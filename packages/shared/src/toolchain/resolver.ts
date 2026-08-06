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
import type { ToolchainPaths, ToolchainResolver } from './types';

const isWindows = process.platform === 'win32';

/** Имена-кандидаты для поиска: на Windows исполняемый файл имеет расширение. */
function candidateNames(name: string): string[] {
  if (!isWindows) return [name];
  return name.endsWith('.exe') ? [name] : [`${name}.exe`, name];
}

/** Файл существует и исполняем (на win32 — просто существует). */
async function isExecutable(file: string): Promise<boolean> {
  try {
    await fs.promises.access(file, isWindows ? fs.constants.F_OK : fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export interface ResolverOptions {
  manifest?: typeof TOOLCHAIN_MANIFEST;
  /** DI вместо process.env.PATH (тесты). */
  pathEnv?: string;
}

/** Собрать ссылку toolchain/<tool>/current → пути кандидатов по binPaths манифеста. */
async function toolchainCandidates(
  paths: ToolchainPaths,
  manifest: typeof TOOLCHAIN_MANIFEST,
  name: string,
): Promise<string[]> {
  const baseNames = new Set(candidateNames(name));
  const found: string[] = [];
  for (const entry of manifest) {
    for (const artifacts of Object.values(entry.artifacts)) {
      if (!artifacts) continue;
      for (const binRel of artifacts.binPaths) {
        const base = path.basename(binRel);
        if (!baseNames.has(base.replace(/\.exe$/i, '')) && !baseNames.has(base)) continue;
        found.push(path.join(paths.toolchainDir, entry.name, 'current', binRel));
      }
    }
  }
  return found;
}

/** PATH-поиск («which» кросс-платформенный). */
async function findInPath(name: string, pathEnv: string | undefined): Promise<string | null> {
  const dirs = (pathEnv ?? '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const candidate of candidateNames(name)) {
      const full = path.join(dir, candidate);
      if (await isExecutable(full)) return full;
    }
  }
  return null;
}

export function createResolver(
  paths: ToolchainPaths,
  opts: ResolverOptions = {},
): ToolchainResolver {
  const manifest = opts.manifest ?? TOOLCHAIN_MANIFEST;

  return {
    async findExecutable(name: string): Promise<string | null> {
      // 1) toolchain: <toolchainDir>/<tool>/current/<binPath>
      for (const candidate of await toolchainCandidates(paths, manifest, name)) {
        if (await isExecutable(candidate)) return candidate;
      }
      // 2) PATH
      return findInPath(name, opts.pathEnv ?? process.env.PATH);
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
        for (const artifacts of Object.values(entry.artifacts)) {
          if (!artifacts) continue;
          for (const binRel of artifacts.binPaths) {
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
