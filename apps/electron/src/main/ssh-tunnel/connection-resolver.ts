/**
 * SSH-aware remote-workspace connection resolver.
 *
 * A remote workspace can be reached two ways:
 *
 *   - Plain ws  — `RemoteServerConfig.url`/`token` point straight at a server the
 *     user runs. There is nothing to resolve: dial as-is.
 *   - SSH-backed — `RemoteServerConfig.sshHostId` is set. The durable identity is
 *     the SSH host (in the host store), NOT the persisted `url`: the tunnel
 *     forwards an EPHEMERAL localhost port that changes every session, and the
 *     managed token lives in the host store. Before the ws transport can dial, we
 *     must drive the SSH machinery to obtain a FRESH `url` + `token`:
 *       1. ensure the tunnel is up (auto-reconnect handles later drops);
 *       2. if no server answers the forwarded port, run the one-click bootstrap
 *          (fast path when already installed, full install otherwise);
 *       3. return the fresh forwarded `url` + the managed token.
 *
 * This module is the single place that knows "how do I turn a persisted
 * RemoteServerConfig into a live {url, token}". The preload transport calls it
 * (over IPC) before constructing each workspace WsRpcClient, so a restart — where
 * the old ephemeral port is dead — transparently establishes a new tunnel on a
 * new port instead of dialing the stale one.
 *
 * SECURITY: the resolved token is a managed secret. It is returned to the preload
 * over IPC (same trust boundary as today's direct token) but never logged here.
 */

import type { RemoteServerConfig } from '@craft-agent/core/types'
import type { SshHostConfig } from '@craft-agent/shared/config'
import type { BootstrapProgress } from './server-bootstrap.ts'
import type { TunnelState } from './ssh-tunnel.ts'
import { isSshBacked } from '../../shared/ssh.ts'

/** A live connection target for the ws transport. */
export interface ResolvedConnection {
  url: string
  token: string
  remoteWorkspaceId: string
}

/**
 * Structured, user-facing status for the SSH resolution phase — composed IN
 * FRONT of the ws transport states so the UI never surfaces a raw ws error
 * ("connection refused on 127.0.0.1:64037") for an SSH workspace.
 */
export type SshConnectionPhase =
  | 'tunnel-connecting'
  | 'bootstrapping'
  | 'tunnel-reconnecting'
  | 'ready'
  | 'error'

export interface SshConnectionStatus {
  hostId: string
  hostLabel: string
  phase: SshConnectionPhase
  /** Reconnect attempt count, when the tunnel dropped and is retrying. */
  attempt?: number
  /** Non-secret detail (e.g. bootstrap sub-phase). */
  detail?: string
}

/** Injected side effects so the resolver is unit-testable without ssh/net. */
export interface ConnectionResolverDeps {
  /** Look up the durable SSH host record by id. */
  getSshHost: (hostId: string) => SshHostConfig | undefined
  /**
   * Ensure a tunnel is up; resolves the forwarded ws url + local port. With
   * `requireProbe: false` the tunnel is kept (and reported connected) even when
   * nothing answers the forwarded port yet — ssh transport failures still reject.
   */
  connectTunnel: (
    host: SshHostConfig,
    opts?: { requireProbe?: boolean },
  ) => Promise<{ url?: string; localPort?: number }>
  /**
   * Ensure a managed server is installed + running on the host (fast path when
   * already alive). Resolves the managed token.
   */
  bootstrapServer: (
    host: SshHostConfig,
    onProgress: (p: BootstrapProgress) => void,
  ) => Promise<{ token: string }>
  /** Read the stored managed token for a host, if any (credential store). */
  loadManagedToken: (hostId: string) => Promise<string | undefined>
  /** Probe a forwarded local port for a live craft-agent server. */
  probe: (localPort: number) => Promise<boolean>
}

/**
 * Map a live tunnel state change to the SSH connection status the renderer
 * banners render, or null when nothing should be pushed (fresh first connect —
 * an active resolve emits its own richer phases — or an idle disconnect).
 *
 * This is the mid-session-drop path: resolveRemoteConnection only streams
 * status while a (re)dial is in flight, so without this mapping a tunnel that
 * drops later would surface as a raw ws error and the 'tunnel-reconnecting'
 * banner branch would never fire.
 */
