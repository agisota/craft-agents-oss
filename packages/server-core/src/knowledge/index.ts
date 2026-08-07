/**
 * File-backed knowledge stores (spec K-04 §3.3) — the only modules in the
 * knowledge domain that touch the filesystem. RPC handlers reach them through
 * the bridge service (K-04 §3.5 «единый писатель»), never directly.
 */
export * from './connections-store'
export * from './snapshots-store'
export * from './proposals-store'
export * from './knowledge-audit'
export * from './drafts-store'
export * from './publications-store'
export * from './links-store'
export * from './publication-service'
export * from './work-envelopes-store'
