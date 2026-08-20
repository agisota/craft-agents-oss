import type { MarketplaceEntryKind } from '../marketplace/catalog.ts'
import type { ExtensionPermission } from './types.ts'
import { extensionPermissionRisk } from './permissions.ts'

export const MARKETPLACE_KIND_PERMISSIONS: Record<MarketplaceEntryKind, ExtensionPermission[]> = {
  skillpack: ['ui.command'],
  tool: ['shell.execute', 'network.request'],
  'context-doc': ['filesystem.read', 'ui.command'],
}

export function permissionsForMarketplaceKind(kind: MarketplaceEntryKind): ExtensionPermission[] {
  return MARKETPLACE_KIND_PERMISSIONS[kind]
}

export function isHighRiskMarketplacePermission(permission: ExtensionPermission): boolean {
  return extensionPermissionRisk(permission) === 'high'
}
