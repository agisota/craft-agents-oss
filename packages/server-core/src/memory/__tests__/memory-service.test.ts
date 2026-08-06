import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'bun:test'
import { MemoryService, parseDistillResult, redactSecrets } from '../MemoryService'
import { LessonStore } from '../LessonStore'
import { MemoryFileStore } from '../MemoryFileStore'
import type { DistillResult, Lesson, MemoryConfig, SkillCandidate } from '@craft-agent/shared/memory/types'
import type { StoredMessage } from '@craft-agent/core/types'

const MSGS: StoredMessage[] = [
  { id: 'm1', type: 'user', content: 'use key AKIAIOSFODNN7EXAMPLE and api_key=abc123 here' },
  { id: 'm2', type: 'assistant', content: 'done' },
]

const OK: DistillResult = {
  history_entry: 'Session wrapped up',
  memory_update: 'Always run tsc after edits',
  lessons: [{ rule: 'Run tests before shipping', category: 'workflow' }],
  skill_candidate: { slug: 'sweep-thing', description: 'sweep', body: '# sweep it' },
}

const SENSITIVE: DistillResult = {
  ...OK,
  skill_candidate: { slug: 'read-ssh', description: 'x', body: 'reads ~/.ssh files' },
}

/** Flush the async FIFO drain deterministically (no wall-clock timers). */
async function drain(svc: MemoryService): Promise<void> {
  // Let the void'd microtask kick off the drain loop, then wait for it.
  await Promise.resolve()
  await Promise.resolve()
  await svc.whenIdle()
}

function makeService(opts: { distiller?: (prompt: string) => Promise<string>; clock?: () => number } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'memsvc-'))
  const prompts: string[] = []
  const enqueued: SkillCandidate[] = []
  const emitted: Array<[string, unknown[]]> = []
  const config: MemoryConfig = { enabled: true, distillIdleHours: 3, distillMsgCount: 30 }
  let autoCreate = false
  let fire: ((evt: { sessionId: string; reason: 'complete' | 'interrupted' | 'error' | 'timeout' }) => void) | null = null
  const wsFiles = new MemoryFileStore('workspace', root)
  const wsLessons = new LessonStore(wsFiles.lessonsPath, 'workspace')
  const globalLessons = new LessonStore(new MemoryFileStore('global', root).lessonsPath, 'global')
  const svc = new MemoryService({
    workspaceRoot: root,
    workspaceId: 'ws-1',
    clock: opts.clock,
    lessonStoreFactory: (scope) => (scope === 'global' ? globalLessons : wsLessons),
    fileStore: wsFiles,
    skillQueue: { enqueue: (c: SkillCandidate) => (enqueued.push(c), true) } as never,
    distiller: async (prompt) => {
      prompts.push(prompt)
      return opts.distiller ? opts.distiller(prompt) : JSON.stringify(OK)
    },
    emit: (channel, args) => emitted.push([channel, args]),
    logger: { warn: () => {} },
    readMessages: () => MSGS,
    getConfig: () => config,
    isSkillAutoCreateEnabled: () => autoCreate,
  })
  svc.attachSessionCompletion((cb) => {
    fire = cb
    return () => {}
  })
  return {
    svc,
    prompts,
    enqueued,
    emitted,
    config,
    wsFiles,
    wsLessons,
    globalLessons,
    root,
    setAutoCreate: (v: boolean) => {
      autoCreate = v
    },
    complete: (sessionId = 's1') => fire!({ sessionId, reason: 'complete' }),
    interrupted: (sessionId = 's1') => fire!({ sessionId, reason: 'interrupted' }),
    timeout: (sessionId = 's1') => fire!({ sessionId, reason: 'timeout' }),
  }
}

const tmpRoots: string[] = []

afterEach(() => {
  while (tmpRoots.length) rmSync(tmpRoots.pop()!, { recursive: true, force: true })
})

