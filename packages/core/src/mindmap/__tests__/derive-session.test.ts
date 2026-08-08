import { describe, expect, test } from 'bun:test';
import { deriveSessionMindMap, groupSessionTurns } from '../derive-session.ts';

describe('groupSessionTurns', () => {
  test('groups user then assistant/tools', () => {
    const turns = groupSessionTurns([
      { id: 'u1', type: 'user', content: 'Hi' },
      { id: 'a1', type: 'assistant', content: 'Hello' },
      { id: 't1', type: 'tool', content: '', toolName: 'bash', toolUseId: 'tu1' },
      { id: 'u2', type: 'user', content: 'Next' },
    ]);
    expect(turns).toHaveLength(2);
    expect(turns[0]!.user.id).toBe('u1');
    expect(turns[0]!.rest.map((m) => m.id)).toEqual(['a1', 't1']);
    expect(turns[1]!.user.id).toBe('u2');
  });
});

describe('deriveSessionMindMap', () => {
  test('builds turn tree with tools under assistant', () => {
    const graph = deriveSessionMindMap({
      sessionId: 's1',
      title: 'Research',
      now: 1000,
      messages: [
        { id: 'u1', type: 'user', content: 'Look up X', turnId: 't1' },
        { id: 'a1', type: 'assistant', content: 'Searching', turnId: 't1' },
        {
          id: 'tool1',
          type: 'tool',
          content: 'ok',
          toolName: 'web_search',
          toolUseId: 'tu1',
          turnId: 't1',
        },
        { id: 'u2', type: 'user', content: 'Summarize', turnId: 't2' },
        { id: 'a2', type: 'assistant', content: 'Done', turnId: 't2' },
      ],
    });

    expect(graph.entity).toEqual({ type: 'session', sessionId: 's1' });
    expect(graph.derivation).toBe('outline');
    expect(graph.derivedAt).toBe(1000);
    expect(graph.contentHash).toMatch(/^[0-9a-f]+$/);

    const root = graph.nodes[graph.rootId]!;
    expect(root.label).toBe('Research');
    expect(root.children).toHaveLength(2);

    const turn1 = graph.nodes[root.children[0]!]!;
    expect(turn1.kind).toBe('turn');
    expect(turn1.label).toContain('Look up');
    expect(turn1.source).toEqual({ kind: 'message', id: 'u1' });

    const assistant = graph.nodes[turn1.children[0]!]!;
    expect(assistant.id).toBe('msg:a1');
    expect(assistant.children.some((id) => id === 'tool:tu1')).toBe(true);
    expect(graph.nodes['tool:tu1']!.label).toBe('web_search');
  });

  test('truncates to maxTurns and sets meta', () => {
    const messages = [];
    for (let i = 0; i < 5; i++) {
      messages.push({ id: `u${i}`, type: 'user', content: `Q${i}` });
      messages.push({ id: `a${i}`, type: 'assistant', content: `A${i}` });
    }
    const graph = deriveSessionMindMap({
      sessionId: 's2',
      title: 'Long',
      messages,
      maxTurns: 2,
      now: 1,
    });
    const root = graph.nodes[graph.rootId]!;
    expect(root.children).toHaveLength(2);
    expect(root.meta?.truncated).toBe(true);
    expect(root.meta?.turnCount).toBe(5);
    // last two user questions
    expect(graph.nodes[root.children[0]!]!.label).toContain('Q3');
    expect(graph.nodes[root.children[1]!]!.label).toContain('Q4');
  });

  test('stable hash for identical input', () => {
    const input = {
      sessionId: 's3',
      title: 'T',
      now: 1,
      messages: [
        { id: 'u1', type: 'user', content: 'Hi' },
        { id: 'a1', type: 'assistant', content: 'Yo' },
      ],
    };
    expect(deriveSessionMindMap(input).contentHash).toBe(deriveSessionMindMap(input).contentHash);
  });

  test('skips status/compaction noise', () => {
    const graph = deriveSessionMindMap({
      sessionId: 's4',
      title: 'T',
      now: 1,
      messages: [
        { id: 'u1', type: 'user', content: 'Hi' },
        { id: 'st', type: 'assistant', content: '…', statusType: 'compacting' },
        { id: 'a1', type: 'assistant', content: 'Ok' },
      ],
    });
    const turn = graph.nodes[graph.nodes[graph.rootId]!.children[0]!]!;
    expect(turn.children).toEqual(['msg:a1']);
  });
});
