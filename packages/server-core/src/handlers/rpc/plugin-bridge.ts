/**
 * SiYuan plugin bridge RPC handlers (W6).
 *
 * LOCAL_ONLY. LIST order: fixture/env → kernel (soft) → filesystem scan of
 * known SiYuan data dirs → empty + residual.
 * Kernel client resolution: healthy knowledge connections → any-status
 * connections with token → conf.json api.token fallback (G2-safe, never spawn).
 * Never spawns/downloads SiYuan (G2). Does not execute third-party plugin code.
 * Does not rewrite petals.json on disk — kernel owns petal state.
 */

import { existsSync, readFileSync } from 'node:fs'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { CONFIG_DIR } from '@craft-agent/shared/config/paths'
import { getCredentialManager } from '@craft-agent/shared/credentials'
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
import {
  SiyuanKernelClient,
  type SiyuanBazaarPluginPackage,
  type SiyuanInstalledPluginPackage,
  type SiyuanPetalInfo,
} from '@craft-agent/core/knowledge/providers/siyuan'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import {
  credentialIdFromRef,
  KnowledgeConnectionsStore,
  type KnowledgeConnectionRecord,
} from '../../knowledge/connections-store'
import {
  listInstalledPluginsFromFilesystem,
  readFirstSiyuanApiTokenFromConf,
  type InstalledPluginFeedItem,
} from '../../knowledge/siyuan-plugins-fs'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.pluginBridge.LIST_PLUGINS,
  RPC_CHANNELS.pluginBridge.GET_PROJECTIONS,
  RPC_CHANNELS.pluginBridge.SET_ENABLED,
  RPC_CHANNELS.pluginBridge.OPEN_COMPAT,
] as const

export type PluginBridgeFeedSource = 'fixture' | 'kernel' | 'filesystem'

const EMPTY_RESIDUAL =
  'no installed SiYuan plugins found (fixture, kernel, or local data/plugins)'

const KERNEL_SOFT_FAIL_RESIDUAL =
  'kernel plugin list unavailable; using filesystem or empty feed'

/** In-memory fixture for tests / local smoke. */
let fixtureManifests: SiYuanBridgeManifest[] | null = null

/** Optional kernel client override (tests). */
let kernelClientOverride: SiyuanKernelClient | null | undefined

export function setPluginBridgeFixture(
  manifests: SiYuanBridgeManifest[] | null,
): void {
  fixtureManifests = manifests
}

export function resetPluginBridgeFixture(): void {
  fixtureManifests = null
}