describe('MemoryService', () => {
  it('complete → distiller called once asynchronously', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.complete()
    expect(h.prompts).toHaveLength(0) // never sync inside the event handler
    await drain(h.svc)
    expect(h.prompts).toHaveLength(1)
  })

  it('interrupted → trigger interrupted', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.interrupted()
    await drain(h.svc)
    expect(h.wsLessons.list()[0]?.source.trigger).toBe('interrupted')
  })

  it('timeout → mapped to error trigger', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.timeout()
    await drain(h.svc)
    expect(h.wsLessons.list()[0]?.source.trigger).toBe('error')
  })

  it('message-count triggers exactly once per 30', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    for (let i = 1; i <= 29; i++) h.svc.notifyMessageCount('s1', i)
    await drain(h.svc)
    expect(h.prompts).toHaveLength(0)
    h.svc.notifyMessageCount('s1', 30)
    await drain(h.svc)
    expect(h.prompts).toHaveLength(1)
    for (let i = 31; i <= 60; i++) h.svc.notifyMessageCount('s1', i)
    await drain(h.svc)
    expect(h.prompts).toHaveLength(2)
  })

  it('idle check fires post-N-hours only, once per idle period', async () => {
    const t0 = 1_000_000
    let now = t0
    const h = makeService({ clock: () => now })
    tmpRoots.push(h.root)
    h.svc.notifyMessageCount('s1', 1)
    now = t0 + 2 * 3_600_000
    h.svc.checkIdle(now) // 2h < 3h → nothing
    await drain(h.svc)
    expect(h.prompts).toHaveLength(0)
    now = t0 + 3 * 3_600_000
    h.svc.checkIdle(now) // 3h → full distill
    await drain(h.svc)
    expect(h.prompts).toHaveLength(1)
    h.svc.checkIdle(now + 10 * 3_600_000) // same idle period → no refire
    await drain(h.svc)
    expect(h.prompts).toHaveLength(1)
  })

  it('invalid JSON → single retry → drop, no crash', async () => {
    let calls = 0
    const h = makeService({
      distiller: async () => {
        calls++
        return 'not json at all'
      },
    })
    tmpRoots.push(h.root)
    h.complete()
    await drain(h.svc)
    expect(calls).toBe(2)
    expect(h.wsLessons.list()).toHaveLength(0)
    expect(h.wsFiles.readContext()).toBe('')
  })

  it('redaction: distiller prompt carries no raw secrets', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.complete()
    await drain(h.svc)
    expect(h.prompts).toHaveLength(1)
    expect(h.prompts[0]).not.toContain('AKIAIOSFODNN7EXAMPLE')
    expect(h.prompts[0]).not.toContain('abc123')
    expect(h.prompts[0]).toContain('[REDACTED AWS KEY]')
  })

  it('skill_candidate: gated off by default → no enqueue', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.complete()
    await drain(h.svc)
    expect(h.enqueued).toHaveLength(0)
  })

  it('skill_candidate: gated on → enqueued on full distill', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.setAutoCreate(true)
    h.complete()
    await drain(h.svc)
    expect(h.enqueued).toHaveLength(1)
  })

  it('skill_candidate: sensitive slug/body dropped even when gated on', async () => {
    const h = makeService({ distiller: async () => JSON.stringify(SENSITIVE) })
    tmpRoots.push(h.root)
    h.setAutoCreate(true)
    h.complete()
    await drain(h.svc)
    expect(h.enqueued).toHaveLength(0)
  })

  it('skill_candidate: lightweight distill never enqueues even when gated on', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.setAutoCreate(true)
    h.svc.notifyMessageCount('s1', 30)
    await drain(h.svc)
    expect(h.enqueued).toHaveLength(0)
  })

  it('memory.enabled=false → no distill from any trigger', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.config.enabled = false
    h.complete()
    h.svc.notifyMessageCount('s1', 60)
    h.svc.notifyBranchCorrection('s1', 'm1')
    h.svc.checkIdle(Date.now() + 999 * 3_600_000)
    await drain(h.svc)
    expect(h.prompts).toHaveLength(0)
  })

  it('branch correction enqueues a branch-triggered lightweight distill', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.svc.notifyBranchCorrection('s1', 'm1')
    await drain(h.svc)
    expect(h.prompts).toHaveLength(1)
    expect(h.wsLessons.list()[0]?.source.trigger).toBe('branch')
  })

  it('memory:changed broadcast after applied writes', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.complete()
    await drain(h.svc)
    expect(h.emitted.some(([ch, args]) => ch === 'memory:changed' && args[0] === 'ws-1' && args[1] === 'both')).toBe(true)
  })

  it('skillsPending:changed broadcast when a candidate is enqueued', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.setAutoCreate(true)
    h.complete()
    await drain(h.svc)
    expect(h.emitted.some(([ch, args]) => ch === 'skillsPending:changed' && args[0] === 'ws-1')).toBe(true)
  })

  it('memory_update is appended once (no duplicate)', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.svc.notifyMessageCount('s1', 30)
    await drain(h.svc)
    h.svc.notifyMessageCount('s2', 30)
    await drain(h.svc)
    expect(h.wsFiles.readContext().split('Always run tsc after edits')).toHaveLength(2)
  })

  it('default distiller rejects with a clear error (real one wired via setDistiller)', async () => {
    const h = makeService()
    tmpRoots.push(h.root)
    // Default distiller log+drop path: swap in a fresh service without a distiller.
    const svc = new MemoryService({
      workspaceRoot: h.root,
      logger: { warn: () => {} },
      readMessages: () => MSGS,
      getConfig: () => h.config,
    })
    svc.notifyMessageCount('s1', 30)
    await drain(svc)
    // No crash, nothing applied (distiller error → drop).
    expect(new LessonStore(h.wsFiles.lessonsPath, 'workspace').list()).toHaveLength(0)
  })

  it('buildMemoryBlocks merges global+workspace lessons and workspace memory', () => {
    const h = makeService()
    tmpRoots.push(h.root)
    h.globalLessons.add({
      ts: '2026-01-01T00:00:00Z',
      rule: 'global rule',
      category: 'preference',
      scope: 'global',
      source: { trigger: 'explicit' },
    } as Lesson)
    h.wsLessons.add({
      ts: '2026-01-01T00:00:01Z',
      rule: 'ws rule',
      category: 'workflow',
      scope: 'workspace',
      source: { trigger: 'explicit' },
    } as Lesson)
    const blocks = h.svc.buildMemoryBlocks()
    expect(blocks?.lessonsBlock).toContain('global rule')
    expect(blocks?.lessonsBlock).toContain('ws rule')
    h.config.enabled = false
    expect(h.svc.buildMemoryBlocks()).toBeUndefined()
  })
})

describe('helpers', () => {
  it('redactSecrets masks common token shapes', () => {
    const input =
      'AWS=AKIAIOSFODNN7EXAMPLE sk-abcdefghijklmnopqrstuvwxyz0123 ghp_' +
      'a'.repeat(36) +
      ' xoxb-1234-5678-zzzz -----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAKj\n-----END RSA PRIVATE KEY----- apiKey = "SUPERSECRET"'
    const out = redactSecrets(input)
    for (const raw of ['AKIAIOSFODNN7EXAMPLE', 'sk-abc', 'ghp_', 'xoxb-', 'MIIBOgIBAAJBAKj', 'SUPERSECRET']) {
      expect(out).not.toContain(raw)
    }
  })

  it('parseDistillResult strips code fences, rejects garbage', () => {
    expect(
      parseDistillResult('```json\n{"history_entry":null,"memory_update":null,"lessons":[],"skill_candidate":null}\n```'),
    ).not.toBeNull()
    expect(parseDistillResult('garbage')).toBeNull()
  })
})
