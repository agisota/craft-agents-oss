/**
 * Sidebar profile strip — compact identity trigger.
 *
 * Account switching lives in the top-bar AccountMenu. This strip only shows
 * the current display name and opens Settings (host onClick). Legacy
 * gamification values remain in ProfileStripData for host compatibility, but
 * this surface renders no progress, level, balance, or account switcher.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const bundledDefaultAvatar = new URL(
  '../../../../resources/default-avatar.svg',
  import.meta.url,
).href

export interface ProfileStripData {
  displayName: string
  level: number
  xp: number
  progress: number
  xpIntoLevel: number
  xpForNext: number
  nextThreshold: number | null
  balance: number | null
}

interface ProfileStripProps {
  data: ProfileStripData
  onClick: () => void
  className?: string
  defaultAvatarFallback?: React.ReactNode
}

export function ProfileStrip({
  data,
  onClick,
  className,
  defaultAvatarFallback,
}: ProfileStripProps) {
  const { t } = useTranslation()
  const displayName = data.displayName || t('profile.defaultName')
  const avatarFallback = defaultAvatarFallback ?? (
    <img
      src={bundledDefaultAvatar}
      alt=""
      className="h-full w-full object-cover"
    />
  )

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-2 rounded-md',
        'text-left hover:bg-foreground/5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
      aria-label={t('accountMenu.openMenu')}
      data-tutorial="profile-strip"
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          delayMs={0}
          className="bg-foreground/10 text-foreground/80"
        >
          {avatarFallback}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground/90">
        {displayName}
      </span>
    </button>
  )
}
