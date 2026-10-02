# [INV] Source coverage and direct dependency inventory

Pinned source: `f63294ba4fffa7238b46b24e918925a313ad0b12`. Generated from Git's tracked tree, not ignored build outputs or installed dependencies. Counts describe source inventory, not test execution or coverage percentages.

## [INV-WORKSPACES] Every app and package

| Workspace | Manifest | Production source files | Test-related files | Backlog ownership |
| --- | --- | ---: | ---: | --- |
| `apps/cli` | [apps/cli/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cli/package.json#L1) | 3 | 4 | SVC / WEB / INT / QA |
| `apps/cloud-gateway` | [apps/cloud-gateway/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/package.json#L1) | 4 | 0 | SVC / WEB / INT / QA |
| `apps/electron` | [apps/electron/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/package.json#L1) | 1157 | 498 | UI / WIN / MAC / INT / QA |
| `apps/viewer` | [apps/viewer/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/viewer/package.json#L1) | 12 | 4 | WEB / INT / QA |
| `apps/webui` | [apps/webui/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/package.json#L1) | 12 | 2 | WEB / INT / QA |
| `packages/cloud-runner` | [packages/cloud-runner/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/package.json#L1) | 14 | 5 | SVC / WEB / INT / QA |
| `packages/core` | [packages/core/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/package.json#L1) | 154 | 77 | SVC / INT / QA |
| `packages/messaging-discord-worker` | [packages/messaging-discord-worker/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-discord-worker/package.json#L1) | 2 | 1 | SVC / WEB / INT / QA |
| `packages/messaging-gateway` | [packages/messaging-gateway/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/package.json#L1) | 49 | 31 | SVC / WEB / INT / QA |
| `packages/messaging-whatsapp-worker` | [packages/messaging-whatsapp-worker/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-whatsapp-worker/package.json#L1) | 5 | 3 | SVC / WEB / INT / QA |
| `packages/pi-agent-server` | [packages/pi-agent-server/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/package.json#L1) | 23 | 17 | SVC / WEB / INT / QA |
| `packages/server-core` | [packages/server-core/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/package.json#L1) | 255 | 221 | SVC / WEB / INT / QA |
| `packages/server` | [packages/server/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/package.json#L1) | 2 | 2 | SVC / WEB / INT / QA |
| `packages/session-mcp-server` | [packages/session-mcp-server/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/session-mcp-server/package.json#L1) | 1 | 0 | SVC / WEB / INT / QA |
| `packages/session-tools-core` | [packages/session-tools-core/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/session-tools-core/package.json#L1) | 50 | 25 | SVC / WEB / INT / QA |
| `packages/shared` | [packages/shared/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/package.json#L1) | 580 | 478 | SVC / WEB / INT / QA |
| `packages/ui` | [packages/ui/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/package.json#L1) | 153 | 45 | UI / INT / QA |

## [INV-MODULES] packages/shared/src

| Module or file | Source entry | Production files | Test-related files | Required audit family |
| --- | --- | ---: | ---: | --- |
| `__tests__` | [packages/shared/src/__tests__/feature-flags.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/__tests__/feature-flags.test.ts#L1) | 0 | 10 | SVC; contract INT/QA |
| `account-replica` | [packages/shared/src/account-replica/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/account-replica/index.ts#L1) | 4 | 1 | SVC; contract INT/QA |
| `agent` | [packages/shared/src/agent/backend/claude/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/agent/backend/claude/index.ts#L1) | 75 | 89 | SVC; contract INT/QA |
| `auth` | [packages/shared/src/auth/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/auth/index.ts#L1) | 21 | 10 | SVC; contract INT/QA |
| `automations` | [packages/shared/src/automations/handlers/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/automations/handlers/index.ts#L1) | 32 | 20 | SVC; contract INT/QA |
| `branding.ts` | [packages/shared/src/branding.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/branding.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `browser` | [packages/shared/src/browser/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/browser/index.ts#L1) | 4 | 4 | SVC; contract INT/QA |
| `capabilities` | [packages/shared/src/capabilities/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/capabilities/index.ts#L1) | 5 | 1 | SVC; contract INT/QA |
| `cli` | [packages/shared/src/cli/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/cli/index.ts#L1) | 3 | 2 | SVC; contract INT/QA |
| `code-intelligence` | [packages/shared/src/code-intelligence/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/code-intelligence/index.ts#L1) | 5 | 1 | SVC; contract INT/QA |
| `collaboration` | [packages/shared/src/collaboration/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/collaboration/index.ts#L1) | 7 | 3 | SVC; contract INT/QA |
| `colors` | [packages/shared/src/colors/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/colors/index.ts#L1) | 6 | 1 | SVC; contract INT/QA |
| `config` | [packages/shared/src/config/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/config/index.ts#L1) | 27 | 29 | SVC; contract INT/QA |
| `connections` | [packages/shared/src/connections/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/connections/index.ts#L1) | 2 | 1 | SVC; contract INT/QA |
| `context-docs` | [packages/shared/src/context-docs/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/context-docs/index.ts#L1) | 1 | 2 | SVC; contract INT/QA |
| `credentials` | [packages/shared/src/credentials/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/credentials/index.ts#L1) | 25 | 22 | SVC; contract INT/QA |
| `design-manifest` | [packages/shared/src/design-manifest/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/design-manifest/index.ts#L1) | 3 | 1 | SVC; contract INT/QA |
| `docs` | [packages/shared/src/docs/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/docs/index.ts#L1) | 3 | 0 | SVC; contract INT/QA |
| `environment` | [packages/shared/src/environment/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/environment/index.ts#L1) | 4 | 1 | SVC; contract INT/QA |
| `execution` | [packages/shared/src/execution/terminal-protocol.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/execution/terminal-protocol.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `extensions` | [packages/shared/src/extensions/adapters/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/extensions/adapters/index.ts#L1) | 23 | 8 | SVC; contract INT/QA |
| `feature-flags.ts` | [packages/shared/src/feature-flags.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/feature-flags.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `feed` | [packages/shared/src/feed/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/feed/index.ts#L1) | 5 | 1 | SVC; contract INT/QA |
| `gamification` | [packages/shared/src/gamification/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/gamification/index.ts#L1) | 4 | 3 | SVC; contract INT/QA |
| `git` | [packages/shared/src/git/exec.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/git/exec.ts#L1) | 2 | 3 | SVC; contract INT/QA |
| `i18n` | [packages/shared/src/i18n/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/i18n/index.ts#L1) | 6 | 87 | SVC; contract INT/QA |
| `icons` | [packages/shared/src/icons/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/icons/index.ts#L1) | 2 | 0 | SVC; contract INT/QA |
| `identity` | [packages/shared/src/identity/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/identity/index.ts#L1) | 6 | 4 | SVC; contract INT/QA |
| `index.ts` | [packages/shared/src/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/index.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `interceptor-common.ts` | [packages/shared/src/interceptor-common.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/interceptor-common.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `interceptor-request-utils.ts` | [packages/shared/src/interceptor-request-utils.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/interceptor-request-utils.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `kanban` | [packages/shared/src/kanban/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/kanban/index.ts#L1) | 5 | 1 | SVC; contract INT/QA |
| `knowledge` | [packages/shared/src/knowledge/oem-pin.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/knowledge/oem-pin.ts#L1) | 5 | 5 | SVC; contract INT/QA |
| `labels` | [packages/shared/src/labels/auto/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/labels/auto/index.ts#L1) | 14 | 6 | SVC; contract INT/QA |
| `mail` | [packages/shared/src/mail/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mail/index.ts#L1) | 5 | 1 | SVC; contract INT/QA |
| `marketplace` | [packages/shared/src/marketplace/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/marketplace/index.ts#L1) | 6 | 6 | SVC; contract INT/QA |
| `mcp` | [packages/shared/src/mcp/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mcp/index.ts#L1) | 8 | 13 | SVC; contract INT/QA |
| `meeting-agents` | [packages/shared/src/meeting-agents/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/meeting-agents/index.ts#L1) | 12 | 8 | SVC; contract INT/QA |
| `memory` | [packages/shared/src/memory/context-select.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/memory/context-select.ts#L1) | 3 | 1 | SVC; contract INT/QA |
| `mentions` | [packages/shared/src/mentions/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/mentions/index.ts#L1) | 1 | 3 | SVC; contract INT/QA |
| `openclaw` | [packages/shared/src/openclaw/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/openclaw/index.ts#L1) | 3 | 2 | SVC; contract INT/QA |
| `orgs` | [packages/shared/src/orgs/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/orgs/index.ts#L1) | 3 | 1 | SVC; contract INT/QA |
| `os` | [packages/shared/src/os/user-display-name.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/os/user-display-name.ts#L1) | 1 | 1 | SVC; contract INT/QA |
| `pages` | [packages/shared/src/pages/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/pages/index.ts#L1) | 12 | 7 | SVC; contract INT/QA |
| `privacy` | [packages/shared/src/privacy/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/privacy/index.ts#L1) | 5 | 1 | SVC; contract INT/QA |
| `projects` | [packages/shared/src/projects/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/projects/index.ts#L1) | 3 | 1 | SVC; contract INT/QA |
| `prompts` | [packages/shared/src/prompts/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/prompts/index.ts#L1) | 3 | 2 | SVC; contract INT/QA |
| `protocol` | [packages/shared/src/protocol/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/protocol/index.ts#L1) | 8 | 3 | SVC; contract INT/QA |
| `release-notes` | [packages/shared/src/release-notes/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/release-notes/index.ts#L1) | 1 | 1 | SVC; contract INT/QA |
| `resources` | [packages/shared/src/resources/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/resources/index.ts#L1) | 3 | 1 | SVC; contract INT/QA |
| `scheduler` | [packages/shared/src/scheduler/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/scheduler/index.ts#L1) | 2 | 0 | SVC; contract INT/QA |
| `search` | [packages/shared/src/search/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/search/index.ts#L1) | 2 | 0 | SVC; contract INT/QA |
| `secrets` | [packages/shared/src/secrets/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/secrets/index.ts#L1) | 9 | 9 | SVC; contract INT/QA |
| `security` | [packages/shared/src/security/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/security/index.ts#L1) | 4 | 1 | SVC; contract INT/QA |
| `sessions` | [packages/shared/src/sessions/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sessions/index.ts#L1) | 30 | 23 | SVC; contract INT/QA |
| `side-threads` | [packages/shared/src/side-threads/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/side-threads/index.ts#L1) | 2 | 2 | SVC; contract INT/QA |
| `skills` | [packages/shared/src/skills/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/skills/index.ts#L1) | 5 | 3 | SVC; contract INT/QA |
| `sources` | [packages/shared/src/sources/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/sources/index.ts#L1) | 10 | 18 | SVC; contract INT/QA |
| `statuses` | [packages/shared/src/statuses/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/statuses/index.ts#L1) | 6 | 1 | SVC; contract INT/QA |
| `tasks` | [packages/shared/src/tasks/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/tasks/index.ts#L1) | 7 | 2 | SVC; contract INT/QA |
| `team` | [packages/shared/src/team/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/team/index.ts#L1) | 6 | 1 | SVC; contract INT/QA |
| `test-preload-pdfjs-url.ts` | [packages/shared/src/test-preload-pdfjs-url.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/test-preload-pdfjs-url.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `toolchain` | [packages/shared/src/toolchain/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/toolchain/index.ts#L1) | 15 | 12 | SVC; contract INT/QA |
| `toolchain-runtime.ts` | [packages/shared/src/toolchain-runtime.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/toolchain-runtime.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `tools` | [packages/shared/src/tools/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/tools/index.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `types` | [packages/shared/src/types/incr-regex-package.d.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/types/incr-regex-package.d.ts#L1) | 2 | 0 | SVC; contract INT/QA |
| `unified-network-interceptor.ts` | [packages/shared/src/unified-network-interceptor.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/unified-network-interceptor.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `utils` | [packages/shared/src/utils/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/utils/index.ts#L1) | 24 | 10 | SVC; contract INT/QA |
| `validation` | [packages/shared/src/validation/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/validation/index.ts#L1) | 2 | 0 | SVC; contract INT/QA |
| `version` | [packages/shared/src/version/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/version/index.ts#L1) | 4 | 0 | SVC; contract INT/QA |
| `views` | [packages/shared/src/views/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/views/index.ts#L1) | 8 | 3 | SVC; contract INT/QA |
| `voice` | [packages/shared/src/voice/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/voice/index.ts#L1) | 40 | 5 | SVC; contract INT/QA |
| `workflows` | [packages/shared/src/workflows/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/workflows/index.ts#L1) | 8 | 2 | SVC; contract INT/QA |
| `workspace` | [packages/shared/src/workspace/open-in-editor.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/workspace/open-in-editor.ts#L1) | 1 | 1 | SVC; contract INT/QA |
| `workspaces` | [packages/shared/src/workspaces/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/src/workspaces/index.ts#L1) | 4 | 3 | SVC; contract INT/QA |

## [INV-MODULES] packages/server-core/src

| Module or file | Source entry | Production files | Test-related files | Required audit family |
| --- | --- | ---: | ---: | --- |
| `bootstrap` | [packages/server-core/src/bootstrap/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/bootstrap/index.ts#L1) | 3 | 3 | SVC; contract INT/QA |
| `collaboration` | [packages/server-core/src/collaboration/bro-invite-service.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/collaboration/bro-invite-service.ts#L1) | 1 | 1 | SVC; contract INT/QA |
| `command-gateway` | [packages/server-core/src/command-gateway/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/command-gateway/index.ts#L1) | 2 | 1 | SVC; contract INT/QA |
| `domain` | [packages/server-core/src/domain/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/domain/index.ts#L1) | 7 | 1 | SVC; contract INT/QA |
| `execution` | [packages/server-core/src/execution/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/execution/index.ts#L1) | 5 | 2 | SVC; contract INT/QA |
| `feed` | [packages/server-core/src/feed/feed-service.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/feed/feed-service.ts#L1) | 3 | 2 | SVC; contract INT/QA |
| `handlers` | [packages/server-core/src/handlers/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/handlers/index.ts#L1) | 67 | 62 | SVC; contract INT/QA |
| `index.ts` | [packages/server-core/src/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/index.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `knowledge` | [packages/server-core/src/knowledge/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/knowledge/index.ts#L1) | 28 | 25 | SVC; contract INT/QA |
| `meetings` | [packages/server-core/src/meetings/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/meetings/index.ts#L1) | 43 | 32 | SVC; contract INT/QA |
| `memory` | [packages/server-core/src/memory/AuditLog.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/memory/AuditLog.ts#L1) | 12 | 13 | SVC; contract INT/QA |
| `model-fetchers` | [packages/server-core/src/model-fetchers/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/model-fetchers/index.ts#L1) | 6 | 0 | SVC; contract INT/QA |
| `native` | [packages/server-core/src/native/client.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/native/client.ts#L1) | 3 | 9 | SVC; contract INT/QA |
| `observability` | [packages/server-core/src/observability/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/observability/index.ts#L1) | 2 | 1 | SVC; contract INT/QA |
| `openclaw` | [packages/server-core/src/openclaw/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/openclaw/index.ts#L1) | 6 | 4 | SVC; contract INT/QA |
| `pages` | [packages/server-core/src/pages/mcp-executor.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/pages/mcp-executor.ts#L1) | 4 | 3 | SVC; contract INT/QA |
| `runtime` | [packages/server-core/src/runtime/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/runtime/index.ts#L1) | 4 | 0 | SVC; contract INT/QA |
| `security` | [packages/server-core/src/security/workspace-scope.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/security/workspace-scope.ts#L1) | 1 | 1 | SVC; contract INT/QA |
| `services` | [packages/server-core/src/services/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/services/index.ts#L1) | 6 | 3 | SVC; contract INT/QA |
| `sessions` | [packages/server-core/src/sessions/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/sessions/index.ts#L1) | 12 | 32 | SVC; contract INT/QA |
| `sources` | [packages/server-core/src/sources/build-servers.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/sources/build-servers.ts#L1) | 4 | 3 | SVC; contract INT/QA |
| `tasks` | [packages/server-core/src/tasks/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/tasks/index.ts#L1) | 5 | 4 | SVC; contract INT/QA |
| `transport` | [packages/server-core/src/transport/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/transport/index.ts#L1) | 9 | 3 | SVC; contract INT/QA |
| `utils` | [packages/server-core/src/utils/path-validation.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/utils/path-validation.ts#L1) | 1 | 1 | SVC; contract INT/QA |
| `webui` | [packages/server-core/src/webui/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/webui/index.ts#L1) | 4 | 2 | SVC; contract INT/QA |
| `workflows` | [packages/server-core/src/workflows/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/workflows/index.ts#L1) | 5 | 1 | SVC; contract INT/QA |
| `workgraph` | [packages/server-core/src/workgraph/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/src/workgraph/index.ts#L1) | 11 | 12 | SVC; contract INT/QA |

## [INV-MODULES] packages/core/src/platform

| Module or file | Source entry | Production files | Test-related files | Required audit family |
| --- | --- | ---: | ---: | --- |
| `__tests__` | [packages/core/src/platform/__tests__/commands-registry.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/__tests__/commands-registry.test.ts#L1) | 0 | 12 | SVC; contract INT/QA |
| `agent-teams` | [packages/core/src/platform/agent-teams/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/agent-teams/index.ts#L1) | 3 | 1 | SVC; contract INT/QA |
| `commands` | [packages/core/src/platform/commands/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/commands/index.ts#L1) | 3 | 0 | SVC; contract INT/QA |
| `context-keys` | [packages/core/src/platform/context-keys/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/context-keys/index.ts#L1) | 4 | 0 | SVC; contract INT/QA |
| `http-fetch.ts` | [packages/core/src/platform/http-fetch.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/http-fetch.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `identity` | [packages/core/src/platform/identity/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/identity/index.ts#L1) | 16 | 13 | SVC; contract INT/QA |
| `index.ts` | [packages/core/src/platform/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/index.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `modes` | [packages/core/src/platform/modes/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/modes/index.ts#L1) | 3 | 0 | SVC; contract INT/QA |
| `panels` | [packages/core/src/platform/panels/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/panels/index.ts#L1) | 5 | 0 | SVC; contract INT/QA |
| `resources` | [packages/core/src/platform/resources/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/resources/index.ts#L1) | 3 | 0 | SVC; contract INT/QA |
| `session-apply` | [packages/core/src/platform/session-apply/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/session-apply/index.ts#L1) | 4 | 2 | SVC; contract INT/QA |
| `surfaces` | [packages/core/src/platform/surfaces/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/surfaces/index.ts#L1) | 5 | 0 | SVC; contract INT/QA |
| `types.ts` | [packages/core/src/platform/types.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/types.ts#L1) | 1 | 0 | SVC; contract INT/QA |
| `workbench` | [packages/core/src/platform/workbench/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/src/platform/workbench/index.ts#L1) | 8 | 0 | SVC; contract INT/QA |

## [INV-MODULES] apps/electron/src/renderer/pages

| Module or file | Source entry | Production files | Test-related files | Required audit family |
| --- | --- | ---: | ---: | --- |
| `BrowserPanelPage.tsx` | [apps/electron/src/renderer/pages/BrowserPanelPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/BrowserPanelPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `ChatPage.tsx` | [apps/electron/src/renderer/pages/ChatPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ChatPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `CloudRunSurfacePage.tsx` | [apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/CloudRunSurfacePage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `ConnectionsPage.tsx` | [apps/electron/src/renderer/pages/ConnectionsPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ConnectionsPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `ExtensionSurfacePage.tsx` | [apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ExtensionSurfacePage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `FeedPage.tsx` | [apps/electron/src/renderer/pages/FeedPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/FeedPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `InboxPage.tsx` | [apps/electron/src/renderer/pages/InboxPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/InboxPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `KnowledgeEntityPage.tsx` | [apps/electron/src/renderer/pages/KnowledgeEntityPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/KnowledgeEntityPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `KnowledgeSurfacePage.tsx` | [apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/KnowledgeSurfacePage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `MeetingsPage.tsx` | [apps/electron/src/renderer/pages/MeetingsPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/MeetingsPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `NotesPage.tsx` | [apps/electron/src/renderer/pages/NotesPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/NotesPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `ProjectInfoPage.tsx` | [apps/electron/src/renderer/pages/ProjectInfoPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ProjectInfoPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `ShortcutsPage.tsx` | [apps/electron/src/renderer/pages/ShortcutsPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/ShortcutsPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `SkillInfoPage.tsx` | [apps/electron/src/renderer/pages/SkillInfoPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SkillInfoPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `SourceInfoPage.tsx` | [apps/electron/src/renderer/pages/SourceInfoPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/SourceInfoPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `TasksPage.tsx` | [apps/electron/src/renderer/pages/TasksPage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TasksPage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `TerminalSurfacePage.tsx` | [apps/electron/src/renderer/pages/TerminalSurfacePage.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/TerminalSurfacePage.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `__tests__` | [apps/electron/src/renderer/pages/__tests__/connections-list.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/__tests__/connections-list.test.ts#L1) | 0 | 11 | UI; browser adaptation WEB; journey INT/QA |
| `chat-rox2-surface.ts` | [apps/electron/src/renderer/pages/chat-rox2-surface.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/chat-rox2-surface.ts#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `connections-list.ts` | [apps/electron/src/renderer/pages/connections-list.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/connections-list.ts#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `connections-overview.tsx` | [apps/electron/src/renderer/pages/connections-overview.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/connections-overview.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `connections-ui.ts` | [apps/electron/src/renderer/pages/connections-ui.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/connections-ui.ts#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `extra-screens` | [apps/electron/src/renderer/pages/extra-screens/ExtraScreenHost.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/extra-screens/ExtraScreenHost.tsx#L1) | 18 | 7 | UI; browser adaptation WEB; journey INT/QA |
| `feed` | [apps/electron/src/renderer/pages/feed/FeedParts.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/feed/FeedParts.tsx#L1) | 3 | 2 | UI; browser adaptation WEB; journey INT/QA |
| `inbox` | [apps/electron/src/renderer/pages/inbox/inbox-model.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/inbox/inbox-model.ts#L1) | 5 | 2 | UI; browser adaptation WEB; journey INT/QA |
| `index.ts` | [apps/electron/src/renderer/pages/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/index.ts#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `meetings` | [apps/electron/src/renderer/pages/meetings/AgentReadiness.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/meetings/AgentReadiness.tsx#L1) | 18 | 12 | UI; browser adaptation WEB; journey INT/QA |
| `notes` | [apps/electron/src/renderer/pages/notes/NotesAIMenu.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes/NotesAIMenu.tsx#L1) | 13 | 9 | UI; browser adaptation WEB; journey INT/QA |
| `notes-rox2-surface.ts` | [apps/electron/src/renderer/pages/notes-rox2-surface.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/notes-rox2-surface.ts#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `rox2-native-surfaces.ts` | [apps/electron/src/renderer/pages/rox2-native-surfaces.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/rox2-native-surfaces.ts#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `settings` | [apps/electron/src/renderer/pages/settings/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/settings/index.ts#L1) | 44 | 43 | UI; browser adaptation WEB; journey INT/QA |
| `tasks` | [apps/electron/src/renderer/pages/tasks/MoveDialog.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/pages/tasks/MoveDialog.tsx#L1) | 6 | 1 | UI; browser adaptation WEB; journey INT/QA |

## [INV-MODULES] apps/electron/src/renderer/components

| Module or file | Source entry | Production files | Test-related files | Required audit family |
| --- | --- | ---: | ---: | --- |
| `AppMenu.tsx` | [apps/electron/src/renderer/components/AppMenu.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/AppMenu.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `KeyboardShortcuts.tsx` | [apps/electron/src/renderer/components/KeyboardShortcuts.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/KeyboardShortcuts.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `KeyboardShortcutsDialog.tsx` | [apps/electron/src/renderer/components/KeyboardShortcutsDialog.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/KeyboardShortcutsDialog.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `ResetConfirmationDialog.tsx` | [apps/electron/src/renderer/components/ResetConfirmationDialog.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/ResetConfirmationDialog.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `ServerDirectoryBrowser.tsx` | [apps/electron/src/renderer/components/ServerDirectoryBrowser.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/ServerDirectoryBrowser.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `SplashScreen.tsx` | [apps/electron/src/renderer/components/SplashScreen.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/SplashScreen.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `apisetup` | [apps/electron/src/renderer/components/apisetup/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/apisetup/index.ts#L1) | 5 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `app-menu` | [apps/electron/src/renderer/components/app-menu/DesktopAppMenu.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-menu/DesktopAppMenu.tsx#L1) | 6 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `app-shell` | [apps/electron/src/renderer/components/app-shell/input/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/app-shell/input/index.ts#L1) | 165 | 101 | UI; browser adaptation WEB; journey INT/QA |
| `automations` | [apps/electron/src/renderer/components/automations/ActionTypeIcon.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/automations/ActionTypeIcon.tsx#L1) | 21 | 7 | UI; browser adaptation WEB; journey INT/QA |
| `browser` | [apps/electron/src/renderer/components/browser/BrowserTabBadge.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/browser/BrowserTabBadge.tsx#L1) | 9 | 2 | UI; browser adaptation WEB; journey INT/QA |
| `calendar` | [apps/electron/src/renderer/components/calendar/CalendarConnectorChips.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/calendar/CalendarConnectorChips.tsx#L1) | 2 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `chat` | [apps/electron/src/renderer/components/chat/AuthRequestCard.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/chat/AuthRequestCard.tsx#L1) | 3 | 3 | UI; browser adaptation WEB; journey INT/QA |
| `cloud-runs` | [apps/electron/src/renderer/components/cloud-runs/CloudRunsChip.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/cloud-runs/CloudRunsChip.tsx#L1) | 1 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `files` | [apps/electron/src/renderer/components/files/FileViewer.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/files/FileViewer.tsx#L1) | 1 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `icons` | [apps/electron/src/renderer/components/icons/ConnectionIcon.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/icons/ConnectionIcon.tsx#L1) | 11 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `info` | [apps/electron/src/renderer/components/info/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/info/index.ts#L1) | 14 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `knowledge` | [apps/electron/src/renderer/components/knowledge/PublishSessionDialog.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/knowledge/PublishSessionDialog.tsx#L1) | 3 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `markdown` | [apps/electron/src/renderer/components/markdown/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/markdown/index.ts#L1) | 2 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `meetings` | [apps/electron/src/renderer/components/meetings/MeetingRecordingIndicator.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/meetings/MeetingRecordingIndicator.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `memory` | [apps/electron/src/renderer/components/memory/MemoryScreen.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/memory/MemoryScreen.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `messaging` | [apps/electron/src/renderer/components/messaging/access/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/messaging/access/index.ts#L1) | 18 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `mode-screen` | [apps/electron/src/renderer/components/mode-screen/ModeScreen.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/mode-screen/ModeScreen.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `notes` | [apps/electron/src/renderer/components/notes/NotesImportButton.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/notes/NotesImportButton.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `onboarding` | [apps/electron/src/renderer/components/onboarding/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/onboarding/index.ts#L1) | 16 | 8 | UI; browser adaptation WEB; journey INT/QA |
| `pages` | [apps/electron/src/renderer/components/pages/DeletePageDialog.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/pages/DeletePageDialog.tsx#L1) | 11 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `preview` | [apps/electron/src/renderer/components/preview/TableOfContents.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/preview/TableOfContents.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `projects` | [apps/electron/src/renderer/components/projects/CreateProjectDialog.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/projects/CreateProjectDialog.tsx#L1) | 2 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `right-sidebar` | [apps/electron/src/renderer/components/right-sidebar/SessionFilesSection.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/right-sidebar/SessionFilesSection.tsx#L1) | 2 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `server-directory-browser-i18n.test.ts` | [apps/electron/src/renderer/components/server-directory-browser-i18n.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/server-directory-browser-i18n.test.ts#L1) | 0 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `session-inspector` | [apps/electron/src/renderer/components/session-inspector/BottomTerminalDock.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/session-inspector/BottomTerminalDock.tsx#L1) | 6 | 3 | UI; browser adaptation WEB; journey INT/QA |
| `session-workbench` | [apps/electron/src/renderer/components/session-workbench/PlaybookHoleList.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/session-workbench/PlaybookHoleList.tsx#L1) | 21 | 12 | UI; browser adaptation WEB; journey INT/QA |
| `settings` | [apps/electron/src/renderer/components/settings/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/settings/index.ts#L1) | 16 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `shiki` | [apps/electron/src/renderer/components/shiki/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/shiki/index.ts#L1) | 4 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `team` | [apps/electron/src/renderer/components/team/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/team/index.ts#L1) | 9 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `ui` | [apps/electron/src/renderer/components/ui/CompactSourceSelector.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/ui/CompactSourceSelector.tsx#L1) | 75 | 13 | UI; browser adaptation WEB; journey INT/QA |
| `views` | [apps/electron/src/renderer/components/views/ViewPurposeList.tsx](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/views/ViewPurposeList.tsx#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `workspace` | [apps/electron/src/renderer/components/workspace/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/renderer/components/workspace/index.ts#L1) | 13 | 5 | UI; browser adaptation WEB; journey INT/QA |

## [INV-MODULES] apps/electron/src/main

| Module or file | Source entry | Production files | Test-related files | Required audit family |
| --- | --- | ---: | ---: | --- |
| `__tests__` | [apps/electron/src/main/__tests__/auto-update-suppress.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/__tests__/auto-update-suppress.test.ts#L1) | 0 | 38 | WIN/MAC/WEB; integration INT/QA |
| `auto-update-policy.ts` | [apps/electron/src/main/auto-update-policy.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/auto-update-policy.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `auto-update.ts` | [apps/electron/src/main/auto-update.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/auto-update.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `brand-config-boot.ts` | [apps/electron/src/main/brand-config-boot.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/brand-config-boot.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `brand-icon-migration.ts` | [apps/electron/src/main/brand-icon-migration.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/brand-icon-migration.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `browser-cdp.ts` | [apps/electron/src/main/browser-cdp.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/browser-cdp.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `browser-cookie-auto-import.ts` | [apps/electron/src/main/browser-cookie-auto-import.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/browser-cookie-auto-import.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `browser-cookie-crypto.ts` | [apps/electron/src/main/browser-cookie-crypto.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/browser-cookie-crypto.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `browser-pane-manager.ts` | [apps/electron/src/main/browser-pane-manager.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/browser-pane-manager.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `chunked-rpc.ts` | [apps/electron/src/main/chunked-rpc.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/chunked-rpc.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `deep-link.ts` | [apps/electron/src/main/deep-link.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/deep-link.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `extension-host` | [apps/electron/src/main/extension-host/capability-broker.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/extension-host/capability-broker.ts#L1) | 5 | 3 | WIN/MAC/WEB; integration INT/QA |
| `extension-host-manager.ts` | [apps/electron/src/main/extension-host-manager.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/extension-host-manager.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `global-input-router.ts` | [apps/electron/src/main/global-input-router.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/global-input-router.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `handlers` | [apps/electron/src/main/handlers/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/handlers/index.ts#L1) | 10 | 10 | WIN/MAC/WEB; integration INT/QA |
| `index.ts` | [apps/electron/src/main/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/index.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `knowledge-engine-session.ts` | [apps/electron/src/main/knowledge-engine-session.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/knowledge-engine-session.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `local-client-binding.test.ts` | [apps/electron/src/main/local-client-binding.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/local-client-binding.test.ts#L1) | 0 | 1 | WIN/MAC/WEB; integration INT/QA |
| `local-client-binding.ts` | [apps/electron/src/main/local-client-binding.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/local-client-binding.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `logger.ts` | [apps/electron/src/main/logger.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/logger.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `mail` | [apps/electron/src/main/mail/local-ipc.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/mail/local-ipc.ts#L1) | 3 | 1 | WIN/MAC/WEB; integration INT/QA |
| `meetings` | [apps/electron/src/main/meetings/capture.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/meetings/capture.ts#L1) | 9 | 3 | WIN/MAC/WEB; integration INT/QA |
| `menu.ts` | [apps/electron/src/main/menu.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/menu.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `network-proxy-utils.ts` | [apps/electron/src/main/network-proxy-utils.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/network-proxy-utils.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `network-proxy.ts` | [apps/electron/src/main/network-proxy.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/network-proxy.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `notifications.ts` | [apps/electron/src/main/notifications.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/notifications.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `onboarding.ts` | [apps/electron/src/main/onboarding.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/onboarding.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `openclaw-host-control.test.ts` | [apps/electron/src/main/openclaw-host-control.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/openclaw-host-control.test.ts#L1) | 0 | 1 | WIN/MAC/WEB; integration INT/QA |
| `openclaw-host-control.ts` | [apps/electron/src/main/openclaw-host-control.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/openclaw-host-control.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `openclaw-security.test.ts` | [apps/electron/src/main/openclaw-security.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/openclaw-security.test.ts#L1) | 0 | 1 | WIN/MAC/WEB; integration INT/QA |
| `openclaw-security.ts` | [apps/electron/src/main/openclaw-security.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/openclaw-security.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `page-thumbnail-host.ts` | [apps/electron/src/main/page-thumbnail-host.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/page-thumbnail-host.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `page-thumbnailer.ts` | [apps/electron/src/main/page-thumbnailer.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/page-thumbnailer.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `platform.ts` | [apps/electron/src/main/platform.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/platform.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `power-manager.ts` | [apps/electron/src/main/power-manager.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/power-manager.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `remote-tls-enrollment.ts` | [apps/electron/src/main/remote-tls-enrollment.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/remote-tls-enrollment.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `server-endpoint-policy.ts` | [apps/electron/src/main/server-endpoint-policy.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/server-endpoint-policy.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `shell-env.ts` | [apps/electron/src/main/shell-env.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/shell-env.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `shell-material.ts` | [apps/electron/src/main/shell-material.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/shell-material.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `shims` | [apps/electron/src/main/shims/abort-controller.cjs](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/shims/abort-controller.cjs#L1) | 3 | 0 | WIN/MAC/WEB; integration INT/QA |
| `ssh-tunnel` | [apps/electron/src/main/ssh-tunnel/connection-resolver.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/ssh-tunnel/connection-resolver.ts#L1) | 7 | 0 | WIN/MAC/WEB; integration INT/QA |
| `thumbnail-protocol.ts` | [apps/electron/src/main/thumbnail-protocol.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/thumbnail-protocol.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `voice` | [apps/electron/src/main/voice/overlay-window.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/voice/overlay-window.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `window-manager.ts` | [apps/electron/src/main/window-manager.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/window-manager.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `window-state.ts` | [apps/electron/src/main/window-state.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/src/main/window-state.ts#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |

## [INV-MODULES] packages/ui/src

| Module or file | Source entry | Production files | Test-related files | Required audit family |
| --- | --- | ---: | ---: | --- |
| `__tests__` | [packages/ui/src/__tests__/pdfjs-url-import.test.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/__tests__/pdfjs-url-import.test.ts#L1) | 0 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `components` | [packages/ui/src/components/chat/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/components/chat/index.ts#L1) | 138 | 38 | UI; browser adaptation WEB; journey INT/QA |
| `context` | [packages/ui/src/context/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/context/index.ts#L1) | 3 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `fonts` | [packages/ui/src/fonts/rox/OFL.txt](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/fonts/rox/OFL.txt#L1) | 0 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `index.ts` | [packages/ui/src/index.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/index.ts#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `lib` | [packages/ui/src/lib/dismissible-layer-bridge.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/lib/dismissible-layer-bridge.ts#L1) | 6 | 1 | UI; browser adaptation WEB; journey INT/QA |
| `pdfjs-worker.d.ts` | [packages/ui/src/pdfjs-worker.d.ts](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/pdfjs-worker.d.ts#L1) | 1 | 0 | UI; browser adaptation WEB; journey INT/QA |
| `styles` | [packages/ui/src/styles/index.css](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/src/styles/index.css#L1) | 0 | 3 | UI; browser adaptation WEB; journey INT/QA |

## [INV-MODULES] native

| Module or file | Source entry | Production files | Test-related files | Required audit family |
| --- | --- | ---: | ---: | --- |
| `Cargo.lock` | [native/Cargo.lock](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/native/Cargo.lock#L1) | 0 | 0 | WIN/MAC/WEB; integration INT/QA |
| `Cargo.toml` | [native/Cargo.toml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/native/Cargo.toml#L1) | 0 | 0 | WIN/MAC/WEB; integration INT/QA |
| `apps` | [native/apps/craft-native/Cargo.toml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/native/apps/craft-native/Cargo.toml#L1) | 1 | 0 | WIN/MAC/WEB; integration INT/QA |
| `crates` | [native/crates/craft-exec/Cargo.toml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/native/crates/craft-exec/Cargo.toml#L1) | 5 | 0 | WIN/MAC/WEB; integration INT/QA |
| `rust-toolchain.toml` | [native/rust-toolchain.toml](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/native/rust-toolchain.toml#L1) | 0 | 0 | WIN/MAC/WEB; integration INT/QA |

## [INV-DEPENDENCIES] Every declared direct dependency

Declared ranges below are read from the pinned manifest snapshot. Exact installed resolution is governed by `bun.lock`; peer/dev/optional roles remain separate.

### [INV-DEP] craft-agent — [package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@anthropic-ai/claude-agent-sdk` | `0.3.258` | dependencies |
| `@anthropic-ai/sdk` | `^0.100.0` | dependencies |
| `@dnd-kit/dom` | `^0.4.0-beta-20260227032529` | dependencies |
| `@dnd-kit/helpers` | `^0.4.0-beta-20260227032529` | dependencies |
| `@earendil-works/pi-ai` | `0.85.1` | dependencies |
| `@earendil-works/pi-coding-agent` | `0.85.1` | dependencies |
| `@github/copilot-sdk` | `^0.1.23` | dependencies |
| `@modelcontextprotocol/sdk` | `^1.29.0` | dependencies |
| `@radix-ui/react-avatar` | `^1.1.11` | dependencies |
| `@radix-ui/react-collapsible` | `^1.1.12` | dependencies |
| `@radix-ui/react-dropdown-menu` | `^2.1.16` | dependencies |
| `@radix-ui/react-scroll-area` | `^1.2.10` | dependencies |
| `@radix-ui/react-select` | `^2.2.6` | dependencies |
| `@radix-ui/react-separator` | `^1.1.8` | dependencies |
| `@radix-ui/react-slot` | `^1.2.4` | dependencies |
| `@radix-ui/react-tabs` | `^1.1.13` | dependencies |
| `@radix-ui/react-tooltip` | `^1.2.8` | dependencies |
| `@sentry/electron` | `^7.7.0` | dependencies |
| `@sentry/react` | `^10.36.0` | dependencies |
| `@shikijs/cli` | `^3.19.0` | dependencies |
| `@tailwindcss/typography` | `^0.5.19` | dependencies |
| `@tiptap/extension-bubble-menu` | `^3.20.0` | dependencies |
| `@tiptap/extension-file-handler` | `^3.20.0` | dependencies |
| `@tiptap/extension-image` | `^3.20.0` | dependencies |
| `@tiptap/extension-mathematics` | `^3.20.0` | dependencies |
| `@tiptap/extension-placeholder` | `^3.20.0` | dependencies |
| `@tiptap/extension-task-item` | `^3.20.0` | dependencies |
| `@tiptap/extension-task-list` | `^3.20.0` | dependencies |
| `@tiptap/markdown` | `^3.20.0` | dependencies |
| `@tiptap/react` | `^3.20.0` | dependencies |
| `@tiptap/starter-kit` | `^3.20.0` | dependencies |
| `@tiptap/suggestion` | `^3.20.0` | dependencies |
| `@vscode/ripgrep` | `^1.17.1` | dependencies |
| `beautiful-mermaid` | `^1.1.3` | dependencies |
| `class-variance-authority` | `^0.7.1` | dependencies |
| `clsx` | `^2.1.1` | dependencies |
| `date-fns` | `^4.1.0` | dependencies |
| `gray-matter` | `^4.0.3` | dependencies |
| `jotai` | `^2.16.0` | dependencies |
| `js-yaml` | `^4.1.1` | dependencies |
| `katex` | `^0.16.33` | dependencies |
| `linkify-it` | `^5.0.0` | dependencies |
| `lucide-react` | `^0.561.0` | dependencies |
| `marked` | `^17.0.1` | dependencies |
| `markitdown-js` | `^0.0.14` | dependencies |
| `open` | `^11.0.0` | dependencies |
| `prosemirror-highlight` | `^0.15.0` | dependencies |
| `react` | `^18.3.1` | dependencies |
| `react-dom` | `^18.3.1` | dependencies |
| `react-markdown` | `^10.1.0` | dependencies |
| `react-resizable-panels` | `^3.0.6` | dependencies |
| `rehype-katex` | `^7.0.1` | dependencies |
| `rehype-raw` | `^7.0.0` | dependencies |
| `remark-gfm` | `^4.0.1` | dependencies |
| `remark-math` | `^6.0.0` | dependencies |
| `semver` | `^7.7.3` | dependencies |
| `shiki` | `^3.19.0` | dependencies |
| `tailwind-merge` | `^3.4.0` | dependencies |
| `tiptap-extension-code-block-shiki` | `^1.0.0` | dependencies |
| `tiptap-markdown` | `^0.9.0` | dependencies |
| `zod` | `^4.0.0` | dependencies |
| `@aws-sdk/client-s3` | `^3.947.0` | devDependencies |
| `@electron/packager` | `^19.0.1` | devDependencies |
| `@playwright/test` | `1.49.1` | devDependencies |
| `@rollup/rollup-win32-arm64-msvc` | `^4.55.1` | devDependencies |
| `@sentry/vite-plugin` | `^4.8.0` | devDependencies |
| `@tailwindcss/vite` | `^4.1.18` | devDependencies |
| `@types/bun` | `latest` | devDependencies |
| `@types/js-yaml` | `^4.0.9` | devDependencies |
| `@types/katex` | `^0.16.8` | devDependencies |
| `@types/linkify-it` | `^5.0.0` | devDependencies |
| `@types/node` | `^25.0.8` | devDependencies |
| `@types/react` | `^18.3.0` | devDependencies |
| `@types/react-dom` | `^18.3.0` | devDependencies |
| `@types/semver` | `^7.7.1` | devDependencies |
| `@types/shell-quote` | `^1.7.5` | devDependencies |
| `@types/uuid` | `^11.0.0` | devDependencies |
| `@typescript-eslint/eslint-plugin` | `^8.52.0` | devDependencies |
| `@typescript-eslint/parser` | `^8.52.0` | devDependencies |
| `@vitejs/plugin-react` | `^5.1.2` | devDependencies |
| `autoprefixer` | `^10.4.23` | devDependencies |
| `concurrently` | `^9.2.1` | devDependencies |
| `electron` | `^39.2.7` | devDependencies |
| `electron-builder` | `^26.0.12` | devDependencies |
| `esbuild` | `^0.25.0` | devDependencies |
| `eslint` | `^9.39.2` | devDependencies |
| `eslint-plugin-react` | `^7.37.5` | devDependencies |
| `eslint-plugin-react-hooks` | `^7.0.1` | devDependencies |
| `husky` | `^9.1.7` | devDependencies |
| `openai` | `^6.18.0` | devDependencies |
| `postcss` | `^8.5.6` | devDependencies |
| `react-devtools-core` | `^6.1.1` | devDependencies |
| `tailwindcss` | `^4.1.18` | devDependencies |
| `tar` | `^7.5.2` | devDependencies |
| `typescript` | `^5.0.0` | devDependencies |
| `vite` | `^6.2.4` | devDependencies |
| `@img/sharp-darwin-arm64` | `0.34.5` | optionalDependencies |
| `@img/sharp-darwin-x64` | `0.34.5` | optionalDependencies |
| `@img/sharp-libvips-darwin-arm64` | `1.2.4` | optionalDependencies |
| `@img/sharp-libvips-darwin-x64` | `1.2.4` | optionalDependencies |
| `@img/sharp-libvips-linux-arm64` | `1.2.4` | optionalDependencies |
| `@img/sharp-libvips-linux-x64` | `1.2.4` | optionalDependencies |
| `@img/sharp-linux-arm64` | `0.34.5` | optionalDependencies |
| `@img/sharp-linux-x64` | `0.34.5` | optionalDependencies |

### [INV-DEP] @craft-agent/cli — [apps/cli/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cli/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/server-core` | `workspace:*` | dependencies |
| `@craft-agent/shared` | `workspace:*` | dependencies |
| `@types/bun` | `latest` | devDependencies |
| `@types/node` | `^22.0.0` | devDependencies |
| `typescript` | `^5.8.2` | devDependencies |

### [INV-DEP] @craft-agent/cloud-gateway — [apps/cloud-gateway/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/cloud-gateway/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@cloudflare/computer` | `0.1.0-alpha.1` | dependencies |
| `@cloudflare/workers-types` | `^4.20260702.1` | devDependencies |
| `typescript` | `^5.9.0` | devDependencies |
| `wrangler` | `^4.115.0` | devDependencies |

### [INV-DEP] @craft-agent/electron — [apps/electron/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/electron/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/core` | `workspace:*` | dependencies |
| `@craft-agent/messaging-gateway` | `workspace:*` | dependencies |
| `@craft-agent/server-core` | `workspace:*` | dependencies |
| `@craft-agent/shared` | `workspace:*` | dependencies |
| `@craft-agent/ui` | `workspace:*` | dependencies |
| `@dnd-kit/core` | `^6.3.1` | dependencies |
| `@dnd-kit/sortable` | `^10.0.0` | dependencies |
| `@dnd-kit/utilities` | `^3.2.2` | dependencies |
| `@paper-design/shaders-react` | `^0.0.69` | dependencies |
| `@pierre/diffs` | `^1.0.4` | dependencies |
| `@radix-ui/react-context-menu` | `^2.2.16` | dependencies |
| `@radix-ui/react-dialog` | `^1.1.15` | dependencies |
| `@radix-ui/react-dropdown-menu` | `^2.1.16` | dependencies |
| `@radix-ui/react-label` | `^2.1.8` | dependencies |
| `@radix-ui/react-popover` | `^1.1.15` | dependencies |
| `@radix-ui/react-switch` | `^1.2.6` | dependencies |
| `@tanstack/react-table` | `^8.21.3` | dependencies |
| `@xyflow/react` | `^12.11.3` | dependencies |
| `buffer` | `^6.0.3` | dependencies |
| `chrono-node` | `^2.9.0` | dependencies |
| `cmdk` | `^1.1.1` | dependencies |
| `electron-log` | `^5.4.3` | dependencies |
| `electron-updater` | `^6.8.0` | dependencies |
| `i18next-browser-languagedetector` | `^8.2.1` | dependencies |
| `jotai-family` | `^1.0.1` | dependencies |
| `motion` | `^12.23.26` | dependencies |
| `next-themes` | `^0.4.6` | dependencies |
| `process` | `^0.11.10` | dependencies |
| `qrcode.react` | `^4.2.0` | dependencies |
| `react` | `^18.3.1` | dependencies |
| `react-colorful` | `^5.7.0` | dependencies |
| `react-day-picker` | `^9.13.0` | dependencies |
| `react-dom` | `^18.3.1` | dependencies |
| `react-i18next` | `^17.0.2` | dependencies |
| `react-pdf` | `^10.3.0` | dependencies |
| `react-simple-code-editor` | `^0.14.1` | dependencies |
| `remark` | `^15.0.1` | dependencies |
| `sharp` | `0.35.0` | dependencies |
| `sonner` | `^2.0.7` | dependencies |
| `strip-markdown` | `^6.0.0` | dependencies |
| `undici` | `^7.22.0` | dependencies |
| `unist-util-visit` | `^5.0.0` | dependencies |
| `vaul` | `^1.1.2` | dependencies |
| `ws` | `^8.19.0` | dependencies |
| `@types/ws` | `^8.18.1` | devDependencies |

### [INV-DEP] @craft-agent/viewer — [apps/viewer/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/viewer/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/core` | `workspace:*` | dependencies |
| `@craft-agent/ui` | `workspace:*` | dependencies |
| `react` | `^18.3.1` | dependencies |
| `react-dom` | `^18.3.1` | dependencies |
| `react-i18next` | `^17.0.2` | dependencies |
| `@tailwindcss/typography` | `^0.5.16` | devDependencies |
| `@tailwindcss/vite` | `^4.0.0` | devDependencies |
| `@vitejs/plugin-react` | `^4.4.1` | devDependencies |
| `class-variance-authority` | `^0.7.1` | devDependencies |
| `clsx` | `^2.1.1` | devDependencies |
| `lucide-react` | `^0.501.0` | devDependencies |
| `motion` | `^12.0.0` | devDependencies |
| `react-markdown` | `^9.0.3` | devDependencies |
| `rehype-raw` | `^7.0.0` | devDependencies |
| `remark-gfm` | `^4.0.1` | devDependencies |
| `shiki` | `^3.0.0` | devDependencies |
| `tailwind-merge` | `^2.6.0` | devDependencies |
| `tailwindcss` | `^4.0.0` | devDependencies |
| `typescript` | `^5.7.3` | devDependencies |
| `vite` | `^6.2.5` | devDependencies |

### [INV-DEP] @craft-agent/webui — [apps/webui/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/apps/webui/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/core` | `workspace:*` | dependencies |
| `@craft-agent/shared` | `workspace:*` | dependencies |
| `@craft-agent/ui` | `workspace:*` | dependencies |
| `i18next` | `^26.0.3` | dependencies |
| `i18next-browser-languagedetector` | `^8.2.1` | dependencies |
| `jotai` | `^2.16.0` | dependencies |
| `react` | `^18.3.1` | dependencies |
| `react-dom` | `^18.3.1` | dependencies |
| `react-i18next` | `^17.0.2` | dependencies |
| `sonner` | `^2.0.7` | dependencies |

### [INV-DEP] @craft-agent/cloud-runner — [packages/cloud-runner/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/cloud-runner/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| None declared | — | Contracts/source package |

### [INV-DEP] @craft-agent/core — [packages/core/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/core/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@types/uuid` | `^11.0.0` | devDependencies |
| `@anthropic-ai/claude-agent-sdk` | `0.3.258` | peerDependencies |
| `@modelcontextprotocol/sdk` | `>=1.29.0` | peerDependencies |

### [INV-DEP] @craft-agent/messaging-discord-worker — [packages/messaging-discord-worker/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-discord-worker/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `discord.js` | `^14.16.0` | dependencies |
| `@types/node` | `^22.0.0` | devDependencies |
| `typescript` | `^5.8.2` | devDependencies |

### [INV-DEP] @craft-agent/messaging-gateway — [packages/messaging-gateway/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-gateway/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/core` | `workspace:*` | dependencies |
| `@craft-agent/messaging-discord-worker` | `workspace:*` | dependencies |
| `@craft-agent/messaging-whatsapp-worker` | `workspace:*` | dependencies |
| `@craft-agent/server-core` | `workspace:*` | dependencies |
| `@craft-agent/shared` | `workspace:*` | dependencies |
| `@larksuiteoapi/node-sdk` | `^1.62.1` | dependencies |
| `grammy` | `^1.35.0` | dependencies |
| `qrcode-terminal` | `0.12.0` | dependencies |
| `@types/node` | `^22.0.0` | devDependencies |
| `typescript` | `^5.8.2` | devDependencies |

### [INV-DEP] @craft-agent/messaging-whatsapp-worker — [packages/messaging-whatsapp-worker/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/messaging-whatsapp-worker/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@whiskeysockets/baileys` | `^6.7.0` | dependencies |
| `@types/node` | `^22.0.0` | devDependencies |
| `typescript` | `^5.8.2` | devDependencies |

### [INV-DEP] @craft-agent/pi-agent-server — [packages/pi-agent-server/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/pi-agent-server/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/core` | `workspace:*` | dependencies |
| `@craft-agent/session-tools-core` | `workspace:*` | dependencies |
| `@earendil-works/pi-agent-core` | `0.85.1` | dependencies |
| `@earendil-works/pi-ai` | `0.85.1` | dependencies |
| `@earendil-works/pi-coding-agent` | `0.85.1` | dependencies |
| `duck-duck-scrape` | `^2.2.7` | dependencies |
| `node-html-parser` | `^6.1.0` | dependencies |
| `pdfjs-dist` | `^5.4.0` | dependencies |
| `turndown` | `^7.2.0` | dependencies |
| `@types/node` | `^22.0.0` | devDependencies |

### [INV-DEP] @craft-agent/server-core — [packages/server-core/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server-core/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/cloud-runner` | `workspace:*` | dependencies |
| `@craft-agent/core` | `workspace:*` | dependencies |
| `@craft-agent/session-tools-core` | `workspace:*` | dependencies |
| `@craft-agent/shared` | `workspace:*` | dependencies |
| `@earendil-works/pi-ai` | `0.85.1` | dependencies |
| `@tursodatabase/database` | `0.7.2` | dependencies |
| `@xenova/transformers` | `2.17.2` | dependencies |
| `gray-matter` | `^4.0.3` | dependencies |
| `jose` | `^6.0.0` | dependencies |
| `js-yaml` | `^4.1.1` | dependencies |
| `sharp` | `0.35.0` | dependencies |
| `ws` | `^8.19.0` | dependencies |
| `typescript` | `^5.8.2` | devDependencies |

### [INV-DEP] @craft-agent/server — [packages/server/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/server/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/core` | `workspace:*` | dependencies |
| `@craft-agent/messaging-gateway` | `workspace:*` | dependencies |
| `@craft-agent/server-core` | `workspace:*` | dependencies |
| `@craft-agent/shared` | `workspace:*` | dependencies |
| `@types/node` | `^22.0.0` | devDependencies |
| `typescript` | `^5.8.2` | devDependencies |
| `ws` | `^8.16.0` | devDependencies |

### [INV-DEP] @craft-agent/session-mcp-server — [packages/session-mcp-server/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/session-mcp-server/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/session-tools-core` | `workspace:*` | dependencies |
| `@craft-agent/shared` | `workspace:*` | dependencies |
| `@modelcontextprotocol/sdk` | `^1.29.0` | dependencies |
| `zod` | `^4.0.0` | dependencies |
| `@types/node` | `^22.0.0` | devDependencies |

### [INV-DEP] @craft-agent/session-tools-core — [packages/session-tools-core/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/session-tools-core/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/core` | `workspace:*` | dependencies |
| `beautiful-mermaid` | `*` | dependencies |
| `gray-matter` | `^4.0.3` | dependencies |
| `zod` | `^3.23.0` | dependencies |
| `zod-to-json-schema` | `^3.25.0` | dependencies |
| `typescript` | `^5.8.2` | devDependencies |

### [INV-DEP] @craft-agent/shared — [packages/shared/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/shared/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/core` | `workspace:*` | dependencies |
| `@craft-agent/session-tools-core` | `workspace:*` | dependencies |
| `@earendil-works/pi-agent-core` | `0.85.1` | dependencies |
| `@earendil-works/pi-ai` | `0.85.1` | dependencies |
| `@earendil-works/pi-coding-agent` | `0.85.1` | dependencies |
| `@isaacs/ttlcache` | `^2.1.4` | dependencies |
| `@leeoniya/ufuzzy` | `^1.0.19` | dependencies |
| `bash-parser` | `^0.5.0` | dependencies |
| `croner` | `^10.0.1` | dependencies |
| `date-fns` | `^4.1.0` | dependencies |
| `filtrex` | `^3.1.0` | dependencies |
| `glob` | `^13.0.0` | dependencies |
| `i18next` | `^26.0.3` | dependencies |
| `incr-regex-package` | `^1.0.4` | dependencies |
| `shell-quote` | `^1.8.3` | dependencies |
| `yaml` | `^2.8.2` | dependencies |
| `@types/shell-quote` | `^1.7.5` | devDependencies |
| `@types/uuid` | `^11.0.0` | devDependencies |
| `@anthropic-ai/claude-agent-sdk` | `0.3.258` | peerDependencies |
| `@modelcontextprotocol/sdk` | `>=1.29.0` | peerDependencies |
| `zod` | `>=4.0.0` | peerDependencies |

### [INV-DEP] @craft-agent/ui — [packages/ui/package.json](https://github.com/rox-one/rox-one/blob/f63294ba4fffa7238b46b24e918925a313ad0b12/packages/ui/package.json#L1)

| Dependency | Declared constraint | Role |
| --- | --- | --- |
| `@craft-agent/core` | `workspace:*` | dependencies |
| `@craft-agent/shared` | `workspace:*` | dependencies |
| `@paper-design/shaders-react` | `^0.0.69` | dependencies |
| `@types/mdast` | `^4.0.0` | dependencies |
| `@uiw/react-json-view` | `^2.0.0-alpha.40` | dependencies |
| `beautiful-mermaid` | `*` | dependencies |
| `fflate` | `^0.8.2` | dependencies |
| `nice-ticks` | `^1.0.2` | dependencies |
| `unified` | `^11.0.0` | dependencies |
| `unist-util-visit` | `^5.0.0` | dependencies |
| `@pierre/diffs` | `>=0.1.0` | peerDependencies |
| `@radix-ui/react-context-menu` | `>=2.0.0` | peerDependencies |
| `@radix-ui/react-dialog` | `>=1.0.0` | peerDependencies |
| `@radix-ui/react-dropdown-menu` | `>=2.0.0` | peerDependencies |
| `@tailwindcss/typography` | `>=0.5.0` | peerDependencies |
| `class-variance-authority` | `>=0.7.0` | peerDependencies |
| `clsx` | `>=2.0.0` | peerDependencies |
| `i18next` | `>=26.0.0` | peerDependencies |
| `jotai` | `>=2.0.0` | peerDependencies |
| `katex` | `>=0.16.0` | peerDependencies |
| `lucide-react` | `>=0.400.0` | peerDependencies |
| `motion` | `>=11.0.0` | peerDependencies |
| `react` | `>=18.0.0` | peerDependencies |
| `react-dom` | `>=18.0.0` | peerDependencies |
| `react-i18next` | `>=17.0.0` | peerDependencies |
| `react-markdown` | `>=9.0.0` | peerDependencies |
| `react-pdf` | `>=10.0.0` | peerDependencies |
| `rehype-katex` | `>=7.0.0` | peerDependencies |
| `rehype-raw` | `>=7.0.0` | peerDependencies |
| `remark-gfm` | `>=4.0.0` | peerDependencies |
| `remark-math` | `>=6.0.0` | peerDependencies |
| `shiki` | `^3.21.0` | peerDependencies |
| `tailwind-merge` | `>=2.0.0` | peerDependencies |
| `tailwindcss` | `>=4.0.0` | peerDependencies |
| `vaul` | `>=1.0.0` | peerDependencies |

## [INV-EXPORTS] Referenced external or missing exports

- `vendor/rox-one-assets` and `vendor/rox-one-website` are pinned Git submodules and were not initialized. Their contents are outside the inspected source tree. See `.gitmodules` and architecture document.
- `apps/docs-site`, `apps/marketing`, and `workers/pages` are absent in the audited tracked tree even though root scripts or Docker references exist. Missing paths are completion work, not a claim that a hidden external service was inspected.
- An inventory row is a discovery record; the surface/runtime/platform documents provide task mapping and acceptance checks. Private external provider implementations and deployed infrastructure were not audited from this repository.
