import { describe, expect, it } from 'bun:test'

import type { MarketplaceEntry } from '../catalog.ts'
import {
  createMemoryStatsStore,
  fetchMarketplaceStats,
  type MarketplaceStatsFetch,
} from '../stats.ts'

const ENTRY: MarketplaceEntry = {
  id: 'pack-one',
  kind: 'skillpack',
  title: 'Pack One',
  descriptionRu: 'Тестовый пак',
  source: { type: 'github', repo: 'owner/repo', ref: 'c'.repeat(40) },
}

describe('fetchMarketplaceStats', () => {
  it('serves fresh cache hits with zero network calls', async () => {
    const now = 1_700_000_000_000
    const store = createMemoryStatsStore({
      'pack-one': { stars: 5, pushedAt: '2026-01-01T00:00:00Z', fetchedAt: now },
    })
    let calls = 0
    const fetchFn: MarketplaceStatsFetch = async () => {
      calls++
      throw new Error('must not be called')
    }
    const result = await fetchMarketplaceStats([ENTRY], { store, fetchFn, now: () => now + 60_000 })
    expect(calls).toBe(0)
    expect(result['pack-one']).toEqual({
      id: 'pack-one',
      stars: 5,
      pushedAt: '2026-01-01T00:00:00Z',
      fetchedAt: now,
      stale: false,
    })
  })

  it('fetches on a cache miss and updates the store', async () => {
    const now = 1_700_000_000_000
    const store = createMemoryStatsStore()
    let requestedUrl: string | undefined
    const fetchFn: MarketplaceStatsFetch = async (url) => {
      requestedUrl = url
      return {
        ok: true,
        status: 200,
        json: async () => ({ stargazers_count: 42, pushed_at: '2026-08-01T00:00:00Z' }),
      }
    }
    const result = await fetchMarketplaceStats([ENTRY], { store, fetchFn, now: () => now })
    expect(requestedUrl).toBe('https://api.github.com/repos/owner/repo')
    expect(result['pack-one']!.stars).toBe(42)
    expect(result['pack-one']!.stale).toBe(false)
    expect(store.data['pack-one']).toEqual({ stars: 42, pushedAt: '2026-08-01T00:00:00Z', fetchedAt: now })
  })
})
