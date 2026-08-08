import { afterEach, describe, expect, it } from 'bun:test'
import {
  ExtensionHostManager,
  getExtensionHostManager,
  resetExtensionHostManager,
} from '../extension-host-manager'

describe('ExtensionHostManager', () => {
  afterEach(() => {
    resetExtensionHostManager()
  })

  it('starts stopped and never claims SiYuan plugin execution', () => {
    const mgr = new ExtensionHostManager()
    const status = mgr.getStatus()
    expect(status.status).toBe('stopped')
    expect(status.executesSiyuanPlugins).toBe(false)
    expect(status.pid).toBeUndefined()
  })

  it('start is no-op safe → running without loading plugins', async () => {
    const mgr = new ExtensionHostManager()
    const status = await mgr.start()
    expect(status.status).toBe('running')
    expect(status.executesSiyuanPlugins).toBe(false)
    expect(status.message).toMatch(/does not execute|SiYuan/i)
  })

  it('stop and restart cycle', async () => {
    const mgr = new ExtensionHostManager()
    await mgr.start()
    const stopped = await mgr.stop()
    expect(stopped.status).toBe('stopped')
    const restarted = await mgr.restart()
    expect(restarted.status).toBe('running')
    expect(restarted.executesSiyuanPlugins).toBe(false)
  })

  it('singleton getExtensionHostManager is stable until reset', () => {
    const a = getExtensionHostManager()
    const b = getExtensionHostManager()
    expect(a).toBe(b)
    resetExtensionHostManager()
    const c = getExtensionHostManager()
    expect(c).not.toBe(a)
  })
})
