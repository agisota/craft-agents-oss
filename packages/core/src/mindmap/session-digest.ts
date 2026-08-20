import type { SessionScene, SessionSceneGraph } from './session-scene-graph.ts';

export type DigestShelf = 'decisions' | 'artifacts' | 'open' | 'pinned';

export type DigestItem = {
  id: string;
  shelf: DigestShelf;
  sceneId: string;
  messageId: string;
  title: string;
  reason: string;
};

/** Overlay key prefix; pins live in localStorage, not the transcript. */
export const DIGEST_PIN_STORAGE_KEY = 'rox.sessionDigest.pins';

export function digestPinStorageKey(sessionId: string): string {
  return `${DIGEST_PIN_STORAGE_KEY}.${sessionId}`;
}

export function parsePinnedSceneIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function serializePinnedSceneIds(ids: readonly string[]): string {
  return JSON.stringify([...ids]);
}

const DECISION_RE = /переделай|иначе|fork|restart|instead/i;
const ARTIFACT_RE = /write|edit|bash|read|apply_patch/i;
const SHELF_ORDER: Record<DigestShelf, number> = {
  decisions: 0,
  artifacts: 1,
  open: 2,
  pinned: 3,
};

function titleOf(scene: SessionScene): string {
  return scene.triggerPreview.slice(0, 80) || scene.id;
}

export function buildDigestItems(
  graph: SessionSceneGraph,
  pinnedSceneIds: string[] = [],
): DigestItem[] {
  const items: DigestItem[] = [];
  const byId = new Map(graph.scenes.map((s) => [s.id, s]));

  for (const scene of graph.scenes) {
    const isFork = scene.childSceneIds.length > 1;
    if (isFork || DECISION_RE.test(scene.triggerPreview)) {
      items.push({
        id: `dec_${scene.id}`,
        shelf: 'decisions',
        sceneId: scene.id,
        messageId: scene.triggerMessageId,
        title: titleOf(scene),
        reason: isFork ? 'форк' : 'форк',
      });
    }
    const artifact = scene.tools.find((t) => t.status !== 'error' && ARTIFACT_RE.test(t.name));
    if (artifact) {
      items.push({
        id: `art_${scene.id}_${artifact.toolCallId}`,
        shelf: 'artifacts',
        sceneId: scene.id,
        messageId: artifact.messageId,
        title: titleOf(scene),
        reason: `инструмент ${artifact.name}`,
      });
    }
    const blocked = scene.tools.some((t) => t.status === 'error' || t.status === 'pending');
    if (scene.assistantMessageIds.length === 0 || blocked) {
      items.push({
        id: `open_${scene.id}`,
        shelf: 'open',
        sceneId: scene.id,
        messageId: scene.triggerMessageId,
        title: titleOf(scene),
        reason: scene.assistantMessageIds.length === 0 ? 'нет ответа' : 'ошибка инструмента',
      });
    }
  }

  for (const id of pinnedSceneIds) {
    const scene = byId.get(id);
    if (!scene) continue;
    items.push({
      id: `pin_${scene.id}`,
      shelf: 'pinned',
      sceneId: scene.id,
      messageId: scene.triggerMessageId,
      title: titleOf(scene),
      reason: 'закреплено',
    });
  }

  items.sort((a, b) => {
    const shelf = SHELF_ORDER[a.shelf] - SHELF_ORDER[b.shelf];
    if (shelf !== 0) return shelf;
    return a.id.localeCompare(b.id);
  });
  return items;
}
