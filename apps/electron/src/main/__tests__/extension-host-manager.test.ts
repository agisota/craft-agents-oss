import { afterEach, describe, expect, it } from 'bun:test'
import { EventEmitter } from 'node:events'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { credentialIdToAccount } from '@craft-agent/shared/credentials'
import {
  ExtensionHostManager,
  getExtensionHostManager,
  resetExtensionHostManager,
  type ExtensionHostChild,
  type ExtensionHostForkFn,
} from '../extension-host-manager'
import { CapabilityBroker } from '../extension-host/capability-broker'
import { buildScrubbedWorkerEnv } from '../extension-host/protocol'
import { isPathAllowlisted, resolveSandboxRoots } from '../extension-host/path-allowlist'
import { startWorker } from '../extension-host/worker'

async function flush(times = 5) {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

class FakeChild extends EventEmitter implements ExtensionHostChild {
  pid = 4242
  killed = false
  messages: unknown[] = []

  postMessage(message: unknown): void {
    this.messages.push(message)
  }

  kill(): void {
    this.killed = true
    queueMicrotask(() => this.emit('exit', 0))
  }
}

/** In-process worker backed fake: manager <-> startWorker via EventEmitters. */
function createInProcessFork(configDir: string): {
  forkFn: ExtensionHostForkFn
  children: FakeChild[]
} {
  const children: FakeChild[] = []

  const forkFn: ExtensionHostForkFn = () => {
    const child = new FakeChild()
    children.push(child)

    // Bridge: child.postMessage → worker; worker.postMessage → child 'message'
    const port = {
      postMessage(msg: unknown) {
        // worker → main
        queueMicrotask(() => child.emit('message', msg))
      },
      on(event: 'message', listener: (message: unknown) => void) {
        if (event === 'message') {
          child.on('__to_worker__', listener)
        }
      },
    }

    const originalPost = child.postMessage.bind(child)
    child.postMessage = (message: unknown) => {
      originalPost(message)
      // main → worker
      queueMicrotask(() => child.emit('__to_worker__', message))
    }

    startWorker({
      port,
      configDir,
      importFn: async (url: string) => {
        // Dynamic import of file URL for fixture modules
        return import(url)
      },
    })

    return child
  }

  return { forkFn, children }
}

describe('buildScrubbedWorkerEnv', () => {
  it('strips secret-shaped keys and keeps PATH', () => {
    const env = buildScrubbedWorkerEnv({
      PATH: '/usr/bin',
      HOME: '/home/u',
      OPENAI_API_KEY: 'sk-secret',
      ANTHROPIC_API_KEY: 'sk-ant',
      MY_API_KEY: 'x',
      RANDOM_TOKEN: 't',
      CRAFT_CONFIG_DIR: '/tmp/cfg',
      CRAFT_EXTENSION_SANDBOX_ROOT: '/tmp/sandbox',
      ELECTRON_RUN_AS_NODE: '1',
      NODE_OPTIONS: '--require ./evil.js',
    })
    expect(env.PATH).toBe('/usr/bin')
    expect(env.CRAFT_CONFIG_DIR).toBe('/tmp/cfg')
    expect(env.CRAFT_EXTENSION_SANDBOX_ROOT).toBe('/tmp/sandbox')
    expect(env.OPENAI_API_KEY).toBeUndefined()
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
    expect(env.MY_API_KEY).toBeUndefined()
    expect(env.RANDOM_TOKEN).toBeUndefined()
    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined()
    expect(env.NODE_OPTIONS).toBeUndefined()
  })

  it('never forwards NODE_OPTIONS into the worker', () => {
    const env = buildScrubbedWorkerEnv({
      PATH: '/bin',
      NODE_OPTIONS: '--inspect=0.0.0.0:9229',
    })
    expect(env).not.toHaveProperty('NODE_OPTIONS')
    expect(env.NODE_OPTIONS).toBeUndefined()
  })
})

describe('path allowlist', () => {
  it('accepts paths under configDir/extensions/sandbox', () => {
    const roots = resolveSandboxRoots({ configDir: '/tmp/cfg' })
    const entry = join('/tmp/cfg', 'extensions', 'sandbox', 'ext', 'index.js')
    const result = isPathAllowlisted(entry, roots)
    expect(result.ok).toBe(true)
  })

  it('rejects path traversal with ..', () => {
    const roots = resolveSandboxRoots({ configDir: '/tmp/cfg' })
    const result = isPathAllowlisted(
      join('/tmp/cfg', 'extensions', 'sandbox', '..', '..', 'secrets.js'),
      roots,
    )
    expect(result.ok).toBe(false)
  })

  it('rejects paths outside allowlist', () => {
    const roots = resolveSandboxRoots({ configDir: '/tmp/cfg' })
    const result = isPathAllowlisted('/etc/passwd', roots)
    expect(result.ok).toBe(false)
  })

  it('never treats SiYuan plugin dirs as special', () => {
    const roots = resolveSandboxRoots({ configDir: '/tmp/cfg' })
    const siyuanPlugin = '/tmp/cfg/siyuan/data/plugins/foo/index.js'
    expect(isPathAllowlisted(siyuanPlugin, roots).ok).toBe(false)
  })

  it('rejects symlink escape outside allowlisted roots', () => {
    const base = mkdtempSync(join(tmpdir(), 'eh-allow-'))
    try {
      const sandbox = join(base, 'extensions', 'sandbox')
      mkdirSync(sandbox, { recursive: true })
      const outside = join(base, 'outside-secret.js')
      writeFileSync(outside, 'export default 1\n')
      const link = join(sandbox, 'escape.js')
      symlinkSync(outside, link)

      const roots = resolveSandboxRoots({ configDir: base })
      const result = isPathAllowlisted(link, roots)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toMatch(/outside|allowlist|sandbox/i)
      }
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  })

  it('accepts real files under sandbox after realpath', () => {
    const base = mkdtempSync(join(tmpdir(), 'eh-allow-ok-'))
    try {
      const sandbox = join(base, 'extensions', 'sandbox', 'ext')
      mkdirSync(sandbox, { recursive: true })
      const entry = join(sandbox, 'index.js')
      writeFileSync(entry, 'export default 1\n')
      const roots = resolveSandboxRoots({ configDir: base })
      const result = isPathAllowlisted(entry, roots)
      expect(result.ok).toBe(true)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  })
})

describe('ExtensionHostManager', () => {
  let tmp: string

  afterEach(async () => {
    resetExtensionHostManager()
    if (tmp) {
      try {
        rmSync(tmp, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
  })

  it('starts stopped and never claims SiYuan plugin execution', () => {
    const mgr = new ExtensionHostManager({
      forkFn: () => new FakeChild(),
      skipReadyWait: true,
    })
    const status = mgr.getStatus()
    expect(status.status).toBe('stopped')
    expect(status.executesSiyuanPlugins).toBe(false)
    expect(status.pid).toBeUndefined()
  })

  it('start forks worker and reports pid when running', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const { forkFn, children } = createInProcessFork(tmp)
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/extension-host-worker.cjs',
      messageTimeoutMs: 2000,
    })

    const status = await mgr.start()
    expect(status.status).toBe('running')
    expect(status.pid).toBe(4242)
    expect(status.executesSiyuanPlugins).toBe(false)
    expect(children.length).toBe(1)
    expect(status.message).toMatch(/SiYuan|craft-sandbox/i)
  })

  it('start when already running returns status without second fork', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const { forkFn, children } = createInProcessFork(tmp)
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
    })
    await mgr.start()
    await mgr.start()
    expect(children.length).toBe(1)
  })

  it('crash → degraded; restart recovers', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const { forkFn, children } = createInProcessFork(tmp)
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
    })

    await mgr.start()
    expect(mgr.getStatus().status).toBe('running')

    // Simulate crash
    children[0]!.emit('exit', 1)
    await flush(10)

    const degraded = mgr.getStatus()
    expect(degraded.status).toBe('degraded')
    expect(degraded.pid).toBeUndefined()
    expect(degraded.executesSiyuanPlugins).toBe(false)
    expect(degraded.message).toMatch(/crash|degraded/i)

    const recovered = await mgr.restart()
    expect(recovered.status).toBe('running')
    expect(recovered.pid).toBe(4242)
    expect(recovered.executesSiyuanPlugins).toBe(false)
    expect(children.length).toBe(2)
  })

  it('stop and restart cycle', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const { forkFn } = createInProcessFork(tmp)
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
    })
    await mgr.start()
    const stopped = await mgr.stop()
    expect(stopped.status).toBe('stopped')
    expect(stopped.pid).toBeUndefined()
    const restarted = await mgr.restart()
    expect(restarted.status).toBe('running')
    expect(restarted.executesSiyuanPlugins).toBe(false)
  })

  it('load rejects path outside allowlist / with ..', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const { forkFn } = createInProcessFork(tmp)
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
    })
    await mgr.start()

    await expect(
      mgr.loadExtension('evil', join(tmp, 'extensions', 'sandbox', '..', '..', 'x.js')),
    ).rejects.toThrow(/reject|allowlist|traversal/i)

    await expect(mgr.loadExtension('evil2', '/etc/passwd')).rejects.toThrow(
      /reject|allowlist|outside/i,
    )
  })

  it('load + call routes to worker and returns result', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const sandbox = join(tmp, 'extensions', 'sandbox', 'demo')
    mkdirSync(sandbox, { recursive: true })
    const entry = join(sandbox, 'index.mjs')
    writeFileSync(
      entry,
      `export function greet(name) { return 'hello:' + name }\nexport default { greet }\n`,
    )

    const { forkFn } = createInProcessFork(tmp)
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
      messageTimeoutMs: 3000,
    })

    await mgr.start()
    await mgr.loadExtension('demo', entry)
    const result = await mgr.callExtension('demo', 'greet', ['world'])
    expect(result).toBe('hello:world')

    const status = mgr.getStatus()
    expect(status.loadedExtensions).toContain('demo')
    expect(status.executesSiyuanPlugins).toBe(false)
  })

  it('call with empty permissions fails basic permission check', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const { forkFn } = createInProcessFork(tmp)
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
    })
    await mgr.start()
    await expect(
      mgr.callExtension('x', 'y', [], []),
    ).rejects.toThrow(/permission/i)
  })

  it('executesSiyuanPlugins always false across lifecycle', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const { forkFn, children } = createInProcessFork(tmp)
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
    })
    expect(mgr.getStatus().executesSiyuanPlugins).toBe(false)
    expect((await mgr.start()).executesSiyuanPlugins).toBe(false)
    children[0]!.emit('exit', 1)
    await flush(5)
    expect(mgr.getStatus().executesSiyuanPlugins).toBe(false)
    expect((await mgr.restart()).executesSiyuanPlugins).toBe(false)
    expect((await mgr.stop()).executesSiyuanPlugins).toBe(false)
  })

  it('singleton getExtensionHostManager is stable until reset', () => {
    const a = getExtensionHostManager()
    const b = getExtensionHostManager()
    expect(a).toBe(b)
    resetExtensionHostManager()
    const c = getExtensionHostManager()
    expect(c).not.toBe(a)
  })

  it('concurrent start shares one in-flight attempt and forks once', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const { forkFn, children } = createInProcessFork(tmp)
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
    })

    const [a, b, c] = await Promise.all([mgr.start(), mgr.start(), mgr.start()])
    expect(children.length).toBe(1)
    expect(a.status).toBe('running')
    expect(b.status).toBe('running')
    expect(c.status).toBe('running')
    expect(a.pid).toBe(4242)
  })

  it('stop during start wins and never ends running', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const children: FakeChild[] = []
    let releaseReady!: () => void
    const readyGate = new Promise<void>((resolve) => {
      releaseReady = resolve
    })

    const forkFn: ExtensionHostForkFn = () => {
      const child = new FakeChild()
      children.push(child)
      void readyGate.then(() => {
        queueMicrotask(() => child.emit('message', { type: 'ready' }))
      })
      return child
    }

    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
      messageTimeoutMs: 2000,
    })

    const starting = mgr.start()
    // Let startExclusive reach waitForReady
    await flush(20)
    expect(mgr.getStatus().status).toBe('starting')
    expect(children.length).toBe(1)

    const stopped = await mgr.stop()
    expect(stopped.status).toBe('stopped')

    releaseReady()
    const startResult = await starting
    expect(startResult.status).toBe('stopped')
    expect(mgr.getStatus().status).toBe('stopped')
    expect(mgr.getStatus().pid).toBeUndefined()
    // Orphan from cancelled start must be killed; no second fork.
    expect(children.length).toBe(1)
    expect(children[0]!.killed).toBe(true)
  })

  it('intentional stop exit does not flip stopped to degraded', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const children: FakeChild[] = []
    // kill() does not auto-emit so we can fire exit after stop settles.
    class ControlledChild extends FakeChild {
      override kill(): void {
        this.killed = true
      }
    }
    const forkFn: ExtensionHostForkFn = () => {
      const child = new ControlledChild()
      children.push(child)
      queueMicrotask(() => child.emit('message', { type: 'ready' }))
      return child
    }

    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
    })

    await mgr.start()
    const child = children[0]!
    const stopped = await mgr.stop()
    expect(stopped.status).toBe('stopped')
    expect(child.killed).toBe(true)

    // Late exit after intentional stop must not clobber stopped → degraded.
    child.emit('exit', 0)
    await flush(10)
    expect(mgr.getStatus().status).toBe('stopped')
    expect(mgr.getStatus().message).not.toMatch(/crash|degraded/i)
  })

  it('stop during start then late ready/exit stays stopped not degraded', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const children: FakeChild[] = []
    let releaseReady!: () => void
    const readyGate = new Promise<void>((resolve) => {
      releaseReady = resolve
    })

    class ControlledChild extends FakeChild {
      override kill(): void {
        this.killed = true
        // Simulate async OS exit after kill while stop is in flight.
        queueMicrotask(() => this.emit('exit', 0))
      }
    }

    const forkFn: ExtensionHostForkFn = () => {
      const child = new ControlledChild()
      children.push(child)
      void readyGate.then(() => {
        queueMicrotask(() => child.emit('message', { type: 'ready' }))
      })
      return child
    }

    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
      messageTimeoutMs: 2000,
    })

    const starting = mgr.start()
    await flush(20)
    const stopped = await mgr.stop()
    expect(stopped.status).toBe('stopped')

    releaseReady()
    await starting
    await flush(20)

    expect(mgr.getStatus().status).toBe('stopped')
    expect(mgr.getStatus().status).not.toBe('degraded')
    expect(mgr.getStatus().message).not.toMatch(/crash/i)
  })

  it('mintCapability returns token only; never secret; grant required', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const { forkFn } = createInProcessFork(tmp)
    const broker = new CapabilityBroker()
    const account = 'source_bearer::ws::src'
    const secret = 'raw-secret-value-xyz'
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
      broker,
      getCredential: async (id) => {
        if (credentialIdToAccount(id) === account) return { value: secret }
        return null
      },
    })

    await mgr.start()
    await mgr.loadExtension('demo', join(tmp, 'extensions', 'sandbox', 'x.js').replace(
      // ensure path under sandbox after mkdir
      /.*/,
      (() => {
        const sandbox = join(tmp, 'extensions', 'sandbox', 'demo')
        mkdirSync(sandbox, { recursive: true })
        const entry = join(sandbox, 'index.mjs')
        writeFileSync(entry, 'export function ping() { return 1 }\n')
        return entry
      })(),
    ), [`secrets.use:${account}`, 'network.request'])

    expect(() =>
      mgr.mintCapability({
        extensionId: 'demo',
        permission: 'secrets.use:source_bearer::other::x',
      }),
    ).toThrow(/not granted/i)

    const minted = mgr.mintCapability({
      extensionId: 'demo',
      permission: `secrets.use:${account}`,
    })
    expect(minted.token).toBeTruthy()
    expect(minted.permission).toBe(`secrets.use:${account}`)
    expect(JSON.stringify(minted)).not.toContain(secret)
    expect('value' in minted).toBe(false)

    let seenAuth: string | undefined
    const result = await mgr.proxyFetch({
      token: minted.token,
      url: 'https://api.example/v1',
      fetchImpl: (async (_u, init) => {
        seenAuth = (init?.headers as Record<string, string>)?.Authorization
        return new Response('ok', { status: 200 })
      }) as typeof fetch,
    })
    expect(seenAuth).toBe(`Bearer ${secret}`)
    expect(result.status).toBe(200)
    expect(result.body).not.toContain(secret)
  })

  it('worker __craftCapability mint never receives secret', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const sandbox = join(tmp, 'extensions', 'sandbox', 'cap')
    mkdirSync(sandbox, { recursive: true })
    const entry = join(sandbox, 'index.mjs')
    writeFileSync(
      entry,
      `
export async function mintNet() {
  const cap = globalThis.__craftCapability
  if (!cap) throw new Error('no __craftCapability')
  const minted = await cap.mint('network.request', { extensionId: 'cap' })
  return minted
}
`,
    )

    const { forkFn } = createInProcessFork(tmp)
    const broker = new CapabilityBroker()
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
      broker,
      messageTimeoutMs: 3000,
      getCredential: async () => null,
    })

    await mgr.start()
    await mgr.loadExtension('cap', entry, ['network.request'])
    const minted = (await mgr.callExtension('cap', 'mintNet')) as {
      token: string
      expiresAt: number
      permission: string
    }
    expect(minted.token).toBeTruthy()
    expect(minted.permission).toBe('network.request')
    expect(Object.keys(minted).sort()).toEqual(
      ['expiresAt', 'permission', 'token'].sort(),
    )
    expect(broker.peek(minted.token)).not.toBeNull()

    mgr.revokeCapability(minted.token)
    expect(broker.peek(minted.token)).toBeNull()
  })

  it('worker cannot mint with self-supplied grants when not loaded', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const sandbox = join(tmp, 'extensions', 'sandbox', 'evil')
    mkdirSync(sandbox, { recursive: true })
    const entry = join(sandbox, 'index.mjs')
    writeFileSync(
      entry,
      `
export async function forgeMint() {
  const cap = globalThis.__craftCapability
  if (!cap) throw new Error('no __craftCapability')
  // Attempt to mint as a different, never-loaded extension with self-grant.
  return cap.mint('network.request', { extensionId: 'not-loaded' })
}
export async function escalateMint() {
  const cap = globalThis.__craftCapability
  if (!cap) throw new Error('no __craftCapability')
  // Even with the loaded id, worker cannot escalate beyond stored grants.
  return cap.mint('secrets.use:source_bearer::ws::x', { extensionId: 'evil' })
}
`,
    )

    const { forkFn } = createInProcessFork(tmp)
    const broker = new CapabilityBroker()
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
      broker,
      messageTimeoutMs: 3000,
      getCredential: async () => null,
    })

    await mgr.start()
    // Loaded with empty grants — worker self-supply must not authorize.
    await mgr.loadExtension('evil', entry, [])

    await expect(mgr.callExtension('evil', 'forgeMint')).rejects.toThrow(
      /not loaded|not granted|No stored grants/i,
    )
    await expect(mgr.callExtension('evil', 'escalateMint')).rejects.toThrow(
      /not granted/i,
    )
    expect(broker.size()).toBe(0)
  })

  it('mintCapability ignores forged grantedPermissions without prior load grants', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const sandbox = join(tmp, 'extensions', 'sandbox', 'forge')
    mkdirSync(sandbox, { recursive: true })
    const entry = join(sandbox, 'index.mjs')
    writeFileSync(entry, 'export function ping() { return 1 }\n')

    const { forkFn } = createInProcessFork(tmp)
    const broker = new CapabilityBroker()
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
      broker,
      getCredential: async () => null,
    })

    await mgr.start()

    // Unloaded extension — mint must fail even if caller claims grants.
    expect(() =>
      mgr.mintCapability({
        extensionId: 'ghost',
        permission: 'network.request',
        // @ts-expect-error forged field must not authorize
        grantedPermissions: ['network.request'],
      }),
    ).toThrow(/not loaded/i)

    // Loaded with empty grants — forged list on mint args is stripped by type
    // and requireStoredGrants only sees [] from loadExtension.
    await mgr.loadExtension('forge', entry, [])
    expect(() =>
      mgr.mintCapability({
        extensionId: 'forge',
        permission: 'network.request',
        // @ts-expect-error renderer cannot self-grant via mint
        grantedPermissions: ['network.request', 'secrets.use:source_bearer::ws::x'],
      }),
    ).toThrow(/not granted/i)
    expect(broker.size()).toBe(0)

    // After real load grants, mint works for those permissions only.
    await mgr.unloadExtension('forge')
    await mgr.loadExtension('forge', entry, ['network.request'])
    const ok = mgr.mintCapability({
      extensionId: 'forge',
      permission: 'network.request',
    })
    expect(ok.token).toBeTruthy()
    expect(broker.peek(ok.token)).not.toBeNull()
  })

  it('stop revokes all tokens so proxyFetch fails after', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const sandbox = join(tmp, 'extensions', 'sandbox', 'stop-cap')
    mkdirSync(sandbox, { recursive: true })
    const entry = join(sandbox, 'index.mjs')
    writeFileSync(entry, 'export function ping() { return 1 }\n')

    const { forkFn } = createInProcessFork(tmp)
    const broker = new CapabilityBroker()
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
      broker,
      getCredential: async () => null,
    })

    await mgr.start()
    await mgr.loadExtension('stop-cap', entry, ['network.request'])
    const minted = mgr.mintCapability({
      extensionId: 'stop-cap',
      permission: 'network.request',
    })
    expect(broker.peek(minted.token)).not.toBeNull()

    await mgr.stop()
    expect(broker.peek(minted.token)).toBeNull()
    expect(broker.size()).toBe(0)

    await expect(
      mgr.proxyFetch({
        token: minted.token,
        url: 'https://api.example/v1',
        fetchImpl: (async () => new Response('nope', { status: 200 })) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/invalid|expired|capability/i)
  })

  it('child crash clears broker tokens', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'eh-'))
    const sandbox = join(tmp, 'extensions', 'sandbox', 'crash-cap')
    mkdirSync(sandbox, { recursive: true })
    const entry = join(sandbox, 'index.mjs')
    writeFileSync(entry, 'export function ping() { return 1 }\n')

    const { forkFn, children } = createInProcessFork(tmp)
    const broker = new CapabilityBroker()
    const mgr = new ExtensionHostManager({
      forkFn,
      configDir: tmp,
      workerPath: '/virtual/worker.cjs',
      broker,
      getCredential: async () => null,
    })

    await mgr.start()
    await mgr.loadExtension('crash-cap', entry, ['network.request'])
    const minted = mgr.mintCapability({
      extensionId: 'crash-cap',
      permission: 'network.request',
    })
    expect(broker.peek(minted.token)).not.toBeNull()

    const child = children[children.length - 1]
    child.emit('exit', 1)
    await flush(20)

    expect(broker.peek(minted.token)).toBeNull()
    expect(broker.size()).toBe(0)
    expect(mgr.getStatus().status).toBe('degraded')
  })
})
