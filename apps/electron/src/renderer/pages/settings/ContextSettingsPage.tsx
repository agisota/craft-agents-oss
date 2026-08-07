/**
 * ContextSettingsPage — standing runtime context documents:
 * - list & edit <CONFIG_DIR>/context/*.md (soul.md, rules.md, user-*.md)
 * - Add document
 * - template-stale: Accept template / Keep mine
 * - bundled skill packs enable/disable
 * - project-level override explanation
 * - pointer to skills management
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, FileText, Plus } from 'lucide-react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { navigate, routes } from '@/lib/navigate'
import { useAppShellContext } from '@/context/AppShellContext'
import { Spinner } from '@craft-agent/ui'
import { SettingsSection, SettingsCard, SettingsRow, SettingsToggle } from '@/components/settings'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type { BundledSkillPackStatus, ContextDocContent, ContextDocInfo, Lesson } from '../../../shared/types'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'context',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function normalizeNewDocFilename(raw: string): string {
  let name = raw.trim()
  if (!name) return ''
  if (!name.toLowerCase().endsWith('.md')) name = `${name}.md`
  return name
}

export default function ContextSettingsPage() {
  const { t } = useTranslation()
  const { activeWorkspaceId } = useAppShellContext()
  const [docs, setDocs] = useState<ContextDocInfo[]>([])
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null)
  const [currentDoc, setCurrentDoc] = useState<ContextDocContent | null>(null)
  const [draft, setDraft] = useState('')
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newDocName, setNewDocName] = useState('')
  const [pageError, setPageError] = useState<string | null>(null)

  const [packs, setPacks] = useState<BundledSkillPackStatus[] | null>(null)
  const [packsBusy, setPacksBusy] = useState(false)

  const [lessons, setLessons] = useState<Lesson[] | null>(null)
  const [templatePreview, setTemplatePreview] = useState<string | null>(null)
  const [showTemplateDiff, setShowTemplateDiff] = useState(false)

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
        setPageError(error instanceof Error ? error.message : String(error))
      })
  }, [])

  const loadPacks = useCallback(() => {
    window.electronAPI
      .listBundledSkillPacks()
      .then(setPacks)
      .catch((error) => {
        console.error('Failed to list bundled skill packs:', error)
        setPacks([])
      })
  }, [])

  useEffect(() => {
    loadDocs()
    loadPacks()
    const offDocs = window.electronAPI.onContextDocsChanged(() => loadDocs())
    const offPacks = window.electronAPI.onBundledSkillsChanged(() => loadPacks())
    return () => {
      offDocs()
      offPacks()
    }
  }, [loadDocs, loadPacks])

  useEffect(() => {
    let cancelled = false
    setLessons(null)
    window.electronAPI
      .listMemoryLessons('both', activeWorkspaceId ?? undefined)
      .then((list) => {
        if (!cancelled) setLessons(list)
      })
      .catch(() => {
        if (!cancelled) setLessons([])
      })
    const off = window.electronAPI.onMemoryChanged?.(() => {
      window.electronAPI
        .listMemoryLessons('both', activeWorkspaceId ?? undefined)
        .then((list) => {
          if (!cancelled) setLessons(list)
        })
        .catch(() => {
          if (!cancelled) setLessons([])
        })
    })
    return () => {
      cancelled = true
      off?.()
    }
  }, [activeWorkspaceId])

  const openDoc = useCallback((filename: string) => {
    setSelectedFilename(filename)
    setCurrentDoc(null)
    setDraft('')
    setTemplatePreview(null)
    setShowTemplateDiff(false)
    setPageError(null)
    window.electronAPI
      .readContextDoc(filename)
      .then(async (doc) => {
        setCurrentDoc(doc)
        setDraft(doc.content)
        if (doc.templateStale) {
          try {
            const tpl = await window.electronAPI.readContextDocTemplate(filename)
            setTemplatePreview(tpl)
            setShowTemplateDiff(true)
          } catch {
            setTemplatePreview(null)
          }
        }
      })
      .catch((error) => {
        console.error('Failed to read context doc:', error)
        setPageError(error instanceof Error ? error.message : String(error))
      })
  }, [])

  const saveDoc = useCallback(async () => {
    if (!currentDoc) return
    setSaving(true)
    setPageError(null)
    try {
      const updated = await window.electronAPI.writeContextDoc(currentDoc.filename, draft)
      setCurrentDoc((prev) => (prev ? { ...prev, ...updated, content: draft } : prev))
      setDocs((prev) => prev.map((d) => (d.filename === updated.filename ? updated : d)))
    } catch (error) {
      console.error('Failed to write context doc:', error)
      setPageError(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }, [currentDoc, draft])

  const createDoc = useCallback(async () => {
    const filename = normalizeNewDocFilename(newDocName)
    if (!filename) return
    setAdding(true)
    setPageError(null)
    try {
      const seed = `<!-- context-doc-version: 1 -->\n# ${filename.replace(/\.md$/i, '')}\n\n`
      const created = await window.electronAPI.writeContextDoc(filename, seed)
      setNewDocName('')
      setDocs((prev) => {
        const without = prev.filter((d) => d.filename !== created.filename)
        return [...without, created].sort((a, b) => a.filename.localeCompare(b.filename))
      })
      openDoc(created.filename)
    } catch (error) {
      console.error('Failed to create context doc:', error)
      setPageError(error instanceof Error ? error.message : String(error))
    } finally {
      setAdding(false)
    }
  }, [newDocName, openDoc])

  const acceptTemplate = useCallback(async () => {
    if (!currentDoc) return
    setTemplateBusy(true)
    setPageError(null)
    try {
      const updated = await window.electronAPI.acceptContextDocTemplate(currentDoc.filename)
      const full = await window.electronAPI.readContextDoc(currentDoc.filename)
      setCurrentDoc(full)
      setDraft(full.content)
      setTemplatePreview(null)
      setShowTemplateDiff(false)
      setDocs((prev) => prev.map((d) => (d.filename === updated.filename ? { ...d, ...updated } : d)))
    } catch (error) {
      console.error('Failed to accept template:', error)
      setPageError(error instanceof Error ? error.message : String(error))
    } finally {
      setTemplateBusy(false)
    }
  }, [currentDoc])

  const keepMineTemplate = useCallback(async () => {
    if (!currentDoc) return
    setTemplateBusy(true)
    setPageError(null)
    try {
      // Persist current draft first so Keep mine applies to what the user sees.
      if (draft !== currentDoc.content) {
        await window.electronAPI.writeContextDoc(currentDoc.filename, draft)
      }
      const updated = await window.electronAPI.keepMineContextDocTemplate(currentDoc.filename)
      const full = await window.electronAPI.readContextDoc(currentDoc.filename)
      setCurrentDoc(full)
      setDraft(full.content)
      setTemplatePreview(null)
      setShowTemplateDiff(false)
      setDocs((prev) => prev.map((d) => (d.filename === updated.filename ? { ...d, ...updated } : d)))
    } catch (error) {
      console.error('Failed to keep mine template:', error)
      setPageError(error instanceof Error ? error.message : String(error))
    } finally {
      setTemplateBusy(false)
    }
  }, [currentDoc, draft])

  const togglePack = useCallback(
    async (slug: string, enabled: boolean) => {
      if (!packs) return
      setPacksBusy(true)
      setPageError(null)
      try {
        const currentlyDisabled = packs.filter((p) => p.disabled).map((p) => p.slug)
        const next = enabled
          ? currentlyDisabled.filter((s) => s !== slug)
          : [...new Set([...currentlyDisabled, slug])]
        await window.electronAPI.setBundledSkillsDisabled(next)
        const refreshed = await window.electronAPI.listBundledSkillPacks()
        setPacks(refreshed)
      } catch (error) {
        console.error('Failed to toggle bundled pack:', error)
        setPageError(error instanceof Error ? error.message : String(error))
      } finally {
        setPacksBusy(false)
      }
    },
    [packs],
  )

  const isDirty = currentDoc !== null && draft !== currentDoc.content
  const showTemplateActions = currentDoc?.templateStale === true

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title={t('settings.context.title')}
        actions={<HeaderMenu route={routes.view.settings('context')} />}
      />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto space-y-8">
            {pageError && (
              <p className="text-sm text-destructive px-1" role="alert">
                {pageError}
              </p>
            )}

            <SettingsSection
              title={t('settings.context.docsTitle')}
              description={t('settings.context.docsDesc')}
            >
              {loadingDocs ? (
                <div className="flex justify-center py-8">
                  <Spinner className="w-4 h-4" />
                </div>
              ) : (
                <>
                  {docs.length === 0 ? (
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

                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      placeholder={t('settings.context.addDocPlaceholder')}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void createDoc()
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void createDoc()}
                      disabled={adding || !normalizeNewDocFilename(newDocName)}
                    >
                      {adding ? <Spinner className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      <span className="ml-1">{t('settings.context.addDoc')}</span>
                    </Button>
                  </div>
                </>
              )}

              {selectedFilename && (
                <div className="space-y-3 pt-4">
                  {!currentDoc ? (
                    <div className="flex justify-center py-4">
                      <Spinner className="w-4 h-4" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium">{currentDoc.filename}</span>
                        <div className="flex items-center gap-2">
                          {showTemplateActions && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={templateBusy}
                                onClick={() => void acceptTemplate()}
                              >
                                {t('settings.context.acceptTemplate')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={templateBusy}
                                onClick={() => void keepMineTemplate()}
                              >
                                {t('settings.context.keepMine')}
                              </Button>
                            </>
                          )}
                          <Button size="sm" onClick={() => void saveDoc()} disabled={!isDirty || saving}>
                            {saving ? <Spinner className="w-3 h-3" /> : t('settings.context.save')}
                          </Button>
                        </div>
                      </div>
                      {showTemplateActions && (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">{t('settings.context.templateStaleHint')}</p>
                          {templatePreview != null ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowTemplateDiff((v) => !v)}
                            >
                              {showTemplateDiff
                                ? t('settings.context.hideTemplateDiff')
                                : t('settings.context.showTemplateDiff')}
                            </Button>
                          ) : null}
                        </div>
                      )}
                      {showTemplateActions && showTemplateDiff && templatePreview != null ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="text-[11px] font-medium text-muted-foreground">
                              {t('settings.context.templateColumn')}
                              {currentDoc.templateVersion != null
                                ? ` · v${currentDoc.templateVersion}`
                                : ''}
                            </div>
                            <pre className="w-full min-h-[320px] max-h-[480px] overflow-auto rounded-md border border-input bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                              {templatePreview}
                            </pre>
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="text-[11px] font-medium text-muted-foreground">
                              {t('settings.context.yoursColumn')}
                              {currentDoc.version != null ? ` · v${currentDoc.version}` : ''}
                            </div>
                            <textarea
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              spellCheck={false}
                              className="w-full min-h-[320px] max-h-[480px] rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                          </div>
                        </div>
                      ) : (
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          spellCheck={false}
                          className="w-full min-h-[400px] rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              title={t('settings.context.overridesTitle')}
              description={t('settings.context.overridesDesc')}
            >
              <p className="text-sm text-muted-foreground px-1">{t('settings.context.overridesBody')}</p>
            </SettingsSection>

            <SettingsSection
              title={t('settings.context.bundledTitle')}
              description={t('settings.context.bundledDesc')}
            >
              {packs === null ? (
                <div className="flex justify-center py-6">
                  <Spinner className="w-4 h-4" />
                </div>
              ) : packs.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">{t('settings.context.bundledEmpty')}</p>
              ) : (
                <SettingsCard>
                  {packs.map((pack) => (
                    <SettingsToggle
                      key={pack.slug}
                      label={pack.slug}
                      description={
                        [
                          pack.commit ? pack.commit.slice(0, 8) : null,
                          pack.localModified ? t('settings.context.bundledLocalModified') : null,
                          `${pack.installed.length}/${pack.skills.length} ${t('settings.context.bundledSkillsCount')}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      }
                      checked={!pack.disabled}
                      disabled={packsBusy}
                      onCheckedChange={(checked) => void togglePack(pack.slug, checked)}
                    />
                  ))}
                </SettingsCard>
              )}
            </SettingsSection>

            <SettingsSection
              title={t('settings.context.memoryTitle')}
              description={t('settings.context.memoryDesc')}
            >
              {lessons === null ? (
                <div className="flex justify-center py-4">
                  <Spinner className="w-4 h-4" />
                </div>
              ) : (
                <SettingsCard>
                  {lessons.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-4 py-3">{t('settings.context.memoryEmpty')}</p>
                  ) : (
                    lessons.slice(0, 5).map((lesson, idx) => (
                      <SettingsRow
                        key={`${lesson.scope}-${lesson.ts}-${idx}`}
                        label={lesson.negative ? `¬ ${lesson.rule}` : lesson.rule}
                        description={`${lesson.scope} · ${lesson.category}${lesson.usageCount != null ? ` · ×${lesson.usageCount}` : ''}`}
                      />
                    ))
                  )}
                  {lessons.length > 5 ? (
                    <p className="text-xs text-muted-foreground px-4 pb-2">
                      {t('settings.context.memoryMore', { count: lessons.length - 5 })}
                    </p>
                  ) : null}
                  <SettingsRow
                    label={t('settings.context.openMemory')}
                    description={t('settings.context.openMemoryDesc')}
                    onClick={() => navigate(routes.view.memory())}
                    action={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  />
                </SettingsCard>
              )}
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
