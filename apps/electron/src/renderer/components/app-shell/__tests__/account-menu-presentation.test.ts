import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * AccountMenu is the unified Identity Center (S-07): Profile, Workspaces,
 * Connections, and Account & Security. Compact headers use a nested Drawer;
 * desktop headers use a DropdownMenu. Workspace switching stays here so
 * ProfileStrip is not a second account switcher.
 */
const accountMenuPath = join(__dirname, '../AccountMenu.tsx')

describe('AccountMenu presentation mode', () => {
  const src = readFileSync(accountMenuPath, 'utf8')
  const compactBranch = src.slice(src.indexOf('if (compact)'), src.indexOf('// Desktop: DropdownMenu'))
  const desktopBranch = src.slice(src.indexOf('// Desktop: DropdownMenu'))

  it('uses a nested Drawer when compact is true', () => {
    expect(src).toContain('if (compact)')
    expect(src).toContain('<Drawer nested open={open} onOpenChange={handleOpenChange}>')
    expect(src).toContain('DrawerContent')
    expect(src).toContain('data-account-menu={compact ? \'compact\' : \'topbar\'}')
    expect(src).toContain("<DrawerTitle>{t('workspace.selectWorkspace')}</DrawerTitle>")
  })

  it('keeps DropdownMenu on the desktop (!compact) path only', () => {
    expect(src).toContain('<DropdownMenu open={open} onOpenChange={handleOpenChange}>')
    expect(src).toContain('StyledDropdownMenuContent')

    // Compact branch must not construct DropdownMenu; only the desktop return does.
    expect(compactBranch).toContain('<Drawer nested')
    expect(compactBranch).not.toContain('<DropdownMenu')
    expect(compactBranch).not.toContain('StyledDropdownMenuContent')
  })

  it('loads Identity Center state via identityGetState and getCredentialHealth', () => {
    expect(src).toContain('window.electronAPI.identityGetState')
    expect(src).toContain('window.electronAPI.getCredentialHealth()')
    expect(src).toContain('window.electronAPI.onIdentityChanged')
    expect(src).toContain('void loadIdentity()')
    expect(src).toContain('void loadCredentialHealth()')
    expect(src).toContain("const triggerLabel = selectedWorkspace?.name || t('workspace.selectWorkspace')")
    expect(src).toContain('onSelectWorkspace: (workspaceId: string, openInNewWindow?: boolean) => void | Promise<void>')
    expect(src).toContain('onWorkspaceCreated?.(workspace)')
    expect(src).toContain('onWorkspaceRemoved?.()')
  })

  it('exposes four Identity Center sections on both compact and desktop surfaces', () => {
    for (const branch of [compactBranch, desktopBranch]) {
      expect(branch).toContain("t('accountMenu.section.profile')")
      expect(branch).toContain("t('accountMenu.section.workspaces')")
      expect(branch).toContain("t('accountMenu.section.connections')")
      expect(branch).toContain("t('accountMenu.section.security')")
      expect(branch).toContain("t('accountMenu.editProfile')")
      expect(branch).toContain("t('accountMenu.manageConnections')")
      expect(branch).toContain("t('accountMenu.openAccountsSettings')")
      expect(branch).toContain("t('accountMenu.credentialHealth'")
      expect(branch).toContain("t('workspace.addWorkspace')")
      expect(branch).toContain('profileModeLabel')
      expect(branch).toContain('connectionsSummary')
      expect(branch).not.toContain("t('accountMenu.localProfile')")
    }

    expect(src).toContain("navigate(routes.view.settings('account'))")
    expect(src).toContain("navigate(routes.view.settings('accounts'))")
    expect(src).toContain('openAccountPage')
    expect(src).toContain('openAccountsSettings')
    expect(src).toContain("connection.provider === 'siyuan-cloud'")
  })

  it('does not present secrets or a second account switcher', () => {
    expect(src).not.toContain('credentialValue')
    expect(src).not.toContain('type="password"')
    expect(src).not.toContain('import { ProfileStrip')
    expect(src).not.toContain('<ProfileStrip')
    expect(src).toContain("t('accountMenu.profileMode'")
    expect(src).toContain('errors: errorCount')
    expect(src).not.toContain("t('accountMenu.localProfile')")
    expect(src).not.toContain('initialsFromName')
    expect((src.match(/<DropdownMenu /g) ?? []).length).toBe(1)
    expect((src.match(/<Drawer nested/g) ?? []).length).toBe(1)
  })
})
