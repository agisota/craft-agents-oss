import { getToolchainManager } from '@craft-agent/shared/toolchain-runtime'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import type { ToolName } from '@craft-agent/shared/toolchain'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.toolchain.STATUS,
  RPC_CHANNELS.toolchain.UPDATE,
] as const

export function registerToolchainHandlers(server: RpcServer, _deps: HandlerDeps): void {
  // Snapshot of per-tool statuses (no side effects).
  server.handle(RPC_CHANNELS.toolchain.STATUS, async () => {
    return getToolchainManager().status()
  })

  // Force update of a single tool.
  server.handle(RPC_CHANNELS.toolchain.UPDATE, async (_ctx, name: ToolName) => {
    return getToolchainManager().update(name)
  })

  // Push install progress to every client (local toolchain — broadcast to all).
  getToolchainManager().onStatusChange((status) => {
    server.push(RPC_CHANNELS.toolchain.STATUS_CHANGED, { to: 'all' }, status)
  })
}
