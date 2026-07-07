---
phase: 39
slug: cost-realism
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-06
updated: 2026-07-07
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (855 tests green at Phase 38 close → 1017 at Phase 39 validation close) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <changed-test-files>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <affected test files>`
- **After every plan wave:** Run `npx vitest run` (full suite) + `npx tsc -b`
- **Before `/gsd:verify-work`:** Full suite must be green, `tsc -b` clean, `npm run build` green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-01/T1 | 39-01 | 1 | FAIL-01, WEAR-01 | T-39-01, T-39-03 | v12 stores + guarded writes + backup inclusion | integration | `npx vitest run src/utils/backupSchema.test.ts src/db/database.migrations.test.ts` | ✅ | ✅ green |
| 39-01/T2 | 39-01 | 1 | FAIL-01, WEAR-01, TOU-02 | T-39-01, T-39-02 | event CRUD hooks + TOU pure math (no NaN) | unit + hook | `npx vitest run src/hooks/useFailureEvents.test.tsx src/hooks/useMaintenanceEvents.test.tsx src/utils/touElectricity.test.ts` | ✅ | ✅ green |
| 39-02/T1 | 39-02 | 2 | FAIL-02, FAIL-03 | T-39-04 | empirical rate derivation (pure fn + hook) | unit + hook | `npx vitest run src/db/failureRate.test.ts src/hooks/useFailureRate.test.tsx` | ✅ | ✅ green |
| 39-02/T2 | 39-02 | 2 | FAIL-01 | T-39-04, T-39-06 | LogFailureModal clamp/enum + transactional per-material stock deduction | component | `npx vitest run src/components/LogFailureModal.test.tsx src/components/JobsManager.test.tsx` | ✅ | ✅ green |
| 39-02/T3 | 39-02 | 2 | FAIL-04 | T-39-05 | Failures ledger renders notes as plain text | component | `npx vitest run src/components/ReportsSection.test.tsx` | ✅ | ✅ green |
| 39-03/T1 | 39-03 | 2 | TOU-01 | T-39-07, T-39-09 | tariff editor validation (finite, overlap-reject, max-3) | hook + component | `npx vitest run src/hooks/useTouTariff.test.tsx src/components/SettingsModal.test.tsx` | ✅ | ✅ green |
| 39-03/T2 | 39-03 | 2 | TOU-02 | T-39-08 | legacy reconcile: idempotent, never fabricates rates | unit | `npx vitest run src/db/backfill.test.ts` | ✅ | ✅ green |
| 39-04/T1 | 39-04 | 2 | WEAR-01, WEAR-02 | T-39-11, T-39-12 | abrasive matchers + amortization/prediction (null-guarded) | unit | `npx vitest run src/utils/abrasive.test.ts src/db/maintenanceAmortization.test.ts src/hooks/useMaintenanceAmortization.test.tsx` | ✅ | ✅ green |
| 39-04/T2 | 39-04 | 2 | WEAR-01 | T-39-10 | LogMaintenanceModal guards + per-printer drill-in | component | `npx vitest run src/components/LogMaintenanceModal.test.tsx src/components/PrinterSettings.test.tsx` | ✅ | ✅ green |
| 39-05/T1 | 39-05 | 3 | FAIL-03, TOU-02, WEAR-02 | T-39-13, T-39-15 | costCalc TOU/maintenance/abrasive paths, defaults byte-identical | unit | `npx vitest run src/utils/costCalc.test.ts` | ✅ | ✅ green |
| 39-05/T2 | 39-05 | 3 | FAIL-02, FAIL-03 | T-39-13, T-39-15 | Apply-gated hints, clamped Apply values | component | `npx vitest run src/components/calculator/CostParametersSection.test.tsx` | ✅ | ✅ green |
| 39-05/T3 | 39-05 | 3 | all (regression oracle) | T-39-14 | output-equivalence baseline append-only + render/sequence tripwires | snapshot + integration | `npx vitest run src/components/calculator/` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Extend `goldenScenarios.ts` fixtures so the output-equivalence oracle covers new `CalcInput` fields — 3 scenarios appended (`phase39-tou-active`, `phase39-cf-brass`, `phase39-empirical-applied`) in dedicated commit `bcde91f`
- [x] Test stubs for new Dexie stores (`failureEvents`, `maintenanceEvents`) at `db.version(12)` including migration test — store CRUD via hook tests; explicit v11→v12 upgrade-path test added 2026-07-07 in `src/db/database.migrations.test.ts` (real Dexie via fake-indexeddb: pre-existing rows intact, new stores usable via indexed queries)
- [x] Backup/restore round-trip test extension for the two new stores in `backupSchema.ts` — `src/utils/backupSchema.test.ts` + legacy pre-Phase-39 backup compatibility suite in `src/utils/backupRestore.test.ts` (CR-01 regression)

*Existing vitest infrastructure covers the framework; no new tooling install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One-tap failure logging feels one-tap from a job row | FAIL-01 | UX judgment | Open Jobs tab, log a failure from a job, count interactions |
| Empirical failure-rate suggestion renders beside manual input without layout shift | FAIL-03 | Visual | Open calculator with ≥1 failure logged, inspect suggestion chip |
| TOU tariff window editor usability in Settings | TOU-01 | UX judgment | Define peak/off-peak windows, verify overlap handling messaging (inline error on overlapping bands) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s (full suite ~12s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-07 (post-execution audit)

---

## Validation Audit 2026-07-07

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

Gap: no explicit Dexie v11→v12 upgrade-path test (FAIL-01 migration clause). Resolved by appending a real-Dexie integration describe block to `src/db/database.migrations.test.ts` — seeds v11 data (jobs/materials/settings), reopens at v12, asserts data intact + both new stores usable via their real index strings. Suite: 1016 → 1017 passed, `tsc -b` clean. All 8 requirement IDs (FAIL-01..04, TOU-01..02, WEAR-01..02) now have green automated coverage; 3 UX-judgment items remain manual-only by design.
