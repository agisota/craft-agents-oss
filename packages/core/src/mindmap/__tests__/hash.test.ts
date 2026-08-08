import { describe, expect, test } from 'bun:test';
import { hashMindMapSource, normalizeMindMapPart } from '../hash.ts';

describe('hashMindMapSource', () => {
  test('same inputs produce same hash', () => {
    const a = hashMindMapSource(['root', 'child-a', 'child-b']);
    const b = hashMindMapSource(['root', 'child-a', 'child-b']);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test('matches the SHA-256 known vector', () => {
    expect(hashMindMapSource(['abc'])).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  test('uses the browser-safe fallback without a native Bun hasher', () => {
    const bun = (globalThis as { Bun?: Record<string, unknown> }).Bun;
    if (!bun) {
      expect(hashMindMapSource(['abc'])).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
      return;
    }

    const nativeHasher = bun.CryptoHasher;
    try {
      bun.CryptoHasher = undefined;
      expect(hashMindMapSource(['abc'])).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    } finally {
      bun.CryptoHasher = nativeHasher;
    }
  });

  test('order of parts affects hash', () => {
    const a = hashMindMapSource(['a', 'b']);
    const b = hashMindMapSource(['b', 'a']);
    expect(a).not.toBe(b);
  });

  test('label change affects hash', () => {
    const a = hashMindMapSource(['node:1:Hello']);
    const b = hashMindMapSource(['node:1:Hello!']);
    expect(a).not.toBe(b);
  });

  test('normalizes CRLF to LF before hashing', () => {
    const a = hashMindMapSource(['line1\r\nline2']);
    const b = hashMindMapSource(['line1\nline2']);
    expect(a).toBe(b);
  });

  test('empty parts stay unambiguous via NUL join', () => {
    const a = hashMindMapSource(['a', '', 'b']);
    const b = hashMindMapSource(['a', 'b']);
    expect(a).not.toBe(b);
  });
});

describe('normalizeMindMapPart', () => {
  test('converts bare CR and CRLF to LF', () => {
    expect(normalizeMindMapPart('a\r\nb\rc')).toBe('a\nb\nc');
  });
});
