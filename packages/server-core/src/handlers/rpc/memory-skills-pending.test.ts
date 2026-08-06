/**
 * Handler tests for memory.* and skillsPending.* RPC channels, following the
 * system.open-url.test.ts harness pattern. Workspace resolution
 * (@craft-agent/shared/config) and the global config dir
 * (@craft-agent/shared/config/paths) are mocked so tests never touch the real
 * home directory or workspace registry.
 */
import './memory-test-setup' // must run before any module reading CRAFT_CONFIG_DIR
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import type { RpcServer, HandlerFn, RequestContext } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

let workspaceRoot: string
const configDir = process.env.CRAFT_CONFIG_DIR!

mock.module('@craft-agent/shared/config', () => ({
  getWorkspaceByNameOrId: (id: string) =>
    id === 'ws1' ? { id: 'ws1', name: 'ws1', rootPath: workspaceRoot } : null,
}))

import { registerMemoryHandlers } from './memory'
import { registerSkillsPendingHandlers } from './skills-pending'
import { MemoryFileStore } from '../../memory/MemoryFileStore'
import { SkillPendingQueue } from '../../memory/SkillPendingQueue'

function createHarness(registerers: Array<(server: RpcServer, deps: HandlerDeps) => void>) {
  const handlers = new Map<string, HandlerFn>()
  const pushCalls: Array<{ channel: string; target: unknown; args: unknown[] }> = []

  const server: RpcServer = {
    handle(channel, handler) { handlers.set(channel, handler) },
    push(channel, target, ...args) { pushCalls.push({ channel, target, args }) },
    async invokeClient() { return undefined },
    hasClientCapability() { return false },
    findClientsWithCapability() { return [] },
  }

  const deps: HandlerDeps = {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    platform: {
      appRootPath: '/',
      resourcesPath: '/',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
    },
  }

  for (const register of registerers) register(server, deps)

  const invoke = (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`No handler for ${channel}`)
    return handler({ clientId: 'c1', workspaceId: null } as unknown as RequestContext, ...args)
  }

  return { invoke, pushCalls }
}

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'mem-hdl-ws-'))
  rmSync(configDir, { recursive: true, force: true })
  mkdirSync(configDir, { recursive: true })
})

afterEach(() => {
  rmSync(workspaceRoot, { recursive: true, force: true })
})

