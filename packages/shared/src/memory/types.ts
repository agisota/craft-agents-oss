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
}
