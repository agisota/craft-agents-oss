/**
 * knowledge-home.test.ts — W2 KnowledgeHome search surface logic.
 *
 * Renderer tests in this app are logic-level `bun:test` (no DOM harness), so
 * the component's search/routing behavior is exercised through the exported
 * helpers with a mocked `window.electronAPI.knowledge` (the sessions.test.ts
 * preload-stub pattern). The `window` stub is restored after each test to
 * avoid cross-file pollution (single-process test runner).
 */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { SearchHit } from '@craft-agent/core/knowledge'
import {
  resolveKnowledgeApi,
  searchHitRoute,
  searchKnowledge,
  type KnowledgeSearchApi,
} from '../KnowledgeHome'

const savedWindow = globalThis.window

function makeHit(kind: SearchHit['ref']['kind'], id: string): SearchHit {
  return {
    ref: { scheme: 'siyuan', kind, id },
    title: `Hit ${id}`,
    snippet: 'plain text context',
    notebookPath: '/Notes',
    updatedAt: 1725148800000,
  }
}

function installKnowledgeApi(api: KnowledgeSearchApi) {
  globalThis.window = { electronAPI: { knowledge: api } } as unknown as Window &
    typeof globalThis
}

afterEach(() => {
  globalThis.window = savedWindow
})

describe('searchKnowledge', () => {
  it('searches the first connection and maps hits to siYuan routes (happy path)', async () => {
    const searchCalls: unknown[] = []
    const api: KnowledgeSearchApi = {
      listConnections: async () => [{ id: 'conn-1' }, { id: 'conn-2' }],
      search: async (args) => {
        searchCalls.push(args)
        return { items: [makeHit('document', 'doc-1'), makeHit('block', 'blk-2')] }
      },
    }
    installKnowledgeApi(api)

    const resolved = resolveKnowledgeApi()
    expect(resolved).not.toBeNull()

    const items = await searchKnowledge(resolved, 'ws-42', 'craft agents')
    expect(searchCalls).toEqual([
      { workspaceId: 'ws-42', connectionId: 'conn-1', input: { query: 'craft agents' } },
    ])
    expect(items).toHaveLength(2)
    expect(searchHitRoute(items![0])).toBe('knowledge/document/doc-1')
    expect(searchHitRoute(items![1])).toBe('knowledge/block/blk-2')
  })

  it('returns null and never searches when no connections exist (empty state)', async () => {
    const search = mock(async () => ({ items: [] }))
    const api: KnowledgeSearchApi = {
      listConnections: async () => [],
      search,
    }
    installKnowledgeApi(api)

    const items = await searchKnowledge(resolveKnowledgeApi(), 'ws-42', 'anything')
    expect(items).toBeNull()
    expect(search).not.toHaveBeenCalled()
  })

  it('returns null when the preload knowledge surface is absent', async () => {
    globalThis.window = { electronAPI: {} } as unknown as Window & typeof globalThis
    expect(resolveKnowledgeApi()).toBeNull()
    expect(await searchKnowledge(resolveKnowledgeApi(), 'ws-42', 'q')).toBeNull()
  })

  it('URI-encodes ids so deep-link ids with separators stay a single route segment', () => {
    expect(searchHitRoute(makeHit('document', '20200812/abc def'))).toBe(
      'knowledge/document/20200812%2Fabc%20def',
    )
  })
})
