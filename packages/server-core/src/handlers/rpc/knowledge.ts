/**
 * Knowledge provider RPC handlers — 9 read channels (P1, spec
 * 2026-08-07-siyuan-integration/03 §§3.2–3.6, storage per spec 04 §3.3) plus
 * 7 write-back mutation-proposal channels (P3, spec 05 05-mutation-safety.md)
 * plus 8 Session→Knowledge publication channels (P4, spec 06).
 *
 * WRITE-BACK BOUNDARY: HANDLED_CHANNELS below is exactly the 9 spec-03 read
 * channels + the 7 spec-05 proposal channels + the 8 spec-06 publication
 * channels. Every mutation channel routes through KnowledgeBridgeService
 * (the spec-05 pipeline: validate → base-hash → draft → diff → review → apply,
 * with inverse-ops rollback) — no direct provider write path is registered
 * from this file, and engine-lifecycle channels remain P7 and absent by
 * design. Publication APPLY only creates a proposal; FINALIZE commits
 * publications/links after the proposal reaches 'applied' via P3 UI.
 *
 * Proposal wiring: one memoized KnowledgeBridgeService per workspace root —
 * proposals/audit are workspace data at {root}/knowledge/{proposals,
 * audit.jsonl} while connections stay global. proposeMutation resolves its
 * workspace from the connection's credentialRef
 * (`source_bearer::{workspaceId}::…`, the same parse as readToken);
 * proposal-id-only channels locate their workspace by scanning
 * getWorkspaces(). The bridge `push` dep fans out as knowledge:changed with
 * {ref, change:'updated'} after created/approved/applied/conflict/
 * rolled_back transitions.
 *
 * Provider wiring: every content channel resolves connectionId → record from
 * KnowledgeConnectionsStore, reads the bearer token via CredentialManager at
 * key `source_bearer::{workspaceId}::{connectionId}` (the record's
 * credentialRef verbatim — no new CredentialType), then obtains the provider
 * through a KnowledgeRegistry ('siyuan' factory → SiyuanKnowledgeProvider,
 * external-local mode only). Registry.connect() re-invokes the factory on
 * every call, so token rotation takes effect without process restart.
 *
 * Errors: domain KnowledgeError codes map 1:1 onto transport CodedError codes
 * (the seven spec-03 §3.2 codes are in the shared ErrorCode union); validation
 * failures throw CodedError directly (INVALID_REF / NOT_FOUND /
 * CONNECTION_UNAVAILABLE), mirroring the notes.ts/marketplace.ts conventions.
 */
