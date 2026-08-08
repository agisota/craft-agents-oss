import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { resetExtensionStateStoreCache } from '@craft-agent/shared/extensions'
import { SiyuanKernelClient } from '@craft-agent/core/knowledge/providers/siyuan'
import {
  HANDLED_CHANNELS,
  registerPluginBridgeHandlers,
  resetPluginBridgeFixture,
  setPluginBridgeFixture,
  __setPluginBridgeKernelClientForTests,
} from '../plugin-bridge'
import { __setSiyuanDataDirCandidatesForTests } from '../../../knowledge/siyuan-plugins-fs'

type Handler = (ctx: unknown, ...args: unknown[]) => unknown | Promise<unknown>

function createMockServer() {
  const handlers = new Map<string, Handler>()
  return {
    handlers,
    handle(channel: string, fn: Handler) {
      handlers.set(channel, fn)
    },
    broadcast() {},
  }
}

function makeTempDataDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'craft-plugin-bridge-data-'))
  mkdirSync(join(root, 'plugins'), { recursive: true })
  mkdirSync(join(root, 'storage', 'petal'), { recursive: true })
  return root
}

function writePlugin(dataDir: string, name: string, body: Record<string, unknown>): void {
  const dir = join(dataDir, 'plugins', name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'plugin.json'), JSON.stringify(body), 'utf8')
}

type HandlerResult = { data?: unknown; code?: number; msg?: string; httpStatus?: number }
type FetchHandler = (body: Record<string, unknown>) => HandlerResult

