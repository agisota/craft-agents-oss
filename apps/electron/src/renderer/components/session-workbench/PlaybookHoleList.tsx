import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { PlaybookHole } from './fan-out-jobs'

export function PlaybookHoleList({
  holes,
  selectedIds,
  onToggle,
}: {
  holes: PlaybookHole[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
}) {
  const { t } = useTranslation()
  if (!holes.length) {
    return <p className="text-[11px] text-muted-foreground">{t('entityView.playbookHoleEmpty')}</p>
  }
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
        {t('entityView.playbookHoles')}
      </div>
      <ul className="space-y-0.5">
        {holes.map((hole) => {
          const on = selectedIds.has(hole.id)
          return (
            <li key={hole.id}>
              <button
                type="button"
                onClick={() => onToggle(hole.id)}
                className={cn(
                  'w-full rounded px-2 py-1 text-left text-xs hover:bg-foreground/5',
                  on && 'bg-foreground/10',
                )}
              >
                {hole.title}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
