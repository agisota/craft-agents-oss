import type { BulkUpdateSessionsPatch } from '@craft-agent/shared/protocol/dto'

/** Reject ambiguous replacement-plus-delta label patches before mutating any session. */
export function assertValidBulkLabelPatch(patch: BulkUpdateSessionsPatch): void {
  if (patch.labels !== undefined && (patch.addLabels !== undefined || patch.removeLabels !== undefined)) {
    throw new Error('bulk_labels_conflict')
  }
}

/**
 * Resolve replacement or delta label operations for one session.
 * Returns undefined when the patch does not affect labels.
 */
export function resolveBulkLabels(
  currentLabels: readonly string[] | undefined,
  patch: BulkUpdateSessionsPatch,
): string[] | undefined {
  assertValidBulkLabelPatch(patch)

  if (patch.labels !== undefined) return [...new Set(patch.labels)]
  if (patch.addLabels === undefined && patch.removeLabels === undefined) return undefined

  const next = new Set(currentLabels ?? [])
  for (const labelId of patch.addLabels ?? []) next.add(labelId)
  for (const labelId of patch.removeLabels ?? []) next.delete(labelId)
  return [...next]
}
