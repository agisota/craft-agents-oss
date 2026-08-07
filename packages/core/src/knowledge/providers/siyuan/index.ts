/**
 * @craft-agent/core/knowledge/providers/siyuan — SiYuan kernel provider subpath (KP1Siyuan).
 *
 * - ./client.ts: typed SiYuan kernel REST client (verified against kernel router.go, own header).
 * - ./deep-links.ts: siyuan:// deep-link policy + canonical open() error (K-03 §3.5.3).
 * - ./adapter.ts: read-only KnowledgeProvider implementation over the client (P1).
 */

export * from './client.ts';
export * from './deep-links.ts';
export * from './adapter.ts';
