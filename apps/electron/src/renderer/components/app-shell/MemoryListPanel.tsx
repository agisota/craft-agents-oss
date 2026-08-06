import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, Pencil, Trash2, Check, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { Lesson, LessonCategory, LessonScope } from '@craft-agent/shared/memory/types'

export interface MemoryListPanelProps {
  workspaceId?: string
  className?: string
}

const CATEGORIES: LessonCategory[] = ['preference', 'workflow', 'knowledge', 'correction']

function scopeChipClass(scope: LessonScope): string {
  return scope === 'global'
    ? 'bg-accent/15 text-accent'
    : 'bg-foreground/5 text-muted-foreground'
}

function sectionTitleClass(): string {
  return 'px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70'
}

export function MemoryListPanel({ workspaceId, className }: MemoryListPanelProps) {
  const { t } = useTranslation()

  const [lessons, setLessons] = React.useState<Lesson[]>([])
  const [preferences, setPreferences] = React.useState('')
  const [context, setContext] = React.useState('')
  const [historyDates, setHistoryDates] = React.useState<string[]>([])
  const [historyDate, setHistoryDate] = React.useState<string | null>(null)
  const [historyContent, setHistoryContent] = React.useState('')

  const [formOpen, setFormOpen] = React.useState(false)
  const [formRule, setFormRule] = React.useState('')
  const [formCategory, setFormCategory] = React.useState<LessonCategory>('workflow')
  const [formScope, setFormScope] = React.useState<LessonScope>('workspace')
  const [formNegative, setFormNegative] = React.useState(false)

  const [editingRule, setEditingRule] = React.useState<string | null>(null)
  const [editDraft, setEditDraft] = React.useState('')
  const [confirmDeleteRule, setConfirmDeleteRule] = React.useState<string | null>(null)

  const loadLessons = React.useCallback(() => {
    window.electronAPI
      .listMemoryLessons('both', workspaceId)
      .then(setLessons)
      .catch(() => setLessons([]))
  }, [workspaceId])

  const loadContext = React.useCallback(() => {
    window.electronAPI
      .getMemoryContext(workspaceId)
      .then((dto) => { setPreferences(dto.preferences); setContext(dto.context) })
      .catch(() => { setPreferences(''); setContext('') })
  }, [workspaceId])

  const loadHistoryDates = React.useCallback(() => {
    if (!workspaceId) { setHistoryDates([]); return }
    window.electronAPI
      .listMemoryHistory(workspaceId)
      .then((dto) => setHistoryDates(dto.dates))
      .catch(() => setHistoryDates([]))
  }, [workspaceId])

  React.useEffect(() => {
    loadLessons()
    loadContext()
    loadHistoryDates()
    setHistoryDate(null)
    setHistoryContent('')
    const off = window.electronAPI.onMemoryChanged(() => {
      loadLessons()
      loadContext()
      loadHistoryDates()
    })
    return off
  }, [loadLessons, loadContext, loadHistoryDates])

  const openDate = (date: string) => {
    if (!workspaceId) return
    window.electronAPI
      .listMemoryHistory(workspaceId, date)
      .then((dto) => { setHistoryDate(dto.date); setHistoryContent(dto.content) })
      .catch(() => toast.error(t('memory.historyLoadFailed')))
  }

  const handleAdd = async () => {
    const rule = formRule.trim()
    if (!rule) return
    try {
      await window.electronAPI.addMemoryLesson(formScope === 'global' ? null : workspaceId ?? null, {
        rule,
        category: formCategory,
        scope: formScope,
        ...(formNegative ? { negative: true } : {}),
      })
      setFormRule('')
      setFormNegative(false)
      setFormOpen(false)
      toast.success(t('memory.lessonAdded'))
    } catch (err) {
      toast.error(t('memory.lessonAddFailed'), {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const handleSaveEdit = async (lesson: Lesson) => {
    const rule = editDraft.trim()
    if (!rule) { setEditingRule(null); return }
    try {
      await window.electronAPI.updateMemoryLesson(
        lesson.scope === 'global' ? null : workspaceId ?? null,
        lesson.scope,
        lesson.rule,
        { rule },
      )
      setEditingRule(null)
    } catch (err) {
      toast.error(t('memory.lessonUpdateFailed'), {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const handleDelete = async (lesson: Lesson) => {
    try {
      await window.electronAPI.deleteMemoryLesson(
        lesson.scope === 'global' ? null : workspaceId ?? null,
        lesson.scope,
        lesson.rule,
      )
      setConfirmDeleteRule(null)
    } catch (err) {
      toast.error(t('memory.lessonDeleteFailed'), {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const handleSaveContext = async (scope: LessonScope) => {
    try {
      await window.electronAPI.updateMemoryContext(
        scope === 'global' ? null : workspaceId ?? null,
        scope,
        scope === 'global' ? preferences : context,
      )
      toast.success(t('memory.contextSaved'))
    } catch (err) {
      toast.error(t('memory.contextSaveFailed'), {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const globalLessons = lessons.filter((l) => l.scope === 'global')
  const workspaceLessons = lessons.filter((l) => l.scope === 'workspace')

  const renderLesson = (lesson: Lesson) => {
    const key = `${lesson.scope}:${lesson.rule}`
    const isEditing = editingRule === key
    const isConfirming = confirmDeleteRule === key
    return (
      <li key={key} className="rounded-[8px] px-2 py-1.5 hover:bg-foreground/[0.03]">
        {isEditing ? (
          <div className="space-y-1.5">
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-[8px] bg-foreground/[0.03] p-2 text-sm outline-none focus:bg-foreground/[0.05]"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void handleSaveEdit(lesson)}
                className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-medium rounded-[6px] bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
              >
                <Check className="size-3" />
                {t('memory.save')}
              </button>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="inline-flex items-center h-6 px-2 text-[11px] font-medium rounded-[6px] bg-foreground/5 text-muted-foreground hover:bg-foreground/10 transition-colors"
              >
                {t('memory.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <span className="block text-sm whitespace-pre-wrap">{lesson.rule}</span>
        )}
        {!isEditing && (
          <span className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground">
              {t(`memory.category.${lesson.category}`)}
            </span>
            {lesson.negative && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">
                {t('memory.negativeBadge')}
              </span>
            )}
            <span className="flex-1" />
            {isConfirming ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleDelete(lesson)}
                  className="inline-flex items-center h-5 px-1.5 text-[10px] font-medium rounded-[6px] bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
                >
                  {t('memory.deleteConfirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteRule(null)}
                  className="inline-flex items-center h-5 px-1.5 text-[10px] font-medium rounded-[6px] bg-foreground/5 text-muted-foreground hover:bg-foreground/10 transition-colors"
                >
                  {t('memory.cancel')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  aria-label={t('memory.editLesson')}
                  onClick={() => { setEditingRule(key); setEditDraft(lesson.rule) }}
                  className="inline-flex items-center justify-center size-5 rounded-[6px] text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  aria-label={t('memory.deleteLesson')}
                  onClick={() => setConfirmDeleteRule(key)}
                  className="inline-flex items-center justify-center size-5 rounded-[6px] text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3" />
                </button>
              </>
            )}
          </span>
        )}
      </li>
    )
  }

  const renderScopeGroup = (title: string, items: Lesson[]) => (
    <div className="mb-1">
      <div className={`${sectionTitleClass()} flex items-center gap-1.5`}>
        {title}
        <span className={`inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold normal-case ${scopeChipClass(items[0]?.scope ?? 'workspace')}`}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="px-2 pb-1 text-xs text-muted-foreground/70">{t('memory.noLessons')}</div>
      ) : (
        <ul>{items.map(renderLesson)}</ul>
      )}
    </div>
  )

  return (
    <div className={`flex flex-col gap-2 px-1 pb-4 overflow-y-auto ${className ?? ''}`} data-list-role="memory">
      {/* Add lesson */}
      <div>
        {formOpen ? (
          <div className="mx-1 space-y-1.5 rounded-[8px] bg-foreground/[0.03] p-2">
            <textarea
              value={formRule}
              onChange={(e) => setFormRule(e.target.value)}
              rows={3}
              placeholder={t('memory.rulePlaceholder')}
              className="w-full resize-y rounded-[8px] bg-background/60 p-2 text-sm outline-none"
            />
            <div className="flex items-center gap-1.5">
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as LessonCategory)}
                className="h-6 flex-1 rounded-[6px] bg-background/60 px-1.5 text-[11px] text-foreground outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(`memory.category.${c}`)}</option>
                ))}
              </select>
              <select
                value={formScope}
                onChange={(e) => setFormScope(e.target.value as LessonScope)}
                className="h-6 flex-1 rounded-[6px] bg-background/60 px-1.5 text-[11px] text-foreground outline-none"
              >
                <option value="workspace">{t('memory.scope.workspace')}</option>
                <option value="global">{t('memory.scope.global')}</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={formNegative}
                onChange={(e) => setFormNegative(e.target.checked)}
              />
              {t('memory.negativeLabel')}
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!formRule.trim()}
                onClick={() => void handleAdd()}
                className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-medium rounded-[6px] bg-accent/15 text-accent hover:bg-accent/25 transition-colors disabled:opacity-50"
              >
                <Check className="size-3" />
                {t('memory.addLessonSubmit')}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="inline-flex items-center h-6 px-2 text-[11px] font-medium rounded-[6px] bg-foreground/5 text-muted-foreground hover:bg-foreground/10 transition-colors"
              >
                {t('memory.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="mx-1 inline-flex items-center gap-1 h-7 px-2 text-xs font-medium rounded-[8px] bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
          >
            <Plus className="size-3.5" />
            {t('memory.addLesson')}
          </button>
        )}
      </div>

      {/* Lessons grouped by scope */}
      {renderScopeGroup(t('memory.globalLessons'), globalLessons)}
      {renderScopeGroup(t('memory.workspaceLessons'), workspaceLessons)}

      {/* Context */}
      <div className="border-t border-foreground/5 pt-1.5">
        <div className={sectionTitleClass()}>{t('memory.contextSection')}</div>
        <div className="mx-1 space-y-2">
          <div>
            <div className="mb-0.5 text-[11px] text-muted-foreground">{t('memory.preferencesGlobal')}</div>
            <textarea
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-[8px] bg-foreground/[0.03] p-2 text-xs outline-none focus:bg-foreground/[0.05]"
            />
            <button
              type="button"
              onClick={() => void handleSaveContext('global')}
              className="mt-0.5 inline-flex items-center h-6 px-2 text-[11px] font-medium rounded-[6px] bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
            >
              {t('memory.saveContext')}
            </button>
          </div>
          {workspaceId && (
            <div>
              <div className="mb-0.5 text-[11px] text-muted-foreground">{t('memory.contextWorkspace')}</div>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-[8px] bg-foreground/[0.03] p-2 text-xs outline-none focus:bg-foreground/[0.05]"
              />
              <button
                type="button"
                onClick={() => void handleSaveContext('workspace')}
                className="mt-0.5 inline-flex items-center h-6 px-2 text-[11px] font-medium rounded-[6px] bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
              >
                {t('memory.saveContext')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {workspaceId && (
        <div className="border-t border-foreground/5 pt-1.5">
          <div className={sectionTitleClass()}>{t('memory.historySection')}</div>
          {historyDates.length === 0 ? (
            <div className="px-2 pb-1 text-xs text-muted-foreground/70">{t('memory.historyEmpty')}</div>
          ) : (
            <ul>
              {historyDates.map((date) => (
                <li key={date}>
                  <button
                    type="button"
                    onClick={() => openDate(date)}
                    className={`w-full rounded-[8px] px-2 py-1 text-left text-sm transition-colors ${
                      historyDate === date ? 'bg-foreground/[0.06] text-foreground' : 'text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground'
                    }`}
                  >
                    {date}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {historyDate && (
            <pre className="mx-1 mt-1.5 max-h-72 overflow-auto whitespace-pre-wrap rounded-[8px] bg-foreground/[0.03] p-2 text-[11px] leading-snug text-foreground/80">
              {historyContent || t('memory.historyEmptyEntry')}
            </pre>
          )}
        </div>
      )}

      {lessons.length === 0 && !formOpen && !preferences && !context && (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
          <Brain className="size-6 opacity-40" />
          <span className="text-sm">{t('memory.emptyHint')}</span>
        </div>
      )}
    </div>
  )
}
