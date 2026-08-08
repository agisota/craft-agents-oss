import { describe, expect, it } from 'bun:test'
import { RPC_CHANNELS, type Session } from '@craft-agent/shared/protocol'
import type { BulkUpdateSessionsInput, BulkUpdateSessionsResult } from '@craft-agent/shared/protocol/dto'
import type { HandlerDeps } from '../handler-deps'
import { registerSessionsHandlers } from './sessions'
import type { HandlerFn, RequestContext, RpcServer } from '../../transport'

type PushedEvent = { channel: string; target: unknown; args: unknown[] }

function createHarness(sessions: Session[]) {
  const byId = new Map(sessions.map((session) => [session.id, session]))
  const handlers = new Map<string, HandlerFn>()
  const pushed: PushedEvent[] = []

  const server: RpcServer = {
    handle(channel, handler) {
      handlers.set(channel, handler)
    },
    push(channel, target, ...args) {
      pushed.push({ channel, target, args })
    },
    async invokeClient() {},
    hasClientCapability() {
      return false
    },
    findClientsWithCapability() {
      return []
    },
  }

  const sessionManager = {
    async getSession(id: string) {
      return byId.get(id)
    },
    async setSessionLabels(id: string, labels: string[]) {
      const session = byId.get(id)
      if (!session) throw new Error('not_found')
      session.labels = labels
    },
  }

  registerSessionsHandlers(
    server,
    {
      sessionManager,
      platform: { logger: { error() {}, warn() {}, info() {}, debug() {} } },
    } as unknown as HandlerDeps,
  )

  return {
    byId,
    pushed,
    async bulk(input: BulkUpdateSessionsInput): Promise<BulkUpdateSessionsResult> {
      const handler = handlers.get(RPC_CHANNELS.sessions.BULK_UPDATE)
      if (!handler) throw new Error('bulk handler was not registered')
      return handler({} as RequestContext, input) as Promise<BulkUpdateSessionsResult>
    },
  }
}

function session(id: string, labels: string[]): Session {
  return {
    id,
    workspaceId: 'workspace-1',
    isProcessing: false,
    labels,
  } as Session
}

describe('sessions:bulkUpdate label deltas', () => {
  it('resolves add/remove deltas from every target and emits one coalesced event', async () => {
    const harness = createHarness([
      session('a', ['keep', 'remove']),
      session('b', ['target-only']),
    ])

    const result = await harness.bulk({
      workspaceId: 'workspace-1',
      ids: ['a', 'b'],
      patch: { addLabels: ['added', 'keep'], removeLabels: ['remove'] },
    })

    expect(result).toEqual({ ok: ['a', 'b'], failed: [] })
    expect(harness.byId.get('a')?.labels).toEqual(['keep', 'added'])
    expect(harness.byId.get('b')?.labels).toEqual(['target-only', 'added', 'keep'])
    expect(harness.pushed).toEqual([
      {
        channel: RPC_CHANNELS.sessions.BULK_CHANGED,
        target: { to: 'workspace', workspaceId: 'workspace-1' },
        args: [
          {
            workspaceId: 'workspace-1',
            ids: ['a', 'b'],
            patch: { addLabels: ['added', 'keep'], removeLabels: ['remove'] },
          },
        ],
      },
    ])
  })

  it('rejects replacement plus delta before mutating any target', async () => {
    const harness = createHarness([session('a', ['keep'])])

    await expect(
      harness.bulk({
        workspaceId: 'workspace-1',
        ids: ['a'],
        patch: { labels: ['replace'], addLabels: ['added'] },
      }),
    ).rejects.toThrow('bulk_labels_conflict')

    expect(harness.byId.get('a')?.labels).toEqual(['keep'])
    expect(harness.pushed).toEqual([])
  })
})
