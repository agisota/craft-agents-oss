/**
 * Mind map host — map mode uses SVG engine; outline mode uses nested list.
 * Optional split mode syncs selection across map + outline.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  Columns2,
  Maximize2,
  Network,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { MindMapEntityRef, MindMapGraph, MindMapNodeId } from '@craft-agent/core/mindmap'
import { cn } from '@/lib/utils'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { MindMapOutline } from './MindMapOutline'
import {
  SvgMindMapView,
  type SvgMindMapViewHandle,
} from './engine/svg-engine'

export interface MindMapHostProps {
  entity: MindMapEntityRef
  graph: MindMapGraph | null
  loading?: boolean
  error?: string | null
  /** External tab mode from EntityViewTabs */
  mode?: 'map' | 'outline'
  selectedId?: MindMapNodeId | null
  onSelect?: (id: MindMapNodeId | null) => void
  onNavigate?: (source: { kind: string; id: string }) => void
  className?: string
}

export function MindMapHost({
  entity: _entity,
  graph,
  loading,
  error,
  mode = 'map',
  selectedId: selectedProp = null,
  onSelect,
  onNavigate,
  className,
}: MindMapHostProps) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = React.useState<MindMapNodeId | null>(selectedProp)
  const [search, setSearch] = React.useState('')
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState<Set<MindMapNodeId>>(() => new Set())
  const [split, setSplit] = React.useState(false)
  const [fitKey, setFitKey] = React.useState(0)
  const engineRef = React.useRef<SvgMindMapViewHandle | null>(null)

  React.useEffect(() => {
    setSelectedId(selectedProp)
  }, [selectedProp])

  // Reset collapse when graph identity changes
  React.useEffect(() => {
    setCollapsed(new Set())
  }, [graph?.contentHash, graph?.rootId])

  const handleSelect = React.useCallback(
    (id: MindMapNodeId | null) => {
      setSelectedId(id)
      onSelect?.(id)
    },
    [onSelect],
  )

  const handleToggleCollapse = React.useCallback((id: MindMapNodeId) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (loading) {
    return (
      <div
        className={cn(
          'flex-1 flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
      >
        {t('mindmap.loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center',
          className,
        )}
      >
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!graph) {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center',
          className,
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5 text-muted-foreground">
          <Network className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <p className="text-sm text-muted-foreground">{t('mindmap.empty')}</p>
      </div>
    )
  }

  const childCount = Object.keys(graph.nodes).length
  const onlyRoot = childCount <= 1
  const showMapChrome = mode === 'map' && !onlyRoot

  const renderMap = () => (
    <SvgMindMapView
      ref={engineRef}
      graph={graph}
      layout="auto"
      readOnlyStructure
      searchQuery={search}
      selectedId={selectedId}
      collapsed={collapsed}
      onSelect={handleSelect}
      onNavigate={onNavigate}
      onToggleCollapse={handleToggleCollapse}
      fitRequestKey={fitKey}
    />
  )

  const renderOutline = () => (
    <MindMapOutline
      graph={graph}
      selectedId={selectedId}
      onSelect={handleSelect}
      onNavigate={onNavigate}
    />
  )

  return (
    <div className={cn('flex-1 flex flex-col min-h-0', className)}>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30 text-[11px] text-muted-foreground shrink-0">
        <span className="inline-flex items-center rounded-full bg-foreground/5 px-2 py-0.5 font-medium text-foreground/80">
          {t('mindmap.live')}
        </span>
        <span className="truncate">
          {mode === 'outline' && !split
            ? t('entityView.outline')
            : split
              ? t('mindmap.split')
              : t('entityView.map')}
          {' · '}
          {childCount} {t('mindmap.nodes')}
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          {showMapChrome ? (
            <>
              <button
                type="button"
                className="h-7 w-7 grid place-items-center rounded-[6px] hover:bg-foreground/5 text-muted-foreground hover:text-foreground"
                title={t('mindmap.fit')}
                onClick={() => {
                  engineRef.current?.fitView()
                  setFitKey((k) => k + 1)
                }}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="h-7 w-7 grid place-items-center rounded-[6px] hover:bg-foreground/5 text-muted-foreground hover:text-foreground"
                title="Zoom in"
                onClick={() => engineRef.current?.zoomBy(1.1)}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="h-7 w-7 grid place-items-center rounded-[6px] hover:bg-foreground/5 text-muted-foreground hover:text-foreground"
                title="Zoom out"
                onClick={() => engineRef.current?.zoomBy(1 / 1.1)}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className={cn(
                  'h-7 w-7 grid place-items-center rounded-[6px] hover:bg-foreground/5',
                  split
                    ? 'text-foreground bg-foreground/5'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title={t('mindmap.split')}
                onClick={() => setSplit((v) => !v)}
              >
                <Columns2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={cn(
              'h-7 w-7 grid place-items-center rounded-[6px] hover:bg-foreground/5',
              searchOpen
                ? 'text-foreground bg-foreground/5'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title={t('common.search')}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {searchOpen ? (
        <div className="px-3 py-1.5 border-b border-border/20 shrink-0">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="w-full h-8 rounded-[8px] border border-border/50 bg-background px-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-foreground/30 placeholder:text-muted-foreground"
          />
        </div>
      ) : null}

      {onlyRoot ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {t('mindmap.empty')}
        </div>
      ) : mode === 'outline' ? (
        renderOutline()
      ) : split ? (
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={62} minSize={30}>
            <div className="flex h-full min-h-0 flex-col">{renderMap()}</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={38} minSize={20}>
            <div className="flex h-full min-h-0 flex-col border-l border-border/30">
              {renderOutline()}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        renderMap()
      )}
    </div>
  )
}