import { CodedError, RPC_CHANNELS } from '@craft-agent/shared/protocol'
import type {
  ApplyResult,
  KnowledgeEngineStatus,
  KnowledgeLinkRecord,
  MutationActor,
  MutationInput,
  MutationProposal,
  MutationProposalStatus,
  PublicationRecord,
  PublishApplyResult,
  PublishDraft,
  PublishPrepareResult,
} from '@craft-agent/shared/protocol'
import { getWorkspaceByNameOrId, getWorkspaces } from '@craft-agent/shared/config'
import { getCredentialManager } from '@craft-agent/shared/credentials'
import assertKnowledgeActionAllowed from '@craft-agent/shared/agent/knowledge-permissions'
import { pushTyped, type RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import {
  createKnowledgeRegistry,
  KnowledgeError,
  MutationValidationError,
  ProposalTransitionError,
} from '@craft-agent/core/knowledge'
import type {
  ContextMode,
  ContextPayload,
  ContextSnapshot,
  KnowledgeConnection,
  KnowledgeProvider,
  KnowledgeRef,
  SearchInput,
} from '@craft-agent/core/knowledge'
import {
  SiyuanKernelClient,
  SiyuanKnowledgeProvider,
} from '@craft-agent/core/knowledge/providers/siyuan'
import {
  KnowledgeAuditLog,
  KnowledgeConnectionsStore,
  KnowledgeContextSnapshotsStore,
  KnowledgeMutationProposalsStore,
  KnowledgePublicationService,
  credentialIdFromRef,
} from '../../knowledge'
import {
  KnowledgeBridgeService,
  type KnowledgeProposalFileRecord,
} from '../../knowledge/bridge-service'
import type {
  KnowledgeConnectionRecord,
  KnowledgeConnectionStatus,
  KnowledgeContextSnapshotRecord,
} from '../../knowledge'

/**
 * Тестовый seam (вместо mock.module('@craft-agent/core/knowledge/providers/siyuan')).
 * mock.module — транзитивно-глобален и необратим для модулей, загруженных после
 * мока: он ломал packages/core knowledge adapter-тесты в полном прогоне
 * (19 fails; версия '2.10.0' из их фейка). Хендлер дергает provider/client
 * ТОЛЬКО через эти фактори; тесты ставят свой и возвращают оригинал в afterEach.
 */
type SiyuanKnowledgeProviderCtor = new (options: { connection: KnowledgeConnection; token: string }) => KnowledgeProvider
type SiyuanKernelClientCtor = new (options: { baseUrl: string; token: string }) => Pick<SiyuanKernelClient, 'getVersion'>
let knowledgeProviderCtor: SiyuanKnowledgeProviderCtor = SiyuanKnowledgeProvider as unknown as SiyuanKnowledgeProviderCtor
let siyuanKernelClientCtor: SiyuanKernelClientCtor = SiyuanKernelClient
export function __setKnowledgeTestConstructors(ctor: SiyuanKnowledgeProviderCtor | null, clientCtor?: SiyuanKernelClientCtor | null): void {
  knowledgeProviderCtor = ctor ?? (SiyuanKnowledgeProvider as unknown as SiyuanKnowledgeProviderCtor)
  if (clientCtor !== undefined) {
    siyuanKernelClientCtor = clientCtor ?? SiyuanKernelClient
  }
}

/** The complete knowledge channel set — 9 P1 read + 7 P3 write-back + 8 P4 publication; asserted verbatim by knowledge.test.ts. */
export const HANDLED_CHANNELS = [
  RPC_CHANNELS.knowledge.LIST_CONNECTIONS,
  RPC_CHANNELS.knowledge.CAPABILITIES,
  RPC_CHANNELS.knowledge.SEARCH,
  RPC_CHANNELS.knowledge.GET,
  RPC_CHANNELS.knowledge.GET_CONTEXT,
  RPC_CHANNELS.knowledge.GET_BACKLINKS,
  RPC_CHANNELS.knowledge.SNAPSHOT_CREATE,
  RPC_CHANNELS.knowledge.SNAPSHOT_GET,
  RPC_CHANNELS.knowledge.ENGINE_STATUS,
  RPC_CHANNELS.knowledge.PROPOSE_MUTATION,
  RPC_CHANNELS.knowledge.APPROVE_PROPOSAL,
  RPC_CHANNELS.knowledge.REJECT_PROPOSAL,
  RPC_CHANNELS.knowledge.APPLY_PROPOSAL,
  RPC_CHANNELS.knowledge.ROLLBACK_PROPOSAL,
  RPC_CHANNELS.knowledge.GET_PROPOSAL,
  RPC_CHANNELS.knowledge.LIST_PROPOSALS,
  // P4 publication pipeline (spec 06)
  RPC_CHANNELS.knowledge.PUBLISH_DISTILL,
  RPC_CHANNELS.knowledge.PUBLISH_GET_DRAFT,
  RPC_CHANNELS.knowledge.PUBLISH_UPDATE_DRAFT,
  RPC_CHANNELS.knowledge.PUBLISH_PREPARE,
  RPC_CHANNELS.knowledge.PUBLISH_APPLY,
  RPC_CHANNELS.knowledge.PUBLISH_FINALIZE,
  RPC_CHANNELS.knowledge.PUBLISH_LIST,
  RPC_CHANNELS.knowledge.LIST_LINKS,
] as const

// ---------------------------------------------------------------------------
// Wire payload shapes (spec 03 §3.5.1 RPC table)
// ---------------------------------------------------------------------------

export interface KnowledgeConnectionArgs {
  connectionId: string
}

export interface KnowledgeSearchArgs extends KnowledgeConnectionArgs {
  input: SearchInput
}

export interface KnowledgeRefArgs extends KnowledgeConnectionArgs {
  ref: KnowledgeRef
}

export interface KnowledgeGetContextArgs extends KnowledgeRefArgs {
  mode: ContextMode
}

export interface KnowledgeSnapshotCreateArgs extends KnowledgeConnectionArgs {
  /** Workspace owning {root}/knowledge/snapshots — snapshots are workspace data. */
  workspaceId: string
  ref: KnowledgeRef
  mode?: ContextMode
  /** Owning session — snapshots are session-scoped working artifacts (spec 04 §3.4). */
  sessionId: string
  provenance?: ContextPayload['provenance']
}

export interface KnowledgeSnapshotGetArgs {
  workspaceId: string
  snapshotId: string
}

// ---------------------------------------------------------------------------
// P3 write-back wire shapes (spec 05 §3.5 proposal RPC table)
// ---------------------------------------------------------------------------

export interface KnowledgeProposeMutationArgs extends KnowledgeConnectionArgs {
  /** Wire MutationInput; `actor` rides as an optional extension (agent/automation origins). */
  input: MutationInput & { actor?: MutationActor }
}

export interface KnowledgeProposalArgs {
  proposalId: string
}

export interface KnowledgeApplyProposalArgs extends KnowledgeProposalArgs {
  /** Optional workspace hint — skips the cross-workspace proposal scan. */
  workspaceId?: string
}

export interface KnowledgeListProposalsArgs {
  workspaceId?: string
  connectionId?: string
  status?: MutationProposalStatus
}

// ---------------------------------------------------------------------------
// P4 publication wire shapes (spec 06)
// ---------------------------------------------------------------------------

export interface KnowledgePublishDistillArgs {
  connectionId: string
  sessionId?: string
  runIds?: string[]
  language?: string
  /** Optional override for tests / when session message load is unavailable. */
  messages?: Array<{ id: string; role: string; content: string }>
  model?: { connectionSlug: string; modelId: string }
}

export interface KnowledgePublishDraftArgs {
  draftId: string
  connectionId?: string
}

export interface KnowledgePublishUpdateDraftArgs extends KnowledgePublishDraftArgs {
  title?: string
  markdown?: string
}

export interface KnowledgePublishPrepareArgs {
  draftId: string
  connectionId: string
  notebookId: string
  path: string
  adoptExisting?: boolean
}

export interface KnowledgePublishApplyArgs {
  draftId: string
  connectionId: string
}

export interface KnowledgePublishFinalizeArgs {
  draftId: string
  proposalId: string
  connectionId?: string
  appliedDocRef?: KnowledgeRef
}

export interface KnowledgePublishListArgs {
  connectionId?: string
  sessionId?: string
  runId?: string
}

export interface KnowledgeListLinksArgs {
  connectionId?: string
  craftId?: string
  knowledgeId?: string
}

// ---------------------------------------------------------------------------
// Record ↔ contract mapping
// ---------------------------------------------------------------------------

const CONNECTION_STATUS_MAP: Record<KnowledgeConnectionStatus, KnowledgeConnection['status']> = {
  ok: 'connected',
  failed: 'offline',
  unknown: 'offline',
  needs_auth: 'needs_auth',
}

/** Storage record → contract KnowledgeConnection; credentialRef never crosses the wire. */
function toContractConnection(record: KnowledgeConnectionRecord): KnowledgeConnection {
  return {
    id: record.id,
    provider: record.provider,
    label: record.baseUrl,
    baseUrl: record.baseUrl,
    status: CONNECTION_STATUS_MAP[record.status],
  }
}

function toContextSnapshot(record: KnowledgeContextSnapshotRecord): ContextSnapshot {
  return {
    id: record.id,
    sessionId: record.sessionId,
    provider: record.provider,
    ref: JSON.parse(record.refJson) as KnowledgeRef,
    contentHash: record.contentHash,
    capturedAt: Date.parse(record.capturedAt),
    snapshot: JSON.parse(record.snapshotJson) as ContextPayload,
  }
}

/** Token key lives in the record's credentialRef — parsed once by credentialIdFromRef (knowledge/connections-store). */
function assertContextMode(mode: unknown): asserts mode is ContextMode {
  if (mode !== 'snapshot' && mode !== 'live-reference') {
    throw new Error(`knowledge: invalid context mode '${String(mode)}' (expected 'snapshot' | 'live-reference')`)
  }
}

const KNOWLEDGE_KINDS: Record<string, true> = {
  notebook: true,
  document: true,
  block: true,
  database: true,
  asset: true,
}

function assertKnowledgeRef(ref: unknown): asserts ref is KnowledgeRef {
  const r = ref as KnowledgeRef | null
  if (
    !r ||
    typeof r !== 'object' ||
    r.scheme !== 'siyuan' ||
    typeof r.id !== 'string' ||
    r.id.length === 0 ||
    typeof r.kind !== 'string' ||
    KNOWLEDGE_KINDS[r.kind] !== true
  ) {
    throw new CodedError('INVALID_REF', `knowledge: invalid KnowledgeRef: ${JSON.stringify(ref)}`)
  }
}

export function registerKnowledgeHandlers(server: RpcServer, deps: HandlerDeps): void {
  const log = deps.platform.logger

  // Per-registration registry: factory re-runs on every connect(), picking up
  // the current token from tokensByConnection (set just before connect()).
  const tokensByConnection = new Map<string, string>()
  const registry = createKnowledgeRegistry()
  registry.registerProvider('siyuan', (connection) =>
    new knowledgeProviderCtor({ connection, token: tokensByConnection.get(connection.id) ?? '' }),
  )

  /** Domain KnowledgeError code → transport CodedError with the identical code string. */
  function toTransportError(error: unknown): unknown {
    if (error instanceof KnowledgeError) return new CodedError(error.code, error.message)
    return error
  }

  function requireConnection(connectionId: string) {
    const record = new KnowledgeConnectionsStore().get(connectionId)
    if (!record) throw new CodedError('NOT_FOUND', `Knowledge connection not found: ${connectionId}`)
    return record
  }

  /** Empty string when no credential is stored — tokenless kernels answer fine, authed ones error naturally. */
  async function readToken(record: ReturnType<typeof requireConnection>): Promise<string> {
    const id = credentialIdFromRef(record.credentialRef)
    if (!id) {
      throw new CodedError(
        'CONNECTION_UNAVAILABLE',
        `Knowledge connection '${record.id}' has a malformed credential reference`,
      )
    }
    const credential = await getCredentialManager().get(id)
    return credential?.value ?? ''
  }

  async function resolveProvider(connectionId: string): Promise<KnowledgeProvider> {
    const record = requireConnection(connectionId)
    tokensByConnection.set(record.id, await readToken(record))
    try {
      return await registry.connect(toContractConnection(record))
    } catch (error) {
      throw toTransportError(error)
    }
  }

  async function callProvider<T>(connectionId: string, fn: (provider: KnowledgeProvider) => Promise<T>): Promise<T> {
    try {
      return await fn(await resolveProvider(connectionId))
    } catch (error) {
      throw toTransportError(error)
    }
  }

  function requireWorkspaceRoot(workspaceId: string): string {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new CodedError('NOT_FOUND', `Workspace not found: ${workspaceId}`)
    return workspace.rootPath
  }

  // ——— P3 write-back: one memoized KnowledgeBridgeService per workspace root ———
  // Proposals/audit are workspace data ({root}/knowledge/{proposals,audit.jsonl});
  // providerResolver reuses resolveProvider above so token rotation semantics are
  // identical to the read channels. push fans out as knowledge:changed.
  const bridges = new Map<string, KnowledgeBridgeService>()

  function bridgeFor(rootPath: string, workspaceId: string): KnowledgeBridgeService {
    let bridge = bridges.get(rootPath)
    if (!bridge) {
      bridge = new KnowledgeBridgeService({
        providerResolver: resolveProvider,
        proposalsStore: new KnowledgeMutationProposalsStore(rootPath),
        audit: new KnowledgeAuditLog(rootPath),
        assertAllowed: assertKnowledgeActionAllowed,
        push: (payload) => {
          pushTyped(server, RPC_CHANNELS.knowledge.CHANGED, { to: 'workspace', workspaceId }, payload)
        },
        workspaceId,
      })
      bridges.set(rootPath, bridge)
    }
    return bridge
  }

  /** proposeMutations carry no workspaceId: resolve it from the connection's credentialRef. */
  function requireConnectionWorkspaceRoot(record: KnowledgeConnectionRecord): { rootPath: string; workspaceId: string } {
    const credentialId = credentialIdFromRef(record.credentialRef)
    if (credentialId?.workspaceId) {
      const workspace = getWorkspaceByNameOrId(credentialId.workspaceId)
      if (workspace) return { rootPath: workspace.rootPath, workspaceId: workspace.id }
    }
    // Unscoped/malformed credentialRef — single-workspace installs resolve unambiguously.
    const workspaces = getWorkspaces()
    const only = workspaces[0]
    if (workspaces.length === 1 && only) return { rootPath: only.rootPath, workspaceId: only.id }
    throw new CodedError('INVALID_REF', `knowledge: cannot resolve workspace for connection '${record.id}'`)
  }

  /** Proposal-id-only channels: locate the owning workspace by scanning getWorkspaces(). */
  async function locateProposalBridge(proposalId: string): Promise<{ bridge: KnowledgeBridgeService; record: KnowledgeProposalFileRecord }> {
    for (const workspace of getWorkspaces()) {
      const bridge = bridgeFor(workspace.rootPath, workspace.id)
      await bridge.sweepExpired()
      const record = bridge.get(proposalId)
      if (record) return { bridge, record }
    }
    throw new CodedError('NOT_FOUND', `Knowledge mutation proposal not found: ${proposalId}`)
  }

  function requireProposalId(args: { proposalId?: unknown } | undefined): string {
    const proposalId = args?.proposalId
    if (typeof proposalId !== 'string' || proposalId.length === 0) {
      throw new Error('knowledge: proposalId must be a non-empty string')
    }
    return proposalId
  }

  /**
   * Engine guard rejections (§3.2 closed table) cross the wire as TYPED errors, never raw
   * engine throws. The common user-facing case: the handler-side pre-sweep demoted an
   * approval-expired proposal to pending_review, so the apply click hits beginApply from
   * pending_review — the correct answer is "approve it again" (informative), not a bare stack.
   */
  async function withProposalTransitions<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error) {
      if (error instanceof ProposalTransitionError) {
        const expiryHint =
          error.from === 'pending_review' && error.action === 'beginApply'
            ? ' The proposal is awaiting (re-)approval — an approval TTL (24 h, spec 05 §3.7) sweep may have demoted it; approve it again before applying.'
            : ''
        throw new CodedError(
          'HASH_CONFLICT',
          `knowledge: proposal transition '${error.action}' is not allowed from status '${error.from}'` +
            (error.reason ? ` (${error.reason})` : '') + '.' + expiryHint,
        )
      }
      throw error
    }
  }

  // ——— LIST_CONNECTIONS({}) → KnowledgeConnection[] ———
  server.handle(RPC_CHANNELS.knowledge.LIST_CONNECTIONS, () =>
    new KnowledgeConnectionsStore().list().map(toContractConnection),
  )

  // ——— CAPABILITIES({connectionId}) → KnowledgeCapabilities ———
  server.handle(RPC_CHANNELS.knowledge.CAPABILITIES, (_ctx, args: KnowledgeConnectionArgs) =>
    callProvider(args.connectionId, (provider) => provider.capabilities()),
  )

  // ——— SEARCH({connectionId, input}) → SearchPage ———
  server.handle(RPC_CHANNELS.knowledge.SEARCH, (_ctx, args: KnowledgeSearchArgs) => {
    if (!args?.input || typeof args.input.query !== 'string') {
      throw new Error('knowledge.search: input.query must be a string')
    }
    return callProvider(args.connectionId, (provider) => provider.search(args.input))
  })

  // ——— GET({connectionId, ref}) → KnowledgeNode ———
  server.handle(RPC_CHANNELS.knowledge.GET, (_ctx, args: KnowledgeRefArgs) => {
    assertKnowledgeRef(args?.ref)
    return callProvider(args.connectionId, (provider) => provider.get(args.ref))
  })

  // ——— GET_CONTEXT({connectionId, ref, mode}) → ContextPayload ———
  server.handle(RPC_CHANNELS.knowledge.GET_CONTEXT, (_ctx, args: KnowledgeGetContextArgs) => {
    assertKnowledgeRef(args?.ref)
    assertContextMode(args.mode)
    return callProvider(args.connectionId, (provider) => provider.getContext(args.ref, args.mode))
  })

  // ——— GET_BACKLINKS({connectionId, ref}) → ContextPayload['backlinks'] ———
  server.handle(RPC_CHANNELS.knowledge.GET_BACKLINKS, async (_ctx, args: KnowledgeRefArgs) => {
    assertKnowledgeRef(args?.ref)
    const payload = await callProvider(args.connectionId, (provider) =>
      provider.getContext(args.ref, 'snapshot'),
    )
    return payload.backlinks
  })

  // ——— SNAPSHOT_CREATE({workspaceId, connectionId, ref, mode?, sessionId, provenance?}) → ContextSnapshot ———
  server.handle(RPC_CHANNELS.knowledge.SNAPSHOT_CREATE, async (_ctx, args: KnowledgeSnapshotCreateArgs): Promise<ContextSnapshot> => {
    const rootPath = requireWorkspaceRoot(args.workspaceId)
    assertKnowledgeRef(args?.ref)
    const mode = args.mode ?? 'snapshot'
    assertContextMode(mode)
    if (typeof args.sessionId !== 'string' || args.sessionId.length === 0) {
      throw new Error('knowledge.snapshotCreate: sessionId is required')
    }
    const record = requireConnection(args.connectionId)
    const payload = await callProvider(args.connectionId, (provider) =>
      provider.getContext(args.ref, mode),
    )
    if (args.provenance) payload.provenance = args.provenance
    const stored = new KnowledgeContextSnapshotsStore(rootPath).create({
      sessionId: args.sessionId,
      provider: record.provider,
      ref: args.ref,
      contentHash: payload.contentHash,
      snapshot: payload,
    })
    return toContextSnapshot(stored)
  })

  // ——— SNAPSHOT_GET({workspaceId, snapshotId}) → ContextSnapshot ———
  server.handle(RPC_CHANNELS.knowledge.SNAPSHOT_GET, (_ctx, args: KnowledgeSnapshotGetArgs): ContextSnapshot => {
    const rootPath = requireWorkspaceRoot(args.workspaceId)
    const record = new KnowledgeContextSnapshotsStore(rootPath).get(args.snapshotId)
    if (!record) throw new CodedError('NOT_FOUND', `Knowledge context snapshot not found: ${args.snapshotId}`)
    return toContextSnapshot(record)
  })

  // ——— ENGINE_STATUS({connectionId}) → KnowledgeEngineStatus (LOCAL_ONLY) ———
  // Probe semantics, not command semantics: an unreachable kernel yields
  // running:false (the channel's answer), never a thrown provider error.
  server.handle(RPC_CHANNELS.knowledge.ENGINE_STATUS, async (_ctx, args: KnowledgeConnectionArgs): Promise<KnowledgeEngineStatus> => {
    const record = requireConnection(args.connectionId)
    try {
      // Construction itself may fail (missing token / bad baseUrl) — probe semantics
      // still answer running:false rather than throw a provider error to the wire.
      const token = await readToken(record)
      const client = new siyuanKernelClientCtor({ baseUrl: record.baseUrl, token })
      const version = await client.getVersion()
      return { mode: record.mode, running: true, version }
    } catch (error) {
      log?.debug?.(`KNOWLEDGE_ENGINE_STATUS: probe failed for connection ${record.id}: ${String((error as Error)?.message ?? error)}`)
      return { mode: record.mode, running: false }
    }
  })

  // -------------------------------------------------------------------------
  // P3 write-back (spec 05) — the mutation-proposal lifecycle. All seven
  // delegate to KnowledgeBridgeService; the bridge owns validation, the
  // permission gate, the state machine, audit and knowledge:changed push.
  // -------------------------------------------------------------------------

  // ——— PROPOSE_MUTATION({connectionId, input}) → MutationProposal ———
  server.handle(RPC_CHANNELS.knowledge.PROPOSE_MUTATION, async (_ctx, args: KnowledgeProposeMutationArgs): Promise<MutationProposal> => {
    const record = requireConnection(args.connectionId)
    const input = args?.input
    if (!input || typeof input !== 'object') {
      throw new CodedError('INVALID_REF', 'knowledge.proposeMutation: input with targetRef and ops is required')
    }
    assertKnowledgeRef(input.targetRef)
    const { rootPath, workspaceId } = requireConnectionWorkspaceRoot(record)
    try {
      return await bridgeFor(rootPath, workspaceId).propose({ connectionId: args.connectionId, input })
    } catch (error) {
      // T1 admission guards reject as MutationValidationError (a plain Error
      // subclass); without this map the transport collapses them into a
      // generic HANDLER_ERROR and the client cannot tell bad input from a crash.
      if (error instanceof MutationValidationError) {
        throw new CodedError('INVALID_REF', `knowledge.proposeMutation: ${error.reason}: ${error.message}`)
      }
      throw toTransportError(error)
    }
  })

  // ——— APPROVE_PROPOSAL({proposalId}) → MutationProposal ———
  server.handle(RPC_CHANNELS.knowledge.APPROVE_PROPOSAL, async (_ctx, args: KnowledgeProposalArgs): Promise<MutationProposal> => {
    const proposalId = requireProposalId(args)
    const { bridge } = await locateProposalBridge(proposalId)
    return withProposalTransitions(() => bridge.approve(proposalId))
  })

  // ——— REJECT_PROPOSAL({proposalId}) → { ok: true } ———
  server.handle(RPC_CHANNELS.knowledge.REJECT_PROPOSAL, async (_ctx, args: KnowledgeProposalArgs): Promise<{ ok: true }> => {
    const proposalId = requireProposalId(args)
    const { bridge } = await locateProposalBridge(proposalId)
    return withProposalTransitions(() => bridge.reject(proposalId))
  })

  // ——— APPLY_PROPOSAL({proposalId, workspaceId?}) → ApplyResult ———
  server.handle(RPC_CHANNELS.knowledge.APPLY_PROPOSAL, async (_ctx, args: KnowledgeApplyProposalArgs): Promise<ApplyResult> => {
    const proposalId = requireProposalId(args)
    if (args?.workspaceId) {
      const bridge = bridgeFor(requireWorkspaceRoot(args.workspaceId), args.workspaceId)
      await bridge.sweepExpired()
      if (!bridge.get(proposalId)) {
        throw new CodedError('NOT_FOUND', `Knowledge mutation proposal not found: ${proposalId}`)
      }
      return withProposalTransitions(() => bridge.apply(proposalId))
    }
    const { bridge } = await locateProposalBridge(proposalId)
    return withProposalTransitions(() => bridge.apply(proposalId))
  })

  // ——— ROLLBACK_PROPOSAL({proposalId}) → ApplyResult ———
  server.handle(RPC_CHANNELS.knowledge.ROLLBACK_PROPOSAL, async (_ctx, args: KnowledgeProposalArgs): Promise<ApplyResult> => {
    const proposalId = requireProposalId(args)
    const { bridge } = await locateProposalBridge(proposalId)
    return withProposalTransitions(() => bridge.rollback(proposalId))
  })

  // ——— GET_PROPOSAL({proposalId}) → MutationProposal ———
  server.handle(RPC_CHANNELS.knowledge.GET_PROPOSAL, async (_ctx, args: KnowledgeProposalArgs): Promise<MutationProposal> => {
    const { record } = await locateProposalBridge(requireProposalId(args))
    return record
  })

  // ——— LIST_PROPOSALS({workspaceId?, connectionId?, status?}) → MutationProposal[] ———
  server.handle(RPC_CHANNELS.knowledge.LIST_PROPOSALS, async (_ctx, args: KnowledgeListProposalsArgs = {}): Promise<MutationProposal[]> => {
    const roots = args.workspaceId
      ? [{ workspaceId: args.workspaceId, rootPath: requireWorkspaceRoot(args.workspaceId) }]
      : getWorkspaces().map((workspace) => ({ workspaceId: workspace.id, rootPath: workspace.rootPath }))
    const proposals: MutationProposal[] = []
    for (const { workspaceId, rootPath } of roots) {
      const bridge = bridgeFor(rootPath, workspaceId)
      await bridge.sweepExpired()
      proposals.push(...bridge.list({ status: args.status, connectionId: args.connectionId }))
    }
    return proposals
  })

  // -------------------------------------------------------------------------
  // P4 publication pipeline (spec 06) — distill → prepare → apply(propose) →
  // finalize. Drafts/publications/links live under {workspaceRoot}/knowledge/.
  // -------------------------------------------------------------------------

  const publications = new KnowledgePublicationService()

  /** Map plain service Errors (P4 service throws Error, not KnowledgeError) onto CodedError. */
  function toPublishError(error: unknown, prefix: string): unknown {
    if (error instanceof CodedError || error instanceof KnowledgeError) return toTransportError(error)
    if (error instanceof MutationValidationError) {
      return new CodedError('INVALID_REF', `${prefix}: ${error.reason}: ${error.message}`)
    }
    if (error instanceof Error) {
      const msg = error.message
      if (/not found/i.test(msg)) return new CodedError('NOT_FOUND', `${prefix}: ${msg}`)
      if (/cannot edit|expected 'applied'|status is|already/i.test(msg)) {
        return new CodedError('HASH_CONFLICT', `${prefix}: ${msg}`)
      }
      return new CodedError('INVALID_REF', `${prefix}: ${msg}`)
    }
    return error
  }

  async function loadSessionMessages(
    sessionId: string | undefined,
  ): Promise<Array<{ id: string; role: string; content: string }> | undefined> {
    if (!sessionId) return undefined
    try {
      const session = await deps.sessionManager.getSession?.(sessionId)
      const raw = (session as { messages?: Array<Record<string, unknown>> } | null)?.messages
      if (!Array.isArray(raw)) return undefined
      return raw.map((m, index) => {
        const id = typeof m.id === 'string' ? m.id : `msg_${index}`
        // StoredMessage uses `type` for role; runtime Message may use `role`.
        const role = typeof m.role === 'string' ? m.role : typeof m.type === 'string' ? m.type : 'unknown'
        const content = typeof m.content === 'string' ? m.content : ''
        return { id, role, content }
      })
    } catch {
      return undefined
    }
  }

  function resolvePublishWorkspace(connectionId: string | undefined): {
    rootPath: string
    workspaceId: string
    record?: KnowledgeConnectionRecord
  } {
    if (connectionId) {
      const record = requireConnection(connectionId)
      const ws = requireConnectionWorkspaceRoot(record)
      return { ...ws, record }
    }
    const workspaces = getWorkspaces()
    const only = workspaces[0]
    if (workspaces.length === 1 && only) return { rootPath: only.rootPath, workspaceId: only.id }
    throw new CodedError('INVALID_REF', 'knowledge.publish: connectionId is required to resolve workspace')
  }

  // ——— PUBLISH_DISTILL({connectionId, sessionId?, runIds?, messages?, model?}) → PublishDraft ———
  server.handle(RPC_CHANNELS.knowledge.PUBLISH_DISTILL, async (_ctx, args: KnowledgePublishDistillArgs): Promise<PublishDraft> => {
    if (!args?.connectionId || typeof args.connectionId !== 'string') {
      throw new CodedError('INVALID_REF', 'knowledge.publishDistill: connectionId is required')
    }
    const record = requireConnection(args.connectionId)
    const { rootPath } = requireConnectionWorkspaceRoot(record)
    let messages = args.messages
    if (!messages?.length && args.sessionId) {
      messages = await loadSessionMessages(args.sessionId)
    }
    try {
      return await publications.distill({
        workspaceRoot: rootPath,
        connectionId: args.connectionId,
        sessionId: args.sessionId,
        runIds: args.runIds,
        language: args.language,
        messages,
        model: args.model,
      })
    } catch (error) {
      throw toPublishError(error, 'knowledge.publishDistill')
    }
  })

  // ——— PUBLISH_GET_DRAFT({draftId, connectionId?}) → PublishDraft | null ———
  server.handle(RPC_CHANNELS.knowledge.PUBLISH_GET_DRAFT, (_ctx, args: KnowledgePublishDraftArgs): PublishDraft | null => {
    if (typeof args?.draftId !== 'string' || args.draftId.length === 0) {
      throw new CodedError('INVALID_REF', 'knowledge.publishGetDraft: draftId is required')
    }
    const { rootPath } = resolvePublishWorkspace(args.connectionId)
    return publications.getDraft(rootPath, args.draftId)
  })

  // ——— PUBLISH_UPDATE_DRAFT({draftId, title?, markdown?, connectionId?}) → PublishDraft ———
  server.handle(RPC_CHANNELS.knowledge.PUBLISH_UPDATE_DRAFT, (_ctx, args: KnowledgePublishUpdateDraftArgs): PublishDraft => {
    if (typeof args?.draftId !== 'string' || args.draftId.length === 0) {
      throw new CodedError('INVALID_REF', 'knowledge.publishUpdateDraft: draftId is required')
    }
    const { rootPath } = resolvePublishWorkspace(args.connectionId)
    try {
      return publications.updateDraft(rootPath, args.draftId, {
        title: args.title,
        markdown: args.markdown,
      })
    } catch (error) {
      throw toPublishError(error, 'knowledge.publishUpdateDraft')
    }
  })

  // ——— PUBLISH_PREPARE({draftId, connectionId, notebookId, path, adoptExisting?}) → PublishPrepareResult ———
  server.handle(RPC_CHANNELS.knowledge.PUBLISH_PREPARE, async (_ctx, args: KnowledgePublishPrepareArgs): Promise<PublishPrepareResult> => {
    if (!args?.connectionId || typeof args.draftId !== 'string') {
      throw new CodedError('INVALID_REF', 'knowledge.publishPrepare: connectionId and draftId are required')
    }
    if (typeof args.notebookId !== 'string' || typeof args.path !== 'string') {
      throw new CodedError('INVALID_REF', 'knowledge.publishPrepare: notebookId and path are required')
    }
    const record = requireConnection(args.connectionId)
    const { rootPath } = requireConnectionWorkspaceRoot(record)
    const provider = await resolveProvider(args.connectionId)
    try {
      return await publications.prepare({
        workspaceRoot: rootPath,
        draftId: args.draftId,
        notebookId: args.notebookId,
        path: args.path,
        adoptExisting: args.adoptExisting,
        provider,
      })
    } catch (error) {
      throw toPublishError(error, 'knowledge.publishPrepare')
    }
  })

  // ——— PUBLISH_APPLY({draftId, connectionId}) → PublishApplyResult ———
  server.handle(RPC_CHANNELS.knowledge.PUBLISH_APPLY, async (_ctx, args: KnowledgePublishApplyArgs): Promise<PublishApplyResult> => {
    if (!args?.connectionId || typeof args.draftId !== 'string') {
      throw new CodedError('INVALID_REF', 'knowledge.publishApply: connectionId and draftId are required')
    }
    const record = requireConnection(args.connectionId)
    const { rootPath, workspaceId } = requireConnectionWorkspaceRoot(record)
    const provider = await resolveProvider(args.connectionId)
    const bridge = bridgeFor(rootPath, workspaceId)
    try {
      return await publications.apply({
        workspaceRoot: rootPath,
        draftId: args.draftId,
        provider,
        bridge,
        actor: 'user',
      })
    } catch (error) {
      throw toPublishError(error, 'knowledge.publishApply')
    }
  })

  // ——— PUBLISH_FINALIZE({draftId, proposalId, connectionId?, appliedDocRef?}) → PublishApplyResult ———
  server.handle(RPC_CHANNELS.knowledge.PUBLISH_FINALIZE, async (_ctx, args: KnowledgePublishFinalizeArgs): Promise<PublishApplyResult> => {
    if (typeof args?.draftId !== 'string' || typeof args?.proposalId !== 'string') {
      throw new CodedError('INVALID_REF', 'knowledge.publishFinalize: draftId and proposalId are required')
    }
    let rootPath: string
    let workspaceId: string | undefined
    if (args.connectionId) {
      const record = requireConnection(args.connectionId)
      ;({ rootPath, workspaceId } = requireConnectionWorkspaceRoot(record))
    } else {
      // Prefer single-workspace install; otherwise require connectionId.
      const workspaces = getWorkspaces()
      const only = workspaces[0]
      if (workspaces.length === 1 && only) {
        rootPath = only.rootPath
        workspaceId = only.id
      } else {
        // Best-effort: scan workspaces for a draft file via publication service.
        const hit = workspaces.find((ws) => publications.getDraft(ws.rootPath, args.draftId) != null)
        if (!hit) {
          throw new CodedError(
            'INVALID_REF',
            'knowledge.publishFinalize: connectionId is required when multiple workspaces are present',
          )
        }
        rootPath = hit.rootPath
        workspaceId = hit.id
      }
    }

    // Contract: finalize only after P3 apply — proposal must be 'applied'.
    // Prefer bridge lookup when we can resolve the workspace; otherwise require appliedDocRef
    // and still reject unknown proposal ids via store scan when possible.
    if (workspaceId) {
      const bridge = bridgeFor(rootPath, workspaceId)
      await bridge.sweepExpired()
      const proposal = bridge.get(args.proposalId)
      if (!proposal) {
        throw new CodedError('NOT_FOUND', `Knowledge mutation proposal not found: ${args.proposalId}`)
      }
      if (proposal.status !== 'applied') {
        throw new CodedError(
          'HASH_CONFLICT',
          `knowledge.publishFinalize: proposal '${args.proposalId}' status is '${proposal.status}', expected 'applied'`,
        )
      }
    }

    try {
      return await publications.finalize({
        workspaceRoot: rootPath,
        draftId: args.draftId,
        proposalId: args.proposalId,
        appliedDocRef: args.appliedDocRef,
      })
    } catch (error) {
      throw toPublishError(error, 'knowledge.publishFinalize')
    }
  })

  // ——— PUBLISH_LIST({connectionId?, sessionId?, runId?}) → PublicationRecord[] ———
  server.handle(RPC_CHANNELS.knowledge.PUBLISH_LIST, (_ctx, args: KnowledgePublishListArgs = {}): PublicationRecord[] => {
    const { rootPath } = resolvePublishWorkspace(args.connectionId)
    return publications.listPublications(rootPath, {
      sessionId: args.sessionId,
      runId: args.runId,
    })
  })

  // ——— LIST_LINKS({connectionId?, craftId?, knowledgeId?}) → KnowledgeLinkRecord[] ———
  server.handle(RPC_CHANNELS.knowledge.LIST_LINKS, (_ctx, args: KnowledgeListLinksArgs = {}): KnowledgeLinkRecord[] => {
    const { rootPath } = resolvePublishWorkspace(args.connectionId)
    return publications.listLinks(rootPath, {
      craftId: args.craftId,
      knowledgeId: args.knowledgeId,
    })
  })
}
