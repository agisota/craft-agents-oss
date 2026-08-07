import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Spinner } from '@craft-agent/ui'
import {
  ShoppingBag,
  Star,
  Clock,
  DownloadCloud,
  Package,
  CheckCircle2,
  FileText,
  Wrench,
} from 'lucide-react'

import { routes } from '@/lib/navigate'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type {
  MarketplaceCatalogResult,
  MarketplaceEntry,
  MarketplaceEntryKind,
  MarketplaceEntryStats,
  MarketplaceLockRecord,
} from '@craft-agent/shared/marketplace'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'marketplace',
}

type SortKey = 'stars' | 'downloads' | 'updated' | 'name'
type BusyState = Record<string, 'busy' | undefined>

const KIND_ICONS: Record<MarketplaceEntryKind, typeof Package> = {
  skillpack: Package,
  tool: Wrench,
  'context-doc': FileText,
}

function formatCompact(n: number): string {
  return Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

function daysElapsed(iso: string): number {
  // Прошедшие полные сутки с pushedAt/refetch-даты; отрицательное не бывает.
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
}

export default function MarketplaceSettingsPage() {
  const { t } = useTranslation()
  const [view, setView] = useState<MarketplaceCatalogResult | null>(null)
  const [statsMap, setStatsMap] = useState<Record<string, MarketplaceEntryStats>>({})
  const [busy, setBusy] = useState<BusyState>({})
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<MarketplaceEntryKind | ''>('')
  const [sortKey, setSortKey] = useState<SortKey>('stars')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [cat, st] = await Promise.all([
        window.electronAPI.getMarketplaceCatalog(),
        window.electronAPI.getMarketplaceStats(),
      ])
      setView(cat)
      setStatsMap(st)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return window.electronAPI.onMarketplaceChanged(() => {
      void load()
    })
  }, [load])

  const run = useCallback(
    async (id: string, fn: () => Promise<unknown>, successKey: string) => {
      setBusy((b) => ({ ...b, [id]: 'busy' }))
      try {
        await fn()
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
      void successKey
    },
    [load],
  )

  const entries = useMemo(() => {
    if (!view) return []
    const q = query.trim().toLowerCase()
    const filtered = view.catalog.entries.filter((e) => {
      if (q && !e.title.toLowerCase().includes(q) && !e.descriptionRu.toLowerCase().includes(q))
        return false
      if (kindFilter && e.kind !== kindFilter) return false
      return true
    })
    const statsVal = (id: string, sel: (s: MarketplaceEntryStats) => number): number => {
      const s = statsMap[id]
      return s ? sel(s) : 0
    }
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.title.localeCompare(b.title, 'ru')
        case 'downloads':
          return (
            statsVal(b.id, (s) => s.npmWeeklyDownloads ?? 0) -
            statsVal(a.id, (s) => s.npmWeeklyDownloads ?? 0)
          )
        case 'updated': {
          const pa = statsMap[a.id]?.pushedAt ? new Date(statsMap[a.id]!.pushedAt!).getTime() : 0
          const pb = statsMap[b.id]?.pushedAt ? new Date(statsMap[b.id]!.pushedAt!).getTime() : 0
          return pb - pa
        }
        default:
          return statsVal(b.id, (s) => s.stars ?? 0) - statsVal(a.id, (s) => s.stars ?? 0)
      }
    })
  }, [view, query, kindFilter, sortKey, statsMap])

  const installs: Record<string, MarketplaceLockRecord> = view?.installs ?? {}

  const entryState = (e: MarketplaceEntry): 'available' | 'installed' | 'update' | 'deferred' => {
    const lock = installs[e.id]
    if (!lock) return 'available'
    if (lock.status === 'deferred') return 'deferred'
    return lock.ref === e.source.ref ? 'installed' : 'update'
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <PanelHeader
          title={t('settings.marketplace.title')}
          actions={<HeaderMenu route={routes.view.settings('marketplace')} />}
        />
        <div className="flex-1 flex items-center justify-center">
          <Spinner className="w-6 h-6" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title={t('settings.marketplace.title')}
        actions={<HeaderMenu route={routes.view.settings('marketplace')} />}
      />

      <div className="px-5 pt-6 max-w-3xl mx-auto w-full">
        {/* Catalog status bar */}
        <div className="flex items-center justify-between border rounded-lg px-4 py-3 bg-muted/30 mb-4 text-sm">
          <div>
            <span className="opacity-70">{t('marketplace.catalogVersion')}: </span>
            <span className="font-medium">{view?.catalog.catalogVersion ?? '—'}</span>
            {view && (
              <span className="ml-2 text-xs italic opacity-60">
                ({t(`marketplace.origin.${view.origin}`)})
              </span>
            )}
            {view?.lastCatalogFetchAt ? (
              <span className="ml-2 text-xs opacity-60">
                {t('marketplace.lastFetchDaysAgo', { count: daysElapsed(new Date(view.lastCatalogFetchAt).toISOString()) })}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setRefreshing(true)
              window.electronAPI
                .refreshMarketplaceCatalog()
                .then((cat) => setView(cat))
                .catch((err) => setError(err instanceof Error ? err.message : String(err)))
                .finally(() => setRefreshing(false))
            }}
            disabled={refreshing}
            className="text-sm underline decoration-dashed opacity-80 hover:opacity-100 disabled:opacity-40 flex items-center gap-1.5"
          >
            {refreshing ? <Spinner className="w-3 h-3" /> : null}
            {t('marketplace.refresh')}
          </button>
        </div>

        {error ? (
          <div className="mb-4 border border-destructive/40 bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-2">
            {error}
          </div>
        ) : null}

        {/* Controls */}
        <div className="flex flex-wrap gap-2 mb-4 items-center text-sm">
          <input
            className="border rounded-md px-3 py-1.5 outline-none focus:ring-1 focus:ring-ring bg-background"
            placeholder={t('marketplace.search')}
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
          />
          <select
            className="border rounded-md px-2 py-1.5 bg-background"
            value={kindFilter}
            onChange={(ev) => setKindFilter(ev.target.value as MarketplaceEntryKind | '')}
          >
            <option value="">{t('marketplace.filterAllKinds')}</option>
            <option value="skillpack">{t('marketplace.kind.skillpack')}</option>
            <option value="tool">{t('marketplace.kind.tool')}</option>
            <option value="context-doc">{t('marketplace.kind.context-doc')}</option>
          </select>
          <select
            className="border rounded-md px-2 py-1.5 bg-background"
            value={sortKey}
            onChange={(ev) => setSortKey(ev.target.value as SortKey)}
          >
            <option value="stars">{t('marketplace.sortStars')}</option>
            <option value="downloads">{t('marketplace.sortDownloads')}</option>
            <option value="updated">{t('marketplace.sortUpdated')}</option>
            <option value="name">{t('marketplace.sortName')}</option>
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 pb-8 space-y-3 max-w-3xl mx-auto w-full">
            {entries.length === 0 ? (
              <div className="text-center py-12 border rounded-lg">
                <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <div className="text-sm font-medium">{t('marketplace.emptyTitle')}</div>
                <div className="text-xs opacity-70 mt-1">{t('marketplace.emptyDescription')}</div>
              </div>
            ) : (
              entries.map((e) => {
                const st = statsMap[e.id]
                const state = entryState(e)
                const isBusy = busy[e.id] === 'busy'
                const Icon = KIND_ICONS[e.kind]
                return (
                  <div key={e.id} className="border rounded-lg p-4 flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary mt-1">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                            {e.title}
                            <span className="text-xs px-2 py-0.5 border rounded-full opacity-70">
                              {t(`marketplace.kind.${e.kind}`)}
                            </span>
                            {e.license ? (
                              <span className="text-[10px] opacity-60">{e.license}</span>
                            ) : null}
                          </div>
                          <div className="text-xs opacity-70 mt-1 break-words">
                            {e.descriptionRu}
                          </div>
                        </div>

                        <div className="text-xs text-right whitespace-nowrap shrink-0">
                          {st && !st.error ? (
                            <>
                              {typeof st.stars === 'number' ? (
                                <div className="flex items-center justify-end gap-1.5 font-medium">
                                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                  {formatCompact(st.stars)}
                                </div>
                              ) : null}
                              {typeof st.npmWeeklyDownloads === 'number' ? (
                                <div className="mt-1 opacity-80 flex items-center justify-end gap-1.5">
                                  <DownloadCloud className="w-3 h-3" />
                                  {t('marketplace.weeklyDownloads', {
                                    count: formatCompact(st.npmWeeklyDownloads),
                                  })}
                                </div>
                              ) : null}
                              {st.pushedAt ? (
                                <div className="mt-1 opacity-60 flex items-center justify-end gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  {t('marketplace.updatedDaysAgo', { count: daysElapsed(st.pushedAt) })}
                                </div>
                              ) : null}
                              {st.stale ? (
                                <div className="mt-0.5 text-[10px] opacity-50">
                                  {t('marketplace.statsStale')}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="italic opacity-50">{t('marketplace.statsUnavailable')}</div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            title={e.source.ref}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground cursor-help"
                          >
                            {e.source.repo}@{e.source.ref.slice(0, 8)}
                          </span>
                          {e.tags?.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] opacity-60">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {state === 'installed' || state === 'deferred' ? (
                            <>
                              <span className="text-xs py-1 px-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                {state === 'deferred'
                                  ? t('marketplace.deferred')
                                  : t('marketplace.installed')}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  void run(e.id, () => window.electronAPI.removeMarketplaceEntry(e.id), 'remove')
                                }
                                disabled={isBusy}
                                className="text-xs px-3 py-1 rounded-md border hover:bg-muted disabled:opacity-40"
                              >
                                {t('marketplace.remove')}
                              </button>
                            </>
                          ) : state === 'update' ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void run(e.id, () => window.electronAPI.updateMarketplaceEntry(e.id), 'update')
                                }
                                disabled={isBusy}
                                className="text-xs px-4 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5 disabled:opacity-40"
                              >
                                {isBusy ? <Spinner className="w-3 h-3" /> : null}
                                {t('marketplace.update')}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void run(e.id, () => window.electronAPI.removeMarketplaceEntry(e.id), 'remove')
                                }
                                disabled={isBusy}
                                className="text-xs px-3 py-1 rounded-md border hover:bg-muted disabled:opacity-40"
                              >
                                {t('marketplace.remove')}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void run(e.id, () => window.electronAPI.installMarketplaceEntry(e.id), 'install')
                              }
                              disabled={isBusy}
                              className="text-xs px-4 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 disabled:opacity-40"
                            >
                              {isBusy ? <Spinner className="w-3 h-3" /> : null}
                              {t('marketplace.install')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
