/**
 * MemoryService — the self-learning memory orchestrator (spec §3).
 *
 * One instance per workspace, lazily created by SessionManager. Wires the
 * in-process session-completion seam to an async distillation queue:
 *
 *   complete    → full distill (trigger 'distillation')
 *   interrupted → lightweight distill (trigger 'interrupted')
 *   error/timeout → lightweight distill (trigger 'error')
 *   branch      → lightweight distill (trigger 'branch')
 *   every N messages → lightweight distill (skill candidates dropped)
 *   idle > distillIdleHours → full distill (once per idle period)
 *
 * Distiller DI: the default distiller intentionally throws
 * ("no distiller configured"). A real one-shot LLM runner is attached later
 * by server bootstrap via setDistiller() — running a full headless agent
 * here would pull provider runtime back into the session layer.
 *
 * All storage goes through the existing stores:
 *   LessonStore.add / MemoryFileStore.appendDailyHistory / writeContext /
 *   SkillPendingQueue.enqueue (gated by skills.autoCreateFromSessions).
 * Results are broadcast as 'memory:changed' / 'skillsPending:changed' via
 * the injected emitter (SessionManager eventSink).
 */
import { readSessionMessages } from '@craft-agent/shared/sessions/jsonl'
import { getSessionFilePath } from '@craft-agent/shared/sessions/storage'
import { getMemoryConfig, getSkillsAutoCreateFromSessions } from '@craft-agent/shared/config/storage'
import {
  formatLessonsForPrompt,
  formatWorkspaceMemoryForPrompt,
} from '@craft-agent/shared/prompts/system'
import { buildTransferredSessionContext } from '@craft-agent/shared/agent/conversation-summary'
import type { StoredMessage, SessionMemoryMode } from '@craft-agent/core/types'
import type {
  DistillResult,
  Lesson,
  LessonConflict,
  LessonScope,
  LessonTrigger,
  MemoryConfig,
  MemoryPromptBlocks,
  SkillCandidate,
} from '@craft-agent/shared/memory/types'
import { LessonStore } from './LessonStore'
import { MemoryFileStore } from './MemoryFileStore'
import { SkillPendingQueue } from './SkillPendingQueue'
import { AuditLog } from './AuditLog'

/** Max chars of serialized conversation window sent to the distiller (front-truncated). */
const DISTILL_WINDOW_CHARS = 160_000
/** How many messages trigger a lightweight distillation (overridable per config). */

export interface SessionCompletionLike {
  sessionId: string
  /**
   * 'branch' is accepted for future emitters (branch = abandon: the user's
   * original session ended badly) — SessionManager's SessionCompletionEvent
   * today narrows to the other four reasons.
   */
  reason: 'complete' | 'interrupted' | 'error' | 'timeout' | 'branch'
}

interface DistillJob {
  sessionId: string
  full: boolean
  trigger: LessonTrigger
}

export interface MemoryServiceDeps {
  workspaceRoot: string
  /** Workspace id used as the broadcast target. */
  workspaceId?: string
  /** Store factory per scope — injectable for tests. */
  lessonStoreFactory?: (scope: LessonScope) => LessonStore
  /** Workspace-scope file store (context.md / history). Injectable for tests. */
  fileStore?: MemoryFileStore
  /** Pending-skill queue. Injectable for tests. */
  skillQueue?: SkillPendingQueue
  clock?: () => number
  /** LLM one-shot: prompt → raw text (expected strict JSON). Default: throws. */
  distiller?: (prompt: string) => Promise<string>
  /** Broadcast emitter: (channel, args) — wired to SessionManager's eventSink. */
  emit?: (channel: string, args: unknown[]) => void
  logger?: { warn: (msg: string, err?: unknown) => void; info?: (msg: string) => void }
  /** Message reader (defaults to readSessionMessages over session.jsonl). */
  readMessages?: (sessionId: string) => StoredMessage[]
  /** Config reader (defaults to shared config storage helpers). */
  getConfig?: () => MemoryConfig
  isSkillAutoCreateEnabled?: () => boolean
  /**
   * Per-session memory-mode lookup (spec F3). 'incognito' | 'temporary' sessions
   * skip ALL memory writes (distill/branch/idle triggers); 'persistent' (and
   * absent/unknown sessions) write as before. Injectable for tests.
   */
  getSessionMode?: (sessionId: string) => SessionMemoryMode
  /**
   * L1 feedback loop: lessons that were injected into a session's prompts
   * (spec F4 provenance record), as `{rule, scope}` pairs. Wired to
   * readProvenance().lessons in SessionManager; absent/empty means nothing
   * to attribute (session predates F4 or memory was disabled at spawn).
   */
  readSessionProvenance?: (sessionId: string) => Array<{ rule: string; scope: LessonScope }>
}

