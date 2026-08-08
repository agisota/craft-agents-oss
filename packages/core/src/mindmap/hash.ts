/**
 * Stable content hashing for mind-map projections.
 * Same runtime strategy as knowledge/publications sha256Hex (Bun.sha → crypto.hash → node createHash).
 */

import { createHash } from 'node:crypto';

function sha256Hex(text: string): string {
  const g = globalThis as typeof globalThis & {
    crypto?: Crypto & {
      hash?: (alg: string, data: string | ArrayBufferView, out?: string) => string | ArrayBuffer;
    };
    Bun?: { sha?: (input: string | Uint8Array, encoding?: string) => string | Uint8Array };
  };
  if (typeof g.Bun?.sha === 'function') {
    return String(g.Bun.sha(text, 'hex'));
  }
  if (typeof g.crypto?.hash === 'function') {
    return String(g.crypto.hash('sha256', text, 'hex'));
  }
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Normalize newlines only (\r\n / \r → \n). Does not trim — structural parts stay exact. */
export function normalizeMindMapPart(part: string): string {
  return part.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Hash ordered structural parts joined with NUL after newline normalization.
 */
export function hashMindMapSource(parts: readonly string[]): string {
  const payload = parts.map(normalizeMindMapPart).join('\0');
  return sha256Hex(payload);
}
