/**
 * P4.4 — migrate Craft markdown notes vault → SiYuan documents.
 *
 * Map file: `{workspaceRoot}/.craft/notes-migration-map.json`
 * Notebook: prefer a notebook named "Craft Notes"; SiYuan has no createNotebook
 * on our kernel whitelist, so when missing we place docs under the first open
 * notebook at path prefix `/Craft Notes/...`.
 *
 * User-initiated only (RPC knowledge:migrateNotes). Never deletes the notes vault.
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'path'
import { getWorkspaceByNameOrId } from '@craft-agent/shared/config'
import { getDefaultWorkspacesDir } from '@craft-agent/shared/workspaces'
import { loadWorkspaceConfig } from '@craft-agent/shared/workspaces'
import matter from 'gray-matter'

export const NOTES_MIGRATION_MAP_VERSION = 1 as const
export const DEFAULT_CRAFT_NOTES_NOTEBOOK_NAME = 'Craft Notes'
export const NOTES_MIGRATION_MAP_RELATIVE = join('.craft', 'notes-migration-map.json')

const NOTES_DIR = 'notes'
const ASSETS_DIR = 'assets'
const TEMPLATES_DIR = 'templates'

export interface NotesMigrationMapEntry {
  noteId: string
  path: string
  siyuanId: string
  title: string
  migratedAt: number
}

export interface NotesMigrationMap {
  version: typeof NOTES_MIGRATION_MAP_VERSION
  notebookId?: string
  notebookName: string
  entries: NotesMigrationMapEntry[]
}

export interface MigrateNotesArgs {
  workspaceId: string
  connectionId: string
  notebookName?: string
}

export interface MigrateNotesResult {
  migrated: number
  skipped: number
  failed: Array<{ noteId: string; error: string }>
  mapPath: string
  notebookId: string
}

export interface NotesMigrationNote {
  noteId: string
  /** Relative path under notes root, posix slashes, with .md */
  relativePath: string
  title: string
  /** Body markdown (frontmatter stripped) */
  body: string
}

export interface NotesMigrationKernel {
  listNotebooks(): Promise<Array<{ id: string; name: string; closed: boolean }>>
  createDocWithMd(input: { notebook: string; path: string; markdown: string }): Promise<string>
  checkBlockExist(id: string): Promise<boolean>
}

function toSlashPath(path: string): string {
  return path.split(sep).join('/')
}

function stripMdExtension(path: string): string {
  return path.toLowerCase().endsWith('.md') ? path.slice(0, -3) : path
}

function noteIdFromRelativePath(relativePath: string): string {
  return stripMdExtension(toSlashPath(relativePath))
}

export function notesMigrationMapPath(workspaceRoot: string): string {
  return join(workspaceRoot, NOTES_MIGRATION_MAP_RELATIVE)
}

export function emptyNotesMigrationMap(notebookName = DEFAULT_CRAFT_NOTES_NOTEBOOK_NAME): NotesMigrationMap {
  return {
    version: NOTES_MIGRATION_MAP_VERSION,
    notebookName,
    entries: [],
  }
}

export async function readNotesMigrationMap(workspaceRoot: string): Promise<NotesMigrationMap> {
  const mapPath = notesMigrationMapPath(workspaceRoot)
  try {
    const raw = await readFile(mapPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<NotesMigrationMap>
    if (!parsed || typeof parsed !== 'object') return emptyNotesMigrationMap()
    const notebookName =
      typeof parsed.notebookName === 'string' && parsed.notebookName.trim()
        ? parsed.notebookName.trim()
        : DEFAULT_CRAFT_NOTES_NOTEBOOK_NAME
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
      version: NOTES_MIGRATION_MAP_VERSION,
      notebookId: typeof parsed.notebookId === 'string' ? parsed.notebookId : undefined,
      notebookName,
      entries,
    }
  } catch {
    return emptyNotesMigrationMap()
  }
}

