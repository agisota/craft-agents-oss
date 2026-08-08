import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_COLLECTION_FILTERS,
  compareSessions,
  dueBucket,
  filterSessionMeta,
  type CollectionDisplay,
  type CollectionFilters,
  type SessionPriority,
} from '@craft-agent/shared/sessions'
import { useNavigation } from '@/contexts/NavigationContext'
import { useAppShellContext } from '@/context/AppShellContext'
import { routes } from '@/lib/navigate'
import { sessionMetaMapAtom, updateSessionMetaAtom, type SessionMeta } from '@/atoms/sessions'
import {
  collectionDisplayAtom,
  loadCollectionDisplayAtom,
  replaceCollectionDisplayAtom,
  setCollectionDisplayAtom,
} from '@/atoms/collection-display'
import { sessionSelection } from '@/hooks/useEntitySelection'
import type { SessionStatus, SessionStatusConfig } from '@/config/session-status-config'
import { CollectionViewToggle } from '../kanban/BoardListToggle'
import { CollectionOpsBar } from '../collection/CollectionOpsBar'
import { CollectionBulkBar } from '../collection/CollectionBulkBar'
import { SessionTableRow } from './SessionTableRow'
import { SessionTableGroupHeader } from './SessionTableGroupHeader'

const PRIORITIES: SessionPriority[] = ['urgent', 'high', 'medium', 'low', 'none']

type GroupBucket = { key: string; label: string; count: number }

function bucketFor(
  meta: SessionMeta,
  groupBy: CollectionDisplay['groupBy'],
  statusById: Map<string, SessionStatusConfig>,
  projectNameById: Map<string, string>,
  labelById: Map<string, string>,
  now: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): GroupBucket {
  switch (groupBy) {
    case 'status': {
      const id = meta.sessionStatus ?? 'todo'
      return { key: `status:${id}`, label: statusById.get(id)?.label ?? id, count: 0 }
    }
    case 'priority': {
      const p = meta.priority ?? 'none'
      return { key: `priority:${p}`, label: t(`priority.${p}`), count: 0 }
    }
    case 'project': {
      const pid = meta.projectId ?? ''
      return {
        key: `project:${pid}`,
        label: pid ? (projectNameById.get(pid) ?? pid) : t('collection.bulk.noProject'),
        count: 0,
      }
    }
    case 'dueDate': {
      const b = dueBucket(meta.dueDate ?? null, now)
      return { key: `due:${b}`, label: t(`collection.display.dueBucket.${b}`), count: 0 }
    }
    case 'label': {
      const first = (meta.labels ?? []).slice().sort((a, b) => a.localeCompare(b))[0]
      if (!first) return { key: 'label:none', label: t('collection.display.labelNone'), count: 0 }
      return { key: `label:${first}`, label: labelById.get(first) ?? first, count: 0 }
    }
    case 'none':
    default:
      return { key: '__all__', label: t('collection.display.groupBy.none'), count: 0 }
  }
}

const COLLAPSE_KEY = 'craft-session-table-collapsed-groups'

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveCollapsed(set: Set<string>) {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set]))
  } catch {
    // ignore
  }
}

