/**
 * Custom workspace icon-rail links (user-configurable shortcuts).
 * Stored in localStorage, workspace-scoped.
 */

import * as storage from '@/lib/local-storage'

export type RailLinkKind = 'knowledge' | 'notes' | 'external'

export interface RailLink {
  id: string
  label: string
  kind: RailLinkKind
  /** External URL (kind=external) or optional notes folder path hint (kind=notes) */
  target?: string
}

const MAX_LINKS = 12

function newId(): string {
  return `rl_${Math.random().toString(36).slice(2, 10)}`
}

export function loadRailLinks(workspaceId: string | null | undefined): RailLink[] {
  if (!workspaceId) return []
  const raw = storage.get<RailLink[]>(storage.KEYS.workspaceRailLinks, [], workspaceId)
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is RailLink =>
      !!item
      && typeof item === 'object'
      && typeof item.id === 'string'
      && typeof item.label === 'string'
      && (item.kind === 'knowledge' || item.kind === 'notes' || item.kind === 'external'),
    )
    .slice(0, MAX_LINKS)
}

export function saveRailLinks(workspaceId: string, links: RailLink[]): void {
  storage.set(storage.KEYS.workspaceRailLinks, links.slice(0, MAX_LINKS), workspaceId)
}

export function createRailLink(input: Omit<RailLink, 'id'> & { id?: string }): RailLink {
  return {
    id: input.id ?? newId(),
    label: input.label.trim() || 'Link',
    kind: input.kind,
    target: input.target?.trim() || undefined,
  }
}
