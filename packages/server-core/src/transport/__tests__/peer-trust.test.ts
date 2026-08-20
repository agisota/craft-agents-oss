import { afterEach, describe, expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash, X509Certificate } from 'node:crypto'
import { WsRpcServer } from '../server'
import { WsRpcClient } from '../client'
import {
  createPeerTrustVerifier,
  tlsSocketOptions,
  verifyPeerTrust,
} from '../peer-trust.ts'
import type { RemoteTlsTrust } from '@craft-agent/core/types'

const PIN = Buffer.alloc(32, 7).toString('base64')
const OTHER = Buffer.alloc(32, 9).toString('base64')
const TEST_TOKEN = 'test-token-with-enough-entropy-to-pass'

const teardown: Array<() => void | Promise<void>> = []

afterEach(async () => {
  for (const fn of teardown.splice(0).reverse()) {
    try { await fn() } catch { /* best-effort */ }
  }
})

function pinTrust(overrides: Partial<Extract<RemoteTlsTrust, { mode: 'spki-pin' }>> = {}): RemoteTlsTrust {
  return {
    mode: 'spki-pin',
    origin: 'wss://remote.example.test:8443',
    spkiSha256: PIN,
    enrolledAt: 1_725_000_000_000,
    ...overrides,
  }
}

describe('tlsSocketOptions', () => {
  it('never relaxes TLS for public-CA trust', () => {
    expect(tlsSocketOptions({ mode: 'public-ca' })).toEqual({ rejectUnauthorized: true })
  })

  it('never relaxes TLS for an enrolled SPKI pin', () => {
    const opts = tlsSocketOptions(pinTrust())
    expect(opts.rejectUnauthorized).toBe(true)
    expect(typeof opts.checkServerIdentity).toBe('function')
  })

  it('rejects a mismatched pin during TLS identity checks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rox-tls-pin-'))
    teardown.push(() => rmSync(dir, { recursive: true, force: true }))
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', join(dir, 'key.pem'),
      '-out', join(dir, 'cert.pem'),
      '-days', '1', '-nodes',
      '-subj', '/CN=127.0.0.1',
    ], { stdio: 'pipe' })
    const certPem = readFileSync(join(dir, 'cert.pem'))
    const x509 = new X509Certificate(certPem)
    const peer = { raw: x509.raw, subject: { CN: '127.0.0.1' }, subjectaltname: 'IP Address:127.0.0.1' }
    const err = tlsSocketOptions(pinTrust({ spkiSha256: OTHER })).checkServerIdentity!(
      '127.0.0.1',
      peer as never,
    )
    expect(err).toMatchObject({ name: 'PeerTrustError', code: 'TLS_TRUST_REJECTED' })
  })
})

describe('verifyPeerTrust', () => {
  it('resolves a matching SPKI pin before any handshake can be sent', async () => {
    await verifyPeerTrust({
      url: 'wss://remote.example.test:8443',
      socket: {} as WebSocket,
      trust: pinTrust(),
      extractSpkiSha256: () => PIN,
      nodeRuntime: true,
    })
  })

  it('rejects a mismatched pin with TLS_TRUST_REJECTED', async () => {
    await expect(
      verifyPeerTrust({
        url: 'wss://remote.example.test:8443',
        socket: {} as WebSocket,
        trust: pinTrust(),
        extractSpkiSha256: () => OTHER,
        nodeRuntime: true,
      }),
    ).rejects.toMatchObject({ code: 'TLS_TRUST_REJECTED' })
  })

  it('rejects SPKI pin in a browser WebSocket runtime', async () => {
    await expect(
      verifyPeerTrust({
        url: 'wss://remote.example.test:8443',
        socket: {} as WebSocket,
        trust: pinTrust(),
        nodeRuntime: false,
      }),
    ).rejects.toMatchObject({ code: 'TLS_TRUST_UNSUPPORTED' })
  })
})

describe('WsRpcClient peerTrustVerifier', () => {
  it('does not send a token-bearing handshake when the pin verifier rejects', async () => {
    const server = new WsRpcServer({
      host: '127.0.0.1',
      port: 0,
      requireAuth: true,
      validateToken: async () => true,
      serverId: 'peer-trust-test',
    })
    await server.listen()
    teardown.push(() => server.close())

    const client = new WsRpcClient(`ws://127.0.0.1:${server.port}`, {
      token: TEST_TOKEN,
      workspaceId: 'ws-a',
      autoReconnect: false,
      peerTrustVerifier: createPeerTrustVerifier(pinTrust(), {
        extractSpkiSha256: () => OTHER,
        nodeRuntime: true,
      }),
    })
    client.connect()
    teardown.push(() => client.destroy())

    const failed = await new Promise<string | undefined>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('client never failed')), 2000)
      const off = client.onConnectionStateChanged((state) => {
        if (state.status === 'failed') {
          clearTimeout(t)
          off()
          resolve(state.lastError?.code)
        } else if (state.status === 'connected') {
          clearTimeout(t)
          off()
          reject(new Error('handshake succeeded despite pin mismatch'))
        }
      })
    })

    expect(failed).toBe('TLS_TRUST_REJECTED')
    expect(server.getConnectedClientCount()).toBe(0)
  })

  it('fails closed at TLS when the enrolled pin does not match', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rox-tls-wss-'))
    teardown.push(() => rmSync(dir, { recursive: true, force: true }))
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', join(dir, 'key.pem'),
      '-out', join(dir, 'cert.pem'),
      '-days', '1', '-nodes',
      '-subj', '/CN=127.0.0.1',
    ], { stdio: 'pipe' })
    const key = readFileSync(join(dir, 'key.pem'))
    const cert = readFileSync(join(dir, 'cert.pem'))
    const spkiDer = new X509Certificate(cert).publicKey.export({ type: 'spki', format: 'der' })
    const actualPin = createHash('sha256').update(Uint8Array.from(spkiDer)).digest('base64')

    const server = new WsRpcServer({
      host: '127.0.0.1',
      port: 0,
      requireAuth: true,
      validateToken: async () => true,
      serverId: 'peer-trust-tls',
      tls: { cert, key },
    })
    await server.listen()
    teardown.push(() => server.close())

    const client = new WsRpcClient(`wss://127.0.0.1:${server.port}`, {
      token: TEST_TOKEN,
      workspaceId: 'ws-a',
      autoReconnect: false,
      tlsSocketOptions: tlsSocketOptions(pinTrust({
        origin: `wss://127.0.0.1:${server.port}`,
        spkiSha256: OTHER,
      })),
    })
    client.connect()
    teardown.push(() => client.destroy())

    const failed = await new Promise<{ status: string; code?: string }>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('client never failed')), 4000)
      const off = client.onConnectionStateChanged((state) => {
        if (state.status === 'failed' || state.status === 'disconnected') {
          clearTimeout(t)
          off()
          resolve({ status: state.status, code: state.lastError?.code })
        } else if (state.status === 'connected') {
          clearTimeout(t)
          off()
          reject(new Error(`handshake succeeded despite pin mismatch (actual pin ${actualPin})`))
        }
      })
    })

    expect(failed.status).not.toBe('connected')
    expect(server.getConnectedClientCount()).toBe(0)
  })
})
