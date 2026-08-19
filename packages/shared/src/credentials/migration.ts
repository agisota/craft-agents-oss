import type {
  CredentialMigrationBackend,
  CredentialMigrationCounts,
  CredentialMigrationRecord,
  CredentialMigrationStatus,
} from './backends/types.ts';
import { encodeCredentialEnvelope } from './envelope.ts';
import {
  credentialKindForType,
  CredentialManager,
  getCredentialManager,
} from './manager.ts';
import type { CredentialId } from './types.ts';

export type { CredentialMigrationCounts, CredentialMigrationStatus } from './backends/types.ts';

export interface CredentialMigrationPreview {
  readonly ready: number;
  readonly alreadyEnvelope: number;
  readonly skipped: number;
  readonly invalid: number;
}

export interface CredentialMigrationApplyResult extends CredentialMigrationPreview {
  readonly applied: number;
  readonly migrationId: string | null;
  readonly state: 'applied' | null;
}

export interface CredentialMigrationRollbackResult extends CredentialMigrationPreview {
  readonly migrationId: string;
  readonly state: 'rolled_back';
  readonly rollbackAvailable: false;
}

interface EvaluatedMigration {
  readonly preview: CredentialMigrationPreview;
  readonly replacements: readonly CredentialMigrationRecord[];
}

function cloneCredentialId(id: CredentialId): CredentialId {
  return {
    type: id.type,
    connectionSlug: id.connectionSlug,
    workspaceId: id.workspaceId,
    sourceId: id.sourceId,
    name: id.name,
    hostId: id.hostId,
  };
}

function countsFromPreview(preview: CredentialMigrationPreview): CredentialMigrationCounts {
  return {
    ready: preview.ready,
    alreadyEnvelope: preview.alreadyEnvelope,
    skipped: preview.skipped,
    invalid: preview.invalid,
  };
}

async function evaluateMigration(manager: CredentialManager): Promise<EvaluatedMigration> {
  let ready = 0;
  let alreadyEnvelope = 0;
  let skipped = 0;
  let invalid = 0;
  const replacements: CredentialMigrationRecord[] = [];

  for (const id of await manager.list()) {
    const classified = await manager.inspect(id);
    if (!classified) {
      invalid += 1;
      continue;
    }
    if (classified.encoding === 'envelope-v1') {
      alreadyEnvelope += 1;
      continue;
    }
    try {
      replacements.push({
        id: cloneCredentialId(id),
        credential: {
          value: encodeCredentialEnvelope({
            kind: credentialKindForType(id.type),
            payload: classified.credential,
          }),
        },
      });
      ready += 1;
    } catch {
      invalid += 1;
    }
  }

  return {
    preview: { ready, alreadyEnvelope, skipped, invalid },
    replacements,
  };
}

async function migrationBackend(manager: CredentialManager): Promise<CredentialMigrationBackend> {
  return manager.getMigrationBackend();
}

export async function previewCredentialMigration(
  manager: CredentialManager = getCredentialManager(),
): Promise<CredentialMigrationPreview> {
  await migrationBackend(manager);
  return (await evaluateMigration(manager)).preview;
}

export async function applyCredentialMigration(
  manager: CredentialManager = getCredentialManager(),
): Promise<CredentialMigrationApplyResult> {
  const backend = await migrationBackend(manager);
  const evaluated = await evaluateMigration(manager);
  if (evaluated.replacements.length === 0) {
    return { ...evaluated.preview, applied: 0, migrationId: null, state: null };
  }
  const snapshot = await backend.createMigrationSnapshot();
  await backend.applyMigration(snapshot, evaluated.replacements, countsFromPreview(evaluated.preview));
  return {
    ...evaluated.preview,
    applied: evaluated.replacements.length,
    migrationId: snapshot.migrationId,
    state: 'applied',
  };
}

export async function getCredentialMigrationStatus(
  manager: CredentialManager = getCredentialManager(),
): Promise<CredentialMigrationStatus | null> {
  return (await migrationBackend(manager)).getLatestMigrationStatus();
}

export async function rollbackCredentialMigration(
  migrationId: string,
  manager: CredentialManager = getCredentialManager(),
): Promise<CredentialMigrationRollbackResult> {
  if (typeof migrationId !== 'string' || migrationId.length === 0) {
    throw new Error('Credential migration snapshot is invalid');
  }
  const backend = await migrationBackend(manager);
  await backend.rollbackMigration(migrationId);
  const status = await backend.getLatestMigrationStatus();
  if (!status || status.migrationId !== migrationId || status.state !== 'rolled_back') {
    throw new Error('Credential migration rollback is unavailable');
  }
  return {
    migrationId: status.migrationId,
    state: 'rolled_back',
    rollbackAvailable: false,
    ready: status.ready,
    alreadyEnvelope: status.alreadyEnvelope,
    skipped: status.skipped,
    invalid: status.invalid,
  };
}
