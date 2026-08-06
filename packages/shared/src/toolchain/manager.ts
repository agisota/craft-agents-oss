/**
 * Toolchain Manager: diff манифеста с состоянием, фоновая установка
 * missing/outdated (concurrency <= 2), retry/backoff в downloader'е,
 * sha256-verify, атомарная установка, персист в state.json.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { downloadArtifact, HttpError, NetworkError, ShaMismatchError } from './downloader';
import { installTool } from './installer';
import { currentPlatform, TOOLCHAIN_MANIFEST } from './manifest';
import { createResolver } from './resolver';
import { StatusEmitter } from './status';
import type {
  ToolArtifact,
  ToolEntry,
  ToolName,
  ToolStatus,
  ToolchainManager,
  ToolchainPaths,
  ToolchainPlatform,
  ToolchainStateFile,
} from './types';

/** Бинарник для synthetic-статуса по инструментам без артефакта (git на mac/linux). */
const SYSTEM_BIN_BY_TOOL: Partial<Record<ToolName, string>> = { git: 'git' };

async function readStateFile(stateFile: string): Promise<ToolchainStateFile> {
  try {
    const raw = await fs.promises.readFile(stateFile, 'utf8');
    return JSON.parse(raw) as ToolchainStateFile;
  } catch {
    return { tools: {} };
  }
}

async function writeStateFile(stateFile: string, state: ToolchainStateFile): Promise<void> {
  await fs.promises.mkdir(path.dirname(stateFile), { recursive: true });
  const tmp = `${stateFile}.tmp-${process.pid}`;
  await fs.promises.writeFile(tmp, JSON.stringify(state, null, 2));
  await fs.promises.rename(tmp, stateFile);
}

export interface ManagerOptions {
  manifest?: ToolEntry[];
  platform?: ToolchainPlatform;
  /** DI для тестов. */
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  retryDelaysMs?: readonly number[];
  /** Сколько загрузок/установок одновременно. */
  concurrency?: number;
  pathEnv?: string;
}

interface WorkItem {
  entry: ToolEntry;
  artifact: ToolArtifact;
  reason: 'missing' | 'outdated';
}

