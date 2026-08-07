/**
 * KnowledgeChangeWatcher — polling attr/hash change detection (P6).
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  InMemoryKnowledgeProvider,
  hashKnowledgeContent,
  type KnowledgeNode,
  type KnowledgeRef,
} from '@craft-agent/core/knowledge'
import {
  KnowledgeChangeWatcher,
  stopAllKnowledgeWatches,
  type KnowledgeWatchEvent,
  type KnowledgeWatchPayload,
} from '../change-watcher'

const DOC: KnowledgeRef = { scheme: 'siyuan', kind: 'document', id: 'doc-1' }

async function node(
  markdown: string,
  attrs: Array<{ key: string; value: string }> = [],
): Promise<KnowledgeNode> {
  const contentHash = await hashKnowledgeContent(markdown)
  return {
    ref: { ...DOC },
    title: 'Doc',
    markdown,
    path: '/Doc',
    attributes: attrs,
    createdAt: 1,
    updatedAt: 1,
    contentHash,
  }
}

describe('KnowledgeChangeWatcher', () => {
  const tmpDirs: string[] = []
  afterEach(() => {
    stopAllKnowledgeWatches()
    for (const d of tmpDirs.splice(0)) {
      try {
        rmSync(d, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  })

  it('seeds silently then emits AttributeChanged once on attr diff', async () => {
    const root = mkdtempSync(join(tmpdir(), 'craft-watch-'))
    tmpDirs.push(root)

    const n1 = await node('body', [{ key: 'workflow_status', value: 'open' }])
    const provider = new InMemoryKnowledgeProvider({
      connectionId: 'c1',
      seed: { nodes: [n1] },
    })

    const events: Array<{ event: KnowledgeWatchEvent; payload: KnowledgeWatchPayload }> = []
    const watcher = new KnowledgeChangeWatcher({
      connectionId: 'c1',
      workspaceId: 'ws-1',
      workspaceRoot: root,
      getProvider: async () => provider,
      onEvent: (event, payload) => {
        events.push({ event, payload })
      },
      intervalMs: 60_000,
      // Do not start interval — we drive tick() manually
      setIntervalFn: (() => 0) as unknown as typeof setInterval,
      clearIntervalFn: (() => {}) as unknown as typeof clearInterval,
      silentSeed: true,
    })

    // First tick = seed baseline, no emits
    await watcher.tick()
    expect(events).toEqual([])

    // Mutate attrs in-place on the in-memory node
    const live = await provider.get(DOC)
    // InMemory stores by id — re-seed by proposing? Simpler: replace via internal if needed.
    // Use provider.proposeMutation setAttribute path... or construct new provider.
    // Easiest: new provider with updated attrs and same watcher state file.
    const n2 = await node('body', [{ key: 'workflow_status', value: 'needs-research' }])
    const provider2 = new InMemoryKnowledgeProvider({
      connectionId: 'c1',
      seed: { nodes: [n2] },
    })
    // Swap getProvider by creating a new watcher against same state path
    const watcher2 = new KnowledgeChangeWatcher({
      connectionId: 'c1',
      workspaceId: 'ws-1',
      workspaceRoot: root,
      getProvider: async () => provider2,
      onEvent: (event, payload) => {
        events.push({ event, payload })
      },
      intervalMs: 60_000,
      setIntervalFn: (() => 0) as unknown as typeof setInterval,
      clearIntervalFn: (() => {}) as unknown as typeof clearInterval,
      silentSeed: false, // state file already exists from first watcher
    })
    // Force seeded=true path by ticking — state file has prior entry
    await watcher2.tick()

    const attrEvents = events.filter((e) => e.event === 'KnowledgeAttributeChanged')
    expect(attrEvents.length).toBeGreaterThanOrEqual(1)
    const hit = attrEvents.find((e) => e.payload.attribute?.name === 'workflow_status')
    expect(hit).toBeDefined()
    expect(hit!.payload.oldValue).toBe('open')
    expect(hit!.payload.newValue).toBe('needs-research')

    // Second tick with same state → no duplicate attr events
    const before = events.length
    await watcher2.tick()
    const attrAfter = events.slice(before).filter((e) => e.event === 'KnowledgeAttributeChanged')
    expect(attrAfter).toEqual([])

    watcher.stop()
    watcher2.stop()
    expect(watcher.isRunning).toBe(false)
  })

  it('stop() prevents further processing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'craft-watch-stop-'))
    tmpDirs.push(root)
    const n1 = await node('v1')
    const provider = new InMemoryKnowledgeProvider({ connectionId: 'c1', seed: { nodes: [n1] } })
    let calls = 0
    const watcher = new KnowledgeChangeWatcher({
      connectionId: 'c1',
      workspaceId: 'ws',
      workspaceRoot: root,
      getProvider: async () => {
        calls += 1
        return provider
      },
      onEvent: () => {},
      setIntervalFn: (() => 0) as unknown as typeof setInterval,
      clearIntervalFn: (() => {}) as unknown as typeof clearInterval,
    })
    watcher.start()
    await watcher.tick()
    const afterStart = calls
    watcher.stop()
    expect(watcher.isRunning).toBe(false)
    watcher.dispose()
    await watcher.tick() // disposed → no-op
    expect(calls).toBe(afterStart)
  })

  it('emits KnowledgeDocumentUpdated when contentHash changes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'craft-watch-hash-'))
    tmpDirs.push(root)
    const n1 = await node('version-one')
    const p1 = new InMemoryKnowledgeProvider({ connectionId: 'c1', seed: { nodes: [n1] } })
    const events: string[] = []

    const w1 = new KnowledgeChangeWatcher({
      connectionId: 'c1',
      workspaceId: 'ws',
      workspaceRoot: root,
      getProvider: async () => p1,
      onEvent: (e) => {
        events.push(e)
      },
      setIntervalFn: (() => 0) as unknown as typeof setInterval,
      clearIntervalFn: (() => {}) as unknown as typeof clearInterval,
      silentSeed: true,
    })
    await w1.tick()
    expect(events).toEqual([])

    const n2 = await node('version-two')
    const p2 = new InMemoryKnowledgeProvider({ connectionId: 'c1', seed: { nodes: [n2] } })
    const w2 = new KnowledgeChangeWatcher({
      connectionId: 'c1',
      workspaceId: 'ws',
      workspaceRoot: root,
      getProvider: async () => p2,
      onEvent: (e) => {
        events.push(e)
      },
      setIntervalFn: (() => 0) as unknown as typeof setInterval,
      clearIntervalFn: (() => {}) as unknown as typeof clearInterval,
      silentSeed: false,
    })
    await w2.tick()
    expect(events).toContain('KnowledgeDocumentUpdated')
    w1.stop()
    w2.stop()
  })
})
