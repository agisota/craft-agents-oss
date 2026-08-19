# Controlled Credential Migration UI Design

**Date:** 2026-08-19
**Status:** Approved design — implementation not started

## Goal

Expose the existing CF-2 controlled migration of valid legacy credential records into CF-1 envelopes through the desktop Settings UI. The flow is explicit and reversible:

1. Preview only when the user asks.
2. Apply only after a second, deliberate confirmation.
3. Roll back the last applied migration, including after an application restart.

No application startup path may invoke this migration.

## Scope

- Add a credential migration card to **Settings → Accounts & Connections → Account & Security**.
- Add a small, secret-free credential-migration RPC surface through the existing shared protocol, Electron transport bridge, and server-core handler boundary.
- Persist only migration metadata required to discover and roll back the most recent completed migration after restart.
- Reuse CF-2 encrypted snapshot, atomic replacement, source-checksum, quarantine, and fail-closed behaviors.

Out of scope:

- New Settings navigation pages.
- Automatic preview, automatic migration, startup migration, CLI migration controls, or external integrations.
- Exposing credentials, fingerprints, record identifiers, snapshot paths, ciphertext, keys, or raw migration errors to the renderer.
- Changing the unrelated legacy `migrateLegacyCredentials()` compatibility path.

## Existing integration points

- `apps/electron/src/renderer/pages/settings/AccountsSettingsPage.tsx` already owns the Account & Security section and Credential Health control.
- `packages/shared/src/protocol/channels.ts` owns the `credentials` RPC namespace.
- `apps/electron/src/transport/channel-map.ts` maps typed renderer API methods to RPC channels.
- `apps/electron/src/shared/types.ts` declares `window.electronAPI`.
- `packages/server-core/src/handlers/rpc/auth.ts` currently registers `credentials:healthCheck`; controlled migration handlers belong in the same credentials boundary or a narrowly named sibling handler.
- CF-2 core APIs already provide preview, apply, rollback, encrypted snapshots, atomic replacement, and source consistency checks in `packages/shared/src/credentials`.

## Architecture

### Placement

Embed a dedicated **Credential storage migration** card in `AccountsSettingsPage`'s existing Account & Security `SettingsSection`. This avoids adding a page to the settings registry, navigator menu, icon map, and locale navigation metadata for one maintenance control.

Extract the card into a focused `CredentialMigrationCard` renderer component. `AccountsSettingsPage` remains responsible for layout; the card owns its transient UI state and calls typed `window.electronAPI` methods.

### Protocol and data boundary

Add typed, secret-free `credentials` RPC operations:

- `previewMigration()` — read-only, no arguments.
- `applyMigration()` — no caller-supplied records or snapshot paths; recomputes the preview server-side.
- `getMigrationStatus()` — read-only metadata for the latest applied migration and rollback availability.
- `rollbackMigration(migrationId)` — accepts only an opaque migration ID returned by status/apply.

The protocol DTOs return only state and aggregate counts:

- Preview: `ready`, `alreadyEnvelope`, `skipped`, `invalid`.
- Apply: `migrationId`, aggregate results, and a non-secret status.
- Status: `migrationId`, `state`, timestamps, aggregate results, and whether rollback is currently available.
- Rollback: resulting state and aggregate result.

Neither DTOs, errors, renderer state, events, or debug logs may include a credential value, fingerprint, credential ID, storage path, ciphertext, encryption key, checksum, or snapshot manifest content.

### Persisted rollback discovery

The credential backend persists a private metadata record for each successful migration alongside its private encrypted snapshot. Metadata contains only:

- Opaque migration ID.
- State (`applied` or `rolled_back`).
- Created/applied/rolled-back timestamps.
- Aggregate counts.
- Source and applied checksums needed only by backend consistency checks.

The backend exposes only a sanitized projection. It identifies the latest applied migration after restart so the UI can offer rollback. The encrypted snapshot and manifest remain inaccessible to renderer code.

## User flow

