/**
 * P1 knowledge RPC handler tests (spec 2026-08-07-siyuan-integration/03 §§3.2–3.6):
 * HANDLED_CHANNELS is exactly the 9-channel P1 read set (no mutation / engine-lifecycle
 * channels; CHANGED is a push event, not a handled channel); every declared channel gets
 * a registered handler; connection records map to contract connections with credentialRef
 * stripped; provider resolution reads the token from CredentialManager at
 * source_bearer::{workspaceId}::{connectionId}; ENGINE_STATUS is probe semantics
 * (unreachable kernel → running:false, never a thrown provider error).
 *
 * Harness mirrors memory-io.test.ts: CRAFT_CONFIG_DIR is redirected by memory-test-setup
 * (the real KnowledgeConnectionsStore reads/writes there), the workspace registry and
 * CredentialManager are mock.module seams, and the SiYuan provider/kernel client are
 * stubbed at the module seam so no network ever happens.
 */
import '../memory-test-setup' // must run before any module reading CRAFT_CONFIG_DIR
import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { CodedError, RPC_CHANNELS } from '@craft-agent/shared/protocol'
import type { CredentialId } from '@craft-agent/shared/credentials'
import type { HandlerFn, RequestContext, RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../../handler-deps'
import type {
  ContextMode,
  ContextPayload,
  KnowledgeCapabilities,
  KnowledgeConnection,
  KnowledgeNode,
  KnowledgeRef,
  SearchInput,
  SearchPage,
} from '@craft-agent/core/knowledge'
import { KnowledgeConnectionsStore, KnowledgeMutationProposalsStore } from '../../../knowledge'
import type { KnowledgeProposalFileRecord } from '../../../knowledge/bridge-service'
import type { SaveConnectionInput } from '../../../knowledge'

// ---------------------------------------------------------------------------
// Mutable seam state (reset in beforeEach)
// ---------------------------------------------------------------------------

const DOC_REF: KnowledgeRef = { scheme: 'siyuan', kind: 'document', id: 'doc-1' }

// Kernel-wire fixture for the REAL SiyuanKnowledgeProvider search mapping (fullTextSearchBlock).
const KERNEL_SEARCH_RESPONSE = {
  code: 0,
  msg: '',
  data: {
    blocks: [
      {
        box: 'nb-1',
        path: '/20260807142000-x1afz9.sy',
        hPath: '/Research/Kernel Guide',
        id: 'doc-1',
        rootID: 'doc-1',
        parentID: '',
        name: 'Kernel Guide',
        alias: '',
        memo: '',
        tag: '',
        content: 'the siyuan <span data-type="search-mark">kernel</span> contract',
        fcontent: '',
        markdown: '',
        folded: false,
        type: 'NodeDocument',
        subType: '',
        refText: '',
        refs: null,
        defID: '',
        defPath: '',
        ial: '',
        children: null,
        depth: 0,
        count: 0,
        sort: 0,
        created: '20260807000000',
        updated: '20260807120000',
      },
    ],
    matchedBlockCount: 1,
    matchedRootCount: 1,
    pageCount: 1,
    docMode: false,
  },
}

const credentials = new Map<string, { value: string }>()
const fetchCalls: Array<{ url: string; init: RequestInit }> = []
let kernelProbeError: Error | null = null

// globalThis.fetch seam: bun's mock.module registry is process-global and leaks into OTHER
// test files in combined runs (the adapter's own suite observed this fake module and failed
// 19/19 with our fixtures). Fetch, by contrast, is consulted per handler invocation — the
// handler constructs SiyuanKernelClient without fetchImpl, so the real client+adapter run
// end-to-end against this stub. Restored to the captured original in afterAll.
const originalFetch = globalThis.fetch

function installFetchSeam() {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    fetchCalls.push({ url: u, init: init as RequestInit })
    if (kernelProbeError) throw kernelProbeError
    if (u.endsWith('/api/system/version')) {
      return new Response(JSON.stringify({ code: 0, msg: '', data: '3.1.28' }), { status: 200 })
    }
    if (u.endsWith('/api/search/fullTextSearchBlock')) {
      return new Response(JSON.stringify(KERNEL_SEARCH_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error(`unmocked kernel endpoint: ${u}`)
  }) as unknown as typeof fetch
}
installFetchSeam()

afterAll(() => {
  globalThis.fetch = originalFetch
})

// ---------------------------------------------------------------------------
// Module seams: workspace registry + CredentialManager only. The SiYuan
// provider/client run REAL through the fetch seam above — module mocks must
// never target packages another suite imports directly (bun leak, see above).
// ---------------------------------------------------------------------------

mock.module('@craft-agent/shared/credentials', () => ({
  getCredentialManager: () => ({
    async get(id: CredentialId) {
      return credentials.get(`${id.type}::${id.workspaceId}::${id.sourceId}`) ?? null
    },
  }),
}))

let workspaceRoot: string

mock.module('@craft-agent/shared/config', () => ({
  getWorkspaceByNameOrId: (id: string) =>
    id === 'ws1' ? { id: 'ws1', name: 'ws1', rootPath: workspaceRoot } : null,
  getWorkspaces: () =>
    workspaceRoot ? [{ id: 'ws1', name: 'ws1', rootPath: workspaceRoot }] : [],
}))

import { registerKnowledgeHandlers, HANDLED_CHANNELS } from '../knowledge'

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function createHarness() {
  const handlers = new Map<string, HandlerFn>()
  const server: RpcServer = {
    handle(channel, handler) { handlers.set(channel, handler) },
    push() {},
    async invokeClient() { return undefined },
    hasClientCapability() { return false },
    findClientsWithCapability() { return [] },
  }
  const deps: HandlerDeps = {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    platform: {
      appRootPath: '/',
      resourcesPath: '/',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
    },
  }
  registerKnowledgeHandlers(server, deps)
  const invoke = (channel: string, args: unknown) => {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`No handler for ${channel}`)
    return handler({ clientId: 'c1', workspaceId: null } as unknown as RequestContext, args)
  }
  return { handlers, invoke }
}

function seedConnection(id: string, overrides: Partial<SaveConnectionInput> = {}) {
  return new KnowledgeConnectionsStore().save({
    id,
    baseUrl: 'http://127.0.0.1:6806',
    credentialRef: `source_bearer::ws1::${id}`,
    ...overrides,
  })
}

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'knowledge-test-ws-'))
  rmSync(join(process.env.CRAFT_CONFIG_DIR!, 'knowledge'), { recursive: true, force: true })
  credentials.clear()
  fetchCalls.length = 0
  kernelProbeError = null
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registration', () => {
  it('declares exactly the 9 P1 read + 7 P3 write-back + 8 P4 publication + 6 P5 view/envelope channels — no engine lifecycle, no CHANGED push event', () => {
    expect([...HANDLED_CHANNELS]).toEqual([
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
      RPC_CHANNELS.knowledge.PUBLISH_DISTILL,
      RPC_CHANNELS.knowledge.PUBLISH_GET_DRAFT,
      RPC_CHANNELS.knowledge.PUBLISH_UPDATE_DRAFT,
      RPC_CHANNELS.knowledge.PUBLISH_PREPARE,
      RPC_CHANNELS.knowledge.PUBLISH_APPLY,
      RPC_CHANNELS.knowledge.PUBLISH_FINALIZE,
      RPC_CHANNELS.knowledge.PUBLISH_LIST,
      RPC_CHANNELS.knowledge.LIST_LINKS,
      RPC_CHANNELS.knowledge.ENVELOPE_GET,
      RPC_CHANNELS.knowledge.ENVELOPE_UPSERT,
      RPC_CHANNELS.knowledge.ENVELOPE_LIST,
      RPC_CHANNELS.knowledge.VIEWS_LIST,
      RPC_CHANNELS.knowledge.VIEW_RUN,
      RPC_CHANNELS.knowledge.VIEW_SET_ATTRIBUTE,
    ])
    // Engine lifecycle (engineStart/engineStop) remains P7 and MUST NOT be registered.
    expect(HANDLED_CHANNELS.some((ch) => /engine(Start|Stop)/i.test(ch))).toBe(false)
    // CHANGED is a server→client push event subscribed via knowledge.onChanged, not a handler.
    expect([...HANDLED_CHANNELS]).not.toContain(RPC_CHANNELS.knowledge.CHANGED)
    expect(HANDLED_CHANNELS).toHaveLength(30) // 9 P1 + 7 P3 + 8 P4 + 6 P5
  })

  it('registers a handler for every declared channel and nothing else', () => {
    const { handlers } = createHarness()
    expect(handlers.size).toBe(HANDLED_CHANNELS.length)
    for (const ch of HANDLED_CHANNELS) expect(handlers.has(ch)).toBe(true)
  })
})

