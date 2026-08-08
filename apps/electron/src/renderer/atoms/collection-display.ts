/**
 * Workspace-scoped CollectionDisplay atom + load/persist helpers.
 *
 * Display prefs live in `{workspace}/collection/display.json` via RPC
 * (getCollectionDisplay / setCollectionDisplay / onCollectionDisplayChanged).
 * Filters stay local to the host (list/table) for B2; full viewFilters
 * migration lands later.
 */

import { atom } from 'jotai'
import {
  DEFAULT_COLLECTION_DISPLAY,
  type CollectionDisplay,
} from '@craft-agent/shared/sessions'
import { windowWorkspaceIdAtom } from './sessions'

function cloneDisplay(display: CollectionDisplay = DEFAULT_COLLECTION_DISPLAY): CollectionDisplay {
  return {
    ...display,
    visibleProperties: [...display.visibleProperties],
  }
}

/** Current workspace CollectionDisplay (defaults until loaded). */
export const collectionDisplayAtom = atom<CollectionDisplay>(cloneDisplay())

/** True while a workspace display load is in flight. */
export const collectionDisplayLoadingAtom = atom(false)

/**
 * Replace local display state. Prefer `setCollectionDisplayAtom` when the
 * change should persist to the workspace file.
 */
export const replaceCollectionDisplayAtom = atom(
  null,
  (_get, set, display: CollectionDisplay) => {
    set(collectionDisplayAtom, cloneDisplay(display))
  },
)

/**
 * Optimistically update local display and persist via RPC for the active
 * workspace. Returns the normalized server payload when save succeeds.
 */
export const setCollectionDisplayAtom = atom(
  null,
  async (get, set, patch: Partial<CollectionDisplay> | CollectionDisplay): Promise<CollectionDisplay> => {
    const workspaceId = get(windowWorkspaceIdAtom)
    const prev = get(collectionDisplayAtom)
    const next: CollectionDisplay = {
      ...prev,
      ...patch,
      version: 1,
      visibleProperties: patch.visibleProperties
        ? [...patch.visibleProperties]
        : [...prev.visibleProperties],
    }
    set(collectionDisplayAtom, next)

    if (!workspaceId || typeof window === 'undefined' || !window.electronAPI?.setCollectionDisplay) {
      return next
    }

    try {
      const saved = await window.electronAPI.setCollectionDisplay(workspaceId, next)
      set(collectionDisplayAtom, cloneDisplay(saved))
      return saved
    } catch (err) {
      // Keep optimistic value; caller may toast. Reload on next workspace tick.
      console.warn('[collection-display] setCollectionDisplay failed', err)
      return next
    }
  },
)

/**
 * Load display for a workspace id (or active window workspace).
 * No-ops when id is null.
 */
export const loadCollectionDisplayAtom = atom(
  null,
  async (get, set, workspaceId?: string | null): Promise<CollectionDisplay> => {
    const id = workspaceId === undefined ? get(windowWorkspaceIdAtom) : workspaceId
    if (!id || typeof window === 'undefined' || !window.electronAPI?.getCollectionDisplay) {
      const fallback = cloneDisplay()
      set(collectionDisplayAtom, fallback)
      set(collectionDisplayLoadingAtom, false)
      return fallback
    }

    set(collectionDisplayLoadingAtom, true)
    try {
      const loaded = await window.electronAPI.getCollectionDisplay(id)
      // Ignore stale responses after a workspace switch.
      if (get(windowWorkspaceIdAtom) === id) {
        const next = cloneDisplay(loaded)
        set(collectionDisplayAtom, next)
        return next
      }
      return get(collectionDisplayAtom)
    } catch (err) {
      console.warn('[collection-display] getCollectionDisplay failed', err)
      const fallback = cloneDisplay()
      if (get(windowWorkspaceIdAtom) === id) {
        set(collectionDisplayAtom, fallback)
      }
      return fallback
    } finally {
      if (get(windowWorkspaceIdAtom) === id) {
        set(collectionDisplayLoadingAtom, false)
      }
    }
  },
)
