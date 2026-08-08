/**
 * Settings → Extensions (S-05 / W5 Extension Center).
 *
 * Unified catalog + installed projections (skills/sources/automations/marketplace).
 * Install for curated marketplace entries delegates to marketplace.install.
 * Install for SiYuan Bazaar entries delegates to pluginBridge.installBazaar
 * (kernel-only; Craft never downloads the plugin zip).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Blocks,
  CheckCircle2,
  DownloadCloud,
  Package,
  RefreshCw,
  Shield,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Wrench,
  FileText,
  AlertTriangle,
} from 'lucide-react'

import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Spinner } from '@craft-agent/ui'
import { navigate, routes } from '@/lib/navigate'
import { SIYUAN_FULL_SURFACE_ID } from '@/knowledge/siyuan-url'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type {
  CatalogCategory,
  CatalogEntry,
  ExtensionHostStatus,
  ExtensionPermission,
  ExtensionRecord,
  ExtensionRuntime,
  ExtensionsListCatalogResult,
  ExtensionsListInstalledResult,
} from '@craft-agent/shared/extensions'
import { CATALOG_CATEGORIES, RUNTIME_PLACEMENT, HIGH_RISK_PERMISSIONS } from '@craft-agent/shared/extensions'
import { useActiveWorkspace } from '@/context/AppShellContext'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'extensions',
}

type SectionId =
  | 'catalog'
  | 'installed'
  | 'updates'
  | 'permissions'
  | 'disabled'
  | 'developer'
  | 'registries'

type CategoryFilter = CatalogCategory | 'all'

const SECTIONS: SectionId[] = [
  'catalog',
  'installed',
  'updates',
  'permissions',
  'disabled',
  'developer',
  'registries',
]

function isHighRisk(perm: ExtensionPermission): boolean {
  if (perm.startsWith('secrets.use:')) return true
  return (HIGH_RISK_PERMISSIONS as readonly string[]).includes(perm)
}

/** Parse compat level from extension tags (`compat-lN` or `level:N`). */
function parseCompatLevelFromTags(tags?: string[]): 0 | 1 | 2 | 3 | undefined {
  if (!tags?.length) return undefined
  for (const tag of tags) {
    const compat = /^compat-l([0-3])$/i.exec(tag)
    if (compat) return Number(compat[1]) as 0 | 1 | 2 | 3
    const level = /^level:([0-3])$/i.exec(tag)
    if (level) return Number(level[1]) as 0 | 1 | 2 | 3
  }
  return undefined
}

function tagsRequireFullChrome(tags?: string[]): boolean {
  if (!tags?.length) return false
  return tags.some((t) => t === 'requiresFullChrome' || t === 'requires-full-chrome')
}