export function createManager(
  paths: ToolchainPaths,
  opts: ManagerOptions = {},
): ToolchainManager & { ensureIdle(): Promise<void> } {
  const manifest = opts.manifest ?? TOOLCHAIN_MANIFEST;
  const platform = opts.platform ?? currentPlatform();
  const concurrency = opts.concurrency ?? 2;
  const emitter = new StatusEmitter();
  const resolver = createResolver(paths, { manifest, pathEnv: opts.pathEnv });

  // Очередь активного ensureAll (для ensureIdle в тестах / перед выходом)
  let activeRun: Promise<void> | null = null;

  function setStatus(status: ToolStatus): ToolStatus {
    emitter.emit({ ...status });
    return status;
  }

  async function persistTool(
    name: ToolName,
    value: ToolchainStateFile['tools'][ToolName] | undefined,
  ): Promise<void> {
    const state = await readStateFile(paths.stateFile);
    if (value) state.tools[name] = value;
    else delete state.tools[name];
    await writeStateFile(paths.stateFile, state);
  }

  /** Установка python через системный/бандловый uv (через PATH-резолвер). */
  async function installUvPython(entry: ToolEntry): Promise<void> {
    const uv = await resolver.findExecutable('uv');
    if (!uv) {
      throw new Error('uv not found: cannot install bundled python (integration must expose uv on PATH)');
    }
    const installDir = path.join(paths.toolchainDir, 'python');
    const proc = Bun.spawn(
      [uv, 'python', 'install', entry.version, '--install-dir', installDir],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    if (code !== 0) throw new Error(`uv python install failed: ${stderr.trim()}`);
  }

  async function installOne(item: WorkItem): Promise<void> {
    const { entry, artifact } = item;
    const base: ToolStatus = { name: entry.name, phase: 'downloading', totalBytes: artifact.size };
    setStatus({ ...base, downloadedBytes: 0 });

    try {
      if (artifact.archive === 'uv-python') {
        setStatus({ name: entry.name, phase: 'installing' });
        await installUvPython(entry);
        const installedPath = path.join(paths.toolchainDir, 'python');
        const result = { installedPath, installedVersion: entry.version };
        await persistTool(entry.name, result);
        setStatus({ name: entry.name, phase: 'ready', ...result });
        return;
      }

      const dest = path.join(paths.downloadsDir, 'partial', `${entry.name}-${entry.version}`);
      // прерванные partial-файлы — с чистого листа (без Range-resume)
      await fs.promises.rm(dest, { force: true });
      await fs.promises.rm(`${dest}.partial`, { force: true });

      let networkFailed = false;
      try {
        await downloadArtifact({
          url: artifact.url,
          dest,
          sha256: artifact.sha256,
          size: artifact.size,
          fetchImpl: opts.fetchImpl,
          sleepImpl: opts.sleepImpl,
          retryDelaysMs: opts.retryDelaysMs,
          onProgress: (downloadedBytes, totalBytes) =>
            setStatus({ name: entry.name, phase: 'downloading', downloadedBytes, totalBytes }),
        });
      } catch (error) {
        // сетевой сбой до начала/в процессе после всех ретраев -> offline
        if (error instanceof NetworkError) networkFailed = true;
        throw networkFailed ? new Error(`offline: ${(error as Error).message}`) : error;
      }

      setStatus({ name: entry.name, phase: 'installing' });
      const result = await installTool(paths, entry.name, entry.version, dest, artifact);
      await persistTool(entry.name, result);
      setStatus({ name: entry.name, phase: 'ready', ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof NetworkError || message.startsWith('offline:')) {
        setStatus({ name: entry.name, phase: 'offline', error: message });
        return;
      }
      if (error instanceof ShaMismatchError || error instanceof HttpError) {
        await persistTool(entry.name, {
          installedVersion: '',
          installedPath: '',
          lastError: message,
        });
      }
      setStatus({ name: entry.name, phase: 'error', error: message });
    }
  }

  /** Простейший пул воркеров с лимитом параллелизма. */
  async function runPool(items: WorkItem[]): Promise<void> {
    const queue = [...items];
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        await installOne(item);
      }
    });
    await Promise.all(workers);
  }

  /** Причина установки для entry или null, если актуальная версия уже стоит. */
  async function planItem(entry: ToolEntry, artifact: ToolArtifact): Promise<WorkItem | null> {
    const state = await readStateFile(paths.stateFile);
    const installed = state.tools[entry.name];
    if (!installed || !installed.installedVersion) return { entry, artifact, reason: 'missing' };
    if (installed.installedVersion !== entry.version) return { entry, artifact, reason: 'outdated' };
    // версия совпала, но директория могли подтереть — проверяем факт
    if (!fs.existsSync(installed.installedPath)) return { entry, artifact, reason: 'missing' };
    return null;
  }

  /** Снапшот со стороны диска/манифеста без побочных эффектов. */
  async function buildStatusSnapshot(): Promise<ToolStatus[]> {
    const state = await readStateFile(paths.stateFile);
    const statuses: ToolStatus[] = [];
    for (const entry of manifest) {
      const artifact = entry.artifacts[platform];
      const installed = state.tools[entry.name];
      const runtimeStatus = emitter.get(entry.name);

      // Нет артефакта под текущую платформу -> системный fallback (git на mac/linux)
      if (!artifact) {
        const sysBin = SYSTEM_BIN_BY_TOOL[entry.name];
        if (sysBin && (await resolver.findExecutable(sysBin))) {
          statuses.push({ name: entry.name, phase: 'ready', installedVersion: 'system' });
        } else if (sysBin) {
          statuses.push({ name: entry.name, phase: 'missing' });
        }
        // инструментов вроде git без системного бинарника в списке нет вовсе
        continue;
      }

      // активная работа важнее дискового снапшота
      if (runtimeStatus && ['downloading', 'installing'].includes(runtimeStatus.phase)) {
        statuses.push(runtimeStatus);
        continue;
      }

      if (installed?.installedVersion && fs.existsSync(installed.installedPath)) {
        statuses.push(
          installed.installedVersion === entry.version
            ? {
                name: entry.name,
                phase: 'ready',
                installedVersion: installed.installedVersion,
                installedPath: installed.installedPath,
              }
            : {
                name: entry.name,
                phase: 'outdated',
                installedVersion: installed.installedVersion,
                installedPath: installed.installedPath,
              },
        );
      } else if (runtimeStatus && ['error', 'offline'].includes(runtimeStatus.phase)) {
        statuses.push(runtimeStatus);
      } else if (installed?.lastError) {
        statuses.push({ name: entry.name, phase: 'error', error: installed.lastError });
      } else {
        statuses.push({ name: entry.name, phase: 'missing' });
      }
    }
    return statuses;
  }

  async function ensureAll(optsEnsure?: { background?: boolean }): Promise<ToolStatus[]> {
    const plan: WorkItem[] = [];
    for (const entry of manifest) {
      const artifact = entry.artifacts[platform];
      if (!artifact) continue;
      const item = await planItem(entry, artifact);
      if (item) plan.push(item);
    }

    const startRun = (): Promise<void> => {
      const run = runPool(plan).finally(() => {
        if (activeRun === run) activeRun = null;
      });
      activeRun = run;
      return run;
    };

    if (optsEnsure?.background !== false) {
      // фон: статусы по ходу через onStatusChange; ошибки не летят наружу
      void startRun();
      return buildStatusSnapshot();
    }
    await startRun();
    return buildStatusSnapshot();
  }

  async function update(name: ToolName): Promise<ToolStatus> {
    const entry = manifest.find((e) => e.name === name);
    if (!entry) throw new Error(`unknown tool: ${name}`);
    const artifact = entry.artifacts[platform];
    if (!artifact) {
      const status = { name, phase: 'missing' as const };
      setStatus(status);
      return status;
    }
    // форс: игнорируем текущее состояние
    await installOne({ entry, artifact, reason: 'outdated' });
    return (await buildStatusSnapshot()).find((s) => s.name === name) ?? emitter.get(name)!;
  }

  return {
    ensureAll,
    status: buildStatusSnapshot,
    update,
    onStatusChange: (listener) => emitter.subscribe(listener),
    /** Дождаться завершения фоновой волны (тесты/грациозный выход). */
    ensureIdle: () => activeRun ?? Promise.resolve(),
  };
}
