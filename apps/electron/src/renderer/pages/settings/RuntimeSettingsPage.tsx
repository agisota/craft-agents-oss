/**
 * RuntimeSettingsPage — AI runtime management:
 * - pointer to LLM connection settings (single source: AI settings page)
 * - default thinking level
 * - workspace approval (permission) mode
 * - toolchain status rows (phase/progress, manual update/retry) + enable/disable
 *   toggles (toolchain.disabled)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, ChevronRight, CloudOff, Plus, X } from 'lucide-react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { navigate, routes } from '@/lib/navigate'
import { useAppShellContext } from '@/context/AppShellContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@craft-agent/ui'
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SettingsToggle,
  SettingsMenuSelectRow,
} from '@/components/settings'
import { useToolchainStatus } from '@/hooks/useToolchainStatus'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type { PermissionMode, ThinkingLevel, ToolchainToolName, ToolchainToolStatus } from '../../../shared/types'
import { cn } from '@/lib/utils'
import { DEFAULT_THINKING_LEVEL, THINKING_LEVELS } from '@craft-agent/shared/agent/thinking-levels'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'runtime',
}

// ============================================
// Toolchain status rows (restored from the absorbed ToolchainSettingsPage)
// ============================================

/**
 * Preferred display order for status rows. Unknown/new tools from the manager
 * append alphabetically after this list so default-on/opt-in (just, fzf, gbrain…)
 * are never dropped from the Runtime status section.
 */
const TOOL_ORDER: readonly ToolchainToolName[] = [
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
  'just',
  'fzf',
  'mise',
  'worktrunk',
  'gbrain',
  'opencode-ai',
  'oh-my-codex',
  'oh-my-claude-sisyphus',
  'skills',
  'infisical',
  'eve',
  'agent-browser',
  'portless',
  'just-bash',
  'opensrc',
  'deepsec',
  'dev3000',
  'mole',
  'docker',
  'brew',
]

const TOOL_LABELS: Partial<Record<ToolchainToolName, string>> = {
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
  just: 'just',
  fzf: 'fzf',
  mise: 'mise',
  worktrunk: 'worktrunk (wt)',
  gbrain: 'gbrain',
  'opencode-ai': 'OpenCode',
  'oh-my-codex': 'oh-my-codex',
  'oh-my-claude-sisyphus': 'oh-my-claude-sisyphus',
  skills: 'skills CLI',
  infisical: 'Infisical CLI',
  eve: 'eve',
  'agent-browser': 'agent-browser',
  portless: 'portless',
  'just-bash': 'just-bash',
  opensrc: 'opensrc',
  deepsec: 'deepsec',
  dev3000: 'dev3000',
  mole: 'Mole',
  docker: 'Docker',
  brew: 'Homebrew',
}

