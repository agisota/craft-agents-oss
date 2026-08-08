import { describe, expect, it } from 'bun:test'
import {
  BUILTIN_KANBAN_COLUMN_IDS,
  getDefaultKanbanBoardConfig,
  normalizeKanbanBoardConfig,
  patchKanbanColumn,
} from './config.ts'

describe('Kanban browser config', () => {
  it('provides all built-in columns in canonical order without disk access', () => {
    const config = getDefaultKanbanBoardConfig()

    expect(config.columns.map((column) => column.id)).toEqual([...BUILTIN_KANBAN_COLUMN_IDS])
    expect(config.columns.find((column) => column.id === 'backlog')?.collapsed).toBe(true)
  })

  it('normalizes malformed input and retains valid custom columns', () => {
    const config = normalizeKanbanBoardConfig({
      groupBy: 'none',
      columns: [{ id: 'todo', color: '#ffffff' }, { id: 'release', label: 'Release' }, null],
    })

    expect(config.groupBy).toBe('none')
    expect(config.columns.map((column) => column.id)).toEqual([
      ...BUILTIN_KANBAN_COLUMN_IDS,
      'release',
    ])
    expect(config.columns.find((column) => column.id === 'todo')?.color).toBe('#ffffff')
    expect(config.columns.find((column) => column.id === 'release')).toMatchObject({
      isBuiltIn: false,
      label: 'Release',
    })
  })

  it('patches a column without allowing its id to change', () => {
    const config = patchKanbanColumn(getDefaultKanbanBoardConfig(), 'todo', {
      id: 'other',
      collapsed: true,
    })

    expect(config.columns.find((column) => column.id === 'todo')).toMatchObject({
      id: 'todo',
      collapsed: true,
    })
  })
})
