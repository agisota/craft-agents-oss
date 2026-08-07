/**
 * Marketplace catalog — schema, validation, remote refresh.
 * Spec: docs/runtime-context-marketplace-prd.md §8.1, plan §5 (M4a).
 *
 * Trust model: the catalog is an index, not executable code. Entries are
 * curated (GitHub-only sources, pinned commit SHA). Remote refresh uses
 * ETag + 24h TTL; on any failure the last cache or the bundled copy wins.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { CONFIG_DIR } from '../config/paths.ts'
import { getBundledAssetsDir } from '../utils/paths.ts'

// ---------------------------------------------------------------------------
// Schema (PRD §8.1 + descriptionRu)
// ---------------------------------------------------------------------------

export type MarketplaceEntryKind = 'skillpack' | 'tool' | 'context-doc'

export interface MarketplaceSource {
  type: 'github'
  /** owner/repo */
  repo: string
  /** Pinned commit SHA (40 hex). Catalog entries are never floating refs. */
  ref: string
}

export interface MarketplaceDocument {
  /** Path inside the source repo, e.g. 'AGENTS.md'. */
  repoPath: string
  /** Target file name inside <CONFIG_DIR>/context/ (must end with .md). */
  targetName: string
}

export interface MarketplaceEntry {
  id: string
  kind: MarketplaceEntryKind
  title: string
  /** All marketplace descriptions are curated Russian text (PRD §8.2). */
  descriptionRu: string
  source: MarketplaceSource
  /** Informational list of skill slugs shipped by a skillpack. */
  skills?: string[]
  license?: string
  default?: 'installed' | 'available'
  sizeHintKb?: number
  tags?: string[]
  /** skillpack: restrict the SKILL.md scan to this subdirectory (e.g. 'skills', '.agents'). */
  skillsSubdir?: string
  /**
   * skillpack layout:
   * - 'skills' (default): scan for SKILL.md and install every discovered skill
   *    as ~/.agents/skills/<basename>.
   * - 'directory': install the whole repo as one ~/.agents/skills/<id> dir
   *    (clone-only; upstream install.sh is NEVER executed).
   */
  installMode?: 'skills' | 'directory'
  /** context-doc: repo files → <CONFIG_DIR>/context/<targetName>. */
  documents?: MarketplaceDocument[]
  /** tool: tool name in the toolchain manifest (deferred install via toolchain:update). */
  toolName?: string
  /** stats: npm package used for weekly-download metrics. */
  npm?: { package: string }
}

export interface MarketplaceCatalog {
  catalogVersion: number
  updatedAt?: string
  entries: MarketplaceEntry[]
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ID_RE = /^[a-z0-9][a-z0-9-]*$/
const SHA_RE = /^[0-9a-f]{40}$/
const REPO_RE = /^[\w.-]+\/[\w.-]+$/
const DOC_NAME_RE = /^[a-z0-9][a-z0-9-]*\.md$/
const KINDS: Record<string, true> = { skillpack: true, tool: true, 'context-doc': true }

export class CatalogValidationError extends Error {
  readonly issues: string[]
  constructor(issues: string[]) {
    super(`Invalid marketplace catalog: ${issues.join('; ')}`)
    this.name = 'CatalogValidationError'
    this.issues = issues
  }
}

/**
 * Parse + validate a catalog payload. Throws CatalogValidationError on any
 * schema violation — callers MUST treat an invalid remote catalog as a fetch
 * failure and fall back to cache/bundle (fail-closed).
 */
export function parseCatalog(raw: unknown): MarketplaceCatalog {
  const issues: string[] = []
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new CatalogValidationError(['root must be an object'])
  }
  const obj = raw as Record<string, unknown>
  if (typeof obj.catalogVersion !== 'number' || !Number.isInteger(obj.catalogVersion) || obj.catalogVersion < 1) {
    issues.push('catalogVersion must be a positive integer')
  }
  if (obj.updatedAt !== undefined && typeof obj.updatedAt !== 'string') {
    issues.push('updatedAt must be a string when present')
  }
  if (!Array.isArray(obj.entries)) {
    issues.push('entries must be an array')
  }
  if (issues.length > 0) throw new CatalogValidationError(issues)

