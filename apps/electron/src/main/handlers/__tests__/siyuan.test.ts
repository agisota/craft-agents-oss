/**
 * Tests for the SiYuan engine surface handlers (durable-key registry over
 * BrowserPaneManager).
 *
 * Harness shape mirrors browser-broadcast.test.ts: recorder RpcServer +
 * HandlerDeps with a stubbed browserPaneManager. The contract under test is
 * the durable-key mapping: dedup by `siyuan:{kind}:{id}` key, STATE_CHANGED /
 * REMOVED broadcast semantics, and workspace-aware LIST filtering.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { RpcServer } from '@craft-agent/server-core/transport'
import { RPC_CHANNELS, type SiyuanSurfaceState } from '@craft-agent/shared/protocol'
import type { HandlerDeps } from '../handler-deps'

mock.module('electron', () => ({
  ipcMain: { handle: () => {}, on: () => {} },
}))

type HandlerFn = (...args: unknown[]) => unknown
type Push = { channel: string; target: unknown; args: unknown[] }

interface Recorder {
  server: RpcServer
  handlers: Map<string, HandlerFn>
  pushes: Push[]
}

function makeServer(): Recorder {
  const handlers = new Map<string, HandlerFn>()
  const pushes: Push[] = []
  const server: RpcServer = {
    handle(channel, handler) {
      handlers.set(channel, handler as HandlerFn)
    },
    push(channel, target, ...args) {
      pushes.push({ channel, target, args })
    },
    async invokeClient() {},
    hasClientCapability() { return false },
    findClientsWithCapability() { return [] },
  }
  return { server, handlers, pushes }
}

interface EmbeddedCalls {
  created: Array<{ url?: string; workspaceId?: string | null }>
  destroyed: string[]
  focused: string[]
  bounds: Array<{ id: string; rect: unknown }>
  nextInstanceId: number
}

function makeDeps(calls: EmbeddedCalls): HandlerDeps {
  return {
    sessionManager: {} as HandlerDeps['sessionManager'],
    platform: {
      appRootPath: '',
      resourcesPath: '',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: false,
      logger: console,
      imageProcessor: {
        getMetadata: async () => null,
        process: async () => Buffer.from(''),
      },
    },
    windowManager: {} as HandlerDeps['windowManager'],
    browserPaneManager: {
      createEmbeddedInstance: (input?: { url?: string; workspaceId?: string | null }) => {
        calls.created.push(input ?? {})
        return `browser-embedded-${++calls.nextInstanceId}`
      },
      destroyInstance: (id: string) => {
        calls.destroyed.push(id)
      },
      syncEmbeddedBounds: (id: string, rect: unknown) => {
        calls.bounds.push({ id, rect })
      },
      focus: (id: string) => {
        calls.focused.push(id)
      },
      onStateChange: () => {},
      onRemoved: () => {},
      onInteracted: () => {},
    } as unknown as NonNullable<HandlerDeps['browserPaneManager']>,
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
  }
}

function makeCalls(): EmbeddedCalls {
  return { created: [], destroyed: [], focused: [], bounds: [], nextInstanceId: 0 }
}

const CTX = {} as never

describe('siyuan surface handlers', () => {
  let recorder: Recorder
  let calls: EmbeddedCalls
  let register: (typeof import('../siyuan'))['registerSiyuanHandlers']
  let HANDLED_CHANNELS: readonly string[]

  beforeEach(async () => {
    recorder = makeServer()
    calls = makeCalls()
    // Dynamic import: electron must be mocked before the handler module graph
    // resolves (repo-wide convention across main/handlers tests).
    const mod = await import('../siyuan')
    register = mod.registerSiyuanHandlers
    HANDLED_CHANNELS = mod.HANDLED_CHANNELS
  })

  it('declares exactly the 5 invoke channels — push events are handler-external', () => {
    expect([...HANDLED_CHANNELS]).toEqual([
      RPC_CHANNELS.siyuan.CREATE_EMBEDDED,
      RPC_CHANNELS.siyuan.DESTROY,
      RPC_CHANNELS.siyuan.LIST,
      RPC_CHANNELS.siyuan.SYNC_BOUNDS,
      RPC_CHANNELS.siyuan.FOCUS,
    ])
    expect([...HANDLED_CHANNELS]).not.toContain(RPC_CHANNELS.siyuan.STATE_CHANGED)
    expect([...HANDLED_CHANNELS]).not.toContain(RPC_CHANNELS.siyuan.REMOVED)
  })

  it('registers a handler for every declared channel and nothing else', () => {
    register(recorder.server, makeDeps(calls))
    expect(recorder.handlers.size).toBe(HANDLED_CHANNELS.length)
    for (const ch of HANDLED_CHANNELS) {
      expect(recorder.handlers.has(ch)).toBe(true)
    }
  })

  it('registers nothing when the browser pane manager is absent', () => {
    const deps = makeDeps(calls)
    deps.browserPaneManager = undefined
    register(recorder.server, deps)
    expect(recorder.handlers.size).toBe(0)
  })

  it('createEmbedded registers the surface, returns the instanceId, broadcasts STATE_CHANGED to all', () => {
    register(recorder.server, makeDeps(calls))
    const handler = recorder.handlers.get(RPC_CHANNELS.siyuan.CREATE_EMBEDDED)!

    const instanceId = handler(CTX, {
      durableKey: 'siyuan:doc:20240101-abc',
      url: 'http://localhost:6806/stage/build/desktop/',
      workspaceId: 'ws-1',
    })

    expect(instanceId).toBe('browser-embedded-1')
    expect(calls.created).toEqual([
      { url: 'http://localhost:6806/stage/build/desktop/', workspaceId: 'ws-1' },
    ])

    const pushes = recorder.pushes.filter((p) => p.channel === RPC_CHANNELS.siyuan.STATE_CHANGED)
    expect(pushes).toHaveLength(1)
    expect(pushes[0].target).toEqual({ to: 'all' })
    expect(pushes[0].args[0]).toEqual({
      instanceId: 'browser-embedded-1',
      durableKey: 'siyuan:doc:20240101-abc',
      url: 'http://localhost:6806/stage/build/desktop/',
      workspaceId: 'ws-1',
    } satisfies SiyuanSurfaceState)
  })

  it('createEmbedded dedups on durableKey: reuses the surface, focuses it, re-broadcasts state', () => {
    register(recorder.server, makeDeps(calls))
    const handler = recorder.handlers.get(RPC_CHANNELS.siyuan.CREATE_EMBEDDED)!

    const first = handler(CTX, { durableKey: 'siyuan:doc:x', url: 'http://h/desktop/', workspaceId: 'ws-1' }) as string
    const second = handler(CTX, { durableKey: 'siyuan:doc:x', url: 'http://h/desktop/', workspaceId: 'ws-1' })

    expect(second).toBe(first)
    expect(calls.created).toHaveLength(1)
    expect(calls.focused).toEqual([first])
    // One push for creation, one for the dedup re-open.
    expect(recorder.pushes.filter((p) => p.channel === RPC_CHANNELS.siyuan.STATE_CHANGED)).toHaveLength(2)
  })

  it('createEmbedded with distinct durable keys creates distinct surfaces', () => {
    register(recorder.server, makeDeps(calls))
    const handler = recorder.handlers.get(RPC_CHANNELS.siyuan.CREATE_EMBEDDED)!

    const a = handler(CTX, { durableKey: 'siyuan:doc:a', url: 'http://h/desktop/', workspaceId: 'ws-1' })
    const b = handler(CTX, { durableKey: 'siyuan:block:b', url: 'http://h/desktop/', workspaceId: 'ws-2' })

    expect(a).not.toBe(b)
    expect(calls.created).toHaveLength(2)
  })

  it('list returns all surfaces, workspace-scopes on request, and always passes unbound surfaces', () => {
    register(recorder.server, makeDeps(calls))
    const create = recorder.handlers.get(RPC_CHANNELS.siyuan.CREATE_EMBEDDED)!
    const list = recorder.handlers.get(RPC_CHANNELS.siyuan.LIST)!

    create(CTX, { durableKey: 'siyuan:doc:a', url: 'u://a', workspaceId: 'ws-1' })
    create(CTX, { durableKey: 'siyuan:doc:b', url: 'u://b', workspaceId: 'ws-2' })
    create(CTX, { durableKey: 'siyuan:doc:c', url: 'u://c' })

    const all = list(CTX) as SiyuanSurfaceState[]
    expect(all.map((s) => s.durableKey).sort()).toEqual(['siyuan:doc:a', 'siyuan:doc:b', 'siyuan:doc:c'])
    // No workspaceId on create → registry stores null.
    expect(all.find((s) => s.durableKey === 'siyuan:doc:c')?.workspaceId).toBeNull()

    const ws1 = list(CTX, { workspaceId: 'ws-1' }) as SiyuanSurfaceState[]
    expect(ws1.map((s) => s.durableKey).sort()).toEqual(['siyuan:doc:a', 'siyuan:doc:c'])
  })

  it('syncBounds forwards the rect verbatim and tolerates unknown instances', () => {
    register(recorder.server, makeDeps(calls))
    const create = recorder.handlers.get(RPC_CHANNELS.siyuan.CREATE_EMBEDDED)!
    const sync = recorder.handlers.get(RPC_CHANNELS.siyuan.SYNC_BOUNDS)!

    const id = create(CTX, { durableKey: 'siyuan:doc:a', url: 'u://a', workspaceId: 'ws-1' }) as string
    const rect = { x: 1, y: 2, width: 300, height: 400 }
    sync(CTX, { instanceId: id, rect })
    sync(CTX, { instanceId: 'ghost', rect: null })

    expect(calls.bounds).toEqual([
      { id, rect },
      { id: 'ghost', rect: null },
    ])
  })

  it('destroy forwards to the manager, purges the registry and broadcasts REMOVED to all', () => {
    register(recorder.server, makeDeps(calls))
    const create = recorder.handlers.get(RPC_CHANNELS.siyuan.CREATE_EMBEDDED)!
    const destroy = recorder.handlers.get(RPC_CHANNELS.siyuan.DESTROY)!
    const list = recorder.handlers.get(RPC_CHANNELS.siyuan.LIST)!

    const id = create(CTX, { durableKey: 'siyuan:doc:a', url: 'u://a', workspaceId: 'ws-1' }) as string
    destroy(CTX, { instanceId: id })

    expect(calls.destroyed).toEqual([id])
    expect(list(CTX)).toEqual([])

    const removedPushes = recorder.pushes.filter((p) => p.channel === RPC_CHANNELS.siyuan.REMOVED)
    expect(removedPushes).toHaveLength(1)
    expect(removedPushes[0].target).toEqual({ to: 'all' })
    expect(removedPushes[0].args).toEqual([id])

    // A new create with the same durable key must spawn a fresh surface now.
    const reused = create(CTX, { durableKey: 'siyuan:doc:a', url: 'u://a', workspaceId: 'ws-1' })
    expect(reused).not.toBe(id)
    expect(calls.created).toHaveLength(2)
  })

  it('destroy of an unknown instance forwards but does not broadcast REMOVED', () => {
    register(recorder.server, makeDeps(calls))
    const destroy = recorder.handlers.get(RPC_CHANNELS.siyuan.DESTROY)!

    destroy(CTX, { instanceId: 'browser-embedded-99' })

    expect(calls.destroyed).toEqual(['browser-embedded-99'])
    expect(recorder.pushes.filter((p) => p.channel === RPC_CHANNELS.siyuan.REMOVED)).toHaveLength(0)
  })

  it('focus forwards to the browser pane manager (contract-complete no-op for embedded)', () => {
    register(recorder.server, makeDeps(calls))
    const focus = recorder.handlers.get(RPC_CHANNELS.siyuan.FOCUS)!

    focus(CTX, { instanceId: 'browser-embedded-1' })
    expect(calls.focused).toEqual(['browser-embedded-1'])
  })
})
