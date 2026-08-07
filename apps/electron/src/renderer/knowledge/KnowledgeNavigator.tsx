/**
 * KnowledgeNavigator (W2, spec S-01 §Режим Знания) — left-nav composition for
 * the Knowledge mode. Prop-less: reads workspace context via atoms/context
 * internally, so AppShell can mount it directly in the navigator slot
 * (W2-NAV wires it behind `isKnowledgeNavigation`).
 *
 * Contents: the section tree (notebooks + static S-01 sections) and a hint
 * pointing at the full SiYuan desktop interface rendered by the surface slice
 * (W2-SURF owns the embedded surface itself).
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { KnowledgeNotebookTree } from './KnowledgeNotebookTree'

export function KnowledgeNavigator() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-border px-3 py-2">
        <h2 className="truncate text-[13px] font-semibold text-foreground">
          {t('knowledge.nav.title')}
        </h2>
      </header>
      <div className={cn('min-h-0 flex-1 overflow-y-auto')}>
        <KnowledgeNotebookTree />
      </div>
      <footer className="border-t border-border px-3 py-2">
        <p className="text-[11px] leading-snug text-muted-foreground">
          {t('knowledge.openFullInterface')}
        </p>
      </footer>
    </div>
  )
}
