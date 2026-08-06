/**
 * Toolchain Download Manager — контракты.
 * Spec: docs/superpowers/specs/2026-08-06-toolchain-download-manager-design.md
 */

export type ToolchainPlatform = 'darwin-arm64' | 'darwin-x64' | 'linux-x64' | 'win32-x64';

export type ToolName =
  | 'omp'
  | 'python'
  | 'node'
  | 'ffmpeg'
  | 'pandoc'
  | 'gh'
  | 'jq'
  | 'yq'
  | 'git'
  | 'bun'
  | 'uv';

/** Один артефакт для скачивания под конкретную платформу. */
export interface ToolArtifact {
  /** Прямой URL артефакта (no API — GitHub release asset / vendor CDN / npm tarball). */
  url: string;
  /** sha256 файла в hex (lowercase), обязателен для записей manifest. */
  sha256: string;
  /** Размер в байтах (для прогресс-баров и аннотирования UI). */
  size: number;
  /** Тип архива. 'raw' — голый бинарник. 'uv-python' — ставится командой `uv python install`. */
  archive: 'tar.gz' | 'tar.xz' | 'zip' | 'raw' | 'uv-python';
  /**
   * Пути к исполняемым файлам внутри распакованного дерева инструмента,
   * относительно toolchain/<tool>/<version>/. Windows — .exe обязаны.
   * Пример для node darwin: ['bin/node', 'bin/npx'].
   */
  binPaths: string[];
}

export interface ToolEntry {
  name: ToolName;
  /** Pinned-версии (inf ждет). */
  version: string;
  /** Критичный (omp): блокирует дефолтное OMP-подключение; статус дублируется в UI подключением. */
  critical?: boolean;
  /** Инструменты, которые должны быть установлены раньше (волнами ensureAll). */
  dependsOn?: ToolName[];
  /** Показываемая подсказка/icon для UI. */
  displayName: string;
  /** Per-platform записи. Отсутствие ключа = инструмент недоступен/не нужен на этой платформе (git: только win32-x64). */
  artifacts: Partial<Record<ToolchainPlatform, ToolArtifact>>;
}

export type ToolPhase =
  | 'missing'
  | 'downloading'
  | 'installing'
  | 'ready'
  | 'outdated'
  | 'error'
  | 'offline';

export interface ToolStatus {
  name: ToolName;
  phase: ToolPhase;
  /** Скачанные байты текущей загрузки. */
  downloadedBytes?: number;
  totalBytes?: number;
  error?: string;
  /** Installed путь: <toolchainDir>/<tool>/<version>. */
  installedPath?: string;
  installedVersion?: string;
}

export interface ToolchainStateFile {
  /** per-tool persist state, живёт между рестартами. */
  tools: Partial<
    Record<
      ToolName,
      {
        installedVersion: string;
        installedPath: string;
        lastError?: string;
      }
    >
  >;
}

/** Публичный API — consumers: OmpAgent, agents env, bootstrap, UI status. */
export interface ToolchainResolver {
  /** Путь исполняемого с приоритетом: toolchain → bundled → PATH (null если нигде нет). */
  findExecutable(name: string): Promise<string | null>;
  /** Префикс PATH, который должен получить каждый сабпроцесс агента (bin-диры toolchain + bundled). */
  toolchainPathPrefix(): Promise<string>;
  /** Директория toolchain: <CONFIG_DIR>/toolchain. */
  toolchainDir(): string;
}

export interface ToolchainManager {
  /** Diff manifest vs state; фоново ставит missing/outdated; возвращает snapshot сразу. */
  ensureAll(opts?: { background?: boolean }): Promise<ToolStatus[]>;
  /** Текущий snapshot состояний без побочных эффектов. */
  status(): Promise<ToolStatus[]>;
  /** Принудительное обновление одного инструмента. */
  update(name: ToolName): Promise<ToolStatus>;
  /** Подписка на прогресс (для UI/IPC). */
  onStatusChange(listener: (status: ToolStatus) => void): () => void;
}

export interface ToolchainPaths {
  toolchainDir: string; // <CONFIG_DIR>/toolchain
  downloadsDir: string; // <CONFIG_DIR>/downloads
  stateFile: string; // <CONFIG_DIR>/toolchain/state.json
}
