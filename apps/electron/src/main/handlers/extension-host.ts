/**
 * Extension Host RPC handlers (S-05 §3.5 / W6).
 *
 * LOCAL_ONLY lifecycle + craft-sandbox load/call over ExtensionHostManager.
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
      args: { extensionId: string; entryPath: string },
    ): Promise<{ ok: true }> => {
      if (!args || typeof args.extensionId !== 'string' || typeof args.entryPath !== 'string') {
        throw new Error('extensionHost.load requires { extensionId, entryPath }')
      }
      await getExtensionHostManager().loadExtension(args.extensionId, args.entryPath)
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
}
