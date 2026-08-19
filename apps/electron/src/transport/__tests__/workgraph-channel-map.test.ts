import { describe, expect, it } from 'bun:test'
import { RPC_CHANNELS } from '../../shared/types'
import { CHANNEL_MAP } from '../channel-map'

describe('CF-6.3 workgraph channel map', () => {
  it('nests list/get/create under workgraph.*', () => {
    expect(CHANNEL_MAP['workgraph.listConnections']).toEqual({
      type: 'invoke',
      channel: RPC_CHANNELS.workgraph.LIST_CONNECTIONS,
    })
    expect(CHANNEL_MAP['workgraph.getConnection']).toEqual({
      type: 'invoke',
      channel: RPC_CHANNELS.workgraph.GET_CONNECTION,
    })
    expect(CHANNEL_MAP['workgraph.createConnection']).toEqual({
      type: 'invoke',
      channel: RPC_CHANNELS.workgraph.CREATE_CONNECTION,
    })
    expect(CHANNEL_MAP['workgraph.previewGithubEnv']).toEqual({
      type: 'invoke',
      channel: RPC_CHANNELS.workgraph.PREVIEW_GITHUB_ENV,
    })
    expect(CHANNEL_MAP['workgraph.importGithubEnv']).toEqual({
      type: 'invoke',
      channel: RPC_CHANNELS.workgraph.IMPORT_GITHUB_ENV,
    })
  })
})
