/**
 * Unified shell platform hosts (W1) — barrel + the `UnifiedShellLayout`
 * gate. Spec: S-03 (rails/inspector), S-02 (surface tabs), S-09 §3.1 (W1
 * scope, wave flag).
 *
 * Mount contract (AppShell): wrap the existing `PanelStackContainer` JSX with
 * `UnifiedShellLayout`. When `featureUnifiedShellAtom` is OFF the wrapper
 * renders children unchanged — zero behavioral delta. When ON it mounts:
 *   [ActivityRail] [SurfaceTabs over PanelStackContainer] [InspectorHost]
 * in the shell row (ActivityRail left of the LeftSidebar slot, InspectorHost
 * at the right edge).
 */
import type { ReactNode } from 'react'
import { useAtomValue } from 'jotai'
import { featureUnifiedShellAtom } from '@/atoms/unified-shell'
import { ActivityRail } from './ActivityRail'
import { InspectorHost } from './InspectorHost'
import { SurfaceTabs } from './SurfaceTabs'

export { ActivityRail, ACTIVITY_RAIL_WIDTH, ACTIVITY_RAIL_COLLAPSED_WIDTH } from './ActivityRail'
export { SurfaceTabs } from './SurfaceTabs'
export { InspectorHost } from './InspectorHost'

export function UnifiedShellLayout({ children }: { children: ReactNode }) {
  const enabled = useAtomValue(featureUnifiedShellAtom)
  if (!enabled) return <>{children}</>
  return (
    <>
      <ActivityRail />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SurfaceTabs />
        {children}
      </div>
      <InspectorHost />
    </>
  )
}
