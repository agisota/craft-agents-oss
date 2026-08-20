import { describe, expect, test } from 'bun:test';
import { projectSessionScenes } from '../session-scene-graph.ts';
import {
  buildDigestItems,
  digestPinStorageKey,
  parsePinnedSceneIds,
  serializePinnedSceneIds,
} from '../session-digest.ts';

describe('buildDigestItems', () => {
  test('write tool is an artifact; trailing user is open', () => {
    const graph = projectSessionScenes('s', [
      { id: 'u1', type: 'user', content: 'save' },
      { id: 'a1', type: 'assistant', content: 'ok' },
      { id: 't1', type: 'tool', content: 'ok', toolName: 'Write', toolUseId: 'w1' },
      { id: 'u2', type: 'user', content: 'next' },
    ]);
    const items = buildDigestItems(graph, ['scn_u1']);
    expect(items.some((i) => i.shelf === 'artifacts')).toBe(true);
    expect(items.some((i) => i.shelf === 'open' && i.sceneId === 'scn_u2')).toBe(true);
    expect(items.some((i) => i.shelf === 'pinned')).toBe(true);
  });

  test('pins come from overlay key, not the transcript', () => {
    const key = digestPinStorageKey('sess-1');
    expect(key).toContain('rox.sessionDigest.pins');
    const overlay = serializePinnedSceneIds(['scn_u1']);
    expect(parsePinnedSceneIds(overlay)).toEqual(['scn_u1']);
    const graph = projectSessionScenes('s', [{ id: 'u1', type: 'user', content: 'fork restart' }]);
    const items = buildDigestItems(graph, parsePinnedSceneIds(overlay));
    expect(items.some((i) => i.shelf === 'decisions')).toBe(true);
    expect(items.some((i) => i.shelf === 'pinned')).toBe(true);
    expect(graph.scenes[0]!.triggerPreview).not.toContain('pin_');
  });
});
