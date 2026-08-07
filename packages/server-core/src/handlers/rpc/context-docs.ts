import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { pushTyped, type RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import {
  ensureContextDocs,
  listContextDocs,
  readContextDoc,
  writeContextDoc,
} from '@craft-agent/shared/context-docs'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.contextDocs.LIST,
  RPC_CHANNELS.contextDocs.READ,
  RPC_CHANNELS.contextDocs.WRITE,
] as const

/**
 * Runtime context documents (soul.md, rules.md, user-added *.md in
 * <CONFIG_DIR>/context/). LOCAL_ONLY — the docs live next to the local
 * config dir and are edited from the Context settings tab.
 */
export function registerContextDocsHandlers(server: RpcServer, _deps: HandlerDeps): void {
  // Seed bundled templates (resources/context/*.md) once per server boot.
  // Runs here (not only in electron main) so headless servers get the same
  // seeding; existing user files are never overwritten by the seed.
  try {
    ensureContextDocs()
  } catch (error) {
    console.error('[context-docs] Seeding failed:', error)
  }

  // List all context documents with version/stale metadata
  server.handle(RPC_CHANNELS.contextDocs.LIST, async () => {
    return listContextDocs()
  })

  // Read one document's full content (filename validated against traversal)
  server.handle(RPC_CHANNELS.contextDocs.READ, async (_ctx, filename: string) => {
    return readContextDoc(filename)
  })

  // Write (create or replace) a document, then notify all clients.
  // External edits reach clients via ConfigWatcher → contextDocs.CHANGED;
  // this direct push covers the write-through-RPC path (labels.CREATE pattern).
  server.handle(RPC_CHANNELS.contextDocs.WRITE, async (_ctx, filename: string, content: string) => {
    const info = writeContextDoc(filename, content)
    pushTyped(server, RPC_CHANNELS.contextDocs.CHANGED, { to: 'all' })
    return info
  })
}
