import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { marketplacePaths, type MarketplaceEntry, type MarketplaceFetch } from '../catalog.ts'
import { INSTALL_MARKER_NAME, readLock, readInstallMarker } from '../lock.ts'
import { installEntry, removeEntry, type ExecFileFn } from '../installer.ts'

const REF = 'd'.repeat(40)

const DOC_ENTRY: MarketplaceEntry = {
  id: 'soul-pack',
  kind: 'context-doc',
  title: 'Soul Pack',
  descriptionRu: 'Тестовый документ',
  source: { type: 'github', repo: 'owner/docs', ref: REF },
  documents: [{ repoPath: 'AGENTS.md', targetName: 'agents.md' }],
}

const docFetch: MarketplaceFetch = async (url) => {
  if (!url.includes(`/${REF}/`)) return { ok: false, status: 404, headers: { get: () => null }, text: async () => '' }
  return { ok: true, status: 200, headers: { get: () => null }, text: async () => '# Agent Doc' }
}

let home: string
let configDir: string
let skillsDir: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'craft-marketplace-install-'))
  configDir = join(home, '.craft')
  skillsDir = join(home, '.agents', 'skills')
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('installEntry (context-doc)', () => {
  it('installs documents atomically and records provenance', async () => {
    const result = await installEntry(DOC_ENTRY, { configDir, fetchFn: docFetch, now: () => 777 })
    expect(result).toEqual({
      id: 'soul-pack',
      kind: 'context-doc',
      status: 'installed',
      ref: REF,
      targets: [join(configDir, 'context', 'agents.md')],
    })

    const target = join(configDir, 'context', 'agents.md')
    expect(readFileSync(target, 'utf8')).toBe('# Agent Doc')
    // Provenance marker beside the .md file + aggregate lock record
    expect(readInstallMarker(target)?.ref).toBe(REF)
    const rec = readLock(marketplacePaths(configDir).lockFile).entries['soul-pack']
    expect(rec?.status).toBe('installed')
    expect(rec?.installedAt).toBe(777)
    expect(rec?.targets).toEqual([target])
  })

  it('fails closed when the download 404s (no lock record, no file)', async () => {
    const badFetch: MarketplaceFetch = async () => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
      text: async () => '',
    })
    await expect(installEntry(DOC_ENTRY, { configDir, fetchFn: badFetch })).rejects.toThrow('404')
    expect(readLock(marketplacePaths(configDir).lockFile).entries['soul-pack']).toBeUndefined()
    expect(existsSync(join(configDir, 'context', 'agents.md'))).toBe(false)
  })
})

describe('removeEntry (soft-clean)', () => {
  it('removes owned artifacts; reports not-installed for unknown ids', async () => {
    await installEntry(DOC_ENTRY, { configDir, fetchFn: docFetch })
    const result = removeEntry('soul-pack', { configDir })
    expect(result.status).toBe('removed')
    expect(result.removed).toEqual([join(configDir, 'context', 'agents.md')])
    expect(existsSync(join(configDir, 'context', 'agents.md'))).toBe(false)
    expect(readInstallMarker(join(configDir, 'context', 'agents.md'))).toBeNull()
    expect(readLock(marketplacePaths(configDir).lockFile).entries).toEqual({})

    expect(removeEntry('soul-pack', { configDir }).status).toBe('not-installed')
  })

  it('keeps locally-modified targets instead of deleting user edits', async () => {
    await installEntry(DOC_ENTRY, { configDir, fetchFn: docFetch })
    const target = join(configDir, 'context', 'agents.md')
    writeFileSync(target, '# Locally edited')

    const result = removeEntry('soul-pack', { configDir })
    expect(result.status).toBe('partial')
    expect(result.kept).toEqual([{ path: target, reason: 'locally-modified' }])
    expect(readFileSync(target, 'utf8')).toBe('# Locally edited')
    expect(readLock(marketplacePaths(configDir).lockFile).entries).toEqual({})
  })
})

describe('installEntry (skillpack, directory mode)', () => {
  const PACK_ENTRY: MarketplaceEntry = {
    id: 'mega-pack',
    kind: 'skillpack',
    title: 'Mega Pack',
    descriptionRu: 'Тестовый пакет скиллов',
    source: { type: 'github', repo: 'owner/pack', ref: REF },
    installMode: 'directory',
  }

  /** Fake git: synthesizes the repo contents at FETCH_HEAD checkout time. */
  const fakeGit: ExecFileFn = async (_file, args, options) => {
    if (args.includes('checkout')) {
      writeFileSync(join(options.cwd!, 'SKILL.md'), '# Mega Skill')
      mkdirSync(join(options.cwd!, 'docs'), { recursive: true })
      writeFileSync(join(options.cwd!, 'docs', 'GUIDE.md'), 'guide')
    }
    return { stdout: args[0] === 'rev-parse' ? `${REF}\n` : '', stderr: '' }
  }

  it('clones pinned, verifies HEAD, installs the whole repo as one skill dir', async () => {
    const result = await installEntry(PACK_ENTRY, { configDir, skillsDir, execFileFn: fakeGit })
    expect(result).toEqual({
      id: 'mega-pack',
      kind: 'skillpack',
      status: 'installed',
      ref: REF,
      skills: ['mega-pack'],
      targets: [join(skillsDir, 'mega-pack')],
    })

    const target = join(skillsDir, 'mega-pack')
    expect(readFileSync(join(target, 'SKILL.md'), 'utf8')).toBe('# Mega Skill')
    expect(readFileSync(join(target, 'docs', 'GUIDE.md'), 'utf8')).toBe('guide')
    expect(existsSync(join(target, INSTALL_MARKER_NAME))).toBe(true)
    expect(readLock(marketplacePaths(configDir).lockFile).entries['mega-pack']?.status).toBe('installed')
    // staging area cleaned up (no leftover clone-*/stage-* dirs)
    const tmpDir = marketplacePaths(configDir).tmpDir
    expect(existsSync(tmpDir) ? readdirSync(tmpDir) : []).toEqual([])
  })

  it('rejects a HEAD that does not match the pinned ref', async () => {
    const wrongHead: ExecFileFn = async (_file, args, options) => {
      if (args.includes('checkout')) writeFileSync(join(options.cwd!, 'SKILL.md'), '# x')
      return { stdout: args[0] === 'rev-parse' ? `${'e'.repeat(40)}\n` : '', stderr: '' }
    }
    await expect(installEntry(PACK_ENTRY, { configDir, skillsDir, execFileFn: wrongHead })).rejects.toThrow('ref mismatch')
    expect(existsSync(join(skillsDir, 'mega-pack'))).toBe(false)
    expect(readLock(marketplacePaths(configDir).lockFile).entries).toEqual({})
  })
})

describe('installEntry (kind:tool)', () => {
  it('rejects tools missing from the toolchain manifest', async () => {
    const entry: MarketplaceEntry = {
      id: 'unknown-tool',
      kind: 'tool',
      title: 'Unknown Tool',
      descriptionRu: 'Инструмент вне манифеста',
      source: { type: 'github', repo: 'owner/tool', ref: REF },
      toolName: 'definitely-not-a-real-tool',
    }
    const error = await installEntry(entry, { configDir }).catch((err: unknown) => err)
    expect((error as { code?: string }).code).toBe('TOOL_NOT_IN_MANIFEST')
    expect(readLock(marketplacePaths(configDir).lockFile).entries).toEqual({})
  })
})
