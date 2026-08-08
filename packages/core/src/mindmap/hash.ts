/**
 * Stable content hashing for mind-map projections.
 * Same runtime strategy as knowledge/publications sha256Hex (Bun.sha → crypto.hash → fallback).
 */

function sha256Hex(text: string): string {
  const g = globalThis as typeof globalThis & {
    crypto?: Crypto & { hash?: (alg: string, data: string | ArrayBufferView, out?: string) => string | ArrayBuffer };
    Bun?: { sha?: (input: string | Uint8Array, encoding?: string) => string | Uint8Array };
  };
  if (typeof g.Bun?.sha === 'function') {
    return String(g.Bun.sha(text, 'hex'));
  }
  if (typeof g.crypto?.hash === 'function') {
    return String(g.crypto.hash('sha256', text, 'hex'));
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c << 1), 0x01000193) >>> 0;
  }
  return (
    h1.toString(16).padStart(8, '0') +
    h2.toString(16).padStart(8, '0') +
    (h1 ^ h2).toString(16).padStart(8, '0') +
    ((h1 + h2) >>> 0).toString(16).padStart(8, '0') +
    h1.toString(16).padStart(8, '0') +
    h2.toString(16).padStart(8, '0') +
    (h1 ^ h2).toString(16).padStart(8, '0') +
    ((h1 + h2) >>> 0).toString(16).padStart(8, '0')
  );
}

/** Normalize a structural part before hashing (trim, LF). */
export function normalizeMindMapPart(part: string): string {
  return part.replace(/\r\n?/g, '\n').trim();
}

/**
 * Hash ordered structural parts (labels, parent relations, source ids).
 * Joins with a unit separator so empty parts stay unambiguous.
 */
export function hashMindMapSource(parts: readonly string[]): string {
  const payload = parts.map(normalizeMindMapPart).join('\u001f');
  return sha256Hex(payload);
}
