import { CredentialRefRegistry } from '@craft-agent/core/platform'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { LocalFileSecretProvider, SecureStorageBackend } from '@craft-agent/shared/credentials'
import type { RpcServer } from '@craft-agent/server-core/transport'
import {
  commitGithubEnvImport,
  previewGithubEnvImport,
  type CreateConnectionInput,
  type WorkGraphKernel,
} from '@craft-agent/server-core/workgraph'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.workgraph.GET_HEALTH,
  RPC_CHANNELS.workgraph.GET_VERSION,
  RPC_CHANNELS.workgraph.LIST_CONNECTIONS,
  RPC_CHANNELS.workgraph.GET_CONNECTION,
  RPC_CHANNELS.workgraph.CREATE_CONNECTION,
  RPC_CHANNELS.workgraph.PREVIEW_GITHUB_ENV,
  RPC_CHANNELS.workgraph.IMPORT_GITHUB_ENV,
] as const

export interface GithubEnvImportHost {
  readonly provider: LocalFileSecretProvider
  readonly preview: typeof previewGithubEnvImport
  readonly commit: typeof commitGithubEnvImport
}

export function createGithubEnvImportHost(): GithubEnvImportHost {
  return {
    provider: new LocalFileSecretProvider(new SecureStorageBackend(), new CredentialRefRegistry()),
    preview: previewGithubEnvImport,
    commit: commitGithubEnvImport,
  }
}

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
  githubImport?: GithubEnvImportHost,
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
  server.handle(
    RPC_CHANNELS.workgraph.PREVIEW_GITHUB_ENV,
    async (_ctx, envPath: string) => {
      if (!githubImport) return []
      if (typeof envPath !== 'string' || envPath.includes('\0')) throw new Error('Invalid path')
      return githubImport.preview({ envPath, provider: githubImport.provider })
    },
    { access: 'localElectron' },
  )
  server.handle(
    RPC_CHANNELS.workgraph.IMPORT_GITHUB_ENV,
    async (_ctx, input: { envPath: string; candidateId: string; workspaceId: string }) => {
      if (!githubImport) throw new Error('github_import_unavailable')
      if (typeof input?.envPath !== 'string' || input.envPath.includes('\0')) throw new Error('Invalid path')
      return githubImport.commit({
        envPath: input.envPath,
        candidateId: input.candidateId,
        provider: githubImport.provider,
        kernel: workGraph,
        workspaceId: input.workspaceId,
        requestedBy: 'owner',
      })
    },
    { access: 'localElectron' },
  )
}
