import { describe, it, expect } from 'bun:test'
import {
  tunnelStatusToUserFacing,
  shouldMaskWsState,
} from '../ssh-tunnel/ssh-connection-state.ts'
import type { TunnelState } from '../ssh-tunnel/ssh-tunnel.ts'

function state(patch: Partial<TunnelState>): TunnelState {
  return { hostId: 'h', status: 'disconnected', reconnectAttempts: 0, ...patch }
}

describe('tunnelStatusToUserFacing — state composition mapping', () => {
  it('connected → ready', () => {
    expect(tunnelStatusToUserFacing(state({ status: 'connected' }))).toMatchObject({
      status: 'ready',
      labelKey: 'ssh.conn.ready',
    })
  })

  it('first connecting → connecting', () => {
    expect(tunnelStatusToUserFacing(state({ status: 'connecting' }))).toMatchObject({
      status: 'connecting',
      labelKey: 'ssh.conn.connecting',
    })
  })

  it('connecting after a drop → reconnecting with attempt', () => {
    const r = tunnelStatusToUserFacing(state({ status: 'connecting', reconnectAttempts: 2 }))
    expect(r.status).toBe('reconnecting')
    expect(r.labelKey).toBe('ssh.conn.reconnecting')
    expect(r.attempt).toBe(2)
  })

  it('error mid-backoff (attempts > 0) → reconnecting, not terminal', () => {
    const r = tunnelStatusToUserFacing(state({ status: 'error', reconnectAttempts: 3, error: 'dropped' }))
    expect(r.status).toBe('reconnecting')
    expect(r.attempt).toBe(3)
  })

  it('terminal error (no attempts) → error', () => {
    const r = tunnelStatusToUserFacing(state({ status: 'error', error: 'gave up' }))
    expect(r.status).toBe('error')
    expect(r.labelKey).toBe('ssh.conn.error')
    expect(r.detail).toBe('gave up')
  })
})

describe('shouldMaskWsState', () => {
  it('plain-ws (no ssh state) never masks', () => {
    expect(shouldMaskWsState(false, undefined)).toBe(false)
  })
  it('ws connected → never mask (show ws)', () => {
    expect(shouldMaskWsState(true, tunnelStatusToUserFacing(state({ status: 'connecting' })))).toBe(false)
  })
  it('ws not connected + ssh settling → mask ws error', () => {
    expect(shouldMaskWsState(false, tunnelStatusToUserFacing(state({ status: 'connecting' })))).toBe(true)
  })
  it('ws not connected but ssh ready → do not mask (ws is authoritative)', () => {
    expect(shouldMaskWsState(false, tunnelStatusToUserFacing(state({ status: 'connected' })))).toBe(false)
  })
})
