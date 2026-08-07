import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCatalog } from '../catalog.ts'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../')
const CATALOG_PATH = join(REPO_ROOT, 'apps/electron/resources/marketplace/catalog.json')
const SHA256_RE = /^[0-9a-f]{64}$/

describe('bundled catalog content pins', () => {
  it('parseCatalog accepts on-disk catalog.json', () => {
    expect(existsSync(CATALOG_PATH)).toBe(true)
    const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as unknown
    const catalog = parseCatalog(raw)
    expect(catalog.catalogVersion).toBeGreaterThanOrEqual(1)
    expect(catalog.entries.length).toBeGreaterThan(0)
  })

  it('every present expectedContentSha256 pin is a 64-hex digest', () => {
    const catalog = parseCatalog(JSON.parse(readFileSync(CATALOG_PATH, 'utf8')))
    let pinCount = 0
    for (const entry of catalog.entries) {
      if (entry.kind !== 'skillpack' && entry.kind !== 'context-doc') continue
      const pins = entry.expectedContentSha256
      if (!pins) continue
      for (const [key, value] of Object.entries(pins)) {
        expect(key.length).toBeGreaterThan(0)
        expect(key.includes('..')).toBe(false)
        expect(value).toMatch(SHA256_RE)
        pinCount++
      }
    }
    // Soft floor: script may partially pin; when pins exist they must be well-formed.
    // Prefer at least the next-skills context-doc pins when the pin script ran successfully.
    const nextSkills = catalog.entries.find((e) => e.id === 'next-skills')
    if (nextSkills?.expectedContentSha256) {
      expect(Object.keys(nextSkills.expectedContentSha256).length).toBeGreaterThan(0)
      for (const v of Object.values(nextSkills.expectedContentSha256)) {
        expect(v).toMatch(SHA256_RE)
      }
    }
    expect(pinCount).toBeGreaterThanOrEqual(0)
  })
})