function ExtensionCard({
  name,
  version,
  description,
  runtime,
  category,
  permissions,
  worksIn,
  installTarget,
  status,
  providerLabel,
  readOnly,
  busy,
  onInstall,
  onUpdate,
  onUninstall,
  onToggle,
  marketplaceId,
  compatLevel,
  requiresFullChrome,
  onOpenCompat,
}: {
  name: string
  version: string
  description?: string
  runtime: ExtensionRuntime
  category: string
  permissions: ExtensionPermission[]
  worksIn: string[]
  installTarget?: string
  status?: string
  providerLabel?: string
  readOnly?: boolean
  busy?: boolean
  onInstall?: () => void
  onUpdate?: () => void
  onUninstall?: () => void
  onToggle?: (enabled: boolean) => void
  marketplaceId?: string
  compatLevel?: 0 | 1 | 2 | 3
  requiresFullChrome?: boolean
  onOpenCompat?: () => void
}) {
  const { t } = useTranslation()
  const enabled = status === 'enabled' || status === 'installed' || status === 'update-available'
  const available = status === 'available' || (!status && marketplaceId)
  const updateAvailable = status === 'update-available'
  const showOpenFullSiyuan =
    runtime === 'siyuan-plugin' &&
    (compatLevel === 0 ||
      compatLevel === 1 ||
      Boolean(requiresFullChrome) ||
      typeof onOpenCompat === 'function')

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-background/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{name}</h3>
            <span className="text-xs opacity-60">v{version}</span>
            {compatLevel != null ? (
              <span
                className="text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5 font-mono opacity-80"
                title={t('extensions.card.compatLevelHint', {
                  defaultValue: 'SiYuan plugin compatibility level',
                  level: compatLevel,
                })}
              >
                {t('extensions.card.compatLevel', {
                  defaultValue: 'L{{level}}',
                  level: compatLevel,
                })}
              </span>
            ) : null}
            {status ? (
              <span className="text-[10px] uppercase tracking-wide opacity-70 border rounded px-1.5 py-0.5">
                {t(`extensions.status.${status}`, { defaultValue: status })}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs opacity-70 flex flex-wrap gap-2">
            <span>{t(`extensions.category.${category}`, { defaultValue: category })}</span>
            {providerLabel ? <span>· {providerLabel}</span> : null}
            {readOnly ? (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {t('extensions.card.readOnly', { defaultValue: 'projection' })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showOpenFullSiyuan ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpenCompat?.()}
              className="inline-flex items-center gap-1 text-xs border rounded-md px-2 py-1 hover:bg-muted disabled:opacity-50"
            >
              {t('extensions.action.openFullSiyuan', { defaultValue: 'Open in full SiYuan' })}
            </button>
          ) : null}
          {onToggle && !available ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggle(!enabled)}
              className="inline-flex items-center gap-1 text-xs border rounded-md px-2 py-1 hover:bg-muted disabled:opacity-50"
              title={
                enabled
                  ? t('extensions.action.disable', { defaultValue: 'Disable' })
                  : t('extensions.action.enable', { defaultValue: 'Enable' })
              }
            >
              {enabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              {enabled
                ? t('extensions.action.disable', { defaultValue: 'Disable' })
                : t('extensions.action.enable', { defaultValue: 'Enable' })}
            </button>
          ) : null}
          {onUpdate && updateAvailable ? (
            <button
              type="button"
              disabled={busy}
              onClick={onUpdate}
              className="inline-flex items-center gap-1 text-xs border rounded-md px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              {busy ? <Spinner className="w-3 h-3" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {t('marketplace.update', { defaultValue: 'Update' })}
            </button>
          ) : null}
          {onUninstall && !available ? (
            <button
              type="button"
              disabled={busy}
              onClick={onUninstall}
              className="inline-flex items-center gap-1 text-xs border rounded-md px-2 py-1 hover:bg-muted disabled:opacity-50"
            >
              {busy ? <Spinner className="w-3 h-3" /> : <Trash2 className="w-3.5 h-3.5" />}
              {t('marketplace.remove', { defaultValue: 'Remove' })}
            </button>
          ) : null}
          {onInstall && available ? (
            <button
              type="button"
              disabled={busy}
              onClick={onInstall}
              className="inline-flex items-center gap-1 text-xs border rounded-md px-2 py-1 hover:bg-muted disabled:opacity-50"
            >
              {busy ? <Spinner className="w-3 h-3" /> : <DownloadCloud className="w-3.5 h-3.5" />}
              {t('extensions.action.install', { defaultValue: 'Install' })}
            </button>
          ) : null}
        </div>
      </div>

      {description ? <p className="text-sm opacity-80 line-clamp-3">{description}</p> : null}

      <div className="grid gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <RuntimeBadge runtime={runtime} />
          {installTarget ? (
            <span className="opacity-70">
              {t('extensions.card.installTarget', { defaultValue: 'Install to' })}:{' '}
              <span className="font-medium">
                {t(`extensions.installTarget.${installTarget}`, { defaultValue: installTarget })}
              </span>
            </span>
          ) : null}
        </div>
        <div>
          <div className="opacity-70 mb-1">
            {t('extensions.card.worksIn', { defaultValue: 'Works in' })}
          </div>
          <div className="flex flex-wrap gap-1">
            {worksIn.length ? (
              worksIn.map((w) => (
                <span key={w} className="rounded bg-muted px-1.5 py-0.5">
                  {w}
                </span>
              ))
            ) : (
              <span className="opacity-50">—</span>
            )}
          </div>
        </div>
        <div>
          <div className="opacity-70 mb-1">
            {t('extensions.card.permissions', {
              defaultValue: 'Permissions',
              count: permissions.length,
            })}{' '}
            ({permissions.length})
          </div>
          <PermissionsList permissions={permissions} />
        </div>
      </div>
    </div>
  )
}

