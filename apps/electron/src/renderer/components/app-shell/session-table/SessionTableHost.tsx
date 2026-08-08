import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@/contexts/NavigationContext'
import { routes } from '@/lib/navigate'
import { CollectionViewToggle } from '../kanban/BoardListToggle'

/**
 * Sessions collection table shell (B0). Full table grid lands in later slices;
 * this host owns the view-mode chrome and a placeholder body so `/table` is
 * reachable end-to-end.
 */
export function SessionTableHost() {
  const { t } = useTranslation()
  const { navigate } = useNavigation()

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-sm font-medium">{t('collection.table.title')}</span>
        </div>
        <div className="flex items-center gap-2">
          <CollectionViewToggle
            value="table"
            onChange={view => {
              if (view === 'list') navigate(routes.view.allSessions())
              if (view === 'board') navigate(routes.view.board())
            }}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">{t('collection.table.placeholder')}</p>
      </div>
    </div>
  )
}