describe('memory handlers', () => {
  function harness() {
    return createHarness([registerMemoryHandlers])
  }

  it('add/list/update/delete lessons in the global scope with broadcasts', async () => {
    const { invoke, pushCalls } = harness()

    const added = await invoke(RPC_CHANNELS.memory.ADD_LESSON, null, {
      rule: 'Run typecheck before done',
      category: 'workflow',
      scope: 'global',
    })
    expect(added.source.trigger).toBe('explicit')
    expect(pushCalls.at(-1)).toMatchObject({
      channel: RPC_CHANNELS.memory.CHANGED,
      target: { to: 'all' },
      args: [null, 'global'],
    })

    const list = await invoke(RPC_CHANNELS.memory.LIST_LESSONS, 'global')
    expect(list.map((l: { rule: string }) => l.rule)).toEqual(['Run typecheck before done'])

    const updated = await invoke(RPC_CHANNELS.memory.UPDATE_LESSON, null, 'global', 'run TYPECHECK before done', { negative: true })
    expect(updated.negative).toBe(true)

    expect(await invoke(RPC_CHANNELS.memory.DELETE_LESSON, null, 'global', 'Run typecheck before done')).toBe(true)
    expect(await invoke(RPC_CHANNELS.memory.LIST_LESSONS, 'global')).toEqual([])
    expect(pushCalls.filter(c => c.channel === RPC_CHANNELS.memory.CHANGED)).toHaveLength(3)
  })

  it('scopes workspace lessons to the workspace memory dir and broadcasts to the workspace', async () => {
    const { invoke, pushCalls } = harness()
    await invoke(RPC_CHANNELS.memory.ADD_LESSON, 'ws1', { rule: 'use bun', category: 'preference', scope: 'workspace' })
    expect(pushCalls.at(-1)).toMatchObject({
      channel: RPC_CHANNELS.memory.CHANGED,
      target: { to: 'workspace', workspaceId: 'ws1' },
      args: ['ws1', 'workspace'],
    })
    expect(readFileSync(join(workspaceRoot, 'memory', 'lessons.jsonl'), 'utf8')).toContain('use bun')
    expect(existsSync(join(configDir, 'memory', 'lessons.jsonl'))).toBe(false)
    const both = await invoke(RPC_CHANNELS.memory.LIST_LESSONS, 'both', 'ws1')
    expect(both).toHaveLength(1)
  })

  it('getContext returns global preferences plus workspace memory bundle', async () => {
    const { invoke } = harness()
    await invoke(RPC_CHANNELS.memory.UPDATE_CONTEXT, null, 'global', 'prefer bun test')
    await invoke(RPC_CHANNELS.memory.UPDATE_CONTEXT, 'ws1', 'workspace', 'project context')
    const ctx = await invoke(RPC_CHANNELS.memory.GET_CONTEXT, 'ws1')
    expect(ctx.preferences).toBe('prefer bun test')
    expect(ctx.context).toBe('project context')
    expect(ctx.workspaceMemory.context).toBe('project context')
    expect(ctx.workspaceMemory.preferences).toBe('prefer bun test')
  })

  it('listHistory returns dates and selected content', async () => {
    const store = new MemoryFileStore('workspace', workspaceRoot, configDir)
    store.appendDailyHistory('entry A', '2026-08-01')
    store.appendDailyHistory('entry B', '2026-08-05')
    const { invoke } = harness()
    const res = await invoke(RPC_CHANNELS.memory.LIST_HISTORY, 'ws1')
    expect(res.dates).toEqual(['2026-08-05', '2026-08-01'])
    expect(res.content).toContain('entry B')
    const old = await invoke(RPC_CHANNELS.memory.LIST_HISTORY, 'ws1', '2026-08-01')
    expect(old.content).toContain('entry A')
  })
})

describe('skillsPending handlers', () => {
  function harness() {
    return createHarness([registerSkillsPendingHandlers])
  }

  function enqueue(slug: string) {
    new SkillPendingQueue(workspaceRoot).enqueue({
      slug,
      description: `desc ${slug}`,
      body: 'body',
      source: { ts: new Date().toISOString() },
    })
  }

  it('list/approve/dismiss over the workspace pending queue', async () => {
    enqueue('cand-a')
    enqueue('cand-b')
    const { invoke, pushCalls } = harness()

    const list = await invoke(RPC_CHANNELS.skillsPending.LIST, 'ws1')
    expect(list.map((c: { slug: string }) => c.slug).sort()).toEqual(['cand-a', 'cand-b'])

    expect(await invoke(RPC_CHANNELS.skillsPending.APPROVE, 'ws1', 'cand-a')).toBe(true)
    expect(existsSync(join(workspaceRoot, 'skills', 'cand-a', 'SKILL.md'))).toBe(true)
    expect(pushCalls.at(-1)).toMatchObject({
      channel: RPC_CHANNELS.skillsPending.CHANGED,
      target: { to: 'workspace', workspaceId: 'ws1' },
      args: ['ws1'],
    })

    expect(await invoke(RPC_CHANNELS.skillsPending.DISMISS, 'ws1', 'cand-b')).toBe(true)
    expect(await invoke(RPC_CHANNELS.skillsPending.LIST, 'ws1')).toEqual([])

    // approve conflict surfaces as an error: re-create a pending candidate
    // directly (enqueue would refuse since the skill slug is now taken)
    const conflictDir = join(workspaceRoot, 'skills', '.pending', 'cand-a')
    mkdirSync(conflictDir, { recursive: true })
    writeFileSync(join(conflictDir, 'SKILL.md'), '---\nname: cand-a\n---\n\nbody\n')
    await expect(invoke(RPC_CHANNELS.skillsPending.APPROVE, 'ws1', 'cand-a')).rejects.toThrow(/already exists/)
  })
})
