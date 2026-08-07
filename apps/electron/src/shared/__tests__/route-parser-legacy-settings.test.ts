/**
 * Legacy settings subpage redirect: 'toolchain' → 'runtime'
 * (PRD runtime-context-marketplace §5.1 — вкладка Toolchain поглощена Runtime).
 */
import { describe, it, expect } from 'bun:test'
import { parseCompoundRoute, parseRouteToNavigationState } from '../route-parser'

describe('legacy settings subpages', () => {
  it("routes 'settings/toolchain' to the runtime subpage (compound route)", () => {
    const state = parseCompoundRoute('settings/toolchain')
    expect(state).not.toBeNull()
    expect(state!.navigator).toBe('settings')
    expect(state!.details).toEqual({ type: 'runtime', id: 'runtime' })
    const nav = parseRouteToNavigationState('settings/toolchain')
    expect(nav).not.toBeNull()
  })

  it("keeps valid subpages untouched, still rejects unknown ones", () => {
    expect(parseCompoundRoute('settings/runtime')!.details).toEqual({ type: 'runtime', id: 'runtime' })
    expect(parseCompoundRoute('settings/marketplace')!.details).toEqual({ type: 'marketplace', id: 'marketplace' })
    expect(parseCompoundRoute('settings/does-not-exist')).toBeNull()
  })
})
