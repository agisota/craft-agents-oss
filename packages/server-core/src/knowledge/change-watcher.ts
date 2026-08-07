/**
 * KnowledgeChangeWatcher — polling watcher for knowledge document/attr changes (P6 / K-10).
 *
 * v1: poll provider.search + provider.get; compare contentHash/attrs snapshot in
 * `{workspaceRoot}/knowledge/watch-state.json`. Emits AppEvent-shaped callbacks
 * (KnowledgeDocumentCreated|Updated|AttributeChanged). No SiYuan push stream.
 *
 * Loop-safety: consults AutomationLoopGuard before emit when automationId is known
 * (watcher itself emits without automationId; handler/executor notes writes).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { KnowledgeNode, KnowledgeProvider, KnowledgeRef } from '@craft-agent/core/knowledge'
import {
  getSharedAutomationLoopGuard,
  type AutomationLoopGuard,
} from './automation-loop-guard'

export type KnowledgeWatchEvent =
  | 'KnowledgeDocumentCreated'
  | 'KnowledgeDocumentUpdated'
  | 'KnowledgeAttributeChanged'
  | 'KnowledgeDatabaseRowChanged'
  | 'KnowledgeDocumentStale'

export interface KnowledgeWatchPayload {
  workspaceId: string
  connectionId: string
  timestamp: number
  ref: KnowledgeRef
  contentHashBefore?: string
  contentHashAfter?: string
  notebookId?: string
  path?: string
  title?: string
  attrs?: Record<string, string>
  attribute?: { name: string; type?: string }
  oldValue?: string | null
  newValue?: string | null
  editor?: 'external' | 'automation'
  /** Present when change is attributed to a prior automation write (usually suppressed). */
  automationId?: string
  [key: string]: unknown
}

export type KnowledgeWatchOnEvent = (
  event: KnowledgeWatchEvent,
  payload: KnowledgeWatchPayload,
) => void | Promise<void>

export interface WatchStateEntry {
  contentHash: string
  attrs: Record<string, string>
  path?: string
  title?: string
  updatedAt?: number
}

export type WatchStateMap = Record<string, WatchStateEntry>

export interface KnowledgeChangeWatcherOptions {
  connectionId: string
  workspaceId: string
  workspaceRoot: string
  /** Provider factory invoked each tick (token rotation safe). */
  getProvider: () => Promise<KnowledgeProvider>
  onEvent: KnowledgeWatchOnEvent
  intervalMs?: number
  /** Max docs sampled per tick (search page size). */
  pageLimit?: number
  loopGuard?: AutomationLoopGuard
  /** Injectable clock. */
  now?: () => number
  /** Injectable timer (tests). */
  setIntervalFn?: typeof setInterval
  clearIntervalFn?: typeof clearInterval
  /** When set, skip the initial baseline seed emit (default true = seed silently). */
  silentSeed?: boolean
}

function attrsToRecord(node: KnowledgeNode): Record<string, string> {
  const out: Record<string, string> = {}
  for (const a of node.attributes ?? []) {
    out[a.key] = a.value
  }
  return out
}

function attrsHash(attrs: Record<string, string>): string {
  const keys = Object.keys(attrs).sort()
  return keys.map((k) => `${k}=${attrs[k]}`).join('\n')
}

function refKey(ref: KnowledgeRef): string {
  return `${ref.scheme}/${ref.kind}/${ref.id}`
}

export class KnowledgeChangeWatcher {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private disposed = false
  private tickInFlight: Promise<void> | null = null
  private readonly statePath: string
  private readonly intervalMs: number
  private readonly pageLimit: number
  private readonly loopGuard: AutomationLoopGuard
  private readonly now: () => number
  private readonly setIntervalFn: typeof setInterval
  private readonly clearIntervalFn: typeof clearInterval
  private readonly silentSeed: boolean
  private seeded = false

  constructor(private readonly options: KnowledgeChangeWatcherOptions) {
    this.statePath = join(options.workspaceRoot, 'knowledge', 'watch-state.json')
    this.intervalMs = options.intervalMs ?? 60_000
    this.pageLimit = options.pageLimit ?? 50
    this.loopGuard = options.loopGuard ?? getSharedAutomationLoopGuard()
    this.now = options.now ?? (() => Date.now())
    this.setIntervalFn = options.setIntervalFn ?? setInterval
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval
    this.silentSeed = options.silentSeed !== false
  }

  start(): void {
    if (this.disposed || this.running) return
    this.running = true
    // Immediate first tick, then interval.
    void this.safeTick()
    this.timer = this.setIntervalFn(() => {
      void this.safeTick()
    }, this.intervalMs)
    // Don't keep the process alive solely for the watcher in Node/Bun.
    if (typeof (this.timer as { unref?: () => void }).unref === 'function') {
      ;(this.timer as { unref: () => void }).unref()
    }
  }

  stop(): void {
    this.running = false
    if (this.timer !== null) {
      this.clearIntervalFn(this.timer as unknown as NodeJS.Timeout)
      this.timer = null
    }
  }

  dispose(): void {
    this.stop()
    this.disposed = true
  }

  get isRunning(): boolean {
    return this.running
  }

  /** Exposed for tests — run one poll cycle (works even if not start()ed). */
  async tick(): Promise<void> {
    if (this.disposed) return
    if (this.tickInFlight) return this.tickInFlight
    this.tickInFlight = this.runTick()
      .catch(() => {
        /* fail-soft */
      })
      .finally(() => {
        this.tickInFlight = null
      })
    return this.tickInFlight
  }

