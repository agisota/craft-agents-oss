import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { CreateConnectionInput, WorkGraphKernel } from '@craft-agent/server-core/workgraph'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.workgraph.GET_HEALTH,
  RPC_CHANNELS.workgraph.GET_VERSION,
  RPC_CHANNELS.workgraph.LIST_CONNECTIONS,
  RPC_CHANNELS.workgraph.GET_CONNECTION,
  RPC_CHANNELS.workgraph.CREATE_CONNECTION,
] as const

const CONNECTION_INPUT_KEYS = new Set([
  'workspaceId',
  'integrationId',
  'credentialRefId',
  'storageMode',
  'scopes',
])

function assertConnectionMetadata(input: unknown): CreateConnectionInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid connection metadata')
  }
  for (const key of Object.keys(input)) {
    if (!CONNECTION_INPUT_KEYS.has(key)) {
      throw new Error(`Invalid connection metadata field: ${key}`)
    }
  }
  return input as CreateConnectionInput
}

/**
 * WorkGraph is deliberately composed only by Electron main. The transport's
 * localElectron access class additionally requires the renderer's trusted,
 * main-issued window/workspace binding before these channels are advertised.
 */
export function registerWorkGraphHandlers(
  server: RpcServer,
  workGraph: Pick<WorkGraphKernel, 'getHealth' | 'getVersion' | 'listConnections' | 'getConnection' | 'createConnection'>,
): void {
  server.handle(RPC_CHANNELS.workgraph.GET_HEALTH, () => workGraph.getHealth(), { access: 'localElectron' })
  server.handle(RPC_CHANNELS.workgraph.GET_VERSION, () => workGraph.getVersion(), { access: 'localElectron' })
  server.handle(
    RPC_CHANNELS.workgraph.LIST_CONNECTIONS,
    (_ctx, workspaceId: string) => workGraph.listConnections(workspaceId),
    { access: 'localElectron' },
  )
  server.handle(
    RPC_CHANNELS.workgraph.GET_CONNECTION,
    (_ctx, input: { workspaceId: string; connectionId: string }) => (
      workGraph.getConnection(input.workspaceId, input.connectionId)
    ),
    { access: 'localElectron' },
  )
  server.handle(
    RPC_CHANNELS.workgraph.CREATE_CONNECTION,
    (_ctx, input: unknown) => workGraph.createConnection(assertConnectionMetadata(input)),
    { access: 'localElectron' },
  )
}
