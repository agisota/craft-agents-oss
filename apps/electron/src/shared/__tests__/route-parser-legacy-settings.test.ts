/**
 * Legacy settings subpage redirects:
 * - 'toolchain' → 'runtime' (PRD runtime-context-marketplace §5.1)
 * - 'marketplace' → 'extensions' (S-05 / W5 Extension Center)
 * - 'preferences' → 'context' (P2.1 Context ↔ Preferences merge)
 */
import { describe, it, expect } from 'bun:test'
import { parseCompoundRoute, parseRouteToNavigationState } from '../route-parser'

describe('legacy settings redirects', () => {
  it('redirects toolchain → runtime', () => {
    expect(parseCompoundRoute('settings/toolchain')!.details).toEqual({ type: 'runtime', id: 'runtime' })
  })

  it('redirects marketplace → extensions', () => {
    expect(parseCompoundRoute('settings/marketplace')!.details).toEqual({
      type: 'extensions',
      id: 'extensions',
    })
  })

  it('redirects preferences → context', () => {
    expect(parseCompoundRoute('settings/preferences')!.details).toEqual({
      type: 'context',
      id: 'context',
    })
  })

  it('keeps known pages and rejects unknown', () => {
    expect(parseCompoundRoute('settings/runtime')!.details).toEqual({ type: 'runtime', id: 'runtime' })
    expect(parseCompoundRoute('settings/extensions')!.details).toEqual({
      type: 'extensions',
      id: 'extensions',
    })
    expect(parseCompoundRoute('settings/does-not-exist')).toBeNull()
  })
})
