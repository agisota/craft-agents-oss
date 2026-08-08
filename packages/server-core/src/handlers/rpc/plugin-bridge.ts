/**
 * SiYuan plugin bridge RPC handlers (W6).
 *
 * LOCAL_ONLY. Kernel plugin list API is not wired — fail-soft with residual
 * note and optional fixture (env CRAFT_SIYUAN_PLUGIN_FIXTURE_JSON or
 * setPluginBridgeFixture for tests). Never invents crashing kernel endpoints.
 * Does not execute third-party plugin code.
 */

import { existsSync, readFileSync } from 'node:fs'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { CONFIG_DIR } from '@craft-agent/shared/config/paths'
import {
  detectCompatLevel,
  getExtensionStateStore,
  localizedText,
  parseSiYuanPluginManifest,
  projectBridgeContributions,
  type BridgeProjectedContributions,
  type PluginBridgeGetProjectionsArgs,
  type PluginBridgeListItem,
  type PluginBridgeListResult,
  type PluginBridgeSetEnabledArgs,
  type PluginBridgeSetEnabledResult,
  type SiYuanBridgeManifest,
} from '@craft-agent/shared/extensions'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.pluginBridge.LIST_PLUGINS,
  RPC_CHANNELS.pluginBridge.GET_PROJECTIONS,
  RPC_CHANNELS.pluginBridge.SET_ENABLED,
  RPC_CHANNELS.pluginBridge.OPEN_COMPAT,
] as const

const KERNEL_RESIDUAL =
  'kernel plugin list API not wired; use fixture listFn'

/** In-memory fixture for tests / local smoke. */
let fixtureManifests: SiYuanBridgeManifest[] | null = null

export function setPluginBridgeFixture(
  manifests: SiYuanBridgeManifest[] | null,
): void {
  fixtureManifests = manifests
}

export function resetPluginBridgeFixture(): void {
  fixtureManifests = null
}

function configDir(): string {
  return process.env.CRAFT_CONFIG_DIR || CONFIG_DIR
}

function extensionIdFor(name: string): string {
  return name.startsWith('siyuan-plugin:') ? name : `siyuan-plugin:${name}`
}

function barePluginId(pluginId: string): string {
  return pluginId.startsWith('siyuan-plugin:')
    ? pluginId.slice('siyuan-plugin:'.length)
    : pluginId
}

function loadFixtureFromEnv(): SiYuanBridgeManifest[] | null {
  const path = process.env.CRAFT_SIYUAN_PLUGIN_FIXTURE_JSON
  if (!path || !existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    const arr = Array.isArray(raw) ? raw : [raw]
    const out: SiYuanBridgeManifest[] = []
    for (const item of arr) {
      const parsed = parseSiYuanPluginManifest(item)
      if (parsed) out.push(parsed)
    }
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}

export function loadPluginBridgeManifests(): {
  manifests: SiYuanBridgeManifest[]
  fixture: boolean
} {
  if (fixtureManifests) {
    return { manifests: fixtureManifests, fixture: true }
  }
  const fromEnv = loadFixtureFromEnv()
  if (fromEnv) {
    return { manifests: fromEnv, fixture: true }
  }
  return { manifests: [], fixture: false }
}

/** Catalog listFn for SiYuan Bazaar provider (fixture/env only until kernel API). */
export function pluginBridgeBazaarListFn(): SiYuanBridgeManifest[] {
  return loadPluginBridgeManifests().manifests
}


function findManifest(
  pluginId: string,
  override?: unknown,
): SiYuanBridgeManifest | null {
  if (override !== undefined) {
    return parseSiYuanPluginManifest(override)
  }
  const bare = barePluginId(pluginId)
  const { manifests } = loadPluginBridgeManifests()
  return (
    manifests.find((m) => m.name === bare || extensionIdFor(m.name) === pluginId) ??
    null
  )
}

function toListItem(
  manifest: SiYuanBridgeManifest,
  enabled: boolean,
  capabilityProbeFailed?: boolean,
): PluginBridgeListItem {
  const level = detectCompatLevel(manifest, { capabilityProbeFailed })
  return {
    id: extensionIdFor(manifest.name),
    name: manifest.name,
    version: manifest.version,
    displayName: localizedText(manifest.displayName) ?? manifest.name,
    description: localizedText(manifest.description),
    enabled,
    level,
    requiresFullChrome: manifest.craft?.requiresFullChrome,
    author: typeof manifest.author === 'string' ? manifest.author : undefined,
  }
}

export interface PluginBridgeOpenCompatArgs {
  pluginId?: string
}

export interface PluginBridgeOpenCompatResult {
  route: string
  ref: { kind: 'notebook'; id: string }
}

export function registerPluginBridgeHandlers(
  server: RpcServer,
  _deps: HandlerDeps,
): void {
  server.handle(
    RPC_CHANNELS.pluginBridge.LIST_PLUGINS,
    async (): Promise<PluginBridgeListResult> => {
      const { manifests, fixture } = loadPluginBridgeManifests()
      const store = getExtensionStateStore(configDir())
      const plugins = manifests.map((m) => {
        const id = extensionIdFor(m.name)
        const enabled = store.isEnabled(id, true)
        return toListItem(m, enabled)
      })
      return {
        plugins,
        ...(fixture ? { fixture: true } : {}),
        residual: KERNEL_RESIDUAL,
      }
    },
  )

  server.handle(
    RPC_CHANNELS.pluginBridge.GET_PROJECTIONS,
    async (
      _ctx,
      args?: PluginBridgeGetProjectionsArgs,
    ): Promise<BridgeProjectedContributions> => {
      const pluginId = args?.pluginId ?? ''
      const manifest = findManifest(pluginId, args?.manifest)
      // grantedPermissions omitted → install-time default from declared
      // craft.contributes permissions (projectBridgeContributions / S-05).
      return projectBridgeContributions(manifest, {
        grantedPermissions: args?.grantedPermissions,
        capabilityProbeFailed: args?.capabilityProbeFailed,
      })
    },
  )

  server.handle(
    RPC_CHANNELS.pluginBridge.SET_ENABLED,
    async (
      _ctx,
      args?: PluginBridgeSetEnabledArgs,
    ): Promise<PluginBridgeSetEnabledResult> => {
      if (!args?.pluginId || typeof args.enabled !== 'boolean') {
        throw new Error('pluginBridge.setEnabled: pluginId and enabled are required')
      }
      const id = extensionIdFor(barePluginId(args.pluginId))
      try {
        const store = getExtensionStateStore(configDir())
        store.setEnabled(id, args.enabled)
        return {
          pluginId: id,
          enabled: args.enabled,
          persisted: 'local',
          residual: 'kernel enable/disable not wired; local ExtensionStateStore only',
        }
      } catch {
        return {
          pluginId: id,
          enabled: args.enabled,
          persisted: 'none',
          residual: 'failed to persist local enable preference; kernel not wired',
        }
      }
    },
  )

  server.handle(
    RPC_CHANNELS.pluginBridge.OPEN_COMPAT,
    async (
      _ctx,
      _args?: PluginBridgeOpenCompatArgs,
    ): Promise<PluginBridgeOpenCompatResult> => {
      // Route descriptor only — UI navigates; no kernel / BrowserView side effects here.
      return {
        route: 'knowledge/notebook/__full__',
        ref: { kind: 'notebook', id: '__full__' },
      }
    },
  )
}
