import { describe, expect, test } from 'bun:test';
import { initialFanOutStatuses, planFanOutJobs, projectSessionScenes } from '../session-scene-graph.ts';

describe('projectSessionScenes', () => {
  test('nests tools under the user scene', () => {
    const graph = projectSessionScenes('s1', [
      { id: 'u1', type: 'user', content: 'ship it' },
      { id: 'a1', type: 'assistant', content: 'ok' },
      { id: 't1', type: 'tool', content: 'wrote', toolName: 'Write', toolUseId: 'tu1' },
    ]);
    expect(graph.scenes).toHaveLength(1);
    expect(graph.scenes[0]!.tools[0]!.name).toBe('Write');
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
});

describe('planFanOutJobs', () => {
  test('caps at 32 and parallel 8', () => {
    expect(planFanOutJobs(2, 5)).toEqual({ total: 10, parallelCap: 8 });
    expect(() => planFanOutJobs(33, 1)).toThrow('cap');
    const st = initialFanOutStatuses(10);
    expect(st.filter((s) => s === 'running')).toHaveLength(8);
    expect(st.filter((s) => s === 'queued')).toHaveLength(2);
  });
});
