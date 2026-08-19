import { unlink } from 'fs/promises'
import { join } from 'path'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import type {
  CredentialMigrationApplyDto,
  CredentialMigrationErrorCode,
  CredentialMigrationPreviewDto,
  CredentialMigrationResult,
  CredentialMigrationRollbackDto,
  CredentialMigrationStatusDto,
} from '@craft-agent/shared/protocol'
import {
  applyCredentialMigration,
  getCredentialManager,
  getCredentialMigrationStatus,
  previewCredentialMigration,
  rollbackCredentialMigration,
} from '@craft-agent/shared/credentials'
import { CONFIG_DIR } from '@craft-agent/shared/config/paths'
import { getIdentityStore, resetIdentityStoreCache } from '@craft-agent/core/platform/identity/store'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { requestClientConfirmDialog } from '@craft-agent/server-core/transport'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.auth.LOGOUT,
  RPC_CHANNELS.auth.SHOW_LOGOUT_CONFIRMATION,
  RPC_CHANNELS.auth.SHOW_DELETE_SESSION_CONFIRMATION,
  RPC_CHANNELS.auth.SHOW_DELETE_WORKSPACE_CONFIRMATION,
  RPC_CHANNELS.credentials.HEALTH_CHECK,
  RPC_CHANNELS.credentials.PREVIEW_MIGRATION,
  RPC_CHANNELS.credentials.APPLY_MIGRATION,
  RPC_CHANNELS.credentials.GET_MIGRATION_STATUS,
  RPC_CHANNELS.credentials.ROLLBACK_MIGRATION,
] as const

/** Opaque IDs minted by the credential backend (`credential-migration-` + UUID). */
export const CREDENTIAL_MIGRATION_ID_PATTERN = /^credential-migration-[0-9a-f-]{36}$/i

function fail(code: CredentialMigrationErrorCode): CredentialMigrationResult<never> {
  return { ok: false, code }
}

function ok<T>(data: T): CredentialMigrationResult<T> {
  return { ok: true, data }
}

export function isCredentialMigrationId(value: unknown): value is string {
  return typeof value === 'string' && CREDENTIAL_MIGRATION_ID_PATTERN.test(value)
}

function publicCounts(value: {
  ready: number
  alreadyEnvelope: number
  skipped: number
  invalid: number
}): CredentialMigrationPreviewDto {
  return {
    ready: value.ready,
    alreadyEnvelope: value.alreadyEnvelope,
    skipped: value.skipped,
    invalid: value.invalid,
  }
}

function mapMigrationError(error: unknown, kind: 'preview' | 'apply' | 'status' | 'rollback'): CredentialMigrationErrorCode {
  const text = error instanceof Error ? error.message.toLowerCase() : ''
  if (text.includes('unavailable')) return 'unavailable'
  if (text.includes('source changed')) {
    return kind === 'rollback' ? 'rollback_stale' : 'stale_source'
  }
  if (
    text.includes('snapshot is invalid')
    || text.includes('snapshot is unavailable')
    || text.includes('rollback is unavailable')
  ) {
    return 'rollback_unavailable'
  }
  if (text.includes('not_ready') || text.includes('no valid legacy')) return 'not_ready'
  return 'operation_failed'
}

function emptyStatus(): CredentialMigrationStatusDto {
  return {
    ready: 0,
    alreadyEnvelope: 0,
    skipped: 0,
    invalid: 0,
    migrationId: null,
    state: 'none',
    rollbackAvailable: false,
  }
}