  const seen = new Set<string>()
  const entries = obj.entries as unknown[]
  for (let i = 0; i < entries.length; i++) {
    const where = `entries[${i}]`
    const e = entries[i]
    if (typeof e !== 'object' || e === null || Array.isArray(e)) {
      issues.push(`${where} must be an object`)
      continue
    }
    const rec = e as Record<string, unknown>
    if (typeof rec.id !== 'string' || !ID_RE.test(rec.id)) issues.push(`${where}.id must match ${ID_RE}`)
    else if (seen.has(rec.id)) issues.push(`${where}.id '${rec.id}' is duplicated`)
    else seen.add(rec.id)
    if (typeof rec.kind !== 'string' || !KINDS[rec.kind]) issues.push(`${where}.kind must be one of skillpack|tool|context-doc`)
    if (typeof rec.title !== 'string' || rec.title.length === 0) issues.push(`${where}.title is required`)
    if (typeof rec.descriptionRu !== 'string' || rec.descriptionRu.length === 0) issues.push(`${where}.descriptionRu is required (PRD §8.2)`)

    const src = rec.source as Record<string, unknown> | undefined
    if (typeof src !== 'object' || src === null) {
      issues.push(`${where}.source is required`)
    } else {
      if (src.type !== 'github') issues.push(`${where}.source.type must be 'github' (curated GitHub-only sources)`)
      if (typeof src.repo !== 'string' || !REPO_RE.test(src.repo)) issues.push(`${where}.source.repo must be owner/repo`)
      if (typeof src.ref !== 'string' || !SHA_RE.test(src.ref)) issues.push(`${where}.source.ref must be a pinned 40-hex commit SHA`)
    }

    const kind = rec.kind as MarketplaceEntryKind | undefined
    if (kind === 'skillpack') {
      if (rec.installMode !== undefined && rec.installMode !== 'skills' && rec.installMode !== 'directory') {
        issues.push(`${where}.installMode must be 'skills'|'directory'`)
      }
      if (rec.skills !== undefined && !Array.isArray(rec.skills)) issues.push(`${where}.skills must be an array`)
      if (rec.skillsSubdir !== undefined && (typeof rec.skillsSubdir !== 'string' || rec.skillsSubdir.includes('..'))) {
        issues.push(`${where}.skillsSubdir must be a safe relative path`)
      }
    }
    if (kind === 'tool') {
      if (typeof rec.toolName !== 'string' || rec.toolName.length === 0) issues.push(`${where}.toolName is required for kind 'tool'`)
      const npm = rec.npm as Record<string, unknown> | undefined
      if (npm !== undefined && (typeof npm !== 'object' || npm === null || typeof npm.package !== 'string' || npm.package.length === 0)) {
        issues.push(`${where}.npm.package must be a non-empty string when npm is present`)
      }
    }
    if (kind === 'context-doc') {
      if (!Array.isArray(rec.documents) || rec.documents.length === 0) {
        issues.push(`${where}.documents is required for kind 'context-doc'`)
      } else {
        for (const [j, d] of (rec.documents as unknown[]).entries()) {
          const doc = d as Record<string, unknown>
          if (typeof doc?.repoPath !== 'string' || doc.repoPath.length === 0 || doc.repoPath.includes('..')) {
            issues.push(`${where}.documents[${j}].repoPath must be a safe repo-relative path`)
          }
          if (typeof doc?.targetName !== 'string' || !DOC_NAME_RE.test(doc.targetName)) {
            issues.push(`${where}.documents[${j}].targetName must match ${DOC_NAME_RE}`)
          }
        }
      }
    }
  }
  if (issues.length > 0) throw new CatalogValidationError(issues)
  return obj as unknown as MarketplaceCatalog
}

// ---------------------------------------------------------------------------
// Meta store (ETag + lastCatalogFetchAt). Production wiring persists these in
// StoredConfig.marketplace (plan §0.1) via createConfigMetaStore; tests inject
// createMemoryMetaStore.
// ---------------------------------------------------------------------------

export interface MarketplaceMeta {
  catalogEtag?: string
  lastCatalogFetchAt?: number
}

export interface MarketplaceMetaStore {
  get(): MarketplaceMeta
  set(meta: MarketplaceMeta): void
}

export function createMemoryMetaStore(initial: MarketplaceMeta = {}): MarketplaceMetaStore & { value: MarketplaceMeta } {
  const box: { value: MarketplaceMeta } = { value: { ...initial } }
  return {
    get value() {
      return box.value
    },
    get: () => ({ ...box.value }),
    set: (meta) => {
      box.value = { ...meta }
    },
  }
}

