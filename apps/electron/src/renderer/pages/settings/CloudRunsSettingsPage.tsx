/**
 * CloudRunsSettingsPage — enable/configure cloud runs
 * (PRD docs/cloud-runs-prd.md, G3.4 + P2.8 UX rewrite).
 *
 * Reads/writes config.json via cloudRuns RPC. The provider token is NOT
 * editable here: it lives in <configDir>/cloud-runs.env (0600,
 * user-managed); the page only shows whether it's present.
 */
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsToggle,
} from '@/components/settings'
import { Input } from '@/components/ui/input'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'cloudRuns',
}

type Provider = 'local' | 'cloudflare' | 'modal' | 'e2b'
interface Config {
  enabled: boolean
  provider: Provider
  gatewayUrl?: string
  notifyWebhookUrl?: string
  cheapModelId?: string
  personas?: boolean
  tokenConfigured: boolean
  defaults: { maxWallClockSec: number; maxLlmTokens: number; maxArtifactsBytes: number }
}

const fieldClass =
  'w-full max-w-xl rounded-md border border-border bg-background px-2.5 py-1.5 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function CloudRunsSettingsPage() {
  const { t } = useTranslation()
  const [config, setConfig] = React.useState<Config | null>(null)

  React.useEffect(() => {
    window.electronAPI
      .getCloudRunsConfig()
      .then(setConfig)
      .catch((error) => toast.error(String(error)))
  }, [])

  const patch = (p: Partial<Config> & {
    defaultMaxWallClockSec?: number
    defaultMaxLlmTokens?: number
    defaultMaxArtifactsBytes?: number
  }) => {
    window.electronAPI
      .setCloudRunsConfig(p)
      .then(() =>
        setConfig((prev) => {
          if (!prev) return prev
          const next = { ...prev, ...p }
          if (p.defaultMaxWallClockSec != null) {
            next.defaults = { ...prev.defaults, maxWallClockSec: p.defaultMaxWallClockSec }
          }
          if (p.defaultMaxLlmTokens != null) {
            next.defaults = { ...next.defaults, maxLlmTokens: p.defaultMaxLlmTokens }
          }
          if (p.defaultMaxArtifactsBytes != null) {
            next.defaults = { ...next.defaults, maxArtifactsBytes: p.defaultMaxArtifactsBytes }
          }
          return next
        }),
      )
      .catch((error) => toast.error(String(error)))
  }

  if (!config) return null

  return (
    <div className="flex flex-col gap-8 p-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">{t('settings.cloudRuns.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.cloudRuns.description')}</p>
      </div>

      {/* ── Подключение ─────────────────────────────────────────── */}
      <SettingsSection title={t('settings.cloudRuns.sectionConnection')}>
        <SettingsCard className="gap-1">
          <SettingsToggle
            label={t('settings.cloudRuns.enable')}
            description={t('settings.cloudRuns.enableHint')}
            checked={config.enabled}
            onCheckedChange={(checked) => patch({ enabled: checked })}
          />
          <SettingsRow
            label={t('settings.cloudRuns.provider')}
            description={t('settings.cloudRuns.providerHint')}
          >
            <select
              className={fieldClass + ' w-56'}
              value={config.provider}
              onChange={(e) => patch({ provider: e.target.value as Provider })}
            >
              <option value="local">{t('settings.cloudRuns.providerLocal')}</option>
              <option value="cloudflare">Cloudflare</option>
              <option value="modal">Modal</option>
            </select>
          </SettingsRow>
          {(config.provider === 'cloudflare' || config.provider === 'modal') && (
            <>
              <SettingsRow
                label={t('settings.cloudRuns.gatewayUrl')}
                description={t('settings.cloudRuns.gatewayUrlHint')}
              >
                <Input
                  className={fieldClass}
                  defaultValue={config.gatewayUrl ?? ''}
                  placeholder="https://craft-cloud-gateway.<sub>.workers.dev"
                  onBlur={(e) => patch({ gatewayUrl: e.target.value.trim() || undefined })}
                />
              </SettingsRow>
              <SettingsRow
                label={t('settings.cloudRuns.token')}
                description={
                  config.tokenConfigured
                    ? t('settings.cloudRuns.tokenSet')
                    : t('settings.cloudRuns.tokenMissing')
                }
              >
                <span
                  className={`inline-flex h-7 min-w-[2rem] items-center justify-center rounded-md border px-2 text-xs font-medium ${
                    config.tokenConfigured
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-destructive/40 bg-destructive/10 text-destructive'
                  }`}
                >
                  {config.tokenConfigured ? '✓' : '✗'}
                </span>
              </SettingsRow>
            </>
          )}
          <SettingsRow
            label={t('settings.cloudRuns.webhook')}
            description={t('settings.cloudRuns.webhookHint')}
          >
            <Input
              className={fieldClass}
              defaultValue={config.notifyWebhookUrl ?? ''}
              placeholder="https://example.com/cloud-runs-hook"
              onBlur={(e) => patch({ notifyWebhookUrl: e.target.value.trim() || undefined })}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {/* ── Лимиты ──────────────────────────────────────────────── */}
      <SettingsSection title={t('settings.cloudRuns.sectionLimits')}>
        <SettingsCard>
          <SettingsRow
            label={t('settings.cloudRuns.maxWallClock')}
            description={t('settings.cloudRuns.maxWallClockHint')}
          >
            <Input
              className={fieldClass + ' w-32'}
              type="number"
              min={60}
              defaultValue={config.defaults.maxWallClockSec}
              onBlur={(e) => {
                const value = Number(e.target.value)
                if (Number.isInteger(value) && value >= 60) patch({ defaultMaxWallClockSec: value })
              }}
            />
          </SettingsRow>
          <SettingsRow
            label={t('settings.cloudRuns.maxLlmTokens')}
            description={t('settings.cloudRuns.maxLlmTokensHint')}
          >
            <Input
              className={fieldClass + ' w-40'}
              type="number"
              min={10_000}
              defaultValue={config.defaults.maxLlmTokens}
              onBlur={(e) => {
                const value = Number(e.target.value)
                if (Number.isInteger(value) && value >= 10_000) patch({ defaultMaxLlmTokens: value })
              }}
            />
          </SettingsRow>
          <SettingsRow
            label={t('settings.cloudRuns.maxArtifacts')}
            description={t('settings.cloudRuns.maxArtifactsHint')}
          >
            <Input
              className={fieldClass + ' w-40'}
              type="number"
              min={1_000_000}
              defaultValue={config.defaults.maxArtifactsBytes}
              onBlur={(e) => {
                const value = Number(e.target.value)
                if (Number.isInteger(value) && value >= 1_000_000) {
                  patch({ defaultMaxArtifactsBytes: value })
                }
              }}
            />
          </SettingsRow>
          <SettingsRow
            label={t('settings.cloudRuns.cheapModel')}
            description={t('settings.cloudRuns.cheapModelHint')}
          >
            <Input
              className={fieldClass + ' w-64'}
              defaultValue={config.cheapModelId ?? ''}
              placeholder="kimi-lite / gpt-4o-mini"
              onBlur={(e) => patch({ cheapModelId: e.target.value.trim() || undefined })}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {/* ── Расписание ──────────────────────────────────────────── */}
      <SettingsSection title={t('settings.cloudRuns.sectionSchedule')}>
        <SettingsCard>
          <div className="px-4 py-3 text-sm text-muted-foreground space-y-2">
            <p>{t('settings.cloudRuns.scheduleHelp')}</p>
            <p className="text-xs opacity-80">{t('settings.cloudRuns.everyHoursHelp')}</p>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* ── Персоны ─────────────────────────────────────────────── */}
      <SettingsSection title={t('settings.cloudRuns.sectionPersonas')}>
        <SettingsCard>
          <SettingsToggle
            label={t('settings.cloudRuns.personasLbl')}
            description={t('settings.cloudRuns.personasHint')}
            checked={config.personas ?? false}
            onCheckedChange={(checked) => patch({ personas: checked })}
          />
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}
