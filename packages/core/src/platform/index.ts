/**
 * @craft-agent/core — platform layer.
 *
 * Pure-TS registries and model for the unified shell (spec suite
 * 2026-08-07-unified-shell): panels & rails (S-03), surface tabs (S-02),
 * commands (S-04 §3.5), context keys & the when-language (S-04 §3.7,
 * S-03 §3.9). React hosts and URL truth live in the renderer; this layer
 * has zero app deps.
 */

export type { Disposable } from './types.ts';
export * from './context-keys/index.ts';
export * from './panels/index.ts';
export * from './commands/index.ts';
export * from './surfaces/index.ts';
