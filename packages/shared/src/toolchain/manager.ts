/**
 * Toolchain Manager: diff манифеста с состоянием, фоновая установка
 * missing/outdated (concurrency <= 2), retry/backoff в downloader'е,
 * sha256-verify, атомарная установка, персист в state.json.
 */

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { downloadArtifact, HttpError, NetworkError, ShaMismatchError } from './downloader';
import { runCommand } from './exec';
import { cleanupOldVersions, flipCurrent, installTool } from './installer';
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
  // Случайный суффикс + O_EXCL ('wx'): предсказуемый .tmp-<pid> позволял бы
  // чужому same-user процессу подложить symlink и перезаписать произвольный файл.
  const tmp = `${stateFile}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  await fs.promises.writeFile(tmp, JSON.stringify(state, null, 2), { flag: 'wx' });
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

  // Сериализация read-modify-write записей state.json: параллельные установки
  // иначе затирают записи друг друга (lost update).
  let stateWriteChain: Promise<void> = Promise.resolve();

  async function persistTool(
    name: ToolName,
    value: ToolchainStateFile['tools'][ToolName] | undefined,
  ): Promise<void> {
    const op = stateWriteChain.then(async () => {
      const state = await readStateFile(paths.stateFile);
      if (value) state.tools[name] = value;
      else delete state.tools[name];
      await writeStateFile(paths.stateFile, state);
    });
    stateWriteChain = op.catch(() => {
      // цепочка продолжается даже при сбое одной записи
    });
    await op;
  }

  /** Установка python через toolchain/системный uv (резолвер toolchain-first). */
  async function installUvPython(entry: ToolEntry): Promise<{ installedPath: string }> {
    const uv = await resolver.findExecutable('uv');
    if (!uv) {
      throw new Error('uv not found: cannot install bundled python (integration must expose uv on PATH)');
    }
    // Layout зеркалит обычные инструменты: python/<version>/cpython-…/ +
    // stable link .pyinstall (binPaths манифеста относительны current).
    const toolRoot = path.join(paths.toolchainDir, 'python');
    const versionDir = path.join(toolRoot, entry.version);
    await runCommand([uv, 'python', 'install', entry.version, '--install-dir', versionDir]);

    // Находим cpython-директорию (ручное имя содержит patch-версию/платформу,
    // в манифест его не зашить) и ссылаемся на неё стабильным .pyinstall.
    const entries = await fs.promises.readdir(versionDir);
    const cpython = entries.find((e) => e.startsWith('cpython-'));
    if (!cpython) throw new Error(`uv python install: cpython dir not found in ${versionDir}`);
    const link = path.join(versionDir, '.pyinstall');
    await fs.promises.rm(link, { force: true, recursive: true });
    // win32: без явного типа symlink каталога падает (EPERM/EINVAL) — 'junction'.
    await fs.promises.symlink(cpython, link, process.platform === 'win32' ? 'junction' : undefined);
    await flipCurrent(toolRoot, entry.version, versionDir);
    await cleanupOldVersions(toolRoot, entry.version);
    return { installedPath: versionDir };
  }

  async function installOne(item: WorkItem): Promise<void> {
    const { entry, artifact } = item;
    const base: ToolStatus = { name: entry.name, phase: 'downloading', totalBytes: artifact.size };
    setStatus({ ...base, downloadedBytes: 0 });

    try {
      if (artifact.archive === 'uv-python') {
        setStatus({ name: entry.name, phase: 'installing' });
        const { installedPath } = await installUvPython(entry);
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
        // Не затираем запись о ранее рабочей установке: только помечаем
        // lastError — иначе неудачный update ломал бы и состояние старой версии.
        let prev: ToolchainStateFile['tools'][ToolName] | undefined;
        try {
          prev = (await readStateFile(paths.stateFile)).tools[entry.name];
        } catch {
          prev = undefined;
        }
        await persistTool(entry.name, {
          installedVersion: prev?.installedVersion ?? '',
          installedPath: prev?.installedPath ?? '',
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
        await installSerialized(item);
      }
    });
    await Promise.all(workers);
  }

  // Per-tool mutex: update() вручную во время фонового ensureAll не должен
  // дублировать установку (два писателя в один partial-файл → шумный sha-fail).
  const inflight = new Map<ToolName, Promise<void>>();
  function installSerialized(item: WorkItem): Promise<void> {
    const name = item.entry.name;
    const existing = inflight.get(name);
    if (existing) return existing;
    const p = installOne(item).finally(() => {
      if (inflight.get(name) === p) inflight.delete(name);
    });
    inflight.set(name, p);
    return p;
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
      // Волны по dependsOn: провайдеры (bun, uv) ставятся до зависимых
      // (omp — нужен bun для npm install deps; python — нужен uv).
      const run = (async () => {
        const installedNames = new Set<ToolName>();
        try {
          const st = await readStateFile(paths.stateFile);
          for (const [n, meta] of Object.entries(st.tools)) {
            if (meta?.installedVersion && fs.existsSync(meta.installedPath)) {
              installedNames.add(n as ToolName);
            }
          }
        } catch {
          // state unreadable — волнами только по плану
        }
        const remaining = [...plan];
        while (remaining.length > 0) {
          const wave = remaining.filter((i) =>
            (i.entry.dependsOn ?? []).every((d) => installedNames.has(d)),
          );
          const batch = wave.length > 0 ? wave : remaining; // цикл: ставим как есть
          for (const w of batch) remaining.splice(remaining.indexOf(w), 1);
          await runPool(batch);
          for (const w of batch) installedNames.add(w.entry.name);
        }
      })().finally(() => {
        if (activeRun === run) activeRun = null;
      });
      activeRun = run;
      return run;
    }

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
    // форс: игнорируем текущее состояние (через общий per-tool mutex)
    await installSerialized({ entry, artifact, reason: 'outdated' });
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
