/**
 * KnowledgeHome (W2, spec S-01 §Режим Знания + P2) — collection body of the
 * Knowledge mode: full-text search across the primary knowledge connection,
 * result deep-links into the in-app SiYuan surface, and the saved-views slot.
 *
 * Behavior:
 * - Search box (`knowledge.search.placeholder`); typing ≥2 chars searches
 *   after a short debounce, Enter searches immediately. Queries the FIRST
 *   connection from `knowledge.listConnections()` (P1 multi-connection UX is
 *   settings-driven; there is no in-surface connection picker yet).
 * - Result click → `navigate(routes.view.siyuan({ kind: ref.kind, id: ref.id }))`
 *   via NavigationContext, opening `knowledge/{kind}/{id}` in the panel stack.
 * - Saved-views slot is a fixed placeholder card (SLOT for P5) with an honest
 *   copy — no hidden data source.
 *
 * The search/empty logic is exported (searchKnowledge / searchHitRoute /
 * resolveKnowledgeApi) so `__tests__/knowledge-home.test.ts` exercises the
 * routing happy path and the no-connections empty state without a DOM harness
 * (the electron renderer test convention is logic-level bun:test).
 */
import { atom, useAtom, useAtomValue } from 'jotai'
import { Bookmark, FileDiff, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SearchHit } from '@craft-agent/core/knowledge'
import { windowWorkspaceIdAtom } from '@/atoms/sessions'
import { EntityList } from '@/components/ui/entity-list'
import { useNavigation } from '@/contexts/NavigationContext'
import { routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import { KnowledgeProposals } from './KnowledgeProposals'
import { countActionableProposals, resolveKnowledgeMutationsApi } from './proposal-actions'

/**
 * Which body KnowledgeHome renders. Module-level atom so other column hosts
 * (KnowledgeNavigator link) can surface the proposals list explicitly; the
 * section entry below search toggles it in place.
 */
export const knowledgeHomeViewAtom = atom<'search' | 'proposals'>('search')

// ---------------------------------------------------------------------------
// Search logic (exported for tests — see header).
// ---------------------------------------------------------------------------

export interface KnowledgeSearchApi {
  listConnections(): Promise<Array<{ id: string }>>
  search(args: {
    workspaceId: string
    connectionId: string
    input: { query: string }
  }): Promise<{ items: SearchHit[] }>
}

/** Reads the P1 knowledge surface off the preload-injected ElectronAPI. */
export function resolveKnowledgeApi(): KnowledgeSearchApi | null {
  if (typeof window === 'undefined' || !window.electronAPI?.knowledge) return null
  return window.electronAPI.knowledge
}

/**
 * Runs a knowledge search against the first configured connection.
 * Returns `null` when there is no usable API or zero connections — the
 * component renders the empty state for that; throws are caught by callers
 * that surface `knowledge.surface.error`.
 */
export async function searchKnowledge(
  api: KnowledgeSearchApi | null,
  workspaceId: string,
  query: string,
): Promise<SearchHit[] | null> {
  if (!api) return null
  const connections = await api.listConnections()
  const primary = connections[0]
  if (!primary) return null
  const page = await api.search({
    workspaceId,
    connectionId: primary.id,
    input: { query },
  })
  return page.items
}

/** Route for a search hit — the in-app SiYuan surface for this document/block. */
export function searchHitRoute(hit: Pick<SearchHit, 'ref'>) {
  return routes.view.siyuan({ kind: hit.ref.kind, id: hit.ref.id })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type SearchStatus = 'idle' | 'loading' | 'error' | 'done'

const SEARCH_DEBOUNCE_MS = 250

export function KnowledgeHome() {
  const { t } = useTranslation()
  const { navigate } = useNavigation()
  const workspaceId = useAtomValue(windowWorkspaceIdAtom)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [noConnections, setNoConnections] = useState(false)
  const [view, setView] = useAtom(knowledgeHomeViewAtom)
  const [actionableProposalCount, setActionableProposalCount] = useState(0)

  // Proposals section entry badge: count of proposals awaiting the user
  // (pending_review/conflict), re-read on knowledge:changed (P3 push wiring).
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    const refreshCount = async () => {
      const api = resolveKnowledgeMutationsApi()
      if (!api) return
      try {
        const count = await countActionableProposals(api, workspaceId ?? undefined)
        if (!cancelled) setActionableProposalCount(count)
      } catch {
        /* leave the previous count in place */
      }
    }
    void refreshCount()
    const unsubscribe = window.electronAPI?.knowledge?.onChanged?.(() => void refreshCount())
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [workspaceId])

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      if (!trimmed) {
        setStatus('idle')
        setHits([])
        setNoConnections(false)
        return
      }
      if (!workspaceId) return
      const api = resolveKnowledgeApi()
      setStatus('loading')
      try {
        const items = await searchKnowledge(api, workspaceId, trimmed)
        if (items === null) {
          setNoConnections(true)
          setHits([])
        } else {
          setNoConnections(false)
          setHits(items)
        }
        setStatus('done')
      } catch {
        setStatus('error')
      }
    },
    [workspaceId],
  )

  useEffect(() => {
    if (query.trim().length < 2) return
    const timer = setTimeout(() => void runSearch(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, runSearch])

  const openHit = useCallback(
    (hit: SearchHit) => navigate(searchHitRoute(hit)),
    [navigate],
  )

  // Empty-state semantics: idle prompts the search, no-connections points at
  // Settings, a finished search with zero hits says so. The previously
  // borrowed keys lied (home.title is a title, surface.compatHint is the
  // compat banner, search.placeholder is input copy) — P3-16.
  const emptyState =
    status === 'idle' ? (
      <HomeHint text={t('knowledge.search.placeholder')} />
    ) : noConnections ? (
      <HomeHint text={t('knowledge.home.noConnections')} />
    ) : (
      <HomeHint text={t('knowledge.home.noResults')} />
    )

  const proposalsEntry = (
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={() => setView(view === 'proposals' ? 'search' : 'proposals')}
        aria-pressed={view === 'proposals'}
        className={cn(
          'flex w-full items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-left',
          'hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          view === 'proposals' && 'ring-1 ring-ring',
        )}
      >
        <FileDiff className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground/80">
          {t('knowledge.proposals.title')}
        </span>
        {actionableProposalCount > 0 && (
          <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {t('knowledge.proposals.count', { count: actionableProposalCount })}
          </span>
        )}
      </button>
    </div>
  )

  if (view === 'proposals') {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border pt-3">{proposalsEntry}</div>
        <KnowledgeProposals className="min-h-0 flex-1" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <EntityList<SearchHit>
        className="flex-1"
        header={
          <>
            <form
              className="sticky top-0 z-10 bg-background px-3 pb-2 pt-3"
              onSubmit={(e) => {
                e.preventDefault()
                void runSearch(query)
              }}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('knowledge.search.placeholder')}
                  aria-label={t('knowledge.search.placeholder')}
                  className={cn(
                    'w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-[13px]',
                    'placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                />
              </div>
            </form>
            {proposalsEntry}
          </>
        }
        items={status === 'done' ? hits : []}
        getKey={(hit) => `${hit.ref.kind}:${hit.ref.id}`}
        emptyState={
          status === 'loading' ? (
            <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              {t('knowledge.surface.loading')}
            </p>
          ) : status === 'error' ? (
            <p className="px-3 py-6 text-center text-[12px] text-destructive">
              {t('knowledge.surface.error')}
            </p>
          ) : (
            emptyState
          )
        }
        renderItem={(hit) => (
          <button
            type="button"
            key={`${hit.ref.kind}:${hit.ref.id}`}
            onClick={() => openHit(hit)}
            className={cn(
              'flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left',
              'hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            <span className="truncate text-[13px] font-medium text-foreground">
              {hit.title || hit.ref.id}
            </span>
            <span className="truncate text-[12px] text-muted-foreground">{hit.snippet}</span>
          </button>
        )}
      />
      {/* Saved-views slot — fixed placeholder; P5 lands the real model/UI. */}
      <div className="border-t border-border px-3 py-2">
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2">
          <Bookmark className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium text-foreground/80">
              {t('knowledge.nav.savedViews')}
            </div>
            <div className="text-[11px] leading-snug text-muted-foreground">
              {t('knowledge.nav.savedViewsHint')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HomeHint({ text }: { text: string }) {
  return (
    <p className="px-3 py-6 text-center text-[12px] leading-snug text-muted-foreground">{text}</p>
  )
}
