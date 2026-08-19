import { describe, expect, it, mock } from 'bun:test'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'

const previewFn = mock(async () => ({
  ready: 1,
  alreadyEnvelope: 1,
  skipped: 0,
  invalid: 1,
  entries: [{ id: { type: 'llm_api_key', connectionSlug: 'secret-id' }, status: 'ready' }],
}))

const applyFn = mock(async () => ({
  ready: 1,
  alreadyEnvelope: 0,
  skipped: 0,
  invalid: 0,
  applied: 1,
  migrationId: 'credential-migration-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  state: 'applied' as const,
  snapshot: {
    migrationId: 'credential-migration-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    createdAt: 1,
    sourceChecksum: 'private-checksum',
    path: '/secret/credentials.bin',
  },
}))

const statusFn = mock(async () => ({
  migrationId: 'credential-migration-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  state: 'applied' as const,
  createdAt: 1,
  appliedAt: 2,
  rolledBackAt: null,
  ready: 1,
  alreadyEnvelope: 0,
  skipped: 0,
  invalid: 0,
  rollbackAvailable: true,
  sourceChecksum: 'private-checksum',
}))

const rollbackFn = mock(async (migrationId: string) => ({
  migrationId,
  state: 'rolled_back' as const,
  rollbackAvailable: false as const,
  ready: 1,
  alreadyEnvelope: 0,
  skipped: 0,
  invalid: 0,
}))

mock.module('@craft-agent/shared/credentials', () => ({
  getCredentialManager: () => ({
    checkHealth: async () => ({ healthy: true, issues: [] }),
    list: async () => [],
    delete: async () => true,
  }),
  previewCredentialMigration: previewFn,
  applyCredentialMigration: applyFn,
  getCredentialMigrationStatus: statusFn,
  rollbackCredentialMigration: rollbackFn,
}))

const {
  HANDLED_CHANNELS,
  isCredentialMigrationId,
  registerAuthHandlers,
} = await import('../auth')

type Handler = (ctx: unknown, ...args: unknown[]) => unknown | Promise<unknown>

function createMockServer() {
  const handlers = new Map<string, Handler>()
  return {
    handlers,
    handle(channel: string, fn: Handler) {
      handlers.set(channel, fn)
    },
    push() {},
    invokeClient: async () => ({}),
    hasClientCapability: () => false,
    findClientsWithCapability: () => [],
  }
}

const SECRET_NEEDLES = [
  'private-checksum',
  '/secret/credentials.bin',
  'secret-id',
  'sourceChecksum',
  'snapshot',
  'entries',
  'fingerprint',
]

function assertSecretFree(value: unknown) {
  const serialized = JSON.stringify(value)
  for (const needle of SECRET_NEEDLES) {
    expect(serialized).not.toContain(needle)
  }
}

describe('credential migration RPC handlers', () => {
  it('registers the four migration channels', () => {
    const server = createMockServer()
    registerAuthHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)

    expect(HANDLED_CHANNELS).toContain(RPC_CHANNELS.credentials.PREVIEW_MIGRATION)
    expect(HANDLED_CHANNELS).toContain(RPC_CHANNELS.credentials.APPLY_MIGRATION)
    expect(HANDLED_CHANNELS).toContain(RPC_CHANNELS.credentials.GET_MIGRATION_STATUS)
    expect(HANDLED_CHANNELS).toContain(RPC_CHANNELS.credentials.ROLLBACK_MIGRATION)

    for (const channel of HANDLED_CHANNELS) {
      expect(server.handlers.has(channel)).toBe(true)
    }
  })

  it('returns only aggregate secret-free shapes', async () => {
    const server = createMockServer()
    registerAuthHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)

    const preview = await server.handlers.get(RPC_CHANNELS.credentials.PREVIEW_MIGRATION)!({})
    const applied = await server.handlers.get(RPC_CHANNELS.credentials.APPLY_MIGRATION)!({})
    const status = await server.handlers.get(RPC_CHANNELS.credentials.GET_MIGRATION_STATUS)!({})

    expect(preview).toEqual({
      ok: true,
      data: { ready: 1, alreadyEnvelope: 1, skipped: 0, invalid: 1 },
    })
    expect(applied).toEqual({
      ok: true,
      data: {
        ready: 1,
        alreadyEnvelope: 0,
        skipped: 0,
        invalid: 0,
        migrationId: 'credential-migration-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        applied: 1,
        status: 'applied',
      },
    })
    expect(status).toMatchObject({
      ok: true,
      data: {
        migrationId: 'credential-migration-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        state: 'applied',
        rollbackAvailable: true,
      },
    })
    assertSecretFree(preview)
    assertSecretFree(applied)
    assertSecretFree(status)
  })

  it('rejects malformed rollback IDs before invoking core', async () => {
    rollbackFn.mockClear()
    const server = createMockServer()
    registerAuthHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const rollback = server.handlers.get(RPC_CHANNELS.credentials.ROLLBACK_MIGRATION)!

    const malformed = [
      '',
      'not-an-id',
      '../etc/passwd',
      'credential-migration-nope',
      { migrationId: 'credential-migration-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
      12,
    ]

    for (const value of malformed) {
      expect(isCredentialMigrationId(value)).toBe(false)
      const result = await rollback({}, value)
      expect(result).toEqual({ ok: false, code: 'rollback_unavailable' })
      assertSecretFree(result)
    }

    expect(rollbackFn).not.toHaveBeenCalled()
  })

  it('invokes core rollback only after the opaque ID validates', async () => {
    rollbackFn.mockClear()
    const server = createMockServer()
    registerAuthHandlers(server as never, {
      platform: { logger: { info() {}, error() {}, warn() {}, debug() {} } },
    } as never)
    const id = 'credential-migration-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const result = await server.handlers.get(RPC_CHANNELS.credentials.ROLLBACK_MIGRATION)!({}, id)
    expect(rollbackFn).toHaveBeenCalledTimes(1)
    expect(rollbackFn.mock.calls[0]?.[0]).toBe(id)
    expect(result).toMatchObject({
      ok: true,
      data: { migrationId: id, state: 'rolled_back', rollbackAvailable: false },
    })
    assertSecretFree(result)
  })
})
