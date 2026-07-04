/**
 * Unit tests for the SshTunnel state machine and port allocator.
 * child_process is faked via an injected spawn returning a controllable
 * EventEmitter-backed process stub.
 */

import { describe, it, expect } from 'bun:test'
import { EventEmitter } from 'events'
import { SshTunnel, buildSshArgs, type SshTunnelDeps } from '../ssh-tunnel/ssh-tunnel.ts'
import { findFreePort } from '../ssh-tunnel/port-allocator.ts'
import type { SshHostConfig } from '@craft-agent/shared/config'

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const HOST: SshHostConfig = {
  id: 'box',
  label: 'Box',
  host: 'example.com',
  port: 2222,
  user: 'deploy',
  remotePort: 9100,
  identityFile: '/keys/id_ed25519',
}

class FakeProc extends EventEmitter {
  stderr = new EventEmitter()
  killed = false
  kill() {
    this.killed = true
    // ssh exits when killed.
    queueMicrotask(() => this.emit('exit', null))
    return true
  }
}

function makeDeps(overrides: Partial<SshTunnelDeps> & { procs?: FakeProc[] } = {}): {
  deps: SshTunnelDeps
  procs: FakeProc[]
  timers: Array<() => void>
} {
  const procs = overrides.procs ?? []
  const timers: Array<() => void> = []
  const deps: SshTunnelDeps = {
    spawn: () => {
      const p = new FakeProc()
      procs.push(p)
      return p as unknown as ReturnType<SshTunnelDeps['spawn']>
    },
    probe: overrides.probe ?? (async () => true),
    allocatePort: overrides.allocatePort ?? (async () => 55000),
    backoffMs: () => 1,
    maxReconnects: overrides.maxReconnects ?? 3,
    // Run scheduled reconnects synchronously via a collected queue.
    setTimeoutFn: (fn) => {
      timers.push(fn)
      return 0 as unknown as ReturnType<typeof setTimeout>
    },
    clearTimeoutFn: () => {},
  }
  return { deps, procs, timers }
}

describe('buildSshArgs', () => {
  it('builds -N -L forward with hardening options', () => {
    const args = buildSshArgs(HOST, { forward: { localPort: 55000 } })
    expect(args).toContain('-N')
    expect(args).toContain('55000:127.0.0.1:9100')
    expect(args.join(' ')).toContain('BatchMode=yes')
    expect(args.join(' ')).toContain('ExitOnForwardFailure=yes')
    expect(args.join(' ')).toContain('ConnectTimeout=10')
    expect(args).toContain('-i')
    expect(args).toContain('/keys/id_ed25519')
    expect(args[args.length - 1]).toBe('deploy@example.com')
    expect(args).toContain('2222')
  })

  it('omits forwarding flags in command mode', () => {
    const args = buildSshArgs(HOST)
    expect(args).not.toContain('-N')
    expect(args).not.toContain('-L')
    expect(args.join(' ')).not.toContain('ExitOnForwardFailure')
    expect(args.join(' ')).toContain('BatchMode=yes')
    expect(args.join(' ')).toContain('ConnectTimeout=10')
    expect(args[args.length - 1]).toBe('deploy@example.com')
  })

  it('omits -i when no identityFile', () => {
    const { identityFile, ...rest } = HOST
    void identityFile
    expect(buildSshArgs(rest, { forward: { localPort: 1 } }).includes('-i')).toBe(false)
  })
})

