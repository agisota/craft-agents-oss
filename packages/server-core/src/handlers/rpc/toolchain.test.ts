/**
 * Handler-level test for toolchain RPC surface.
 *
 * Runs against a temp CRAFT_CONFIG_DIR; no network — STATUS returns the
 * snapshot with all tools in non-mutating phases, STATUS_CHANGED push is
 * wired on registration. UPDATE is exercised only against a tool whose
 * manifest has no artifact for the current platform (no download starts).
 */
import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ToolStatus } from '@craft-agent/shared/toolchain/types';

process.env.CRAFT_CONFIG_DIR = await mkdtemp(join(tmpdir(), 'craft-toolchain-test-'));

// Dynamic imports are intentional: paths.ts captures CRAFT_CONFIG_DIR at
// module load, so the env must be set before any module under test is
// imported (module-loading boundary exception).
const { RPC_CHANNELS } = await import('@craft-agent/shared/protocol');
const { registerToolchainHandlers, HANDLED_CHANNELS } = await import('./toolchain.ts');

type Handler = (ctx: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers: Record<string, Handler> = {};
const pushes: { channel: string; payload: unknown }[] = [];
const fakeServer = {
  handle(channel: string, fn: Handler) {
    handlers[channel] = fn;
  },
  push(channel: string, _target: unknown, payload: unknown) {
    pushes.push({ channel, payload });
  },
} as never;

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> => {
  const fn = handlers[channel];
  if (!fn) throw new Error(`no handler for ${channel}`);
  return fn(null, ...args) as Promise<T>;
};

registerToolchainHandlers(fakeServer, {} as never);

const VALID_PHASES: Record<string, true> = {
  missing: true,
  downloading: true,
  installing: true,
  ready: true,
  outdated: true,
  error: true,
  offline: true,
};

describe('toolchain rpc handlers', () => {
  test('STATUS returns a snapshot of manifest tools with valid phases', async () => {
    const statuses = await invoke<ToolStatus[]>(RPC_CHANNELS.toolchain.STATUS);
    expect(Array.isArray(statuses)).toBe(true);
    // Fresh temp config: nothing installed yet and status() must not mutate —
    // every tool starts in 'missing' (or 'ready' for system-detected tools).
    for (const s of statuses) {
      expect(VALID_PHASES[s.phase]).toBe(true);
      expect(['missing', 'ready']).toContain(s.phase);
    }
  });

  test('registers every channel from HANDLED_CHANNELS', () => {
    for (const ch of HANDLED_CHANNELS) {
      expect(handlers[ch]).toBeDefined();
    }
  });

  test('UPDATE on a platform-absent tool never starts a download', async () => {
    // git ships only for win32-x64; on mac/linux update() must no-op/reject.
    if (process.platform === 'win32') return;
    const result = await invoke<ToolStatus>(RPC_CHANNELS.toolchain.UPDATE, 'git').catch(
      (e: Error) => ({ name: 'git', phase: 'error', error: e.message }) as ToolStatus,
    );
    expect(result).toBeDefined();
    expect(result.phase).not.toBe('downloading');
    expect(result.phase).not.toBe('installing');
  });
});
