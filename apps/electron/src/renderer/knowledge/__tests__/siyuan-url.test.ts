import { describe, it, expect } from 'bun:test'
import {
  buildSiyuanSurfaceUrl,
  buildSiyuanDurableKey,
  isSiyuanCompatRef,
  DEFAULT_BASE_URL,
  SIYUAN_FULL_SURFACE_ID,
} from '../siyuan-url'

describe('buildSiyuanSurfaceUrl', () => {
  it('appends the desktop web build path to the base URL', () => {
    expect(buildSiyuanSurfaceUrl('http://localhost:6806')).toBe(
      'http://localhost:6806/stage/build/desktop/',
    )
  })

  it('strips trailing slashes from the base URL to avoid a double slash', () => {
    expect(buildSiyuanSurfaceUrl('http://localhost:6806/')).toBe(
      'http://localhost:6806/stage/build/desktop/',
    )
    expect(buildSiyuanSurfaceUrl('http://localhost:6806///')).toBe(
      'http://localhost:6806/stage/build/desktop/',
    )
  })

  it('supports remote base URLs', () => {
    expect(buildSiyuanSurfaceUrl('https://notes.example.com')).toBe(
      'https://notes.example.com/stage/build/desktop/',
    )
  })

  it('MVP: renders the full editor regardless of the ref (doc-targeted URLs unsupported)', () => {
    const withDoc = buildSiyuanSurfaceUrl('http://localhost:6806', { kind: 'document', id: '20240101-abcdef' })
    expect(withDoc).toBe('http://localhost:6806/stage/build/desktop/')
  })

  it('compat view uses the same helper (sentinel __full__ ref)', () => {
    const compat = buildSiyuanSurfaceUrl('http://localhost:6806', { kind: 'notebook', id: SIYUAN_FULL_SURFACE_ID })
    expect(compat).toBe('http://localhost:6806/stage/build/desktop/')
  })
})

describe('DEFAULT_BASE_URL', () => {
  it('is the local SiYuan kernel endpoint', () => {
    expect(DEFAULT_BASE_URL).toBe('http://localhost:6806')
  })
})

describe('buildSiyuanDurableKey', () => {
  it('formats siyuan:{kind}:{id}', () => {
    expect(buildSiyuanDurableKey({ kind: 'document', id: 'abc' })).toBe('siyuan:document:abc')
  })

  it('produces a distinct key for the compat surface', () => {
    expect(buildSiyuanDurableKey({ kind: 'notebook', id: SIYUAN_FULL_SURFACE_ID })).toBe(
      'siyuan:notebook:__full__',
    )
  })
})

describe('isSiyuanCompatRef', () => {
  it('is true only for the notebook/__full__ sentinel', () => {
    expect(isSiyuanCompatRef({ kind: 'notebook', id: SIYUAN_FULL_SURFACE_ID })).toBe(true)
  })

  it('is false for real documents', () => {
    expect(isSiyuanCompatRef({ kind: 'document', id: 'abc' })).toBe(false)
    expect(isSiyuanCompatRef({ kind: 'document', id: SIYUAN_FULL_SURFACE_ID })).toBe(false)
    expect(isSiyuanCompatRef({ kind: 'notebook', id: '20240101-abcdef' })).toBe(false)
  })
})
