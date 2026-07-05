/**
 * Pure, dependency-free SSH predicates shared by main, preload and renderer.
 *
 * An SSH-backed remote workspace's durable identity is its `sshHostId` (the SSH
 * host store), NOT the persisted `url` — the tunnel forwards an EPHEMERAL
 * localhost port that changes every session. Every place that needs to answer
 * "is this workspace reached over SSH?" must use these guards so the behavior
 * (skip stale-url health checks, resolve a fresh tunnel before dialing, etc.)
 * stays consistent.
 */

import type { RemoteServerConfig } from '@craft-agent/core/types'

/** True when this remote config is reached over SSH (durable, not port-derived). */
export function isSshBacked(
  remote: RemoteServerConfig | null | undefined,
): remote is RemoteServerConfig & { sshHostId: string } {
  return !!remote && typeof remote.sshHostId === 'string' && remote.sshHostId.length > 0
}

/** True when a workspace's remote binding is SSH-backed. */
export function isSshBackedWorkspace(
  workspace: { remoteServer?: RemoteServerConfig | null } | null | undefined,
): boolean {
  return isSshBacked(workspace?.remoteServer)
}
