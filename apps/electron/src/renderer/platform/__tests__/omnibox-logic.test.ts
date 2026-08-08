import { describe, it, expect, beforeEach } from 'bun:test'
import { createStore } from 'jotai'
import { omniboxOpenAtom } from '@/atoms/omnibox'
import { createCommandRegistry, type CommandContribution } from '@craft-agent/core/platform'
import { parsePrefix, scoreMatch } from '../omnibox-helpers'
import { actions } from '@/actions/definitions'

/**
 * Logic-level omnibox tests (no DOM):
 * - open/close atom
 * - command filtering mirrors Omnibox.tsx action section
 * - app.omnibox action is registered with mod+k
 */

function filterCommands(
  registry: ReturnType<typeof createCommandRegistry>,
  input: string,
): CommandContribution[] {
  const { prefix, query } = parsePrefix(input)
  if (prefix !== '' && prefix !== '>') return []
  const text = query
  const keys = {}
  const list = registry.query({ text: text.trim() || undefined }, keys)
  if (!text.trim()) return list
  return list
    .map((c) => ({
      c,
      s: Math.max(
        scoreMatch(c.title, text),
        scoreMatch(c.category, text),
        ...(c.keywords ?? []).map((k) => scoreMatch(k, text)),
      ),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
}

describe('omniboxOpenAtom', () => {
  it('defaults to closed and toggles open/close', () => {
    const store = createStore()
    expect(store.get(omniboxOpenAtom)).toBe(false)
    store.set(omniboxOpenAtom, true)
    expect(store.get(omniboxOpenAtom)).toBe(true)
    store.set(omniboxOpenAtom, false)
    expect(store.get(omniboxOpenAtom)).toBe(false)
  })
})

describe('app.omnibox action definition', () => {
  it('is registered with mod+k and General category', () => {
    expect(actions['app.omnibox']).toBeDefined()
    expect(actions['app.omnibox'].defaultHotkey).toBe('mod+k')
    expect(actions['app.omnibox'].category).toBe('General')
    expect(actions['app.omnibox'].label).toBe('Command Palette')
  })

  it('does not collide with app.search hotkey', () => {
    expect(actions['app.search'].defaultHotkey).toBe('mod+f')
    expect(actions['app.search'].defaultHotkey).not.toBe(actions['app.omnibox'].defaultHotkey)
  })
})

describe('omnibox command filter logic', () => {
  let registry: ReturnType<typeof createCommandRegistry>

  beforeEach(() => {
    registry = createCommandRegistry()
    for (const def of Object.values(actions)) {
      const action = def as {
        id: string
        label: string
        category: string
        description?: string
        defaultHotkey: string | null
      }
      registry.register({
        id: action.id,
        title: action.label,
        category: action.category,
        source: 'craft',
        keywords: action.description ? [action.description] : undefined,
        defaultHotkey: action.defaultHotkey ?? undefined,
        execute: async () => {},
      })
    }
    registry.register({
      id: 'knowledge.openHome',
      title: 'Open Knowledge',
      category: 'Knowledge',
      source: 'craft',
      keywords: ['knowledge', 'siyuan'],
      execute: async () => {},
    })
  })

  it('empty query returns craft actions including omnibox', () => {
    const hits = filterCommands(registry, '')
    expect(hits.some((c) => c.id === 'app.omnibox')).toBe(true)
    expect(hits.some((c) => c.id === 'app.newChat')).toBe(true)
  })

  it('typing filters craft actions by title', () => {
    const hits = filterCommands(registry, 'palette')
    expect(hits.some((c) => c.id === 'app.omnibox')).toBe(true)
    expect(hits.every((c) => /palette|command/i.test(c.title) || c.keywords?.some((k) => /palette|command/i.test(k)))).toBe(true)
  })

  it('> prefix shows only commands (same list path, no resources)', () => {
    const hits = filterCommands(registry, '>settings')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((c) => c.source === 'craft' || c.id.startsWith('knowledge.'))).toBe(true)
    expect(hits.some((c) => /settings/i.test(c.title))).toBe(true)
  })

  it('@ prefix suppresses action section', () => {
    expect(filterCommands(registry, '@memory')).toEqual([])
  })

  it('/ prefix suppresses action section', () => {
    expect(filterCommands(registry, '/skill')).toEqual([])
  })
})
