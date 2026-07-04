/**
 * User-facing SSH connection state, composed IN FRONT of the ws transport state.
 *
 * An SSH-backed workspace has two layered lifecycles:
 *
 *   ssh layer  — tunnel connecting / bootstrapping server / tunnel dropped &
 *                reconnecting on a NEW local port
 *   ws layer   — the existing TransportConnectionState against the forwarded port
 *
 * The UI must show the SSH-level state and NEVER a raw ws error like
 * "connection refused on 127.0.0.1:64037" while the SSH layer is still settling.
 * This module produces a single discriminated status the UI can render, plus the
 * i18n key it maps to. The renderer decides, per workspace: if the ws layer is
 * `connected`, show the ws state; otherwise, if the workspace is SSH-backed and
 * the SSH layer is not `ready`, show the SSH state instead of the ws error.
 */

import type { TunnelState, TunnelStatus } from './ssh-tunnel.ts'

/** The single user-facing SSH status the renderer renders. */
export type SshUserFacingStatus =
  | 'connecting' // tunnel is coming up (first connect)
  | 'starting-server' // bootstrap: installing/starting the remote server
  | 'reconnecting' // tunnel dropped, retrying on a new port
  | 'ready' // tunnel up + server answering; defer to ws state
  | 'error' // tunnel/bootstrap gave up

export interface SshUserFacingState {
  status: SshUserFacingStatus
  /** i18n key under `ssh.conn.*` for the status label. */
  labelKey: string
  /** Reconnect attempt, surfaced for the "reconnecting (attempt N)" string. */
  attempt?: number
  /** Non-secret detail (bootstrap sub-phase, error message). */
  detail?: string
}

/** Map a live tunnel status to its user-facing SSH status. */
export function tunnelStatusToUserFacing(state: TunnelState): SshUserFacingState {
  const status: TunnelStatus = state.status
  switch (status) {
    case 'connected':
      return { status: 'ready', labelKey: 'ssh.conn.ready' }
    case 'connecting':
      // First attempt vs. a reconnect after a drop.
      if (state.reconnectAttempts > 0) {
        return {
          status: 'reconnecting',
          labelKey: 'ssh.conn.reconnecting',
          attempt: state.reconnectAttempts,
        }
      }
      return { status: 'connecting', labelKey: 'ssh.conn.connecting' }
    case 'error':
      // An `error` state with reconnectAttempts > 0 is a transient drop being
      // retried (backoff window), not a terminal failure.
      if (state.reconnectAttempts > 0) {
        return {
          status: 'reconnecting',
          labelKey: 'ssh.conn.reconnecting',
          attempt: state.reconnectAttempts,
          detail: state.error,
        }
      }
      return { status: 'error', labelKey: 'ssh.conn.error', detail: state.error }
    case 'disconnected':
    default:
      return { status: 'connecting', labelKey: 'ssh.conn.connecting' }
  }
}

/**
 * Decide whether the SSH layer should mask the ws transport state for this
 * workspace. When true, the UI shows {@link SshUserFacingState}; when false, the
 * ws transport is in control (either connected, or a plain-ws workspace).
 *
 * @param wsConnected  whether the ws transport reports `connected`
 * @param ssh          the composed SSH state, or undefined for plain-ws
 */
export function shouldMaskWsState(
  wsConnected: boolean,
  ssh: SshUserFacingState | undefined,
): boolean {
  if (!ssh) return false // plain-ws: never mask
  if (wsConnected) return false // tunnel + server up and ws dialed through: show ws
  return ssh.status !== 'ready' // SSH layer still settling: mask the ws error
}
