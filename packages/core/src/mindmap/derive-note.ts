import { addChild, createGraphBuilder, finalizeGraph, truncateLabel } from './graph.ts';
import { attachHeadingsTree, parseOutlineHeadings } from './outline.ts';
import type { MindMapGraph } from './types.ts';

export interface MindMapNoteBacklink {
  id: string;
  title: string;
}

export interface MindMapNoteInput {
  noteId: string;
  title: string;
  markdown: string;
  backlinks?: MindMapNoteBacklink[];
  now?: number;
}

export function deriveNoteMindMap(input: MindMapNoteInput): MindMapGraph {
  const title = input.title.trim() || 'Note';
  const entity = { type: 'note' as const, noteId: input.noteId };
  const builder = createGraphBuilder(entity, title);

  const headings = parseOutlineHeadings(input.markdown);
  if (headings.length > 0) {
    attachHeadingsTree(builder, headings, builder.rootId, 'h');
  } else {
    const body = input.markdown.replace(/\s+/g, ' ').trim();
    if (body) {
      addChild(builder, builder.rootId, {
        id: 'section:body',
        label: truncateLabel(body, 120),
        kind: 'section',
        level: 1,
        source: { kind: 'note', id: input.noteId },
      });
    }
  }

  for (const bl of input.backlinks ?? []) {
    const id = `backlink:${bl.id}`;
    addChild(builder, builder.rootId, {
      id,
      label: bl.title.trim() || bl.id,
      kind: 'backlink',
      level: 1,
      source: { kind: 'note', id: bl.id },
    });
  }

  return finalizeGraph(builder, { derivation: 'outline', now: input.now });
}
