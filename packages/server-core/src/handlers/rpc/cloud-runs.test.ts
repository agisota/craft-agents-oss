/**
 * Handler-level test for cloud-runs RPC surface (local provider leg).
 *
 * Runs against a temp CRAFT_CONFIG_DIR with an enabled local provider:
 * submit → status → import → aggregate; no mocks of the provider —
 * the local runner subprocess does the work (fast stub).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile as fsWriteFile, readFile as fsReadFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CRAFT_CONFIG_DIR = await mkdtemp(join(tmpdir(), 'craft-cloud-runs-test-'));

// Dynamic imports are intentional: paths.ts captures CRAFT_CONFIG_DIR
// at module load, so the env must be set before any module under test
// is imported (module-loading boundary exception).
const { RPC_CHANNELS } = await import('@craft-agent/shared/protocol');
const { registerCloudRunsHandlers } = await import('./cloud-runs.ts');

type Handler = (ctx: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers = new Map<string, Handler>();
const fakeServer = {
  handle(channel: string, fn: Handler) {
    handlers.set(channel, fn);
  },
} as never;

const sent: { sessionId: string; message: string }[] = [];
const fakeDeps = {
  sessionManager: {
    getSession: async (sessionId: string) => ({ id: sessionId, workspaceId: 'ws-test' }),
    sendMessage: async (sessionId: string, message: string) => {
      sent.push({ sessionId, message });
    },
  },
} as never;

const configDir = process.env.CRAFT_CONFIG_DIR!;

beforeAll(async () => {
  await fsWriteFile(
    join(configDir, 'config.json'),
    JSON.stringify({
      workspaces: [],
      activeWorkspaceId: null,
      activeSessionId: null,
      cloudRuns: { enabled: true, provider: 'local' },
    }),
  );
  registerCloudRunsHandlers(fakeServer, fakeDeps);
});

afterAll(async () => {
  await rm(configDir, { recursive: true, force: true });
});

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`no handler for ${channel}`);
  return (await handler({}, ...args)) as T;
}

describe('cloud-runs rpc handlers (local provider)', () => {
  let runId = '';

  test('GET_CONFIG reflects config.json', async () => {
    const cfg = await invoke<{ enabled: boolean; provider: string }>(RPC_CHANNELS.cloudRuns.GET_CONFIG);
    expect(cfg.enabled).toBe(true);
    expect(cfg.provider).toBe('local');
  });

  test('SUBMIT → run completes with artifacts', async () => {
    const handle = await invoke<{ id: string; provider: string }>(RPC_CHANNELS.cloudRuns.SUBMIT, {
      topic: 'open source agent runtimes',
      sessionId: 'sess-1',
    });
    runId = handle.id;
    expect(runId.startsWith('research-')).toBe(true);
    expect(runId.includes('/')).toBe(false);

    // Integration test against a real runner subprocess: polling with
    // real sleeps is the point (no deterministic signal otherwise).
    for (let i = 0; i < 100; i++) {
      const status = await invoke<{ state: string }>(RPC_CHANNELS.cloudRuns.GET_STATUS, runId);
      if (status.state !== 'queued' && status.state !== 'running') {
        expect(status.state).toBe('done');
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('run did not reach terminal state');
  }, 30_000);

  test('LIST contains the submitted run', async () => {
    const list = await invoke<{ runs: { id: string; topic?: string }[] }>(RPC_CHANNELS.cloudRuns.LIST);
    expect(list.runs.some((r) => r.id === runId && r.topic === 'open source agent runtimes')).toBe(true);
  });

  test('IMPORT downloads briefs into the workspace dir', async () => {
    const result = await invoke<{ root: string; files: string[] }>(RPC_CHANNELS.cloudRuns.IMPORT, {
      runId,
      sessionId: 'sess-1',
    });
    expect(result.files.length).toBeGreaterThanOrEqual(5); // 5 research subtasks
    const sample = await fsReadFile(join(result.root, 'landscape', 'notes.md'), 'utf8');
    expect(sample).toContain('open source agent runtimes');
  });

  test('AGGREGATE sends the report prompt into the session', async () => {
    const result = await invoke<{ ok: boolean; artifactsRoot: string }>(RPC_CHANNELS.cloudRuns.AGGREGATE, {
      runId,
      sessionId: 'sess-1',
    });
    expect(result.ok).toBe(true);
    expect(sent.length).toBe(1);
    expect(sent[0]!.sessionId).toBe('sess-1');
    expect(sent[0]!.message).toContain(result.artifactsRoot);
    expect(sent[0]!.message).toContain('REPORT.md');
  });

  test('disabled feature is enforced', async () => {
    const dir2 = await mkdtemp(join(tmpdir(), 'craft-cloud-runs-off-'));
    try {
      // Flip the config off, then requireEnabled must reject SUBMIT.
      await fsWriteFile(
        join(configDir, 'config.json'),
        JSON.stringify({ workspaces: [], activeWorkspaceId: null, activeSessionId: null, cloudRuns: { enabled: false, provider: 'local' } }),
      );
      await expect(invoke(RPC_CHANNELS.cloudRuns.SUBMIT, { topic: 'x' })).rejects.toThrow(/disabled/);
    } finally {
      await fsWriteFile(
        join(configDir, 'config.json'),
        JSON.stringify({ workspaces: [], activeWorkspaceId: null, activeSessionId: null, cloudRuns: { enabled: true, provider: 'local' } }),
      );
      await rm(dir2, { recursive: true, force: true });
    }
  });
});
