import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type {
  CredentialBackend,
  CredentialMigrationBackend,
  CredentialMigrationCounts,
  CredentialMigrationRecord,
  CredentialMigrationSnapshot,
  CredentialMigrationStatus,
} from '../backends/types.ts';
import { SecureStorageBackend } from '../backends/secure-storage.ts';
import { encodeCredentialEnvelope } from '../envelope.ts';
import { CredentialManager } from '../manager.ts';
import {
  applyCredentialMigration,
  getCredentialMigrationStatus,
  previewCredentialMigration,
  rollbackCredentialMigration,
} from '../migration.ts';
import { credentialIdToAccount, type CredentialId, type StoredCredential } from '../types.ts';

class MemoryMigrationBackend implements CredentialMigrationBackend {
  readonly name = 'memory-migration';
  readonly priority = 100;
  readonly values = new Map<string, StoredCredential>();
  readonly ids = new Map<string, CredentialId>();
  snapshotCalls = 0;
  applyCalls = 0;
  rollbackCalls = 0;
  private sequence = 0;
  private backups = new Map<string, Map<string, StoredCredential>>();
  private statuses = new Map<string, CredentialMigrationStatus>();

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async get(id: CredentialId): Promise<StoredCredential | null> {
    return this.values.get(credentialIdToAccount(id)) ?? null;
  }

  async set(id: CredentialId, credential: StoredCredential): Promise<void> {
    const key = credentialIdToAccount(id);
    this.values.set(key, credential);
    this.ids.set(key, { ...id });
  }

  async delete(id: CredentialId): Promise<boolean> {
    return this.values.delete(credentialIdToAccount(id));
  }

  async list(): Promise<CredentialId[]> {
    return [...this.ids.values()].map((id) => ({ ...id }));
  }

  async createMigrationSnapshot(): Promise<CredentialMigrationSnapshot> {
    this.snapshotCalls += 1;
    this.sequence += 1;
    const migrationId = `credential-migration-00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`;
    this.backups.set(migrationId, new Map(this.values));
    return {
      migrationId,
      createdAt: Date.now(),
      sourceChecksum: `checksum-${this.sequence}`,
    };
  }

  async applyMigration(
    snapshot: CredentialMigrationSnapshot,
    replacements: readonly CredentialMigrationRecord[],
    counts: CredentialMigrationCounts,
  ): Promise<void> {
    this.applyCalls += 1;
    for (const replacement of replacements) {
      await this.set(replacement.id, replacement.credential);
    }
    this.statuses.set(snapshot.migrationId, {
      migrationId: snapshot.migrationId,
      state: 'applied',
      createdAt: snapshot.createdAt,
      appliedAt: Date.now(),
      rolledBackAt: null,
      ...counts,
      rollbackAvailable: true,
    });
  }

  async rollbackMigration(migrationId: string): Promise<void> {
    this.rollbackCalls += 1;
    const backup = this.backups.get(migrationId);
    const status = this.statuses.get(migrationId);
    if (!backup || !status || status.state !== 'applied') {
      throw new Error('Credential migration rollback is unavailable');
    }
    this.values.clear();
    this.ids.clear();
    for (const [key, value] of backup) {
      this.values.set(key, value);
    }
    this.statuses.set(migrationId, {
      ...status,
      state: 'rolled_back',
      rolledBackAt: Date.now(),
      rollbackAvailable: false,
    });
  }

  async getLatestMigrationStatus(): Promise<CredentialMigrationStatus | null> {
    const records = [...this.statuses.values()];
    if (records.length === 0) return null;
    records.sort((a, b) => (b.appliedAt ?? b.createdAt) - (a.appliedAt ?? a.createdAt));
    return records[0] ?? null;
  }
}

function manager(backend: CredentialBackend): CredentialManager {
  return new CredentialManager({ backends: [backend] });
}

const legacyId: CredentialId = { type: 'llm_api_key', connectionSlug: 'primary' };
const currentId: CredentialId = { type: 'llm_api_key', connectionSlug: 'current' };
const malformedId: CredentialId = { type: 'llm_api_key', connectionSlug: 'repair' };

const temporaryDirectories: string[] = [];

const SECRET_BEARING_KEYS = [
  'entries',
  'snapshot',
  'sourceChecksum',
  'appliedChecksum',
  'fingerprint',
  'credential',
  'ciphertext',
  'path',
];

