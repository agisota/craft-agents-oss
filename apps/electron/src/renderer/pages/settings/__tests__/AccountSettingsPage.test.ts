import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SETTINGS_PAGES } from '../../../../shared/settings-registry'

const source = readFileSync(join(import.meta.dir, '..', 'AccountSettingsPage.tsx'), 'utf8')

describe('AccountSettingsPage', () => {
  it('is the first settings page', () => {
    expect(SETTINGS_PAGES[0]?.id).toBe('account')
  })

  it('loads identity and gamification and persists profile fields', () => {
    expect(source).toContain('window.electronAPI.identityGetState()')
    expect(source).toContain('window.electronAPI.getGamificationProfile()')
    expect(source).toContain('window.electronAPI.identityUpdateProfile')
    expect(source).toContain('window.electronAPI.openFileDialog()')
    expect(source).toContain('window.electronAPI.readUserAttachment(path)')
    expect(source).toContain('t(`settings.account.plan.${value}`)')
    expect(source).toContain('PROFILE_PLANS')
    expect(source).toContain("t('profile.balanceEmpty')")
    expect(source).not.toContain('checkout')
    expect(source).not.toContain('stripe')
    expect(source).not.toContain('USD')
    expect(source).toContain("routes.view.settings('accounts')")
  })
})