export function registerAuthHandlers(server: RpcServer, deps: HandlerDeps): void {
  // Show logout confirmation dialog (routed to client)
  server.handle(RPC_CHANNELS.auth.SHOW_LOGOUT_CONFIRMATION, async (ctx) => {
    const result = await requestClientConfirmDialog(server, ctx.clientId, {
      type: 'warning',
      buttons: ['Cancel', 'Log Out'],
      defaultId: 0,
      cancelId: 0,
      title: 'Log Out',
      message: 'Are you sure you want to log out?',
      detail: 'All conversations will be deleted. This action cannot be undone.',
    })
    // result.response is the index of the clicked button
    // 0 = Cancel, 1 = Log Out
    return result.response === 1
  })

  // Show delete session confirmation dialog (routed to client)
  server.handle(RPC_CHANNELS.auth.SHOW_DELETE_SESSION_CONFIRMATION, async (ctx, name: string) => {
    const result = await requestClientConfirmDialog(server, ctx.clientId, {
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
      title: 'Delete Conversation',
      message: `Are you sure you want to delete: "${name}"?`,
      detail: 'This action cannot be undone.',
    })
    // result.response is the index of the clicked button
    // 0 = Cancel, 1 = Delete
    return result.response === 1
  })

  // Show delete workspace confirmation dialog (routed to client)
  server.handle(RPC_CHANNELS.auth.SHOW_DELETE_WORKSPACE_CONFIRMATION, async (ctx, name: string) => {
    const result = await requestClientConfirmDialog(server, ctx.clientId, {
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
      title: 'Delete Workspace',
      message: `Are you sure you want to delete the workspace "${name}"?`,
      detail: 'This action cannot be undone.',
    })
    // result.response is the index of the clicked button
    // 0 = Cancel, 1 = Delete
    return result.response === 1
  })

  // Logout - clear all credentials, identity, and config
  server.handle(RPC_CHANNELS.auth.LOGOUT, async () => {
    try {
      const manager = getCredentialManager()

      // List and delete all stored credentials
      const allCredentials = await manager.list()
      for (const credId of allCredentials) {
        await manager.delete(credId)
      }

      // Clear Identity Center state (connections/entitlements + local profile shell)
      try {
        const identityDir = process.env.CRAFT_CONFIG_DIR || CONFIG_DIR
        getIdentityStore(identityDir).clear()
        resetIdentityStoreCache()
      } catch (identityError) {
        deps.platform.logger.warn('Logout: failed to clear identity store', identityError)
      }

      // Delete the config file
      const configPath = join(CONFIG_DIR, 'config.json')
      await unlink(configPath).catch(() => {
        // Ignore if file doesn't exist
      })

      deps.platform.logger.info('Logout complete - cleared credentials, identity, and config')
    } catch (error) {
      deps.platform.logger.error('Logout error:', error)
      throw error
    }
  })

  // Credential health check - validates credential store is readable and usable
  // Called on app startup to detect corruption, machine migration, or missing credentials
  server.handle(RPC_CHANNELS.credentials.HEALTH_CHECK, async () => {
    const manager = getCredentialManager()
    return manager.checkHealth()
  })

  server.handle(RPC_CHANNELS.credentials.PREVIEW_MIGRATION, async (): Promise<CredentialMigrationResult<CredentialMigrationPreviewDto>> => {
    try {
      return ok(publicCounts(await previewCredentialMigration()))
    } catch (error) {
      return fail(mapMigrationError(error, 'preview'))
    }
  })

  server.handle(RPC_CHANNELS.credentials.APPLY_MIGRATION, async (): Promise<CredentialMigrationResult<CredentialMigrationApplyDto>> => {
    try {
      const result = await applyCredentialMigration()
      if (!result.migrationId || result.applied === 0 || result.state !== 'applied') {
        return fail('not_ready')
      }
      const data: CredentialMigrationApplyDto = {
        ...publicCounts(result),
        migrationId: result.migrationId,
        applied: result.applied,
        status: 'applied',
      }
      return ok(data)
    } catch (error) {
      return fail(mapMigrationError(error, 'apply'))
    }
  })

  server.handle(RPC_CHANNELS.credentials.GET_MIGRATION_STATUS, async (): Promise<CredentialMigrationResult<CredentialMigrationStatusDto>> => {
    try {
      const status = await getCredentialMigrationStatus()
      if (!status) {
        return ok(emptyStatus())
      }
      const data: CredentialMigrationStatusDto = {
        ready: status.ready,
        alreadyEnvelope: status.alreadyEnvelope,
        skipped: status.skipped,
        invalid: status.invalid,
        migrationId: status.migrationId,
        state: status.state,
        createdAt: status.createdAt,
        appliedAt: status.appliedAt ?? undefined,
        rolledBackAt: status.rolledBackAt ?? undefined,
        rollbackAvailable: status.rollbackAvailable,
      }
      return ok(data)
    } catch (error) {
      return fail(mapMigrationError(error, 'status'))
    }
  })

  server.handle(RPC_CHANNELS.credentials.ROLLBACK_MIGRATION, async (_ctx, migrationId: unknown): Promise<CredentialMigrationResult<CredentialMigrationRollbackDto>> => {
    if (!isCredentialMigrationId(migrationId)) {
      return fail('rollback_unavailable')
    }
    try {
      const result = await rollbackCredentialMigration(migrationId)
      const data: CredentialMigrationRollbackDto = {
        ...publicCounts(result),
        migrationId: result.migrationId,
        state: 'rolled_back',
        rollbackAvailable: false,
      }
      return ok(data)
    } catch (error) {
      return fail(mapMigrationError(error, 'rollback'))
    }
  })
}
