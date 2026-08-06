/**
 * Резолвер исполняемых файлов.
 * Приоритет: toolchain (установленные менеджером) → PATH.
 *
 * Bundled-бинарники (claude/uv/ripgrep/bun из Electron-бандла) сюда НЕ вшиты:
 * их каталоги добавляются в PATH сабпроцесса интеграционным слоем
 * (injector при спавне агента) — shared-пакет не знает layout бандла.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { TOOLCHAIN_MANIFEST } from './manifest';
import type { ToolchainPaths, ToolchainPlatform, ToolchainResolver } from './types';

const isWindows = process.platform === 'win32';

/** Имена-кандидаты для поиска: на Windows исполняемый файл имеет расширение (.exe/.cmd/.bat). */
function candidateNames(name: string, win = isWindows): string[] {
  if (!win) return [name];
  return /\.(exe|cmd|bat)$/i.test(name) ? [name] : [`${name}.exe`, `${name}.cmd`, name];
}

/** Файл существует и исполняем (на win32 — просто существует). */
async function isExecutable(file: string, win = isWindows): Promise<boolean> {
  try {
    await fs.promises.access(file, win ? fs.constants.F_OK : fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export interface ResolverOptions {
  manifest?: typeof TOOLCHAIN_MANIFEST;
  /** DI вместо process.env.PATH (тесты). */
  pathEnv?: string;
  /** DI вместо process.platform (тесты win-семантики на unix). */
  platform?: NodeJS.Platform;
}

/** Собрать ссылку toolchain/<tool>/current → пути кандидатов по binPaths манифеста. */
async function toolchainCandidates(
  paths: ToolchainPaths,
  manifest: typeof TOOLCHAIN_MANIFEST,
  name: string,
  win = isWindows,
  platform: ToolchainPlatform | null = null,
): Promise<string[]> {
  const baseNames = new Set(candidateNames(name, win));
  const found: string[] = [];
  for (const entry of manifest) {
    const artifacts = [
      // только артефакт текущей платформы; null/legacy — весь набор (тесты)
      ...(platform ? [entry.artifacts[platform]] : Object.values(entry.artifacts)),
    ];
    for (const artifact of artifacts) {
      if (!artifact) continue;
      for (const binRel of artifact.binPaths) {
        const base = path.basename(binRel);
        if (!baseNames.has(base.replace(/\.(exe|cmd|bat)$/i, '')) && !baseNames.has(base)) continue;
        found.push(path.join(paths.toolchainDir, entry.name, 'current', binRel));
      }
    }
  }
  return found;
}

/** PATH-поиск («which» кросс-платформенный). */
async function findInPath(name: string, pathEnv: string | undefined, win = isWindows): Promise<string | null> {
  const dirs = (pathEnv ?? '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const candidate of candidateNames(name, win)) {
      const full = path.join(dir, candidate);
      if (await isExecutable(full, win)) return full;
    }
  }
  return null;
}

export function createResolver(
  paths: ToolchainPaths,
  opts: ResolverOptions = {},
): ToolchainResolver {
  const manifest = opts.manifest ?? TOOLCHAIN_MANIFEST;
  const win = (opts.platform ?? process.platform) === 'win32';
  // Текущая платформа в терминах манифеста: бинарники других платформ в
  // resolver/PATH-prefix не протекают (P3: раньше Object.values брал всех).
  const platName = opts.platform ?? process.platform;
  const platArch = process.arch;
  const platformKey: ToolchainPlatform | null =
    platName === 'darwin'
      ? platArch === 'arm64'
        ? 'darwin-arm64'
        : 'darwin-x64'
      : platName === 'win32'
        ? 'win32-x64'
        : platName === 'linux'
          ? 'linux-x64'
          : null;

  return {
    async findExecutable(name: string): Promise<string | null> {
      // 1) toolchain: <toolchainDir>/<tool>/current/<binPath>
      for (const candidate of await toolchainCandidates(paths, manifest, name, win, platformKey)) {
        if (await isExecutable(candidate, win)) return candidate;
      }
      // 2) PATH
      return findInPath(name, opts.pathEnv ?? process.env.PATH, win);
    },

    /** Префикс PATH для сабпроцессов агентов: bin-директории установленных инструментов. */
    async toolchainPathPrefix(): Promise<string> {
      const dirs = new Set<string>();
      for (const entry of manifest) {
        let installed = false;
        try {
          installed = fs.existsSync(path.join(paths.toolchainDir, entry.name, 'current'));
        } catch {
          installed = false;
        }
        if (!installed) continue;
        const prefixArtifacts = platformKey
          ? [entry.artifacts[platformKey]]
          : Object.values(entry.artifacts);
        for (const artifact of prefixArtifacts) {
          if (!artifact) continue;
          for (const binRel of artifact.binPaths) {
            dirs.add(path.dirname(path.join(paths.toolchainDir, entry.name, 'current', binRel)));
          }
        }
      }
      return [...dirs].join(path.delimiter);
    },

    toolchainDir(): string {
      return paths.toolchainDir;
    },
  };
}
