const FORBIDDEN = new Set(['value', 'payload', 'secret', 'token', 'refreshToken'])

export interface ConnectionListRow {
  readonly id: string
  readonly workspaceId: string
  readonly integrationId: string
  readonly credentialRefId: string
  readonly storageMode: string
  readonly scopes: readonly string[]
}

export function sanitizeConnectionRows(rows: readonly unknown[]): ConnectionListRow[] {
  return rows.map((row) => {
    if (!row || typeof row !== 'object') throw new Error('Invalid connection metadata')
    const rec = row as Record<string, unknown>
    for (const key of Object.keys(rec)) {
      if (FORBIDDEN.has(key)) throw new Error(`Invalid connection metadata field: ${key}`)
    }
    if (typeof rec.id !== 'string' || typeof rec.integrationId !== 'string') {
      throw new Error('Invalid connection metadata')
    }
    if (typeof rec.credentialRefId !== 'string' || typeof rec.storageMode !== 'string') {
      throw new Error('Invalid connection metadata')
    }
    if (typeof rec.workspaceId !== 'string') {
      throw new Error('Invalid connection metadata')
    }
    const scopes = Array.isArray(rec.scopes) ? rec.scopes.filter((scope) => typeof scope === 'string') : []
    return {
      id: rec.id,
      workspaceId: rec.workspaceId,
      integrationId: rec.integrationId,
      credentialRefId: rec.credentialRefId,
      storageMode: rec.storageMode,
      scopes,
    }
  })
}
