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

  it('exposes a masked git-credential-helper import on the Imports tab', () => {
    expect(page).toContain('previewGitHelper')
    expect(page).toContain('importGitHelper')
    expect(page).toContain('gitConfigPath')
    expect(page.toLowerCase()).not.toContain('infisical')
  })

  it('revokes a listed connection without exposing secret fields', () => {
    expect(page).toContain('revokeConnection')
    expect(page).toContain('connections.revoke')
    expect(page.toLowerCase()).not.toContain('infisical')
  })

  it('confirms before revoking a connection', () => {
    expect(page).toContain('connections.revokeConfirm')
    expect(page).toContain('connections.revokeCancel')
    expect(page).toContain('confirmingId')
  })

  it('renders credential and policy metadata from listed connections', () => {
    expect(page).toContain("tab === 'credentials'")
    expect(page).toContain("tab === 'policies'")
    expect(page).toContain('row.scopes')
    expect(page).toContain('row.credentialRefId')
  })

  it('selects a service row for the inspector host', () => {
    expect(page).toContain('selectedConnectionAtom')
    expect(page).toContain('aria-selected')
    expect(page).toContain('data-testid="connections-row"')
  })

  it('tests a listed GitHub connection without exposing secret fields', () => {
    expect(page).toContain('testConnection')
    expect(page).toContain('connections.test')
    expect(page.toLowerCase()).not.toContain('infisical')
  })

  it('rotates a listed connection with confirm', () => {
    expect(page).toContain('rotateConnection')
    expect(page).toContain('connections.rotateConfirm')
  })

  it('repairs a listed connection', () => {
    expect(page).toContain('repairConnection')
    expect(page).toContain('connections.repair')
  })

  it('exposes a native Connect control that lists import sources', () => {
    expect(page).toContain('connections.connect')
    expect(page).toContain('CONNECT_SOURCES')
    expect(page).toContain("'keychain'")
    expect(page).toContain("'adc'")
    expect(page).toContain("'ssh-agent'")
    expect(page.toLowerCase()).not.toContain('<iframe')
  })

  it('exposes masked docker, aws, keychain, adc, and ssh-agent imports', () => {
    expect(page).toContain('previewDockerHelper')
    expect(page).toContain('importDockerHelper')
    expect(page).toContain('dockerConfigPath')
    expect(page).toContain('previewAwsProfiles')
    expect(page).toContain('importAwsProfile')
    expect(page).toContain('previewKeychain')
    expect(page).toContain('importKeychain')
    expect(page).toContain('previewAdc')
    expect(page).toContain('importAdc')
    expect(page).toContain('previewSshAgent')
    expect(page).toContain('importSshAgent')
    expect(page.toLowerCase()).not.toContain('infisical')
  })
})



