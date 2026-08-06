import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Zap, PackageOpen, Check, ChevronDown, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { SkillAvatar } from '@/components/ui/skill-avatar'
import { EntityPanel } from '@/components/ui/entity-panel'
import { EntityListEmptyScreen } from '@/components/ui/entity-list-empty'
import { skillSelection } from '@/hooks/useEntitySelection'
import { SkillMenu } from './SkillMenu'
import { SendResourceToWorkspaceDialog } from './SendResourceToWorkspaceDialog'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { useActiveWorkspace, useAppShellContext } from '@/context/AppShellContext'
import { getFileManagerName } from '@/lib/platform'
import type { PendingSkill } from '@craft-agent/shared/memory/types'
import type { LoadedSkill } from '../../../shared/types'

export interface SkillsListPanelProps {
  skills: LoadedSkill[]
  onDeleteSkill: (skillSlug: string) => void
  onSkillClick: (skill: LoadedSkill) => void
  selectedSkillSlug?: string | null
  workspaceId?: string
  workspaceRootPath?: string
  className?: string
}

export function SkillsListPanel({
  skills,
  onDeleteSkill,
  onSkillClick,
  selectedSkillSlug,
  workspaceId,
  workspaceRootPath,
  className,
}: SkillsListPanelProps) {
  const { t } = useTranslation()
  const activeWorkspace = useActiveWorkspace()
  const canRevealLocally = !activeWorkspace?.remoteServer
  const { workspaces, activeWorkspaceId } = useAppShellContext()
  const hasOtherWorkspaces = workspaces.length > 1

  // OMP skills (~/.omp/agent/skills, {workspace}/.omp/skills) render as a
  // separate read-only group with an "Export to craft skills" action.
  const craftSkills = skills.filter((s) => s.source !== 'omp')
  const ompSkills = skills.filter((s) => s.source === 'omp')
  const [exportingSlug, setExportingSlug] = React.useState<string | null>(null)

  // Pending skill candidates from the self-learning distillation queue.
  const [pendingSkills, setPendingSkills] = React.useState<PendingSkill[]>([])
  const [expandedPendingSlug, setExpandedPendingSlug] = React.useState<string | null>(null)
  const effectiveWorkspaceId = workspaceId ?? activeWorkspaceId

  React.useEffect(() => {
    if (!effectiveWorkspaceId) {
      setPendingSkills([])
      return
    }
    let cancelled = false
    const load = () => {
      window.electronAPI
        .listPendingSkills(effectiveWorkspaceId)
        .then((items) => { if (!cancelled) setPendingSkills(items) })
        .catch(() => { if (!cancelled) setPendingSkills([]) })
    }
    load()
    // Refetch when the pending queue or the approved skills list change —
    // approving a candidate moves it into the main list and bumps skills.CHANGED.
    const offPending = window.electronAPI.onSkillsPendingChanged((changedWorkspaceId) => {
      if (changedWorkspaceId === effectiveWorkspaceId) load()
    })
    const offSkills = window.electronAPI.onSkillsChanged((changedWorkspaceId) => {
      if (changedWorkspaceId === effectiveWorkspaceId) load()
    })
    return () => { cancelled = true; offPending(); offSkills() }
  }, [effectiveWorkspaceId])

  const handlePendingAction = async (slug: string, action: 'approve' | 'dismiss', description?: string) => {
    if (!effectiveWorkspaceId) return
    try {
      if (action === 'approve') {
        await window.electronAPI.approvePendingSkill(effectiveWorkspaceId, slug)
        toast.success(t('pendingSkills.approved', { slug }))
      } else {
        await window.electronAPI.dismissPendingSkill(effectiveWorkspaceId, slug, description)
        toast.success(t('pendingSkills.dismissed', { slug }))
      }
      setExpandedPendingSlug((current) => (current === slug ? null : current))
    } catch (err) {
      toast.error(action === 'approve' ? t('pendingSkills.approveFailed') : t('pendingSkills.dismissFailed'), {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Send to Workspace dialog state
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false)
  const [sendResourceSlug, setSendResourceSlug] = React.useState<string | null>(null)
  const [sendResourceLabel, setSendResourceLabel] = React.useState('')

  const handleExportOmpSkill = async (skill: LoadedSkill) => {
    const targetWorkspaceId = workspaceId ?? activeWorkspaceId
    if (!targetWorkspaceId || exportingSlug) return
    setExportingSlug(skill.slug)
    try {
      const result = await window.electronAPI.importOmpSkill(targetWorkspaceId, skill.slug)
      toast.success(t('skillsList.ompExported', { name: skill.metadata.name, slug: result.slug }))
    } catch (err) {
      toast.error(t('skillsList.ompExportFailed'), {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setExportingSlug(null)
    }
  }

  // Render EntityPanel empty state only when there are no skills at all —
  // a workspace with only OMP skills shouldn't show "No skills configured".
  const emptyState = ompSkills.length > 0 ? undefined : (
    <EntityListEmptyScreen
      icon={<Zap />}
      title={t('skillsList.noSkillsConfigured')}
      description={t('skillsList.emptyDescription')}
      docKey="skills"
    >
      {workspaceRootPath && (
        <EditPopover
          align="center"
          trigger={
            <button className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-[8px] bg-background shadow-minimal hover:bg-foreground/[0.03] transition-colors">
              {t('skillsList.addSkill')}
            </button>
          }
          {...getEditConfig('add-skill', workspaceRootPath)}
        />
      )}
    </EntityListEmptyScreen>
  )

  return (
    <>
    <EntityPanel<LoadedSkill>
      items={craftSkills}
      getId={(s) => s.slug}
      selection={skillSelection}
      selectedId={selectedSkillSlug}
      onItemClick={onSkillClick}
      className={className}
      containerProps={{ 'data-list-role': 'skills' }}
      emptyState={emptyState}
      mapItem={(skill) => ({
        icon: <SkillAvatar skill={skill} size="sm" workspaceId={workspaceId} />,
        title: skill.metadata.name,
        badges: (
          <span className="flex items-center gap-1.5 min-w-0">
            {skill.source === 'project' && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground">
                {t('skillsList.projectBadge')}
              </span>
            )}
            <span className="truncate">{skill.metadata.description}</span>
          </span>
        ),
        menu: (
          <SkillMenu
            skillSlug={skill.slug}
            skillName={skill.metadata.name}
            onOpenInNewWindow={() => window.electronAPI.openUrl(`craftagents://skills/skill/${skill.slug}?window=focused`)}
            onShowInFinder={async () => {
              if (!canRevealLocally) return
              try {
                await window.electronAPI.showInFolder(skill.path)
              } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                toast.error(t('toast.failedToReveal', { fileManager: getFileManagerName() }), {
                  description: message,
                })
              }
            }}
            canShowInFinder={canRevealLocally}
            onDelete={skill.source === 'workspace' ? () => onDeleteSkill(skill.slug) : undefined}
            canDelete={skill.source === 'workspace'}
            deleteLabel={skill.source === 'workspace' ? t('skillsList.deleteSkill') : t('skillsList.managedByProject')}
            onSendToWorkspace={hasOtherWorkspaces && skill.source === 'workspace' ? () => {
              setSendResourceSlug(skill.slug)
              setSendResourceLabel(skill.metadata.name)
              setSendDialogOpen(true)
            } : undefined}
          />
        ),
      })}
    />

    {/* Pending skill candidates awaiting approval */}
    {pendingSkills.length > 0 && (
      <div className="mb-2 pb-1.5 border-b border-foreground/5" data-list-role="pending-skills">
        <div className="px-2 pb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {t('pendingSkills.section')}
          <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent/15 text-accent text-[10px] font-semibold">
            {pendingSkills.length}
          </span>
        </div>
        <ul>
          {pendingSkills.map((candidate) => {
            const expanded = expandedPendingSlug === candidate.slug
            return (
              <li key={candidate.slug} className="mx-0 px-2 py-1.5 rounded-[8px] hover:bg-foreground/[0.03]">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedPendingSlug(expanded ? null : candidate.slug)}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {expanded ? <ChevronDown className="size-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3 shrink-0 text-muted-foreground" />}
                    <span className="truncate text-sm font-medium">{candidate.slug}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground pl-4">
                    {candidate.description}
                  </span>
                </button>
                {expanded && (
                  <div className="mt-1.5 pl-4 space-y-1.5">
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-[8px] bg-foreground/[0.03] p-2 text-[11px] leading-snug text-foreground/80">
                      {candidate.content}
                    </pre>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handlePendingAction(candidate.slug, 'approve')}
                        className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-medium rounded-[6px] bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
                      >
                        <Check className="size-3" />
                        {t('pendingSkills.approve')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePendingAction(candidate.slug, 'dismiss', candidate.description)}
                        className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-medium rounded-[6px] bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
                      >
                        <X className="size-3" />
                        {t('pendingSkills.dismiss')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )}

    {/* OMP skills — read-only group with export-to-craft action */}
    {ompSkills.length > 0 && (
      <div className="mt-2 border-t border-foreground/5 pt-1.5" data-list-role="omp-skills">
        <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {t('skillsList.ompSection')}
        </div>
        <ul>
          {ompSkills.map((skill) => (
            <li
              key={skill.slug}
              title={skill.shadowedByCraft ? t('skillsList.ompShadowed') : skill.metadata.description}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-[8px] ${skill.shadowedByCraft ? 'opacity-50' : ''}`}
            >
              <SkillAvatar skill={skill} size="sm" workspaceId={workspaceId} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate text-sm">{skill.metadata.name}</span>
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground">
                    {t('skillsList.ompBadge')}
                  </span>
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {skill.shadowedByCraft ? t('skillsList.ompShadowed') : skill.metadata.description}
                </span>
              </span>
              <button
                type="button"
                disabled={exportingSlug !== null}
                onClick={() => void handleExportOmpSkill(skill)}
                className="shrink-0 inline-flex items-center gap-1 h-6 px-2 text-[11px] font-medium rounded-[6px] bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors disabled:opacity-50"
              >
                <PackageOpen className="size-3" />
                {t('skillsList.ompExport')}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )}

    {/* Send to Workspace dialog */}
    {sendResourceSlug && (
      <SendResourceToWorkspaceDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        resourceType="skill"
        resourceIds={[sendResourceSlug]}
        resourceLabel={sendResourceLabel}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
      />
    )}
    </>
  )
}
