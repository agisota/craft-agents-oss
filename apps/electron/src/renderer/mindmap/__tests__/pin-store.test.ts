import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinnedMap, deriveNoteMindMap } from '@craft-agent/core/mindmap'
import { clearPin, loadPin, pinStorageKey, savePin } from '../pin-store'

const memory = new Map<string, string>()

beforeEach(() => {
  memory.clear()
  // minimal localStorage shim for bun test
  const store = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v)
    },
    removeItem: (k: string) => {
      memory.delete(k)
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: store,
    configurable: true,
  })
})

describe('pin-store', () => {
  test('round-trips pin for note entity', () => {
    const graph = deriveNoteMindMap({
      noteId: 'n1',
      title: 'T',
      markdown: '# H\n',
    })
    const entity = { type: 'note' as const, noteId: 'n1' }
    expect(pinStorageKey(entity)).toContain('note_n1')
    const pin = createPinnedMap(graph, { positions: {}, collapsed: ['h:0:h'] })
    savePin(pin)
    const loaded = loadPin(entity)
    expect(loaded?.graph.contentHash).toBe(graph.contentHash)
    expect(loaded?.layout.collapsed).toEqual(['h:0:h'])
    clearPin(entity)
    expect(loadPin(entity)).toBeNull()
  })
})
