/**
 * KnowledgeSettingsPage — SiYuan knowledge engine connection (P1, read-only).
 *
 * Settings → Knowledge contract (spec K-11 P1): baseUrl (default
 * http://localhost:6806), token, health status.
 *
 * The token never touches renderer-side storage: it goes through the
 * existing sources:saveCredentials RPC straight into CredentialManager under
 * 'source_bearer::{workspaceId}::{connectionId}'. No knowledge mutation
 * channels exist in P1 — listConnections/engineStatus are the only
 * knowledge RPC calls the page makes (read-only by contract), so the
 * baseUrl field is informational until a save-connection channel lands.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import { SettingsCard, SettingsRow, SettingsSection } from '@/components/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useActiveWorkspace } from '@/context/AppShellContext'
import type { KnowledgeConnection, KnowledgeEngineStatus } from '../../../shared/types'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'knowledge',
}

const DEFAULT_BASE_URL = 'http://localhost:6806'

const CONNECTION_STATUS_LABEL_KEYS: Record<KnowledgeConnection['status'], string> = {
  connected: 'settings.knowledge.status.connected',
  degraded: 'settings.knowledge.status.degraded',
  offline: 'settings.knowledge.status.offline',
  needs_auth: 'settings.knowledge.status.needsAuth',
}

const CONNECTION_STATUS_TONE: Record<KnowledgeConnection['status'], string> = {
  connected: 'text-success',
  degraded: 'text-amber-500',
  offline: 'text-destructive',
  needs_auth: 'text-amber-500',
}

const ENGINE_MODE_LABEL_KEYS: Record<string, string> = {
  'external-local': 'settings.knowledge.mode.externalLocal',
  managed: 'settings.knowledge.mode.managed',
  remote: 'settings.knowledge.mode.remote',
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function KnowledgeSettingsPage() {
  const { t } = useTranslation()
  const activeWorkspace = useActiveWorkspace()
  const workspaceId = activeWorkspace?.id

  const [connections, setConnections] = React.useState<KnowledgeConnection[] | null>(null)
  const [engineStatus, setEngineStatus] = React.useState<KnowledgeEngineStatus | null>(null)
  const [token, setToken] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)

  // MVP: a single external-local connection (spec K-03 §3.3); the list still
  // renders every entry so additional providers stay visible.
  const connection = connections?.[0] ?? null

  React.useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    const load = async () => {
      try {
        const list = await window.electronAPI.knowledge.listConnections()
        if (cancelled) return
        setConnections(list)
        const first = list[0]
        if (first) {
          const status = await window.electronAPI.knowledge.engineStatus({ workspaceId, connectionId: first.id })
          if (!cancelled) setEngineStatus(status)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(t('settings.knowledge.loadFailed', { message: errorMessage(error) }))
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [t, workspaceId])

  const handleSaveToken = async () => {
    const trimmed = token.trim()
    if (!workspaceId || !connection || !trimmed) return
    setSaving(true)
    try {
      await window.electronAPI.saveSourceCredentials(workspaceId, connection.id, trimmed)
      setToken('')
      toast.success(t('settings.knowledge.tokenSaved'))
    } catch (error) {
      toast.error(t('settings.knowledge.tokenSaveFailed', { message: errorMessage(error) }))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!workspaceId || !connection) return
    setTesting(true)
    try {
      const status = await window.electronAPI.knowledge.engineStatus({ workspaceId, connectionId: connection.id })
      setEngineStatus(status)
      toast.success(t('settings.knowledge.testOk'))
    } catch (error) {
      toast.error(t('settings.knowledge.testFailed', { message: errorMessage(error) }))
    } finally {
      setTesting(false)
    }
  }

  const engineStateLabel = !engineStatus
    ? t('settings.knowledge.status.unknown')
    : engineStatus.running
      ? t('settings.knowledge.status.running')
      : t('settings.knowledge.status.stopped')

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">{t('settings.knowledge.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('settings.knowledge.description')}</p>
      </div>

      <SettingsSection title={t('settings.knowledge.sectionConnection')}>
        <SettingsCard>
          <SettingsRow
            label={t('settings.knowledge.baseUrl')}
            description={t('settings.knowledge.baseUrlHint')}
          >
            <Input
              className="w-80"
              value={connection?.baseUrl ?? DEFAULT_BASE_URL}
              disabled
              readOnly
            />
          </SettingsRow>
          <SettingsRow
            label={t('settings.knowledge.token')}
            description={t('settings.knowledge.tokenHint')}
          >
            <Input
              className="w-80"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="••••••••"
              autoComplete="off"
              disabled={!connection}
            />
          </SettingsRow>
          <SettingsRow label="">
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => void handleSaveToken()}
                disabled={!workspaceId || !connection || !token.trim() || saving}
              >
                {t('settings.knowledge.saveToken')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleTest()}
                disabled={!connection || testing}
              >
                {testing ? t('settings.knowledge.testing') : t('settings.knowledge.test')}
              </Button>
            </div>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('settings.knowledge.sectionEngine')}>
        <SettingsCard>
          <SettingsRow label={t('settings.knowledge.engineState')}>
            <span className={`text-sm ${engineStatus?.running ? 'text-success' : 'text-muted-foreground'}`}>
              {engineStateLabel}
            </span>
          </SettingsRow>
          <SettingsRow label={t('settings.knowledge.engineMode')}>
            <span className="text-sm text-muted-foreground">
              {engineStatus
                ? t(ENGINE_MODE_LABEL_KEYS[engineStatus.mode] ?? 'settings.knowledge.mode.externalLocal')
                : t('settings.knowledge.status.unknown')}
            </span>
          </SettingsRow>
          <SettingsRow label={t('settings.knowledge.engineVersion')}>
            <span className="text-sm text-muted-foreground">{engineStatus?.version ?? '—'}</span>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {connections !== null && (
        <SettingsSection title={t('settings.knowledge.connectionsTitle')}>
          <SettingsCard>
            {connections.length === 0 ? (
              <div className="px-4 py-4">
                <p className="text-sm font-medium">{t('settings.knowledge.connectionEmptyTitle')}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {t('settings.knowledge.connectionEmptyBody')}
                </p>
              </div>
            ) : (
              connections.map((conn) => (
                <div key={conn.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{conn.label}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {conn.baseUrl ?? DEFAULT_BASE_URL} · {conn.provider}
                    </div>
                  </div>
                  <span className={`text-xs ${CONNECTION_STATUS_TONE[conn.status]}`}>
                    {t(CONNECTION_STATUS_LABEL_KEYS[conn.status])}
                  </span>
                </div>
              ))
            )}
          </SettingsCard>
        </SettingsSection>
      )}
    </div>
  )
}
