import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import type { PushTarget } from '@craft-agent/shared/protocol'
import { getWorkspaceByNameOrId } from '@craft-agent/shared/config'
import type { Lesson, LessonCategory, LessonScope, WorkspaceMemory } from '@craft-agent/shared/memory/types'
import type { RpcServer } from '@craft-agent/server-core/transport'
import { pushTyped } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { LessonStore } from '../../memory/LessonStore'
import { MemoryFileStore } from '../../memory/MemoryFileStore'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.memory.LIST_LESSONS,
  RPC_CHANNELS.memory.ADD_LESSON,
  RPC_CHANNELS.memory.UPDATE_LESSON,
  RPC_CHANNELS.memory.DELETE_LESSON,
  RPC_CHANNELS.memory.GET_CONTEXT,
  RPC_CHANNELS.memory.UPDATE_CONTEXT,
  RPC_CHANNELS.memory.LIST_HISTORY,
] as const

export interface LessonInput {
  rule: string
  category: LessonCategory
  negative?: boolean
  scope: LessonScope
}

export interface MemoryContextDto {
  /** Global ~/.craft-agent/memory/preferences.md */
  preferences: string
  /** Workspace {root}/memory/context.md ('' when no workspace given) */
  context: string
  /** Full workspace memory bundle (context + preferences + recent history) */
  workspaceMemory: WorkspaceMemory | null
}

export interface MemoryHistoryDto {
  dates: string[]
  /** The date whose content is returned (requested, else most recent, else null) */
  date: string | null
  content: string
}

function lessonStoreFor(scope: LessonScope, workspaceId?: string): LessonStore | null {
  if (scope === 'global') {
    return new LessonStore(new MemoryFileStore('global').lessonsPath, 'global')
  }
  if (!workspaceId) return null
  const workspace = getWorkspaceByNameOrId(workspaceId)
  if (!workspace) return null
  return new LessonStore(new MemoryFileStore('workspace', workspace.rootPath).lessonsPath, 'workspace')
}

export function registerMemoryHandlers(server: RpcServer, deps: HandlerDeps): void {
  const broadcastChanged = (workspaceId: string | null, scope: LessonScope | 'both'): void => {
    const target: PushTarget = workspaceId ? { to: 'workspace', workspaceId } : { to: 'all' }
    pushTyped(server, RPC_CHANNELS.memory.CHANGED, target, workspaceId, scope)
  }

  // List lessons for one scope or both.
  server.handle(RPC_CHANNELS.memory.LIST_LESSONS, async (_ctx, scope: LessonScope | 'both', workspaceId?: string) => {
    const scopes: LessonScope[] = scope === 'both' ? ['global', 'workspace'] : [scope]
    const lessons: Lesson[] = []
    for (const s of scopes) {
      const store = lessonStoreFor(s, workspaceId)
      if (!store) {
        if (s === 'workspace') deps.platform.logger?.error(`MEMORY_LIST_LESSONS: Workspace not found: ${workspaceId}`)
        continue
      }
      lessons.push(...store.list())
    }
    return lessons
  })

  // Add a lesson from the UI (explicit trigger).
  server.handle(RPC_CHANNELS.memory.ADD_LESSON, async (_ctx, workspaceId: string | null, input: LessonInput) => {
    const scope: LessonScope = input.scope ?? 'global'
    const store = lessonStoreFor(scope, workspaceId ?? undefined)
    if (!store) throw new Error('Workspace not found')
    const lesson = store.add({
      ts: new Date().toISOString(),
      rule: input.rule,
      category: input.category,
      scope,
      ...(input.negative ? { negative: true } : {}),
      source: { trigger: 'explicit' },
    })
    broadcastChanged(scope === 'global' ? null : workspaceId, scope)
    return lesson
  })

  // Patch a lesson by rule text or index.
  server.handle(
    RPC_CHANNELS.memory.UPDATE_LESSON,
    async (_ctx, workspaceId: string | null, scope: LessonScope, match: string | number, patch: Partial<Omit<Lesson, 'scope'>>) => {
      const store = lessonStoreFor(scope, workspaceId ?? undefined)
      if (!store) throw new Error('Workspace not found')
      const updated = store.update(match, patch)
      if (!updated) return null
      broadcastChanged(scope === 'global' ? null : workspaceId, scope)
      return updated
    },
  )

  // Delete a lesson by rule text or index.
  server.handle(RPC_CHANNELS.memory.DELETE_LESSON, async (_ctx, workspaceId: string | null, scope: LessonScope, match: string | number) => {
    const store = lessonStoreFor(scope, workspaceId ?? undefined)
    if (!store) throw new Error('Workspace not found')
    const deleted = store.delete(match)
    if (deleted) broadcastChanged(scope === 'global' ? null : workspaceId, scope)
    return deleted
  })

  // Global preferences.md + workspace context.md (+ workspace memory bundle).
  server.handle(RPC_CHANNELS.memory.GET_CONTEXT, async (_ctx, workspaceId?: string): Promise<MemoryContextDto> => {
    const globalStore = new MemoryFileStore('global')
    const preferences = globalStore.readPreferences()
    if (!workspaceId) return { preferences, context: '', workspaceMemory: null }
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) {
      deps.platform.logger?.error(`MEMORY_GET_CONTEXT: Workspace not found: ${workspaceId}`)
      return { preferences, context: '', workspaceMemory: null }
    }
    const wsStore = new MemoryFileStore('workspace', workspace.rootPath)
    return {
      preferences,
      context: wsStore.readContext(),
      workspaceMemory: wsStore.loadWorkspaceMemory(),
    }
  })

  // Overwrite preferences.md (global) or context.md (workspace).
  server.handle(RPC_CHANNELS.memory.UPDATE_CONTEXT, async (_ctx, workspaceId: string | null, scope: LessonScope, content: string) => {
    if (scope === 'global') {
      new MemoryFileStore('global').writePreferences(content)
      broadcastChanged(null, 'global')
      return true
    }
    const workspace = workspaceId ? getWorkspaceByNameOrId(workspaceId) : null
    if (!workspace) throw new Error('Workspace not found')
    new MemoryFileStore('workspace', workspace.rootPath).writeContext(content)
    broadcastChanged(workspaceId, 'workspace')
    return true
  })

  // History dates for the workspace memory log + content of one date
  // (requested date, else the most recent entry).
  server.handle(RPC_CHANNELS.memory.LIST_HISTORY, async (_ctx, workspaceId: string, date?: string): Promise<MemoryHistoryDto> => {
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) {
      deps.platform.logger?.error(`MEMORY_LIST_HISTORY: Workspace not found: ${workspaceId}`)
      return { dates: [], date: null, content: '' }
    }
    const store = new MemoryFileStore('workspace', workspace.rootPath)
    const dates = store.listHistoryDates()
    const selected = date ?? dates[0] ?? null
    return { dates, date: selected, content: selected ? store.readHistory(selected) : '' }
  })
}
