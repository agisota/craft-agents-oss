/**
 * Read-only parser for `~/.ssh/config` Host entries.
 *
 * Produces import suggestions (host/hostname/user/port/identityfile). Wildcard
 * patterns (`Host *`, `Host foo.*`) are skipped — they are match rules, not
 * concrete hosts. The user's ssh config is never mutated.
 */

import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { readFileSync } from 'fs';
import { DEFAULT_SSH_PORT, type SshConfigImportSuggestion } from './ssh-hosts.ts';

const DEFAULT_SSH_CONFIG_PATH = join(homedir(), '.ssh', 'config');

interface MutableEntry {
  aliases: string[];
  hostName?: string;
  user?: string;
  port?: number;
  identityFile?: string;
}

function hasWildcard(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.startsWith('!');
}

/**
 * Expand a leading `~` in an ssh IdentityFile path to the user's home dir.
 */
function expandHome(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

/**
 * Parse ssh config text into concrete host suggestions.
 * A `Host` line may list multiple aliases; only non-wildcard aliases become
 * suggestions, and an entry with only wildcard aliases is dropped entirely.
 */
export function parseSshConfig(text: string): SshConfigImportSuggestion[] {
  const entries: MutableEntry[] = [];
  let current: MutableEntry | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Split on first whitespace or `=` (ssh accepts both `Key value` and `Key=value`).
    const match = line.match(/^(\S+?)\s*[=\s]\s*(.+)$/);
    if (!match) continue;
    const key = match[1]!.toLowerCase();
    const value = match[2]!.trim();

    if (key === 'host') {
      const aliases = value.split(/\s+/).filter((a) => !hasWildcard(a));
      current = { aliases };
      entries.push(current);
      continue;
    }
    if (!current) continue;

    switch (key) {
      case 'hostname':
        current.hostName = value;
        break;
      case 'user':
        current.user = value;
        break;
      case 'port': {
        const port = parseInt(value, 10);
        if (Number.isFinite(port)) current.port = port;
        break;
      }
      case 'identityfile':
        // Only take the first IdentityFile; strip surrounding quotes.
        if (!current.identityFile) {
          current.identityFile = expandHome(value.replace(/^["']|["']$/g, ''));
        }
        break;
    }
  }

  const suggestions: SshConfigImportSuggestion[] = [];
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      suggestions.push({
        alias,
        host: entry.hostName || alias,
        port: entry.port ?? DEFAULT_SSH_PORT,
        user: entry.user,
        identityFile: entry.identityFile,
      });
    }
  }
  return suggestions;
}

/**
 * Read and parse the user's ssh config file. Returns [] when the file is
 * missing or unreadable.
 */
export function importSshConfigSuggestions(
  configPath: string = DEFAULT_SSH_CONFIG_PATH,
): SshConfigImportSuggestion[] {
  try {
    if (!existsSync(configPath)) return [];
    return parseSshConfig(readFileSync(configPath, 'utf-8'));
  } catch {
    return [];
  }
}