  private async safeTick(): Promise<void> {
    if (!this.running || this.disposed) return
    if (this.tickInFlight) return this.tickInFlight
    this.tickInFlight = this.runTick()
      .catch(() => {
        /* fail-soft: next interval retries */
      })
      .finally(() => {
        this.tickInFlight = null
      })
    return this.tickInFlight
  }

  private loadState(): WatchStateMap {
    if (!existsSync(this.statePath)) return {}
    try {
      const raw = JSON.parse(readFileSync(this.statePath, 'utf8')) as unknown
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as WatchStateMap
      }
    } catch {
      /* corrupt → resync */
    }
    return {}
  }

  private saveState(state: WatchStateMap): void {
    mkdirSync(dirname(this.statePath), { recursive: true })
    writeFileSync(this.statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  }

  private async runTick(): Promise<void> {
    const provider = await this.options.getProvider()
    const prev = this.loadState()
    const next: WatchStateMap = { ...prev }
    const timestamp = this.now()
    const { connectionId, workspaceId } = this.options

    // Page through recent documents (empty query = broad sample for v1).
    let cursor: string | undefined
    const seen = new Set<string>()
    let pages = 0
    const maxPages = 5

    do {
      const page = await provider.search({
        query: '',
        kinds: ['document', 'block'],
        limit: this.pageLimit,
        cursor,
      })
      pages += 1

      for (const hit of page.items) {
        const k = refKey(hit.ref)
        if (seen.has(k)) continue
        seen.add(k)

        let node: KnowledgeNode
        try {
          node = await provider.get(hit.ref)
        } catch {
          continue
        }

        const attrs = attrsToRecord(node)
        const entry: WatchStateEntry = {
          contentHash: node.contentHash,
          attrs,
          path: node.path,
          title: node.title,
          updatedAt: node.updatedAt,
        }

        const prior = prev[k]
        next[k] = entry

        // First successful tick seeds baseline without emitting (unless silentSeed=false).
        if (!this.seeded && this.silentSeed) {
          continue
        }

        if (!prior) {
          await this.emitSafe('KnowledgeDocumentCreated', {
            workspaceId,
            connectionId,
            timestamp,
            ref: hit.ref,
            notebookId: hit.notebookPath,
            path: node.path,
            title: node.title,
            contentHashAfter: node.contentHash,
            attrs,
            createdAt: node.createdAt,
          })
          continue
        }

        if (prior.contentHash !== entry.contentHash) {
          await this.emitSafe('KnowledgeDocumentUpdated', {
            workspaceId,
            connectionId,
            timestamp,
            ref: hit.ref,
            contentHashBefore: prior.contentHash,
            contentHashAfter: entry.contentHash,
            updatedAt: node.updatedAt,
            editor: 'external',
            path: node.path,
            title: node.title,
            attrs,
          })
        }

        // Attribute diffs
        const allKeys = new Set([...Object.keys(prior.attrs), ...Object.keys(attrs)])
        for (const name of allKeys) {
          const oldValue = prior.attrs[name]
          const newValue = attrs[name]
          if (oldValue === newValue) continue
          await this.emitSafe(
            'KnowledgeAttributeChanged',
            {
              workspaceId,
              connectionId,
              timestamp,
              ref: hit.ref,
              attribute: { name, type: 'text' },
              oldValue: oldValue ?? null,
              newValue: newValue ?? null,
              changedAt: timestamp,
              path: node.path,
              title: node.title,
              attrs,
            },
            name,
          )
        }
      }

      cursor = page.nextCursor
    } while (cursor && pages < maxPages && this.running && !this.disposed)

    this.seeded = true
    this.saveState(next)
  }

  private async emitSafe(
    event: KnowledgeWatchEvent,
    payload: KnowledgeWatchPayload,
    attrName?: string,
  ): Promise<void> {
    // Watcher emits external changes; loop-guard is consulted only when payload
    // carries an automationId (normally absent). Handlers note writes after propose.
    if (payload.automationId) {
      if (
        this.loopGuard.shouldSuppress({
          connectionId: payload.connectionId,
          refId: payload.ref.id,
          attrName,
          automationId: payload.automationId,
        })
      ) {
        return
      }
    }
    await this.options.onEvent(event, payload)
  }
}

/** Per-(workspace, connection) watcher registry used by RPC WATCH/UNWATCH. */
const watchers = new Map<string, KnowledgeChangeWatcher>()

function watcherKey(workspaceRoot: string, connectionId: string): string {
  return `${workspaceRoot}::${connectionId}`
}

export function startKnowledgeWatch(options: KnowledgeChangeWatcherOptions): KnowledgeChangeWatcher {
  const key = watcherKey(options.workspaceRoot, options.connectionId)
  const existing = watchers.get(key)
  if (existing) {
    existing.stop()
    existing.dispose()
  }
  const watcher = new KnowledgeChangeWatcher(options)
  watchers.set(key, watcher)
  watcher.start()
  return watcher
}

export function stopKnowledgeWatch(workspaceRoot: string, connectionId: string): boolean {
  const key = watcherKey(workspaceRoot, connectionId)
  const existing = watchers.get(key)
  if (!existing) return false
  existing.dispose()
  watchers.delete(key)
  return true
}

export function stopAllKnowledgeWatches(): void {
  for (const w of watchers.values()) w.dispose()
  watchers.clear()
}

export function __getKnowledgeWatchCount(): number {
  return watchers.size
}
