import { describe, it, expect } from 'bun:test'
import type { ElectronAPI } from '../../shared/types'
import { CHANNEL_MAP } from '../channel-map'

type AnyFn = (...args: any[]) => any

type FunctionKeys<T> = {
  [K in keyof T]-?: Extract<T[K], AnyFn> extends never ? never : K
}[keyof T] & string

// Aliases are pre-extracted: the bun transpiler cannot parse a bracket-indexed
// type inside `${...}` of a template-literal type (`ElectronAPI['x']}` fails);
// the alias form is the identical type.
type BrowserPaneApi = ElectronAPI['browserPane']
// Knowledge (P1 read-only) nests like browserPane via dotted CHANNEL_MAP keys.
type KnowledgeApi = ElectronAPI['knowledge']
// SiYuan engine surfaces (P2) nest the same way.
type SiyuanEngineApi = ElectronAPI['siyuanEngine']
// Extension UI surfaces (S-05) nest the same way.
type ExtensionSurfaceApi = ElectronAPI['extensionSurface']
type BrowserPaneKeys = `browserPane.${FunctionKeys<BrowserPaneApi>}`
type KnowledgeKeys = `knowledge.${FunctionKeys<KnowledgeApi>}`
type SiyuanEngineKeys = `siyuanEngine.${FunctionKeys<SiyuanEngineApi>}`
type ExtensionSurfaceKeys = `extensionSurface.${FunctionKeys<ExtensionSurfaceApi>}`

// Methods excluded from CHANNEL_MAP because they are implemented directly in the preload
// (no IPC round-trip to the main process). Each reads local state or orchestrates client-side.
type ApiToChannelMapKeys = Exclude<
  FunctionKeys<ElectronAPI>,
  | 'performOAuth'
  | 'getTransportConnectionState'
  | 'getRuntimeEnvironment'
  | 'onTransportConnectionStateChanged'
  | 'reconnectTransport'
  | 'isChannelAvailable'
  | 'getSystemWarnings' // reads env var set at startup — no IPC needed
  | 'relaunchApp' // direct IPC to main process — not through WS RPC
  | 'removeWorkspace' // direct IPC to main process — modifies local config
  | 'invokeOnServer' // direct IPC to main process — cross-server RPC
  | 'transferSessionToWorkspace' // direct IPC to main process — orchestrated remote transfer
  | 'onTransferProgress' // direct IPC listener — chunk upload progress
  | 'changeLanguage' // direct IPC to main process — syncs i18n language
  | 'exportNotePdf' // direct IPC to main process — uses BrowserWindow.printToPDF
  | 'getFilePath' // renderer-local — webUtils.getPathForFile, no IPC round-trip
  // SSH remote hosts + tunnels — direct IPC to main process (Electron-only)
  | 'sshListHosts'
  | 'sshAddHost'
  | 'sshUpdateHost'
  | 'sshDeleteHost'
  | 'sshImportFromConfig'
  | 'sshConnect'
  | 'sshBootstrapConnect'
  | 'sshResolveWorkspaceConnection'
  | 'onSshBootstrapProgress'
  | 'onSshConnectionStatus'
  | 'onOmniboxOpen' // direct IPC listener — embedded BrowserView ⌘K bridge
> | BrowserPaneKeys
  | KnowledgeKeys
  | SiyuanEngineKeys
  | ExtensionSurfaceKeys
type ChannelMapKeys = keyof typeof CHANNEL_MAP & string

type AssertNever<T extends never> = true

// Compile-time guardrails: if these fail, CHANNEL_MAP and ElectronAPI drifted.
const _missingFromMap: AssertNever<Exclude<ApiToChannelMapKeys, ChannelMapKeys>> = true
const _extraInMap: AssertNever<Exclude<ChannelMapKeys, ApiToChannelMapKeys>> = true

void _missingFromMap
void _extraInMap

describe('CHANNEL_MAP runtime contract', () => {
  it('has valid entry kinds and channels', () => {
    for (const [method, entry] of Object.entries(CHANNEL_MAP)) {
      expect(typeof method).toBe('string')
      expect(entry.type === 'invoke' || entry.type === 'listener').toBe(true)
      expect(typeof entry.channel).toBe('string')
      expect(entry.channel.length).toBeGreaterThan(0)

      if (entry.type === 'listener') {
        expect((entry as any).transform).toBeUndefined()
      }
    }
  })

  it('contains at least one listener and one invoke entry', () => {
    const values = Object.values(CHANNEL_MAP)
    expect(values.some((entry) => entry.type === 'listener')).toBe(true)
    expect(values.some((entry) => entry.type === 'invoke')).toBe(true)
  })
})
