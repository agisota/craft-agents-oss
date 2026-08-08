/**
 * Client-side reader for `{workspaceRoot}/.craft/notes-migration-map.json`.
 *
 * Written by knowledge.migrateNotes (P4.4). Used by Notes Extract Tasks attach
 * chip and ChatPage note deep-links so migrated notes open/attach as SiYuan docs.
 */

export const NOTES_MIGRATION_MAP_RELATIVE = '.craft/notes-migration-map.json'

export interface NotesMigrationMapEntry {
  noteId: string
  path: string
  siyuanId: string
  title: string
  migratedAt: number
}

export interface NotesMigrationMap {
  version: number
  notebookId?: string
  notebookName?: string
  entries: NotesMigrationMapEntry[]
}

/** Normalize note id / relative path keys for map lookup. */
export function normalizeNoteMapKey(value: string): string {
  let cleaned = value.replace(/\\/g, '/').trim().replace(/^\.\//, '')
  if (cleaned.toLowerCase().startsWith('notes/')) {
    cleaned = cleaned.slice('notes/'.length)
  }
  if (cleaned.toLowerCase().endsWith('.md')) {
    cleaned = cleaned.slice(0, -3)
  }
  return cleaned.toLowerCase()
}

export function parseNotesMigrationMap(raw: string): NotesMigrationMap {
  try {
    const parsed = JSON.parse(raw) as Partial<NotesMigrationMap>
    if (!parsed || typeof parsed !== 'object') {
      return { version: 1, entries: [] }
    }
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter(
          (e): e is NotesMigrationMapEntry =>
            !!e &&
            typeof e.noteId === 'string' &&
            typeof e.path === 'string' &&
            typeof e.siyuanId === 'string' &&
            typeof e.title === 'string' &&
            typeof e.migratedAt === 'number',
        )
      : []
    return {
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      notebookId: typeof parsed.notebookId === 'string' ? parsed.notebookId : undefined,
      notebookName: typeof parsed.notebookName === 'string' ? parsed.notebookName : undefined,
      entries,
    }
  } catch {
    return { version: 1, entries: [] }
  }
}

export function findMigrationEntry(
  map: NotesMigrationMap,
  noteIdOrPath: string,
): NotesMigrationMapEntry | null {
  const key = normalizeNoteMapKey(noteIdOrPath)
  if (!key) return null
  for (const entry of map.entries) {
    if (normalizeNoteMapKey(entry.noteId) === key) return entry
    if (normalizeNoteMapKey(entry.path) === key) return entry
  }
  return null
}

export function notesMigrationMapAbsolutePath(workspaceRoot: string): string {
  const root = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '')
  return `${root}/${NOTES_MIGRATION_MAP_RELATIVE}`
}

/**
 * Read the migration map from disk via electronAPI.readFile.
 * Missing/unreadable map → empty entries (not an error).
 */
export async function loadNotesMigrationMap(
  workspaceRoot: string | null | undefined,
  readFile: (path: string) => Promise<string> = (path) => window.electronAPI.readFile(path),
): Promise<NotesMigrationMap> {
  if (!workspaceRoot) return { version: 1, entries: [] }
  const mapPath = notesMigrationMapAbsolutePath(workspaceRoot)
  try {
    const raw = await readFile(mapPath)
    return parseNotesMigrationMap(raw)
  } catch {
    return { version: 1, entries: [] }
  }
}

export async function lookupMigratedSiyuanId(
  workspaceRoot: string | null | undefined,
  noteIdOrPath: string,
  readFile?: (path: string) => Promise<string>,
): Promise<NotesMigrationMapEntry | null> {
  const map = await loadNotesMigrationMap(workspaceRoot, readFile)
  return findMigrationEntry(map, noteIdOrPath)
}
