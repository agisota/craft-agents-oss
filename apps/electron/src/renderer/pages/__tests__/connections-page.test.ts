import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const page = readFileSync(join(__dirname, '../ConnectionsPage.tsx'), 'utf8')

describe('CF-6.2 ConnectionsPage', () => {
  it('exposes the five native tabs and no iframe or secret fields', () => {
    expect(page).toContain("'services'")
    expect(page).toContain("'credentials'")
    expect(page).toContain("'imports'")
    expect(page).toContain("'policies'")
    expect(page).toContain("'audit'")
    expect(page.toLowerCase()).not.toContain('<iframe')
    expect(page.toLowerCase()).not.toContain('infisical')
    expect(page).not.toMatch(/\bpayload\b|\bsecret\b|\brefreshToken\b/)
  })

  it('loads the workgraph connection list for the active workspace', () => {
    expect(page).toContain('listConnections')
    expect(page).toContain('sanitizeConnectionRows')
  })

  it('exposes a masked GitHub env import on the Imports tab', () => {
    expect(page).toContain('previewGithubEnv')
    expect(page).toContain('importGithubEnv')
    expect(page).toContain('maskedSummary')
    expect(page.toLowerCase()).not.toContain('infisical')
  })
})

