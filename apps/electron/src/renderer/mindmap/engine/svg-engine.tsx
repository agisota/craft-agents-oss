/**
 * Craft SVG mind-map engine — LR tree, pan/zoom, collapse, minimap.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  autoLayout,
  layoutBounds,
  type MindMapLayout,
  type MindMapNodeId,
} from '@craft-agent/core/mindmap'
import { MindMapMinimap } from './minimap'
import {
  MIND_MAP_NODE_HEIGHT,
  MIND_MAP_NODE_WIDTH,
  type MindMapEngineProps,
} from './types'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 2.75
const ZOOM_IN = 1.1
const ZOOM_OUT = 1 / ZOOM_IN

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

function normalizeCollapsed(
  collapsed: MindMapEngineProps['collapsed'],
): MindMapNodeId[] {
  if (!collapsed) return []
  if (collapsed instanceof Set) return [...collapsed]
  return [...collapsed]
}

function parentBezier(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

function truncateLabel(label: string, max: number): string {
  const t = label.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(1, max - 1))}…`
}

export type SvgMindMapViewProps = Omit<MindMapEngineProps, 'layout' | 'mode'> & {
  layout?: MindMapLayout | 'auto'
  /** Bump to request fitView from host toolbar */
  fitRequestKey?: number
}

export type SvgMindMapViewHandle = {
  fitView: () => void
  zoomBy: (factor: number) => void
  getViewport: () => { x: number; y: number; zoom: number }
}