function RuntimeBadge({ runtime }: { runtime: ExtensionRuntime }) {
  const { t } = useTranslation()
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium opacity-90"
      title={t(`extensions.runtime.${runtime}.hint`, {
        defaultValue: RUNTIME_PLACEMENT[runtime],
      })}
    >
      <span className="opacity-70">{t('extensions.card.runtime', { defaultValue: 'Runtime' })}:</span>
      {t(`extensions.runtime.${runtime}`, { defaultValue: runtime })}
    </span>
  )
}

function PermissionsList({ permissions }: { permissions: ExtensionPermission[] }) {
  const { t } = useTranslation()
  if (!permissions.length) {
    return (
      <span className="text-xs opacity-60">
        {t('extensions.card.noPermissions', { defaultValue: 'No permissions' })}
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {permissions.map((p) => (
        <span
          key={p}
          className={`rounded px-1.5 py-0.5 text-[10px] font-mono border ${
            isHighRisk(p)
              ? 'border-amber-500/60 text-amber-700 dark:text-amber-300 bg-amber-500/10'
              : 'opacity-80'
          }`}
        >
          {p}
        </span>
      ))}
    </div>
  )
}

export default function ExtensionsSettingsPage() {
  const { t } = useTranslation()
  const activeWorkspace = useActiveWorkspace()
  const workspaceId = activeWorkspace?.id
  const [section, setSection] = useState<SectionId>('catalog')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [query, setQuery] = useState('')
  const [catalog, setCatalog] = useState<ExtensionsListCatalogResult | null>(null)
  const [installed, setInstalled] = useState<ExtensionsListInstalledResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [hostStatus, setHostStatus] = useState<ExtensionHostStatus | null>(null)

  const load = useCallback(async () => {
    try {
      const filter =
        category === 'all' && !query
          ? undefined
          : {
              category: category === 'all' ? undefined : category,
              query: query.trim() || undefined,
            }
      const [cat, inst, host] = await Promise.all([
        window.electronAPI.extensionsListCatalog({ filter }),
        window.electronAPI.extensionsListInstalled({
          workspaceId: workspaceId ?? undefined,
        }),
        window.electronAPI.extensionHostStatus().catch(() => null),
      ])
      setCatalog(cat)
      setInstalled(inst)
      setHostStatus(host)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [category, query, workspaceId])

  useEffect(() => {
    void load()
    const off = window.electronAPI.onExtensionsChanged(() => {
      void load()
    })
    const offMp = window.electronAPI.onMarketplaceChanged(() => {
      void load()
    })
    return () => {
      off()
      offMp()
    }
  }, [load])

  const runBusy = useCallback(async (id: string, fn: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      await fn()
      setActionMsg(t('extensions.action.success', { defaultValue: 'Done' }))
      window.setTimeout(() => setActionMsg(null), 2500)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy((b) => {
        const next = { ...b }
        delete next[id]
        return next
      })
    }
  }, [load, t])

  const catalogEntries = catalog?.entries ?? []
  const installedRecords = installed?.records ?? []

  const filteredInstalled = useMemo(() => {
    let list = installedRecords
    if (category !== 'all') list = list.filter((r) => r.category === category)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((r) =>
        [r.manifest.name, r.description ?? '', r.id, ...(r.tags ?? [])]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }
    return list
  }, [installedRecords, category, query])

  const updates = useMemo(
    () => installedRecords.filter((r) => r.status === 'update-available'),
    [installedRecords],
  )
  const disabled = useMemo(
    () => installedRecords.filter((r) => r.status === 'disabled'),
    [installedRecords],
  )

  const permissionRows = useMemo(() => {
    return installedRecords.map((r) => ({
      id: r.id,
      name: r.manifest.name,
      permissions: r.manifest.permissions,
      status: r.status,
    }))
  }, [installedRecords])

  const providerLabel = useCallback(
    (providerId: string) =>
      catalog?.providers.find((p) => p.id === providerId)?.label ?? providerId,
    [catalog],
  )


  const openSiyuanCompat = useCallback(() => {
    navigate(routes.view.siyuan({ kind: 'notebook', id: SIYUAN_FULL_SURFACE_ID }))
  }, [])


  const renderCatalogCard = (entry: CatalogEntry) => {
    const installedMatch = installedRecords.find((r) => r.id === entry.id)
    const status = installedMatch?.status ?? 'available'
    const marketplaceId = entry.marketplaceId ?? installedMatch?.marketplaceId
    const curatedInstalled = Boolean(marketplaceId && installedMatch)
    const tags = entry.tags ?? installedMatch?.tags
    const compatLevel = parseCompatLevelFromTags(tags)
    const requiresFullChrome = tagsRequireFullChrome(tags)
    const bazaarCoords = entry.bazaar
    const isSiyuanBazaar =
      entry.providerId === 'siyuan-bazaar' || entry.runtime === 'siyuan-plugin'
    const canInstallBazaar =
      Boolean(bazaarCoords) && status === 'available' && isSiyuanBazaar
    const canInstallMarketplace = Boolean(marketplaceId) && status === 'available'
    const bareBazaarName = entry.id.startsWith('siyuan-plugin:')
      ? entry.id.slice('siyuan-plugin:'.length)
      : entry.id
    const canUninstallBazaar =
      isSiyuanBazaar && Boolean(installedMatch) && !installedMatch?.readOnly
    return (
      <ExtensionCard
        key={entry.id}
        name={entry.name}
        version={entry.version}
        description={entry.description}
        runtime={entry.runtime}
        category={entry.category}
        permissions={entry.permissions}
        worksIn={entry.worksIn}
        installTarget={entry.installTarget}
        status={status}
        providerLabel={providerLabel(entry.providerId)}
        busy={Boolean(busy[entry.id])}
        marketplaceId={marketplaceId}
        compatLevel={compatLevel}
        requiresFullChrome={requiresFullChrome}
        onOpenCompat={
          entry.runtime === 'siyuan-plugin' || installedMatch?.manifest.runtime === 'siyuan-plugin'
            ? openSiyuanCompat
            : undefined
        }
        onInstall={
          canInstallBazaar && bazaarCoords
            ? () =>
                void runBusy(entry.id, async () => {
                  await window.electronAPI.pluginBridgeInstallBazaar({
                    packageName: bazaarCoords.packageName,
                    repoURL: bazaarCoords.repoURL,
                    repoHash: bazaarCoords.repoHash,
                  })
                })
            : canInstallMarketplace
              ? () =>
                  void runBusy(entry.id, async () => {
                    await window.electronAPI.installMarketplaceEntry(marketplaceId!)
                  })
              : undefined
        }
        onUpdate={
          curatedInstalled && status === 'update-available'
            ? () =>
                void runBusy(entry.id, async () => {
                  await window.electronAPI.updateMarketplaceEntry(marketplaceId!)
                })
            : undefined
        }
        onUninstall={
          canUninstallBazaar
            ? () =>
                void runBusy(entry.id, async () => {
                  await window.electronAPI.pluginBridgeUninstallBazaar({
                    packageName: bareBazaarName,
                  })
                })
            : curatedInstalled
              ? () =>
                  void runBusy(entry.id, async () => {
                    await window.electronAPI.removeMarketplaceEntry(marketplaceId!)
                  })
              : undefined
        }
        onToggle={
          installedMatch
            ? (enabled) =>
                void runBusy(entry.id, async () => {
                  await window.electronAPI.extensionsSetEnabled({ id: entry.id, enabled })
                })
            : undefined
        }
      />
    )
  }

  const renderRecordCard = (rec: ExtensionRecord) => {
    const marketplaceId = rec.marketplaceId
    const curated = Boolean(marketplaceId) && !rec.readOnly
    const compatLevel = parseCompatLevelFromTags(rec.tags)
    const requiresFullChrome = tagsRequireFullChrome(rec.tags)
    const isSiyuanBazaar =
      rec.providerId === 'siyuan-bazaar' || rec.manifest.runtime === 'siyuan-plugin'
    const bareBazaarName = rec.id.startsWith('siyuan-plugin:')
      ? rec.id.slice('siyuan-plugin:'.length)
      : rec.id
    const canUninstallBazaar = isSiyuanBazaar && !rec.readOnly
    return (
      <ExtensionCard
        key={rec.id}
        name={rec.manifest.name}
        version={rec.manifest.version}
        description={rec.description}
        runtime={rec.manifest.runtime}
        category={rec.category}
        permissions={rec.manifest.permissions}
        worksIn={rec.worksIn}
        installTarget={rec.installTarget}
        status={rec.status}
        providerLabel={providerLabel(rec.providerId)}
        readOnly={rec.readOnly}
        busy={Boolean(busy[rec.id])}
        marketplaceId={marketplaceId}
        compatLevel={compatLevel}
        requiresFullChrome={requiresFullChrome}
        onOpenCompat={rec.manifest.runtime === 'siyuan-plugin' ? openSiyuanCompat : undefined}
        onUpdate={
          curated && rec.status === 'update-available'
            ? () =>
                void runBusy(rec.id, async () => {
                  await window.electronAPI.updateMarketplaceEntry(marketplaceId!)
                })
            : undefined
        }
        onUninstall={
          canUninstallBazaar
            ? () =>
                void runBusy(rec.id, async () => {
                  await window.electronAPI.pluginBridgeUninstallBazaar({
                    packageName: bareBazaarName,
                  })
                })
            : curated
              ? () =>
                  void runBusy(rec.id, async () => {
                    await window.electronAPI.removeMarketplaceEntry(marketplaceId!)
                  })
              : undefined
        }
        onToggle={(enabled) =>
          void runBusy(rec.id, async () => {
            await window.electronAPI.extensionsSetEnabled({ id: rec.id, enabled })
          })
        }
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        title={t('settings.extensions.title', { defaultValue: 'Extensions' })}
        actions={<HeaderMenu route={routes.view.settings('extensions')} />}
      />

      <ScrollArea className="flex-1">
        <div className="px-5 pt-6 pb-10 max-w-3xl mx-auto w-full space-y-5">
          {/* Sections */}
          <div className="flex flex-wrap gap-1.5">
            {SECTIONS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`text-xs rounded-md border px-2.5 py-1 ${
                  section === id ? 'bg-muted font-medium' : 'opacity-70 hover:opacity-100'
                }`}
              >
                {t(`extensions.section.${id}`, { defaultValue: id })}
              </button>
            ))}
          </div>

          {/* Category filters */}
          {(section === 'catalog' || section === 'installed') && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`text-xs rounded-full border px-2.5 py-1 ${
                  category === 'all' ? 'bg-muted font-medium' : 'opacity-70'
                }`}
              >
                {t('extensions.category.all', { defaultValue: 'All' })}
              </button>
              {CATALOG_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`text-xs rounded-full border px-2.5 py-1 ${
                    category === c ? 'bg-muted font-medium' : 'opacity-70'
                  }`}
                >
                  {t(`extensions.category.${c}`, { defaultValue: c })}
                </button>
              ))}
              <input
                className="ml-auto border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring bg-background min-w-[12rem]"
                placeholder={t('extensions.search', { defaultValue: 'Search extensions…' })}
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
              />
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1 text-xs border rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <RefreshCw className="w-3 h-3" />
                {t('extensions.refresh', { defaultValue: 'Refresh' })}
              </button>
            </div>
          )}

          {actionMsg ? (
            <div className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {actionMsg}
            </div>
          ) : null}
          {error ? (
            <div className="text-xs text-destructive border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 text-sm opacity-70 py-10 justify-center">
              <Spinner className="w-4 h-4" />
              {t('extensions.loading', { defaultValue: 'Loading extensions…' })}
            </div>
          ) : null}

          {!loading && section === 'catalog' ? (
            <div className="space-y-3">
              <div className="text-xs opacity-60 flex items-center gap-2">
                <Package className="w-3.5 h-3.5" />
                {t('extensions.catalog.count', {
                  defaultValue: '{{count}} catalog entries',
                  count: catalogEntries.length,
                })}
              </div>
              {catalogEntries.length === 0 ? (
                <p className="text-sm opacity-60">
                  {t('extensions.catalog.empty', { defaultValue: 'No catalog entries match.' })}
                </p>
              ) : (
                catalogEntries.map(renderCatalogCard)
              )}
            </div>
          ) : null}

          {!loading && section === 'installed' ? (
            <div className="space-y-3">
              <div className="text-xs opacity-60 flex items-center gap-2">
                <Blocks className="w-3.5 h-3.5" />
                {t('extensions.installed.count', {
                  defaultValue: '{{count}} installed',
                  count: filteredInstalled.length,
                })}
              </div>
              {filteredInstalled.length === 0 ? (
                <p className="text-sm opacity-60">
                  {t('extensions.installed.empty', {
                    defaultValue: 'No installed extensions in this workspace yet.',
                  })}
                </p>
              ) : (
                filteredInstalled.map(renderRecordCard)
              )}
            </div>
          ) : null}

          {!loading && section === 'updates' ? (
            <div className="space-y-3">
              {updates.length === 0 ? (
                <p className="text-sm opacity-60">
                  {t('extensions.updates.empty', { defaultValue: 'No updates available.' })}
                </p>
              ) : (
                updates.map(renderRecordCard)
              )}
            </div>
          ) : null}

          {!loading && section === 'permissions' ? (
            <div className="space-y-3">
              <div className="text-xs opacity-60 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                {t('extensions.permissions.summary', {
                  defaultValue: 'Granted permissions by extension',
                })}
              </div>
              {permissionRows.length === 0 ? (
                <p className="text-sm opacity-60">
                  {t('extensions.permissions.empty', { defaultValue: 'No extensions installed.' })}
                </p>
              ) : (
                permissionRows.map((row) => (
                  <div key={row.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{row.name}</span>
                      <span className="text-[10px] uppercase opacity-60">{row.status}</span>
                    </div>
                    <PermissionsList permissions={row.permissions} />
                  </div>
                ))
              )}
            </div>
          ) : null}

          {!loading && section === 'disabled' ? (
            <div className="space-y-3">
              {disabled.length === 0 ? (
                <p className="text-sm opacity-60">
                  {t('extensions.disabled.empty', { defaultValue: 'No disabled extensions.' })}
                </p>
              ) : (
                disabled.map(renderRecordCard)
              )}
            </div>
          ) : null}

          {!loading && section === 'developer' ? (
            <div className="border rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Wrench className="w-4 h-4" />
                {t('extensions.developer.title', { defaultValue: 'Developer mode' })}
              </div>
              <p className="opacity-70 text-xs leading-relaxed">
                {t('extensions.developer.body', {
                  defaultValue:
                    'Extension Host runs craft-sandbox modules in a utilityProcess. SiYuan plugins are never executed here.',
                })}
              </p>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1 font-mono">
                <div>
                  {t('extensions.developer.hostStatus', { defaultValue: 'Host status' })}:{' '}
                  <span className="font-semibold">{hostStatus?.status ?? 'unknown'}</span>
                  {hostStatus?.pid != null ? ` · pid ${hostStatus.pid}` : null}
                </div>
                <div className="opacity-70">
                  executesSiyuanPlugins: {String(hostStatus?.executesSiyuanPlugins ?? false)}
                </div>
                {hostStatus?.message ? (
                  <div className="opacity-60 break-words whitespace-pre-wrap">{hostStatus.message}</div>
                ) : null}
                {hostStatus?.loadedExtensions?.length ? (
                  <div className="opacity-60">loaded: {hostStatus.loadedExtensions.join(', ')}</div>
                ) : null}
              </div>
              <div className="text-xs font-mono opacity-60 break-all">
                state keys: {Object.keys(installed?.state.enabled ?? {}).length}
              </div>
            </div>
          ) : null}

          {!loading && section === 'registries' ? (
            <div className="space-y-3">
              <div className="text-xs opacity-60 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                {t('extensions.registries.title', { defaultValue: 'Catalog providers' })}
              </div>
              {(catalog?.providers ?? []).map((p) => (
                <div key={p.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{p.label}</div>
                    <div className="text-xs opacity-60 font-mono">{p.id}</div>
                  </div>
                  <span className="text-[10px] uppercase opacity-60">
                    {p.id === 'siyuan-bazaar'
                      ? t('extensions.registries.bazaarEmpty', {
                          defaultValue: 'Empty without kernel plugin list',
                        })
                      : t('extensions.registries.active', { defaultValue: 'active' })}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}
