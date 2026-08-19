import { describe, expect, it } from 'bun:test'
import { RPC_CHANNELS } from '../../shared/types'
import { CHANNEL_MAP } from '../channel-map'

describe('credential migration transport mapping', () => {
  it('maps the four typed Electron methods to credentials channels', () => {
    expect(CHANNEL_MAP.previewCredentialMigration).toEqual({
      type: 'invoke',
      channel: RPC_CHANNELS.credentials.PREVIEW_MIGRATION,
    })
    expect(CHANNEL_MAP.applyCredentialMigration).toEqual({
      type: 'invoke',
      channel: RPC_CHANNELS.credentials.APPLY_MIGRATION,
    })
    expect(CHANNEL_MAP.getCredentialMigrationStatus).toEqual({
      type: 'invoke',
      channel: RPC_CHANNELS.credentials.GET_MIGRATION_STATUS,
    })
    expect(CHANNEL_MAP.rollbackCredentialMigration).toEqual({
      type: 'invoke',
      channel: RPC_CHANNELS.credentials.ROLLBACK_MIGRATION,
    })
  })

  it('does not attach transforms that could leak snapshots', () => {
    for (const method of ['previewCredentialMigration', 'applyCredentialMigration', 'getCredentialMigrationStatus', 'rollbackCredentialMigration'] as const) {
      expect('transform' in CHANNEL_MAP[method]).toBe(false)
    }
  })
})
