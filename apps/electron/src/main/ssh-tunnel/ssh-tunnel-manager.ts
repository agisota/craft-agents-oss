/**
 * Owns all live SSH tunnels (one per host) and the concrete child_process /
 * network wiring the SshTunnel state machine depends on. Emits per-host state
 * changes so the main process can forward them to the renderer.
 */

import { spawn, execFile } from 'child_process'
import { connect as netConnect } from 'net'
import { EventEmitter } from 'events'
import type { SshHostConfig } from '@craft-agent/shared/config'
import { updateSshHost, getSshHost } from '@craft-agent/shared/config'
import { generateServerToken } from '@craft-agent/server-core/bootstrap'
import { findFreePort } from './port-allocator.ts'
import { SshTunnel, buildSshArgs, type TunnelState } from './ssh-tunnel.ts'
import { resolveServerArtifact, parseUnameTarget } from './server-artifact.ts'
import {
  bootstrapRemoteServer,
  type BootstrapProgress,
  type ServerBootstrapDeps,
} from './server-bootstrap.ts'

const SSH_BIN = 'ssh'
const SCP_BIN = 'scp'
const PROBE_TIMEOUT_MS = 8000
const PROBE_INTERVAL_MS = 250

/** Minimal factory over net.connect, injectable for tests. */
export type ConnectFn = (port: number) => import('net').Socket

/**
 * One application-level probe attempt against the forwarded port.
 *
 * A bare TCP connect is not enough: with `ssh -L` the *local* listener accepts
 * even when nothing listens on the remote port — ssh accepts locally, then
 * tears the socket down when the remote channel fails. So after connecting we
 * write a minimal HTTP request and require at least one response byte before
 * the socket closes. Immediate close/reset without data = failure.
 */
export function probeOnce(localPort: number, connectFn: ConnectFn = (p) => netConnect({ host: '127.0.0.1', port: p })): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = connectFn(localPort)
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      sock.destroy()
      resolve(ok)
    }
    sock.once('connect', () => {
      sock.write('GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n')
    })
    sock.once('data', () => finish(true))
    sock.once('error', () => finish(false))
    sock.once('close', () => finish(false))
    sock.setTimeout(3000, () => finish(false))
  })
}

/**
 * Probe the forwarded local port for a live craft-agent server, retrying
 * until the overall timeout elapses.
 */
function probeLocalPort(localPort: number): Promise<boolean> {
  const deadline = Date.now() + PROBE_TIMEOUT_MS
  return new Promise((resolve) => {
    const tryOnce = async () => {
      const ok = await probeOnce(localPort)
      if (ok) {
        resolve(true)
      } else if (Date.now() >= deadline) {
        resolve(false)
      } else {
        setTimeout(tryOnce, PROBE_INTERVAL_MS)
      }
    }
    void tryOnce()
  })
}

export class SshTunnelManager extends EventEmitter {
  private tunnels = new Map<string, SshTunnel>()

  /** Current state for a host, or a synthetic disconnected state if none. */
  getState(hostId: string): TunnelState {
    return (
      this.tunnels.get(hostId)?.getState() ?? {
        hostId,
        status: 'disconnected',
        reconnectAttempts: 0,
      }
    )
  }

  getAllStates(): TunnelState[] {
    return [...this.tunnels.values()].map((t) => t.getState())
  }

