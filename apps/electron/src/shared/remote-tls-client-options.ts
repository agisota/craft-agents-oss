import type { RemoteServerConfig } from '@craft-agent/core/types'
import {
  createPeerTrustVerifier,
  tlsSocketOptions,
  type PeerTrustVerifier,
  type RemoteTlsSocketOptions,
} from '@craft-agent/server-core/transport'
import { normalizeRemoteTlsTrust } from '@craft-agent/shared/config'

export function peerTrustOptionsForRemote(
  remote: Pick<RemoteServerConfig, 'url' | 'token' | 'remoteWorkspaceId' | 'tlsTrust' | 'sshHostId'>,
): { peerTrustVerifier?: PeerTrustVerifier; tlsSocketOptions?: RemoteTlsSocketOptions } {
  if (remote.sshHostId) return {}
  const trust = normalizeRemoteTlsTrust({
    url: remote.url,
    token: remote.token,
    remoteWorkspaceId: remote.remoteWorkspaceId,
    tlsTrust: remote.tlsTrust,
  })
  return {
    peerTrustVerifier: createPeerTrustVerifier(trust),
    tlsSocketOptions: tlsSocketOptions(trust),
  }
}
