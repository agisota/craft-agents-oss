/**
 * AccountSettingsPage — first settings tab: identity, plan, XP, balance.
 *
 * Connections stay on settings/accounts. Balance is local credits or an em dash
 * when gamification.balance is null. Plan is a local label, not billing.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSegmentedControl,
} from '@/components/settings'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { navigate, routes } from '@/lib/navigate'
import {
  PROFILE_PLANS,
  type Profile,
  type ProfilePlan,
} from '../../../shared/types'
import type { XpEventType } from '@craft-agent/shared/gamification'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'account',
}

const bundledDefaultAvatar = new URL(
  '../../../../resources/default-avatar.svg',
  import.meta.url,
).href

const XP_EVENT_KEYS: Record<XpEventType, string> = {
  session_completed: 'settings.account.event.sessionCompleted',
  automation_ran: 'settings.account.event.automationRan',
  cloud_run_imported: 'settings.account.event.cloudRunImported',
  note_linked: 'settings.account.event.noteLinked',
}

type GamificationSnapshot = {
  xp: number
  level: number
  balance: number | null
  progress: number
  xpIntoLevel: number
  xpForNext: number
  nextThreshold: number | null
  currentThreshold?: number
  recentEvents?: Array<{ type: XpEventType; xp: number; at: number }>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatBalance(balance: number | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (balance === null || !Number.isFinite(balance)) return t('profile.balanceEmpty')
  return t('profile.balance', { amount: balance })
}

async function avatarDataUrlFromPickedFile(): Promise<string | null> {
  const paths = await window.electronAPI.openFileDialog()
  const path = paths[0]
  if (!path) return null
  const attachment = await window.electronAPI.readUserAttachment(path)
  if (!attachment || attachment.type !== 'image' || !attachment.base64) {
    throw new Error('image-required')
  }
  const mime = attachment.mimeType.toLowerCase()
  if (mime.includes('svg') || mime.includes('html')) {
    throw new Error('image-required')
  }
  let pngBase64 = attachment.thumbnailBase64
  if (!pngBase64) {
    pngBase64 = (await window.electronAPI.generateThumbnail(attachment.base64, attachment.mimeType)) ?? undefined
  }
  if (!pngBase64) throw new Error('image-required')
  return `data:image/png;base64,${pngBase64}`
}

export default function AccountSettingsPage() {
  const { t } = useTranslation()
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [displayName, setDisplayName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [changingAvatar, setChangingAvatar] = React.useState(false)
  const [gamification, setGamification] = React.useState<GamificationSnapshot | null>(null)

  const load = React.useCallback(async () => {
    try {
      const [identity, nextGamification] = await Promise.all([
        window.electronAPI.identityGetState(),
        window.electronAPI.getGamificationProfile(),
      ])
      setProfile(identity.profile)
      setDisplayName(identity.profile.displayName)
      setEmail(identity.profile.email ?? '')
      setGamification(nextGamification)
    } catch (error) {
      toast.error(t('settings.account.loadFailed', { message: errorMessage(error) }))
    }
  }, [t])

  React.useEffect(() => {
    void load()
    const offIdentity = window.electronAPI.onIdentityChanged?.(() => {
      void load()
    })
    const offXp = window.electronAPI.onGamificationChanged((payload) => {
      setGamification(payload)
    })
    return () => {
      offIdentity?.()
      offXp()
    }
  }, [load])

  const persist = async (input: Parameters<typeof window.electronAPI.identityUpdateProfile>[0]) => {
    const next = await window.electronAPI.identityUpdateProfile(input)
    setProfile(next.profile)
    setDisplayName(next.profile.displayName)
    setEmail(next.profile.email ?? '')
    return next.profile
  }

  const handleSaveProfile = async () => {
    const trimmed = displayName.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await persist({ displayName: trimmed, email })
      toast.success(t('settings.accounts.profileSaved'))
    } catch (error) {
      toast.error(t('settings.accounts.profileSaveFailed', { message: errorMessage(error) }))
    } finally {
      setSaving(false)
    }
  }

  const handlePlanChange = async (plan: ProfilePlan) => {
    try {
      await persist({ plan })
    } catch (error) {
      toast.error(t('settings.accounts.profileSaveFailed', { message: errorMessage(error) }))
    }
  }

  const handleChangeAvatar = async () => {
    setChangingAvatar(true)
    try {
      const dataUrl = await avatarDataUrlFromPickedFile()
      if (!dataUrl) return
      await persist({ avatar: dataUrl })
      toast.success(t('settings.account.avatarSaved'))
    } catch (error) {
      toast.error(t('settings.account.avatarFailed', { message: errorMessage(error) }))
    } finally {
      setChangingAvatar(false)
    }
  }

  const handleRemoveAvatar = async () => {
    try {
      await persist({ avatar: '' })
    } catch (error) {
      toast.error(t('settings.accounts.profileSaveFailed', { message: errorMessage(error) }))
    }
  }

  const name = profile?.displayName || t('profile.defaultName')
  const plan = profile?.plan ?? 'standard'
  const progressPct = Math.round((gamification?.progress ?? 0) * 100)
  const recent = gamification?.recentEvents ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-4 border-b border-border/60">
        <h1 className="text-lg font-semibold">{t('settings.account.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.account.description')}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <SettingsSection title={t('settings.account.identitySection')}>
          <SettingsCard>
            <SettingsRow label={t('settings.account.avatar')}>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  {profile?.avatar ? <AvatarImage src={profile.avatar} alt="" /> : null}
                  <AvatarFallback delayMs={0} className="bg-foreground/10">
                    <img src={bundledDefaultAvatar} alt="" className="h-full w-full object-cover" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="outline" disabled={changingAvatar} onClick={() => void handleChangeAvatar()}>
                    {t('settings.account.changeAvatar')}
                  </Button>
                  {profile?.avatar ? (
                    <Button size="sm" variant="ghost" onClick={() => void handleRemoveAvatar()}>
                      {t('settings.account.removeAvatar')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </SettingsRow>
            <SettingsRow label={t('settings.accounts.displayName')}>
              <div className="flex items-center gap-2 min-w-[240px]">
                <Input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="h-8"
                  aria-label={t('settings.accounts.displayName')}
                />
              </div>
            </SettingsRow>
            <SettingsRow
              label={t('settings.account.email')}
              description={t('settings.account.emailHint')}
            >
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-8 min-w-[240px]"
                inputMode="email"
                autoComplete="email"
                placeholder={t('settings.account.emailEmpty')}
                aria-label={t('settings.account.email')}
              />
            </SettingsRow>
            <SettingsRow label="">
              <Button size="sm" onClick={() => void handleSaveProfile()} disabled={saving || !displayName.trim()}>
                {t('common.save')}
              </Button>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={t('settings.account.planSection')}>
          <SettingsCard>
            <SettingsRow
              label={t('settings.account.plan')}
              description={t('settings.account.planHint')}
            >
              <SettingsSegmentedControl
                size="sm"
                value={plan}
                onValueChange={(next) => void handlePlanChange(next)}
                options={PROFILE_PLANS.map((value) => ({
                  value,
                  label: t(`settings.account.plan.${value}`),
                }))}
              />
            </SettingsRow>
            <SettingsRow label={t('profile.balanceLabel')} description={t('settings.account.balanceHint')}>
              <span className="text-sm tabular-nums">{formatBalance(gamification?.balance ?? null, t)}</span>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={t('settings.account.progressSection')}>
          <SettingsCard>
            <SettingsRow label={t('settings.account.level')}>
              <span className="text-sm">{t('profile.level', { level: gamification?.level ?? 1 })}</span>
            </SettingsRow>
            <SettingsRow
              label={t('settings.account.xp')}
              description={t('settings.account.xpHint')}
            >
              <div className="min-w-[220px] space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>
                    {gamification?.nextThreshold == null
                      ? t('profile.xpMax', { xp: gamification?.xp ?? 0 })
                      : t('profile.xpProgress', {
                          current: gamification?.xp ?? 0,
                          next: gamification.nextThreshold,
                        })}
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPct}
                  className="h-1.5 rounded-full bg-foreground/10 overflow-hidden"
                >
                  <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            </SettingsRow>
            <SettingsRow label={t('settings.account.xpSources')}>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>{t('settings.account.source.sessionCompleted')}</li>
                <li>{t('settings.account.source.automationRan')}</li>
                <li>{t('settings.account.source.cloudRunImported')}</li>
                <li>{t('settings.account.source.noteLinked')}</li>
              </ul>
            </SettingsRow>
            <SettingsRow label={t('settings.account.recentXp')}>
              {recent.length === 0 ? (
                <span className="text-sm text-muted-foreground">{t('settings.account.recentXpEmpty')}</span>
              ) : (
                <ul className="text-xs space-y-1 min-w-[220px]">
                  {recent.slice(0, 8).map((event, index) => (
                    <li key={`${event.at}-${index}`} className="flex justify-between gap-3">
                      <span>{t(XP_EVENT_KEYS[event.type] ?? event.type)}</span>
                      <span className="tabular-nums text-muted-foreground">+{event.xp}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={t('settings.accounts.connectionsSection')}>
          <SettingsCard>
            <SettingsRow
              label={name}
              description={t('settings.account.openConnectionsHint')}
            >
              <Button size="sm" variant="outline" onClick={() => navigate(routes.view.settings('accounts'))}>
                {t('settings.account.openConnections')}
              </Button>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      </div>
    </div>
  )
}