/**
 * Redact secrets from the serialized window before it leaves the machine for
 * the distiller. Defense-in-depth: the store layer never should have held
 * raw secrets, but long sessions inevitably do.
 */
export function redactSecrets(text: string): string {
  let out = text.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY BLOCK]')
  out = out.replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED AWS KEY]')
  out = out.replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED OPENAI KEY]')
  out = out.replace(/ghp_[A-Za-z0-9]{36}/g, '[REDACTED GITHUB TOKEN]')
  out = out.replace(/xox[baprs]-[A-Za-z0-9-]+/g, '[REDACTED SLACK TOKEN]')
  out = out.replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
  return out
}

/** Parse a strict-JSON DistillResult, tolerating ```json fences. Returns null on failure. */
export function parseDistillResult(raw: string): DistillResult | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    const parsed = JSON.parse(stripped) as Partial<DistillResult>
    return {
      history_entry: parsed.history_entry ?? null,
      memory_update: parsed.memory_update ?? null,
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
      skill_candidate: parsed.skill_candidate ?? null,
    }
  } catch {
    return null
  }
}

/** Anything sensitive-looking in a candidate slug/body blocks auto-creation. */
const SENSITIVE_RE = /\.ssh|\.pem$|\.key$|credential|secret/i

function buildDistillPrompt(windowText: string, full: boolean, negativeFirst: boolean): string {
  return (
    `You are the memory distiller for a coding agent. Distill the session conversation window below into durable knowledge.\n` +
    `Return ONLY valid JSON of the shape:\n` +
    `{"history_entry": string|null, "memory_update": string|null, "lessons": [{"rule": string, "category": "preference"|"workflow"|"knowledge"|"correction", "negative"?: boolean}], "skill_candidate": {"slug": string, "description": string, "body": string}|null}\n` +
    (full
      ? `This is a FULL distillation: extract all durable lessons and, if the session shows a repeated, generalizable workflow, propose one skill_candidate.\n`
      : `This is a LIGHTWEIGHT distillation: extract only clearly durable lessons; always set skill_candidate to null.\n`) +
    // L5 (memory.negativeFirst): negative formulations resist agent drift better —
    // "never do X" constrains a plan, "prefer Y" only nudges it.
    (negativeFirst
      ? `Prefer negative formulations (never/MUST NOT) for constraint-type lessons where idiomatic.\n`
      : ``) +
    `history_entry: one-line session summary for the dated history log, or null if nothing worth logging.\n` +
    `memory_update: a paragraph to append to the workspace context document if it contains information not already there, else null.\n\n` +
    buildTransferredSessionContext(windowText)
  )
}

export class MemoryService {
  private readonly deps: MemoryServiceDeps
  private readonly clock: () => number
  private readonly emit: (channel: string, args: unknown[]) => void
  private readonly logger: { warn: (msg: string, err?: unknown) => void; info?: (msg: string) => void }
  private distiller: (prompt: string) => Promise<string>
  private queue: DistillJob[] = []
  private draining = false
  private stopped = false
  private idleTimer: NodeJS.Timeout | null = null
  private readonly lastCounts = new Map<string, number>()
  private readonly lastActivity = new Map<string, number>()
  private readonly idleDistilled = new Set<string>()
  private idleWaiters: Array<() => void> = []

  constructor(deps: MemoryServiceDeps) {
    this.deps = deps
    this.clock = deps.clock ?? (() => Date.now())
    this.emit = deps.emit ?? (() => {})
    this.logger = deps.logger ?? { warn: () => {} }
    this.distiller =
      deps.distiller ??
      (() => Promise.reject(new Error('MemoryService: no distiller configured — call setDistiller() during server bootstrap')))
  }

  /** Attach the real one-shot distiller (lazy bootstrap wiring). */
  setDistiller(distiller: (prompt: string) => Promise<string>): void {
    this.distiller = distiller
  }

  private get config(): MemoryConfig {
    return this.deps.getConfig?.() ?? getMemoryConfig()
  }