describe('listConnections', () => {
  it('maps store records to contract connections and never leaks credentialRef', async () => {
    seedConnection('conn-1', { status: 'ok' })
    seedConnection('conn-2', { status: 'needs_auth', baseUrl: 'http://127.0.0.1:6807' })
    const { invoke } = createHarness()
    const list = await invoke(RPC_CHANNELS.knowledge.LIST_CONNECTIONS, {}) as KnowledgeConnection[]
    expect(list).toEqual([
      { id: 'conn-1', provider: 'siyuan', label: 'http://127.0.0.1:6806', baseUrl: 'http://127.0.0.1:6806', status: 'connected' },
      { id: 'conn-2', provider: 'siyuan', label: 'http://127.0.0.1:6807', baseUrl: 'http://127.0.0.1:6807', status: 'needs_auth' },
    ])
    for (const conn of list) expect('credentialRef' in conn).toBe(false)
  })
})

describe('search', () => {
  it('serves the query through the real provider with the CredentialManager token', async () => {
    seedConnection('conn-1', { status: 'ok' })
    credentials.set('source_bearer::ws1::conn-1', { value: 'secret-token-1' })
    const { invoke } = createHarness()
    const page = (await invoke(RPC_CHANNELS.knowledge.SEARCH, { connectionId: 'conn-1', input: { query: 'kernel' } })) as SearchPage

    // Real adapter mapping of the kernel fixture (title from hPath leaf, markup stripped).
    expect(page.items).toHaveLength(1)
    expect(page.items[0]!.title).toBe('Kernel Guide')
    expect(page.items[0]!.snippet).toBe('the siyuan kernel contract')
    expect(page.items[0]!.ref).toEqual(DOC_REF)

    // End-to-end plumbing: exact kernel endpoint, bearer token at protocol layer, query passthrough.
    const call = fetchCalls.find((c) => c.url.endsWith('/api/search/fullTextSearchBlock'))!
    expect((call.init.headers as Record<string, string>)['Authorization']).toBe('Token secret-token-1')
    expect((JSON.parse(String(call.init.body)) as Record<string, unknown>)['query']).toBe('kernel')
  })

  it('rejects an unknown connectionId with CodedError NOT_FOUND before touching the kernel', async () => {
    const { invoke } = createHarness()
    await expect(
      invoke(RPC_CHANNELS.knowledge.SEARCH, { connectionId: 'conn-missing', input: { query: 'x' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(fetchCalls).toHaveLength(0)
  })
})

describe('engineStatus', () => {
  it('reports running with the kernel version when the probe answers', async () => {
    seedConnection('conn-1', { status: 'ok' })
    credentials.set('source_bearer::ws1::conn-1', { value: 'secret-token-1' })
    const { invoke } = createHarness()
    const status = await invoke(RPC_CHANNELS.knowledge.ENGINE_STATUS, { connectionId: 'conn-1' })
    expect(status).toEqual({ mode: 'external-local', running: true, version: '3.1.28' })
  })

  it('reports running:false when the kernel probe fails — probe semantics, never a throw', async () => {
    seedConnection('conn-1', { status: 'failed' })
    kernelProbeError = new Error('connect ECONNREFUSED 127.0.0.1:6806')
    const { invoke } = createHarness()
    const status = await invoke(RPC_CHANNELS.knowledge.ENGINE_STATUS, { connectionId: 'conn-1' })
    expect(status).toEqual({ mode: 'external-local', running: false })
  })
})

// TC-3: handler-invoke error-shape contracts for the P3 proposal channels.
describe('proposals wire errors', () => {
  it('getProposal with an unknown id rejects with CodedError NOT_FOUND (no workspaces scanned)', async () => {
    const { invoke } = createHarness()
    await expect(
      invoke(RPC_CHANNELS.knowledge.GET_PROPOSAL, { proposalId: 'p_missing' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('listProposals returns [] when no workspaces are registered', async () => {
    const { invoke } = createHarness()
    const proposals = await invoke(RPC_CHANNELS.knowledge.LIST_PROPOSALS, {})
    expect(proposals).toEqual([])
  })

  it('proposeMutation with ops: [] rejects as typed INVALID_REF, never a generic 500', async () => {
    seedConnection('conn-1', { status: 'ok' })
    const { invoke } = createHarness()
    // Default permission mode is 'ask' (mode-manager), so the gate passes and
    // the empty-ops admission guard (validateOpsWhitelist 'empty-ops') is what fires.
    await expect(
      invoke(RPC_CHANNELS.knowledge.PROPOSE_MUTATION, {
        connectionId: 'conn-1',
        input: { targetRef: DOC_REF, ops: [] },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REF' })
  })

  it('proposeMutation with a missing targetRef rejects as typed INVALID_REF before touching the bridge', async () => {
    seedConnection('conn-1', { status: 'ok' })
    const { invoke } = createHarness()
    await expect(
      invoke(RPC_CHANNELS.knowledge.PROPOSE_MUTATION, {
        connectionId: 'conn-1',
        input: { ops: [{ op: 'updateBlock', blockId: 'b-1', markdown: 'x' }] },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REF' })
    expect(fetchCalls).toHaveLength(0)
  })

  it('proposeMutation without input rejects as typed INVALID_REF', async () => {
    seedConnection('conn-1', { status: 'ok' })
    const { invoke } = createHarness()
    await expect(
      invoke(RPC_CHANNELS.knowledge.PROPOSE_MUTATION, { connectionId: 'conn-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_REF' })
  })

  it('proposeMutation with an unknown connectionId still rejects NOT_FOUND (unchanged precedence)', async () => {
    const { invoke } = createHarness()
    await expect(
      invoke(RPC_CHANNELS.knowledge.PROPOSE_MUTATION, {
        connectionId: 'conn-missing',
        input: { targetRef: DOC_REF, ops: [{ op: 'updateBlock', blockId: 'b-1', markdown: 'x' }] },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('applyProposal guard mapping (§3.2 wire contract, P2-14)', () => {
  it('pre-sweep demotes approval-expired proposals (recorded) and answers apply with a typed HASH_CONFLICT + re-approval hint', async () => {
    const { invoke } = createHarness()
    const approvedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    const expiredSeed: KnowledgeProposalFileRecord = {
      id: 'p_expired',
      connectionId: 'conn-1',
      targetRef: { scheme: 'siyuan', kind: 'block', id: 'blk-1' },
      ops: [{ op: 'updateBlock', blockId: 'blk-1', markdown: 'patched' }],
      selectionProofs: [],
      baseHash: 'deadbeef',
      baseReadAt: approvedAt,
      preState: 'original',
      hashAlgorithm: 'sha256-canonical-v1',
      status: 'approved',
      statusHistory: [{ from: 'pending_review', to: 'approved', at: approvedAt, actor: 'user' }],
      createdAt: approvedAt,
      updatedAt: approvedAt,
      actor: 'user',
      approvedBy: 'user',
      approvedAt,
    }
    new KnowledgeMutationProposalsStore(workspaceRoot).save(expiredSeed)

    const error: unknown = await invoke(RPC_CHANNELS.knowledge.APPLY_PROPOSAL, {
      proposalId: 'p_expired',
      workspaceId: 'ws1',
    }).then(() => null, (caught: unknown) => caught)

    // Typed wire error — never a raw engine ProposalTransitionError stack.
    expect(error).toBeInstanceOf(CodedError)
    expect(error).toMatchObject({ code: 'HASH_CONFLICT' })
    expect((error as Error).message).toContain("beginApply")
    expect((error as Error).message).toContain('approve it again')
    // And the pre-sweep demotion was RECORDED (the informative UX state), not silently errored.
    const record = new KnowledgeMutationProposalsStore(workspaceRoot).get('p_expired')
    expect(record?.status).toBe('pending_review')
    expect(record?.approvedAt).toBeUndefined()
  })
})
