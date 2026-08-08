import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  closeAllSourceIndexes,
  countIndexedFiles,
  indexSourceTree,
  reindexWorkspaceSources,
  searchSourceIndex,
  walkSourceTree,
} from '../source-index'

function tmpRoot(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

afterEach(() => {
  closeAllSourceIndexes()
})

describe('walkSourceTree', () => {
  it('collects text files and skips node_modules', () => {
    const root = tmpRoot('src-walk')
    try {
      writeFileSync(join(root, 'readme.md'), '# Hello craft sources index')
      mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true })
      writeFileSync(join(root, 'node_modules', 'pkg', 'x.md'), 'skip me')
      mkdirSync(join(root, 'docs'), { recursive: true })
      writeFileSync(join(root, 'docs', 'guide.txt'), 'keyword alpha beta')

      const { files, truncated } = walkSourceTree(root)
      expect(truncated).toBe(false)
      const rels = files.map((f) => f.relPath).sort()
      expect(rels).toEqual(['docs/guide.txt', 'readme.md'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('source index FTS/LIKE', () => {
  it('indexes and searches local trees', () => {
    const workspace = tmpRoot('src-ws')
    const folderA = join(workspace, 'src-a')
    const folderB = join(workspace, 'src-b')
    mkdirSync(folderA, { recursive: true })
    mkdirSync(folderB, { recursive: true })
    writeFileSync(join(folderA, 'alpha.md'), 'The quick brown fox jumps over craft agents')
    writeFileSync(join(folderB, 'beta.md'), 'SiYuan flashcards and plugins surface modes')

    try {
      const re = reindexWorkspaceSources(workspace, [
        { slug: 'local-a', path: folderA },
        { slug: 'local-b', path: folderB },
      ])
      expect(re.indexed).toBe(2)
      expect(countIndexedFiles(workspace)).toBe(2)

      const fox = searchSourceIndex(workspace, 'fox', { limit: 5 })
      expect(fox.hits.length).toBeGreaterThanOrEqual(1)
      expect(fox.hits.some((h) => h.path.includes('local-a/alpha.md'))).toBe(true)
      expect(fox.hits[0]!.snippet.toLowerCase()).toContain('fox')

      const flash = searchSourceIndex(workspace, 'flashcards', { limit: 5 })
      expect(flash.hits.some((h) => h.path.includes('local-b/beta.md'))).toBe(true)

      // second index of single tree with clear
      writeFileSync(join(folderA, 'gamma.md'), 'brand new document about zebras')
      const single = indexSourceTree(workspace, folderA, {
        sourceSlug: 'local-a',
        clearSource: true,
      })
      expect(single.indexed).toBe(2)
      const zebra = searchSourceIndex(workspace, 'zebras')
      expect(zebra.hits.some((h) => h.path.endsWith('gamma.md'))).toBe(true)
    } finally {
      rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('returns empty for blank query or missing db', () => {
    const workspace = tmpRoot('src-empty')
    try {
      expect(searchSourceIndex(workspace, '  ').hits).toEqual([])
      expect(searchSourceIndex(workspace, 'anything').hits).toEqual([])
      expect(countIndexedFiles(workspace)).toBe(0)
    } finally {
      rmSync(workspace, { recursive: true, force: true })
    }
  })
})
