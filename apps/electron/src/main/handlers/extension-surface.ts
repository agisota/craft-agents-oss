/**
 * Extension UI surface handlers (S-05 sandboxed BrowserView).
 *
 * Thin registry over BrowserPaneManager: embedded extension panels are keyed by
 * a durable view key (`ext:${extensionId}:${viewId}`), so re-opening the same
 * view dedupifies onto the existing surface. Each extension gets an isolated
 * session partition `persist:ext-${extensionId}` (sandbox + contextIsolation).
 *
 * Delegation shape mirrors handlers/siyuan.ts 1:1 (create-embedded /
 * sync-bounds / destroy / list / focus forwards, broadcastToAll push
 * semantics). All channels are LOCAL_ONLY (routing.ts).
 *
 * REMOVED is broadcast from DESTROY itself, not from a BrowserPaneManager
 * onRemoved subscription: browser-pane-manager exposes onRemoved as a
 * single-slot setter, and stealing the slot here would clobber the browser
 * domain's own REMOVED broadcast.
 */

import { RPC_CHANNELS, type ExtensionSurfaceState } from '../../shared/types'
import type { EmbeddedBoundsRect } from '../browser-pane-manager'
import { pushTyped, type RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from './handler-deps'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.extensionSurface.CREATE_EMBEDDED,
  RPC_CHANNELS.extensionSurface.DESTROY,
  RPC_CHANNELS.extensionSurface.LIST,
  RPC_CHANNELS.extensionSurface.SYNC_BOUNDS,
  RPC_CHANNELS.extensionSurface.FOCUS,
] as const

/** Registry record: wire state plus the last bounds reported by the renderer. */
interface ExtensionSurfaceRecord extends ExtensionSurfaceState {
  rect: EmbeddedBoundsRect | null
  /**
   * Holder refcount: every createEmbedded call — including a dedup re-open onto
   * an existing surface — takes one owner slot; DESTROY releases one slot. The
   * native BrowserView is torn down only when the LAST owner releases.
   */
  owners: number
}

/**
 * In-memory durableKey → surface registry. Process-local: BrowserViews die with
 * the app; renderers re-issue createEmbedded on restore (LIST exposes live state).
 */
export class ExtensionSurfaceManager {
  private readonly byDurableKey = new Map<string, ExtensionSurfaceRecord>()

  get(durableKey: string): ExtensionSurfaceRecord | undefined {
    return this.byDurableKey.get(durableKey)
  }

  getByInstanceId(instanceId: string): ExtensionSurfaceRecord | undefined {
    for (const record of this.byDurableKey.values()) {
      if (record.instanceId === instanceId) return record
    }
    return undefined
  }

  register(record: ExtensionSurfaceRecord): void {
    this.byDurableKey.set(record.durableKey, record)
  }

  remove(instanceId: string): ExtensionSurfaceRecord | undefined {
    for (const [durableKey, record] of this.byDurableKey) {
      if (record.instanceId === instanceId) {
        this.byDurableKey.delete(durableKey)
        return record
      }
    }
    return undefined
  }

  setBounds(instanceId: string, rect: EmbeddedBoundsRect | null): ExtensionSurfaceRecord | undefined {
    for (const record of this.byDurableKey.values()) {
      if (record.instanceId === instanceId) {
        record.rect = rect
        return record
      }
    }
    return undefined
  }

  /**
   * Wire-state list, optionally workspace-scoped. Surfaces bound to no
   * workspace (`null`) pass every filter — same convention as SiyuanSurfaceManager.
   */
  list(workspaceId?: string | null): ExtensionSurfaceState[] {
    const states: ExtensionSurfaceState[] = []
    for (const record of this.byDurableKey.values()) {
      if (workspaceId == null || record.workspaceId == null || record.workspaceId === workspaceId) {
        states.push(toState(record))
      }
    }
    return states
  }
}

