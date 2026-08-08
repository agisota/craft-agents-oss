/**
 * Mind map host shell — P1 renders outline list; P2+ plugs SVG engine.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Network } from 'lucide-react'
import type { MindMapEntityRef, MindMapGraph, MindMapNodeId } from '@craft-agent/core/mindmap'
import { MindMapOutline } from './MindMapOutline'

export interface MindMapHostProps {
  entity: MindMapEntityRef
  graph: MindMapGraph | null
  loading?: boolean
  error?: string | null
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
  selectedId,
  onSelect,
  onNavigate,
  className,
}: MindMapHostProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className={`flex-1 flex items-center justify-center text-sm text-muted-foreground ${className ?? ''}`}>
        {t('mindmap.loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center ${className ?? ''}`}>
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!graph) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center ${className ?? ''}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5 text-muted-foreground">
          <Network className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <p className="text-sm text-muted-foreground">{t('mindmap.empty')}</p>
      </div>
    )
  }

  const childCount = Object.keys(graph.nodes).length
  const onlyRoot = childCount <= 1

  return (
    <div className={`flex-1 flex flex-col min-h-0 ${className ?? ''}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30 text-[11px] text-muted-foreground shrink-0">
        <span className="inline-flex items-center rounded-full bg-foreground/5 px-2 py-0.5 font-medium text-foreground/80">
          {t('mindmap.live')}
        </span>
        <span className="truncate">
          {mode === 'outline' ? t('entityView.outline') : t('entityView.map')}
          {' · '}
          {childCount} {t('mindmap.nodes')}
        </span>
      </div>
      {onlyRoot ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {t('mindmap.empty')}
        </div>
      ) : (
        <MindMapOutline
          graph={graph}
          selectedId={selectedId}
          onSelect={onSelect}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}
