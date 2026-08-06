import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { createManager } from '../manager';
import { currentPlatform, toolchainPaths } from '../manifest';
import type { ToolArtifact, ToolEntry, ToolStatus } from '../types';

const FIXTURES = path.join(import.meta.dir, 'fixtures');
const ZIP_BYTES = fs.readFileSync(path.join(FIXTURES, 'demo-1.0.0.zip'));
const ZIP_SHA256 = '256730d7e1cf9c1fbacc93b92e35a5e1d476db1fa66e09687e393e31b4968c04';
const sleepNoop = () => Promise.resolve();

let tmpDir: string;
let counter = 0;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-mgr-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeManifest(opts?: { sha256?: string }): ToolEntry[] {
  const artifact: ToolArtifact = {
    url: 'http://test.invalid/demo.zip',
    sha256: opts?.sha256 ?? ZIP_SHA256,
    size: ZIP_BYTES.byteLength,
    archive: 'zip',
    binPaths: ['bin/demo'],
  };
  return [
    {
      name: 'jq',
      version: '1.0.0',
      displayName: 'jq',
      artifacts: { [currentPlatform()]: artifact },
    },
  ];
}

function okFetch(): typeof fetch {
  return (async () =>
    new Response(ZIP_BYTES, { headers: { 'content-length': String(ZIP_BYTES.byteLength) } })) as unknown as typeof fetch;
}

function makeManager(manifest: ToolEntry[], fetchImpl: typeof fetch) {
  const configDir = path.join(tmpDir, `cfg-${counter++}`);
  const paths = toolchainPaths(configDir);
  const manager = createManager(paths, {
    manifest,
    fetchImpl,
    sleepImpl: sleepNoop,
    retryDelaysMs: [1, 1, 1],
  });
  return { manager, paths };
}

describe('manager status transitions', () => {
  it('missing -> downloading -> installing -> ready; state.json персистится', async () => {
    const { manager, paths } = makeManager(makeManifest(), okFetch());
    const seen: ToolStatus[] = [];
    manager.onStatusChange((s) => seen.push({ ...s }));

    expect((await manager.status())[0]?.phase).toBe('missing');
    const after = await manager.ensureAll({ background: false });
    const jq = after.find((s) => s.name === 'jq');
    expect(jq?.phase).toBe('ready');
    expect(jq?.installedVersion).toBe('1.0.0');
    expect(fs.existsSync(path.join(jq!.installedPath!, 'bin', 'demo'))).toBe(true);

    const phases = seen.filter((s) => s.name === 'jq').map((s) => s.phase);
    expect(phases[0]).toBe('downloading');
    expect(phases).toContain('installing');
    expect(phases.at(-1)).toBe('ready');
    // прогресс загрузки дошёл до полного размера
    const lastDownload = seen.filter((s) => s.phase === 'downloading').at(-1);
    expect(lastDownload?.downloadedBytes).toBe(ZIP_BYTES.byteLength);

    // state.json переживает рестарт
    const state = JSON.parse(fs.readFileSync(paths.stateFile, 'utf8'));
    expect(state.tools.jq.installedVersion).toBe('1.0.0');
  });

  it('повторный ensureAll ничего не ставит (актуальная версия)', async () => {
    const { manager } = makeManager(makeManifest(), okFetch());
    await manager.ensureAll({ background: false });
    let downloads = 0;
    manager.onStatusChange((s) => {
      if (s.phase === 'downloading') downloads++;
    });
    const snapshot = await manager.ensureAll({ background: false });
    expect(snapshot[0]?.phase).toBe('ready');
    expect(downloads).toBe(0);
  });

  it('bump версии в манифесте -> outdated -> переустановка -> ready', async () => {
    const { manager, paths } = makeManager(makeManifest(), okFetch());
    await manager.ensureAll({ background: false });

    const bumped = makeManifest().map((e) => ({ ...e, version: '2.0.0' }));
    const manager2 = createManager(paths, {
      manifest: bumped,
      fetchImpl: okFetch(),
      sleepImpl: sleepNoop,
      retryDelaysMs: [1],
    });
    expect((await manager2.status())[0]?.phase).toBe('outdated');
    const after = await manager2.ensureAll({ background: false });
    expect(after[0]?.phase).toBe('ready');
    expect(after[0]?.installedVersion).toBe('2.0.0');
    // старая версия вычищена
    expect(fs.existsSync(path.join(paths.toolchainDir, 'jq', '1.0.0'))).toBe(false);
    expect(fs.existsSync(path.join(paths.toolchainDir, 'jq', '2.0.0'))).toBe(true);
  });

  it('sha256 mismatch -> phase error, partial не остаётся', async () => {
    const bad = makeManifest({ sha256: '0'.repeat(64) });
    const { manager, paths } = makeManager(bad, okFetch());
    const after = await manager.ensureAll({ background: false });
    const jq = after.find((s) => s.name === 'jq');
    expect(jq?.phase).toBe('error');
    expect(jq?.error).toContain('sha256 mismatch');
    const partialDir = path.join(paths.downloadsDir, 'partial');
    expect(fs.existsSync(path.join(partialDir, 'jq-1.0.0'))).toBe(false);
    expect(fs.existsSync(path.join(partialDir, 'jq-1.0.0.partial'))).toBe(false);
  });

  it('сетевой сбой -> phase offline', async () => {
    const offlineFetch = (async () => {
      throw new Error('ENOTFOUND');
    }) as unknown as typeof fetch;
    const { manager } = makeManager(makeManifest(), offlineFetch);
    const after = await manager.ensureAll({ background: false });
    expect(after.find((s) => s.name === 'jq')?.phase).toBe('offline');
    // и в свежем status() (после «рестарта» эмиттера) — missing, т.к. на диске пусто
    const fresh = createManager(
      toolchainPaths(path.join(tmpDir, `cfg-${counter++}`)),
      { manifest: makeManifest(), fetchImpl: offlineFetch, sleepImpl: sleepNoop, retryDelaysMs: [1] },
    );
    expect((await fresh.status()).find((s) => s.name === 'jq')?.phase).toBe('missing');
  });

  it('инструмент без артефакта под платформу: git -> ready/system если есть в PATH, иначе missing', async () => {
    const gitEntry: ToolEntry[] = [
      { name: 'git', version: '2.0', displayName: 'git', artifacts: {} },
    ];
    const { manager } = makeManager(gitEntry, okFetch());
    const git = (await manager.status()).find((s) => s.name === 'git');
    // системного git на mac/linux почти всегда есть; на его отсутствии допускаем missing
    const gitPhase = git?.phase ?? 'missing';
    const allowed: ToolStatus['phase'][] = ['ready', 'missing'];
    expect(allowed).toContain(gitPhase);
    if (git?.phase === 'ready') expect(git.installedVersion).toBe('system');
  });

  it('background: ensureAll возвращает snapshot сразу, ensureIdle ждёт волну', async () => {
    const { manager } = makeManager(makeManifest(), okFetch());
    const snapshot = await manager.ensureAll({ background: true });
    expect(snapshot.length).toBeGreaterThan(0);
    await manager.ensureIdle();
    const final = await manager.status();
    expect(final.find((s) => s.name === 'jq')?.phase).toBe('ready');
  });

  it('update(): принудительная переустановка даёт ready', async () => {
    const { manager } = makeManager(makeManifest(), okFetch());
    const status = await manager.update('jq');
    expect(status.phase).toBe('ready');
    expect(status.installedVersion).toBe('1.0.0');
  });
});
