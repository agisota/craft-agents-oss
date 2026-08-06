import { describe, expect, it, beforeEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { pathToFileURL } from 'url'
import type { RemoteServerConfig } from '@craft-agent/core/types'

/** SSH-backed workspaces record sshHostId durably (not the ephemeral port);
 * plain-ws workspaces round-trip unchanged (backward compat). */

const STORAGE_MODULE_PATH = pathToFileURL(join(import.meta.dir, '..', 'storage.ts')).href

async function freshStorage() {
  const configDir = mkdtempSync(join(tmpdir(), 'craft-agent-ssh-persist-'))
  mkdirSync(configDir, { recursive: true })
  // Minimal root config so loadStoredConfig() has something to read/write.
  writeFileSync(
    join(configDir, 'config.json'),
    JSON.stringify({ workspaces: [], activeWorkspaceId: null, activeSessionId: null }, null, 2),
    'utf-8',
  )
  process.env.CRAFT_CONFIG_DIR = configDir
  // Bust the module cache so CONFIG_DIR picks up the new env value.
  const mod = (await import(`${STORAGE_MODULE_PATH}?t=${Date.now()}-${Math.random()}`)) as typeof import('../storage.ts')
  mod.ensureConfigDir()
  mod.ensureConfigDefaults()
  return mod
}

describe('RemoteServerConfig SSH persistence', () => {
  beforeEach(() => {
    delete process.env.CRAFT_CONFIG_DIR
  })

  it('persists sshHostId on an SSH-backed workspace and survives reload', async () => {
    const storage = await freshStorage()
    const remoteServer: RemoteServerConfig = {
      url: 'ws://127.0.0.1:50123', // ephemeral — must NOT be the source of truth
      token: 'managed',
      remoteWorkspaceId: 'remote-ws-1',
      sshHostId: 'prod-box',
    }
    const ws = storage.addWorkspace({ name: 'Prod', rootPath: join(tmpdir(), 'prod'), remoteServer } as any)

    // Reload from disk (fresh module instance, same config dir).
    const reloaded = await import(`${STORAGE_MODULE_PATH}?t=${Date.now()}-${Math.random()}`)
    const found = (reloaded.getWorkspaces() as any[]).find((w) => w.id === ws.id)
    expect(found).toBeTruthy()
    expect(found.remoteServer.sshHostId).toBe('prod-box')
    expect(found.remoteServer.remoteWorkspaceId).toBe('remote-ws-1')
  })

  it('plain-ws workspace round-trips with no sshHostId (backward compat)', async () => {
    const storage = await freshStorage()
    const remoteServer: RemoteServerConfig = {
      url: 'wss://my-server:8443',
      token: 't',
      remoteWorkspaceId: 'rw',
    }
    const ws = storage.addWorkspace({ name: 'Plain', rootPath: join(tmpdir(), 'plain'), remoteServer } as any)
    const found = (storage.getWorkspaces() as any[]).find((w) => w.id === ws.id)
    expect(found.remoteServer.sshHostId).toBeUndefined()
    expect(found.remoteServer.url).toBe('wss://my-server:8443')
  })

  it('updateWorkspaceRemoteServer preserves sshHostId when re-binding', async () => {
    const storage = await freshStorage()
    const ws = storage.addWorkspace({ name: 'X', rootPath: join(tmpdir(), 'x') } as any)
    storage.updateWorkspaceRemoteServer(ws.id, {
      url: 'ws://127.0.0.1:9',
      token: 'k',
      remoteWorkspaceId: 'r',
      sshHostId: 'host-42',
    })
    const found = (storage.getWorkspaces() as any[]).find((w) => w.id === ws.id)
    expect(found.remoteServer.sshHostId).toBe('host-42')
  })
})
