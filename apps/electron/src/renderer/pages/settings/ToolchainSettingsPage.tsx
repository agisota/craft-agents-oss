/**
 * ToolchainSettingsPage
 *
 * Status surface for the toolchain download manager (spec 2026-08-06):
 * the first-run background downloads of the agent runtime tools (omp, node,
 * python, ffmpeg, …). The manager installs/updates everything on its own —
 * this page is a read window plus manual "Update now" / "Retry" actions.
 *
 * Hidden entirely when the connected server has no toolchain handler
 * (headless/remote transport without the manager) — see useToolchainStatus.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { routes } from '@/lib/navigate'
import { Spinner } from '@craft-agent/ui'
import { AlertTriangle, CheckCircle2, CloudOff } from 'lucide-react'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type { ToolchainToolStatus, ToolchainToolName } from '../../../shared/types'
import { cn } from '@/lib/utils'

import { SettingsSection, SettingsCard } from '@/components/settings'
import { useToolchainStatus } from '@/hooks/useToolchainStatus'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'toolchain',
}

// ============================================
// Tool metadata (renderer-side)
// ============================================

/**
 * Display names + stable row order for the manifest tools. Kept in the
 * renderer because the wire ToolStatus intentionally carries no UI copy and
 * the shared manifest may be partially collected.
 */
const TOOL_ORDER: ToolchainToolName[] = [
  'omp',
  'bun',
  'uv',
  'node',
  'python',
  'git',
  'gh',
  'jq',
  'yq',
  'ffmpeg',
  'pandoc',
]

const TOOL_LABELS: Record<ToolchainToolName, string> = {
  omp: 'OMP runtime',
  bun: 'Bun',
  uv: 'uv',
  node: 'Node.js LTS',
  python: 'Python 3.12',
  git: 'git',
  gh: 'GitHub CLI',
  jq: 'jq',
  yq: 'yq',
  ffmpeg: 'ffmpeg',
  pandoc: 'pandoc',
}

// ============================================
// Helpers
// ============================================

/** Format bytes as compact MB, locale-agnostic. */
function formatSizeMb(bytes?: number): string | undefined {
  if (!bytes || bytes <= 0) return undefined
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Download progress percentage 0–100, or undefined when indeterminate. */
function downloadPercent(tool: ToolchainToolStatus): number | undefined {
  if (!tool.totalBytes || tool.totalBytes <= 0 || !tool.downloadedBytes) return undefined
  return Math.min(100, Math.max(0, Math.round((tool.downloadedBytes / tool.totalBytes) * 100)))
}

// ============================================
// Status badge
// ============================================

/** Small status chip styled after the existing settings badges. */
function StatusBadge({ tone, children }: { tone: 'muted' | 'warn' | 'error' | 'ok'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-5 px-2 text-[11px] font-medium rounded-[4px]',
        tone === 'muted' && 'bg-background shadow-minimal text-foreground/60',
        tone === 'ok' && 'bg-background shadow-minimal text-foreground/60',
        tone === 'warn' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        tone === 'error' && 'bg-destructive/10 text-destructive',
      )}
    >
      {children}
    </span>
  )
}

// ============================================
// Tool row
// ============================================

interface ToolRowProps {
  tool: ToolchainToolStatus
  isUpdating: boolean
  onUpdate: (name: ToolchainToolName) => void
}

function ToolRow({ tool, isUpdating, onUpdate }: ToolRowProps) {
  const { t } = useTranslation()

  const sizeLabel = formatSizeMb(tool.totalBytes)
  const versionLabel = tool.installedVersion ? `v${tool.installedVersion}` : undefined

  // Meta line: phase label + version + size (locale-independent ordering,
  // consistent with the "· "-joined rows elsewhere in settings)
  const metaParts: string[] = [t(`settings.toolchain.status.${tool.phase}`)]
  if (versionLabel) metaParts.push(versionLabel)
  if (sizeLabel) metaParts.push(sizeLabel)
  const meta = metaParts.join(' · ')

  const percent = downloadPercent(tool)
  const showProgress = tool.phase === 'downloading'

  const action = (() => {
    if (tool.phase === 'outdated') {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={isUpdating}
          onClick={() => onUpdate(tool.name)}
        >
          {isUpdating ? <Spinner className="mr-1.5" /> : null}
          {t('settings.toolchain.updateNow')}
        </Button>
      )
    }
    if (tool.phase === 'error') {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={isUpdating}
          onClick={() => onUpdate(tool.name)}
        >
          {isUpdating ? <Spinner className="mr-1.5" /> : null}
          {t('settings.toolchain.retry')}
        </Button>
      )
    }
    return null
  })()

  const badge = (() => {
    switch (tool.phase) {
      case 'ready':
        return (
          <StatusBadge tone="ok">
            <CheckCircle2 className="h-3 w-3" />
          </StatusBadge>
        )
      case 'outdated':
        return <StatusBadge tone="muted">{t('settings.toolchain.status.outdated')}</StatusBadge>
      case 'error':
        return (
          <StatusBadge tone="error">
            <AlertTriangle className="h-3 w-3" />
            {t('settings.toolchain.status.error')}
          </StatusBadge>
        )
      case 'offline':
        return (
          <StatusBadge tone="warn">
            <CloudOff className="h-3 w-3" />
            {t('settings.toolchain.status.offline')}
          </StatusBadge>
        )
      case 'downloading':
      case 'installing':
        return (
          <StatusBadge tone="muted">
            {percent != null ? `${percent}%` : t(`settings.toolchain.status.${tool.phase}`)}
          </StatusBadge>
        )
      default:
        return null
    }
  })()

  return (
    <div data-layout="settings-row" className="w-full px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{TOOL_LABELS[tool.name]}</div>
          <div className="text-sm text-muted-foreground truncate">
            {meta}
            {tool.phase === 'error' && tool.error && (
              <span className="text-destructive" title={tool.error}>
                {' '}
                — {tool.error}
              </span>
            )}
          </div>
        </div>
        <div data-layout="settings-control" className="flex items-center gap-2 ml-4 shrink-0">
          {badge}
          {action}
        </div>
      </div>
      {showProgress && (
        <div className="mt-2 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
          <div
            className={cn('h-full bg-foreground/60', percent != null && 'transition-all')}
            style={{ width: `${percent ?? 100}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ============================================
// Main Component
// ============================================

export default function ToolchainSettingsPage() {
  const { t } = useTranslation()
  const { available, isLoading, tools, updateTool, updating } = useToolchainStatus()

  const orderedTools = useMemo(() => {
    const byName: Partial<Record<ToolchainToolName, ToolchainToolStatus>> = {}
    for (const tool of tools) byName[tool.name] = tool
    return TOOL_ORDER.map((name) => byName[name]).filter(
      (tool): tool is ToolchainToolStatus => tool !== undefined,
    )
  }, [tools])

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title={t('settings.toolchain.title')}
        actions={<HeaderMenu route={routes.view.settings('toolchain')} />}
      />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto">
            {available && (
              <div className="space-y-8">
                <SettingsSection
                  title={t('settings.toolchain.toolsTitle')}
                  description={t('settings.toolchain.toolsDesc')}
                >
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Spinner className="w-4 h-4" />
                    </div>
                  ) : orderedTools.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      {t('settings.toolchain.empty')}
                    </div>
                  ) : (
                    <SettingsCard>
                      {orderedTools.map((tool) => (
                        <ToolRow
                          key={tool.name}
                          tool={tool}
                          isUpdating={updating === tool.name}
                          onUpdate={updateTool}
                        />
                      ))}
                    </SettingsCard>
                  )}
                </SettingsSection>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
