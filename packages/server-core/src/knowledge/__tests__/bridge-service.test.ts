/**
 * KnowledgeBridgeService tests — spec-05 (K-05) acceptance criteria, end-to-end
 * through the REAL landed pieces: the spec-mandated InMemoryKnowledgeProvider
 * test double (real mutation semantics, engine-driven), the real
 * KnowledgeMutationProposalsStore and the real KnowledgeAuditLog, both rooted
 * in a fresh per-test workspaceRoot mkdtemp (harness mirrored from
 * proposals-store.test.ts, which likewise relies on static imports and
 * per-test tmp dirs).
 *
 * Seam discipline: deps injection ONLY (providerResolver / now /
 * resolvePermissionMode / push). No mock.module, no fetch stubbing — nothing
 * that leaks process-global state into sibling suites.
 *
 * Config discipline: the bridge permission gate is exercised through the
 * injected `resolvePermissionMode` (always 'allow-all' here), so the shared
 * mode-manager and its CONFIG_DIR (a module-load const in shared/config/paths,
 * already bound by the bunfig preload before any test body can run) are never
 * consulted — exactly like proposals-store.test.ts, which needs no
 * CRAFT_CONFIG_DIR manipulation. The `??=` below is belt-and-braces for any
 * late, call-time env reader; it never overrides an inherited value.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import {
  APPROVAL_TTL_MS,
  InMemoryKnowledgeProvider,
  MutationValidationError,
  PartialApplyError,
  ProposalTransitionError,
  computeInverseOps,
  hashKnowledgeContent,
} from '@craft-agent/core/knowledge'
import type {
  ApplyResult,
  KnowledgeNode,
  KnowledgeRef,
  MutationActor,
  MutationInput,
  MutationOp,
  MutationProposal,
  SelectionProof,
} from '@craft-agent/core/knowledge'
import type { KnowledgeChangedPayload } from '@craft-agent/shared/protocol'
import { KnowledgeAuditLog } from '../knowledge-audit'
import { KnowledgeMutationProposalsStore } from '../proposals-store'
import { KnowledgeBridgeService } from '../bridge-service'
import type { KnowledgeBridgeProposeArgs, KnowledgeProposalFileRecord } from '../bridge-service'

process.env.CRAFT_CONFIG_DIR ??= mkdtempSync(join(tmpdir(), 'craft-config-bridge-'))

// ---------------------------------------------------------------------------
// Harness (mirrors proposals-store.test.ts: fresh mkdtemp per test, afterEach cleanup)
// ---------------------------------------------------------------------------

let workspaceRoot: string
const tmpDirs: string[] = []

const T0 = Date.parse('2026-08-07T00:00:00.000Z')
let nowMs = T0

const CONNECTION_ID = 'conn-1'
const DOC_REF: KnowledgeRef = { scheme: 'siyuan', kind: 'document', id: 'doc-1' }
const BLK_REF: KnowledgeRef = { scheme: 'siyuan', kind: 'block', id: 'blk-1' }
const BLK2_REF: KnowledgeRef = { scheme: 'siyuan', kind: 'block', id: 'blk-2' }

const BLOCK_PRE = 'original block line'
const BLOCK_PATCHED = 'patched block line'

function makeDoc(markdown: string): KnowledgeNode {
  return {
    ref: { ...DOC_REF },
    title: 'Doc',
    markdown,
    path: '/Doc',
    attributes: [],
    createdAt: 0,
    updatedAt: 0,
    contentHash: '',
  }
}

function makeBlock(ref: KnowledgeRef, markdown: string): KnowledgeNode {
  return {
    ref: { ...ref },
    title: markdown.slice(0, 40),
    markdown,
    parentRef: { ...DOC_REF },
    path: `/Doc/${ref.id}`,
    attributes: [],
    createdAt: 0,
    updatedAt: 0,
    contentHash: '',
  }
}

function newProvider(...nodes: KnowledgeNode[]): InMemoryKnowledgeProvider {
  return new InMemoryKnowledgeProvider({ connectionId: CONNECTION_ID, seed: { nodes } })
}

function updateProof(ref: KnowledgeRef, selectedAt = new Date(nowMs).toISOString()): SelectionProof {
  return { kind: 'surface-selection', selectionId: `sel-${ref.id}`, ref: { ...ref }, selectedAt }
}

function updateOp(ref: KnowledgeRef, markdown: string): MutationOp {
  return { op: 'updateBlock', blockId: ref.id, markdown }
}

const iso = (ms: number): string => new Date(ms).toISOString()

interface Harness {
  service: KnowledgeBridgeService
  store: KnowledgeMutationProposalsStore
  audit: KnowledgeAuditLog
  pushes: KnowledgeChangedPayload[]
}

function makeHarness(provider: InMemoryKnowledgeProvider): Harness {
  const store = new KnowledgeMutationProposalsStore(workspaceRoot)
  const audit = new KnowledgeAuditLog(workspaceRoot)
  const pushes: KnowledgeChangedPayload[] = []
  const service = new KnowledgeBridgeService({
    providerResolver: async (connectionId) => {
      if (connectionId !== CONNECTION_ID) throw new Error(`unexpected connectionId ${connectionId}`)
      return provider
    },
    proposalsStore: store,
    audit,
    now: () => nowMs,
    resolvePermissionMode: () => 'allow-all',
    push: (payload) => pushes.push(payload),
  })
  return { service, store, audit, pushes }
}

interface AuditLine {
  actor: MutationActor
  action: string
  target: string
  detail?: Record<string, unknown>
}

/** Chronological (oldest-first) audit entries with parsed detail payloads. */
function auditEntries(audit: KnowledgeAuditLog): AuditLine[] {
  return audit
    .read()
    .reverse()
    .map((entry) => ({
      actor: entry.actor as unknown as MutationActor,
      action: entry.action as unknown as string,
      target: entry.target,
      detail: entry.detail === undefined ? undefined : (JSON.parse(entry.detail) as Record<string, unknown>),
    }))
}

