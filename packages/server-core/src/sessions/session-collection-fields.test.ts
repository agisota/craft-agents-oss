import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import {
  getSessionFilePath,
  loadSession,
  writeSessionJsonl,
  lexorankValidate,
  type StoredSession,
} from '@craft-agent/shared/sessions'
import type { StoredMessage } from '@craft-agent/core/types'
import { SessionManager, createManagedSession } from './SessionManager.ts'

/**
 * B1.3: priority / dueDate / rank setters + getSessions rank backfill.
 * Harness mirrors session-memory-mode.test.ts (cold managed map seed).
 *
 * Default: stub flushSession so getSessions backfill does not race temp-dir
 * cleanup via PersistenceQueue. Tests that assert disk durability restore the
 * real flush for that case only.
 */
describe('session collection fields (B1.3)', () => {
  let tmpRoot: string
  let sm: SessionManager
  const smAny = () => sm as unknown as { sessions: Map<string, unknown> }
  const events: Array<{ type: string; sessionId?: string; changes?: Record<string, unknown> }> = []

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'sm-collection-'))
    sm = new SessionManager()
    events.length = 0
    sm.flushSession = async () => {}
    ;(sm as unknown as {
      sendEvent: (e: { type: string; sessionId?: string; changes?: Record<string, unknown> }) => void
    }).sendEvent = (e) => {
      events.push(e)
    }
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  function enableRealFlush() {
    const proto = Object.getPrototypeOf(sm) as SessionManager
    sm.flushSession = proto.flushSession.bind(sm)
  }

  function buildWorkspace(id = 'ws_test') {
    return {
      id,
      name: 'Test Workspace',
      rootPath: tmpRoot,
      createdAt: Date.now(),
    } as never
  }

  function seedSession(
    sessionId: string,
    opts: {
      lastMessageAt?: number
      rank?: string
      priority?: 'none' | 'urgent' | 'high' | 'medium' | 'low'
      dueDate?: number | null
      messages?: StoredMessage[]
    } = {},
  ) {
    const filePath = getSessionFilePath(tmpRoot, sessionId)
    mkdirSync(dirname(filePath), { recursive: true })
    const stored: StoredSession = {
      id: sessionId,
      workspaceRootPath: tmpRoot,
      name: sessionId,
      createdAt: opts.lastMessageAt ?? Date.now(),
      lastUsedAt: opts.lastMessageAt ?? Date.now(),
      lastMessageAt: opts.lastMessageAt,
      messages: opts.messages ?? [],
      ...(opts.rank !== undefined ? { rank: opts.rank } : {}),
      ...(opts.priority !== undefined ? { priority: opts.priority } : {}),
      ...(opts.dueDate !== undefined && opts.dueDate !== null ? { dueDate: opts.dueDate } : {}),
    } as StoredSession
    writeSessionJsonl(filePath, stored)

    const managed = createManagedSession(
      {
        id: sessionId,
        name: stored.name,
        createdAt: stored.createdAt,
        lastMessageAt: opts.lastMessageAt ?? Date.now(),
        ...(opts.rank !== undefined ? { rank: opts.rank } : {}),
        ...(opts.priority !== undefined ? { priority: opts.priority } : {}),
        ...(opts.dueDate !== undefined ? { dueDate: opts.dueDate ?? undefined } : {}),
      },
      buildWorkspace(),
    )
    smAny().sessions.set(sessionId, managed)
    return managed
  }

  function readDiskHeader(sessionId: string): Record<string, unknown> {
    const path = getSessionFilePath(tmpRoot, sessionId)
    const firstLine = readFileSync(path, 'utf-8').split('\n')[0]
    return JSON.parse(firstLine)
  }

  it('setPriority persists and emits session_metadata_changed', async () => {
    enableRealFlush()
    seedSession('s1')
    await sm.setPriority('s1', 'high')
    const header = readDiskHeader('s1')
    expect(header.priority).toBe('high')
    const reloaded = loadSession(tmpRoot, 's1')
    expect(reloaded?.priority).toBe('high')
    expect(events.some((e) => e.type === 'session_metadata_changed' && e.changes?.priority === 'high')).toBe(true)
  })

  it('setDueDate null clears managed field and emits dueDate: null', async () => {
    enableRealFlush()
    seedSession('s2', { dueDate: Date.UTC(2026, 7, 1, 12, 0, 0) })
    await sm.setDueDate('s2', null)
    const header = readDiskHeader('s2')
    expect(header.dueDate).toBeUndefined()
    const metaEvt = events.find((e) => e.type === 'session_metadata_changed' && e.sessionId === 's2')
    expect(metaEvt?.changes?.dueDate).toBeNull()
  })

  it('setRank rejects invalid ranks', async () => {
    seedSession('s3')
    await expect(sm.setRank('s3', '!!!')).rejects.toThrow(/Invalid rank/)
  })

  it('setRank persists a valid rank', async () => {
    enableRealFlush()
    seedSession('s4')
    await sm.setRank('s4', 'U')
    expect(readDiskHeader('s4').rank).toBe('U')
    expect(lexorankValidate(String(readDiskHeader('s4').rank))).toBe(true)
  })

  it('reorderRank throws RANK_NEIGHBORS_STALE for missing neighbor', async () => {
    seedSession('s5', { rank: 'M' })
    await expect(sm.reorderRank('s5', 'missing-prev')).rejects.toThrow(/RANK_NEIGHBORS_STALE/)
  })

  it('reorderRank places rank between neighbors', async () => {
    enableRealFlush()
    seedSession('a', { rank: 'A' })
    seedSession('b', { rank: 'Z' })
    seedSession('mid', { rank: 'A' })
    await sm.reorderRank('mid', 'a', 'b')
    const midRank = String(readDiskHeader('mid').rank)
    expect(lexorankValidate(midRank)).toBe(true)
    expect(midRank > 'A').toBe(true)
    expect(midRank < 'Z').toBe(true)
  })

  it('getSessions backfills missing ranks ordered by lastMessageAt desc', () => {
    seedSession('old', { lastMessageAt: 1000 })
    seedSession('new', { lastMessageAt: 3000 })
    seedSession('mid', { lastMessageAt: 2000 })

    const first = sm.getSessions('ws_test')
    expect(first).toHaveLength(3)
    for (const s of first) {
      expect(s.rank).toBeTruthy()
      expect(lexorankValidate(s.rank!)).toBe(true)
    }

    const byRankAsc = [...first].sort((a, b) => (a.rank! < b.rank! ? -1 : a.rank! > b.rank! ? 1 : 0))
    expect(byRankAsc.map((s) => s.id)).toEqual(['new', 'mid', 'old'])

    const ranksAfterFirst = Object.fromEntries(first.map((s) => [s.id, s.rank]))
    const second = sm.getSessions('ws_test')
    for (const s of second) {
      expect(s.rank).toBe(ranksAfterFirst[s.id])
    }
  })

  it('managedToSession coerces missing priority/dueDate defaults', () => {
    const managed = createManagedSession({ id: 'coerce', rank: 'M' }, buildWorkspace())
    smAny().sessions.set('coerce', managed)
    const [session] = sm.getSessions('ws_test')
    expect(session.priority).toBe('none')
    expect(session.dueDate).toBeNull()
  })
})