type StoredConfigLike = { marketplace?: MarketplaceMeta } & Record<string, unknown>

/** Meta store backed by StoredConfig.marketplace (plan §0.1). IO functions are injected for testability. */
export function createConfigMetaStore(
  loadConfig: () => StoredConfigLike | null,
  saveConfig: (config: StoredConfigLike) => void,
): MarketplaceMetaStore {
  return {
    get: () => ({ ...(loadConfig()?.marketplace ?? {}) }),
    set: (meta) => {
      const existing = loadConfig()
      saveConfig({ ...(existing ?? {}), marketplace: { ...meta } })
    },
  }
}

// ---------------------------------------------------------------------------
// Minimal fetch shape (trivially mockable; no DOM Response typing needed)
// ---------------------------------------------------------------------------

export interface MarketplaceResponse {
  ok: boolean
  status: number
  headers: { get(name: string): string | null }
  text(): Promise<string>
}

export type MarketplaceFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<MarketplaceResponse>

// ---------------------------------------------------------------------------
// Catalog loading: ETag / 24h TTL / atomic swap / fallback bundle
// ---------------------------------------------------------------------------

export const MARKETPLACE_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Remote catalog source of truth (PRD §8.1). Path note: the catalog lives at
 * apps/electron/resources/marketplace/catalog.json in the repo layout (the PRD
 * snippet omitted the apps/electron prefix).
 */
export const DEFAULT_CATALOG_REMOTE_URL =
  'https://raw.githubusercontent.com/agisota/craft-agents-oss/main/apps/electron/resources/marketplace/catalog.json'

export interface MarketplacePaths {
  /** <configDir>/marketplace */
  dir: string
  /** Catalog cache (last known-good remote copy). */
  catalogCache: string
  /** Install registry. */
  lockFile: string
  /** Stats cache (6h TTL). */
  statsCache: string
  /** Temp staging area for clones/downloads. */
  tmpDir: string
}

export function marketplacePaths(configDir: string = CONFIG_DIR): MarketplacePaths {
  const dir = join(configDir, 'marketplace')
  return {
    dir,
    catalogCache: join(dir, 'catalog.cache.json'),
    lockFile: join(dir, 'lock.json'),
    statsCache: join(dir, 'stats-cache.json'),
    tmpDir: join(dir, 'tmp'),
  }
}

export type CatalogOrigin = 'cache' | 'remote' | 'stale-cache' | 'bundled' | 'empty'

export interface CatalogLoadResult {
  catalog: MarketplaceCatalog
  origin: CatalogOrigin
  lastCatalogFetchAt: number | null
  /** Present when a degraded origin was used. */
  error?: string
}

export interface GetCatalogOptions {
  configDir?: string
  /** Path of the bundled fallback catalog (default: resolved via getBundledAssetsDir('marketplace')). */
  bundledCatalogPath?: string
  remoteUrl?: string
  metaStore?: MarketplaceMetaStore
  fetchFn?: MarketplaceFetch
  now?: () => number
  maxCacheAgeMs?: number
}

function defaultBundledCatalogPath(): string | null {
  const dir = getBundledAssetsDir('marketplace')
  if (!dir) return null
  const file = join(dir, 'catalog.json')
  return existsSync(file) ? file : null
}

