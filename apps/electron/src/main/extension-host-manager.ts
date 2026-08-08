/**
 * Craft Extension Host lifecycle scaffold (W6).
 *
 * Honest about what it does NOT do: this host does not load or execute
 * third-party SiYuan plugin code. SiYuan plugins remain runtime
 * `siyuan-plugin` inside the SiYuan process. Lifecycle methods are no-op
 * safe and report running/degraded without spawning untrusted code.
 */

import type { ExtensionHostStatus } from '@craft-agent/shared/extensions'

export type ExtensionHostLifecycle = 'stopped' | 'starting' | 'running' | 'degraded'

export class ExtensionHostManager {
  private lifecycle: ExtensionHostLifecycle = 'stopped'
  private message?: string

  getStatus(): ExtensionHostStatus {
    return {
      status: this.lifecycle,
      // Never claim a worker pid — we do not spawn plugin host processes yet.
      executesSiyuanPlugins: false,
      message:
        this.message ??
        'Extension Host scaffold — does not execute SiYuan plugins',
    }
  }

  /**
   * No-op safe start. Transitions to running without loading third-party code.
   * Callers must treat executesSiyuanPlugins:false as authoritative.
   */
  async start(): Promise<ExtensionHostStatus> {
    if (this.lifecycle === 'running') return this.getStatus()
    this.lifecycle = 'starting'
    // Intentionally no child_process / utilityProcess / dynamic import of plugins.
    this.lifecycle = 'running'
    this.message =
      'Extension Host running (scaffold) — SiYuan plugins execute only inside SiYuan'
    return this.getStatus()
  }

  async stop(): Promise<ExtensionHostStatus> {
    this.lifecycle = 'stopped'
    this.message = 'Extension Host stopped'
    return this.getStatus()
  }

  async restart(): Promise<ExtensionHostStatus> {
    await this.stop()
    return this.start()
  }
}

let singleton: ExtensionHostManager | null = null

export function getExtensionHostManager(): ExtensionHostManager {
  if (!singleton) singleton = new ExtensionHostManager()
  return singleton
}

/** Test helper — drop singleton. */
export function resetExtensionHostManager(): void {
  singleton = null
}
