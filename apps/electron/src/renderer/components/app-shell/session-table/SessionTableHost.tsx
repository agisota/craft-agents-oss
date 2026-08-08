import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_COLLECTION_FILTERS,
  compareSessions,
  filterSessionMeta,
  type CollectionDisplay,
  type CollectionFilters,
  type SessionPriority,
} from '@craft-agent/shared/sessions'
import { useNavigation } from '@/contexts/NavigationContext'
import { useAppShellContext } from '@/context/AppShellContext'
import { routes } from '@/lib/navigate'
import { sessionMetaMapAtom, type SessionMeta } from '@/atoms/sessions'
import {
  collectionDisplayAtom,
  loadCollectionDisplayAtom,
  setCollectionDisplayAtom,
} from '@/atoms/collection-display'
import { resolveStatusDisplayLabel, type SessionStatus } from '@/config/session-status-config'
import { getSessionTitle } from '@/utils/session'
import { cn } from '@/lib/utils'
import { CollectionViewToggle } from '../kanban/BoardListToggle'
import { CollectionOpsBar } from '../collection/CollectionOpsBar'

const PRIORITIES: SessionPriority[] = ['urgent', 'high', 'medium', 'low', 'none']

/**
 * Sessions collection table host.
 * B2: OpsBar (filters + Display) + dense filtered/sorted rows.
 * Full virtualized grid / inline edits land in B3.
 */
