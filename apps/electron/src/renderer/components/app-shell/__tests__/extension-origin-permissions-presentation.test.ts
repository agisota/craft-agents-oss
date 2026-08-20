import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const extensionsPath = join(__dirname, '../../../pages/settings/ExtensionsSettingsPage.tsx')
const marketplacePath = join(__dirname, '../../../pages/settings/MarketplaceSettingsPage.tsx')
const kindPath = join(__dirname, '../../../../../../../packages/shared/src/extensions/marketplace-kind.ts')

describe('extension origin and permissions presentation', () => {
  const extensions = readFileSync(extensionsPath, 'utf8')
  const marketplace = readFileSync(marketplacePath, 'utf8')
  const kind = readFileSync(kindPath, 'utf8')

  it('shows installed origin next to runtime', () => {
    expect(extensions).toContain('origin={record.providerId}')
    expect(extensions).toContain('data-extension-origin={origin}')
    expect(extensions).toContain('t(`extensions.origin.${origin}`')
    expect(extensions).toContain('<RuntimeBadge runtime={runtime} />')
  })

  it('chips marketplace permissions beside GitHub origin and highlights high-risk', () => {
    expect(marketplace).toContain('permissionsForMarketplaceKind(e.kind)')
    expect(marketplace).toContain('isHighRiskMarketplacePermission(permission)')
    expect(marketplace).toContain('data-marketplace-permission={permission}')
    expect(marketplace).toContain('e.source.repo')
    expect(marketplace).not.toContain('CatalogProvider')
  })

  it('keeps marketplace kind permissions in a browser-safe helper', () => {
    expect(kind).toContain("skillpack: ['ui.command']")
    expect(kind).toContain("tool: ['shell.execute', 'network.request']")
    expect(kind).toContain('extensionPermissionRisk')
    expect(kind).not.toContain('node:fs')
    expect(kind).not.toContain('from \'fs\'')
  })
})
