import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useActiveWorkspace } from '@/context/AppShellContext'
import { sanitizeConnectionRows, type ConnectionListRow } from './connections-list'

const TABS = ['services', 'credentials', 'imports', 'policies', 'audit'] as const
type ConnectionsTab = (typeof TABS)[number]

export default function ConnectionsPage() {
  const { t } = useTranslation()
  const workspace = useActiveWorkspace()
  const [tab, setTab] = useState<ConnectionsTab>('services')
  const [rows, setRows] = useState<ConnectionListRow[] | null>(null)

  useEffect(() => {
    const workspaceId = workspace?.id
    const listConnections = window.electronAPI?.workgraph?.listConnections
    if (!workspaceId || typeof listConnections !== 'function') {
      setRows([])
      return
    }
    let stale = false
    listConnections(workspaceId)
      .then((raw) => {
        if (!stale) setRows(sanitizeConnectionRows(raw))
      })
      .catch(() => {
        if (!stale) setRows([])
      })
    return () => {
      stale = true
    }
  }, [workspace?.id])

  const services = tab === 'services' ? rows ?? [] : []

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
      <div className="flex flex-1 min-h-0 flex-col p-6 text-muted-foreground">
        {tab === 'services' && services.length > 0 ? (
          <ul className="space-y-2 text-sm text-foreground">
            {services.map((row) => (
              <li key={row.id} className="rounded border px-3 py-2">
                <div className="font-medium">{row.integrationId}</div>
                <div className="text-muted-foreground">{row.storageMode}</div>
                <div className="font-mono text-xs">{row.credentialRefId}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm">{t('connections.empty')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
