# Account surface, catalog UI, honest remaining gates

Status: implementing after owner “делай всё и сразу”.
Tree: `/private/tmp/craft-account-surface` · `feat/account-surface-and-catalog-ui`

## What this is

First settings tab is a personal page. Sidebar and account click show the real identity name. Extensions/Marketplace share one card language. Knowledge/import/external-access only grow already-legal increments.

## Honest data

| Field | Source | Missing |
|---|---|---|
| Name | `identity.profile.displayName` (OS username default) | never invent “User” if identity has a name |
| Avatar | `identity.profile.avatar` data URL | bundled default |
| Email | optional `identity.profile.email` | em dash; not a registration system |
| Plan | local `identity.profile.plan`: standard / pro / team / max | default `standard`; no payment |
| Level / XP | `gamification.json` table 1–20 | events listed below |
| Balance | `gamification.balance` | em dash when `null` (no billing API) |

XP events: `session_completed` +25, `automation_ran` +15, `cloud_run_imported` +40, `note_linked` +10.

## Not in this change

- Billing, dollars, paid checkout
- Managed SiYuan / G2 / numeric G1 close
- RoxImportGateway Tasks 1–16
- External-access C–F (share, microVM, device store)

## Surfaces

1. New settings page `account` is first in `SETTINGS_PAGES`.
2. Click ProfileStrip or AccountMenu “edit profile” → `settings/account`.
3. Connections stay on `settings/accounts`.
4. Desktop bare `settings` fallback is `account`, not `app`.
5. Extensions and Marketplace cards use `SettingsCard` / `SettingsRow` / the same chip + tab styles.

## Security

- Avatar: user-picked file only (`openFileDialog` + `readUserAttachment`). Store a PNG thumbnail data URL. Reject SVG and anything over ~400k chars. Validate in `IdentityStore.updateProfile`.
- Email: optional, max 254, simple address check, no verification mail.
- TLS Increment A: inspect peer before token-bearing `testRemoteConnection` on `wss`/`https` (skip SSH). Persist `tlsTrust` on the workspace. Reject/rollover uses existing `remoteTls:decide`.

## Tests

Registry first-id `account`; identity persist/reject; account page source contracts; ProfileStrip uses identity; extensions cards use SettingsCard; remote TLS inspect-before-test on wss.
