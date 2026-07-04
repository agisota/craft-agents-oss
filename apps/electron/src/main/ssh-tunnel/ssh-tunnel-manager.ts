/**
 * Owns all live SSH tunnels (one per host) and the concrete child_process /
 * network wiring the SshTunnel state machine depends on. Emits per-host state
 * changes so the main process can forward them to the renderer.
 */

import { spawn, execFile } from 'child_process'
import { connect as netConnect } from 'net'
import { EventEmitter } from 'events'
import type { SshHostConfig } from '@craft-agent/shared/config'
import { findFreePort } from './port-allocator.ts'
import { SshTunnel, buildSshArgs, type TunnelState } from './ssh-tunnel.ts'

const SSH_BIN = 'ssh'
const PROBE_TIMEOUT_MS = 8000
const PROBE_INTERVAL_MS = 250

/**
 * Probe a local port by opening a TCP connection until it succeeds or the
 * overall timeout elapses. A successful connect means the forwarded
 * craft-agent server is accepting connections (the WS handshake/auth is done
 * later by the existing remote-workspace client).
 */
function probeLocalPort(localPort: number): Promise<boolean> {
  const deadline = Date.now() + PROBE_TIMEOUT_MS
  return new Promise((resolve) => {
    const tryOnce = () => {
      const sock = netConnect({ host: '127.0.0.1', port: localPort })
      let settled = false
      const cleanup = () => {
        if (settled) return
        settled = true
        sock.destroy()
      }
      sock.once('connect', () => {
        cleanup()
        resolve(true)
      })
      sock.once('error', () => {
        cleanup()
        if (Date.now() >= deadline) {
          resolve(false)
        } else {
          setTimeout(tryOnce, PROBE_INTERVAL_MS)
        }
      })
    }
    tryOnce()
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
    await this.runRemote(host, `nohup sh -c '${host.remoteServerCommand}' >/dev/null 2>&1 &`)
  }

  /** Run a one-shot command over ssh and return stdout. */
  private runRemote(host: SshHostConfig, command: string): Promise<string> {
    const args = buildSshArgs(host, 0)
      // Drop the -N / -L forwarding flags; keep connection/identity options.
      .filter((a, i, arr) => a !== '-N' && arr[i - 1] !== '-L' && a !== '-L')
    // buildSshArgs ends with user@host; append the remote command.
    return new Promise((resolve, reject) => {
      execFile(SSH_BIN, [...args, command], { timeout: 15_000 }, (err, stdout) => {
        if (err && !stdout) reject(err)
        else resolve(stdout)
      })
    })
  }

  disposeAll(): void {
    for (const tunnel of this.tunnels.values()) tunnel.dispose()
    this.tunnels.clear()
    this.removeAllListeners()
  }
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

let singleton: SshTunnelManager | undefined
export function getSshTunnelManager(): SshTunnelManager {
  if (!singleton) singleton = new SshTunnelManager()
  return singleton
}
