import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Zap, PackageOpen } from 'lucide-react'
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
