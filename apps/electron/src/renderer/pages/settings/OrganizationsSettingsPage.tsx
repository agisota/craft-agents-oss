/**
 * OrganizationsSettingsPage (P3.1)
 *
 * Create orgs, invite by email/username, list members + pending invites.
 * Local-first; invite redemption prefers CRAFT_SERVER_URL when present.
 */

import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { routes } from '@/lib/navigate'
import { Spinner } from '@craft-agent/ui'
import { toast } from 'sonner'
import {
  SettingsSection,
  SettingsCard,
  SettingsInput,
  SettingsRow,
} from '@/components/settings'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type {
  OrganizationWithMembers,
  OrgInvite,
  OrgMember,
  OrgRole,
} from '@craft-agent/shared/orgs'
import { useAppShellContext } from '@/context/AppShellContext'
import { cn } from '@/lib/utils'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'organizations',
}

type Identity = { userId: string; username?: string; email?: string; name?: string }

function roleLabel(role: OrgRole, t: (k: string) => string): string {
  if (role === 'owner') return t('settings.orgs.roleOwner')
  if (role === 'admin') return t('settings.orgs.roleAdmin')
  return t('settings.orgs.roleMember')
}

export default function OrganizationsSettingsPage() {
  const { t } = useTranslation()
  const appShell = useAppShellContext()
  const activeWorkspaceId = appShell.activeWorkspaceId

  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState<OrganizationWithMembers[]>([])
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)

  const [newOrgName, setNewOrgName] = useState('')
  const [creating, setCreating] = useState(false)

  const [inviteTarget, setInviteTarget] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)

  const [acceptToken, setAcceptToken] = useState('')
  const [accepting, setAccepting] = useState(false)

  const [usernameDraft, setUsernameDraft] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [savingIdentity, setSavingIdentity] = useState(false)

  const [linking, setLinking] = useState(false)

  const refresh = useCallback(async () => {
    if (!window.electronAPI?.listOrganizations) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [list, id] = await Promise.all([
        window.electronAPI.listOrganizations(),
        window.electronAPI.getOrgIdentity(),
      ])
      setOrgs(list)
      setIdentity(id)
      setUsernameDraft(id.username ?? '')
      setEmailDraft(id.email ?? '')
      setSelectedOrgId((prev) => {
        if (prev && list.some((o) => o.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('settings.orgs.loadFailed'), { description: message })
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selected = orgs.find((o) => o.id === selectedOrgId) ?? null

  const handleCreate = useCallback(async () => {
    const name = newOrgName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const org = await window.electronAPI.createOrganization({ name })
      setNewOrgName('')
      setOrgs((prev) => [...prev, org])
      setSelectedOrgId(org.id)
      toast.success(t('settings.orgs.created', { name: org.name }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('settings.orgs.createFailed'), { description: message })
    } finally {
      setCreating(false)
    }
  }, [newOrgName, creating, t])

  const handleInvite = useCallback(async () => {
    if (!selected || !inviteTarget.trim() || inviting) return
    setInviting(true)
    try {
      const invite = await window.electronAPI.inviteToOrganization({
        orgId: selected.id,
        emailOrUsername: inviteTarget.trim(),
        role: inviteRole,
      })
      setInviteTarget('')
      setOrgs((prev) =>
        prev.map((o) =>
          o.id === selected.id
            ? {
                ...o,
                pendingInvites: [
                  ...o.pendingInvites.filter((i) => i.id !== invite.id),
                  invite,
                ],
              }
            : o,
        ),
      )
      toast.success(t('settings.orgs.inviteSent', { target: invite.emailOrUsername }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('settings.orgs.inviteFailed'), { description: message })
    } finally {
      setInviting(false)
    }
  }, [selected, inviteTarget, inviteRole, inviting, t])

  const handleAccept = useCallback(async () => {
    const token = acceptToken.trim()
    if (!token || accepting) return
    setAccepting(true)
    try {
      const result = await window.electronAPI.acceptOrganizationInvite({ token })
      setAcceptToken('')
      await refresh()
      setSelectedOrgId(result.org.id)
      toast.success(t('settings.orgs.inviteAccepted', { name: result.org.name }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('settings.orgs.acceptFailed'), { description: message })
    } finally {
      setAccepting(false)
    }
  }, [acceptToken, accepting, refresh, t])

  const handleSaveIdentity = useCallback(async () => {
    if (savingIdentity) return
    setSavingIdentity(true)
    try {
      const next = await window.electronAPI.updateOrgIdentity({
        username: usernameDraft.trim() || undefined,
        email: emailDraft.trim() || undefined,
      })
      setIdentity(next)
      toast.success(t('settings.orgs.identitySaved'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('settings.orgs.identitySaveFailed'), { description: message })
    } finally {
      setSavingIdentity(false)
    }
  }, [usernameDraft, emailDraft, savingIdentity, t])

  const handleLinkWorkspace = useCallback(async () => {
    if (!activeWorkspaceId || !selected || linking) return
    setLinking(true)
    try {
      await window.electronAPI.setWorkspaceOrganization(activeWorkspaceId, selected.id)
      toast.success(t('settings.orgs.workspaceLinked', { name: selected.name }))
      await appShell.onRefreshWorkspaces?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('settings.orgs.workspaceLinkFailed'), { description: message })
    } finally {
      setLinking(false)
    }
  }, [activeWorkspaceId, selected, linking, t, appShell])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={t('settings.orgs.title')}
        actions={<HeaderMenu route={routes.view.settings('organizations')} />}
      />
      <ScrollArea className="flex-1">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-6">
          <SettingsSection
            title={t('settings.orgs.identity')}
            description={t('settings.orgs.identityDesc')}
          >
            <SettingsCard>
              <div className="space-y-3 p-3">
                <div className="text-xs text-muted-foreground">
                  {t('settings.orgs.userId')}:{' '}
                  <span className="font-mono text-foreground/80">{identity?.userId ?? '—'}</span>
                </div>
                <SettingsInput
                  label={t('settings.orgs.username')}
                  value={usernameDraft}
                  onChange={setUsernameDraft}
                  placeholder={t('settings.orgs.usernamePlaceholder')}
                  inCard
                />
                <SettingsInput
                  label={t('settings.orgs.email')}
                  value={emailDraft}
                  onChange={setEmailDraft}
                  type="email"
                  placeholder={t('settings.orgs.emailPlaceholder')}
                  inCard
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => void handleSaveIdentity()} disabled={savingIdentity}>
                    {savingIdentity ? t('common.saving') : t('common.save')}
                  </Button>
                </div>
              </div>
            </SettingsCard>
          </SettingsSection>

          <SettingsSection
            title={t('settings.orgs.create')}
            description={t('settings.orgs.createDesc')}
          >
            <SettingsCard>
              <div className="flex items-end gap-2 p-3">
                <div className="flex-1">
                  <SettingsInput
                    label={t('settings.orgs.orgName')}
                    value={newOrgName}
                    onChange={setNewOrgName}
                    placeholder={t('settings.orgs.orgNamePlaceholder')}
                    inCard
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCreate()
                    }}
                  />
                </div>
                <Button size="sm" onClick={() => void handleCreate()} disabled={!newOrgName.trim() || creating}>
                  {creating ? t('common.creating') : t('common.create')}
                </Button>
              </div>
            </SettingsCard>
          </SettingsSection>

          <SettingsSection
            title={t('settings.orgs.yourOrgs')}
            description={t('settings.orgs.yourOrgsDesc')}
          >
            <SettingsCard>
              {orgs.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">{t('settings.orgs.empty')}</div>
              ) : (
                <div className="divide-y divide-border/40">
                  {orgs.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => setSelectedOrgId(org.id)}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors',
                        selectedOrgId === org.id ? 'bg-foreground/5' : 'hover:bg-foreground/3',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{org.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {org.slug} · {t('settings.orgs.memberCount', { count: org.members.length })}
                        </div>
                      </div>
                      {selectedOrgId === org.id && (
                        <span className="text-[11px] text-muted-foreground">{t('common.selected')}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </SettingsCard>
          </SettingsSection>

          {selected && (
            <>
              <SettingsSection
                title={t('settings.orgs.members')}
                description={t('settings.orgs.membersDesc', { name: selected.name })}
              >
                <SettingsCard>
                  <div className="divide-y divide-border/40">
                    {selected.members.map((m: OrgMember) => (
                      <SettingsRow
                        key={`${m.orgId}:${m.userId}`}
                        label={m.displayLabel || m.userId}
                        description={m.userId}
                        action={
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {roleLabel(m.role, t)}
                          </span>
                        }
                      />
                    ))}
                    {selected.pendingInvites.map((inv: OrgInvite) => (
                      <SettingsRow
                        key={inv.id}
                        label={inv.emailOrUsername}
                        description={t('settings.orgs.pendingInvite')}
                        action={
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                            {roleLabel(inv.role, t)} · {t('settings.orgs.pending')}
                          </span>
                        }
                      />
                    ))}
                  </div>
                </SettingsCard>
              </SettingsSection>

              <SettingsSection
                title={t('settings.orgs.invite')}
                description={t('settings.orgs.inviteDesc')}
              >
                <SettingsCard>
                  <div className="space-y-3 p-3">
                    <SettingsInput
                      label={t('settings.orgs.inviteTarget')}
                      value={inviteTarget}
                      onChange={setInviteTarget}
                      placeholder={t('settings.orgs.inviteTargetPlaceholder')}
                      inCard
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">{t('settings.orgs.role')}</label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                        className="h-8 rounded-md border border-border/60 bg-background px-2 text-sm"
                      >
                        <option value="member">{t('settings.orgs.roleMember')}</option>
                        <option value="admin">{t('settings.orgs.roleAdmin')}</option>
                      </select>
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        onClick={() => void handleInvite()}
                        disabled={!inviteTarget.trim() || inviting}
                      >
                        {inviting ? t('common.sending') : t('settings.orgs.sendInvite')}
                      </Button>
                    </div>
                    {selected.pendingInvites.length > 0 && (
                      <p className="break-all text-[11px] text-muted-foreground">
                        {t('settings.orgs.lastToken')}:{' '}
                        <code className="font-mono">
                          {selected.pendingInvites[selected.pendingInvites.length - 1]?.token}
                        </code>
                      </p>
                    )}
                  </div>
                </SettingsCard>
              </SettingsSection>

              {activeWorkspaceId && (
                <SettingsSection
                  title={t('settings.orgs.linkWorkspace')}
                  description={t('settings.orgs.linkWorkspaceDesc')}
                >
                  <SettingsCard>
                    <div className="flex items-center justify-between gap-3 p-3">
                      <p className="text-sm text-muted-foreground">
                        {t('settings.orgs.linkWorkspaceHint', { name: selected.name })}
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleLinkWorkspace()}
                        disabled={linking}
                      >
                        {linking ? t('common.saving') : t('settings.orgs.linkWorkspaceAction')}
                      </Button>
                    </div>
                  </SettingsCard>
                </SettingsSection>
              )}
            </>
          )}

          <SettingsSection
            title={t('settings.orgs.accept')}
            description={t('settings.orgs.acceptDesc')}
          >
            <SettingsCard>
              <div className="flex items-end gap-2 p-3">
                <div className="flex-1">
                  <SettingsInput
                    label={t('settings.orgs.inviteToken')}
                    value={acceptToken}
                    onChange={setAcceptToken}
                    placeholder={t('settings.orgs.inviteTokenPlaceholder')}
                    inCard
                  />
                </div>
                <Button size="sm" onClick={() => void handleAccept()} disabled={!acceptToken.trim() || accepting}>
                  {accepting ? t('common.loading') : t('settings.orgs.acceptAction')}
                </Button>
              </div>
            </SettingsCard>
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  )
}