  /**
   * F3: incognito/temporary sessions skip every memory WRITE trigger
   * (completion/distill/branch/idle) but still record activity, so flipping
   * back to 'persistent' doesn't instantly stale-fire an idle distill.
   * Explicit RPC adds (addLesson etc.) bypass this — user intent wins.
   */
  private skipsWrites(sessionId: string): boolean {
    const mode = this.deps.getSessionMode?.(sessionId) ?? 'persistent'
    return mode === 'incognito' || mode === 'temporary'
  }

  /** Subscribe to SessionManager.onSessionComplete. Returns unsubscribe. Never throws. */
  attachSessionCompletion(subscribeFn: (cb: (evt: SessionCompletionLike) => void) => () => void): () => void {
    return subscribeFn((evt) => {
      try {
        this.recordActivity(evt.sessionId)
        if (!this.config.enabled) return
        if (this.skipsWrites(evt.sessionId)) return
        if (evt.reason === 'complete') {
          this.enqueue({ sessionId: evt.sessionId, full: true, trigger: 'distillation' })
        } else {
          // L1 feedback loop: a bad ending is evidence the injected lessons
          // failed this session. Attribute the conflict to every lesson the
          // session saw BEFORE the distill enqueues.
          this.recordProvenanceConflicts(evt)
          this.enqueue({
            sessionId: evt.sessionId,
            full: false,
            trigger:
              evt.reason === 'interrupted'
                ? 'interrupted'
                : evt.reason === 'branch'
                  ? 'branch'
                  : 'error', // timeout → 'error'
          })
        }
      } catch (err) {
        this.logger.warn(`MemoryService: completion handler failed for ${evt.sessionId}`, err)
      }
    })
  }

  /** Called from the per-session message persist path with the current message count. */
  notifyMessageCount(sessionId: string, count: number): void {
    this.recordActivity(sessionId)
    if (!this.config.enabled) return
    if (this.skipsWrites(sessionId)) return
    const interval = this.config.distillMsgCount
    const last = this.lastCounts.get(sessionId) ?? 0
    // Fire exactly once per crossed interval boundary.
    if (Math.floor(count / interval) > Math.floor(last / interval)) {
      this.lastCounts.set(sessionId, count)
      this.enqueue({ sessionId, full: false, trigger: 'distillation' })
    } else if (count > last) {
      this.lastCounts.set(sessionId, count)
    }
  }

  /** User branched a session — a strong correction signal. */
  notifyBranchCorrection(sessionId: string, _messageId: string): void {
    this.recordActivity(sessionId)
    if (!this.config.enabled) return
    if (this.skipsWrites(sessionId)) return
    this.enqueue({ sessionId, full: false, trigger: 'branch' })
  }

  /** Start the 60s idle check. */
  start(): void {
    if (this.idleTimer || this.stopped) return
    this.idleTimer = setInterval(() => this.checkIdle(this.clock()), 60_000)
    if (typeof this.idleTimer.unref === 'function') this.idleTimer.unref()
  }

  /** Stop the idle timer. Does not drain enqueued jobs. */
  stop(): void {
    this.stopped = true
    if (this.idleTimer) {
      clearInterval(this.idleTimer)
      this.idleTimer = null
    }
  }

  /**
   * Trigger full distillation for sessions idle longer than distillIdleHours.
   * Fires once per idle period (activity resets the once-flag).
   */
  checkIdle(now: number): void {
    if (!this.config.enabled || this.stopped) return
    const idleMs = this.config.distillIdleHours * 3_600_000
    for (const [sessionId, lastAt] of this.lastActivity) {
      if (this.idleDistilled.has(sessionId)) continue
      if (this.skipsWrites(sessionId)) continue
      if (now - lastAt >= idleMs) {
        this.idleDistilled.add(sessionId)
        this.enqueue({ sessionId, full: true, trigger: 'distillation' })
      }
    }
  }

