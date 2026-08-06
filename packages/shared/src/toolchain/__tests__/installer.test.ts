import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { extractArtifact, installTool } from '../installer';
import { toolchainPaths } from '../manifest';

const FIXTURES = path.join(import.meta.dir, 'fixtures');
const isWindows = process.platform === 'win32';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-inst-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function assertExecBits(file: string): void {
  if (isWindows) return;
  expect(fs.statSync(file).mode & 0o111).not.toBe(0);
}

describe('installer', () => {
  it('extract tar.gz: раскладывает дерево', async () => {
    const dest = path.join(tmpDir, 'tgz');
    await extractArtifact(path.join(FIXTURES, 'demo-1.0.0.tar.gz'), 'tar.gz', dest);
    expect(fs.readFileSync(path.join(dest, 'bin', 'demo'), 'utf8')).toContain('fixture-bin');
    expect(fs.existsSync(path.join(dest, 'README.txt'))).toBe(true);
  });

  it('extract zip: раскладывает дерево', async () => {
    const dest = path.join(tmpDir, 'zip');
    await extractArtifact(path.join(FIXTURES, 'demo-1.0.0.zip'), 'zip', dest);
    expect(fs.readFileSync(path.join(dest, 'bin', 'demo'), 'utf8')).toContain('fixture-bin');
  });

  it('installTool (tar.gz): layout, chmod +x, current symlink, cleanup старых версий', async () => {
    const configDir = path.join(tmpDir, 'cfg-tgz');
    const paths = toolchainPaths(configDir);
    // притворимся, что стоит старая версия
    const oldDir = path.join(paths.toolchainDir, 'jq', '0.9.0');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'stale'), 'x');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'stale'), 'x');

    const src = path.join(tmpDir, 'demo-1.0.0-download.tar.gz');
    fs.copyFileSync(path.join(FIXTURES, 'demo-1.0.0.tar.gz'), src);
    const result = await installTool(paths, 'jq', '1.0.0', src, {
      url: 'file://fixture',
      sha256: 'unused',
      size: 1,
      archive: 'tar.gz',
      binPaths: ['bin/demo'],
    });

    expect(result.installedVersion).toBe('1.0.0');
    expect(result.installedPath).toBe(path.join(paths.toolchainDir, 'jq', '1.0.0'));
    const binFile = path.join(result.installedPath, 'bin', 'demo');
    expect(fs.existsSync(binFile)).toBe(true);
    assertExecBits(binFile);
    // current указывает на новую версию
    const current = path.join(paths.toolchainDir, 'jq', 'current');
    expect(fs.existsSync(path.join(current, 'bin', 'demo'))).toBe(true);
    if (!isWindows) expect(fs.lstatSync(current).isSymbolicLink()).toBe(true);
    // исходник артефакта удалён
    expect(fs.existsSync(src)).toBe(false);
    // старая версия вычищена
    expect(fs.existsSync(oldDir)).toBe(false);
  });

  it('installTool (raw): кладёт бинарник по binPaths и делает его исполняемым', async () => {
    const configDir = path.join(tmpDir, 'cfg-raw');
    const paths = toolchainPaths(configDir);
    const src = path.join(tmpDir, `raw-${process.pid}.bin`);
    fs.copyFileSync(path.join(FIXTURES, 'demo-raw.bin'), src);
    const result = await installTool(paths, 'jq', '2.0.0', src, {
      url: 'file://fixture',
      sha256: 'unused',
      size: 1,
      archive: 'raw',
      binPaths: ['bin/jq'],
    });
    const binFile = path.join(result.installedPath, 'bin', 'jq');
    expect(fs.readFileSync(binFile, 'utf8')).toContain('raw');
    assertExecBits(binFile);
    expect(fs.existsSync(path.join(paths.toolchainDir, 'jq', 'current', 'bin', 'jq'))).toBe(true);
  });

  it('installTool (npm tarball): генерирует именованные лончеры из package.json bin', async () => {
    // нпм-пакет как у omp: package/package.json с bin { demo-cli: dist/cli.js }
    const pkgRoot = path.join(tmpDir, 'npm-fixture', 'package');
    fs.mkdirSync(path.join(pkgRoot, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(pkgRoot, 'package.json'),
      JSON.stringify({ name: 'demo-cli', version: '1.0.0', bin: { 'demo-cli': 'dist/cli.js' } }),
    );
    fs.writeFileSync(path.join(pkgRoot, 'dist', 'cli.js'), '#!/usr/bin/env bun\nconsole.log(1)\n', {
      mode: 0o755,
    });
    const tarball = path.join(tmpDir, `npm-fixture-${process.pid}.tar.gz`);
    const tar = Bun.spawn(['tar', '-czf', tarball, '-C', path.join(tmpDir, 'npm-fixture'), 'package']);
    expect(await tar.exited).toBe(0);

    const configDir = path.join(tmpDir, 'cfg-npm');
    const paths = toolchainPaths(configDir);
    const result = await installTool(paths, 'omp', '1.0.0', tarball, {
      url: 'file://fixture',
      sha256: 'unused',
      size: 1,
      archive: 'tar.gz',
      binPaths: ['bin/demo-cli'],
    });
    const launcher = path.join(result.installedPath, 'bin', 'demo-cli');
    expect(fs.existsSync(launcher)).toBe(true);
    const content = fs.readFileSync(launcher, 'utf8');
    expect(content).toContain('"$DIR/../package/dist/cli.js"');
    expect(content).toContain('CRAFT_BUN_PATH');
    if (!isWindows) {
      assertExecBits(launcher);
      expect(fs.lstatSync(launcher).mode & 0o755).not.toBe(0);
    }
    // windows-вариант генерируется всегда
    expect(fs.existsSync(path.join(result.installedPath, 'bin', 'demo-cli.cmd'))).toBe(true);
  });
});
