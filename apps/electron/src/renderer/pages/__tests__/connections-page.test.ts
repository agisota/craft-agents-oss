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
    expect(page).not.toMatch(/\bvalue\b|\bpayload\b|\bsecret\b|\brefreshToken\b/)
  })
})