/** Extract a displayable message from an unknown caught value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

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
          <div className="text-sm font-medium">{TOOL_LABELS[tool.name] ?? tool.name}</div>
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

export default function RuntimeSettingsPage() {
  const { t } = useTranslation()
  const { available, isLoading, tools, updateTool, updating } = useToolchainStatus()
  const activeWorkspaceId = useAppShellContext().activeWorkspaceId
  const [disabledTools, setDisabledTools] = useState<ToolchainToolName[]>([])
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(DEFAULT_THINKING_LEVEL)
  const [permissionMode, setPermissionMode] = useState<PermissionMode | null>(null)
  const [envEntries, setEnvEntries] = useState<Array<{ key: string; value: string }> | null>(null)
  const [envSaving, setEnvSaving] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  const orderedTools = useMemo(() => {
    const byName: Partial<Record<ToolchainToolName, ToolchainToolStatus>> = {}
    for (const tool of tools) byName[tool.name] = tool
    const preferred = TOOL_ORDER.map((name) => byName[name]).filter(
      (tool): tool is ToolchainToolStatus => tool !== undefined,
    )
    const preferredSet = new Set(TOOL_ORDER)
    const extras = tools
      .filter((tool) => !preferredSet.has(tool.name))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
    return [...preferred, ...extras]
  }, [tools])

  useEffect(() => {
    window.electronAPI
      .getToolchainDisabled()
      .then(setDisabledTools)
      .catch((error) => {
        console.error('Failed to load disabled toolchain tools:', error)
        setPageError(errorMessage(error))
      })
    window.electronAPI
      .getDefaultThinkingLevel()
      .then(setThinkingLevel)
      .catch((error) => {
        console.error('Failed to load default thinking level:', error)
        setPageError(errorMessage(error))
      })
    window.electronAPI
      .getEnvOverrides()
      .then((env) => setEnvEntries(Object.entries(env).map(([key, value]) => ({ key, value }))))
      .catch((error) => {
        console.error('Failed to load session env overrides:', error)
        setPageError(errorMessage(error))
        setEnvEntries([])
      })
  }, [])

  useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI
      .getWorkspaceSettings(activeWorkspaceId)
      .then((settings) => setPermissionMode(settings?.permissionMode ?? 'ask'))
      .catch((error) => {
        console.error('Failed to load workspace permission mode:', error)
        setPageError(errorMessage(error))
      })
  }, [activeWorkspaceId])

  const toggleTool = async (name: ToolchainToolName, enabled: boolean) => {
    const next = enabled
      ? disabledTools.filter((n) => n !== name)
      : [...disabledTools, name]
    setDisabledTools(next)
    setPageError(null)
    try {
      await window.electronAPI.setToolchainDisabled(next)
    } catch (error) {
      console.error('Failed to update disabled toolchain tools:', error)
      setPageError(errorMessage(error))
    }
  }

  const handleThinkingLevelChange = useCallback(async (level: ThinkingLevel) => {
    const previous = thinkingLevel
    setThinkingLevel(level)
    setPageError(null)
    try {
      const result = await window.electronAPI.setDefaultThinkingLevel(level)
      if (!result.success) {
        console.error('Failed to set default thinking level:', result.error)
        setPageError(result.error ?? t('common.failed'))
        setThinkingLevel(previous)
      }
    } catch (error) {
      console.error('Failed to set default thinking level:', error)
      setPageError(errorMessage(error))
      setThinkingLevel(previous)
    }
  }, [thinkingLevel])

  const handlePermissionModeChange = useCallback(async (mode: PermissionMode) => {
    if (!activeWorkspaceId) return
    const previous = permissionMode
    setPermissionMode(mode)
    setPageError(null)
    try {
      await window.electronAPI.updateWorkspaceSetting(activeWorkspaceId, 'permissionMode', mode)
    } catch (error) {
      console.error('Failed to update permission mode:', error)
      setPageError(errorMessage(error))
      setPermissionMode(previous)
    }
  }, [activeWorkspaceId, permissionMode])

  const updateEnvEntry = useCallback((index: number, patch: Partial<{ key: string; value: string }>) => {
    setEnvEntries((entries) => entries?.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) ?? entries)
  }, [])

  const removeEnvEntry = useCallback((index: number) => {
    setEnvEntries((entries) => entries?.filter((_, i) => i !== index) ?? entries)
  }, [])

  const addEnvEntry = useCallback(() => {
    setEnvEntries((entries) => [...(entries ?? []), { key: '', value: '' }])
  }, [])

  const saveEnvOverrides = useCallback(async () => {
    if (!envEntries) return
    setEnvSaving(true)
    setPageError(null)
    try {
      const env: Record<string, string> = {}
      for (const { key, value } of envEntries) {
        const trimmedKey = key.trim()
        if (trimmedKey) env[trimmedKey] = value
      }
      await window.electronAPI.setEnvOverrides(env)
    } catch (error) {
      console.error('Failed to save session env overrides:', error)
      setPageError(errorMessage(error))
    } finally {
      setEnvSaving(false)
    }
  }, [envEntries])

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title={t('settings.runtime.title')}
        actions={<HeaderMenu route={routes.view.settings('runtime')} />}
      />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto space-y-8">
            {pageError && (
              <div className="border border-destructive/40 bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="min-w-0 break-words">{pageError}</span>
              </div>
            )}
            <SettingsSection
              title={t('settings.runtime.llmConnections')}
              description={t('settings.runtime.llmConnectionsDesc')}
            >
              <SettingsCard>
                <SettingsRow
                  label={t('settings.runtime.openAiSettings')}
                  description={t('settings.runtime.openAiSettingsDesc')}
                  onClick={() => navigate(routes.view.settings('ai'))}
                  action={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
                />
              </SettingsCard>
            </SettingsSection>

            <SettingsSection
              title={t('settings.runtime.thinkingLevel')}
              description={t('settings.runtime.thinkingLevelDesc')}
            >
              <SettingsCard>
                <SettingsMenuSelectRow
                  label={t('settings.ai.thinking')}
                  description={t('settings.ai.thinkingDesc')}
                  value={thinkingLevel}
                  onValueChange={(value) => handleThinkingLevelChange(value as ThinkingLevel)}
                  options={THINKING_LEVELS.map(({ id, nameKey, descriptionKey }) => ({
                    value: id,
                    label: t(nameKey),
                    description: t(descriptionKey),
                  }))}
                />
              </SettingsCard>
            </SettingsSection>

            <SettingsSection
              title={t('settings.runtime.approvalTitle')}
              description={t('settings.runtime.approvalDesc')}
            >
              <SettingsCard>
                {permissionMode === null ? (
                  activeWorkspaceId ? (
                    <div className="flex justify-center py-8">
                      <Spinner className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      {t('settings.runtime.approvalSelectWorkspace')}
                    </div>
                  )
                ) : (
                  <>
                    <SettingsMenuSelectRow
                      label={t('settings.runtime.approvalMode')}
                      description={t('settings.runtime.approvalModeDesc')}
                      value={permissionMode}
                      onValueChange={(value) => handlePermissionModeChange(value as PermissionMode)}
                      options={[
                        { value: 'safe', label: t('mode.explore'), description: t('mode.exploreDesc') },
                        { value: 'ask', label: t('mode.ask'), description: t('mode.askDesc') },
                        { value: 'allow-all', label: t('mode.execute'), description: t('mode.executeDesc') },
                      ]}
                    />
                    <div className="h-px bg-border/50 mx-4" />
                    <div className="px-4 py-2.5 text-xs text-muted-foreground">
                      {t('settings.runtime.approvalRespawnNote')}
                    </div>
                  </>
                )}
              </SettingsCard>
            </SettingsSection>

            {available && (
              <>
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

                <SettingsSection
                  title={t('settings.toolchain.enabledTitle')}
                  description={t('settings.toolchain.enabledDesc')}
                >
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Spinner className="w-4 h-4" />
                    </div>
                  ) : (
                    <SettingsCard>
                      {tools.map((tool) => (
                        <SettingsToggle
                          key={tool.name}
                          label={tool.name}
                          checked={!disabledTools.includes(tool.name)}
                          onCheckedChange={(enabled) => toggleTool(tool.name, enabled)}
                        />
                      ))}
                    </SettingsCard>
                  )}
                </SettingsSection>
              </>
            )}

            <SettingsSection
              title={t('settings.runtime.envTitle')}
              description={t('settings.runtime.envDesc')}
            >
              <SettingsCard divided={false}>
                <div className="p-3 space-y-2">
                  {envEntries === null ? (
                    <div className="flex justify-center py-4">
                      <Spinner className="w-4 h-4" />
                    </div>
                  ) : (
                    <>
                      {envEntries.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={entry.key}
                            onChange={(e) => updateEnvEntry(index, { key: e.target.value })}
                            placeholder={t('settings.runtime.envKeyPlaceholder')}
                            spellCheck={false}
                            className="font-mono text-xs flex-1"
                          />
                          <span className="text-muted-foreground">=</span>
                          <Input
                            value={entry.value}
                            onChange={(e) => updateEnvEntry(index, { value: e.target.value })}
                            placeholder={t('settings.runtime.envValuePlaceholder')}
                            spellCheck={false}
                            className="font-mono text-xs flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEnvEntry(index)}
                            aria-label={t('settings.runtime.envRemove')}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-1">
                        <Button variant="ghost" size="sm" onClick={addEnvEntry}>
                          <Plus className="w-3 h-3 mr-1" />
                          {t('settings.runtime.envAdd')}
                        </Button>
                        <Button size="sm" onClick={saveEnvOverrides} disabled={envSaving}>
                          {envSaving ? <Spinner className="w-3 h-3" /> : t('settings.runtime.envSave')}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </SettingsCard>
            </SettingsSection>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
