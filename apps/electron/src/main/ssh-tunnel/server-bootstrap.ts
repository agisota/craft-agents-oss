/**
 * One-click bootstrap of an app-managed craft-agent server on a remote host,
 * VS Code Remote-SSH style: detect the remote OS/arch, ensure a server build
 * for that target exists locally, upload + extract it, generate and store a
 * token, start the server under nohup, and re-probe until it answers.
 *
 * The orchestration is a pure state machine with every side effect (ssh exec,
 * scp upload, artifact resolution, probe, token gen, token persistence)
 * injected as a dependency, so it can be unit-tested without touching the
 * network or filesystem. Progress is reported via an `onProgress` callback so
 * the UI can render a step list.
 *
 * SECURITY: the managed token is a secret. It is never included in progress
 * events, log output, or error messages produced here.
 */

import type { SshHostConfig } from '@craft-agent/shared/config'
import type { RemoteTarget, ResolvedArtifact } from './server-artifact.ts'

export type BootstrapPhase =
  | 'checking-server'
  | 'detecting-os'
  | 'building-server'
  | 'uploading-server'
  | 'installing-server'
  | 'starting-server'
  | 'waiting-for-server'
  | 'connecting-tunnel'
  | 'creating-workspace'
  | 'ready'
  | 'error'

export interface BootstrapProgress {
  phase: BootstrapPhase
  /** Human-readable detail (never contains secrets). */
  detail?: string
}

export interface BootstrapResult {
  /** The token the server was started with (managed secret). */
  token: string
}

/** Directory on the remote host where the managed server is installed. */
export const REMOTE_INSTALL_DIR = '~/.craft-agent/remote-server'
export const REMOTE_LOG_PATH = '~/.craft-agent/remote-server/server.log'
/** Token file on the remote (0600). The token travels over ssh stdin, never argv. */
export const REMOTE_TOKEN_PATH = '~/.craft-agent/remote-server/.token'

export interface RunRemoteOptions {
  /** Timeout for the remote command, ms. */
  timeoutMs?: number
  /**
   * Data piped to the remote command's stdin. Used to transfer the token
   * without it ever appearing in any argv (local or remote `ps`).
   */
  stdin?: string
}

export interface ServerBootstrapDeps {
  /** Run a command over ssh on the remote host; resolves stdout. */
  runRemote: (host: SshHostConfig, command: string, opts?: RunRemoteOptions) => Promise<string>
  /** Upload a local file to a remote absolute-ish path via scp. */
  uploadFile: (host: SshHostConfig, localPath: string, remotePath: string) => Promise<void>
  /** Detect remote target from `uname -sm`. */
  detectTarget: (unameOutput: string) => RemoteTarget
  /** Ensure a server artifact for the target exists locally; returns its path. */
  resolveArtifact: (target: RemoteTarget) => Promise<ResolvedArtifact>
  /** Probe the (already forwarded) local port for a live server. */
  probe: () => Promise<boolean>
  /** Generate a fresh server auth token. */
  generateToken: () => string
  /** Persist the managed token for this host in the ssh-hosts store. */
  storeToken: (hostId: string, token: string) => void
  /** Read a previously stored managed token for this host, if any. */
  loadStoredToken: (hostId: string) => string | undefined
  /** Injectable delay (ms) for probe retry loops. */
  sleep?: (ms: number) => Promise<void>
  /** Max attempts (with delay) to re-probe after starting the server. */
  probeAttempts?: number
  /** Delay between post-start probe attempts, ms. */
  probeIntervalMs?: number
}

const DEFAULT_PROBE_ATTEMPTS = 40
const DEFAULT_PROBE_INTERVAL_MS = 500

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** POSIX single-quote a string for safe embedding in a remote shell command. */
export function posixSingleQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

/**
 * Build the remote shell command that writes the token file from stdin.
 * The token is piped over ssh stdin (see RunRemoteOptions.stdin) so the
 * literal secret never appears in any argv — not locally, and not in the
 * remote's `ps` output. umask 077 ensures the file is 0600 from creation.
 */
export function buildWriteTokenCommand(): string {
  return (
    `mkdir -p ${REMOTE_INSTALL_DIR} && umask 077 && ` +
    `cat > ${REMOTE_TOKEN_PATH} && chmod 600 ${REMOTE_TOKEN_PATH}`
  )
}

/**
 * Build the remote shell command that installs an uploaded archive and starts
 * the server. Exported for testing (asserts the token is read from the 0600
 * token file — never embedded in argv — the server is detached under nohup,
 * and logs go to a file).
 */
