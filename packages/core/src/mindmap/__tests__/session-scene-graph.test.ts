import { describe, expect, test } from 'bun:test';
import {
  FANOUT_MAX,
  FANOUT_PARALLEL,
  initialFanOutStatuses,
  planFanOutJobs,
  projectSessionScenes,
} from '../session-scene-graph.ts';

describe('projectSessionScenes', () => {
  test('empty transcript', () => {
    const graph = projectSessionScenes('s1', []);
    expect(graph.scenes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  test('nests tools under the user scene and does not drop them', () => {
    const graph = projectSessionScenes('s1', [
      { id: 'u1', type: 'user', content: 'ship it' },
      { id: 'a1', type: 'assistant', content: 'ok' },
      { id: 't1', type: 'tool', content: 'wrote', toolName: 'Write', toolUseId: 'tu1' },
    ]);
    expect(graph.scenes).toHaveLength(1);
    expect(graph.scenes[0]!.id).toBe('scn_u1');
    expect(graph.scenes[0]!.tools.map((x) => x.name)).toEqual(['Write']);
    expect(graph.scenes[0]!.assistantMessageIds).toEqual(['a1']);
  });

  test('linear scenes chain as continue', () => {
    const graph = projectSessionScenes('s1', [
      { id: 'u1', type: 'user', content: 'one' },
      { id: 'a1', type: 'assistant', content: 'a' },
      { id: 'u2', type: 'user', content: 'two' },
    ]);
    expect(graph.scenes).toHaveLength(2);
    expect(graph.scenes[1]!.parentSceneId).toBe('scn_u1');
    expect(graph.edges[0]!.kind).toBe('continue');
  });

  test('skips status chrome', () => {
    const graph = projectSessionScenes('s1', [
      { id: 'st', type: 'status', content: 'busy' },
      { id: 'u1', type: 'user', content: 'hi' },
    ]);
    expect(graph.scenes.map((s) => s.triggerMessageId)).toEqual(['u1']);
  });

  test('orphan assistant before first user keeps tools', () => {
    const graph = projectSessionScenes('s1', [
      { id: 'a0', type: 'assistant', content: 'hello' },
      { id: 't0', type: 'tool', content: 'x', toolName: 'Read', toolUseId: 'r0' },
    ]);
    expect(graph.scenes).toHaveLength(1);
    expect(graph.scenes[0]!.orphaned).toBe(true);
    expect(graph.scenes[0]!.tools).toHaveLength(1);
  });

  test('fork via parentToolUseId does not drop tools', () => {
    const graph = projectSessionScenes('s1', [
      { id: 'u1', type: 'user', content: 'base' },
      { id: 'a1', type: 'assistant', content: 'ok' },
      { id: 't1', type: 'tool', content: 'wrote', toolName: 'Write', toolUseId: 'tu1' },
      { id: 'u2', type: 'user', content: 'branch a', parentToolUseId: 'tu1' },
      { id: 'a2', type: 'assistant', content: 'a' },
      { id: 't2', type: 'tool', content: 'read', toolName: 'Read', toolUseId: 'tu2', parentToolUseId: 'tu1' },
      { id: 'u3', type: 'user', content: 'branch b', parentToolUseId: 'tu1' },
    ]);
    const root = graph.scenes.find((s) => s.id === 'scn_u1')!;
    expect(root.childSceneIds.sort()).toEqual(['scn_u2', 'scn_u3']);
    expect(graph.edges.filter((e) => e.kind === 'fork')).toHaveLength(2);
    expect(root.tools.map((t) => t.name).sort()).toEqual(['Read', 'Write']);
  });

  test('cycle via parentToolUseId is broken as orphaned', () => {
    const graph = projectSessionScenes('s1', [
      { id: 'u1', type: 'user', content: 'one', parentToolUseId: 'later' },
      { id: 't1', type: 'tool', content: 'x', toolName: 'Write', toolUseId: 'first' },
      { id: 'u2', type: 'user', content: 'two', parentToolUseId: 'first' },
      { id: 't2', type: 'tool', content: 'y', toolName: 'Write', toolUseId: 'later' },
    ]);
    expect(graph.scenes.some((s) => s.orphaned)).toBe(true);
    const ids = new Set(graph.scenes.map((s) => s.id));
    for (const scene of graph.scenes) {
      const seen = new Set<string>();
      let cur: string | null = scene.id;
      while (cur) {
        expect(seen.has(cur)).toBe(false);
        seen.add(cur);
        cur = graph.scenes.find((s) => s.id === cur)?.parentSceneId ?? null;
        if (cur && !ids.has(cur)) break;
      }
    }
  });
});

describe('planFanOutJobs', () => {
  test('caps at 32 and parallel 8', () => {
    expect(planFanOutJobs(2, 5)).toEqual({ total: 10, parallelCap: FANOUT_PARALLEL });
    expect(initialFanOutStatuses(10).filter((s) => s === 'running')).toHaveLength(8);
    expect(initialFanOutStatuses(10).filter((s) => s === 'queued')).toHaveLength(2);
    expect(() => planFanOutJobs(FANOUT_MAX + 1, 1)).toThrow('cap');
    expect(() => planFanOutJobs(0, 1)).toThrow('empty');
  });
});