function assertSecretFree(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('legacy-value');
  expect(serialized).not.toContain('current-value');
  expect(serialized).not.toContain('never-in-result');
  for (const key of SECRET_BEARING_KEYS) {
    expect(serialized).not.toContain(`"${key}"`);
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('controlled credential migration', () => {
  it('previews without writing and never returns credential values', async () => {
    const backend = new MemoryMigrationBackend();
    await backend.set(legacyId, { value: 'legacy-value' });
    await backend.set(currentId, {
      value: encodeCredentialEnvelope({ kind: 'api_key', payload: { value: 'current-value' } }),
    });
    await backend.set(malformedId, { value: '{"format":"rox-credential-envelope"}' });

    const preview = await previewCredentialMigration(manager(backend));

    expect(preview).toEqual({ ready: 1, alreadyEnvelope: 1, skipped: 0, invalid: 1 });
    expect(backend.snapshotCalls).toBe(0);
    expect(backend.applyCalls).toBe(0);
    assertSecretFree(preview);
  });

  it('converts only valid legacy objects after making one snapshot', async () => {
    const backend = new MemoryMigrationBackend();
    await backend.set(legacyId, { value: 'legacy-value' });
    await backend.set(malformedId, { value: '{"format":"rox-credential-envelope"}' });

    const result = await applyCredentialMigration(manager(backend));

    expect(result).toMatchObject({ ready: 1, invalid: 1, applied: 1, state: 'applied' });
    expect(result.migrationId).toBeTruthy();
    expect(backend.snapshotCalls).toBe(1);
    expect(backend.applyCalls).toBe(1);
    const converted = await backend.get(legacyId);
    expect(converted).not.toBeNull();
    expect(converted?.value).toContain('rox-credential-envelope');
    expect(await backend.get(malformedId)).toEqual({ value: '{"format":"rox-credential-envelope"}' });
    assertSecretFree(result);
  });

  it('does not snapshot or write when no valid legacy credential exists', async () => {
    const backend = new MemoryMigrationBackend();
    await backend.set(currentId, {
      value: encodeCredentialEnvelope({ kind: 'api_key', payload: { value: 'current-value' } }),
    });
    await backend.set(malformedId, { value: '{"format":"rox-credential-envelope"}' });

    const result = await applyCredentialMigration(manager(backend));

    expect(result).toMatchObject({
      ready: 0,
      alreadyEnvelope: 1,
      invalid: 1,
      applied: 0,
      migrationId: null,
      state: null,
    });
    expect(backend.snapshotCalls).toBe(0);
    expect(backend.applyCalls).toBe(0);
    assertSecretFree(result);
  });

  it('runs preview apply and rollback against encrypted storage', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'craft-controlled-migration-'));
    temporaryDirectories.push(directory);
    const backend = new SecureStorageBackend(directory);
    const credentialManager = manager(backend);
    await backend.set(legacyId, { value: 'legacy-value' });

    expect((await previewCredentialMigration(credentialManager)).ready).toBe(1);
    const applied = await applyCredentialMigration(credentialManager);
    if (!applied.migrationId) throw new Error('expected migration id');
    expect((await backend.get(legacyId))?.value).toContain('rox-credential-envelope');

    await rollbackCredentialMigration(applied.migrationId, credentialManager);
    expect(await backend.get(legacyId)).toEqual({ value: 'legacy-value' });
  });

  it('fails closed for multiple active backends and delegates rollback by opaque id', async () => {
    const first = new MemoryMigrationBackend();
    const second = new MemoryMigrationBackend();
    const ambiguous = new CredentialManager({ backends: [first, second] });
    await expect(previewCredentialMigration(ambiguous)).rejects.toThrow('unavailable');
    await expect(getCredentialMigrationStatus(ambiguous)).rejects.toThrow('unavailable');

    await first.set(legacyId, { value: 'legacy-value' });
    const applied = await applyCredentialMigration(manager(first));
    if (!applied.migrationId) throw new Error('expected migration id');
    await rollbackCredentialMigration(applied.migrationId, manager(first));
    expect(first.rollbackCalls).toBe(1);
  });

  it('public service results expose only internal secret-free fields', async () => {
    const backend = new MemoryMigrationBackend();
    await backend.set(legacyId, { value: 'never-in-result' });
    const preview = await previewCredentialMigration(manager(backend));
    const applied = await applyCredentialMigration(manager(backend));
    const status = await getCredentialMigrationStatus(manager(backend));
    if (!applied.migrationId || !status) throw new Error('expected status');
    const rolled = await rollbackCredentialMigration(applied.migrationId, manager(backend));

    for (const result of [preview, applied, status, rolled]) {
      expect(Object.keys(result).sort()).not.toContain('entries');
      expect(Object.keys(result).sort()).not.toContain('snapshot');
      assertSecretFree(result);
    }
  });
});
