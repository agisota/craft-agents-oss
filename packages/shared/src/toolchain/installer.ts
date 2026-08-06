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

/** chmod +x всем binPaths (unix). Windows не требует. */
async function chmodBins(toolDir: string, binPaths: string[]): Promise<void> {
  if (isWindows) return;
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
async function flipCurrent(toolRoot: string, version: string, versionDir: string): Promise<void> {
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
async function cleanupOldVersions(toolRoot: string, keepVersion: string): Promise<void> {
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
  }
  await chmodBins(versionDir, artifact.binPaths);
  await flipCurrent(toolRoot, version, versionDir);
  await cleanupOldVersions(toolRoot, version);
  // partial/исходник артефакта больше не нужен
  await fs.promises.rm(artifactFile, { force: true });

  return { installedPath: versionDir, installedVersion: version };
}
