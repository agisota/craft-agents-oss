import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const TABS = ['services', 'credentials', 'imports', 'policies', 'audit'] as const
type ConnectionsTab = (typeof TABS)[number]

export default function ConnectionsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ConnectionsTab>('services')

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="connections-page">
      <div role="tablist" aria-label={t('sidebar.connections')} className="flex gap-2 border-b px-4 pt-3">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`rounded-t px-3 py-2 text-sm ${tab === id ? 'bg-accent/10 text-accent' : 'text-muted-foreground'}`}
            onClick={() => setTab(id)}
          >
            {t(`connections.tab.${id}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
        <p className="text-sm">{t('connections.empty')}</p>
      </div>
    </div>
  )
}
