/**
 * SurfaceTabs (W1 unified shell, spec S-02 §3.3/§3.5) — tab strip over the
 * panel-stack area. Derives tabs from the existing panel-stack atoms
 * (read-only consumption: the URL/NavigationContext remains the single source
 * of truth; no forked persistence). Focus/close delegate to the existing
 * stack ops (`focusedPanelIdAtom` / `closePanelAtom`), which NavigationContext
 * syncs back to the URL.
 *
 * Kind mapping lives in `surface-tab-model.ts`: session/browser map onto real
 * SurfaceTab kinds; legacy navigator panels (source/settings/skills/other)
 * degrade to labelled tabs until wave M3.
 *
 * Mounted by `UnifiedShellLayout` (platform/index.tsx) — rendered only when
 * `featureUnifiedShellAtom` is ON.
 */
import { useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { DatabaseZap, Globe, MessageSquare, PanelTop, Settings, X, Zap, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  closePanelAtom,
  focusedPanelIdAtom,
  panelStackAtom,
  type PanelType,
} from '@/atoms/panel-stack'
import { sessionMetaMapAtom } from '@/atoms/sessions'
import { cn } from '@/lib/utils'
import { getSessionTitle } from '@/utils/session'
import {
  buildSurfaceTabViews,
  type SurfaceTabView,
} from './surface-tab-model'

const TAB_STRIP_HEIGHT = 36

function tabIcon(tab: SurfaceTabView): LucideIcon {
  if (tab.kind === 'browser') return Globe
  switch (tab.panelType) {
    case 'session':
      return MessageSquare
    case 'source':
      return DatabaseZap
    case 'settings':
      return Settings
    case 'skills':
      return Zap
    default:
      return PanelTop
  }
}

function SurfaceTabItem({ tab }: { tab: SurfaceTabView }) {
  const { t } = useTranslation()
  const setFocusedPanelId = useSetAtom(focusedPanelIdAtom)
  const closePanel = useSetAtom(closePanelAtom)
  const Icon = tabIcon(tab)

  return (
    <div
      role="tab"
      aria-selected={tab.focused}
      tabIndex={0}
      title={tab.title}
      onClick={() => setFocusedPanelId(tab.panelId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setFocusedPanelId(tab.panelId)
        }
      }}
      onAuxClick={(e) => {
        // Middle-click closes, matching browser tab conventions.
        if (e.button === 1) {
          e.preventDefault()
          closePanel(tab.panelId)
        }
      }}
      className={cn(
        'group flex h-7 max-w-[220px] min-w-0 shrink-0 cursor-default items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] transition-colors',
        tab.focused
          ? 'bg-background text-foreground shadow-minimal'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{tab.title}</span>
      <button
        type="button"
        aria-label={t('surfaceTabs.closeTab')}
        onClick={(e) => {
          e.stopPropagation()
          closePanel(tab.panelId)
        }}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] transition-all hover:bg-foreground/10',
          tab.focused ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60',
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

export function SurfaceTabs() {
  const { t } = useTranslation()
  const entries = useAtomValue(panelStackAtom)
  const focusedPanelId = useAtomValue(focusedPanelIdAtom)
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)

  const resolveSessionTitle = useCallback(
    (sessionId: string) => {
      const meta = sessionMetaMap.get(sessionId)
      return meta ? getSessionTitle(meta) : null
    },
    [sessionMetaMap],
  )

  const tabs = buildSurfaceTabViews({
    entries,
    focusedPanelId,
    resolveSessionTitle,
    labels: {
      untitled: t('surfaceTabs.untitled'),
      browser: t('surfaceTabs.browser'),
      panel: t('surfaceTabs.panel'),
      source: t('surfaceTabs.source'),
      settings: t('surfaceTabs.settings'),
      skills: t('surfaceTabs.skills'),
    },
  })

  return (
    <div
      role="tablist"
      className="flex shrink-0 items-center gap-1 overflow-x-auto px-2"
      style={{ height: TAB_STRIP_HEIGHT }}
    >
      {tabs.length === 0 ? (
        <span className="px-1 text-[12px] text-muted-foreground/50">{t('surfaceTabs.empty')}</span>
      ) : (
        tabs.map((tab) => <SurfaceTabItem key={tab.panelId} tab={tab} />)
      )}
    </div>
  )
}
