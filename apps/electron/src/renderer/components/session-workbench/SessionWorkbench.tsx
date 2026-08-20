/**
 * Session workbench: persistent memo rail + chat/graph stage + inspector.
 * Map/outline tabs share this chrome; SiYuan graph stays a full-page surface.
 */
import * as React from 'react'
import { Pin, PinOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  buildDigestItems,
  projectSessionScenes,
  type DigestItem,
  type DigestShelf,
  type SessionScene,
  type SessionSceneGraph,
} from '@craft-agent/core/mindmap'
import type { MindMapSessionMessage } from '@craft-agent/core/mindmap'

const SHELF_LABEL: Record<DigestShelf, string> = {
  decisions: 'Решения',
  artifacts: 'Артефакты',
  open: 'Открытое',
  pinned: 'Закреплённое',
}

export interface SessionWorkbenchProps {
  sessionId: string
  messages: MindMapSessionMessage[]
  stage: 'chat' | 'graph'
  graphStage: React.ReactNode
  chatStage: React.ReactNode
  onSelectMessage?: (messageId: string) => void
}

function loadPins(sessionId: string): string[] {
  try {
    const raw = localStorage.getItem(`rox-session-pins:${sessionId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function SessionWorkbench({
  sessionId,
  messages,
  stage,
  graphStage,
  chatStage,
  onSelectMessage,
}: SessionWorkbenchProps) {
  const { t } = useTranslation()
  const [pins, setPins] = React.useState<string[]>(() => loadPins(sessionId))
  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(null)
  const [camera, setCamera] = React.useState<'map' | 'flow'>('map')

  React.useEffect(() => {
    setPins(loadPins(sessionId))
  }, [sessionId])

  const sceneGraph = React.useMemo(
    () => projectSessionScenes(sessionId, messages),
    [sessionId, messages],
  )
  const digest = React.useMemo(() => buildDigestItems(sceneGraph, pins), [sceneGraph, pins])
  const selected = sceneGraph.scenes.find((s) => s.id === selectedSceneId) ?? sceneGraph.scenes.at(-1) ?? null

  const togglePin = (sceneId: string) => {
    setPins((prev) => {
      const next = prev.includes(sceneId) ? prev.filter((id) => id !== sceneId) : [...prev, sceneId]
      localStorage.setItem(`rox-session-pins:${sessionId}`, JSON.stringify(next))
      return next
    })
  }

  const selectScene = (scene: SessionScene) => {
    setSelectedSceneId(scene.id)
    onSelectMessage?.(scene.triggerMessageId)
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-border/50 bg-background/40">
        <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('entityView.workbenchMemo', { defaultValue: 'Памятка' })}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {(['decisions', 'artifacts', 'open', 'pinned'] as DigestShelf[]).map((shelf) => {
            const items = digest.filter((i) => i.shelf === shelf)
            if (!items.length) return null
            return (
              <Shelf key={shelf} title={SHELF_LABEL[shelf]} items={items} onPick={selectScene} graph={sceneGraph} />
            )
          })}
          <div className="mt-3 text-[11px] font-medium uppercase text-muted-foreground">Сцены</div>
          <ul className="mt-1 space-y-0.5">
            {sceneGraph.scenes.map((scene) => (
              <li key={scene.id}>
                <button
                  type="button"
                  onClick={() => selectScene(scene)}
                  className={cn(
                    'w-full rounded-md px-2 py-1 text-left text-xs hover:bg-foreground/5',
                    selected?.id === scene.id && 'bg-foreground/10',
                  )}
                >
                  <div className="truncate">{scene.triggerPreview || scene.id}</div>
                  {scene.tools.length > 0 && (
                    <div className="text-[10px] text-muted-foreground">{scene.tools.length} tools</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {stage === 'graph' && (
          <div className="flex items-center gap-1 border-b border-border/40 px-3 py-1 text-xs">
            <button
              type="button"
              className={cn('rounded px-2 py-0.5', camera === 'map' && 'bg-foreground/10')}
              onClick={() => setCamera('map')}
            >
              Карта
            </button>
            <button
              type="button"
              className={cn('rounded px-2 py-0.5', camera === 'flow' && 'bg-foreground/10')}
              onClick={() => setCamera('flow')}
            >
              Поток
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1">{stage === 'chat' ? chatStage : graphStage}</div>
      </div>
      <aside className="flex w-[260px] shrink-0 flex-col border-l border-border/50 bg-background/40 p-3 text-xs">
        <div className="font-medium uppercase tracking-wide text-muted-foreground">Инспектор</div>
        {selected ? (
          <div className="mt-2 space-y-2">
            <div className="text-sm text-foreground">{selected.triggerPreview}</div>
            {selected.outcomePreview && (
              <div className="text-muted-foreground">{selected.outcomePreview}</div>
            )}
            <div>tools: {selected.tools.map((t) => t.name).join(', ') || '—'}</div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1"
              onClick={() => togglePin(selected.id)}
            >
              {pins.includes(selected.id) ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              {pins.includes(selected.id) ? 'Открепить' : 'Закрепить'}
            </button>
            <p className="text-[11px] text-muted-foreground">
              Форк создаёт дочернюю сессию (ветка), не переписывает историю. Fan-out: до 8 параллельно / 32 за запуск.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-muted-foreground">Нет сцен</p>
        )}
      </aside>
    </div>
  )
}

function Shelf({
  title,
  items,
  graph,
  onPick,
}: {
  title: string
  items: DigestItem[]
  graph: SessionSceneGraph
  onPick: (scene: SessionScene) => void
}) {
  return (
    <div className="mb-2">
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{title}</div>
      <ul>
        {items.map((item) => {
          const scene = graph.scenes.find((s) => s.id === item.sceneId)
          if (!scene) return null
          return (
            <li key={item.id}>
              <button
                type="button"
                className="w-full truncate rounded px-2 py-0.5 text-left text-xs hover:bg-foreground/5"
                onClick={() => onPick(scene)}
              >
                {item.title}
                <span className="ml-1 text-[10px] text-muted-foreground">{item.reason}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