function makeKernelClient(handlers: Record<string, FetchHandler>): SiyuanKernelClient {
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const endpoint = String(url).replace(/^https?:\/\/[^/]+/, '')
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    const handler = handlers[endpoint]
    if (!handler) throw new Error(`unmocked kernel endpoint: ${endpoint}`)
    const result = handler(body)
    if (result.httpStatus !== undefined) {
      return new Response('', { status: result.httpStatus })
    }
    return new Response(
      JSON.stringify({ code: result.code ?? 0, msg: result.msg ?? '', data: result.data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }) as unknown as typeof fetch
  return new SiyuanKernelClient({ baseUrl: 'http://127.0.0.1:6806', token: 'tok', fetchImpl })
}

describe('pluginBridge handlers', () => {
  let configDir: string
  let prevConfig: string | undefined
  let dataDir: string | undefined

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), 'craft-plugin-bridge-'))
    prevConfig = process.env.CRAFT_CONFIG_DIR
    process.env.CRAFT_CONFIG_DIR = configDir
    resetExtensionStateStoreCache()
    resetPluginBridgeFixture()
    __setPluginBridgeKernelClientForTests(null) // force no auto kernel
    __setSiyuanDataDirCandidatesForTests([]) // empty fs by default
  })

  afterEach(() => {
    resetPluginBridgeFixture()
    resetExtensionStateStoreCache()
    __setPluginBridgeKernelClientForTests(undefined)
    __setSiyuanDataDirCandidatesForTests(null)
    if (prevConfig === undefined) delete process.env.CRAFT_CONFIG_DIR
    else process.env.CRAFT_CONFIG_DIR = prevConfig
    rmSync(configDir, { recursive: true, force: true })
    if (dataDir) {
      rmSync(dataDir, { recursive: true, force: true })
      dataDir = undefined
    }
  })

  it('registers every HANDLED_CHANNELS entry', () => {
    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    expect([...HANDLED_CHANNELS]).toEqual([
      RPC_CHANNELS.pluginBridge.LIST_PLUGINS,
      RPC_CHANNELS.pluginBridge.GET_PROJECTIONS,
      RPC_CHANNELS.pluginBridge.SET_ENABLED,
      RPC_CHANNELS.pluginBridge.OPEN_COMPAT,
    ])
    for (const ch of HANDLED_CHANNELS) {
      expect(server.handlers.has(ch)).toBe(true)
    }
  })

  it('LIST_PLUGINS soft-fails empty with residual when no fixture/fs/kernel', async () => {
    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const list = server.handlers.get(RPC_CHANNELS.pluginBridge.LIST_PLUGINS)!
    const result = (await list({})) as {
      plugins: unknown[]
      residual?: string
      fixture?: boolean
    }
    expect(result.plugins).toEqual([])
    expect(result.residual).toBeTruthy()
    expect(result.fixture).toBeUndefined()
  })

  it('LIST_PLUGINS returns fixture manifests', async () => {
    setPluginBridgeFixture([
      {
        name: 'fx-plugin',
        version: '0.1.0',
        craft: { level: 2 },
      },
    ])
    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const list = server.handlers.get(RPC_CHANNELS.pluginBridge.LIST_PLUGINS)!
    const result = (await list({})) as {
      plugins: Array<{ id: string; level: number; enabled: boolean }>
      fixture?: boolean
      residual?: string
    }
    expect(result.fixture).toBe(true)
    expect(result.plugins).toHaveLength(1)
    expect(result.plugins[0]?.id).toBe('siyuan-plugin:fx-plugin')
    expect(result.plugins[0]?.level).toBe(2)
    expect(result.plugins[0]?.enabled).toBe(true)
    expect(result.residual).toContain('fixture')
  })

  it('LIST_PLUGINS returns filesystem manifests with petals enabled', async () => {
    dataDir = makeTempDataDir()
    writePlugin(dataDir, 'fs-plugin', {
      name: 'fs-plugin',
      version: '3.1.0',
      craft: { level: 1 },
    })
    writePlugin(dataDir, 'other-plugin', {
      name: 'other-plugin',
      version: '0.2.0',
    })
    writeFileSync(
      join(dataDir, 'storage', 'petal', 'petals.json'),
      JSON.stringify([
        { name: 'fs-plugin', enabled: false },
        { name: 'other-plugin', enabled: true },
      ]),
      'utf8',
    )
    __setSiyuanDataDirCandidatesForTests([dataDir])

    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const list = server.handlers.get(RPC_CHANNELS.pluginBridge.LIST_PLUGINS)!
    const result = (await list({})) as {
      plugins: Array<{ id: string; name: string; enabled: boolean; level: number }>
      fixture?: boolean
      residual?: string
    }
    expect(result.fixture).toBeUndefined()
    expect(result.plugins).toHaveLength(2)
    const fsPlugin = result.plugins.find((p) => p.name === 'fs-plugin')
    expect(fsPlugin?.enabled).toBe(false)
    expect(fsPlugin?.level).toBe(1)
    expect(result.plugins.find((p) => p.name === 'other-plugin')?.enabled).toBe(true)
    expect(result.residual).toContain('filesystem')
  })

  it('LIST_PLUGINS prefers kernel feed when healthy client is injected', async () => {
    const client = makeKernelClient({
      '/api/system/version': () => ({ data: '3.1.28' }),
      '/api/bazaar/getInstalledPlugin': () => ({
        data: [
          {
            name: 'kernel-plugin',
            version: '9.0.0',
            craft: { level: 2 },
          },
        ],
      }),
      '/api/petal/loadPetals': () => ({
        data: [{ name: 'kernel-plugin', enabled: false }],
      }),
    })
    __setPluginBridgeKernelClientForTests(client)

    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const list = server.handlers.get(RPC_CHANNELS.pluginBridge.LIST_PLUGINS)!
    const result = (await list({})) as {
      plugins: Array<{ id: string; enabled: boolean; level: number }>
      residual?: string
    }
    expect(result.plugins).toHaveLength(1)
    expect(result.plugins[0]?.id).toBe('siyuan-plugin:kernel-plugin')
    expect(result.plugins[0]?.enabled).toBe(false)
    expect(result.plugins[0]?.level).toBe(2)
    expect(result.residual).toContain('kernel')
  })

  it('LIST_PLUGINS soft-falls to filesystem when kernel throws', async () => {
    dataDir = makeTempDataDir()
    writePlugin(dataDir, 'fs-only', { name: 'fs-only', version: '1.0.0' })
    __setSiyuanDataDirCandidatesForTests([dataDir])

    const client = makeKernelClient({
      '/api/system/version': () => ({ data: '3.1.28' }),
      '/api/bazaar/getInstalledPlugin': () => {
        throw new Error('kernel down mid-call')
      },
      '/api/petal/loadPetals': () => ({ data: [] }),
    })
    __setPluginBridgeKernelClientForTests(client)

    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const list = server.handlers.get(RPC_CHANNELS.pluginBridge.LIST_PLUGINS)!
    const result = (await list({})) as {
      plugins: Array<{ name: string }>
      residual?: string
    }
    expect(result.plugins.map((p) => p.name)).toEqual(['fs-only'])
    expect(result.residual).toContain('filesystem')
  })

  it('GET_PROJECTIONS projects fixture with granted permissions', async () => {
    setPluginBridgeFixture([
      {
        name: 'fx-plugin',
        version: '0.1.0',
        craft: {
          level: 2,
          contributes: {
            commands: [{ id: 'fx.run', title: 'Run', permissions: ['ui.command'] }],
          },
        },
      },
    ])
    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const get = server.handlers.get(RPC_CHANNELS.pluginBridge.GET_PROJECTIONS)!
    const denied = (await get({}, { pluginId: 'fx-plugin', grantedPermissions: [] })) as {
      commands: unknown[]
      diagnostics: Array<{ kind: string }>
    }
    expect(denied.commands).toEqual([])
    expect(denied.diagnostics.some((d) => d.kind === 'permission-denied')).toBe(true)

    const ok = (await get(
      {},
      { pluginId: 'siyuan-plugin:fx-plugin', grantedPermissions: ['ui.command'] },
    )) as { commands: Array<{ id: string; source: string }> }
    expect(ok.commands).toHaveLength(1)
    expect(ok.commands[0]).toMatchObject({ id: 'fx.run', source: 'siyuan-plugin' })
  })

  it('GET_PROJECTIONS without grants still returns L2 commands when plugin declares ui.command', async () => {
    setPluginBridgeFixture([
      {
        name: 'fx-plugin',
        version: '0.1.0',
        craft: {
          level: 2,
          contributes: {
            commands: [{ id: 'fx.run', title: 'Run', permissions: ['ui.command'] }],
          },
        },
      },
    ])
    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const get = server.handlers.get(RPC_CHANNELS.pluginBridge.GET_PROJECTIONS)!
    const projected = (await get({}, { pluginId: 'fx-plugin' })) as {
      commands: Array<{ id: string; source: string }>
      level: number
    }
    expect(projected.level).toBe(2)
    expect(projected.commands).toHaveLength(1)
    expect(projected.commands[0]).toMatchObject({ id: 'fx.run', source: 'siyuan-plugin' })
  })

  it('SET_ENABLED persists locally only when kernel unavailable', async () => {
    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const set = server.handlers.get(RPC_CHANNELS.pluginBridge.SET_ENABLED)!
    const result = (await set({}, { pluginId: 'fx-plugin', enabled: false })) as {
      pluginId: string
      enabled: boolean
      persisted: string
      residual?: string
    }
    expect(result.pluginId).toBe('siyuan-plugin:fx-plugin')
    expect(result.enabled).toBe(false)
    expect(result.persisted).toBe('local')
    expect(result.residual).toContain('kernel')
  })

  it('SET_ENABLED local then LIST shows disabled without kernel', async () => {
    setPluginBridgeFixture([
      {
        name: 'fx-plugin',
        version: '0.1.0',
        craft: { level: 2 },
      },
    ])
    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const set = server.handlers.get(RPC_CHANNELS.pluginBridge.SET_ENABLED)!
    const list = server.handlers.get(RPC_CHANNELS.pluginBridge.LIST_PLUGINS)!

    const setResult = (await set({}, { pluginId: 'fx-plugin', enabled: false })) as {
      persisted: string
    }
    expect(setResult.persisted).toBe('local')

    const result = (await list({})) as {
      plugins: Array<{ id: string; enabled: boolean }>
    }
    expect(result.plugins).toHaveLength(1)
    expect(result.plugins[0]?.id).toBe('siyuan-plugin:fx-plugin')
    expect(result.plugins[0]?.enabled).toBe(false)
  })

  it('SET_ENABLED calls setPetalEnabled when kernel available', async () => {
    const calls: Array<{ endpoint: string; body: Record<string, unknown> }> = []
    const client = makeKernelClient({
      '/api/system/version': () => ({ data: '3.1.28' }),
      '/api/petal/setPetalEnabled': (body) => {
        calls.push({ endpoint: '/api/petal/setPetalEnabled', body })
        return { data: null }
      },
    })
    __setPluginBridgeKernelClientForTests(client)

    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const set = server.handlers.get(RPC_CHANNELS.pluginBridge.SET_ENABLED)!
    const result = (await set({}, { pluginId: 'siyuan-plugin:fx-plugin', enabled: true })) as {
      persisted: string
      residual?: string
    }
    expect(result.persisted).toBe('kernel')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body).toEqual({ packageName: 'fx-plugin', enabled: true })
  })

  it('OPEN_COMPAT returns route descriptor only', async () => {
    const server = createMockServer()
    registerPluginBridgeHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const open = server.handlers.get(RPC_CHANNELS.pluginBridge.OPEN_COMPAT)!
    const result = (await open({}, { pluginId: 'any' })) as {
      route: string
      ref: { kind: string; id: string }
    }
    expect(result.route).toBe('knowledge/notebook/__full__')
    expect(result.ref).toEqual({ kind: 'notebook', id: '__full__' })
  })
})
