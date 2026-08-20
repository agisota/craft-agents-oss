/**
 * CredentialMigrationCard — explicit, reversible credential storage migration.
 *
 * On mount, load getCredentialMigrationStatus only so a rollback-eligible
 * applied migration remains available after restart. Never auto-preview or
 * auto-apply. Check is required before Apply. Apply and rollback require
 * confirmation dialogs. Renderer state is aggregate counts and stable error
 * codes only.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SettingsCard, SettingsRow } from '@/components/settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type {
  CredentialMigrationCountsDto,
  CredentialMigrationErrorCode,
  CredentialMigrationResult,
  CredentialMigrationStatusDto,
} from '@craft-agent/shared/protocol'

const ERROR_CODES = [
  'not_ready',
  'unavailable',
  'stale_source',
  'rollback_unavailable',
  'rollback_stale',
  'operation_failed',
] as const satisfies readonly CredentialMigrationErrorCode[]

type PendingOp = 'preview' | 'apply' | 'status' | 'rollback' | null

function isErrorCode(value: string): value is CredentialMigrationErrorCode {
  return (ERROR_CODES as readonly string[]).includes(value)
}

function readCode(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  if (typeof record.code === 'string') return record.code
  if (typeof record.errorCode === 'string') return record.errorCode
  if (typeof record.error === 'string' && isErrorCode(record.error)) return record.error
  if (typeof record.error === 'object' && record.error !== null) {
    return readCode(record.error)
  }
  return undefined
}

function migrationErrorCode(error: unknown): CredentialMigrationErrorCode {
  const nested = readCode(error)
  if (nested && isErrorCode(nested)) return nested
  return 'operation_failed'
}

function pickCounts(value: CredentialMigrationCountsDto): CredentialMigrationCountsDto {
  return {
    ready: value.ready,
    alreadyEnvelope: value.alreadyEnvelope,
    skipped: value.skipped,
    invalid: value.invalid,
  }
}

class MigrationResultError extends Error {
  readonly code: CredentialMigrationErrorCode

  constructor(code: CredentialMigrationErrorCode) {
    super(code)
    this.name = 'MigrationResultError'
    this.code = code
  }
}

function unwrapMigration<T>(result: CredentialMigrationResult<T>): T {
  if (result.ok) return result.data
  throw new MigrationResultError(result.code)
}

export function CredentialMigrationCard() {
  const { t } = useTranslation()
  const [pending, setPending] = React.useState<PendingOp>(null)
  const [preview, setPreview] = React.useState<CredentialMigrationCountsDto | null>(null)
  const [status, setStatus] = React.useState<CredentialMigrationStatusDto | null>(null)
  const [appliedCounts, setAppliedCounts] = React.useState<CredentialMigrationCountsDto | null>(null)
  const [errorCode, setErrorCode] = React.useState<CredentialMigrationErrorCode | null>(null)
  const [applyDialogOpen, setApplyDialogOpen] = React.useState(false)
  const [rollbackDialogOpen, setRollbackDialogOpen] = React.useState(false)

  const busy = pending !== null
  const canApply = preview !== null && preview.ready > 0
  const canRollback = Boolean(
    status?.rollbackAvailable && status.migrationId && status.state === 'applied',
  )

  const showError = React.useCallback(
    (error: unknown) => {
      const code = migrationErrorCode(error)
      setErrorCode(code)
      toast.error(t(`settings.accounts.migration.error.${code}`))
      if (code === 'stale_source') {
        setPreview(null)
      }
    },
    [t],
  )

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const nextStatus = unwrapMigration(await window.electronAPI.getCredentialMigrationStatus())
        if (!cancelled) setStatus(nextStatus)
      } catch {
        // Stay idle; opening Settings must not preview or toast.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleCheck = async () => {
    if (busy) return
    setPending('preview')
    setErrorCode(null)
    try {
      const next = unwrapMigration(await window.electronAPI.previewCredentialMigration())
      setPreview(pickCounts(next))
      setAppliedCounts(null)
      const nextStatus = unwrapMigration(await window.electronAPI.getCredentialMigrationStatus())
      setStatus(nextStatus)
    } catch (error) {
      showError(error)
    } finally {
      setPending(null)
    }
  }

  const handleApplyConfirmed = async () => {
    if (busy || !canApply) return
    setApplyDialogOpen(false)
    setPending('apply')
    setErrorCode(null)
    try {
      const result = unwrapMigration(await window.electronAPI.applyCredentialMigration())
      setAppliedCounts(pickCounts(result))
      setPreview(pickCounts(result))
      const nextStatus = unwrapMigration(await window.electronAPI.getCredentialMigrationStatus())
      setStatus(nextStatus)
    } catch (error) {
      showError(error)
    } finally {
      setPending(null)
    }
  }

  const handleRollbackConfirmed = async () => {
    if (busy || !status?.migrationId) return
    const migrationId = status.migrationId
    setRollbackDialogOpen(false)
    setPending('rollback')
    setErrorCode(null)
    try {
      const result = unwrapMigration(
        await window.electronAPI.rollbackCredentialMigration(migrationId),
      )
      setStatus({
        ...result,
        migrationId: result.migrationId,
        state: 'rolled_back',
        rollbackAvailable: false,
        ...pickCounts(result),
      })
      setPreview(null)
      setAppliedCounts(null)
    } catch (error) {
      showError(error)
    } finally {
      setPending(null)
    }
  }

  const previewDescription = (): string => {
    if (errorCode) {
      return t(`settings.accounts.migration.error.${errorCode}`)
    }
    if (status?.state === 'rolled_back' && !preview) {
      return t('settings.accounts.migration.rolledBack')
    }
    if (appliedCounts) {
      return t('settings.accounts.migration.applied', {
        ready: appliedCounts.ready,
        alreadyEnvelope: appliedCounts.alreadyEnvelope,
        skipped: appliedCounts.skipped,
        invalid: appliedCounts.invalid,
      })
    }
    if (!preview) {
      return t('settings.accounts.migration.idle')
    }
    if (preview.ready === 0) {
      if (preview.invalid > 0) {
        return t('settings.accounts.migration.previewEmptyAttention', {
          invalid: preview.invalid,
        })
      }
      if (preview.alreadyEnvelope > 0) {
        return t('settings.accounts.migration.previewEmptyCurrent', {
          alreadyEnvelope: preview.alreadyEnvelope,
        })
      }
      return t('settings.accounts.migration.nothingToMigrate')
    }
    return t('settings.accounts.migration.counts', {
      ready: preview.ready,
      alreadyEnvelope: preview.alreadyEnvelope,
      skipped: preview.skipped,
      invalid: preview.invalid,
    })
  }

  return (
    <>
      <SettingsCard>
        <SettingsRow
          label={t('settings.accounts.migration.title')}
          description={t('settings.accounts.migration.description')}
        >
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleCheck()}>
            {t('settings.accounts.migration.check')}
          </Button>
        </SettingsRow>
        <SettingsRow label={t('settings.accounts.migration.statusLabel')} description={previewDescription()}>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={busy || !canApply}
              onClick={() => setApplyDialogOpen(true)}
            >
              {t('settings.accounts.migration.apply')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !canRollback}
              onClick={() => setRollbackDialogOpen(true)}
            >
              {t('settings.accounts.migration.rollback')}
            </Button>
          </div>
        </SettingsRow>
      </SettingsCard>

      <Dialog open={applyDialogOpen} onOpenChange={(open) => !busy && setApplyDialogOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.accounts.migration.applyConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.accounts.migration.applyConfirm', { count: preview?.ready ?? 0 })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={busy} onClick={() => setApplyDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={busy || !canApply} onClick={() => void handleApplyConfirmed()}>
              {t('settings.accounts.migration.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rollbackDialogOpen} onOpenChange={(open) => !busy && setRollbackDialogOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.accounts.migration.rollbackConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('settings.accounts.migration.rollbackConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={busy} onClick={() => setRollbackDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !canRollback}
              onClick={() => void handleRollbackConfirmed()}
            >
              {t('settings.accounts.migration.rollback')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
