import { describe, expect, it } from 'bun:test'
import { needsRemoteTlsInspect, tlsTrustFromDecision } from './remote-tls-connect'

describe('needsRemoteTlsInspect', () => {
  it('requires inspect for wss and https remotes', () => {
    expect(needsRemoteTlsInspect('wss://remote.example.test:8443')).toBe(true)
    expect(needsRemoteTlsInspect('https://remote.example.test')).toBe(true)
  })

  it('skips inspect for ws:// and SSH-backed remotes', () => {
    expect(needsRemoteTlsInspect('ws://192.168.1.100:9100')).toBe(false)
    expect(needsRemoteTlsInspect('wss://remote.example.test:8443', 'host-1')).toBe(false)
  })
})

describe('tlsTrustFromDecision', () => {
  it('keeps persist for create/reconnect remoteServer', () => {
    const persist = {
      mode: 'spki-pin' as const,
      origin: 'wss://remote.example.test:8443',
      spkiSha256: 'pin',
      enrolledAt: 1,
    }
    expect(tlsTrustFromDecision(persist)).toEqual(persist)
    expect(tlsTrustFromDecision(null)).toBeUndefined()
  })
})

describe('ConnectRemote token test uses enrolled pin', () => {
  it('passes persist into testRemoteConnection after accept', () => {
    const src = require('node:fs').readFileSync(require('node:path').join(import.meta.dir, 'AddWorkspaceStep_ConnectRemote.tsx'), 'utf8')
    expect(src).toContain('testRemoteConnection(serverUrl, token, trust)')
    expect(src).toContain('await runTokenBearingTest(persist)')
    expect(src).not.toContain('JSON.stringify(result')
  })
})
