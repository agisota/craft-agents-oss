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
import { beforeEach, afterAll, describe, expect, it, mock } from 'bun:test'
import { rmSync } from 'fs'
import { join } from 'path'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
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
import { KnowledgeConnectionsStore } from '../../../knowledge'
import type { SaveConnectionInput } from '../../../knowledge'

// ---------------------------------------------------------------------------
// Mutable seam state (reset in beforeEach)
// ---------------------------------------------------------------------------

const DOC_REF: KnowledgeRef = { scheme: 'siyuan', kind: 'document', id: 'doc-1' }

const fakeCapabilities: KnowledgeCapabilities = {
  provider: 'siyuan',
  version: '3.1.28',
  minSupportedVersion: '2.10.0',
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
    createDocument: false,
    appendBlock: false,
    updateBlock: false,
    setAttribute: false,
    transactions: false,
    rollback: false,
  },
}

const fakeSearchPage: SearchPage = {
  items: [
    { ref: DOC_REF, title: 'Kernel Guide', snippet: 'the siyuan kernel …', notebookPath: '/Research/Kernel Guide', updatedAt: 1760400000000 },
  ],
  totalEstimate: 1,
}

const credentials = new Map<string, { value: string }>()
const providerCtorArgs: Array<{ connection: KnowledgeConnection; token?: string }> = []
let lastSearchInput: SearchInput | null = null
let kernelProbeError: Error | null = null

class FakeSiyuanKnowledgeProvider {
  constructor(opts: { connection: KnowledgeConnection; token?: string }) {
    providerCtorArgs.push(opts)
  }
  capabilities = async (): Promise<KnowledgeCapabilities> => fakeCapabilities
  search = async (input: SearchInput): Promise<SearchPage> => {
    lastSearchInput = input
    return fakeSearchPage
  }
  get = async (_ref: KnowledgeRef): Promise<KnowledgeNode> => {
    throw new Error('not exercised in these tests')
  }
  getContext = async (_ref: KnowledgeRef, _mode: ContextMode): Promise<ContextPayload> => {
    throw new Error('not exercised in these tests')
  }
  proposeMutation = async (): Promise<never> => {
    throw new Error('P1 is read-only')
  }
  applyMutation = async (): Promise<never> => {
    throw new Error('P1 is read-only')
  }
  open = async (): Promise<never> => {
    throw new Error('P1 is read-only')
  }
}

// ---------------------------------------------------------------------------
// Module seams (registered before the module under test loads)
// ---------------------------------------------------------------------------

mock.module('@craft-agent/shared/credentials', () => ({
  getCredentialManager: () => ({
    async get(id: CredentialId) {
      return credentials.get(`${id.type}::${id.workspaceId}::${id.sourceId}`) ?? null
    },
  }),
}))

mock.module('@craft-agent/shared/config', () => ({
  getWorkspaceByNameOrId: (id: string) =>
    id === 'ws1' ? { id: 'ws1', name: 'ws1', rootPath: '/tmp/knowledge-test-ws' } : null,
}))

import { registerKnowledgeHandlers, HANDLED_CHANNELS, __setKnowledgeTestConstructors } from '../knowledge'

// Локальный seam вместо процесс-глобального mock.module на siyuan-баррель:
// mock.module ломал packages/core adapter-тесты в полном прогоне сьюта.
__setKnowledgeTestConstructors(
  FakeSiyuanKnowledgeProvider as never,
  class {
    constructor(readonly opts: { baseUrl?: string; token: string }) {}
    async getVersion(): Promise<string> {
      if (kernelProbeError) throw kernelProbeError
      return '3.1.28'
    }
  } as never,
)
afterAll(() => __setKnowledgeTestConstructors(null))

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
  rmSync(join(process.env.CRAFT_CONFIG_DIR!, 'knowledge'), { recursive: true, force: true })
  credentials.clear()
  providerCtorArgs.length = 0
  lastSearchInput = null
  kernelProbeError = null
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registration', () => {
  it('declares exactly the 9 P1 read channels — no mutation, no engine lifecycle, no CHANGED push event', () => {
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
    ])
    // Roadmap P1 exit criterion: 0 write channels. Mutation channels (proposeMutation/
    // applyMutation/discardMutation) and engine lifecycle (engineStart/engineStop) are P3/P7.
    expect(HANDLED_CHANNELS.some((ch) => /mutation|engine(Start|Stop)/i.test(ch))).toBe(false)
    // CHANGED is a server→client push event subscribed via knowledge.onChanged, not a handler.
    expect([...HANDLED_CHANNELS]).not.toContain(RPC_CHANNELS.knowledge.CHANGED)
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
  it('resolves the provider with the CredentialManager token and passes input through untouched', async () => {
    seedConnection('conn-1', { status: 'ok' })
    credentials.set('source_bearer::ws1::conn-1', { value: 'secret-token-1' })
    const { invoke } = createHarness()
    const input: SearchInput = { query: 'kernel' }
    const page = await invoke(RPC_CHANNELS.knowledge.SEARCH, { connectionId: 'conn-1', input })

    expect(page).toBe(fakeSearchPage)
    expect(lastSearchInput).toBe(input)
    expect(providerCtorArgs.at(-1)).toEqual({
      connection: {
        id: 'conn-1',
        provider: 'siyuan',
        label: 'http://127.0.0.1:6806',
        baseUrl: 'http://127.0.0.1:6806',
        status: 'connected',
      },
      token: 'secret-token-1',
    })
  })

  it('rejects an unknown connectionId with CodedError NOT_FOUND before touching the provider', async () => {
    const { invoke } = createHarness()
    await expect(
      invoke(RPC_CHANNELS.knowledge.SEARCH, { connectionId: 'conn-missing', input: { query: 'x' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(providerCtorArgs).toHaveLength(0)
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
