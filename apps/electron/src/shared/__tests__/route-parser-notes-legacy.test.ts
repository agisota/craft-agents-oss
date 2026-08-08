import { describe, it, expect } from 'bun:test'
import { routes } from '../routes'
import {
  parseRoute,
  parseCompoundRoute,
  parseRouteToNavigationState,
  isCompoundRoute,
} from '../route-parser'

describe('route-parser: notes-legacy vault routes', () => {
  it('treats notes-legacy as a compound route prefix', () => {
    expect(isCompoundRoute('notes-legacy')).toBe(true)
    expect(isCompoundRoute('notes-legacy/note/foo')).toBe(true)
  })

  it('parses notes-legacy as notes navigator', () => {
    const compound = parseCompoundRoute('notes-legacy')
    expect(compound).not.toBeNull()
    expect(compound!.navigator).toBe('notes')
    expect(compound!.details).toBeNull()

    const parsed = parseRoute('notes-legacy')
    expect(parsed).not.toBeNull()
    expect(parsed!.type).toBe('view')
    expect(parsed!.name).toBe('notes')

    const state = parseRouteToNavigationState('notes-legacy')
    expect(state).not.toBeNull()
    expect(state!.navigator).toBe('notes')
    if (state && 'details' in state) {
      expect(state.details).toBeNull()
    }
  })

  it('parses notes-legacy/note/{id} as notes detail', () => {
    const compound = parseCompoundRoute('notes-legacy/note/foo')
    expect(compound).not.toBeNull()
    expect(compound!.navigator).toBe('notes')
    expect(compound!.details).toEqual({ type: 'note', id: 'foo' })

    const parsed = parseRoute('notes-legacy/note/foo')
    expect(parsed).not.toBeNull()
    expect(parsed!.type).toBe('view')
    expect(parsed!.name).toBe('note-info')
    expect(parsed!.id).toBe('foo')

    const state = parseRouteToNavigationState('notes-legacy/note/foo')
    expect(state).not.toBeNull()
    expect(state!.navigator).toBe('notes')
    if (state && state.navigator === 'notes') {
      expect(state.details).toEqual({ type: 'note', noteId: 'foo' })
    }
  })

  it('decodes encoded note ids under notes-legacy', () => {
    const id = 'folder/my note.md'
    const route = routes.view.notesLegacy(id)
    expect(route).toBe(`notes-legacy/note/${encodeURIComponent(id)}`)

    const compound = parseCompoundRoute(route)
    expect(compound).not.toBeNull()
    expect(compound!.navigator).toBe('notes')
    expect(compound!.details).toEqual({ type: 'note', id })
  })

  it('keeps notesLegacy() emitter on notes-legacy keys', () => {
    expect(routes.view.notesLegacy()).toBe('notes-legacy')
    expect(routes.view.notesLegacy('abc')).toBe('notes-legacy/note/abc')
  })

  it('still parses plain notes routes as notes navigator', () => {
    expect(parseCompoundRoute('notes')!.navigator).toBe('notes')
    expect(parseCompoundRoute('notes/note/bar')!.details).toEqual({ type: 'note', id: 'bar' })
  })
})