function actionsOf(entries: AuditLine[]): string[] {
  return entries.map((entry) => entry.action)
}

/** Ordered-subsequence check: every needle appears in haystack in order. */
function expectOrderedSubsequence(haystack: string[], needles: string[]): void {
  let cursor = 0
  for (const needle of needles) {
    const found = haystack.indexOf(needle, cursor)
    expect(found).toBeGreaterThanOrEqual(cursor)
    cursor = found + 1
  }
}

/** Standard propose input against BLK_REF with a fresh proof (updateBlock lane). */
function blockUpdateInput(markdown: string): KnowledgeBridgeProposeArgs['input'] {
  return {
    targetRef: BLK_REF,
    ops: [updateOp(BLK_REF, markdown)],
    selectionProofs: [updateProof(BLK_REF)],
    sessionId: 'sess-1',
  }
}

/** Drive the happy path up to (and including) approval against a seeded block. */
async function proposeAndApproveBlock(
  service: KnowledgeBridgeService,
  markdown = BLOCK_PATCHED,
): Promise<KnowledgeProposalFileRecord> {
  const proposed = await service.propose({ connectionId: CONNECTION_ID, input: blockUpdateInput(markdown) })
  return service.approve(proposed.id)
}

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'knowledge-bridge-'))
  tmpDirs.push(workspaceRoot)
  nowMs = T0
})

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// (1) T1 propose: draft → pending_review, base capture, typed guard rejection
// ---------------------------------------------------------------------------

