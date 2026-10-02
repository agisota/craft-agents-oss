# [SURFACE] Final-readiness surface backlog

Source baseline: `f63294ba4fffa7238b46b24e918925a313ad0b12` (upstream `main` snapshot). This document audits renderer/UI source and proposes completion work; it does not assert that native packages, integrations or hosted services passed a runtime acceptance test.

Targets: **A** Windows 10 and Windows 11 installed builds; **B** macOS installed builds; **C** authenticated hosted web application. A browser viewer/public share is a separate product surface from the authenticated hosted application.

**Evidence classifications:** “Observed limitation/gap” describes an explicit source constraint, local-only persistence or missing behavior visible in inspected code. “Implementation exists; verification required” means code is present and a release gate remains; it is not an allegation that the feature is broken. Product boundaries such as hidden local plan labels, coming-soon Slack and the separate meeting workspace require a release scope decision before implementation work is assigned.

**Execution policy:** implement fixes when the acceptance workflow reveals a failure. Do not rewrite already-working modules merely because they appear in this qualification backlog. Every acceptance result must identify build/commit, target OS/browser, backend/provider, test dataset and persisted/server readback. Run existing relevant Bun tests and add behavior tests for concrete gaps; mock/source-text tests alone are insufficient for final functional acceptance. For C, direct `window.electronAPI` usage is acceptable only where the real browser transport exposes an authorized equivalent; filesystem/native view APIs need explicit server/browser adaptations.

## [SURFACE-COVERAGE] Page and module inventory

The table maps every task to its owning surface. Supporting dialogs/editors and each registered settings section are included in the linked task requirements. All five extra screens and all twenty Home widgets are explicitly named below.

