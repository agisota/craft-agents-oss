/**
 * Kanban board config storage.
 *
 * File: `{workspaceRoot}/kanban/config.json`
 * Absence → built-in defaults (5 columns, groupBy project).
 */

import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { atomicWriteFileSync, readJsonFileSync } from '../utils/files.ts'
import type { KanbanBoardColumnConfig, KanbanBoardConfig, KanbanGroupBy } from './types.ts'

export const KANBAN_CONFIG_RELATIVE_PATH = 'kanban/config.json'

/** Built-in column ids in left→right board order. */
export const BUILTIN_KANBAN_COLUMN_IDS = [
  'backlog',
  'todo',
  'in-progress',
  'needs-review',
  'done',
] as const

export type BuiltinKanbanColumnId = (typeof BUILTIN_KANBAN_COLUMN_IDS)[number]

const BUILTIN_DEFAULT_COLORS: Record<BuiltinKanbanColumnId, string> = {
  backlog: '#94a3b8',
  todo: '#3b82f6',
  'in-progress': '#f59e0b',
  'needs-review': '#8b5cf6',
  done: '#10b981',
}

export function getDefaultKanbanBoardConfig(): KanbanBoardConfig {
  return {
    version: 1,
    groupBy: 'project',
    columns: BUILTIN_KANBAN_COLUMN_IDS.map((id) => ({
      id,
      color: BUILTIN_DEFAULT_COLORS[id],
      collapsed: id === 'backlog',
      dropStatusId: id,
      isBuiltIn: true,
      promptEnabled: false,
      prompt: '',
    })),
  }
}

function isGroupBy(value: unknown): value is KanbanGroupBy {
  return value === 'none' || value === 'project'
}

function normalizeColumn(raw: unknown, index: number): KanbanBoardColumnConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  const id = typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `col-${index}`
  const isBuiltIn =
    typeof c.isBuiltIn === 'boolean'
      ? c.isBuiltIn
      : (BUILTIN_KANBAN_COLUMN_IDS as readonly string[]).includes(id)

  const column: KanbanBoardColumnConfig = {
    id,
    isBuiltIn,
  }

  if (typeof c.label === 'string' && c.label.trim()) column.label = c.label.trim()
  if (typeof c.color === 'string' && c.color.trim()) column.color = c.color.trim()
  if (typeof c.collapsed === 'boolean') column.collapsed = c.collapsed
  else if (id === 'backlog' && isBuiltIn) column.collapsed = true
  if (typeof c.promptEnabled === 'boolean') column.promptEnabled = c.promptEnabled
  if (typeof c.prompt === 'string') column.prompt = c.prompt
  if (typeof c.dropStatusId === 'string' && c.dropStatusId.trim()) {
    column.dropStatusId = c.dropStatusId.trim()
  } else if (isBuiltIn) {
    column.dropStatusId = id
  }

  return column
}

/**
 * Normalize a raw JSON object into a valid KanbanBoardConfig.
 * Ensures all built-ins exist (inserts missing ones in canonical order) and
 * preserves custom columns after the built-in set.
 */
export function normalizeKanbanBoardConfig(raw: unknown): KanbanBoardConfig {
  const defaults = getDefaultKanbanBoardConfig()
  if (!raw || typeof raw !== 'object') return defaults

  const obj = raw as Record<string, unknown>
  const rawColumns = Array.isArray(obj.columns) ? obj.columns : []
  const parsed = rawColumns
    .map((c, i) => normalizeColumn(c, i))
    .filter((c): c is KanbanBoardColumnConfig => c !== null)

  const byId = new Map(parsed.map((c) => [c.id, c]))
  const columns: KanbanBoardColumnConfig[] = []

  // Built-ins first, in canonical order (merge user overrides).
  for (const id of BUILTIN_KANBAN_COLUMN_IDS) {
    const existing = byId.get(id)
    const fallback = defaults.columns.find((c) => c.id === id)!
    if (existing) {
      columns.push({
        ...fallback,
        ...existing,
        id,
        isBuiltIn: true,
        dropStatusId: existing.dropStatusId ?? id,
        collapsed: existing.collapsed ?? fallback.collapsed,
        color: existing.color ?? fallback.color,
      })
      byId.delete(id)
    } else {
      columns.push({ ...fallback })
    }
  }

  // Remaining custom columns keep author order.
  for (const c of parsed) {
    if (!byId.has(c.id)) continue
    columns.push({ ...c, isBuiltIn: false })
    byId.delete(c.id)
  }

  if (columns.length === 0) return defaults

  return {
    version: 1,
    groupBy: isGroupBy(obj.groupBy) ? obj.groupBy : 'project',
    columns,
  }
}

export function getKanbanConfigPath(workspaceRootPath: string): string {
  return join(workspaceRootPath, KANBAN_CONFIG_RELATIVE_PATH)
}

/**
 * Load board config from disk. Missing/corrupt file → defaults (not written).
 */
export function loadKanbanBoardConfig(workspaceRootPath: string): KanbanBoardConfig {
  const path = getKanbanConfigPath(workspaceRootPath)
  if (!existsSync(path)) return getDefaultKanbanBoardConfig()
  try {
    const raw = readJsonFileSync<unknown>(path)
    return normalizeKanbanBoardConfig(raw)
  } catch {
    return getDefaultKanbanBoardConfig()
  }
}

/**
 * Persist board config. Creates `kanban/` directory as needed.
 * Returns the normalized config that was written.
 */
export function saveKanbanBoardConfig(
  workspaceRootPath: string,
  config: KanbanBoardConfig,
): KanbanBoardConfig {
  const normalized = normalizeKanbanBoardConfig(config)
  const path = getKanbanConfigPath(workspaceRootPath)
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  atomicWriteFileSync(path, JSON.stringify(normalized, null, 2) + '\n')
  return normalized
}

/**
 * Patch helpers — apply a partial column update by id.
 */
export function patchKanbanColumn(
  config: KanbanBoardConfig,
  columnId: string,
  patch: Partial<KanbanBoardColumnConfig>,
): KanbanBoardConfig {
  return {
    ...config,
    columns: config.columns.map((c) =>
      c.id === columnId ? { ...c, ...patch, id: c.id } : c,
    ),
  }
}
