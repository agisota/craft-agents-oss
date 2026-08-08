/**
 * Filesystem feed for installed SiYuan plugins (offline-capable).
 *
 * Reads dataDir/plugins/<name>/plugin.json and optional
 * dataDir/storage/petal/petals.json enabled flags. Never spawns or
 * downloads SiYuan (G2). Kernel remains optional enrichment elsewhere.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseSiYuanPluginManifest, type SiYuanBridgeManifest } from '@craft-agent/shared/extensions'

/** Test-only override of candidate data dirs (null = use platform defaults). */
let candidateDataDirsOverride: string[] | null = null

/** @internal test seam — pass null to restore platform candidates. */
export function __setSiyuanDataDirCandidatesForTests(dirs: string[] | null): void {
  candidateDataDirsOverride = dirs
}

/**
 * Platform candidate SiYuan *data* directories (the folder that contains
 * `plugins/`, `storage/`, notebooks, …). Not the app install path.
 */
export function candidateSiyuanDataDirs(platform: NodeJS.Platform = process.platform): string[] {
  if (candidateDataDirsOverride !== null) return [...candidateDataDirsOverride]

  const home = homedir()
  const fromEnv = process.env.CRAFT_SIYUAN_DATA_DIRS
  if (fromEnv && fromEnv.trim()) {
    return fromEnv
      .split(platform === 'win32' ? ';' : ':')
      .map((p) => p.trim())
      .filter(Boolean)
  }

  switch (platform) {
    case 'darwin':
      return [join(home, 'Library', 'Application Support', 'SiYuan', 'data')]
    case 'win32': {
      const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming')
      return [join(appData, 'SiYuan', 'data')]
    }
    default:
      // Linux / others — desktop packages commonly use ~/.config/siyuan or ~/.siyuan
      return [
        join(home, '.config', 'siyuan', 'data'),
        join(home, '.config', 'SiYuan', 'data'),
        join(home, '.siyuan', 'data'),
        join(home, 'SiYuan', 'data'),
      ]
  }
}

/** Existing candidate data dirs only. */
export function findSiyuanDataDirs(platform: NodeJS.Platform = process.platform): string[] {
  return candidateSiyuanDataDirs(platform).filter((p) => {
    try {
      return existsSync(p) && statSync(p).isDirectory()
    } catch {
      return false
    }
  })
}

/**
 * Parse petals.json → Map<packageName, enabled>.
 * Accepts array form (current SiYuan) or object map. Fail-soft → empty Map.
 */
export function readPetalsEnabledMap(dataDir: string): Map<string, boolean> {
  const out = new Map<string, boolean>()
  const path = join(dataDir, 'storage', 'petal', 'petals.json')
  if (!existsSync(path)) return out
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const rec = item as Record<string, unknown>
        if (typeof rec.name !== 'string' || !rec.name) continue
        if (typeof rec.enabled === 'boolean') out.set(rec.name, rec.enabled)
      }
      return out
    }
    if (raw && typeof raw === 'object') {
      for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!name) continue
        if (typeof value === 'boolean') {
          out.set(name, value)
          continue
        }
        if (value && typeof value === 'object' && 'enabled' in value) {
          const enabled = value.enabled
          if (typeof enabled === 'boolean') out.set(name, enabled)
        }
      }
    }
  } catch {
    /* corrupt petals — treat as absent */
  }
  return out
}

/**
 * Read plugins/<name>/plugin.json under a data dir. Malformed entries are skipped.
 */
export function listInstalledPluginManifests(dataDir: string): SiYuanBridgeManifest[] {
  const pluginsDir = join(dataDir, 'plugins')
  if (!existsSync(pluginsDir)) return []
  let entries: string[]
  try {
    entries = readdirSync(pluginsDir)
  } catch {
    return []
  }
  const out: SiYuanBridgeManifest[] = []
  for (const name of entries) {
    const dir = join(pluginsDir, name)
    try {
      if (!statSync(dir).isDirectory()) continue
    } catch {
      continue
    }
    const manifestPath = join(dir, 'plugin.json')
    if (!existsSync(manifestPath)) continue
    try {
      const raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown
      const parsed = parseSiYuanPluginManifest(raw)
      if (parsed) out.push(parsed)
    } catch {
      /* skip malformed */
    }
  }
  // Stable order by package name
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

export interface InstalledPluginFeedItem {
  manifest: SiYuanBridgeManifest
  /** petals.json enabled when known; undefined → caller falls back to local store */
  petalsEnabled?: boolean
  dataDir: string
}

/**
 * Scan known data dirs; first dir that yields any plugins wins (typical single install).
 * Merges petals enabled flags when present.
 */
export function listInstalledPluginsFromFilesystem(
  platform: NodeJS.Platform = process.platform,
): InstalledPluginFeedItem[] {
  for (const dataDir of findSiyuanDataDirs(platform)) {
    const manifests = listInstalledPluginManifests(dataDir)
    if (manifests.length === 0) continue
    const petals = readPetalsEnabledMap(dataDir)
    return manifests.map((manifest) => {
      const item: InstalledPluginFeedItem = { manifest, dataDir }
      if (petals.has(manifest.name)) {
        item.petalsEnabled = petals.get(manifest.name)
      }
      return item
    })
  }
  return []
}