  /** Prompt blocks for BackendConfig.memoryBlocks. Returns undefined when disabled. */
  buildMemoryBlocks(): MemoryPromptBlocks | undefined {
    if (!this.config.enabled) return undefined
    const globalStore = this.deps.lessonStoreFactory?.('global') ?? this.defaultLessonStore('global')
    const workspaceStore = this.deps.lessonStoreFactory?.('workspace') ?? this.defaultLessonStore('workspace')
    const globalLessons = globalStore.forContext()
    const workspaceLessons = workspaceStore.forContext()
    const lessons = [...globalLessons, ...workspaceLessons]
    const memory = this.fileStore.loadWorkspaceMemory()
    // Usage accounting (spec F1/F4): the lessons just assembled into the prompt
    // count as "used". Done at the very end, after both blocks were built, so a
    // throw during formatting never inflates counters. Fail-soft: usage counters
    // must never break prompt assembly (session-start path). touchUsed([]) no-ops.
    try {
      globalStore.touchUsed(globalLessons.map(l => l.rule))
      workspaceStore.touchUsed(workspaceLessons.map(l => l.rule))
    } catch (err) {
      this.logger.warn('MemoryService: touchUsed failed', err)
    }
    return {
      lessonsBlock: lessons.length ? formatLessonsForPrompt(lessons) : undefined,
      memoryBlock: formatWorkspaceMemoryForPrompt(memory) || undefined,
      // Provenance (spec F4): exactly the lessons handed to formatLessonsForPrompt.
      used: lessons.map(l => ({ rule: l.rule, scope: l.scope })),
    }
  }

  private get fileStore(): MemoryFileStore {
    return (this.deps.fileStore ??= new MemoryFileStore('workspace', this.deps.workspaceRoot))
  }

  private auditLog: AuditLog | null = null
  private get audit(): AuditLog {
    return (this.auditLog ??= new AuditLog('workspace', this.deps.workspaceRoot))
  }

  private defaultLessonStore(scope: LessonScope): LessonStore {
    const store = new MemoryFileStore(scope, this.deps.workspaceRoot)
    return new LessonStore(store.lessonsPath, scope)
  }

  /**
   * L1 feedback loop (spec §L1/F1): on branch/interrupted/error/timeout
   * completion, every lesson that was injected into the session's prompts
   * (provenance) gets a conflict event — branch→'branch',
   * interrupted→'interrupted', error|timeout→'error'. Best-effort: missing
   * provenance, missing lessons in the store, and store errors just skip —
   * they must never block the distill enqueue or the completion handler.
   */
  private recordProvenanceConflicts(evt: SessionCompletionLike): void {
    const readProvenance = this.deps.readSessionProvenance
    if (!readProvenance) return
    try {
      const used = readProvenance(evt.sessionId)
      if (!used || used.length === 0) return
      const reason: LessonConflict['reason'] =
        evt.reason === 'branch' ? 'branch' : evt.reason === 'interrupted' ? 'interrupted' : 'error'
      const ts = new Date(this.clock()).toISOString()
      for (const lesson of used) {
        try {
          const store = this.deps.lessonStoreFactory?.(lesson.scope) ?? this.defaultLessonStore(lesson.scope)
          store.recordConflict(lesson.rule, { sessionId: evt.sessionId, ts, reason }, 'distill')
        } catch (err) {
          this.logger.warn(`MemoryService: recordConflict failed for ${evt.sessionId}`, err)
        }
      }
    } catch (err) {
      this.logger.warn(`MemoryService: provenance read failed for ${evt.sessionId}`, err)
    }
  }

  private recordActivity(sessionId: string): void {
    const now = this.clock()
    const prev = this.lastActivity.get(sessionId)
    // New activity resets the idle once-flag.
    if (prev !== undefined && now > prev) this.idleDistilled.delete(sessionId)
    this.lastActivity.set(sessionId, Math.max(prev ?? 0, now))
  }

  private enqueue(job: DistillJob): void {
    if (this.queue.length >= 50) return // backpressure: drop rather than grow forever
    this.queue.push(job)
    // Async drain — the event handler must never await.
    void Promise.resolve()
      .then(() => this.drain())
      .catch((err) => this.logger.warn('MemoryService: drain failed', err))
  }

  private async drain(): Promise<void> {
    if (this.draining) return
    this.draining = true
    try {
      for (let job = this.queue.shift(); job; job = this.queue.shift()) {
        await this.runDistill(job)
      }
    } finally {
      this.draining = false
      // Jobs enqueued during drain: schedule another pass.
      if (this.queue.length > 0 && !this.stopped) {
        this.enqueue(this.queue.shift()!)
      } else {
        const idle = this.idleWaiters
        this.idleWaiters = []
        for (const resolve of idle) resolve()
      }
    }
  }

  /** Resolves once every currently-enqueued job has been processed (test/drain seam). */
  whenIdle(): Promise<void> {
    if (!this.draining && this.queue.length === 0) return Promise.resolve()
    const { promise, resolve } = Promise.withResolvers<void>()
    this.idleWaiters.push(resolve)
    return promise
  }

