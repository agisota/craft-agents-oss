/**
 * Unit tests for the one-click remote-server bootstrap state machine.
 * All side effects (ssh exec, scp, artifact resolution, probe, token store)
 * are injected as mocks — nothing touches the network or filesystem.
 */

import { describe, it, expect } from 'bun:test'
import {
  bootstrapRemoteServer,
  buildStartCommand,
  REMOTE_LOG_PATH,
  type ServerBootstrapDeps,
  type BootstrapProgress,
} from '../ssh-tunnel/server-bootstrap.ts'
import type { SshHostConfig } from '@craft-agent/shared/config'

const HOST: SshHostConfig = {
  id: 'box',
  label: 'Box',
  host: '127.0.0.1',
  port: 2222,
  user: 'tester',
  remotePort: 9200,
}

interface Recorded {
  remoteCommands: string[]
  uploads: Array<{ local: string; remote: string }>
  stored: Record<string, string>
  progress: BootstrapProgress[]
}

function makeDeps(
  overrides: Partial<ServerBootstrapDeps> & {
    probeResults?: boolean[]
    initialToken?: string
  } = {},
): { deps: ServerBootstrapDeps; rec: Recorded; onProgress: (p: BootstrapProgress) => void } {
  const rec: Recorded = { remoteCommands: [], uploads: [], stored: {}, progress: [] }
  if (overrides.initialToken) rec.stored[HOST.id] = overrides.initialToken
  const probeResults = overrides.probeResults ? [...overrides.probeResults] : []
  let probeIdx = 0

  const deps: ServerBootstrapDeps = {
    runRemote: async (_h, cmd) => {
      rec.remoteCommands.push(cmd)
      if (cmd.includes('uname')) return 'Darwin arm64\n'
      if (cmd.includes('tail')) return 'boom: server crashed\n'
      return ''
    },
    uploadFile: async (_h, local, remote) => {
      rec.uploads.push({ local, remote })
    },
    detectTarget: () => ({ platform: 'darwin', arch: 'arm64' }),
    resolveArtifact: async () => ({
      archivePath: '/local/dist/craft-server-1.0.0-darwin-arm64.tar.gz',
      archiveName: 'craft-server-1.0.0-darwin-arm64.tar.gz',
      version: '1.0.0',
    }),
    probe: async () => {
      const r = probeResults[probeIdx] ?? false
      probeIdx++
      return r
    },
    generateToken: () => 'GENERATED_SECRET_TOKEN_abcdef0123456789',
    storeToken: (hostId, token) => {
      rec.stored[hostId] = token
    },
    loadStoredToken: (hostId) => rec.stored[hostId],
    sleep: async () => {},
    probeAttempts: 3,
    probeIntervalMs: 1,
    ...overrides,
  }
  const onProgress = (p: BootstrapProgress) => rec.progress.push(p)
  return { deps, rec, onProgress }
}

describe('buildStartCommand', () => {
  it('extracts, passes token via env, detaches under nohup, logs to a file', () => {
    const cmd = buildStartCommand('~/.craft-agent/x.tar.gz', 'secret-token', 9200)
    expect(cmd).toContain('tar -xzf ~/.craft-agent/x.tar.gz')
    expect(cmd).toContain('CRAFT_SERVER_TOKEN=')
    expect(cmd).toContain('CRAFT_RPC_PORT=9200')
    expect(cmd).toContain('nohup')
    expect(cmd).toContain(REMOTE_LOG_PATH)
    expect(cmd).toContain('&')
  })

  it('quotes the token so shell metacharacters are inert', () => {
    const cmd = buildStartCommand('~/x.tgz', "to'ken", 9100)
    // The launcher is single-quoted for the outer `sh -c`, so the token is
    // doubly quoted — but never appears as the bare, unescaped literal.
    expect(cmd).not.toContain("=to'ken ")
    expect(cmd).toContain('CRAFT_SERVER_TOKEN=')
  })

  it('detaches all fds so the ssh channel closes (no hang)', () => {
    const cmd = buildStartCommand('~/x.tgz', 'tok', 9100)
    expect(cmd).toContain('< /dev/null')
    expect(cmd).toContain('sh -c')
  })
})

describe('bootstrapRemoteServer', () => {
  it('short-circuits when a server is already alive and a token is stored', async () => {
    const { deps, rec } = makeDeps({ probeResults: [true], initialToken: 'EXISTING_TOKEN' })
    const result = await bootstrapRemoteServer(HOST, deps, (p) => rec.progress.push(p))
    expect(result.token).toBe('EXISTING_TOKEN')
    expect(rec.uploads).toHaveLength(0)
    expect(rec.remoteCommands).toHaveLength(0)
    expect(rec.progress.map((p) => p.phase)).toEqual(['checking-server', 'ready'])
  })

  it('runs the full install path when no server exists', async () => {
    // First probe (initial check) false, then post-start probe true.
    const { deps, rec, onProgress } = makeDeps({ probeResults: [false, true] })
    const result = await bootstrapRemoteServer(HOST, deps, onProgress)

    expect(result.token).toBe('GENERATED_SECRET_TOKEN_abcdef0123456789')
    // Token was persisted.
    expect(rec.stored[HOST.id]).toBe('GENERATED_SECRET_TOKEN_abcdef0123456789')
    // Uploaded the artifact.
    expect(rec.uploads).toHaveLength(1)
    expect(rec.uploads[0]!.local).toContain('craft-server-1.0.0-darwin-arm64.tar.gz')
    // Detected OS, then started the server.
    expect(rec.remoteCommands.some((c) => c.includes('uname'))).toBe(true)
    expect(rec.remoteCommands.some((c) => c.includes('nohup'))).toBe(true)
    // Progress reached ready.
    expect(rec.progress.at(-1)!.phase).toBe('ready')
  })

  it('never leaks the token into progress events', async () => {
    const { deps, rec, onProgress } = makeDeps({ probeResults: [false, true] })
    await bootstrapRemoteServer(HOST, deps, onProgress)
    const serialized = JSON.stringify(rec.progress)
    expect(serialized).not.toContain('GENERATED_SECRET_TOKEN')
  })

  it('reuses a stored token when the server needs (re)installing', async () => {
    const { deps, rec, onProgress } = makeDeps({
      probeResults: [false, true],
      initialToken: 'REUSED_TOKEN_0123456789abcdef',
    })
    const result = await bootstrapRemoteServer(HOST, deps, onProgress)
    expect(result.token).toBe('REUSED_TOKEN_0123456789abcdef')
    // Started the server with the reused token (present in the start command).
    expect(rec.remoteCommands.some((c) => c.includes('REUSED_TOKEN_0123456789abcdef'))).toBe(true)
  })

  it('surfaces a remote log tail on start timeout', async () => {
    // Initial probe false, and all post-start probes false → timeout.
    const { deps, onProgress } = makeDeps({ probeResults: [false, false, false, false] })
    await expect(bootstrapRemoteServer(HOST, deps, onProgress)).rejects.toThrow(/server crashed/)
  })
})
