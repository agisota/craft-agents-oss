/**
 * RuntimeSettingsPage — AI runtime management:
 * - pointer to LLM connection settings (single source: AI settings page)
 * - default thinking level
 * - bundled toolchain tools (enable/disable via toolchain.disabled)
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Plus, X } from 'lucide-react'
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
import type { PermissionMode, ThinkingLevel, ToolchainToolName } from '../../../shared/types'
import { DEFAULT_THINKING_LEVEL, THINKING_LEVELS } from '@craft-agent/shared/agent/thinking-levels'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'runtime',
}

export default function RuntimeSettingsPage() {
  const { t } = useTranslation()
  const { available, isLoading, tools } = useToolchainStatus()
  const activeWorkspaceId = useAppShellContext().activeWorkspaceId
  const [disabledTools, setDisabledTools] = useState<ToolchainToolName[]>([])
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(DEFAULT_THINKING_LEVEL)
  const [permissionMode, setPermissionMode] = useState<PermissionMode | null>(null)
  const [envEntries, setEnvEntries] = useState<Array<{ key: string; value: string }> | null>(null)
  const [envSaving, setEnvSaving] = useState(false)

  useEffect(() => {
    window.electronAPI
      .getToolchainDisabled()
      .then(setDisabledTools)
      .catch((error) => console.error('Failed to load disabled toolchain tools:', error))
    window.electronAPI
      .getDefaultThinkingLevel()
      .then(setThinkingLevel)
      .catch((error) => console.error('Failed to load default thinking level:', error))
    window.electronAPI
      .getEnvOverrides()
      .then((env) => setEnvEntries(Object.entries(env).map(([key, value]) => ({ key, value }))))
      .catch((error) => {
        console.error('Failed to load session env overrides:', error)
        setEnvEntries([])
      })
  }, [])

  useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI
      .getWorkspaceSettings(activeWorkspaceId)
      .then((settings) => setPermissionMode(settings?.permissionMode ?? 'ask'))
      .catch((error) => console.error('Failed to load workspace permission mode:', error))
  }, [activeWorkspaceId])

  const toggleTool = async (name: ToolchainToolName, enabled: boolean) => {
    const next = enabled
      ? disabledTools.filter((n) => n !== name)
      : [...disabledTools, name]
    setDisabledTools(next)
    try {
      await window.electronAPI.setToolchainDisabled(next)
    } catch (error) {
      console.error('Failed to update disabled toolchain tools:', error)
    }
  }

  const handleThinkingLevelChange = useCallback(async (level: ThinkingLevel) => {
    const previous = thinkingLevel
    setThinkingLevel(level)
    try {
      const result = await window.electronAPI.setDefaultThinkingLevel(level)
      if (!result.success) {
        console.error('Failed to set default thinking level:', result.error)
        setThinkingLevel(previous)
      }
    } catch (error) {
      console.error('Failed to set default thinking level:', error)
      setThinkingLevel(previous)
    }
  }, [thinkingLevel])

  const handlePermissionModeChange = useCallback(async (mode: PermissionMode) => {
    if (!activeWorkspaceId) return
    const previous = permissionMode
    setPermissionMode(mode)
    try {
      await window.electronAPI.updateWorkspaceSetting(activeWorkspaceId, 'permissionMode', mode)
    } catch (error) {
      console.error('Failed to update permission mode:', error)
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
    try {
      const env: Record<string, string> = {}
      for (const { key, value } of envEntries) {
        const trimmedKey = key.trim()
        if (trimmedKey) env[trimmedKey] = value
      }
      await window.electronAPI.setEnvOverrides(env)
    } catch (error) {
      console.error('Failed to save session env overrides:', error)
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
                  <div className="flex justify-center py-8">
                    <Spinner className="w-4 h-4" />
                  </div>
                ) : (
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
                )}
              </SettingsCard>
            </SettingsSection>

            {available && (
              <SettingsSection
                title={t('settings.toolchain.toolsTitle')}
                description={t('settings.toolchain.toolsDesc')}
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
