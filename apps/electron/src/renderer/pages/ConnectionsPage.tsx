import { useAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { selectedConnectionAtom } from '@/atoms/connections'
import { useActiveWorkspace } from '@/context/AppShellContext'
import { sanitizeConnectionRows, type ConnectionListRow } from './connections-list'

const TABS = ['services', 'credentials', 'imports', 'policies', 'audit'] as const
type ConnectionsTab = (typeof TABS)[number]
type PreviewRow = {
  candidateId: string
  label: string
  maskedSummary: string
  source: 'env' | 'git-helper'
}

export default function ConnectionsPage() {
  const { t } = useTranslation()
  const workspace = useActiveWorkspace()
  const [tab, setTab] = useState<ConnectionsTab>('services')
  const [selected, setSelected] = useAtom(selectedConnectionAtom)
  const [rows, setRows] = useState<ConnectionListRow[] | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [envPath, setEnvPath] = useState('')
  const [gitConfigPath, setGitConfigPath] = useState('')
  const [previews, setPreviews] = useState<PreviewRow[]>([])

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
      setSelected(null)
      setConfirmingId(null)
    }
  }, [workspace?.id, setSelected])

  const refreshRows = async (workspaceId: string) => {
    const listConnections = window.electronAPI?.workgraph?.listConnections
    if (typeof listConnections !== 'function') return
    setRows(sanitizeConnectionRows(await listConnections(workspaceId)))
  }

  const listed = rows ?? []
  const services = tab === 'services' ? listed : []
  const credentialRows = tab === 'credentials' ? listed : []
  const policyRows = tab === 'policies' ? listed : []

  const confirmRevoke = async (connectionId: string) => {
    const workspaceId = workspace?.id
    const revokeConnection = window.electronAPI?.workgraph?.revokeConnection
    if (!workspaceId || typeof revokeConnection !== 'function') return
    await revokeConnection({ workspaceId, connectionId })
    if (selected?.id === connectionId) setSelected(null)
    setConfirmingId(null)
    await refreshRows(workspaceId)
  }

  const renderRevokeControls = (row: ConnectionListRow) => (
    confirmingId === row.id ? (
      <div className="flex gap-1">
        <button type="button" className="rounded border px-2 py-1" onClick={() => confirmRevoke(row.id)}>
          {t('connections.revokeConfirm')}
        </button>
        <button type="button" className="rounded border px-2 py-1" onClick={() => setConfirmingId(null)}>
          {t('connections.revokeCancel')}
        </button>
      </div>
    ) : (
      <button type="button" className="rounded border px-2 py-1" onClick={() => setConfirmingId(row.id)}>
        {t('connections.revoke')}
      </button>
    )
  )

  const empty = (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm">{t('connections.empty')}</p>
    </div>
  )

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
        {tab === 'imports' ? (
          <div className="space-y-3 text-sm text-foreground">
            <label className="block">
              <span className="text-muted-foreground">{t('connections.import.envPath')}</span>
              <input
                className="mt-1 w-full rounded border bg-transparent px-2 py-1 font-mono text-xs"
                value={envPath}
                onChange={(event) => setEnvPath(event.target.value)}
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={async () => {
                const previewGithubEnv = window.electronAPI?.workgraph?.previewGithubEnv
                if (typeof previewGithubEnv !== 'function' || !envPath) {
                  setPreviews((current) => current.filter((row) => row.source !== 'env'))
                  return
                }
                const next = await previewGithubEnv(envPath)
                setPreviews((current) => [
                  ...current.filter((row) => row.source !== 'env'),
                  ...next.map((row) => ({ ...row, source: 'env' as const })),
                ])
              }}
            >
              {t('connections.import.discover')}
            </button>
            <label className="block">
              <span className="text-muted-foreground">{t('connections.import.gitConfigPath')}</span>
              <input
                className="mt-1 w-full rounded border bg-transparent px-2 py-1 font-mono text-xs"
                value={gitConfigPath}
                onChange={(event) => setGitConfigPath(event.target.value)}
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={async () => {
                const previewGitHelper = window.electronAPI?.workgraph?.previewGitHelper
                if (typeof previewGitHelper !== 'function' || !gitConfigPath) {
                  setPreviews((current) => current.filter((row) => row.source !== 'git-helper'))
                  return
                }
                const next = await previewGitHelper(gitConfigPath)
                setPreviews((current) => [
                  ...current.filter((row) => row.source !== 'git-helper'),
                  ...next.map((row) => ({ ...row, source: 'git-helper' as const })),
                ])
              }}
            >
              {t('connections.import.discoverGitHelper')}
            </button>
            <ul className="space-y-2">
              {previews.map((row) => (
                <li key={`${row.source}:${row.candidateId}`} className="flex items-center justify-between rounded border px-3 py-2">
                  <div>
                    <div className="font-medium">{row.label}</div>
                    <div className="font-mono text-xs text-muted-foreground">{row.maskedSummary}</div>
                  </div>
                  <button
                    type="button"
                    className="rounded border px-2 py-1"
                    onClick={async () => {
                      const workspaceId = workspace?.id
                      if (!workspaceId) return
                      if (row.source === 'env') {
                        const importGithubEnv = window.electronAPI?.workgraph?.importGithubEnv
                        if (typeof importGithubEnv !== 'function') return
                        await importGithubEnv({ envPath, candidateId: row.candidateId, workspaceId })
                      } else {
                        const importGitHelper = window.electronAPI?.workgraph?.importGitHelper
                        if (typeof importGitHelper !== 'function') return
                        await importGitHelper({ configPath: gitConfigPath, candidateId: row.candidateId, workspaceId })
                      }
                      await refreshRows(workspaceId)
                    }}
                  >
                    {t('connections.import.commit')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : tab === 'services' && services.length > 0 ? (
          <ul className="space-y-2 text-sm text-foreground">
            {services.map((row) => (
              <li key={row.id} className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="connections-row"
                  aria-selected={selected?.id === row.id}
                  className={`min-w-0 flex-1 rounded border px-3 py-2 text-left ${selected?.id === row.id ? 'bg-accent/10' : ''}`}
                  onClick={() => setSelected(row)}
                >
                  <div className="font-medium">{row.integrationId}</div>
                  <div className="text-muted-foreground">{row.storageMode}</div>
                  <div className="font-mono text-xs">{row.credentialRefId}</div>
                </button>
                {renderRevokeControls(row)}
              </li>
            ))}
          </ul>
        ) : tab === 'credentials' && credentialRows.length > 0 ? (
          <ul className="space-y-2 text-sm text-foreground">
            {credentialRows.map((row) => (
              <li key={row.id} className="rounded border px-3 py-2">
                <div className="font-medium">{row.integrationId}</div>
                <div className="font-mono text-xs">{row.credentialRefId}</div>
                <div className="text-muted-foreground">{row.storageMode}</div>
              </li>
            ))}
          </ul>
        ) : tab === 'policies' && policyRows.length > 0 ? (
          <ul className="space-y-2 text-sm text-foreground">
            {policyRows.map((row) => (
              <li key={row.id} className="rounded border px-3 py-2">
                <div className="font-medium">{row.integrationId}</div>
                <div className="font-mono text-xs">{row.scopes.join(', ') || '—'}</div>
              </li>
            ))}
          </ul>
        ) : (
          empty
        )}
      </div>
    </div>
  )
}
