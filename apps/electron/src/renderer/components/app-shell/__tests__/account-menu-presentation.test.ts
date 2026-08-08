import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P1 guard: AccountMenu inside craft-menu Drawer must not open a Radix
 * DropdownMenu (z-dropdown 100) under Drawer (z-modal 200). Compact mode uses
 * a nested vaul Drawer; desktop keeps DropdownMenu.
 */
const accountMenuPath = join(__dirname, '../AccountMenu.tsx')

describe('AccountMenu presentation mode', () => {
  const src = readFileSync(accountMenuPath, 'utf8')

  it('uses a nested Drawer when compact is true', () => {
    expect(src).toContain('if (compact)')
    expect(src).toContain('<Drawer nested open={open} onOpenChange={handleOpenChange}>')
    expect(src).toContain('DrawerContent')
    expect(src).toContain('data-account-menu={compact ? \'compact\' : \'topbar\'}')
  })

  it('keeps DropdownMenu on the desktop (!compact) path only', () => {
    expect(src).toContain('<DropdownMenu open={open} onOpenChange={handleOpenChange}>')
    expect(src).toContain('StyledDropdownMenuContent')

    // Compact branch must not construct DropdownMenu; only the desktop return does.
    const compactBranch = src.slice(src.indexOf('if (compact)'), src.indexOf('// Desktop: DropdownMenu'))
    expect(compactBranch).toContain('<Drawer nested')
    expect(compactBranch).not.toContain('<DropdownMenu')
    expect(compactBranch).not.toContain('StyledDropdownMenuContent')
  })

  it('documents residual Omnibox bridge as implemented in App.tsx', () => {
    const appSrc = readFileSync(join(__dirname, '../../../App.tsx'), 'utf8')
    expect(appSrc).toContain('embedded')
    expect(appSrc).toContain('⌘K bridge are both implemented')
    expect(appSrc).not.toContain('webContents ⌘K bridge is a follow-up')
  })
})
