/**
 * Session multi-view tabs: Standard | Graph | Mind map | Team chat.
 * Graph/mindmap host SiYuan knowledge surfaces; team chat stays placeholder.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { GitBranch, MessageSquare, Network, Share2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as storage from '@/lib/local-storage'

export type SessionViewId = 'standard' | 'graph' | 'mindmap' | 'teamchat'

const VIEWS: Array<{
  id: SessionViewId
  labelKey: string
  icon: LucideIcon
  available: boolean
}> = [
  { id: 'standard', labelKey: 'sessionView.standard', icon: MessageSquare, available: true },
  { id: 'graph', labelKey: 'sessionView.graph', icon: Share2, available: true },
  { id: 'mindmap', labelKey: 'sessionView.mindmap', icon: Network, available: true },
  { id: 'teamchat', labelKey: 'sessionView.teamChat', icon: GitBranch, available: false },
]

function storageKey(sessionId: string): string {
  return sessionId
}

export function useSessionView(sessionId: string): [SessionViewId, (id: SessionViewId) => void] {
  const [view, setViewState] = React.useState<SessionViewId>(() => {
    const saved = storage.get<SessionViewId>(storage.KEYS.sessionViewMode, 'standard', storageKey(sessionId))
    return VIEWS.some((v) => v.id === saved && v.available) ? saved : 'standard'
  })

  React.useEffect(() => {
    const saved = storage.get<SessionViewId>(storage.KEYS.sessionViewMode, 'standard', storageKey(sessionId))
    setViewState(VIEWS.some((v) => v.id === saved && v.available) ? saved : 'standard')
  }, [sessionId])

  const setView = React.useCallback((id: SessionViewId) => {
    setViewState(id)
    storage.set(storage.KEYS.sessionViewMode, id, storageKey(sessionId))
  }, [sessionId])

  return [view, setView]
}

export interface SessionViewTabsProps {
  value: SessionViewId
  onChange: (id: SessionViewId) => void
  className?: string
}

export function SessionViewTabs({ value, onChange, className }: SessionViewTabsProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 px-3 py-1.5 border-b border-border/40 bg-background/40 shrink-0',
        className,
      )}
      role="tablist"
      aria-label={t('sessionView.tabsLabel')}
    >
      {VIEWS.map(({ id, labelKey, icon: Icon, available }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[8px] text-xs font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
              !available && !active && 'opacity-80',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{t(labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}

export interface SessionViewPlaceholderProps {
  view: SessionViewId
}

export function SessionViewPlaceholder({ view }: SessionViewPlaceholderProps) {
  const { t } = useTranslation()
  const meta = VIEWS.find((v) => v.id === view)
  const Icon = meta?.icon ?? Network

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center min-h-0">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5 text-muted-foreground">
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {meta ? t(meta.labelKey) : t('sessionView.standard')}
        </p>
        <p className="text-sm text-muted-foreground">{t('sessionView.comingSoon')}</p>
      </div>
    </div>
  )
}
