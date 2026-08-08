import { describe, expect, it } from 'bun:test'
import type { KanbanTask } from '../types'
import type { KanbanProjectGroup } from '../KanbanColumn'
import type { SessionPriority } from '@craft-agent/shared/protocol/dto'

// Mirrors the `priorityGroupsByColumn` memo in KanbanBoard.tsx (B6):
// buckets tasks of one column by priority in fixed order, non-empty groups only,
// pseudo ids `__priority_<p>`, unknown priorities appended at the end.
function buildPriorityGroups(tasks: KanbanTask[], t: (key: string, opts?: unknown) => string): KanbanProjectGroup[] {
  const order: readonly string[] = ['urgent', 'high', 'medium', 'low', 'none']
  const byPrio = new Map<string, KanbanTask[]>()
  for (const task of tasks) {
    const key = (task.priority ?? 'none') as string
    const list = byPrio.get(key)
    if (list) list.push(task)
    else byPrio.set(key, [task])
  }
  const groups: KanbanProjectGroup[] = []
  for (const prio of order) {
    const list = byPrio.get(prio)
    if (!list || list.length === 0) continue
    groups.push({
      projectId: `__priority_${prio}`,
      name: t(`priority.${prio}`, { defaultValue: prio }),
      tasks: list,
    })
    byPrio.delete(prio)
  }
  for (const [prio, list] of byPrio) {
    groups.push({ projectId: `__priority_${prio}`, name: prio, tasks: list })
  }
  return groups
}

const t = (key: string) => key

function task(id: string, priority?: SessionPriority): KanbanTask {
  return { id, title: id, column: 'todo', statusId: 'todo', model: 'm', subtasks: [], priority }
}

describe('B6 priority groups (board Display.groupBy=priority)', () => {
  it('groups in fixed priority order and skips empty buckets', () => {
    const groups = buildPriorityGroups(
      [task('a', 'low'), task('b', 'urgent'), task('c', 'none'), task('d', 'urgent'), task('e', 'medium')],
      t,
    )
    expect(groups.map(g => g.projectId)).toEqual(['__priority_urgent', '__priority_medium', '__priority_low', '__priority_none'])
    expect(groups[0]!.tasks.map(x => x.id)).toEqual(['b', 'd'])
  })

  it('task without priority lands in the none group', () => {
    const groups = buildPriorityGroups([task('a')], t)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.projectId).toBe('__priority_none')
  })

  it('unknown priority value appears after all known priorities', () => {
    const groups = buildPriorityGroups(
      [task('a', 'p4' as SessionPriority), task('b', 'high')],
      t,
    )
    expect(groups.map(g => g.projectId)).toEqual(['__priority_high', '__priority_p4'])
    expect(groups[1]!.name).toBe('p4')
  })

  it('empty task list yields zero groups', () => {
    expect(buildPriorityGroups([], t)).toEqual([])
  })
})
