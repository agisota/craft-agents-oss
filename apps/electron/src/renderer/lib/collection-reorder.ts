/**
 * B5 LexoRank reorder helpers for collection views.
 */

import type { SessionMeta } from '@/atoms/sessions'
import type { CollectionOrderBy, CollectionOrderDir } from '@craft-agent/shared/sessions'

export interface RankNeighbors {
  prevId?: string
  nextId?: string
}

/**
 * Given the visible ordered list of sibling sessions in a bucket/column/view,
 * compute prev/next ids for a card dropped between beforeIndex and beforeIndex+1.
 * - `list` must already be sorted by rank asc for orderBy=rank.
 * - 0 <= beforeIndex <= list.length (list.length = append to end).
 */
export function rankNeighborsForDrop(list: SessionMeta[], beforeIndex: number): RankNeighbors {
  const clamped = Math.max(0, Math.min(beforeIndex, list.length))
  const prev = clamped > 0 ? list[clamped - 1] : undefined
  const next = clamped < list.length ? list[clamped] : undefined
  return { prevId: prev?.id, nextId: next?.id }
}

/**
 * Invoke reorderRank with a single stale-retry. Renderer handles refresh of the
 * meta map between attempts when required.
 */
export async function reorderRankWithRetry(
  sessionId: string,
  prevId: string | undefined,
  nextId: string | undefined,
): Promise<void> {
  try {
    await window.electronAPI.sessionCommand(sessionId, { type: 'reorderRank', prevId, nextId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/RANK_NEIGHBORS_STALE/.test(msg)) throw e
    // Single retry — server recomputes from current sessions map (it may already have
    // refreshed through metadata events); worst case it throws again and UI reverts.
    await window.electronAPI.sessionCommand(sessionId, { type: 'reorderRank', prevId, nextId })
  }
}