| ID | Surface / module | Evidence class | Pinned code reference |
|---|---|---|---|
| [UI-001](#ui-001-workbench-shell-routes-and-window-layouts) | Workbench shell, routes and window layouts | Implementation exists; complete route and layout verification required. | [apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx:175-492](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx#L175-L492) |
| [UI-002](#ui-002-onboarding-provider-setup-and-reauthentication) | Onboarding, provider setup and reauthentication | Implementation exists; fresh-install and authentication verification required. | [apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx:14-236](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx#L14-L236) |
| [UI-003](#ui-003-home-dashboard-and-every-registered-widget) | Home dashboard and every registered widget | Implementation exists; dashboard layout is local and widgets require release qualification. | [apps/electron/src/renderer/platform/home/widgets.tsx:1352-1379](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L1352-L1379) |
| [UI-004](#ui-004-session-lists-collections-kanban-and-batch-actions) | Session lists, collections, Kanban and batch actions | Implementation exists; collection interactions and persistence verification required. | [apps/electron/src/renderer/components/app-shell/SessionList.tsx:1-130](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/SessionList.tsx#L1-L130) |
| [UI-005](#ui-005-chat-transcript-composer-and-rich-session-views) | Chat transcript, composer and rich session views | Implementation exists; full streaming/provider matrix verification required. | [apps/electron/src/renderer/pages/ChatPage.tsx:164-426](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ChatPage.tsx#L164-L426) |
| [UI-006](#ui-006-branching-rewriting-side-threads-and-session-workbench) | Branching, rewriting, side threads and session workbench | Implementation exists; backend-specific branch handshake and UI integrity verification required. | [apps/electron/src/renderer/pages/ChatPage.tsx:593-696](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ChatPage.tsx#L593-L696) |
| [UI-007](#ui-007-permission-credential-admin-approval-and-source-authentication-dialogs) | Permission, credential, admin approval and source authentication dialogs | Implementation exists; authorization and concurrent-dialog verification required. | [apps/electron/src/renderer/components/app-shell/input/structured/PermissionRequest.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/input/structured/PermissionRequest.tsx#L1-L100) |
| [UI-008](#ui-008-personal-tasks-scheduling-lists-and-task-detail) | Personal tasks, scheduling, lists and task detail | Implementation exists; canonical RPC persistence and interaction verification required. | [apps/electron/src/renderer/pages/TasksPage.tsx:1-110](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TasksPage.tsx#L1-L110) |
| [UI-009](#ui-009-task-delegation-and-agent-task-projections) | Task delegation and agent task projections | Implementation exists; delegation failure recovery and agent-state verification required. | [apps/electron/src/renderer/pages/TasksPage.tsx:238-270](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TasksPage.tsx#L238-L270) |
| [UI-010](#ui-010-notes-documents-folders-assets-and-markdown-editor) | Notes documents, folders, assets and Markdown editor | Implementation exists; durable file edits and editor round-trip verification required. | [apps/electron/src/renderer/pages/NotesPage.tsx:1-95](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/NotesPage.tsx#L1-L95) |
| [UI-011](#ui-011-notes-basetable-json-canvas-outline-graph-and-mind-map) | Notes Base/Table, JSON Canvas, Outline, Graph and mind map | Implementation exists; Canvas/view configuration is localStorage-backed and needs durable release policy. | [apps/electron/src/renderer/pages/notes/NotesViewHost.tsx:67-105](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/NotesViewHost.tsx#L67-L105) |
| [UI-012](#ui-012-note-ai-comments-wiki-links-and-vault-insights) | Note AI, comments, wiki links and vault insights | Implementation exists; cross-module provenance and mutation verification required. | [apps/electron/src/renderer/pages/NotesPage.tsx:34-99](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/NotesPage.tsx#L34-L99) |
| [UI-013](#ui-013-unified-inbox-review-actions-and-attention-state) | Unified Inbox, review actions and attention state | Implementation exists; multi-source acknowledgement verification required. | [apps/electron/src/renderer/pages/InboxPage.tsx:91-216](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/InboxPage.tsx#L91-L216) |
| [UI-014](#ui-014-inbox-mail-accounts-folders-message-rendering-and-composition) | Inbox mail accounts, folders, message rendering and composition | Implementation exists; real mail-server and hostile-content verification required. | [apps/electron/src/renderer/pages/inbox/mail/MailPanels.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/inbox/mail/MailPanels.tsx#L1-L100) |
| [UI-015](#ui-015-feed-agents-automation-activity-news-subscriptions-and-source-editor) | Feed agents, automation activity, news, subscriptions and source editor | Implementation exists; data-source and annotation persistence verification required. | [apps/electron/src/renderer/pages/FeedPage.tsx:45-150](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/FeedPage.tsx#L45-L150) |
| [UI-016](#ui-016-local-meetings-recording-imports-asr-and-follow-up-outputs) | Local Meetings recording, imports, ASR and follow-up outputs | Implementation exists; native/audio/model qualification required. | [apps/electron/src/renderer/pages/MeetingsPage.tsx:1-155](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/MeetingsPage.tsx#L1-L155) |
| [UI-017](#ui-017-meeting-workspace-agent-readiness-and-proposal-inbox) | Meeting workspace, agent readiness and proposal inbox | Separate implementation exists; catalog route mounts pages/MeetingsPage.tsx, so reachability/product scope must be resolved. | [apps/electron/src/renderer/pages/meetings/MeetingsPage.tsx:1-29](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/MeetingsPage.tsx#L1-L29) |
| [UI-018](#ui-018-memory-manager-injection-meter-and-lesson-provenance) | Memory manager, injection meter and lesson provenance | Implementation exists; mutation and context-injection parity verification required. | [apps/electron/src/renderer/components/memory/MemoryScreen.tsx:1-55](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/memory/MemoryScreen.tsx#L1-L55) |
| [UI-019](#ui-019-automation-editor-graph-schedules-and-execution-history) | Automation editor, graph, schedules and execution history | Implementation exists; scheduler and tool execution qualification required. | [apps/electron/src/renderer/components/automations/AutomationEditor.tsx:1-120](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/automations/AutomationEditor.tsx#L1-L120) |
| [UI-020](#ui-020-projects-home-creation-detail-assets-and-settings) | Projects home, creation, detail, assets and settings | Implementation exists; resource/path and mutation verification required. | [apps/electron/src/renderer/pages/ProjectInfoPage.tsx:80-121](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ProjectInfoPage.tsx#L80-L121) |
| [UI-021](#ui-021-sources-catalog-mcp-tools-permissions-and-source-detail) | Sources catalog, MCP tools, permissions and source detail | Implementation exists; connector/tool handshake verification required. | [apps/electron/src/renderer/pages/SourceInfoPage.tsx:211-288](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SourceInfoPage.tsx#L211-L288) |
| [UI-022](#ui-022-skills-catalog-omp-imports-editing-and-invocation) | Skills catalog, OMP imports, editing and invocation | Implementation exists; file discovery and live runtime activation verification required. | [apps/electron/src/renderer/pages/SkillInfoPage.tsx:56-162](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SkillInfoPage.tsx#L56-L162) |
| [UI-023](#ui-023-connections-hub-imports-credentials-grants-and-audit) | Connections hub, imports, credentials, grants and audit | Implementation exists; OS import and Workgraph authorization qualification required. | [apps/electron/src/renderer/pages/ConnectionsPage.tsx:70-105](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ConnectionsPage.tsx#L70-L105) |
| [UI-024](#ui-024-knowledge-search-saved-views-and-entity-inspector) | Knowledge search, saved views and entity inspector | Observed limitation: search selects the first connection; release must define provider/connection selection. | [apps/electron/src/renderer/knowledge/KnowledgeHome.tsx:1-137](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/knowledge/KnowledgeHome.tsx#L1-L137) |
| [UI-025](#ui-025-knowledge-proposals-and-diff-review) | Knowledge proposals and diff review | Implementation exists; proposal state and conflict verification required. | [apps/electron/src/renderer/knowledge/KnowledgeDiff.tsx:82-109](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/knowledge/KnowledgeDiff.tsx#L82-L109) |
| [UI-026](#ui-026-optional-knowledge-engine-and-embedded-siyuan-surface) | Optional knowledge engine and embedded SiYuan surface | Native implementation exists; direct SiYuan native view/bounds calls need a C surface alternative. | [apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx:139-360](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx#L139-L360) |
| [UI-027](#ui-027-browser-pane-profiles-navigation-and-inspector-browser) | Browser pane, profiles, navigation and inspector browser | Native browser view implementation exists; it is not directly renderable as a hosted browser pane. | [apps/electron/src/renderer/pages/BrowserPanelPage.tsx:62-171](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/BrowserPanelPage.tsx#L62-L171) |
| [UI-028](#ui-028-embedded-extension-views-and-extension-host-integration) | Embedded extension views and extension host integration | Native extension surface implementation exists; C requires a browser-capable host. | [apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx:68-144](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx#L68-L144) |
| [UI-029](#ui-029-terminal-route-dock-and-genuine-interactive-shell) | Terminal route, dock and genuine interactive shell | Observed implementation gaps: full UEW PTY/xterm contribution is unwired; terminalId labels a generic InspectorTerminal. Both desktop and headless shell EXEC handlers hardcode /bin/zsh (unavailable on standard Windows) with 20-second/1-MiB command-runner limits. | [apps/electron/src/renderer/pages/TerminalSurfacePage.tsx:1-76](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TerminalSurfacePage.tsx#L1-L76) |
| [UI-030](#ui-030-cloud-run-detail-surface-and-live-run-operations) | Cloud-run detail surface and live run operations | Observed limitation: detail loads once per runId with no event/poll subscription; fallback synthesizes createdAt=Date.now(). | [apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx:40-122](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx#L40-L122) |
| [UI-031](#ui-031-generated-pages-catalog-page-runtime-and-capability-grants) | Generated Pages catalog, page runtime and capability grants | Implementation exists; iframe bridge and grant lifecycle verification required. | [apps/electron/src/renderer/components/pages/PageFrame.tsx:74-319](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/pages/PageFrame.tsx#L74-L319) |
| [UI-032](#ui-032-page-publication-session-sharing-and-publish-dialogs) | Page publication, session sharing and publish dialogs | Implementation exists; enabled capability does not prove hosted publication infrastructure. | [apps/electron/src/renderer/components/pages/SharePageDialog.tsx:52-185](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/pages/SharePageDialog.tsx#L52-L185) |
| [UI-033](#ui-033-team-activity-invitations-and-workspace-transfers) | Team activity, invitations and workspace transfers | Implementation exists; multi-user authority and transfer verification required. | [apps/electron/src/renderer/components/team/TeamOrgSettingsSection.tsx:1-43](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/team/TeamOrgSettingsSection.tsx#L1-L43) |
| [UI-034](#ui-034-dossier-contacts-companies-touches-and-generated-briefs) | Dossier contacts, companies, touches and generated briefs | Observed limitation: authored dossiers persist in localStorage through extra-screens/storage; release durability policy required. | [apps/electron/src/renderer/pages/extra-screens/dossier/DossierPage.tsx:103-154](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/dossier/DossierPage.tsx#L103-L154) |
| [UI-035](#ui-035-radar-topics-source-signals-sweeps-and-digest-detail) | Radar topics, source signals, sweeps and digest detail | Observed limitation: authored Radar topics/sweeps/dismissals use localStorage; run synchronization exists and needs qualification. | [apps/electron/src/renderer/pages/extra-screens/radar/RadarPage.tsx:58-163](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/radar/RadarPage.tsx#L58-L163) |
| [UI-036](#ui-036-decisions-log-extraction-and-memory-promotion) | Decisions log, extraction and memory promotion | Observed limitation: decision records are localStorage-backed; memory and extraction APIs exist. | [apps/electron/src/renderer/pages/extra-screens/decisions/DecisionsPage.tsx:62-116](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/decisions/DecisionsPage.tsx#L62-L116) |
| [UI-037](#ui-037-agent-center-stop-controls-automations-and-budget-monitor) | Agent Center, stop controls, automations and budget monitor | Observed limitation: budget is local monitor input to pure buildAgentCenter; no execution enforcement is shown here. | [apps/electron/src/renderer/pages/extra-screens/agents/AgentCenterPage.tsx:103-179](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/agents/AgentCenterPage.tsx#L103-L179) |
| [UI-038](#ui-038-focus-timer-daily-priorities-calendar-and-daily-summary) | Focus timer, daily priorities, calendar and daily summary | Implementation exists; focus/local calendar storage and summary persistence qualification required. | [apps/electron/src/renderer/pages/extra-screens/focus/FocusPage.tsx:50-126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/focus/FocusPage.tsx#L50-L126) |
| [UI-039](#ui-039-settings-overview-navigator-and-registry-coverage) | Settings overview, navigator and registry coverage | Implementation exists; registry contains 22 settings subpages and supporting legacy pages require scope review. | [apps/electron/src/renderer/pages/settings/settings-pages.ts:20-83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/settings-pages.ts#L20-L83) |
| [UI-040](#ui-040-account-profile-avatar-xp-and-balance-settings) | Account profile, avatar, XP and balance settings | Observed product boundary: plan picker is intentionally hidden; plan label is local and is not billing. | [apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx:1-46](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx#L1-L46) |
| [UI-041](#ui-041-accounts-service-identity-cloud-connection-and-logout) | Accounts, service identity, cloud connection and logout | Implementation exists; actual service identity and reset behavior verification required. | [apps/electron/src/renderer/pages/settings/AccountsSettingsPage.tsx:73-210](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AccountsSettingsPage.tsx#L73-L210) |
| [UI-042](#ui-042-privacy-purpose-controls-export-and-remote-deletion) | Privacy purpose controls, export and remote deletion | Implementation exists; completed export/deletion proof required rather than queued UI status alone. | [apps/electron/src/renderer/pages/settings/PrivacySettingsPage.tsx:48-113](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PrivacySettingsPage.tsx#L48-L113) |
| [UI-043](#ui-043-runtime-toolchain-environment-and-secret-references-settings) | Runtime, toolchain, environment and secret references settings | Observed platform gap: detect-only craft-native install guide currently contains a developer cargo build command; final package needs a usable product recovery path. | [apps/electron/src/renderer/pages/settings/RuntimeSettingsPage.tsx:48-146](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/RuntimeSettingsPage.tsx#L48-L146) |
| [UI-044](#ui-044-context-documents-templates-preferences-and-memory-entry-points) | Context documents, templates, preferences and memory entry points | Implementation exists; context-file mutation and runtime propagation verification required. | [apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx:217-322](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx#L217-L322) |
| [UI-045](#ui-045-knowledge-settings-engine-connections-migration-and-note-ai-prompts) | Knowledge settings, engine connections, migration and note AI prompts | Observed boundary: first external connection is selected (MVP single-connection); local notes are default. | [apps/electron/src/renderer/pages/settings/KnowledgeSettingsPage.tsx:73-180](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/KnowledgeSettingsPage.tsx#L73-L180) |
| [UI-046](#ui-046-marketplace-catalog-packages-offline-reports-and-update-lifecycle) | Marketplace catalog, packages, offline reports and update lifecycle | Implementation exists; catalog provenance and actual package install verification required. | [apps/electron/src/renderer/pages/settings/MarketplaceSettingsPage.tsx:152-194](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/MarketplaceSettingsPage.tsx#L152-L194) |
| [UI-047](#ui-047-extensions-settings-catalogs-dev-host-and-compatibility-center) | Extensions settings, catalogs, dev host and compatibility center | Implementation exists; multiple installation backends and dev APIs need release qualification. | [apps/electron/src/renderer/pages/settings/ExtensionsSettingsPage.tsx:391-513](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ExtensionsSettingsPage.tsx#L391-L513) |
| [UI-048](#ui-048-foreign-session-import-and-automatic-discovery-settings) | Foreign session import and automatic discovery settings | Implementation exists; source coverage and migration verification required. | [apps/electron/src/renderer/pages/settings/ImportSettingsPage.tsx:64-183](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ImportSettingsPage.tsx#L64-L183) |
| [UI-049](#ui-049-app-environment-notifications-power-proxy-and-updates-settings) | App environment, notifications, power, proxy and updates settings | Implementation exists; browser environment handling and native services verification required. | [apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx:117-211](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx#L117-L211) |
| [UI-050](#ui-050-ai-connections-provider-editor-and-workspace-model-overrides) | AI connections, provider editor and workspace model overrides | Implementation exists; provider availability/authentication and defaults verification required. | [apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:770-927](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx#L770-L927) |
| [UI-051](#ui-051-appearance-shell-variants-theme-language-density-and-icon-settings) | Appearance, shell variants, theme, language, density and icon settings | Implementation exists; visual settings have broad release validation scope. | [apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx:168-433](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx#L168-L433) |
| [UI-052](#ui-052-input-spellcheck-send-key-and-voice-settings) | Input, spellcheck, send key and voice settings | Implementation exists; voice section returns null until prefs load and needs visible failure/readiness behavior. | [apps/electron/src/renderer/pages/settings/InputSettingsPage.tsx:55-128](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/InputSettingsPage.tsx#L55-L128) |
| [UI-053](#ui-053-workspace-identity-tls-enabled-modes-directories-and-mcp-settings) | Workspace identity, TLS, enabled modes, directories and MCP settings | Implementation exists; filesystem/TLS and scope verification required. | [apps/electron/src/renderer/pages/settings/WorkspaceSettingsPage.tsx:393-646](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/WorkspaceSettingsPage.tsx#L393-L646) |
| [UI-054](#ui-054-permissions-defaults-workspace-rules-openclaw-audit-and-command-gateway) | Permissions defaults, workspace rules, OpenClaw audit and command gateway | Implementation exists; configuration gates and actual runtime policy verification required. | [apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx:173-222](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx#L173-L222) |
| [UI-055](#ui-055-labels-hierarchy-colors-and-saved-collection-views-settings) | Labels, hierarchy, colors and saved collection views settings | Implementation exists; label mutation and view references verification required. | [apps/electron/src/renderer/pages/settings/LabelsSettingsPage.tsx:169-276](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/LabelsSettingsPage.tsx#L169-L276) |
| [UI-056](#ui-056-organizations-membership-invitations-and-team-spaces-settings) | Organizations, membership, invitations and team spaces settings | Implementation exists; real multi-user and role enforcement verification required. | [apps/electron/src/renderer/pages/settings/OrganizationsSettingsPage.tsx:77-221](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/OrganizationsSettingsPage.tsx#L77-L221) |
| [UI-057](#ui-057-messaging-platform-connections-pairing-bindings-and-access-settings) | Messaging platform connections, pairing, bindings and access settings | Implementation exists; Slack explicitly listed as coming soon and must not be treated as complete. | [apps/electron/src/renderer/pages/settings/MessagingSettingsPage.tsx:1-95](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/MessagingSettingsPage.tsx#L1-L95) |
| [UI-058](#ui-058-server-remote-access-tls-auth-token-and-native-sidecar-settings) | Server remote access, TLS, auth token and native sidecar settings | Implementation exists; desktop remote-server settings are not a hosted-operations console by default. | [apps/electron/src/renderer/pages/settings/ServerSettingsPage.tsx:97-193](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ServerSettingsPage.tsx#L97-L193) |
| [UI-059](#ui-059-cloud-runs-provider-sandbox-quotas-and-scheduling-settings) | Cloud Runs provider, sandbox, quotas and scheduling settings | Observed UX boundary: provider token is external cloud-runs.env, not editable here; setup needs end-user provisioning path. | [apps/electron/src/renderer/pages/settings/CloudRunsSettingsPage.tsx:1-53](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/CloudRunsSettingsPage.tsx#L1-L53) |
| [UI-060](#ui-060-security-overview-openclaw-lifecycle-vault-health-and-risk-acceptance) | Security overview, OpenClaw lifecycle, vault health and risk acceptance | Implementation exists; displayed assurance requires actual supported backend evidence. | [apps/electron/src/renderer/pages/settings/SecuritySettingsPage.tsx:137-278](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/SecuritySettingsPage.tsx#L137-L278) |
| [UI-061](#ui-061-shortcuts-page-command-palette-and-platform-key-mappings) | Shortcuts page, command palette and platform key mappings | Implementation exists; duplicate pages/ShortcutsPage.tsx needs reachability review. | [apps/electron/src/renderer/pages/settings/ShortcutsPage.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ShortcutsPage.tsx#L1-L100) |
| [UI-062](#ui-062-preferences-identitypersonalocation-and-settings-embedding) | Preferences identity/persona/location and settings embedding | Supporting implementation exists and PreferencesForm is verified embedded in ContextSettingsPage.tsx:355; not a standalone registry subpage. | [apps/electron/src/renderer/pages/settings/PreferencesPage.tsx:118-205](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PreferencesPage.tsx#L118-L205) |
| [UI-063](#ui-063-shared-markdown-document-code-diff-and-media-viewers) | Shared Markdown, document, code, diff and media viewers | Implementation exists; every rich block and overlay needs actual renderer/browser verification. | [packages/ui/src/components/markdown/Markdown.tsx:1-120](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/components/markdown/Markdown.tsx#L1-L120) |
| [UI-064](#ui-064-shared-menus-dialogs-accessibility-and-responsive-primitives) | Shared menus, dialogs, accessibility and responsive primitives | Implementation exists; component checks do not replace full application accessibility. | [packages/ui/src/components/ui/PremiumMenu.tsx:1-110](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/components/ui/PremiumMenu.tsx#L1-L110) |
| [UI-065](#ui-065-localization-dates-plural-forms-and-visible-product-identity) | Localization, dates, plural forms and visible product identity | Observed documentation drift: AGENTS.md describes ten locales, while canonical LOCALE_REGISTRY registers twelve including Korean and Arabic; CloudRun detail has literal ID/Progress labels. | [packages/shared/src/i18n/registry.ts:51-76](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/i18n/registry.ts#L51-L76) |
| [UI-066](#ui-066-browser-profile-import-cookies-bookmarks-and-credential-consent) | Browser profile import, cookies, bookmarks and credential consent | Implementation exists under Import settings; privileged OS/browser profile access needs separate qualification. | [apps/electron/src/renderer/pages/settings/BrowserProfileImportPanel.tsx:1-112](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/BrowserProfileImportPanel.tsx#L1-L112) |
| [UI-067](#ui-067-workspace-picker-creation-folder-opening-remote-tls-and-ssh-bootstrap) | Workspace picker, creation, folder opening, remote TLS and SSH bootstrap | Implementation exists; real connection success and remote bootstrap qualification required. | [apps/electron/src/renderer/components/workspace/WorkspaceCreationScreen.tsx:25-184](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/workspace/WorkspaceCreationScreen.tsx#L25-L184) |

## [SURFACE-BACKLOG] Workbench, features and settings completion tasks

### [UI-001] Workbench shell, routes and window layouts

**Assessment:** Implementation exists; complete route and layout verification required.

**Code references:** [apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx:175-492](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx#L175-L492).

- **Requirements:** Qualify every route branch, lazy loading, stale selection, workspace switch, panel stack/resize, compact/mobile menus, sidebar/rail, status and transport banners; define recoverable loading and route error boundaries. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Open every inventory route, reload with selection, navigate back/forward, delete the selected item remotely, disconnect/reconnect and resize from narrow width to high DPI.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-001.1] Route recovery and deep links

**Code reference:** [apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx:175-492](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx#L175-L492); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Preserve workspace and entity selection through direct links, restart, browser history and missing/deleted entities. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Every link resolves to its own surface or a specific missing/unavailable state; no unrelated chat fallback.
- **Full functional verification:** Open direct links for session, source, skill, project, note, page, knowledge, extension, terminal, cloud-run and all extra screens; remove each entity while selected.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-001.2] Panel geometry and platform chrome

**Code reference:** [apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx:175-492](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx#L175-L492); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify all shell variants, native overlays and modal focus at supported DPI/zoom; persist only valid layout sizes. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Content remains usable without clipped actions, native view overlap or inaccessible resize handles.
- **Full functional verification:** Resize panels while opening dialogs, browser and extension hosts; repeat Windows 100/150/200% scaling and macOS Retina plus browser zoom.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-002] Onboarding, provider setup and reauthentication

**Assessment:** Implementation exists; fresh-install and authentication verification required.

**Code references:** [apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx:14-236](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx#L14-L236).

- **Requirements:** Complete Welcome, ROX connect, Git Bash, provider-select, local-model, credentials, OMP credentials and completion/reauth workflows using clean profiles; preserve retry/cancel and actionable failures. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Start from a clean profile, provision a provider, send the first real prompt, restart, expire credentials and reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/onboarding/__tests__/OnboardingWizard.test.tsx`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-002.1] Windows prerequisites and first result

**Code reference:** [apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx:14-236](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx#L14-L236); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Make Git Bash/toolchain discovery succeed with spaces/non-ASCII usernames and missing prerequisites; support reinstall and retry. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Onboarding produces a working runtime without assuming a developer PATH.
- **Full functional verification:** Use clean Windows 10 and 11 profiles with no developer tools, then install prerequisites and complete the first tool-using session.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/onboarding/__tests__/OnboardingWizard.test.tsx`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-002.2] OAuth, tokens and hosted onboarding

**Code reference:** [apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx:14-236](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx#L14-L236); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Use provider-specific OAuth redirect/state handling and server-side credentials in C; ensure cancellation/denial/expiry returns to a usable screen. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** First prompt succeeds only after actual authentication, with no credential exposed in UI logs or URLs.
- **Full functional verification:** Complete and cancel each advertised provider flow; deny consent, provide invalid token, lose network and restore it.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/onboarding/__tests__/OnboardingWizard.test.tsx`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-003] Home dashboard and every registered widget

**Assessment:** Implementation exists; dashboard layout is local and widgets require release qualification.

**Code references:** [apps/electron/src/renderer/platform/home/widgets.tsx:1352-1379](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L1352-L1379).

- **Requirements:** Verify summary, quickActions, recentSessions, agents, inbox, usage, models, balance, tasks, meetings, focus, automations, feed, notes, decisions, radar, taskTracker, inboxTracker, calls and calendar independently; reconcile displayed values with canonical stores. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Populate each source, add all twenty widgets, resize S/M/L, reorder by pointer/keyboard, remove/reset, reload and follow each action.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.1] Dashboard customization and persistence

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:1352-1379](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L1352-L1379); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Retain an explicit global layout contract and migrate local layout if account-level sync is promised; recover corrupted storage and failed widgets. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Other widgets remain functional; layout normalization never loses unrelated user data.
- **Full functional verification:** Arrange all widget types, reload, corrupt layout data and trigger one widget fetch failure.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.2] Widget data and action parity

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:1352-1379](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L1352-L1379); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Define every widget empty/unavailable/loading state and show accurate source-specific counts, cost, model, call/calendar readiness and destinations. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Counts and drill-down actions match real records; unsupported call/calendar features are explicitly described.
- **Full functional verification:** Compare all twenty widget values with their full pages and trigger each quick action after workspace switch.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.3] Home widget: summary

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:172-198](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L172-L198); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify workspace task/session/transport summary independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Create queued/running/review sessions and tasks; disconnect/reconnect and compare summary with live stores. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.4] Home widget: quickActions

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:238-307](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L238-L307); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify new chat, note/daily note, task/search and recording shortcuts independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Activate every quick action including denied mic and failed note creation; inspect resulting canonical resource. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.5] Home widget: recentSessions

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:308-339](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L308-L339); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify recent workspace sessions, unread/time/order and click-through independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Update and archive sessions across two workspaces, resize widget and open each displayed session. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.6] Home widget: agents

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:340-390](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L340-L390); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify running/waiting/stuck sessions and approval counts independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Run sessions, request credentials/permission, stall and cancel; compare Agent Center states. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.7] Home widget: inbox

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:391-428](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L391-L428); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify remote/local pending items and kind/status navigation independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Generate one pending item per kind, snooze/resolve externally and compare Inbox ordering/count. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.8] Home widget: usage

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:429-482](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L429-L482); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify daily tokens/cost, usage chart and model breakdown independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Meter sessions near local midnight with known/unknown usage and compare aggregation and timezone behavior. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.9] Home widget: models

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:483-540](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L483-L540); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify connection usage, workspace default and model totals independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Change workspace default, remove connection and compare model totals with session metadata. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.10] Home widget: balance

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:541-599](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L541-L599); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify real balance loading/missing/error/retry and spend summary independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Return valid/absent/failed balance service response and verify retry without invented credits. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.11] Home widget: tasks

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:600-642](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L600-L642); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify ranked open tasks, focus priorities and deadline links independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Change top-three priorities, complete/overdue tasks and open selected task after workspace switch. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.12] Home widget: meetings

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:667-730](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L667-L730); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify planned/local meeting overview, recording and details independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Plan and record meeting, deny microphone, update transcription state and follow details. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.13] Home widget: calls

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:731-781](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L731-L781); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify recent locally recorded calls and duration totals, not an implemented VoIP call service independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Record/import local call audio, compare duration totals and verify that UI describes the local recording contract. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.14] Home widget: focus

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:782-821](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L782-L821); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify focus timer and selected task state independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Run/pause/complete focus from full page, background timer and compare remaining time. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.15] Home widget: automations

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:878-957](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L878-L957); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify enabled schedule/next run/history and toggle feedback independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Enable/pause scheduled and event automation, fail toggle and compare full editor state. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.16] Home widget: feed

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:958-992](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L958-L992); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify current feed items and source-unavailable behavior independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Ingest source content, lose source access, update item and open canonical Feed item. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.17] Home widget: notes

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:1013-1040](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L1013-L1040); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify recent notes by update time and note navigation independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Create/edit/move/delete notes externally, resize widget and open each remaining note. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.18] Home widget: decisions

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:1041-1077](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L1041-L1077); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify accepted decisions and candidate-review attention independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Create accepted/candidate decisions, change status and follow entry into Decisions log. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.19] Home widget: radar

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:1078-1113](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L1078-L1113); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify latest sweep signals, topics/running/empty and digest navigation independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Run sweep, change topics/dismiss signals and compare Radar digest and widget. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.20] Home widget: taskTracker

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:1114-1199](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L1114-L1199); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify open/overdue/today/completed statistics, list distribution and quick add independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Create/complete overdue/today tasks, submit quick-add with RPC failure and inspect canonical task persistence. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.21] Home widget: inboxTracker

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:1200-1247](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L1200-L1247); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify decisions/blocking/messages/snoozed counts and per-kind bars independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Generate and resolve every Inbox kind, snooze items and compare counters and navigation. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-003.22] Home widget: calendar

**Code reference:** [apps/electron/src/renderer/platform/home/widgets.tsx:1248-1348](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/platform/home/widgets.tsx#L1248-L1348); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify seven-day local meetings/tasks/cron/note projection and event routing independently at S/M/L sizes, including loading, empty, error and disabled source states. Reconcile data with its authoritative source and retain workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Widget values and actions match real source state; source failures are explicit, layout remains usable and supported state survives reload.
- **Full functional verification:** Create events across midnight/DST, resize week/list layout and follow each source-kind event; do not claim external calendar synchronization from this projection alone. Repeat after reload and remote update on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/platform/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-004] Session lists, collections, Kanban and batch actions

**Assessment:** Implementation exists; collection interactions and persistence verification required.

**Code references:** [apps/electron/src/renderer/components/app-shell/SessionList.tsx:1-130](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/SessionList.tsx#L1-L130).

- **Requirements:** Qualify list/board, project/label/status/search filters, sorting/grouping/density, archived/unread/flagged states, child-session families, keyboard multiselect and batch rename/archive/delete/transfer. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create sessions in different projects/statuses, manipulate every filter/view and batch action while new events stream.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-004.1] Collection operations and accessible selection

**Code reference:** [apps/electron/src/renderer/components/app-shell/SessionList.tsx:1-130](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/SessionList.tsx#L1-L130); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Keep selection stable through filtering, virtualization, live updates and view changes; validate destructive confirmation and partial failure. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only intended records change and failed records remain recoverable.
- **Full functional verification:** Select ranges by keyboard, change filters, delete one selected record externally, and inject one failed batch mutation.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-004.2] Kanban lifecycle and task editor

**Code reference:** [apps/electron/src/renderer/components/app-shell/SessionList.tsx:1-130](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/SessionList.tsx#L1-L130); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify drag/status transitions, priority groups, subtask progress, model chips and task editor persistence. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Board and session detail agree after reload; active execution is not represented as completed.
- **Full functional verification:** Move queued/running/review/done cards across statuses; edit parent and child tasks during live execution.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-005] Chat transcript, composer and rich session views

**Assessment:** Implementation exists; full streaming/provider matrix verification required.

**Code references:** [apps/electron/src/renderer/pages/ChatPage.tsx:164-426](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ChatPage.tsx#L164-L426).

- **Requirements:** Qualify lazy transcript loading/retry, drafts, attachments, model/connection/thinking/permission selectors, working directory, stop/steer/queue, background tasks, thinking/tool cards, replies/reactions and transcript/document/mind-map views. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Run text/image/file/tool sessions with each advertised backend; interrupt, reconnect, switch sessions and reload during a turn.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-005.1] Composer and attachment round trip

**Code reference:** [apps/electron/src/renderer/pages/ChatPage.tsx:164-426](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ChatPage.tsx#L164-L426); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Persist draft text and attachments per session; support paste, drag/drop, file preview and unsupported vision warnings with C upload semantics. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Exactly the intended prompt and attachments arrive once; drafts never bleed into another session.
- **Full functional verification:** Attach images, PDFs and a large file, change model, switch sessions, reload, submit and inspect the backend received payload.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-005.2] Streaming, failures and transcript actions

**Code reference:** [apps/electron/src/renderer/pages/ChatPage.tsx:164-426](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ChatPage.tsx#L164-L426); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Reconcile chunks, final answer, errors, thinking completion, usage, tool output and background continuation across reconnect. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** No lost or duplicate messages; stop state and retry affordance correspond to runtime state.
- **Full functional verification:** Disconnect during tool output, cancel a turn, provoke provider failure, retry and open transcript overlays.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-006] Branching, rewriting, side threads and session workbench

**Assessment:** Implementation exists; backend-specific branch handshake and UI integrity verification required.

**Code references:** [apps/electron/src/renderer/pages/ChatPage.tsx:593-696](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ChatPage.tsx#L593-L696).

- **Requirements:** Verify fork/rewrite anchors, parent-child navigation, side-thread preview, inherited context, right-session bindings, revisions and child-session creation; qualify OMP anchors with server transcript truth. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Fork from middle and tail, rewrite a turn, create children and resume each branch after application restart.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-006.1] History and branch isolation

**Code reference:** [apps/electron/src/renderer/pages/ChatPage.tsx:593-696](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ChatPage.tsx#L593-L696); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Preserve branch point, artifacts, model and permission mode while isolating subsequent messages and tool side effects. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Branches contain the intended history and never merge future turns accidentally.
- **Full functional verification:** Fork mid-history after file edits, execute different tool actions in both branches and compare transcripts/metadata.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-006.2] Side-thread and contextual session panes

**Code reference:** [apps/electron/src/renderer/pages/ChatPage.tsx:593-696](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ChatPage.tsx#L593-L696); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Ensure preview dialog, workbench map and RightSessionShell route to the correct entity/revision and release subscriptions. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Context provenance remains accurate and closed panes stop observing the previous entity.
- **Full functional verification:** Open side thread from a note and session, change note revision, switch workspace and close/reopen the pane.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-007] Permission, credential, admin approval and source authentication dialogs

**Assessment:** Implementation exists; authorization and concurrent-dialog verification required.

**Code references:** [apps/electron/src/renderer/components/app-shell/input/structured/PermissionRequest.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/input/structured/PermissionRequest.tsx#L1-L100).

- **Requirements:** Finish all structured approval states, CredentialRequest, AdminApprovalRequest, source AuthRequestCard/APISetup/OAuthConnect and timeout/deny behavior; unify Inbox and composer views of the same request. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Trigger simultaneous permission/credential requests; allow once, allow always, deny, cancel, expire and reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/input/structured/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-007.1] Permission delivery and exact-once answers

**Code reference:** [apps/electron/src/renderer/components/app-shell/input/structured/PermissionRequest.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/input/structured/PermissionRequest.tsx#L1-L100); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Show requesting tool, scope and arguments; honor safe/ask/allow-all and deny expired requests without stale UI success. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** One backend response takes effect; stale requests disappear from every surface.
- **Full functional verification:** Respond in Inbox while composer displays the same request, then deliver a duplicate response and restart pending approval.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/input/structured/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-007.2] Credential privacy and source reauthentication

**Code reference:** [apps/electron/src/renderer/components/app-shell/input/structured/PermissionRequest.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/input/structured/PermissionRequest.tsx#L1-L100); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Use protected input/storage, grant-aware credential delivery and browser OAuth UX; redact sensitive fields from failures and telemetry. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Tool access follows explicit authentication and secret values are not rendered in transcript or errors.
- **Full functional verification:** Enter invalid credentials, abort authentication, refresh credentials and execute a real source tool.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/input/structured/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-008] Personal tasks, scheduling, lists and task detail

**Assessment:** Implementation exists; canonical RPC persistence and interaction verification required.

**Code references:** [apps/electron/src/renderer/pages/TasksPage.tsx:1-110](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TasksPage.tsx#L1-L110).

- **Requirements:** Qualify Inbox/Today/Evening/Upcoming/Anytime/Someday/Logbook/Trash, areas/projects/headings/tags, natural-language Quick Entry, deadlines/reminders, checklist, search, duplicate, move, drag reorder, export/import and undo. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create tasks with relative dates, move across all lists, edit details, complete/restore/delete and restart/reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/tasks/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-008.1] Task persistence, migration and conflict handling

**Code reference:** [apps/electron/src/renderer/pages/TasksPage.tsx:1-110](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TasksPage.tsx#L1-L110); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Use server canonical personalTasks RPC; retain migration/cache safely and expose failed sync without claiming saved state. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Canonical data contains each accepted edit once; conflicts and failures are visible and recoverable.
- **Full functional verification:** Import an old local bundle, edit from two clients, disconnect during save and reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/tasks/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-008.2] Keyboard, drag/drop, dates and reminders

**Code reference:** [apps/electron/src/renderer/pages/TasksPage.tsx:1-110](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TasksPage.tsx#L1-L110); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Map Cmd shortcuts to Ctrl where appropriate; preserve ordering and date semantics across timezones/DST and background sleep. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Task dates/order and notifications match user intent on A/B/C.
- **Full functional verification:** Exercise all documented task shortcuts and magic-plus drops; schedule a reminder across local midnight and wake from sleep.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/tasks/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-009] Task delegation and agent task projections

**Assessment:** Implementation exists; delegation failure recovery and agent-state verification required.

**Code references:** [apps/electron/src/renderer/pages/TasksPage.tsx:238-270](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TasksPage.tsx#L238-L270).

- **Requirements:** Qualify delegate-to-agent/session links, agent mention parsing, board/running/review/conductor projections and task/chat context; avoid orphan tasks or duplicate sessions on retries. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Delegate a task with subtasks/notes, interrupt session creation/send, retry and inspect task/session links.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/tasks/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-009.1] Atomic delegation and provenance

**Code reference:** [apps/electron/src/renderer/pages/TasksPage.tsx:238-270](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TasksPage.tsx#L238-L270); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Persist linkage only after successful session creation and initial prompt; define repair when rename/status/send fails. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** One linked usable session exists with full task prompt and clear recovery for partial creation.
- **Full functional verification:** Inject failure after session creation and before send, retry delegation and reopen task detail.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/tasks/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-009.2] Live agent projections and lifecycle

**Code reference:** [apps/electron/src/renderer/pages/TasksPage.tsx:238-270](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TasksPage.tsx#L238-L270); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Reflect runtime states, review requirements and completion separately from user task completion. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Task projections accurately reflect runtime state without silently completing personal tasks.
- **Full functional verification:** Run, pause, await permission, fail and finish delegated sessions while observing tasks and Kanban.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/tasks/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-010] Notes documents, folders, assets and Markdown editor

**Assessment:** Implementation exists; durable file edits and editor round-trip verification required.

**Code references:** [apps/electron/src/renderer/pages/NotesPage.tsx:1-95](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/NotesPage.tsx#L1-L95).

- **Requirements:** Qualify create/open/rename/move/delete notes and folders, properties/tags, daily notes, attachments/import/export, text/rich editing, autosave, external file watcher and linked-note rename impacts. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create a vault with linked Markdown, media and frontmatter; edit, rename/move, import, export, reopen and modify externally.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/notes/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-010.1] Safe editing, autosave and concurrent changes

**Code reference:** [apps/electron/src/renderer/pages/NotesPage.tsx:1-95](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/NotesPage.tsx#L1-L95); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Preserve Markdown/frontmatter/rich blocks; prevent stale editor writes from overwriting newer file revisions; handle save failures and recovery. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Accepted content is durable; conflicting content is preserved with an explicit resolution path.
- **Full functional verification:** Edit a note from two clients and external editor, disconnect on save, then reopen and inspect bytes/revisions.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/notes/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-010.2] Filesystem and hosted storage semantics

**Code reference:** [apps/electron/src/renderer/pages/NotesPage.tsx:1-95](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/NotesPage.tsx#L1-L95); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Handle Windows case/drive separators/reserved names and macOS Unicode; C uses tenant-scoped note storage and browser upload/download. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Links, properties, assets and note identity survive round trip on each target.
- **Full functional verification:** Rename linked notes and folders using spaces/non-ASCII names, import assets and export/reimport the complete vault.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/notes/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-011] Notes Base/Table, JSON Canvas, Outline, Graph and mind map

**Assessment:** Implementation exists; Canvas/view configuration is localStorage-backed and needs durable release policy.

**Code references:** [apps/electron/src/renderer/pages/notes/NotesViewHost.tsx:67-105](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/NotesViewHost.tsx#L67-L105).

- **Requirements:** Qualify every non-document view, saved Base/Table filters/formulas/sort/group/columns, Canvas nodes/edges/zoom/fit/import/export, Outline folds, Graph navigation and MindMapHost pin/layout/actions. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Build a cross-linked vault, switch every view, edit configurations, manipulate graphs and reload/reopen on a second client.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/notes/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-011.1] Saved views and Canvas durability

**Code reference:** [apps/electron/src/renderer/pages/notes/NotesViewHost.tsx:67-105](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/NotesViewHost.tsx#L67-L105); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Move user-authored view/canvas configurations to durable workspace storage or explicitly ship a documented local-only contract with export/recovery. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** User-authored graph/view data has an intentional, verified retention and recovery contract.
- **Full functional verification:** Create a Canvas and saved base, clear browser cache after export, restore it and open from another account device.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/notes/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-011.2] Graph/editor behavior and accessibility

**Code reference:** [apps/electron/src/renderer/pages/notes/NotesViewHost.tsx:67-105](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/NotesViewHost.tsx#L67-L105); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify selection, node move/resize, edges, keyboard deletion, zoom/fit, text editing and provenance links for every projection. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Every displayed node/formula is derived from correct records and all supported interactions work without clipping.
- **Full functional verification:** Use mouse and keyboard to edit Canvas; navigate Outline/Graph/mind map to source notes after note rename.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/notes/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-012] Note AI, comments, wiki links and vault insights

**Assessment:** Implementation exists; cross-module provenance and mutation verification required.

**Code references:** [apps/electron/src/renderer/pages/NotesPage.tsx:34-99](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/NotesPage.tsx#L34-L99).

- **Requirements:** Qualify AI action menu/custom prompts, selection replacement versus append, comments/highlights/TOC/folds/columns, wiki autocomplete/create, inspector tasks/entities/backlinks, footnotes, insights/index health, merge and undo. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Run each AI action on selected text, comment and link a note, inspect insights, merge entities and undo.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/notes/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-012.1] AI mutations and revision safety

**Code reference:** [apps/electron/src/renderer/pages/NotesPage.tsx:34-99](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/NotesPage.tsx#L34-L99); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Apply generated edits only to the intended selection/revision; expose cancellation/failure and review agent changes before destructive replacement. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** No stale selection replacement or hidden lost edits; AI provenance remains traceable.
- **Full functional verification:** Edit the note while AI generates, cancel one action and retry with custom prompt, then inspect saved Markdown.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/notes/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-012.2] Comments, links, insights and conversions

**Code reference:** [apps/electron/src/renderer/pages/NotesPage.tsx:34-99](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/NotesPage.tsx#L34-L99); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Persist comments/folds/links safely and verify note-to-task/session conversion, link suggestions, entity merge/undo and index repair. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Canonical note bytes, task links and index reflect the same accepted operations.
- **Full functional verification:** Rename a wiki target, follow backlinks, create task from a note, accept/reject a link suggestion and undo entity merge.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/notes/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-013] Unified Inbox, review actions and attention state

**Assessment:** Implementation exists; multi-source acknowledgement verification required.

**Code references:** [apps/electron/src/renderer/pages/InboxPage.tsx:91-216](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/InboxPage.tsx#L91-L216).

- **Requirements:** Qualify permission, credentials, plans, memory proposals, pending skills, messaging senders, errors and session unread items; search/filter/sort, snooze/dismiss and source-specific acknowledgement. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Generate one real item of each supported kind, resolve it from Inbox and underlying surface, and reload.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/inbox/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-013.1] Review actions and source state

**Code reference:** [apps/electron/src/renderer/pages/InboxPage.tsx:91-216](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/InboxPage.tsx#L91-L216); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Implement idempotent approval/rejection and clear error/retry for memory, skills, senders, plans and tools; preserve provenance. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only one mutation occurs; failures keep the item actionable with accurate source state.
- **Full functional verification:** Approve and reject each item type, race a second client response and force one RPC failure.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/inbox/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-013.2] Attention, snooze and stale-item cleanup

**Code reference:** [apps/electron/src/renderer/pages/InboxPage.tsx:91-216](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/InboxPage.tsx#L91-L216); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Reconcile unread counts, snooze expiry, deleted sessions and expired approval requests across live updates. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Inbox counts and details never expose unrelated workspace items or stale actions.
- **Full functional verification:** Snooze an item, advance clock, resolve externally and switch workspaces while events arrive.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/inbox/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-014] Inbox mail accounts, folders, message rendering and composition

**Assessment:** Implementation exists; real mail-server and hostile-content verification required.

**Code references:** [apps/electron/src/renderer/pages/inbox/mail/MailPanels.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/inbox/mail/MailPanels.tsx#L1-L100).

- **Requirements:** Qualify mail account readiness, folder/message list, flags/read state, search, message body sanitization, attachments and any advertised compose/reply/send actions using the actual mail API. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Connect a test mail account and process plain/HTML/multipart messages with attachments through the mail panels.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/inbox/mail/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-014.1] Mail actions and synchronization

**Code reference:** [apps/electron/src/renderer/pages/inbox/mail/MailPanels.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/inbox/mail/MailPanels.tsx#L1-L100); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify flag/move/delete/reply/send only where implemented and communicate unavailable operations; preserve account/folder selection on reconnect. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** UI and mailbox server agree; failed operations do not present a success state.
- **Full functional verification:** Read and flag messages, reconnect, compare server flags, and retry failed sends/moves with duplicate prevention.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/inbox/mail/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-014.2] Mail content and attachment safety

**Code reference:** [apps/electron/src/renderer/pages/inbox/mail/MailPanels.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/inbox/mail/MailPanels.tsx#L1-L100); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Render sanitized HTML with an explicit remote-content policy and authenticated attachment downloads; never execute mail scripts. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Message content remains readable and untrusted content cannot access application credentials or runtime APIs.
- **Full functional verification:** Open messages with script/event URLs, oversized attachments and remote tracking images on A/B/C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/inbox/mail/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-015] Feed agents, automation activity, news, subscriptions and source editor

**Assessment:** Implementation exists; data-source and annotation persistence verification required.

**Code references:** [apps/electron/src/renderer/pages/FeedPage.tsx:45-150](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/FeedPage.tsx#L45-L150).

- **Requirements:** Qualify agents/news/subscriptions/team activity and sources, source health/retry, refresh, read/unread, stars/colors/tags, search/filter/order/density, source CRUD and send-to-task/note actions. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Connect each advertised feed source, ingest items, annotate, edit source, create linked task/note and reload.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/feed/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-015.1] External feed ingest and source health

**Code reference:** [apps/electron/src/renderer/pages/FeedPage.tsx:45-150](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/FeedPage.tsx#L45-L150); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Show not-connected/error/rate-limit distinctly from empty; verify news/page-change/X-post subscriptions against owned source fixtures. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Healthy sources produce real content and failing sources offer accurate recovery.
- **Full functional verification:** Break source auth and URL, restore them, refresh repeatedly and compare de-duplicated items.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/feed/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-015.2] Feed annotations and conversions

**Code reference:** [apps/electron/src/renderer/pages/FeedPage.tsx:45-150](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/FeedPage.tsx#L45-L150); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Persist marks/tags/color/read state and task/note provenance durably; define view preference locality separately. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Accepted state survives reload and repeated actions do not create accidental duplicate resources.
- **Full functional verification:** Annotate and convert one item twice while reconnecting and open resulting note/task.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/feed/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-016] Local Meetings recording, imports, ASR and follow-up outputs

**Assessment:** Implementation exists; native/audio/model qualification required.

**Code references:** [apps/electron/src/renderer/pages/MeetingsPage.tsx:1-155](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/MeetingsPage.tsx#L1-L155).

- **Requirements:** Qualify planned/all/recording/ready/trash lists, microphone record/pause/resume/stop, audio import/drop, engine readiness/progress, transcript editing/search, summary, action items, decisions, attached documents and retention. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Record a meeting, pause/resume, transcribe, search/edit transcript, generate summary and convert action/decision into canonical task/log.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/meetings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-016.1] Recording and ASR lifecycle

**Code reference:** [apps/electron/src/renderer/pages/MeetingsPage.tsx:1-155](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/MeetingsPage.tsx#L1-L155); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Package supported audio codecs and ASR models; handle mic denial/disconnect, sleep, zero bytes, maximum file size, cancellation and engine failure. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Audio is retained according to consent and transcription reaches a truthful terminal state without corrupt recordings.
- **Full functional verification:** Use Windows and macOS microphones and C HTTPS browser capture; import supported/unsupported formats and stop during ASR.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/meetings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-016.2] Meeting outputs and durable links

**Code reference:** [apps/electron/src/renderer/pages/MeetingsPage.tsx:1-155](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/MeetingsPage.tsx#L1-L155); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Persist transcript/summary/attachments and derived tasks/decisions with source IDs; ensure restart/retry does not duplicate output. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Meeting and downstream records contain consistent provenance and edits survive restart.
- **Full functional verification:** Generate outputs, fail halfway, retry, reopen meeting and follow every task/decision/attachment.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/meetings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-017] Meeting workspace, agent readiness and proposal inbox

**Assessment:** Separate implementation exists; catalog route mounts pages/MeetingsPage.tsx, so reachability/product scope must be resolved.

**Code references:** [apps/electron/src/renderer/pages/meetings/MeetingsPage.tsx:1-29](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/MeetingsPage.tsx#L1-L29).

- **Requirements:** Resolve the relationship between local catalog and MeetingsWorkspace/AgentReadiness/MeetingDetail/ConationPanels/ProposalInbox; ship a discoverable supported route or remove unsupported entry points from production. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Trace and launch every meeting-workspace entry point, capture/manual/import/finalize RPC and proposal review with a real owned meeting.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/meetings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-017.1] Route and capability contract

**Code reference:** [apps/electron/src/renderer/pages/meetings/MeetingsPage.tsx:1-29](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/MeetingsPage.tsx#L1-L29); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Document which meeting workspace features are shipped on A/B/C; avoid promising live rooms/calendar if only local capture is supported. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** All marketed meeting actions are reachable or explicitly excluded by release scope.
- **Full functional verification:** Navigate from catalog, readiness, widget and deep link into each advertised meeting action.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/meetings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-017.2] Capture, finalization and proposal review

**Code reference:** [apps/electron/src/renderer/pages/meetings/MeetingsPage.tsx:1-29](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/MeetingsPage.tsx#L1-L29); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify start/capture/manual/import/finalize/proposal RPC with reconnect, duplicate calls and invalid state ordering. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** One finalized meeting and correct review outputs exist with recoverable failures.
- **Full functional verification:** Import transcript, finalize twice, review a generated proposal, reconnect before persistence acknowledgement.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/meetings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-018] Memory manager, injection meter and lesson provenance

**Assessment:** Implementation exists; mutation and context-injection parity verification required.

**Code references:** [apps/electron/src/renderer/components/memory/MemoryScreen.tsx:1-55](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/memory/MemoryScreen.tsx#L1-L55).

- **Requirements:** Qualify scope/status/type/source/usage/topics/tags facets, search/sort/bulk selection, create/edit/delete, pin/disable/promote, duplicates/merge, provenance/usage history and token budget; compare injected context with meter. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create scoped lessons, merge duplicates, promote/pin/disable them and run a session to inspect actual context selection.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-018.1] Lesson mutations and merge recovery

**Code reference:** [apps/electron/src/renderer/components/memory/MemoryScreen.tsx:1-55](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/memory/MemoryScreen.tsx#L1-L55); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Apply scoped mutations with confirmation, stable IDs and preserved provenance; reject cross-workspace unauthorized operations. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** No unrelated lesson is lost; accepted mutation and provenance are durable.
- **Full functional verification:** Merge/delete/promote lessons while a second client edits, restart and inspect source lineage.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-018.2] Context accounting and usage history

**Code reference:** [apps/electron/src/renderer/components/memory/MemoryScreen.tsx:1-55](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/memory/MemoryScreen.tsx#L1-L55); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Use the same selection semantics as runtime injection and distinguish approximate token counts from actual model billing. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Displayed in-context lessons and usage history match actual runtime selection.
- **Full functional verification:** Create lessons above budget, toggle pinned/disabled state and compare selected lesson IDs with runtime input.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-019] Automation editor, graph, schedules and execution history

**Assessment:** Implementation exists; scheduler and tool execution qualification required.

**Code references:** [apps/electron/src/renderer/components/automations/AutomationEditor.tsx:1-120](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/automations/AutomationEditor.tsx#L1-L120).

- **Requirements:** Qualify list/editor, events/matchers/conditions/actions, cron builder/timezone, graph/workspace editor, enable/pause, duplicate/delete, dry-run test, replay, timeline/history, errors and transfers. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create one event and one scheduled automation, run tests, execute, replay, pause and restart scheduler.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/automations/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-019.1] Editor serialization and scheduled execution

**Code reference:** [apps/electron/src/renderer/components/automations/AutomationEditor.tsx:1-120](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/automations/AutomationEditor.tsx#L1-L120); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Preserve JSON/graph configuration and reject invalid cycles/matchers/cron; qualify next-run display and DST/missed-run behavior. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Saved automation executes at the documented times exactly once and UI next-run matches scheduler.
- **Full functional verification:** Edit graph and JSON round trip, schedule across DST, pause/resume and restart before a scheduled time.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/automations/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-019.2] Test/replay and history integrity

**Code reference:** [apps/electron/src/renderer/components/automations/AutomationEditor.tsx:1-120](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/automations/AutomationEditor.tsx#L1-L120); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Separate preview/test from real effects and enforce permission/spend gates on replay; retain execution correlation IDs. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** History shows actual outcomes and preview cannot silently perform external side effects.
- **Full functional verification:** Run dry test then real automation; force action failure and replay with denied permission.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/automations/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-020] Projects home, creation, detail, assets and settings

**Assessment:** Implementation exists; resource/path and mutation verification required.

**Code references:** [apps/electron/src/renderer/pages/ProjectInfoPage.tsx:80-121](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ProjectInfoPage.tsx#L80-L121).

- **Requirements:** Qualify ProjectsHomeInMain/CreateProjectDialog, rename/icon/color/settings, linked sessions/pages/tasks, working directory, asset upload/delete and project deletion/transfer behavior. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create a project, upload assets/icon, associate each supported resource, change directory and delete after confirmation.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-020.1] Project metadata, assets and working directory

**Code reference:** [apps/electron/src/renderer/pages/ProjectInfoPage.tsx:80-121](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ProjectInfoPage.tsx#L80-L121); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate names/paths/assets and retain old assets until replacement metadata is accepted; C exposes server workspace paths only. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Metadata and assets remain consistent and failures do not delete the previous valid asset.
- **Full functional verification:** Upload invalid/large/non-ASCII assets, fail icon replacement and change directory after session creation.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-020.2] Resource membership and deletion

**Code reference:** [apps/electron/src/renderer/pages/ProjectInfoPage.tsx:80-121](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ProjectInfoPage.tsx#L80-L121); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Define deletion effects on linked tasks/sessions/pages and protect data; verify transfer collision handling. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Resource retention follows a documented contract without orphan route crashes.
- **Full functional verification:** Delete a project containing linked resources, cancel first, confirm, then inspect all remaining records.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-021] Sources catalog, MCP tools, permissions and source detail

**Assessment:** Implementation exists; connector/tool handshake verification required.

**Code references:** [apps/electron/src/renderer/pages/SourceInfoPage.tsx:211-288](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SourceInfoPage.tsx#L211-L288).

- **Requirements:** Qualify source list/grouping/menu, add/update/delete, enabled/auth states, source document/config edits, tools discovery, permission rules, reconnect and local source file reveal. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Add MCP/API/local sources, authenticate, discover tools, execute a real tool, change permissions and remove the source.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-021.1] Source health, auth and tools

**Code reference:** [apps/electron/src/renderer/pages/SourceInfoPage.tsx:211-288](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SourceInfoPage.tsx#L211-L288); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Distinguish configured from authenticated/reachable and refresh tool catalogs after config change; handle invalid credential/protocol/schema. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Health and tool availability reflect actual connectivity and mutations are recoverable.
- **Full functional verification:** Expire a token, disconnect MCP, change tool schema and reconnect while a chat uses the source.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-021.2] Source edits, policies and paths

**Code reference:** [apps/electron/src/renderer/pages/SourceInfoPage.tsx:211-288](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SourceInfoPage.tsx#L211-L288); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Persist source description/config/permissions with validation and C-safe path/download semantics; review legacy craftagents deep links. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Source policies apply to tool execution and all shipped links target ROX correctly.
- **Full functional verification:** Edit config, rename source, transfer, reveal/download configuration and open the generated source deep link.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-022] Skills catalog, OMP imports, editing and invocation

**Assessment:** Implementation exists; file discovery and live runtime activation verification required.

**Code references:** [apps/electron/src/renderer/pages/SkillInfoPage.tsx:56-162](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SkillInfoPage.tsx#L56-L162).

- **Requirements:** Qualify skill catalog/grouping/detail, name/description/icon/Markdown editing, OMP discovery/import, pending review, delete/reveal, mentions and workspace transfer; resolve legacy URL schemes. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Import a real OMP/workspace skill, edit it, activate via mention in a session and observe actual runtime instructions.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-022.1] Skill discovery and editing

**Code reference:** [apps/electron/src/renderer/pages/SkillInfoPage.tsx:56-162](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SkillInfoPage.tsx#L56-L162); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Handle duplicate slugs/scopes/malformed SKILL.md and file watcher updates; use browser import/export for C. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Catalog and runtime use the same selected skill content with stable scope.
- **Full functional verification:** Import duplicate/global/project skills, edit externally and rename/delete while selected.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-022.2] Activation and transfer integrity

**Code reference:** [apps/electron/src/renderer/pages/SkillInfoPage.tsx:56-162](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SkillInfoPage.tsx#L56-L162); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Check mention routing, preview/review, disabled/pending states and transfer collisions; ensure UI edit updates next runtime invocation. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only approved intended skill content is activated and provenance remains clear.
- **Full functional verification:** Invoke before and after edit, reject a pending skill, transfer to another workspace and invoke there.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-023] Connections hub, imports, credentials, grants and audit

**Assessment:** Implementation exists; OS import and Workgraph authorization qualification required.

**Code references:** [apps/electron/src/renderer/pages/ConnectionsPage.tsx:70-105](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ConnectionsPage.tsx#L70-L105).

- **Requirements:** Qualify services/imports/keys/infrastructure/runtime views, create/test/repair/revoke/rotate/convert connections, GitHub env/Git helper/Docker/AWS/keychain/ADC/SSH-agent preview/import, grants/bindings and audit. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Use owned fixture credentials for each importer, preview, commit, test real access, grant consumer then revoke/rotate.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__/connections-page.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-023.1] Credential import and preview safety

**Code reference:** [apps/electron/src/renderer/pages/ConnectionsPage.tsx:70-105](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ConnectionsPage.tsx#L70-L105); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Detect OS-supported importers and redact secret values; never treat preview as imported or show unavailable keychain helpers as working on Windows/C. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only selected imports become connections; errors expose no secret bytes.
- **Full functional verification:** Preview all seven importer classes, cancel, commit selected profiles, corrupt one config and reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__/connections-page.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-023.2] Connection lifecycle and consumer grants

**Code reference:** [apps/electron/src/renderer/pages/ConnectionsPage.tsx:70-105](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ConnectionsPage.tsx#L70-L105); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify test/repair, copy/reference conversion, secret rotation, scoped grants and revoked binding propagation. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Actual tool access follows authoritative grant state and audit records match every accepted mutation.
- **Full functional verification:** Grant a session limited access, rotate secret during use, revoke binding, then retry the same tool.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__/connections-page.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-024] Knowledge search, saved views and entity inspector

**Assessment:** Observed limitation: search selects the first connection; release must define provider/connection selection.

**Code references:** [apps/electron/src/renderer/knowledge/KnowledgeHome.tsx:1-137](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/knowledge/KnowledgeHome.tsx#L1-L137).

- **Requirements:** Qualify full-text search/debounce/errors, saved knowledge views, grouped results, attribute proposals, local/imported-note deep links and entity context/backlinks; support explicit connection selection or document a single-connection release. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Configure two connections, search distinct records, select saved views and inspect entities and backlinks.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/knowledge/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-024.1] Connection selection and result routing

**Code reference:** [apps/electron/src/renderer/knowledge/KnowledgeHome.tsx:1-137](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/knowledge/KnowledgeHome.tsx#L1-L137); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Bind searches/views/entities to the intended workspace/connection; preserve provider IDs and local migration map resolution. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Search and details return the intended provider record and do not open an unrelated local note.
- **Full functional verification:** Create duplicate record IDs in two providers, change primary connection, follow hits after notes migration.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/knowledge/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-024.2] Saved-view mutations and inspector fidelity

**Code reference:** [apps/electron/src/renderer/knowledge/KnowledgeHome.tsx:1-137](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/knowledge/KnowledgeHome.tsx#L1-L137); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify saved view filters/grouping and set-attribute proposals; handle partial context/backlink failure visibly. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Views and inspector reflect actual accepted state with a precise degraded state.
- **Full functional verification:** Run each configured view, propose attribute change, approve it and reload inspector with one failed context fetch.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/knowledge/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-025] Knowledge proposals and diff review

**Assessment:** Implementation exists; proposal state and conflict verification required.

**Code references:** [apps/electron/src/renderer/knowledge/KnowledgeDiff.tsx:82-109](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/knowledge/KnowledgeDiff.tsx#L82-L109).

- **Requirements:** Qualify proposals list/status filter/count, diff renderer, base/current/new content, approve/reject/rebase/conflict affordances and updates emitted while review is open. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Propose a real mutation, modify source independently, review the conflict, resolve/reject and inspect actual stored data.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/knowledge/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-025.1] Review, apply and reject semantics

**Code reference:** [apps/electron/src/renderer/knowledge/KnowledgeDiff.tsx:82-109](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/knowledge/KnowledgeDiff.tsx#L82-L109); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Ensure review action is authorized, idempotent and revision-bound; preserve failed proposals for retry. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Exactly one accepted mutation occurs and failed/conflicting states remain explicit.
- **Full functional verification:** Approve twice from two clients, reject stale proposal and force failure after preview.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/knowledge/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-025.2] Diff provenance and live refresh

**Code reference:** [apps/electron/src/renderer/knowledge/KnowledgeDiff.tsx:82-109](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/knowledge/KnowledgeDiff.tsx#L82-L109); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Show correct source/connection/revision and refresh counts/detail when another client changes the proposal. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Rendered diff and action eligibility track authoritative proposal state.
- **Full functional verification:** Review proposals containing code/Markdown/attributes then modify/reject externally.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/knowledge/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-026] Optional knowledge engine and embedded SiYuan surface

**Assessment:** Native implementation exists; direct SiYuan native view/bounds calls need a C surface alternative.

**Code references:** [apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx:139-360](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx#L139-L360).

- **Requirements:** Decide supported external-local/managed/remote engine modes, mounting/reuse, engine readiness/auth, export, evaluations and view lifecycle; keep local notes as default and optional engine dependency explicit. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Start/stop engine, open embedded surface, resize panels, export data, disconnect engine and reopen.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-026.1] Native engine host lifecycle

**Code reference:** [apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx:139-360](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx#L139-L360); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Package/probe supported engine, synchronize bounds, destroy orphan instances and preserve authored content across crash/restart. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** No leaked native views or hidden data loss; surface clearly reports unavailable engine.
- **Full functional verification:** Open multiple engine views, switch workspaces, crash engine and move/resize the app.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-026.2] Hosted engine access and export

**Code reference:** [apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx:139-360](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx#L139-L360); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Provide an authenticated web editor/route or supported remote-engine iframe contract with correct origin policy, TLS and downloadable export. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Hosted users can use every advertised engine operation without native bounds APIs.
- **Full functional verification:** Open C from another machine, reject blocked origin/token, export full content and reimport.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-027] Browser pane, profiles, navigation and inspector browser

**Assessment:** Native browser view implementation exists; it is not directly renderable as a hosted browser pane.

**Code references:** [apps/electron/src/renderer/pages/BrowserPanelPage.tsx:62-171](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/BrowserPanelPage.tsx#L62-L171).

- **Requirements:** Qualify navigation/back/forward/reload/URL/security state, profiles/session auth, native bounds, persisted instances, focus, overlays and inspector routing; define C remote-browser interaction or explicit native-only availability. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Open an owned site, authenticate, navigate/download, resize and reopen across restart with overlays.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-027.1] Native WebContents geometry and lifecycle

**Code reference:** [apps/electron/src/renderer/pages/BrowserPanelPage.tsx:62-171](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/BrowserPanelPage.tsx#L62-L171); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Keep browser views aligned with shell panels and modal stacking; release subscriptions/views correctly and preserve intended profile isolation. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** No click-through, view overlap or leaked authenticated profile between workspaces.
- **Full functional verification:** Open two profiles, cover with menus/dialogs, switch workspace and close/reopen at Retina/high DPI.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-027.2] Browser capability on C

**Code reference:** [apps/electron/src/renderer/pages/BrowserPanelPage.tsx:62-171](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/BrowserPanelPage.tsx#L62-L171); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Implement a secure hosted remote-browser view if promised, including interaction/session/download behavior; otherwise gate the feature and provide supported navigation. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Feature works according to published platform contract; arbitrary sites are not falsely presented as iframe-compatible.
- **Full functional verification:** Use hosted UI to perform the documented browser workflow and verify isolation with a second tenant.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-028] Embedded extension views and extension host integration

**Assessment:** Native extension surface implementation exists; C requires a browser-capable host.

**Code references:** [apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx:68-144](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx#L68-L144).

- **Requirements:** Qualify createEmbedded, initial route/state, bounds, focus, message/event subscriptions, enable/update/uninstall behavior and host crash recovery; implement capability-constrained hosted extension views. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Install a test extension exposing a view, exercise it, update/uninstall while open and restart host.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-028.1] View lifecycle, state and host failures

**Code reference:** [apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx:68-144](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx#L68-L144); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Persist supported extension view state and destroy orphan native instances; reject views from disabled/uninstalled extension. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Views recover or close accurately without orphan native windows or stale privileged callbacks.
- **Full functional verification:** Open/resize multiple views, kill host, disable extension, recover and inspect instance registry.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-028.2] Hosted extension isolation

**Code reference:** [apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx:68-144](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx#L68-L144); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Provide browser view execution with origin/capability/tenant isolation and compatibility reporting for native-only extensions. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only granted supported capabilities execute; unsupported views cannot break hosted shell.
- **Full functional verification:** Run extension that requests filesystem/clipboard/network, deny grant and test tenant separation.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-029] Terminal route, dock and genuine interactive shell

**Assessment:** Observed implementation gaps: full UEW PTY/xterm contribution is unwired; terminalId labels a generic InspectorTerminal. Both desktop and headless shell EXEC handlers hardcode /bin/zsh (unavailable on standard Windows) with 20-second/1-MiB command-runner limits.

**Code references:** [apps/electron/src/renderer/pages/TerminalSurfacePage.tsx:1-76](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TerminalSurfacePage.tsx#L1-L76) ; [apps/electron/src/main/handlers/system.ts:289-314](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/handlers/system.ts#L289-L314) ; [packages/server-core/src/handlers/rpc/system.ts:385-409](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/system.ts#L385-L409) ; [apps/electron/src/renderer/components/session-inspector/InspectorTerminal.tsx:5-39](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/session-inspector/InspectorTerminal.tsx#L5-L39).

- **Requirements:** Define release contract for command runner versus full terminal. Implement real terminal identity/PTY/session lifecycle if advertising interactive terminal, including streaming, input, resize, cwd, exit, interrupt and reconnection; choose Windows shell rather than assuming zsh. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Open two terminal IDs, run distinct cwd commands, an interactive program, long-running output, Ctrl+C and reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__/terminal-cloudrun-hosts-nav.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-029.1] Cross-platform interactive terminal

**Code reference:** [apps/electron/src/main/handlers/system.ts:289-314](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/handlers/system.ts#L289-L314); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Wire PTY/xterm and Windows ConPTY/selected shell or limit advertised behavior explicitly; bind commands and cwd to terminalId. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Supported terminal semantics work and two terminals keep independent process/cwd/history.
- **Full functional verification:** Run PowerShell/Git Bash on A, zsh on B and isolated server PTY on C; resize and interrupt interactive processes.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__/terminal-cloudrun-hosts-nav.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-029.2] Execution authorization and recovery

**Code reference:** [packages/server-core/src/handlers/rpc/system.ts:385-409](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/rpc/system.ts#L385-L409); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Enforce shell permission, tenant/workspace filesystem boundary, cancellation and disconnect process policy; retain useful session output. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** No arbitrary host shell access from C; process ownership and recovery behavior are explicit.
- **Full functional verification:** Deny shell access, disconnect running process, reconnect and close dock while process runs.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__/terminal-cloudrun-hosts-nav.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-030] Cloud-run detail surface and live run operations

**Assessment:** Observed limitation: detail loads once per runId with no event/poll subscription; fallback synthesizes createdAt=Date.now().

**Code references:** [apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx:40-122](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx#L40-L122).

- **Requirements:** Implement truthful live queued/running/done/failed/cancelled detail, reconnect/refresh, actual timestamps/provider, progress, logs/artifacts, cancellation and linked session; retain explicit disabled/missing/error states. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Keep detail open while a real run progresses and finishes, then inspect artifacts and linked session after reload.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__/terminal-cloudrun-hosts-nav.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-030.1] Live detail and trustworthy metadata

**Code reference:** [apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx:40-122](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx#L40-L122); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Subscribe/poll authoritative status and fetch actual run metadata; do not present current time as historical creation time when fallback probe returns only status. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Detail displays correct historical metadata and updates status without route remount.
- **Full functional verification:** Select an old run absent from list and a running run, update backend and reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__/terminal-cloudrun-hosts-nav.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-030.2] Run artifacts, cancellation and failures

**Code reference:** [apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx:40-122](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx#L40-L122); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Expose supported logs/artifacts/downloads and authorized cancellation/retry actions with clear provider failures. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** UI reflects authoritative outcome and all advertised run outputs are accessible securely.
- **Full functional verification:** Cancel a running run, deny download, retry failed run and inspect artifact bytes.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/app-shell/__tests__/terminal-cloudrun-hosts-nav.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-031] Generated Pages catalog, page runtime and capability grants

**Assessment:** Implementation exists; iframe bridge and grant lifecycle verification required.

**Code references:** [apps/electron/src/renderer/components/pages/PageFrame.tsx:74-319](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/pages/PageFrame.tsx#L74-L319).

- **Requirements:** Qualify PagesHome create/delete/search/project filters, PageView rename/project/lease/snapshot/source auth, html/md/script frames and granted actions/cancel; verify PageGrantsDialog and PageGrantRequestDialog. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create each supported page kind, open two clients, request/approve/deny capabilities and delete while leased.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-031.1] Iframe messaging, leases and action isolation

**Code reference:** [apps/electron/src/renderer/components/pages/PageFrame.tsx:74-319](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/pages/PageFrame.tsx#L74-L319); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Authenticate message sender/window, correlate IDs, constrain grants and invalidate leases; verify user activation and cancellation. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Untrusted frames cannot invoke application APIs outside valid scoped grants.
- **Full functional verification:** Send forged postMessage from sibling frame, replay expired request and close page during long action.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-031.2] Page lifecycle and content fidelity

**Code reference:** [apps/electron/src/renderer/components/pages/PageFrame.tsx:74-319](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/pages/PageFrame.tsx#L74-L319); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Preserve page config/content/snapshot through rename, source-auth recovery, refresh and concurrent lease contention. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Page data remains durable and expired/missing content receives a precise recoverable state.
- **Full functional verification:** Edit/reopen pages, fail source auth, transfer project and delete active page.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-032] Page publication, session sharing and publish dialogs

**Assessment:** Implementation exists; enabled capability does not prove hosted publication infrastructure.

**Code references:** [apps/electron/src/renderer/components/pages/SharePageDialog.tsx:52-185](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/pages/SharePageDialog.tsx#L52-L185).

- **Requirements:** Qualify publish/update/unpublish/password, sharing capability discovery, public URLs/copy/QR and PublishSessionDialog plus Chat shareToViewer/updateShare/revokeShare; connect to live supported hosted publication. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Publish owned page and session, read in logged-out browser, update, set password and revoke.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-032.1] Public publication lifecycle

**Code reference:** [apps/electron/src/renderer/components/pages/SharePageDialog.tsx:52-185](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/pages/SharePageDialog.tsx#L52-L185); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Deploy required publishing endpoints/storage and confirm readback; disable sharing when backend unavailable and retain precise errors. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Public content matches published snapshot and revoked URLs stop serving protected content.
- **Full functional verification:** Publish then independently fetch public URL, update content, revoke and attempt access again.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-032.2] Access control, password and sensitive content review

**Code reference:** [apps/electron/src/renderer/components/pages/SharePageDialog.tsx:52-185](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/pages/SharePageDialog.tsx#L52-L185); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Enforce publication password/auth, version bounds and reviewed inclusion of attachments/session data. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only intentionally published content is accessible and password controls operate on server.
- **Full functional verification:** Open protected link without/wrong/right password; inspect payload for excluded secrets, private files and tool credentials.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/pages/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-033] Team activity, invitations and workspace transfers

**Assessment:** Implementation exists; multi-user authority and transfer verification required.

**Code references:** [apps/electron/src/renderer/components/team/TeamOrgSettingsSection.tsx:1-43](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/team/TeamOrgSettingsSection.tsx#L1-L43).

- **Requirements:** Qualify team roster/presence/activity/inbox, organization team spaces, session presence avatars, resource/session send dialogs and remote workspace creation/connection; verify cross-workspace scope and collisions. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Use two real users/workspaces, send session/source/skill/automation/page/project resources, inspect recipient state and revoke access.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/team/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-033.1] Workspace transfer correctness

**Code reference:** [apps/electron/src/renderer/components/team/TeamOrgSettingsSection.tsx:1-43](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/team/TeamOrgSettingsSection.tsx#L1-L43); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Define copy/move/provenance and dependency mapping, including attachments/source references and name collisions. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Destination records are usable and source retention follows documented semantics without duplicate/corrupt copies.
- **Full functional verification:** Transfer each supported resource with duplicate slug and inaccessible dependency, fail halfway and retry.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/team/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-033.2] Team presence and collaboration boundaries

**Code reference:** [apps/electron/src/renderer/components/team/TeamOrgSettingsSection.tsx:1-43](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/team/TeamOrgSettingsSection.tsx#L1-L43); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Show real identity/presence and authorized activity; enforce server roles rather than local UI selection. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Activity and resource access follow current server authorization on A/B/C.
- **Full functional verification:** Join/leave team, revoke membership while viewing shared session and attempt mutation from removed user.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/team/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-034] Dossier contacts, companies, touches and generated briefs

**Assessment:** Observed limitation: authored dossiers persist in localStorage through extra-screens/storage; release durability policy required.

**Code references:** [apps/electron/src/renderer/pages/extra-screens/dossier/DossierPage.tsx:103-154](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/dossier/DossierPage.tsx#L103-L154).

- **Requirements:** Qualify person/company creation/edit/delete/search/filter, suggestions, source touches from sessions/messaging/meetings/tasks/notes/feed, promised/pending summary, generated brief and task conversion. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create linked person/company dossiers, generate brief from owned records, edit source and reopen from another client.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/dossier-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-034.1] Dossier durable data and source identity

**Code reference:** [apps/electron/src/renderer/pages/extra-screens/dossier/DossierPage.tsx:103-154](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/dossier/DossierPage.tsx#L103-L154); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Persist authored entity data in workspace store or explicitly constrain release to local data with export/recovery; resolve ambiguous person matching. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Authored data is recoverable and no unrelated workspace/person activity appears.
- **Full functional verification:** Create identical names in two workspaces, clear cache after backup and restore; compare linked touches.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/dossier-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-034.2] Brief generation and conversions

**Code reference:** [apps/electron/src/renderer/pages/extra-screens/dossier/DossierPage.tsx:103-154](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/dossier/DossierPage.tsx#L103-L154); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Ground briefs in linked records, respect read-only agent execution and attach source IDs; verify create-task and refresh behavior. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Brief claims have traceable sources and one correctly linked task is created.
- **Full functional verification:** Generate brief, cancel/fail run, edit referenced meeting and convert a pending promise to task.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/dossier-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-035] Radar topics, source signals, sweeps and digest detail

**Assessment:** Observed limitation: authored Radar topics/sweeps/dismissals use localStorage; run synchronization exists and needs qualification.

**Code references:** [apps/electron/src/renderer/pages/extra-screens/radar/RadarPage.tsx:58-163](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/radar/RadarPage.tsx#L58-L163).

- **Requirements:** Qualify topic/keyword CRUD, local signal matching, feed/meeting/note/session aggregation, agent sweep start/sync/parse/error states, dismissals and signal-to-task/link actions. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Configure topics, run a sweep with matching sources, inspect digest, dismiss signal and create task.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/radar-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-035.1] Radar state, agent runs and parse recovery

**Code reference:** [apps/electron/src/renderer/pages/extra-screens/radar/RadarPage.tsx:58-163](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/radar/RadarPage.tsx#L58-L163); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Persist topics/sweeps/results and recover incomplete runs after restart; reject malformed results without losing source records. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Digest reports actual run status and retained signals remain recoverable without duplicated sweeps.
- **Full functional verification:** Restart during sweep, return malformed/partial output, reconnect and rerun.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/radar-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-035.2] Signal provenance, relevance and actions

**Code reference:** [apps/electron/src/renderer/pages/extra-screens/radar/RadarPage.tsx:58-163](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/radar/RadarPage.tsx#L58-L163); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Resolve all local/external signals to source records and validate links before opening; preserve task conversion origin. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Relevant sources only appear and actions open the correct record with intentional duplicate handling.
- **Full functional verification:** Add same keyword in unrelated workspace, edit/delete source and create task from digest twice.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/radar-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-036] Decisions log, extraction and memory promotion

**Assessment:** Observed limitation: decision records are localStorage-backed; memory and extraction APIs exist.

**Code references:** [apps/electron/src/renderer/pages/extra-screens/decisions/DecisionsPage.tsx:62-116](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/decisions/DecisionsPage.tsx#L62-L116).

- **Requirements:** Qualify manual decision title/why/who/rejected options, status/source/date/search filters, edit/delete, session/meeting extraction, pending run polling and promote/remove memory rule. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create and extract decisions, promote to memory, edit decision and inspect linkage after restart.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/decisions-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-036.1] Durable log, extraction and de-duplication

**Code reference:** [apps/electron/src/renderer/pages/extra-screens/decisions/DecisionsPage.tsx:62-116](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/decisions/DecisionsPage.tsx#L62-L116); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Persist decisions, sources and pending extraction run IDs authoritatively; reconcile manual/meeting/agent entries by stable provenance. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** One intended decision per accepted extraction exists with durable provenance and history.
- **Full functional verification:** Extract twice, restart mid-run, edit source and delete decision with confirmation.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/decisions-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-036.2] Memory promotion lifecycle

**Code reference:** [apps/electron/src/renderer/pages/extra-screens/decisions/DecisionsPage.tsx:62-116](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/decisions/DecisionsPage.tsx#L62-L116); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Synchronize promoted rules with lesson store; define edit/delete behavior so stale rules do not remain silently injected. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Displayed promotion state and actual memory injection agree.
- **Full functional verification:** Promote decision, edit it, remove promotion, delete it and inspect subsequent runtime context.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/decisions-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-037] Agent Center, stop controls, automations and budget monitor

**Assessment:** Observed limitation: budget is local monitor input to pure buildAgentCenter; no execution enforcement is shown here.

**Code references:** [apps/electron/src/renderer/pages/extra-screens/agents/AgentCenterPage.tsx:103-179](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/agents/AgentCenterPage.tsx#L103-L179).

- **Requirements:** Qualify running/waiting/stuck classification, cost metrics, daily budget display, stop/stop-all, cancel cloud run, automation pause-all/resume-paused and partial failures; clarify whether budget is advisory or enforce server quota. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Run local/cloud sessions, await approvals, set budget, stop all and pause/resume automations while one action fails.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/agent-center-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-037.1] Cancellation and automation ownership

**Code reference:** [apps/electron/src/renderer/pages/extra-screens/agents/AgentCenterPage.tsx:103-179](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/agents/AgentCenterPage.tsx#L103-L179); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Ensure bulk controls handle each failure, target owned runs only and resume only automations paused by this center. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Partial results remain visible and unrelated paused automations are never resumed.
- **Full functional verification:** Mix externally paused/enabled automations, inject one failed pause/cancel and reopen center.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/agent-center-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-037.2] Cost and budget contract

**Code reference:** [apps/electron/src/renderer/pages/extra-screens/agents/AgentCenterPage.tsx:103-179](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/agents/AgentCenterPage.tsx#L103-L179); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Show authoritative cost/timezone basis and distinguish advisory monitor from enforced spending cap; implement server enforcement if advertised. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** UI does not claim spending protection unless runtime actually rejects excess usage.
- **Full functional verification:** Exceed budget with real metered test run, use unknown costs and cross midnight.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/agent-center-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-038] Focus timer, daily priorities, calendar and daily summary

**Assessment:** Implementation exists; focus/local calendar storage and summary persistence qualification required.

**Code references:** [apps/electron/src/renderer/pages/extra-screens/focus/FocusPage.tsx:50-126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/focus/FocusPage.tsx#L50-L126).

- **Requirements:** Qualify top-three priority selection, timer start/pause/reset/finish/history, sleep/reload behavior, calendar/meeting day merge, inbox triage and generated daily summary note. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Choose priorities, run timer across sleep/restart, merge calendar events and write/open summary note.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/focus-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-038.1] Timer durability and correct elapsed time

**Code reference:** [apps/electron/src/renderer/pages/extra-screens/focus/FocusPage.tsx:50-126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/focus/FocusPage.tsx#L50-L126); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Retain focus state/history and calculate wall-clock progress across sleep/time changes; define global versus workspace scope. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Timer/history reflect documented elapsed-time and scope semantics without duplicate completions.
- **Full functional verification:** Start timer, sleep machine/background tab, change timezone, reload and switch workspace.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/focus-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-038.2] Calendar and summary outputs

**Code reference:** [apps/electron/src/renderer/pages/extra-screens/focus/FocusPage.tsx:50-126](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/focus/FocusPage.tsx#L50-L126); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Reconcile real imported calendar/meetings and generate source-grounded daily summary with reliable note write/retry. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Day plan and saved summary match actual sources; retries do not falsely report saved notes.
- **Full functional verification:** Import events near midnight/DST, complete task, write summary twice and simulate note-save error.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/extra-screens/__tests__/focus-model.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-039] Settings overview, navigator and registry coverage

**Assessment:** Implementation exists; registry contains 22 settings subpages and supporting legacy pages require scope review.

**Code references:** [apps/electron/src/renderer/pages/settings/settings-pages.ts:20-83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/settings-pages.ts#L20-L83).

- **Requirements:** Qualify settings overview attention/actions/recent routes, search/navigation, lazy errors and capability gates; document every registered page and remove or explicitly route duplicate legacy settings surfaces. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Open all twenty-two settings routes, exercise attention/recent links, reload direct settings URL and deny capability.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-039.1] Registry and legacy reachability

**Code reference:** [apps/electron/src/renderer/pages/settings/settings-pages.ts:20-83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/settings-pages.ts#L20-L83); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify SettingsNavigator/overview registry parity and inspect PreferencesPage plus duplicate ShortcutsPage before release. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Every supported settings page is reachable once with valid metadata and stale entries are handled.
- **Full functional verification:** Enumerate shared/settings-registry against lazy component map and attempt each entry from both desktop/mobile navigation.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-039.2] Settings error and apply semantics

**Code reference:** [apps/electron/src/renderer/pages/settings/settings-pages.ts:20-83](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/settings-pages.ts#L20-L83); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Give failed reads/writes visible retry, preserve unsaved forms and distinguish application/workspace/server preferences. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Scope and saved/unsaved state are accurate on each page without silent lost edits.
- **Full functional verification:** Navigate with dirty form, fail save, change workspace and reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-040] Account profile, avatar, XP and balance settings

**Assessment:** Observed product boundary: plan picker is intentionally hidden; plan label is local and is not billing.

**Code references:** [apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx:1-46](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx#L1-L46).

- **Requirements:** Qualify profile display name/email/avatar remove/upload, usage/XP/level/event history, balance availability and analytics consent; keep plan/balance claims aligned with real entitlement or explicitly scoped local profile. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Edit profile/avatar, generate real XP event, toggle consent and compare usage/balance with authoritative source.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/AccountSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-040.1] Identity, avatar and profile persistence

**Code reference:** [apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx:1-46](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx#L1-L46); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate raster image uploads, size/MIME, thumbnail failure and concurrent profile updates; use browser upload for C. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Valid profile persists and invalid avatar cannot destroy previous valid profile.
- **Full functional verification:** Upload malformed/SVG/large image, change profile from second client, restart and inspect stored profile.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/AccountSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-040.2] Gamification, balance and entitlement clarity

**Code reference:** [apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx:1-46](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx#L1-L46); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify event accounting/consent and keep unavailable balance/hidden plan honest; add billing only if commercial release requirements demand it. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** XP is not duplicated, consent controls actual telemetry and local labels never impersonate purchased entitlement.
- **Full functional verification:** Generate event twice, switch workspace, revoke analytics and inspect balance with missing service.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/AccountSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-041] Accounts, service identity, cloud connection and logout

**Assessment:** Implementation exists; actual service identity and reset behavior verification required.

**Code references:** [apps/electron/src/renderer/pages/settings/AccountsSettingsPage.tsx:73-210](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AccountsSettingsPage.tsx#L73-L210).

- **Requirements:** Qualify profile/save/refresh, notes local/cloud accounts, token-based connect/disconnect, credential health/migration and logout/reset confirmation; distinguish local profile from authenticated remote identity. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Connect owned cloud account, refresh, expire token, reconnect/disconnect then logout on test profile.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/AccountsSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-041.1] Cloud account lifecycle and health

**Code reference:** [apps/electron/src/renderer/pages/settings/AccountsSettingsPage.tsx:73-210](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AccountsSettingsPage.tsx#L73-L210); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Confirm identityConnect reaches actual service and reports verified account/status; verify refresh and token expiry without leaking values. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Connected status reflects server identity and recovery restores real access.
- **Full functional verification:** Use valid/invalid token, simulate service outage and refresh existing connection.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/AccountsSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-041.2] Logout/reset and data retention

**Code reference:** [apps/electron/src/renderer/pages/settings/AccountsSettingsPage.tsx:73-210](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AccountsSettingsPage.tsx#L73-L210); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Define session invalidation, local data retention and optional reset clearly; ensure cancel cannot erase data. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only documented data is cleared and old remote authentication stops working.
- **Full functional verification:** Cancel reset, confirm logout, reopen and sign back in; inspect local notes and remote session validity.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/AccountsSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-042] Privacy purpose controls, export and remote deletion

**Assessment:** Implementation exists; completed export/deletion proof required rather than queued UI status alone.

**Code references:** [apps/electron/src/renderer/pages/settings/PrivacySettingsPage.tsx:48-113](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PrivacySettingsPage.tsx#L48-L113).

- **Requirements:** Qualify purpose consent dependencies, realtimeSync/recovery relation, pending/error/status, actual export delivery and remote deletion lifecycle with explicit local retention. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Toggle each purpose, request and download export, request deletion in test tenant and verify completed remote removal.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/PrivacySettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-042.1] Consent enforcement and dependencies

**Code reference:** [apps/electron/src/renderer/pages/settings/PrivacySettingsPage.tsx:48-113](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PrivacySettingsPage.tsx#L48-L113); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Apply consent to actual analytics/sync/recovery flows; explain disabled dependent controls and handle reconnect conflicts. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Data flows follow persisted consent rather than the toggle alone.
- **Full functional verification:** Revoke recovery/realtime consent while sync runs and inspect server traffic/retained data.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/PrivacySettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-042.2] Export/deletion completion and readback

**Code reference:** [apps/electron/src/renderer/pages/settings/PrivacySettingsPage.tsx:48-113](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PrivacySettingsPage.tsx#L48-L113); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Provide traceable request ID/progress/completion/error and downloadable export; verify scoped remote deletion and stated exclusions. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Requested operations complete with evidence; queued status is not displayed as finished.
- **Full functional verification:** Export populated account, validate contents, delete remote test account and query associated stores afterward.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/PrivacySettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-043] Runtime, toolchain, environment and secret references settings

**Assessment:** Observed platform gap: detect-only craft-native install guide currently contains a developer cargo build command; final package needs a usable product recovery path.

**Code references:** [apps/electron/src/renderer/pages/settings/RuntimeSettingsPage.tsx:48-146](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/RuntimeSettingsPage.tsx#L48-L146).

- **Requirements:** Qualify default LLM/thinking/session apply, workspace permission, every ordered/discovered tool, install/update/retry/disable, environment overrides and SecretRefsSection; provide platform-correct distribution/health and no developer-build prerequisite for users. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Install from clean machine, recover missing tool, change defaults/env/secret refs and inspect the next spawned runtime.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-043.1] Toolchain rows and platform install recovery

**Code reference:** [apps/electron/src/renderer/pages/settings/RuntimeSettingsPage.tsx:48-146](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/RuntimeSettingsPage.tsx#L48-L146); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify each actual tool row, version/progress/failure/detect-only guide for A/B; C manages approved server tools rather than browser-local installs. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Installed/enabled labels correspond to working supported tools and actionable end-user recovery.
- **Full functional verification:** Break one tool download, disable it, retry, use missing Docker/native sidecar and compare row state with executed binary.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-043.2] Environment, secrets and defaults propagation

**Code reference:** [apps/electron/src/renderer/pages/settings/RuntimeSettingsPage.tsx:48-146](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/RuntimeSettingsPage.tsx#L48-L146); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate environment keys, preserve hidden secrets and distinguish apply-to-current-session from future defaults; test secret references before activation. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Runtime receives exactly intended overrides without exposing secrets or silently changing unrelated sessions.
- **Full functional verification:** Save invalid env key and secret ref, update thinking/model/permission and inspect live versus new-session behavior.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-044] Context documents, templates, preferences and memory entry points

**Assessment:** Implementation exists; context-file mutation and runtime propagation verification required.

**Code references:** [apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx:217-322](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx#L217-L322).

- **Requirements:** Qualify list/read/create/edit/delete context docs, template-change diff/accept/keep-mine, preferences embedding, memory/skills links and external updates; ensure effective prompt context matches saved documents. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create custom context, accept template, keep user version and run a session that reads effective instructions.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-044.1] Context and template conflict safety

**Code reference:** [apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx:217-322](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx#L217-L322); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate filenames and preserve unsaved user edits during incoming template/file updates; avoid directory traversal and accidental deletion. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** User edits and template provenance are retained with an explicit conflict decision.
- **Full functional verification:** Edit while template updates, save/accept/keep mine, use invalid filename and restart.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-044.2] Runtime context and browser storage contract

**Code reference:** [apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx:217-322](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx#L217-L322); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Use tenant/workspace-scoped server context in C and prove changes are included at documented runtime boundary. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Effective context matches accepted saved docs and never includes another workspace secrets.
- **Full functional verification:** Change context in C and desktop, spawn/resume session and inspect the assembled prompt.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-045] Knowledge settings, engine connections, migration and note AI prompts

**Assessment:** Observed boundary: first external connection is selected (MVP single-connection); local notes are default.

**Code references:** [apps/electron/src/renderer/pages/settings/KnowledgeSettingsPage.tsx:73-180](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/KnowledgeSettingsPage.tsx#L73-L180).

- **Requirements:** Qualify connection status/test/token storage, engine modes, local notes shortcut, craft-markdown migration/partial failures and per-action note AI prompts; explicitly scope multiple provider support. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Configure engine, test actual read, migrate owned Markdown vault with failure fixture and run every customized AI action.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-045.1] Connection and engine verification

**Code reference:** [apps/electron/src/renderer/pages/settings/KnowledgeSettingsPage.tsx:73-180](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/KnowledgeSettingsPage.tsx#L73-L180); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Implement explicit connection add/select/edit if multiple providers are supported; test auth/offline/degraded states against real engine. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Selected connection controls actual engine access and status is based on real response.
- **Full functional verification:** Configure two connections, rotate token, stop engine and run health probe.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-045.2] Migration and AI prompt persistence

**Code reference:** [apps/electron/src/renderer/pages/settings/KnowledgeSettingsPage.tsx:73-180](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/KnowledgeSettingsPage.tsx#L73-L180); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Preserve source vault, links/assets/import mappings and report partial failures; retain customized prompts with supported sync policy. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Migration is repeat-safe and source data intact; prompts actually affect note AI behavior.
- **Full functional verification:** Migrate mixed valid/corrupt files twice, follow imported links and run custom prompt after reload.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-046] Marketplace catalog, packages, offline reports and update lifecycle

**Assessment:** Implementation exists; catalog provenance and actual package install verification required.

**Code references:** [apps/electron/src/renderer/pages/settings/MarketplaceSettingsPage.tsx:152-194](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/MarketplaceSettingsPage.tsx#L152-L194).

- **Requirements:** Qualify catalog refresh/stats/search/tags/sort/categories, install/update/remove progress, offline report/copy, compatibility/readiness and installed state; reconcile with extension center. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Install/update/remove one supported package of each advertised type and repeat with offline/rate-limit/broken manifest.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-046.1] Catalog and package lifecycle

**Code reference:** [apps/electron/src/renderer/pages/settings/MarketplaceSettingsPage.tsx:152-194](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/MarketplaceSettingsPage.tsx#L152-L194); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate package provenance/compatibility and persist installed versions; avoid optimistic success on failed download/runtime activation. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Package state and progress match durable working installation.
- **Full functional verification:** Interrupt install/update, restart, retry and compare installed version with actual executable/plugin.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-046.2] Offline and platform compatibility

**Code reference:** [apps/electron/src/renderer/pages/settings/MarketplaceSettingsPage.tsx:152-194](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/MarketplaceSettingsPage.tsx#L152-L194); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Provide accurate package support for Windows/macOS/server web; make offline report actionable without embedding secrets. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Unsupported packages have explicit reasons and offline failures are recoverable.
- **Full functional verification:** Open catalog offline, select unsupported platform package and inspect report/readiness after reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-047] Extensions settings, catalogs, dev host and compatibility center

**Assessment:** Implementation exists; multiple installation backends and dev APIs need release qualification.

**Code references:** [apps/electron/src/renderer/pages/settings/ExtensionsSettingsPage.tsx:391-513](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ExtensionsSettingsPage.tsx#L391-L513).

- **Requirements:** Qualify each declared section/catalog/installed view, Bazaar/plugin bridge versus marketplace installation, enable/update/uninstall, compatibility, host diagnostics and developer actions; expose only supported APIs in C. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Install extensions through each supported backend, enable/open view/update/uninstall and inspect host diagnostics.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-047.1] Single installed-state truth across backends

**Code reference:** [apps/electron/src/renderer/pages/settings/ExtensionsSettingsPage.tsx:391-513](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ExtensionsSettingsPage.tsx#L391-L513); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Unify extension registry, marketplace and Bazaar identifiers/version/progress; recover partial install/uninstall. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Catalog, center and runtime agree with one durable installed state.
- **Full functional verification:** Install same extension via alternate entry point, disable/re-enable and fail uninstall mid-operation.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-047.2] Compatibility and development controls

**Code reference:** [apps/electron/src/renderer/pages/settings/ExtensionsSettingsPage.tsx:391-513](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ExtensionsSettingsPage.tsx#L391-L513); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Gate dev-host APIs by environment/authorization, report native/browser capabilities and close affected views on changes. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Unsupported/dev-only actions are absent or accurately unavailable, and supported extension views remain usable.
- **Full functional verification:** Use production hosted build with dev API absent, install native-only extension, update open view and restart host.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-048] Foreign session import and automatic discovery settings

**Assessment:** Implementation exists; source coverage and migration verification required.

**Code references:** [apps/electron/src/renderer/pages/settings/ImportSettingsPage.tsx:64-183](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ImportSettingsPage.tsx#L64-L183).

- **Requirements:** Qualify foreignAutoImport status/run/set, discover preview/select/persist, all supported external session formats, progress and audit/last-run; never mutate source transcripts. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Discover representative external sessions, preview, import selected/all and rerun after external source change.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-048.1] Format fidelity and repeat-safe import

**Code reference:** [apps/electron/src/renderer/pages/settings/ImportSettingsPage.tsx:64-183](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ImportSettingsPage.tsx#L64-L183); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Preserve message roles/tool results/time/source/model/attachments as supported and show exclusions; deduplicate by source identity. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Supported content survives and repeated import does not duplicate sessions.
- **Full functional verification:** Import malformed, large, duplicate and partial transcripts twice and compare imported messages.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-048.2] Automatic import and hosted source access

**Code reference:** [apps/electron/src/renderer/pages/settings/ImportSettingsPage.tsx:64-183](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ImportSettingsPage.tsx#L64-L183); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Scope polling permissions and sources correctly; C accepts upload or authorized server import rather than client home-directory scanning. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Import obeys configured scope and gives clear failure/retry without reading unauthorized paths.
- **Full functional verification:** Enable/disable auto import, revoke source directory access, restart and upload hosted import.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-049] App environment, notifications, power, proxy and updates settings

**Assessment:** Implementation exists; browser environment handling and native services verification required.

**Code references:** [apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx:117-211](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx#L117-L211).

- **Requirements:** Qualify EnvironmentSettingsSection/runtime choice, notifications, keep awake, browser tool toggle, proxy validation/save/reset/readback, about/version/check/install updates; hide native-only operations on C with coherent alternatives. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Change every setting, perform relevant OS operation and restart; check version/update against signed release channel.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-049.1] OS integration and environment choice

**Code reference:** [apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx:117-211](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx#L117-L211); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify native notifications permissions/click-through, sleep prevention release and selected environment behavior; C uses browser permissions/server execution. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Settings govern actual OS/runtime behavior and power assertions end after work.
- **Full functional verification:** Deny notifications then enable, complete background task, wake/sleep during run and switch configured environment.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-049.2] Proxy and update operations

**Code reference:** [apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx:117-211](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx#L117-L211); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate proxy URLs/bypass, apply to intended transports and preserve working config after failed save; qualify update status/install/restart. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Network routing and displayed version reflect successful saved configuration and update outcome.
- **Full functional verification:** Use test proxy/auth/failure, check update offline, download interrupted update and restart updated package.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-050] AI connections, provider editor and workspace model overrides

**Assessment:** Implementation exists; provider availability/authentication and defaults verification required.

**Code references:** [apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:770-927](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx#L770-L927).

- **Requirements:** Qualify add/provider/API setup/OAuth/reauth/rename/edit/delete/validate/default, multiple accounts, model catalogs, workspace connection/model/thinking overrides, steer/queue, cache/1M context/RTK settings and credential health. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Provision each advertised backend, validate, change defaults/overrides and run actual text/tool/image requests.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-050.1] Provider and model truth

**Code reference:** [apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:770-927](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx#L770-L927); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Only advertise supported authenticated models/capabilities and validate provider endpoint/auth with real requests; handle deleted default/unavailable connection. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** UI choices correspond to usable runtime models and fallback is explicit.
- **Full functional verification:** Add valid/invalid provider, reauthenticate, remove active default and change vision/context model.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-050.2] Defaults, overrides and live-session application

**Code reference:** [apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:770-927](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx#L770-L927); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Apply global/workspace defaults at documented boundaries and synchronize current session changes; reflect cache/RTK readiness truthfully. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Runtime receives correct scoped settings without stale UI or silent cross-workspace changes.
- **Full functional verification:** Set workspace override, open two workspaces, alter thinking/cache/RTK then inspect runtime request.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-051] Appearance, shell variants, theme, language, density and icon settings

**Assessment:** Implementation exists; visual settings have broad release validation scope.

**Code references:** [apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx:168-433](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx#L168-L433).

- **Requirements:** Qualify preset/custom/default/workspace themes, language, zoom, connection icons, workspace rail, tool descriptions/icon mapping, project colors, Kanban preferences, WorkbenchChrome/Zen/Conation shell and ExtraScreensSettings flags. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Set each appearance control, switch workspace/theme/shell, reopen app and inspect all primary screens at high DPI.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/AppearanceSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-051.1] Theme, shell and layout persistence

**Code reference:** [apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx:168-433](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx#L168-L433); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate every shell variant and appearance preference migration; preserve focus, readable contrast and panel geometry. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Every appearance control has observable retained effect without unreadable or obscured actions.
- **Full functional verification:** Switch default/workspace theme and shell while dialogs/native panes are open; restart with saved preferences.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/AppearanceSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-051.2] Language, zoom, icons and feature flags

**Code reference:** [apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx:168-433](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx#L168-L433); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Apply locale to native/renderer surfaces, honor zoom and avoid broken icon mappings; disabled extra screens show intentional unavailable behavior. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Rendered labels/icons/scales and navigation match persisted choices.
- **Full functional verification:** Switch all locales, change zoom, replace tool icon, toggle each extra-screen flag and open direct link.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/AppearanceSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-052] Input, spellcheck, send key and voice settings

**Assessment:** Implementation exists; voice section returns null until prefs load and needs visible failure/readiness behavior.

**Code references:** [apps/electron/src/renderer/pages/settings/InputSettingsPage.tsx:55-128](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/InputSettingsPage.tsx#L55-L128).

- **Requirements:** Qualify capitalization/spellcheck/Enter versus Cmd-Ctrl-Enter, voice STT local/cloud engines, language/PTT-toggle/hotkey/overlay, consent/retention/auto-submit, TTS engines, wake word, enhancement and history controls. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Type with IME, submit multiline text, dictate/speak with each supported voice engine and retry denied/unavailable mic.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-052.1] Typing and send semantics

**Code reference:** [apps/electron/src/renderer/pages/settings/InputSettingsPage.tsx:55-128](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/InputSettingsPage.tsx#L55-L128); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Prevent IME/composition/mobile/shortcut conflicts and ensure preferences apply consistently to all composers/editor fields. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** No accidental submit during composition and intended key sends exactly once.
- **Full functional verification:** Test Russian/English/CJK input, spellcheck, multiline Enter and Cmd/Ctrl+Enter across chat and note/task fields.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-052.2] Voice readiness, consent and failure UX

**Code reference:** [apps/electron/src/renderer/pages/settings/InputSettingsPage.tsx:55-128](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/InputSettingsPage.tsx#L55-L128); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Show load/error/unavailable states instead of disappearing section; enforce cloud consent and actual retention, package local model and verify TTS/history. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** User can recover voice setup and no cloud audio operation bypasses consent.
- **Full functional verification:** Deny mic, fail prefs/model load, use local/cloud STT and both TTS options; revoke consent and inspect retained audio.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-053] Workspace identity, TLS, enabled modes, directories and MCP settings

**Assessment:** Implementation exists; filesystem/TLS and scope verification required.

**Code references:** [apps/electron/src/renderer/pages/settings/WorkspaceSettingsPage.tsx:393-646](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/WorkspaceSettingsPage.tsx#L393-L646).

- **Requirements:** Qualify workspace name/icon/info/TLS, permissions, mode toggles, enabled sources, working directory, notes path and local MCP; preserve healed source lists and remote-workspace policy. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create local and remote workspaces, edit all settings, remove enabled source and reopen sessions/notes.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-053.1] Directories and notes relocation

**Code reference:** [apps/electron/src/renderer/pages/settings/WorkspaceSettingsPage.tsx:393-646](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/WorkspaceSettingsPage.tsx#L393-L646); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate path existence/access and define notes-path move versus pointer change; C routes through server filesystem chooser only. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Data remains intact and path errors have an actionable recovery path.
- **Full functional verification:** Choose missing/read-only/non-ASCII Windows/macOS paths, clear path and switch notes root with unsaved editor.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-053.2] Workspace TLS, modes and source defaults

**Code reference:** [apps/electron/src/renderer/pages/settings/WorkspaceSettingsPage.tsx:393-646](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/WorkspaceSettingsPage.tsx#L393-L646); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Enforce scoped remote TLS/cert settings, mode availability and source healing; verify changed defaults in actual runtime. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only valid sources/modes remain enabled and trusted remote connection behavior matches saved config.
- **Full functional verification:** Change certificate/source/mode, delete enabled source externally and reconnect remote workspace.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-054] Permissions defaults, workspace rules, OpenClaw audit and command gateway

**Assessment:** Implementation exists; configuration gates and actual runtime policy verification required.

**Code references:** [apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx:173-222](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx#L173-L222).

- **Requirements:** Qualify explicit read grant, default/custom permission tables/config edits, workspace policy precedence, OpenClawAuditSection and CommandGatewaySection; align UI safe/ask/allow-all with runtime enforcement. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Set restrictive policy and attempt filesystem/network/host tool actions through each backend and gateway.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-054.1] Permission rules and config validation

**Code reference:** [apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx:173-222](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx#L173-L222); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate defaults/workspace/source rule schemas, ordering and reload; preserve last valid policy after bad edits. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Displayed effective policy matches enforced decisions and invalid edits cannot relax access silently.
- **Full functional verification:** Add overlapping allow/deny rules, corrupt config, reload and run matching/nonmatching actions.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-054.2] Gateway/audit controls and pending approvals

**Code reference:** [apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx:173-222](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx#L173-L222); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Prove audit results and gateway controls apply to owned workspace commands and denied actions remain denied after restart. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Runtime and audit evidence agree; stale approvals cannot grant new access.
- **Full functional verification:** Trigger audited command, deny approval, toggle gateway, reconnect and replay old request.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-055] Labels, hierarchy, colors and saved collection views settings

**Assessment:** Implementation exists; label mutation and view references verification required.

**Code references:** [apps/electron/src/renderer/pages/settings/LabelsSettingsPage.tsx:169-276](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/LabelsSettingsPage.tsx#L169-L276).

- **Requirements:** Qualify label create/name/color/delete/hierarchy, ask/auto-label behavior and views section; propagate labels to session filters/chips/task editing and bulk operations. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create parent/child labels, assign them, rename/delete, configure view and reopen filtered collection.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-055.1] Label edits and cascading references

**Code reference:** [apps/electron/src/renderer/pages/settings/LabelsSettingsPage.tsx:169-276](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/LabelsSettingsPage.tsx#L169-L276); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate unique names/IDs and update session/view references atomically or expose recovery; define child deletion policy. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Accepted label changes propagate without orphan filters or wrong assignments.
- **Full functional verification:** Rename parent, delete assigned child, fail label save and compare session filters across clients.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-055.2] Auto-label and saved-view behavior

**Code reference:** [apps/electron/src/renderer/pages/settings/LabelsSettingsPage.tsx:169-276](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/LabelsSettingsPage.tsx#L169-L276); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify actual inference/assignment and persisted view definitions against live sessions rather than config appearance alone. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Automatic labels and saved views follow configured semantics with visible failure states.
- **Full functional verification:** Trigger auto-label scenario, edit view predicate and compare results with canonical session records.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-056] Organizations, membership, invitations and team spaces settings

**Assessment:** Implementation exists; real multi-user and role enforcement verification required.

**Code references:** [apps/electron/src/renderer/pages/settings/OrganizationsSettingsPage.tsx:77-221](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/OrganizationsSettingsPage.tsx#L77-L221).

- **Requirements:** Qualify organization create/select, member identity, roles, invite target/token/accept/expiry, identity update, workspace membership and TeamOrgSettingsSection team spaces. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Use administrator/member/outsider accounts, invite/accept, change roles and remove membership while sessions are open.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/OrganizationsSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-056.1] Invite lifecycle and real identity

**Code reference:** [apps/electron/src/renderer/pages/settings/OrganizationsSettingsPage.tsx:77-221](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/OrganizationsSettingsPage.tsx#L77-L221); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate invitation target, expiry/revocation/single-use and server-authenticated identity; do not equate editable local username with account authorization. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only intended authenticated member joins and replay/expired invitations fail safely.
- **Full functional verification:** Accept valid/expired/revoked token under wrong account, then accept valid token once and replay.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/OrganizationsSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-056.2] Organization roles and workspace access

**Code reference:** [apps/electron/src/renderer/pages/settings/OrganizationsSettingsPage.tsx:77-221](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/OrganizationsSettingsPage.tsx#L77-L221); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Enforce admin/member limits server-side and synchronize team-space/workspace access across desktop/web. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** All entry points enforce current role and removed users lose scoped access.
- **Full functional verification:** Attempt admin actions as member, revoke membership and access direct session/resource URL.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/OrganizationsSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-057] Messaging platform connections, pairing, bindings and access settings

**Assessment:** Implementation exists; Slack explicitly listed as coming soon and must not be treated as complete.

**Code references:** [apps/electron/src/renderer/pages/settings/MessagingSettingsPage.tsx:1-95](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/MessagingSettingsPage.tsx#L1-L95).

- **Requirements:** Qualify Telegram/Discord/Lark/WeChat/WhatsApp connect dialogs, pairing/QR/code expiry, Telegram supergroups/topics/DMs, platform owners/access/allow lists, guild triggers, connect/reconfigure/disconnect/forget/unbind and session links. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Connect each supported platform to a test account, send real messages, bind session, update access then disconnect/reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/MessagingSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-057.1] Platform-specific setup and transport lifecycle

**Code reference:** [apps/electron/src/renderer/pages/settings/MessagingSettingsPage.tsx:1-95](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/MessagingSettingsPage.tsx#L1-L95); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Test Telegram token/supergroup pairing, Discord bot/guild, Lark credentials, WeChat and WhatsApp QR/session flows independently; scope Slack implementation or explicit exclusion. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only working platforms show connected and all advertised message flows succeed end to end.
- **Full functional verification:** For each advertised platform, pair, expire credentials, reconnect and send inbound/outbound message and attachment.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/MessagingSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-057.2] Binding access, ownership and destructive actions

**Code reference:** [apps/electron/src/renderer/pages/settings/MessagingSettingsPage.tsx:1-95](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/MessagingSettingsPage.tsx#L1-L95); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Enforce sender/owner/allow-list policies and confirmation across forget/unbind/reset; synchronize pending sender Inbox with platform state. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Unauthorized senders cannot execute tools and binding changes stop routing at authoritative source.
- **Full functional verification:** Message from allowed/disallowed users, change owner mode, deny pending sender and unbind active topic.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/MessagingSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-057.3] Telegram connection dialog and messaging acceptance

**Code reference:** [apps/electron/src/renderer/components/messaging/TelegramConnectDialog.tsx:1-167](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/messaging/TelegramConnectDialog.tsx#L1-L167); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify bot token connection and token validation, owner/access modes, pending sender review, DM/topic bindings, supergroup pairing and pairing-code expiry and advertise connected only after provider confirms a usable session. Preserve cancellation and safe reconnect. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** The advertised platform workflow completes against its real service; failures, credentials and workspace identity are handled accurately.
- **Full functional verification:** Pair bot and supergroup, send DM/topic messages from allowed/denied sender, expire code and unbind topic. Verify binding persistence and access enforcement on A/B/C with the actual corresponding service.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/MessagingSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-057.4] Discord connection dialog and messaging acceptance

**Code reference:** [apps/electron/src/renderer/components/messaging/DiscordConnectDialog.tsx:1-162](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/messaging/DiscordConnectDialog.tsx#L1-L162); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify bot token/guild configuration, guild trigger mode, access policy and session bindings and advertise connected only after provider confirms a usable session. Preserve cancellation and safe reconnect. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** The advertised platform workflow completes against its real service; failures, credentials and workspace identity are handled accurately.
- **Full functional verification:** Connect test guild, send mention/nonmention according to trigger setting, revoke bot access and reconnect. Verify binding persistence and access enforcement on A/B/C with the actual corresponding service.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/MessagingSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-057.5] Lark connection dialog and messaging acceptance

**Code reference:** [apps/electron/src/renderer/components/messaging/LarkConnectDialog.tsx:1-175](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/messaging/LarkConnectDialog.tsx#L1-L175); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify application credentials, connection status, binding list and message/event handling and advertise connected only after provider confirms a usable session. Preserve cancellation and safe reconnect. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** The advertised platform workflow completes against its real service; failures, credentials and workspace identity are handled accurately.
- **Full functional verification:** Configure owned test application, process inbound/outbound event and attachment, then rotate credentials and reconnect. Verify binding persistence and access enforcement on A/B/C with the actual corresponding service.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/MessagingSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-057.6] WeChat connection dialog and messaging acceptance

**Code reference:** [apps/electron/src/renderer/components/messaging/WeChatConnectDialog.tsx:1-175](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/messaging/WeChatConnectDialog.tsx#L1-L175); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify QR starting/show-QR/verification/connected/error phases and verification submission and advertise connected only after provider confirms a usable session. Preserve cancellation and safe reconnect. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** The advertised platform workflow completes against its real service; failures, credentials and workspace identity are handled accurately.
- **Full functional verification:** Pair owned account, refresh expired QR, submit verification, close/reopen mid-pair and process a real test message. Verify binding persistence and access enforcement on A/B/C with the actual corresponding service.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/MessagingSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-057.7] WhatsApp connection dialog and messaging acceptance

**Code reference:** [apps/electron/src/renderer/components/messaging/WhatsAppConnectDialog.tsx:1-158](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/messaging/WhatsAppConnectDialog.tsx#L1-L158); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify Baileys QR pairing, workspace-filtered connect events, credential reuse, error/disconnect/retry and advertise connected only after provider confirms a usable session. Preserve cancellation and safe reconnect. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** The advertised platform workflow completes against its real service; failures, credentials and workspace identity are handled accurately.
- **Full functional verification:** Pair owned account in two open workspaces, expire QR, restart and verify no cross-workspace pairing events. Verify binding persistence and access enforcement on A/B/C with the actual corresponding service.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/MessagingSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-058] Server remote access, TLS, auth token and native sidecar settings

**Assessment:** Implementation exists; desktop remote-server settings are not a hosted-operations console by default.

**Code references:** [apps/electron/src/renderer/pages/settings/ServerSettingsPage.tsx:97-193](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ServerSettingsPage.tsx#L97-L193).

- **Requirements:** Qualify read grant, enabled/bind/port/config validation/save/reset/restart, URL/token copy, cert/key pickers and native-sidecar health; provide scoped hosted connection information without tenant ability to reconfigure shared server. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Enable secure remote access, connect a second client, rotate config/cert, restart and inspect sidecar health.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-058.1] Remote access and TLS configuration

**Code reference:** [apps/electron/src/renderer/pages/settings/ServerSettingsPage.tsx:97-193](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ServerSettingsPage.tsx#L97-L193); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate host/port/cert/key paths and restart requirement; authenticate client and preserve last valid config on failure. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Saved settings produce a reachable trusted authorized connection; failed config is recoverable.
- **Full functional verification:** Use wrong cert/key/port in use, then valid TLS, copy connection info and connect from Windows/macOS/browser.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-058.2] Health and hosted administrator boundaries

**Code reference:** [apps/electron/src/renderer/pages/settings/ServerSettingsPage.tsx:97-193](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ServerSettingsPage.tsx#L97-L193); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Probe real sidecar/server health with actionable diagnostics and restrict shared-host operations to authorized administration. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Health reports actual readiness and tenant UI exposes no shared-server secret or privileged reconfiguration.
- **Full functional verification:** Stop sidecar, deny config grant, use ordinary hosted tenant and inspect diagnostics.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-059] Cloud Runs provider, sandbox, quotas and scheduling settings

**Assessment:** Observed UX boundary: provider token is external cloud-runs.env, not editable here; setup needs end-user provisioning path.

**Code references:** [apps/electron/src/renderer/pages/settings/CloudRunsSettingsPage.tsx:1-53](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/CloudRunsSettingsPage.tsx#L1-L53).

- **Requirements:** Qualify explicit config-read grant, local/Daytona/native providers, gateway/webhook, token readiness, Daytona project/image/snapshot/region/API/TTL, wall/token/artifact limits, cheap model, personas and schedule link. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Configure each supported provider from a clean account and launch a bounded real run using the saved configuration.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/CloudRunsSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-059.1] Credential/setup and provider readiness

**Code reference:** [apps/electron/src/renderer/pages/settings/CloudRunsSettingsPage.tsx:1-53](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/CloudRunsSettingsPage.tsx#L1-L53); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Provide secure provider credential provisioning and actual connection test for A/B/C; distinguish token-present from authenticated runnable provider. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** A new user can reach real provider readiness without editing undocumented internal files.
- **Full functional verification:** Use missing/invalid/valid token, change provider and run test sandbox creation.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/CloudRunsSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-059.2] Limits and sandbox persistence

**Code reference:** [apps/electron/src/renderer/pages/settings/CloudRunsSettingsPage.tsx:1-53](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/CloudRunsSettingsPage.tsx#L1-L53); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate numeric drafts/URLs/TTL and apply limits at backend execution; persist failed patch for retry and display effective config. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Accepted values are enforced and UI accurately shows effective quota/provider state.
- **Full functional verification:** Set invalid/edge quotas, fail save, retry and run beyond each configured limit.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/CloudRunsSettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-060] Security overview, OpenClaw lifecycle, vault health and risk acceptance

**Assessment:** Implementation exists; displayed assurance requires actual supported backend evidence.

**Code references:** [apps/electron/src/renderer/pages/settings/SecuritySettingsPage.tsx:137-278](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/SecuritySettingsPage.tsx#L137-L278).

- **Requirements:** Qualify API availability, install/provision/start/stop, standard/deep audit, findings/domain/detail filters, accept/revoke risk, summary/coverage and Infisical health; distinguish unavailable/incomplete/accepted risk from clean state. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Provision test workspace, run audit with known fixture findings, accept/revoke one risk and rerun after mitigation.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/SecuritySettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-060.1] Runtime lifecycle and security audit progress

**Code reference:** [apps/electron/src/renderer/pages/settings/SecuritySettingsPage.tsx:137-278](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/SecuritySettingsPage.tsx#L137-L278); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Expose real progress/cancel/failure and preserve previous audit; require supported sidecar on A/B and tenant-scoped hosted audit. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Audit never falsely reports clean or complete when execution failed or evidence is missing.
- **Full functional verification:** Fail install/provision, stop runtime during audit and restart application before audit completes.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/SecuritySettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-060.2] Finding details and risk acceptance integrity

**Code reference:** [apps/electron/src/renderer/pages/settings/SecuritySettingsPage.tsx:137-278](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/SecuritySettingsPage.tsx#L137-L278); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Store acceptance justification/expiry/identity and fingerprint; keep accepted findings visible and vault health free of secret disclosure. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Finding state and accepted-risk status are accurate and audit history remains traceable.
- **Full functional verification:** Accept/revoke a finding, change fixture fingerprint, expire acceptance and inspect Infisical failure diagnostics.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/SecuritySettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-060.3] Seven-domain SecuritySnake visualization and findings filters

**Code reference:** [apps/electron/src/renderer/pages/settings/security/SecuritySnake.tsx:5-112](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/security/SecuritySnake.tsx#L5-L112); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Qualify ingress, sessions, tools, secrets, network, extensions and isolation segments; severity/coverage/direction/count/selection and responsive layout must reflect authoritative summary. Preserve other-domain findings in the default list and provide equivalent accessible textual evidence. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Every segment accurately represents summary/coverage; unavailable or incomplete evidence is not displayed as a pass, and all findings remain discoverable.
- **Full functional verification:** Use fixture summaries with pass/warn/critical/unavailable and incomplete coverage, toggle each segment and reset selection; compare findings list, screen-reader label and narrow/RTL layout.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__/SecuritySettingsPage.test.ts`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-061] Shortcuts page, command palette and platform key mappings

**Assessment:** Implementation exists; duplicate pages/ShortcutsPage.tsx needs reachability review.

**Code references:** [apps/electron/src/renderer/pages/settings/ShortcutsPage.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ShortcutsPage.tsx#L1-L100).

- **Requirements:** Qualify shortcut discovery/search/categories, KeyboardShortcutsDialog, AppMenu/native menus, command palette and focused-field guards; map macOS Cmd/Option to documented Windows/browser keys without reserved collisions. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Execute every advertised command via key and menu across each main surface, editable field and modal.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-061.1] Shortcut registry and focused controls

**Code reference:** [apps/electron/src/renderer/pages/settings/ShortcutsPage.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ShortcutsPage.tsx#L1-L100); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Ensure displayed accelerators correspond to active handlers, avoid duplicate registration and protect typing/IME/terminal input. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Every published key has one intended action and no unintended text submission/deletion.
- **Full functional verification:** Search shortcuts, open dialog, execute each key with focus in composer, note editor, terminal and modal.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-061.2] Native/browser collisions and legacy page scope

**Code reference:** [apps/electron/src/renderer/pages/settings/ShortcutsPage.tsx:1-100](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ShortcutsPage.tsx#L1-L100); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Resolve duplicate shortcut surfaces, reserved browser keys and native menu parity; provide alternative controls for unavailable keys. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Platform guidance matches actual behavior with accessible alternative actions.
- **Full functional verification:** Use Windows Ctrl combos/macOS Cmd combos and browser reserved keys; compare menu labels and resulting actions.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-062] Preferences identity/persona/location and settings embedding

**Assessment:** Supporting implementation exists and PreferencesForm is verified embedded in ContextSettingsPage.tsx:355; not a standalone registry subpage.

**Code references:** [apps/electron/src/renderer/pages/settings/PreferencesPage.tsx:118-205](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PreferencesPage.tsx#L118-L205) ; [apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx:349-356](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx#L349-L356).

- **Requirements:** Qualify preferences JSON read/write, identity/persona/name/timezone/city/country/notes, autosave/focus refresh and actual agent context usage; distinguish local preference identity from authentication. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Edit embedded preferences, update externally, return focus, run a session and inspect effective user context.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-062.1] Preference conflict and validation behavior

**Code reference:** [apps/electron/src/renderer/pages/settings/PreferencesPage.tsx:118-205](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PreferencesPage.tsx#L118-L205); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate timezone/JSON types and preserve dirty edits when focus-triggered refresh observes another writer. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Accepted preferences persist without silent overwrite and errors are actionable.
- **Full functional verification:** Edit same preference from two clients, type during focus refresh and submit invalid timezone.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-062.2] Persona and context propagation

**Code reference:** [apps/electron/src/renderer/pages/settings/PreferencesPage.tsx:118-205](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PreferencesPage.tsx#L118-L205); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Document where persona/location/preferences affect prompt and ensure C uses account/workspace-scoped storage. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Prompt behavior follows documented setting boundary and never substitutes preference identity for authentication.
- **Full functional verification:** Change persona/name/location, spawn new session, resume old one and inspect prompt context.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-063] Shared Markdown, document, code, diff and media viewers

**Assessment:** Implementation exists; every rich block and overlay needs actual renderer/browser verification.

**Code references:** [packages/ui/src/components/markdown/Markdown.tsx:1-120](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/components/markdown/Markdown.tsx#L1-L120).

- **Requirements:** Qualify code/diff, datatable/CSV export, document/Tiptap, HTML, images, JSON, LaTeX, Mermaid, PDF/worker, spreadsheet and all corresponding full-screen overlays; verify annotation, print/download/copy/navigation parity. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Open representative artifacts for every rich block in chat/note/page and full-screen viewer, edit where supported, export and reopen.
- **Test method:** Regression entry point: `bun test packages/ui/src/components/markdown/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-063.1] Artifact fidelity and dangerous content

**Code reference:** [packages/ui/src/components/markdown/Markdown.tsx:1-120](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/components/markdown/Markdown.tsx#L1-L120); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify syntax themes, diff normalization, large data virtualization, PDF worker loading and safe HTML/link rendering across packaged and hosted asset paths. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Supported content is accurate/readable and untrusted artifacts cannot invoke application APIs.
- **Full functional verification:** Render large code/diff/table/PDF/spreadsheet plus malicious HTML/URLs and missing assets.
- **Test method:** Regression entry point: `bun test packages/ui/src/components/markdown/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-063.2] Overlay and editor interaction parity

**Code reference:** [packages/ui/src/components/markdown/Markdown.tsx:1-120](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/components/markdown/Markdown.tsx#L1-L120); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify zoom/fit/item navigation/copy/download/print/annotations and Escape layering without destroying selection or edits. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only top layer closes, actions work on selected artifact and edits/selection are retained.
- **Full functional verification:** Nest annotation menu and full-screen viewer, use Escape/back, copy and export each block type.
- **Test method:** Regression entry point: `bun test packages/ui/src/components/markdown/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-064] Shared menus, dialogs, accessibility and responsive primitives

**Assessment:** Implementation exists; component checks do not replace full application accessibility.

**Code references:** [packages/ui/src/components/ui/PremiumMenu.tsx:1-110](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/components/ui/PremiumMenu.tsx#L1-L110).

- **Requirements:** Qualify PremiumMenu/Select, drawers/islands/dropdowns/filterable popovers, tooltip/loading, mode screens and renderer dialogs; require keyboard reachability, focus restore, labels, contrast, reduced motion and responsive usable target sizes. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Complete core workflows using keyboard and screen reader at narrow width/high zoom with nested popover/dialog.
- **Test method:** Regression entry point: `bun test packages/ui/src/components/ui/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-064.1] Keyboard and assistive technology workflows

**Code reference:** [packages/ui/src/components/ui/PremiumMenu.tsx:1-110](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/components/ui/PremiumMenu.tsx#L1-L110); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Implement correct dialog/menu roles, focus trap/restore, active item and announcement of load/error/status; verify real application contexts. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** No keyboard trap or unlabeled critical action; status and errors are announced accurately.
- **Full functional verification:** Run NVDA on Windows, VoiceOver on macOS and hosted Chromium/Firefox with keyboard-only onboarding/chat/task/note/settings workflows.
- **Test method:** Regression entry point: `bun test packages/ui/src/components/ui/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-064.2] Responsive, touch and high zoom behavior

**Code reference:** [packages/ui/src/components/ui/PremiumMenu.tsx:1-110](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/components/ui/PremiumMenu.tsx#L1-L110); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Fit menus/dialogs within viewport and preserve actions at touch/narrow/high-DPI/200% zoom; honor reduced motion. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Actions remain visible/reachable and no inaccessible overflow or motion-dependent state exists.
- **Full functional verification:** Use hosted mobile/touch widths, desktop scaled displays and reduced-motion preferences; invoke all nested menus.
- **Test method:** Regression entry point: `bun test packages/ui/src/components/ui/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-065] Localization, dates, plural forms and visible product identity

**Assessment:** Observed documentation drift: AGENTS.md describes ten locales, while canonical LOCALE_REGISTRY registers twelve including Korean and Arabic; CloudRun detail has literal ID/Progress labels.

**Code references:** [packages/shared/src/i18n/registry.ts:51-76](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/i18n/registry.ts#L51-L76) ; [AGENTS.md:6-11](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/AGENTS.md#L6-L11) ; [apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx:210-230](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx#L210-L230).

- **Requirements:** Audit the complete visible surface inventory for translations, fallback/plurals/date/number/timezone formatting and Craft URLs/branding. Derive supported locales from LOCALE_REGISTRY: en, ru, es, zh-Hans, zh-Hant, ja, de, hu, pl, fr, ko, ar. Update stale contributor instructions and qualify Arabic bidirectional/RTL layout and Korean text; key parity alone cannot prove translation quality. Target coverage: A: Windows 10/11 installed application. B: macOS installed application. C: authenticated hosted application with durable server data and browser navigation.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Switch all twelve registry locales through every inventory surface; trigger error/permission/empty/paid-run states, inspect Korean glyphs and Arabic RTL/bidirectional flows, and open product links.
- **Test method:** Regression entry point: `bun test packages/shared/src/i18n`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-065.1] Translation and locale parity

**Code reference:** [packages/shared/src/i18n/registry.ts:51-76](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/i18n/registry.ts#L51-L76); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Translate every visible label/error/dialog, including CloudRun ID/Progress, across all twelve registry locales. Preserve sorted keys and Russian/Polish/Arabic plural conventions; update stale ten-locale guidance and identify untranslated English fallback values. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** No raw key/fallback-only label or incorrect plural remains in supported release states.
- **Full functional verification:** Run i18n parity/registry tests, then capture every primary/detail/settings page in English/Russian and long-string/CJK/Korean/Arabic locales; inspect actual strings as well as key presence.
- **Test method:** Regression entry point: `bun test packages/shared/src/i18n`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-065.2] Identity, links and regional semantics

**Code reference:** [packages/shared/src/i18n/registry.ts:51-76](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/i18n/registry.ts#L51-L76); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Replace or intentionally document Craft branding/schemes/docs URLs; use correct localized dates, costs and platform labels. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** ROX navigation and help links work; regional formatting preserves underlying values.
- **Full functional verification:** Open source/skill deep links and sharing docs; test timezone/DST/date filters and number/cost formatting across locales.
- **Test method:** Regression entry point: `bun test packages/shared/src/i18n`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-065.3] Arabic RTL and mixed-direction content

**Code reference:** [packages/shared/src/i18n/registry.ts:51-76](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/i18n/registry.ts#L51-L76); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Define and implement Arabic document direction and visual layout policy, focus/navigation order, directional icons, menus/popovers, charts, code/path/URL rendering and mixed Arabic/English/numbers. Retain LTR code/terminal content where required. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Arabic is readable and interactive with consistent directionality; mixed-direction values remain accurate and keyboard/focus semantics work on A/B/C.
- **Full functional verification:** Use ar across onboarding, shell, chat, tasks, notes, modal menus and all settings; type mixed-direction names/URLs/code and verify keyboard focus, selection, caret and responsive rendering.
- **Test method:** Regression entry point: `bun test packages/shared/src/i18n`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-066] Browser profile import, cookies, bookmarks and credential consent

**Assessment:** Implementation exists under Import settings; privileged OS/browser profile access needs separate qualification.

**Code references:** [apps/electron/src/renderer/pages/settings/BrowserProfileImportPanel.tsx:1-112](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/BrowserProfileImportPanel.tsx#L1-L112).

- **Requirements:** Qualify profile discovery/recommendation, running/locked/corrupt/unsupported state, history/bookmark versus cookie/credential consent, OS approval, preview/import summaries, automatic cookie session import, progress/reset/delete and source-profile preservation. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Use owned browser profiles, import each allowed data class, revoke consent, restart and compare in-app browser state.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-066.1] Manual profile import and independent consent

**Code reference:** [apps/electron/src/renderer/pages/settings/BrowserProfileImportPanel.tsx:1-112](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/BrowserProfileImportPanel.tsx#L1-L112); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Validate every supported browser/OS profile, preserve source DBs and separate history/bookmarks, cookies and credentials grants. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Only granted data imports; original profile is intact and C cannot scan client browser secrets.
- **Full functional verification:** Import clean/locked/running/corrupt profiles with each consent combination on A/B; attempt hosted local-profile access in C.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-066.2] Automatic cookie import and rollback

**Code reference:** [apps/electron/src/renderer/pages/settings/BrowserProfileImportPanel.tsx:1-112](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/BrowserProfileImportPanel.tsx#L1-L112); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Keep auto-import default off, scope cookie/profile targets, expose actual summaries/errors and support reset/removal without deleting source data. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Automatic import follows current consent and imported state is recoverable and removable.
- **Full functional verification:** Enable auto import, receive new cookie, fail decrypt/import, revoke consent and remove imported session.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/pages/settings/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

### [UI-067] Workspace picker, creation, folder opening, remote TLS and SSH bootstrap

**Assessment:** Implementation exists; real connection success and remote bootstrap qualification required.

**Code references:** [apps/electron/src/renderer/components/workspace/WorkspaceCreationScreen.tsx:25-184](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/workspace/WorkspaceCreationScreen.tsx#L25-L184).

- **Requirements:** Qualify WorkspacePicker and choice/create/open-folder/team-space/remote/SSH screens, custom path and permissions, host create/edit/delete/import, nine SSH bootstrap phases, tunnel recovery, remote workspace enumeration and TLS trust/reconnect. Target coverage: A: Windows 10/11 shell, file, keyboard and DPI behavior. B: macOS shell, sandbox/privacy and keyboard behavior. C: authenticated browser transport, browser file/upload/download semantics and explicit capability availability.
- **DoD:** The requirements above are demonstrably satisfied on each supported target and failures found by the workflow are fixed; retained evidence includes persisted readback, provider/platform capability decision and no unresolved blocker for this surface.
- **Full functional verification:** Create local/team workspace, open existing folder, connect remote server and bootstrap owned SSH host from clean desktop; reopen and reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/workspace/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-067.1] Local creation and remote connection results

**Code reference:** [apps/electron/src/renderer/components/workspace/WorkspaceCreationScreen.tsx:25-184](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/workspace/WorkspaceCreationScreen.tsx#L25-L184); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Resolve creation/open/reconnect only after verified backend success; handle duplicate folder/name, invalid tokens and remote TLS trust errors. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** One correctly scoped usable workspace exists with precise failed/connected status.
- **Full functional verification:** Create with invalid/read-only paths, connect wrong token/cert, cancel, retry valid connection and switch workspace.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/workspace/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

#### [UI-067.2] SSH host bootstrap and tunnel lifecycle

**Code reference:** [apps/electron/src/renderer/components/workspace/WorkspaceCreationScreen.tsx:25-184](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/workspace/WorkspaceCreationScreen.tsx#L25-L184); inspect the task's named companion components/RPC handlers when implementing.

- **Requirements:** Verify host CRUD/config import/key permissions and checking/detecting/building/uploading/installing/starting/waiting/tunnel/create phases; C uses authorized server connector or explicit unsupported state. Target coverage: A Windows 10/11; B macOS; C hosted web, following the explicit platform contract in the parent task.
- **DoD:** Progress represents real remote operations, retries preserve remote data and credentials are not logged.
- **Full functional verification:** Bootstrap owned host, interrupt upload, fail remote startup, resume/retry, disconnect tunnel and reconnect.
- **Test method:** Regression entry point: `bun test apps/electron/src/renderer/components/workspace/__tests__`. Add behavior coverage for the changed contract; automate the full workflow above with Playwright/Electron or supported native UI automation on A/B and actual hosted browser C. Assert canonical persistence and backend results, retaining redacted evidence.

## [SURFACE-INVENTORY] Complete page-directory TSX coverage

This file-level inventory is generated from the audited checkout. Some entries are internal components or legacy/support surfaces rather than independently routed pages; they still have an explicit completion owner.

| Page/support component | Completion owner |
|---|---|
| [apps/electron/src/renderer/pages/BrowserPanelPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/BrowserPanelPage.tsx#L1-L12) | [UI-027] Browser pane, profiles, navigation and inspector browser |
| [apps/electron/src/renderer/pages/ChatPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ChatPage.tsx#L1-L12) | [UI-005] Chat transcript, composer and rich session views |
| [apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx#L1-L12) | [UI-030] Cloud-run detail surface and live run operations |
| [apps/electron/src/renderer/pages/ConnectionsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ConnectionsPage.tsx#L1-L12) | [UI-023] Connections hub, imports, credentials, grants and audit |
| [apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx#L1-L12) | [UI-028] Embedded extension views and extension host integration |
| [apps/electron/src/renderer/pages/FeedPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/FeedPage.tsx#L1-L12) | [UI-015] Feed agents, automation activity, news, subscriptions and source editor |
| [apps/electron/src/renderer/pages/InboxPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/InboxPage.tsx#L1-L12) | [UI-013] Unified Inbox, review actions and attention state |
| [apps/electron/src/renderer/pages/KnowledgeEntityPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/KnowledgeEntityPage.tsx#L1-L12) | [UI-024] Knowledge search, saved views and entity inspector |
| [apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx#L1-L12) | [UI-026] Optional knowledge engine and embedded SiYuan surface |
| [apps/electron/src/renderer/pages/MeetingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/MeetingsPage.tsx#L1-L12) | [UI-016] Local Meetings recording, imports, ASR and follow-up outputs |
| [apps/electron/src/renderer/pages/NotesPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/NotesPage.tsx#L1-L12) | [UI-010] Notes documents, folders, assets and Markdown editor |
| [apps/electron/src/renderer/pages/ProjectInfoPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ProjectInfoPage.tsx#L1-L12) | [UI-020] Projects home, creation, detail, assets and settings |
| [apps/electron/src/renderer/pages/ShortcutsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ShortcutsPage.tsx#L1-L12) | [UI-061] Shortcuts page, command palette and platform key mappings |
| [apps/electron/src/renderer/pages/SkillInfoPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SkillInfoPage.tsx#L1-L12) | [UI-022] Skills catalog, OMP imports, editing and invocation |
| [apps/electron/src/renderer/pages/SourceInfoPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SourceInfoPage.tsx#L1-L12) | [UI-021] Sources catalog, MCP tools, permissions and source detail |
| [apps/electron/src/renderer/pages/TasksPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TasksPage.tsx#L1-L12) | [UI-008] Personal tasks, scheduling, lists and task detail |
| [apps/electron/src/renderer/pages/TerminalSurfacePage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TerminalSurfacePage.tsx#L1-L12) | [UI-029] Terminal route, dock and genuine interactive shell |
| [apps/electron/src/renderer/pages/connections-overview.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/connections-overview.tsx#L1-L12) | [UI-023] Connections hub, imports, credentials, grants and audit |
| [apps/electron/src/renderer/pages/extra-screens/ExtraScreenHost.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/ExtraScreenHost.tsx#L1-L12) | [UI-001] Workbench shell, routes and window layouts |
| [apps/electron/src/renderer/pages/extra-screens/ExtraScreensRailGroup.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/ExtraScreensRailGroup.tsx#L1-L12) | [UI-051] Appearance, shell variants, theme, language, density and icon settings |
| [apps/electron/src/renderer/pages/extra-screens/agents/AgentCenterPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/agents/AgentCenterPage.tsx#L1-L12) | [UI-037] Agent Center, stop controls, automations and budget monitor |
| [apps/electron/src/renderer/pages/extra-screens/decisions/DecisionsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/decisions/DecisionsPage.tsx#L1-L12) | [UI-036] Decisions log, extraction and memory promotion |
| [apps/electron/src/renderer/pages/extra-screens/dossier/DossierPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/dossier/DossierPage.tsx#L1-L12) | [UI-034] Dossier contacts, companies, touches and generated briefs |
| [apps/electron/src/renderer/pages/extra-screens/focus/FocusPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/focus/FocusPage.tsx#L1-L12) | [UI-038] Focus timer, daily priorities, calendar and daily summary |
| [apps/electron/src/renderer/pages/extra-screens/radar/RadarPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/radar/RadarPage.tsx#L1-L12) | [UI-035] Radar topics, source signals, sweeps and digest detail |
| [apps/electron/src/renderer/pages/extra-screens/ui.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/ui.tsx#L1-L12) | [UI-064] Shared menus, dialogs, accessibility and responsive primitives |
| [apps/electron/src/renderer/pages/feed/FeedParts.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/feed/FeedParts.tsx#L1-L12) | [UI-015] Feed agents, automation activity, news, subscriptions and source editor |
| [apps/electron/src/renderer/pages/feed/FeedSources.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/feed/FeedSources.tsx#L1-L12) | [UI-015] Feed agents, automation activity, news, subscriptions and source editor |
| [apps/electron/src/renderer/pages/inbox/mail/MailPanels.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/inbox/mail/MailPanels.tsx#L1-L12) | [UI-014] Inbox mail accounts, folders, message rendering and composition |
| [apps/electron/src/renderer/pages/meetings/AgentReadiness.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/AgentReadiness.tsx#L1-L12) | [UI-017] Meeting workspace, agent readiness and proposal inbox |
| [apps/electron/src/renderer/pages/meetings/ConationPanels.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/ConationPanels.tsx#L1-L12) | [UI-017] Meeting workspace, agent readiness and proposal inbox |
| [apps/electron/src/renderer/pages/meetings/LocalMeetingDetail.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/LocalMeetingDetail.tsx#L1-L12) | [UI-016] Local Meetings recording, imports, ASR and follow-up outputs |
| [apps/electron/src/renderer/pages/meetings/MeetingDetail.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/MeetingDetail.tsx#L1-L12) | [UI-017] Meeting workspace, agent readiness and proposal inbox |
| [apps/electron/src/renderer/pages/meetings/MeetingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/MeetingsPage.tsx#L1-L12) | [UI-017] Meeting workspace, agent readiness and proposal inbox |
| [apps/electron/src/renderer/pages/meetings/MeetingsWorkspace.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/MeetingsWorkspace.tsx#L1-L12) | [UI-017] Meeting workspace, agent readiness and proposal inbox |
| [apps/electron/src/renderer/pages/meetings/ProposalInbox.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/ProposalInbox.tsx#L1-L12) | [UI-017] Meeting workspace, agent readiness and proposal inbox |
| [apps/electron/src/renderer/pages/notes/NoteInspector.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/NoteInspector.tsx#L1-L12) | [UI-012] Note AI, comments, wiki links and vault insights |
| [apps/electron/src/renderer/pages/notes/NotesAIMenu.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/NotesAIMenu.tsx#L1-L12) | [UI-012] Note AI, comments, wiki links and vault insights |
| [apps/electron/src/renderer/pages/notes/NotesDialogs.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/NotesDialogs.tsx#L1-L12) | [UI-010] Notes documents, folders, assets and Markdown editor |
| [apps/electron/src/renderer/pages/notes/NotesDocumentChrome.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/NotesDocumentChrome.tsx#L1-L12) | [UI-012] Note AI, comments, wiki links and vault insights |
| [apps/electron/src/renderer/pages/notes/NotesReadingChrome.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/NotesReadingChrome.tsx#L1-L12) | [UI-012] Note AI, comments, wiki links and vault insights |
| [apps/electron/src/renderer/pages/notes/NotesViewHost.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/NotesViewHost.tsx#L1-L12) | [UI-011] Notes Base/Table, JSON Canvas, Outline, Graph and mind map |
| [apps/electron/src/renderer/pages/notes/VaultIndexHealthPanel.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/VaultIndexHealthPanel.tsx#L1-L12) | [UI-012] Note AI, comments, wiki links and vault insights |
| [apps/electron/src/renderer/pages/notes/VaultInsightsPanel.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/VaultInsightsPanel.tsx#L1-L12) | [UI-012] Note AI, comments, wiki links and vault insights |
| [apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx#L1-L12) | [UI-040] Account profile, avatar, XP and balance settings |
| [apps/electron/src/renderer/pages/settings/AccountsSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AccountsSettingsPage.tsx#L1-L12) | [UI-041] Accounts, service identity, cloud connection and logout |
| [apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx#L1-L12) | [UI-050] AI connections, provider editor and workspace model overrides |
| [apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx#L1-L12) | [UI-049] App environment, notifications, power, proxy and updates settings |
| [apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx#L1-L12) | [UI-051] Appearance, shell variants, theme, language, density and icon settings |
| [apps/electron/src/renderer/pages/settings/BrowserProfileImportPanel.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/BrowserProfileImportPanel.tsx#L1-L12) | [UI-066] Browser profile import, cookies, bookmarks and credential consent |
| [apps/electron/src/renderer/pages/settings/CloudRunsSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/CloudRunsSettingsPage.tsx#L1-L12) | [UI-059] Cloud Runs provider, sandbox, quotas and scheduling settings |
| [apps/electron/src/renderer/pages/settings/ConationShellSettings.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ConationShellSettings.tsx#L1-L12) | [UI-051] Appearance, shell variants, theme, language, density and icon settings |
| [apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ContextSettingsPage.tsx#L1-L12) | [UI-044] Context documents, templates, preferences and memory entry points |
| [apps/electron/src/renderer/pages/settings/CredentialMigrationCard.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/CredentialMigrationCard.tsx#L1-L12) | [UI-041] Accounts, service identity, cloud connection and logout |
| [apps/electron/src/renderer/pages/settings/EnvironmentSettingsSection.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/EnvironmentSettingsSection.tsx#L1-L12) | [UI-049] App environment, notifications, power, proxy and updates settings |
| [apps/electron/src/renderer/pages/settings/ExtensionsSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ExtensionsSettingsPage.tsx#L1-L12) | [UI-047] Extensions settings, catalogs, dev host and compatibility center |
| [apps/electron/src/renderer/pages/settings/ExtraScreensSettings.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ExtraScreensSettings.tsx#L1-L12) | [UI-051] Appearance, shell variants, theme, language, density and icon settings |
| [apps/electron/src/renderer/pages/settings/ImportSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ImportSettingsPage.tsx#L1-L12) | [UI-048] Foreign session import and automatic discovery settings |
| [apps/electron/src/renderer/pages/settings/InputSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/InputSettingsPage.tsx#L1-L12) | [UI-052] Input, spellcheck, send key and voice settings |
| [apps/electron/src/renderer/pages/settings/KnowledgeSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/KnowledgeSettingsPage.tsx#L1-L12) | [UI-045] Knowledge settings, engine connections, migration and note AI prompts |
| [apps/electron/src/renderer/pages/settings/LabelsSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/LabelsSettingsPage.tsx#L1-L12) | [UI-055] Labels, hierarchy, colors and saved collection views settings |
| [apps/electron/src/renderer/pages/settings/MarketplaceSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/MarketplaceSettingsPage.tsx#L1-L12) | [UI-046] Marketplace catalog, packages, offline reports and update lifecycle |
| [apps/electron/src/renderer/pages/settings/MessagingSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/MessagingSettingsPage.tsx#L1-L12) | [UI-057] Messaging platform connections, pairing, bindings and access settings |
| [apps/electron/src/renderer/pages/settings/OrganizationsSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/OrganizationsSettingsPage.tsx#L1-L12) | [UI-056] Organizations, membership, invitations and team spaces settings |
| [apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx#L1-L12) | [UI-054] Permissions defaults, workspace rules, OpenClaw audit and command gateway |
| [apps/electron/src/renderer/pages/settings/PreferencesPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PreferencesPage.tsx#L1-L12) | [UI-062] Preferences identity/persona/location and settings embedding |
| [apps/electron/src/renderer/pages/settings/PrivacySettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/PrivacySettingsPage.tsx#L1-L12) | [UI-042] Privacy purpose controls, export and remote deletion |
| [apps/electron/src/renderer/pages/settings/RuntimeSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/RuntimeSettingsPage.tsx#L1-L12) | [UI-043] Runtime, toolchain, environment and secret references settings |
| [apps/electron/src/renderer/pages/settings/SecretRefsSection.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/SecretRefsSection.tsx#L1-L12) | [UI-043] Runtime, toolchain, environment and secret references settings |
| [apps/electron/src/renderer/pages/settings/SecuritySettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/SecuritySettingsPage.tsx#L1-L12) | [UI-060] Security overview, OpenClaw lifecycle, vault health and risk acceptance |
| [apps/electron/src/renderer/pages/settings/ServerSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ServerSettingsPage.tsx#L1-L12) | [UI-058] Server remote access, TLS, auth token and native sidecar settings |
| [apps/electron/src/renderer/pages/settings/SettingsNavigator.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/SettingsNavigator.tsx#L1-L12) | [UI-039] Settings overview, navigator and registry coverage |
| [apps/electron/src/renderer/pages/settings/SettingsOverviewPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/SettingsOverviewPage.tsx#L1-L12) | [UI-039] Settings overview, navigator and registry coverage |
| [apps/electron/src/renderer/pages/settings/ShortcutsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ShortcutsPage.tsx#L1-L12) | [UI-061] Shortcuts page, command palette and platform key mappings |
| [apps/electron/src/renderer/pages/settings/VoiceSettingsSection.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/VoiceSettingsSection.tsx#L1-L12) | [UI-052] Input, spellcheck, send key and voice settings |
| [apps/electron/src/renderer/pages/settings/WorkbenchChromeSettings.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/WorkbenchChromeSettings.tsx#L1-L12) | [UI-051] Appearance, shell variants, theme, language, density and icon settings |
| [apps/electron/src/renderer/pages/settings/WorkspaceSettingsPage.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/WorkspaceSettingsPage.tsx#L1-L12) | [UI-053] Workspace identity, TLS, enabled modes, directories and MCP settings |
| [apps/electron/src/renderer/pages/settings/ZenShellSettings.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/ZenShellSettings.tsx#L1-L12) | [UI-051] Appearance, shell variants, theme, language, density and icon settings |
| [apps/electron/src/renderer/pages/settings/secret-refs-ui.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/secret-refs-ui.tsx#L1-L12) | [UI-043] Runtime, toolchain, environment and secret references settings |
| [apps/electron/src/renderer/pages/settings/security/SecuritySnake.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/security/SecuritySnake.tsx#L1-L12) | [UI-060] Security overview, OpenClaw lifecycle, vault health and risk acceptance |
| [apps/electron/src/renderer/pages/tasks/MoveDialog.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/tasks/MoveDialog.tsx#L1-L12) | [UI-008] Personal tasks, scheduling, lists and task detail |
| [apps/electron/src/renderer/pages/tasks/QuickEntry.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/tasks/QuickEntry.tsx#L1-L12) | [UI-008] Personal tasks, scheduling, lists and task detail |
| [apps/electron/src/renderer/pages/tasks/TaskDetail.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/tasks/TaskDetail.tsx#L1-L12) | [UI-008] Personal tasks, scheduling, lists and task detail |
| [apps/electron/src/renderer/pages/tasks/parts.tsx:1-12](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/tasks/parts.tsx#L1-L12) | [UI-008] Personal tasks, scheduling, lists and task detail |

## [SURFACE-ACCEPTANCE] Closure and evidence rule

A task can close only when its Requirements, DoD, Full functional verification and Test method are fulfilled. If a feature is intentionally excluded from a target, record the concrete capability decision, hide/disable its entry points consistently, publish that platform contract and verify the unavailable state. A successful unit test, fixture preview, source-string assertion, configured token, queued operation or screenshot alone does not prove a working feature. Use the integration/release backlog in this package for cross-module scenarios and final A/B/C build acceptance.
