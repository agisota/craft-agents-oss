import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { resetExtensionStateStoreCache } from '@craft-agent/shared/extensions'
import { HANDLED_CHANNELS, registerExtensionsHandlers } from '../extensions'

type Handler = (ctx: unknown, ...args: unknown[]) => unknown | Promise<unknown>

function createMockServer() {
  const handlers = new Map<string, Handler>()
  return {
    handlers,
    handle(channel: string, fn: Handler) {
      handlers.set(channel, fn)
    },
    push() {},
  }
}

describe('extensions RPC', () => {
  let dir: string
  let prev: string | undefined

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ext-rpc-'))
    prev = process.env.CRAFT_CONFIG_DIR
    process.env.CRAFT_CONFIG_DIR = dir
    resetExtensionStateStoreCache()
    // Minimal marketplace cache so catalog load does not hit network hard-fail.
    const mp = join(dir, 'marketplace')
    mkdirSync(mp, { recursive: true })
    writeFileSync(
      join(mp, 'catalog.cache.json'),
      JSON.stringify({
        fetchedAt: Date.now(),
        catalog: {
          catalogVersion: 1,
          entries: [
            {
              id: 'demo-pack',
              kind: 'skillpack',
              title: 'Demo Pack',
              descriptionRu: 'demo',
              source: {
                type: 'github',
                repo: 'acme/demo',
                ref: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              },
              skills: ['a'],
              expectedContentSha256: {
                a: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              },
            },
          ],
        },
      }),
      'utf8',
    )
    writeFileSync(
      join(mp, 'lock.json'),
      JSON.stringify({
        version: 1,
        entries: {
          'demo-pack': {
            id: 'demo-pack',
            kind: 'skillpack',
            repo: 'acme/demo',
            ref: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            installedAt: Date.now(),
            status: 'installed',
            targets: [join(dir, 'skills', 'a')],
          },
        },
      }),
      'utf8',
    )
  })

  afterEach(() => {
    resetExtensionStateStoreCache()
    if (prev === undefined) delete process.env.CRAFT_CONFIG_DIR
    else process.env.CRAFT_CONFIG_DIR = prev
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  it('registers expected channels', () => {
    const server = createMockServer()
    registerExtensionsHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    expect(HANDLED_CHANNELS).toEqual([
      RPC_CHANNELS.extensions.LIST_CATALOG,
      RPC_CHANNELS.extensions.LIST_INSTALLED,
      RPC_CHANNELS.extensions.SET_ENABLED,
      RPC_CHANNELS.extensions.GET_STATE,
    ])
    for (const ch of HANDLED_CHANNELS) {
      expect(server.handlers.has(ch)).toBe(true)
    }
  })

  it('listCatalog includes craft-curated entries and siyuan stub provider', async () => {
    const server = createMockServer()
    registerExtensionsHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const list = server.handlers.get(RPC_CHANNELS.extensions.LIST_CATALOG)!
    const result = (await list({}, {})) as {
      entries: Array<{ id: string; runtime: string }>
      providers: Array<{ id: string }>
    }
    expect(result.providers.map((p) => p.id).sort()).toEqual(['craft-curated', 'siyuan-bazaar'])
    expect(result.entries.some((e) => e.id === 'marketplace:demo-pack')).toBe(true)
    expect(result.entries.find((e) => e.id === 'marketplace:demo-pack')?.runtime).toBe('skill-pack')
  })

  it('listInstalled projects marketplace lock + setEnabled persists', async () => {
    const server = createMockServer()
    registerExtensionsHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const listInstalled = server.handlers.get(RPC_CHANNELS.extensions.LIST_INSTALLED)!
    const setEnabled = server.handlers.get(RPC_CHANNELS.extensions.SET_ENABLED)!
    const getState = server.handlers.get(RPC_CHANNELS.extensions.GET_STATE)!

    const before = (await listInstalled({}, {})) as {
      records: Array<{ id: string; status: string }>
    }
    expect(before.records.some((r) => r.id === 'marketplace:demo-pack')).toBe(true)
    expect(before.records.find((r) => r.id === 'marketplace:demo-pack')?.status).toBe('enabled')

    await setEnabled({}, { id: 'marketplace:demo-pack', enabled: false })
    const state = (await getState({})) as { state: { enabled: Record<string, boolean> } }
    expect(state.state.enabled['marketplace:demo-pack']).toBe(false)

    const after = (await listInstalled({}, {})) as {
      records: Array<{ id: string; status: string }>
    }
    expect(after.records.find((r) => r.id === 'marketplace:demo-pack')?.status).toBe('disabled')
  })
})
