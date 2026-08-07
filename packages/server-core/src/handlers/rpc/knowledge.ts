/**
 * P1 read-only knowledge provider RPC handlers (spec 2026-08-07-siyuan-integration/03
 * §§3.2–3.6, storage per spec 04 §3.3).
 *
 * READ-ONLY WIRE GUARANTEE: HANDLED_CHANNELS below is the complete P1 read set —
 * the 9 spec-03 read channels and nothing else. No mutation channel constant,
 * handler, or store write path towards SiYuan exists at P1 by design
 * (roadmap P1 exit criterion: «0 write-каналов»). Mutations (proposeMutation /
 * applyMutation / discard / engine lifecycle) land with P3/P7 — see spec 05
 * (05-mutation-safety.md); mutation TYPES exist in @craft-agent/core/knowledge
 * strictly as type-level declarations for forward compatibility.
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
import type { KnowledgeEngineStatus } from '@craft-agent/shared/protocol'
import { getWorkspaceByNameOrId } from '@craft-agent/shared/config'
import { getCredentialManager } from '@craft-agent/shared/credentials'
import type { CredentialId } from '@craft-agent/shared/credentials'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import {
  createKnowledgeRegistry,
  KnowledgeError,
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
  KnowledgeConnectionsStore,
  KnowledgeContextSnapshotsStore,
} from '../../knowledge'
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

/** The complete P1 read set — asserted verbatim by knowledge.test.ts. */
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

/** Token key lives in the record's credentialRef: source_bearer::{workspaceId}::{connectionId}. */
function credentialIdFromRef(credentialRef: string): CredentialId | null {
  const parts = credentialRef.split('::')
  if (parts.length !== 3 || parts[0] !== 'source_bearer' || !parts[1] || !parts[2]) return null
  return { type: 'source_bearer', workspaceId: parts[1], sourceId: parts[2] }
}

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
    const token = await readToken(record)
    const client = new siyuanKernelClientCtor({ baseUrl: record.baseUrl, token })
    try {
      const version = await client.getVersion()
      return { mode: record.mode, running: true, version }
    } catch (error) {
      log?.debug?.(`KNOWLEDGE_ENGINE_STATUS: probe failed for connection ${record.id}: ${String((error as Error)?.message ?? error)}`)
      return { mode: record.mode, running: false }
    }
  })
}
