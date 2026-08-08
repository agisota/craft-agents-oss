import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { resetExtensionStateStoreCache } from '@craft-agent/shared/extensions'
import {
  HANDLED_CHANNELS,
  registerPluginBridgeHandlers,
  resetPluginBridgeFixture,
  setPluginBridgeFixture,
} from '../plugin-bridge'

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

describe('pluginBridge handlers', () => {
  let configDir: string
  let prevConfig: string | undefined

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), 'craft-plugin-bridge-'))
    prevConfig = process.env.CRAFT_CONFIG_DIR
    process.env.CRAFT_CONFIG_DIR = configDir
    resetExtensionStateStoreCache()
    resetPluginBridgeFixture()
  })

  afterEach(() => {
    resetPluginBridgeFixture()
    resetExtensionStateStoreCache()
    if (prevConfig === undefined) delete process.env.CRAFT_CONFIG_DIR
    else process.env.CRAFT_CONFIG_DIR = prevConfig
    rmSync(configDir, { recursive: true, force: true })
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

  it('LIST_PLUGINS soft-fails empty with residual when no fixture', async () => {
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
    expect(result.residual).toContain('kernel plugin list API not wired')
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
    }
    expect(result.fixture).toBe(true)
    expect(result.plugins).toHaveLength(1)
    expect(result.plugins[0]?.id).toBe('siyuan-plugin:fx-plugin')
    expect(result.plugins[0]?.level).toBe(2)
    expect(result.plugins[0]?.enabled).toBe(true)
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

  it('SET_ENABLED persists locally only', async () => {
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
