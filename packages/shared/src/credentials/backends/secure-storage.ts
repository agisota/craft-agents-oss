/**
 * Secure Storage Backend
 *
 * Stores credentials in an encrypted file at ~/.craft-agent/credentials.enc
 * Uses AES-256-GCM for authenticated encryption.
 *
 * Encryption key is derived from OS-native hardware UUID using PBKDF2:
 * - macOS: IOPlatformUUID (tied to logic board, never changes)
 * - Windows: MachineGuid from registry (set at OS install)
 * - Linux: /var/lib/dbus/machine-id (set at OS install)
 *
 * This is more stable than the previous hostname-based derivation, which could
 * change with network/DHCP. Legacy credentials remain readable without rewrite.
 *
 * File format:
 *   [Header - 64 bytes]
 *   ├── Magic: "CRAFT01\0" (8 bytes)
 *   ├── Flags: uint32 LE (4 bytes) - reserved for future use
 *   ├── Salt: 32 bytes (PBKDF2 salt)
 *   ├── Reserved: 20 bytes
 *   [Encrypted Payload]
 *   ├── IV: 12 bytes (random per write)
 *   ├── Auth Tag: 16 bytes (GCM authentication)
 *   └── Ciphertext: variable (encrypted JSON)
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
  createHash,
} from 'crypto';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { hostname, userInfo, homedir } from 'os';
import { join, dirname, basename } from 'path';

import type { CredentialBackend } from './types.ts';
import type { CredentialId, StoredCredential } from '../types.ts';
import { credentialIdToAccount, accountToCredentialId } from '../types.ts';
import { CONFIG_DIR } from '../../config/paths.ts';

const DEFAULT_CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.enc');

export type CredentialRepairCode = 'undersized' | 'bad_magic' | 'decrypt_failed' | 'checksum_mismatch';

export interface CredentialRepairRecord {
  readonly digest: string;
  readonly code: CredentialRepairCode;
  readonly quarantinedAt: number;
  readonly quarantineDir: string;
}

const MAGIC_BYTES = Buffer.from('CRAFT01\0');
const HEADER_SIZE = 64;
const MAGIC_SIZE = 8;
const FLAGS_SIZE = 4;
const SALT_SIZE = 32;
const IV_SIZE = 12;
const AUTH_TAG_SIZE = 16;
const KEY_SIZE = 32;
const PBKDF2_ITERATIONS = 100000;

function getStableMachineId(): string {
  try {
    if (process.platform === 'darwin') {
      const output = execSync(
        'ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match?.[1]) return match[1];
    } else if (process.platform === 'win32') {
      const output = execSync(
        'reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const match = output.match(/MachineGuid\s+REG_SZ\s+(\S+)/);
      if (match?.[1]) return match[1];
    } else {
      const machineIdPath = '/var/lib/dbus/machine-id';
      const altPath = '/etc/machine-id';
      if (existsSync(machineIdPath)) {
        return readFileSync(machineIdPath, 'utf-8').trim();
      }
      if (existsSync(altPath)) {
        return readFileSync(altPath, 'utf-8').trim();
      }
    }
  } catch {
    // Fall through to fallback
  }

  return `${userInfo().username}:${homedir()}`;
}

interface CredentialStore {
  version: 1;
  credentials: Record<string, StoredCredential>;
  metadata: {
    createdAt: number;
    updatedAt: number;
  };
}

export class SecureStorageBackend implements CredentialBackend {
  readonly name = 'secure-storage';
  readonly priority = 100;

  private readonly filePath: string;
  private cachedStore: CredentialStore | null = null;
  private encryptionKey: Buffer | null = null;
  private salt: Buffer | null = null;
  private repairRecord: CredentialRepairRecord | null = null;
  private writesBlocked = false;

  constructor(options?: { filePath?: string }) {
    this.filePath = options?.filePath ?? DEFAULT_CREDENTIALS_FILE;
    this.repairRecord = this.readRepairRecord();
    if (this.repairRecord) this.writesBlocked = true;
  }

  getRepairRecord(): CredentialRepairRecord | null {
    return this.repairRecord;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async get(id: CredentialId): Promise<StoredCredential | null> {
    const store = await this.loadStore();
    if (!store) return null;
    return store.credentials[credentialIdToAccount(id)] || null;
  }

  async set(id: CredentialId, credential: StoredCredential): Promise<void> {
    this.assertWritable();
    let store = await this.loadStore();
    if (!store) {
      store = {
        version: 1,
        credentials: {},
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };
    }
    store.credentials[credentialIdToAccount(id)] = credential;
    store.metadata.updatedAt = Date.now();
    await this.saveStore(store);
  }

  async delete(id: CredentialId): Promise<boolean> {
    return this.deleteSync(id);
  }

  deleteSync(id: CredentialId): boolean {
    this.assertWritable();
    const store = this.loadStoreSync();
    if (!store) return false;
    const key = credentialIdToAccount(id);
    if (!(key in store.credentials)) return false;
    delete store.credentials[key];
    store.metadata.updatedAt = Date.now();
    this.saveStoreSync(store);
    return true;
  }

  async list(filter?: Partial<CredentialId>): Promise<CredentialId[]> {
    const store = await this.loadStore();
    if (!store) return [];
    const ids = Object.keys(store.credentials)
      .map(accountToCredentialId)
      .filter((id): id is CredentialId => id !== null);
    if (!filter) return ids;
    return ids.filter((id) => {
      if (filter.type && id.type !== filter.type) return false;
      if (filter.workspaceId && id.workspaceId !== filter.workspaceId) return false;
      if (filter.name && id.name !== filter.name) return false;
      return true;
    });
  }

  clearCache(): void {
    this.cachedStore = null;
    this.encryptionKey = null;
    this.salt = null;
  }

  private async loadStore(): Promise<CredentialStore | null> {
    return this.loadStoreSync();
  }

  private loadStoreSync(): CredentialStore | null {
    if (this.cachedStore) return this.cachedStore;
    if (this.writesBlocked) return null;
    if (!existsSync(this.filePath)) return null;

    let fileData: Buffer;
    try {
      fileData = readFileSync(this.filePath);
    } catch {
      return null;
    }

    if (fileData.length < HEADER_SIZE + IV_SIZE + AUTH_TAG_SIZE) {
      this.quarantineCorrupted('undersized', fileData);
      return null;
    }
    if (!fileData.subarray(0, MAGIC_SIZE).equals(MAGIC_BYTES)) {
      this.quarantineCorrupted('bad_magic', fileData);
      return null;
    }

    const salt = fileData.subarray(MAGIC_SIZE + FLAGS_SIZE, MAGIC_SIZE + FLAGS_SIZE + SALT_SIZE);
    this.salt = salt;
    const encryptedData = fileData.subarray(HEADER_SIZE);

    const current = this.tryDecrypt(encryptedData, this.getEncryptionKey(salt));
    if (current) {
      this.cachedStore = current;
      return current;
    }

    const legacy = this.tryDecrypt(encryptedData, this.getLegacyEncryptionKey(salt));
    if (legacy) {
      this.cachedStore = legacy;
      return legacy;
    }

    this.quarantineCorrupted('decrypt_failed', fileData);
    return null;
  }

  private tryDecrypt(encryptedData: Buffer, key: Buffer): CredentialStore | null {
    try {
      const iv = encryptedData.subarray(0, IV_SIZE);
      const authTag = encryptedData.subarray(IV_SIZE, IV_SIZE + AUTH_TAG_SIZE);
      const ciphertext = encryptedData.subarray(IV_SIZE + AUTH_TAG_SIZE);
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(decrypted.toString('utf8')) as CredentialStore;
    } catch {
      return null;
    }
  }

  private async saveStore(store: CredentialStore): Promise<void> {
    this.saveStoreSync(store);
  }

  private saveStoreSync(store: CredentialStore): void {
    this.assertWritable();
    const directory = dirname(this.filePath);
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
    }

    const salt = this.salt || randomBytes(SALT_SIZE);
    this.salt = salt;
    const key = this.getEncryptionKey(salt);
    const plaintext = Buffer.from(JSON.stringify(store), 'utf8');
    const iv = randomBytes(IV_SIZE);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const header = Buffer.alloc(HEADER_SIZE);
    MAGIC_BYTES.copy(header, 0);
    header.writeUInt32LE(0, MAGIC_SIZE);
    salt.copy(header, MAGIC_SIZE + FLAGS_SIZE);
    writeFileSync(this.filePath, Buffer.concat([header, iv, authTag, ciphertext]), { mode: 0o600 });
    this.cachedStore = store;
  }

  private getEncryptionKey(salt: Buffer): Buffer {
    if (this.encryptionKey) return this.encryptionKey;
    const stableMachineId = createHash('sha256')
      .update(getStableMachineId())
      .update('craft-agent-v2')
      .digest();
    this.encryptionKey = pbkdf2Sync(stableMachineId, salt, PBKDF2_ITERATIONS, KEY_SIZE, 'sha256');
    return this.encryptionKey;
  }

  private getLegacyEncryptionKey(salt: Buffer): Buffer {
    const legacyMachineId = createHash('sha256')
      .update(hostname())
      .update(userInfo().username)
      .update(homedir())
      .update('craft-agent-v1')
      .digest();
    return pbkdf2Sync(legacyMachineId, salt, PBKDF2_ITERATIONS, KEY_SIZE, 'sha256');
  }

  private repairRecordPath(): string {
    return `${this.filePath}.repair.json`;
  }

  private readRepairRecord(): CredentialRepairRecord | null {
    const path = this.repairRecordPath();
    if (!existsSync(path)) return null;
    try {
      const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      const record = parsed as Partial<CredentialRepairRecord>;
      if (typeof record.digest !== 'string' || typeof record.code !== 'string') return null;
      if (typeof record.quarantinedAt !== 'number' || typeof record.quarantineDir !== 'string') return null;
      return {
        digest: record.digest,
        code: record.code as CredentialRepairCode,
        quarantinedAt: record.quarantinedAt,
        quarantineDir: record.quarantineDir,
      };
    } catch {
      return null;
    }
  }

  private assertWritable(): void {
    if (this.writesBlocked || this.repairRecord) {
      throw new Error('Credential store is in repair_required');
    }
  }

  private quarantineCorrupted(code: CredentialRepairCode, fileData: Buffer): void {
    const digest = createHash('sha256').update(fileData).digest('hex');
    const quarantineDir = join(dirname(this.filePath), `${basename(this.filePath)}.quarantine-${Date.now()}`);
    try {
      mkdirSync(quarantineDir, { recursive: true, mode: 0o700 });
      const quarantinedPath = join(quarantineDir, 'credentials.enc');
      writeFileSync(quarantinedPath, fileData, { mode: 0o600 });
      const copyDigest = createHash('sha256').update(readFileSync(quarantinedPath)).digest('hex');
      if (copyDigest !== digest) {
        this.persistRepair({ digest, code: 'checksum_mismatch', quarantinedAt: Date.now(), quarantineDir });
        return;
      }
      if (existsSync(this.filePath)) unlinkSync(this.filePath);
      this.persistRepair({ digest, code, quarantinedAt: Date.now(), quarantineDir });
    } catch {
      this.persistRepair({ digest, code, quarantinedAt: Date.now(), quarantineDir });
    }
    this.cachedStore = null;
    this.encryptionKey = null;
    this.salt = null;
  }

  private persistRepair(record: CredentialRepairRecord): void {
    this.repairRecord = record;
    this.writesBlocked = true;
    writeFileSync(this.repairRecordPath(), JSON.stringify(record), { mode: 0o600 });
  }
}
