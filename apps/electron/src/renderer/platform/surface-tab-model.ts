/**
 * SurfaceTabs model (W1) — pure derivation of the unified tab strip from the
 * existing panel stack. Read-only consumption of `atoms/panel-stack.ts`:
 * no forked persistence, no second source of truth (URL/NavigationContext
 * stays authoritative). Kind mapping follows S-02 §3.5: `session` and
 * `browser` map onto real SurfaceTab kinds; legacy navigator panels
 * (`source`/`settings`/`skills`/`other`) degrade to `null` kind and are
 * rendered as plain labelled tabs until wave M3.
 */
import type { SurfaceTabKind } from '@craft-agent/core'
import {
  getPanelTypeFromRoute,
  parseSessionIdFromRoute,
  type PanelStackEntry,
  type PanelType,
} from '@/atoms/panel-stack'

/** PanelType (`panel-stack.ts:16`) → SurfaceTab kind; null = legacy degradation. */
export function panelTypeToSurfaceKind(panelType: PanelType): SurfaceTabKind | null {
  switch (panelType) {
    case 'session':
      return 'session'
    case 'browser':
      return 'browser'
    // sources/settings/skills/other stay legacy navigator views (S-02 §3.5, M3).
    default:
      return null
  }
}

export interface SurfaceTabView {
  panelId: string
  /** Mapped surface kind; null for degraded legacy navigator panels. */
  kind: SurfaceTabKind | null
  panelType: PanelType
  title: string
  focused: boolean
  /** Session id when derivable from the route (dedup/focus semantics live in panel-stack). */
  sessionId: string | null
}

export interface SurfaceTabLabels {
  untitled: string
  browser: string
  panel: string
  source: string
  settings: string
  skills: string
}

export interface BuildSurfaceTabViewsInput {
  entries: PanelStackEntry[]
  focusedPanelId: string | null
  /** Resolve a session title by id; return null when unknown. */
  resolveSessionTitle: (sessionId: string) => string | null
  labels: SurfaceTabLabels
}

function legacyPanelTitle(panelType: PanelType, labels: SurfaceTabLabels): string {
  switch (panelType) {
    case 'source':
      return labels.source
    case 'settings':
      return labels.settings
    case 'skills':
      return labels.skills
    default:
      return labels.panel
  }
}

export function buildSurfaceTabViews(input: BuildSurfaceTabViewsInput): SurfaceTabView[] {
  const { entries, focusedPanelId, resolveSessionTitle, labels } = input
  return entries.map((entry) => {
    // Compute from the live route rather than the stamped `entry.panelType`
    // so route updates (updateFocusedPanelRouteAtom) stay reflected.
    const panelType = getPanelTypeFromRoute(entry.route)
    const kind = panelTypeToSurfaceKind(panelType)
    const sessionId = panelType === 'session' ? parseSessionIdFromRoute(entry.route) : null
    let title: string
    if (sessionId !== null) {
      title = resolveSessionTitle(sessionId) ?? labels.untitled
    } else if (kind === 'browser') {
      title = labels.browser
    } else {
      title = legacyPanelTitle(panelType, labels)
    }
    return {
      panelId: entry.id,
      kind,
      panelType,
      title,
      focused: entry.id === focusedPanelId,
      sessionId,
    }
  })
}
