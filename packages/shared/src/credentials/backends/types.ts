/**
 * Credential Backend Interface
 *
 * All credential storage backends must implement this interface.
 * Backends are tried in priority order until one succeeds.
 */

import type { CredentialId, StoredCredential } from '../types.ts';

export interface CredentialMigrationSnapshot {
  readonly migrationId: string;
  readonly createdAt: number;
  readonly sourceChecksum: string;
}

export interface CredentialMigrationRecord {
  readonly id: CredentialId;
  readonly credential: StoredCredential;
}

export type CredentialMigrationBackendState = 'applied' | 'rolled_back';

/** Sanitized aggregate counts. Never includes identifiers or secrets. */
export interface CredentialMigrationCounts {
  readonly ready: number;
  readonly alreadyEnvelope: number;
  readonly skipped: number;
  readonly invalid: number;
}

/**
 * Sanitized projection of persisted migration metadata.
 * Checksums, paths, ciphertext, and credential identities are omitted.
 */
export interface CredentialMigrationStatus {
  readonly migrationId: string;
  readonly state: CredentialMigrationBackendState;
  readonly createdAt: number;
  readonly appliedAt: number | null;
  readonly rolledBackAt: number | null;
  readonly ready: number;
  readonly alreadyEnvelope: number;
  readonly skipped: number;
  readonly invalid: number;
  readonly rollbackAvailable: boolean;
}

export interface CredentialBackend {
  /** Backend name for logging/debugging */
  readonly name: string;

  /** Priority (higher = tried first) */
  readonly priority: number;

  /** Check if this backend is available on the current platform */
  isAvailable(): Promise<boolean>;

  /** Get a credential by ID */
  get(id: CredentialId): Promise<StoredCredential | null>;

  /** Set/update a credential */
  set(id: CredentialId, credential: StoredCredential): Promise<void>;

  /** Delete a credential */
  delete(id: CredentialId): Promise<boolean>;

  /** Delete a credential synchronously, when supported by the backend. */
  deleteSync?(id: CredentialId): boolean;

  /** List all credentials (optionally filtered by partial ID) */
  list(filter?: Partial<CredentialId>): Promise<CredentialId[]>;
}

export interface CredentialMigrationBackend extends CredentialBackend {
  createMigrationSnapshot(): Promise<CredentialMigrationSnapshot>;
  applyMigration(
    snapshot: CredentialMigrationSnapshot,
    replacements: readonly CredentialMigrationRecord[],
    counts: CredentialMigrationCounts,
  ): Promise<void>;
  rollbackMigration(migrationId: string): Promise<void>;
  getLatestMigrationStatus(): Promise<CredentialMigrationStatus | null>;
}

export function isCredentialMigrationBackend(value: CredentialBackend): value is CredentialMigrationBackend {
  return (
    'createMigrationSnapshot' in value &&
    typeof value.createMigrationSnapshot === 'function' &&
    'applyMigration' in value &&
    typeof value.applyMigration === 'function' &&
    'rollbackMigration' in value &&
    typeof value.rollbackMigration === 'function' &&
    'getLatestMigrationStatus' in value &&
    typeof value.getLatestMigrationStatus === 'function'
  );
}
