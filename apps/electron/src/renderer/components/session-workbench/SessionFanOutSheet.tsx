import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { FANOUT_MAX, FANOUT_PARALLEL } from '@craft-agent/core/mindmap'
import type { SessionScene } from '@craft-agent/core/mindmap'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  buildFanOutChildJobs,
  type FanOutChildJob,
  type PlaybookHole,
} from './fan-out-jobs'
import { PlaybookHoleList } from './PlaybookHoleList'

export type { FanOutChildJob, PlaybookHole }

function planJobs(
  originScene: SessionScene | null,
  playbookHoles: PlaybookHole[],
  selectedHoles: Set<string>,
  replicas: number,
): { jobs: FanOutChildJob[]; error: string | null } {
  if (!originScene) return { jobs: [], error: null }
  const holeVariants = playbookHoles
    .filter((h) => selectedHoles.has(h.id))
    .map((h) => h.prompt?.trim() || h.title)
  const variants = holeVariants.length
    ? holeVariants
    : [originScene.triggerPreview || originScene.id]
  try {
    return {
      jobs: buildFanOutChildJobs({
        variants,
        count: replicas,
        branchFromMessageId: originScene.triggerMessageId,
        originSceneId: originScene.id,
      }),
      error: null,
    }
  } catch {
    return { jobs: [], error: 'cap' }
  }
}

export function SessionFanOutSheet({
  open,
  onOpenChange,
  originScene,
  playbookHoles = [],
  replicas = 1,
  onCreateChildSessions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  originScene: SessionScene | null
  playbookHoles?: PlaybookHole[]
  replicas?: number
  onCreateChildSessions?: (jobs: FanOutChildJob[]) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const [selectedHoles, setSelectedHoles] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) setSelectedHoles(new Set(playbookHoles.map((h) => h.id)))
  }, [open, playbookHoles])

  const { jobs, error: planError } = React.useMemo(
    () => planJobs(originScene, playbookHoles, selectedHoles, replicas),
    [originScene, playbookHoles, replicas, selectedHoles],
  )

  const launch = async () => {
    if (!jobs.length || !onCreateChildSessions) {
      onOpenChange(false)
      return
    }
    setBusy(true)
    try {
      await onCreateChildSessions(jobs)
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  const toggleHole = (id: string) => {
    setSelectedHoles((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{t('entityView.fanOutTitle')}</DrawerTitle>
          <DrawerDescription>
            {t('entityView.fanOutCapHint', {
              max: FANOUT_MAX,
              parallel: FANOUT_PARALLEL,
            })}
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-3 px-4 pb-2 text-xs">
          {originScene && (
            <div className="rounded border border-border/50 bg-foreground/5 px-2 py-1">
              {originScene.triggerPreview || originScene.id}
            </div>
          )}
          {playbookHoles.length > 0 && (
            <PlaybookHoleList holes={playbookHoles} selectedIds={selectedHoles} onToggle={toggleHole} />
          )}
          <div className="font-medium uppercase text-muted-foreground">
            {t('entityView.fanOutJobs')} ({jobs.length})
          </div>
          {planError && <p className="text-destructive">{t('entityView.fanOutCapError')}</p>}
          <ul className="max-h-56 space-y-0.5 overflow-auto">
            {jobs.map((job) => (
              <li
                key={job.index}
                className={cn(
                  'flex items-center justify-between rounded px-2 py-1',
                  job.status === 'running' && 'bg-foreground/5',
                )}
              >
                <span className="truncate">{job.title}</span>
                <span className="ml-2 shrink-0 text-[10px] uppercase text-muted-foreground">
                  {job.status === 'running' ? t('entityView.fanOutRunning') : t('entityView.fanOutQueued')}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <DrawerFooter>
          <Button type="button" size="sm" disabled={busy || !jobs.length} onClick={() => void launch()}>
            {t('entityView.fanOutLaunch')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
