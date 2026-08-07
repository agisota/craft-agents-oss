/**
 * Marketplace RPC handlers (runtime-context-marketplace PRD §8, plan §5 M4a).
 *
 * LOCAL_ONLY: the catalog cache, lock registry, and installed artifacts live
 * in the local config dir; kind:tool installs are validated against the
 * toolchain manifest (TOOL_NOT_IN_MANIFEST) and recorded as 'deferred' — M4a
 * never performs the actual tool install (toolchain:update owns that).
 */

import { CodedError, RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { loadStoredConfig, saveConfig, type StoredConfig } from '@craft-agent/shared/config'
import { pushTyped, type RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import {
  createConfigMetaStore,
  createFileStatsStore,
  fetchMarketplaceStats,
  getCatalog,
  installEntry,
  marketplacePaths,
  readLock,
  refreshCatalog,
  removeEntry,
  type MarketplaceCatalogResult,
  type MarketplaceEntry,
  type MarketplaceFetch,
  type MarketplaceMeta,
  type MarketplaceStatsFetch,
} from '@craft-agent/shared/marketplace'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.marketplace.CATALOG,
  RPC_CHANNELS.marketplace.STATS,
  RPC_CHANNELS.marketplace.INSTALL,
  RPC_CHANNELS.marketplace.REMOVE,
  RPC_CHANNELS.marketplace.UPDATE,
  RPC_CHANNELS.marketplace.REFRESH,
] as const

type MarketplaceConfigShape = { marketplace?: MarketplaceMeta } & Record<string, unknown>

/** Minimal adapter: WHATWG fetch → the trivially-mockable marketplace fetch shape. */
const catalogFetch: MarketplaceFetch = async (url, init) => {
  const res = await fetch(url, { headers: init?.headers })
  return {
    ok: res.ok,
    status: res.status,
    headers: { get: (name: string) => res.headers.get(name) },
    text: () => res.text(),
  }
}

const statsFetch: MarketplaceStatsFetch = async (url, init) => {
  const res = await fetch(url, { headers: init?.headers })
  return { ok: res.ok, status: res.status, json: () => res.json() }
}

export function registerMarketplaceHandlers(server: RpcServer, _deps: HandlerDeps): void {
  // ETag/fetch timestamps persist in StoredConfig.marketplace (plan §0.1).
  const metaStore = createConfigMetaStore(
    () => loadStoredConfig() as MarketplaceConfigShape | null,
    (config) => {
      saveConfig(config as unknown as StoredConfig)
    },
  )

  const loadCatalogView = async (): Promise<MarketplaceCatalogResult> => {
    const result = await getCatalog({ metaStore, fetchFn: catalogFetch })
    return { ...result, installs: readLock(marketplacePaths().lockFile).entries }
  }

  const requireEntry = async (id: string): Promise<MarketplaceEntry> => {
    const { catalog } = await getCatalog({ metaStore, fetchFn: catalogFetch })
    const entry = catalog.entries.find((e) => e.id === id)
    if (!entry) {
      throw new CodedError('MARKETPLACE_ENTRY_NOT_FOUND', `Marketplace entry '${id}' is not in the catalog`)
    }
    return entry
  }

  // One mutation per slug at a time (in-memory). Installs are serialized in
  // the single local server process; a second caller fails fast instead of
  // racing the same artifacts.
  const inFlight = new Set<string>()
  const exclusive = async <T>(id: string, fn: () => Promise<T>): Promise<T> => {
    if (inFlight.has(id)) {
      throw new CodedError('MARKETPLACE_OPERATION_IN_FLIGHT', `Marketplace entry '${id}' already has an operation in flight`)
    }
    inFlight.add(id)
    try {
      return await fn()
    } finally {
      inFlight.delete(id)
    }
  }

  // Catalog view + install registry (ETag/24h TTL handled inside getCatalog)
  server.handle(RPC_CHANNELS.marketplace.CATALOG, async () => {
    return loadCatalogView()
  })

  // Live card stats (6h cache inside fetchMarketplaceStats)
  server.handle(RPC_CHANNELS.marketplace.STATS, async () => {
    const { catalog } = await getCatalog({ metaStore, fetchFn: catalogFetch })
    return fetchMarketplaceStats(catalog.entries, {
      store: createFileStatsStore(marketplacePaths().statsCache),
      fetchFn: statsFetch,
    })
  })

  // Install by catalog id (kind:tool → deferred record only, no tool install)
  server.handle(RPC_CHANNELS.marketplace.INSTALL, async (_ctx, id: string) => {
    return exclusive(id, async () => {
      const entry = await requireEntry(id)
      const result = await installEntry(entry, { fetchFn: catalogFetch })
      pushTyped(server, RPC_CHANNELS.marketplace.CHANGED, { to: 'all' }, { id, action: 'installed', ref: entry.source.ref })
      return result
    })
  })

  // Remove artifacts we own (soft-clean: locally-edited targets are kept)
  server.handle(RPC_CHANNELS.marketplace.REMOVE, async (_ctx, id: string) => {
    return exclusive(id, async () => {
      const ref = readLock(marketplacePaths().lockFile).entries[id]?.ref
      const result = removeEntry(id)
      if (result.status !== 'not-installed') {
        pushTyped(server, RPC_CHANNELS.marketplace.CHANGED, { to: 'all' }, ref ? { id, action: 'removed', ref } : { id, action: 'removed' })
      }
      return result
    })
  })

  // Update = re-install from the current catalog pin; requires an installed record
  server.handle(RPC_CHANNELS.marketplace.UPDATE, async (_ctx, id: string) => {
    return exclusive(id, async () => {
      if (!readLock(marketplacePaths().lockFile).entries[id]) {
        throw new CodedError('MARKETPLACE_ENTRY_NOT_INSTALLED', `Marketplace entry '${id}' is not installed`)
      }
      const entry = await requireEntry(id)
      const result = await installEntry(entry, { fetchFn: catalogFetch })
      pushTyped(server, RPC_CHANNELS.marketplace.CHANGED, { to: 'all' }, { id, action: 'updated', ref: entry.source.ref })
      return result
    })
  })

  // Force remote refresh (ETag still honored; 304 keeps the cache body)
  server.handle(RPC_CHANNELS.marketplace.REFRESH, async () => {
    const result = await refreshCatalog({ metaStore, fetchFn: catalogFetch })
    return { ...result, installs: readLock(marketplacePaths().lockFile).entries }
  })
}
