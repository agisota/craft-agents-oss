import { describe, expect, test } from 'bun:test';
import { createGraphBuilder, finalizeGraph } from '../graph.ts';
import { attachHeadingsTree, parseOutlineHeadings } from '../outline.ts';

describe('parseOutlineHeadings', () => {
  test('extracts nested ATX headings', () => {
    const md = `# Title\n\n## Section\n\n### Deep\n\n## Other\n`;
    const h = parseOutlineHeadings(md);
    expect(h.map((x) => `${x.level}:${x.text}`)).toEqual([
      '1:Title',
      '2:Section',
      '3:Deep',
      '2:Other',
    ]);
  });

  test('ignores headings inside fenced code', () => {
    const md = `# Real\n\n\`\`\`\n# Fake\n\`\`\`\n\n## After\n`;
    const h = parseOutlineHeadings(md);
    expect(h.map((x) => x.text)).toEqual(['Real', 'After']);
  });

  test('strips trailing hash run', () => {
    const h = parseOutlineHeadings('## Hello ##\n');
    expect(h[0]?.text).toBe('Hello');
  });
});

describe('attachHeadingsTree', () => {
  test('nests by level under root', () => {
    const builder = createGraphBuilder({ type: 'note', noteId: 'n1' }, 'Doc');
    const headings = parseOutlineHeadings('# A\n## B\n# C\n');
    attachHeadingsTree(builder, headings, builder.rootId);
    const g = finalizeGraph(builder, { now: 1 });
    const root = g.nodes[g.rootId]!;
    expect(root.children.length).toBe(2);
    const a = g.nodes[root.children[0]!]!;
    expect(a.label).toBe('A');
    expect(a.children.length).toBe(1);
    expect(g.nodes[a.children[0]!]!.label).toBe('B');
    expect(g.nodes[root.children[1]!]!.label).toBe('C');
  });
});
