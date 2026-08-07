/**
 * Toolchain Download Manager — контракты.
 * Spec: docs/superpowers/specs/2026-08-06-toolchain-download-manager-design.md
 */

export type ToolchainPlatform = 'darwin-arm64' | 'darwin-x64' | 'linux-x64' | 'win32-x64';

export type ToolName =
  // core (11): всегда ставятся ensureAll'ом
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
  | 'uv'
  // binary default-on: ensureAll ставит, пока не в config toolchain.disabled
  | 'just'
  | 'fzf'
  | 'mise'
  | 'worktrunk'
  // binary opt-in: только через update(name)
  | 'infisical'
  // npm default-on (тарболл + fail-closed npm ci по embedded lock)
  | 'opencode-ai'
  | 'oh-my-openagent'
  | 'oh-my-codex'
  | 'oh-my-claude-sisyphus'
  | 'skills'
  // npm opt-in (эти 5 vercel tools ставятся из marketplace kind:tool через update)
  | 'eve'
  | 'agent-browser'
  | 'portless'
  | 'just-bash'
  | 'opensrc'
  | 'deepsec'
  | 'dev3000'
  // git-npm default-on: bun install -g github:repo@commit
  | 'gbrain'
  // brew opt-in (mac only): brew install, префлайт command -v brew
  | 'mole'
  // detect opt-in: только детект системного исполняемого, установки нет
  | 'docker'
  | 'brew';

/** Стратегия установки инструмента. */
export type ToolKind =
  /** Архив с бинарником по pinned url+sha256 (текущий путь). */
  | 'binary'
  /** npm-тарболл + wrapper-launcher + npm ci --locked deps (npm-locks.ts). */
  | 'npm'
  /** git-репозиторий, pinned коммитом: bun install -g github:repo@commit (git-locks.ts). */
  | 'git-npm'
  /** pip-пакет (зарезервировано, в этом срезе не реализуется — CLI-Anything отложен). */
  | 'pip'
  /** Homebrew формула: префлайт `command -v brew`, иначе статус skipped-no-brew. */
  | 'brew'
  /** Только детект системного исполняемого (docker/brew); toolchain ничего не ставит. */
  | 'detect';

/** Волна установки инструмента в ensureAll. */
export type ToolTier =
  /** Всегда ставится ensureAll'ом (11 исходных инструментов). */
  | 'core'
  /** Ставится ensureAll'ом, если не disabled в config (toolchain.disabled). */
  | 'default-on'
  /** Никогда не ставится ensureAll'ом — только явный update(name). */
  | 'opt-in';

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
  /** Стратегия установки (default: 'binary'). */
  kind?: ToolKind;
  /** Волна ensureAll (default: 'core'). */
  tier?: ToolTier;
  /** Критичный (omp): блокирует дефолтное OMP-подключение; статус дублируется в UI подключением. */
  critical?: boolean;
  /** Инструменты, которые должны быть установлены раньше (волнами ensureAll). */
  dependsOn?: ToolName[];
  /** Показываемая подсказка/icon для UI. */
  displayName: string;
  /** Per-platform записи. Отсутствие ключа = инструмент недоступен/не нужен на этой платформе (git: только win32-x64). */
  artifacts: Partial<Record<ToolchainPlatform, ToolArtifact>>;
  /** Платформы, на которых инструмент вообще существует (из TOOL_PLATFORM_MATRIX); undefined = все. */
  platforms?: ToolchainPlatform[];
  /**
   * Системный исполняемый для детекта/fallback: detect/brew kinds и
   * инструменты без артефакта под платформу (git на mac/linux → 'git').
   */
  systemBinary?: string;
  /** brew kind: имя формулы для `brew install` (default — имя инструмента). */
  brewFormula?: string;
}

export type ToolPhase =
  | 'missing'
  | 'downloading'
  | 'installing'
  | 'ready'
  | 'outdated'
  | 'error'
  | 'offline'
  /** brew kind: префлайт `command -v brew` не прошёл — инструмент пропущен. */
  | 'skipped-no-brew';

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
  /** Принудительное обновление одного инструмента (единственный путь установки opt-in). */
  update(name: ToolName): Promise<ToolStatus>;
  /** Подписка на прогресс (для UI/IPC). */
  onStatusChange(listener: (status: ToolStatus) => void): () => void;
  /** Заменить список disabled-инструментов (default-on tier пропускается ensureAll'ом). */
  setDisabledTools(tools: ToolName[]): ToolName[];
  /** Текущий список disabled-инструментов. */
  getDisabledTools(): ToolName[];
}

export interface ToolchainPaths {
  toolchainDir: string; // <CONFIG_DIR>/toolchain
  downloadsDir: string; // <CONFIG_DIR>/downloads
  stateFile: string; // <CONFIG_DIR>/toolchain/state.json
}