describe('propose (T1)', () => {
  it('creates a pending_review proposal with captured baseHash/baseReadAt/preState + rendered diff', async () => {
    const provider = newProvider(makeDoc('doc content'), makeBlock(BLK_REF, BLOCK_PRE))
    const { service, store, pushes } = makeHarness(provider)

    const record = await service.propose({ connectionId: CONNECTION_ID, input: blockUpdateInput(BLOCK_PATCHED) })

    expect(record.id.startsWith('p_')).toBe(true)
    expect(record.status).toBe('pending_review')
    expect(record.connectionId).toBe(CONNECTION_ID)
    expect(record.targetRef).toEqual(BLK_REF)
    expect(record.actor).toBe('user')

    // base capture
    expect(record.baseHash).toBe(await hashKnowledgeContent(BLOCK_PRE))
    expect(record.baseReadAt).toBe(iso(T0))
    expect(record.preState).toBe(BLOCK_PRE)
    expect(record.preStateAttributes).toEqual({ [BLK_REF.id]: {} })
    expect(record.hashAlgorithm).toBe('sha256-canonical-v1')

    // T2 rode in the same call: diff rendered as unified text and persisted
    expect(record.diff?.startsWith('--- base\n+++ patched\n')).toBe(true)
    expect(record.diff).toContain(`-${BLOCK_PRE}`)
    expect(record.diff).toContain(`+${BLOCK_PATCHED}`)
    expect(record.statusHistory).toEqual([{ from: 'draft', to: 'pending_review', at: iso(T0), actor: 'user' }])

    // persisted verbatim in the real store; knowledge:changed fanned out (T2 immediate)
    expect(store.get(record.id)?.status).toBe('pending_review')
    expect(pushes).toEqual([{ ref: BLK_REF, change: 'updated' }])
  })

  it('audits proposal.created then proposal.reviewed around the draft→pending_review hop', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service, audit } = makeHarness(provider)

    const record = await service.propose({ connectionId: CONNECTION_ID, input: blockUpdateInput(BLOCK_PATCHED) })
    const entries = auditEntries(audit)

    expectOrderedSubsequence(actionsOf(entries), ['knowledge.proposal.created', 'knowledge.proposal.reviewed'])
    const created = entries.find((entry) => entry.action === 'knowledge.proposal.created')
    expect(created?.actor).toBe('user')
    expect(created?.detail).toMatchObject({ proposalId: record.id, ops: ['updateBlock'] })
    const reviewed = entries.find((entry) => entry.action === 'knowledge.proposal.reviewed')
    expect(reviewed?.detail).toMatchObject({ proposalId: record.id, sessionId: 'sess-1' })
  })

  it('rejects updateBlock without a selection proof: typed error + audited rejection, no file created', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service, store, audit } = makeHarness(provider)

    const error = await service
      .propose({
        connectionId: CONNECTION_ID,
        input: { targetRef: BLK_REF, ops: [updateOp(BLK_REF, BLOCK_PATCHED)], sessionId: 'sess-1' },
      })
      .then(
        () => null,
        (caught: unknown) => caught,
      )

    expect(error).toBeInstanceOf(MutationValidationError)
    expect((error as MutationValidationError).reason).toBe('missing-selection-proof')

    const rejected = auditEntries(audit).find((entry) => entry.action === 'knowledge.proposal.rejected')
    expect(rejected).toBeDefined()
    expect(rejected?.detail).toMatchObject({ reason: 'missing-selection-proof', connectionId: CONNECTION_ID, sessionId: 'sess-1' })

    // §3.4.1 admission guards run BEFORE the READ: no proposal file ever existed
    expect(store.list()).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// (2) T3 approve: pending_review only, approvedBy 'user', engine inverse ops
// ---------------------------------------------------------------------------

