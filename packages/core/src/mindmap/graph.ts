import { hashMindMapSource } from './hash.ts';
import type {
  MindMapDerivation,
  MindMapEdge,
  MindMapEdgeKind,
  MindMapEntityRef,
  MindMapGraph,
  MindMapNode,
  MindMapNodeId,
  MindMapNodeKind,
  MindMapNodeSource,
} from './types.ts';
import { MIND_MAP_ROOT_ID } from './types.ts';

export interface CreateNodeInput {
  id: MindMapNodeId;
  label: string;
  kind: MindMapNodeKind;
  level: number;
  source?: MindMapNodeSource;
  meta?: Record<string, string | number | boolean>;
}

/** Mutable builder used during derive; call finalizeGraph before returning. */
export interface MindMapGraphBuilder {
  entity: MindMapEntityRef;
  rootId: MindMapNodeId;
  nodes: Record<MindMapNodeId, MindMapNode>;
  edges: MindMapEdge[];
  hashParts: string[];
}

export function createGraphBuilder(entity: MindMapEntityRef, rootLabel: string): MindMapGraphBuilder {
  const root: MindMapNode = {
    id: MIND_MAP_ROOT_ID,
    label: rootLabel,
    kind: 'root',
    level: 0,
    children: [],
  };
  return {
    entity,
    rootId: MIND_MAP_ROOT_ID,
    nodes: { [MIND_MAP_ROOT_ID]: root },
    edges: [],
    hashParts: [`entity:${entityKey(entity)}`, `root:${rootLabel}`],
  };
}

export function entityKey(entity: MindMapEntityRef): string {
  if (entity.type === 'session') return `session:${entity.sessionId}`;
  if (entity.type === 'note') return `note:${entity.noteId}`;
  const ref = entity.ref;
  return `knowledge:${ref.provider ?? ref.scheme}:${ref.kind}:${ref.id}`;
}

export function addNode(builder: MindMapGraphBuilder, input: CreateNodeInput): MindMapNode {
  if (builder.nodes[input.id]) {
    return builder.nodes[input.id]!;
  }
  const node: MindMapNode = {
    id: input.id,
    label: input.label,
    kind: input.kind,
    level: input.level,
    children: [],
    ...(input.source ? { source: input.source } : {}),
    ...(input.meta ? { meta: input.meta } : {}),
  };
  builder.nodes[input.id] = node;
  builder.hashParts.push(`node:${input.id}:${input.kind}:${input.label}`);
  return node;
}

export function addChild(
  builder: MindMapGraphBuilder,
  parentId: MindMapNodeId,
  input: CreateNodeInput,
): MindMapNode {
  const parent = builder.nodes[parentId];
  if (!parent) {
    throw new Error(`mindmap: unknown parent ${parentId}`);
  }
  const node = addNode(builder, input);
  if (!parent.children.includes(node.id)) {
    parent.children.push(node.id);
    builder.hashParts.push(`parent:${parentId}>${node.id}`);
  }
  addEdge(builder, parentId, node.id, 'parent');
  return node;
}

export function addEdge(
  builder: MindMapGraphBuilder,
  from: MindMapNodeId,
  to: MindMapNodeId,
  kind: MindMapEdgeKind,
): MindMapEdge {
  const id = `e:${kind}:${from}>${to}`;
  const existing = builder.edges.find((edge) => edge.id === id);
  if (existing) return existing;
  const edge: MindMapEdge = { id, from, to, kind };
  builder.edges.push(edge);
  if (kind !== 'parent') {
    builder.hashParts.push(`edge:${kind}:${from}>${to}`);
  }
  return edge;
}

export function truncateLabel(text: string, max = 80): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine || '…';
  return `${oneLine.slice(0, Math.max(1, max - 1))}…`;
}

export function finalizeGraph(
  builder: MindMapGraphBuilder,
  opts?: { derivation?: MindMapDerivation; now?: number },
): MindMapGraph {
  const contentHash = hashMindMapSource(builder.hashParts);
  return {
    entity: builder.entity,
    rootId: builder.rootId,
    nodes: builder.nodes,
    edges: builder.edges,
    contentHash,
    derivedAt: opts?.now ?? Date.now(),
    derivation: opts?.derivation ?? 'outline',
  };
}
