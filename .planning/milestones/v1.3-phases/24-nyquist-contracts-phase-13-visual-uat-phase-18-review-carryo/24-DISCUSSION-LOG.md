# Phase 24: Nyquist contracts + Phase 13 visual UAT + Phase 18 review carryover - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryover
**Areas discussed:** WR-02 dedupe strategy, Validate-phase plan parallelism, Phase 13 visual UAT rigor, NYQ-04 scope

---

## WR-02 dedupe strategy

The 18-REVIEW.md WR-02 finding: after Phase 18 pinned `@tauri-apps/api` to 2.10.1, plugins `plugin-fs@2.5.1` and `plugin-dialog@2.7.1` both declare `@tauri-apps/api: ^2.11.0` as a dep, so npm installed 2.11.0 nested under each plugin. Two copies ship in the bundle today (top-level 2.10.1 + nested 2.11.0). Works in production (the plugins' Rust IPC contract is what matters), but wasteful and fragile.

### Q1: Which strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| (b) Bump Rust tauri to 2.11.x + re-pin @tauri-apps/api to ^2.11.0 | Treats 2.11.x as the new floor for both JS and Rust sides. Single canonical @tauri-apps/api copy in bundle. Triggers another Cargo.lock churn. Slight risk: 2.10→2.11 patch notes may include behavior changes — research will verify. | ✓ |
| (a) Bump plugin-fs + plugin-dialog to versions matching 2.10.x | Keeps Rust side at 2.10.2. Requires finding plugin versions whose deps line up — may not exist (plugins typically move forward). | |
| (c) Accept dual-copy, document + validate | Run npm dedupe, confirm collapse fails, document + CI guard. No code change. Cheapest, leaves waste in place. | |

**User's choice:** (b) — recommended option.
**Notes:** Single canonical version path. Cargo.lock churn is acceptable (Phase 18 surfaced this pattern; ~50-line diff was tolerable).

### Q2: Should the bump plan include a regression UAT (re-run Phase 18 UAT-A)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — re-run UAT-A as blocking checkpoint | Mirrors Phase 18 pattern. ~5 min, catches 2.11.x behavior surprises. | |
| No — trust test suite + `npm run tauri build` | Fully autonomous. Risk: 2.11.x runtime fs breakage missed by tests. | |
| Conditional — only if research surfaces fs/dialog/ACL behavior changes in 2.11.x changelog | Planner's research step reads 2.11 release notes; UAT added only if relevant. Adaptive. | (Claude's discretion) |

**User's choice:** "you decide" — explicit delegation to Claude.
**Notes:** Claude selected "Conditional." Rationale: Phase 18 UAT-D Result A showed manual Tauri UAT surfaces real bugs that tests miss, but running 5-min UAT on every dep bump is overkill. Gate manual UAT to actual risk signals via the changelog. Sets pattern for future Tauri dep bumps.

---

## Validate-phase plan parallelism

Each `/gsd:validate-phase X` is independent and touches its own phase directory.

| Option | Description | Selected |
|--------|-------------|----------|
| Wave 1: NYQ-01..04 in parallel | Wave 2: NYQ-05 | Wave 3: WR hygiene | Maximizes parallelism for 4 doc-audit plans (separate phase dirs). NYQ-05 second since it writes to 13-VERIFICATION.md which NYQ-01 may touch. WR hygiene last to keep human checkpoint at end. | ✓ |
| Single wave: everything parallel except NYQ-05 | NYQ-01..04 + WR hygiene all in wave 1; NYQ-05 in wave 2. Slightly faster but mixes doc audits with code changes — WR build failure would block doc-audit wave-completion gates. | |
| Serial — one plan at a time | Safest, slowest. Loses parallelism. | |

**User's choice:** 3-wave layout (recommended option).
**Notes:** Wave boundary enforces NYQ-01 finishing before NYQ-05 starts (both touch 13-VERIFICATION.md). WR hygiene last keeps the conditional manual UAT at the end of the phase, mirroring Phase 18's structure.

---

## Phase 13 visual UAT rigor

