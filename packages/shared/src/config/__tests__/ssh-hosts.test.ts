import { describe, expect, it, beforeAll, beforeEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// paths.ts reads CRAFT_CONFIG_DIR at first import, so set it before importing
// the store and use one config dir for the whole suite (cleared between tests).
const CONFIG_DIR = mkdtempSync(join(tmpdir(), 'craft-ssh-hosts-'))
process.env.CRAFT_CONFIG_DIR = CONFIG_DIR

let store: typeof import('../ssh-hosts.ts')

beforeAll(async () => {
  store = await import('../ssh-hosts.ts')
})

beforeEach(() => {
  rmSync(store.getSshHostsPath(), { force: true })
})

describe('ssh-hosts store', () => {
  it('returns [] when no file exists', () => {
    expect(store.loadSshHosts()).toEqual([])
  })

  it('adds a host with slugified id and defaults', () => {
    const host = store.addSshHost({ label: 'My Box', host: '10.0.0.1', user: 'root' })
    expect(host.id).toBe('my-box')
    expect(host.port).toBe(22)
    expect(host.remotePort).toBe(9100)
    expect(store.loadSshHosts()).toHaveLength(1)
  })

  it('ensures unique ids on collision', () => {
    const a = store.addSshHost({ label: 'Box', host: 'h', user: 'u' })
    const b = store.addSshHost({ label: 'Box', host: 'h2', user: 'u' })
    expect(a.id).toBe('box')
    expect(b.id).toBe('box-2')
  })

  it('updates an existing host', () => {
    const host = store.addSshHost({ label: 'Box', host: 'h', user: 'u' })
    const updated = store.updateSshHost(host.id, { user: 'deploy', remotePort: 9200 })
    expect(updated?.user).toBe('deploy')
    expect(updated?.remotePort).toBe(9200)
    expect(store.getSshHost(host.id)?.user).toBe('deploy')
  })

  it('returns undefined updating a missing host', () => {
    expect(store.updateSshHost('nope', { user: 'x' })).toBeUndefined()
  })

  it('deletes a host', () => {
    const host = store.addSshHost({ label: 'Box', host: 'h', user: 'u' })
    expect(store.deleteSshHost(host.id)).toBe(true)
    expect(store.loadSshHosts()).toEqual([])
    expect(store.deleteSshHost(host.id)).toBe(false)
  })

  it('persists to disk', () => {
    store.addSshHost({ label: 'Persisted', host: 'h', user: 'u' })
    expect(store.loadSshHosts()[0]!.label).toBe('Persisted')
  })
})
