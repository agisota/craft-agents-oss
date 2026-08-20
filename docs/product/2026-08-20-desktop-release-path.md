# Desktop release path (as of 2026-08-20)

Read-only snapshot of the **live** Electron packaging scripts. No signing owner is assigned here.

## Config

- **`apps/electron/electron-builder.yml` exists.** Artifact names: `Craft-Agents-${arch}.{dmg,zip,exe,AppImage}`. Output dir: `apps/electron/release/`.
- Root `package.json` passes `--config electron-builder.yml` on `electron:dist*`.
- The Electron README previously claimed there was no electron-builder config; that is stale.

## Local unsigned macOS package

```bash
bun run electron:dist:dev:mac
```

This is:

1. `CSC_IDENTITY_AUTO_DISCOVERY=false CRAFT_DEV_RUNTIME=1 bun run electron:build`
2. `cd apps/electron && CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --config electron-builder.yml --mac`

Identity auto-discovery is **off** for this path. It is the unsigned local/dev dist.

## Full macOS DMG script

```bash
# from apps/electron
bun run dist:mac          # scripts/build-dmg.sh arm64
bun run dist:mac:x64      # scripts/build-dmg.sh x64
# or
bash apps/electron/scripts/build-dmg.sh [arm64|x64] [--upload] [--latest] [--script]
```

`build-dmg.sh` stages Bun + SDK + ripgrep + interceptors, runs `bun run electron:build`, stages MCP/Pi servers (`scripts/build/stage-servers.ts darwin $ARCH`), then `npx electron-builder --mac --${ARCH}`.

Signing discovery (only if the caller has **not** already set `CSC_IDENTITY_AUTO_DISCOVERY`):

- **true** if `APPLE_SIGNING_IDENTITY`, `CSC_NAME`, `CSC_LINK`, or the Apple notarize trio is present
- **false** otherwise (same as unsigned smoke)

If `APPLE_SIGNING_IDENTITY` is set, it is exported as `CSC_NAME` (prefix `Developer ID Application: ` stripped).

## Notarize

- In **yml**: `mac.notarize` is **commented** (`teamId: ${APPLE_TEAM_ID}`). Comments mention `CSC_LINK`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
- In **`build-dmg.sh`**: notarize is **env-gated**. When `APPLE_ID`, `APPLE_TEAM_ID`, and `APPLE_APP_SPECIFIC_PASSWORD` are all non-empty, the script exports them and `NOTARIZE=true`. No person or team is named as owner.

## Upload (`--upload`)

`build-dmg.sh --upload` requires `S3_VERSIONS_BUCKET_ENDPOINT`, `S3_VERSIONS_BUCKET_ACCESS_KEY_ID`, and `S3_VERSIONS_BUCKET_SECRET_ACCESS_KEY`, then runs:

```bash
bun run scripts/upload.ts --electron   # plus --latest / --script if those flags were passed
```

**`scripts/upload.ts` is missing** in this tree. `--upload` cannot succeed until that script is added.

## Auto-update

- Dependency: `electron-updater` (`apps/electron/package.json`, currently `^6.8.0`).
- **In-tree usage:** `apps/electron/src/main/auto-update.ts` imports `{ autoUpdater } from 'electron-updater'`. `src/main/index.ts` and `src/main/menu.ts` load that module (launch check is skipped in dev).
- Publish URL in yml: generic provider `https://agents.craft.do/electron/latest`.
- Runtime can override the feed (`github` owner/repo or generic URL) inside `auto-update.ts`.

## Other platforms

| Script | Builder |
|--------|---------|
| `electron:dist:win` / `electron:dist:dev:win` | `--win` (NSIS x64; `CRAFT_DEV_RUNTIME=1` on the `:dev:` variant) |
| `electron:dist:linux` / `electron:dist:dev:linux` | `--linux` (AppImage x64) |
| `apps/electron` `dist:win` | `scripts/build-win.ps1` |

## Related

- Entitlements: `apps/electron/build/entitlements.mac.plist`
- After-pack Liquid Glass hook: `apps/electron/scripts/afterPack.cjs`
