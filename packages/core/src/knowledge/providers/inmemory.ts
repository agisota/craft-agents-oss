/**
 * InMemoryKnowledgeProvider — full in-memory implementation of the KnowledgeProvider
 * contract (K-03 §3.3: «полная реализация в памяти для unit/component-тестов»).
 *
 * Mutation semantics (documented choice for the P1 batch): instead of throwing for the
 * P3-only methods, the provider implements the full READ → CAPTURE BASE HASH → LOCAL PATCH
 * flow in memory. proposeMutation builds diffPreview/inversePatch without touching the graph;
 * applyMutation re-reads the target and enforces the hash-conflict check (conflicted=true on
 * mismatch). This keeps the FULL interface live for contract-conformance tests; nothing is persisted.
 */

import type { KnowledgeCapabilities } from '../capabilities.ts';
import type { ContextMode, ContextPayload } from '../context.ts';
import { KnowledgeError } from '../errors.ts';
import {
  hashKnowledgeContent,
  type ApplyResult,
  type KnowledgeNode,
  type KnowledgeProvider,
  type MutationInput,
  type MutationOp,
  type MutationProposal,
  type SearchInput,
  type SearchPage,
} from '../provider.ts';
import { siyuanDeepLink, validateKnowledgeRef, type KnowledgeRef } from '../refs.ts';

export interface InMemoryKnowledgeLink {
  /** source node references target node → target's backlinks include source */
  sourceId: string;
  targetId: string;
}

export interface InMemoryKnowledgeSeed {
  nodes?: KnowledgeNode[];
  links?: InMemoryKnowledgeLink[];
}

export interface InMemoryKnowledgeProviderOptions {
  connectionId?: string;
  capabilities?: KnowledgeCapabilities;
  seed?: InMemoryKnowledgeSeed;
}

interface PendingMutation {
  targetId: string | null;
  preAllocatedId?: string;
}

const PROPOSAL_TTL_MS = 15 * 60_000;

