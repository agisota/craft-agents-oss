import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { createManager } from '../manager';
import type { BrewInstallContext } from '../manager';
import { currentPlatform, toolchainPaths } from '../manifest';
import type { ToolArtifact, ToolEntry, ToolName } from '../types';

const FIXTURES = path.join(import.meta.dir, 'fixtures');
const ZIP_BYTES = fs.readFileSync(path.join(FIXTURES, 'demo-1.0.0.zip'));
const ZIP_SHA256 = '256730d7e1cf9c1fbacc93b92e35a5e1d476db1fa66e09687e393e31b4968c04';
const sleepNoop = () => Promise.resolve();

let tmpDir: string;
let counter = 0;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-kinds-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function demoArtifact(): ToolArtifact {
  return {
    url: 'http://test.invalid/demo.zip',
    sha256: ZIP_SHA256,
    size: ZIP_BYTES.byteLength,
    archive: 'zip',
    binPaths: ['bin/demo'],
  };
}

/**
 * jq = core (tier не указан — дефолт 'core'), fzf = default-on, skills = opt-in.
 * Все binary на одном zip-фикстуре; сети нет (fetch подменён).
 */
function tierManifest(): ToolEntry[] {
  const plat = currentPlatform();
  return [
    { name: 'jq', version: '1.0.0', displayName: 'jq', artifacts: { [plat]: demoArtifact() } },
    { name: 'fzf', version: '1.0.0', tier: 'default-on', displayName: 'fzf', artifacts: { [plat]: demoArtifact() } },
    {
      name: 'skills',
      version: '1.0.0',
      tier: 'opt-in',
      displayName: 'skills',
      artifacts: { [plat]: demoArtifact() },
    },
  ];
}

function makeManager(
  manifest: ToolEntry[],
  opts: { disabledTools?: ToolName[]; pathEnv?: string; brewInstallImpl?: (ctx: BrewInstallContext) => Promise<void> } = {},
) {
  const configDir = path.join(tmpDir, `cfg-${counter++}`);
  const paths = toolchainPaths(configDir);
  const fetchCalls: string[] = [];
  const fetchImpl = (async (input: unknown) => {
    fetchCalls.push(String(input));
    return new Response(ZIP_BYTES, { headers: { 'content-length': String(ZIP_BYTES.byteLength) } });
  }) as unknown as typeof fetch;
  const manager = createManager(paths, {
    manifest,
    fetchImpl,
    sleepImpl: sleepNoop,
    retryDelaysMs: [1, 1, 1],
    disabledTools: opts.disabledTools,
    pathEnv: opts.pathEnv,
    brewInstallImpl: opts.brewInstallImpl,
  });
  return { manager, paths, fetchCalls };
}

describe('kinds: tier-фильтр ensureAll', () => {
  it('core ставится всегда; default-on — если не disabled; opt-in — никогда', async () => {
    const { manager, fetchCalls } = makeManager(tierManifest());
    const after = await manager.ensureAll({ background: false });
    expect(after.find((s) => s.name === 'jq')?.phase).toBe('ready');
    expect(after.find((s) => s.name === 'fzf')?.phase).toBe('ready');
    // opt-in игнорируется ensureAll даже без disabled-списка
    expect(after.find((s) => s.name === 'skills')?.phase).toBe('missing');
    // скачивались только jq и fzf
    expect(fetchCalls).toHaveLength(2);
  });

  it("disabled=['fzf']: default-on из списка пропускается, core ставится; очистка списка доустанавливает", async () => {
    const { manager, fetchCalls } = makeManager(tierManifest(), { disabledTools: ['fzf'] });
    const after = await manager.ensureAll({ background: false });
    expect(after.find((s) => s.name === 'jq')?.phase).toBe('ready');
    expect(after.find((s) => s.name === 'fzf')?.phase).toBe('missing');
    expect(fetchCalls).toHaveLength(1); // только core
    expect(manager.getDisabledTools()).toEqual(['fzf']);

    manager.setDisabledTools([]);
    expect(manager.getDisabledTools()).toEqual([]);
    const rerun = await manager.ensureAll({ background: false });
    expect(rerun.find((s) => s.name === 'fzf')?.phase).toBe('ready');
    expect(fetchCalls).toHaveLength(2); // jq не перекачивается, fzf доустановился
  });

  it('brew без префлайта (brew не на PATH) -> skipped-no-brew, brew install не вызывается', async () => {
    let brewCalls = 0;
    const { manager } = makeManager(
      [
        {
          name: 'mole',
          version: '1.49.2',
          kind: 'brew',
          tier: 'opt-in',
          displayName: 'mole',
          systemBinary: 'mole',
          brewFormula: 'mole',
          artifacts: {},
        },
      ],
      {
        // Изоляция от хоста: на dev-машине /opt/homebrew/bin/brew существует —
        // пустой pathEnv делает префлайт детерминированно непройденным.
        pathEnv: '',
        brewInstallImpl: async () => {
          brewCalls++;
        },
      },
    );

    // ensureAll brew-kind не планирует вовсе (kind brew — только через update)
    await manager.ensureAll({ background: false });
    expect(brewCalls).toBe(0);

    // статус: ни системного mole, ни brew на PATH → skipped-no-brew (а не missing)
    expect((await manager.status()).find((s) => s.name === 'mole')?.phase).toBe('skipped-no-brew');

    // update — единственный путь установки opt-in/brew — тоже упирается в префлайт
    const st = await manager.update('mole');
    expect(st.phase).toBe('skipped-no-brew');
    expect(brewCalls).toBe(0);
  });
});
