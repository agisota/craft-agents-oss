import { describe, expect, test } from 'bun:test';
import { deriveNoteMindMap } from '../derive-note.ts';
import {
  createPinnedMap,
  entityPinFilename,
  isPinnedMapStale,
  loadPinnedMap,
  parsePinnedMap,
  savePinnedMap,
  serializePinnedMap,
} from '../pin.ts';

describe('pin helpers', () => {
  test('entityPinFilename sanitizes ids', () => {
    expect(entityPinFilename({ type: 'session', sessionId: 'abc/def' })).toBe(
      'session_abc_def.json',
    );
    expect(
      entityPinFilename({
        type: 'knowledge',
        ref: { scheme: 'siyuan', kind: 'document', id: 'd1' },
      }),
    ).toBe('knowledge_document_d1.json');
  });

  test('round-trip serialize/parse', () => {
    const graph = deriveNoteMindMap({
      noteId: 'n1',
      title: 'T',
      markdown: '# H\n',
      now: 10,
    });
    const pin = createPinnedMap({
      entity: { type: 'note', noteId: 'n1' },
      graph,
      layout: { positions: { root: { x: 0, y: 0 } }, collapsed: [] },
      sourceContentHash: graph.contentHash,
      now: 10,
    });
    const again = parsePinnedMap(serializePinnedMap(pin));
    expect(again.entity).toEqual(pin.entity);
    expect(again.graph.contentHash).toBe(graph.contentHash);
    expect(again.graph.derivation).toBe('pinned');
    expect(again.layout.positions.root).toEqual({ x: 0, y: 0 });
  });

  test('load/save with memory io', async () => {
    const store = new Map<string, string>();
    const io = {
      read: async (path: string) => store.get(path) ?? null,
      write: async (path: string, data: string) => {
        store.set(path, data);
      },
    };
    const graph = deriveNoteMindMap({
      noteId: 'n2',
      title: 'T',
      markdown: 'body only',
      now: 1,
    });
    const pin = createPinnedMap({
      entity: { type: 'note', noteId: 'n2' },
      graph,
      layout: { positions: {}, collapsed: ['section:body'] },
      sourceContentHash: graph.contentHash,
      now: 1,
    });
    await savePinnedMap(io, '/ws/mindmaps', pin);
    const loaded = await loadPinnedMap(io, '/ws/mindmaps', { type: 'note', noteId: 'n2' });
    expect(loaded?.layout.collapsed).toEqual(['section:body']);
    expect(await loadPinnedMap(io, '/ws/mindmaps', { type: 'note', noteId: 'missing' })).toBeNull();
  });

  test('isPinnedMapStale', () => {
    const graph = deriveNoteMindMap({
      noteId: 'n3',
      title: 'T',
      markdown: '# A\n',
      now: 1,
    });
    const pin = createPinnedMap({
      entity: { type: 'note', noteId: 'n3' },
      graph,
      layout: { positions: {}, collapsed: [] },
      sourceContentHash: graph.contentHash,
      now: 1,
    });
    expect(isPinnedMapStale(pin, graph.contentHash)).toBe(false);
    expect(isPinnedMapStale(pin, 'other')).toBe(true);
  });
});
