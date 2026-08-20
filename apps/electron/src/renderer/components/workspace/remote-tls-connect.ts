import type { RemoteTlsTrust } from '../../../shared/types'

/** Token-bearing tests run only after inspect on wss/https. SSH and ws:// skip. */
export function needsRemoteTlsInspect(url: string, sshHostId?: string): boolean {
  if (sshHostId) return false
  try {
    const protocol = new URL(url).protocol
    return protocol === 'wss:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function tlsTrustFromDecision(persist: RemoteTlsTrust | null | undefined): RemoteTlsTrust | undefined {
  return persist ?? undefined
}