export function tunnelStateToConnectionStatus(
  state: TunnelState,
  hostLabel: string,
): SshConnectionStatus | null {
  const base = { hostId: state.hostId, hostLabel }
  switch (state.status) {
    case 'connected':
      // Also clears any earlier reconnecting/error banner when no resolve runs.
      return { ...base, phase: 'ready' }
    case 'connecting':
      // First connect (attempts 0) is narrated by the active resolve; only a
      // drop-recovery retry needs to be pushed from here.
      return state.reconnectAttempts > 0
        ? { ...base, phase: 'tunnel-reconnecting', attempt: state.reconnectAttempts }
        : null
    case 'error':
      return state.willRetry
        ? {
            ...base,
            phase: 'tunnel-reconnecting',
            attempt: Math.max(state.reconnectAttempts, 1),
            detail: state.error,
          }
        : { ...base, phase: 'error', detail: state.error }
    case 'disconnected':
    default:
      return null
  }
}

/**
 * Resolve a persisted RemoteServerConfig into a live {url, token}.
 *
 * Plain-ws workspaces are returned unchanged (zero behavior change). SSH-backed
 * workspaces are driven through the tunnel + bootstrap machinery to obtain a
 * fresh forwarded url and the managed token.
 */
export async function resolveRemoteConnection(
  remote: RemoteServerConfig,
  deps: ConnectionResolverDeps,
  onStatus: (s: SshConnectionStatus) => void = () => {},
): Promise<ResolvedConnection> {
  if (!isSshBacked(remote)) {
    // Plain ws — dial exactly as persisted.
    return { url: remote.url, token: remote.token, remoteWorkspaceId: remote.remoteWorkspaceId }
  }

  const hostId = remote.sshHostId
  const host = deps.getSshHost(hostId)
  if (!host) {
    onStatus({ hostId, hostLabel: hostId, phase: 'error', detail: 'unknown-host' })
    throw new Error(`SSH host "${hostId}" is no longer configured. Re-add it in Remote (SSH) settings.`)
  }

  // Wrap the whole SSH resolution so ANY failure (tunnel, bootstrap, re-dial)
  // reaches the renderer as a terminal 'error' phase — the connection banner
  // masks ws state until the last phase is 'ready', so a silent throw would
  // leave it spinning forever with no retry affordance.
  try {
    // 1. Ensure the tunnel is up → fresh forwarded local port. `requireProbe:
    //    false` keeps the tunnel even when the remote server is dead (ssh
    //    transport up, nothing answering) so step 3 can bootstrap through it;
    //    an ssh-level failure still rejects here.
    onStatus({ hostId, hostLabel: host.label, phase: 'tunnel-connecting' })
    let tunnel: { url?: string; localPort?: number }
    try {
      tunnel = await deps.connectTunnel(host, { requireProbe: false })
    } catch (err) {
      throw new Error(`SSH tunnel to ${host.label} failed: ${errMsg(err)}`)
    }
    if (!tunnel.url || tunnel.localPort == null) {
      throw new Error(`SSH tunnel to ${host.label} did not report a forwarded port.`)
    }

    // 2. Is a managed server already answering on the fresh port with a token we hold?
    const stored = await deps.loadManagedToken(hostId)
    const alive = await deps.probe(tunnel.localPort)
    if (alive && stored) {
      onStatus({ hostId, hostLabel: host.label, phase: 'ready' })
      return { url: tunnel.url, token: stored, remoteWorkspaceId: remote.remoteWorkspaceId }
    }

    // 3. Server not answering (or no token) — run the one-click bootstrap. It probes
    //    over ssh, fast-paths when already installed, and installs+starts otherwise.
    onStatus({ hostId, hostLabel: host.label, phase: 'bootstrapping' })
    const { token } = await deps.bootstrapServer(host, (p) => {
      onStatus({ hostId, hostLabel: host.label, phase: 'bootstrapping', detail: p.phase })
    })

    // Re-ensure the tunnel (idempotent when it stayed up) and grab a current
    // forwarded url now that a server answers.
    const after = await deps.connectTunnel(host)
    const url = after.url ?? tunnel.url
    onStatus({ hostId, hostLabel: host.label, phase: 'ready' })
    return { url, token, remoteWorkspaceId: remote.remoteWorkspaceId }
  } catch (err) {
    onStatus({ hostId, hostLabel: host.label, phase: 'error', detail: errMsg(err) })
    throw err
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
