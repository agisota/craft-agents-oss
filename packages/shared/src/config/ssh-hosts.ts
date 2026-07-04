/**
 * SSH host configuration for reaching a craft-agent server on a remote machine
 * over an SSH tunnel (VS Code Remote-SSH style).
 *
 * SSH is used only as a tunnel/bootstrap layer: a local port is forwarded to the
 * craft-agent server's port on the remote host, and the app then talks to that
 * server over the existing remote-workspace WebSocket path.
 *
 * Manually-added/edited hosts are persisted to `ssh-hosts.json`. Entries parsed
 * from `~/.ssh/config` are read-only import suggestions and are never written
 * back to the user's ssh config.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { ensureConfigDir } from './storage.ts';
import { CONFIG_DIR } from './paths.ts';
import { readJsonFileSync, atomicWriteFileSync } from '../utils/files.ts';
import { DEFAULT_SERVER_CONFIG } from './server-config.ts';

/** Default SSH port. */
export const DEFAULT_SSH_PORT = 22;

/** Default craft-agent server port on the remote (mirrors DEFAULT_SERVER_CONFIG.port). */
export const DEFAULT_REMOTE_SERVER_PORT = DEFAULT_SERVER_CONFIG.port;

export interface SshHostConfig {
  /** Stable id / slug for this host. */
  id: string;
  /** Human-friendly label shown in the UI. */
  label: string;
  /** Hostname or IP to connect to (ssh HostName). */
  host: string;
  /** SSH port. Defaults to 22. */
  port: number;
  /** SSH login user. */
  user: string;
  /** Optional path to a private key file (ssh IdentityFile). */
  identityFile?: string;
  /** craft-agent server port on the remote host. Defaults to the server default. */
  remotePort: number;
  /**
   * Optional custom command to start the craft-agent server on the remote host.
   * Used by the "start remote server" action when no server is reachable.
   */
  remoteServerCommand?: string;
  /** True when this entry was imported from ~/.ssh/config (read-only suggestion). */
  imported?: boolean;
  /** Last time this record was written. */
  updatedAt?: number;
}

/** A host parsed from ~/.ssh/config, before it is saved as a managed host. */
export interface SshConfigImportSuggestion {
  /** The `Host` alias from ssh config (used as label + slug seed). */
  alias: string;
  host: string;
  port: number;
  user?: string;
  identityFile?: string;
}

const SSH_HOSTS_FILE = join(CONFIG_DIR, 'ssh-hosts.json');

interface SshHostsFile {
  hosts: SshHostConfig[];
  updatedAt?: number;
}

/**
 * Turn an arbitrary string into a stable, filesystem/url-safe slug.
 * Falls back to `host` when the label reduces to empty.
 */
export function slugifyHostId(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'host';
}

export function loadSshHosts(): SshHostConfig[] {
  try {
    if (!existsSync(SSH_HOSTS_FILE)) return [];
    const raw = readJsonFileSync<SshHostsFile>(SSH_HOSTS_FILE);
    if (!raw || !Array.isArray(raw.hosts)) return [];
    return raw.hosts.map(normalizeHost);
  } catch {
    return [];
  }
}

function saveSshHosts(hosts: SshHostConfig[]): void {
  ensureConfigDir();
  const payload: SshHostsFile = { hosts, updatedAt: Date.now() };
  atomicWriteFileSync(SSH_HOSTS_FILE, JSON.stringify(payload, null, 2));
}

function normalizeHost(host: SshHostConfig): SshHostConfig {
  return {
    ...host,
    port: host.port || DEFAULT_SSH_PORT,
    remotePort: host.remotePort || DEFAULT_REMOTE_SERVER_PORT,
  };
}

/** Ensure a unique id: if `id` is taken, append `-2`, `-3`, ... */
function ensureUniqueId(id: string, existing: SshHostConfig[]): string {
  const taken = new Set(existing.map((h) => h.id));
  if (!taken.has(id)) return id;
  let n = 2;
  while (taken.has(`${id}-${n}`)) n++;
  return `${id}-${n}`;
}

export type SshHostInput = Omit<SshHostConfig, 'id' | 'port' | 'remotePort' | 'updatedAt'> &
  Partial<Pick<SshHostConfig, 'id' | 'port' | 'remotePort'>>;

export function addSshHost(input: SshHostInput): SshHostConfig {
  const hosts = loadSshHosts();
  const baseId = input.id ? slugifyHostId(input.id) : slugifyHostId(input.label || input.host);
  const host: SshHostConfig = normalizeHost({
    ...input,
    id: ensureUniqueId(baseId, hosts),
    port: input.port ?? DEFAULT_SSH_PORT,
    remotePort: input.remotePort ?? DEFAULT_REMOTE_SERVER_PORT,
    updatedAt: Date.now(),
  });
  saveSshHosts([...hosts, host]);
  return host;
}

export function updateSshHost(
  id: string,
  updates: Partial<Omit<SshHostConfig, 'id'>>,
): SshHostConfig | undefined {
  const hosts = loadSshHosts();
  const existing = hosts.find((h) => h.id === id);
  const idx = hosts.findIndex((h) => h.id === id);
  if (idx === -1 || !existing) return undefined;
  const updated = normalizeHost({
    ...existing,
    ...updates,
    id,
    updatedAt: Date.now(),
  });
  hosts[idx] = updated;
  saveSshHosts(hosts);
  return updated;
}

export function deleteSshHost(id: string): boolean {
  const hosts = loadSshHosts();
  const next = hosts.filter((h) => h.id !== id);
  if (next.length === hosts.length) return false;
  saveSshHosts(next);
  return true;
}

export function getSshHost(id: string): SshHostConfig | undefined {
  return loadSshHosts().find((h) => h.id === id);
}

export function getSshHostsPath(): string {
  return SSH_HOSTS_FILE;
}
