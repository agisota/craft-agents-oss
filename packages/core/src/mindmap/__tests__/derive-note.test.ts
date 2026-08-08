import { describe, expect, test } from 'bun:test';
import { deriveNoteMindMap } from '../derive-note.ts';

describe('deriveNoteMindMap', () => {
  test('builds tree from headings', () => {
    const g = deriveNoteMindMap({
      noteId: 'n1',
      title: 'My Note',
      markdown: '# Intro\n\n## Details\n\nbody\n',
      now: 1,
    });
    const root = g.nodes[g.rootId]!;
    expect(root.label).toBe('My Note');
    expect(root.children.length).toBe(1);
    const intro = g.nodes[root.children[0]!]!;
    expect(intro.label).toBe('Intro');
    expect(intro.children.length).toBe(1);
    expect(g.nodes[intro.children[0]!]!.label).toBe('Details');
  });

  test('body section when no headings', () => {
    const g = deriveNoteMindMap({
      noteId: 'n2',
      title: 'Plain',
      markdown: 'just a paragraph of text without structure',
      now: 1,
    });
    const root = g.nodes[g.rootId]!;
    expect(root.children).toEqual(['section:body']);
    expect(g.nodes['section:body']!.kind).toBe('section');
  });

  test('attaches backlinks under root', () => {
    const g = deriveNoteMindMap({
      noteId: 'n3',
      title: 'N',
      markdown: '# H\n',
      backlinks: [{ id: 'other', title: 'Other Note' }],
      now: 1,
    });
    const root = g.nodes[g.rootId]!;
    expect(root.children.some((id) => id === 'backlink:other')).toBe(true);
    expect(g.nodes['backlink:other']!.label).toBe('Other Note');
  });
});
