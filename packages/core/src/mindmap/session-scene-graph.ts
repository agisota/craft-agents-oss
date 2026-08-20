import type { MindMapSessionMessage } from './derive-session.ts';

export type SceneToolStatus = 'ok' | 'error' | 'pending' | 'unknown';

export type SceneToolPacket = {
  toolCallId: string;
  name: string;
  status: SceneToolStatus;
  messageId: string;
};

export type SessionScene = {
  id: string;
  triggerMessageId: string;
  assistantMessageIds: string[];
  tools: SceneToolPacket[];
  triggerPreview: string;
  outcomePreview: string;
  parentSceneId: string | null;
  childSceneIds: string[];
  orphaned: boolean;
};

export type SceneEdge = {
  from: string;
  to: string;
  kind: 'continue' | 'fork';
};

export type SessionSceneGraph = {
  sessionId: string;
  scenes: SessionScene[];
  edges: SceneEdge[];
};

const SKIP = new Set(['status', 'info', 'warning']);

function preview(text: string, n: number): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, n);
}

function toolStatus(msg: MindMapSessionMessage): SceneToolStatus {
  const raw = String((msg as { status?: string }).status ?? '').toLowerCase();
  if (raw === 'ok' || raw === 'error' || raw === 'pending') return raw;
  return 'unknown';
}

/**
 * Project session messages into scenes: one user turn + following assistant/tools.
 * Tools are nested packets, not dropped. Linear parent is previous scene (no parent_message_id).
 */
export function projectSessionScenes(
  sessionId: string,
  messages: MindMapSessionMessage[],
): SessionSceneGraph {
  const scenes: SessionScene[] = [];
  let open: SessionScene | null = null;

  for (const msg of messages) {
    if (SKIP.has(msg.type)) continue;
    if (msg.type === 'user') {
      const scene: SessionScene = {
        id: `scn_${msg.id}`,
        triggerMessageId: msg.id,
        assistantMessageIds: [],
        tools: [],
        triggerPreview: preview(msg.content, 80),
        outcomePreview: '',
        parentSceneId: scenes.length ? scenes[scenes.length - 1]!.id : null,
        childSceneIds: [],
        orphaned: false,
      };
      scenes.push(scene);
      open = scene;
      continue;
    }
    if (!open) {
      open = {
        id: `scn_orphan_${msg.id}`,
        triggerMessageId: msg.id,
        assistantMessageIds: [],
        tools: [],
        triggerPreview: preview(msg.content || msg.type, 80),
        outcomePreview: '',
        parentSceneId: null,
        childSceneIds: [],
        orphaned: true,
      };
      scenes.push(open);
    }
    if (msg.type === 'assistant' || msg.type === 'thinking' || msg.type === 'plan') {
      open.assistantMessageIds.push(msg.id);
      if (msg.content) open.outcomePreview = preview(msg.content, 140);
      continue;
    }
    if (msg.type === 'tool') {
      open.tools.push({
        toolCallId: msg.toolUseId || msg.id,
        name: msg.toolName || 'tool',
        status: toolStatus(msg),
        messageId: msg.id,
      });
    }
  }

  const children = new Map<string, string[]>();
  for (const scene of scenes) {
    if (!scene.parentSceneId) continue;
    const list = children.get(scene.parentSceneId) ?? [];
    list.push(scene.id);
    children.set(scene.parentSceneId, list);
  }
  const edges: SceneEdge[] = [];
  for (const scene of scenes) {
    const kids = children.get(scene.id) ?? [];
    scene.childSceneIds = kids;
    const kind: SceneEdge['kind'] = kids.length > 1 ? 'fork' : 'continue';
    for (const child of kids) edges.push({ from: scene.id, to: child, kind });
  }

  return { sessionId, scenes, edges };
}

export const FANOUT_PARALLEL = 8;
export const FANOUT_MAX = 32;

export function planFanOutJobs(variantsLength: number, count: number): { total: number; parallelCap: number } {
  const total = variantsLength * count;
  if (total < 1) throw new Error('empty');
  if (total > FANOUT_MAX) throw new Error('cap');
  return { total, parallelCap: FANOUT_PARALLEL };
}

export function initialFanOutStatuses(total: number): Array<'running' | 'queued'> {
  return Array.from({ length: total }, (_, i) => (i < FANOUT_PARALLEL ? 'running' : 'queued'));
}
