/**
 * Sidebar footer profile strip — avatar, display name, level, XP bar, balance.
 * Click opens Settings.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

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
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function ProfileStrip({ data, onClick, className }: ProfileStripProps) {
  const { t } = useTranslation()
  const initials = initialsFromName(data.displayName)
  const balanceLabel =
    data.balance === null || data.balance === undefined
      ? t('profile.balanceEmpty')
      : t('profile.balance', { amount: data.balance })

  const xpLabel =
    data.nextThreshold == null
      ? t('profile.xpMax', { xp: data.xp })
      : t('profile.xpProgress', {
          current: data.xpIntoLevel,
          next: data.xpForNext + data.xpIntoLevel,
        })

  const pct = Math.round(Math.min(1, Math.max(0, data.progress)) * 100)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2 py-2 rounded-md',
        'text-left hover:bg-foreground/5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
      aria-label={t('profile.openSettings', { name: data.displayName })}
      data-tutorial="profile-strip"
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-[11px] font-medium bg-foreground/10 text-foreground/80">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate text-[13px] font-medium text-foreground/90">
            {data.displayName}
          </span>
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80 tabular-nums">
            {t('profile.level', { level: data.level })}
          </span>
        </div>

        <div
          className="h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={xpLabel}
          title={xpLabel}
        >
          <div
            className="h-full rounded-full bg-primary/80 transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground/70 tabular-nums">
          <span className="truncate">{xpLabel}</span>
          <span className="shrink-0" title={t('profile.balanceLabel')}>
            {balanceLabel}
          </span>
        </div>
      </div>
    </button>
  )
}