/** Write file atomically: tmp sibling + rename (same filesystem → atomic on POSIX/NTFS). */
export function atomicWriteFileSync(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`
  writeFileSync(tmp, content)
  renameSync(tmp, path)
}

function readCache(paths: MarketplacePaths): { catalog: MarketplaceCatalog; fetchedAt: number | null } | null {
  try {
    if (!existsSync(paths.catalogCache)) return null
    const parsed = JSON.parse(readFileSync(paths.catalogCache, 'utf8')) as { fetchedAt?: unknown; catalog?: unknown }
    return { catalog: parseCatalog(parsed.catalog), fetchedAt: typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : null }
  } catch {
    return null // corrupt cache is treated as absent; bundled fallback still works
  }
}

function writeCache(paths: MarketplacePaths, rawCatalogJson: string): void {
  atomicWriteFileSync(paths.catalogCache, JSON.stringify({ fetchedAt: Date.now(), catalog: JSON.parse(rawCatalogJson) }))
}

function loadBundled(bundledCatalogPath?: string): MarketplaceCatalog | null {
  const file = bundledCatalogPath ?? defaultBundledCatalogPath()
  if (!file || !existsSync(file)) return null
  try {
    return parseCatalog(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return null
  }
}

const EMPTY_CATALOG: MarketplaceCatalog = { catalogVersion: 0, entries: [] }

/**
 * Load the catalog honoring ETag + TTL with graceful degradation:
 * fresh cache → remote (304 reuses cache) → stale cache → bundled → empty.
 */
export async function getCatalog(options: GetCatalogOptions = {}): Promise<CatalogLoadResult> {
  return refreshCatalogInternal({ ...options, allowFreshCache: true })
}

/** Force a remote fetch (still honors ETag; 304 keeps the cache body). */
export async function refreshCatalog(options: GetCatalogOptions = {}): Promise<CatalogLoadResult> {
  return refreshCatalogInternal({ ...options, allowFreshCache: false })
}

async function refreshCatalogInternal(options: GetCatalogOptions & { allowFreshCache: boolean }): Promise<CatalogLoadResult> {
  const paths = marketplacePaths(options.configDir)
  const fetchFn: MarketplaceFetch | undefined = options.fetchFn ?? (globalThis.fetch as unknown as MarketplaceFetch | undefined)
  const now = options.now ?? (() => Date.now())
  const ttl = options.maxCacheAgeMs ?? MARKETPLACE_CACHE_TTL_MS
  const metaStore = options.metaStore ?? createMemoryMetaStore()
  const remoteUrl = options.remoteUrl ?? process.env.CRAFT_MARKETPLACE_CATALOG_URL ?? DEFAULT_CATALOG_REMOTE_URL
  const meta = metaStore.get()

  const cached = readCache(paths)

  // Fresh cache short-circuit (24h TTL).
  const cacheAge = cached?.fetchedAt != null ? now() - cached.fetchedAt : Number.POSITIVE_INFINITY
  if (options.allowFreshCache && cached && cacheAge < ttl) {
    return { catalog: cached.catalog, origin: 'cache', lastCatalogFetchAt: meta.lastCatalogFetchAt ?? cached.fetchedAt }
  }

  // Remote attempt (may be skipped entirely when there is no fetch — tests, airgapped).
  let remoteError: string | undefined
  if (fetchFn) {
    try {
      const headers: Record<string, string> = { 'user-agent': 'craft-agents-marketplace' }
      if (meta.catalogEtag) headers['if-none-match'] = meta.catalogEtag
      const res = await fetchFn(remoteUrl, { headers })
      if (res.status === 304 && cached) {
        const fetchedAt = now()
        metaStore.set({ ...meta, lastCatalogFetchAt: fetchedAt })
        return { catalog: cached.catalog, origin: 'cache', lastCatalogFetchAt: fetchedAt }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.text()
      const catalog = parseCatalog(JSON.parse(body)) // throws CatalogValidationError
      // Version monotonicity: never replace a newer cache with an older catalog.
      if (cached && catalog.catalogVersion < cached.catalog.catalogVersion) {
        throw new Error(`catalogVersion regression (${catalog.catalogVersion} < ${cached.catalog.catalogVersion})`)
      }
      writeCache(paths, body) // atomic swap
      const fetchedAt = now()
      const etag = res.headers.get('etag') ?? undefined
      metaStore.set({ catalogEtag: etag, lastCatalogFetchAt: fetchedAt })
      return { catalog, origin: 'remote', lastCatalogFetchAt: fetchedAt }
    } catch (err) {
      remoteError = err instanceof Error ? err.message : String(err)
    }
  } else {
    remoteError = 'fetch unavailable'
  }

  // Degradation ladder.
  if (cached) {
    return { catalog: cached.catalog, origin: 'stale-cache', lastCatalogFetchAt: meta.lastCatalogFetchAt ?? cached.fetchedAt, error: remoteError }
  }
  const bundled = loadBundled(options.bundledCatalogPath)
  if (bundled) {
    return { catalog: bundled, origin: 'bundled', lastCatalogFetchAt: meta.lastCatalogFetchAt ?? null, error: remoteError }
  }
  return { catalog: EMPTY_CATALOG, origin: 'empty', lastCatalogFetchAt: null, error: remoteError ?? 'no catalog available' }
}
