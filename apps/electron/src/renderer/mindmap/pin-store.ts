/**
 * Browser localStorage pin persistence for mind maps.
 * No IPC / entity writeback — host-only chrome state.
 */

import {
  entityPinKey,
  parsePinnedMap,
  serializePinnedMap,
  type MindMapEntityRef,
  type PinnedMap,
} from '@craft-agent/core/mindmap'

export function pinStorageKey(entity: MindMapEntityRef): string {
  return `craft-mindmap-pin:${entityPinKey(entity)}`
}

export function loadPin(entity: MindMapEntityRef): PinnedMap | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(pinStorageKey(entity))
    if (raw == null || raw.trim() === '') return null
    return parsePinnedMap(raw)
  } catch {
    return null
  }
}

export function savePin(pin: PinnedMap): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(pinStorageKey(pin.entity), serializePinnedMap(pin))
  } catch {
    // Quota / private mode — pin is best-effort chrome state
  }
}

export function clearPin(entity: MindMapEntityRef): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(pinStorageKey(entity))
  } catch {
    // ignore
  }
}
