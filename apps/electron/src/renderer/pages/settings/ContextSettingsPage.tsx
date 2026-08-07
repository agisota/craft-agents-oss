/**
 * ContextSettingsPage — standing runtime context documents:
 * - list & edit <CONFIG_DIR>/context/*.md documents (soul.md, rules.md, user-*.md)
 * - template-stale badge when the bundled template is newer than the installed copy
 * - project-level override explanation (per-project soul.md/rules.md win)
 * - pointer to skills management
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, FileText } from 'lucide-react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { navigate, routes } from '@/lib/navigate'
import { Spinner } from '@craft-agent/ui'
import { SettingsSection, SettingsCard, SettingsRow } from '@/components/settings'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type { ContextDocContent, ContextDocInfo } from '../../../shared/types'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'context',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function ContextSettingsPage() {
  const { t } = useTranslation()
  const [docs, setDocs] = useState<ContextDocInfo[]>([])
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null)
  const [currentDoc, setCurrentDoc] = useState<ContextDocContent | null>(null)
  const [draft, setDraft] = useState('')
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadDocs = useCallback(() => {
    window.electronAPI
      .listContextDocs()
      .then((list) => {
        setDocs(list)
        setLoadingDocs(false)
      })
      .catch((error) => {
        console.error('Failed to list context docs:', error)
        setLoadingDocs(false)
      })
  }, [])

  useEffect(() => {
    loadDocs()
    return window.electronAPI.onContextDocsChanged(() => loadDocs())
  }, [loadDocs])

  const openDoc = useCallback((filename: string) => {
    setSelectedFilename(filename)
    setCurrentDoc(null)
    setDraft('')
    window.electronAPI
      .readContextDoc(filename)
      .then((doc) => {
        setCurrentDoc(doc)
        setDraft(doc.content)
      })
      .catch((error) => console.error('Failed to read context doc:', error))
  }, [])

  const saveDoc = useCallback(async () => {
    if (!currentDoc) return
    setSaving(true)
    try {
      const updated = await window.electronAPI.writeContextDoc(currentDoc.filename, draft)
      setCurrentDoc((prev) => (prev ? { ...prev, ...updated, content: draft } : prev))
      setDocs((prev) => prev.map((d) => (d.filename === updated.filename ? updated : d)))
    } catch (error) {
      console.error('Failed to write context doc:', error)
    } finally {
      setSaving(false)
    }
  }, [currentDoc, draft])

  const isDirty = currentDoc !== null && draft !== currentDoc.content

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title={t('settings.context.title')}
        actions={<HeaderMenu route={routes.view.settings('context')} />}
      />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto space-y-8">
            <SettingsSection
              title={t('settings.context.docsTitle')}
              description={t('settings.context.docsDesc')}
            >
              {loadingDocs ? (
                <div className="flex justify-center py-8">
                  <Spinner className="w-4 h-4" />
                </div>
              ) : docs.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">{t('settings.context.emptyDocs')}</p>
              ) : (
                <SettingsCard>
                  {docs.map((doc) => (
                    <SettingsRow
                      key={doc.filename}
                      label={doc.filename}
                      description={
                        doc.templateVersion !== null
                          ? `${t('settings.context.templateVersion', { version: doc.templateVersion })} · ${formatSize(doc.size)}`
                          : formatSize(doc.size)
                      }
                      onClick={() => openDoc(doc.filename)}
                      action={
                        <span className="flex items-center gap-2">
                          {doc.templateStale && (
                            <Badge variant="secondary">{t('settings.context.templateStale')}</Badge>
                          )}
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        </span>
                      }
                    />
                  ))}
                </SettingsCard>
              )}

              {selectedFilename && (
                <div className="space-y-3">
                  {!currentDoc ? (
                    <div className="flex justify-center py-4">
                      <Spinner className="w-4 h-4" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{currentDoc.filename}</span>
                        <Button
                          size="sm"
                          onClick={saveDoc}
                          disabled={!isDirty || saving}
                        >
                          {saving ? <Spinner className="w-3 h-3" /> : t('settings.context.save')}
                        </Button>
                      </div>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        spellCheck={false}
                        className="w-full min-h-[400px] rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </>
                  )}
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              title={t('settings.context.overridesTitle')}
              description={t('settings.context.overridesDesc')}
            >
              <></>
            </SettingsSection>

            <SettingsSection
              title={t('settings.context.skillsTitle')}
              description={t('settings.context.skillsDesc')}
            >
              <SettingsCard>
                <SettingsRow
                  label={t('settings.context.openSkills')}
                  description={t('settings.context.openSkillsDesc')}
                  onClick={() => navigate(routes.view.skills())}
                  action={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
                />
              </SettingsCard>
            </SettingsSection>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
