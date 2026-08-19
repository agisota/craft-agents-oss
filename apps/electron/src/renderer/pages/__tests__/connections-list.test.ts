import { describe, expect, it } from 'bun:test'
import { sanitizeConnectionRows } from '../connections-list'

describe('CF-6.3 connection list sanitizer', () => {
  it('keeps metadata fields and rejects secret fields', () => {
    const rows = sanitizeConnectionRows([{
      id: 'c1',
      workspaceId: 'workspace_a',
      integrationId: 'github',
      credentialRefId: 'cred_123e4567-e89b-12d3-a456-426614174000',
      storageMode: 'copy',
      scopes: ['repo'],
      createdAt: 1,
      updatedAt: 1,
    }])
    expect(rows).toEqual([{
      id: 'c1',
      workspaceId: 'workspace_a',
      integrationId: 'github',
      credentialRefId: 'cred_123e4567-e89b-12d3-a456-426614174000',
      storageMode: 'copy',
      scopes: ['repo'],
    }])
    expect(JSON.stringify(rows)).not.toContain('super-secret')
    expect(() => sanitizeConnectionRows([{
      id: 'c1',
      integrationId: 'github',
      credentialRefId: 'cred_123e4567-e89b-12d3-a456-426614174000',
      storageMode: 'copy',
      value: 'super-secret',
    }])).toThrow(/value/)
  })
})