  private async runDistill(job: DistillJob): Promise<void> {
    let result: DistillResult | null = null
    try {
      const messages = (this.deps.readMessages ?? ((id) => readSessionMessages(getSessionFilePath(this.deps.workspaceRoot, id))))(
        job.sessionId,
      )
      const serialized = messages.map((m) => `${m.type}: ${m.content ?? ''}`).join('\n')
      const windowText = redactSecrets(
        serialized.length > DISTILL_WINDOW_CHARS ? serialized.slice(-DISTILL_WINDOW_CHARS) : serialized,
      )
      const negativeFirst = this.config.negativeFirst
      let raw: string | null = null
      try {
        raw = await this.distiller(buildDistillPrompt(windowText, job.full, negativeFirst))
      } catch (err) {
        this.logger.warn(`MemoryService: distiller failed for ${job.sessionId}: ${err instanceof Error ? err.message : String(err)}`, err)
        return
      }
      result = parseDistillResult(raw)
      if (!result) {
        // One retry with a harder JSON-only instruction.
        raw = await this.distiller(buildDistillPrompt(windowText, job.full, negativeFirst) + '\nReturn only valid JSON')
        result = parseDistillResult(raw ?? '')
        if (!result) {
          this.logger.warn(`MemoryService: distiller returned invalid JSON twice for ${job.sessionId}`)
          return
        }
      }
    } catch (err) {
      this.logger.warn(`MemoryService: runDistill failed for ${job.sessionId}`, err)
      return
    }
    this.applyResult(job, result)
  }

  private applyResult(job: DistillJob, result: DistillResult): void {
    const workspaceId = this.deps.workspaceId ?? this.deps.workspaceRoot
    let wroteMemory = false
    try {
      // Defense-in-depth: the distiller reads a redacted window, but its output
      // is still untrusted text — never persist a re-emitted secret.
      for (const lesson of result.lessons) {
        lesson.rule = redactSecrets(lesson.rule)
      }
      if (result.memory_update) result.memory_update = redactSecrets(result.memory_update)
      if (result.history_entry) result.history_entry = redactSecrets(result.history_entry)
      if (result.skill_candidate) {
        result.skill_candidate.body = redactSecrets(result.skill_candidate.body)
        result.skill_candidate.description = redactSecrets(result.skill_candidate.description)
      }
      for (const lesson of result.lessons) {
        const store = this.deps.lessonStoreFactory?.('workspace') ?? this.defaultLessonStore('workspace')
        const entry: Lesson = {
          ts: new Date(this.clock()).toISOString(),
          rule: lesson.rule,
          category: lesson.category,
          scope: 'workspace',
          negative: lesson.negative,
          source: { sessionId: job.sessionId, trigger: job.trigger },
        }
        store.add(entry, 'distill')
        wroteMemory = true
      }
      if (result.history_entry) {
        this.fileStore.appendDailyHistory(result.history_entry)
        wroteMemory = true
      }
      if (result.memory_update) {
        const existing = this.fileStore.readContext()
        if (!existing.includes(result.memory_update)) {
          this.fileStore.writeContext(existing ? `${existing}\n\n${result.memory_update}` : result.memory_update)
          try {
            this.audit.append({ actor: 'distill', action: 'update', target: 'context.md' })
          } catch {
            // auditing is best-effort; the write already landed
          }
          wroteMemory = true
        }
      }
      if (result.skill_candidate && job.full) {
        const autoCreate = (this.deps.isSkillAutoCreateEnabled ?? getSkillsAutoCreateFromSessions)()
        const cand = result.skill_candidate
        if (!autoCreate) {
          // gated off by default — drop
        } else if (SENSITIVE_RE.test(cand.slug) || SENSITIVE_RE.test(cand.body)) {
          this.logger.warn(`MemoryService: dropped sensitive skill candidate '${cand.slug}'`)
        } else {
          const candidate: SkillCandidate = {
            slug: cand.slug,
            description: cand.description,
            body: cand.body,
            source: { sessionId: job.sessionId, ts: new Date(this.clock()).toISOString() },
          }
          const queue = this.deps.skillQueue ?? new SkillPendingQueue(this.deps.workspaceRoot)
          if (queue.enqueue(candidate)) {
            this.emit('skillsPending:changed', [workspaceId])
          }
        }
      }
    } catch (err) {
      this.logger.warn(`MemoryService: failed to apply distill result for ${job.sessionId}`, err)
    }
    if (wroteMemory) {
      this.emit('memory:changed', [workspaceId, 'both'])
    }
  }
}
