import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const profileStripPath = join(__dirname, '../ProfileStrip.tsx')

describe('ProfileStrip presentation', () => {
  const src = readFileSync(profileStripPath, 'utf8')

  it('renders a compact identity trigger instead of persistent XP chrome', () => {
    expect(src).toContain('defaultAvatarFallback?: React.ReactNode')
    expect(src).toContain('default-avatar.svg')
    expect(src).toContain('data-tutorial="profile-strip"')
    expect(src).toContain("t(`settings.account.plan.${plan}`)")
    expect(src).toContain("t('profile.balanceLabel')")
    expect(src).toContain("t('profile.balanceEmpty')")
    expect(src).not.toContain('initialsFromName')
    expect(src).not.toContain('role="progressbar"')
    expect(src).not.toContain("t('profile.level'")
    expect(src).not.toContain("t('profile.xp")
  })

  it('does not present a competing account switcher or secret-bearing actions', () => {
    expect(src).not.toContain('<DropdownMenu')
    expect(src).not.toContain('<ChevronDown')
    expect(src).not.toContain("t('menu.settings')")
    expect(src).not.toContain("t('menu.checkForUpdates')")
    expect(src).not.toContain("t('settings.accounts.signOut')")
    expect(src).not.toContain('showLogoutConfirmation()')
    expect(src).not.toContain('window.electronAPI.logout()')
    expect(src).not.toContain('identityGetState')
    expect(src).not.toContain('credentialValue')
    expect(src).not.toContain('menu.keyboardShortcuts')
    expect(src).toContain('onClick={onClick}')
  })
})