export function buildStartCommand(archiveRemotePath: string, remotePort: number): string {
  // Extract into the install dir, then start start.sh detached, logging to
  // server.log. The token is read from REMOTE_TOKEN_PATH inside the inner
  // shell — the `$(cat ...)` stays literal in argv, so `ps` never shows it.
  // The launch must fully detach so the ssh channel closes immediately
  // (otherwise ssh blocks until the server exits and the connection times
  // out): nohup + background, with the outer command's own stdin/stdout/stderr
  // redirected so no fd keeps the ssh session open.
  const launch =
    `CRAFT_SERVER_TOKEN="$(cat ${REMOTE_TOKEN_PATH})" CRAFT_RPC_PORT=${remotePort} ` +
    `nohup ${REMOTE_INSTALL_DIR}/start.sh > ${REMOTE_LOG_PATH} 2>&1 < /dev/null &`
  return [
    `mkdir -p ${REMOTE_INSTALL_DIR}`,
    `tar -xzf ${archiveRemotePath} -C ${REMOTE_INSTALL_DIR}`,
    `chmod +x ${REMOTE_INSTALL_DIR}/start.sh ${REMOTE_INSTALL_DIR}/bin/craft-server 2>/dev/null || true`,
    `rm -f ${archiveRemotePath}`,
    // Detach the launcher: `sh -c '... &'` with all fds redirected so ssh returns.
    `sh -c ${posixSingleQuote(launch)} > /dev/null 2>&1 < /dev/null`,
  ].join(' && ')
}

/**
 * Run the full bootstrap. Assumes the SSH tunnel is already established and the
 * remote server port is forwarded locally (so `probe()` targets it).
 *
 * Returns the token in hand on success. Progress is streamed via `onProgress`.
 */
export async function bootstrapRemoteServer(
  host: SshHostConfig,
  deps: ServerBootstrapDeps,
  onProgress: (p: BootstrapProgress) => void = () => {},
): Promise<BootstrapResult> {
  const sleep = deps.sleep ?? defaultSleep
  const probeAttempts = deps.probeAttempts ?? DEFAULT_PROBE_ATTEMPTS
  const probeIntervalMs = deps.probeIntervalMs ?? DEFAULT_PROBE_INTERVAL_MS

  // 1. If a server already answers and we have a stored token, we're done.
  onProgress({ phase: 'checking-server' })
  const alreadyAlive = await deps.probe()
  const stored = deps.loadStoredToken(host.id)
  if (alreadyAlive && stored) {
    onProgress({ phase: 'ready' })
    return { token: stored }
  }
  if (alreadyAlive) {
    // A server we don't manage already occupies the port. Installing another
    // one would fail to bind, the re-probe would then hit the old server, and
    // workspace creation would fail auth with a confusing error — fail fast
    // with a clear, actionable message instead.
    const detail =
      `A server is already running on port ${host.remotePort} on this host, but it is not managed by this app. ` +
      `Connect to it via the Advanced option (with its own token), or change this host's server port to install a managed server.`
    onProgress({ phase: 'error', detail })
    throw new Error(detail)
  }

  // 2. Detect the remote OS/arch.
  onProgress({ phase: 'detecting-os' })
  const uname = await deps.runRemote(host, 'uname -sm')
  const target = deps.detectTarget(uname)

  // 3. Ensure a local artifact for the target (build on demand in dev).
  onProgress({ phase: 'building-server', detail: `${target.platform}-${target.arch}` })
  const artifact = await deps.resolveArtifact(target)

  // 4. Upload + extract.
  const remoteArchive = `~/.craft-agent/${artifact.archiveName}`
  onProgress({ phase: 'uploading-server' })
  await deps.runRemote(host, 'mkdir -p ~/.craft-agent')
  await deps.uploadFile(host, artifact.archivePath, remoteArchive)

  // 5. Generate + store token, transfer it via stdin (never argv), then
  //    install + start the server (which reads the token from the 0600 file).
  const token = stored ?? deps.generateToken()
  deps.storeToken(host.id, token)

  onProgress({ phase: 'installing-server' })
  await deps.runRemote(host, buildWriteTokenCommand(), { stdin: token })

  onProgress({ phase: 'starting-server' })
  // Extracting a large archive + launching can take a while; allow generous time.
  await deps.runRemote(host, buildStartCommand(remoteArchive, host.remotePort), {
    timeoutMs: 180_000,
  })

  // 6. Re-probe until the server answers.
  onProgress({ phase: 'waiting-for-server' })
  for (let attempt = 0; attempt < probeAttempts; attempt++) {
    if (await deps.probe()) {
      onProgress({ phase: 'ready' })
      return { token }
    }
    await sleep(probeIntervalMs)
  }

  // Failure — surface a tail of the remote log to help diagnosis (no secrets in it).
  let logTail = ''
  try {
    logTail = (await deps.runRemote(host, `tail -n 30 ${REMOTE_LOG_PATH} 2>/dev/null || true`)).trim()
  } catch {
    /* best effort */
  }
  const detail = logTail
    ? `Server did not come up in time. Remote log tail:\n${logTail}`
    : 'Server did not come up in time and no remote log was available.'
  onProgress({ phase: 'error', detail })
  throw new Error(detail)
}