describe('approve (T3)', () => {
  it('approves from pending_review with approvedBy=user and inverse ops matching core computeInverseOps', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service, audit } = makeHarness(provider)
    const proposed = await service.propose({ connectionId: CONNECTION_ID, input: blockUpdateInput(BLOCK_PATCHED) })

    const record = await service.approve(proposed.id)

    expect(record.status).toBe('approved')
    expect(record.approvedBy).toBe('user')
    expect(record.approvedAt).toBe(iso(T0))
    const expectedInverse = computeInverseOps(
      { content: BLOCK_PRE, attributes: { [BLK_REF.id]: {} } },
      [updateOp(BLK_REF, BLOCK_PATCHED)],
      { at: iso(T0) },
    )
    expect(record.inverseOps).toEqual(expectedInverse)
    expect(record.statusHistory.at(-1)).toEqual({ from: 'pending_review', to: 'approved', at: iso(T0), actor: 'user' })
    expect(actionsOf(auditEntries(audit))).toContain('knowledge.proposal.approved')
  })

  it('throws a typed ProposalTransitionError from draft', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service, store } = makeHarness(provider)
    // A draft-state record exists only pre-T2; seed one directly into the dumb store.
    const createdAt = iso(T0)
    store.save({
      id: 'p_draftseed',
      connectionId: CONNECTION_ID,
      targetRef: BLK_REF,
      ops: [updateOp(BLK_REF, BLOCK_PATCHED)],
      selectionProofs: [updateProof(BLK_REF)],
      baseHash: await hashKnowledgeContent(BLOCK_PRE),
      baseReadAt: createdAt,
      preState: BLOCK_PRE,
      hashAlgorithm: 'sha256-canonical-v1',
      status: 'draft',
      statusHistory: [],
      createdAt,
      actor: 'user',
    })

    const error = await service.approve('p_draftseed').then(
      () => null,
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(ProposalTransitionError)
    expect((error as ProposalTransitionError).from).toBe('draft')
  })

  it('refuses a second approve (approved idempotent guard) with a typed error', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service } = makeHarness(provider)
    const approved = await proposeAndApproveBlock(service)

    const error = await service.approve(approved.id).then(
      () => null,
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(ProposalTransitionError)
    expect((error as ProposalTransitionError).from).toBe('approved')
    // the stored record is untouched by the failed re-approve
    expect(service.get(approved.id)?.status).toBe('approved')
  })
})

// ---------------------------------------------------------------------------
// (3)+(4) T5/T6 apply: happy path and wrong-status typed errors
// ---------------------------------------------------------------------------

describe('apply (T5/T6)', () => {
  it('applies an approved appendBlock: provider executes, record applied with post-apply hash, audit applied', async () => {
    const docMarkdown = 'line one\nline two'
    const provider = newProvider(makeDoc(docMarkdown))
    const { service, audit } = makeHarness(provider)
    const ops: MutationOp[] = [{ op: 'appendBlock', documentId: DOC_REF.id, markdown: 'new tail' }]
    const proposed = await service.propose({
      connectionId: CONNECTION_ID,
      input: { targetRef: DOC_REF, ops, sessionId: 'sess-1' },
    })
    await service.approve(proposed.id)

    nowMs = T0 + 60_000
    const result = await service.apply(proposed.id)

    expect(result).toMatchObject({ proposalId: proposed.id, applied: true, conflicted: false, status: 'applied' })
    expect(result.createdRef?.kind).toBe('block')

    // InMemory executed the append: the kernel-created child block exists with the payload
    const created = await provider.get(result.createdRef!)
    expect(created.markdown).toBe('new tail')

    // verify RE-READ: post-apply hash differs from base and is persisted on the record
    const record = service.get(proposed.id)!
    expect(record.status).toBe('applied')
    expect(record.appliedAt).toBe(result.appliedAt)
    expect(record.appliedHash).toBe(await hashKnowledgeContent('new tail'))
    expect(record.appliedHash).not.toBe(record.baseHash)

    // §3.8: $insertedBlockId[0] placeholders in inverse ops bound to the created ref
    expect(record.inverseOps?.[0]).toMatchObject({ op: 'updateBlock', blockId: result.createdRef!.id })
    expect(record.inverseOps?.[1]).toMatchObject({
      op: 'setAttribute',
      blockId: result.createdRef!.id,
      name: 'craft-rolled-back',
      value: 'true',
    })

    expect(actionsOf(auditEntries(audit))).toContain('knowledge.proposal.applied')
  })

  it('throws a typed ProposalTransitionError when applying from draft, pending_review, or conflict', async () => {
    // draft (seeded directly — a bridge proposal never rests in draft)
    {
      const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
      const { service, store } = makeHarness(provider)
      const createdAt = iso(T0)
      store.save({
        id: 'p_draftseed',
        connectionId: CONNECTION_ID,
        targetRef: BLK_REF,
        ops: [updateOp(BLK_REF, BLOCK_PATCHED)],
        selectionProofs: [],
        baseHash: 'base',
        baseReadAt: createdAt,
        preState: BLOCK_PRE,
        hashAlgorithm: 'sha256-canonical-v1',
        status: 'draft',
        statusHistory: [],
        createdAt,
        actor: 'user',
      })
      await expect(service.apply('p_draftseed')).rejects.toBeInstanceOf(ProposalTransitionError)
    }

    // pending_review
    {
      const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
      const { service } = makeHarness(provider)
      const proposed = await service.propose({ connectionId: CONNECTION_ID, input: blockUpdateInput(BLOCK_PATCHED) })
      await expect(service.apply(proposed.id)).rejects.toBeInstanceOf(ProposalTransitionError)
    }

    // conflict (real T7 flow: tampered between approve and apply)
    {
      const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
      const { service } = makeHarness(provider)
      const approved = await proposeAndApproveBlock(service)
      provider.seed({ nodes: [makeBlock(BLK_REF, 'tampered content')] })
      const conflicted = await service.apply(approved.id)
      expect(conflicted.status).toBe('conflict')
      await expect(service.apply(approved.id)).rejects.toBeInstanceOf(ProposalTransitionError)
      expect(service.get(approved.id)?.status).toBe('conflict')
    }
  })
})