function toState(record: ExtensionSurfaceRecord): ExtensionSurfaceState {
  return {
    instanceId: record.instanceId,
    durableKey: record.durableKey,
    extensionId: record.extensionId,
    viewId: record.viewId,
    url: record.url,
    workspaceId: record.workspaceId,
  }
}

export function buildExtensionDurableKey(extensionId: string, viewId: string): string {
  return `ext:${extensionId}:${viewId}`
}

export function extensionPartition(extensionId: string): string {
  return `persist:ext-${extensionId}`
}

export interface ExtensionCreateEmbeddedInput {
  durableKey?: string
  url: string
  extensionId: string
  viewId: string
  workspaceId?: string | null
}

export interface ExtensionInstanceInput {
  instanceId: string
}

export interface ExtensionListInput {
  workspaceId?: string | null
}

export interface ExtensionSyncBoundsInput extends ExtensionInstanceInput {
  rect: EmbeddedBoundsRect | null
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`)
  }
  return value.trim()
}

export function registerExtensionSurfaceHandlers(server: RpcServer, deps: HandlerDeps): void {
  const { browserPaneManager } = deps
  if (!browserPaneManager) return

  const surfaces = new ExtensionSurfaceManager()

  server.handle(
    RPC_CHANNELS.extensionSurface.CREATE_EMBEDDED,
    (_ctx, input: ExtensionCreateEmbeddedInput): string => {
      const extensionId = requireNonEmptyString(input?.extensionId, 'extensionId')
      const viewId = requireNonEmptyString(input?.viewId, 'viewId')
      const url = typeof input?.url === 'string' ? input.url : 'about:blank'
      const durableKey =
        typeof input?.durableKey === 'string' && input.durableKey.trim().length > 0
          ? input.durableKey.trim()
          : buildExtensionDurableKey(extensionId, viewId)

      const existing = surfaces.get(durableKey)
      if (existing) {
        existing.owners += 1
        if (input.workspaceId !== undefined) {
          existing.workspaceId = input.workspaceId ?? null
        }
        browserPaneManager.focus(existing.instanceId)
        pushTyped(server, RPC_CHANNELS.extensionSurface.STATE_CHANGED, { to: 'all' }, toState(existing))
        return existing.instanceId
      }

      const instanceId = browserPaneManager.createEmbeddedInstance({
        url,
        workspaceId: input.workspaceId ?? null,
        partition: extensionPartition(extensionId),
      })
      const record: ExtensionSurfaceRecord = {
        instanceId,
        durableKey,
        extensionId,
        viewId,
        url,
        workspaceId: input.workspaceId ?? null,
        rect: null,
        owners: 1,
      }
      surfaces.register(record)
      pushTyped(server, RPC_CHANNELS.extensionSurface.STATE_CHANGED, { to: 'all' }, toState(record))
      return instanceId
    },
  )

  server.handle(RPC_CHANNELS.extensionSurface.DESTROY, (_ctx, input: ExtensionInstanceInput) => {
    const record = surfaces.getByInstanceId(input.instanceId)
    if (record && record.owners > 1) {
      record.owners -= 1
      return
    }
    browserPaneManager.destroyInstance(input.instanceId)
    const removed = surfaces.remove(input.instanceId)
    if (removed) {
      pushTyped(server, RPC_CHANNELS.extensionSurface.REMOVED, { to: 'all' }, removed.instanceId)
    }
  })

  server.handle(RPC_CHANNELS.extensionSurface.LIST, (_ctx, input?: ExtensionListInput) => {
    return surfaces.list(input?.workspaceId)
  })

  server.handle(RPC_CHANNELS.extensionSurface.SYNC_BOUNDS, (_ctx, input: ExtensionSyncBoundsInput) => {
    browserPaneManager.syncEmbeddedBounds(input.instanceId, input.rect)
    surfaces.setBounds(input.instanceId, input.rect)
  })

  server.handle(RPC_CHANNELS.extensionSurface.FOCUS, (_ctx, input: ExtensionInstanceInput) => {
    browserPaneManager.focus(input.instanceId)
  })
}
