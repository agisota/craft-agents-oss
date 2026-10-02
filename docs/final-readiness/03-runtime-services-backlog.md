# [SVC] Runtime, services and shared-module final-readiness backlog

**Audited source:** `rox-one/rox-one` main at `f63294ba4fffa7238b46b24e918925a313ad0b12`. **Targets:** A = Windows 10 and Windows 11; B = macOS; C = hosted web app. **Scope:** backend/server services, subprocess runtimes, cloud execution, integrations and shared storage/business modules. Screen-specific work and overall integration/release gates are documented in the companion backlog files.

This is a source audit and implementation backlog. “Observed” means visible in the pinned source. “Verification requirement” identifies a capability already present in code that still needs complete packaged/hosted functional evidence; it does not imply that every named behavior is currently broken. No paid cloud provisioning, live messaging, mail delivery or account integration was exercised during this document's source inspection. Existing tests are entry points for future acceptance, not proof of a final production build.

## [SVC-ARCH] Actual service topology

| Component | Process / deployment boundary | Responsibilities and dependencies | Source |
|---|---|---|---|
| Desktop/server shared core | Library running inside Electron main or Bun headless server | SessionManager, RPC handlers, tasks, memory, knowledge, pages, native/OpenClaw/workflow services. Depends on shared/core/session-tools/cloud-runner, `ws`, `jose`, `sharp`, Turso database and Transformers. | [packages/server-core/package.json:1–47](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/package.json#L1-L47) |
| Standalone headless server | Bun process; HTTP and WebSocket on a configured public/local origin | Loads runtime assets, WebUI, provider credentials, messaging bootstrap, OAuth callback and session manager. This is a deployable server, not a static frontend. | [packages/server/src/index.ts:119–170](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L119-L170); [packages/server/package.json:1–38](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/package.json#L1-L38) |
| WebUI auth/HTTP | Embedded Node adapter or standalone Bun HTTP handler | Static WebUI delivery, password login, signed cookie, health, OAuth completion. Current login is a single configured password and JWT subject `webui`. | [packages/server-core/src/webui/http-server.ts:2–10](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/http-server.ts#L2-L10); [packages/server-core/src/webui/auth.ts:47–67](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/auth.ts#L47-L67) |
| RPC and browser capabilities | WSS clients plus host/server callbacks | Handshake, registered channel access, streaming events, reconnect replay, invocation capabilities and trusted local renderer binding. | [packages/server-core/src/transport/server.ts:116–143](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/server.ts#L116-L143); [packages/server-core/src/transport/server.ts:250–292](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/server.ts#L250-L292) |
| Claude / Pi / OMP | Backend-specific SDK or subprocess under trusted execution host | Actual supported backend registry contains all three; provider/auth/runtime paths are resolved through drivers. OMP owns CLI auth and exposes host tools; Pi uses its out-of-process JSONL server. | [packages/shared/src/agent/backend/factory.ts:65–69](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/factory.ts#L65-L69); [packages/shared/src/agent/backend/factory.ts:135–148](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/factory.ts#L135-L148); [packages/pi-agent-server/package.json:11–28](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/package.json#L11-L28) |
| MCP/API/source integrations | Remote HTTP/SSE, local stdio child or in-process API proxy | Shared pool, tool schemas, source permissions, authentication and refresh. Local sources refer to execution-host folders, not the remote browser's filesystem. | [packages/shared/src/mcp/mcp-pool.ts:1–14](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mcp/mcp-pool.ts#L1-L14); [packages/shared/src/sources/server-builder.ts:33–38](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/server-builder.ts#L33-L38) |
| Messaging gateway | In-process registry/router with platform adapters | Telegram, Lark, WeChat run adapter code; WhatsApp and Discord have separate bundled Node worker processes. Polling/socket/event transports are outbound integrations, not five automatically independent hosted microservices. | [packages/messaging-gateway/src/bootstrap.ts:28–54](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/bootstrap.ts#L28-L54); [packages/server/src/index.ts:161–169](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L161-L169) |
| Cloud runner active registry | Daytona remote sandbox, local child or native sidecar | Public active providers are `daytona | local | native`. Local defaults to a reference stub. Daytona uses a thin HTTP control-plane client and expects `rox-run` inside the sandbox. | [packages/cloud-runner/src/public-registry.ts:2–21](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/public-registry.ts#L2-L21); [packages/cloud-runner/src/local-provider.ts:133–136](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/local-provider.ts#L133-L136); [packages/cloud-runner/src/daytona-provider.ts:332–340](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-provider.ts#L332-L340) |
| Cloudflare gateway legacy | Worker + RunAgent Durable Objects + container/workspace binding | Retained in source; retired from normal public registry. Uses shared bearer token v1 and has separate artifact/share routes. Default Wrangler configuration permits up to 100 container instances. | [apps/cloud-gateway/src/index.ts:11–37](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/src/index.ts#L11-L37); [apps/cloud-gateway/wrangler.jsonc:7–34](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/wrangler.jsonc#L7-L34) |
| Credentials/secrets | Trusted host store and materialization broker | Encrypted credentials, master key via macOS/Linux keychain or file fallback, managed grants/importers, optional Infisical and spawn-time secret resolution. | [packages/shared/src/credentials/backends/secure-storage.ts:124–184](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/credentials/backends/secure-storage.ts#L124-L184); [packages/shared/src/secrets/runtime.ts:4–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/secrets/runtime.ts#L4-L49) |
| SiYuan/OEM knowledge | Optional external provider or supervised local/server kernel | Connection bridge, mutation proposals, publications, vault watch/import, pinned kernel gate. Managed spawn blocks unless accepted G2 variant C and binary evidence exist. | [packages/server-core/src/knowledge/process-manager.ts:89–114](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/process-manager.ts#L89-L114); [packages/server-core/src/knowledge/publication-service.ts:2–7](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/publication-service.ts#L2-L7) |
| Mail | External Stalwart/JMAP infrastructure and future hosted signup worker | Local pilot provisioning creates owner-marked mailbox and device app password; signup hook is described as later. DNS/SMTP/mail delivery infrastructure is outside the client package. | [packages/shared/src/mail/provisioning.ts:2–18](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mail/provisioning.ts#L2-L18) |
| Replica/team/collaboration | Shared local engines requiring hosted authority/transport | Replica engine is in memory. Team sync is explicitly local-only with no remote team API. Public publication helper is gated off. | [packages/shared/src/account-replica/replica.ts:56–66](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/account-replica/replica.ts#L56-L66); [packages/shared/src/team/sync.ts:4–58](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/team/sync.ts#L4-L58); [packages/shared/src/collaboration/publication.ts:1–8](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/collaboration/publication.ts#L1-L8) |
| Default “microservices” | Folder-source configuration, not independent daemons | Notes, memory, sessions, tasks, projects, workspace tree, applications and Telegram-support directories; applications/Telegram paths are macOS-specific and folder pointers are marked connected in seed config. | [packages/shared/src/sources/default-microservices.ts:2–6](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/default-microservices.ts#L2-L6); [packages/shared/src/sources/default-microservices.ts:76–96](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/default-microservices.ts#L76-L96); [packages/shared/src/sources/default-microservices.ts:117–126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/default-microservices.ts#L117-L126) |

A hosted deployment needs persistent workspace/config/session/credential/queue stores, an actual authenticated server, runtime assets, per-tenant execution ownership and optional external integrations. A static web bundle cannot supply local filesystem access, Node workers, OS keychains, OMP/Pi children or the knowledge kernel. These capabilities execute on the server or an authenticated desktop companion.

## [SVC-PRIORITY] Confirmed gaps with highest release impact

1. Hosted WebUI has shared-password identity, not account-specific authentication ([SVC-002]).
2. Daytona `exec()` return value is ignored before `state='done'` ([SVC-012]).
3. Paid Daytona gate helper is disabled but normal live RPC factory constructs the provider separately; enforce and prove all-path gating ([SVC-013]).
4. Local runner defaults to test/reference stub output ([SVC-014]).
5. Replica persistence/transport and organization/team remote transport are not complete ([SVC-027], [SVC-028]).
6. Windows secure-storage new master key lacks OS-keychain branch; OpenClaw audit refuses Windows child spawning pending ownership ([SVC-009], [SVC-037]).
7. Desktop Electron memory full-text search explicitly falls back because `bun:sqlite` is unavailable ([SVC-025]).
8. Managed knowledge, public publication and paid sandbox release gates remain intentionally closed in their respective modules; final product claims must match enforced capability ([SVC-013], [SVC-024], [SVC-029]).
9. ROX-only token alias WebUI startup and standalone MCP credential-aware tool behavior need regression proof ([SVC-001], [SVC-008]).

## [SVC-BACKLOG] Tasks and subtasks

Dependencies: complete identity/tenant isolation ([SVC-002]) before multi-user services ([SVC-027]–[SVC-029]); complete credential/source/permission boundaries ([SVC-007]–[SVC-011], [SVC-035]) before enabling cloud/workflow/page execution; complete actual provider outcomes ([SVC-012]–[SVC-014]) before reporting cloud quests/publications as completed. All targets require final packaged/deployed acceptance in addition to package tests.

### [SVC-001] Production server bootstrap and HTTP/WebSocket configuration

**Status:** Observed configuration inconsistency; end-to-end launch unverified. **Targets:** A/B: packaged local service; C: authoritative hosted service.

Resolve server environment names through one validated configuration path. WebUI bootstrap currently reads CRAFT_SERVER_TOKEN directly, while headless bootstrap accepts ROX_SERVER_TOKEN. Make web assets, ports, TLS and runtime assets deterministic.

**Code references:** [packages/server/src/index.ts:119–156](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L119-L156); [packages/server-core/src/bootstrap/headless-start.ts:391–434](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/bootstrap/headless-start.ts#L391-L434).

**Requirements:** ROX and legacy CRAFT aliases behave consistently; startup reports missing assets or invalid ports without exposing secrets.

**DoD:** Both aliases independently start authenticated HTTP and RPC, and an invalid configuration fails before accepting clients.

**Full functional verification:** Boot from a clean data directory, log in, connect RPC, run a session, restart and reopen it.

**Test method:** Subprocess startup matrix plus browser smoke against the built server.

#### [SVC-001.1] Canonical environment aliases and startup diagnostics

Implement a shared resolved token/port/path configuration for WebUI and bootstrap; verify an ROX-only environment actually enables login. **Targets:** A/B: packaged local service; C: authoritative hosted service.

**Code references:** [packages/server/src/index.ts:119–156](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L119-L156); [packages/server-core/src/bootstrap/headless-start.ts:391–434](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/bootstrap/headless-start.ts#L391-L434).

**Requirements:** ROX-only, CRAFT-only and both-defined precedence documented.

**DoD:** Each supported configuration starts the same authenticated surfaces.

**Full functional verification:** Start three isolated servers and read /login, /health and WebSocket handshake.

**Test method:** Extend server smoke tests with alias-only subprocess cases.

#### [SVC-001.2] Deploy HTTP, RPC and OAuth under the public origin

Validate public WebSocket URL, HTTPS termination, forwarded host/protocol and secure cookies; headless supports embedded HTTP/WSS or a separate Bun HTTP port. **Targets:** A/B: packaged local service; C: authoritative hosted service.

**Code references:** [packages/server/src/index.ts:119–156](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L119-L156); [packages/server-core/src/bootstrap/headless-start.ts:391–434](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/bootstrap/headless-start.ts#L391-L434).

**Requirements:** Production URL and proxy allowlist explicitly configured.

**DoD:** No mixed-content or localhost callback URLs appear to remote browsers.

**Full functional verification:** Login through production-shaped TLS proxy and finish an OAuth redirect.

**Test method:** WebUI HTTP tests plus actual proxy/browser integration.

### [SVC-002] Hosted identity, tenancy and authorization

**Status:** Observed single shared WebUI identity; multi-user readiness gap. **Targets:** A/B: preserve local-owner behavior; C: implement hosted account isolation.

WebUI currently signs every login with sub='webui' after one configured password. Introduce authenticated user/account identity and durable workspace membership; propagate identity into HTTP, RPC, events, downloads and tool ownership.

**Code references:** [packages/server-core/src/webui/auth.ts:16–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/auth.ts#L16-L49); [packages/server-core/src/transport/server.ts:116–143](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/server.ts#L116-L143); [packages/server-core/src/security/workspace-scope.ts:77–116](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/security/workspace-scope.ts#L77-L116).

**Requirements:** Every hosted request has a validated account subject and resource authorization; renderer IDs never establish ownership.

**DoD:** Two accounts cannot read, mutate, subscribe to or execute against each other's resources.

**Full functional verification:** Create two users and workspaces, exchange all known IDs, attempt RPC calls and event subscriptions, and verify denied audit records.

**Test method:** HTTP/RPC adversarial tenancy suite using real signed sessions.

#### [SVC-002.1] Account sessions and revocation

Replace shared hosted login with account-specific sessions, key rotation and server-side revocation; distinguish device bearer tokens from browser sessions. **Targets:** A/B: preserve local-owner behavior; C: implement hosted account isolation.

**Code references:** [packages/server-core/src/webui/auth.ts:16–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/auth.ts#L16-L49); [packages/server-core/src/transport/server.ts:116–143](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/server.ts#L116-L143); [packages/server-core/src/security/workspace-scope.ts:77–116](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/security/workspace-scope.ts#L77-L116).

**Requirements:** Expiry, logout/revoke and role change apply to HTTP and WSS.

**DoD:** Revoked identities lose access even on existing sockets.

**Full functional verification:** Log in on two devices, revoke one and retry reads and writes.

**Test method:** Session lifecycle integration tests with connected sockets.

#### [SVC-002.2] Audit every resource route and push subscription

Inventory HANDLED_CHANNELS and apply authoritative membership checks to sessions, files, cloud runs, knowledge, credentials, orgs, pages and messaging. **Targets:** A/B: preserve local-owner behavior; C: implement hosted account isolation.

**Code references:** [packages/server-core/src/webui/auth.ts:16–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/auth.ts#L16-L49); [packages/server-core/src/transport/server.ts:116–143](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/server.ts#L116-L143); [packages/server-core/src/security/workspace-scope.ts:77–116](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/security/workspace-scope.ts#L77-L116).

**Requirements:** Authorization before lookup, mutation and subscription.

**DoD:** Cross-account requests are denied without leaking resource metadata.

**Full functional verification:** Replay another account's request payloads and monitor every push topic.

**Test method:** Table-driven channel authorization tests plus two-user browser test.

### [SVC-003] RPC compatibility, reconnect and remote capability routing

**Status:** Verification requirement for existing transport. **Targets:** A/B: Electron local binding; C: browser/server capabilities.

Certify handshake compatibility, replay ordering, bounded disconnected-client buffers and local-only channel filtering. Headless GUI methods are intentionally absent, so remote capabilities must return meaningful supported results.

**Code references:** [packages/server-core/src/transport/server.ts:250–292](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/server.ts#L250-L292); [packages/server-core/src/transport/client.ts:979–1040](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/client.ts#L979-L1040); [packages/server-core/src/runtime/platform-headless.ts:1–7](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/runtime/platform-headless.ts#L1-L7).

**Requirements:** Version compatibility, capability availability, timeout and replay semantics documented.

**DoD:** A reconnecting client neither loses durable state nor performs a protected local Electron action.

**Full functional verification:** Interrupt the connection during streaming, permission prompts and client callbacks; reconnect and compare authoritative transcripts.

**Test method:** Transport lifecycle/peer-trust/error-code suites plus network fault browser tests.

#### [SVC-003.1] Reconnect and bounded replay under load

Verify sequence acknowledgements, replay window exhaustion, stale clients and pending callback cleanup. **Targets:** A/B: Electron local binding; C: browser/server capabilities.

**Code references:** [packages/server-core/src/transport/server.ts:250–292](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/server.ts#L250-L292); [packages/server-core/src/transport/client.ts:979–1040](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/client.ts#L979-L1040); [packages/server-core/src/runtime/platform-headless.ts:1–7](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/runtime/platform-headless.ts#L1-L7).

**Requirements:** Buffers and client limits stay bounded under disconnect churn.

**DoD:** No duplicate final message or unreleased pending invocation remains.

**Full functional verification:** Disconnect repeatedly with concurrent sessions and inspect sequence/state.

**Test method:** Load/fault harness around WsRpcServer and WsRpcClient.

#### [SVC-003.2] Capability parity for hosted browsers

Map absent GUI methods to browser download, upload, external-link and remote-browser behavior or explicit unavailable states. **Targets:** A/B: Electron local binding; C: browser/server capabilities.

**Code references:** [packages/server-core/src/transport/server.ts:250–292](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/server.ts#L250-L292); [packages/server-core/src/transport/client.ts:979–1040](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/client.ts#L979-L1040); [packages/server-core/src/runtime/platform-headless.ts:1–7](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/runtime/platform-headless.ts#L1-L7).

**Requirements:** Only negotiated capability clients receive callbacks.

**DoD:** Every exposed operation returns a visible result or actionable error.

**Full functional verification:** Exercise file open/export and browser actions from all target clients.

**Test method:** RPC capability tests plus Win/mac/hosted functional matrix.

### [SVC-004] Agent runtime delivery and provider compatibility

**Status:** Three implemented backends; production runtime certification required. **Targets:** A/B: ship native/runtime binaries; C: execute on tenant-owned server workers.

Certify Claude, Pi and OMP startup, model validation, streaming, abort, mini completions, tool calls and provider credential routing. Their presence in the factory is not proof that packaged runtimes are usable.

**Code references:** [packages/shared/src/agent/backend/factory.ts:65–69](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/factory.ts#L65-L69); [packages/shared/src/agent/backend/factory.ts:135–151](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/factory.ts#L135-L151); [packages/pi-agent-server/package.json:11–28](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/package.json#L11-L28).

**Requirements:** Pinned compatible runtime versions; no implicit dependency on a developer's PATH or home configuration.

**DoD:** All offered backends complete a real conversation and tool call on each supported execution host.

**Full functional verification:** Install on clean machines/containers, authenticate, run text/tool/vision turns and force a runtime crash.

**Test method:** Backend factory/runtime resolver suites plus real-provider acceptance runs.

#### [SVC-004.1] Package and resolve every backend executable

Verify SDK CLI, Pi server bundle, Bun/Node, OMP and ripgrep paths for Windows 10/11 and both macOS architectures. **Targets:** A/B: ship native/runtime binaries; C: execute on tenant-owned server workers.

**Code references:** [packages/shared/src/agent/backend/factory.ts:65–69](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/factory.ts#L65-L69); [packages/shared/src/agent/backend/factory.ts:135–151](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/factory.ts#L135-L151); [packages/pi-agent-server/package.json:11–28](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/package.json#L11-L28).

**Requirements:** Architecture-specific executables and clear missing-runtime errors.

**DoD:** All shipped runtimes launch without globally installed development tools.

**Full functional verification:** Launch under a minimal environment and a path with spaces/non-ASCII text.

**Test method:** Packaged runtime smoke tests and binary manifest inspection.

#### [SVC-004.2] Provider capability and model failure handling

Test unsupported model/auth combinations, throttling, revoked auth, model retirement and unavailable mini-model fallback. **Targets:** A/B: ship native/runtime binaries; C: execute on tenant-owned server workers.

**Code references:** [packages/shared/src/agent/backend/factory.ts:65–69](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/factory.ts#L65-L69); [packages/shared/src/agent/backend/factory.ts:135–151](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/factory.ts#L135-L151); [packages/pi-agent-server/package.json:11–28](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/package.json#L11-L28).

**Requirements:** Provider-specific errors remain actionable and safely redacted.

**DoD:** Streaming/abort/tool and query paths preserve consistent session state.

**Full functional verification:** Run a supported provider then simulate 401, 429 and retired models.

**Test method:** Driver tests plus isolated live-provider contract tests.

### [SVC-005] OMP host tools, branching and permission round trips

**Status:** Existing OMP integration; parity verification required. **Targets:** A/B: local OMP process; C: per-tenant OMP runner.

Certify OMP NDJSON host-tool dispatch, essential tool visibility, source refresh at idle points, thinking events, branch anchors, skills and mirrored transcripts. Preserve Craft transcript authority and deny on unanswered permissions.

**Code references:** [packages/shared/src/agent/session-tool-defs.ts:4–19](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/session-tool-defs.ts#L4-L19); [packages/shared/src/agent/session-tool-defs.ts:87–99](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/session-tool-defs.ts#L87-L99); [AGENTS.md:12–46](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/AGENTS.md#L12-L46).

**Requirements:** Ask/safe/allow-all modes enforce the same policy as Pi/Claude, including source tools and shadowed host bash.

**DoD:** Source changes and branch/resume produce correct context without unauthorized execution.

**Full functional verification:** Run source read/write, change permissions mid-session, fork before the last turn and reopen after process restart.

**Test method:** OMP transport, source-proxy, anchors and permission tests plus live CLI harness.

#### [SVC-005.1] Host tools and extension responses

Exercise host_tool_call/result, extension_ui_request/response, schema errors, cancellation and timeout paths. **Targets:** A/B: local OMP process; C: per-tenant OMP runner.

**Code references:** [packages/shared/src/agent/session-tool-defs.ts:4–19](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/session-tool-defs.ts#L4-L19); [packages/shared/src/agent/session-tool-defs.ts:87–99](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/session-tool-defs.ts#L87-L99); [AGENTS.md:12–46](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/AGENTS.md#L12-L46).

**Requirements:** Every extension request receives a valid protocol response.

**DoD:** No hung process, hidden essential tool or permission bypass.

**Full functional verification:** Trigger prompts with accept, reject, no answer and UI disconnect.

**Test method:** NDJSON protocol fixture suite and real OMP tool runs.

#### [SVC-005.2] Branch, skills and transcript recovery

Validate sidecar anchors, switch_session/branch handshakes, tail forks, imported skills and restoration from Craft history. **Targets:** A/B: local OMP process; C: per-tenant OMP runner.

**Code references:** [packages/shared/src/agent/session-tool-defs.ts:4–19](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/session-tool-defs.ts#L4-L19); [packages/shared/src/agent/session-tool-defs.ts:87–99](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/session-tool-defs.ts#L87-L99); [AGENTS.md:12–46](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/AGENTS.md#L12-L46).

**Requirements:** Stable parent/child provenance and correct skill activation.

**DoD:** Reopened branches contain intended history and no future parent turns.

**Full functional verification:** Fork at middle/tail, kill OMP, reopen both branches and compare context.

**Test method:** Anchor/branch/skill discovery tests plus restart acceptance.

### [SVC-006] Pi agent server lifecycle, search and web fetch

**Status:** Implemented subprocess; external-provider and SSRF verification required. **Targets:** A/B: bundled Pi child; C: sandboxed tenant worker.

Validate JSONL framing, ephemeral-query cleanup, per-session model/auth settings, controlled bash and web/search behavior. Search has provider/model fallbacks; web fetch has protocol/private-IP and size guards that require redirect/DNS abuse testing.

**Code references:** [packages/pi-agent-server/src/index.ts:1–60](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/src/index.ts#L1-L60); [packages/pi-agent-server/src/tools/web-fetch.ts:68–126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/src/tools/web-fetch.ts#L68-L126); [packages/pi-agent-server/src/tools/search/SEARCH_PAYLOAD_CONTRACT.md:1–28](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/src/tools/search/SEARCH_PAYLOAD_CONTRACT.md#L1-L28).

**Requirements:** Subprocess output is framed; web/search limits and permitted egress are enforceable on the execution host.

**DoD:** One tenant cannot influence another runtime's credential/model/tool configuration; invalid fetches cannot reach private infrastructure.

**Full functional verification:** Run long streaming sessions and ephemeral queries while canceling; test search failures and malicious URL redirects.

**Test method:** Pi lifecycle/search suites plus real HTTP DNS/redirect fixture server.

#### [SVC-006.1] Runtime cancellation and subprocess resource cleanup

Verify normal completion, abort, parent exit, invalid JSONL and subprocess startup failure. **Targets:** A/B: bundled Pi child; C: sandboxed tenant worker.

**Code references:** [packages/pi-agent-server/src/index.ts:1–60](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/src/index.ts#L1-L60); [packages/pi-agent-server/src/tools/web-fetch.ts:68–126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/src/tools/web-fetch.ts#L68-L126); [packages/pi-agent-server/src/tools/search/SEARCH_PAYLOAD_CONTRACT.md:1–28](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/src/tools/search/SEARCH_PAYLOAD_CONTRACT.md#L1-L28).

**Requirements:** No orphan subprocess or unresolved ephemeral query.

**DoD:** Repeated sessions return process/handle counts to baseline.

**Full functional verification:** Run/cancel hundreds of queries and kill the parent midway.

**Test method:** Ephemeral lifecycle and packaged Pi smoke tests with process tracking.

#### [SVC-006.2] Search and web-fetch full capability contract

Exercise OAuth/API search, model fallback, PDF/text/download extraction and redirect/DNS rebinding guards. **Targets:** A/B: bundled Pi child; C: sandboxed tenant worker.

**Code references:** [packages/pi-agent-server/src/index.ts:1–60](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/src/index.ts#L1-L60); [packages/pi-agent-server/src/tools/web-fetch.ts:68–126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/src/tools/web-fetch.ts#L68-L126); [packages/pi-agent-server/src/tools/search/SEARCH_PAYLOAD_CONTRACT.md:1–28](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/src/tools/search/SEARCH_PAYLOAD_CONTRACT.md#L1-L28).

**Requirements:** Bounded retries, content size, output and wall time; artifacts stay session-contained.

**DoD:** Correct results on supported content and safe errors on forbidden URLs.

**Full functional verification:** Search with each configured provider and fetch oversized/private/redirected content.

**Test method:** Search provider tests plus hostile fetch integration cases.

### [SVC-007] Shared source tools, MCP pooling and credential refresh

**Status:** Existing integration; cross-backend and multi-tenant verification required. **Targets:** A/B: local stdio and remote sources; C: remote sources/server-side stdio only.

Certify HTTP, legacy SSE, stdio MCP and API proxy sources across all backends. Pool sharing must never cross credential/tenant boundaries; browser filesystem access must not be confused with server-local sources.

**Code references:** [packages/shared/src/mcp/mcp-pool.ts:1–14](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mcp/mcp-pool.ts#L1-L14); [packages/shared/src/mcp/mcp-pool.ts:62–72](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mcp/mcp-pool.ts#L62-L72); [packages/shared/src/sources/server-builder.ts:2–38](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/server-builder.ts#L2-L38).

**Requirements:** Source enablement, grants, expiry and transport configuration enforced at invocation.

**DoD:** Add/connect/read/write/disable/delete and credential renewal work across all visible source types.

**Full functional verification:** Configure one source per transport, use two sessions, rotate its token and disable during an in-flight call.

**Test method:** Source builder/token-refresh/API credential suites plus fixture MCP servers.

#### [SVC-007.1] Connection lifecycle and per-tenant pool isolation

Key shared clients by account/workspace/source/credential context; verify stale registrations and reconnect teardown. **Targets:** A/B: local stdio and remote sources; C: remote sources/server-side stdio only.

**Code references:** [packages/shared/src/mcp/mcp-pool.ts:1–14](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mcp/mcp-pool.ts#L1-L14); [packages/shared/src/mcp/mcp-pool.ts:62–72](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mcp/mcp-pool.ts#L62-L72); [packages/shared/src/sources/server-builder.ts:2–38](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/server-builder.ts#L2-L38).

**Requirements:** A disabled or deleted source becomes unusable promptly.

**DoD:** Tool names and runtime availability match authoritative source state.

**Full functional verification:** Rename/remove sources while Pi/OMP/Claude sessions are open.

**Test method:** MCP pool integration tests with two workspaces and auth-separated servers.

#### [SVC-007.2] API authentication and dynamic token freshness

Test OAuth, bearer, basic, multi-header and renew-endpoint authentication without decrypted cache files. **Targets:** A/B: local stdio and remote sources; C: remote sources/server-side stdio only.

**Code references:** [packages/shared/src/mcp/mcp-pool.ts:1–14](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mcp/mcp-pool.ts#L1-L14); [packages/shared/src/mcp/mcp-pool.ts:62–72](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mcp/mcp-pool.ts#L62-L72); [packages/shared/src/sources/server-builder.ts:2–38](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/server-builder.ts#L2-L38).

**Requirements:** Secrets resolved for the actual request and redacted in diagnostics.

**DoD:** Expired credentials refresh once and tool retries safely.

**Full functional verification:** Expire each credential shape and inspect fixture request headers/logs.

**Test method:** Existing source auth/refresh/log-redaction tests plus end-to-end request capture.

### [SVC-008] Session tools and standalone session MCP parity

**Status:** Observed disabled credential-cache adapter; credential-aware operations need traced verification. **Targets:** A/B: local MCP child; C: trusted server callback channel.

Standalone session MCP readCredentialCache always returns null after cache retirement, and its manager cannot refresh. Trace each credential-aware tool to the live host callback or implement a scoped broker so those operations remain usable without restoring plaintext caches.

**Code references:** [packages/session-mcp-server/src/index.ts:61–111](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/session-mcp-server/src/index.ts#L61-L111); [packages/shared/src/agent/session-tool-defs.ts:61–99](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/session-tool-defs.ts#L61-L99); [packages/session-tools-core/package.json:15–24](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/session-tools-core/package.json#L15-L24).

**Requirements:** Session tool parity is behavioral across Claude/Pi/OMP/standalone MCP; credentials stay in trusted host memory/storage.

**DoD:** Every advertised tool has a working implementation or is excluded with an explicit reason.

**Full functional verification:** List tool definitions and exercise source auth/test, plans, browser, spawn_session and call_llm through each backend.

**Test method:** Registry parity suite plus standalone MCP stdio integration.

#### [SVC-008.1] Replace null credential adapter with scoped host access

Inspect tools using hasValidCredentials/getToken/refresh and route necessary operations to an authenticated per-session host broker. **Targets:** A/B: local MCP child; C: trusted server callback channel.

**Code references:** [packages/session-mcp-server/src/index.ts:61–111](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/session-mcp-server/src/index.ts#L61-L111); [packages/shared/src/agent/session-tool-defs.ts:61–99](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/session-tool-defs.ts#L61-L99); [packages/session-tools-core/package.json:15–24](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/session-tools-core/package.json#L15-L24).

**Requirements:** No decrypted credential cache is recreated.

**DoD:** Credential-aware source checks pass using encrypted host-managed auth.

**Full functional verification:** Authenticate a source and invoke checks via standalone session MCP.

**Test method:** MCP child/host round-trip tests with token refresh and denied scope.

#### [SVC-008.2] Callback timeout, error and permission parity

Verify __CALLBACK__ stderr framing, request IDs, 120s timeout, errors and subprocess exit. **Targets:** A/B: local MCP child; C: trusted server callback channel.

**Code references:** [packages/session-mcp-server/src/index.ts:61–111](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/session-mcp-server/src/index.ts#L61-L111); [packages/shared/src/agent/session-tool-defs.ts:61–99](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/session-tool-defs.ts#L61-L99); [packages/session-tools-core/package.json:15–24](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/session-tools-core/package.json#L15-L24).

**Requirements:** Callbacks bind to the originating session and workspace.

**DoD:** No stale callback can authorize a different session.

**Full functional verification:** Interleave callbacks from two sessions; timeout one and close its owner.

**Test method:** Session tool registry/callback integration and permission denial tests.

### [SVC-009] Credentials, master keys and managed credential grants

**Status:** Observed no Windows OS-keychain branch for current master key; production security gap. **Targets:** A: DPAPI/Credential Manager or enforced ACL fallback; B: Keychain; C: managed secret/KMS and tenant stores.

Current master-key read/write supports macOS and Linux then a credentials.key fallback; Windows MachineGuid applies to legacy derivation, not protected new key storage. Add a documented Windows protected-key path and certify recovery/migration/credential grant enforcement.

**Code references:** [packages/shared/src/credentials/backends/secure-storage.ts:124–184](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/credentials/backends/secure-storage.ts#L124-L184); [packages/shared/src/credentials/fabric/broker.ts:1–80](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/credentials/fabric/broker.ts#L1-L80); [packages/shared/src/credentials/fabric/infisical-provider.ts:144–155](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/credentials/fabric/infisical-provider.ts#L144-L155).

**Requirements:** Secrets encrypted at rest; master-key protection, recovery and grant scope defined per platform.

**DoD:** Valid credentials survive restart/migration; missing keys never silently discard existing secrets or broaden grants.

**Full functional verification:** Create/read/migrate/rollback credentials and test revoked grants, tenant mismatch and unavailable key stores.

**Test method:** Secure-storage/master-key/migration/fabric policy suites plus OS-native storage tests.

#### [SVC-009.1] Protect Windows and hosted master keys

Implement OS-bound Windows protection or explicit restrictive ACL controls; configure server-side KMS/secret mounts and key rotation. **Targets:** A: DPAPI/Credential Manager or enforced ACL fallback; B: Keychain; C: managed secret/KMS and tenant stores.

**Code references:** [packages/shared/src/credentials/backends/secure-storage.ts:124–184](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/credentials/backends/secure-storage.ts#L124-L184); [packages/shared/src/credentials/fabric/broker.ts:1–80](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/credentials/fabric/broker.ts#L1-L80); [packages/shared/src/credentials/fabric/infisical-provider.ts:144–155](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/credentials/fabric/infisical-provider.ts#L144-L155).

**Requirements:** Unprivileged other users cannot read key or ciphertext material.

**DoD:** Protection and recovery behavior documented and demonstrated.

**Full functional verification:** Attempt read as a second OS user; restore encrypted store with approved recovery.

**Test method:** Windows ACL/DPAPI and hosted KMS integration acceptance.

#### [SVC-009.2] Certify importers, grants and secret materialization

Test Keychain/git/docker/SSH/aws/ADC/Infisical importers without disclosure, with locator-only and copy modes. **Targets:** A: DPAPI/Credential Manager or enforced ACL fallback; B: Keychain; C: managed secret/KMS and tenant stores.

**Code references:** [packages/shared/src/credentials/backends/secure-storage.ts:124–184](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/credentials/backends/secure-storage.ts#L124-L184); [packages/shared/src/credentials/fabric/broker.ts:1–80](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/credentials/fabric/broker.ts#L1-L80); [packages/shared/src/credentials/fabric/infisical-provider.ts:144–155](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/credentials/fabric/infisical-provider.ts#L144-L155).

**Requirements:** Server-authorized grants specify resource, capability and expiry.

**DoD:** Revoked/expired/wrong-project grants fail before materialization.

**Full functional verification:** Import each available provider, revoke it and retry execution.

**Test method:** Fabric importer/broker/grant tests plus actual supported provider checks.

### [SVC-010] Runtime secret isolation and rotation

**Status:** Observed process-global last-known secret fragment behavior; tenancy/rotation verification required. **Targets:** A/B: local owner scopes; C: eliminate cross-tenant global fragments.

Runtime refresh has a process-global generation counter and keeps previous fragment after unexpected failure. Bind fragments to execution/account context and define fail-closed behavior for revoked required secrets.

**Code references:** [packages/shared/src/secrets/runtime.ts:4–9](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/secrets/runtime.ts#L4-L9); [packages/shared/src/secrets/runtime.ts:23–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/secrets/runtime.ts#L23-L49); [packages/server-core/src/sessions/spawn-env.ts:1–42](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/sessions/spawn-env.ts#L1-L42).

**Requirements:** Only declared and authorized secret refs enter a child's environment; revoked values are removed.

**DoD:** Concurrent tenant spawns cannot inherit another tenant's env fragment.

**Full functional verification:** Rotate/remove secrets, force provider failure and race two tenants' spawns; inspect only redacted env metadata.

**Test method:** Secret chain/runtime/spawn-env tests with sentinel secret values.

#### [SVC-010.1] Scope spawn environment per execution owner

Replace shared mutable secret fragments on hosted workers with explicit scoped resolution results. **Targets:** A/B: local owner scopes; C: eliminate cross-tenant global fragments.

**Code references:** [packages/shared/src/secrets/runtime.ts:4–9](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/secrets/runtime.ts#L4-L9); [packages/shared/src/secrets/runtime.ts:23–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/secrets/runtime.ts#L23-L49); [packages/server-core/src/sessions/spawn-env.ts:1–42](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/sessions/spawn-env.ts#L1-L42).

**Requirements:** No implicit process-global secret reuse across accounts.

**DoD:** Every child receives only its authorized refs.

**Full functional verification:** Race different tenants and compare allowlisted environment keys.

**Test method:** Concurrency tests against real subprocesses with redacted assertions.

#### [SVC-010.2] Rotation, revocation and redaction boundaries

Decide which failures block spawn and clear stale revoked values; register secrets before logs/errors/output paths. **Targets:** A/B: local owner scopes; C: eliminate cross-tenant global fragments.

**Code references:** [packages/shared/src/secrets/runtime.ts:4–9](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/secrets/runtime.ts#L4-L9); [packages/shared/src/secrets/runtime.ts:23–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/secrets/runtime.ts#L23-L49); [packages/server-core/src/sessions/spawn-env.ts:1–42](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/sessions/spawn-env.ts#L1-L42).

**Requirements:** Errors never contain secrets or retain revoked credentials.

**DoD:** Rotation changes future calls and revoked required credentials stop execution.

**Full functional verification:** Rotate while sessions are active, fail resolution and scan stored logs/artifacts.

**Test method:** Secret availability/redaction tests and operational rotation drill.

### [SVC-011] OAuth redirects, callback ownership and hosted provider setup

**Status:** Existing flows; hosted callback/replay certification required. **Targets:** A/B: loopback/external browser; C: public HTTPS server callbacks.

Hosted HTTP callback deliberately skips client/workspace caller checks and relies on OAuth state. Certify one-time state, expiry, initiating owner, redirect allowlists and credential placement. Generic OAuth CLI flow is explicitly unsupported.

**Code references:** [packages/server-core/src/webui/http-server.ts:317–355](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/http-server.ts#L317-L355); [packages/shared/src/auth/oauth-flow-store.ts:1–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/auth/oauth-flow-store.ts#L1-L70); [packages/shared/src/sources/credential-manager.ts:1160–1172](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/credential-manager.ts#L1160-L1172).

**Requirements:** PKCE/state validation, public redirect registration, owner binding and cancellation across supported providers.

**DoD:** OAuth completion connects only the initiating owner's source and refreshes its credentials.

**Full functional verification:** Authenticate Google/Microsoft/MCP/LLM/ROX flows, replay callbacks and submit another user's state.

**Test method:** OAuth store/callback/relay suites plus live provider authorization acceptance.

#### [SVC-011.1] Bind and consume callback state once

Audit lookup/remove/exchange ordering and ensure replay/concurrent callbacks cannot store a credential twice or in a foreign workspace. **Targets:** A/B: loopback/external browser; C: public HTTPS server callbacks.

**Code references:** [packages/server-core/src/webui/http-server.ts:317–355](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/http-server.ts#L317-L355); [packages/shared/src/auth/oauth-flow-store.ts:1–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/auth/oauth-flow-store.ts#L1-L70); [packages/shared/src/sources/credential-manager.ts:1160–1172](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/credential-manager.ts#L1160-L1172).

**Requirements:** State has expiry, initiating owner and one-time completion semantics.

**DoD:** Expired/replayed/mismatched callbacks deny safely.

**Full functional verification:** Send the same callback concurrently and after expiry; switch user before return.

**Test method:** HTTP callback adversarial state tests.

#### [SVC-011.2] Deploy redirect/relay configuration and recovery

Register actual desktop and hosted callbacks, trusted relay origins and provider scopes; provide supported auth path where CLI lacks generic OAuth. **Targets:** A/B: loopback/external browser; C: public HTTPS server callbacks.

**Code references:** [packages/server-core/src/webui/http-server.ts:317–355](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/http-server.ts#L317-L355); [packages/shared/src/auth/oauth-flow-store.ts:1–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/auth/oauth-flow-store.ts#L1-L70); [packages/shared/src/sources/credential-manager.ts:1160–1172](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/credential-manager.ts#L1160-L1172).

**Requirements:** No embedded production client secret in distributed apps.

**DoD:** All offered auth actions finish or recover from user cancellation.

**Full functional verification:** Perform fresh consent, denial, timeout and token renewal from each target client.

**Test method:** Real OAuth provider matrix and relay contract tests.

### [SVC-012] Daytona cloud execution truthfulness and process results

**Status:** Observed nonzero exec result ignored; release blocker. **Targets:** A/B/C: same server/provider outcome semantics.

The runner awaits client.exec but ignores exitCode/stdout/stderr before setting state='done'. Detect unsuccessful exits and incomplete subtask artifacts; record actual progress/usage rather than unconditional 1/1.

**Code references:** [packages/cloud-runner/src/daytona-provider.ts:325–355](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-provider.ts#L325-L355); [packages/cloud-runner/src/daytona-client.ts:305–316](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-client.ts#L305-L316); [packages/cloud-runner/src/daytona-provider.ts:71–78](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-provider.ts#L71-L78).

**Requirements:** Success requires successful runner exit plus validated outputs and subtask outcomes; budgets enforced using measured usage.

**DoD:** Failing runner cannot be presented as completed research; usage and failure reason persist.

**Full functional verification:** Run success, nonzero exit, missing rox-run, partial artifact, oversized output and token-limit cases.

**Test method:** Daytona provider/conformance tests with result-bearing client fixtures and live sandbox run.

#### [SVC-012.1] Honor exit status and validate completion artifacts

Capture exec result, distinguish tool/process failure, read per-subtask completion markers and reject incomplete output. **Targets:** A/B/C: same server/provider outcome semantics.

**Code references:** [packages/cloud-runner/src/daytona-provider.ts:325–355](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-provider.ts#L325-L355); [packages/cloud-runner/src/daytona-client.ts:305–316](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-client.ts#L305-L316); [packages/cloud-runner/src/daytona-provider.ts:71–78](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-provider.ts#L71-L78).

**Requirements:** Nonzero exit and missing completion signal fail the run.

**DoD:** Failure state and actionable diagnostic survive restart.

**Full functional verification:** Make rox-run exit 17 after creating one artifact and inspect status/UI.

**Test method:** Provider regression test plus controlled sandbox executable.

#### [SVC-012.2] Measure progress and enforce token/cost budgets

Collect runner usage/progress records and enforce maxLlmTokens in the live runner/control path. **Targets:** A/B/C: same server/provider outcome semantics.

**Code references:** [packages/cloud-runner/src/daytona-provider.ts:325–355](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-provider.ts#L325-L355); [packages/cloud-runner/src/daytona-client.ts:305–316](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-client.ts#L305-L316); [packages/cloud-runner/src/daytona-provider.ts:71–78](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-provider.ts#L71-L78).

**Requirements:** Accounting uses actual tokens and runtime; exceeded limits terminate.

**DoD:** No success reported with absent usage or unfinished subtasks.

**Full functional verification:** Execute multiple subtasks near token/wall/artifact limits.

**Test method:** Usage/budget boundary tests plus billed provider reconciliation.

### [SVC-013] Daytona paid gate, hardened image and control plane integration

**Status:** Observed gate helper separate from live provider; release blocker pending enforcement proof. **Targets:** A/B: cloud controls available on desktop; C: account-owned sandbox service.

Paid provisioning is disabled by DAYTONA_PAID_PROVISION_ENABLED=false, but the live RPC provider factory directly constructs DaytonaProvider. Trace every provision path and enforce gate/entitlement/budget on the real path. Verify actual REST contract and hardened snapshot includes rox-run and its dependencies.

**Code references:** [packages/cloud-runner/src/daytona-sandbox.ts:2–13](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-sandbox.ts#L2-L13); [packages/cloud-runner/src/daytona-sandbox.ts:72–104](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-sandbox.ts#L72-L104); [packages/server-core/src/handlers/rpc/cloud-runs.ts:254–267](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/cloud-runs.ts#L254-L267); [packages/cloud-runner/src/daytona-client.ts:235–254](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-client.ts#L235-L254).

**Requirements:** One authoritative provision policy; no retired-provider fallback or unapproved cloud spend.

**DoD:** Unpaid/gated/kill-switch calls cannot create a sandbox; enabled paid calls run only approved images.

**Full functional verification:** Attempt each RPC/schedule/workflow entry with gate closed and inspect provider create requests.

**Test method:** Provision policy/RPC tests plus sandbox image and provider API contract acceptance.

#### [SVC-013.1] Enforce entitlement and release gate on all entrypoints

Guard submit/resume/schedules/automation/tool-driven provisioning with server-authenticated paid account and budget. **Targets:** A/B: cloud controls available on desktop; C: account-owned sandbox service.

**Code references:** [packages/cloud-runner/src/daytona-sandbox.ts:2–13](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-sandbox.ts#L2-L13); [packages/cloud-runner/src/daytona-sandbox.ts:72–104](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-sandbox.ts#L72-L104); [packages/server-core/src/handlers/rpc/cloud-runs.ts:254–267](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/cloud-runs.ts#L254-L267); [packages/cloud-runner/src/daytona-client.ts:235–254](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-client.ts#L235-L254).

**Requirements:** Gate cannot be bypassed through direct factory calls or alternate routes.

**DoD:** All denied paths issue zero sandbox-create requests.

**Full functional verification:** Call every provision entry as unpaid, over-budget and gated accounts.

**Test method:** RPC-to-provider spy tests plus controlled remote request audit.

#### [SVC-013.2] Certify provider REST and hardened runner image

Validate REST response shapes, pagination, file APIs, exec timeout/results, snapshot digest and rox-run installation against deployed provider. **Targets:** A/B: cloud controls available on desktop; C: account-owned sandbox service.

**Code references:** [packages/cloud-runner/src/daytona-sandbox.ts:2–13](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-sandbox.ts#L2-L13); [packages/cloud-runner/src/daytona-sandbox.ts:72–104](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-sandbox.ts#L72-L104); [packages/server-core/src/handlers/rpc/cloud-runs.ts:254–267](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/cloud-runs.ts#L254-L267); [packages/cloud-runner/src/daytona-client.ts:235–254](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/daytona-client.ts#L235-L254).

**Requirements:** Immutable vetted image; scoped auth; bounded network and process privileges.

**DoD:** Fresh sandbox completes a real run and exports artifacts without manual setup.

**Full functional verification:** Provision, upload spec, execute, download, cancel/delete in actual provider staging.

**Test method:** Live Daytona contract test and image executable smoke.

### [SVC-014] Cloud run durability, restart recovery and local execution

**Status:** Observed local provider defaults to reference stub; single-file registry readiness gap. **Targets:** A: Windows child-tree ownership; B: POSIX process groups; C: durable hosted run ownership.

Replace reference output in user-facing local runs with a real agent runner, or clearly remove this mode from final execution claims. Harden registry/schedule persistence and reconcile running sandboxes after server restart.

**Code references:** [packages/cloud-runner/src/local-provider.ts:33–41](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/local-provider.ts#L33-L41); [packages/cloud-runner/src/local-provider.ts:106–119](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/local-provider.ts#L106-L119); [packages/server-core/src/handlers/rpc/cloud-runs.ts:334–362](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/cloud-runs.ts#L334-L362); [packages/cloud-runner/src/runners/stub-runner.ts:49–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/runners/stub-runner.ts#L49-L70).

**Requirements:** Durable run owner, spec, events, outputs and terminal result; no orphan work after cancellation.

**DoD:** Restart restores active/terminal runs; local mode performs the requested task.

**Full functional verification:** Submit, kill host mid-run, restart, resume, cancel and inspect artifacts/process/sandbox inventory.

**Test method:** Cloud runner conformance/RPC tests plus host crash-recovery matrix.

#### [SVC-014.1] Real local runner and Windows process trees

Provide production runnerCommand and packaged assets; replace Windows parent-only kill with owned child-tree termination. **Targets:** A: Windows child-tree ownership; B: POSIX process groups; C: durable hosted run ownership.

**Code references:** [packages/cloud-runner/src/local-provider.ts:33–41](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/local-provider.ts#L33-L41); [packages/cloud-runner/src/local-provider.ts:106–119](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/local-provider.ts#L106-L119); [packages/server-core/src/handlers/rpc/cloud-runs.ts:334–362](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/cloud-runs.ts#L334-L362); [packages/cloud-runner/src/runners/stub-runner.ts:49–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/runners/stub-runner.ts#L49-L70).

**Requirements:** Identical run contract with real inference/tool behavior.

**DoD:** Cancel leaves no child or grandchild process running.

**Full functional verification:** Spawn a nested long-running command in local run and cancel on each OS.

**Test method:** Local provider lifecycle tests plus Windows process enumeration acceptance.

#### [SVC-014.2] Persist registries and recover distributed runs

Make cloud registry/schedule updates atomic and serialized; recover active provider work without duplicate provisioning. **Targets:** A: Windows child-tree ownership; B: POSIX process groups; C: durable hosted run ownership.

**Code references:** [packages/cloud-runner/src/local-provider.ts:33–41](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/local-provider.ts#L33-L41); [packages/cloud-runner/src/local-provider.ts:106–119](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/local-provider.ts#L106-L119); [packages/server-core/src/handlers/rpc/cloud-runs.ts:334–362](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/cloud-runs.ts#L334-L362); [packages/cloud-runner/src/runners/stub-runner.ts:49–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/runners/stub-runner.ts#L49-L70).

**Requirements:** Run/schedule writes tolerate concurrent operations and partial file writes.

**DoD:** Restart neither loses runs nor repeats completed work.

**Full functional verification:** Interrupt writes/pump and restart from persisted run records.

**Test method:** Filesystem fault injection and provider reconcile tests.

### [SVC-015] Retired Cloudflare gateway disposition and API hardening

**Status:** Observed retained v1 shared-token gateway; conditional if retained/deployed. **Targets:** A/B/C: no hidden fallback; C: isolate or retire legacy service.

Cloudflare remains exported/deployable although public registry retires it. Decide whether it is an internal legacy target or removed service. If retained, replace shared-token run IDs with authorized tenant ownership and robust RunSpec schemas/quotas.

**Code references:** [packages/cloud-runner/src/public-registry.ts:2–21](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/public-registry.ts#L2-L21); [apps/cloud-gateway/src/index.ts:11–37](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/src/index.ts#L11-L37); [apps/cloud-gateway/src/index.ts:77–96](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/src/index.ts#L77-L96); [apps/cloud-gateway/wrangler.jsonc:7–34](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/wrangler.jsonc#L7-L34).

**Requirements:** Supported provider list matches runtime/routes/docs; legacy endpoint cannot broaden access or bypass spend policy.

**DoD:** No normal user path silently uses Cloudflare; retained APIs validate ownership and size limits.

**Full functional verification:** Try legacy configuration, known foreign run IDs, parent fork IDs and malformed/oversized request bodies.

**Test method:** Registry migration tests plus gateway API/security harness when service retained.

#### [SVC-015.1] Retire or constrain gateway deployment

Remove accidental public deployment/fallback or define internal operators, auth and lifecycle explicitly. **Targets:** A/B/C: no hidden fallback; C: isolate or retire legacy service.

**Code references:** [packages/cloud-runner/src/public-registry.ts:2–21](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/public-registry.ts#L2-L21); [apps/cloud-gateway/src/index.ts:11–37](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/src/index.ts#L11-L37); [apps/cloud-gateway/src/index.ts:77–96](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/src/index.ts#L77-L96); [apps/cloud-gateway/wrangler.jsonc:7–34](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/wrangler.jsonc#L7-L34).

**Requirements:** Provider retirement enforced independently of UI visibility.

**DoD:** Old configs migrate predictably without invoking retired provider.

**Full functional verification:** Load old cloudflare config and submit from every execution entry.

**Test method:** Public registry/coercion and RPC migration tests.

#### [SVC-015.2] Tenant-safe run IDs, schemas and share revocation

For retained service authorize owner before create/status/fork/artifacts/cancel; validate subtasks/limits; enforce expiring/revocable share capabilities. **Targets:** A/B/C: no hidden fallback; C: isolate or retire legacy service.

**Code references:** [packages/cloud-runner/src/public-registry.ts:2–21](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/src/public-registry.ts#L2-L21); [apps/cloud-gateway/src/index.ts:11–37](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/src/index.ts#L11-L37); [apps/cloud-gateway/src/index.ts:77–96](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/src/index.ts#L77-L96); [apps/cloud-gateway/wrangler.jsonc:7–34](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/wrangler.jsonc#L7-L34).

**Requirements:** No shared administrative token in distributed clients.

**DoD:** Foreign IDs and invalid specs reject; revoked share becomes unreadable.

**Full functional verification:** Two owners exchange IDs, malformed schemas and share tokens.

**Test method:** Worker/DO integration tests and deployed gateway adversarial API test.

### [SVC-016] Messaging gateway ownership, routing and operational lifecycle

**Status:** Existing owner/public-inbox policy; production delivery verification required. **Targets:** A/B: local gateway ownership; C: server-hosted adapters and credential stores.

Certify all configured platforms through the same bootstrap, workspace binding, command access evaluator and session event fanout. Keep public-inbox non-executing and require authoritative owners for tool routing and permission buttons.

**Code references:** [packages/messaging-gateway/src/bootstrap.ts:28–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/bootstrap.ts#L28-L70); [packages/messaging-gateway/src/access-control.ts:55–110](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/access-control.ts#L55-L110); [packages/messaging-gateway/src/router.ts:1–90](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/router.ts#L1-L90).

**Requirements:** Sender/workspace/session identity and access mode enforced before commands, turns and decisions.

**DoD:** Unauthorized messages cannot start sessions or approve tools; authorized responses reliably reach the correct thread.

**Full functional verification:** Pair an owner and outsider on each platform; send commands, attachments and permission buttons across two workspaces.

**Test method:** Messaging access/router/commands/button/registry suites plus real platform acceptance.

#### [SVC-016.1] Bind sender access and permission decisions

Audit pre-binding commands, existing binding routes, pairing, pending senders, plan tokens and button replay. **Targets:** A/B: local gateway ownership; C: server-hosted adapters and credential stores.

**Code references:** [packages/messaging-gateway/src/bootstrap.ts:28–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/bootstrap.ts#L28-L70); [packages/messaging-gateway/src/access-control.ts:55–110](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/access-control.ts#L55-L110); [packages/messaging-gateway/src/router.ts:1–90](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/router.ts#L1-L90).

**Requirements:** Access enforcement identical for messages and buttons.

**DoD:** Outsider/replayed button produces no tool execution or state mutation.

**Full functional verification:** Forward an owner's approval button to another sender and replay it.

**Test method:** Gateway button/access/pairing tests with real adapter delivery.

#### [SVC-016.2] Durable delivery, worker health and shutdown

Define inbound deduplication, outgoing retries/ordering, session binding recovery and adapter health beyond swallowed initialize errors. **Targets:** A/B: local gateway ownership; C: server-hosted adapters and credential stores.

**Code references:** [packages/messaging-gateway/src/bootstrap.ts:28–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/bootstrap.ts#L28-L70); [packages/messaging-gateway/src/access-control.ts:55–110](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/access-control.ts#L55-L110); [packages/messaging-gateway/src/router.ts:1–90](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/router.ts#L1-L90).

**Requirements:** Gateway health reports unavailable platform and pending delivery states.

**DoD:** Restart recovers bindings without duplicate agent turns.

**Full functional verification:** Kill/restart gateway while inbound/outbound messages and attachments are active.

**Test method:** Fault-injection gateway lifecycle tests plus adapter reconnect drill.

### [SVC-017] Telegram polling, forum topics and attachments

**Status:** Implemented adapter; stale phase-1 comment is not evidence of missing features. **Targets:** A/B/C: Node/Bun gateway with single active bot poller.

Verify implemented DM/forum pairing and topic routing, text/media downloads, file caps and formatted replies. Define hosted single-poller ownership and offset recovery rather than assuming the outdated text-only header describes current capabilities.

**Code references:** [packages/messaging-gateway/src/adapters/telegram/index.ts:26–41](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/telegram/index.ts#L26-L41); [packages/messaging-gateway/src/topic-registry.ts:1–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/topic-registry.ts#L1-L70); [packages/messaging-gateway/src/adapters/telegram/dm-only.test.ts:1–39](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/telegram/dm-only.test.ts#L1-L39).

**Requirements:** DM/group/forum behavior explicitly specified; one poller per bot credential; attachment size/time limits.

**DoD:** Supported message types route once to the intended bound topic and recover from polling interruptions.

**Full functional verification:** Use a private chat and forum supergroup; pair, bind, send text/PDF/image/audio and restart the poller.

**Test method:** Telegram/topic registry tests plus dedicated real bot acceptance.

#### [SVC-017.1] Forum pairing and topic lifecycle

Validate getChatInfo checks, ownership, missing/deleted topics and topic reuse across sessions. **Targets:** A/B/C: Node/Bun gateway with single active bot poller.

**Code references:** [packages/messaging-gateway/src/adapters/telegram/index.ts:26–41](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/telegram/index.ts#L26-L41); [packages/messaging-gateway/src/topic-registry.ts:1–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/topic-registry.ts#L1-L70); [packages/messaging-gateway/src/adapters/telegram/dm-only.test.ts:1–39](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/telegram/dm-only.test.ts#L1-L39).

**Requirements:** Pairing requires an actual forum supergroup and authorized owner.

**DoD:** Topic messages stay in the correct session and invalid pairings reject.

**Full functional verification:** Pair a regular group/forum, delete a topic and recreate a session.

**Test method:** Topic registry/router tests and live forum scenario.

#### [SVC-017.2] Polling failover and attachment handling

Persist/validate update offset and ensure only one active replica owns polling; clean temporary media files. **Targets:** A/B/C: Node/Bun gateway with single active bot poller.

**Code references:** [packages/messaging-gateway/src/adapters/telegram/index.ts:26–41](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/telegram/index.ts#L26-L41); [packages/messaging-gateway/src/topic-registry.ts:1–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/topic-registry.ts#L1-L70); [packages/messaging-gateway/src/adapters/telegram/dm-only.test.ts:1–39](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/telegram/dm-only.test.ts#L1-L39).

**Requirements:** No duplicate turns or leaked temp files during failover.

**DoD:** Text/media resume after disconnect without crossing file caps.

**Full functional verification:** Interrupt polling during a media update and switch the active server.

**Test method:** Polling lifecycle fixture tests and real media delivery drill.

### [SVC-018] WhatsApp Node worker, authentication and message lifecycle

**Status:** Implemented separate worker; edit capability explicitly unsupported. **Targets:** A/B: bundle Node/Electron-as-Node worker; C: durable server auth directory.

WhatsApp must execute in a Node subprocess rather than Bun. Certify QR/code pairing, auth persistence, worker IPC, history filtering, media, reconnect and unsupported edit handling.

**Code references:** [packages/server/src/index.ts:161–167](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L161-L167); [packages/messaging-gateway/src/adapters/whatsapp/index.ts:285–302](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/whatsapp/index.ts#L285-L302); [packages/messaging-whatsapp-worker/src/worker.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-whatsapp-worker/src/worker.ts#L1-L65).

**Requirements:** Worker bundle and correct Node executable shipped; session auth protected and account-scoped.

**DoD:** Owner can pair, exchange media and reconnect across host restart without silently failing edits.

**Full functional verification:** Fresh pair, restart, disconnect/reconnect, send historical/live messages and force worker exit.

**Test method:** WhatsApp lifecycle/filter/upsert/media tests plus real test account acceptance.

#### [SVC-018.1] Package worker and protect pairing credentials

Stage worker.cjs/Node path on every deployment; enforce storage ACLs and per-account directory isolation. **Targets:** A/B: bundle Node/Electron-as-Node worker; C: durable server auth directory.

**Code references:** [packages/server/src/index.ts:161–167](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L161-L167); [packages/messaging-gateway/src/adapters/whatsapp/index.ts:285–302](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/whatsapp/index.ts#L285-L302); [packages/messaging-whatsapp-worker/src/worker.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-whatsapp-worker/src/worker.ts#L1-L65).

**Requirements:** Missing worker/runtime fails visibly before pairing.

**DoD:** Pairing survives restart only for the correct account.

**Full functional verification:** Install clean build, pair, restart then inspect protected auth directory.

**Test method:** Worker bundle smoke and native/server lifecycle tests.

#### [SVC-018.2] Capability-aware updates and reconnect deduplication

Use adapter capabilities to select append/final-message behavior where edit throws; test history replay and media failures. **Targets:** A/B: bundle Node/Electron-as-Node worker; C: durable server auth directory.

**Code references:** [packages/server/src/index.ts:161–167](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L161-L167); [packages/messaging-gateway/src/adapters/whatsapp/index.ts:285–302](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/whatsapp/index.ts#L285-L302); [packages/messaging-whatsapp-worker/src/worker.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-whatsapp-worker/src/worker.ts#L1-L65).

**Requirements:** No unsupported edit route or replay-triggered duplicate turn.

**DoD:** Long streaming reply completes correctly after worker reconnect.

**Full functional verification:** Stream a response, kill worker, reconnect and inspect final chat.

**Test method:** Renderer/gateway capability tests and live reconnect scenario.

### [SVC-019] Discord worker, channel bindings and intents

**Status:** Implemented optional Node worker; live intent/delivery certification required. **Targets:** A/B/C: bundled or server-side Discord worker and scoped bot token.

Certify Discord bot startup, Node worker packaging, gateway intents, DM/channel/thread behavior, permission components and attachment formatting. Optional worker omission must produce an accurate unavailable state.

**Code references:** [packages/messaging-gateway/src/bootstrap.ts:48–54](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/bootstrap.ts#L48-L54); [packages/messaging-discord-worker/src/worker.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-discord-worker/src/worker.ts#L1-L65); [packages/messaging-gateway/src/adapters/discord/index.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/discord/index.ts#L1-L85).

**Requirements:** Bot scopes/intents, channel access and adapter capability matrix documented.

**DoD:** Authorized sender can create/bind sessions and receive complete text/media responses.

**Full functional verification:** Install bot in test guild, exercise DM/thread/channel, insufficient intents and worker restart.

**Test method:** Discord protocol/config/format/lifecycle tests plus real guild acceptance.

#### [SVC-019.1] Gateway intents and channel/thread access

Validate configured intents and permissions against bot behavior; separate missing permissions from connection failure. **Targets:** A/B/C: bundled or server-side Discord worker and scoped bot token.

**Code references:** [packages/messaging-gateway/src/bootstrap.ts:48–54](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/bootstrap.ts#L48-L54); [packages/messaging-discord-worker/src/worker.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-discord-worker/src/worker.ts#L1-L65); [packages/messaging-gateway/src/adapters/discord/index.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/discord/index.ts#L1-L85).

**Requirements:** Only intended guilds/channels/senders execute tools.

**DoD:** Supported threads route correctly and forbidden channels deny.

**Full functional verification:** Revoke channel access and message-content intent during a session.

**Test method:** Adapter/router fixture tests and test guild permission matrix.

#### [SVC-019.2] Worker IPC and interactive approvals

Verify worker framing, reconnect, component payload ownership and stale button rejection. **Targets:** A/B/C: bundled or server-side Discord worker and scoped bot token.

**Code references:** [packages/messaging-gateway/src/bootstrap.ts:48–54](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/bootstrap.ts#L48-L54); [packages/messaging-discord-worker/src/worker.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-discord-worker/src/worker.ts#L1-L65); [packages/messaging-gateway/src/adapters/discord/index.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/discord/index.ts#L1-L85).

**Requirements:** Worker failures surface without losing authoritative session.

**DoD:** Restart and old component clicks cannot execute an unintended command.

**Full functional verification:** Kill worker during permission prompt then click old/new buttons.

**Test method:** Protocol/gateway button tests plus real Discord interaction.

### [SVC-020] Lark adapter, event cards and resource download

**Status:** Implemented adapter with explicit unsupported-message paths. **Targets:** A/B/C: server or local adapter with app credentials and event transport.

Certify Lark event transport, card version/schema, resource SDK shapes, owner identity and app scopes. Unsupported message types are dropped in code; expose a supported capability list and visible handling for user actions.

**Code references:** [packages/messaging-gateway/src/adapters/lark/index.ts:625–655](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/lark/index.ts#L625-L655); [packages/messaging-gateway/src/adapters/lark/index.ts:735–765](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/lark/index.ts#L735-L765); [packages/messaging-gateway/src/adapters/lark/card.ts:1–45](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/lark/card.ts#L1-L45).

**Requirements:** Document accepted event/message/card/resource shapes and exact app scopes.

**DoD:** Supported text/files/cards work with the deployed SDK/API; unsupported events have safe diagnostics.

**Full functional verification:** Use a test Lark app to send text/resource/card actions and test revoked scopes.

**Test method:** Lark adapter/card/format tests plus live tenant acceptance.

#### [SVC-020.1] App auth, event reconnect and message identity

Test tenant token refresh, duplicate event IDs, disconnect/reconnect and sender ownership. **Targets:** A/B/C: server or local adapter with app credentials and event transport.

**Code references:** [packages/messaging-gateway/src/adapters/lark/index.ts:625–655](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/lark/index.ts#L625-L655); [packages/messaging-gateway/src/adapters/lark/index.ts:735–765](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/lark/index.ts#L735-L765); [packages/messaging-gateway/src/adapters/lark/card.ts:1–45](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/lark/card.ts#L1-L45).

**Requirements:** Events bind to the configured workspace/account.

**DoD:** No duplicated turn or lost owner command after reconnect.

**Full functional verification:** Deliver duplicate events and revoke/regrant app access.

**Test method:** Lark adapter event/auth fixture tests and real app reconnect.

#### [SVC-020.2] Cards, resource downloads and supported types

Exercise card actions, permissions, SDK response variants, file caps and unsupported message feedback. **Targets:** A/B/C: server or local adapter with app credentials and event transport.

**Code references:** [packages/messaging-gateway/src/adapters/lark/index.ts:625–655](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/lark/index.ts#L625-L655); [packages/messaging-gateway/src/adapters/lark/index.ts:735–765](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/lark/index.ts#L735-L765); [packages/messaging-gateway/src/adapters/lark/card.ts:1–45](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/lark/card.ts#L1-L45).

**Requirements:** No schema rejection or accidental private resource disclosure.

**DoD:** Every advertised card/media operation delivers the actual result.

**Full functional verification:** Upload resource, use approval card, send unknown event and large file.

**Test method:** Card/resource tests and actual Lark UI readback.

### [SVC-021] WeChat/iLink authentication, encrypted media and polling

**Status:** Implemented vendored protocol adapter; live compatibility certification required. **Targets:** A/B/C: account-isolated state/sync buffers and supported media runtime.

Certify QR login, account selection/session guards, polling sync buffer, encrypted CDN media, upload/decrypt, audio transcoding and reconnect. These external protocol assumptions need live account tests; transport code alone does not establish current service compatibility.

**Code references:** [packages/messaging-gateway/src/adapters/wechat/index.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/wechat/index.ts#L1-L85); [packages/messaging-gateway/src/adapters/wechat/ilink/auth/login-qr.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/wechat/ilink/auth/login-qr.ts#L1-L65); [packages/messaging-gateway/src/adapters/wechat/ilink/media/media-download.ts:1–45](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/wechat/ilink/media/media-download.ts#L1-L45).

**Requirements:** Protocol endpoint/configuration and supported media dependencies pinned; auth state tenant-isolated.

**DoD:** Real account pairs, sends/receives supported content and recovers polling state after restart.

**Full functional verification:** Pair dedicated account, exchange text/image/audio/file, restart and test expired session/invalid ciphertext.

**Test method:** WeChat adapter/send/renderer tests plus real test account protocol acceptance.

#### [SVC-021.1] Auth and polling state recovery

Protect account files, serialize sync-buffer updates and handle expired credentials without running foreign account work. **Targets:** A/B/C: account-isolated state/sync buffers and supported media runtime.

**Code references:** [packages/messaging-gateway/src/adapters/wechat/index.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/wechat/index.ts#L1-L85); [packages/messaging-gateway/src/adapters/wechat/ilink/auth/login-qr.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/wechat/ilink/auth/login-qr.ts#L1-L65); [packages/messaging-gateway/src/adapters/wechat/ilink/media/media-download.ts:1–45](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/wechat/ilink/media/media-download.ts#L1-L45).

**Requirements:** Account/session mismatch denies before processing.

**DoD:** Restart resumes one owned poller with accurate online state.

**Full functional verification:** Switch accounts, corrupt buffer and expire login during incoming traffic.

**Test method:** Account/session-guard/polling integration and live reconnect.

#### [SVC-021.2] Encrypted media and transcoder deployment

Verify AES/CDN URL handling, MIME/size limits, failed decryption and Silk transcoder availability per host. **Targets:** A/B/C: account-isolated state/sync buffers and supported media runtime.

**Code references:** [packages/messaging-gateway/src/adapters/wechat/index.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/wechat/index.ts#L1-L85); [packages/messaging-gateway/src/adapters/wechat/ilink/auth/login-qr.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/wechat/ilink/auth/login-qr.ts#L1-L65); [packages/messaging-gateway/src/adapters/wechat/ilink/media/media-download.ts:1–45](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/src/adapters/wechat/ilink/media/media-download.ts#L1-L45).

**Requirements:** No unrestricted download or leaked temporary media.

**DoD:** Supported media round trips or gives actionable unavailable errors.

**Full functional verification:** Send encrypted sample content and invalid/oversized media on each host.

**Test method:** Media crypto/download tests plus real audio/image delivery.

### [SVC-022] Automations execution, retries and side-effect semantics

**Status:** Observed single-process retry invariant; multi-worker readiness gap. **Targets:** A/B: one workspace executor; C: leases/queue ownership for hosted workers.

Certify prompts, webhooks, scripts, knowledge and meeting-followup actions. RetryScheduler explicitly supports one process and at-least-once effects after restart; hosted deployment must honor that invariant or introduce leases/idempotency/DLQ.

**Code references:** [packages/shared/src/automations/retry-scheduler.ts:2–25](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/automations/retry-scheduler.ts#L2-L25); [packages/shared/src/automations/script-executor.ts:4–15](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/automations/script-executor.ts#L4-L15); [packages/shared/src/automations/automation-system.ts:1–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/automations/automation-system.ts#L1-L70).

**Requirements:** Event/action permissions, retry/idempotency semantics and secret environment boundaries documented and enforced.

**DoD:** Automation outcomes persist accurately and do not falsely claim external success.

**Full functional verification:** Trigger each action, restart between effect and ack, test duplicated events and trap script termination.

**Test method:** Automation/security/retry/script/handler suites plus real fixture side-effect services.

#### [SVC-022.1] Hosted lease ownership and webhook idempotency

Keep one executor per workspace or add durable leases and side-effect idempotency keys; retain failed deliveries for inspection/retry. **Targets:** A/B: one workspace executor; C: leases/queue ownership for hosted workers.

**Code references:** [packages/shared/src/automations/retry-scheduler.ts:2–25](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/automations/retry-scheduler.ts#L2-L25); [packages/shared/src/automations/script-executor.ts:4–15](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/automations/script-executor.ts#L4-L15); [packages/shared/src/automations/automation-system.ts:1–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/automations/automation-system.ts#L1-L70).

**Requirements:** Two replicas cannot concurrently own one queue; restart duplication handled.

**DoD:** Failed/uncertain delivery is visible and recoverable.

**Full functional verification:** Run two workers and crash one immediately after webhook accepts.

**Test method:** Retry crash/lease tests with effect-recording HTTP fixture.

#### [SVC-022.2] Script runtime, policy and descendant cleanup

Resolve bundled Bun/Node/Python runtime; enforce workspace containment, environment allowlist and Windows/POSIX descendant termination. **Targets:** A/B: one workspace executor; C: leases/queue ownership for hosted workers.

**Code references:** [packages/shared/src/automations/retry-scheduler.ts:2–25](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/automations/retry-scheduler.ts#L2-L25); [packages/shared/src/automations/script-executor.ts:4–15](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/automations/script-executor.ts#L4-L15); [packages/shared/src/automations/automation-system.ts:1–70](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/automations/automation-system.ts#L1-L70).

**Requirements:** Unapproved script cannot escape source/workspace grants.

**DoD:** Timeout/cancel leaves no descendants; logs do not contain secrets.

**Full functional verification:** Execute path traversal/symlink/trapped-signal and nested-child scripts.

**Test method:** Script/security tests and OS-specific process cleanup acceptance.

### [SVC-023] Scheduler, task runner and workflow receipts

**Status:** Existing executors; durable hosted coordination and receipt verification required. **Targets:** A/B: sleep/wake and local-time behavior; C: leader/lease and timezone policy.

Certify cron/interval matching, timezone/DST, missed ticks, task resume, graph validation, live workflow receipts and permission routing. Workflow production success explicitly requires caller-injected receipts and non-loopback evidence.

**Code references:** [packages/shared/src/scheduler/scheduler-service.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/scheduler/scheduler-service.ts#L1-L85); [packages/server-core/src/tasks/TaskRunner.ts:843–903](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/tasks/TaskRunner.ts#L843-L903); [packages/server-core/src/workflows/executor.ts:36–54](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/workflows/executor.ts#L36-L54).

**Requirements:** Durable schedule/task/workflow ownership; defined misfire policy; receipts tied to real external operations.

**DoD:** Restart/resume never fabricates completed nodes or repeats non-idempotent work silently.

**Full functional verification:** Run a multi-node workflow with failure/approval, suspend machine, change timezone and resume after restart.

**Test method:** Scheduler/cron/TaskRunner/workflow live-executor suites plus durable service integration.

#### [SVC-023.1] Scheduling and task recovery

Define local/hosted timezone and DST semantics, durable next-fire state and leader ownership; resume task.yaml/run-log safely. **Targets:** A/B: sleep/wake and local-time behavior; C: leader/lease and timezone policy.

**Code references:** [packages/shared/src/scheduler/scheduler-service.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/scheduler/scheduler-service.ts#L1-L85); [packages/server-core/src/tasks/TaskRunner.ts:843–903](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/tasks/TaskRunner.ts#L843-L903); [packages/server-core/src/workflows/executor.ts:36–54](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/workflows/executor.ts#L36-L54).

**Requirements:** No duplicate trigger under restart or two workers.

**DoD:** Missed jobs follow the published skip/catch-up policy.

**Full functional verification:** Advance clock through DST, sleep/wake and concurrent server restart.

**Test method:** Fake-clock scheduler tests plus process restart task acceptance.

#### [SVC-023.2] Persistent receipts and production workflow wiring

Inject durable receipt store and real model/tool registries; verify graph cancel/resume and idempotency keys. **Targets:** A/B: sleep/wake and local-time behavior; C: leader/lease and timezone policy.

**Code references:** [packages/shared/src/scheduler/scheduler-service.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/scheduler/scheduler-service.ts#L1-L85); [packages/server-core/src/tasks/TaskRunner.ts:843–903](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/tasks/TaskRunner.ts#L843-L903); [packages/server-core/src/workflows/executor.ts:36–54](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/workflows/executor.ts#L36-L54).

**Requirements:** Loopback/in-memory test execution never appears verified production.

**DoD:** External result is read back before succeeded/verified.

**Full functional verification:** Perform a real create/update workflow, fail after effect and resume.

**Test method:** Workflow receipt integration with readback fixture and one live provider.

### [SVC-024] Knowledge bridge, managed SiYuan/OEM kernel and local vaults

**Status:** Observed managed provider gate; final release capability requires approval evidence or clear unavailable state. **Targets:** A: Windows kernel/discovery; B: macOS SiYuan/vault; C: server-owned vault or authenticated remote provider.

Certify managed/external knowledge connection, provider gating, mutation proposal/apply/rollback, watches, migration, publications and provenance. Managed kernel intentionally blocks until accepted G2 variant C and binary/provider evidence exist.

**Code references:** [packages/server-core/src/knowledge/process-manager.ts:89–114](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/process-manager.ts#L89-L114); [packages/server-core/src/knowledge/bridge-service.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/bridge-service.ts#L1-L65); [packages/server-core/src/knowledge/publication-service.ts:2–7](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/publication-service.ts#L2-L7); [packages/server-core/src/knowledge/automation-actions.ts:475–495](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/automation-actions.ts#L475-L495).

**Requirements:** Only approved pinned kernel runs; server/desktop vault ownership is explicit; no unintended browser access to local desktop files.

**DoD:** Connect/read/search/propose/review/apply/rollback and export work against actual provider data.

**Full functional verification:** Use a real external provider and approved managed build, edit out-of-band, apply stale proposal and restart watcher/kernel.

**Test method:** Knowledge gate/process/bridge/publication/vault/migration suites plus real provider UI readback.

#### [SVC-024.1] Complete managed kernel release gate and distribution

Supply accepted provider/OEM evidence, digest-pinned binaries per OS, port/workspace locks, auth token and crash supervision. **Targets:** A: Windows kernel/discovery; B: macOS SiYuan/vault; C: server-owned vault or authenticated remote provider.

**Code references:** [packages/server-core/src/knowledge/process-manager.ts:89–114](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/process-manager.ts#L89-L114); [packages/server-core/src/knowledge/bridge-service.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/bridge-service.ts#L1-L65); [packages/server-core/src/knowledge/publication-service.ts:2–7](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/publication-service.ts#L2-L7); [packages/server-core/src/knowledge/automation-actions.ts:475–495](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/automation-actions.ts#L475-L495).

**Requirements:** Blocked gate remains enforced until evidence is accepted.

**DoD:** Approved build starts; absent/invalid pin or conflicting workspace fails safely.

**Full functional verification:** Install fresh kernel, test lock conflict, health timeout and crash recovery.

**Test method:** Provider gate/process-manager tests plus packaged kernel acceptance.

#### [SVC-024.2] Mutation safety, watches and substantive publication

Verify compare-before-write, partial-apply compensation, selection proof, provenance and loop guard; replace automation publication placeholders with actual run content when final publishing is offered. **Targets:** A: Windows kernel/discovery; B: macOS SiYuan/vault; C: server-owned vault or authenticated remote provider.

**Code references:** [packages/server-core/src/knowledge/process-manager.ts:89–114](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/process-manager.ts#L89-L114); [packages/server-core/src/knowledge/bridge-service.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/bridge-service.ts#L1-L65); [packages/server-core/src/knowledge/publication-service.ts:2–7](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/publication-service.ts#L2-L7); [packages/server-core/src/knowledge/automation-actions.ts:475–495](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/automation-actions.ts#L475-L495).

**Requirements:** Review approval precedes writes; full content and stable links persist.

**DoD:** Readback matches approved draft and rollback restores prior content.

**Full functional verification:** Publish session/run, modify provider externally, apply stale draft and undo.

**Test method:** Bridge/publication/watcher tests plus live vault/provider comparison.

### [SVC-025] Memory storage, search, learning and scope parity

**Status:** Observed desktop Electron FTS fallback; search capability gap. **Targets:** A/B: Electron Node disables bun:sqlite FTS; C: Bun server has FTS.

FTS index loads bun:sqlite lazily and explicitly falls back to recency in Electron/Node. Define equivalent supported search quality across desktop and hosted clients; certify lesson approval, provenance, scope disabling, decay and rebuild.

**Code references:** [packages/server-core/src/memory/fts-index.ts:14–41](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/memory/fts-index.ts#L14-L41); [packages/server-core/src/memory/MemoryService.ts:1–75](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/memory/MemoryService.ts#L1-L75); [packages/server-core/src/memory/MemoryProposalStore.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/memory/MemoryProposalStore.ts#L1-L65).

**Requirements:** Scope boundaries and search availability visible; authoritative markdown/JSONL is recoverable independently of indexes.

**DoD:** Approved lessons influence only authorized sessions; revoked/deleted lessons stop being retrieved.

**Full functional verification:** Create global/workspace/session lessons, search distinctive older text, disable memory and rebuild corrupted index.

**Test method:** Memory service/provenance/decay/FTS suites plus desktop and server retrieval acceptance.

#### [SVC-025.1] Desktop search parity and index observability

Provide a compatible desktop database/index path or explicitly specify reduced search; surface index failure/rebuild diagnostics. **Targets:** A/B: Electron Node disables bun:sqlite FTS; C: Bun server has FTS.

**Code references:** [packages/server-core/src/memory/fts-index.ts:14–41](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/memory/fts-index.ts#L14-L41); [packages/server-core/src/memory/MemoryService.ts:1–75](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/memory/MemoryService.ts#L1-L75); [packages/server-core/src/memory/MemoryProposalStore.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/memory/MemoryProposalStore.ts#L1-L65).

**Requirements:** Older relevant lessons remain findable under offered full-text search.

**DoD:** Search results behave consistently on same corpus per target.

**Full functional verification:** Index a large known corpus and compare query recall on Electron and Bun.

**Test method:** FTS/retrieval integration in real desktop runtime and hosted server.

#### [SVC-025.2] Learning approval, deletion and migration

Test proposal approval/rejection, duplicate rule keys, decay, provenance, history export and workspace disable flags. **Targets:** A/B: Electron Node disables bun:sqlite FTS; C: Bun server has FTS.

**Code references:** [packages/server-core/src/memory/fts-index.ts:14–41](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/memory/fts-index.ts#L14-L41); [packages/server-core/src/memory/MemoryService.ts:1–75](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/memory/MemoryService.ts#L1-L75); [packages/server-core/src/memory/MemoryProposalStore.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/memory/MemoryProposalStore.ts#L1-L65).

**Requirements:** Unapproved or foreign lessons do not enter prompts.

**DoD:** Deletion removes authoritative record and all derived search entries.

**Full functional verification:** Approve/reject lessons, delete one, restart and inspect generated context.

**Test method:** Memory proposal/store/service tests plus prompt-context readback.

### [SVC-026] Mail provisioning, Stalwart/JMAP operations and signup integration

**Status:** Observed local pilot; hosted signup hook described as later. **Targets:** A/B: device-scoped mailbox credential; C: trusted signup/provisioning worker.

Complete actual hosted signup provisioning and operational mail infrastructure where mail is advertised. Keep Stalwart admin credential only on trusted server; verify account owner marker, app-password repair, JMAP send/read and external delivery.

**Code references:** [packages/shared/src/mail/provisioning.ts:2–18](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mail/provisioning.ts#L2-L18); [packages/shared/src/mail/provisioning.ts:46–72](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mail/provisioning.ts#L46-L72); [packages/shared/src/mail/jmap-client.ts:1–75](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mail/jmap-client.ts#L1-L75).

**Requirements:** Provisioning authorization, domain/mail transport/DNS, account ownership and quotas configured.

**DoD:** User receives a verified mailbox and can send/read real messages; retries do not adopt another owner's account.

**Full functional verification:** Create two accounts with colliding handles, revoke device app password, repair and send/receive externally.

**Test method:** Provisioning/JMAP fixtures plus real staging mailbox and delivery acceptance.

#### [SVC-026.1] Server-owned signup and account lifecycle

Wire authenticated account creation/deletion to durable provisioning worker; remove admin credential exposure from distributed client setup. **Targets:** A/B: device-scoped mailbox credential; C: trusted signup/provisioning worker.

**Code references:** [packages/shared/src/mail/provisioning.ts:2–18](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mail/provisioning.ts#L2-L18); [packages/shared/src/mail/provisioning.ts:46–72](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mail/provisioning.ts#L46-L72); [packages/shared/src/mail/jmap-client.ts:1–75](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mail/jmap-client.ts#L1-L75).

**Requirements:** Admin secrets unavailable to desktop/browser untrusted users.

**DoD:** Signup reliably provisions or shows recoverable pending/repair state.

**Full functional verification:** Concurrent signup with same handle and interrupted create/mint steps.

**Test method:** Worker/provisioning integration against staging Stalwart.

#### [SVC-026.2] JMAP capabilities, external delivery and device revocation

Verify session account identity, paging, attachments, send failures, SMTP/DNS configuration, app-password revoke and retention. **Targets:** A/B: device-scoped mailbox credential; C: trusted signup/provisioning worker.

**Code references:** [packages/shared/src/mail/provisioning.ts:2–18](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mail/provisioning.ts#L2-L18); [packages/shared/src/mail/provisioning.ts:46–72](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mail/provisioning.ts#L46-L72); [packages/shared/src/mail/jmap-client.ts:1–75](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mail/jmap-client.ts#L1-L75).

**Requirements:** Mailbox access scoped per device/account with operator diagnostics.

**DoD:** External recipient receives sent message and revoked device loses access.

**Full functional verification:** Send attachment both directions, revoke one device and retry.

**Test method:** JMAP contract tests plus external inbox delivery readback.

### [SVC-027] Encrypted account replica and cross-device synchronization

**Status:** Observed in-memory replica engine; production transport/durability gap. **Targets:** A/B: desktop enrollment/offline edits; C: durable account replica service.

AccountReplica stores memberships, devices, ops and offline queue in memory. Add production persistence/transport, server-authenticated membership, encrypted envelopes, device revocation, conflict handling and deletion propagation before claiming usable cloud sync.

**Code references:** [packages/shared/src/account-replica/replica.ts:1–4](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/account-replica/replica.ts#L1-L4); [packages/shared/src/account-replica/replica.ts:56–86](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/account-replica/replica.ts#L56-L86); [packages/shared/src/account-replica/replica.ts:273–283](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/account-replica/replica.ts#L273-L283).

**Requirements:** Encrypted durable per-account operations; excluded categories and explicit sync controls honored.

**DoD:** Two enrolled devices and browser can synchronize eligible content across restart without leaking excluded data.

**Full functional verification:** Edit offline on both devices, reconnect, resolve markdown conflict, revoke device and execute account deletion.

**Test method:** Replica crypto/tenancy tests plus two-device transport/restart acceptance.

#### [SVC-027.1] Durable replica API and account membership

Implement authenticated upload/download/cursor endpoints and persistent encrypted operation/device stores; do not trust caller bindWorkspace mutations. **Targets:** A/B: desktop enrollment/offline edits; C: durable account replica service.

**Code references:** [packages/shared/src/account-replica/replica.ts:1–4](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/account-replica/replica.ts#L1-L4); [packages/shared/src/account-replica/replica.ts:56–86](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/account-replica/replica.ts#L56-L86); [packages/shared/src/account-replica/replica.ts:273–283](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/account-replica/replica.ts#L273-L283).

**Requirements:** Membership managed by trusted server authority.

**DoD:** Restart preserves encrypted replica and unauthorized workspace denies.

**Full functional verification:** Restart sync service then request another account's op cursor.

**Test method:** Replica API/database fault and tenancy integration tests.

#### [SVC-027.2] Recovery, conflict resolution and deletion receipts

Implement recovery key UX, device key rotation/revoke, offline retries, markdown conflicts and complete deletion acknowledgements. **Targets:** A/B: desktop enrollment/offline edits; C: durable account replica service.

**Code references:** [packages/shared/src/account-replica/replica.ts:1–4](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/account-replica/replica.ts#L1-L4); [packages/shared/src/account-replica/replica.ts:56–86](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/account-replica/replica.ts#L56-L86); [packages/shared/src/account-replica/replica.ts:273–283](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/account-replica/replica.ts#L273-L283).

**Requirements:** Recovery/deletion semantics and excluded categories documented.

**DoD:** Conflicts are reviewable and revoked devices cannot upload/download.

**Full functional verification:** Lose a device, recover on new device and verify deletion on all peers.

**Test method:** Multi-device chaos and cryptographic recovery/deletion tests.

### [SVC-028] Organizations, team outbox and remote collaboration

**Status:** Observed no multi-user team API or remote push/pull. **Targets:** A/B: local team data migration; C: authoritative organization service.

Team sync always creates LocalOnlyTeamSyncAdapter; push accepts nothing and pull returns null. Organizations/invites are device-local and email delivery is not implemented. Build a real organization membership and team sync service for complete collaboration.

**Code references:** [packages/shared/src/team/sync.ts:4–10](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/team/sync.ts#L4-L10); [packages/shared/src/team/sync.ts:37–58](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/team/sync.ts#L37-L58); [packages/shared/src/orgs/storage.ts:340–367](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/orgs/storage.ts#L340-L367).

**Requirements:** Authenticated org roles, targeted invites, shared comments/assignments/handoffs/access/approvals/activity and durable cursors.

**DoD:** Two users on different devices see synchronized authorized state and revocation removes access.

**Full functional verification:** Invite second user remotely, comment/assign/handoff offline, reconnect and revoke their membership.

**Test method:** Org/team store tests plus multi-user server transport acceptance.

#### [SVC-028.1] Organization authority and targeted invite redemption

Implement durable org/membership/role endpoints and account-bound expiring one-time invites with actual delivery. **Targets:** A/B: local team data migration; C: authoritative organization service.

**Code references:** [packages/shared/src/team/sync.ts:4–10](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/team/sync.ts#L4-L10); [packages/shared/src/team/sync.ts:37–58](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/team/sync.ts#L37-L58); [packages/shared/src/orgs/storage.ts:340–367](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/orgs/storage.ts#L340-L367).

**Requirements:** Renderer/local profile cannot select arbitrary member identity.

**DoD:** Only intended user can redeem invite and roles enforce permissions.

**Full functional verification:** Try wrong account, expired token, duplicate redemption and last-owner removal.

**Test method:** Organization API invite/RBAC adversarial tests.

#### [SVC-028.2] Outbox synchronization and concurrent updates

Add real TeamSyncAdapter push/pull with idempotent entry IDs, cursors, merge policy and visibility-scoped events. **Targets:** A/B: local team data migration; C: authoritative organization service.

**Code references:** [packages/shared/src/team/sync.ts:4–10](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/team/sync.ts#L4-L10); [packages/shared/src/team/sync.ts:37–58](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/team/sync.ts#L37-L58); [packages/shared/src/orgs/storage.ts:340–367](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/orgs/storage.ts#L340-L367).

**Requirements:** Accepted entries are acknowledged only after durable server write.

**DoD:** Offline entries sync once and conflicts remain visible.

**Full functional verification:** Edit same task/comment on two users; drop/replay network responses.

**Test method:** Outbox protocol and multi-user browser/desktop integration.

### [SVC-029] Session collaboration links, presence and public publication gates

**Status:** Observed local invite service and disabled public publication helper. **Targets:** A/B: account authenticated client; C: actual bro/share service.

Certify a real cross-device bro.rox.one join route, presence, editor/viewer ACLs, conflict resolution and revocation. Public publication is explicitly DG03_GATED; retain gate until retention, abuse and deletion SLA are fulfilled across every share mechanism.

**Code references:** [packages/server-core/src/collaboration/bro-invite-service.ts:37–61](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/collaboration/bro-invite-service.ts#L37-L61); [packages/shared/src/collaboration/invite.ts:5–12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/collaboration/invite.ts#L5-L12); [packages/shared/src/collaboration/publication.ts:1–8](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/collaboration/publication.ts#L1-L8); [packages/shared/src/collaboration/store.ts:23–25](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/collaboration/store.ts#L23-L25).

**Requirements:** Collaboration requires membership; public sharing has approved visibility, expiry, redaction and deletion semantics.

**DoD:** Remote invited user joins only intended session; revoked access and deleted publication cease immediately.

**Full functional verification:** Open invite on another account/device, edit simultaneously, revoke and test an old public/share URL.

**Test method:** Invite/presence/conflict/publication tests plus actual hosted routes and readback.

#### [SVC-029.1] Hosted join/presence/permission enforcement

Wire link redemption and session transport to authoritative account identity with viewer/editor permissions and heartbeat expiry. **Targets:** A/B: account authenticated client; C: actual bro/share service.

**Code references:** [packages/server-core/src/collaboration/bro-invite-service.ts:37–61](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/collaboration/bro-invite-service.ts#L37-L61); [packages/shared/src/collaboration/invite.ts:5–12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/collaboration/invite.ts#L5-L12); [packages/shared/src/collaboration/publication.ts:1–8](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/collaboration/publication.ts#L1-L8); [packages/shared/src/collaboration/store.ts:23–25](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/collaboration/store.ts#L23-L25).

**Requirements:** One-time join and session scope enforced server-side.

**DoD:** Viewer cannot mutate or execute; stale presence expires.

**Full functional verification:** Invite viewer/editor, replay link, disconnect and revoke mid-session.

**Test method:** Bro service/API/WebSocket collaboration acceptance.

#### [SVC-029.2] Unify public sharing gates and retention

Audit collaboration publication, session share, pages and cloud share routes; apply release gate/redaction/TTL/deletion consistently. **Targets:** A/B: account authenticated client; C: actual bro/share service.

**Code references:** [packages/server-core/src/collaboration/bro-invite-service.ts:37–61](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/collaboration/bro-invite-service.ts#L37-L61); [packages/shared/src/collaboration/invite.ts:5–12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/collaboration/invite.ts#L5-L12); [packages/shared/src/collaboration/publication.ts:1–8](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/collaboration/publication.ts#L1-L8); [packages/shared/src/collaboration/store.ts:23–25](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/collaboration/store.ts#L23-L25).

**Requirements:** No alternate public route bypasses blocked publication policy.

**DoD:** Expiry/revoke/delete remove access and preserve safe audit evidence.

**Full functional verification:** Publish allowed test content, revoke and inspect CDN/object/API access.

**Test method:** Share route integration with retention/deletion and secret-sentinel tests.

### [SVC-030] Marketplace catalog, signed packages and installation lifecycle

**Status:** Existing signed catalog/cache path; external catalog ownership verification required. **Targets:** A/B: local install/executable permissions; C: hosted workspace installs only.

Validate the default catalog endpoint still points to agisota/craft-agents-oss and define final ROX catalog ownership, signing trust roots and publication process. Certify install/update/remove/rollback and project/skill/source integration.

**Code references:** [packages/shared/src/marketplace/catalog.ts:374–400](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/marketplace/catalog.ts#L374-L400); [packages/shared/src/marketplace/catalog.ts:508–546](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/marketplace/catalog.ts#L508-L546); [packages/shared/src/marketplace/installer.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/marketplace/installer.ts#L1-L85).

**Requirements:** Catalog and packages have authenticated provenance, immutable version/digest and permitted execution capabilities.

**DoD:** Verified supported package installs work on every execution host; invalid signatures fail without partial mutation.

**Full functional verification:** Refresh catalog online/offline, install/update/remove package, corrupt signature and interrupt install.

**Test method:** Marketplace catalog/signing/installer/lock suites plus real signed release acceptance.

#### [SVC-030.1] Own catalog publication and key rotation

Publish ROX catalog/digest/signature using managed signing keys; define pinned trusted keys, revocation and catalog rollback policy. **Targets:** A/B: local install/executable permissions; C: hosted workspace installs only.

**Code references:** [packages/shared/src/marketplace/catalog.ts:374–400](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/marketplace/catalog.ts#L374-L400); [packages/shared/src/marketplace/catalog.ts:508–546](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/marketplace/catalog.ts#L508-L546); [packages/shared/src/marketplace/installer.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/marketplace/installer.ts#L1-L85).

**Requirements:** Distributed app trusts controlled signing authority.

**DoD:** Tampered/untrusted/regressed catalog rejected; trusted rotation succeeds.

**Full functional verification:** Serve modified body/signature and rotate a catalog key in staging.

**Test method:** Catalog signature/version/caching contract tests.

#### [SVC-030.2] Install lifecycle, permissions and dependency resolution

Verify git/npm/toolchain sources, lockfiles, denied network/exec grants, filesystem staging and removal without deleting user content. **Targets:** A/B: local install/executable permissions; C: hosted workspace installs only.

**Code references:** [packages/shared/src/marketplace/catalog.ts:374–400](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/marketplace/catalog.ts#L374-L400); [packages/shared/src/marketplace/catalog.ts:508–546](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/marketplace/catalog.ts#L508-L546); [packages/shared/src/marketplace/installer.ts:1–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/marketplace/installer.ts#L1-L85).

**Requirements:** Hosted installs restricted to authorized tenant workspace.

**DoD:** Interrupted installs roll back and installed tools actually execute.

**Full functional verification:** Install one real source/skill/runtime, interrupt update and rerun.

**Test method:** Installer/resource/toolchain integration with packaged hosts.

### [SVC-031] Projects, resource bundles and portable workspace data

**Status:** Existing disk-backed CRUD and staged imports; portability/tenancy certification required. **Targets:** A: Windows paths/ACLs; B: macOS paths; C: server workspace upload/download.

Certify project creation/rename/delete, assets/context and source/skill/automation bundle portability. A hosted browser imports to server workspace and downloads exported data; it cannot directly read arbitrary desktop paths.

**Code references:** [packages/shared/src/projects/storage.ts:2–8](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/projects/storage.ts#L2-L8); [packages/shared/src/projects/storage.ts:39–57](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/projects/storage.ts#L39-L57); [packages/shared/src/resources/resource-bundle.ts:4–13](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/resources/resource-bundle.ts#L4-L13).

**Requirements:** Project path containment, quotas and grants; bundles exclude secrets and reset auth correctly.

**DoD:** Portable export/import preserves valid content while clearing runtime credentials and refreshing watchers.

**Full functional verification:** Create project/assets, move/export to another platform, import conflicting resources and verify source reconnect.

**Test method:** Project/resource/bundle path tests plus real cross-platform round trip.

#### [SVC-031.1] Project CRUD and filesystem containment

Validate slugs, absolute/relative root mapping, symlink/case collisions, non-ASCII names and deletion scope. **Targets:** A: Windows paths/ACLs; B: macOS paths; C: server workspace upload/download.

**Code references:** [packages/shared/src/projects/storage.ts:2–8](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/projects/storage.ts#L2-L8); [packages/shared/src/projects/storage.ts:39–57](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/projects/storage.ts#L39-L57); [packages/shared/src/resources/resource-bundle.ts:4–13](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/resources/resource-bundle.ts#L4-L13).

**Requirements:** No crafted project/asset path escapes workspace.

**DoD:** Assets/context persist and delete affects only selected project.

**Full functional verification:** Use traversal, drive/UNC paths and symlink targets; restart after changes.

**Test method:** Project storage path/migration tests and native filesystem acceptance.

#### [SVC-031.2] Bundle staging, redaction and overwrite recovery

Verify import staging/rename, watcher notification, source credential deletion and automation retry/history reset with explicit overwrite behavior. **Targets:** A: Windows paths/ACLs; B: macOS paths; C: server workspace upload/download.

**Code references:** [packages/shared/src/projects/storage.ts:2–8](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/projects/storage.ts#L2-L8); [packages/shared/src/projects/storage.ts:39–57](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/projects/storage.ts#L39-L57); [packages/shared/src/resources/resource-bundle.ts:4–13](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/resources/resource-bundle.ts#L4-L13).

**Requirements:** Bundle/file caps and secret stripping apply to every file/type.

**DoD:** Interrupted import leaves recoverable state and no secret-bearing export.

**Full functional verification:** Export sentinel credentials, import over active resources and interrupt rename.

**Test method:** Resource import/export and filesystem failure-injection tests.

### [SVC-032] Pages, custom views and mediated source actions

**Status:** Existing lease/grant broker; cross-runtime production wiring verification required. **Targets:** A/B: desktop page host; C: sandboxed browser page/server broker.

Certify page persistence/data refresh/publishing, view evaluation and source actions through content-bound leases/grants. Generated page JavaScript must not directly access sources, secrets, host filesystem or unscoped server RPC.

**Code references:** [packages/shared/src/pages/action-bridge.ts:4–28](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/pages/action-bridge.ts#L4-L28); [packages/shared/src/pages/action-bridge.ts:55–75](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/pages/action-bridge.ts#L55-L75); [packages/shared/src/views/evaluator.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/views/evaluator.ts#L1-L65).

**Requirements:** Sandbox, owner/frame binding, schema/timeout/rate/replay limits and approved source policies enforced.

**DoD:** Page read/action/refresh works; stale digest, nonce, replay and foreign workspace requests reject.

**Full functional verification:** Create an interactive page with API/MCP/script action, edit its content, reuse old grant and exercise from hosted browser.

**Test method:** Page action/data/share/view evaluator suites plus actual iframe/browser integration.

#### [SVC-032.1] Page broker execution and frame ownership

Bind lease/action requests to authenticated owner and real renderer frame, and validate source grants after lease/grant matching. **Targets:** A/B: desktop page host; C: sandboxed browser page/server broker.

**Code references:** [packages/shared/src/pages/action-bridge.ts:4–28](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/pages/action-bridge.ts#L4-L28); [packages/shared/src/pages/action-bridge.ts:55–75](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/pages/action-bridge.ts#L55-L75); [packages/shared/src/views/evaluator.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/views/evaluator.ts#L1-L65).

**Requirements:** Grant revocation/source disable affects active page immediately.

**DoD:** Malicious iframe cannot invoke another page's source action.

**Full functional verification:** Swap frame/page/session IDs, replay nonce/request and revoke source.

**Test method:** Broker/source-gate/MCP/script executor integration tests.

#### [SVC-032.2] Data refresh, views and publishing readback

Test filter/slice evaluation, refresh concurrency, saved data edits, bundle publication and browser export against actual server persistence. **Targets:** A/B: desktop page host; C: sandboxed browser page/server broker.

**Code references:** [packages/shared/src/pages/action-bridge.ts:4–28](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/pages/action-bridge.ts#L4-L28); [packages/shared/src/pages/action-bridge.ts:55–75](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/pages/action-bridge.ts#L55-L75); [packages/shared/src/views/evaluator.ts:1–65](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/views/evaluator.ts#L1-L65).

**Requirements:** No evaluated custom expression escapes allowed operations.

**DoD:** Saved page/view returns identical content after restart and exported version works.

**Full functional verification:** Refresh while editing, reopen custom views and import/share bundle.

**Test method:** View/data-store/publisher tests plus live client readback.

### [SVC-033] Code intelligence and optional SBOM services

**Status:** Implemented local symbol index; Syft missing returns skipped scan. **Targets:** A/B: authorized local repositories; C: server-uploaded/checked-out repositories.

Certify ingestion boundaries, source provenance, citations, generated explanations and selected local-fs-symbols/syft-sbom capability states. Optional Syft absence must remain an honest skipped result, not a clean security or completed scan claim.

**Code references:** [packages/shared/src/code-intelligence/local-adapter.ts:1–84](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/code-intelligence/local-adapter.ts#L1-L84); [packages/shared/src/code-intelligence/sbom.ts:1–23](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/code-intelligence/sbom.ts#L1-L23); [packages/shared/src/code-intelligence/explainer.ts:30–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/code-intelligence/explainer.ts#L30-L49).

**Requirements:** Supported languages/size limits and repository access grants documented; output citations match checked-out revision.

**DoD:** Index/explain/navigation and supported SBOM output function on authorized repos without private data leakage.

**Full functional verification:** Index fixtures and a real repo, edit files, follow citations, deny a foreign path and remove Syft.

**Test method:** Code-intelligence adapter/explainer/SBOM tests plus actual installed tool acceptance.

#### [SVC-033.1] Index correctness and source ownership

Validate excluded paths/binaries, file changes, language coverage, source root containment and revision provenance. **Targets:** A/B: authorized local repositories; C: server-uploaded/checked-out repositories.

**Code references:** [packages/shared/src/code-intelligence/local-adapter.ts:1–84](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/code-intelligence/local-adapter.ts#L1-L84); [packages/shared/src/code-intelligence/sbom.ts:1–23](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/code-intelligence/sbom.ts#L1-L23); [packages/shared/src/code-intelligence/explainer.ts:30–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/code-intelligence/explainer.ts#L30-L49).

**Requirements:** Every symbol explanation references real source position/revision.

**DoD:** Updating/deleting code invalidates stale symbols/citations.

**Full functional verification:** Edit/delete indexed functions, query and open all citations.

**Test method:** Fixture corpus and filesystem watcher/index integration.

#### [SVC-033.2] Syft discovery, availability and real output

Define opt-in supported Syft versions per OS/server and parse/validate actual SBOM artifacts. **Targets:** A/B: authorized local repositories; C: server-uploaded/checked-out repositories.

**Code references:** [packages/shared/src/code-intelligence/local-adapter.ts:1–84](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/code-intelligence/local-adapter.ts#L1-L84); [packages/shared/src/code-intelligence/sbom.ts:1–23](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/code-intelligence/sbom.ts#L1-L23); [packages/shared/src/code-intelligence/explainer.ts:30–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/code-intelligence/explainer.ts#L30-L49).

**Requirements:** Missing tool visibly unavailable; successful output structurally valid.

**DoD:** Installed scanner produces artifact that can be opened/exported.

**Full functional verification:** Run with no Syft then with supported binary against real repo.

**Test method:** Runner contract tests plus native Syft smoke.

### [SVC-034] Environment preferences, OS discovery and git execution

**Status:** Observed macOS-specific default local folders; platform gap. **Targets:** A: Windows app/Telegram discovery; B: macOS access controls; C: server filesystem only.

Default 'applications' and 'telegram-support' sources are folder pointers using macOS paths and connected status without existence validation. Implement platform-aware defaults and ensure saved environment choices actually control model/audio/browser/runtime placement and git behavior.

**Code references:** [packages/shared/src/sources/default-microservices.ts:117–126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/default-microservices.ts#L117-L126); [packages/shared/src/sources/default-microservices.ts:76–96](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/default-microservices.ts#L76-L96); [packages/shared/src/environment/storage.ts:1–33](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/environment/storage.ts#L1-L33); [packages/shared/src/git/exec.ts:1–60](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/git/exec.ts#L1-L60).

**Requirements:** Actual existence/access/capability drives status; local vs hosted filesystem and placement choices are explicit.

**DoD:** Windows defaults point to usable locations; unavailable data is shown accurately; preference changes affect runtime behavior.

**Full functional verification:** Fresh startup per OS/server, deny folder access, change placement preferences and execute git in path with spaces.

**Test method:** Default-source/environment/git tests plus native host acceptance.

#### [SVC-034.1] Correct local source paths and connection status

Select Windows/macOS/server roots; validate exists/read access before reporting connected; avoid representing folder pointers as live importers. **Targets:** A: Windows app/Telegram discovery; B: macOS access controls; C: server filesystem only.

**Code references:** [packages/shared/src/sources/default-microservices.ts:117–126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/default-microservices.ts#L117-L126); [packages/shared/src/sources/default-microservices.ts:76–96](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/default-microservices.ts#L76-L96); [packages/shared/src/environment/storage.ts:1–33](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/environment/storage.ts#L1-L33); [packages/shared/src/git/exec.ts:1–60](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/git/exec.ts#L1-L60).

**Requirements:** No false connected status or implicit personal-directory exposure.

**DoD:** Missing applications/Telegram folder yields clear unavailable source.

**Full functional verification:** Boot fresh Windows/macOS/container and inspect seeded configs/status.

**Test method:** Source seeder/path tests with actual native directory permissions.

#### [SVC-034.2] Apply environment rules and safe git runtime

Trace questionnaire model/STT/TTS/browser/agent choices to execution; validate git executable, credential helper, cancellation and command quoting. **Targets:** A: Windows app/Telegram discovery; B: macOS access controls; C: server filesystem only.

**Code references:** [packages/shared/src/sources/default-microservices.ts:117–126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/default-microservices.ts#L117-L126); [packages/shared/src/sources/default-microservices.ts:76–96](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/default-microservices.ts#L76-L96); [packages/shared/src/environment/storage.ts:1–33](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/environment/storage.ts#L1-L33); [packages/shared/src/git/exec.ts:1–60](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/git/exec.ts#L1-L60).

**Requirements:** Unanswered/skipped choices preserve defined defaults.

**DoD:** Saved rules and placement affect new sessions and git uses authorized repo.

**Full functional verification:** Change preferences, start session, run status/diff in Unicode/space path.

**Test method:** Environment/config and git subprocess integration matrix.

### [SVC-035] Command gateway and privileged execution authorization

**Status:** Existing pending store and approval broker; persistent execution semantics verification required. **Targets:** A: Windows elevation/UAC; B: macOS privileged prompts; C: restrict server escalation.

Certify restart-safe pending commands, exact command-hash approvals, policy/expiry and execution readback across sessions/tasks/messaging/pages. Privileged broker audits raw command text: enforce secret redaction before persistence.

**Code references:** [packages/server-core/src/command-gateway/pending-commands.ts:2–8](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/command-gateway/pending-commands.ts#L2-L8); [packages/server-core/src/services/privileged-execution-broker.ts:35–83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/services/privileged-execution-broker.ts#L35-L83); [packages/server-core/src/services/privileged-execution-broker.ts:88–112](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/services/privileged-execution-broker.ts#L88-L112).

**Requirements:** Approvals scoped to authenticated user/workspace/session and exact immutable command; no generic privilege bypass.

**DoD:** Denied/expired/replayed/mismatched approval never executes; approved effect produces durable accurate receipt.

**Full functional verification:** Approve a harmless command, restart before execution, mutate payload, replay approval and test timeout/elevation denial.

**Test method:** Pending-command/privileged-policy/broker suites plus actual OS permission scenarios.

#### [SVC-035.1] Bind authorization and persist execution outcomes

Link pending decision to originating execution owner/hash and persist consumed/executed outcome/idempotency receipt. **Targets:** A: Windows elevation/UAC; B: macOS privileged prompts; C: restrict server escalation.

**Code references:** [packages/server-core/src/command-gateway/pending-commands.ts:2–8](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/command-gateway/pending-commands.ts#L2-L8); [packages/server-core/src/services/privileged-execution-broker.ts:35–83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/services/privileged-execution-broker.ts#L35-L83); [packages/server-core/src/services/privileged-execution-broker.ts:88–112](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/services/privileged-execution-broker.ts#L88-L112).

**Requirements:** Restart cannot replay one approved non-idempotent command.

**DoD:** Approved command executes once with truthful result and denied command never runs.

**Full functional verification:** Crash after approval/effect and relaunch executor.

**Test method:** Command gateway/broker crash-recovery integration.

#### [SVC-035.2] Platform elevation and audit redaction

Define supported UAC/macOS privilege path and hosted restricted policy; redact secrets in command/audit/log data. **Targets:** A: Windows elevation/UAC; B: macOS privileged prompts; C: restrict server escalation.

**Code references:** [packages/server-core/src/command-gateway/pending-commands.ts:2–8](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/command-gateway/pending-commands.ts#L2-L8); [packages/server-core/src/services/privileged-execution-broker.ts:35–83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/services/privileged-execution-broker.ts#L35-L83); [packages/server-core/src/services/privileged-execution-broker.ts:88–112](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/services/privileged-execution-broker.ts#L88-L112).

**Requirements:** No server root escalation via generic user tool; safe audit retention.

**DoD:** Blocked operations show accurate reasons without secret disclosure.

**Full functional verification:** Use sentinel secret in command, deny OS prompt and inspect logs.

**Test method:** Privileged broker/redaction tests plus native elevation acceptance.

### [SVC-036] Gamification, quests and account balance correctness

**Status:** Existing local state; no billing API implied by local balance. **Targets:** A/B: local persistence; C: per-account state and authoritative balance.

Certify XP events, quests, ratings and consent independently of account billing. Local balance is explicitly nullable without billing API; connect real account balance only through authenticated ROX service readback and prevent global hosted gamification state leakage.

**Code references:** [packages/shared/src/gamification/storage.ts:32–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/gamification/storage.ts#L32-L49); [packages/shared/src/gamification/quests.ts:1–80](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/gamification/quests.ts#L1-L80); [packages/shared/src/auth/rox-cloud.ts:136–155](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/auth/rox-cloud.ts#L136-L155).

**Requirements:** XP/quest award rules idempotent and account-scoped; billing values authoritative; analytics consent enforced.

**DoD:** User progress persists without duplicate rewards and unrelated users never share state.

**Full functional verification:** Complete a quest twice, retry event after restart, change consent and compare displayed balance to real service.

**Test method:** Gamification/quest/auth tests plus two-account runtime acceptance.

#### [SVC-036.1] Per-account progress and idempotent rewards

Scope config storage for hosted accounts and use stable event/quest completion keys. **Targets:** A/B: local persistence; C: per-account state and authoritative balance.

**Code references:** [packages/shared/src/gamification/storage.ts:32–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/gamification/storage.ts#L32-L49); [packages/shared/src/gamification/quests.ts:1–80](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/gamification/quests.ts#L1-L80); [packages/shared/src/auth/rox-cloud.ts:136–155](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/auth/rox-cloud.ts#L136-L155).

**Requirements:** Retries cannot grant repeated XP for one completed action.

**DoD:** Two accounts retain distinct quests and ratings after restart.

**Full functional verification:** Replay completed event and log in as another hosted user.

**Test method:** Gamification state/retry/isolation integration tests.

#### [SVC-036.2] Balance and analytics consent integration

Use authenticated cloud balance where offered; show unavailable when no authoritative billing integration; gate analytics transmission. **Targets:** A/B: local persistence; C: per-account state and authoritative balance.

**Code references:** [packages/shared/src/gamification/storage.ts:32–49](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/gamification/storage.ts#L32-L49); [packages/shared/src/gamification/quests.ts:1–80](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/gamification/quests.ts#L1-L80); [packages/shared/src/auth/rox-cloud.ts:136–155](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/auth/rox-cloud.ts#L136-L155).

**Requirements:** No fabricated credits and no analytics when consent is false.

**DoD:** UI balance matches service and toggled-off consent stops sends.

**Full functional verification:** Inspect balance response/UI and network requests after consent revoke.

**Test method:** Balance contract and consent egress tests.

### [SVC-037] Managed OpenClaw runtime and audit collectors

**Status:** Observed Windows audit process deliberately unsupported pending Job Object ownership. **Targets:** A: implement native job ownership or expose unsupported audit; B: owned POSIX child; C: tenant-owned runtime.

Certify install/config/runtime ownership, credential storage, port blocks, health, audit collectors, redaction, stop/restart and persistence. Windows collectors explicitly refuse to spawn audit children until native Job Object ownership is available.

**Code references:** [packages/server-core/src/openclaw/collectors.ts:158–175](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/openclaw/collectors.ts#L158-L175); [packages/server-core/src/openclaw/collectors.ts:326–345](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/openclaw/collectors.ts#L326-L345); [packages/server-core/src/openclaw/runtime-manager.ts:807–825](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/openclaw/runtime-manager.ts#L807-L825).

**Requirements:** Runtime and audit dependencies actually shipped; process ownership and supported platform capability truthful.

**DoD:** Managed runtime starts/stops/restarts without foreign process control; supported audit produces real bounded evidence.

**Full functional verification:** Install runtime in clean workspace, start, audit, crash/restart, deny credentials and check orphan processes.

**Test method:** OpenClaw collector/audit/runtime-manager suites plus actual managed runtime acceptance.

#### [SVC-037.1] Close Windows audit process ownership gap

Implement native Windows Job Object child-tree lifecycle or mark audit unavailable in final Windows capability matrix. **Targets:** A: implement native job ownership or expose unsupported audit; B: owned POSIX child; C: tenant-owned runtime.

**Code references:** [packages/server-core/src/openclaw/collectors.ts:158–175](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/openclaw/collectors.ts#L158-L175); [packages/server-core/src/openclaw/collectors.ts:326–345](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/openclaw/collectors.ts#L326-L345); [packages/server-core/src/openclaw/runtime-manager.ts:807–825](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/openclaw/runtime-manager.ts#L807-L825).

**Requirements:** No unsupported spawn until safe ownership exists.

**DoD:** Audit succeeds when supported and leaves no descendant process.

**Full functional verification:** Run audit spawning grandchildren, cancel/timeout/parent exit on Windows.

**Test method:** Collector/native ownership tests and Windows process inspection.

#### [SVC-037.2] Runtime health, config and credential recovery

Verify port conflicts, launch nonce, owner checks, protected gateway token, crash budget and safe bounded output. **Targets:** A: implement native job ownership or expose unsupported audit; B: owned POSIX child; C: tenant-owned runtime.

**Code references:** [packages/server-core/src/openclaw/collectors.ts:158–175](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/openclaw/collectors.ts#L158-L175); [packages/server-core/src/openclaw/collectors.ts:326–345](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/openclaw/collectors.ts#L326-L345); [packages/server-core/src/openclaw/runtime-manager.ts:807–825](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/openclaw/runtime-manager.ts#L807-L825).

**Requirements:** Foreign/stale runtime nonce cannot control current child.

**DoD:** Restart reconciles persisted runtime state and exposes failed health accurately.

**Full functional verification:** Crash child, occupy port, revoke token and stop wrong workspace runtime.

**Test method:** Runtime manager/audit tests plus real gateway health/readback.

## [SVC-COVERAGE] Module ownership and acceptance mapping

| Source module / surface | Primary task coverage | Required service-level result |
|---|---|---|
| `server`, `server-core/bootstrap`, `webui`, `transport`, `security` | SVC-001–003 | Authenticated persistent service; account isolation; reconnect/capability parity. |
| `shared/agent/backend`, Claude/Pi/OMP agents, `pi-agent-server` | SVC-004–006 | Real provider conversations/tools/abort and runtime cleanup. |
| `shared/sources`, `shared/mcp`, `session-tools-core`, `session-mcp-server` | SVC-007–008 | All declared tools invoke authorized live integrations. |
| `credentials`, `credentials/fabric`, `secrets`, `auth`, workgraph imports | SVC-009–011 | Protected storage, grants, rotation and owner-bound authorization. |
| `cloud-runner`, `handlers/rpc/cloud-runs`, `cloud-gateway` | SVC-012–015 | Truthful results, spend gates, restart-safe runs and provider retirement. |
| `messaging-gateway`, WhatsApp/Discord worker packages | SVC-016–021 | Owner-authorized reliable delivery and platform-specific pairing/media/reconnect. |
| `automations`, `scheduler`, `tasks`, `workflows`, meeting-followup actions | SVC-022–023 | Defined side-effect semantics; durable receipts; schedules and resume. |
| `knowledge`, `shared/knowledge`, notes/vault bridge | SVC-024 | Approved real provider, supervised kernel and reviewable recoverable writes. |
| `memory`, lessons/episodic/FTS/skills pending queues | SVC-025 | Scoped learning and usable indexed retrieval on offered targets. |
| `shared/mail` | SVC-026 | Trusted mailbox provisioning plus real send/receive and revocation. |
| `account-replica` | SVC-027 | Encrypted durable cross-device sync, recovery and deletion. |
| `orgs`, `team`, `collaboration` | SVC-028–029 | Actual remote team state and scoped collaboration/publication. |
| `marketplace`, catalog/lock/signing/stats, toolchain integrations | SVC-030 | Signed controlled catalog, truthful stale/available states and working installs. |
| `projects`, `resources`, workspaces/data portability | SVC-031 | Contained CRUD/assets and secret-safe portable bundles. |
| `pages`, `views`, script/MCP page executors | SVC-032 | Sandboxed interactive pages, mediated grants and persisted views. |
| `code-intelligence` | SVC-033 | Correct source citations and actual optional SBOM output. |
| `environment`, `os`, `git`, default source folders | SVC-034 | Platform-aware choices, real accessible folders and safe repo commands. |
| `command-gateway`, privileged execution broker | SVC-035 | Exact-owner approval, immutable command binding and durable execution result. |
| `gamification`, quests/ratings, cloud balance | SVC-036 | Account-scoped progress, consent and authoritative billing display. |
| `openclaw` runtime/audit | SVC-037 | Owned process lifecycle and honest supported audit capability. |
| `kanban`, `side-threads` | SVC-023, SVC-028, SVC-031; screen backlog | Kanban has browser-safe pure config separate from disk storage; side-thread actions are prompt contracts. Persisted session/task/team operations and real backend execution must be verified, with full UI journeys in the screen backlog. |

**Additional mapping sources:** [packages/shared/src/kanban/browser.ts:1–17](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/kanban/browser.ts#L1-L17); [packages/shared/src/side-threads/prompts.ts:1–23](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/side-threads/prompts.ts#L1-L23).

## [SVC-VERIFY] Service audit acceptance record

Before calling this backlog complete as an implementation program, record for each task/subtask: owner, target, build SHA, environment, fixture/live provider, commands, result, output/readback artifact and unresolved limits. Run existing relevant suites using `bun test <actual test paths>`; use package scripts for packages that provide `typecheck`/`validate`. A test that substitutes MemoryDaytonaClient, fake workflow gateways, stub runner, local-only team adapter or in-memory replica cannot satisfy the live functional DoD. Verify deployed account integrations only in dedicated authorized test accounts; paid provider acceptance belongs to the later implementation/release phase.

The companion integration/test/recheck backlog supplies cross-module journeys and final Windows 10/11, macOS and hosted web release gates. Service owners must link their evidence into those gates after all component DoDs pass.
