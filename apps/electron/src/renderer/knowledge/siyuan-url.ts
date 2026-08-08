/**
 * SiYuan surface URL helpers (P4 surface modes).
 *
 * Base: `${baseUrl}/stage/build/desktop/`
 * - document/block refs append `?id=<id>` (SiYuan web supports this)
 * - graph / global-graph / outline / backlinks still open the desktop build and
 *   pass `craftSurface=<mode>` so the host can inject a dock-open script after load
 *
 * KnowledgeKind (notebook|document|block|database|asset) is unchanged for refs;
 * surface presentation is a separate SiyuanSurfaceMode.
 */

import type { KnowledgeRefKind } from '../../shared/types'

/** Local SiYuan kernel default (mirrors SIYUAN_DEFAULT_BASE_URL in core). */
export const DEFAULT_BASE_URL = 'http://localhost:6806'

/** Compat-surface sentinel: `knowledge/notebook/__full__` = full-UI surface. */
export const SIYUAN_FULL_SURFACE_ID = '__full__'

/**
 * Presentation mode for an embedded SiYuan surface.
 * Orthogonal to KnowledgeKind — kind/id identify the ref; mode chooses the UI.
 */
export type SiyuanSurfaceMode =
  | 'editor'
  | 'graph'
  | 'global-graph'
  | 'outline'
  | 'backlinks'

export const SIYUAN_SURFACE_MODES: readonly SiyuanSurfaceMode[] = [
  'editor',
  'graph',
  'global-graph',
  'outline',
  'backlinks',
] as const

export interface SiyuanSurfaceRef {
  kind: KnowledgeRefKind
  id: string
}

export interface BuildSiyuanSurfaceUrlOptions {
  mode?: SiyuanSurfaceMode
}

/**
 * JS injected after load when craftSurface is set — opens the matching SiYuan
 * dock/panel (graph first; Alt+G fallback). Safe no-op if selectors miss.
 */
export const SIYUAN_OPEN_DOCK_SCRIPT = `(() => {
  const mode = document.location.search.includes('craftSurface=global-graph') ? 'global' : 'local';
  const tryClick = (sel) => { const el = document.querySelector(sel); if (el) { el.click(); return true } return false };
  // common SiYuan dock selectors
  if (tryClick('[data-type="graph"]') || tryClick('.dock__item[data-type="graph"]') || tryClick('#dockLeft [data-type="graph"]')) return 'clicked';
  // hotkey Alt+G (graph)
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'g', code:'KeyG', altKey:true, bubbles:true}));
  return 'hotkey';
})()`


/**
 * URL of the embedded SiYuan desktop surface.
 * - document/block → `?id=<id>`
 * - non-editor modes → `craftSurface=<mode>` (and id when document-like)
 */
export function buildSiyuanSurfaceUrl(
  baseUrl: string,
  ref?: SiyuanSurfaceRef,
  options?: BuildSiyuanSurfaceUrlOptions,
): string {
  const root = `${baseUrl.replace(/\/+$/, '')}/stage/build/desktop/`
  const mode: SiyuanSurfaceMode = options?.mode ?? 'editor'
  const params = new URLSearchParams()

  if (
    ref &&
    (ref.kind === 'document' || ref.kind === 'block') &&
    ref.id &&
    ref.id !== SIYUAN_FULL_SURFACE_ID
  ) {
    params.set('id', ref.id)
  }

  if (mode !== 'editor') {
    params.set('craftSurface', mode)
  }

  const qs = params.toString()
  return qs ? `${root}?${qs}` : root
}

/** Stable per-document durable key (restores across restart, dedups re-open). */
export function buildSiyuanDurableKey(ref: SiyuanSurfaceRef): string {
  return `siyuan:${ref.kind}:${ref.id}`
}

/** True when the route targets the compat full-interface surface. */
export function isSiyuanCompatRef(ref: SiyuanSurfaceRef): boolean {
  return ref.kind === 'notebook' && ref.id === SIYUAN_FULL_SURFACE_ID
}

/** True when the mode needs the post-load dock-open evaluate. */
export function needsSiyuanDockOpen(mode: SiyuanSurfaceMode): boolean {
  return mode !== 'editor'
}
