import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Archive, Flag, Trash2, X } from 'lucide-react'
import type { SessionPriority } from '@craft-agent/shared/protocol/dto'
import {
  useIsMultiSelectActive,
  useSelectedIds,
  useSelectionCount,
  useSessionSelectionStore,
} from '@/hooks/useSession'
import { sessionSelection } from '@/hooks/useEntitySelection'
import type { SessionStatus } from '@/config/session-status-config'
import type { SessionStatusId } from '@/config/session-status-config'
import { cn } from '@/lib/utils'

export interface CollectionBulkBarProps {
  workspaceId: string | null | undefined
  statuses?: SessionStatus[]
  projects?: Array<{ id: string; name: string }>
  labels?: Array<{ id: string; name: string }>
  className?: string
}

const STATUSES_QUICK: SessionStatusId[] = ['todo', 'in-progress', 'needs-review', 'done', 'cancelled']
const PRIORITIES: SessionPriority[] = ['none', 'urgent', 'high', 'medium', 'low']

/**
 * Floating bulk actions for sessions multi-select.
 * Calls electronAPI.bulkUpdateSessions; per-id failures toast.
 */
export function CollectionBulkBar({
  workspaceId,
  statuses = [],
  projects = [],
  labels = [],
  className,
}: CollectionBulkBarProps) {
  const { t } = useTranslation()
  const active = useIsMultiSelectActive()
  const selectedIds = useSelectedIds()
  const count = useSelectionCount()
  const { clearSelection } = sessionSelection
  const selectionStore = useSessionSelectionStore()
  const [busy, setBusy] = React.useState(false)

  // EC selection clear on Escape
  React.useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, clearSelection])

  const apply = React.useCallback(
    async (patch: import('@craft-agent/shared/protocol/dto').BulkUpdateSessionsPatch) => {
      if (!workspaceId || selectedIds.size === 0) return
      setBusy(true)
      try {
        const res = await window.electronAPI.bulkUpdateSessions({
          workspaceId,
          ids: [...selectedIds],
          patch,
        })
        if (res.failed.length > 0) {
          toast.error(t('collection.bulk.partial', { count: res.failed.length }))
        } else {
          toast.success(t('collection.bulk.applied', { count: res.ok.length }))
        }
        selectionStore.setState({ selected: null, selectedIds: new Set(), anchors: [] })
      } catch (e) {
        toast.error(t('collection.bulk.failed', { message: e instanceof Error ? e.message : String(e) }))
      } finally {
        setBusy(false)
      }
    },
    [workspaceId, selectedIds, selectionStore, t],
  )

  if (!active || !workspaceId) return null

  const statusOptions = statuses.length > 0 ? statuses.map((s) => s.id) : STATUSES_QUICK

  return (
    <div
      className={cn(
        'pointer-events-auto fixed inset-x-0 bottom-6 z-50 flex justify-center',
        className,
      )}
      role="toolbar"
      aria-label={t('collection.bulk.title')}
    >
      <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
        <span className="text-xs font-semibold text-foreground/90">
          {t('collection.bulk.selected', { count })}
        </span>

        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          defaultValue=""
          disabled={busy}
          onChange={(e) => {
            const v = e.target.value as SessionStatusId
            e.target.value = ''
            if (v) void apply({ sessionStatus: v })
          }}
        >
          <option value="" disabled>
            {t('collection.bulk.setStatus')}
          </option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {t(`kanban.column.${s}`, { defaultValue: s })}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          defaultValue=""
          disabled={busy}
          onChange={(e) => {
            const v = e.target.value as SessionPriority
            e.target.value = ''
            if (!v) return
            void apply({ priority: v })
          }}
        >
          <option value="" disabled>
            {t('collection.bulk.setPriority')}
          </option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t(`priority.${p}`)}
            </option>
          ))}
        </select>

        {projects.length > 0 && (
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            defaultValue=""
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value
              e.target.value = ''
              void apply({ projectId: v === '' ? null : v })
            }}
          >
            <option value="" disabled>
              {t('collection.bulk.setProject')}
            </option>
            <option value="">{t('collection.bulk.noProject')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void apply({ isFlagged: true })}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground/80 hover:bg-foreground/[0.03]"
        >
          <Flag className="h-3.5 w-3.5" /> {t('collection.bulk.flag')}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void apply({ isFlagged: false })}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground/80 hover:bg-foreground/[0.03]"
        >
          {t('collection.bulk.unflag')}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t('collection.bulk.confirmArchive', { count }))) {
              void apply({ isArchived: true })
            }
          }}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground/80 hover:bg-foreground/[0.03]"
        >
          <Archive className="h-3.5 w-3.5" /> {t('collection.bulk.archive')}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => clearSelection()}
          aria-label={t('collection.bulk.clear')}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> {t('collection.bulk.clear')}
        </button>
      </div>
    </div>
  )
}
