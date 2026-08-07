import { describe, test, expect } from 'bun:test'
import { getAllChannelValues, RPC_CHANNELS } from '../channels'
import { LOCAL_ONLY_CHANNELS, REMOTE_ELIGIBLE_CHANNELS } from '../routing'

describe('channel routing exhaustiveness', () => {
  const all = getAllChannelValues()

  test('every channel is classified exactly once', () => {
    for (const ch of all) {
      const inLocal = LOCAL_ONLY_CHANNELS.has(ch)
      const inRemote = REMOTE_ELIGIBLE_CHANNELS.has(ch)

      if (!inLocal && !inRemote) {
        throw new Error(`Channel "${ch}" is not classified in LOCAL_ONLY or REMOTE_ELIGIBLE. Add it to one set in routing.ts.`)
      }
      if (inLocal && inRemote) {
        throw new Error(`Channel "${ch}" is in BOTH LOCAL_ONLY and REMOTE_ELIGIBLE. It must be in exactly one.`)
      }
    }
  })

  test('no extra channels in LOCAL_ONLY', () => {
    for (const ch of LOCAL_ONLY_CHANNELS) {
      expect(all).toContain(ch)
    }
  })

  test('no extra channels in REMOTE_ELIGIBLE', () => {
    for (const ch of REMOTE_ELIGIBLE_CHANNELS) {
      expect(all).toContain(ch)
    }
  })

  test('sets are non-empty', () => {
    expect(LOCAL_ONLY_CHANNELS.size).toBeGreaterThan(0)
    expect(REMOTE_ELIGIBLE_CHANNELS.size).toBeGreaterThan(0)
  })

  test('total classified equals total channels', () => {
    expect(LOCAL_ONLY_CHANNELS.size + REMOTE_ELIGIBLE_CHANNELS.size).toBe(all.length)
  })
})

describe('channel routing behavior', () => {
  test('LOCAL_ONLY and REMOTE_ELIGIBLE have zero intersection', () => {
    const intersection: string[] = []
    for (const ch of LOCAL_ONLY_CHANNELS) {
      if (REMOTE_ELIGIBLE_CHANNELS.has(ch)) {
        intersection.push(ch)
      }
    }
    expect(intersection).toEqual([])
  })

  test('all server:* channels are REMOTE_ELIGIBLE', () => {
    const serverChannels = Object.values(RPC_CHANNELS.server)
    expect(serverChannels.length).toBeGreaterThan(0)

    for (const ch of serverChannels) {
      expect(REMOTE_ELIGIBLE_CHANNELS.has(ch)).toBe(true)
    }
  })

  test('no LOCAL_ONLY channel starts with server:', () => {
    for (const ch of LOCAL_ONLY_CHANNELS) {
      if (ch.startsWith('server:')) {
        throw new Error(`server:* channel "${ch}" must be REMOTE_ELIGIBLE, not LOCAL_ONLY`)
      }
    }
  })
})

describe('knowledge channel routing (P1 read-only)', () => {
  const REMOTE_READ_CHANNELS = [
    RPC_CHANNELS.knowledge.LIST_CONNECTIONS,
    RPC_CHANNELS.knowledge.CAPABILITIES,
    RPC_CHANNELS.knowledge.SEARCH,
    RPC_CHANNELS.knowledge.GET,
    RPC_CHANNELS.knowledge.GET_CONTEXT,
    RPC_CHANNELS.knowledge.GET_BACKLINKS,
    RPC_CHANNELS.knowledge.SNAPSHOT_CREATE,
    RPC_CHANNELS.knowledge.SNAPSHOT_GET,
    RPC_CHANNELS.knowledge.CHANGED,
  ]

  test('knowledge read channels and CHANGED broadcast are REMOTE_ELIGIBLE', () => {
    for (const ch of REMOTE_READ_CHANNELS) {
      expect(REMOTE_ELIGIBLE_CHANNELS.has(ch)).toBe(true)
      expect(LOCAL_ONLY_CHANNELS.has(ch)).toBe(false)
    }
  })

  test('knowledge ENGINE_STATUS is LOCAL_ONLY', () => {
    expect(LOCAL_ONLY_CHANNELS.has(RPC_CHANNELS.knowledge.ENGINE_STATUS)).toBe(true)
    expect(REMOTE_ELIGIBLE_CHANNELS.has(RPC_CHANNELS.knowledge.ENGINE_STATUS)).toBe(false)
  })

  test('knowledge namespace is exactly the P1 read-only set (no mutation/engine-lifecycle channels)', () => {
    expect([...Object.keys(RPC_CHANNELS.knowledge)].sort()).toEqual([
      'CAPABILITIES',
      'CHANGED',
      'ENGINE_STATUS',
      'GET',
      'GET_BACKLINKS',
      'GET_CONTEXT',
      'LIST_CONNECTIONS',
      'SEARCH',
      'SNAPSHOT_CREATE',
      'SNAPSHOT_GET',
    ])
    // P3/P7: proposeMutation/applyMutation/discardMutation/engineStart/engineStop MUST NOT exist in P1.
    for (const ch of Object.values(RPC_CHANNELS.knowledge)) {
      expect(ch).not.toMatch(/mutation|engineStart|engineStop/i)
    }
  })
})