function snippetOf(node: KnowledgeNode, query: string): string {
  const text = (node.markdown ?? node.title).replace(/\s+/g, ' ').trim();
  const index = query ? text.toLowerCase().indexOf(query) : -1;
  const start = index > 40 ? index - 40 : 0;
  const end = index >= 0 ? index + query.length + 40 : 80;
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

export class InMemoryKnowledgeProvider implements KnowledgeProvider {
  readonly connectionId: string;
  /** Test hook: deep links recorded by open() in call order. */
  readonly openedDeepLinks: string[] = [];

  private readonly nodes = new Map<string, KnowledgeNode>();
  private readonly links: InMemoryKnowledgeLink[] = [];
  private readonly proposals = new Map<string, MutationProposal>();
  private readonly pendingMutations = new Map<string, PendingMutation>();
  private readonly caps: KnowledgeCapabilities;
  private sequence = 0;

  constructor(options: InMemoryKnowledgeProviderOptions = {}) {
    this.connectionId = options.connectionId ?? 'inmemory';
    this.caps = options.capabilities ?? {
      provider: 'memory',
      version: '0.0.0-inmemory',
      minSupportedVersion: '0.0.0',
      features: {
        search: true,
        backlinks: true,
        attributes: true,
        databases: true,
        assets: true,
        liveReference: true,
        watch: false,
        deepLinks: true,
      },
      mutations: {
        createDocument: true,
        appendBlock: true,
        updateBlock: true,
        setAttribute: true,
        transactions: false,
        rollback: true,
      },
    };
    this.seed(options.seed ?? {});
  }

  /** Bulk load; can also be used between calls as a test hook that replaces a node. */
  seed(seed: InMemoryKnowledgeSeed): void {
    for (const node of seed.nodes ?? []) {
      this.nodes.set(node.ref.id, structuredClone(node));
    }
    for (const link of seed.links ?? []) {
      this.links.push({ ...link });
    }
  }

  async capabilities(): Promise<KnowledgeCapabilities> {
    return structuredClone(this.caps);
  }

  async search(input: SearchInput): Promise<SearchPage> {
    const kinds = input.kinds ?? ['document', 'block'];
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
    const query = input.query.trim().toLowerCase();

    const matched = [...this.nodes.values()].filter((node) => {
      if (!kinds.includes(node.ref.kind)) return false;
      if (input.notebookId && this.notebookIdOf(node) !== input.notebookId) return false;
      if (input.pathPrefix && !node.path.startsWith(input.pathPrefix)) return false;
      if (input.attributes) {
        for (const [key, value] of Object.entries(input.attributes)) {
          if (node.attributes.find((attribute) => attribute.key === key)?.value !== value) return false;
        }
      }
      if (query && !`${node.title}\n${node.markdown ?? ''}`.toLowerCase().includes(query)) return false;
      return true;
    });
    matched.sort((a, b) => b.updatedAt - a.updatedAt || a.ref.id.localeCompare(b.ref.id));

    const items = matched.slice(offset, offset + limit).map((node) => {
      const notebookId = this.notebookIdOf(node);
      return {
        ref: { ...node.ref },
        title: node.title,
        snippet: snippetOf(node, query),
        notebookPath: notebookId ? (this.nodes.get(notebookId)?.path ?? '') : '',
        updatedAt: node.updatedAt,
      };
    });
    const page: SearchPage = { items, totalEstimate: matched.length };
    if (offset + limit < matched.length) page.nextCursor = String(offset + limit);
    return page;
  }

  async get(ref: KnowledgeRef): Promise<KnowledgeNode> {
    const node = structuredClone(this.nodeOrThrow(validateKnowledgeRef(ref).id));
    if (node.ref.kind === 'document') node.blockCount = this.childrenOf(node.ref.id).length;
    return node;
  }

  async getContext(ref: KnowledgeRef, mode: ContextMode): Promise<ContextPayload> {
    if (mode === 'live-reference' && !this.caps.features.liveReference) {
      throw new KnowledgeError(
        'UNSUPPORTED_OPERATION',
        `Provider "${this.caps.provider}" does not support live-reference context`,
      );
    }
    const node = await this.get(ref);
    const markdown = node.markdown ?? '';
    const backlinks: ContextPayload['backlinks'] = [];
    for (const link of this.links) {
      if (link.targetId !== node.ref.id) continue;
      const source = this.nodes.get(link.sourceId);
      if (source) backlinks.push({ ref: { ...source.ref }, title: source.title });
    }
    return {
      ref,
      mode,
      blockId: node.ref.id,
      content: markdown,
      children: this.childrenOf(node.ref.id).map((child) => ({ blockId: child.ref.id, content: child.markdown ?? '' })),
      backlinks,
      attributes: node.attributes.map((attribute) => ({ ...attribute })),
      capturedAt: Date.now(),
      contentHash: await hashKnowledgeContent(markdown),
    };
  }

  async proposeMutation(input: MutationInput): Promise<MutationProposal> {
    const op = input.op;
    const capabilityByOp: Record<MutationOp['type'], boolean> = {
      'create-document': this.caps.mutations.createDocument,
      'append-block': this.caps.mutations.appendBlock,
      'update-block': this.caps.mutations.updateBlock,
      'set-attribute': this.caps.mutations.setAttribute,
    };
    if (!capabilityByOp[op.type]) {
      throw new KnowledgeError('UNSUPPORTED_OPERATION', `Provider "${this.caps.provider}" does not support mutation "${op.type}"`);
    }

    const createdAt = Date.now();
    const id = `inmem-proposal-${++this.sequence}`;
    let targetRef: KnowledgeRef;
    let preAllocatedId: string | undefined;
    let diffPreview: MutationProposal['diffPreview'];
    let inversePatch: MutationOp;
    let pendingTargetId: string | null;
    let baseHash: string;

    if (op.type === 'create-document') {
      const notebook = this.nodeOrThrow(op.notebookId);
      if (notebook.ref.kind !== 'notebook') {
        throw new KnowledgeError('INVALID_REF', `Mutation "create-document" needs a notebook target, got ${notebook.ref.kind} "${op.notebookId}"`);
      }
      targetRef = { scheme: 'siyuan', kind: 'document', id: `inmem-document-${++this.sequence}` };
      preAllocatedId = targetRef.id;
      diffPreview = { before: '', after: op.markdown };
      // In-memory approximation of delete (no delete op in MutationOp): rollback empties the created doc.
      inversePatch = { type: 'update-block', blockId: targetRef.id, markdown: '' };
      pendingTargetId = null;
      baseHash = await hashKnowledgeContent('');
    } else {
      if (!input.targetRef) {
        throw new KnowledgeError('INVALID_REF', `Mutation "${op.type}" requires targetRef`);
      }
      const target = this.nodeOrThrow(validateKnowledgeRef(input.targetRef).id);
      const opTargetId = op.type === 'append-block' ? op.parentId : op.type === 'update-block' ? op.blockId : op.targetId;
      if (opTargetId !== target.ref.id) {
        throw new KnowledgeError('INVALID_REF', `Mutation target "${opTargetId}" does not match targetRef "${target.ref.id}"`);
      }
      const before = target.markdown ?? '';
      switch (op.type) {
        case 'append-block': {
          preAllocatedId = `inmem-block-${++this.sequence}`;
          diffPreview = { before, after: before ? `${before}\n${op.markdown}` : op.markdown };
          // Rollback empties the appended child (no delete op in MutationOp).
          inversePatch = { type: 'update-block', blockId: preAllocatedId, markdown: '' };
          break;
        }
        case 'update-block': {
          diffPreview = { before, after: op.markdown };
          inversePatch = { type: 'update-block', blockId: op.blockId, markdown: before };
          break;
        }
        case 'set-attribute': {
          const old = target.attributes.find((attribute) => attribute.key === op.key)?.value ?? '';
          diffPreview = { before: `${op.key}=${old}`, after: `${op.key}=${op.value}` };
          inversePatch = { type: 'set-attribute', targetId: op.targetId, key: op.key, value: old };
          break;
        }
      }
      targetRef = { ...target.ref };
      pendingTargetId = target.ref.id;
      baseHash = await hashKnowledgeContent(before);
    }

    const proposal: MutationProposal = {
      id,
      connectionId: this.connectionId,
      sessionId: input.sessionId,
      input,
      targetRef,
      baseHash,
      diffPreview,
      inversePatch,
      status: 'pending',
      createdAt,
      expiresAt: createdAt + PROPOSAL_TTL_MS,
    };
    this.proposals.set(id, proposal);
    this.pendingMutations.set(id, { targetId: pendingTargetId, preAllocatedId });
    return structuredClone(proposal);
  }

  async applyMutation(proposalId: string): Promise<ApplyResult> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new KnowledgeError('NOT_FOUND', `Mutation proposal "${proposalId}" not found`);
    if (proposal.status !== 'pending') {
      throw new KnowledgeError('PROVIDER_ERROR', `Mutation proposal "${proposalId}" is ${proposal.status}, cannot apply`);
    }
    const pending = this.pendingMutations.get(proposalId);
    if (!pending) throw new KnowledgeError('PROVIDER_ERROR', `Mutation proposal "${proposalId}" lost its pending op`);
    const op = proposal.input.op;

    if (op.type !== 'create-document') {
      const target = pending.targetId ? this.nodes.get(pending.targetId) : undefined;
      if (!target) throw new KnowledgeError('NOT_FOUND', `Mutation target "${pending.targetId}" no longer exists`);
      const currentHash = await hashKnowledgeContent(target.markdown ?? '');
      if (currentHash !== proposal.baseHash) {
        proposal.status = 'conflicted';
        return { proposalId, applied: false, conflicted: true, currentHash };
      }
    }

    const now = Date.now();
    let createdRef: KnowledgeRef | undefined;
    if (op.type === 'create-document') {
      const notebook = this.nodeOrThrow(op.notebookId);
      const id = pending.preAllocatedId;
      if (!id) throw new KnowledgeError('PROVIDER_ERROR', `Mutation proposal "${proposalId}" lost its pre-allocated id`);
      createdRef = { scheme: 'siyuan', kind: 'document', id };
      this.nodes.set(id, {
        ref: createdRef,
        title: op.path.split('/').filter(Boolean).pop() ?? op.path,
        markdown: op.markdown,
        parentRef: { ...notebook.ref },
        path: op.path,
        attributes: [],
        createdAt: now,
        updatedAt: now,
        contentHash: await hashKnowledgeContent(op.markdown),
        blockCount: 0,
      });
    } else if (op.type === 'append-block') {
      const parent = this.nodeOrThrow(op.parentId);
      const childId = pending.preAllocatedId;
      if (!childId) throw new KnowledgeError('PROVIDER_ERROR', `Mutation proposal "${proposalId}" lost its pre-allocated id`);
      parent.updatedAt = now;
      parent.contentHash = await hashKnowledgeContent(parent.markdown ?? '');
      createdRef = { scheme: 'siyuan', kind: 'block', id: childId };
      this.nodes.set(childId, {
        ref: createdRef,
        title: (op.markdown.split('\n')[0] ?? '').slice(0, 80),
        markdown: op.markdown,
        parentRef: { ...parent.ref },
        path: `${parent.path}/${childId}`,
        attributes: [],
        createdAt: now,
        updatedAt: now,
        contentHash: await hashKnowledgeContent(op.markdown),
      });
    } else if (op.type === 'update-block') {
      const target = this.nodeOrThrow(op.blockId);
      target.markdown = op.markdown;
      target.updatedAt = now;
      target.contentHash = await hashKnowledgeContent(op.markdown);
    } else {
      const target = this.nodeOrThrow(op.targetId);
      const existing = target.attributes.find((attribute) => attribute.key === op.key);
      if (existing) existing.value = op.value;
      else target.attributes.push({ key: op.key, value: op.value });
      target.updatedAt = now;
    }

    proposal.status = 'applied';
    const result: ApplyResult = { proposalId, applied: true, conflicted: false, appliedAt: now };
    if (createdRef) result.createdRef = createdRef;
    return result;
  }

  async open(ref: KnowledgeRef): Promise<void> {
    const valid = validateKnowledgeRef(ref);
    this.nodeOrThrow(valid.id);
    this.openedDeepLinks.push(siyuanDeepLink(valid));
  }

  private nodeOrThrow(id: string): KnowledgeNode {
    const node = this.nodes.get(id);
    if (!node) throw new KnowledgeError('NOT_FOUND', `Knowledge node "${id}" not found`);
    return node;
  }

  private childrenOf(id: string): KnowledgeNode[] {
    return [...this.nodes.values()].filter((node) => node.parentRef?.id === id);
  }

  private notebookIdOf(node: KnowledgeNode): string | undefined {
    let current = node;
    const seen = new Set<string>([current.ref.id]);
    while (current.parentRef) {
      const parent = this.nodes.get(current.parentRef.id);
      if (!parent || seen.has(parent.ref.id)) return undefined;
      if (parent.ref.kind === 'notebook') return parent.ref.id;
      seen.add(parent.ref.id);
      current = parent;
    }
    return undefined;
  }
}