export function SessionTableHost() {
  const { t } = useTranslation()
  const { navigate } = useNavigation()
  const { activeWorkspaceId, sessionStatuses = [], projects = [], labels = [] } = useAppShellContext()
  const metaMap = useAtomValue(sessionMetaMapAtom)
  const [display] = useAtom(collectionDisplayAtom)
  const setDisplay = useSetAtom(setCollectionDisplayAtom)
  const loadDisplay = useSetAtom(loadCollectionDisplayAtom)

  const [filters, setFilters] = React.useState<CollectionFilters>(() => ({
    ...DEFAULT_COLLECTION_FILTERS,
  }))

  // Load + subscribe CollectionDisplay for the active workspace.
  React.useEffect(() => {
    void loadDisplay(activeWorkspaceId)
  }, [activeWorkspaceId, loadDisplay])

  React.useEffect(() => {
    if (!activeWorkspaceId || typeof window === 'undefined') return
    const api = window.electronAPI
    if (!api?.onCollectionDisplayChanged) return
    return api.onCollectionDisplayChanged((workspaceId, next) => {
      if (workspaceId !== activeWorkspaceId) return
      // External / multi-window update — apply without re-persisting.
      void setDisplay({ ...next, visibleProperties: [...next.visibleProperties] })
    })
  }, [activeWorkspaceId, setDisplay])

  const handleDisplayChange = React.useCallback(
    (next: CollectionDisplay) => {
      void setDisplay(next)
    },
    [setDisplay],
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
    return list
  }, [metaMap, filters, display.showCompleted, display.orderBy, display.orderDir])

  const statusById = React.useMemo(() => {
    const map = new Map<string, SessionStatus>()
    for (const s of sessionStatuses) map.set(s.id, s)
    return map
  }, [sessionStatuses])

  const projectNameById = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) {
      map.set(p.id, p.name)
    }
    return map
  }, [projects])

  const showStatus = display.visibleProperties.includes('status')
  const showPriority = display.visibleProperties.includes('priority')
  const showDue = display.visibleProperties.includes('dueDate')
  const showProject = display.visibleProperties.includes('project')
  const showFlag = display.visibleProperties.includes('flag')

  const openSession = (sessionId: string) => {
    navigate(routes.view.allSessions(sessionId))
  }

  const projectOptions = React.useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects],
  )
  const labelOptions = React.useMemo(
    () => (labels ?? []).map((l) => ({ id: l.id, name: l.name })),
    [labels],
  )

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-sm font-medium">{t('collection.table.title')}</span>
          <span className="text-xs text-muted-foreground">
            {t('collection.ops.count', { count: rows.length })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CollectionViewToggle
            value="table"
            onChange={(view) => {
              if (view === 'list') navigate(routes.view.allSessions())
              if (view === 'board') navigate(routes.view.board())
            }}
          />
        </div>
      </div>

      <CollectionOpsBar
        display={display}
        filters={filters}
        onDisplayChange={handleDisplayChange}
        onFiltersChange={setFilters}
        statuses={sessionStatuses}
        priorities={PRIORITIES}
        projects={projectOptions}
        labels={labelOptions}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center px-4 text-sm text-muted-foreground">
            {t('collection.table.empty')}
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
              <tr className="border-b border-border/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">{t('collection.table.column.title')}</th>
                {showStatus && (
                  <th className="w-[8.5rem] px-2 py-2 font-medium">{t('collection.table.column.status')}</th>
                )}
                {showPriority && (
                  <th className="w-[6.5rem] px-2 py-2 font-medium">{t('collection.table.column.priority')}</th>
                )}
                {showDue && (
                  <th className="w-[7rem] px-2 py-2 font-medium">{t('collection.table.column.due')}</th>
                )}
                {showProject && (
                  <th className="w-[8rem] px-2 py-2 font-medium">{t('collection.table.column.project')}</th>
                )}
                {showFlag && (
                  <th className="w-10 px-2 py-2 font-medium">{t('collection.table.column.flag')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((meta) => {
                const statusId = meta.sessionStatus ?? 'todo'
                const status = statusById.get(statusId)
                const statusLabel = status
                  ? resolveStatusDisplayLabel(status, t)
                  : statusId
                const priority = meta.priority ?? 'none'
                const dueLabel = formatDue(meta.dueDate, t)
                const projectLabel = meta.projectId
                  ? projectNameById.get(meta.projectId) ?? meta.projectId
                  : '—'

                return (
                  <tr
                    key={meta.id}
                    className="cursor-pointer border-b border-border/30 transition-colors hover:bg-foreground/[0.03]"
                    onClick={() => openSession(meta.id)}
                  >
                    <td className="max-w-0 truncate px-4 py-1.5 font-medium text-foreground">
                      {getSessionTitle(meta)}
                    </td>
                    {showStatus && (
                      <td className="px-2 py-1.5">
                        <span
                          className="inline-flex max-w-full truncate rounded-md bg-foreground/[0.05] px-1.5 py-0.5 text-[11px] text-foreground/80"
                          style={status?.resolvedColor ? { color: status.resolvedColor } : undefined}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    )}
                    {showPriority && (
                      <td className="px-2 py-1.5">
                        <span
                          className={cn(
                            'inline-flex rounded-md px-1.5 py-0.5 text-[11px]',
                            priorityTone(priority),
                          )}
                        >
                          {t(`priority.${priority}`)}
                        </span>
                      </td>
                    )}
                    {showDue && (
                      <td
                        className={cn(
                          'px-2 py-1.5 text-xs tabular-nums text-muted-foreground',
                          dueLabel.overdue && 'font-medium text-destructive',
                        )}
                      >
                        {dueLabel.text}
                      </td>
                    )}
                    {showProject && (
                      <td className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                        {projectLabel}
                      </td>
                    )}
                    {showFlag && (
                      <td className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                        {meta.isFlagged ? '★' : ''}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function priorityTone(priority: SessionPriority): string {
  switch (priority) {
    case 'urgent':
      return 'bg-destructive/15 text-destructive'
    case 'high':
      return 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
    case 'medium':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
    case 'low':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-400'
    default:
      return 'bg-foreground/[0.04] text-muted-foreground'
  }
}

function formatDue(
  dueDate: number | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
): { text: string; overdue: boolean } {
  if (dueDate == null || !Number.isFinite(dueDate)) {
    return { text: '—', overdue: false }
  }
  const d = new Date(dueDate)
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const overdue = dueDate < start
  const text = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return { text: overdue ? t('collection.table.dueOverdue', { date: text }) : text, overdue }
}