// ---------------------------------------------------------------------------
// (5) T7 conflict: drift between propose and apply — zero writes, full info
// ---------------------------------------------------------------------------

describe('apply conflict (T7)', () => {
  it('reports conflict with conflictInfo, writes nothing to the provider, and audits conflict', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service, audit, pushes, store } = makeHarness(provider)
    const approved = await proposeAndApproveBlock(service)

    // target drifted between READ (T1) and apply
    provider.seed({ nodes: [makeDoc('doc content'), makeBlock(BLK_REF, 'tampered content')] })

    const baseHash = await hashKnowledgeContent(BLOCK_PRE)
    const result = await service.apply(approved.id)

    expect(result.applied).toBe(false)
    expect(result.conflicted).toBe(true)
    expect(result.status).toBe('conflict')
    expect(result.reason).toBe('hash-mismatch')
    expect(result.currentHash).toBe(await hashKnowledgeContent('tampered content'))
    expect(result.conflictInfo).toEqual({
      baseHash,
      baseReadAt: iso(T0),
      actualHash: await hashKnowledgeContent('tampered content'),
      currentContent: 'tampered content',
      reason: 'hash-mismatch',
    })

    // T7: НИЧЕГО не пишется — the provider still holds the tampered content verbatim
    expect((await provider.get(BLK_REF)).markdown).toBe('tampered content')

    const record = service.get(approved.id)!
    expect(record.status).toBe('conflict')
    expect(record.conflictInfo).toEqual(result.conflictInfo)
    expect(store.get(approved.id)?.status).toBe('conflict')

    const conflictEntry = auditEntries(audit).find((entry) => entry.action === 'knowledge.proposal.conflict')
    expect(conflictEntry?.actor).toBe('automation')
    expect(conflictEntry?.detail).toMatchObject({ proposalId: approved.id, reason: 'hash-mismatch' })
    expect(pushes.at(-1)).toEqual({ ref: BLK_REF, change: 'updated' })
  })
})

// ---------------------------------------------------------------------------
// (6) T10 rollback: applied → rolled_back, provider back at preState
// ---------------------------------------------------------------------------

