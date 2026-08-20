import { useAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { selectedConnectionAtom } from '@/atoms/connections'
import { useActiveWorkspace } from '@/context/AppShellContext'
import { sanitizeConnectionRows, type ConnectionListRow } from './connections-list'

const TABS = ['services', 'credentials', 'imports', 'policies', 'audit'] as const
const CONNECT_SOURCES = ['github-env', 'git-helper', 'docker', 'aws', 'keychain', 'adc', 'ssh-agent'] as const
type ConnectionsTab = (typeof TABS)[number]
type PreviewSource = 'env' | 'git-helper' | 'docker' | 'aws' | 'keychain' | 'adc' | 'ssh-agent'
type PreviewRow = {
  candidateId: string
  label: string
  maskedSummary: string
  source: PreviewSource
}
type SurfaceState = 'ready' | 'unavailable' | 'error'

function classifyFailClosed(error: unknown): SurfaceState {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/unsupported_test|_unavailable|unavailable/i.test(message)) return 'unavailable'
  if (/not found/i.test(message)) return 'error'
  return 'error'
}

export default function ConnectionsPage() {
  const { t } = useTranslation()
  const workspace = useActiveWorkspace()
  const [tab, setTab] = useState<ConnectionsTab>('services')
  const [selected, setSelected] = useAtom(selectedConnectionAtom)
  const [rows, setRows] = useState<ConnectionListRow[] | null>(null)
  const [surface, setSurface] = useState<SurfaceState>('ready')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const [envPath, setEnvPath] = useState('')
  const [gitConfigPath, setGitConfigPath] = useState('')
  const [dockerConfigPath, setDockerConfigPath] = useState('')
  const [awsCredentialsPath, setAwsCredentialsPath] = useState('')
  const [awsConfigPath, setAwsConfigPath] = useState('')
  const [adcPath, setAdcPath] = useState('')
  const [previews, setPreviews] = useState<PreviewRow[]>([])

  useEffect(() => {
    const workspaceId = workspace?.id
    const listConnections = window.electronAPI?.workgraph?.listConnections
    if (!workspaceId || typeof listConnections !== 'function') {
      setRows([])
      setSurface('unavailable')
      return
    }
    let stale = false
    listConnections(workspaceId)
      .then((raw) => {
        if (stale) return
        setRows(sanitizeConnectionRows(raw))
        setSurface('ready')
      })
      .catch((error) => {
        if (stale) return
        setRows([])
        setSurface(classifyFailClosed(error))
      })
    return () => {
      stale = true
      setSelected(null)
      setConfirmingId(null)
      setRotatingId(null)
    }
  }, [workspace?.id, setSelected])

  const refreshRows = async (workspaceId: string) => {
    const listConnections = window.electronAPI?.workgraph?.listConnections
    if (typeof listConnections !== 'function') {
      setSurface('unavailable')
      return
    }
    try {
      setRows(sanitizeConnectionRows(await listConnections(workspaceId)))
      setSurface('ready')
    } catch (error) {
      setRows([])
      setSurface(classifyFailClosed(error))
    }
  }

  const listed = rows ?? []
  const services = tab === 'services' ? listed : []
  const credentialRows = tab === 'credentials' ? listed : []
  const policyRows = tab === 'policies' ? listed : []
  const failClosed = tab === 'services' && surface !== 'ready'

  const confirmRevoke = async (connectionId: string) => {
    const workspaceId = workspace?.id
    const revokeConnection = window.electronAPI?.workgraph?.revokeConnection
    if (!workspaceId || typeof revokeConnection !== 'function') {
      setSurface('unavailable')
      return
    }
    try {
      await revokeConnection({ workspaceId, connectionId })
      if (selected?.id === connectionId) setSelected(null)
      setConfirmingId(null)
      await refreshRows(workspaceId)
    } catch (error) {
      setSurface(classifyFailClosed(error))
    }
  }

  const confirmRotate = async (connectionId: string) => {
    const workspaceId = workspace?.id
    const rotateConnection = window.electronAPI?.workgraph?.rotateConnection
    if (!workspaceId || typeof rotateConnection !== 'function') {
      setSurface('unavailable')
      return
    }
    try {
      await rotateConnection({ workspaceId, connectionId })
      setRotatingId(null)
      await refreshRows(workspaceId)
    } catch (error) {
      setSurface(classifyFailClosed(error))
    }
  }

  const runTest = async (connectionId: string) => {
    const workspaceId = workspace?.id
    const testConnection = window.electronAPI?.workgraph?.testConnection
    if (!workspaceId || typeof testConnection !== 'function') {
      setSurface('unavailable')
      return
    }
    try {
      await testConnection({ workspaceId, connectionId })
    } catch (error) {
      setSurface(classifyFailClosed(error))
    }
  }

  const runRepair = async (connectionId: string) => {
    const workspaceId = workspace?.id
    const repairConnection = window.electronAPI?.workgraph?.repairConnection
    if (!workspaceId || typeof repairConnection !== 'function') {
      setSurface('unavailable')
      return
    }
    try {
      await repairConnection({ workspaceId, connectionId })
      await refreshRows(workspaceId)
    } catch (error) {
      setSurface(classifyFailClosed(error))
    }
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

  const renderRotateControls = (row: ConnectionListRow) => (
    rotatingId === row.id ? (
      <div className="flex gap-1">
        <button type="button" className="rounded border px-2 py-1" onClick={() => confirmRotate(row.id)}>
          {t('connections.rotateConfirm')}
        </button>
        <button type="button" className="rounded border px-2 py-1" onClick={() => setRotatingId(null)}>
          {t('connections.rotateCancel')}
        </button>
      </div>
    ) : (
      <button type="button" className="rounded border px-2 py-1" onClick={() => setRotatingId(row.id)}>
        {t('connections.rotate')}
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
        <button
          type="button"
          className="ml-auto rounded border px-3 py-1 text-sm text-foreground"
          onClick={() => setTab('imports')}
        >
          {t('connections.connect')}
        </button>
      </div>
      <div className="flex flex-1 min-h-0 flex-col p-6 text-muted-foreground">
        {tab === 'imports' ? (
          <div className="space-y-3 text-sm text-foreground">
            <ul className="flex flex-wrap gap-2 text-xs">
              {CONNECT_SOURCES.map((source) => (
                <li key={source} className="rounded border px-2 py-1">{source}</li>
              ))}
            </ul>
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
            <label className="block">
              <span className="text-muted-foreground">{t('connections.import.dockerConfigPath')}</span>
              <input
                className="mt-1 w-full rounded border bg-transparent px-2 py-1 font-mono text-xs"
                value={dockerConfigPath}
                onChange={(event) => setDockerConfigPath(event.target.value)}
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={async () => {
                const previewDockerHelper = window.electronAPI?.workgraph?.previewDockerHelper
                if (typeof previewDockerHelper !== 'function' || !dockerConfigPath) {
                  setPreviews((current) => current.filter((row) => row.source !== 'docker'))
                  return
                }
                const next = await previewDockerHelper(dockerConfigPath)
                setPreviews((current) => [
                  ...current.filter((row) => row.source !== 'docker'),
                  ...next.map((row) => ({ ...row, source: 'docker' as const })),
                ])
              }}
            >
              {t('connections.import.discoverDocker')}
            </button>
            <label className="block">
              <span className="text-muted-foreground">{t('connections.import.awsCredentialsPath')}</span>
              <input
                className="mt-1 w-full rounded border bg-transparent px-2 py-1 font-mono text-xs"
                value={awsCredentialsPath}
                onChange={(event) => setAwsCredentialsPath(event.target.value)}
                spellCheck={false}
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground">{t('connections.import.awsConfigPath')}</span>
              <input
                className="mt-1 w-full rounded border bg-transparent px-2 py-1 font-mono text-xs"
                value={awsConfigPath}
                onChange={(event) => setAwsConfigPath(event.target.value)}
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={async () => {
                const previewAwsProfiles = window.electronAPI?.workgraph?.previewAwsProfiles
                if (typeof previewAwsProfiles !== 'function') {
                  setPreviews((current) => current.filter((row) => row.source !== 'aws'))
                  return
                }
                const next = await previewAwsProfiles({ credentialsPath: awsCredentialsPath, configPath: awsConfigPath })
                setPreviews((current) => [
                  ...current.filter((row) => row.source !== 'aws'),
                  ...next.map((row) => ({ ...row, source: 'aws' as const })),
                ])
              }}
            >
              {t('connections.import.discoverAws')}
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={async () => {
                const previewKeychain = window.electronAPI?.workgraph?.previewKeychain
                if (typeof previewKeychain !== 'function') {
                  setPreviews((current) => current.filter((row) => row.source !== 'keychain'))
                  return
                }
                const next = await previewKeychain()
                setPreviews((current) => [
                  ...current.filter((row) => row.source !== 'keychain'),
                  ...next.map((row) => ({ ...row, source: 'keychain' as const })),
                ])
              }}
            >
              {t('connections.import.discoverKeychain')}
            </button>
            <label className="block">
              <span className="text-muted-foreground">{t('connections.import.adcPath')}</span>
              <input
                className="mt-1 w-full rounded border bg-transparent px-2 py-1 font-mono text-xs"
                value={adcPath}
                onChange={(event) => setAdcPath(event.target.value)}
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={async () => {
                const previewAdc = window.electronAPI?.workgraph?.previewAdc
                if (typeof previewAdc !== 'function' || !adcPath) {
                  setPreviews((current) => current.filter((row) => row.source !== 'adc'))
                  return
                }
                const next = await previewAdc(adcPath)
                setPreviews((current) => [
                  ...current.filter((row) => row.source !== 'adc'),
                  ...next.map((row) => ({ ...row, source: 'adc' as const })),
                ])
              }}
            >
              {t('connections.import.discoverAdc')}
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={async () => {
                const previewSshAgent = window.electronAPI?.workgraph?.previewSshAgent
                if (typeof previewSshAgent !== 'function') {
                  setPreviews((current) => current.filter((row) => row.source !== 'ssh-agent'))
                  return
                }
                const next = await previewSshAgent()
                setPreviews((current) => [
                  ...current.filter((row) => row.source !== 'ssh-agent'),
                  ...next.map((row) => ({ ...row, source: 'ssh-agent' as const })),
                ])
              }}
            >
              {t('connections.import.discoverSshAgent')}
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
                      const api = window.electronAPI?.workgraph
                      if (!workspaceId || !api) return
                      if (row.source === 'env' && api.importGithubEnv) {
                        await api.importGithubEnv({ envPath, candidateId: row.candidateId, workspaceId })
                      } else if (row.source === 'git-helper' && api.importGitHelper) {
                        await api.importGitHelper({ configPath: gitConfigPath, candidateId: row.candidateId, workspaceId })
                      } else if (row.source === 'docker' && api.importDockerHelper) {
                        await api.importDockerHelper({ configPath: dockerConfigPath, candidateId: row.candidateId, workspaceId })
                      } else if (row.source === 'aws' && api.importAwsProfile) {
                        await api.importAwsProfile({ credentialsPath: awsCredentialsPath, configPath: awsConfigPath, candidateId: row.candidateId, workspaceId })
                      } else if (row.source === 'keychain' && api.importKeychain) {
                        await api.importKeychain({ candidateId: row.candidateId, workspaceId })
                      } else if (row.source === 'adc' && api.importAdc) {
                        await api.importAdc({ credentialsPath: adcPath, candidateId: row.candidateId, workspaceId })
                      } else if (row.source === 'ssh-agent' && api.importSshAgent) {
                        await api.importSshAgent({ candidateId: row.candidateId, workspaceId })
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
        ) : failClosed ? (
          <div
            className="flex flex-1 items-center justify-center"
            data-testid="connections-services-unavailable"
            role="alert"
          >
            <p className="text-sm">
              {t(surface === 'unavailable' ? 'sidebar.connectionsUnavailable' : 'chat.connectionUnavailable')}
            </p>
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
                <button type="button" className="rounded border px-2 py-1" onClick={() => runTest(row.id)}>
                  {t('connections.test')}
                </button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => runRepair(row.id)}>
                  {t('connections.repair')}
                </button>
                {renderRevokeControls(row)}
                {renderRotateControls(row)}
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
