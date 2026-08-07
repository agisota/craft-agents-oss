import type { HandlerDeps } from './handler-deps'
import type { RpcServer } from '@craft-agent/server-core/transport'
import { registerCoreRpcHandlers, type ServerHandlerContext } from '@craft-agent/server-core/handlers/rpc'
export { registerCoreRpcHandlers }

// GUI-only handlers remain local (Electron-specific imports)
import { registerSystemGuiHandlers } from './system'
import { registerWorkspaceGuiHandlers } from './workspace'
import { registerBrowserHandlers } from './browser'
import { registerSettingsGuiHandlers } from './settings'
import { registerSiyuanHandlers } from './siyuan'

export function registerGuiRpcHandlers(server: RpcServer, deps: HandlerDeps): void {
  registerSystemGuiHandlers(server, deps)
  registerWorkspaceGuiHandlers(server, deps)
  registerBrowserHandlers(server, deps)
  registerSettingsGuiHandlers(server, deps)
  registerSiyuanHandlers(server, deps)
}

export function registerAllRpcHandlers(server: RpcServer, deps: HandlerDeps, serverCtx?: ServerHandlerContext): void {
  // GUI registers its own browser-pane handlers (see ./browser) — they are a
  // superset of the core ones plus window-stamping and the empty-state LAUNCH
  // channel. Registering both copies makes the RpcServer throw on duplicate
  // channels and the app fails to boot.
  registerCoreRpcHandlers(server, deps, serverCtx, { browserPane: false })
  registerGuiRpcHandlers(server, deps)
}
