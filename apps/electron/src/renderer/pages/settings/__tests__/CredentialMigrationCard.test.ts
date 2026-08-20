import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(import.meta.dir, '..', 'CredentialMigrationCard.tsx'), 'utf8')

describe('CredentialMigrationCard source contracts', () => {
  it('loads status on mount without auto-preview or auto-apply', () => {
    expect(source).toContain("t('settings.accounts.migration.check')")
    expect(source).toContain('onClick={() => void handleCheck()}')
    expect(source).toContain("const [pending, setPending] = React.useState<PendingOp>(null)")
    expect(source).toContain("const [preview, setPreview] = React.useState<CredentialMigrationCountsDto | null>(null)")
    expect(source).toContain("const [status, setStatus] = React.useState<CredentialMigrationStatusDto | null>(null)")
    expect(source).toMatch(/React\.useEffect\s*\(/)
    expect(source).toContain('window.electronAPI.getCredentialMigrationStatus()')
    expect(source).toContain('if (!cancelled) setStatus(nextStatus)')
    expect(source).toContain('Stay idle; opening Settings must not preview or toast.')

    const mountEffect = source.slice(
      source.indexOf('React.useEffect'),
      source.indexOf('const handleCheck'),
    )
    expect(mountEffect).toContain('getCredentialMigrationStatus')
    expect(mountEffect).not.toContain('previewCredentialMigration')
    expect(mountEffect).not.toContain('applyCredentialMigration')

    expect(source).toContain('previewCredentialMigration')
    expect(source.indexOf('handleCheck')).toBeLessThan(source.indexOf('previewCredentialMigration'))
  })

  it('calls typed electronAPI methods by name', () => {
    expect(source).toContain('window.electronAPI.previewCredentialMigration()')
    expect(source).toContain('window.electronAPI.applyCredentialMigration()')
    expect(source).toContain('window.electronAPI.getCredentialMigrationStatus()')
    expect(source).toContain('window.electronAPI.rollbackCredentialMigration(migrationId)')
  })

  it('requires confirmation dialogs before apply and rollback IPC', () => {
    expect(source).toContain('const [applyDialogOpen, setApplyDialogOpen] = React.useState(false)')
    expect(source).toContain('const [rollbackDialogOpen, setRollbackDialogOpen] = React.useState(false)')
    expect(source).toContain('onClick={() => setApplyDialogOpen(true)}')
    expect(source).toContain('onClick={() => setRollbackDialogOpen(true)}')
    expect(source).toContain('handleApplyConfirmed')
    expect(source).toContain('handleRollbackConfirmed')
    expect(source).toContain("t('settings.accounts.migration.applyConfirmTitle')")
    expect(source).toContain("t('settings.accounts.migration.rollbackConfirmTitle')")

    const applyClick = source.indexOf('onClick={() => setApplyDialogOpen(true)}')
    const applyConfirmed = source.indexOf('handleApplyConfirmed')
    const applyIpc = source.indexOf('window.electronAPI.applyCredentialMigration()')
    expect(applyClick).toBeGreaterThan(-1)
    expect(applyConfirmed).toBeGreaterThan(-1)
    expect(applyIpc).toBeGreaterThan(-1)
    expect(applyIpc).toBeLessThan(applyClick)

    const rollbackClick = source.indexOf('onClick={() => setRollbackDialogOpen(true)}')
    const rollbackIpc = source.indexOf('window.electronAPI.rollbackCredentialMigration')
    expect(rollbackClick).toBeGreaterThan(-1)
    expect(rollbackIpc).toBeGreaterThan(-1)
    expect(rollbackIpc).toBeLessThan(rollbackClick)
  })

  it('disables Check, Apply, Rollback, and dialog actions while busy', () => {
    expect(source).toContain('const busy = pending !== null')
    expect(source).toContain('if (busy) return')
    expect(source).toContain('disabled={busy}')
    expect(source).toContain('disabled={busy || !canApply}')
    expect(source).toContain('disabled={busy || !canRollback}')
    expect(source).toContain('onOpenChange={(open) => !busy && setApplyDialogOpen(open)}')
    expect(source).toContain('onOpenChange={(open) => !busy && setRollbackDialogOpen(open)}')
  })

  it('clears preview when stale_source is reported', () => {
    expect(source).toContain("'stale_source'")
    expect(source).toContain("if (code === 'stale_source')")
    expect(source).toContain('setPreview(null)')
  })

  it('surfaces stable error codes only and never renders raw exceptions', () => {
    expect(source).toContain('setErrorCode(code)')
    expect(source).toContain('toast.error(t(`settings.accounts.migration.error.${code}`))')
    expect(source).toContain('t(`settings.accounts.migration.error.${errorCode}`)')
    expect(source).toContain("return 'operation_failed'")
    expect(source).not.toMatch(/error\.message/)
    expect(source).not.toMatch(/String\(error\)/)
    expect(source).not.toMatch(/error\.stack/)
    expect(source).not.toMatch(/JSON\.stringify\(error\)/)
  })

  it('does not read or render secret-bearing fields', () => {
    expect(source).not.toMatch(/\b(password|secret|token|apiKey|api_key|credentialValue|plaintext)\b/i)
    expect(source).toContain('pickCounts')
    expect(source).toContain('ready: value.ready')
    expect(source).toContain('alreadyEnvelope: value.alreadyEnvelope')
    expect(source).toContain('skipped: value.skipped')
    expect(source).toContain('invalid: value.invalid')
  })
})