export async function writeNotesMigrationMap(workspaceRoot: string, map: NotesMigrationMap): Promise<string> {
  const mapPath = notesMigrationMapPath(workspaceRoot)
  await mkdir(dirname(mapPath), { recursive: true })
  const payload: NotesMigrationMap = {
    version: NOTES_MIGRATION_MAP_VERSION,
    notebookId: map.notebookId,
    notebookName: map.notebookName || DEFAULT_CRAFT_NOTES_NOTEBOOK_NAME,
    entries: map.entries,
  }
  await writeFile(mapPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  return mapPath
}

/** Resolve the notes vault root the same way notes RPC does. */
export function resolveWorkspaceNotesRoot(workspaceId: string): string {
  const workspace = getWorkspaceByNameOrId(workspaceId)
  if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
  const config = loadWorkspaceConfig(workspace.rootPath)
  if (config?.notesPath) return config.notesPath
  return join(getDefaultWorkspacesDir(), workspaceId, NOTES_DIR)
}

export function resolveWorkspaceRoot(workspaceId: string): string {
  const workspace = getWorkspaceByNameOrId(workspaceId)
  if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
  return workspace.rootPath
}

async function listMarkdownFiles(dir: string, root = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const abs = join(dir, entry.name)
    const rel = toSlashPath(relative(root, abs))
    if (entry.isDirectory()) {
      if (rel === ASSETS_DIR || rel.startsWith(`${ASSETS_DIR}/`)) continue
      if (rel === TEMPLATES_DIR || rel.startsWith(`${TEMPLATES_DIR}/`)) continue
      files.push(...(await listMarkdownFiles(abs, root)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(abs)
    }
  }
  return files
}

function titleFromNote(noteId: string, properties: Record<string, unknown>, body: string): string {
  const fmTitle = properties.title
  if (typeof fmTitle === 'string' && fmTitle.trim()) return fmTitle.trim()
  const firstHeading = body.match(/^#\s+(.+)$/m)
  if (firstHeading?.[1]?.trim()) return firstHeading[1].trim()
  return basename(noteId)
}

/**
 * Best-effort wikilink rewrite for SiYuan:
 * `[[target]]` → target leaf title
 * `[[target|alias]]` → alias
 * `[[target#heading]]` → target leaf (+ heading text when no alias)
 */
export function rewriteWikilinks(markdown: string): string {
  return markdown.replace(
    /\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/g,
    (_full, target: string, heading = '', alias?: string) => {
      if (alias && alias.trim()) return alias.trim()
      const leaf = target.trim().split(/[/\\]/).pop() || target.trim()
      const headingText = typeof heading === 'string' && heading.startsWith('#') ? heading.slice(1).trim() : ''
      if (headingText) return `${leaf} › ${headingText}`
      return leaf
    },
  )
}

export async function listNotesForMigration(notesRoot: string): Promise<NotesMigrationNote[]> {
  const root = resolve(notesRoot)
  let rootStat
  try {
    rootStat = await stat(root)
  } catch {
    return []
  }
  if (!rootStat.isDirectory()) return []

  const files = await listMarkdownFiles(root)
  const notes: NotesMigrationNote[] = []
  for (const filePath of files) {
    const relativePath = toSlashPath(relative(root, filePath))
    const noteId = noteIdFromRelativePath(relativePath)
    let content = ''
    try {
      content = await readFile(filePath, 'utf-8')
    } catch {
      continue
    }
    let properties: Record<string, unknown> = {}
    let body = content
    try {
      const parsed = matter(content)
      properties = (parsed.data ?? {}) as Record<string, unknown>
      body = parsed.content ?? ''
    } catch {
      body = content
    }
    notes.push({
      noteId,
      relativePath,
      title: titleFromNote(noteId, properties, body),
      body,
    })
  }
  notes.sort((a, b) => a.noteId.localeCompare(b.noteId))
  return notes
}

/** Sanitize a path segment for SiYuan hPath (no leading/trailing slashes). */
export function sanitizePathSegment(raw: string): string {
  const cleaned = raw
    .replace(/[\\/:"*?<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'Untitled'
}

/**
 * Build SiYuan createDocWithMd path under the Craft Notes folder prefix.
 * noteId `projects/foo/bar` → `/Craft Notes/projects/foo/bar`
 * (title used as leaf when noteId is a single segment with different display title — keep id leaf for stability).
 */
export function buildCraftNotesDocPath(noteId: string, notebookName = DEFAULT_CRAFT_NOTES_NOTEBOOK_NAME): string {
  const parts = noteId.split('/').filter(Boolean).map(sanitizePathSegment)
  const leaf = parts.pop() || 'Untitled'
  const folder = parts.join('/')
  const prefix = `/${sanitizePathSegment(notebookName)}`
  if (folder) return `${prefix}/${folder}/${leaf}`
  return `${prefix}/${leaf}`
}

export interface ResolveNotebookResult {
  notebookId: string
  /** True when a notebook with the requested name exists; false when falling back to first open. */
  usedNamedNotebook: boolean
  pathPrefixMode: 'named-notebook-root' | 'default-notebook-prefix'
}

/**
 * Prefer notebook named `notebookName`. If create-notebook is unsupported / missing,
 * fall back to the first open notebook and keep docs under `/Craft Notes/...` path prefix.
 */
export async function resolveMigrationNotebook(
  client: NotesMigrationKernel,
  notebookName: string,
  preferredId?: string,
): Promise<ResolveNotebookResult> {
  const notebooks = await client.listNotebooks()
  const open = notebooks.filter((n) => !n.closed)
  const pool = open.length > 0 ? open : notebooks

  if (preferredId) {
    const preferred = pool.find((n) => n.id === preferredId)
    if (preferred) {
      const named = preferred.name === notebookName
      return {
        notebookId: preferred.id,
        usedNamedNotebook: named,
        pathPrefixMode: named ? 'named-notebook-root' : 'default-notebook-prefix',
      }
    }
  }

  const byName = pool.find((n) => n.name === notebookName)
  if (byName) {
    return {
      notebookId: byName.id,
      usedNamedNotebook: true,
      pathPrefixMode: 'named-notebook-root',
    }
  }

  const first = pool[0]
  if (!first) {
    throw new Error('SiYuan has no notebooks — open or create one in SiYuan, then retry migration')
  }
  return {
    notebookId: first.id,
    usedNamedNotebook: false,
    pathPrefixMode: 'default-notebook-prefix',
  }
}

function entryByNoteId(map: NotesMigrationMap): Map<string, NotesMigrationMapEntry> {
  const m = new Map<string, NotesMigrationMapEntry>()
  for (const entry of map.entries) m.set(entry.noteId, entry)
  return m
}

/**
 * Core migrate loop. Soft-fails per note. Never deletes vault files.
 * When a map entry exists and the SiYuan block still exists → skip.
 */
export async function migrateCraftNotesToSiyuan(options: {
  workspaceRoot: string
  notesRoot: string
  client: NotesMigrationKernel
  notebookName?: string
  /** Optional clock for tests */
  now?: () => number
}): Promise<MigrateNotesResult> {
  const notebookName = (options.notebookName?.trim() || DEFAULT_CRAFT_NOTES_NOTEBOOK_NAME)
  const now = options.now ?? (() => Date.now())
  const map = await readNotesMigrationMap(options.workspaceRoot)
  map.notebookName = notebookName

  const notebook = await resolveMigrationNotebook(options.client, notebookName, map.notebookId)
  map.notebookId = notebook.notebookId

  const notes = await listNotesForMigration(options.notesRoot)
  const existing = entryByNoteId(map)
  let migrated = 0
  let skipped = 0
  const failed: Array<{ noteId: string; error: string }> = []

  for (const note of notes) {
    const prior = existing.get(note.noteId)
    if (prior?.siyuanId) {
      try {
        const stillThere = await options.client.checkBlockExist(prior.siyuanId)
        if (stillThere) {
          skipped++
          continue
        }
      } catch {
        // treat as missing → re-migrate
      }
    }

    try {
      // named notebook: path is relative to that notebook root still under Craft Notes folder
      // fallback notebook: same path prefix so docs land in /Craft Notes/... hierarchy
      const docPath = buildCraftNotesDocPath(note.noteId, notebookName)
      const markdown = rewriteWikilinks(note.body.replace(/^\n+/, ''))
      const siyuanId = await options.client.createDocWithMd({
        notebook: notebook.notebookId,
        path: docPath,
        markdown: markdown.length > 0 ? markdown : `# ${note.title}\n`,
      })
      if (!siyuanId || typeof siyuanId !== 'string') {
        throw new Error('createDocWithMd returned empty id')
      }
      const entry: NotesMigrationMapEntry = {
        noteId: note.noteId,
        path: docPath,
        siyuanId,
        title: note.title,
        migratedAt: now(),
      }
      if (prior) {
        const idx = map.entries.findIndex((e) => e.noteId === note.noteId)
        if (idx >= 0) map.entries[idx] = entry
        else map.entries.push(entry)
      } else {
        map.entries.push(entry)
      }
      existing.set(note.noteId, entry)
      migrated++
      // Persist incrementally so a mid-run crash keeps progress.
      await writeNotesMigrationMap(options.workspaceRoot, map)
    } catch (error) {
      failed.push({
        noteId: note.noteId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const mapPath = await writeNotesMigrationMap(options.workspaceRoot, map)
  return {
    migrated,
    skipped,
    failed,
    mapPath,
    notebookId: notebook.notebookId,
  }
}
