/**
 * Fence-safe ATX heading outline for mind-map derive.
 * Ported from apps/electron/.../outline-parser.ts (no markdown library).
 */

import { addChild, type MindMapGraphBuilder } from './graph.ts';
import type { MindMapNodeId } from './types.ts';

export interface OutlineHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  /** 0-based source line number */
  line: number;
}

const HEADING_RE = /^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const FENCE_RE = /^[ \t]*(```+|~~~)/;

export const MAX_OUTLINE_HEADINGS = 100;

export function parseOutlineHeadings(
  markdown: string,
  maxHeadings = MAX_OUTLINE_HEADINGS,
): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  let inFence = false;
  const lines = markdown.split('\n');
  for (let line = 0; line < lines.length && headings.length < maxHeadings; line++) {
    const text = lines[line] ?? '';
    if (FENCE_RE.test(text)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = HEADING_RE.exec(text);
    if (!match) continue;
    const title = (match[2] ?? '').trim();
    if (!title) continue;
    headings.push({
      level: match[1]!.length as OutlineHeading['level'],
      text: title,
      line,
    });
  }
  return headings;
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'h';
}

/** Attach heading nodes under rootId; returns ids in document order. */
export function attachHeadingsTree(
  builder: MindMapGraphBuilder,
  headings: OutlineHeading[],
  rootId: MindMapNodeId,
  idPrefix = 'h',
): MindMapNodeId[] {
  const stack: Array<{ level: number; id: MindMapNodeId }> = [{ level: 0, id: rootId }];
  const ids: MindMapNodeId[] = [];

  for (const heading of headings) {
    while (stack.length > 1 && stack[stack.length - 1]!.level >= heading.level) {
      stack.pop();
    }
    const parentId = stack[stack.length - 1]!.id;
    const id: MindMapNodeId = `${idPrefix}:${heading.line}:${slugify(heading.text)}`;
    addChild(builder, parentId, {
      id,
      label: heading.text,
      kind: 'heading',
      level: heading.level,
      source: { kind: 'heading', id: String(heading.line) },
      meta: { line: heading.line },
    });
    stack.push({ level: heading.level, id });
    ids.push(id);
  }
  return ids;
}