1. Card loads in an idle state. It does not inspect credential storage automatically.
2. User selects **Check**. The card invokes `previewMigration()` and renders the aggregate result.
3. If `ready === 0`, Apply is unavailable. The card explains whether there is nothing to migrate, storage is already current, or records require attention.
4. If `ready > 0`, **Apply migration** is available. Selecting it opens an in-app confirmation dialog that states the count to be migrated and that the backend will create an encrypted rollback snapshot. The confirm action invokes `applyMigration()`.
5. On success, the card displays aggregate completion data and loads migration status. The source legacy values are no longer used by the migrated records.
6. When status exposes a rollback-eligible migration, including after restart, **Roll back latest migration** is available. Selecting it opens a separate confirmation dialog. Confirm invokes `rollbackMigration(migrationId)`.
7. On successful rollback, the card renders `rolled_back`, disables another rollback, and permits a new Check.

Only one operation may be in flight. All control buttons are disabled while the current RPC is pending.

## Backend invariants and failure behavior

- Preview performs no write.
- Apply recomputes the eligible set; it must not trust a stale renderer preview.
- Apply preserves the encrypted source snapshot before atomic storage replacement.
- If input changes after preview or before atomic replacement, Apply fails with no replacement write. The UI invalidates the displayed preview and requires another Check.
- No eligible legacy records means no snapshot and no write.
- Malformed, corrupt, raw, or envelope-like records are not rewritten. Existing quarantine/safe handling remains authoritative; they affect only the aggregate `invalid`/`skipped` counts.
- Multiple active credential backends fail closed. Migration and rollback make no storage mutation.
- Rollback verifies source/applied checksums and refuses after a subsequent credential write, missing snapshot, malformed manifest, or incompatible migration state. Refusal leaves storage untouched.
- Failed snapshot creation, metadata persistence, encryption, atomic rename, or post-write verification leaves the original active credentials file intact.
- A successful rollback restores the exact pre-apply encrypted bytes and marks the migration `rolled_back` atomically enough that it cannot be rolled back twice.

## Error presentation

The backend maps technical failures to stable, non-secret error codes. The renderer maps them to concise localized messages:

- `not_ready` — no eligible legacy credentials; Apply unavailable.
- `unavailable` — no single active backend; retry after configuration is repaired.
- `stale_source` — storage changed; run Check again.
- `rollback_unavailable` — no eligible applied migration.
- `rollback_stale` — storage changed since Apply; no rollback occurred.
- `operation_failed` — operation did not complete; storage was left unchanged.

The renderer may surface only the code-derived message in a toast/card state. It must not stringify backend exceptions blindly.

## Verification

### Core credential tests

Extend the existing CF-2 migration coverage under `packages/shared/src/credentials/__tests__` to verify:

- Read-only preview and no-op behavior.
- Valid legacy-to-envelope migration.
- Encrypted snapshot and private metadata creation.
- Exact encrypted-byte restoration on rollback.
- Metadata discovery and rollback eligibility after a fresh backend instance simulates restart.
- Stale Apply refusal after a source change.
- Stale Rollback refusal after a later credential write.
- Corrupt/malformed input and multiple-active-backend fail-closed cases.
- No secret-bearing data in migration result DTOs or debug output.

### RPC and transport tests

Verify that the shared channel names, typed transport mapping, Electron API declaration, and server-core handlers route all four operations. Assert that the public result schemas contain only the defined aggregate and opaque fields.

### Renderer tests

Test `CredentialMigrationCard` transitions with a mocked typed `electronAPI`:

- Idle → checked → apply confirmation → applying → applied.
- Applied status after a simulated reload makes rollback available.
- Rollback confirmation → rolling back → rolled back.
- No-ready, busy, stale-source, unavailable, and generic failure states.
- No technical exception text or secret-bearing fields appears in rendered UI state.

### Desktop smoke test

Run Electron against a temporary `CRAFT_CONFIG_DIR` containing a known legacy credential file. In the actual Settings card:

1. Check; verify counts and no source mutation.
2. Apply; verify migration success and the stored format changed.
3. Restart the app; verify rollback remains available.
4. Roll back; verify the original encrypted file bytes are restored exactly.

## Acceptance criteria

- Opening Settings does not call preview or write credential storage.
- The only write route is explicit Check → user-confirmed Apply, or user-confirmed rollback of a discovered applied migration.
- Renderer-visible data is secret-free by construction and by tests.
- Apply/rollback fail closed and preserve storage on every tested refusal/failure path.
- Rollback is available after restart for the latest eligible applied migration and refuses if storage has subsequently changed.
- Existing CF-2 core tests, affected transport tests, renderer transitions, and the Electron temporary-config smoke scenario pass.
