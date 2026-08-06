/**
 * Установка артефактов toolchain: распаковка архивов, chmod, layout
 * toolchain/<tool>/<version>/ + атомарное переключение `current` (symlink /
 * junction / копия на win32), cleanup старых версий и partial-файлов.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { ToolArtifact, ToolName, ToolchainPaths } from './types';

const isWindows = process.platform === 'win32';

/** Спавн системной команды; reject с stderr при ненулевом exit-code. */
async function run(cmd: string[], opts?: { cwd?: string }): Promise<void> {
  const proc = Bun.spawn(cmd, {
    cwd: opts?.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`command failed (${cmd.join(' ')}): ${stderr.trim()}`);
  }
}

/**
 * Распаковать архив в destDir.
 * tar.gz/tar.xz/zip — системный tar (bsdtar на macOS читает и zip);
 * на win32 — PowerShell Expand-Archive. `raw` — голый файл.
 */
export async function extractArtifact(
  archiveFile: string,
  archive: Exclude<ToolArtifact['archive'], 'uv-python'>,
  destDir: string,
): Promise<void> {
  await fs.promises.mkdir(destDir, { recursive: true });
  switch (archive) {
    case 'tar.gz':
      await run(['tar', '-xzf', archiveFile, '-C', destDir]);
      return;
    case 'tar.xz':
      await run(['tar', '-xJf', archiveFile, '-C', destDir]);
      return;
    case 'zip':
      if (isWindows) {
        await run([
          'powershell',
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath '${archiveFile.replaceAll("'", "''")}' -DestinationPath '${destDir.replaceAll("'", "''")}' -Force`,
        ]);
      } else {
        await run(['tar', '-xf', archiveFile, '-C', destDir]);
      }
      return;
    case 'raw':
      // голый бинарник: кладём как <destDir>/bin/<basename>; имя бинарника
      // задаётся binPaths запись манифеста на этапе installTool
      throw new Error('raw artifacts are handled by installTool, not extractArtifact');
    default:
      throw new Error(`unsupported archive type: ${archive satisfies never}`);
  }
}

/**
 * npm-тарболлы кладут исполняемый файл как js (например package/dist/cli.js),
 * а имя CLI задаётся в package.json bin. Генерируем лончеры в <versionDir>/bin/
 * с правильным именем (bin/omp, bin/omp.cmd), чтобы резолвер находил их как
 * обычный исполняемый файл. Bun для запуска: CRAFT_BUN_PATH env → toolchain
 * bun → bun из PATH.
 */
async function generateNpmWrappers(toolDir: string): Promise<string[]> {
  const pkgFile = path.join(toolDir, 'package', 'package.json');
  let pkgBin: Record<string, string> | undefined;
  try {
    const pkg = JSON.parse(await fs.promises.readFile(pkgFile, 'utf8'));
    pkgBin = typeof pkg.bin === 'string' ? { [pkg.name ?? 'bin']: pkg.bin } : pkg.bin;
  } catch {
    return [];
  }
  if (!pkgBin || typeof pkgBin !== 'object') return [];

  const binDir = path.join(toolDir, 'bin');
  await fs.promises.mkdir(binDir, { recursive: true });
  const created: string[] = [];
  for (const [name, rel] of Object.entries(pkgBin)) {
    if (typeof rel !== 'string' || !rel) continue;
    // unix wrapper: ../package/<rel> относительно bin/
    const sh =
      '#!/bin/sh\n' +
      'DIR="$(cd "$(dirname "$0")" && pwd)"\n' +
      'if [ -n "$CRAFT_BUN_PATH" ] && [ -x "$CRAFT_BUN_PATH" ]; then\n' +
      '  BUN="$CRAFT_BUN_PATH"\n' +
      'else\n' +
      '  BUN=""\n' +
      '  for c in "$DIR"/../../../bun/current/bun "$DIR"/../../../bun/current/*/bun; do\n' +
      '    if [ -x "$c" ]; then BUN="$c"; break; fi\n' +
      '  done\n' +
      '  [ -z "$BUN" ] && BUN="bun"\n' +
      'fi\n' +
      `exec "$BUN" "$DIR/../package/${rel}" "$@"\n`;
    await fs.promises.writeFile(path.join(binDir, name), sh, { mode: 0o755 });
    created.push(path.join('bin', name));
    // windows wrapper
    const cmd =
      '@echo off\r\n' +
      'setlocal\r\n' +
      'set "BUN=%CRAFT_BUN_PATH%"\r\n' +
      'if "%BUN%"=="" if exist "%~dp0..\\..\\..\\bun\\current\\bun-windows-x64\\bun.exe" set "BUN=%~dp0..\\..\\..\\bun\\current\\bun-windows-x64\\bun.exe"\r\n' +
      'if "%BUN%"=="" set "BUN=bun"\r\n' +
      `"%BUN%" "%~dp0..\\package\\${rel.replace(/\//g, '\\')}" %*\r\n`;
    await fs.promises.writeFile(path.join(binDir, `${name}.cmd`), cmd);
    created.push(path.join('bin', `${name}.cmd`));
  }
  return created;
}

/**
 * `bun install` в распакованном npm-пакете: поставляет зависимости артефакта
 * (в т.ч. optional native-пакеты вроде @oh-my-pi/pi-natives), без которых
 * tarball сам по себе неработоспособен. Bun: CRAFT_BUN_PATH env → toolchain
 * bun → PATH. Вызывается только для npm-пакетов (есть package/package.json bin).
 */
async function npmInstallDeps(paths: ToolchainPaths, toolDir: string): Promise<void> {
  const envBun = process.env.CRAFT_BUN_PATH?.trim();
  let bunExe: string | undefined = envBun && fs.existsSync(envBun) ? envBun : undefined;
  if (!bunExe && !isWindows) {
    const bunRoot = path.join(paths.toolchainDir, 'bun', 'current');
    try {
      for (const entry of await fs.promises.readdir(bunRoot)) {
        const candidate = path.join(bunRoot, entry, 'bun');
        if (fs.existsSync(candidate)) {
          bunExe = candidate;
          break;
        }
      }
    } catch {
      // toolchain bun ещё не установлен
    }
    bunExe ??= Bun.which('bun') ?? undefined;
  }
  if (!bunExe) {
    throw new Error('bun not found: cannot install npm deps (CRAFT_BUN_PATH / toolchain bun / PATH)');
  }
  const pkgDir = path.join(toolDir, 'package');
  const proc = Bun.spawn([bunExe, 'install', '--production'], {
    cwd: pkgDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (code !== 0) {
    throw new Error(`npm deps install failed (bun install --production): ${stderr.trim()}`);
  }
}

/** chmod +x всем binPaths (unix). Windows не требует. */
async function chmodBins(toolDir: string, binPaths: string[]): Promise<void> {

  for (const rel of binPaths) {
    const file = path.join(toolDir, rel);
    try {
      const stat = await fs.promises.stat(file);
      await fs.promises.chmod(file, stat.mode | 0o755);
    } catch {
      // бинарника нет в дереве — не фатально (npx-симлинки и т.п.)
    }
  }
}

/** Переключить `current` на новую версию атомарно (junction/copy fallback на win32). */
export async function flipCurrent(toolRoot: string, version: string, versionDir: string): Promise<void> {
  const currentLink = path.join(toolRoot, 'current');
  const tmpLink = path.join(toolRoot, `.current.tmp-${process.pid}`);
  await fs.promises.rm(tmpLink, { recursive: true, force: true });
  try {
    if (isWindows) {
      // junction не требует прав администратора
      await fs.promises.symlink(versionDir, tmpLink, 'junction');
    } else {
      await fs.promises.symlink(version, tmpLink); // относительный — переносимо
    }
    await fs.promises.rm(currentLink, { recursive: true, force: true });
    await fs.promises.rename(tmpLink, currentLink);
  } catch (error) {
    await fs.promises.rm(tmpLink, { recursive: true, force: true });
    // Windows-fallback: если symlink запрещён политикой — копируем дерево
    if (!isWindows) throw error;
    await fs.promises.rm(currentLink, { recursive: true, force: true });
    await fs.promises.cp(versionDir, currentLink, { recursive: true });
  }
}

/** Удалить все кроме указанной версии + partial-файлы в downloads. */
export async function cleanupOldVersions(toolRoot: string, keepVersion: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.promises.readdir(toolRoot);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === keepVersion || entry === 'current' || entry.startsWith('.current.tmp')) continue;
    await fs.promises.rm(path.join(toolRoot, entry), { recursive: true, force: true });
  }
}

export interface InstallResult {
  installedPath: string;
  installedVersion: string;
}

/**
 * Установить уже скачанный и проверенный артефакт:
 * распаковка -> toolchain/<tool>/<version> -> flip `current` -> cleanup.
 */
export async function installTool(
  paths: ToolchainPaths,
  tool: ToolName,
  version: string,
  artifactFile: string,
  artifact: ToolArtifact,
): Promise<InstallResult> {
  if (artifact.archive === 'uv-python') {
    throw new Error('uv-python artifacts are installed by manager via bundled uv');
  }
  const toolRoot = path.join(paths.toolchainDir, tool);
  const versionDir = path.join(toolRoot, version);
  await fs.promises.rm(versionDir, { recursive: true, force: true });

  if (artifact.archive === 'raw') {
    // голый бинарник кладём по первому binPath записи манифеста
    const binRel = artifact.binPaths[0] ?? path.join('bin', tool);
    const dest = path.join(versionDir, binRel);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(artifactFile, dest);
  } else {
    await extractArtifact(artifactFile, artifact.archive, versionDir);
    // npm-пакеты: именованные лончеры bin/<name>[.cmd] по package.json bin…
    const wrappers = await generateNpmWrappers(versionDir);
    if (wrappers.length > 0) {
      // …и npm-зависимости (pi-natives и др. — тарболл один неработоспособен).
      await npmInstallDeps(paths, versionDir);
    }
  }
  await chmodBins(versionDir, artifact.binPaths);
  await flipCurrent(toolRoot, version, versionDir);
  await cleanupOldVersions(toolRoot, version);
  // partial/исходник артефакта больше не нужен
  await fs.promises.rm(artifactFile, { force: true });

  return { installedPath: versionDir, installedVersion: version };
}
