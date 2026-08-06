/**
 * CloudRunsChip — entry point for cloud research runs (PRD docs/cloud-runs-prd.md, G3).
 *
 * Self-contained (like BackgroundFinishedChip): fetches config on mount,
 * renders nothing when the feature is disabled. The chip sits in the
 * composer top-right corner: a rocket button opens the dialog showing
 * past runs (refreshed while open) and the "new research" submission box.
 */
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Cloud, Download, FileText, RefreshCw, Rocket, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRegisterModal } from '@/context/ModalContext'

type RunState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
interface ListedRun {
  id: string
  name: string
  createdAt: number
  topic?: string
  sessionId?: string
  status: {
    state: RunState
    failureReason?: string
    progress?: { completed: number; total: number }
    usage?: { promptTokens: number; completionTokens: number; cpuMs?: number }
  } | null
}

interface CloudRunsChipProps {
  sessionId: string
}

const POLL_MS = 5_000

/** Compact "12.3k tok · 4.2k out · 3m40s" ledger line for the runs list. */
function formatUsage(promptTokens: number, completionTokens: number, cpuMs?: number): string {
  const tok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
  const cpu = cpuMs && cpuMs > 0 ? ` · ${Math.floor(cpuMs / 60000)}m${Math.round((cpuMs % 60000) / 1000)}s` : ''
  return `${tok(promptTokens)}+${tok(completionTokens)} tok${cpu}`
}

/**
 * Outer probe: NO modal/electronAPI dependencies may live here — a sync throw
 * at this level trips InputErrorBoundary and kills the whole composer
 * (chat.inputFailedTitle). electronAPI is optional-chained exactly like
 * main.tsx conventions; inner mounts only when the feature is confirmed on.
 */
export function CloudRunsChip({ sessionId }: CloudRunsChipProps) {
  const [enabled, setEnabled] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    try {
      void Promise.resolve(window.electronAPI?.getCloudRunsConfig?.())
        .then((cfg) => setEnabled(cfg?.enabled === true))
        .catch(() => setEnabled(false))
    } catch {
      setEnabled(false)
    }
  }, [])
  if (enabled !== true) return null
  return <CloudRunsChipInner sessionId={sessionId} />
}

function CloudRunsChipInner({ sessionId }: CloudRunsChipProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [runs, setRuns] = React.useState<ListedRun[]>([])
  const [topic, setTopic] = React.useState('')
  const [busy, setBusy] = React.useState<string | null>(null)
  useRegisterModal(open, () => setOpen(false))

  const refresh = React.useCallback(async () => {
    try {
      const result = await window.electronAPI.listCloudRuns()
      setRuns(result.runs)
    } catch { /* status poll failures are non-fatal */ }
  }, [])

  React.useEffect(() => {
    if (!open) return
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [open, refresh])

  // Background poll while the app is open: surfaces active runs on the
  // chip and toasts when a run finishes (PRD: resumption after close
  // is covered because the list survives server-side).
  const lastStates = React.useRef<Map<string, RunState>>(new Map())
  React.useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const result = await window.electronAPI.listCloudRuns()
        setRuns(result.runs)
        for (const run of result.runs) {
          const prev = lastStates.current.get(run.id)
          const next = run.status?.state
          if (prev && next && prev !== next && next === 'done' && !open) {
            toast.success(t('cloudRuns.finished', { name: run.name }))
          }
          if (next) lastStates.current.set(run.id, next)
        }
      } catch { /* non-fatal */ }
    }, 30_000)
    return () => clearInterval(timer)
  }, [open, t])

  const activeCount = runs.filter((r) => r.status && (r.status.state === 'running' || r.status.state === 'queued')).length
  const doneCount = runs.filter((r) => r.status?.state === 'done').length

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    try {
      await fn()
    } catch (error) {
      toast.error(t('cloudRuns.error'), { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(null)
      void refresh()
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={t('cloudRuns.open')}
        title={t('cloudRuns.open')}
        onClick={() => setOpen(true)}
        className="absolute top-2 right-32 z-20 flex h-6 items-center gap-1 rounded-full border border-border/60 bg-background/90 px-2 text-xs text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground"
      >
        {activeCount > 0 ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Cloud className="h-3 w-3" />}
        {activeCount > 0 ? t('cloudRuns.active', { count: activeCount }) : t('cloudRuns.open')}
        {doneCount > 0 && activeCount === 0 ? ` · ${doneCount}` : ''}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('cloudRuns.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('cloudRuns.topicPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && topic.trim()) {
                  void act('submit', async () => {
                    await window.electronAPI.submitCloudRun({ topic: topic.trim(), sessionId })
                    setTopic('')
                    toast.success(t('cloudRuns.submitted'))
                  })
                }
              }}
            />
            <Button
              disabled={!topic.trim() || busy === 'submit'}
              onClick={() =>
                void act('submit', async () => {
                  await window.electronAPI.submitCloudRun({ topic: topic.trim(), sessionId })
                  setTopic('')
                  toast.success(t('cloudRuns.submitted'))
                })
              }
            >
              <Rocket className="mr-1 h-4 w-4" />
              {t('cloudRuns.submit')}
            </Button>
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto">
            {runs.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t('cloudRuns.empty')}</p>}
            {runs.map((run) => {
              const state = run.status?.state
              const progress = run.status?.progress
              return (
                <div key={run.id} className="flex items-center gap-2 rounded-md border border-border/50 px-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate" title={run.topic}>{run.name}</span>
                  {run.status?.usage && (
                    <span
                      className="shrink-0 text-xs text-muted-foreground"
                      title={t('cloudRuns.usageHint')}
                    >
                      {formatUsage(run.status.usage.promptTokens, run.status.usage.completionTokens, run.status.usage.cpuMs)}
                    </span>
                  )}
                  {progress && state === 'running' && (
                    <span className="text-xs text-muted-foreground">{progress.completed}/{progress.total}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{t(`cloudRuns.state.${state ?? 'unknown'}`)}</span>
                  {(state === 'running' || state === 'queued') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === run.id}
                      title={t('cloudRuns.cancel')}
                      onClick={() => void act(run.id, () => window.electronAPI.cancelCloudRun(run.id))}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                  {state === 'failed' && run.topic && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === run.id}
                      title={t('cloudRuns.retry')}
                      onClick={() =>
                        void act(run.id, async () => {
                          await window.electronAPI.submitCloudRun({ topic: run.topic!, sessionId })
                          toast.success(t('cloudRuns.submitted'))
                        })
                      }
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  {state === 'done' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === run.id}
                        title={t('cloudRuns.import')}
                        onClick={() =>
                          void act(run.id, async () => {
                            const result = await window.electronAPI.importCloudRun({ runId: run.id, sessionId })
                            toast.success(t('cloudRuns.imported', { count: result.files.length }))
                          })
                        }
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === run.id}
                        title={t('cloudRuns.aggregate')}
                        onClick={() =>
                          void act(run.id, async () => {
                            await window.electronAPI.aggregateCloudRun({ runId: run.id, sessionId })
                            toast.success(t('cloudRuns.aggregateStarted'))
                          })
                        }
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <DialogFooter>
            <span className="text-xs text-muted-foreground">{t('cloudRuns.footer')}</span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
