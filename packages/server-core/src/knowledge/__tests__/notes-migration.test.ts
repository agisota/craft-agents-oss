/**
 * P4.4 notes → SiYuan migration: map file write + createDocWithMd call counts.
 * Uses an in-memory NotesMigrationKernel (no network / no mock.module).
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  buildCraftNotesDocPath,
  DEFAULT_CRAFT_NOTES_NOTEBOOK_NAME,
  migrateCraftNotesToSiyuan,
  notesMigrationMapPath,
  readNotesMigrationMap,
  rewriteWikilinks,
  type NotesMigrationKernel,
} from '../notes-migration'

function makeKernel(options?: {
  notebooks?: Array<{ id: string; name: string; closed: boolean }>
  existingIds?: Set<string>
  failNotePaths?: Set<string>
}): NotesMigrationKernel & {
  createCalls: Array<{ notebook: string; path: string; markdown: string }>
  created: Map<string, string>
} {
  const createCalls: Array<{ notebook: string; path: string; markdown: string }> = []
  const created = new Map<string, string>()
  let seq = 0
  const existingIds = options?.existingIds ?? new Set<string>()
  const failNotePaths = options?.failNotePaths ?? new Set<string>()
  const notebooks = options?.notebooks ?? [
    { id: 'nb-default', name: 'Main', closed: false },
  ]

  return {
    createCalls,
    created,
    async listNotebooks() {
      return notebooks
    },
    async createDocWithMd(input) {
      createCalls.push(input)
      if (failNotePaths.has(input.path)) {
        throw new Error(`kernel refused ${input.path}`)
      }
      const id = `doc-${++seq}`
      created.set(input.path, id)
      existingIds.add(id)
      return id
    },
    async checkBlockExist(id) {
      return existingIds.has(id)
    },
  }
}

async function writeNote(notesRoot: string, rel: string, body: string, title?: string) {
  const abs = join(notesRoot, rel)
  await mkdir(join(abs, '..'), { recursive: true })
  const fm = title
    ? `---\ntitle: ${JSON.stringify(title)}\n---\n\n${body}`
    : body
  await writeFile(abs, fm, 'utf-8')
}

describe('rewriteWikilinks', () => {
  it('keeps alias, drops target path to leaf title', () => {
    expect(rewriteWikilinks('see [[projects/alpha|Alpha]] and [[beta]]')).toBe(
      'see Alpha and beta',
    )
    expect(rewriteWikilinks('[[folder/note#Heading]]')).toBe('note › Heading')
  })
})

describe('buildCraftNotesDocPath', () => {
  it('prefixes Craft Notes folder hierarchy', () => {
    expect(buildCraftNotesDocPath('hello')).toBe('/Craft Notes/hello')
    expect(buildCraftNotesDocPath('projects/foo/bar')).toBe('/Craft Notes/projects/foo/bar')
  })
})

describe('migrateCraftNotesToSiyuan', () => {
  let workspaceRoot: string
  let notesRoot: string

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'notes-mig-ws-'))
    notesRoot = join(workspaceRoot, 'notes')
    await mkdir(notesRoot, { recursive: true })
  })

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true })
  })

  it('creates a doc per unmapped note, writes map under .craft/, skips remapped', async () => {
    await writeNote(notesRoot, 'alpha.md', 'Body [[linked]]', 'Alpha')
    await writeNote(notesRoot, 'projects/beta.md', '# Beta\n\nMore text')

    const kernel = makeKernel({
      notebooks: [
        { id: 'nb-craft', name: DEFAULT_CRAFT_NOTES_NOTEBOOK_NAME, closed: false },
      ],
    })

    const first = await migrateCraftNotesToSiyuan({
      workspaceRoot,
      notesRoot,
      client: kernel,
      now: () => 1_700_000_000_000,
    })

    expect(first.migrated).toBe(2)
    expect(first.skipped).toBe(0)
    expect(first.failed).toEqual([])
    expect(first.notebookId).toBe('nb-craft')
    expect(kernel.createCalls).toHaveLength(2)
    expect(kernel.createCalls.map((c) => c.path).sort()).toEqual([
      '/Craft Notes/alpha',
      '/Craft Notes/projects/beta',
    ])
    // wikilink rewritten
    const alphaCall = kernel.createCalls.find((c) => c.path.endsWith('/alpha'))!
    expect(alphaCall.markdown).toContain('Body linked')
    expect(alphaCall.markdown).not.toContain('[[')

    const mapPath = notesMigrationMapPath(workspaceRoot)
    expect(first.mapPath).toBe(mapPath)
    const raw = await readFile(mapPath, 'utf-8')
    const map = JSON.parse(raw) as {
      version: number
      notebookId: string
      notebookName: string
      entries: Array<{ noteId: string; siyuanId: string }>
    }
    expect(map.version).toBe(1)
    expect(map.notebookId).toBe('nb-craft')
    expect(map.notebookName).toBe(DEFAULT_CRAFT_NOTES_NOTEBOOK_NAME)
    expect(map.entries).toHaveLength(2)
    expect(map.entries.map((e) => e.noteId).sort()).toEqual(['alpha', 'projects/beta'])

    // Second run: both still exist → skip, no extra createDocWithMd
    const second = await migrateCraftNotesToSiyuan({
      workspaceRoot,
      notesRoot,
      client: kernel,
    })
    expect(second.migrated).toBe(0)
    expect(second.skipped).toBe(2)
    expect(kernel.createCalls).toHaveLength(2)
  })

  it('falls back to first open notebook path prefix when Craft Notes notebook missing', async () => {
    await writeNote(notesRoot, 'solo.md', 'hello')
    const kernel = makeKernel({
      notebooks: [{ id: 'nb-main', name: 'Inbox', closed: false }],
    })
    const result = await migrateCraftNotesToSiyuan({
      workspaceRoot,
      notesRoot,
      client: kernel,
    })
    expect(result.notebookId).toBe('nb-main')
    expect(kernel.createCalls[0]!.notebook).toBe('nb-main')
    expect(kernel.createCalls[0]!.path).toBe('/Craft Notes/solo')
  })

  it('soft-fails per note and continues', async () => {
    await writeNote(notesRoot, 'ok.md', 'ok')
    await writeNote(notesRoot, 'bad.md', 'bad')
    const kernel = makeKernel({
      failNotePaths: new Set(['/Craft Notes/bad']),
    })
    const result = await migrateCraftNotesToSiyuan({
      workspaceRoot,
      notesRoot,
      client: kernel,
    })
    expect(result.migrated).toBe(1)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]!.noteId).toBe('bad')
    const map = await readNotesMigrationMap(workspaceRoot)
    expect(map.entries.map((e) => e.noteId)).toEqual(['ok'])
  })

  it('does not delete notes vault files', async () => {
    await writeNote(notesRoot, 'keep.md', 'stay')
    const kernel = makeKernel()
    await migrateCraftNotesToSiyuan({ workspaceRoot, notesRoot, client: kernel })
    const still = await readFile(join(notesRoot, 'keep.md'), 'utf-8')
    expect(still).toContain('stay')
  })
})
