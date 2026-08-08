import { describe, expect, test } from 'bun:test';
import { deriveKnowledgeMindMap } from '../derive-knowledge.ts';

const ref = { scheme: 'siyuan' as const, kind: 'document' as const, id: 'doc1' };

describe('deriveKnowledgeMindMap', () => {
  test('prefers children blocks over content outline', () => {
    const g = deriveKnowledgeMindMap({
      ref,
      title: 'Spec',
      content: '# ShouldNotUse\n',
      children: [
        { blockId: 'b1', content: 'First block' },
        { blockId: 'b2', content: '## Nested heading text' },
      ],
      now: 1,
    });
    const root = g.nodes[g.rootId]!;
    expect(root.children).toEqual(['block:b1', 'block:b2']);
    expect(g.nodes['block:b1']!.label).toBe('First block');
    expect(g.nodes['block:b2']!.label).toContain('Nested');
  });

  test('falls back to outline from content', () => {
    const g = deriveKnowledgeMindMap({
      ref,
      title: 'Spec',
      content: '# Alpha\n\n## Beta\n',
      children: [],
      now: 1,
    });
    const root = g.nodes[g.rootId]!;
    expect(root.children.length).toBe(1);
    expect(g.nodes[root.children[0]!]!.label).toBe('Alpha');
  });

  test('backlinks as leaf nodes', () => {
    const g = deriveKnowledgeMindMap({
      ref,
      title: 'Spec',
      children: [{ blockId: 'b1', content: 'x' }],
      backlinks: [{ ref: { scheme: 'siyuan', kind: 'document', id: 'doc2' }, title: 'Roadmap' }],
      now: 1,
    });
    expect(g.nodes['backlink:document:doc2']!.label).toBe('Roadmap');
  });
});
