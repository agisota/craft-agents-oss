import { describe, expect, test } from 'bun:test';
import { hashMindMapSource, normalizeMindMapPart } from '../hash.ts';

describe('hashMindMapSource', () => {
  test('is stable for identical parts', () => {
    const a = hashMindMapSource(['root:A', 'node:1:message:hi']);
    const b = hashMindMapSource(['root:A', 'node:1:message:hi']);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]+$/);
    expect(a.length).toBeGreaterThanOrEqual(16);
  });

  test('changes when label changes', () => {
    const a = hashMindMapSource(['root:A', 'node:1:message:hi']);
    const b = hashMindMapSource(['root:A', 'node:1:message:bye']);
    expect(a).not.toBe(b);
  });

  test('changes when child order / parent edge changes', () => {
    const a = hashMindMapSource(['parent:root>a', 'parent:root>b']);
    const b = hashMindMapSource(['parent:root>b', 'parent:root>a']);
    expect(a).not.toBe(b);
  });

  test('normalizes CRLF in parts', () => {
    expect(normalizeMindMapPart('x\r\ny')).toBe('x\ny');
    expect(hashMindMapSource(['x\r\ny'])).toBe(hashMindMapSource(['x\ny']));
  });
});