  /**
   * Establish (or reuse) a tunnel for `host`. Resolves with the connected
   * state (including the forwarded ws:// url) or rejects with the error.
   */
  async connect(host: SshHostConfig): Promise<TunnelState> {
    let tunnel = this.tunnels.get(host.id)
    if (tunnel) {
      // Discard the cached tunnel when it is idle or was built from a stale
      // host config (the user may have edited port/user/identityFile).
      const status = tunnel.getState().status
      const idle = status !== 'connected' && status !== 'connecting'
      const stale = JSON.stringify(tunnel.getHostConfig()) !== JSON.stringify(host)
      if (idle || stale) {
        tunnel.dispose()
        this.tunnels.delete(host.id)
        tunnel = undefined
      }
    }
    if (!tunnel) {
      tunnel = new SshTunnel(host, {
        spawn: (args) => spawn(SSH_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] }),
        probe: probeLocalPort,
        allocatePort: findFreePort,
      })
      tunnel.on('state', (state: TunnelState) => this.emit('state', state))
      this.tunnels.set(host.id, tunnel)
    }

    return new Promise<TunnelState>((resolve, reject) => {
      const onState = (state: TunnelState) => {
        if (state.status === 'connected') {
          tunnel!.off('state', onState)
          resolve(state)
        } else if (state.status === 'error') {
          tunnel!.off('state', onState)
          reject(new Error(state.error ?? 'SSH tunnel failed'))
        }
      }
      tunnel!.on('state', onState)
      void tunnel!.connect()
    })
  }

  disconnect(hostId: string): void {
    const tunnel = this.tunnels.get(hostId)
    if (!tunnel) return
    tunnel.disconnect()
    this.emit('state', tunnel.getState())
  }

  /**
   * Fetch the remote craft-agent server token over ssh, best-effort.
   *
   * The server takes its token from the CRAFT_SERVER_TOKEN env var and does not
   * persist it to a fixed path by default, so we try the token file the user
   * configured (if any) plus the common `.env` convention. Callers fall back to
   * manual token entry when this returns undefined.
   */
  async fetchRemoteToken(host: SshHostConfig, tokenPath?: string): Promise<string | undefined> {
    const candidates = tokenPath
      ? [tokenPath]
      : ['~/.craft-agent/server-token', '~/.craft-agent/.env']
    for (const path of candidates) {
      const out = await this.runRemote(host, `cat ${path} 2>/dev/null || true`)
      const token = extractToken(out)
      if (token) return token
    }
    return undefined
  }

  /**
   * Run the host's remoteServerCommand over ssh in the background (detached on
   * the remote via nohup) so a server comes up before the next connect attempt.
   */
  async startRemoteServer(host: SshHostConfig): Promise<void> {
    if (!host.remoteServerCommand) {
      throw new Error('No remote server command configured for this host')
    }
    await this.runRemote(
      host,
      `nohup sh -c ${posixSingleQuote(host.remoteServerCommand)} >/dev/null 2>&1 &`,
    )
  }

  /**
   * Run a one-shot command over ssh and return stdout.
   *
   * SECURITY: the remote command may embed a secret (the managed token). Node's
   * execFile error attaches the full argv (including the command) to `err.cmd`
   * and its message, which would leak the token into logs/UI. We therefore
   * reject with a sanitized Error that carries only stderr + exit status — never
   * the command string.
   */
  private runRemote(host: SshHostConfig, command: string, timeoutMs = 20_000): Promise<string> {
    const args = buildSshArgs(host)
    // buildSshArgs ends with user@host; append the remote command.
    return new Promise((resolve, reject) => {
      execFile(SSH_BIN, [...args, command], { timeout: timeoutMs }, (err, stdout, stderr) => {
        if (err && !stdout) {
          const detail = String(stderr || '').trim()
          reject(new Error(`Remote command failed${detail ? `: ${detail}` : ''}`))
        } else {
          resolve(stdout)
        }
      })
    })
  }

  /** Upload a local file to the remote host via scp. */
  private uploadFile(host: SshHostConfig, localPath: string, remotePath: string): Promise<void> {
    // scp uses -P for the port (uppercase, unlike ssh's -p).
    // -O uses the legacy SCP protocol instead of SFTP: some minimal/user-mode
    // sshd setups don't enable the sftp subsystem, and the managed server only
    // needs a single file copied, so the classic protocol is the safer default.
    const args = ['-O', '-B', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-P', String(host.port)]
    if (host.identityFile) args.push('-i', host.identityFile, '-o', 'IdentitiesOnly=yes')
    // Expand a leading ~ locally is not needed; remote ~ is expanded by the shell
    // on the remote side, but scp does not run a shell for the destination path.
    // Strip a leading "~/" so scp writes relative to the login home dir.
    const dest = remotePath.replace(/^~\//, '')
    args.push(localPath, `${host.user}@${host.host}:${dest}`)
    return new Promise((resolve, reject) => {
      execFile(SCP_BIN, args, { timeout: 120_000 }, (err, _stdout, stderr) => {
        if (err) reject(new Error(`scp upload failed: ${stderr?.trim() || err.message}`))
        else resolve()
      })
    })
  }

  /**
   * Probe the remote server port directly over ssh (no tunnel needed). Used
   * during bootstrap, before a tunnel is established. Returns true if something
   * answers an HTTP request on 127.0.0.1:<remotePort> on the remote host.
   */
  private async probeRemotePort(host: SshHostConfig): Promise<boolean> {
    const port = host.remotePort
    // Try curl, fall back to a /dev/tcp bash probe. We only need a byte back;
    // craft-agent answers HTTP on the RPC port. Any non-empty response = alive.
    const cmd =
      `(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:${port}/ 2>/dev/null ` +
      `|| (exec 3<>/dev/tcp/127.0.0.1/${port} && printf 'GET / HTTP/1.0\\r\\n\\r\\n' >&3 && head -c 1 <&3 | od -An -tx1)) 2>/dev/null`
    try {
      const out = (await this.runRemote(host, cmd)).trim()
      // curl prints an HTTP status; a 000 means connection refused/timeout.
      if (/^\d{3}$/.test(out)) return out !== '000'
      return out.length > 0
    } catch {
      return false
    }
  }

  /**
   * One-click bootstrap: ensure an app-managed craft-agent server is installed
   * and running on `host`, installing it over SSH if necessary. Streams
   * progress via `onProgress`. Returns the managed token on success.
   */
  async bootstrapServer(
    host: SshHostConfig,
    onProgress: (p: BootstrapProgress) => void,
  ): Promise<{ token: string }> {
    const deps: ServerBootstrapDeps = {
      runRemote: (h, cmd, timeoutMs) => this.runRemote(h, cmd, timeoutMs),
      uploadFile: (h, local, remote) => this.uploadFile(h, local, remote),
      detectTarget: (uname) => parseUnameTarget(uname),
      resolveArtifact: (target) =>
        resolveServerArtifact(target, { isPackaged: isAppPackaged() }),
      probe: () => this.probeRemotePort(host),
      generateToken: () => generateServerToken(),
      storeToken: (hostId, token) => {
        updateSshHost(hostId, { managedToken: token })
      },
      loadStoredToken: (hostId) => getSshHost(hostId)?.managedToken,
    }
    return bootstrapRemoteServer(host, deps, onProgress)
  }

  disposeAll(): void {
    for (const tunnel of this.tunnels.values()) tunnel.dispose()
    this.tunnels.clear()
    this.removeAllListeners()
  }
}

/** POSIX single-quote a string for safe embedding in a remote shell command. */
export function posixSingleQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

/** Pull a token out of `KEY=value` env lines or a bare token file. */
function extractToken(out: string): string | undefined {
  const text = out.trim()
  if (!text) return undefined
  const match = text.match(/CRAFT_SERVER_TOKEN\s*=\s*["']?([A-Za-z0-9._-]+)["']?/)
  if (match) return match[1]
  // A file containing just the token.
  if (/^[A-Za-z0-9._-]{16,}$/.test(text)) return text
  return undefined
}

/** Whether the Electron app is packaged. Fail-soft to `false` (dev) if electron isn't available. */
function isAppPackaged(): boolean {
  try {
    // Lazy require so this module stays importable in plain-bun unit tests.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron') as { app?: { isPackaged?: boolean } }
    return electron.app?.isPackaged ?? false
  } catch {
    return false
  }
}

let singleton: SshTunnelManager | undefined
export function getSshTunnelManager(): SshTunnelManager {
  if (!singleton) singleton = new SshTunnelManager()
  return singleton
}
