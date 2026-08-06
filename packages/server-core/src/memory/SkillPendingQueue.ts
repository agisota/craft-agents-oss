/**
 * SkillPendingQueue — approval queue for distilled skill candidates.
 *
 * Layout (spec §4):
 *   {workspaceRoot}/skills/
 *     .pending/<slug>/{SKILL.md,.meta.json}   — candidates awaiting approval
 *     .pending/.dismissed.jsonl               — anti-repeat log of dismissals
 *     <slug>/{SKILL.md,.versions/v1-SKILL.md} — approved skills
 *
 * A candidate is approved by snapshotting its SKILL.md into `.versions/` and
 * atomically moving the directory from `.pending/` into `skills/` via rename
 * (same filesystem). loadAllSkills ignores dot-dirs, so pending candidates
 * are never picked up as real skills.
 *
 * All reads are resilient: missing/corrupt files skip the candidate instead
 * of throwing.
 */
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  type Dirent,
} from 'fs'
import { join } from 'path'
import type { PendingSkill, SkillCandidate } from '@craft-agent/shared/memory/types'
import { invalidateSkillsCache } from '@craft-agent/shared/skills/storage'
import { AuditLog } from './AuditLog'

const PENDING_DIR = '.pending'
const DISMISSED_LOG = '.dismissed.jsonl'
const VERSIONS_DIR = '.versions'

/** Normalized anti-repeat key for a candidate description. */
export function normalizeDescription(description: string): string {
  return description.trim().toLowerCase()
}