describe('rollback (T10)', () => {
  it('rolls back an applied updateBlock: provider returns to preState and the audit chain is complete', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service, audit } = makeHarness(provider)
    const approved = await proposeAndApproveBlock(service)

    nowMs = T0 + 60_000
    const applied = await service.apply(approved.id)
    expect(applied.status).toBe('applied')
    expect((await provider.get(BLK_REF)).markdown).toBe(BLOCK_PATCHED)

    nowMs = T0 + 120_000
    const rolled = await service.rollback(approved.id)

    expect(rolled).toMatchObject({ applied: true, conflicted: false, status: 'rolled_back', appliedAt: iso(nowMs) })

    // provider content is byte-identical to the captured preState (hash equality)
    const content = (await provider.get(BLK_REF)).markdown ?? ''
    expect(content).toBe(BLOCK_PRE)
    expect(await hashKnowledgeContent(content)).toBe(await hashKnowledgeContent(BLOCK_PRE))

    const record = service.get(approved.id)!
    expect(record.status).toBe('rolled_back')
    expect(record.rolledBackAt).toBe(iso(nowMs))

    // §3.2/§3.8 chain: created → approved → applied → rolled_back
    expectOrderedSubsequence(actionsOf(auditEntries(audit)), [
      'knowledge.proposal.created',
      'knowledge.proposal.approved',
      'knowledge.proposal.applied',
      'knowledge.proposal.rolled_back',
    ])
  })

  it('throws a typed ProposalTransitionError when rolling back a non-applied proposal', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service } = makeHarness(provider)
    const approved = await proposeAndApproveBlock(service)
    await expect(service.rollback(approved.id)).rejects.toBeInstanceOf(ProposalTransitionError)
  })
})

// ---------------------------------------------------------------------------
// (7) §3.7 approval TTL: apply rejection + lazy sweep demotion
// ---------------------------------------------------------------------------

describe('approval expiry (§3.7)', () => {
  it('rejects apply past APPROVAL_TTL_MS and returns the proposal to pending_review with audit', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service, audit } = makeHarness(provider)
    const approved = await proposeAndApproveBlock(service)

    nowMs = T0 + APPROVAL_TTL_MS + 1
    const result = await service.apply(approved.id)

    expect(result).toMatchObject({ applied: false, conflicted: false, status: 'pending_review', reason: 'approval-expired' })
    const record = service.get(approved.id)!
    expect(record.status).toBe('pending_review')
    expect(record.approvedBy).toBeUndefined()
    expect(record.approvedAt).toBeUndefined()
    expect(actionsOf(auditEntries(audit))).toContain('knowledge.proposal.approval-expired')
  })

  it('sweepExpired demotes the approved record to pending_review and audits approval_expired', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service, audit } = makeHarness(provider)
    const approved = await proposeAndApproveBlock(service)

    nowMs = T0 + APPROVAL_TTL_MS + 1
    const swept = await service.sweepExpired()

    expect(swept.approvalExpired).toEqual([approved.id])
    expect(swept.discarded).toEqual([])
    expect(service.get(approved.id)?.status).toBe('pending_review')

    const expired = auditEntries(audit).find((entry) => entry.action === 'knowledge.proposal.approval_expired')
    expect(expired).toBeDefined()
    expect(expired?.actor).toBe('automation')
    expect(expired?.detail).toMatchObject({ proposalId: approved.id, reason: 'approval-expired' })
  })
})

// ---------------------------------------------------------------------------
// (8) partial apply: sabotaged provider fails op 2 → compensated conflict
// ---------------------------------------------------------------------------