/** @internal test seam — pass null to clear; undefined restores auto-resolve. */
export function __setPluginBridgeKernelClientForTests(
  client: SiyuanKernelClient | null | undefined,
): void {
  kernelClientOverride = client
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

export interface PluginBridgeManifestLoad {
  manifests: SiYuanBridgeManifest[]
  /** petals/kernel enabled preference when known (name → enabled) */
  enabledByName: Map<string, boolean>
  source: PluginBridgeFeedSource | null
  residual?: string
  fixture: boolean
}

function emptyLoad(residual?: string): PluginBridgeManifestLoad {
  return {
    manifests: [],
    enabledByName: new Map(),
    source: null,
    fixture: false,
    ...(residual ? { residual } : {}),
  }
}

function fixtureLoad(manifests: SiYuanBridgeManifest[]): PluginBridgeManifestLoad {
  return {
    manifests,
    enabledByName: new Map(),
    source: 'fixture',
    fixture: true,
  }
}

function packagesToManifests(
  packages: SiyuanInstalledPluginPackage[],
): SiYuanBridgeManifest[] {
  const out: SiYuanBridgeManifest[] = []
  for (const pkg of packages) {
    const parsed = parseSiYuanPluginManifest(pkg)
    if (parsed) {
      out.push(parsed)
      continue
    }
    // Minimal fallback when kernel package lacks full plugin.json fields
    if (typeof pkg.name === 'string' && pkg.name) {
      const version = typeof pkg.version === 'string' && pkg.version ? pkg.version : '0.0.0'
      const minimal = parseSiYuanPluginManifest({
        name: pkg.name,
        version,
        ...(pkg.displayName !== undefined ? { displayName: pkg.displayName } : {}),
        ...(pkg.description !== undefined ? { description: pkg.description } : {}),
        ...(typeof pkg.author === 'string' ? { author: pkg.author } : {}),
      })
      if (minimal) out.push(minimal)
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

/**
 * Prefer fuller filesystem plugin.json fields when kernel rows are thin
 * (missing craft block / backends / frontends / minAppVersion). Kernel/petals
 * enabled flags stay on the load result, not the manifest body.
 */
function enrichManifestsWithFilesystem(
  kernelManifests: SiYuanBridgeManifest[],
): SiYuanBridgeManifest[] {
  let fsByName: Map<string, SiYuanBridgeManifest> | null = null
  try {
    const items = listInstalledPluginsFromFilesystem()
    if (items.length > 0) {
      fsByName = new Map(items.map((i) => [i.manifest.name, i.manifest]))
    }
  } catch {
    fsByName = null
  }
  if (!fsByName || fsByName.size === 0) return kernelManifests

  const out: SiYuanBridgeManifest[] = []
  for (const km of kernelManifests) {
    const fs = fsByName.get(km.name)
    if (!fs) {
      out.push(km)
      continue
    }
    // FS wins on fuller metadata; keep kernel name/version when present.
    const merged: SiYuanBridgeManifest = {
      ...fs,
      ...km,
      name: km.name || fs.name,
      version: km.version || fs.version,
    }
    // Prefer FS craft block when kernel lacks one
    if (!km.craft && fs.craft) merged.craft = fs.craft
    else if (km.craft) merged.craft = km.craft
    // Prefer non-empty localized / author fields from the richer side
    if (fs.displayName && !km.displayName) merged.displayName = fs.displayName
    if (fs.description && !km.description) merged.description = fs.description
    if (fs.author && !km.author) merged.author = fs.author
    if (fs.minAppVersion && !km.minAppVersion) merged.minAppVersion = fs.minAppVersion
    if (fs.backends?.length && !km.backends?.length) merged.backends = fs.backends
    if (fs.frontends?.length && !km.frontends?.length) merged.frontends = fs.frontends
    out.push(merged)
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

function petalsToEnabledMap(petals: SiyuanPetalInfo[]): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const p of petals) {
    if (p.name) map.set(p.name, p.enabled)
  }
  return map
}

async function clientFromConnection(
  record: KnowledgeConnectionRecord,
): Promise<SiyuanKernelClient | null> {
  try {
    const id = credentialIdFromRef(record.credentialRef)
    if (!id) return null
    const credential = await getCredentialManager().get(id)
    const token = credential?.value ?? ''
    if (!token) return null
    const client = new SiyuanKernelClient({
      baseUrl: record.baseUrl,
      token,
      timeoutMs: 2_500,
    })
    // Cheap health probe — soft-fail on unreachable kernel
    await client.getVersion()
    return client
  } catch {
    return null
  }
}

/**
 * Resolve a live SiYuan kernel client.
 * Order: test override → healthy knowledge connections → any-status connections
 * with token → conf.json api.token (external-local assist). Never logs tokens.
 */
export async function resolveKernelClient(): Promise<SiyuanKernelClient | null> {
  if (kernelClientOverride !== undefined) {
    return kernelClientOverride
  }

  // 1–2. Knowledge connections (healthy first, then any status with token)
  try {
    const store = new KnowledgeConnectionsStore(configDir())
    const siyuan = store.list().filter((r) => r.provider === 'siyuan')
    const healthy = siyuan.filter((r) => r.status === 'ok')
    const rest = siyuan.filter((r) => r.status !== 'ok')

    for (const record of healthy) {
      const client = await clientFromConnection(record)
      if (client) return client
    }
    for (const record of rest) {
      const client = await clientFromConnection(record)
      if (client) return client
    }
  } catch {
    /* no connections store / credentials */
  }

  // 3. conf.json api.token fallback (G2-safe: read-only, never spawn)
  try {
    const conf = readFirstSiyuanApiTokenFromConf()
    if (conf?.token) {
      const client = new SiyuanKernelClient({
        baseUrl: conf.baseUrl,
        token: conf.token,
        timeoutMs: 2_000,
      })
      await client.getVersion()
      return client
    }
  } catch {
    /* conf missing / kernel down / bad token */
  }

  return null
}

async function loadFromKernel(
  client: SiyuanKernelClient,
): Promise<PluginBridgeManifestLoad | null> {
  try {
    const [packages, petals] = await Promise.all([
      client.getInstalledPlugin('desktop'),
      client.loadPetals('desktop').catch(() => [] as SiyuanPetalInfo[]),
    ])
    let manifests = packagesToManifests(packages)
    if (manifests.length === 0) return null
    manifests = enrichManifestsWithFilesystem(manifests)
    const enabledByName = petalsToEnabledMap(petals)
    // Also pick enabled flags embedded on package rows when petals empty
    if (enabledByName.size === 0) {
      for (const pkg of packages) {
        if (typeof pkg.enabled === 'boolean' && pkg.name) {
          enabledByName.set(pkg.name, pkg.enabled)
        }
      }
    }
    return {
      manifests,
      enabledByName,
      source: 'kernel',
      fixture: false,
    }
  } catch {
    return null
  }
}

function loadFromFilesystem(): PluginBridgeManifestLoad | null {
  try {
    const items: InstalledPluginFeedItem[] = listInstalledPluginsFromFilesystem()
    if (items.length === 0) return null
    const enabledByName = new Map<string, boolean>()
    const manifests: SiYuanBridgeManifest[] = []
    for (const item of items) {
      manifests.push(item.manifest)
      if (typeof item.petalsEnabled === 'boolean') {
        enabledByName.set(item.manifest.name, item.petalsEnabled)
      }
    }
    return {
      manifests,
      enabledByName,
      source: 'filesystem',
      fixture: false,
    }
  } catch {
    return null
  }
}

/**
 * LIST_PLUGINS feed: fixture/env → kernel → filesystem → empty.
 * Never throws on missing kernel.
 */
export async function loadPluginBridgeManifests(): Promise<PluginBridgeManifestLoad> {
  if (fixtureManifests) {
    return fixtureLoad(fixtureManifests)
  }
  const fromEnv = loadFixtureFromEnv()
  if (fromEnv) {
    return fixtureLoad(fromEnv)
  }

  let kernelResidual: string | undefined
  try {
    const client = await resolveKernelClient()
    if (client) {
      const fromKernel = await loadFromKernel(client)
      if (fromKernel) return fromKernel
      kernelResidual = KERNEL_SOFT_FAIL_RESIDUAL
    }
  } catch {
    kernelResidual = KERNEL_SOFT_FAIL_RESIDUAL
  }

  const fromFs = loadFromFilesystem()
  if (fromFs) {
    return {
      ...fromFs,
      ...(kernelResidual ? { residual: kernelResidual } : {}),
    }
  }

  return emptyLoad(kernelResidual ?? EMPTY_RESIDUAL)
}

/** Sync catalog listFn for SiYuan Bazaar provider (installed fixture/fs snapshot). */
export function pluginBridgeBazaarListFn(): SiYuanBridgeManifest[] {
  if (fixtureManifests) return fixtureManifests
  const fromEnv = loadFixtureFromEnv()
  if (fromEnv) return fromEnv
  // Sync path: filesystem only (kernel is async). Catalog refresh via LIST is async elsewhere.
  try {
    return listInstalledPluginsFromFilesystem().map((i) => i.manifest)
  } catch {
    return []
  }
}

/** Map a remote Bazaar package row → bridge manifest (typically L0/L1, no craft). */
export function bazaarPackageToManifest(
  pkg: SiyuanBazaarPluginPackage,
): SiYuanBridgeManifest | null {
  const version =
    typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version.trim() : '0.0.0'
  return parseSiYuanPluginManifest({
    name: pkg.name,
    version,
    ...(pkg.displayName !== undefined ? { displayName: pkg.displayName } : {}),
    ...(pkg.description !== undefined ? { description: pkg.description } : {}),
    ...(typeof pkg.author === 'string' ? { author: pkg.author } : {}),
    ...(typeof pkg.minAppVersion === 'string' ? { minAppVersion: pkg.minAppVersion } : {}),
    ...(Array.isArray(pkg.backends) ? { backends: pkg.backends } : {}),
    ...(Array.isArray(pkg.frontends) ? { frontends: pkg.frontends } : {}),
  })
}

/**
 * Soft-fail remote Bazaar catalog via kernel. Empty when kernel down / no token.
 * Does NOT auto-install.
 */
export async function loadBazaarRemoteManifests(
  keyword = '',
): Promise<SiYuanBridgeManifest[]> {
  try {
    const client = await resolveKernelClient()
    if (!client) return []
    const packages = await client.getBazaarPlugin('desktop', keyword)
    const out: SiYuanBridgeManifest[] = []
    for (const pkg of packages) {
      const m = bazaarPackageToManifest(pkg)
      if (m) out.push(m)
    }
    out.sort((a, b) => a.name.localeCompare(b.name))
    return out
  } catch {
    return []
  }
}

/**
 * Async catalog listFn: installed (sync fixture/fs) + optional remote Bazaar.
 * Installed wins on name collision. Soft-fail empty remote when kernel down.
 */
export async function pluginBridgeBazaarCatalogListFn(): Promise<SiYuanBridgeManifest[]> {
  const installed = pluginBridgeBazaarListFn()
  const remote = await loadBazaarRemoteManifests()
  if (remote.length === 0) return installed

  const byName = new Map<string, SiYuanBridgeManifest>()
  // Remote first, then installed overwrites — installed wins
  for (const m of remote) byName.set(m.name, m)
  for (const m of installed) byName.set(m.name, m)
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function findManifest(
  pluginId: string,
  override?: unknown,
  manifests?: SiYuanBridgeManifest[],
): SiYuanBridgeManifest | null {
  if (override !== undefined) {
    return parseSiYuanPluginManifest(override)
  }
  const bare = barePluginId(pluginId)
  const list = manifests ?? []
  return (
    list.find((m) => m.name === bare || extensionIdFor(m.name) === pluginId) ??
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

function residualForSource(source: PluginBridgeFeedSource | null, extra?: string): string | undefined {
  const parts: string[] = []
  if (source === 'filesystem') parts.push('source: filesystem')
  else if (source === 'kernel') parts.push('source: kernel')
  else if (source === 'fixture') parts.push('source: fixture')
  if (extra) parts.push(extra)
  return parts.length > 0 ? parts.join('; ') : undefined
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
      const loaded = await loadPluginBridgeManifests()
      const store = getExtensionStateStore(configDir())
      const plugins = loaded.manifests.map((m) => {
        const id = extensionIdFor(m.name)
        const petals = loaded.enabledByName.get(m.name)
        // Prefer explicit local store entry (offline SET_ENABLED sticky), then petals/kernel, else default true.
        const localEnabled = store.getState().enabled[id]
        const enabled =
          typeof localEnabled === 'boolean'
            ? localEnabled
            : typeof petals === 'boolean'
              ? petals
              : true
        return toListItem(m, enabled)
      })
      const residual =
        plugins.length === 0
          ? loaded.residual ?? EMPTY_RESIDUAL
          : residualForSource(loaded.source, loaded.residual)
      return {
        plugins,
        ...(loaded.fixture ? { fixture: true } : {}),
        ...(residual ? { residual } : {}),
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
      let manifest: SiYuanBridgeManifest | null = null
      if (args?.manifest !== undefined) {
        manifest = parseSiYuanPluginManifest(args.manifest)
      } else {
        const loaded = await loadPluginBridgeManifests()
        manifest = findManifest(pluginId, undefined, loaded.manifests)
      }
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
      const bare = barePluginId(args.pluginId)
      const id = extensionIdFor(bare)

      let localOk = false
      try {
        const store = getExtensionStateStore(configDir())
        store.setEnabled(id, args.enabled)
        localOk = true
      } catch {
        localOk = false
      }

      // Soft kernel petal enable — never rewrite petals.json from Craft.
      let kernelOk = false
      try {
        const client = await resolveKernelClient()
        if (client) {
          await client.setPetalEnabled(bare, args.enabled)
          kernelOk = true
        }
      } catch {
        kernelOk = false
      }

      if (kernelOk) {
        return {
          pluginId: id,
          enabled: args.enabled,
          persisted: 'kernel',
          residual: localOk
            ? undefined
            : 'kernel petal updated; local ExtensionStateStore write failed',
        }
      }

      if (localOk) {
        return {
          pluginId: id,
          enabled: args.enabled,
          persisted: 'local',
          residual:
            'kernel enable/disable unavailable; local ExtensionStateStore only (petals.json not rewritten)',
        }
      }

      return {
        pluginId: id,
        enabled: args.enabled,
        persisted: 'none',
        residual: 'failed to persist enable preference locally; kernel unavailable',
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
