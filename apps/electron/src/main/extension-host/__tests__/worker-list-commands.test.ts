/**
 * extension-host list-commands: worker exposes exported `commands` to main.
 */
import { describe, expect, it } from 'bun:test'
import { EventEmitter } from 'node:events'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startWorker } from '../worker'
import type { MessagePortLike } from '../protocol'

/** Await a worker reply by id — dynamic import needs real event-loop turns. */
async function awaitReply(
  posted: Msg[],
  id: string,
  type: 'ok' | 'error',
  maxTurns = 200,
): Promise<Msg | undefined> {
  for (let i = 0; i < maxTurns; i++) {
    const hit = posted.find((m) => m.id === id && m.type === type)
    if (hit) return hit
    await new Promise((r) => setImmediate(r))
  }
  return undefined
}

interface Msg {
  id?: string
  type?: string
  result?: unknown
  error?: string
}

class MainPort extends EventEmitter {
  posted: Msg[] = []
  postMessage(message: unknown): void {
    this.posted.push(message as Msg)
  }
}

/** Bridge between worker port and an event emitter the test writes into. */
function wireWorker(opts: { configDir: string }) {
  const toWorker = new EventEmitter() // main -> worker
  const posted = new MainPort() // worker posts replies here

  const workerPort = {
    postMessage(msg: unknown) {
      posted.posted.push(msg as Msg)
    },
    on(_event: string, listener: (msg: unknown) => void) {
      if (_event === 'message') toWorker.on('message', listener)
    },
  }

  startWorker({
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test seam for internal port contract
    port: workerPort as unknown as MessagePortLike,
    configDir: opts.configDir,
    importFn: async (url: string) => import(url),
  })

  return {
    posted,
    send(msg: unknown) {
      toWorker.emit('message', msg)
    },
  }
}

function makeExtensionFixture(base: string, code: string[]): { entry: string } {
  const sandbox = join(base, 'extensions', 'sandbox', 'demo')
  mkdirSync(sandbox, { recursive: true })
  const entry = join(sandbox, 'index.mjs')
  writeFileSync(entry, code.join('\n') + '\n')
  return { entry }
}

describe('worker list-commands', () => {
  it('returns commands exported by loaded module; rejects unknown extensions', async () => {
    const base = mkdtempSync(join(tmpdir(), 'eh-lc-'))
    try {
      const { entry } = makeExtensionFixture(base, [
        'export const commands = [',
        '  { id: "demo.hello", title: "Hello" },',
        '  { id: "demo.world", title: "World", when: "chatFocus", keywords: ["hi"] },',
        ']',
        'export function hello() { return 1 }',
      ])
      const { posted, send } = wireWorker({ configDir: base })

      // readiness signaled
      expect(posted.posted.some((m) => m.type === 'ready')).toBe(true)

      send({ id: 'load-1', type: 'load', extensionId: 'demo', entryPath: entry })
      const loadOk = await awaitReply(posted.posted, 'load-1', 'ok')
      expect(loadOk?.type).toBe('ok')

      send({ id: 'lc-1', type: 'list-commands', extensionId: 'demo' })
      const ok = await awaitReply(posted.posted, 'lc-1', 'ok')
      expect(ok).toBeTruthy()
      const result = (ok as {
        result: {
          commands: Array<{
            id: string
            title: string
            when?: string
            keywords?: string[]
          }>
        }
      }).result
      expect(result.commands.length).toBe(2)
      expect(result.commands[0]).toEqual({ id: 'demo.hello', title: 'Hello' })
      expect(result.commands[1]?.when).toBe('chatFocus')
      expect(result.commands[1]?.keywords).toEqual(['hi'])

      send({ id: 'lc-2', type: 'list-commands', extensionId: 'unknown' })
      const err = await awaitReply(posted.posted, 'lc-2', 'error')
      expect(err?.type).toBe('error')
      expect((err as { error?: string })?.error).toMatch(/not loaded/i)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  })

  it('extension without commands export returns empty list', async () => {
    const base = mkdtempSync(join(tmpdir(), 'eh-lc-'))
    try {
      const { entry } = makeExtensionFixture(base, ['export function hello() { return 1 }'])
      const { posted, send } = wireWorker({ configDir: base })

      send({ id: 'load-1', type: 'load', extensionId: 'demo', entryPath: entry })
      await awaitReply(posted.posted, 'load-1', 'ok')

      send({ id: 'lc-3', type: 'list-commands', extensionId: 'demo' })
      const ok = await awaitReply(posted.posted, 'lc-3', 'ok', 200)
      expect(ok).toBeTruthy()
      expect((ok as { result: { commands: unknown[] } }).result.commands.length).toBe(0)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  })
})
