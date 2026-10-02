# [VERIFY] Executed baseline checks and audit integrity

## [VERIFY-SCOPE] What was actually verified

Source: `f63294ba4fffa7238b46b24e918925a313ad0b12`. Host: macOS arm64. Local Bun: `1.4.2`; resolved TypeScript: `5.9.3`; Electron: `39.2.7`; electron-builder: `26.4.0`; Vite: `6.4.1`. These are the actual local resolved inputs, not a claim that CI's older Bun versions behave identically. No application source was changed to make the baseline pass.

| Check | Executed command / method | Observed result | Limit of evidence |
| --- | --- | --- | --- |
| Dependency installation | `bun install --frozen-lockfile` | PASS; 1,816 packages installed; lockfile unchanged. | Installation does not prove packaged native binaries or clean end-user prerequisites. |
| RX registry | `bun run rx:validate` | PASS; 443 entries, 13 documents, zero errors and warnings. | Registry consistency does not prove completed product functionality. |
| Required root typecheck | `bun run typecheck:all` | FAIL, exit 2; first package core reports 13 TypeScript diagnostics. | Command stops at core; downstream checks therefore ran independently. |
| Independent workspace types | Explicit `bun x tsc --noEmit -p <workspace config>` | 17 workspaces accounted for: 6 PASS, 11 FAIL. 289 diagnostic occurrences across overlapping import graphs. | Occurrences are not 289 unique bugs; one shared production error reappears in many packages. Pi uses its declared `tsconfig.typecheck.json`. Core result is from the first leg of the root check. Viewer result covers its app config, not the separate Functions config. |
| Browser production bundle | `bun run webui:build` | PASS; Vite built in approximately 96 seconds. Main chunk 9,779.57 kB / 2,787.97 kB gzip; App chunk 4,845.38 kB / 1,055.21 kB gzip. Vite warns about chunks over 500 kB. | Build success does not establish typecheck, endpoint connectivity, native capability adaptation or hosted deployment. Sizes are bundler outputs, not measured user latency. |
| WebUI/auth/transport/bootstrap isolation suite | `bun test packages/server-core/src/webui packages/server-core/src/transport packages/shared/src/config/__tests__/config-isolation.test.ts packages/server-core/src/bootstrap` | PASS; 62 tests across 9 files, 130 assertions, zero failures, approximately 14 seconds. | Tests include real local HTTP/WS sockets and auth/peer-trust checks, but do not validate public multi-user hosting, live providers or installed binaries. |
| Document integrity | `bun scripts/final-readiness-audit.ts --validate --export` | Required completion gate: validates unique task IDs, parent relationships, four acceptance fields, own pinned code references, existing source paths/line bounds and companion document links; produces backlog JSON and navigation. Final output is recorded in the package README. | This checks audit integrity; source-reference presence alone does not prove a claim's semantics. Independent source review also corrected backend/helper/locale classifications. |

Test configuration uses the repository's isolation preloads, which set both `ROX_CONFIG_DIR` and `CRAFT_CONFIG_DIR` before import-time root resolution [test-config-isolation.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/test-config-isolation.ts#L24-L48). No real account channel was paired or messaged, no paid sandbox was provisioned and no deployment was performed during baseline checks.

## [VERIFY-FAILURES] Exact observed typecheck failures

The complete commands, exit codes and diagnostics are retained in [package-typechecks.json](evidence/package-typechecks.json). Per-package logs are linked below. PASS logs are intentionally empty when TypeScript printed nothing and exited zero. Production and test diagnostics are both retained; do not resolve failures by hiding tests or weakening type safety.

Highest-impact examples:

- [Core meeting status](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/rox2/meeting-conation-shell.ts#L29) compares canonical verification to `verified`, which is outside its union. This propagates through multiple package checks.
- [Desktop navigation](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/AppShell.tsx#L2739) reads `meetings` from a registry whose type excludes that key; desktop and WebUI both compile this renderer.
- [Label handler](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/labels.ts#L72) accesses a possibly null workspace; [messaging handler](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/messaging.ts#L142) passes `string | null` where the contract expects `string | undefined`.
- [Voice runtime](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/voice/runtime.ts#L177) supplies a fetch-shaped fallback missing Bun's typed `preconnect`; [transcription adapter](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/voice/adapters/rox-transcription.ts#L113) relies on `BlobPart` absent in the host check's lib contract.
- Pi endpoint/API union drift, meeting journal variant handling, strict test result narrowing, graph/project type mismatches and messaging access-policy fixtures are recorded in their package logs.

Remediation is explicitly tracked in **QA-010**, with relevant UI/SVC tasks retaining functional acceptance. A compiler diagnostic establishes a source/build contract failure; runtime consequences must be verified by those task journeys rather than assumed.

## [VERIFY-NOT-RUN] Required release evidence still to obtain

- Windows 10/11 native build, standard-user installation, signed updates, uninstall/retention and native runtime tests.
- macOS Intel/Apple Silicon packaging, Developer ID signing, notarization/stapling, Gatekeeper launch, privacy permissions and update transition.
- Real hosted server/container build and deployment, external HTTPS/WSS checks, durable volumes, backup restore and selected tenancy model.
- Real provider OAuth/session/tool/branch journeys, cloud runner provisioning/execution, messaging account flows, microphone/transcription and external meeting follow-ups.
- Full product UI E2E, accessibility, locale/RTL verification, performance/load measurements and fault/recovery matrix.
- External asset/website submodule source inspection, private third-party implementations and deployed infrastructure configuration.

These are open acceptance requirements, not failed tests presented as executed. This audit delivers the code-grounded completion plan and baseline evidence; it does not claim a signed final product.

## [VERIFY-PACKAGES] Per-workspace result and diagnostic logs

| Workspace | Result | Diagnostic occurrences | Exact log |
| --- | --- | ---: | --- |
| apps/cli | FAIL | 1 | [log](evidence/apps-cli.log) |
| apps/cloud-gateway | PASS | 0 | [log](evidence/apps-cloud-gateway.log) |
| apps/electron | FAIL | 51 | [log](evidence/apps-electron.log) |
| apps/viewer | FAIL | 1 | [log](evidence/apps-viewer.log) |
| apps/webui | FAIL | 52 | [log](evidence/apps-webui.log) |
| packages/cloud-runner | PASS | 0 | [log](evidence/packages-cloud-runner.log) |
| packages/core | FAIL | 13 | [log](evidence/packages-core.log) |
| packages/messaging-discord-worker | PASS | 0 | [log](evidence/packages-messaging-discord-worker.log) |
| packages/messaging-gateway | FAIL | 110 | [log](evidence/packages-messaging-gateway.log) |
| packages/messaging-whatsapp-worker | PASS | 0 | [log](evidence/packages-messaging-whatsapp-worker.log) |
| packages/pi-agent-server | FAIL | 2 | [log](evidence/packages-pi-agent-server.log) |
| packages/server | FAIL | 8 | [log](evidence/packages-server.log) |
| packages/server-core | FAIL | 33 | [log](evidence/packages-server-core.log) |
| packages/session-mcp-server | PASS | 0 | [log](evidence/packages-session-mcp-server.log) |
| packages/session-tools-core | PASS | 0 | [log](evidence/packages-session-tools-core.log) |
| packages/shared | FAIL | 17 | [log](evidence/packages-shared.log) |
| packages/ui | FAIL | 1 | [log](evidence/packages-ui.log) |
