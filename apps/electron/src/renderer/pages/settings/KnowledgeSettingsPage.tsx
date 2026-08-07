/**
 * KnowledgeSettingsPage — SiYuan knowledge engine connection (P1 + P7-prep).
 *
 * Settings → Knowledge contract (spec K-11 P1): baseUrl (default
 * http://localhost:6806), token, health status.
 *
 * P7-prep adds:
 * - Detect SiYuan (LOCAL_ONLY path + port probe; never downloads)
 * - Usage (G1) metrics panel from knowledge:metricsGet
 *
 * Managed kernel remains blocked (G1 thresholds + G2 licensing). Production
 * mode is external-local only.
 *
 * The token never touches renderer-side storage: it goes through the
 * existing sources:saveCredentials RPC straight into CredentialManager under
 * 'source_bearer::{workspaceId}::{connectionId}'.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import { SettingsCard, SettingsRow, SettingsSection } from '@/components/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useActiveWorkspace } from '@/context/AppShellContext'
import type {
  KnowledgeConnection,
  KnowledgeDetectEngineResult,
  KnowledgeEngineStatus,
  KnowledgeMetricsSnapshot,
} from '../../../shared/types'

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
  degraded: 'text-warning',
  offline: 'text-muted-foreground',
  needs_auth: 'text-warning',
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
  const [detecting, setDetecting] = React.useState(false)
  const [detectResult, setDetectResult] = React.useState<KnowledgeDetectEngineResult | null>(null)
  const [metrics, setMetrics] = React.useState<KnowledgeMetricsSnapshot | null>(null)

  // MVP: a single external-local connection (spec K-03 §3.3); the list still
  // renders every entry so additional providers stay visible.
  const connection = connections?.[0] ?? null

  const loadMetrics = React.useCallback(async () => {
    if (!workspaceId) return
    try {
      if (typeof window.electronAPI.knowledge.metricsGet !== 'function') return
      const snap = await window.electronAPI.knowledge.metricsGet({ workspaceId })
      setMetrics(snap)
    } catch {
      /* metrics panel is best-effort */
    }
  }, [workspaceId])

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
        if (!cancelled) await loadMetrics()
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
  }, [t, workspaceId, loadMetrics])

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

  const handleDetect = async () => {
    setDetecting(true)
    try {
      if (typeof window.electronAPI.knowledge.detectEngine !== 'function') {
        toast.error(t('settings.knowledge.detectFailed', { message: 'detectEngine unavailable' }))
        return
      }
      const result = await window.electronAPI.knowledge.detectEngine()
      setDetectResult(result)
      if (result.runningOnDefaultPort) {
        toast.success(t('settings.knowledge.detectRunning'))
      } else if (result.installed) {
        toast.success(t('settings.knowledge.detectInstalled'))
      } else {
        toast.message(t('settings.knowledge.detectNone'))
      }
    } catch (error) {
      toast.error(t('settings.knowledge.detectFailed', { message: errorMessage(error) }))
    } finally {
      setDetecting(false)
    }
  }

  const handleOpenInstallDocs = () => {
    const url = detectResult?.installDocsUrl ?? 'https://b3log.org/siyuan/'
    void window.electronAPI.openUrl(url)
  }

  const engineStateLabel = !engineStatus
    ? t('settings.knowledge.status.unknown')
    : engineStatus.running
      ? t('settings.knowledge.status.running')
      : t('settings.knowledge.status.stopped')

  const counters = metrics?.counters

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
            <div className="flex flex-wrap gap-2 pt-1">
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleDetect()}
                disabled={detecting}
              >
                {detecting ? t('settings.knowledge.detecting') : t('settings.knowledge.detect')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleOpenInstallDocs}
              >
                {t('settings.knowledge.installDocs')}
              </Button>
            </div>
          </SettingsRow>
          {detectResult && (
            <div className="space-y-1 border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <p>
                {t('settings.knowledge.detectResult.installed')}:{' '}
                <span className="text-foreground">
                  {detectResult.installed
                    ? t('settings.knowledge.detectResult.yes')
                    : t('settings.knowledge.detectResult.no')}
                </span>
              </p>
              <p>
                {t('settings.knowledge.detectResult.running')}:{' '}
                <span className="text-foreground">
                  {detectResult.runningOnDefaultPort
                    ? t('settings.knowledge.detectResult.yes')
                    : t('settings.knowledge.detectResult.no')}
                </span>
              </p>
              <p>
                {t('settings.knowledge.detectResult.suggestedUrl')}:{' '}
                <span className="font-mono text-foreground">{detectResult.suggestedBaseUrl}</span>
              </p>
              {detectResult.installPathsFound.length > 0 && (
                <p className="break-all text-xs">
                  {t('settings.knowledge.detectResult.paths')}: {detectResult.installPathsFound.join(', ')}
                </p>
              )}
              <p className="pt-1 text-xs">{t('settings.knowledge.detectNeverDownload')}</p>
            </div>
          )}
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
          {engineStatus?.reason && (
            <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              {engineStatus.reason}
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('settings.knowledge.sectionMetrics')}>
        <SettingsCard>
          <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-2">
            <MetricRow
              label={t('settings.knowledge.metrics.connectionsActive')}
              value={counters?.connectionsActive}
            />
            <MetricRow
              label={t('settings.knowledge.metrics.publicationsTotal')}
              value={counters?.publicationsTotal}
            />
            <MetricRow
              label={t('settings.knowledge.metrics.publicationsLast7d')}
              value={counters?.publicationsLast7d}
            />
            <MetricRow
              label={t('settings.knowledge.metrics.automationProposals')}
              value={counters?.automationProposalsTotal}
            />
            <MetricRow
              label={t('settings.knowledge.metrics.automationRuns')}
              value={counters?.automationRunsTriggered}
            />
            <MetricRow
              label={t('settings.knowledge.metrics.surfaceOpens')}
              value={counters?.knowledgeSurfaceOpens}
            />
            <MetricRow
              label={t('settings.knowledge.metrics.viewRuns')}
              value={counters?.viewRunsTotal}
            />
            <MetricRow
              label={t('settings.knowledge.metrics.watchTicks')}
              value={counters?.watchTicksTotal}
            />
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <p className="text-xs text-muted-foreground">{t('settings.knowledge.metrics.g1Note')}</p>
            <Button size="sm" variant="ghost" onClick={() => void loadMetrics()}>
              {t('settings.knowledge.metrics.refresh')}
            </Button>
          </div>
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

function MetricRow({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums text-foreground">
        {typeof value === 'number' ? value : '—'}
      </span>
    </div>
  )
}
