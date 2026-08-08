/**
 * Extension Host RPC handlers (W6).
 *
 * LOCAL_ONLY lifecycle STATUS/RESTART over ExtensionHostManager.
 * Does not execute SiYuan plugins.
 */

import { RPC_CHANNELS } from '../../shared/types'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from './handler-deps'
import { getExtensionHostManager } from '../extension-host-manager'
import type { ExtensionHostStatus } from '@craft-agent/shared/extensions'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.extensionHost.STATUS,
  RPC_CHANNELS.extensionHost.RESTART,
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
    RPC_CHANNELS.extensionHost.RESTART,
    async (): Promise<ExtensionHostStatus> => {
      return getExtensionHostManager().restart()
    },
  )
}
