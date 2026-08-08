/**
 * Craft Extension Host worker (craft-sandbox).
 *
 * Runs inside Electron utilityProcess (or a test MessagePort harness).
 * - Does NOT read process.env for API keys / secrets
 * - Loads only allowlisted entry paths under sandbox roots
 * - Never special-cases SiYuan plugin paths
 * - Permission check on inbound `call` (basic: method must be a function;
 *   optional permissions list is accepted and recorded for future broker)
 */

import { pathToFileURL } from 'node:url'
import {
  assertPathAllowlisted,
  resolveSandboxRoots,
} from './path-allowlist'
import type {
  MainToWorkerMessage,
  MessagePortLike,
  WorkerToMainMessage,
} from './protocol'

interface LoadedExtension {
  extensionId: string
  entryPath: string
  module: Record<string, unknown>
}

export interface WorkerOptions {
  /** Injectable port (tests). Defaults to process.parentPort. */
  port?: MessagePortLike
  configDir?: string
  sandboxRootEnv?: string
  /** Dynamic import hook for tests. */
  importFn?: (url: string) => Promise<unknown>
}

function getParentPort(): MessagePortLike | null {
  const p = (process as NodeJS.Process & { parentPort?: MessagePortLike }).parentPort
  return p ?? null
}

function send(port: MessagePortLike, msg: WorkerToMainMessage): void {
  port.postMessage(msg)
}

function attachListener(
  port: MessagePortLike,
  handler: (data: unknown) => void,
): void {
  if (typeof port.on === 'function') {
    // Node/Electron EventEmitter / MessagePortMain style: on('message', (msg) => ...)
    port.on('message', (message: unknown) => {
      // Electron MessagePortMain wraps as { data }; plain postMessage may send raw.
      if (
        message &&
        typeof message === 'object' &&
        'data' in (message as object) &&
        Object.keys(message as object).length <= 2
      ) {
        handler((message as { data: unknown }).data)
        return
      }
      handler(message)
    })
    return
  }
  if (typeof port.addEventListener === 'function') {
    port.addEventListener('message', (event) => handler(event.data))
  }
}

function resolveCallable(
  mod: Record<string, unknown>,
  method: string,
): ((...args: unknown[]) => unknown) | null {
  const direct = mod[method]
  if (typeof direct === 'function') {
    return direct as (...args: unknown[]) => unknown
  }
  const def = mod.default
  if (def && typeof def === 'object') {
    const nested = (def as Record<string, unknown>)[method]
    if (typeof nested === 'function') {
      return nested as (...args: unknown[]) => unknown
    }
  }
  if (typeof def === 'function' && (method === 'default' || method === 'activate')) {
    return def as (...args: unknown[]) => unknown
  }
  return null
}

/**
 * Start the worker message loop. Exported for unit tests.
 */
export function startWorker(options: WorkerOptions = {}): {
  dispose: () => void
  loaded: Map<string, LoadedExtension>
} {
  const port = options.port ?? getParentPort()
  if (!port) {
    throw new Error('Extension host worker: no parentPort available')
  }

  const loaded = new Map<string, LoadedExtension>()
  const importFn =
    options.importFn ??
    ((url: string) => import(url))

  const roots = () =>
    resolveSandboxRoots({
      configDir: options.configDir ?? process.env.CRAFT_CONFIG_DIR,
      sandboxRootEnv: options.sandboxRootEnv ?? process.env.CRAFT_EXTENSION_SANDBOX_ROOT,
    })

  const onMessage = async (raw: unknown) => {
    const msg = raw as MainToWorkerMessage
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return

    try {
      switch (msg.type) {
        case 'ping': {
          send(port, { id: msg.id, type: 'pong' })
          return
        }
        case 'load': {
          const resolved = assertPathAllowlisted(msg.entryPath, roots())
          const url = pathToFileURL(resolved).href
          const mod = (await importFn(url)) as Record<string, unknown>
          loaded.set(msg.extensionId, {
            extensionId: msg.extensionId,
            entryPath: resolved,
            module: mod && typeof mod === 'object' ? mod : { default: mod },
          })
          send(port, { id: msg.id, type: 'ok' })
          return
        }
        case 'unload': {
          loaded.delete(msg.extensionId)
          send(port, { id: msg.id, type: 'ok' })
          return
        }
        case 'call': {
          // Basic permission presence check: if permissions array is provided
          // empty, reject. Missing permissions is allowed for internal ping-style
          // calls from trusted main (main is the broker). Non-function methods reject.
          if (Array.isArray(msg.permissions) && msg.permissions.length === 0) {
            send(port, {
              id: msg.id,
              type: 'error',
              error: 'Permission check failed: empty permissions',
            })
            return
          }
          const ext = loaded.get(msg.extensionId)
          if (!ext) {
            send(port, {
              id: msg.id,
              type: 'error',
              error: `Extension not loaded: ${msg.extensionId}`,
            })
            return
          }
          const fn = resolveCallable(ext.module, msg.method)
          if (!fn) {
            send(port, {
              id: msg.id,
              type: 'error',
              error: `Method not found or not a function: ${msg.method}`,
            })
            return
          }
          const args = Array.isArray(msg.args) ? msg.args : []
          const result = await Promise.resolve(fn.apply(ext.module, args))
          send(port, { id: msg.id, type: 'ok', result })
          return
        }
        default: {
          const id = (msg as { id?: string }).id
          if (id) {
            send(port, { id, type: 'error', error: 'Unknown message type' })
          }
        }
      }
    } catch (err) {
      const id = (msg as { id?: string }).id
      const error = err instanceof Error ? err.message : String(err)
      if (id) send(port, { id, type: 'error', error })
    }
  }

  attachListener(port, (data) => {
    void onMessage(data)
  })

  send(port, { type: 'ready' })

  return {
    loaded,
    dispose: () => {
      loaded.clear()
    },
  }
}

// Auto-start when executed as utilityProcess entry (not when imported by tests).
const isDirectRun =
  typeof process !== 'undefined' &&
  // utilityProcess sets parentPort; bun test imports the module without it usually.
  Boolean((process as NodeJS.Process & { parentPort?: unknown }).parentPort)

if (isDirectRun) {
  try {
    startWorker()
  } catch (err) {
    // Last resort — parent will time out on missing ready.
    const msg = err instanceof Error ? err.message : String(err)
    try {
      const port = getParentPort()
      port?.postMessage({ type: 'error', id: 'boot', error: msg })
    } catch {
      // ignore
    }
  }
}