export const SvgMindMapView = React.forwardRef<SvgMindMapViewHandle, SvgMindMapViewProps>(
  function SvgMindMapView(
    {
      graph,
      layout: layoutProp = 'auto',
      readOnlyStructure = true,
      selectedId = null,
      searchQuery = '',
      collapsed: collapsedProp,
      className,
      onLayoutChange,
      onNavigate,
      onSelect,
      onToggleCollapse,
      fitRequestKey = 0,
    },
    ref,
  ) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [size, setSize] = React.useState({ width: 0, height: 0 })
    const [pan, setPan] = React.useState({ x: 48, y: 48 })
    const [zoom, setZoom] = React.useState(1)
    const dragRef = React.useRef<{
      pointerId: number
      startX: number
      startY: number
      origPanX: number
      origPanY: number
    } | null>(null)
    const [isPanning, setIsPanning] = React.useState(false)
    const fittedGraphKey = React.useRef<string | null>(null)

    const collapsedList = React.useMemo(
      () => normalizeCollapsed(collapsedProp),
      [collapsedProp],
    )
    const collapsedSet = React.useMemo(() => new Set(collapsedList), [collapsedList])

    const layout: MindMapLayout = React.useMemo(() => {
      if (layoutProp !== 'auto' && layoutProp && collapsedProp === undefined) {
        if (Object.keys(layoutProp.positions).length > 0) return layoutProp
      }
      return autoLayout(graph, {
        collapsed: collapsedList,
        hGap: 200,
        vGap: 56,
        nodeWidth: MIND_MAP_NODE_WIDTH,
        nodeHeight: MIND_MAP_NODE_HEIGHT,
      })
    }, [graph, layoutProp, collapsedList, collapsedProp])

    React.useEffect(() => {
      onLayoutChange?.(layout)
      // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid callback churn loops
    }, [layout])

    const q = searchQuery.trim().toLowerCase()
    const nodeCount = Object.keys(graph.nodes).length
    const visibleCount = Object.keys(layout.positions).length

    React.useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const ro = new ResizeObserver((entries) => {
        const cr = entries[0]?.contentRect
        if (!cr) return
        setSize({ width: cr.width, height: cr.height })
      })
      ro.observe(el)
      const r = el.getBoundingClientRect()
      setSize({ width: r.width, height: r.height })
      return () => ro.disconnect()
    }, [])

    // Expand point-bounds by half chip so fit includes full node rects
    const bounds = React.useMemo(() => {
      const half = Math.max(MIND_MAP_NODE_WIDTH, MIND_MAP_NODE_HEIGHT) / 2 + 24
      return layoutBounds(layout, half)
    }, [layout])

    const fitView = React.useCallback(() => {
      const { width, height } = size
      if (width <= 0 || height <= 0) return
      if (bounds.width <= 0 || bounds.height <= 0) {
        setPan({ x: width / 2, y: height / 2 })
        setZoom(1)
        return
      }
      const pad = 36
      const zx = (width - pad * 2) / bounds.width
      const zy = (height - pad * 2) / bounds.height
      const nextZoom = clampZoom(Math.min(zx, zy, 1.35))
      const cx = bounds.minX + bounds.width / 2
      const cy = bounds.minY + bounds.height / 2
      setZoom(nextZoom)
      setPan({
        x: width / 2 - cx * nextZoom,
        y: height / 2 - cy * nextZoom,
      })
    }, [bounds, size])

    const zoomBy = React.useCallback(
      (factor: number) => {
        const { width, height } = size
        const mx = width / 2
        const my = height / 2
        setZoom((prev) => {
          const next = clampZoom(prev * factor)
          const worldX = (mx - pan.x) / prev
          const worldY = (my - pan.y) / prev
          setPan({
            x: mx - worldX * next,
            y: my - worldY * next,
          })
          return next
        })
      },
      [pan.x, pan.y, size],
    )

    React.useImperativeHandle(
      ref,
      () => ({
        fitView,
        zoomBy,
        getViewport: () => ({ x: pan.x, y: pan.y, zoom }),
      }),
      [fitView, zoomBy, pan.x, pan.y, zoom],
    )

    const graphKey = `${graph.contentHash}:${graph.rootId}`

    // Fit when graph identity changes and container has size
    React.useEffect(() => {
      if (size.width <= 0 || size.height <= 0) return
      if (fittedGraphKey.current === graphKey) return
      fittedGraphKey.current = graphKey
      fitView()
    }, [graphKey, size.width, size.height, fitView])

    React.useEffect(() => {
      if (fitRequestKey > 0) fitView()
    }, [fitRequestKey, fitView])

    const onWheel = (e: React.WheelEvent) => {
      e.preventDefault()
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? ZOOM_IN : ZOOM_OUT
      setZoom((prev) => {
        const next = clampZoom(prev * factor)
        const worldX = (mx - pan.x) / prev
        const worldY = (my - pan.y) / prev
        setPan({
          x: mx - worldX * next,
          y: my - worldY * next,
        })
        return next
      })
    }

    const onPointerDownBg = (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const target = e.target as Element
      if (target.closest('[data-mindmap-node]')) return
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      }
      setIsPanning(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d || d.pointerId !== e.pointerId) return
      setPan({
        x: d.origPanX + (e.clientX - d.startX),
        y: d.origPanY + (e.clientY - d.startY),
      })
    }

    const endPan = (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d || d.pointerId !== e.pointerId) return
      dragRef.current = null
      setIsPanning(false)
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }

    const handleMinimapNav = React.useCallback(
      (world: { x: number; y: number }) => {
        if (size.width <= 0 || size.height <= 0) return
        setPan({
          x: size.width / 2 - world.x * zoom,
          y: size.height / 2 - world.y * zoom,
        })
      },
      [size.width, size.height, zoom],
    )

    const visibleIds = React.useMemo(
      () => new Set(Object.keys(layout.positions)),
      [layout.positions],
    )

    const edges = React.useMemo(() => {
      const out: Array<{ id: string; kind: 'parent' | 'backlink' | 'ref'; d: string }> = []
      for (const edge of graph.edges) {
        const from = layout.positions[edge.from]
        const to = layout.positions[edge.to]
        if (!from || !to) continue
        if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) continue

        // autoLayout positions are node centers
        if (edge.kind === 'parent') {
          const x1 = from.x + MIND_MAP_NODE_WIDTH / 2
          const y1 = from.y
          const x2 = to.x - MIND_MAP_NODE_WIDTH / 2
          const y2 = to.y
          out.push({ id: edge.id, kind: 'parent', d: parentBezier(x1, y1, x2, y2) })
        } else {
          out.push({
            id: edge.id,
            kind: edge.kind,
            d: parentBezier(from.x, from.y, to.x, to.y),
          })
        }
      }
      return out
    }, [graph.edges, layout.positions, visibleIds])

    const nodes = React.useMemo(() => {
      const list: Array<{
        id: MindMapNodeId
        x: number
        y: number
        label: string
        kind: string
        hasChildren: boolean
        isCollapsed: boolean
        selected: boolean
        dimmed: boolean
        source?: { kind: string; id: string }
      }> = []
      for (const [id, pos] of Object.entries(layout.positions)) {
        if (!pos) continue
        const node = graph.nodes[id]
        if (!node) continue
        const hasChildren = node.children.length > 0
        const isCollapsed = collapsedSet.has(id) || Boolean(node.collapsed)
        const label = node.label || id
        const dimmed = q.length > 0 && !label.toLowerCase().includes(q)
        list.push({
          id,
          x: pos.x,
          y: pos.y,
          label,
          kind: node.kind,
          hasChildren,
          isCollapsed,
          selected: selectedId === id,
          dimmed,
          source: node.source,
        })
      }
      return list
    }, [layout.positions, graph.nodes, collapsedSet, selectedId, q])

    void readOnlyStructure

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative flex-1 min-h-0 min-w-0 overflow-hidden bg-background touch-none select-none',
          isPanning ? 'cursor-grabbing' : 'cursor-grab',
          className,
        )}
        onWheel={onWheel}
        onPointerDown={onPointerDownBg}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <svg
          width="100%"
          height="100%"
          className="absolute inset-0 block h-full w-full"
          style={{ overflow: 'hidden' }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            <g className="pointer-events-none">
              {edges.map((e) => (
                <path
                  key={e.id}
                  d={e.d}
                  fill="none"
                  className={
                    e.kind === 'parent' ? 'stroke-border/70' : 'stroke-muted-foreground/50'
                  }
                  strokeWidth={e.kind === 'parent' ? 1.5 : 1.25}
                  strokeDasharray={e.kind === 'parent' ? undefined : '4 3'}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>

            <g>
              {nodes.map((n) => {
                const x = n.x - MIND_MAP_NODE_WIDTH / 2
                const y = n.y - MIND_MAP_NODE_HEIGHT / 2
                return (
                  <g
                    key={n.id}
                    data-mindmap-node={n.id}
                    transform={`translate(${x}, ${y})`}
                    className={cn('cursor-pointer', n.dimmed ? 'opacity-25' : 'opacity-100')}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect?.(n.id)
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      onSelect?.(n.id)
                      if (n.source) onNavigate?.(n.source)
                    }}
                  >
                    <rect
                      width={MIND_MAP_NODE_WIDTH}
                      height={MIND_MAP_NODE_HEIGHT}
                      rx={10}
                      ry={10}
                      className={cn(
                        'fill-background stroke-border/60',
                        n.kind === 'root' && 'fill-foreground/[0.03]',
                        n.selected && 'stroke-foreground/70 fill-foreground/[0.06]',
                      )}
                      strokeWidth={n.selected ? 2 : 1}
                    />
                    {n.selected ? (
                      <rect
                        x={-3}
                        y={-3}
                        width={MIND_MAP_NODE_WIDTH + 6}
                        height={MIND_MAP_NODE_HEIGHT + 6}
                        rx={12}
                        ry={12}
                        className="fill-none stroke-foreground/30"
                        strokeWidth={1}
                      />
                    ) : null}

                    {n.hasChildren ? (
                      <g
                        transform={`translate(${MIND_MAP_NODE_WIDTH - 22}, ${MIND_MAP_NODE_HEIGHT / 2 - 9})`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleCollapse?.(n.id)
                        }}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={9}
                          cy={9}
                          r={9}
                          className="fill-muted stroke-border/70"
                          strokeWidth={1}
                        />
                        <text
                          x={9}
                          y={9.5}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-muted-foreground"
                          style={{ fontSize: 12, fontFamily: 'inherit' }}
                        >
                          {n.isCollapsed ? '+' : '−'}
                        </text>
                      </g>
                    ) : null}

                    <text
                      x={12}
                      y={MIND_MAP_NODE_HEIGHT / 2 + 0.5}
                      dominantBaseline="middle"
                      className="fill-foreground/80"
                      style={{ fontSize: 12, fontFamily: 'inherit' }}
                    >
                      {truncateLabel(n.label, n.hasChildren ? 20 : 24)}
                    </text>
                  </g>
                )
              })}
            </g>
          </g>
        </svg>

        <MindMapMinimap
          layout={layout}
          bounds={bounds}
          pan={pan}
          zoom={zoom}
          viewportSize={size}
          nodeCount={visibleCount > 0 ? visibleCount : nodeCount}
          selectedId={selectedId}
          onNavigateTo={handleMinimapNav}
        />
      </div>
    )
  },
)

export default SvgMindMapView
