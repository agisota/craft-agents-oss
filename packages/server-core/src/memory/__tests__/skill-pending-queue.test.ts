/**
 * SkillPendingQueue tests — list/enqueue resilience, approve (v1 snapshot +
 * atomic move, conflict rejection), dismiss anti-repeat log, TTL prune, and
 * the loadAllSkills dot-dir filter that keeps pending candidates invisible.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { SkillCandidate } from '@craft-agent/shared/memory/types'
import { loadAllSkills, listSkillSlugs } from '@craft-agent/shared/skills'
import { SkillPendingQueue, normalizeDescription } from '../SkillPendingQueue'

let workspaceRoot: string
let queue: SkillPendingQueue

function candidate(slug: string, description = `desc for ${slug}`): SkillCandidate {
  return {
    slug,
    description,
    body: `# ${slug}\n\ndo the thing`,
    source: { ts: new Date().toISOString(), sessionId: 's1' },
  }
}

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'skill-pending-'))
  queue = new SkillPendingQueue(workspaceRoot)
})

afterEach(() => {
  rmSync(workspaceRoot, { recursive: true, force: true })
})

describe('enqueue + list', () => {
  it('enqueues and lists a candidate with meta and content', () => {
    expect(queue.enqueue(candidate('tidy-imports'))).toBe(true)
    const list = queue.list()
    expect(list).toHaveLength(1)
    expect(list[0].slug).toBe('tidy-imports')
    expect(list[0].description).toBe('desc for tidy-imports')
    expect(list[0].content).toContain('name: tidy-imports')
    expect(list[0].source.ts).toBeTruthy()
  })

  it('skips candidate dirs without SKILL.md', () => {
    queue.enqueue(candidate('good'))
    mkdirSync(join(queue.pendingDir, 'broken'), { recursive: true })
    writeFileSync(join(queue.pendingDir, 'broken', '.meta.json'), '{}')
    mkdirSync(join(queue.pendingDir, '.hidden'), { recursive: true })
    const list = queue.list()
    expect(list.map(c => c.slug)).toEqual(['good'])
  })

  it('refuses duplicate slugs and slugs of existing skills', () => {
    expect(queue.enqueue(candidate('dup'))).toBe(true)
    expect(queue.enqueue(candidate('dup'))).toBe(false)
    mkdirSync(join(queue.skillsDir, 'real-skill'), { recursive: true })
    expect(queue.enqueue(candidate('real-skill'))).toBe(false)
  })
})

describe('approve', () => {
  it('moves the candidate into skills/ with a v1 snapshot', () => {
    queue.enqueue(candidate('tidy-imports'))
    queue.approve('tidy-imports')
    const dest = join(workspaceRoot, 'skills', 'tidy-imports')
    expect(existsSync(join(dest, 'SKILL.md'))).toBe(true)
    expect(existsSync(join(dest, '.versions', 'v1-SKILL.md'))).toBe(true)
    // Snapshot content matches the approved SKILL.md
    expect(readFileSync(join(dest, '.versions', 'v1-SKILL.md'), 'utf8'))
      .toBe(readFileSync(join(dest, 'SKILL.md'), 'utf8'))
    // Pending dir is gone (atomic move, not copy)
    expect(existsSync(join(queue.pendingDir, 'tidy-imports'))).toBe(false)
  })

  it('rejects approve when the target slug already exists', () => {
    queue.enqueue(candidate('taken'))
    mkdirSync(join(workspaceRoot, 'skills', 'taken'), { recursive: true })
    expect(() => queue.approve('taken')).toThrow(/already exists/)
    // Candidate must remain pending after the rejection
    expect(existsSync(join(queue.pendingDir, 'taken', 'SKILL.md'))).toBe(true)
  })

  it('rejects approve for an unknown slug', () => {
    expect(() => queue.approve('nope')).toThrow(/No pending skill candidate/)
  })
})

describe('dismiss + wasDismissed anti-repeat', () => {
  it('removes the candidate and blocks re-enqueueing it', () => {
    queue.enqueue(candidate('annoying'))
    queue.dismiss('annoying')
    expect(existsSync(join(queue.pendingDir, 'annoying'))).toBe(false)
    expect(queue.wasDismissed('annoying', 'desc for annoying')).toBe(true)
    expect(queue.enqueue(candidate('annoying'))).toBe(false)
  })

  it('matches anti-repeat on the normalized description even under a new slug', () => {
    queue.enqueue(candidate('old-slug'))
    queue.dismiss('old-slug', 'Never do X')
    // Same description, different slug — still dismissed (normalize = lowercase trim)
    expect(queue.wasDismissed('new-slug', '  NEVER DO X ')).toBe(true)
    expect(queue.enqueue(candidate('new-slug', 'Never do X'))).toBe(false)
    // Unrelated candidates are not suppressed
    expect(queue.wasDismissed('other', 'something else')).toBe(false)
  })

  it('appends a .dismissed.jsonl entry with the normalized description', () => {
    queue.enqueue(candidate('logme', 'Trimmed Desc'))
    queue.dismiss('logme')
    const line = readFileSync(join(queue.pendingDir, '.dismissed.jsonl'), 'utf8').trim()
    const entry = JSON.parse(line)
    expect(entry.slug).toBe('logme')
    expect(entry.normalizedDescription).toBe('trimmed desc')
    expect(entry.ts).toBeTruthy()
  })
})

describe('prune', () => {
  it('removes candidates older than the TTL and keeps fresh ones', () => {
    const old = candidate('stale')
    old.source.ts = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    queue.enqueue(old)
    queue.enqueue(candidate('fresh'))
    const pruned = queue.prune(30)
    expect(pruned).toEqual(['stale'])
    expect(queue.list().map(c => c.slug)).toEqual(['fresh'])
  })
})

describe('loadAllSkills dot-dir filter', () => {
  it('does not surface .pending candidates as skills', async () => {
    queue.enqueue(candidate('tidy-imports'))
    // An approved control skill to prove the loader still works.
    queue.approve('tidy-imports')
    queue.enqueue(candidate('still-pending'))
    const skills = loadAllSkills(workspaceRoot)
    const slugs = skills.map(s => s.slug)
    expect(slugs).toContain('tidy-imports')
    expect(slugs).not.toContain('still-pending')
    expect(slugs).not.toContain('.pending')
    expect(listSkillSlugs(workspaceRoot).some(s => s.startsWith('.'))).toBe(false)
  })
})

describe('normalizeDescription', () => {
  it('lowercases and trims', () => {
    expect(normalizeDescription('  Hello World \n')).toBe('hello world')
  })
})

describe('slug traversal hardening (mem-sec-001)', () => {
  it('rejects traversal slugs in approve and dismiss', () => {
    expect(() => queue.approve('../../sessions')).toThrow(/Invalid skill slug/)
    expect(() => queue.dismiss('../../sessions')).toThrow(/Invalid skill slug/)
    expect(() => queue.approve('UPPER')).toThrow(/Invalid skill slug/)
    expect(() => queue.approve('.hidden')).toThrow(/Invalid skill slug/)
    expect(() => queue.approve('a/b')).toThrow(/Invalid skill slug/)
  })

  it('drops LLM-produced traversal slugs in enqueue instead of writing outside .pending', () => {
    expect(queue.enqueue(candidate('../../../tmp/pwn'))).toBe(false)
    expect(queue.enqueue(candidate('abs/path'))).toBe(false)
    expect(queue.list()).toHaveLength(0)
  })

  it('accepts normal kebab slugs', () => {
    expect(queue.enqueue(candidate('ok-slug-1'))).toBe(true)
  })
})
