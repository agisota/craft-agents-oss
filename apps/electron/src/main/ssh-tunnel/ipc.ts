/**
 * IPC surface for SSH remote hosts + tunnels. Registered from main/index.ts.
 *
 * Host CRUD/import delegates to the shared config store; connect/disconnect
 * drives the SshTunnelManager and pushes tunnel state changes to every renderer
 * so connection dots stay live.
 */

import { ipcMain, BrowserWindow } from 'electron'
import type { SshHostConfig, SshHostInput } from '@craft-agent/shared/config'
import {
  loadSshHosts,
  addSshHost,
  updateSshHost,
  deleteSshHost,
  getSshHost,
  importSshConfigSuggestions,
} from '@craft-agent/shared/config'
import { getSshTunnelManager } from './ssh-tunnel-manager.ts'
import type { TunnelState } from './ssh-tunnel.ts'

export const SSH_TUNNEL_STATE_EVENT = 'ssh:tunnelState'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

let registered = false

export function registerSshTunnelIpc(): void {
  if (registered) return
  registered = true

  const manager = getSshTunnelManager()
  manager.on('state', (state: TunnelState) => broadcast(SSH_TUNNEL_STATE_EVENT, state))

  ipcMain.handle('ssh:listHosts', () => loadSshHosts())

  ipcMain.handle('ssh:addHost', (_e, input: SshHostInput) => addSshHost(input))

  ipcMain.handle('ssh:updateHost', (_e, id: string, updates: Partial<SshHostConfig>) =>
    updateSshHost(id, updates),
  )

  ipcMain.handle('ssh:deleteHost', (_e, id: string) => deleteSshHost(id))

  ipcMain.handle('ssh:importFromConfig', () => importSshConfigSuggestions())

  ipcMain.handle('ssh:tunnelStatus', (_e, hostId: string) => manager.getState(hostId))

  // Connect and return { url, token? } for the existing remote-workspace flow.
  ipcMain.handle('ssh:connect', async (_e, hostId: string) => {
    const host = getSshHost(hostId)
    if (!host) throw new Error(`Unknown SSH host: ${hostId}`)
    const state = await manager.connect(host)
    const token = await manager.fetchRemoteToken(host)
    return { url: state.url, localPort: state.localPort, token }
  })

  ipcMain.handle('ssh:disconnect', (_e, hostId: string) => {
    manager.disconnect(hostId)
    return manager.getState(hostId)
  })

  ipcMain.handle('ssh:startRemoteServer', async (_e, hostId: string) => {
    const host = getSshHost(hostId)
    if (!host) throw new Error(`Unknown SSH host: ${hostId}`)
    await manager.startRemoteServer(host)
    return { ok: true }
  })
}
