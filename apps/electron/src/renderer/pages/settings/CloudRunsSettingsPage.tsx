/**
 * CloudRunsSettingsPage — enable/configure cloud research runs
 * (PRD docs/cloud-runs-prd.md, G3.4).
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
  tokenConfigured: boolean
  defaults: { maxWallClockSec: number; maxLlmTokens: number; maxArtifactsBytes: number }
}

export default function CloudRunsSettingsPage() {
  const { t } = useTranslation()
  const [config, setConfig] = React.useState<Config | null>(null)

  React.useEffect(() => {
    window.electronAPI
      .getCloudRunsConfig()
      .then(setConfig)
      .catch((error) => toast.error(String(error)))
  }, [])

  const patch = (p: Partial<Config> & { defaultMaxWallClockSec?: number }) => {
    window.electronAPI
      .setCloudRunsConfig(p)
      .then(() => setConfig((prev) => (prev ? { ...prev, ...p } : prev)))
      .catch((error) => toast.error(String(error)))
  }

  if (!config) return null

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">{t('settings.cloudRuns.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('settings.cloudRuns.description')}</p>
      </div>

      <SettingsSection title={t('settings.cloudRuns.general')}>
        <SettingsCard>
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
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
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
                  className="w-80"
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
                <span className={`text-xs ${config.tokenConfigured ? 'text-green-600' : 'text-destructive'}`}>
                  {config.tokenConfigured ? '✓' : '✗'}
                </span>
              </SettingsRow>
            </>
          )}
          <SettingsRow
            label={t('settings.cloudRuns.maxWallClock')}
            description={t('settings.cloudRuns.maxWallClockHint')}
          >
            <Input
              className="w-28"
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
            label={t('settings.cloudRuns.webhook')}
            description={t('settings.cloudRuns.webhookHint')}
          >
            <Input
              className="w-80"
              defaultValue={config.notifyWebhookUrl ?? ''}
              placeholder="https://example.com/cloud-runs-hook"
              onBlur={(e) => patch({ notifyWebhookUrl: e.target.value.trim() || undefined })}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}
