import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isImportProvenancedRelativePath } from '@craft-agent/shared/config'

const source = readFileSync(join(import.meta.dir, '..', 'notes.ts'), 'utf8')

describe('generic Notes omit imported vaults', () => {
  it('classifies migrateNotes destinations as import-provenanced', () => {
    expect(isImportProvenancedRelativePath('imports/alpha')).toBe(true)
    expect(isImportProvenancedRelativePath('assets/imports/picture.png')).toBe(true)
    expect(isImportProvenancedRelativePath('daily/today')).toBe(false)
  })

  it('skips import prefixes in list and rejects import ids on read', () => {
    expect(source).toContain('isImportProvenancedRelativePath(rel)')
    expect(source).toContain("throw new Error('LOCAL_ONLY')")
    expect(source).toContain('isImportProvenancedRelativePath(safe)')
  })
})
