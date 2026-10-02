# [PLATFORM] Windows, macOS, and hosted web release readiness

Audit baseline: `rox-one/rox-one` at `f63294ba4fffa7238b46b24e918925a313ad0b12`. This is a source audit and implementation backlog. A configured packaging target, a unit test, or a development build is not evidence that the shipped installer works on a clean target computer. No Windows installation, notarized macOS release, or hosted deployment was performed for this document.

**Status vocabulary:** **Confirmed gap** means the referenced source demonstrates absent behavior or contradictory configuration. **Verification gap** means implementation exists but final artifact behavior still needs proof. **Product decision** means support must be made explicit before declaring a final release. **P0** blocks a usable or safe final release; **P1** blocks complete supported feature quality; **P2** improves release operations.

## [PLATFORM-BASELINE] What actually ships and what must be provisioned

| Surface/runtime | Source evidence | Current guarantee and remaining obligation |
| --- | --- | --- |
| Desktop shell | [electron-builder.yml:1–12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L1-L12), [targets:119–131,198–205](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L119-L131) | Electron `39.2.7`; macOS arm64/x64 DMG and ZIP; Windows x64 NSIS. Windows arm64 is not a configured target. |
| Agent runtime | [runtime resolver:73–91,129–156,229–237](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/internal/runtime-resolver.ts#L73-L91), [build constants:37–44](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/build/common.ts#L37-L44) | Bundled Bun `1.3.9`, thin Claude SDK plus target-native `claude`/`claude.exe`, separate ripgrep, Pi helper, interceptor, extension-host worker. Installed developer executables must not conceal missing package files. |
| Document tools | [files:42–66](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L42-L66), [uv installer:175–270](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/build/common.ts#L175-L270) | Python scripts and Unix/Windows wrappers for markitdown, PDF, XLSX, DOCX, PPTX, images, calendar, and document diff. uv `0.10.6` provisioning exists; a wrapper's presence does not prove its Python runtime/dependencies are ready. |
| Managed toolchain | [platform matrix:33–88](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/toolchain/manifest-data.ts#L33-L88) | OMP, Python, Node, FFmpeg, Pandoc, gh, jq, yq, Bun, uv, just, fzf, mise, worktrunk and selected npm tools support macOS arm64/x64, Linux x64, Windows x64 in the manifest. Windows Git is managed; macOS/Linux Git is system-provided. Optional tools include Infisical, OpenClaw, agent-browser and other marketplace entries; Docker/Homebrew are detected, not automatically installed. Publish the exact default/optional prerequisite contract. |
| Local audio | [local-asr.ts:14–63,97–104](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/meetings/local-asr.ts#L14-L63) | Meeting ASR expects `whisper-cli` or `whisper-cpp`, FFmpeg, a local ggml model and optionally adjacent FFprobe. This is a separate requirement from the manifest's FFmpeg entry. Windows executable suffix handling is absent in this detector. |
| Native database and embeddings | [mac resources:144–153](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L144-L153), [external native imports:398–403](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/electron-build-main.ts#L398-L403) | Mac resources hardcode the arm64 libSQL package even for x64 output. Windows resources contain no equivalent libSQL entry. `onnxruntime-node` and `sharp` are externalized by the canonical main build, so enabled features require real native dependency files and their transitive libraries in the artifact. |
| Messaging subprocesses | [packaged workers:154–159,229–234](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L154-L159), [server worker paths:161–169](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L161-L169) | WhatsApp and Discord workers ship separately; the headless service explicitly requires Node for these workers. Bundle, resolve, and execute these files in their actual post-install location. |
| Rust substrate | [non-Unix main:64–68](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/native/apps/craft-native/src/main.rs#L64-L68), [local-only distribution:552–565](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/toolchain/manifest-data.ts#L552-L565) | Unix sidecar is optional and seeded from local Cargo/env binaries; no published release tarballs are recorded. Windows native sidecar is unsupported. The TypeScript path can remain the supported implementation if its complete equivalence is established. |
| Full web application | [web App.tsx:1–24,88–156](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/App.tsx#L1-L24), [server webui setup:119–158](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L119-L158) | `apps/webui` reuses the Electron renderer with a browser adapter and cookie-authenticated WebSocket RPC to a real headless server. It needs a stateful backend and agent workers, not just static assets. Several desktop methods are no-ops or unsupported. |
| Session viewer | [viewer routes:1–9,85–116](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/viewer/src/App.tsx#L1-L9), [viewer proxy:36–43](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/viewer/vite.config.ts#L36-L43) | Separate read-only transcript/upload surface with `/s/{id}` and `/s/api/{id}`. Its development proxy targets `agents.rox.one`; deploying the viewer alone does not deploy the full application or establish a production sharing API. |

## [WIN] Windows 10 / Windows 11

### [WIN-001] P0 — Establish a reproducible Windows x64 release build

**Confirmed gap / verification gap.** The PowerShell build independently bundles main/preload/renderer and copies assets, whereas the canonical main script also builds Pi, messaging workers, interceptor and extension-host artifacts. The PowerShell path does not call the Pi/cloud staging entrypoint. Multiple paths can therefore depend on stale generated files. References: [Windows pipeline:248–340](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/scripts/build-win.ps1#L248-L340), [canonical build:357–375](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/electron-build-main.ts#L357-L375), [staging:54–57](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/build/stage-servers.ts#L54-L57).

- **Requirements:** One documented release command, frozen dependency resolution, complete generated artifacts and no dependence on a previous developer build.
- **DoD:** A pristine Windows checkout produces an installable NSIS artifact with all advertised providers and packaged workers.
- **Full functional verification:** Install on separate Windows 10 and Windows 11 machines; complete onboarding, send a real agent turn, invoke a host tool and reopen its saved session.
- **Test method:** Native Windows build job plus installed-artifact UI and subprocess smoke tests; store commit, tool versions, build log and installer checksum.

#### [WIN-001.1] Unify Windows main/preload/interceptor build behavior

Reconcile the standalone PowerShell esbuild flags with the canonical external native imports, `bun:sqlite` shim, toolbar preload and generated worker builds. [Canonical flags:384–414](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/electron-build-main.ts#L384-L414), [Windows flags:248–286](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/scripts/build-win.ps1#L248-L286).

- **Requirements:** Equivalent runtime bundle semantics across documented Windows entrypoints; no unsupported Bun builtins in Electron main.
- **DoD:** All release entrypoints build the same required entrypoint set and pass bundle import checks.
- **Full functional verification:** Open the app, Browser screen and extension surface; start Pi and Claude sessions and exercise memory persistence.
- **Test method:** Clean build for each retained entrypoint and execute generated main/helper modules inside their shipped runtimes.

#### [WIN-001.2] Make helper and executable staging mandatory

Stage Pi/cloud helpers, WhatsApp/Discord workers, Bun, uv, SDK binary and ripgrep before packaging; replace required-resource warnings with release failures. [Pi warning in common.ts:509–518](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/build/common.ts#L509-L518), [cloud staging:568–577](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/build/common.ts#L568-L577), [Windows resources:218–234](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L218-L234).

- **Requirements:** Artifact manifest records required paths, versions, hashes and executable architecture; optional features are explicitly marked.
- **DoD:** Removing any required staged file causes a deterministic pre-publication failure.
- **Full functional verification:** Launch each subprocess from the installed app with developer `node_modules` and system Bun unavailable.
- **Test method:** Package inspection plus negative missing-resource tests and real child-process startup traces.

### [WIN-002] P0 — Package all Windows native dependencies

**Confirmed configuration gap / runtime verification gap.** `node_modules` is excluded; Windows extras list Claude/ripgrep/workers/Bun but no libSQL native facade, and the canonical main leaves native ONNX and sharp external. References: [module exclusion:66–68](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L66-L68), [Windows extras:218–243](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L218-L243), [main native imports:398–403](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/electron-build-main.ts#L398-L403).

- **Requirements:** Every enabled native feature resolves its Windows x64 JS facade, `.node` binary, DLLs and model assets from installed resources.
- **DoD:** WorkGraph, image processing and enabled semantic memory function on a clean machine without development packages.
- **Full functional verification:** Create/query/reopen a WorkGraph record, process an image, index/retrieve a semantic memory fixture, restart and repeat.
- **Test method:** Native dependency closure audit, PE architecture/import inspection and real feature tests in Windows 10/11 VMs.

#### [WIN-002.1] Add Windows libSQL and image/native runtime closure

Derive the target native package names from the installed locked versions instead of copying a Mac package; include required transitives and runtime DLLs. [Current platform resource contrast:144–153,218–234](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L144-L153).

- **Requirements:** Target-specific dependency closure is explicit; native features are not advertised when their binary cannot load.
- **DoD:** All retained native features load successfully under packaged Electron and their separate worker runtimes.
- **Full functional verification:** Execute feature operations in the installed app and inspect resulting persistent records/files.
- **Test method:** Import/load probes inside packaged runtimes plus product UI assertions on outputs.

#### [WIN-002.2] Resolve clean-machine runtime prerequisites

Determine any Visual C++ runtime requirement from the actual shipped PE dependencies, provide detection and remediation, and avoid blanket success claims based on a developer machine. [Bundled runtime lookup:73–91,229–237](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/internal/runtime-resolver.ts#L73-L91).

- **Requirements:** Explicit CPU/OS/runtime support contract and actionable missing-prerequisite states.
- **DoD:** Standard-user installation works on a clean OS image or explains and safely installs a documented prerequisite.
- **Full functional verification:** Test supported CPU baseline, runtime absent/present and non-administrator startup.
- **Test method:** Clean snapshot matrix with native executable dependency reports and first-run logs.

### [WIN-003] P0 — Correct installer identity, launcher paths and data retention

**Confirmed gaps.** The product is `Rox`, but the bootstrap script targets `Programs\Craft Agents\Craft Agents.exe`; NSIS is per-user and `deleteAppDataOnUninstall: true`. These are concrete path/retention discrepancies, while the exact storage directories must be inventoried before choosing migration behavior. References: [product/NSIS:1–2,245–248](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L245-L248), [bootstrap launcher:232–248](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/install-app.ps1#L232-L248).

- **Requirements:** Consistent brand/install paths and deliberate preservation of sessions, workspace files, credentials and settings.
- **DoD:** Installer, Start Menu, command launcher, repair/update and uninstall satisfy the documented retention contract.
- **Full functional verification:** Install, create data, upgrade, repair, uninstall, reinstall and inspect every persisted data category.
- **Test method:** NSIS lifecycle automation under standard Windows users plus before/after storage hashes and launcher execution.

#### [WIN-003.1] Align Rox launcher and upgrade/migration identity

Update bootstrap artifact/feed/launcher conventions and evaluate old Craft bundle identity coexistence rather than silently installing into a mismatched path. [install-app.ps1:7–9,100–116,232–240](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/install-app.ps1#L232-L240), [appId/product:1–2](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L1-L2).

- **Requirements:** Fresh install and supported predecessor migration use a known executable and application identity.
- **DoD:** All supported launch routes start the same expected version; migration creates no orphaned duplicate install.
- **Full functional verification:** Start from installer shortcut, command line, deep link and a predecessor installation.
- **Test method:** Path/registry/shortcut assertions and actual process/version readback for each route.

#### [WIN-003.2] Preserve data by default and offer explicit complete removal

Change destructive uninstall behavior according to a documented product policy; distinguish Electron app data from `.craft-agent`, `.rox`, workspaces and managed toolchain directories. [NSIS current behavior:244–248](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L244-L248), [model directories:31–34](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/meetings/local-asr.ts#L31-L34).

- **Requirements:** No ordinary upgrade/uninstall deletes user content; complete removal requires an explicit informed choice.
- **DoD:** Retained data restores correctly after reinstall and explicit removal deletes only documented Rox-owned data.
- **Full functional verification:** Exercise both retention and removal with real sessions, encrypted credentials, attachments and external workspace folders.
- **Test method:** Seeded lifecycle fixtures and filesystem/credential readback after every transition.

### [WIN-004] P0 — Own and validate the Windows release/update channel

**Confirmed configuration gap / verification gap.** The baked feed is the upstream Craft domain; a runtime override exists but does not establish a Rox release channel. The release helper prints unsigned Mac commands and only DMG release assets. [feed:86–89](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L86-L89), [override:289–307](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/auto-update.ts#L289-L307), [release.ts:1–18](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/release.ts#L1-L18). Use the pinned toolchain's [electron-builder v26 auto-update requirements](https://www.electron.build/v26/docs/features/auto-update/).

- **Requirements:** Rox-owned HTTPS feed, signed publisher identity, NSIS/update metadata, rollback plan and release provenance.
- **DoD:** Two signed release versions support real download/install/relaunch without upstream brand or data replacement.
- **Full functional verification:** Upgrade N→N+1 with open windows and active saved sessions, then test invalid signature, offline download and failed install recovery.
- **Test method:** Controlled production-shaped feed and native Windows installed-artifact update tests.

#### [WIN-004.1] Enforce signing and publish complete Windows metadata

Configure signing in the actual release environment, fail public releases when signatures are absent, upload installers/blockmaps/manifests only after verification, and verify the intended publisher. [NSIS target:198–205](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L198-L205), [v26 configuration](https://www.electron.build/v26/docs/configuration/).

- **Requirements:** Authenticode identity, timestamp and artifact/manifest hashes are recorded and validated.
- **DoD:** A clean Windows machine validates the installer signature and receives matching update metadata from the intended channel.
- **Full functional verification:** Download from the public-shaped URL, verify signature, install and check in-app update identity.
- **Test method:** `Get-AuthenticodeSignature`, signature verification tooling and updater HTTP/artifact readback.

#### [WIN-004.2] Validate interrupted updates and shutdown recovery

Exercise the implemented flush/quit/relaunch hooks with real NSIS installation and verify state survival across an interrupted download or OS shutdown. [installation hooks:554–630](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/auto-update.ts#L554-L630).

- **Requirements:** No lost transcript, permanently locked workspace or half-running app after a failed update.
- **DoD:** Recovery returns to a usable old or new version with data intact and an actionable update state.
- **Full functional verification:** Pause network, kill installer in a test VM, force quit during staging, relaunch and resume sessions.
- **Test method:** Failure injection on disposable snapshots; compare versions, window state, session journals and process cleanup.

### [WIN-005] P1 — Complete Windows shell, paths, toolchain and local audio

**Confirmed audio portability gap / verification gap.** The toolchain advertises Windows artifacts, but local meeting detection searches suffixless `whisper-cli`, `whisper-cpp`, `ffmpeg` and `ffprobe` names. A Windows file named `ffmpeg.exe` is not found by `existsSync(join(dir, 'ffmpeg'))`. [detector:14–38,97–104](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/meetings/local-asr.ts#L14-L38), [manifest matrix:33–45](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/toolchain/manifest-data.ts#L33-L45).

- **Requirements:** Native Windows path/process semantics, `.exe` resolution, managed ASR/model prerequisites and working document/media tools.
- **DoD:** Terminal, file editing, search, document conversion, meetings and dictation work on Windows 10/11 with realistic user paths.
- **Full functional verification:** Use a workspace with spaces/non-ASCII characters; create/edit/search files, convert documents, record and transcribe audio.
- **Test method:** Native fixtures under PowerShell/Git shell as supported; real audio and document outputs checked for correctness.

#### [WIN-005.1] Resolve Windows executables and complete ASR bootstrap

Use the managed toolchain and platform executable suffixes; provision/verify Whisper and models, handle missing FFprobe and cancellation of child process trees. [local-asr.ts:16–28,36–63,68–104](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/meetings/local-asr.ts#L16-L28).

- **Requirements:** Engine status reflects runnable Windows binaries and a compatible model; errors explain missing/invalid assets.
- **DoD:** First-use preparation leads to successful recording duration, transcription and cancellation without orphaned processes.
- **Full functional verification:** Start with no ASR files, provision them, record a known phrase, cancel a second job and repeat after restart.
- **Test method:** Actual Windows audio fixture transcription plus binary suffix/missing-model/cancel fault tests.

#### [WIN-005.2] Verify Windows file/shell/document operations with clean prerequisites

Test relative/absolute paths, drive changes, UNC where supported, Unicode, long paths, quoting, permissions and shell environment; verify the `.cmd` document wrappers and managed Git/Node/Python. [wrapper packaging:42–58](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L42-L58), [platform matrix:35–45](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/toolchain/manifest-data.ts#L35-L45).

- **Requirements:** Supported path types and shell prerequisites are documented; unsupported cases produce clear errors.
- **DoD:** Every advertised file/document tool runs as a standard user with portable path handling and correct output.
- **Full functional verification:** Execute all wrapper families, repository operations and tool approval modes from realistic Windows workspace paths.
- **Test method:** Real command execution and output-content comparison; Windows process/path fixtures and denial/cancel cases.

### [WIN-006] P1 — Resolve Windows native-substrate support explicitly

**Confirmed gap / product decision.** Rust imports UnixListener and the non-Unix main exits 2; the supervisor deliberately avoids Windows. This does not mean the whole app cannot work on Windows: its TypeScript implementation remains primary. [Rust:13–14,64–68](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/native/apps/craft-native/src/main.rs#L64-L68), [supervisor:117–151](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/native/supervisor.ts#L117-L151).

- **Requirements:** Either complete Windows native transport/execution support or formally support and verify full TypeScript fallback for the release feature set.
- **DoD:** Windows has no enabled feature that requires an unavailable sidecar, and supported behavior is demonstrated.
- **Full functional verification:** Run indexing, journal recovery, host command execution and Cloud Runs under the chosen implementation.
- **Test method:** Platform conformance suite and feature-flag matrix on native Windows.

#### [WIN-006.1] Make native feature negotiation truthful on Windows

Prevent opt-in settings from promising a native engine that cannot start; show implementation choice/status and preserve fallback behavior. [tool matrix:82–83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/toolchain/manifest-data.ts#L82-L83), [supervisor Windows guard:117–126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/native/supervisor.ts#L117-L126).

- **Requirements:** Capability reporting matches platform implementation and all dependent UI controls.
- **DoD:** Enabling native flags on Windows produces a supported fallback or an explicit unsupported state without crashes.
- **Full functional verification:** Toggle flags, restart and exercise every dependent feature.
- **Test method:** Runtime capability assertions plus Windows UI/feature tests with flags on and off.

#### [WIN-006.2] Implement a Windows native transport only if required for final parity

If native functionality is part of the Windows release contract, add Windows-compatible IPC, cfg-gate Unix imports, port process termination/permission behavior and publish target binaries. [Unix import/non-Unix exit:13–14,64–68](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/native/apps/craft-native/src/main.rs#L13-L14), [current CI OS matrix:35–40](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/.github/workflows/native.yml#L35-L40).

- **Requirements:** Conditional scope is resolved before release; if implemented, transport authentication/framing and cancellation match the protocol contract.
- **DoD:** Either an approved TypeScript-only parity decision is recorded or Windows Rust binaries compile, install and pass conformance.
- **Full functional verification:** Execute the same persisted indexing/journal/command fixtures on Windows and Unix and compare behavior.
- **Test method:** Native Windows Cargo build/test and cross-implementation protocol/feature tests, or documented fallback acceptance evidence.

### [WIN-007] P1 — Verify Windows desktop integrations in the shipped app

**Verification gap.** Protocol registration and desktop-specific surface methods exist, but configuration alone does not prove Windows OS behavior. [protocol schemes:5–10](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L5-L10), [desktop API channel map:123–139](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/transport/channel-map.ts#L123-L139).

- **Requirements:** Working links, windows, focus/keyboard shortcuts, notifications, clipboard, dialogs and OS permission states.
- **DoD:** Every Windows-facing control has an observable effect or truthful unsupported explanation.
- **Full functional verification:** Trigger a registered link while closed/running, open multiple windows, use notifications/dialogs and suspend/resume.
- **Test method:** Native OS/UI automation with keyboard-only and high-DPI checks plus registry/protocol and process-state readback.

#### [WIN-007.1] Verify URI handling and provider authentication callbacks

Test `rox://` and compatibility links, single-instance dispatch, malformed links, OAuth cancellation and browser-to-app return. [schemes:5–10](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L5-L10).

- **Requirements:** Links navigate the intended workspace/session safely and authenticate only the initiating flow.
- **DoD:** Closed/running/multiple-window link handling and supported provider callbacks work without duplicate instances.
- **Full functional verification:** Complete real provider login and open session links in each lifecycle state.
- **Test method:** OS protocol launches, real callback acceptance and replay/malformed-link negative tests.

#### [WIN-007.2] Verify desktop UX, accessibility and sleep/resume behavior

Cover Start Menu launch, window close/restore, scaling, keyboard shortcuts, text editing, microphone denial, notification click navigation and waking during an agent turn. [window channel mapping:123–139](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/transport/channel-map.ts#L123-L139).

- **Requirements:** Complete keyboard access, readable 100–200% scale layout and no lost work after lifecycle changes.
- **DoD:** Supported Windows 10/11 desktop workflows pass with usable denied-permission/error states.
- **Full functional verification:** Operate the primary screens without a mouse, change DPI/display, suspend mid-turn, resume and inspect persisted output.
- **Test method:** Native accessibility tree/UI tests and manual target-machine lifecycle evidence.

## [MAC] macOS arm64 / x64

### [MAC-001] P0 — Align macOS artifact and application names

**Confirmed gap.** Builder creates `Rox-{arch}.dmg/.zip`; both Darwin packaging functions/scripts expect `Craft-Agents-{arch}`. afterPack copies Assets.car into `Craft Agents.app`, while the product bundle is Rox. References: [artifact names:172–180](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L172-L180), [Darwin validation:66–83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/build/darwin.ts#L66-L83), [shell script expectation:271–279](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/scripts/build-dmg.sh#L271-L279), [icon hook:43–46](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/scripts/afterPack.cjs#L43-L46).

- **Requirements:** Canonical bundle/artifact/launcher/feed naming shared by every macOS build and installer path.
- **DoD:** Both architectures build successfully and all validators/hooks locate the actual Rox outputs.
- **Full functional verification:** Mount DMG, drag-install, launch from Finder/Dock and inspect final icon and version.
- **Test method:** Clean arm64/x64 release builds and target-machine installation with artifact/path/plist assertions.

#### [MAC-001.1] Remove stale Craft artifact and bundle expectations

Fix Darwin scripts, common artifact naming and bootstrap installer application naming; preserve legacy migration intentionally. [Darwin names:71–83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/build/darwin.ts#L71-L83), [installer app name:142–148,290–300](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/install-app.sh#L142-L148).

- **Requirements:** Artifact discovery is target/version-specific and never accepts an unrelated stale file.
- **DoD:** Fresh build, direct installer and update mechanism all agree on Rox names and paths.
- **Full functional verification:** Install through DMG and the supported bootstrap route and launch the resulting app.
- **Test method:** Empty-release-directory build tests plus post-install executable/plist/version checks.

#### [MAC-001.2] Correct Liquid Glass hook and icon provenance

Derive the bundle path from build context instead of `Craft Agents.app`; retain source-hash provenance and verify older-macOS fallback icons. [afterPack.cjs:25–33,43–72](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/scripts/afterPack.cjs#L43-L72).

- **Requirements:** Current approved icon appears in the actual Rox bundle and fallback behavior remains deterministic.
- **DoD:** Correct Assets.car is copied when present/current; invalid provenance triggers an intentional verified fallback.
- **Full functional verification:** Inspect Finder, Dock and app switcher on macOS 26 and an older supported version.
- **Test method:** Hook path/provenance tests and installed-app screenshot/bundle inspection.

### [MAC-002] P0 — Correct arm64/x64 native dependency packaging

**Confirmed gap / verification gap.** Both Mac architectures are targets, but libSQL extras hardcode `database-darwin-arm64`. SDK cross-fetch exists, while ripgrep is copied from the host installation. All native resources need target architecture verification. [targets/resources:119–153](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L119-L153), [SDK/ripgrep copies:145–189](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/scripts/build-dmg.sh#L145-L189).

- **Requirements:** Claude, Bun, uv, ripgrep, libSQL, sharp, ONNX and optional native helpers match the target architecture and minimum OS.
- **DoD:** Each architecture works without developer packages and without unintended dependence on Rosetta.
- **Full functional verification:** Run agent/search/WorkGraph/image/memory operations on separate Apple Silicon and Intel machines.
- **Test method:** Mach-O architecture/dependency inspection plus real native feature execution per artifact.

#### [MAC-002.1] Select libSQL and native module variants per target

Make JS facades, target `.node` binaries and required dylibs available for x64 and arm64; use locked versions and preserve native loader paths. [hardcoded package:144–153](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L144-L153), [external imports:398–403](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/electron-build-main.ts#L398-L403).

- **Requirements:** All enabled native modules have target-complete dependency closure outside inaccessible bundle locations.
- **DoD:** WorkGraph, semantic retrieval and image conversion load the correct modules on both architectures.
- **Full functional verification:** Create/reopen graph data, retrieve known semantic fixtures and process images in the installed app.
- **Test method:** Packaged native import probes and output assertions on Intel and Apple Silicon.

#### [MAC-002.2] Reject wrong-architecture executables during packaging

Validate all downloaded/copied binaries; include ripgrep cross-architecture sourcing and prevent host-only artifacts from passing size-only SDK checks. [SDK verification:16–33](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/build/darwin.ts#L16-L33), [host ripgrep copy:183–189](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/scripts/build-dmg.sh#L183-L189).

- **Requirements:** Target architecture, executable mode, version, hash and minimum deployment version are validated.
- **DoD:** A wrong-architecture binary fails the release gate before the app is signed/published.
- **Full functional verification:** Execute every packaged executable and a representative workload on its native machine.
- **Test method:** `file`/`lipo`/`otool` inspection, deliberate wrong-binary fixtures and actual subprocess launches.

### [MAC-003] P0 — Produce a signed, notarized, Gatekeeper-valid release

**Verification gap.** Hardened runtime, entitlements and Apple credential hooks exist. A commented notarize block does not by itself prove notarization is absent: [electron-builder v26 macOS docs](https://www.electron.build/v26/docs/mac/) describe automatic activation through Apple environment credentials. Public release must prove the actual output is signed/notarized. [configuration:128–131,173–176](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L128-L131), [entitlements:5–16](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/build/entitlements.mac.plist#L5-L16).

- **Requirements:** Developer ID release identity, appropriate nested binary signatures, notarization submission/stapling and retained validation evidence.
- **DoD:** A quarantined download opens normally through Gatekeeper on an independent supported Mac.
- **Full functional verification:** Download DMG/ZIP from the release-shaped endpoint, install with quarantine intact and run native/agent features.
- **Test method:** `codesign --verify --deep --strict`, `spctl --assess`, `xcrun stapler validate` and fresh-machine UI launch.

#### [MAC-003.1] Fail public releases on missing signing or notarization

Separate unsigned developer packaging from release gating; require successful signing/notarization rather than printed "Notarization enabled" messages. [Darwin credential branch:43–61](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/build/darwin.ts#L43-L61), [release helper unsigned path:13–18](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/release.ts#L13-L18).

- **Requirements:** Missing credentials, rejected notarization or invalid final signature stop public artifact publication.
- **DoD:** Release evidence includes actual certificate identity, notarization result and final stapled artifact validation.
- **Full functional verification:** Install the released file on a Mac that did not build it and has never approved an unsigned Rox app.
- **Test method:** Negative credential/rejection cases and positive end-to-end signed distribution gate.

#### [MAC-003.2] Validate the minimum OS and entitlement contract

Document a supported macOS version range and test the bundled native/runtime minimums. Electron 38+ requires macOS 12+, according to the [official Electron 38 announcement](https://www.electronjs.org/blog/electron-38-0); the exact Rox floor may be higher after dependency validation. Audit broad executable-memory/library-validation entitlements and retain only required behavior. [Electron pin:12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L12), [entitlements](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/build/entitlements.mac.plist#L5-L16).

- **Requirements:** Declared minimum OS is compatible with every mandatory binary and encoded in install/update metadata.
- **DoD:** Oldest and newest supported systems run the full supported feature set with approved entitlements.
- **Full functional verification:** Launch and run JIT/native/audio/network workloads on the oldest supported Mac image and current macOS.
- **Test method:** OS-version matrix, plist/Mach-O deployment-target inspection and hardened-runtime feature tests.

### [MAC-004] P0 — Deliver a complete Rox macOS update channel

**Confirmed configuration gap / verification gap.** The feed is upstream and missing ZIP only warns in the Darwin validator. Signed app plus ZIP/update metadata are required by [electron-builder v26 auto-update](https://www.electron.build/v26/docs/features/auto-update/). [feed:86–89](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L86-L89), [ZIP warning:71–83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/build/darwin.ts#L71-L83).

- **Requirements:** Rox-controlled signed DMG/ZIP, architecture-correct `latest-mac.yml`, complete blockmaps/hashes and upgrade recovery.
- **DoD:** Intel and Apple Silicon installations upgrade from N to N+1 using the shipped channel.
- **Full functional verification:** Update with multiple windows and saved sessions; reopen after update and verify data, identity and architecture.
- **Test method:** Two signed release versions on a controlled feed plus target-machine update/restart evidence.

#### [MAC-004.1] Require ZIP and correct update manifest/artifact sets

Treat missing ZIP/manifests as release failures; verify each architecture URL/hash and ensure release publishing includes all required files. [ZIP validator:71–83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/build/darwin.ts#L71-L83), [release assets:13–18](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/release.ts#L13-L18).

- **Requirements:** No channel points to absent, wrong-brand, wrong-version or wrong-architecture artifacts.
- **DoD:** Manifest URLs are fetched and verified after publication; both architectures receive only their intended update.
- **Full functional verification:** Run in-app update checks on Intel/Apple Silicon and observe correct download/install results.
- **Test method:** Remote manifest/artifact readback and actual updater execution, including a missing-file negative case.

#### [MAC-004.2] Verify update flush/relaunch and developer-channel isolation

Test the implemented window/session flush hooks and suppression policy with `/Applications`, user Applications and unsigned development builds. [installation lifecycle:554–630](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/auto-update.ts#L554-L630), [launch suppression:647–654](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/auto-update.ts#L647-L654).

- **Requirements:** Public installs update correctly; developer builds cannot silently replace themselves through a public feed.
- **DoD:** Upgrade preserves multi-window/workspace state and failure recovery returns to a usable process.
- **Full functional verification:** Update a signed install with two windows, interrupt download, simulate install error and test dev-channel suppression.
- **Test method:** Target-machine lifecycle matrix, process/resource cleanup traces and persisted session/window readback.

### [MAC-005] P1 — Complete first-run permissions and nondeveloper prerequisites

**Verification gap.** Local-network and microphone usage descriptions and audio entitlement exist; shell environment loading handles Finder's minimal PATH. ASR and system Git still depend on actual prerequisite availability. [usage keys:111–118](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L111-L118), [shell-env:28–63,86–107](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/shell-env.ts#L28-L63), [ASR:36–63](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/meetings/local-asr.ts#L36-L63).

- **Requirements:** Finder-launched app works for users without terminal environment setup or developer tool installations; permissions have retry/remediation states.
- **DoD:** Onboarding, toolchain bootstrap, supported agent work, microphone recording and LAN requests work from a clean account.
- **Full functional verification:** Install on a fresh account, launch only from Finder, deny then grant permissions and retry operations.
- **Test method:** Clean-account manual/native UI evidence and real prerequisite/bootstrap behavior with PATH minimized.

#### [MAC-005.1] Verify microphone/LAN and permission recovery

Exercise first prompts, denied/revoked permissions, device changes, recording stop/restart and LAN access. Do not claim system-audio recording unless that separate capability is implemented and proven. [usage descriptions:111–118](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L111-L118), [audio entitlement:14–16](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/build/entitlements.mac.plist#L14-L16).

- **Requirements:** Permission-sensitive features disclose capability and provide actionable recovery.
- **DoD:** Denial never becomes false success or a stuck recording; grant/retry succeeds without data loss.
- **Full functional verification:** Record known speech and reach a controlled LAN endpoint through allow/deny/revoke cycles.
- **Test method:** macOS privacy settings reset/revocation and real audio/network output checks.

#### [MAC-005.2] Provision ASR, documents, Git and toolchain from Finder

Ensure managed Whisper/models/FFmpeg and Python document dependencies are ready; detect missing system Git without an unexpected developer-tools prompt; verify shell timeouts and fallback paths. [system Git matrix:33–45](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/toolchain/manifest-data.ts#L33-L45), [shell timeout/fallback:48–63,86–107](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/shell-env.ts#L48-L63), [ASR model detection:31–63](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/meetings/local-asr.ts#L31-L63).

- **Requirements:** First-use prerequisites are installed or explained through the application; slow/broken shell configuration cannot prevent startup.
- **DoD:** Supported operations succeed from Finder on accounts without Homebrew, terminal profiles or predownloaded models.
- **Full functional verification:** Bootstrap on a fresh account, convert representative documents, transcribe audio and execute a repository task.
- **Test method:** Minimal-PATH/slow-shell/missing-Git fixtures and actual nondeveloper-account feature execution.

### [MAC-006] P1 — Package optional native substrate and verify macOS lifecycle

**Confirmed distribution gap / verification gap.** Rust sidecar is local-seeded and not part of standard extraResources; macOS default fallback must remain functional. [sidecar manifest:552–565](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/toolchain/manifest-data.ts#L552-L565), [supervisor lookup:51–78](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/native/supervisor.ts#L51-L78).

- **Requirements:** If native features are advertised, signed target sidecars must be distributable; standard TS behavior must survive native failure and OS lifecycle events.
- **DoD:** No advertised feature requires a developer Cargo checkout; application state survives sleep/quit/reopen.
- **Full functional verification:** Run native/fallback indexing and host commands, kill the sidecar, sleep during a session and reopen.
- **Test method:** Installed-artifact native/fallback conformance plus macOS lifecycle and process cleanup evidence.

#### [MAC-006.1] Publish or deliberately exclude native sidecar release support

Choose the release contract and implement signed arm64/x64 distribution, version/hash checks and resolver location if retained. [local-only sidecar distribution:552–565](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/toolchain/manifest-data.ts#L552-L565).

- **Requirements:** Native availability, feature flags and UI status match what the installer provisions.
- **DoD:** Native-enabled clean installations work or the product explicitly ships the fully verified TS implementation.
- **Full functional verification:** Install on both architectures without Rust, then execute sidecar-dependent advertised operations.
- **Test method:** Signed binary publication/readback, clean-machine resolver/startup tests and fallback acceptance evidence.

#### [MAC-006.2] Verify Dock, windows, shortcuts and sleep/quit recovery

Exercise Cmd-Q versus window close, multiple workspaces/windows, notification navigation, deep links, clipboard, Dock badge, device changes and wake/reconnect. [window API mapping:123–139](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/transport/channel-map.ts#L123-L139), [protocol registration:5–10](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/electron-builder.yml#L5-L10).

- **Requirements:** Native macOS expectations, keyboard accessibility and persisted workspace/window/session state are met.
- **DoD:** Lifecycle changes produce no orphaned workers, lost transcript, stale lock or inaccessible window.
- **Full functional verification:** Operate native controls, sleep mid-turn, wake, quit/reopen and inspect data across multiple windows.
- **Test method:** Native accessibility/UI tests, process-state inspection and persisted output comparison on Intel/Apple Silicon.

## [WEB] Hosted full application, browser adapter and session viewer

### [WEB-001] P0 — Repair the deployable server/web build

**Confirmed gap.** Docker copies a nonexistent `apps/docs-site/package.json` and builds the Pi helper as Node CJS, while the canonical build explicitly requires Bun ESM for its ESM-only SDK dependencies. The image cannot be considered deployable from the pristine source. [Dockerfile.server:55–82](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/Dockerfile.server#L55-L82), [Pi format rationale:197–210](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/electron-build-main.ts#L197-L210).

- **Requirements:** Pristine checkout produces a runtime image containing working WebUI, server, agent helpers, workers and resource assets.
- **DoD:** Image starts as non-root and completes a real browser agent workflow without mounted development artifacts.
- **Full functional verification:** Build, deploy, log in, stream an agent turn with a tool call, restart container and reopen saved output.
- **Test method:** Clean Docker build plus browser UI and actual subprocess execution in the produced image.

#### [WEB-001.1] Fix Docker workspace manifests and helper build formats

Remove/replace nonexistent COPY inputs, use the canonical helper builders and ensure install manifests cover retained runtime packages. [Docker COPY/build:55–85](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/Dockerfile.server#L55-L85), [Pi ESM requirement:197–210](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/scripts/electron-build-main.ts#L197-L210).

- **Requirements:** Build context is source-complete; generated formats match the runtime that starts each helper.
- **DoD:** Build passes on a clean runner and Pi/OMP/Claude plus configured messaging workers start in the image.
- **Full functional verification:** Run a real Pi conversation, default-provider conversation and helper health checks from the hosted UI.
- **Test method:** Clean image build, runtime import/startup probes and server/browser transcript assertions.

#### [WEB-001.2] Pin image/runtime architecture and dependency provisioning

Pin Bun/Node/base-image versions/digests, target SDK/native packages and browser prerequisites; reconcile the Docker multi-platform claim with the Linux-x64-only managed toolchain matrix. [Docker base/Node:26–40](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/Dockerfile.server#L26-L40), [tool platform matrix:33–88](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/toolchain/manifest-data.ts#L33-L88), [browser backend env:24–29](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L24-L29).

- **Requirements:** Declare supported hosted CPU/OS targets and provide all mandatory binaries for each; browser backend needs an actual executable/profile/runtime.
- **DoD:** Each supported image architecture runs advertised tools/browser operations and unsupported architectures fail clearly.
- **Full functional verification:** Start each published image on its native host; use browser navigation, repository tasks and document/media conversion.
- **Test method:** Multi-architecture native runtime matrix, executable architecture checks and actual workload results.

### [WEB-002] P0 — Define the hosted identity and workspace isolation model

**Confirmed product boundary / product decision.** Login verifies one service password and creates JWTs with the fixed subject `webui`; it is not an implemented per-user hosted account model. A private dedicated instance is achievable with existing primitives, while shared SaaS needs a different identity/isolation contract. [password login:267–304](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/http-server.ts#L267-L304), [fixed JWT subject:47–50](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/auth.ts#L47-L50), [default workspace config:389–399](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/http-server.ts#L389-L399).

- **Requirements:** Explicit dedicated-instance versus shared-account product model; authorization consistently protects files, credentials, sessions, tools and background jobs.
- **DoD:** The hosted deployment's advertised identity/isolation model is implemented and tested, with no unauthorized cross-workspace/server access.
- **Full functional verification:** Log in as separate identities/instances as applicable and attempt authorized and unauthorized access to all data/tool families.
- **Test method:** Real HTTP/WebSocket and UI authorization tests against isolated seeded workspaces/instances.

#### [WEB-002.1] Complete hosted authentication, logout and revocation policy

Retain appropriate existing HttpOnly/Strict cookies and Argon2 password verification; add the selected account/login/recovery model and define how logout, password change and token rotation invalidate sessions. Current logout only expires the browser cookie. [cookie/auth behavior:47–79,101–111](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/auth.ts#L47-L79), [logout handler:307–315](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/http-server.ts#L307-L315).

- **Requirements:** Documented session expiry/revocation and login recovery; no false claim of per-user identity in a shared-password instance.
- **DoD:** Authentication lifecycle behaves consistently for HTTP and live WebSocket sessions.
- **Full functional verification:** Log in, expire/revoke/rotate credentials, log out, reconnect and attempt replay of old cookies/connections.
- **Test method:** Real protocol replay/expiry tests plus browser authentication lifecycle assertions.

#### [WEB-002.2] Bind all workspace operations to the authorized principal/instance

Define authorization for default-workspace selection, creation/switching, browsing files, credentials and cross-server RPC; do not treat a workspace query parameter as authorization. [web workspace selection:102–119](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/App.tsx#L102-L119), [adapter workspace methods:150–161,254–255](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L150-L161).

- **Requirements:** Server enforces the chosen isolation boundary for every read/write/tool action and push event.
- **DoD:** Unauthorized workspace IDs cannot reveal data or run commands; approved workspace switches receive only their own events.
- **Full functional verification:** Tamper with URLs, RPC payloads and workspace subscriptions, then perform legitimate switching and creation.
- **Test method:** Seeded principal/workspace access matrix over real WebSocket connections and browser tabs.

### [WEB-003] P0 — Deploy HTTPS/WebSocket ingress and persistent runtime correctly

**Verification gap.** The server can embed WebUI on RPC port and accepts explicit browser-facing WS URL/Secure-cookie options. Auto-resolved URLs otherwise use the server's WS protocol/port, so reverse-proxy deployment requires deliberate configuration. Forwarded host/proto handling also needs a trusted ingress boundary. [URL resolution:82–127](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/http-server.ts#L82-L127), [server configuration:119–158,181–189](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L119-L158), [image runtime:93–119](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/Dockerfile.server#L93-L119).

- **Requirements:** Stable public HTTPS origin, correct WSS upgrade routing, persistent volumes, secret injection, non-root service and health/restore operations.
- **DoD:** A production-shaped domain supports login/streaming/tools across container restart and network reconnection.
- **Full functional verification:** Use external browsers through actual ingress, rotate/restart the service, disconnect/reconnect and reopen saved work.
- **Test method:** Deployed ingress/browser tests, TLS/cookie/WS inspection and persistent-volume backup/restore drill.

#### [WEB-003.1] Configure public WSS URL, trusted forwarding and browser security headers

Set `CRAFT_WEBUI_WS_URL` and Secure cookies for TLS-terminating ingress; ensure direct backend exposure cannot bypass ingress controls. Review CSP/frame/referrer/content-type policies and WS origin enforcement for the actual hosted routes. [forwarding/WS helpers:82–127](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/http-server.ts#L82-L127), [static responses:414–433](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/http-server.ts#L414-L433).

- **Requirements:** Browser receives a same-deployment WSS URL and secure cookie; ingress/header trust is explicit and externally verifiable.
- **DoD:** No mixed-content error, exposed internal port/host or accepted unauthorized cross-origin connection in the chosen deployment.
- **Full functional verification:** Authenticate and stream behind TLS ingress; attempt forged forwarded headers and cross-origin HTTP/WS requests.
- **Test method:** Browser network assertions and direct HTTP/WS ingress boundary tests with negative origins/headers.

#### [WEB-003.2] Persist data, credentials, profiles, models and job state

Define volume ownership/backups for config, sessions, attachments, databases, messaging auth, agent browser profile and models; narrow image-wide world-writable home permissions to the actual runtime needs. [Docker runtime ownership:93–103](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/Dockerfile.server#L93-L103), [browser profile configuration:24–26](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L24-L26).

- **Requirements:** Persist all selected product data categories with correct ownership and a working restore procedure.
- **DoD:** Container recreation and backup restoration retain usable workspace/session/credential state without permission repair by hand.
- **Full functional verification:** Create content/connections/jobs, replace the container, restore on a clean host and resume workflows.
- **Test method:** Real volume replacement and restore drill with data hashes, credential usability and job-state readback.

### [WEB-004] P0 — Implement real browser upload/download and file workflows

**Confirmed gap.** Browser file picker returns filenames only; open file/reveal methods resolve without action, folder dialog returns null and editor action reports no editor. A shared renderer can therefore expose controls without delivering the corresponding web behavior. [file picker:30–47](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L30-L47), [file overrides:109–115](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L109-L115).

- **Requirements:** Upload actual bytes to the authorized backend; download/preview generated files; server paths and browser-local files remain distinguishable.
- **DoD:** Files selected in a browser become usable attachments and generated artifacts can be previewed/downloaded with correct content.
- **Full functional verification:** Attach local documents/images, run a file task, inspect generated output and download/reopen it locally.
- **Test method:** Browser file chooser/drag/drop tests, server persistence assertions and end-to-end downloaded content/hash comparisons.

#### [WEB-004.1] Replace name-only picker with a byte-preserving upload contract

Introduce upload endpoints/RPC streaming and progress/cancel/error handling, authorized destination/storage, size/type limits and collision policy; retain selected file bytes rather than fabricating server paths. [picker implementation:30–47](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L30-L47).

- **Requirements:** Binary fidelity, safe storage and deterministic attachment identifiers for multi-file uploads.
- **DoD:** Text, image, PDF and office fixtures are persisted and usable in a real agent session.
- **Full functional verification:** Upload duplicate names, Unicode names, binary files, oversized/rejected files and cancel mid-upload.
- **Test method:** Browser upload automation with server-side hashes, preview/content assertions and failure injection.

#### [WEB-004.2] Provide web artifact preview/download and remote directory selection

Implement meaningful browser actions for `openFile`, show/reveal and workspace directory selection, or replace them with clearly labeled server-file actions. Prevent private server paths from becoming arbitrary client URLs. [current no-ops:109–115](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L109-L115).

- **Requirements:** User can find/open/download authorized output and select a server workspace without desktop filesystem assumptions.
- **DoD:** All exposed web file controls have a real result or an explicit capability explanation.
- **Full functional verification:** Browse authorized server folders, create a workspace, preview/download artifacts and reject path traversal/unauthorized files.
- **Test method:** Real browser/server file workflows and authorization/path boundary tests.

### [WEB-005] P1 — Make workspace navigation, tabs and desktop capabilities truthful

**Confirmed gaps.** `openWorkspace` is empty, new-session-tab URL ignores workspace, removal returns false and cross-server invoke rejects. Many desktop methods silently resolve, including close/quit/update/menu/skill editor/reveal operations. [workspace/tab adapter:150–161](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L150-L161), [desktop overrides:132–203,232–255](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L232-L255).

- **Requirements:** Capability-driven web UI, correct workspace/session tab state, working URL/history/refresh behavior and no false-success controls.
- **DoD:** Every renderer surface has an explicit hosted-web capability contract and reachable supported actions.
- **Full functional verification:** Create/switch/open workspaces, open sessions in tabs, refresh/deep-link/back/forward, and inspect unavailable desktop controls.
- **Test method:** Browser multi-tab navigation matrix and generated capability-to-control assertions.

#### [WEB-005.1] Implement workspace-aware navigation and session URLs

Carry workspace/server identity into new tab links, implement open/switch/remove according to the hosted model and preserve state through refresh/history. [session URL:19–23](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L19-L23), [workspace actions:150–161,254–255](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L150-L161).

- **Requirements:** Tabs display the intended authorized session/workspace and subscribe to its live updates.
- **DoD:** Navigation works for nondefault workspaces and cannot silently open an unrelated default session.
- **Full functional verification:** Open sessions from two workspaces in separate tabs, switch, refresh and use back/forward while receiving events.
- **Test method:** Browser multi-tab tests with distinct seeded workspace/session titles and live-event assertions.

#### [WEB-005.2] Replace silent desktop no-ops with supported web UX

Hide/disable native-only controls with explanations or implement browser equivalents; cover settings/about/update, skills/files, window controls, power settings, badges and cross-server controls. [no-op overrides:109–115,132–203,227–255](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L132-L203).

- **Requirements:** Capability checks drive available controls; success toasts require an actual completed action.
- **DoD:** A hosted user encounters no actionable button backed only by an unacknowledged no-op.
- **Full functional verification:** Traverse each shared screen/settings pane and activate every visible platform action.
- **Test method:** Browser control inventory linked to adapter methods and functional action assertions, including unsupported cases.

### [WEB-006] P1 — Finish supported web authentication and notification flows

**Confirmed gap / verification gap.** Source/Claude OAuth have browser popup implementations; ChatGPT OAuth explicitly reports unavailable. Notifications do not register click navigation. This requires a truthful connection catalog and browser-specific workflows. [OAuth:258–351](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L258-L351), [notification overrides:205–225](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L205-L225).

- **Requirements:** Every advertised hosted provider has a workable supported authentication method; permission notifications behave consistently in browsers.
- **DoD:** Supported source/provider connections complete from web and notification actions navigate to the right session.
- **Full functional verification:** Authenticate real providers from desktop/mobile browsers, cancel/deny/retry and click a real session notification.
- **Test method:** Real OAuth callback tests, popup-blocked/same-window flows and browser permission/notification tests.

#### [WEB-006.1] Resolve ChatGPT and provider auth support per hosted environment

Implement an officially supported hosted flow if available, otherwise expose an appropriate supported credential path and clear limitation; verify server callback state, refresh, cancellation and restart behavior for all retained providers. [ChatGPT unsupported:345–351](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L345-L351), [callback handling:317–374](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/http-server.ts#L317-L374).

- **Requirements:** Supported auth options respect provider contracts and are correctly scoped to the initiating workspace/user.
- **DoD:** Connection UI never promises a desktop-local callback from a hosted browser; retained flows work end to end.
- **Full functional verification:** Authenticate, run a real turn, refresh credentials, revoke and reconnect across service restart.
- **Test method:** Live provider smoke with server-side credential/status readback plus wrong-state/cancel/replay negative tests.

#### [WEB-006.2] Complete notification permission and navigation behavior

Request permission through user action, handle denied/unavailable APIs, wire click-to-session behavior and decide whether background notification delivery is a product requirement. A service worker/push service is required only if that scope is selected. [current browser notifications:205–225](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L205-L225).

- **Requirements:** Truthful foreground/background delivery contract and authorized session navigation.
- **DoD:** Enabled notifications produce correct visible behavior; unsupported background delivery is not advertised.
- **Full functional verification:** Allow/deny/revoke permission, finish a backgrounded session and click its notification in supported browsers.
- **Test method:** Browser permission matrix and real notification/manual OS interaction evidence; push delivery tests only for selected background scope.

### [WEB-007] P1 — Complete web capture, media and browser-engine parity

**Verification gap.** Shared API maps meeting/voice/browser-pane methods, but desktop capture/overlay semantics and a remote browser runtime are not automatically browser-compatible. The standalone server selects `agent-browser` by default and needs a persistent profile/executable. [media mapping:62–77,499–523](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/transport/channel-map.ts#L499-L523), [browser methods:738–759](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/transport/channel-map.ts#L738-L759), [server browser selection:124–126,218–219](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L124-L126).

- **Requirements:** Browser microphone capture, byte transport, hosted transcription/playback and visible remote browser control have explicit supported contracts.
- **DoD:** Hosted Meetings/Voice/Browser screens perform the selected supported workflows without native desktop assumptions.
- **Full functional verification:** Record/transcribe/play audio and navigate/interact with a remote browser through the hosted UI.
- **Test method:** Real browser media fixtures, backend job/file readback and remote browser screenshot/action assertions.

#### [WEB-007.1] Verify or implement browser-side recording and hosted audio jobs

Map capture to browser media APIs, send chunks to the authorized backend, provide progress/cancel/retry and identify which overlay/hotkey/system-audio controls are desktop-only. [voice capture/chunks/history:505–523](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/transport/channel-map.ts#L505-L523), [meeting capture/import:71–75](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/transport/channel-map.ts#L71-L75).

- **Requirements:** Secure-context capture, supported codecs, reconnect/cancel behavior and per-workspace storage/model readiness.
- **DoD:** Recording and imported media yield playable persistent audio and accurate transcript/status in supported browsers.
- **Full functional verification:** Record a known phrase, pause/resume, deny permission, disconnect during upload and reopen result after restart.
- **Test method:** Chromium/WebKit/Firefox media-path tests and actual backend audio hashes/transcript quality checks.

#### [WEB-007.2] Provision remote browser runtime and verify visible interaction

Install the chosen agent-browser/Chromium runtime and profile persistence; verify embedded/screenshot browser UI behavior, auth/cookies, downloads and cleanup. [headless browser env:24–26](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/src/index.ts#L24-L26), [browser API:738–759](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/transport/channel-map.ts#L738-L759).

- **Requirements:** Browser actions target the authorized instance/profile and have visible, truthful results.
- **DoD:** Hosted browser pane can navigate, click/type/scroll, show current state, download an artifact and recover after runtime restart.
- **Full functional verification:** Complete a controlled website workflow with login, form submission and download, then reload the service/profile.
- **Test method:** Real remote browser workload and UI screenshot/state assertions with crash/reconnect/profile isolation cases.

### [WEB-008] P1 — Fix startup error recovery and certify browser UX

**Confirmed gap / verification gap.** `main.tsx` names a component ErrorBoundary but implements only React Suspense; it does not catch renderer runtime exceptions. App initialization sets ready immediately after `client.connect()` rather than awaiting authenticated/channel-ready state. [main.tsx:33–39](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/main.tsx#L33-L39), [connection startup:121–146](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/App.tsx#L121-L146).

- **Requirements:** Real runtime error boundary, handshake-aware startup/retry and usable responsive/accessible browser surfaces.
- **DoD:** Startup failures, render errors, expired auth and reconnects show recoverable UI; supported browsers pass complete critical workflows.
- **Full functional verification:** Inject a render exception, fail WS handshake, expire cookie, lose network and complete core tasks at desktop/mobile widths.
- **Test method:** Browser fault injection plus accessibility and responsive functional tests against the real backend.

#### [WEB-008.1] Implement actual error boundary and transport readiness gating

Catch runtime render failures, distinguish loading versus error fallback, await authenticated protocol readiness and offer retry/login recovery without destroying valid work. [Suspense-only boundary:33–39](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/main.tsx#L33-L39), [ready-before-handshake:141–146](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/App.tsx#L141-L146).

- **Requirements:** No blank page or indefinitely usable-looking disconnected controls after startup/render failure.
- **DoD:** Each failure presents a localized recovery path and reconnect preserves the authoritative session state.
- **Full functional verification:** Crash a shared page component, reject handshake and reconnect while a server turn continues.
- **Test method:** Runtime component/WS fault injection and browser recovery/state assertions.

#### [WEB-008.2] Certify all hosted surfaces in supported browser engines

Cover Chromium/Edge, Firefox and Safari/WebKit as declared; test editor shortcuts/clipboard, upload/download, menus, notifications, OAuth, large sessions, mobile viewport, virtual keyboard and accessibility. Existing browser adapter uses `document.execCommand` for editing operations and native API availability differs. [editing actions:192–197](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L192-L197), [theme/focus APIs:123–147](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/src/adapter/web-api.ts#L123-L147).

- **Requirements:** Published browser/version support matrix; keyboard/touch/accessibility behavior is complete for all advertised screens.
- **DoD:** No supported browser loses critical tasks due to clipboard, popup, layout or unsupported API behavior.
- **Full functional verification:** Execute end-user task journeys on actual engines and a real mobile Safari device where claimed.
- **Test method:** Multi-engine Playwright task suite plus real-device permission/popup/notification/manual accessibility checks.

### [WEB-009] P1 — Deploy and verify the separate session viewer/sharing surface

**Verification gap / product decision.** Viewer fetches `/s/api/{id}` and renders read-only session data; its Vite development proxy targets `agents.rox.one`. This does not establish production storage, sharing authorization, expiration or revocation. [viewer fetch:85–116](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/viewer/src/App.tsx#L85-L116), [development proxy:36–43](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/viewer/vite.config.ts#L36-L43).

- **Requirements:** Explicit deployment/API/storage ownership for shared transcripts and correct redaction/access/lifecycle behavior.
- **DoD:** A newly shared session opens through the production-shaped link with correct content; revoked/expired links stop working.
- **Full functional verification:** Share from the app, open as recipient, inspect transcript/overlays, revoke and verify access denial.
- **Test method:** Real share service and browser viewer end-to-end test with data/redaction/expiration readback.

#### [WEB-009.1] Wire production viewer routing to a real share API

Deploy viewer assets, SPA route fallback and `/s/api/{id}` under the intended origin; connect actual storage/API operations, content limits and invalid/deleted share states. [routes/fetch:1–9,85–116](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/viewer/src/App.tsx#L85-L116), [Vite proxy:36–43](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/viewer/vite.config.ts#L36-L43).

- **Requirements:** Viewer production does not depend on Vite dev proxy or developer sample session IDs.
- **DoD:** Fresh share links load correct data directly after browser refresh and invalid IDs return clear errors.
- **Full functional verification:** Create a new share, open its URL on an independent browser, refresh and test nonexistent/deleted IDs.
- **Test method:** Deployed API/route readback and browser share lifecycle tests.

#### [WEB-009.2] Verify transcript safety, redaction and accessible overlays

Validate share/import schema, redact credentials/private paths as required, limit oversized content and verify URL opening/clipboard/diff/code/document overlays. Viewer includes raw loading/back labels that must join the localization contract. [platform actions:188–202](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/viewer/src/App.tsx#L188-L202), [loading/error labels:213–231](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/viewer/src/App.tsx#L213-L231).

- **Requirements:** Read-only viewer cannot expose unapproved secrets or execute unsafe content and remains usable across locales/input modes.
- **DoD:** Imported/shared fixture corpus renders correctly with safe links, expected redaction and keyboard-accessible overlays.
- **Full functional verification:** Open large/malformed/hostile/redaction-sensitive sessions and inspect every tool-output overlay type.
- **Test method:** Browser content/URL/schema boundary tests, redaction snapshot assertions and keyboard/accessibility checks.

## [PLATFORM-EXIT] Required release evidence

All tasks above must link their completion evidence to the same final commit and exact artifacts. The separate integration/test/recheck backlog owns the overall release gate. Platform acceptance must include Windows 10 and 11 native installation, Apple Silicon and Intel macOS signed distribution, and externally accessible hosted HTTPS/WSS operation. Build logs or source-only checks cannot substitute for these target-runtime tests. A supported feature may be deliberately excluded only through an explicit product capability decision reflected in the UI, release notes and tests; unmarked stubs cannot be accepted as final functionality.
