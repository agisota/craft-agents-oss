import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  CatalogValidationError,
  createMemoryMetaStore,
  getCatalog,
  marketplacePaths,
  parseCatalog,
  type MarketplaceCatalog,
  type MarketplaceFetch,
} from '../catalog.ts'

const REF = 'a'.repeat(40)

const VALID_CATALOG: MarketplaceCatalog = {
  catalogVersion: 1,
  entries: [
    {
      id: 'pack-one',
      kind: 'skillpack',
      title: 'Pack One',
      descriptionRu: 'Тестовый пак',
      source: { type: 'github', repo: 'owner/repo', ref: REF },
    },
  ],
}

const failingFetch: MarketplaceFetch = async () => {
  throw new Error('network down')
}

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'craft-marketplace-catalog-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('parseCatalog', () => {
  it('accepts a valid catalog', () => {
    expect(parseCatalog(JSON.parse(JSON.stringify(VALID_CATALOG)))).toEqual(VALID_CATALOG)
  })

  it('rejects entries without descriptionRu (fail-closed)', () => {
    const bad = {
      catalogVersion: 1,
      entries: [{ id: 'x', kind: 'tool', title: 'X', source: { type: 'github', repo: 'o/r', ref: REF }, toolName: 'x' }],
    }
    expect(() => parseCatalog(bad)).toThrow(CatalogValidationError)
  })

  it('rejects floating refs', () => {
    const bad = JSON.parse(JSON.stringify(VALID_CATALOG))
    bad.entries[0].source.ref = 'main'
    expect(() => parseCatalog(bad)).toThrow(CatalogValidationError)
  })

  it('accepts valid expectedContentSha256 and lowercases digests', () => {
    const raw = JSON.parse(JSON.stringify(VALID_CATALOG))
    const upper = 'A'.repeat(64)
    raw.entries[0].expectedContentSha256 = { 'skill-a': upper }
    const parsed = parseCatalog(raw)
    expect(parsed.entries[0]!.expectedContentSha256).toEqual({ 'skill-a': 'a'.repeat(64) })
  })

  it('rejects expectedContentSha256 when not an object', () => {
    const bad = JSON.parse(JSON.stringify(VALID_CATALOG))
    bad.entries[0].expectedContentSha256 = ['not-an-object']
    expect(() => parseCatalog(bad)).toThrow(CatalogValidationError)
  })

  it('rejects expectedContentSha256 with bad hex values', () => {
    const bad = JSON.parse(JSON.stringify(VALID_CATALOG))
    bad.entries[0].expectedContentSha256 = { 'skill-a': 'deadbeef' }
    expect(() => parseCatalog(bad)).toThrow(CatalogValidationError)
  })

  it('rejects expectedContentSha256 keys that are empty or contain ..', () => {
    const emptyKey = JSON.parse(JSON.stringify(VALID_CATALOG))
    emptyKey.entries[0].expectedContentSha256 = { '': 'a'.repeat(64) }
    expect(() => parseCatalog(emptyKey)).toThrow(CatalogValidationError)

    const dotdot = JSON.parse(JSON.stringify(VALID_CATALOG))
    dotdot.entries[0].expectedContentSha256 = { '../escape': 'a'.repeat(64) }
    expect(() => parseCatalog(dotdot)).toThrow(CatalogValidationError)
  })
})

describe('getCatalog degradation ladder', () => {
  it('falls back to the bundled catalog when the network fails', async () => {
    const bundledCatalogPath = join(dir, 'bundle.json')
    writeFileSync(bundledCatalogPath, JSON.stringify(VALID_CATALOG))
    const result = await getCatalog({
      configDir: dir,
      metaStore: createMemoryMetaStore(),
      fetchFn: failingFetch,
      bundledCatalogPath,
    })
    expect(result.origin).toBe('bundled')
    expect(result.catalog).toEqual(VALID_CATALOG)
    expect(result.error).toBe('network down')
  })

  it('serves a fresh cache without touching the network', async () => {
    const now = 1_700_000_000_000
    const raw = JSON.stringify({ fetchedAt: now, catalog: VALID_CATALOG })
    mkdirSync(marketplacePaths(dir).dir, { recursive: true })
    writeFileSync(marketplacePaths(dir).catalogCache, raw)

    let calls = 0
    const countingFetch: MarketplaceFetch = async () => {
      calls++
      throw new Error('must not be called')
    }
    const result = await getCatalog({
      configDir: dir,
      metaStore: createMemoryMetaStore(),
      fetchFn: countingFetch,
      now: () => now + 1000, // within the 24h TTL
    })
    expect(calls).toBe(0)
    expect(result.origin).toBe('cache')
    expect(result.catalog).toEqual(VALID_CATALOG)
  })
})
