/**
 * Pluggable mind-map engine contract (SVG v1).
 * Spec: docs/superpowers/specs/2026-08-08-entity-mindmap-views-design.md
 */

import type {
  MindMapGraph,
  MindMapLayout,
  MindMapNodeId,
  MindMapNodeSource,
} from '@craft-agent/core/mindmap'

export type MindMapEngineMode = 'map' | 'outline' | 'split'

export interface MindMapEngineProps {
  graph: MindMapGraph
  layout: MindMapLayout | 'auto'
  mode?: MindMapEngineMode
  zen?: boolean
  /** true for live graphs — no structural edits / reparent */
  readOnlyStructure?: boolean
  selectedId?: MindMapNodeId | null
  /** Label search — non-matches are dimmed, not removed */
  searchQuery?: string
  /** Host-owned collapse set (merged into autoLayout) */
  collapsed?: ReadonlySet<MindMapNodeId> | readonly MindMapNodeId[]
  className?: string
  onLayoutChange?: (layout: MindMapLayout) => void
  onGraphChange?: (graph: MindMapGraph) => void
  onNavigate?: (source: MindMapNodeSource) => void
  onSelect?: (nodeId: MindMapNodeId | null) => void
  onToggleCollapse?: (nodeId: MindMapNodeId) => void
}

export interface MindMapEngineHandle {
  update(props: Partial<MindMapEngineProps>): void
  destroy(): void
  fitView(): void
  getViewport?(): { x: number; y: number; zoom: number }
}

/**
 * Factory-style engine port. SVG v1 is a React view; future adapters may
 * mount imperatively and return a handle.
 */
export interface MindMapEngine {
  mount(el: HTMLElement, props: MindMapEngineProps): MindMapEngineHandle
}

/** Chip size used for edge anchors / fit padding. */
export const MIND_MAP_NODE_WIDTH = 172
export const MIND_MAP_NODE_HEIGHT = 36
export const MIND_MAP_MINIMAP_THRESHOLD = 12

/** @deprecated prefer MIND_MAP_NODE_WIDTH */
export const NODE_WIDTH = MIND_MAP_NODE_WIDTH
/** @deprecated prefer MIND_MAP_NODE_HEIGHT */
export const NODE_HEIGHT = MIND_MAP_NODE_HEIGHT

export type LayoutBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

/** Bounding box of laid-out node centers, expanded by half chip + pad. */
export function computeLayoutBounds(
  layout: MindMapLayout,
  pad = 0,
  nodeW = MIND_MAP_NODE_WIDTH,
  nodeH = MIND_MAP_NODE_HEIGHT,
): LayoutBounds {
  const pts = Object.values(layout.positions)
  if (pts.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const hx = nodeW / 2
  const hy = nodeH / 2
  for (const p of pts) {
    if (!p) continue
    // autoLayout places center-ish points; expand by half chip
    if (p.x - hx < minX) minX = p.x - hx
    if (p.y - hy < minY) minY = p.y - hy
    if (p.x + hx > maxX) maxX = p.x + hx
    if (p.y + hy > maxY) maxY = p.y + hy
  }
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}
