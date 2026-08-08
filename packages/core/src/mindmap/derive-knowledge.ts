import type { KnowledgeRef } from '../knowledge/refs.ts';
import { addChild, createGraphBuilder, finalizeGraph, truncateLabel } from './graph.ts';
import { attachHeadingsTree, parseOutlineHeadings } from './outline.ts';
import type { MindMapGraph } from './types.ts';

export interface MindMapKnowledgeChild {
  blockId: string;
  content: string;
}

export interface MindMapKnowledgeBacklink {
  ref: KnowledgeRef;
  title: string;
}

export interface MindMapKnowledgeInput {
  ref: KnowledgeRef;
  title: string;
  content?: string;
  children?: MindMapKnowledgeChild[];
  backlinks?: MindMapKnowledgeBacklink[];
  now?: number;
}

function firstLineLabel(content: string): string {
  const line = content.split('\n').find((l) => l.trim().length > 0) ?? content;
  return truncateLabel(line.replace(/^#+\s*/, ''), 100);
}

export function deriveKnowledgeMindMap(input: MindMapKnowledgeInput): MindMapGraph {
  const title = input.title.trim() || input.ref.id;
  const entity = { type: 'knowledge' as const, ref: input.ref };
  const builder = createGraphBuilder(entity, title);

  const children = input.children ?? [];
  if (children.length > 0) {
    for (const child of children) {
      addChild(builder, builder.rootId, {
        id: `block:${child.blockId}`,
        label: firstLineLabel(child.content) || child.blockId,
        kind: 'block',
        level: 1,
        source: { kind: 'block', id: child.blockId },
      });
    }
  } else if (input.content?.trim()) {
    const headings = parseOutlineHeadings(input.content);
    if (headings.length > 0) {
      attachHeadingsTree(builder, headings, builder.rootId, 'h');
    } else {
      addChild(builder, builder.rootId, {
        id: 'section:body',
        label: truncateLabel(input.content, 120),
        kind: 'section',
        level: 1,
        source: { kind: 'document', id: input.ref.id },
      });
    }
  }

  for (const bl of input.backlinks ?? []) {
    const id = `backlink:${bl.ref.kind}:${bl.ref.id}`;
    addChild(builder, builder.rootId, {
      id,
      label: bl.title.trim() || bl.ref.id,
      kind: 'backlink',
      level: 1,
      source: { kind: bl.ref.kind, id: bl.ref.id },
    });
  }

  return finalizeGraph(builder, { derivation: 'outline', now: input.now });
}
