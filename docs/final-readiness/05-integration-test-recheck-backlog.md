# [INT-QA-RECHECK] Separate integration, testing, rechecking and delivery backlog

Pinned source: `f63294ba4fffa7238b46b24e918925a313ad0b12`. A = Windows 10/11, B = macOS, C = hosted web. These tasks close cross-module behavior and evidence; the surface/runtime/platform lists remain separately actionable. Priorities and measurable thresholds are proposed acceptance requirements, not claims of executed results. Task dependencies: INT depends on relevant UI/SVC/platform implementations; QA follows working vertical journeys; RECHECK requires final artifacts and prior QA completion.

## [INT-001] Freeze a cross-platform capability and RPC contract

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: browser reuse, desktop APIs, server handlers and provider capabilities need a single acceptance contract. A compiling shim or advertised panel is not proof that an operation works. Source: [packages/core/src/platform/types.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/types.ts#L1).

**Requirements:** Every enabled navigation route and primary command maps to an authenticated implementation; unavailable capabilities produce explicit states. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Visit every route on fresh desktop and browser accounts, compare visible actions to actual negotiated capability, and attempt an unavailable operation. Then Run the same create/edit/delete action from desktop and browser; reconnect during progress and verify final state through a second client.

**Test method:** Add contract assertions against platform capability descriptors and route/command registries; fail on advertised-but-unimplemented commands. Protocol contract tests plus WS integration tests with malformed/version-mismatched payloads and event replay.

### [INT-001.1] Publish the feature and permission matrix

**Priority / targets:** P0 · A/B/C. **Source:** [packages/core/src/platform/types.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/types.ts#L1).

**Requirements:** Classify each surface from UI/SVC/WIN/MAC/WEB as available, companion-required, conditional or excluded; include permission modes, workspace ownership and provider support.

**DoD:** Matrix has an owner, release version and executable acceptance reference for each advertised capability.

**Full functional verification:** Visit every route on fresh desktop and browser accounts, compare visible actions to actual negotiated capability, and attempt an unavailable operation.

**Test method:** Add contract assertions against platform capability descriptors and route/command registries; fail on advertised-but-unimplemented commands.

### [INT-001.2] Validate request, response and event parity

**Priority / targets:** P0 · A/B/C. **Source:** [packages/core/src/platform/types.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/types.ts#L1).

**Requirements:** Check serialized payloads, error codes, event sequencing, disposal and workspace scope for every UI action used on A/B/C; use the typed protocol as authority.

**DoD:** Desktop and web produce compatible observable outcomes; unsupported operations return stable typed errors.

**Full functional verification:** Run the same create/edit/delete action from desktop and browser; reconnect during progress and verify final state through a second client.

**Test method:** Protocol contract tests plus WS integration tests with malformed/version-mismatched payloads and event replay.

## [INT-002] Unify ROX/Craft configuration, identity and runtime roots

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Observed migration boundary: configuration uses preferred ROX and legacy Craft aliases; import-time snapshots make process startup order relevant. Mixed aliases can select different workspaces or secrets. Source: [packages/shared/src/config/paths.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/config/paths.ts#L1).

**Requirements:** Every executable resolves the same intended owned root; migrations preserve original data and never silently create a second active profile. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Create separate seeded profiles, start each host under each alias set, inspect workspace list and write a note, then verify only the selected root changed. Then Upgrade a realistic legacy profile, interrupt at each migration checkpoint, resume, restore backup and compare record/link/attachment counts.

**Test method:** Subprocess config tests using isolated temporary roots; include WebUI token alias startup and runtime-resolver propagation. Migration fault injection and golden-file semantic comparisons, including corrupt JSON/JSONL and locked files.

### [INT-002.1] Test all environment and startup combinations

**Priority / targets:** P0 · A/B/C. **Source:** [packages/shared/src/config/paths.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/config/paths.ts#L1).

**Requirements:** Cover ROX-only, Craft-only, both equal, both different, unset, legacy existing tree, clean tree, read-only root and Unicode paths in desktop/server/CLI/worker launches.

**DoD:** Documented precedence is consistent across hosts; startup reports actionable root errors without secrets.

**Full functional verification:** Create separate seeded profiles, start each host under each alias set, inspect workspace list and write a note, then verify only the selected root changed.

**Test method:** Subprocess config tests using isolated temporary roots; include WebUI token alias startup and runtime-resolver propagation.

### [INT-002.2] Make migrations transactional and recoverable

**Priority / targets:** P0 · A/B/C. **Source:** [packages/shared/src/config/paths.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/config/paths.ts#L1).

**Requirements:** Version schemas and path migrations; back up before moving or rewriting files; preserve credentials, histories, references and knowledge indexes.

**DoD:** Interrupted migrations retry safely, rollback restores readable originals, and downgraded versions do not overwrite unsupported data.

**Full functional verification:** Upgrade a realistic legacy profile, interrupt at each migration checkpoint, resume, restore backup and compare record/link/attachment counts.

**Test method:** Migration fault injection and golden-file semantic comparisons, including corrupt JSON/JSONL and locked files.

## [INT-003] Verify complete agent lifecycle across advertised backends

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: backend adapters need equivalent stream, tool, permission and persistence behavior under the runtime shipped with each target. Source: [packages/shared/src/agent/backend/factory.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/factory.ts#L1).

**Requirements:** Each advertised provider passes the complete session journey, with truthful capability differences and no lost tool or thinking events. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Send a multi-tool request, deny one operation, approve another, cancel a slow tool, restart the host, and resume the session with a verifiable artifact. Then Create a parent with a source and skill, fork at two points, rotate credentials, resume children and confirm actual model and tool access.

**Test method:** Deterministic protocol fixtures plus live sandbox provider tests; correlate backend logs, events and transcript artifacts. Adapter capability tests and live branch/auth integration matrix; snapshot normalized transcripts without secrets.

### [INT-003.1] Exercise stream, tools, cancellation and restart

**Priority / targets:** P0 · A/B/C. **Source:** [packages/shared/src/agent/backend/factory.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/factory.ts#L1).

**Requirements:** Cover the registered Anthropic/Pi/OMP backends and their advertised connection/provider combinations; test text, thinking, tool start/result, failed tool, approval deny/allow, abort and process death. Qualify Copilot connections through their actual backend and OpenClaw control/proxy flows separately instead of inventing unregistered backend drivers.

**DoD:** Terminal states settle correctly; approvals cannot execute after denial/expiry; child processes terminate and transcripts remain readable.

**Full functional verification:** Send a multi-tool request, deny one operation, approve another, cancel a slow tool, restart the host, and resume the session with a verifiable artifact.

**Test method:** Deterministic protocol fixtures plus live sandbox provider tests; correlate backend logs, events and transcript artifacts.

### [INT-003.2] Verify model selection, branching and authentication recovery

**Priority / targets:** P0 · A/B/C. **Source:** [packages/shared/src/agent/backend/factory.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/factory.ts#L1).

**Requirements:** Check catalog refresh, default model, explicit override, supported thinking levels, mid-history branch, tail branch, expired credentials and rate limits.

**DoD:** Selected backend/model matches actual invocation; branches preserve anchors/context; errors show recovery without corrupting history.

**Full functional verification:** Create a parent with a source and skill, fork at two points, rotate credentials, resume children and confirm actual model and tool access.

**Test method:** Adapter capability tests and live branch/auth integration matrix; snapshot normalized transcripts without secrets.

## [INT-004] Close credential and OAuth journeys end to end

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Observed shared hosted identity and multiple credential stores make callback ownership, refresh and revocation release-critical. Secret references must be dereferenced only inside their intended runtime boundary. Source: [packages/server-core/src/webui/auth.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/auth.ts#L1).

**Requirements:** Connection state reflects real authenticated access; revoked/expired credentials stop authorizing tools and no secret reaches UI logs or exports. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Connect a sandbox OAuth source, execute a tool, expire/refresh tokens, replay the callback, revoke externally, and retry from a second workspace. Then Save a credential, use it through an approved tool, export/share/support-bundle the session, disconnect and retry after application restart.

**Test method:** HTTP callback integration tests with malicious states plus real provider sandbox flows; inspect redacted logs and persisted envelopes. Canary-secret leakage assertions across RPC/events/files plus credential recovery and grant-expiry tests.

### [INT-004.1] Verify callback routing and token refresh on all hosts

**Priority / targets:** P0 · A/B/C. **Source:** [packages/server-core/src/webui/auth.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/auth.ts#L1).

**Requirements:** Cover system-browser desktop callback/deep link, hosted HTTPS callback, state/PKCE replay, cancellation, timeout, denied scopes and refresh failure.

**DoD:** OAuth result binds to initiating user/workspace/source; duplicate or forged callbacks are rejected; reauthentication is actionable.

**Full functional verification:** Connect a sandbox OAuth source, execute a tool, expire/refresh tokens, replay the callback, revoke externally, and retry from a second workspace.

**Test method:** HTTP callback integration tests with malicious states plus real provider sandbox flows; inspect redacted logs and persisted envelopes.

### [INT-004.2] Verify secret lifecycle, references and export boundaries

**Priority / targets:** P0 · A/B/C. **Source:** [packages/server-core/src/webui/auth.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/auth.ts#L1).

**Requirements:** Test envelope recovery, account disconnect, source deletion, backup restore, settings secretRef roundtrip and imported browser/account grants.

**DoD:** Secret values stay out of renderer payloads, shared transcripts, support bundles and registry metadata; revocation applies to cached sessions.

**Full functional verification:** Save a credential, use it through an approved tool, export/share/support-bundle the session, disconnect and retry after application restart.

**Test method:** Canary-secret leakage assertions across RPC/events/files plus credential recovery and grant-expiry tests.

## [INT-005] Make files and artifacts portable across desktop and hosted execution

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: local picker paths, server-owned paths and browser File objects are different resources. Names alone are insufficient for a hosted attachment. Source: [packages/server-core/src/handlers/rpc/files.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/files.ts#L1).

**Requirements:** Files selected by a user arrive intact at the authorized runtime, render correctly and can be retrieved without arbitrary-path access. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Attach PNG/PDF/DOCX/CSV from each target, ask an agent to create derived artifacts, reopen them, download and compare checksums. Then Rename a project, branch a session, move a note, share a generated document, revoke it and attempt its URL from another account.

**Test method:** File RPC integration plus browser multipart/stream tests, disk-full/oversize faults and hash comparisons. Resource authorization and link-resolution tests with encoded traversal, symlink escapes and expired grants.

### [INT-005.1] Integrate upload, attach, generate, download and reveal semantics

**Priority / targets:** P0 · A/B/C. **Source:** [packages/server-core/src/handlers/rpc/files.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/files.ts#L1).

**Requirements:** Define browser upload/download versus desktop path/reveal; preserve MIME, size, checksum, workspace ownership and Unicode names; enforce size/type limits.

**DoD:** A file is never marked attached before bytes are persisted; retry is idempotent; rejected uploads clean temporary objects.

**Full functional verification:** Attach PNG/PDF/DOCX/CSV from each target, ask an agent to create derived artifacts, reopen them, download and compare checksums.

**Test method:** File RPC integration plus browser multipart/stream tests, disk-full/oversize faults and hash comparisons.

### [INT-005.2] Verify artifact links through moves, branches and sharing

**Priority / targets:** P0 · A/B/C. **Source:** [packages/server-core/src/handlers/rpc/files.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/files.ts#L1).

**Requirements:** Use stable owned resource references; prohibit cross-workspace reads, traversal and secret-file leakage; keep downloads authorized after reconnect.

**DoD:** Internal references survive rename/restart/branch and expired public links fail safely.

**Full functional verification:** Rename a project, branch a session, move a note, share a generated document, revoke it and attempt its URL from another account.

**Test method:** Resource authorization and link-resolution tests with encoded traversal, symlink escapes and expired grants.

## [INT-006] Integrate tasks, projects, agent teams and workgraph state

**Priority / targets:** P1 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: task UI, scheduler, agents and persistent workgraph must agree on status, dependencies, ownership and completion evidence. Source: [packages/server-core/src/tasks/personal-tasks-service.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/tasks/personal-tasks-service.ts#L1).

**Requirements:** Task completion records real outputs; dependency and cancellation behavior is stable after restarts and simultaneous clients. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Create a project and three dependent agent tasks, fail the middle task, retry it, reopen the app and inspect all links and resulting files. Then Edit a due task from web and desktop, cancel an executing child, restart the host and verify exactly one durable terminal state.

**Test method:** Service integration tests plus cross-client E2E through task UI and real agent sandbox execution. Race/lease tests, event deduplication assertions and process-crash replay integration.

### [INT-006.1] Exercise dependency execution and accountable completion

**Priority / targets:** P1 · A/B/C. **Source:** [packages/server-core/src/tasks/personal-tasks-service.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/tasks/personal-tasks-service.ts#L1).

**Requirements:** Create parent/child tasks with prerequisites, assignees, project links, due dates and required outputs; handle failed prerequisites and retries.

**DoD:** No dependent task executes before satisfied prerequisites; completed tasks have verifiable artifacts and failures remain visible.

**Full functional verification:** Create a project and three dependent agent tasks, fail the middle task, retry it, reopen the app and inspect all links and resulting files.

**Test method:** Service integration tests plus cross-client E2E through task UI and real agent sandbox execution.

### [INT-006.2] Verify concurrency, cancellation and team event propagation

**Priority / targets:** P1 · A/B/C. **Source:** [packages/server-core/src/tasks/personal-tasks-service.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/tasks/personal-tasks-service.ts#L1).

**Requirements:** Test simultaneous edits, task deletion during a run, agent-team handoffs, maximum concurrency and client reconnect.

**DoD:** No duplicate execution or stale overwrite; permissions and assigned workspace remain correct across handoffs.

**Full functional verification:** Edit a due task from web and desktop, cancel an executing child, restart the host and verify exactly one durable terminal state.

**Test method:** Race/lease tests, event deduplication assertions and process-crash replay integration.

## [INT-007] Integrate sources, MCP tools and permission policy

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: source discovery, OAuth/API/local credentials, MCP pool, provider host tools and UI connection status span several layers. Source: [packages/shared/src/sources/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/index.ts#L1).

**Requirements:** A connected source executes a permitted real tool; disconnected or denied sources cannot retain hidden authority. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Create one source of each shipped type, invoke it in two providers, change configuration, break authentication and reconnect while chat remains responsive. Then Attempt read, write and destructive test operations from parent and child sessions under each mode and inspect a sandbox filesystem.

**Test method:** Source-pool integration tests with controlled MCP fixtures plus live sandbox source smoke. Policy matrix tests with side-effect canaries and approval timeout/race scenarios across backends.

### [INT-007.1] Verify source create/test/use/update/disconnect

**Priority / targets:** P0 · A/B/C. **Source:** [packages/shared/src/sources/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/index.ts#L1).

**Requirements:** Cover stdio and HTTP MCP, REST and local filesystem; handle missing executable, malformed schema, slow startup, auth refresh and unavailable network.

**DoD:** Tool list and health reflect actual runtime, update without stale schemas and recover without application-wide failure.

**Full functional verification:** Create one source of each shipped type, invoke it in two providers, change configuration, break authentication and reconnect while chat remains responsive.

**Test method:** Source-pool integration tests with controlled MCP fixtures plus live sandbox source smoke.

### [INT-007.2] Verify approval and least-authority propagation

**Priority / targets:** P0 · A/B/C. **Source:** [packages/shared/src/sources/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/index.ts#L1).

**Requirements:** Ensure Explore/Ask/Auto contracts apply to MCP proxies, host bash, browser tools, spawned sessions and privileged broker operations.

**DoD:** Denied/expired approvals execute zero side effects; child sessions cannot enlarge inherited authority silently.

**Full functional verification:** Attempt read, write and destructive test operations from parent and child sessions under each mode and inspect a sandbox filesystem.

**Test method:** Policy matrix tests with side-effect canaries and approval timeout/race scenarios across backends.

## [INT-008] Integrate knowledge, notes, memory and search retrieval

**Priority / targets:** P1 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: import/index/search/retrieval/publish and memory promotion must connect to real persisted data and provider context. Source: [packages/server-core/src/handlers/rpc/knowledge.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/knowledge.ts#L1).

**Requirements:** Search/retrieval use only authorized sources; edits/deletions invalidate stale entries; generated answers expose usable provenance. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Import a fixture corpus, retrieve an exact answer with source reference, edit/delete the relevant note, reindex and verify changed results. Then Promote conflicting facts from two sessions, inspect resolution, change user/workspace, restart and verify only accepted memory affects the next answer.

**Test method:** End-to-end corpus relevance/ACL tests with stable expected source IDs and index restart/corruption recovery. Memory service integration tests plus conflict/replay/tombstone fixtures and canary tenant data.

### [INT-008.1] Verify import, indexing, retrieval and deletion

**Priority / targets:** P1 · A/B/C. **Source:** [packages/server-core/src/handlers/rpc/knowledge.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/knowledge.ts#L1).

**Requirements:** Import local documents and supported external source material; test keyword/vector retrieval, duplicate imports, incremental updates and unavailable embedding models.

**DoD:** Counts and provenance match persisted inputs; deleted or revoked documents are not retrieved; degraded lexical search is explicit.

**Full functional verification:** Import a fixture corpus, retrieve an exact answer with source reference, edit/delete the relevant note, reindex and verify changed results.

**Test method:** End-to-end corpus relevance/ACL tests with stable expected source IDs and index restart/corruption recovery.

### [INT-008.2] Verify memory conflicts, promotion and account replica consistency

**Priority / targets:** P1 · A/B/C. **Source:** [packages/server-core/src/handlers/rpc/knowledge.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/knowledge.ts#L1).

**Requirements:** Review automatic/user memory writes, conflicts, TTL/retention, manual promotion, export and synchronized account/workspace state.

**DoD:** Memory operations are attributable, reversible and scoped; replica conflicts cannot expose another workspace or silently overwrite canonical content.

**Full functional verification:** Promote conflicting facts from two sessions, inspect resolution, change user/workspace, restart and verify only accepted memory affects the next answer.

**Test method:** Memory service integration tests plus conflict/replay/tombstone fixtures and canary tenant data.

## [INT-009] Integrate automation editor, scheduler and durable execution

**Priority / targets:** P1 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: graph/config editors and schedule runtime need a real create-to-run journey, beyond editor action unit tests. Source: [packages/server-core/src/handlers/rpc/automations-editor.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/automations-editor.test.ts#L1).

**Requirements:** Saved automation executes the intended permitted actions once, with durable history, retries and observable failures. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Save an automation from the UI, advance controlled time through DST, restart/sleep the host and inspect run history and generated artifact. Then Force a partial network failure after a test action succeeds, retry, revoke its source and confirm exactly one external artifact.

**Test method:** Scheduler fake-clock tests combined with service/renderer E2E and one real-time scheduled sandbox run. Fault injection at commit/ack boundaries with idempotency assertions and approval audit inspection.

### [INT-009.1] Execute edited automations including timezone changes

**Priority / targets:** P1 · A/B/C. **Source:** [packages/server-core/src/handlers/rpc/automations-editor.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/automations-editor.test.ts#L1).

**Requirements:** Create graph and schedule automations with conditions, inputs and credentials; validate invalid graphs, DST, sleep and missed triggers.

**DoD:** Saved configuration reloads identically; scheduled runs use workspace timezone and a documented missed-run policy.

**Full functional verification:** Save an automation from the UI, advance controlled time through DST, restart/sleep the host and inspect run history and generated artifact.

**Test method:** Scheduler fake-clock tests combined with service/renderer E2E and one real-time scheduled sandbox run.

### [INT-009.2] Verify retries, idempotency and credential revocation

**Priority / targets:** P1 · A/B/C. **Source:** [packages/server-core/src/handlers/rpc/automations-editor.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/automations-editor.test.ts#L1).

**Requirements:** Set limits on retry/backoff, fan-out and execution budget; record action IDs and approvals; revoked sources disable future work.

**DoD:** Retries do not duplicate external side effects; cancellation and disabled automation stop future scheduling.

**Full functional verification:** Force a partial network failure after a test action succeeds, retry, revoke its source and confirm exactly one external artifact.

**Test method:** Fault injection at commit/ack boundaries with idempotency assertions and approval audit inspection.

## [INT-010] Integrate rich documents, collections, canvas and generated artifacts

**Priority / targets:** P1 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: rich text state, note persistence, diagrams/canvas relationships and document tools must roundtrip without data loss. Source: [packages/ui/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/package.json#L1).

**Requirements:** Native and browser editing preserve structure, references and attachments; supported import/export formats open in their intended applications. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Compose a representative document, edit from a second client, disconnect, reconnect, export, reimport and compare blocks/links/attachments. Then Generate each supported format in the installed app, open it with an independent reader and inspect content/metadata; repeat on a hosted runner.

**Test method:** Semantic fixture roundtrip tests plus UI editing E2E, offline/conflict recovery and actual exported-file open checks. Existing test:doc-tools plus final-artifact subprocess tests and independent format validators; no developer PATH fallback.

### [INT-010.1] Verify editor persistence and document format fidelity

**Priority / targets:** P1 · A/B/C. **Source:** [packages/ui/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/package.json#L1).

**Requirements:** Cover nested blocks, tables, tasks, math, code, image/file embeds, diagram nodes, links and large notes; test save/reload and conflict resolution.

**DoD:** Semantic content survives app restart/export/import; malformed pasted content fails safely; autosave status is truthful.

**Full functional verification:** Compose a representative document, edit from a second client, disconnect, reconnect, export, reimport and compare blocks/links/attachments.

**Test method:** Semantic fixture roundtrip tests plus UI editing E2E, offline/conflict recovery and actual exported-file open checks.

### [INT-010.2] Verify bundled document script/tool prerequisites

**Priority / targets:** P1 · A/B/C. **Source:** [packages/ui/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/package.json#L1).

**Requirements:** Check PDF/DOCX/XLSX/PPTX/image/iCal/diff/MarkItDown tool commands with installed Python/tool dependencies or explicitly supported alternatives.

**DoD:** Clean end-user machine can invoke every advertised document tool; unsupported tools expose setup diagnostics before execution.

**Full functional verification:** Generate each supported format in the installed app, open it with an independent reader and inspect content/metadata; repeat on a hosted runner.

**Test method:** Existing test:doc-tools plus final-artifact subprocess tests and independent format validators; no developer PATH fallback.

## [INT-011] Integrate messaging channels with session ownership and delivery history

**Priority / targets:** P1 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: worker processes, channel accounts, workspace selection and agent event routing need real inbound and outbound integration. Source: [packages/messaging-gateway/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/package.json#L1).

**Requirements:** Messages are attributed to an authorized channel/user/workspace; duplicate reconnect deliveries do not trigger duplicate actions. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Send a sandbox channel message, produce an agent artifact, reply with an attachment, restart worker/host and resume without re-pairing where supported. Then Attempt the same message from an unapproved chat and two linked channels, inject retry/rate-limit faults and inspect execution/delivery counts.

**Test method:** Adapter fixture tests plus credentialed sandbox account E2E; verify actual remote delivery readback. Replay and cross-workspace attack tests plus worker crash/backoff integration; keep all test sends in dedicated sandboxes.

### [INT-011.1] Verify pairing and inbound/outbound channel roundtrip

**Priority / targets:** P1 · A/B/C. **Source:** [packages/messaging-gateway/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/package.json#L1).

**Requirements:** For each enabled Telegram/WhatsApp/Discord/Lark adapter, cover credential setup, permissions, pairing, text/media, disconnect, reconnect and restart.

**DoD:** Channel health matches real connectivity; pairing persists securely; inbound media is usable and outbound state records remote message IDs.

**Full functional verification:** Send a sandbox channel message, produce an agent artifact, reply with an attachment, restart worker/host and resume without re-pairing where supported.

**Test method:** Adapter fixture tests plus credentialed sandbox account E2E; verify actual remote delivery readback.

### [INT-011.2] Verify routing, denial, deduplication and rate limiting

**Priority / targets:** P1 · A/B/C. **Source:** [packages/messaging-gateway/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/package.json#L1).

**Requirements:** Bind external users/chats to workspace grants; reject unknown senders, duplicates and stale webhooks; apply API rate limits and retry rules.

**DoD:** An unauthorized sender cannot run tools or read history; delivery failure is visible without repeated destructive actions.

**Full functional verification:** Attempt the same message from an unapproved chat and two linked channels, inject retry/rate-limit faults and inspect execution/delivery counts.

**Test method:** Replay and cross-workspace attack tests plus worker crash/backoff integration; keep all test sends in dedicated sandboxes.

## [INT-012] Verify meetings from real capture to approved follow-up

**Priority / targets:** P1 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: meeting fixtures are useful but cannot prove microphone, upload, transcription, semantic extraction, sharing and tracker side effects in release artifacts. Source: [tests/e2e/meeting-agents/playwright.config.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/tests/e2e/meeting-agents/playwright.config.ts#L1).

**Requirements:** The complete meeting lifecycle works with real supported inputs, consent/retention rules and explicit approval for external actions. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Record a known multi-speaker sample on each target, import a second file, interrupt upload, finalize and compare transcript/summary to ground truth. Then Approve one generated sandbox tracker task, deny another, replay execute, revoke a shared room link and verify external readback and storage cleanup.

**Test method:** Fixture lifecycle E2E plus live capture/provider run; semantic eval thresholds and human review for unsupported claims. Approval/idempotency RPC tests, live tracker sandbox E2E and retention clock/ACL tests.

### [INT-012.1] Capture/import, transcribe, summarize and review

**Priority / targets:** P1 · A/B/C. **Source:** [tests/e2e/meeting-agents/playwright.config.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/tests/e2e/meeting-agents/playwright.config.ts#L1).

**Requirements:** Cover supported audio capture/import modes, device denial, long recordings, partial upload, transcription provider errors, speakers/timecodes and summary review.

**DoD:** Recording state is truthful; transcript aligns to audio; generated claims link to source segments; cancellation leaves recoverable state.

**Full functional verification:** Record a known multi-speaker sample on each target, import a second file, interrupt upload, finalize and compare transcript/summary to ground truth.

**Test method:** Fixture lifecycle E2E plus live capture/provider run; semantic eval thresholds and human review for unsupported claims.

### [INT-012.2] Approve and verify follow-up side effects

**Priority / targets:** P1 · A/B/C. **Source:** [tests/e2e/meeting-agents/playwright.config.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/tests/e2e/meeting-agents/playwright.config.ts#L1).

**Requirements:** Test tracker actions, room membership, share grants, retention expiry, budgets and duplicate finalize/execute requests.

**DoD:** No external task/email action runs before approval; replay cannot duplicate side effects; expired shares cannot retrieve recordings/transcripts.

**Full functional verification:** Approve one generated sandbox tracker task, deny another, replay execute, revoke a shared room link and verify external readback and storage cleanup.

**Test method:** Approval/idempotency RPC tests, live tracker sandbox E2E and retention clock/ACL tests.

## [INT-013] Integrate organizations, collaboration and shared resources

**Priority / targets:** P0 for multi-user hosting · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: invite UI and shared resources must use enforceable server grants and user identity rather than shared instance password assumptions. Source: [packages/server-core/src/collaboration/bro-invite-service.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/collaboration/bro-invite-service.ts#L1).

**Requirements:** Invites, roles and ownership are enforced across HTTP/RPC/events/storage/runner paths with revocation and no cross-account disclosure. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Invite two sandbox users, accept, downgrade/revoke one while a shared session is open, then retry edit/search/download/run operations. Then Edit a shared note simultaneously, run a task as viewer/editor, reconnect and inspect canonical content and execution audit.

**Test method:** Multi-client RBAC integration and permission-change event tests using unrelated identities. Concurrency/property tests with deterministic clocks plus live multi-client E2E.

### [INT-013.1] Verify invite acceptance and role transitions

**Priority / targets:** P0 for multi-user hosting · A/B/C. **Source:** [packages/server-core/src/collaboration/bro-invite-service.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/collaboration/bro-invite-service.ts#L1).

**Requirements:** Define organization/team membership, resource owner, editor/viewer permissions, expiry and role changes; connect grants to actual server handlers.

**DoD:** Invalid/expired invites are rejected; roles change live; ownership transfer preserves data and an audit trail.

**Full functional verification:** Invite two sandbox users, accept, downgrade/revoke one while a shared session is open, then retry edit/search/download/run operations.

**Test method:** Multi-client RBAC integration and permission-change event tests using unrelated identities.

### [INT-013.2] Verify collaboration conflict and shared run attribution

**Priority / targets:** P0 for multi-user hosting · A/B/C. **Source:** [packages/server-core/src/collaboration/bro-invite-service.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/collaboration/bro-invite-service.ts#L1).

**Requirements:** Resolve concurrent edits and agent execution ownership; expose who changed what and what source/credential grant was used.

**DoD:** No lost update or ambiguous billing/secret authority; shared activity is attributable and scoped.

**Full functional verification:** Edit a shared note simultaneously, run a task as viewer/editor, reconnect and inspect canonical content and execution audit.

**Test method:** Concurrency/property tests with deterministic clocks plus live multi-client E2E.

## [INT-014] Integrate Cloud Runs from the product UI to real execution and artifacts

**Priority / targets:** P0 when Cloud Runs is advertised · A/B/C. **Dependencies:** UI Cloud Runs, SVC provider/state/gate tasks, hosted ownership and staged runtime resources. **Evidence:** the active registry selects Daytona/local/native [public-registry.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/public-registry.ts#L8); existing [provider conformance](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/conformance.ts#L20-L114) checks handles, terminal states, artifacts, traversal and cancellation. Local defaults and reference stubs require explicit separation from real execution.

**Requirements:** Bind UI run selection and input resources to the actual provider, permissions and durable workspace context. Enforce provisioning/cost gates at every entrypoint. Preserve ordered events, truthful process exit/error state, artifact ownership and recoverable cancellation/reconnect.

**DoD:** Each advertised provider executes a real verifiable workload through the UI, produces byte-exact authorized artifacts, settles the correct terminal state, and passes conformance plus lifecycle integration. Stub runs remain labeled simulation and cannot satisfy a real execution DoD.

**Full functional verification:** Start a controlled file-producing run from desktop and browser, confirm selected backend and remote/local process, disconnect/restart, reconnect, download output and compare its hash. Repeat with a nonzero process exit, cancellation, expired grant and exhausted budget.

**Test method:** Extend/map the existing conformance suite, exercise UI→RPC→provider→event/artifact storage E2E, and read back an actual sandbox artifact for each required provider. Paid provisioning requires an explicitly configured test budget and authorization; otherwise record not-run.

### [INT-014.1] Verify real runner state, artifact fidelity and cancellation

**Priority / targets:** P0 when Cloud Runs is advertised · A/B/C. **Source:** [provider conformance](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/conformance.ts#L20-L114).

**Requirements:** Exercise selected provider start/status/events/artifact/cancel contracts, duplicate start IDs, unknown IDs, slow output and process exits. Trace the displayed terminal state to actual execution rather than a reference runner.

**DoD:** Successful runs have expected files and exit status; failed exits are failed, cancellation halts work, and duplicate retries do not create extra runs or chargeable environments.

**Full functional verification:** Generate a known binary and text artifact, stream progress, reconnect, verify downloads, run a command that exits nonzero, then cancel an active long run and inspect the actual process/sandbox state.

**Test method:** Existing conformance plus a real workload harness and UI E2E; compare checksums, ordered event IDs, provider process status and persisted run terminal state.

### [INT-014.2] Verify grants, budgets, provisioning gates and durable recovery

**Priority / targets:** P0 when Cloud Runs is advertised · A/B/C. **Source:** [Cloud Runs RPC](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/cloud-runs.ts#L254-L267).

**Requirements:** Check owner/workspace grants for run start, status, event subscription and artifact download. Apply budget/paid-provisioning policy to every direct and indirect run creation route; persist recoverable handles and secrets separately.

**DoD:** Denied/exhausted requests provision zero environments; another workspace cannot observe/control a run; host restart recovers one authoritative run with its logs and outputs or a truthful orphan error.

**Full functional verification:** Attempt a run through every entrypoint with provisioning disabled, enable an authorized sandbox budget, start one run, restart the host and request its logs/artifacts from an unauthorized client and its owner.

**Test method:** Entry-point enforcement regression tests, cross-workspace canaries, budget/race assertions, and restart E2E with provider inventory readback.

## [INT-015] Integrate voice capture, transcription, history and approved actions

**Priority / targets:** P1 when voice is advertised · A/B/C. **Dependencies:** voice/media platform tasks, provider auth, file upload, history persistence and action permissions. **Evidence:** [voice runtime](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/voice/runtime.ts#L1) and [history store](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/voice/history-store.ts#L1) implement separate concerns that need a complete user journey.

**Requirements:** Capture from a supported input, upload ordered audio chunks, transcribe with an authorized provider, expose editable transcript/history/export and apply any derived action only under the chosen permission contract. Handle microphone denial, interruption, lost chunks, language selection and server versus client media ownership.

**DoD:** A real recording yields an accurate attributable transcript, playable retained audio according to policy and usable persisted history. Errors/cancellation leave no phantom completed recording; external/agent side effects follow explicit approval where required.

**Full functional verification:** Record a known multilingual sample on each target, interrupt the connection, recover or cancel, review/edit/export transcript, restart and reopen history, then approve one derived sandbox action and deny another.

**Test method:** Audio fixtures for chunk ordering/provider responses, real target microphone capture and provider sandbox transcription, history readback/export validation and approval side-effect canaries.

### [INT-015.1] Verify capture-to-transcript and media error recovery

**Priority / targets:** P1 when voice is advertised · A/B/C. **Source:** [voice runtime](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/voice/runtime.ts#L1).

**Requirements:** Test device switching, permission denial, muted/silent input, chunk ordering, reconnect, long recordings, provider timeout and language hints in desktop and browser HTTPS contexts.

**DoD:** UI capture state matches microphone/provider state; no duplicate/lost chunks in successful recovery; unsupported recovery stops with an actionable error and retains only permitted data.

**Full functional verification:** Record speech with known timestamps/language, deny and later grant microphone permission, disconnect halfway, resume/retry transcription and compare text/audio alignment.

**Test method:** Controlled media fixtures and chunk fault injection plus real microphone/provider E2E; inspect server audio hashes/timestamps and transcript provenance.

### [INT-015.2] Verify durable history, export, retention and action gating

**Priority / targets:** P1 when voice is advertised · A/B/C. **Source:** [voice history store](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/voice/history-store.ts#L1).

**Requirements:** Persist transcript edits and recording references with workspace ownership; verify export, retention/deletion and whether dictated instructions require confirmation before agent/tool execution.

**DoD:** History survives restart and resolves its owned media; export faithfully represents edits; deleted/revoked media is inaccessible; denied actions execute no side effects.

**Full functional verification:** Edit/export a transcript, restart, switch workspace, attempt unauthorized audio retrieval, approve/deny two sandbox actions and expire/delete the recording.

**Test method:** History/ACL/retention integration tests, independent exported-file validation and actual action readback with approval canaries.

## [QA-001] Replace placeholder CI and reconcile executable validation commands

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Observed gap: server lifecycle job echoes that its smoke is not implemented. Several root scripts point to absent OSS paths, and Bun versions vary across runners. Source: [.github/workflows/validate-server.yml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/.github/workflows/validate-server.yml#L1).

**Requirements:** Every required job runs a substantive check on the exact release source; missing prerequisites or skipped release-critical tests fail explicitly. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Inspect CI logs/artifacts showing a real bound port, authenticated request, emitted events, saved session and process cleanup. Then Run the required matrix on fork branch and read back result/check artifacts, including unavailable runner status as a failure to deliver evidence.

**Test method:** Wire packages/server smoke and transport/auth integration suites into validate-server; force a regression to prove job failure. Command-existence audit, frozen install and package typecheck/build matrix; remove placeholder skip semantics.

### [QA-001.1] Replace lifecycle echo with isolated server behavior checks

**Priority / targets:** P0 · A/B/C. **Source:** [.github/workflows/validate-server.yml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/.github/workflows/validate-server.yml#L1).

**Requirements:** Start a fresh server, authenticate, list/create workspaces and sessions, stream a fixture agent/tool turn, reconnect and shut down cleanly.

**DoD:** CI verifies real HTTP/WS behavior and persistent state; expected failures are asserted; no success-only echo or silent skip.

**Full functional verification:** Inspect CI logs/artifacts showing a real bound port, authenticated request, emitted events, saved session and process cleanup.

**Test method:** Wire packages/server smoke and transport/auth integration suites into validate-server; force a regression to prove job failure.

### [QA-001.2] Pin toolchain and complete the required job matrix

**Priority / targets:** P0 · A/B/C. **Source:** [.github/workflows/validate-server.yml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/.github/workflows/validate-server.yml#L1).

**Requirements:** Unify Bun/Node/Electron/builder versions or document intentional differences; frozen lock install; include web/viewer/CLI/workers/cloud/native where shipped.

**DoD:** Clean clone CI resolves identical inputs; all supported package commands exist; Windows/macOS/hosted jobs have provisioned runners.

**Full functional verification:** Run the required matrix on fork branch and read back result/check artifacts, including unavailable runner status as a failure to deliver evidence.

**Test method:** Command-existence audit, frozen install and package typecheck/build matrix; remove placeholder skip semantics.

## [QA-002] Guarantee tests cannot mutate live user profiles or infrastructure

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Observed design: config root is snapshotted at import time and both aliases must be controlled. Tests and subprocesses must not inherit live runtime state. Source: [scripts/test-config-isolation.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/test-config-isolation.ts#L1).

**Requirements:** All automated tests operate on disposable owned roots and sandbox credentials; cleanup targets only artifacts created by the test. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Seed sentinel files in external profiles, execute root and per-package tests plus child-process cases, compare sentinels and owned writes. Then Interrupt a test run during active subprocess/tool work, rerun it and verify clean ports/config roots and readable diagnostics.

**Test method:** Run config-isolation suite and filesystem/network canary harness; assert preload parity and explicit external-service gating. Lifecycle teardown tests, process group checks and cleanup fault injection; restrict deletion to generated temp roots.

### [QA-002.1] Apply isolation to every test launch and subprocess

**Priority / targets:** P0 · A/B/C. **Source:** [scripts/test-config-isolation.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/test-config-isolation.ts#L1).

**Requirements:** Set ROX_CONFIG_DIR and CRAFT_CONFIG_DIR before module loading; isolate OMP/Pi/worker sessions, OAuth listeners and port allocation as needed.

**DoD:** Developer live profile remains byte-for-byte unchanged; no test pairs a production channel or starts a paid runner implicitly.

**Full functional verification:** Seed sentinel files in external profiles, execute root and per-package tests plus child-process cases, compare sentinels and owned writes.

**Test method:** Run config-isolation suite and filesystem/network canary harness; assert preload parity and explicit external-service gating.

### [QA-002.2] Make cleanup reliable under failure and cancellation

**Priority / targets:** P0 · A/B/C. **Source:** [scripts/test-config-isolation.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/test-config-isolation.ts#L1).

**Requirements:** Register teardown for temporary dirs, sockets, spawned processes, browsers and workers; retain only deliberate diagnostic artifacts.

**DoD:** Failed tests leave no orphan process, active timer, bound port or usable secret; preserved evidence is redacted.

**Full functional verification:** Interrupt a test run during active subprocess/tool work, rerun it and verify clean ports/config roots and readable diagnostics.

**Test method:** Lifecycle teardown tests, process group checks and cleanup fault injection; restrict deletion to generated temp roots.

## [QA-003] Build an end-user E2E matrix across all required targets

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: a meeting-only fixture suite does not cover the whole product or installed desktop/native/browser differences. Source: [tests/e2e/meeting-agents/lifecycle.spec.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/tests/e2e/meeting-agents/lifecycle.spec.ts#L1).

**Requirements:** Every release-critical UI/SVC capability has a passing complete user journey on the final supported target matrix. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Start a fresh profile on each OS/browser, perform journeys through UI, restart and verify resulting work from a second client/independent file reader. Then Run each key journey with injected faults, standard OS accounts, supported resolutions, keyboard input and reduced motion.

**Test method:** Electron Playwright plus browser Playwright, native OS automation where required, with trace/video and server artifact capture. Parameterized E2E matrix with controlled fault server; manual native permission/installer verification where automation cannot assert OS state.

### [QA-003.1] Implement core product journeys using real UI controls

**Priority / targets:** P0 · A/B/C. **Source:** [tests/e2e/meeting-agents/lifecycle.spec.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/tests/e2e/meeting-agents/lifecycle.spec.ts#L1).

**Requirements:** Cover onboarding, provider setup, chat/tool approval, attachments, projects/tasks, notes/search, sources/skills, automations, settings, sharing and recovery.

**DoD:** Tests assert server/persisted outcomes and downloaded artifacts, not only button visibility or a success toast.

**Full functional verification:** Start a fresh profile on each OS/browser, perform journeys through UI, restart and verify resulting work from a second client/independent file reader.

**Test method:** Electron Playwright plus browser Playwright, native OS automation where required, with trace/video and server artifact capture.

### [QA-003.2] Exercise alternate states and supported platform variants

**Priority / targets:** P0 · A/B/C. **Source:** [tests/e2e/meeting-agents/lifecycle.spec.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/tests/e2e/meeting-agents/lifecycle.spec.ts#L1).

**Requirements:** Cover first run, empty/loading/error, disconnected network, expired auth, unavailable capability, restricted user, Unicode paths and high DPI.

**DoD:** No dead-end dialogs, silent no-ops or irreversible data loss; every failure offers a functional recovery path.

**Full functional verification:** Run each key journey with injected faults, standard OS accounts, supported resolutions, keyboard input and reduced motion.

**Test method:** Parameterized E2E matrix with controlled fault server; manual native permission/installer verification where automation cannot assert OS state.

## [QA-004] Verify accessibility, localization and visual consistency as functional requirements

**Priority / targets:** P1 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: translated keys and visual snapshots alone do not establish usable keyboard, screen-reader, zoom and layout behavior. Source: [packages/shared/src/i18n/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/i18n/index.ts#L1).

**Requirements:** All core journeys are usable without a pointer, translated without exposed keys and readable at supported scaling. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Complete onboarding, chat approval, note edit, source setup and settings using keyboard and native screen readers on Windows/macOS plus browser tools. Then Switch among all locales while tasks/meetings/settings are open; test Russian/Polish plurals, CJK inputs and 200% browser/OS scaling.

**Test method:** Automated accessibility scans with manual Narrator/VoiceOver checks and focus assertions in E2E. Existing i18n checks plus localized route snapshots and functional E2E at two viewport/scaling configurations.

### [QA-004.1] Audit focus and assistive technology through complete flows

**Priority / targets:** P1 · A/B/C. **Source:** [packages/shared/src/i18n/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/i18n/index.ts#L1).

**Requirements:** Check roles/names, tab order, dialog focus trap/return, live regions, shortcut conflicts, contrast and reduced motion.

**DoD:** Keyboard-only completion works; critical status/permission changes are announced; no focus is lost behind native overlays.

**Full functional verification:** Complete onboarding, chat approval, note edit, source setup and settings using keyboard and native screen readers on Windows/macOS plus browser tools.

**Test method:** Automated accessibility scans with manual Narrator/VoiceOver checks and focus assertions in E2E.

### [QA-004.2] Verify all registered locales and expanded text layouts

**Priority / targets:** P1 · A/B/C. **Source:** [packages/shared/src/i18n/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/i18n/index.ts#L1).

**Requirements:** Derive coverage from the [locale registry](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/i18n/registry.ts#L51-L76), which registers 12 locales including Korean and Arabic. Use parity/sorted/coverage checks; test plurals, dates, timezones, numeric formats, long strings, RTL direction and document/user content boundaries. Reconcile the older ten-locale statement in AGENTS.md with the actual registry.

**DoD:** All supported locales render complete user-facing copy, valid plural forms and non-clipped actions; language switching persists.

**Full functional verification:** Switch among all 12 registered locales while tasks/meetings/settings are open; test Russian/Polish plurals, Korean/CJK inputs, Arabic RTL focus/layout and 200% browser/OS scaling.

**Test method:** Existing i18n checks plus localized route snapshots and functional E2E at two viewport/scaling configurations.

## [QA-005] Measure performance and resource consumption using release artifacts

**Priority / targets:** P1 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: source-level budgets must be correlated with actual installed Electron, hosted browser and server load. Source: [scripts/bench/renderer-perf-report.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/bench/renderer-perf-report.ts#L1).

**Requirements:** Adopt explicit budgets for cold start, first usable screen, interaction latency, stream throughput, memory, bundle size and index/run resource use. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Install release candidate, seed benchmark profile, record cold/warm starts and twenty-minute interactions while collecting CPU/RAM and frame/latency data. Then Run the agreed workload against staging, increase concurrency to failure, verify rejected requests and recover service after load stops.

**Test method:** Existing test:perf-budgets plus native tracing/browser performance profiles and repeatable percentile reports. Load harness with p95/p99, error rate, queue depth and cost metrics; validate fairness across distinct workspaces and, when shared tenancy is selected, distinct tenants.

### [QA-005.1] Benchmark realistic large profiles and long sessions

**Priority / targets:** P1 · A/B/C. **Source:** [scripts/bench/renderer-perf-report.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/bench/renderer-perf-report.ts#L1).

**Requirements:** Measure fresh and 500-session profiles, long streaming/tool output, large knowledge corpus, document/canvas rendering and repeated route navigation.

**DoD:** Chosen budgets pass on declared baseline hardware; no unbounded memory growth or blocked input; degraded mode is explicit.

**Full functional verification:** Install release candidate, seed benchmark profile, record cold/warm starts and twenty-minute interactions while collecting CPU/RAM and frame/latency data.

**Test method:** Existing test:perf-budgets plus native tracing/browser performance profiles and repeatable percentile reports.

### [QA-005.2] Load-test hosted RPC, upload, search and runners

**Priority / targets:** P1 · A/B/C. **Source:** [scripts/bench/renderer-perf-report.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/bench/renderer-perf-report.ts#L1).

**Requirements:** Define expected users/workspaces/concurrent runs; include slow clients, reconnect storms, oversized uploads and expensive indexing.

**DoD:** Quotas/backpressure isolate workloads and stay within declared cost/SLO; overload rejects work without dropping persisted results.

**Full functional verification:** Run the agreed workload against staging, increase concurrency to failure, verify rejected requests and recover service after load stops.

**Test method:** Load harness with p95/p99, error rate, queue depth and cost metrics; validate fairness across distinct workspaces and, when shared tenancy is selected, distinct tenants.

## [QA-006] Verify security boundaries with hostile content and hostile clients

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: agent output, imported documents, browser pages, external links and RPC payloads are untrusted inputs to privileged runtimes. Source: [packages/server-core/src/transport/peer-trust.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/peer-trust.ts#L1).

**Requirements:** A renderer/browser client cannot bypass grants, approval, filesystem ownership or secret boundaries through malformed content or direct API calls. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Open a controlled malicious fixture in chat/note/viewer/browser surfaces; attempt IPC and navigation abuse and inspect canary files and network endpoints. Then Use a low-privilege direct HTTP/WS client to request another workspace file, run, secret and event stream; revoke session during tool execution.

**Test method:** Electron security configuration assertions plus malicious-content E2E and manual boundary review against official Electron security guidance. API adversarial integration suite with per-tenant canaries, audit assertions and fuzzed protocol/resource inputs.

### [QA-006.1] Test renderer, document and IPC attack paths

**Priority / targets:** P0 · A/B/C. **Source:** [packages/server-core/src/transport/peer-trust.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/peer-trust.ts#L1).

**Requirements:** Cover HTML/Markdown/URL injection, external navigation, webview content, malicious attachments, preload API abuse and unsolicited permission requests.

**DoD:** Untrusted content does not execute privileged code or disclose credentials; browser/native launch rules enforce allowed schemes and origins.

**Full functional verification:** Open a controlled malicious fixture in chat/note/viewer/browser surfaces; attempt IPC and navigation abuse and inspect canary files and network endpoints.

**Test method:** Electron security configuration assertions plus malicious-content E2E and manual boundary review against official Electron security guidance.

### [QA-006.2] Test hosted auth, resource isolation and executable tools

**Priority / targets:** P0 · A/B/C. **Source:** [packages/server-core/src/transport/peer-trust.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/peer-trust.ts#L1).

**Requirements:** Cover WebSocket Origin/peer trust, CSRF-like upgrades, expired/replayed cookies, workspace ID swapping, traversal, symlink escapes and malicious tool definitions.

**DoD:** Every operation checks current identity/grant; denial occurs before any side effect; privileged execution cannot escape its allowed root.

**Full functional verification:** Use a low-privilege direct HTTP/WS client to request another workspace file, run, secret and event stream; revoke session during tool execution.

**Test method:** API adversarial integration suite with per-tenant canaries, audit assertions and fuzzed protocol/resource inputs.

## [QA-007] Verify backup, restoration and data integrity under failures

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: histories, note links, credentials, SQLite indexes, worker state and run artifacts need an integrated recovery contract. Source: [packages/shared/src/sessions/storage.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sessions/storage.ts#L1).

**Requirements:** Documented backups restore a usable product within agreed RPO/RTO; corruption or full disks do not silently discard user data. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Back up a seeded active workspace, restore under a different user/path or staging host, reopen every core artifact and resume a sandbox session. Then Kill the test host during save/run/index, fill its owned volume, damage selected fixture records and verify recovery messages and canonical data.

**Test method:** Backup manifest/checksum validation and automated restore E2E, plus manual secret-recovery confirmation without printing values. Filesystem fault harness and process-kill recovery tests; compare persisted state to acknowledged operation log.

### [QA-007.1] Create and restore complete profile/server backups

**Priority / targets:** P0 · A/B/C. **Source:** [packages/shared/src/sessions/storage.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sessions/storage.ts#L1).

**Requirements:** Include canonical workspace files, session sidecars, notes, configuration, credential envelopes and required encryption recovery material; regenerate derived indexes safely.

**DoD:** Restore on a second clean host yields matching semantic record counts/links and usable credentials under the documented policy.

**Full functional verification:** Back up a seeded active workspace, restore under a different user/path or staging host, reopen every core artifact and resume a sandbox session.

**Test method:** Backup manifest/checksum validation and automated restore E2E, plus manual secret-recovery confirmation without printing values.

### [QA-007.2] Inject abrupt shutdown, disk pressure and corrupt records

**Priority / targets:** P0 · A/B/C. **Source:** [packages/shared/src/sessions/storage.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sessions/storage.ts#L1).

**Requirements:** Cover mid-write crashes, locked files, partial JSONL, corrupt SQLite, failed migrations, disk-full and concurrent host ownership.

**DoD:** Atomic writes preserve a valid last state; corruption is quarantined/reported; restart does not create duplicate jobs or lose acknowledged edits.

**Full functional verification:** Kill the test host during save/run/index, fill its owned volume, damage selected fixture records and verify recovery messages and canonical data.

**Test method:** Filesystem fault harness and process-kill recovery tests; compare persisted state to acknowledged operation log.

## [QA-008] Verify installation, updates and uninstall preserve the product contract

**Priority / targets:** P0 · A/B; hosted deployment C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: successful packaging does not demonstrate installer behavior, signed update compatibility or retained application data. Source: [apps/electron/electron-builder.yml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L1).

**Requirements:** Users can install, update, recover from interruption and uninstall according to an explicit data retention policy without replacing ROX with another product. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Install each supported architecture artifact, perform core chat/file/source/knowledge journeys and inspect invoked executable paths and native loads. Then Seed previous-version workspace, update via staging feed, interrupt once, retry, inspect all content, uninstall/reinstall and verify retention policy.

**Test method:** Native VM/machine installation matrix and artifact content/ABI/signature inspection; retain install logs and screenshots. Signed staged N-1 to N upgrade E2E, checksum tamper tests, installer script assertions and post-reinstall semantic comparisons.

### [QA-008.1] Run clean-machine install and native runtime smoke

**Priority / targets:** P0 · A/B; hosted deployment C. **Source:** [apps/electron/electron-builder.yml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L1).

**Requirements:** Use standard users with no Bun/Node/OMP/Python/Git development environment; check signing, Gatekeeper/SmartScreen publisher identity and binary loading.

**DoD:** First run and required agent/document/native flows work from actual packaged resources; missing optional dependencies have clear diagnostics.

**Full functional verification:** Install each supported architecture artifact, perform core chat/file/source/knowledge journeys and inspect invoked executable paths and native loads.

**Test method:** Native VM/machine installation matrix and artifact content/ABI/signature inspection; retain install logs and screenshots.

### [QA-008.2] Verify update transition and explicit uninstall retention

**Priority / targets:** P0 · A/B; hosted deployment C. **Source:** [apps/electron/electron-builder.yml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L1).

**Requirements:** Test previous supported version to release candidate, interrupted download/apply, bad signature/hash, offline restart and retained user files.

**DoD:** Updater uses owned feed, rejects tampering, preserves data and recovers safely; uninstall deletes data only under an explicit chosen user action.

**Full functional verification:** Seed previous-version workspace, update via staging feed, interrupt once, retry, inspect all content, uninstall/reinstall and verify retention policy.

**Test method:** Signed staged N-1 to N upgrade E2E, checksum tamper tests, installer script assertions and post-reinstall semantic comparisons.

## [QA-009] Verify service operations, monitoring and failure recovery

**Priority / targets:** P1 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: optional workers/cloud/native/browser dependencies can fail independently of the host; health must reflect operational readiness. Source: [packages/server/src/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L1).

**Requirements:** Failures are observable, bounded and recoverable; readiness does not report healthy when a required execution path is unusable. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Break one dependency at a time, check readiness/UI diagnostics, download support bundle and correlate a failed user action to service logs. Then Terminate host during a stream, messaging reconnect and cloud run; restart, reconnect clients and inspect final state and worker count.

**Test method:** Health endpoint integration and canary-secret scans plus assertions on useful correlation/error metadata. Chaos/lifecycle tests with supervisor restart and persisted-state assertions; staged deployment drain/rollback rehearsal.

### [QA-009.1] Integrate health, metrics and redacted diagnostics

**Priority / targets:** P1 · A/B/C. **Source:** [packages/server/src/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L1).

**Requirements:** Expose startup/readiness, dependency health, run progress, queue depth, error rates and secret-free support bundles with correlation IDs.

**DoD:** Operators can identify the failing subsystem and affected workspace/run; no secrets or private content are logged by default.

**Full functional verification:** Break one dependency at a time, check readiness/UI diagnostics, download support bundle and correlate a failed user action to service logs.

**Test method:** Health endpoint integration and canary-secret scans plus assertions on useful correlation/error metadata.

### [QA-009.2] Verify graceful stop and supervised restart

**Priority / targets:** P1 · A/B/C. **Source:** [packages/server/src/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L1).

**Requirements:** Drain/flush sessions and queues, stop workers/listeners, recover orphaned runs and use an explicit service supervisor/deployment restart policy.

**DoD:** Restart yields one active owner per channel/queue; no stuck port, duplicate scheduled job or lost acknowledged result.

**Full functional verification:** Terminate host during a stream, messaging reconnect and cloud run; restart, reconnect clients and inspect final state and worker count.

**Test method:** Chaos/lifecycle tests with supervisor restart and persisted-state assertions; staged deployment drain/rollback rehearsal.

## [QA-010] Repair the observed TypeScript baseline and qualify every workspace independently

**Priority / targets:** P0 · A/B/C. **Dependencies:** canonical result/protocol contracts, meetings, voice, workspace handlers and renderer shared types. The audit deliberately records these failures without modifying application code.

**Observed evidence:** `bun run typecheck:all` exits 2 in its first package (`packages/core`) with 13 diagnostics. Twelve diagnostics affect tests (calendar narrowing and access to `verification` on legacy-or-canonical results); one production diagnostic is the comparison to an invalid verification value in [meeting-conation-shell.ts:24–33](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/rox2/meeting-conation-shell.ts#L24-L33). Independent downstream checks also fail; the exact command/package/diagnostic inventory is in [07-verification.md](07-verification.md).

**Requirements:** Correct actual type/contracts rather than hiding errors with broad casts, disabling strict checks or excluding failing production code/tests. Validate the configured source sets of every shipped workspace after correcting shared root causes. Keep a separate record of repeated imported diagnostics so counts are not mistaken for unique defects.

**DoD:** The complete required workspace typecheck matrix passes on the pinned release toolchain; every affected runtime behavior and test assertion is consistent with the corrected contract. `typecheck:all` completes its full chain, and web/viewer/CLI/workers/cloud packages omitted from that chain have explicit gates when shipped.

**Full functional verification:** Exercise canonical/legacy result normalization, queued meeting projections, live/readback proof, calendar task/event merging, voice upload/transcription and workspace/label/messaging actions. Verify that queued/unverified work cannot appear as successful or externally verified.

**Test method:** Run corrected contract tests and independent package typechecks, then `bun run typecheck:all` and the affected meeting/calendar/voice/handler E2E. Preserve exact versions and logs; a passing Vite bundle is not a substitute for type correctness.

### [QA-010.1] Reconcile canonical result states and discriminated test assertions

**Priority / targets:** P0 · A/B/C. **Source:** [meeting-conation-shell.ts:24–33](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/rox2/meeting-conation-shell.ts#L24-L33), [platform contract tests](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/rox2/__tests__/platform-contract.test.ts#L706), [calendar assertion](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/calendar/calendar.test.ts#L68-L71).

**Requirements:** Replace the impossible comparison to `verified` with a check consistent with the canonical verification enum and intended invariant; normalize or narrow legacy result unions before reading canonical fields. Replace the tautological already-narrowed calendar assertion with a behavioral check of merged event/task contents.

**DoD:** Core typecheck has zero diagnostics; tests still reject invalid live/success claims and demonstrate correct calendar merge behavior without suppressions.

**Full functional verification:** Produce fixture/queued/receipt/readback results through affected meeting actions, observe UI truth labels, and merge a mixed task/event dataset into Today/Upcoming without duplication or misclassification.

**Test method:** Core contract/calendar tests, adversarial result fixtures and a UI-to-RPC readback journey, followed by `bun x tsc --noEmit -p packages/core/tsconfig.json`.

### [QA-010.2] Fix downstream source contracts and include omitted workspace gates

**Priority / targets:** P0 · A/B/C. **Source:** [labels handler](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/labels.ts#L72), [messaging handler](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/messaging.ts#L142), [voice runtime](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/voice/runtime.ts#L177), [root typecheck scripts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/package.json#L32-L45).

**Requirements:** Resolve nullability/response-shape mismatches, meeting journal variants, voice runtime fetch/DOM assumptions, strict test narrowing and UI SDK/type drift identified in the independent package report. Distinguish missing workspace configuration from unsupported work; include all packages declared part of the final release.

**DoD:** Independently invoked checks and the complete root chain pass; no downstream check is skipped merely because an earlier package fails; production imports and target-specific runtime types agree.

**Full functional verification:** Create/update labels in a missing and valid workspace; save a messaging configuration; run manual/imported meetings; execute voice capture/transcription in desktop and web; reopen affected screens after restart.

**Test method:** Package-specific tsc matrix plus focused null/error-state tests and affected functional E2E. Deduplicate imported failures in triage and keep original logs as baseline evidence.

## [REL-001] Reconcile dependencies, executable supply chain and legal notices

**Priority / targets:** P1 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: native/SDK/alpha/transitive dependencies, generated scripts and bundled assets need reproducibility, license and vulnerability review before distribution. Source: [package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/package.json#L1).

**Requirements:** A release has a complete resolved dependency/binary inventory, compatible target artifacts and accurate notices; accepted risks have owners and expiry. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Inspect installed app/container bundles, compare their hashes/versions with lockfile and dependency inventory, and invoke each bundled executable. Then Build from clean checkout, tamper a downloaded fixture binary, observe rejection, and verify artifact digest/signature against provenance.

**Test method:** SBOM generation plus artifact diff, license scanner and advisory review against primary package advisories; record exact resolved versions. Download integrity and CI secret redaction assertions plus independently verified final artifact manifest.

### [REL-001.1] Produce SBOM and review actual shipped dependencies

**Priority / targets:** P1 · A/B/C. **Source:** [package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/package.json#L1).

**Requirements:** Inventory runtime/dev separation, licenses, native architecture/ABI, SDK protocol versions, alpha dependencies and unrestricted wildcard constraints.

**DoD:** SBOM matches packaged/server artifacts; no required runtime file is omitted and known release-blocking vulnerabilities are resolved or explicitly assessed.

**Full functional verification:** Inspect installed app/container bundles, compare their hashes/versions with lockfile and dependency inventory, and invoke each bundled executable.

**Test method:** SBOM generation plus artifact diff, license scanner and advisory review against primary package advisories; record exact resolved versions.

### [REL-001.2] Protect build inputs and release outputs

**Priority / targets:** P1 · A/B/C. **Source:** [package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/package.json#L1).

**Requirements:** Pin binary downloads/checksums, keep signing secrets server-side, verify submodule ownership/commit, separate staging publish from public release and generate artifact provenance.

**DoD:** A clean builder cannot substitute unverified executables; unsigned/incomplete artifacts are never promoted to release.

**Full functional verification:** Build from clean checkout, tamper a downloaded fixture binary, observe rejection, and verify artifact digest/signature against provenance.

**Test method:** Download integrity and CI secret redaction assertions plus independently verified final artifact manifest.

## [REL-002] Deliver user setup and operator runbooks for the supported product

**Priority / targets:** P1 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Observed inherited product documentation and external prerequisites need an owned ROX delivery guide consistent with actual capabilities and release artifacts. Source: [README.md](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/README.md#L1).

**Requirements:** A new user/operator can install, configure, use, recover and upgrade the product using verified ROX instructions and links. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** A reviewer follows the guide on a clean Windows/macOS machine and browser account without relying on developer knowledge. Then Deploy into a clean staging environment, exercise an agent/source/upload/meeting run, restore a backup and roll back a deliberately bad version.

**Test method:** Documentation walkthrough tied to install/core E2E evidence and automated link/command-existence checks. Infrastructure validation and runbook-driven deployment/restore rehearsal with artifact digest and endpoint readback.

### [REL-002.1] Write and verify first-run and feature setup documentation

**Priority / targets:** P1 · A/B/C. **Source:** [README.md](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/README.md#L1).

**Requirements:** Document provider/source auth, optional runtimes, permissions, platform limitations, data locations, backup and troubleshooting with owned distribution URLs.

**DoD:** Every command/link succeeds against the final release; screenshots/capability claims match the enabled UI.

**Full functional verification:** A reviewer follows the guide on a clean Windows/macOS machine and browser account without relying on developer knowledge.

**Test method:** Documentation walkthrough tied to install/core E2E evidence and automated link/command-existence checks.

### [REL-002.2] Write and rehearse hosted deployment/recovery runbooks

**Priority / targets:** P1 · A/B/C. **Source:** [README.md](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/README.md#L1).

**Requirements:** Specify DNS/TLS/WSS, auth model, secrets, volumes, migrations, workers, quotas, monitoring, backups, restore and rollback; name operational owners.

**DoD:** Runbook recreates staging from scratch and restores a backup; all required services and credentials have a documented source and renewal path.

**Full functional verification:** Deploy into a clean staging environment, exercise an agent/source/upload/meeting run, restore a backup and roll back a deliberately bad version.

**Test method:** Infrastructure validation and runbook-driven deployment/restore rehearsal with artifact digest and endpoint readback.

## [RECHECK-001] Reconcile every task with implemented code and acceptance evidence

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: registry status or an implementation PR cannot substitute for complete functional verification of the parent/subtask requirements. Source: [registry/rx-registry.yaml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/registry/rx-registry.yaml#L1).

**Requirements:** Each required task/subtask has evidence on the release candidate; unresolved blockers are explicit and no unsupported surface is advertised. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Select each task row and reproduce its listed journey against the candidate; compare recorded outputs to its DoD. Then Diff source to candidate commit, inspect changed handlers/adapters/packaging and run their mapped acceptance journeys.

**Test method:** Automated missing-evidence/status checks plus independent review of each release-critical flow and unresolved defect. Change-impact review with Git diff and task-to-code mapping; targeted integration reruns for changed contracts.

### [RECHECK-001.1] Build a requirements-to-evidence closure matrix

**Priority / targets:** P0 · A/B/C. **Source:** [registry/rx-registry.yaml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/registry/rx-registry.yaml#L1).

**Requirements:** Map UI/SVC/WIN/MAC/WEB/INT/QA/REL IDs to owner, implementation commit, target, test, artifact/log and residual issue.

**DoD:** Every required requirement is covered by verifiable evidence; conditional exclusions state the capability decision and user impact.

**Full functional verification:** Select each task row and reproduce its listed journey against the candidate; compare recorded outputs to its DoD.

**Test method:** Automated missing-evidence/status checks plus independent review of each release-critical flow and unresolved defect.

### [RECHECK-001.2] Reaudit changes after the pinned snapshot

**Priority / targets:** P0 · A/B/C. **Source:** [registry/rx-registry.yaml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/registry/rx-registry.yaml#L1).

**Requirements:** Review merged changes since f63294b; delete obsolete tasks, update code anchors and rerun affected dependencies/flows instead of retaining stale claims.

**DoD:** Backlog describes the final tree and preserves historical baseline; every changed contract has updated evidence.

**Full functional verification:** Diff source to candidate commit, inspect changed handlers/adapters/packaging and run their mapped acceptance journeys.

**Test method:** Change-impact review with Git diff and task-to-code mapping; targeted integration reruns for changed contracts.

## [RECHECK-002] Reverify the exact release candidate artifacts and hosted deployment

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: developer builds, unsigned previews and fixture servers cannot stand in for the downloadable app or hosted service. Source: [scripts/check-version.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/check-version.ts#L1).

**Requirements:** Final approval references one commit and immutable artifact/deployment digests with completed functional and platform evidence. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Download artifacts from staging exactly as users will, hash/install them and repeat critical user journeys and update checks. Then Use a fresh external browser/account to upload, run an agent/tool, create a note/task, share/revoke, reconnect and restore a staging backup.

**Test method:** Artifact manifest verification plus native clean-machine acceptance; compare build/install/runtime version readback. Credentialed staging acceptance and synthetic monitoring; read back real persistent and provider-side results.

### [RECHECK-002.1] Freeze and install the release artifact set

**Priority / targets:** P0 · A/B/C. **Source:** [scripts/check-version.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/check-version.ts#L1).

**Requirements:** Record version, commit, lock/toolchain versions, artifact names/digests, signature/notarization status and supported target matrix; build once and promote the same outputs.

**DoD:** Installed/tested artifacts match published candidate digests; version and update metadata agree and no stale bundle is mixed in.

**Full functional verification:** Download artifacts from staging exactly as users will, hash/install them and repeat critical user journeys and update checks.

**Test method:** Artifact manifest verification plus native clean-machine acceptance; compare build/install/runtime version readback.

### [RECHECK-002.2] Repeat hosted checks on deployed infrastructure

**Priority / targets:** P0 · A/B/C. **Source:** [scripts/check-version.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/check-version.ts#L1).

**Requirements:** Check public DNS/TLS, WS proxy/cookies, durable storage, callbacks, runner/worker resources and backup restoration on the actual deployment.

**DoD:** Hosted service passes core journeys and isolation/recovery requirements with operational owners and alerts active.

**Full functional verification:** Use a fresh external browser/account to upload, run an agent/tool, create a note/task, share/revoke, reconnect and restore a staging backup.

**Test method:** Credentialed staging acceptance and synthetic monitoring; read back real persistent and provider-side results.

## [RECHECK-003] Separate fixture evidence, live integrations and final regression signoff

**Priority / targets:** P0 · A/B/C. **Dependencies:** relevant surface and service tasks; platform capability/build fixes before installed acceptance.

**Evidence and scope:** Verification required: fixture flags, stub runs and skipped credentialed tests must remain visible when evaluating final readiness. Source: [tests/e2e/meeting-agents/live.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/tests/e2e/meeting-agents/live.ts#L1).

**Requirements:** Evidence states what actually executed; final regression includes supported live providers and no critical test is implicitly waived. Complete both subtasks below and retain versioned evidence for every required target.

**DoD:** All subtask acceptance conditions pass on the same candidate, with implementation commits, observed outputs and any conditional exclusions recorded.

**Full functional verification:** Review test logs/config, prove one real run per advertised integration, and independently read back artifacts or external task/message IDs. Then A reviewer uses only install/setup guides to complete representative work on Windows 10/11, macOS and hosted web, then verifies saved outputs after restart.

**Test method:** Fixture/stub audit plus live provider/channel/meeting/runner test checklist with explicit pass/fail/not-run status. Full acceptance matrix, defect retest and sampled exploratory testing; retain final evidence manifest and dated signoff.

### [RECHECK-003.1] Audit all fixture flags, stubs and credentialed gates

**Priority / targets:** P0 · A/B/C. **Source:** [tests/e2e/meeting-agents/live.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/tests/e2e/meeting-agents/live.ts#L1).

**Requirements:** Identify mocked agent responses, local stub runner, paid provisioning gates, meeting fixture mode and unavailable credentials/runners.

**DoD:** Report distinguishes deterministic fixtures from real external outcomes; unexecuted required integrations remain open.

**Full functional verification:** Review test logs/config, prove one real run per advertised integration, and independently read back artifacts or external task/message IDs.

**Test method:** Fixture/stub audit plus live provider/channel/meeting/runner test checklist with explicit pass/fail/not-run status.

### [RECHECK-003.2] Perform an independent final usability and regression sweep

**Priority / targets:** P0 · A/B/C. **Source:** [tests/e2e/meeting-agents/live.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/tests/e2e/meeting-agents/live.ts#L1).

**Requirements:** Repeat all core journeys and recovery paths on the exact target artifact/deployment after the last code change; prioritize earlier failures.

**DoD:** No unresolved P0/P1 release requirement; known conditional limitations are disclosed and match actual disabled capabilities.

**Full functional verification:** A reviewer uses only install/setup guides to complete representative work on Windows 10/11, macOS and hosted web, then verifies saved outputs after restart.

**Test method:** Full acceptance matrix, defect retest and sampled exploratory testing; retain final evidence manifest and dated signoff.