Phase 13 shipped 2026-05-21 — 4 days ago. 4+ phases (14, 15, 15.1, 16, 17) have stacked on top with zero bug reports. 13-VERIFICATION.md cites 8 deferred visual UAT items.

| Option | Description | Selected |
|--------|-------------|----------|
| Smoke-test 2 critical items + rubber-stamp the other 6 | Manually verify (1) Default Tax Rate field render+persist and (2) Per-job Tax Rate round-trip. Other 6 flip to passed with explicit in-prod evidence note. ~5 min UAT. | ✓ |
| Full re-test of all 8 items | Walk every item end-to-end. ~30 min. Mostly redundant with in-prod evidence unless drift suspected. | |
| Pure rubber-stamp with note | Flip status to passed, one-line note. No manual checks. Cheapest, risk of regression hiding in low-traffic UI surfaces. | |

**User's choice:** Smoke-test 2 + rubber-stamp 6 (recommended option).
**Notes:** The two smoke-tested items both exercise real IndexedDB persistence — the only items where a silent regression could realistically hide in surfaces low-traffic enough to escape in-prod use. Rubber-stamp note must enumerate the 5 stacked phases and the date range.

---

## NYQ-04 scope (Phase 17 validation)

ROADMAP language: NYQ-04 is "likely trivially satisfied by existing 8-gate build chain + `scripts/assert-no-static-pdf-import.mjs`."

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone plan parallel with NYQ-01..03 | Treat NYQ-04 same as NYQ-01/02/03. Even if audit finds nothing, VALIDATION.md is a permanent artifact citing the inherited global guards. Symmetric across 4 phases. | ✓ |
| Fold into NYQ-01..03 plan as appendix | Drop NYQ-04 from parallel wave; one other plan tacks on "Phase 17 trivially satisfied" appendix. Fewer plans (~5 instead of ~6) but mixes scope. | |
| Skip the plan, write a one-paragraph VALIDATION.md directly | No /gsd:validate-phase invocation; hand-author a 5-line VALIDATION.md. Fastest. Skips audit signal /gsd:validate-phase might surface. | |

**User's choice:** Standalone parallel plan (recommended option).
**Notes:** Symmetric structure across 4 NYQ phases. Even a trivial VALIDATION.md is a permanent artifact worth having on its own commit.

---

## Claude's Discretion

- **WR-02 regression UAT trigger condition** — user said "you decide" on whether to make UAT mandatory, optional, or conditional. Claude chose conditional (gated on changelog research findings). Recorded as D-06 in CONTEXT.md.
- **Phase 13 UAT note exact wording** — recommended template provided; executor has flexibility within the constraint that it enumerates 5 stacked phases + date range and cites Phase 24 NYQ-05 as formal close.
- **WR plan task order within the bundled plan** — executor decides whether to ship WR-01/03 (small TS edits) before or after WR-02 (large dep bump). Recommended order: WR-01 + WR-03 first (fast feedback), then WR-02 (high-churn).

## Deferred Ideas

- **WR-02 strategy (a)** — bump plugins to 2.10.x-compatible versions. Rejected (plugins move forward, not back). Not re-considered unless (b) blocks.
- **WR-02 strategy (c)** — accept dual-copy with npm dedupe + docs. Rejected as wasteful; reserved as documented escape hatch only if (b) fails per CONTEXT.md `<specifics>` fallback note.
- **POL-03 (jspdf module augmentation)** — adjacent to WR-03 (same file) but explicitly Phase 25 scope per REQUIREMENTS.md. Don't fold into Phase 24.
- **POL-04 (overflow menu outside-click handler)** — Phase 25, not 24.
- **Splitting bundled WR plan into 3 separate plans** — user chose "Apply as shown" (bundled) during the ROADMAP edit. Not revisited.
- **Full re-test of all 8 Phase 13 UAT items** — rejected in favor of smoke-test-2 + rubber-stamp-6. Available as escape hatch if smoke tests surface anything unexpected.
- **Standalone "Tauri dep bump" phase** — considered briefly during ROADMAP edit (would let WR-02 live alone). Folded into Phase 24 because bump is small and bundling keeps Phase 18 review carryover atomic.
