import type { BuiltInKanbanColumnId } from './types'

/**
 * Default accent color for each board column (hex). Single source of truth for
 * the column identity; user overrides live in `kanbanColumnColorsAtom` and are
 * merged over these by `useKanbanColumnColors`.
 *
 * Palette (left → right): muted slate backlog → blue task → amber active →
 * violet review → emerald done.
 */
export const DEFAULT_KANBAN_COLUMN_COLORS: Record<BuiltInKanbanColumnId, string> = {
  backlog: '#94a3b8', // slate
  todo: '#3b82f6', // blue
  'in-progress': '#f59e0b', // amber
  'needs-review': '#8b5cf6', // violet
  done: '#10b981', // emerald
}
