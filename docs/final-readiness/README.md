# [ROX-FINAL] Final build completion plan — Windows, macOS and hosted web

**Audited repository:** [rox-one/rox-one](https://github.com/rox-one/rox-one). **Source baseline:** [`f63294ba4fffa7238b46b24e918925a313ad0b12`](https://github.com/rox-one/rox-one/commit/f63294ba4fffa7238b46b24e918925a313ad0b12), captured from `main`. **Audit branch:** `audit/final-readiness-2026-10-03`. **Language:** English.

The repository contains a substantial desktop product and a real interactive web client, but the audited source does not yet meet a verified final-release contract. The WebUI bundle builds; the required typecheck chain fails, several packaging/runtime paths are inconsistent, and full native/hosted/live integration acceptance remains open. The documents below distinguish confirmed implementation gaps from existing functionality that needs release qualification.

## [ROX-FINAL-DELIVERY] Fork, checkout and branch

- GitHub's fork network already contains the user's [agisota/craft-agents-oss](https://github.com/agisota/craft-agents-oss) fork. `rox-one/rox-one` is a child of that fork. Both fork creation commands returned the existing fork; no second new fork is claimed.
- Local checkout: `/Users/t/Projects/rox-one-final-audit-20261003`.
- `upstream`: `https://github.com/rox-one/rox-one.git`.
- `origin`: `https://github.com/agisota/craft-agents-oss.git`.
- Audit branch was created directly from `upstream/main` at the source baseline above. Existing fork `main` was not changed.
- The audit changes only documentation, evidence and a documentation inventory/validation/export script; application/runtime code is not modified.

## [ROX-FINAL-READ] Documents and machine-readable tasks

| Artifact | What to use it for |
| --- | --- |
| [01 — Architecture](01-architecture.md) | Application layers, process/service topology, web version, direct/runtime/external dependencies, target contracts, highest-impact blockers and execution order. |
| [02 — Surface backlog](02-surface-backlog.md) | Every renderer page/support surface, all 22 settings routes, five extra screens, twenty individually specified Home widgets, dialogs, editing and feature actions. |
| [03 — Runtime and service backlog](03-runtime-services-backlog.md) | Agents, RPC, cloud providers, credentials, MCP/sources, workers/messaging, automation, knowledge/memory, mail, collaboration and shared business modules. |
| [04 — Platform and release backlog](04-platform-release-backlog.md) | Windows 10/11, Intel/Apple Silicon macOS, hosted WebUI, native binaries, signing/updating, runtime prerequisites and viewer deployment. |
| [05 — Separate integration, test and recheck backlog](05-integration-test-recheck-backlog.md) | Full vertical journeys, cross-module contract/permission/persistence checks, Cloud Runs/voice integration, functional E2E, security, performance, recovery and final artifact rechecking. |
| [06 — Codebase and dependencies](06-codebase-inventory.md) | All 17 app/package manifests; core/shared/server/renderer/native module inventory; source/test-file counts and every declared direct dependency. |
| [07 — Executed verification](07-verification.md) | Actual baseline commands/results, exact compiler diagnostics and limits of evidence. |
| [08 — Complete checklist/navigation](08-task-index.md) | Links to all 495 task/subtask descriptions, grouped by source document. Checkboxes begin unchecked. |
| [backlog.json](backlog.json) | Every task's ID, parent ID, family, document, full description, requirements, DoD, functional verification, test method and pinned source references; suitable for subsequent issue import. |
| [Typecheck evidence JSON](evidence/package-typechecks.json) | All workspace commands, exit codes and observed diagnostics, with per-package raw logs. |

## [ROX-FINAL-COUNTS] Task scope

| Prefix | Scope | Tasks | Subtasks |
| --- | --- | ---: | ---: |
| UI | Product surfaces, screens, settings and feature actions | 67 | 161 |
| SVC | Runtime/services/integrations/shared modules | 37 | 74 |
| WIN | Windows 10/11 distribution and OS behavior | 7 | 14 |
| MAC | macOS distribution and OS behavior | 6 | 12 |
| WEB | Hosted client/server and sharing viewer | 9 | 18 |
| INT | Cross-module full functional integration | 15 | 30 |
| QA | Build/type correctness, E2E, security, recovery, accessibility and performance | 10 | 20 |
| REL | Supply chain and user/operator delivery guides | 2 | 4 |
| RECHECK | Evidence closure and final artifact/deployment acceptance | 3 | 6 |
| **Total** | **All independently described blocks** | **156** | **339** |

Every task **and** subtask has a prefixed heading, its own pinned codebase reference and concluding **Requirements / DoD / Full functional verification / Test method**. Target letters are consistent throughout: **A** Windows 10/11; **B** macOS; **C** hosted web. Product decisions and conditional capabilities are explicit. Priority does not mean a listed existing implementation must be rewritten; qualify existing behavior, then fix the failures found.

## [ROX-FINAL-BLOCKERS] Start with these release blockers

1. **TypeScript baseline:** 11 of 17 workspaces fail; root `typecheck:all` stops at core. See **QA-010** and exact diagnostic evidence. Shared imported errors are counted repeatedly; 289 diagnostic occurrences do not mean 289 independent defects.
2. **Hosted build:** Docker copies an absent docs-site manifest and its Pi helper format differs from the canonical Bun ESM build. See **WEB-001**.
3. **ROX release identity:** Craft-era artifact names, icon-hook bundle paths and update/distribution assumptions conflict with ROX packaging. See **WIN-003/004**, **MAC-001/004**.
4. **Windows/runtime portability:** shell command runner hardcodes `/bin/zsh`; Rust sidecar explicitly lacks Windows support; executable suffixes/native database/runtime staging need correction or a verified supported fallback. See **UI-029**, **WIN-001/002/005/006**.
5. **Hosted capabilities:** browser file selection does not transfer file bytes; several desktop/native operations are no-ops or unsupported; product navigation must reflect real capabilities. See **WEB-004/005**, **INT-001/005**.
6. **Hosted identity:** current password/JWT authenticates one instance-wide identity. Select a dedicated private-instance contract or implement and verify per-user shared hosting with isolated grants/secrets/storage/runners. See **SVC-002**, **WEB-002**, **INT-013**.
7. **Cloud execution truth:** local default runner is a stub; Daytona terminal status must respect actual process exit; every provisioning route needs enforced policy and budget. See **SVC-012/013/014**, **INT-014**.
8. **Persistent product state:** in-memory collaboration/replica and localStorage-authored surfaces require deliberate durability, sync, backup and recovery contracts; source “connected” labels must reflect real dependencies. See service/surface ownership tables.
9. **Qualification gates:** lifecycle CI currently contains an echo placeholder, and fixture tests do not establish installed native or real hosted/provider functionality. See **QA-001/003/008**, **RECHECK-001/002/003**.

## [ROX-FINAL-BASELINE] Checks actually executed

| Check | Outcome |
| --- | --- |
| Frozen-lock dependency install | PASS; 1,816 packages; no lockfile change. |
| RX registry validator | PASS; 443 entries, no errors/warnings. |
| Browser production build | PASS; large-chunk warnings recorded. |
| WebUI/auth/transport/bootstrap/config isolation tests | PASS; 62 tests, 130 assertions, 0 failures. |
| Required root typecheck | FAIL; 13 core diagnostics, chain stops there. |
| Independent package typecheck accounting | 6 PASS / 11 FAIL across all 17 workspace manifests. |
| Audit structure and pinned-reference validation | PASS; 495 complete task/subtask blocks, all referenced source files/line anchors exist. |

No signed Windows/macOS release or hosted production deployment is claimed. Detailed limits and not-run checks are in [07-verification.md](07-verification.md). External submodules/private services and real account integrations require their own acceptance evidence.

## [ROX-FINAL-REPRODUCE] Validate and export the audit

From the repository root:

```sh
bun scripts/final-readiness-audit.ts --inventory
bun scripts/final-readiness-audit.ts --validate --export
git diff --check
```

The script validates unique IDs/parents, mandatory fields and task-owned source references; checks source paths/line bounds against the pinned source tree; validates companion links; generates dependency inventory, `backlog.json` and checklist navigation. Application baseline commands and their exact package logs remain in the verification document. Rechecking the audit does not start application services or contact live integrations.