describe('partial apply (§3.2 invariant)', () => {
  it('maps a second-op provider failure to conflict reason=partial-apply-rolled-back', async () => {
    /** DI seam: InMemory with a sabotaged mutation stage — op 2 dies after op 1 landed. */
    class SabotagedProvider extends InMemoryKnowledgeProvider {
      override async proposeMutation(): Promise<MutationProposal> {
        return { id: 'sabotaged-proposal' } as MutationProposal
      }
      override async applyMutation(): Promise<ApplyResult> {
        throw new PartialApplyError(1, [updateOp(BLK_REF, BLOCK_PRE)], { cause: new Error('kernel write failed') })
      }
    }
    const provider = new SabotagedProvider({
      connectionId: CONNECTION_ID,
      seed: { nodes: [makeBlock(BLK_REF, BLOCK_PRE), makeBlock(BLK2_REF, 'second block')] },
    })
    const { service, audit } = makeHarness(provider)
    const ops: MutationOp[] = [updateOp(BLK_REF, 'patched one'), updateOp(BLK2_REF, 'patched two')]
    const proposed = await service.propose({
      connectionId: CONNECTION_ID,
      input: {
        targetRef: BLK_REF,
        ops,
        selectionProofs: [updateProof(BLK_REF), updateProof(BLK2_REF)],
        sessionId: 'sess-1',
      },
    })
    await service.approve(proposed.id)

    const result = await service.apply(proposed.id)

    expect(result.applied).toBe(false)
    expect(result.conflicted).toBe(true)
    expect(result.status).toBe('conflict')
    expect(result.reason).toBe('partial-apply-rolled-back')

    const record = service.get(proposed.id)!
    expect(record.status).toBe('conflict')
    expect(record.conflictInfo?.reason).toBe('partial-apply-rolled-back')

    const conflictEntry = auditEntries(audit).find((entry) => entry.action === 'knowledge.proposal.conflict')
    expect(conflictEntry?.actor).toBe('automation')
    expect(conflictEntry?.detail).toMatchObject({ proposalId: proposed.id, reason: 'partial-apply-rolled-back', failedOpIndex: 1 })
  })
})

// ---------------------------------------------------------------------------
// (9) actors: automation may propose; approval is always the human
// ---------------------------------------------------------------------------

describe('actors (§3.6)', () => {
  it('lets an automation actor propose but records approve as approvedBy=user', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service, audit } = makeHarness(provider)

    const proposed = await service.propose({
      connectionId: CONNECTION_ID,
      input: { ...blockUpdateInput(BLOCK_PATCHED), actor: 'automation' },
    })
    expect(proposed.status).toBe('pending_review')
    expect(proposed.actor).toBe('automation')

    const approved = await service.approve(proposed.id)
    expect(approved.status).toBe('approved')
    expect(approved.actor).toBe('automation') // originator preserved…
    expect(approved.approvedBy).toBe('user') // …but v1 approval is always the human (§3.2 T3)
    expect(approved.statusHistory.at(-1)?.actor).toBe('user')

    const created = auditEntries(audit).find((entry) => entry.action === 'knowledge.proposal.created')
    expect(created?.actor).toBe('automation')
  })
})

// ---------------------------------------------------------------------------
// (10) T4 reject: the proposal file is deleted
// ---------------------------------------------------------------------------

describe('reject (T4)', () => {
  it('deletes the record file for a pending_review proposal and audits the rejection', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service, store, audit } = makeHarness(provider)
    const proposed = await service.propose({ connectionId: CONNECTION_ID, input: blockUpdateInput(BLOCK_PATCHED) })
    const filePath = join(store.proposalsDir, `${proposed.id}.json`)
    expect(existsSync(filePath)).toBe(true)

    const result = await service.reject(proposed.id)

    expect(result).toEqual({ ok: true })
    expect(existsSync(filePath)).toBe(false)
    expect(store.get(proposed.id)).toBeNull()
    const rejected = auditEntries(audit).find((entry) => entry.action === 'knowledge.proposal.rejected')
    expect(rejected?.actor).toBe('user')
    expect(rejected?.detail).toMatchObject({ proposalId: proposed.id, reason: 'user-discard', from: 'pending_review' })
  })

  it('deletes the record file for an approved proposal (explicit discard path)', async () => {
    const provider = newProvider(makeBlock(BLK_REF, BLOCK_PRE))
    const { service, store, audit } = makeHarness(provider)
    const approved = await proposeAndApproveBlock(service)
    const filePath = join(store.proposalsDir, `${approved.id}.json`)
    expect(existsSync(filePath)).toBe(true)

    await service.reject(approved.id)

    expect(existsSync(filePath)).toBe(false)
    expect(store.get(approved.id)).toBeNull()
    const rejected = auditEntries(audit).find((entry) => entry.action === 'knowledge.proposal.rejected')
    expect(rejected?.detail).toMatchObject({ proposalId: approved.id, reason: 'user-discard', from: 'approved' })
  })
})
