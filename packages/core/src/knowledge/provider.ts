/**
 * KnowledgeProvider contract: search/get/context types, mutation type records (P3, TYPE-ONLY
 * in P1 — no mutation channels/handlers exist yet), provider interface, and the provider registry.
 * All interfaces verbatim K-03 §§3.2–3.3 (docs/specs/2026-08-07-siyuan-integration/03-knowledge-provider-contract.md).
 */

import type { KnowledgeCapabilities } from './capabilities.ts';
import type { ContextMode, ContextPayload } from './context.ts';
import { KnowledgeError } from './errors.ts';
import type { KnowledgeKind, KnowledgeRef } from './refs.ts';

// search (provider.ts)

export interface SearchInput {
  query: string;
  kinds?: KnowledgeKind[];        // default: ['document', 'block']
  notebookId?: string;
  pathPrefix?: string;            // '/Research/Reports'
  attributes?: Record<string, string>; // фильтр по SiYuan attributes (domain-сущности §4.3)
  limit?: number;                 // default 20, max 100
  cursor?: string;                // opaque курсор постраничности
}

export interface SearchHit {
  ref: KnowledgeRef;
  title: string;
  snippet: string;                // plain text с контекстом совпадения
  notebookPath: string;
  updatedAt: number;              // epoch ms
  score?: number;
}

export interface SearchPage {
  items: SearchHit[];
  nextCursor?: string;            // отсутствует = последняя страница
  totalEstimate?: number;
}

// get (provider.ts)

export interface KnowledgeAttribute { key: string; value: string; }

export interface KnowledgeNode {
  ref: KnowledgeRef;
  title: string;
  markdown?: string;              // для document/block
  parentRef?: KnowledgeRef;
  path: string;                   // '/Research/Reports/Craft × SiYuan'
  attributes: KnowledgeAttribute[];
  createdAt: number;
  updatedAt: number;
  contentHash: string;            // sha256 нормализованного markdown (см. Открытые вопросы)
  blockCount?: number;            // для document
}

// mutations.ts — TYPE-ONLY declarations for P1: types exist so the contract compiles,
// but P1 ships no mutation channels/handlers (proposeMutation/applyMutation land at P3).

export type MutationOp =
  | { type: 'create-document'; notebookId: string; path: string; markdown: string }
  | { type: 'append-block'; parentId: string; markdown: string }
  | { type: 'update-block'; blockId: string; markdown: string }
  | { type: 'set-attribute'; targetId: string; key: string; value: string };

export interface MutationInput {
  targetRef?: KnowledgeRef;       // обязателен для всех op, кроме create-document
  op: MutationOp;
  baseHash?: string;              // хэш цели, прочитанный агентом до генерации patch
  sessionId?: string;
  summary: string;                // человекочитаемое описание для Craft diff UI
}

export interface MutationProposal {
  id: string;
  connectionId: string;
  sessionId?: string;
  input: MutationInput;
  targetRef: KnowledgeRef;
  baseHash: string;               // зафиксирован при создании; перепроверяется на apply
  diffPreview: {
    before: string;               // markdown цели ДО
    after: string;                // после применения op
    unified?: string;             // unified diff для KnowledgeDiff.tsx (новый компонент §8)
  };
  inversePatch: MutationOp;       // обратная операция (rollback, ADR-004)
  status: 'pending' | 'approved' | 'applied' | 'conflicted' | 'discarded' | 'expired';
  createdAt: number;
  expiresAt: number;
}

export interface ApplyResult {
  proposalId: string;
  applied: boolean;
  conflicted: boolean;            // RE-READ: hash mismatch → applied=false (att1 §11 flow)
  currentHash?: string;           // фактический хэш при конфликте
  appliedAt?: number;
  createdRef?: KnowledgeRef;      // для create-document
  auditId?: string;               // запись в knowledge_audit_log (K-04)
}

// KnowledgeProvider interface (att1 §9, verbatim)

export interface KnowledgeProvider {
  capabilities(): Promise<KnowledgeCapabilities>;
  search(input: SearchInput): Promise<SearchPage>;
  get(ref: KnowledgeRef): Promise<KnowledgeNode>;
  getContext(ref: KnowledgeRef, mode: ContextMode): Promise<ContextPayload>;
  proposeMutation(input: MutationInput): Promise<MutationProposal>;
  applyMutation(proposalId: string): Promise<ApplyResult>;
  open(ref: KnowledgeRef): Promise<void>;
}

// Content hashing — shared by KnowledgeNode.contentHash and MutationProposal.baseHash
// (sha256 of normalized markdown; K-05 §3.1 algorithm placeholder until mutation spec lands).

export function normalizeKnowledgeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/g, '\n').trim();
}

export async function hashKnowledgeContent(markdown: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalizeKnowledgeMarkdown(markdown)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Provider registry (verbatim K-03 §3.3)

export type KnowledgeProviderFactory = (connection: KnowledgeConnection) => KnowledgeProvider;

export interface KnowledgeConnection {
  id: string;                     // knowledge_connections.id (K-04)
  provider: string;               // 'siyuan'
  label: string;
  baseUrl?: string;               // external-local/remote режимы (K-07)
  status: 'connected' | 'degraded' | 'offline' | 'needs_auth';
}

export interface KnowledgeRegistry {
  registerProvider(scheme: string, factory: KnowledgeProviderFactory): void;
  connect(connection: KnowledgeConnection): Promise<KnowledgeProvider>;
  /** Разрешение ref → провайдер: по ref.provider/scheme, иначе default */
  resolve(ref: KnowledgeRef): KnowledgeProvider;
  defaultProvider(): KnowledgeProvider | null;
  list(): KnowledgeConnection[];
}

/**
 * In-process registry. MVP is a single SiYuan connection: the first connected
 * provider becomes the default, and `resolve` falls back to it when no explicit
 * connectionId/provider match exists — no API migration needed for multi-connection later.
 */
export function createKnowledgeRegistry(): KnowledgeRegistry {
  const factories = new Map<string, KnowledgeProviderFactory>();
  const connections = new Map<string, KnowledgeConnection>();
  const providers = new Map<string, KnowledgeProvider>();
  let defaultConnectionId: string | null = null;

  return {
    registerProvider(scheme, factory) {
      factories.set(scheme, factory);
    },
    async connect(connection) {
      const factory = factories.get(connection.provider);
      if (!factory) {
        throw new KnowledgeError(
          'UNSUPPORTED_OPERATION',
          `No knowledge provider factory registered for scheme "${connection.provider}"`,
        );
      }
      const provider = factory(connection);
      connections.set(connection.id, connection);
      providers.set(connection.id, provider);
      defaultConnectionId ??= connection.id;
      return provider;
    },
    resolve(ref) {
      if (ref.connectionId) {
        const byConnection = providers.get(ref.connectionId);
        if (byConnection) return byConnection;
      }
      const scheme = ref.provider ?? ref.scheme;
      for (const [id, connection] of connections) {
        if (connection.provider === scheme) {
          const provider = providers.get(id);
          if (provider) return provider;
        }
      }
      const fallback = defaultConnectionId ? providers.get(defaultConnectionId) : undefined;
      if (fallback) return fallback;
      throw new KnowledgeError('CONNECTION_UNAVAILABLE', `No knowledge provider connected for scheme "${scheme}"`);
    },
    defaultProvider() {
      if (!defaultConnectionId) return null;
      return providers.get(defaultConnectionId) ?? null;
    },
    list() {
      return [...connections.values()];
    },
  };
}