export function SessionTableHost() {
  const { t } = useTranslation()
  const { navigate } = useNavigation()
  const { activeWorkspaceId, sessionStatuses = [], projects = [], labels: labelConfigs } =
    useAppShellContext()
  const metaMap = useAtomValue(sessionMetaMapAtom)
  const updateMeta = useSetAtom(updateSessionMetaAtom)
  const display = useAtomValue(collectionDisplayAtom)
  const setDisplay = useSetAtom(setCollectionDisplayAtom)
  const replaceDisplay = useSetAtom(replaceCollectionDisplayAtom)
  const loadDisplay = useSetAtom(loadCollectionDisplayAtom)
  const [filters, setFilters] = React.useState<CollectionFilters>({ ...DEFAULT_COLLECTION_FILTERS })
  const { toggle, selectAll, clearMultiSelect, isSelected } = sessionSelection.useSelection()

  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => loadCollapsed())

  React.useEffect(() => {
    void loadDisplay(activeWorkspaceId)
  }, [activeWorkspaceId, loadDisplay])

  React.useEffect(() => {
    if (!activeWorkspaceId || typeof window === 'undefined') return
    const api = window.electronAPI
    if (!api?.onCollectionDisplayChanged) return
    return api.onCollectionDisplayChanged((workspaceId, next) => {
      if (workspaceId !== activeWorkspaceId) return
      replaceDisplay(next)
    })
  }, [activeWorkspaceId, replaceDisplay])

  const handleDisplayChange = React.useCallback(
    (next: CollectionDisplay) => {
      void setDisplay({ display: next, workspaceId: activeWorkspaceId })
    },
    [setDisplay, activeWorkspaceId],
  )

  const statusById = React.useMemo(() => {
    const map = new Map<string, SessionStatusConfig>()
    for (const s of sessionStatuses) map.set(s.id, s)
    return map
  }, [sessionStatuses])

  const projectNameById = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) map.set(p.id, p.name)
    return map
  }, [projects])

  const labelById = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const l of labelConfigs ?? []) map.set(l.id, l.name)
    return map
  }, [labelConfigs])

  const projectOptions = React.useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects],
  )
  const labelOptions = React.useMemo(
    () => (labelConfigs ?? []).map((l) => ({ id: l.id, name: l.name })),
    [labelConfigs],
  )

  const rows = React.useMemo(() => {
    const now = Date.now()
    const list: SessionMeta[] = []
    for (const meta of metaMap.values()) {
      if (meta.hidden || meta.isArchived) continue
      if (meta.parentSessionId) continue
      if (meta.taskDraft) continue
      if (!filterSessionMeta(meta, filters, display.showCompleted, now)) continue
      list.push(meta)
    }
    list.sort((a, b) => compareSessions(a, b, display.orderBy, display.orderDir))

    if (display.groupBy === 'none') {
      return [{ bucket: null as GroupBucket | null, items: list }]
    }
    const buckets = new Map<string, SessionMeta[]>()
    for (const meta of list) {
      const b = bucketFor(meta, display.groupBy, statusById, projectNameById, labelById, now, t)
      const arr = buckets.get(b.key) ?? []
      arr.push(meta)
      buckets.set(b.key, arr)
    }
    const result: Array<{ bucket: GroupBucket; items: SessionMeta[] }> = []
    for (const [key, items] of buckets) {
      const first = items[0]
      if (!first) continue
      const b = bucketFor(first, display.groupBy, statusById, projectNameById, labelById, now, t)
      result.push({ bucket: { ...b, count: items.length }, items })
    }
    // Keep canonical order for due buckets; others alphabetical
    if (display.groupBy === 'dueDate') {
      const order = ['due:overdue', 'due:today', 'due:this_week', 'due:later', 'due:none']
      result.sort((a, b) => order.indexOf(a.bucket.key) - order.indexOf(b.bucket.key))
    } else {
      result.sort((a, b) => a.bucket.label.localeCompare(b.bucket.label))
    }
    return result
  }, [metaMap, filters, display, statusById, projectNameById, labelById, t])

  const totalRows = rows.reduce((acc, g) => acc + g.items.length, 0)
  const allIds = React.useMemo(
    () => rows.flatMap((g) => g.items).map((s) => s.id),
    [rows],
  )
  const allSelectedVisible = allIds.length > 0 && allIds.every((id) => isSelected(id))

  const showGrip = display.orderBy === 'rank'
  const showCol = (prop: string) => display.visibleProperties.includes(prop as never)

  return (
    <div className="flex h-full flex-col bg-background">
      <CollectionOpsBar
        display={display}
        filters={filters}
        onDisplayChange={handleDisplayChange}
        onFiltersChange={setFilters}
        statuses={sessionStatuses as unknown as SessionStatus[]}
        priorities={PRIORITIES}
        projects={projectOptions}
        labels={labelOptions}
        trailing={
          <CollectionViewToggle
            value="table"
            onChange={(view) => {
              if (view === 'list') navigate(routes.view.allSessions())
              else if (view === 'board') navigate(routes.view.board())
            }}
          />
        }
        className="border-b border-border/50"
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 bg-background/95 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground backdrop-blur">
          <span className="w-6 shrink-0">
            <input
              type="checkbox"
              checked={allSelectedVisible}
              onChange={() => {
                if (allSelectedVisible) clearMultiSelect()
                else selectAll(allIds)
              }}
              aria-label={t('collection.table.selectAll')}
            />
          </span>
          {showGrip && <span className="w-4 shrink-0" />}
          <span className="min-w-0 flex-1">{t('collection.table.column.title')}</span>
          {showCol('status') && <span className="w-28 shrink-0">{t('collection.table.column.status')}</span>}
          {showCol('priority') && <span className="w-20 shrink-0">{t('collection.table.column.priority')}</span>}
          {showCol('project') && <span className="w-28 shrink-0">{t('collection.table.column.project')}</span>}
          {showCol('labels') && <span className="w-32 shrink-0">{t('collection.table.column.labels')}</span>}
          {showCol('dueDate') && <span className="w-24 shrink-0">{t('collection.table.column.dueDate')}</span>}
          {showCol('model') && <span className="w-24 shrink-0">{t('collection.table.column.model')}</span>}
          {showCol('updated') && <span className="w-20 shrink-0">{t('collection.table.column.updated')}</span>}
          {showCol('created') && <span className="w-20 shrink-0">{t('collection.table.column.created')}</span>}
          {showCol('flag') && <span className="w-8 shrink-0" />}
        </div>

        {totalRows === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <p className="text-sm">{t('collection.table.empty')}</p>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-foreground/[0.03]"
              onClick={() => setFilters({ ...DEFAULT_COLLECTION_FILTERS })}
            >
              {t('collection.table.clearFilters')}
            </button>
          </div>
        ) : (
          <ul>
            {rows.map((group) => (
              <React.Fragment key={group.bucket?.key ?? 'all'}>
                {group.bucket && (
                  <SessionTableGroupHeader
                    bucket={group.bucket}
                    collapsed={collapsed.has(group.bucket.key)}
                    onToggle={() => {
                      setCollapsed((prev) => {
                        const next = new Set(prev)
                        if (group.bucket) {
                          if (next.has(group.bucket.key)) next.delete(group.bucket.key)
                          else next.add(group.bucket.key)
                        }
                        saveCollapsed(next)
                        return next
                      })
                    }}
                  />
                )}
                {(group.bucket == null || !collapsed.has(group.bucket.key)) &&
                  group.items.map((meta, index) => (
                    <SessionTableRow
                      key={meta.id}
                      meta={meta}
                      statuses={sessionStatuses}
                      projectNameById={projectNameById}
                      labelById={labelById}
                      selected={isSelected(meta.id)}
                      onSelect={() => toggle(meta.id, index)}
                      onOpen={(id) => navigate(routes.view.allSessions(id))}
                      onUpdate={(partial) => {
                        updateMeta({ id: meta.id, ...partial })
                        const api = window.electronAPI
                        const send = (cmd: unknown) =>
                          api.sessionCommand(meta.id, cmd as never).catch((e) => {
                            console.error(e)
                            // revert on failure
                            updateMeta({ id: meta.id, ...meta })
                          })
                        if (partial.priority !== undefined) void send({ type: 'setPriority', priority: partial.priority })
                        if (partial.dueDate !== undefined) void send({ type: 'setDueDate', dueDate: partial.dueDate })
                        if (partial.sessionStatus !== undefined) void send({ type: 'setSessionStatus', state: partial.sessionStatus })
                        if (partial.isFlagged !== undefined) void send({ type: partial.isFlagged ? 'flag' : 'unflag' })
                      }}
                      showGrip={showGrip}
                      showStatus={showCol('status')}
                      showPriority={showCol('priority')}
                      showProject={showCol('project')}
                      showLabels={showCol('labels')}
                      showDue={showCol('dueDate')}
                      showModel={showCol('model')}
                      showUpdated={showCol('updated')}
                      showCreated={showCol('created')}
                      showFlag={showCol('flag')}
                    />
                  ))}
              </React.Fragment>
            ))}
          </ul>
        )}
      </div>

      <CollectionBulkBar
        workspaceId={activeWorkspaceId}
        statuses={sessionStatuses as unknown as SessionStatus[]}
        projects={projectOptions}
        labels={labelOptions}
      />
    </div>
  )
}

