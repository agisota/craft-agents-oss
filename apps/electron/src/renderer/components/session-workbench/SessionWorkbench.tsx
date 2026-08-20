/**
 * Session workbench: persistent memo rail + chat/graph stage + inspector.
 * Map/outline tabs share this chrome (MindMapHost camera); SiYuan graph stays full-page.
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
  type SceneMessage,
  type SessionScene,
  type SessionSceneGraph,
} from '@craft-agent/core/mindmap'
import { SessionFanOutSheet, type FanOutChildJob, type PlaybookHole } from './SessionFanOutSheet'

const SHELF_KEY: Record<DigestShelf, string> = {
  decisions: 'entityView.workbenchShelfDecisions',
  artifacts: 'entityView.workbenchShelfArtifacts',
  open: 'entityView.workbenchShelfOpen',
  pinned: 'entityView.workbenchShelfPinned',
}

export interface SessionWorkbenchProps {
  sessionId: string
  messages: SceneMessage[]
  stage: 'chat' | 'graph'
  graphStage: React.ReactNode
  chatStage: React.ReactNode
  model?: string
  onSelectMessage?: (messageId: string) => void
  onFork?: (messageId: string) => void
  onRewrite?: (messageId: string, prompt: string) => void
  onCreateChildSessions?: (jobs: FanOutChildJob[]) => void | Promise<void>
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
  model,
  onSelectMessage,
  onFork,
  onRewrite,
  onCreateChildSessions,
}: SessionWorkbenchProps) {
  const { t } = useTranslation()
  const [pins, setPins] = React.useState<string[]>(() => loadPins(sessionId))
  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(null)
  const [fanOutOpen, setFanOutOpen] = React.useState(false)

  React.useEffect(() => {
    setPins(loadPins(sessionId))
  }, [sessionId])

  const sceneGraph = React.useMemo(
    () => projectSessionScenes(sessionId, messages),
    [sessionId, messages],
  )
  const digest = React.useMemo(() => buildDigestItems(sceneGraph, pins), [sceneGraph, pins])
  const selected =
    sceneGraph.scenes.find((s) => s.id === selectedSceneId) ?? sceneGraph.scenes.at(-1) ?? null
  const playbookHoles: PlaybookHole[] = digest
    .filter((item) => item.shelf === 'open')
    .map((item) => ({ id: item.id, title: item.title, prompt: item.title }))

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
          {t('entityView.workbenchMemo')}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {(['decisions', 'artifacts', 'open', 'pinned'] as DigestShelf[]).map((shelf) => {
            const items = digest.filter((i) => i.shelf === shelf)
            if (!items.length) return null
            return (
              <Shelf
                key={shelf}
                title={t(SHELF_KEY[shelf])}
                items={items}
                onPick={selectScene}
                graph={sceneGraph}
              />
            )
          })}
          <div className="mt-3 text-[11px] font-medium uppercase text-muted-foreground">
            {t('entityView.workbenchScenes')}
          </div>
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
                    <div className="text-[10px] text-muted-foreground">
                      {t('entityView.workbenchToolsCount', { count: scene.tools.length })}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">{stage === 'chat' ? chatStage : graphStage}</div>
      </div>
      <aside className="flex w-[260px] shrink-0 flex-col border-l border-border/50 bg-background/40 p-3 text-xs">
        <div className="font-medium uppercase tracking-wide text-muted-foreground">
          {t('entityView.workbenchInspector')}
        </div>
        {selected ? (
          <div className="mt-2 space-y-2">
            <div>
              <div className="text-[11px] uppercase text-muted-foreground">{t('entityView.workbenchPrompt')}</div>
              <div className="text-sm text-foreground">{selected.triggerPreview}</div>
            </div>
            {selected.outcomePreview ? (
              <div className="text-muted-foreground">{selected.outcomePreview}</div>
            ) : (
              <div className="text-muted-foreground">{t('entityView.workbenchNoData')}</div>
            )}
            <div>
              <div className="text-[11px] uppercase text-muted-foreground">{t('entityView.workbenchTools')}</div>
              <ul className="mt-0.5 space-y-0.5">
                {selected.tools.length === 0 ? (
                  <li>{t('entityView.workbenchNoData')}</li>
                ) : (
                  selected.tools.map((tool) => (
                    <li key={tool.toolCallId} className="font-mono">
                      {tool.name} · {tool.status}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <div className="text-[11px] uppercase text-muted-foreground">{t('entityView.workbenchModel')}</div>
              <div>{model || t('entityView.workbenchNoData')}</div>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1"
              onClick={() => togglePin(selected.id)}
            >
              {pins.includes(selected.id) ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              {pins.includes(selected.id) ? t('entityView.workbenchUnpin') : t('entityView.workbenchPin')}
            </button>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded border border-border px-2 py-1"
                onClick={() => onRewrite?.(selected.triggerMessageId, selected.triggerPreview)}
              >
                {t('entityView.workbenchRewrite')}
              </button>
              <button
                type="button"
                className="rounded border border-border px-2 py-1"
                onClick={() => onFork?.(selected.triggerMessageId)}
              >
                {t('entityView.workbenchFork')}
              </button>
              <button
                type="button"
                className="rounded border border-border px-2 py-1"
                onClick={() => setFanOutOpen(true)}
              >
                {t('entityView.fanOutLaunch')}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('entityView.workbenchForkHint')}</p>
          </div>
        ) : (
          <p className="mt-2 text-muted-foreground">{t('entityView.workbenchNoScenes')}</p>
        )}
        <SessionFanOutSheet
          open={fanOutOpen}
          onOpenChange={setFanOutOpen}
          originScene={selected}
          playbookHoles={playbookHoles}
          onCreateChildSessions={onCreateChildSessions}
        />
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
