# Notes + managed kernel — still blocked

## Status addendum — 2026-08-20

- **As of:** 2026-08-20
- **Product implementation for Notes / SiYuan managed kernel:** **still blocked.** Do not start P7 managed (no SiYuan binary, vendor, download, or spawn). Do not treat any other landed work as an unblock.
- **This note:** documentation-only fact update. No product code in this session.

### Current facts (do not invent numbers; do not accept G2)

| Gate / slice | Status as of 2026-08-20 | Unblock? |
| --- | --- | --- |
| **G1** | Instrumentation **landed** (`knowledge:metricsGet`, `{workspaceRoot}/knowledge/metrics.json`, Settings → Knowledge → Usage). All **numeric thresholds remain TBD** (`docs/specs/2026-08-07-siyuan-integration/g1-metrics.md` §4). | **No.** Counters without accepted thresholds do not close G1. |
| **G2** | **OPEN** — blocked on legal/commercial decision (`docs/specs/2026-08-07-siyuan-integration/g2-decision-record.md`). Production remains **A (external-local)** only. | **No.** This note does **not** accept G2. |
| **P1–P6** | Knowledge RPC namespace exists in `packages/shared/src/protocol/channels.ts` (`knowledge:*` for read, mutation proposals, publication, views/envelopes, watch). | Necessary for G1 data, **not** sufficient for P7. |
| **P7 managed** | **Blocked** until G1 thresholds are filled **and accepted** **and** G2 is `ACCEPTED` with variant **B or C** (or an explicit permanent stay on A, which still does not ship managed). | **Blocked.** |
| **CF-2 credential migration UI** | **Landed separately** (Settings → Accounts & Connections → Account & Security, `CredentialMigrationCard`; CF-2 core + secret-free credentials RPC). | **Not a knowledge unblock.** Connection-fabric credential migration is orthogonal to G1/G2/P7. |

### Exact missing owner facts

Named owners are **not** recorded as specific people in the suite. The following **facts still have no owner decision on file**. Until they exist, implementation of managed kernel remains blocked.

**G1 (product / metrics acceptance) — missing:**

1. **Named product owner** who will fill and accept the G1 threshold table (roadmap K-11 open question: “зафиксировать владельцем продукта”; decision artifacts: `g1-metrics.md` + `00-overview.md` — no named individual).
2. **Numeric threshold** for active installs with ≥1 connection.
3. **Numeric threshold** for publications / week (aggregate).
4. **Numeric threshold** for automation proposals / week.
5. **Numeric threshold** for knowledge surface opens / week.
6. **Numeric threshold** for view runs / week.
7. **Window length N** (weeks of production data required before the table can be judged) — still unspecified; do not invent N.
8. **Written acceptance** that observed production metrics meet those numbers (G1 is instrumentation-only until then).

**G2 (legal / commercial) — missing:**

1. **Named legal/commercial owner** of the G2 record (status is OPEN; no signer).
2. **Written decision** choosing variant **B** or **C**, or an **explicit permanent stay on A** (stay-on-A is not managed).
3. If **C**: **signed OEM/commercial terms** covering versions/platforms needed for managed (rightsholder Yunnan Liandi / siyuan-note).
4. If **B**: **source-offer + NOTICE process** and channel compatibility (K-08 §3.7).
5. **ADR / `g2-decision-record.md` flip** to `Status: ACCEPTED` with the chosen variant (must not be flipped in this note).
6. Answers to **K-08 §6 lawyer questions 1–10** (HTTP “at arm’s length”, bundling vs combined work, AGPL §13, OEM cost/terms, trademark, §6/stores, API-docs clean-room, public-fork obligations, kernel patches, whether a formal opinion is required before P2 public release).

**P7 / ROX Notes (still gated, not missing RPC):**

1. Security-review **acceptance** of the local-only Imports seam (`docs/superpowers/plans/2026-08-10-rox-notes-root-imports-plan.md` remains “planning complete; do not implement yet”).
2. Release/legal sign-off that G1+G2 are closed **before** any managed spawn/process manager/installer bundling.

**Explicit non-owners / non-unblocks:** CF-2 UI landing, CF-1 codec/registry, and P1–P6 knowledge RPC **do not** substitute for the facts above.

---

- **Date (original):** 2026-08-13
- **Implementation that session:** **zero**

## Gates that remain closed

1. **G2 licensing OPEN** — `docs/specs/2026-08-07-siyuan-integration/g2-decision-record.md`. No SiYuan source/binary in the monorepo or installer. `mode: managed` fail-closed until ACCEPTED variant B or C (or explicit permanent stay on A).
2. **G1 thresholds TBD** — `docs/specs/2026-08-07-siyuan-integration/g1-metrics.md` §4. Instrumentation exists; **all numeric rows TBD**. P7 managed blocked until filled **and** G2 accepted.
3. **ROX Notes plan** — `docs/superpowers/plans/2026-08-10-rox-notes-root-imports-plan.md`: *Planning complete. Do not implement yet.* Needs security-review acceptance of the local-only Imports seam plus legal/release on G1/G2.

CF-0 remains documentation-only. CF-1 codec/registry already exists and was re-verified (see program B). **CF-2 credential migration UI has landed separately (2026-08-19 design; UI present in Settings) and is not a knowledge unblock.** P7 managed remains blocked on G1+G2 as above.
