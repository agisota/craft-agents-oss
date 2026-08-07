/**
 * Unified Shell (W1) — feature flag + chrome state atoms.
 *
 * Single gate: `featureUnifiedShellAtom` (localStorage `craft-feature-unified-shell`,
 * default OFF). When OFF, AppShell renders zero unified-shell chrome — use this
 * atom as the runtime switch: writing it from any component/devtools flips the
 * chrome live (`atomWithStorage` persists + re-renders subscribers).
 *
 * Chrome state mirrors the sidebarVisible pattern (`AppShell.tsx`): rail collapse,
 * inspector visibility and the active inspector section persist to localStorage
 * and restore across restarts. All keys are contract fields in
 * `lib/local-storage.ts` (KEYS.*, W1 block).
 */
import { atomWithStorage } from 'jotai/utils'
import { KEYS, getKeyString } from '@/lib/local-storage'

/** Wave flag: unified shell chrome (ActivityRail + SurfaceTabs + InspectorHost). */
export const featureUnifiedShellAtom = atomWithStorage<boolean>(
  getKeyString(KEYS.featureUnifiedShell),
  false,
  undefined,
  { getOnInit: true },
)

/** Activity rail collapsed (destinations hidden, expand chevron stays). */
export const activityRailCollapsedAtom = atomWithStorage<boolean>(
  getKeyString(KEYS.activityRailCollapsed),
  false,
  undefined,
  { getOnInit: true },
)

/** Inspector panel visibility (the 48px section rail itself always renders). */
export const inspectorVisibleAtom = atomWithStorage<boolean>(
  getKeyString(KEYS.inspectorVisible),
  false,
  undefined,
  { getOnInit: true },
)

/** Inspector sections shipped in W1; `info` is live, the rest are stub sections. */
export type InspectorSectionId = 'info' | 'agent' | 'outline' | 'backlinks'

/** Active inspector section (persisted; validated on read by `inspector-model.ts`). */
export const inspectorSectionAtom = atomWithStorage<InspectorSectionId>(
  getKeyString(KEYS.inspectorSection),
  'info',
  undefined,
  { getOnInit: true },
)
