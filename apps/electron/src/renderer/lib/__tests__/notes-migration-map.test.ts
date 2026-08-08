import { describe, expect, it } from 'bun:test'
import {
  findMigrationEntry,
  normalizeNoteMapKey,
  parseNotesMigrationMap,
  loadNotesMigrationMap,
  lookupMigratedSiyuanId,
} from '../notes-migration-map'

const SAMPLE = JSON.stringify({
  version: 1,
  notebookId: 'nb-1',
  notebookName: 'Craft Notes',
  entries: [
    {
      noteId: 'alpha',
      path: 'alpha.md',
      siyuanId: '20240101120000-abcde',
      title: 'Alpha',
      migratedAt: 1,
    },
    {
      noteId: 'projects/beta',
      path: 'projects/beta.md',
      siyuanId: 'doc-beta',
      title: 'Beta',
      migratedAt: 2,
    },
  ],
})

describe('normalizeNoteMapKey', () => {
  it('strips notes/ prefix, .md, and lowercases', () => {
    expect(normalizeNoteMapKey('notes/Alpha.md')).toBe('alpha')
    expect(normalizeNoteMapKey('projects/Beta')).toBe('projects/beta')
    expect(normalizeNoteMapKey('./notes/x/Y.md')).toBe('x/y')
  })
})

describe('parseNotesMigrationMap + findMigrationEntry', () => {
  it('finds by noteId and path variants', () => {
    const map = parseNotesMigrationMap(SAMPLE)
    expect(findMigrationEntry(map, 'alpha')?.siyuanId).toBe('20240101120000-abcde')
    expect(findMigrationEntry(map, 'notes/alpha.md')?.siyuanId).toBe('20240101120000-abcde')
    expect(findMigrationEntry(map, 'projects/beta.md')?.siyuanId).toBe('doc-beta')
    expect(findMigrationEntry(map, 'missing')).toBeNull()
  })

  it('returns empty on garbage', () => {
    expect(parseNotesMigrationMap('not-json').entries).toEqual([])
  })
})

describe('loadNotesMigrationMap / lookupMigratedSiyuanId', () => {
  it('loads via readFile and looks up', async () => {
    const readFile = async (path: string) => {
      expect(path.replace(/\\/g, '/')).toMatch(/\/.craft\/notes-migration-map\.json$/)
      return SAMPLE
    }
    const map = await loadNotesMigrationMap('/ws/root', readFile)
    expect(map.entries).toHaveLength(2)
    const entry = await lookupMigratedSiyuanId('/ws/root', 'alpha', readFile)
    expect(entry?.siyuanId).toBe('20240101120000-abcde')
  })

  it('returns empty when read fails', async () => {
    const map = await loadNotesMigrationMap('/ws', async () => {
      throw new Error('ENOENT')
    })
    expect(map.entries).toEqual([])
    expect(await lookupMigratedSiyuanId(null, 'alpha')).toBeNull()
  })
})