/**
 * Slugs are joined into filesystem paths in enqueue/approve/dismiss and flow
 * in from RPC clients and from LLM distillation output (user-influenced
 * transcripts). Anything outside this charset could traverse out of
 * `.pending/` (CWE-22/CWE-73) — reject hard.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

function assertValidSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`Invalid skill slug: ${JSON.stringify(slug)}`)
  }
}

export interface DismissedEntry {
  slug: string
  ts: string
  normalizedDescription: string
}

function readJsonl<T>(path: string): T[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return []
  }
  const out: T[] = []
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      out.push(JSON.parse(t) as T)
    } catch {
      // skip corrupt line
    }
  }
  return out
}

export class SkillPendingQueue {
  /** {workspaceRoot}/skills */
  readonly skillsDir: string
  /** {workspaceRoot}/skills/.pending */
  readonly pendingDir: string
  /** Workspace-scope audit log ({workspaceRoot}/memory/audit.jsonl, spec F2). */
  private readonly audit: AuditLog

  constructor(workspaceRoot: string) {
    this.skillsDir = join(workspaceRoot, 'skills')
    this.pendingDir = join(this.skillsDir, PENDING_DIR)
    this.audit = new AuditLog('workspace', workspaceRoot)
  }

  private get dismissedPath(): string {
    return join(this.pendingDir, DISMISSED_LOG)
  }

  /**
   * Enqueue a distilled candidate. Skips (returns false) when the candidate
   * was previously dismissed, when a pending entry with the same slug already
   * exists, or when the slug is already an approved skill.
   */
  enqueue(candidate: SkillCandidate): boolean {
    // LLM-produced slugs are untrusted: invalid ones are dropped, not thrown.
    if (!SLUG_RE.test(candidate.slug)) return false
    if (this.wasDismissed(candidate.slug, candidate.description)) return false
    const dir = join(this.pendingDir, candidate.slug)
    if (existsSync(dir)) return false
    if (existsSync(join(this.skillsDir, candidate.slug))) return false
    mkdirSync(dir, { recursive: true })
    const skillMd = `---\nname: ${candidate.slug}\ndescription: ${candidate.description.replace(/\n/g, ' ')}\n---\n\n${candidate.body.replace(/\n*$/, '\n')}`
    writeFileSync(join(dir, 'SKILL.md'), skillMd)
    writeFileSync(
      join(dir, '.meta.json'),
      JSON.stringify(
        {
          slug: candidate.slug,
          description: candidate.description,
          source: candidate.source,
        },
        null,
        2,
      ),
    )
    return true
  }

  /** All pending candidates (parsed meta + raw SKILL.md content), corrupt entries skipped. */
  list(): PendingSkill[] {
    if (!existsSync(this.pendingDir)) return []
    const out: PendingSkill[] = []
    let entries: Dirent[]
    try {
      entries = readdirSync(this.pendingDir, { withFileTypes: true })
    } catch {
      return []
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const dir = join(this.pendingDir, entry.name)
      const skillPath = join(dir, 'SKILL.md')
      if (!existsSync(skillPath)) continue
      let content: string
      try {
        content = readFileSync(skillPath, 'utf8')
      } catch {
        continue
      }
      // .meta.json is optional/corrupt-tolerant: fall back to slug + dir mtime.
      let meta: { slug?: string; description?: string; source?: PendingSkill['source'] } = {}
      try {
        meta = JSON.parse(readFileSync(join(dir, '.meta.json'), 'utf8'))
      } catch {
        // fall through with defaults
      }
      let ts = ''
      try {
        ts = statSync(dir).mtime.toISOString()
      } catch {
        // leave empty
      }
      out.push({
        slug: typeof meta.slug === 'string' ? meta.slug : entry.name,
        description: typeof meta.description === 'string' ? meta.description : '',
        content,
        source: {
          ts: meta.source?.ts ?? ts,
          ...(meta.source?.sessionId ? { sessionId: meta.source.sessionId } : {}),
          ...(meta.source?.toolCallStats ? { toolCallStats: meta.source.toolCallStats } : {}),
        },
      })
    }
    return out
  }

  /**
   * Approve a candidate: snapshot SKILL.md as `.versions/v1-SKILL.md` inside
   * the candidate dir, then atomically move the dir to
   * `{workspaceRoot}/skills/<slug>/`. Throws when the target slug already
   * exists; on rename failure any partial move is rolled back.
   */
  approve(slug: string): void {
    assertValidSlug(slug)
    const src = join(this.pendingDir, slug)
    const dest = join(this.skillsDir, slug)
    if (!existsSync(join(src, 'SKILL.md'))) {
      throw new Error(`No pending skill candidate: ${slug}`)
    }
    if (existsSync(dest)) {
      throw new Error(`Skill '${slug}' already exists in workspace`)
    }
    const versionsDir = join(src, VERSIONS_DIR)
    mkdirSync(versionsDir, { recursive: true })
    copyFileSync(join(src, 'SKILL.md'), join(versionsDir, 'v1-SKILL.md'))
    try {
      renameSync(src, dest)
    } catch (err) {
      // Restore: rename is same-filesystem atomic, so a partial dest should
      // not exist — but never trust, remove a half-moved dir if one appeared.
      try {
        if (existsSync(dest) && !existsSync(src)) renameSync(dest, src)
      } catch {
        // leave as-is; original error wins
      }
      throw err instanceof Error ? err : new Error(String(err))
    }
    // Make the approved skill visible to loadAllSkills immediately instead of
    // waiting on the ConfigWatcher debounce or TTL.
    invalidateSkillsCache()
    try {
      this.audit.append({ actor: 'queue', action: 'approved', target: slug })
    } catch {
      // auditing is best-effort; the approval already landed
    }
  }

  /** Remove the candidate and log it to .dismissed.jsonl for anti-repeat. */
  dismiss(slug: string, description?: string): void {
    assertValidSlug(slug)
    const dir = join(this.pendingDir, slug)
    let desc = description
    if (desc === undefined) {
      // Recover the description from .meta.json before deleting.
      try {
        const meta = JSON.parse(readFileSync(join(dir, '.meta.json'), 'utf8'))
        if (typeof meta.description === 'string') desc = meta.description
      } catch {
        // no meta available
      }
    }
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(this.pendingDir, { recursive: true })
    const entry: DismissedEntry = {
      slug,
      ts: new Date().toISOString(),
      normalizedDescription: normalizeDescription(desc ?? ''),
    }
    appendFileSync(this.dismissedPath, JSON.stringify(entry) + '\n')
    invalidateSkillsCache()
    try {
      this.audit.append({ actor: 'queue', action: 'dismissed', target: slug })
    } catch {
      // auditing is best-effort; the dismissal already landed
    }
  }

  /** Dismissed-log entries, oldest first, corrupt lines skipped. */
  dismissed(): DismissedEntry[] {
    return readJsonl<DismissedEntry>(this.dismissedPath)
      .filter(e => e && typeof e.slug === 'string')
  }

  /**
   * Anti-repeat check: has this candidate been dismissed before? Matches on
   * the slug OR the normalized description (case-insensitive, trimmed), so a
   * re-distilled candidate under a new slug is still suppressed.
   */
  wasDismissed(slug: string, description: string): boolean {
    const norm = normalizeDescription(description)
    return this.dismissed().some(
      e => e.slug === slug || (norm !== '' && e.normalizedDescription === norm),
    )
  }

  /**
   * Remove candidates older than `ttlDays` (based on .meta.json source.ts,
   * falling back to the directory mtime). Returns the pruned slugs.
   */
  prune(ttlDays = 30): string[] {
    if (!existsSync(this.pendingDir)) return []
    const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000
    const pruned: string[] = []
    let entries: Dirent[]
    try {
      entries = readdirSync(this.pendingDir, { withFileTypes: true })
    } catch {
      return []
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const dir = join(this.pendingDir, entry.name)
      let ts = NaN
      try {
        const meta = JSON.parse(readFileSync(join(dir, '.meta.json'), 'utf8'))
        ts = Date.parse(meta?.source?.ts)
      } catch {
        // no usable meta timestamp
      }
      if (Number.isNaN(ts)) {
        try {
          ts = statSync(dir).mtimeMs
        } catch {
          continue
        }
      }
      if (ts < cutoff) {
        rmSync(dir, { recursive: true, force: true })
        pruned.push(entry.name)
      }
    }
    return pruned
  }
}
