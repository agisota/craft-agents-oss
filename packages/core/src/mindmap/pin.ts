import { entityKey } from './graph.ts';
import type { MindMapEntityRef, MindMapGraph, MindMapLayout, PinnedMap } from './types.ts';

export interface PinReadIO {
  read(path: string): Promise<string | null>;
}

export interface PinWriteIO {
  write(path: string, data: string): Promise<void>;
}

const PIN_VERSION = 1 as const;

interface PinnedMapFile {
  v: typeof PIN_VERSION;
  pin: PinnedMap;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'id';
}

/** Filename (no directory) for an entity pin. */
export function entityPinFilename(entity: MindMapEntityRef): string {
  if (entity.type === 'session') return `session_${sanitizeSegment(entity.sessionId)}.json`;
  if (entity.type === 'note') return `note_${sanitizeSegment(entity.noteId)}.json`;
  return `knowledge_${sanitizeSegment(entity.ref.kind)}_${sanitizeSegment(entity.ref.id)}.json`;
}

export function entityPinPath(dir: string, entity: MindMapEntityRef): string {
  const base = dir.endsWith('/') || dir.endsWith('\\') ? dir.slice(0, -1) : dir;
  return `${base}/${entityPinFilename(entity)}`;
}

export function createPinnedMap(input: {
  entity: MindMapEntityRef;
  graph: MindMapGraph;
  layout: MindMapLayout;
  sourceContentHash: string;
  id?: string;
  now?: number;
}): PinnedMap {
  const now = input.now ?? Date.now();
  return {
    id: input.id ?? `pin_${entityKey(input.entity)}`,
    entity: input.entity,
    graph: { ...input.graph, derivation: 'pinned' },
    layout: input.layout,
    sourceContentHash: input.sourceContentHash,
    createdAt: now,
    updatedAt: now,
  };
}

export function serializePinnedMap(pin: PinnedMap): string {
  const file: PinnedMapFile = { v: PIN_VERSION, pin };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parsePinnedMap(json: string): PinnedMap {
  const parsed = JSON.parse(json) as PinnedMapFile | PinnedMap;
  if (parsed && typeof parsed === 'object' && 'v' in parsed && 'pin' in parsed) {
    if (parsed.v !== PIN_VERSION) {
      throw new Error(`mindmap pin: unsupported version ${String((parsed as PinnedMapFile).v)}`);
    }
    return parsed.pin;
  }
  // bare pin object
  const bare = parsed as PinnedMap;
  if (!bare?.entity || !bare?.graph || !bare?.layout) {
    throw new Error('mindmap pin: invalid payload');
  }
  return bare;
}

export function isPinnedMapStale(pin: PinnedMap, currentSourceHash: string): boolean {
  return pin.sourceContentHash !== currentSourceHash;
}

export async function loadPinnedMap(
  io: PinReadIO,
  dir: string,
  entity: MindMapEntityRef,
): Promise<PinnedMap | null> {
  const raw = await io.read(entityPinPath(dir, entity));
  if (raw == null || raw.trim() === '') return null;
  return parsePinnedMap(raw);
}

export async function savePinnedMap(
  io: PinWriteIO,
  dir: string,
  pin: PinnedMap,
): Promise<void> {
  await io.write(entityPinPath(dir, pin.entity), serializePinnedMap(pin));
}
