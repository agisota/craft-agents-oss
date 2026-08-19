import type { CredentialRefId } from '@craft-agent/core/platform'
import type { InProcessCredentialBroker, SecretProvider } from '@craft-agent/shared/credentials'

import type { WorkGraphKernel } from './index'

export type WorkGraphRevokeSurface = Pick<
  WorkGraphKernel,
  'getConnection' | 'appendConnectionAudit' | 'affectedClosure'
>

export interface RevokeConnectionInput {
  readonly kernel: WorkGraphRevokeSurface
  readonly broker: InProcessCredentialBroker
  readonly provider: SecretProvider
  readonly workspaceId: string
  readonly connectionId: string
  readonly reason: string
}

export interface RevalidatedConsumer {
  readonly consumerId: string
  readonly status: 'ok' | 'denied' | 'repair_required'
}

export async function revokeConnectionAndRevalidate(
  input: RevokeConnectionInput,
): Promise<{ readonly consumers: readonly RevalidatedConsumer[] }> {
  const connection = await input.kernel.getConnection(input.workspaceId, input.connectionId)
  if (!connection) throw new Error('Connection not found')

  const credentialRefId = connection.credentialRefId as CredentialRefId
  await input.broker.revokeLeasesForRef(credentialRefId, input.reason)
  await input.provider.revoke({
    credentialRef: {
      id: credentialRefId,
      kind: 'bearer_token',
      providerId: input.provider.id,
      locator: { type: 'local', key: credentialRefId },
      createdAt: 0,
      updatedAt: 0,
    },
  })

  await input.kernel.appendConnectionAudit({
    workspaceId: input.workspaceId,
    connectionId: input.connectionId,
    credentialRefId,
    action: 'connection.revoke',
    decision: 'allow',
    eventType: 'connection-revoked',
  })

  const consumerIds = await input.kernel.affectedClosure(input.workspaceId, input.connectionId)
  const consumers: RevalidatedConsumer[] = []
  for (const consumerId of consumerIds) {
    const result = await input.broker.revalidateConsumer({
      kind: 'agent',
      id: consumerId,
      workspaceId: input.workspaceId,
    })
    consumers.push({ consumerId, status: result.status })
  }
  return { consumers }
}
