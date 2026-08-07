/**
 * Deep links for the SiYuan provider (K-03 §3.5.3 + §3.1).
 *
 * Grammar (`siyuan://<kind>/<id>` build/parse) is owned by `../../refs.ts`
 * (siyuanDeepLink/parseSiyuanDeepLink) — the single source of ref formats; re-exported here
 * for consumers of the provider subpath. This module adds only policy: which kinds the native
 * SiYuan editor can open, and the typed error the headless adapter raises in `open()` so the
 * Electron side can perform the navigation itself (renderer builds `routes.view.knowledge(...)`;
 * native fallback is the protocol link).
 *
 * NOTE (verified against the SiYuan desktop protocol handler): the native editor resolves
 * document- and block-anchored links (`siyuan://document/<id>`, `siyuan://block/<id>`).
 * notebook/database/asset refs have no stable native surface — the Electron shell renders
 * those in-app (`knowledge/<kind>/<id>` route), never through the protocol handler.
 */

import { KnowledgeError, siyuanDeepLink, canonicalKnowledgeRef, type KnowledgeKind, type KnowledgeRef } from '../..';

export { siyuanDeepLink, parseSiyuanDeepLink } from '../..';

/** Kinds with a stable native-editor surface (see header note). */
export const SIYUAN_NATIVE_OPEN_KINDS: readonly KnowledgeKind[] = ['document', 'block'];

/** Whether the native SiYuan editor can directly open refs of this kind. */
export function canOpenNatively(kind: KnowledgeKind): boolean {
  return SIYUAN_NATIVE_OPEN_KINDS.includes(kind);
}

/** Canonical throw for the headless adapter's open() (K-03 §3.2: navigation is Electron-side). */
export function nativeOpenUnsupportedError(input: KnowledgeRef): KnowledgeError {
  const ref = canonicalKnowledgeRef(input);
  return new KnowledgeError(
    'UNSUPPORTED_OPERATION',
    `KnowledgeProvider.open() is not available in the headless SiYuan adapter; navigate Electron-side to ${ref.kind}/${ref.id}`,
    { ref, deepLink: siyuanDeepLink(ref), canOpenNatively: canOpenNatively(ref.kind) },
  );
}
