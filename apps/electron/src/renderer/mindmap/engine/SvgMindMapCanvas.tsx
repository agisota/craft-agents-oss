/**
 * React SVG mind-map canvas: pan/zoom, collapse, selection, minimap.
 */

import * as React from 'react'
import {
  autoLayout,
  layoutBounds,
  type MindMapGraph,
  type MindMapLayout,
  type MindMapNodeId,
  type MindMapNodeSource,
} from '@craft-agent/core/mindmap'
import { cn } from '@/lib/utils'
import { NODE_HEIGHT, NODE_WIDTH } from './types'
import { MindMapMinimap } from './Minimap'

export interface SvgMindMapCanvasProps {
  graph: MindMapGraph
  layout?: MindMapLayout | 'auto'
  searchQuery?: string
  selectedId?: MindMapNodeId | null
  className?: string
  onSelect?: (id: MindMapNodeId | null) => void
  onNavigate?: (source: MindMapNodeSource) => void
  onToggleCollapse?: (id: MindMapNodeId) => void
  onLayoutChange?: (layout: MindMapLayout) => void
}

function edgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

export function SvgMindMapCanvas({
  graph,
  layout: layoutProp = 'auto',
  searchQuery = '',
  selectedId = null,
  className,
  onSelect,
  onNavigate,
  onToggleCollapse,
  onLayoutChange,
}: SvgMindMapCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState({ w: 800, h: 600 })
  const [viewport, setViewport] = React.useState({ x: 0, y: 0, zoom: 1 })
  const [collapsed, setCollapsed] = React.useState<Set<MindMapNodeId>>(() => new Set())
  const dragRef = React.useRef<{
    mode: 'pan' | null
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  // Measure container
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize({ w: Math.max(1, cr.width), h: Math.max(1, cr.height) })
    })
    ro.observe(el)
    setSize({ w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) })
    return () => ro.disconnect()
  }, [])

  const layout = React.useMemo((): MindMapLayout => {
    if (layoutProp !== 'auto' && layoutProp) {
      // merge interactive collapsed
      const mergedCollapsed = [...new Set([...(layoutProp.collapsed ?? []), ...collapsed])]
      if (mergedCollapsed.length === (layoutProp.collapsed?.length ?? 0) && collapsed.size === 0) {
        return layoutProp
      }
      return autoLayout(graph, { collapsed: mergedCollapsed })
    }
    return autoLayout(graph, { collapsed: [...collapsed] })
  }, [graph, layoutProp, collapsed])

  React.useEffect(() => {
    onLayoutChange?.(layout)
  }, [layout, onLayoutChange])

  const q = searchQuery.trim().toLowerCase()
  const matches = React.useMemo(() => {
    if (!q) return null
    const set = new Set<MindMapNodeId>()
    for (const [id, node] of Object.entries(graph.nodes)) {
      if (node && node.label.toLowerCase().includes(q)) set.add(id)
    }
    return set
  }, [graph.nodes, q])

  const bounds = React.useMemo(() => layoutBounds(layout, 80), [layout])

  const fitView = React.useCallback(() => {
    if (bounds.width <= 0 || bounds.height <= 0) {
      setViewport({ x: 0, y: 0, zoom: 1 })
      return
    }
    const pad = 48
    const zx = (size.w - pad * 2) / Math.max(bounds.width, 1)
    const zy = (size.h - pad * 2) / Math.max(bounds.height, 1)
    const zoom = Math.max(0.2, Math.min(1.5, Math.min(zx, zy)))
    const cx = bounds.minX + bounds.width / 2
    const cy = bounds.minY + bounds.height / 2
    setViewport({
      zoom,
      x: size.w / 2 - cx * zoom,
      y: size.h / 2 - cy * zoom,
    })
  }, [bounds, size.h, size.w])

  // Fit when graph identity changes
  const graphKey = `${graph.contentHash}:${graph.rootId}`
  React.useEffect(() => {
    fitView()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit on graph change only
  }, [graphKey, size.w, size.h])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setViewport((v) => {
      const nextZoom = Math.max(0.15, Math.min(3, v.zoom * factor))
      const wx = (mx - v.x) / v.zoom
      const wy = (my - v.y) / v.zoom
      return {
        zoom: nextZoom,
        x: mx - wx * nextZoom,
        y: my - wy * nextZoom,
      }
    })
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as Element
    if (target.closest('[data-mindmap-node]')) return
    dragRef.current = {
      mode: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      origX: viewport.x,
      origY: viewport.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.mode !== 'pan') return
    setViewport((v) => ({
      ...v,
      x: d.origX + (e.clientX - d.startX),
      y: d.origY + (e.clientY - d.startY),
    }))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const toggleCollapse = (id: MindMapNodeId, e: React.MouseEvent) => {
    e.stopPropagation()
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    onToggleCollapse?.(id)
  }

  const parentEdges = graph.edges.filter((e) => e.kind === 'parent')
  const otherEdges = graph.edges.filter((e) => e.kind !== 'parent')

  const worldToScreen = (x: number, y: number) => ({
    x: x * viewport.zoom + viewport.x,
    y: y * viewport.zoom + viewport.y,
  })

  return (
    <div
      ref={containerRef}
      className={cn('relative flex-1 min-h-0 overflow-hidden bg-background touch-none', className)}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <svg width={size.w} height={size.h} className="absolute inset-0 block">
        <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
          {/* secondary edges */}
          {otherEdges.map((edge) => {
            const a = layout.positions[edge.from]
            const b = layout.positions[edge.to]
            if (!a || !b) return null
            const x1 = a.x + NODE_WIDTH
            const y1 = a.y
            const x2 = b.x
            const y2 = b.y
            return (
              <path
                key={edge.id}
                d={edgePath(x1, y1, x2, y2)}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.25}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                className="text-muted-foreground"
              />
            )
          })}
          {/* parent edges */}
          {parentEdges.map((edge) => {
            const a = layout.positions[edge.from]
            const b = layout.positions[edge.to]
            if (!a || !b) return null
            const x1 = a.x + NODE_WIDTH
            const y1 = a.y
            const x2 = b.x
            const y2 = b.y
            return (
              <path
                key={edge.id}
                d={edgePath(x1, y1, x2, y2)}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeWidth={1.75}
                className="text-foreground"
              />
            )
          })}

          {Object.entries(layout.positions).map(([id, pos]) => {
            const node = graph.nodes[id]
            if (!node || !pos) return null
            const selected = selectedId === id
            const dimmed = matches != null && !matches.has(id)
            const hasKids = node.children.length > 0
            const isCol = collapsed.has(id) || Boolean(node.collapsed)

            return (
              <g
                key={id}
                data-mindmap-node={id}
                transform={`translate(${pos.x},${pos.y - NODE_HEIGHT / 2})`}
                opacity={dimmed ? 0.28 : 1}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect?.(id)
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  if (node.source) onNavigate?.(node.source)
                }}
              >
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={10}
                  ry={10}
                  className={cn(
                    selected
                      ? 'fill-foreground/15 stroke-foreground/40'
                      : 'fill-card stroke-border/80',
                  )}
                  strokeWidth={1}
                />
                <text
                  x={12}
                  y={NODE_HEIGHT / 2 + 1}
                  dominantBaseline="middle"
                  className="fill-foreground text-[12px]"
                  style={{ fontSize: 12, fontFamily: 'inherit' }}
                >
                  {node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}
                </text>
                {hasKids ? (
                  <g
                    transform={`translate(${NODE_WIDTH - 18}, ${NODE_HEIGHT / 2})`}
                    onClick={(e) => toggleCollapse(id, e as unknown as React.MouseEvent)}
                  >
                    <circle r={8} className="fill-muted stroke-border" strokeWidth={1} />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-muted-foreground"
                      style={{ fontSize: 11, fontFamily: 'inherit' }}
                    >
                      {isCol ? '+' : '−'}
                    </text>
                  </g>
                ) : null}
              </g>
            )
          })}
        </g>
      </svg>

      <MindMapMinimap
        layout={layout}
        bounds={bounds}
        viewport={viewport}
        canvasSize={size}
        nodeCount={Object.keys(layout.positions).length}
        onPanTo={(wx, wy) => {
          setViewport((v) => ({
            ...v,
            x: size.w / 2 - wx * v.zoom,
            y: size.h / 2 - wy * v.zoom,
          }))
        }}
      />

      {/* expose fit via data attr for host toolbar */}
      <button
        type="button"
        className="sr-only"
        data-mindmap-fit
        tabIndex={-1}
        onClick={fitView}
        aria-hidden
      />
      <span className="sr-only" data-mindmap-viewport={JSON.stringify(viewport)} />
    </div>
  )
}

export type SvgMindMapCanvasHandle = {
  fitView: () => void
}

/** Imperative fit helper used by MindMapHost toolbar. */
export function useSvgMindMapFit(containerRef: React.RefObject<HTMLDivElement | null>) {
  return React.useCallback(() => {
    const btn = containerRef.current?.querySelector('[data-mindmap-fit]') as HTMLButtonElement | null
    btn?.click()
  }, [containerRef])
}
