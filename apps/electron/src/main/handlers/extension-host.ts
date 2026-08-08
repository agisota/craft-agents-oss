/**
 * Extension Host RPC handlers (S-05 §3.5 / W6 + capability broker).
 *
 * LOCAL_ONLY lifecycle + craft-sandbox load/call over ExtensionHostManager.
 * Capability mint/revoke/proxyFetch never return raw secrets to callers.
 * Does not execute SiYuan plugins (executesSiyuanPlugins always false).
 */

import { RPC_CHANNELS } from '../../shared/types'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from './handler-deps'
import { getExtensionHostManager } from '../extension-host-manager'
import type { ExtensionHostStatus } from '@craft-agent/shared/extensions'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.extensionHost.STATUS,
  RPC_CHANNELS.extensionHost.START,
  RPC_CHANNELS.extensionHost.STOP,
  RPC_CHANNELS.extensionHost.RESTART,
  RPC_CHANNELS.extensionHost.LOAD,
  RPC_CHANNELS.extensionHost.CALL,
  RPC_CHANNELS.extensionHost.MINT_CAPABILITY,
  RPC_CHANNELS.extensionHost.REVOKE_CAPABILITY,
  RPC_CHANNELS.extensionHost.PROXY_FETCH,
] as const

export function registerExtensionHostHandlers(
  server: RpcServer,
  _deps: HandlerDeps,
): void {
  server.handle(
    RPC_CHANNELS.extensionHost.STATUS,
    async (): Promise<ExtensionHostStatus> => {
      return getExtensionHostManager().getStatus()
    },
  )

  server.handle(
    RPC_CHANNELS.extensionHost.START,
    async (): Promise<ExtensionHostStatus> => {
      return getExtensionHostManager().start()
    },
  )

  server.handle(
    RPC_CHANNELS.extensionHost.STOP,
    async (): Promise<ExtensionHostStatus> => {
      return getExtensionHostManager().stop()
    },
  )

  server.handle(
    RPC_CHANNELS.extensionHost.RESTART,
    async (): Promise<ExtensionHostStatus> => {
      return getExtensionHostManager().restart()
    },
  )

  server.handle(
    RPC_CHANNELS.extensionHost.LOAD,
    async (
      _ctx,
      args: {
        extensionId: string
        entryPath: string
        grantedPermissions?: string[]
      },
    ): Promise<{ ok: true }> => {
      if (!args || typeof args.extensionId !== 'string' || typeof args.entryPath !== 'string') {
        throw new Error('extensionHost.load requires { extensionId, entryPath }')
      }
      await getExtensionHostManager().loadExtension(
        args.extensionId,
        args.entryPath,
        args.grantedPermissions,
      )
      return { ok: true }
    },
  )

  server.handle(
    RPC_CHANNELS.extensionHost.CALL,
    async (
      _ctx,
      args: {
        extensionId: string
        method: string
        args?: unknown[]
        permissions?: string[]
      },
    ): Promise<unknown> => {
      if (!args || typeof args.extensionId !== 'string' || typeof args.method !== 'string') {
        throw new Error('extensionHost.call requires { extensionId, method }')
      }
      return getExtensionHostManager().callExtension(
        args.extensionId,
        args.method,
        args.args,
        args.permissions,
      )
    },
  )

  server.handle(
    RPC_CHANNELS.extensionHost.MINT_CAPABILITY,
    async (
      _ctx,
      args: {
        extensionId: string
        permission: string
        ttlMs?: number
        singleUse?: boolean
      },
    ): Promise<{ token: string; expiresAt: number; permission: string }> => {
      if (
        !args ||
        typeof args.extensionId !== 'string' ||
        typeof args.permission !== 'string'
      ) {
        throw new Error(
          'extensionHost.mintCapability requires { extensionId, permission }',
        )
      }
      // Never trust renderer-supplied grantedPermissions — loadExtension only.
      return getExtensionHostManager().mintCapability({
        extensionId: args.extensionId,
        permission: args.permission,
        ttlMs: args.ttlMs,
        singleUse: args.singleUse,
      })
    },
  )

  server.handle(
    RPC_CHANNELS.extensionHost.REVOKE_CAPABILITY,
    async (
      _ctx,
      args: { token?: string; extensionId?: string },
    ): Promise<{ ok: true }> => {
      if (!args || (typeof args.token !== 'string' && typeof args.extensionId !== 'string')) {
        throw new Error(
          'extensionHost.revokeCapability requires { token } or { extensionId }',
        )
      }
      const mgr = getExtensionHostManager()
      if (typeof args.token === 'string') mgr.revokeCapability(args.token)
      if (typeof args.extensionId === 'string') {
        mgr.revokeExtensionCapabilities(args.extensionId)
      }
      return { ok: true }
    },
  )

  server.handle(
    RPC_CHANNELS.extensionHost.PROXY_FETCH,
    async (
      _ctx,
      args: {
        token: string
        url: string
        method?: string
        headers?: Record<string, string>
        body?: string
        allowedUrlPrefixes?: string[]
      },
    ): Promise<{ status: number; body: string; headers: Record<string, string> }> => {
      if (!args || typeof args.token !== 'string' || typeof args.url !== 'string') {
        throw new Error('extensionHost.proxyFetch requires { token, url }')
      }
      return getExtensionHostManager().proxyFetch({
        token: args.token,
        url: args.url,
        method: args.method,
        headers: args.headers,
        body: args.body,
        allowedUrlPrefixes: args.allowedUrlPrefixes,
      })
    },
  )
}
