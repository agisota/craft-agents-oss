/**
 * WsRpcClient.resolveTarget — re-resolves url/token before every (re)connect.
 *
 * This is the mechanism that lets an SSH-backed workspace re-dial the NEW
 * forwarded port after the tunnel drops and comes back on a different port,
 * instead of dialing the dead one.
 */

import { describe, test, expect, afterEach } from 'bun:test'
import { WsRpcServer } from '../transport/server'
import { WsRpcClient } from '../transport/client'

let servers: WsRpcServer[] = []
let clients: WsRpcClient[] = []
afterEach(() => {
  for (const c of clients) c.destroy()
  for (const s of servers) s.close()
  clients = []
  servers = []
})

async function makeServer(): Promise<WsRpcServer> {
  const s = new WsRpcServer({ host: '127.0.0.1', port: 0 })
  servers.push(s)
  await s.listen()
  return s
}

async function waitConnected(client: WsRpcClient, timeoutMs = 3000) {
  const start = Date.now()
  while (client.getConnectionState().status !== 'connected') {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`connect timeout, status=${client.getConnectionState().status}`)
    }
    await new Promise((r) => setTimeout(r, 10))
  }
}

describe('WsRpcClient resolveTarget', () => {
  test('resolves the target url before the first connect', async () => {
    const server = await makeServer()
    let resolveCalls = 0
    const client = new WsRpcClient('ws://127.0.0.1:1', {
      autoReconnect: false,
      workspaceId: 'w',
      resolveTarget: async () => {
        resolveCalls++
        return { url: `ws://127.0.0.1:${server.port}`, token: 'tok' }
      },
    })
    clients.push(client)
    client.connect()
    await waitConnected(client)
    expect(resolveCalls).toBe(1)
    expect(client.getConnectionState().url).toBe(`ws://127.0.0.1:${server.port}`)
  })

  test('re-dials a NEW port on reconnect (simulates tunnel moving ports)', async () => {
    const first = await makeServer()
    const second = await makeServer()
    expect(first.port).not.toBe(second.port)

    // First resolve → first server; after it dies, resolve → second server.
    let dead = false
    let lastResolvedPort = 0
    const client = new WsRpcClient('ws://127.0.0.1:1', {
      autoReconnect: true,
      workspaceId: 'w',
      maxReconnectDelay: 50,
      resolveTarget: async () => {
        const port = dead ? second.port : first.port
        lastResolvedPort = port
        return { url: `ws://127.0.0.1:${port}`, token: 'tok' }
      },
    })
    clients.push(client)
    client.connect()
    await waitConnected(client)
    expect(lastResolvedPort).toBe(first.port)

    // Kill the first server → client should reconnect and re-resolve to the second.
    dead = true
    first.close()
    servers = servers.filter((s) => s !== first)

    // Wait for the client to land on the second port.
    const start = Date.now()
    while (client.getConnectionState().url !== `ws://127.0.0.1:${second.port}` ||
           client.getConnectionState().status !== 'connected') {
      if (Date.now() - start > 5000) {
        throw new Error(`did not re-dial new port; url=${client.getConnectionState().url} status=${client.getConnectionState().status}`)
      }
      await new Promise((r) => setTimeout(r, 20))
    }
    expect(lastResolvedPort).toBe(second.port)
    expect(client.getConnectionState().url).toBe(`ws://127.0.0.1:${second.port}`)
  })
})