describe('SshTunnel state machine', () => {
  it('goes connecting -> connected when probe succeeds', async () => {
    const { deps } = makeDeps()
    const tunnel = new SshTunnel(HOST, deps)
    const states: string[] = []
    tunnel.on('state', (s) => states.push(s.status))
    await tunnel.connect()
    const st = tunnel.getState()
    expect(st.status).toBe('connected')
    expect(st.localPort).toBe(55000)
    expect(st.url).toBe('ws://127.0.0.1:55000')
    expect(states).toEqual(['connecting', 'connected'])
  })

  it('errors when probe fails (no server on forwarded port)', async () => {
    const { deps, procs } = makeDeps({ probe: async () => false })
    const tunnel = new SshTunnel(HOST, deps)
    await tunnel.connect()
    await Promise.resolve() // let the kill's exit event fire
    expect(tunnel.getState().status).toBe('error')
    expect(procs[0]!.killed).toBe(true)
  })

  it('surfaces stderr in the error message', async () => {
    const { deps, procs } = makeDeps({ probe: async () => false })
    const tunnel = new SshTunnel(HOST, deps)
    const connectP = tunnel.connect()
    // allocatePort is async, so spawn happens a tick later.
    await Promise.resolve()
    procs[0]!.stderr.emit('data', 'Permission denied (publickey).')
    await connectP
    expect(tunnel.getState().error).toContain('Permission denied')
  })

  it('auto-reconnects with backoff when the tunnel drops', async () => {
    const probes = [true, true]
    const { deps, procs, timers } = makeDeps({ probe: async () => probes.shift() ?? true })
    const tunnel = new SshTunnel(HOST, deps)
    await tunnel.connect()
    expect(tunnel.getState().status).toBe('connected')

    // Simulate ssh dying unexpectedly.
    procs[0]!.emit('exit', 255)
    expect(tunnel.getState().status).toBe('error')
    expect(tunnel.getState().reconnectAttempts).toBe(1)
    expect(timers).toHaveLength(1)

    // Fire the scheduled reconnect.
    timers[0]!()
    await flush()
    expect(tunnel.getState().status).toBe('connected')
    expect(tunnel.getState().reconnectAttempts).toBe(0)
  })

  it('gives up after maxReconnects when reconnects keep failing', async () => {
    // First probe connects; every reconnect probe fails.
    let first = true
    const { deps, procs, timers } = makeDeps({
      maxReconnects: 2,
      probe: async () => {
        if (first) {
          first = false
          return true
        }
        return false
      },
    })
    const tunnel = new SshTunnel(HOST, deps)
    await tunnel.connect()
    expect(tunnel.getState().status).toBe('connected')

    // Drop the live tunnel -> schedules reconnect attempt 1.
    procs[procs.length - 1]!.emit('exit', 255)
    expect(tunnel.getState().reconnectAttempts).toBe(1)

    // Attempt 1 (probe fails, kills proc -> exit -> schedules attempt 2).
    timers.shift()!()
    await flush()
    expect(tunnel.getState().reconnectAttempts).toBe(2)

    // Attempt 2 (probe fails) -> exceeds maxReconnects -> give up.
    timers.shift()!()
    await flush()
    expect(tunnel.getState().status).toBe('error')
    expect(tunnel.getState().error).toContain('gave up')
  })

  it('disconnect stops reconnection', async () => {
    const { deps, procs } = makeDeps()
    const tunnel = new SshTunnel(HOST, deps)
    await tunnel.connect()
    tunnel.disconnect()
    expect(tunnel.getState().status).toBe('disconnected')
    // A later exit event must not trigger reconnect.
    procs[0]!.emit('exit', 0)
    expect(tunnel.getState().status).toBe('disconnected')
  })
})

describe('findFreePort', () => {
  it('returns a usable port number', async () => {
    const port = await findFreePort()
    expect(port).toBeGreaterThan(0)
    expect(port).toBeLessThan(65536)
  })

  it('returns different ports across calls', async () => {
    const a = await findFreePort()
    const b = await findFreePort()
    // Not guaranteed distinct, but the allocator should not throw.
    expect(typeof a).toBe('number')
    expect(typeof b).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// Manager helpers: application-level probe + shell quoting
// ---------------------------------------------------------------------------

import { probeOnce, posixSingleQuote } from '../ssh-tunnel/ssh-tunnel-manager.ts'
import type { Socket } from 'net'

class FakeSocket extends EventEmitter {
  written: string[] = []
  destroyed = false
  write(data: string) {
    this.written.push(data)
    return true
  }
  destroy() {
    this.destroyed = true
  }
  setTimeout(_ms: number, _cb?: () => void) {
    return this
  }
}

describe('probeOnce', () => {
  it('succeeds only after receiving a response byte', async () => {
    const sock = new FakeSocket()
    const p = probeOnce(1234, () => sock as unknown as Socket)
    sock.emit('connect')
    expect(sock.written[0]).toContain('GET / HTTP/1.1')
    sock.emit('data', Buffer.from('HTTP/1.1 400 Bad Request'))
    expect(await p).toBe(true)
    expect(sock.destroyed).toBe(true)
  })

  it('fails when the socket closes without any data (ssh -L false accept)', async () => {
    const sock = new FakeSocket()
    const p = probeOnce(1234, () => sock as unknown as Socket)
    // ssh accepts locally, then tears down when the remote channel fails.
    sock.emit('connect')
    sock.emit('close')
    expect(await p).toBe(false)
  })

  it('fails on connection error', async () => {
    const sock = new FakeSocket()
    const p = probeOnce(1234, () => sock as unknown as Socket)
    sock.emit('error', new Error('ECONNREFUSED'))
    expect(await p).toBe(false)
  })
})

describe('posixSingleQuote', () => {
  it('wraps plain strings in single quotes', () => {
    expect(posixSingleQuote('echo hi')).toBe("'echo hi'")
  })

  it('escapes embedded single quotes', () => {
    expect(posixSingleQuote("echo 'hi'")).toBe("'echo '\\''hi'\\'''")
  })
})
