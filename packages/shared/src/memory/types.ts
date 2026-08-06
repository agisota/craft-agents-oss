/**
 * Self-learning / self-evolving types — durable lessons, workspace memory,
 * distillation results and skill-candidate queue.
 * See docs/superpowers/specs/2026-08-06-self-learning-memory-design.md
 */

export type LessonCategory = 'preference' | 'workflow' | 'knowledge' | 'correction'
export type LessonScope = 'global' | 'workspace'
export type LessonTrigger = 'explicit' | 'branch' | 'interrupted' | 'error' | 'distillation'

export interface Lesson {
  /** ISO timestamp */
  ts: string
  /** The durable rule the agent must follow, e.g. "always run frontend checks before calling a change done" */
  rule: string
  category: LessonCategory
  scope: LessonScope
  /** true = anti-rule ("never do X") — rendered as its own MUST NOT line */
  negative?: boolean
  source: {
    sessionId?: string
    trigger: LessonTrigger
  }
  // — Lesson schema v2 (spec F1). All optional: v1 files load without migration. —
  /** How many times this lesson was included in an assembled prompt (touchUsed). */
  usageCount?: number
  /** ISO timestamp of the last prompt inclusion. */
  lastUsedAt?: string
  /** Violations of this lesson (feedback loop), capped at the most recent 20. */
  conflicts?: LessonConflict[]
  /** Marker set when the lesson was promoted from workspace to global scope. */
  promoted?: {
    fromScope: 'workspace'
    workspaceIds: string[]
    ts: string
  }
  /** true when written by distillation (vs an explicit user/branch rule). */
  generated?: boolean
}

/** One recorded violation of a lesson (spec F1). */
export interface LessonConflict {
  sessionId: string
  /** ISO timestamp */
  ts: string
  reason: 'branch' | 'interrupted' | 'error'
}

export type AuditActor = 'ui' | 'distill' | 'rpc' | 'queue'

export type AuditAction = 'add' | 'update' | 'delete' | 'promote' | 'conflict' | 'approved' | 'dismissed'

/**
 * One append-only audit line in {scope}/memory/audit.jsonl (spec F2).
 * Written by LessonStore mutations, MemoryService.applyResult and
 * SkillPendingQueue approve/dismiss.
 */
export interface AuditEntry {
  /** ISO timestamp */
  ts: string
  actor: AuditActor
  action: AuditAction
  /** Rule text for lessons, slug for skills, 'context.md' for memory updates. */
  target: string
  detail?: string
  scope: LessonScope
}

export interface MemoryConfig {
  /** master switch, default true */
  enabled: boolean
  /** idle hours before full distillation, default 3 */
  distillIdleHours: number
  /** messages between lightweight distillations, default 30 */
  distillMsgCount: number
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: true,
  distillIdleHours: 3,
  distillMsgCount: 30,
}

/** Hard limits (mirror KiroCrew learn.py) */
export const LESSON_LIMITS = {
  /** max lessons kept in a store file; oldest pruned beyond this */
  total: 200,
  /** max lessons injected into a prompt context */
  context: 50,
  /** max conflict events kept per lesson (spec F1: cap last 20) */
  conflicts: 20,
} as const

export interface SkillCandidate {
  slug: string
  description: string
  /** SKILL.md body without frontmatter */
  body: string
  source: {
    sessionId?: string
    ts: string
    toolCallStats?: Record<string, number>
  }
}

/**
 * A skill candidate awaiting approval in {workspaceRoot}/skills/.pending/.
 * Returned by skillsPending:list — parsed .meta.json plus raw SKILL.md content.
 */
export interface PendingSkill {
  slug: string
  description: string
  /** Raw SKILL.md file content (with frontmatter) */
  content: string
  source: SkillCandidate['source']
}

/** Strict-JSON payload returned by the distillation prompt */
export interface DistillResult {
  history_entry: string | null
  memory_update: string | null
  lessons: Array<{ rule: string; category: LessonCategory; negative?: boolean }>
  skill_candidate: { slug: string; description: string; body: string } | null
}

/** Workspace memory directory contents */
export interface WorkspaceMemory {
  context: string
  preferences: string
  recentHistory: string
}

/**
 * Pre-formatted prompt blocks produced by formatLessonsForPrompt /
 * formatWorkspaceMemoryForPrompt and injected into agent system prompts.
 * Resolved by the server core (MemoryService) and passed into the agent
 * backends via BackendConfig.memoryBlocks — agent code never reads the
 * memory store itself.
 */
export interface MemoryPromptBlocks {
  /** Output of formatLessonsForPrompt (caller composes global then workspace lessons) */
  lessonsBlock?: string
  /** Output of formatWorkspaceMemoryForPrompt */
  memoryBlock?: string
  /**
   * Provenance (spec F4): lessons actually included in lessonsBlock, listed as
   * `{rule, scope}` pairs in the same order they were passed to
   * formatLessonsForPrompt. Absent in records predating F4; present (possibly
   * empty) whenever the blocks were assembled by an F4-aware MemoryService.
   */
  used?: LessonPromptUsage[]
}

/** One lesson that was injected into an agent prompt (spec F4). */
export interface LessonPromptUsage {
  rule: string
  scope: LessonScope
}

/**
 * Per-session memory provenance record (spec F4), persisted at
 * {workspace}/sessions/{id}/meta/provenance.json by the SessionManager at the
 * site where prompt blocks are assembled (currently: session start / backend
 * spawn). `skills` is [] until sessions carry an enabled-skills list — skills
 * today attach per-message via [skill:slug] mentions, not per session.
 */
export interface SessionProvenance {
  lessons: LessonPromptUsage[]
  skills: string[]
  /** ISO timestamp of the prompt assembly that produced this record */
  ts: string
}
