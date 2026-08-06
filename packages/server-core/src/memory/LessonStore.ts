/**
 * LessonStore — manages one lessons.jsonl file for a single scope
 * ('global' or 'workspace').
 *
 * - Append-only writes for new lessons, full atomic rewrite (tmp + rename)
 *   for updates/deletes.
 * - Case-insensitive dedup on the rule text (lowercase + trim): a duplicate
 *   updates ts/source of the existing lesson in place.
 * - Enforces LESSON_LIMITS.total by pruning the oldest lessons after writes.
 * - list() reads are mtime-cached: the file is re-parsed only when its mtime
 *   changed (another process appended to it, tests wrote to it, ...).
 * - Corrupt lines are skipped, never thrown.
 *
 * See docs/superpowers/specs/2026-08-06-self-learning-memory-design.md §1.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { LESSON_LIMITS, type Lesson, type LessonScope } from '@craft-agent/shared/memory/types'

/** Normalized dedup key for a lesson rule (case-insensitive, whitespace-trimmed). */
export function lessonKey(rule: string): string {
  return rule.trim().toLowerCase()
}

/**
 * Parse a lessons.jsonl payload resiliently. Blank lines are ignored and any
 * line that fails JSON.parse or doesn't look like a lesson is skipped — a
 * store must never fail to load because one line is corrupt.
 */
export function parseLessons(content: string): Lesson[] {
  const lessons: Lesson[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed) as Lesson
      if (parsed && typeof parsed === 'object' && typeof parsed.rule === 'string') {
        lessons.push(parsed)
      }
    } catch {
      // skip corrupt line
    }
  }
  return lessons
}

export class LessonStore {
  readonly filePath: string
  readonly scope: LessonScope
  /** Cached lessons, keyed by file mtime. */
  private cache: { mtimeMs: number; lessons: Lesson[] } | null = null

  constructor(filePath: string, scope: LessonScope) {
    this.filePath = filePath
    this.scope = scope
  }

  /** All lessons, oldest first. `limit` returns the most recent N. */
  list(limit?: number): Lesson[] {
    const lessons = this.read()
    if (limit === undefined) return lessons
    return lessons.slice(-limit)
  }

  /**
   * Add a lesson. If a lesson with the same rule (case-insensitive) exists,
   * its ts and source are updated instead (and it moves to the end).
   * Enforces LESSON_LIMITS.total by pruning the oldest lessons.
   * Returns the stored lesson.
   */
  add(lesson: Lesson): Lesson {
    const lessons = this.read()
    const key = lessonKey(lesson.rule)
    const existingIdx = lessons.findIndex(l => lessonKey(l.rule) === key)
    if (existingIdx >= 0) {
      const existing = lessons[existingIdx]
      lessons.splice(existingIdx, 1)
      lessons.push({ ...existing, ts: lesson.ts, source: lesson.source })
      this.rewrite(lessons)
      return lessons[lessons.length - 1]
    }
    // Append-only fast path when we're under the limit.
    if (lessons.length < LESSON_LIMITS.total) {
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(lesson) + '\n', { flag: 'a' })
      this.cache = this.cache
        ? { mtimeMs: this.mtime(), lessons: [...lessons, lesson] }
        : null
      return lesson
    }
    lessons.push(lesson)
    this.rewrite(lessons)
    return lesson
  }

  /**
   * Patch a lesson identified by rule text (case-insensitive) or by index.
   * Returns the patched lesson, or null when no lesson matches.
   */
  update(match: string | number, patch: Partial<Omit<Lesson, 'scope'>>): Lesson | null {
    const lessons = this.read()
    const idx = this.resolveIndex(lessons, match)
    if (idx < 0) return null
    lessons[idx] = { ...lessons[idx], ...patch }
    this.rewrite(lessons)
    return lessons[idx]
  }

  /**
   * Delete a lesson identified by rule text (case-insensitive) or by index.
   * Returns true when a lesson was removed.
   */
  delete(match: string | number): boolean {
    const lessons = this.read()
    const idx = this.resolveIndex(lessons, match)
    if (idx < 0) return false
    lessons.splice(idx, 1)
    this.rewrite(lessons)
    return true
  }

  /** Most recent lessons (max LESSON_LIMITS.context), most recent first. */
  forContext(): Lesson[] {
    return this.read().slice(-LESSON_LIMITS.context).reverse()
  }

  /** Drop the cache so the next list() re-reads the file. */
  invalidate(): void {
    this.cache = null
  }

  private resolveIndex(lessons: Lesson[], match: string | number): number {
    if (typeof match === 'number') {
      return match >= 0 && match < lessons.length ? match : -1
    }
    const key = lessonKey(match)
    return lessons.findIndex(l => lessonKey(l.rule) === key)
  }

  private mtime(): number {
    try {
      return statSync(this.filePath).mtimeMs
    } catch {
      return -1
    }
  }

  private read(): Lesson[] {
    if (!existsSync(this.filePath)) {
      this.cache = { mtimeMs: -1, lessons: [] }
      return []
    }
    const mtimeMs = this.mtime()
    if (this.cache && this.cache.mtimeMs === mtimeMs) {
      return this.cache.lessons
    }
    const lessons = parseLessons(readFileSync(this.filePath, 'utf8'))
    this.cache = { mtimeMs, lessons }
    return lessons
  }

  /** Full atomic rewrite: write a tmp file in the same dir, then rename. */
  private rewrite(lessons: Lesson[]): void {
    const pruned = lessons.slice(-LESSON_LIMITS.total)
    mkdirSync(dirname(this.filePath), { recursive: true })
    const tmp = join(dirname(this.filePath), `.${Date.now()}-${process.pid}.lessons.tmp`)
    writeFileSync(tmp, pruned.map(l => JSON.stringify(l)).join('\n') + (pruned.length ? '\n' : ''))
    renameSync(tmp, this.filePath)
    this.cache = { mtimeMs: this.mtime(), lessons: pruned }
  }
}
