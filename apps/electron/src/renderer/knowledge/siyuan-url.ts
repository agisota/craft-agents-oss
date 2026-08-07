/**
 * SiYuan surface URL helpers (W2 Knowledge mode).
 *
 * MVP note: the SiYuan web build only exposes the FULL editor UI at
 * `${baseUrl}/stage/build/desktop/` — doc-targeted deep URLs are NOT
 * supported by the current web build (assumption to verify against a live
 * instance). The knowledge surface therefore honors the ref `kind`/`id` only
 * through the durable instance key (one compositor instance per document),
 * while every surface renders the full editor.
 *
 * Compat view: the compatibility ("full interface") surface reuses the same
 * helper — the route `routes.view.siyuan({ kind: 'notebook', id: '__full__' })`
 * yields durableKey `siyuan:notebook:__full__`, i.e. a distinct instance.
 */

import type { KnowledgeRefKind } from '../../shared/types'

/** Local SiYuan kernel default (mirrors SIYUAN_DEFAULT_BASE_URL in core). */
export const DEFAULT_BASE_URL = 'http://localhost:6806'

export interface SiyuanSurfaceRef {
  kind: KnowledgeRefKind
  id: string
}

/** Compat-surface sentinel: `knowledge/notebook/__full__` = full-UI surface. */
export const SIYUAN_FULL_SURFACE_ID = '__full__'

/**
 * URL of the embedded SiYuan desktop surface. `ref` is accepted for forward
 * compatibility (doc-targeted URLs) but currently unused — see header note.
 */
export function buildSiyuanSurfaceUrl(baseUrl: string, _ref?: SiyuanSurfaceRef): string {
  return `${baseUrl.replace(/\/+$/, '')}/stage/build/desktop/`
}

/** Stable per-document durable key (restores across restart, dedups re-open). */
export function buildSiyuanDurableKey(ref: SiyuanSurfaceRef): string {
  return `siyuan:${ref.kind}:${ref.id}`
}

/** True when the route targets the compat full-interface surface. */
export function isSiyuanCompatRef(ref: SiyuanSurfaceRef): boolean {
  return ref.kind === 'notebook' && ref.id === SIYUAN_FULL_SURFACE_ID
}
