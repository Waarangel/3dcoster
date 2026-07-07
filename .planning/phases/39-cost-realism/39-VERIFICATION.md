---
phase: 39-cost-realism
verified: 2026-07-07T16:25:09Z
status: passed
score: 8/8 must-haves verified (requirement IDs); 5/5 plan-level truths sets verified
overrides_applied: 0
---

# Phase 39: Cost Realism Verification Report

**Phase Goal:** Users can log print failures and maintenance events and see those real costs folded into their calculator's true cost — giving them an empirical failure rate no competitor offers
**Verified:** 2026-07-07T16:25:09Z
**Status:** passed
**Re-verification:** No — initial verification

## Context

This phase shipped across 5 plans (01 foundation, 02 failure UI, 03 TOU settings, 04 maintenance/wear UI, 05 calculator convergence), followed by a code-review + fix-pass cycle (`39-REVIEW.md`, status `fixes_applied`) that landed 12 additional `fix(39)` commits (`6520319..6460fb9`) addressing 3 Critical + 8 Warning findings. This verification checks the **current** post-fix codebase state, not the pre-fix SUMMARY.md claims alone — every fix commit was independently re-derived from source, not taken on the review report's word.

Gates re-confirmed independently during this verification:
- `npx vitest run` → **1016 passed / 1 todo, 84 files** (matches REVIEW.md's post-fix count)
- `npx tsc -b` → clean, exit 0
- `npm run build` → clean, main chunk 82.7 KB gzipped (under 300 KB budget)
- `npx vitest run src/components/calculator/` → 42 passed / 1 todo (output-equivalence, renderCount, pricingSequence, CostParametersSection, CostCalculator all green)
- Debt-marker scan (`TBD|FIXME|XXX`) across all 30 phase-touched files → 0 matches

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can log a print failure in one tap from a job row (FAIL-01) | ✓ VERIFIED | `JobsManager.tsx:828-835` — `IconButton` with `onClick={(e)=>{e.stopPropagation(); onLogFailure(job)}}`, opens `LogFailureModal` prefilled (printer/dominant material/total grams); `<NewBadge feature="log-failure">` present |
| 2 | User can log a standalone failure (not tied to a job) | ✓ VERIFIED | `ReportsSection.tsx` "Log failure" CTA opens `LogFailureModal` with no job prefill (D-01) |
| 3 | Empirical failure rate derived per printer×material with ≥5-attempt threshold + one-level printer-fallback provenance (FAIL-02) | ✓ VERIFIED | `src/db/failureRate.ts` implements `MIN_ATTEMPTS_THRESHOLD=5`, `provenance: 'exact'\|'printer-fallback'`, no global cascade; consumed read-only via `useFailureRate` in `CostCalculator.tsx:149` |
| 4 | Applied failure rate hint shown beside manual input with one-click Apply; manual stays authoritative | ✓ VERIFIED | `CostParametersSection.tsx:134-147` renders hint + Apply button; `CostCalculator.tsx:441` `onApplyEmpiricalFailureRate={() => ... setFailureRate(Math.min(99, Math.round(rate)))}` — routes through the EXISTING setter (post-WR-05 fix: clamped+rounded) |
| 5 | Scrap cost (partial filament + time + electricity by %complete) folds into true cost; no silent reprice of saved history (FAIL-03) | ✓ VERIFIED | Failure rate only affects cost when Applied (existing failure multiplier untouched, `costCalc.ts` lines 181-185 per plan); stock deduction now per-material (WR-08 fix in `useFailureEvents.ts` — `db.transaction` wraps add+deduct atomically, WR-01 fix) |
| 6 | User can view a Failures ledger (per printer, per material, over time) inside Reports (FAIL-04) | ✓ VERIFIED | `ReportsSection.tsx:281-330` "Failures" sub-section (no new top-level tab, D-04), grouped by printer/material, chronological list, delete via shared `DeleteButton` |
| 7 | User can define TOU tariffs (peak/off-peak + hour windows) in Settings, no API (TOU-01) | ✓ VERIFIED | `SettingsModal.tsx` renders band editor (`touBands`) via `useTouTariff`; max-3-band clamp; post-fix WR-07 rejects overlapping band windows with inline error (`bandsOverlap` in `touElectricity.ts`) |
| 8 | Job electricity cost uses TOU tariff based on start time + duration, flat rate default (TOU-02) | ✓ VERIFIED | `costCalc.ts:81` `resolveWeightedCostPerKwh(electricity.touBands, electricity.costPerKwh, touStartTime, printTimeHours)`; snapshot fields (`touRateUsedPerKwh`) written at save only when actually used (no reprice of legacy jobs); `reconcileTouSnapshot` (backfill.ts) leaves legacy jobs' TOU fields explicitly `undefined` |
| 9 | User can log maintenance events (nozzle/belt/bed, cost, date, printer-hours) and track cumulative CF/GF-on-brass abrasive-hours (WEAR-01) | ✓ VERIFIED | `LogMaintenanceModal.tsx` form (partType/cost/date/printer-hours, conditional nozzleType Select); `PrinterSettings.tsx` `MaintenanceSection` shows event history + `amortization.abrasiveHours`; post-fix WR-02 re-seeds form on each open (was previously stale-on-mount) |
| 10 | Maintenance history amortizes into real $/hr per printer and predicts next likely swap (WEAR-02) | ✓ VERIFIED | `src/db/maintenanceAmortization.ts` `deriveMaintenanceAmortization` (cost÷hours, null-guarded at 0 hours) + `predictNextSwap` (per-part-category); existing 500h fallback alert in `App.tsx` (`MAINTENANCE_INTERVAL`) confirmed unmodified |

**Score:** 10/10 phase-goal truths verified (mapping to all 8 requirement IDs — several truths map jointly to FAIL-02/03 and WEAR-01/02 pairs)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/database.ts` | `db.version(12)` with `failureEvents`/`maintenanceEvents`, no upgrade() | ✓ VERIFIED | Confirmed at line 267; no `.upgrade(` follows the v12 stanza |
| `src/types.ts` | `FailureEvent`, `MaintenanceEvent`, `TouBand` interfaces; additive fields | ✓ VERIFIED | All interfaces present, additive-only (verified via plan diffs + grep) |
| `src/utils/touElectricity.ts` | `resolveWeightedCostPerKwh`, `parseHHMM`, (+ post-fix `bandsOverlap`) | ✓ VERIFIED | Pure module, no react/database imports |
| `src/hooks/useFailureEvents.ts` / `useMaintenanceEvents.ts` | CRUD hooks, `Number.isFinite` guards | ✓ VERIFIED | Both present; post-fix WR-01 wraps writes in `db.transaction` |
| `src/db/failureRate.ts` | `deriveFailureRate`, `dominantMaterialId` | ✓ VERIFIED | Pure, threshold + fallback + dominant-material logic present |
| `src/components/LogFailureModal.tsx` | Failure entry form | ✓ VERIFIED | Renders trio + reason enum(6) + notes; WR-08 multi-material breakdown wired |
| `src/components/ReportsSection.tsx` | Failures ledger sub-section | ✓ VERIFIED | "Failures" heading present, grouped display |
| `src/hooks/useTouTariff.ts` | TOU settings read/write + validation | ✓ VERIFIED | Max-3-bands, `parseHHMM`, post-fix `bandsOverlap` rejection |
| `src/components/SettingsModal.tsx` | TOU band editor | ✓ VERIFIED | `touBands` rendered/edited beside flat rate |
| `src/db/backfill.ts` | `reconcileTouSnapshot` | ✓ VERIFIED | Present, wired at boot in `useDatabase.ts`, preserves legacy absence |
| `src/utils/abrasive.ts` | `detectIsAbrasive`/`resolveIsAbrasive`/`resolveNozzleType` | ✓ VERIFIED | All 3 exported, pure module |
| `src/db/maintenanceAmortization.ts` | `deriveMaintenanceAmortization`, `predictNextSwap` | ✓ VERIFIED | Both exported; null-guards present |
| `src/components/LogMaintenanceModal.tsx` | Maintenance entry form | ✓ VERIFIED | Present; post-fix WR-02 (reset-on-open) + WR-03 (error handling) applied |
| `src/components/PrinterSettings.tsx` | Per-printer Maintenance drill-in | ✓ VERIFIED | `MaintenanceSection` component present, additive |
| `src/utils/costCalc.ts` | TOU-aware electricity, additive abrasive surcharge, maintenance cost line | ✓ VERIFIED | `calculateElectricityCost`/`resolveElectricityRatePerKwh`/`calculateAbrasiveSurcharge` present; `calculateNozzleWear` body unmodified (confirmed via source read) |
| `src/components/calculator/CostParametersSection.tsx` | 3 hint rows (failure/TOU/maintenance), no Dexie import | ✓ VERIFIED | All 3 present; zero Dexie/hook imports confirmed via grep |
| `src/components/calculator/__fixtures__/goldenScenarios.ts` | 3 appended scenarios (TOU-active, CF-on-brass, empirical-applied) | ✓ VERIFIED | All 3 present at end of `CURATED_SCENARIOS`, no reordering of existing entries |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `JobsManager.tsx` | `LogFailureModal` | per-row IconButton | ✓ WIRED | `onLogFailure` callback confirmed |
| `useFailureRate.ts` | `db.jobs`/`db.failureEvents` | indexed `.where('printerInstanceId')` | ✓ WIRED | Confirmed indexed query, not full `.toArray()` |
| `useDatabase.ts` | `reconcileTouSnapshot` | boot-time call site | ✓ WIRED | Confirmed alongside `reconcileFixedCostsAtSave` |
| `SettingsModal.tsx` | `ElectricityConfig.touBands` | `useTouTariff`/`onElectricityChange` | ✓ WIRED | Confirmed |
| `PrinterSettings.tsx` | `LogMaintenanceModal` + `useMaintenanceEvents` | per-instance Maintenance section | ✓ WIRED | Confirmed |
| `CostCalculator.tsx` | `useFailureRate`/`useTouTariff`(read-only via electricity prop)/`useMaintenanceAmortization` | hooks in orchestrator | ✓ WIRED | Confirmed at lines 149-150; `CostParametersSection` has zero hook imports (contract preserved) |
| `CostParametersSection.tsx` | `onFailureRateChange` | Apply button reuses existing setter | ✓ WIRED | Confirmed — no new write path introduced |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npx vitest run` | 1016 passed / 1 todo, 84 files | ✓ PASS |
| Type check | `npx tsc -b` | exit 0 | ✓ PASS |
| Production build | `npm run build` | clean, budget respected | ✓ PASS |
| Calculator suite (output-equivalence/render-count/sequence) | `npx vitest run src/components/calculator/` | 42 passed / 1 todo | ✓ PASS |
| Debt-marker scan | `grep -nE "TBD|FIXME|XXX"` across 30 phase files | 0 matches | ✓ PASS |

### Code Review Fix-Pass Cross-Check (39-REVIEW.md)

All 11 Critical/Warning findings independently re-verified against current source (not taken on the review report's word):

| Finding | Claimed Fix | Verified in Code |
|---------|-------------|-------------------|
| CR-01 (legacy backups rejected) | Default absent new stores to `[]` | ✓ `backupRestore.ts` — `STORES_ABSENT_IN_LEGACY_BACKUPS` back-compat default confirmed; legacy-fixture regression tests present in `backupRestore.test.ts` |
| CR-02 (standalone-failure grams never deducted stock) | Drop `jobId` requirement | ✓ `useFailureEvents.ts` deduction now keys on `materialBreakdown`/`gramsWasted`, not `jobId` |
| CR-03 (over-broad abrasive regex + no override UI) | Ship `isAbrasive` override UI | ✓ `AssetLibrary.tsx:1356-1359` — Auto-detect/Abrasive/Not-abrasive select writes `Asset.isAbrasive`; regex itself deliberately left unchanged (documented tradeoff, acceptable — override remedy now exists) |
| WR-01 (non-transactional failure log+deduct) | Wrap in `db.transaction` | ✓ Confirmed in `useFailureEvents.ts` `logFailure`/`deleteFailure` |
| WR-02 (stale LogMaintenanceModal state) | Reset-on-open effect | ✓ Present (commit `4399154`) |
| WR-03 (no error handling on maintenance save/delete) | try/catch + visible error | ✓ Present (commit `4aae335`) |
| WR-04 (fabricated abrasive-acceleration doc) | Correct the doc / descope | ✓ Doc corrected, descope recorded in REVIEW.md fix-pass table |
| WR-05 (unclamped Apply value) | Clamp+round | ✓ `CostCalculator.tsx:441` `Math.min(99, Math.round(...))` |
| WR-06 (breakdown rows don't sum to subtotal) | Itemize new cost lines | ✓ `CostSummaryPanel.tsx:92-101` conditional rows present |
| WR-07 (overlapping TOU bands silently accepted) | Reject overlaps | ✓ `bandsOverlap` + `useTouTariff.ts:67` rejection confirmed |
| WR-08 (multi-material job over-deducts) | Per-material deduction | ✓ `useFailureEvents.ts` `materialBreakdown` + per-asset stockEvent writes confirmed |

Info-level findings (IN-01..IN-08) were deliberately not addressed per the review's own fix-pass scope (`critical_warning` only) — this is an explicit, documented descope, not a gap.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| FAIL-01 | 01, 02 | Log failure in one tap, ledger entry | ✓ SATISFIED | JobsManager row action + standalone ReportsSection CTA |
| FAIL-02 | 02, 05 | Empirical failure rate derivation + Apply suggestion | ✓ SATISFIED | `failureRate.ts` + `CostParametersSection.tsx` hint row |
| FAIL-03 | 05 | Applied rate folds real scrap cost; no silent reprice | ✓ SATISFIED | Apply-gated, manual field authoritative; existing multiplier untouched |
| FAIL-04 | 02 | Failure history/diagnostic ledger | ✓ SATISFIED | ReportsSection Failures sub-section |
| TOU-01 | 01, 03 | Define TOU tariffs in Settings | ✓ SATISFIED | SettingsModal band editor + useTouTariff |
| TOU-02 | 01, 05 | TOU-aware job electricity cost, flat default | ✓ SATISFIED | `resolveWeightedCostPerKwh` wired into `calculateElectricityCost`; snapshot at save |
| WEAR-01 | 01, 04 | Log maintenance events + abrasive-hours tracking | ✓ SATISFIED | LogMaintenanceModal + PrinterSettings MaintenanceSection + abrasive.ts |
| WEAR-02 | 04, 05 | Amortized $/hr + next-swap prediction | ✓ SATISFIED | maintenanceAmortization.ts + CostParametersSection hint row |

No orphaned requirements — all 8 IDs from REQUIREMENTS.md (Phase 39) are claimed across the 5 PLAN frontmatter `requirements:` fields and independently confirmed implemented in source.

### Anti-Patterns Found

None blocking. Debt-marker scan (`TBD|FIXME|XXX`) across all 30 phase-touched files returned 0 matches. The one known code-quality tradeoff (CR-03's abrasive regex left broad, e.g. "Carbon Black" pigment names still auto-detect as abrasive) is a **documented, reviewed tradeoff** with an in-app override remedy now shipped — not an unaddressed anti-pattern.

### Human Verification Required

None. All must-haves are verifiable via source inspection, automated tests, and build gates. No UI-feel/visual/real-time behaviors were identified as requiring human judgment beyond what the phase's own `checkpoint:human-verify` gate (Plan 05 Task 3 — golden-fixture baseline re-capture) already covered and the user already approved during execution.

### Gaps Summary

No gaps. All 8 requirement IDs (FAIL-01..04, TOU-01/02, WEAR-01/02) are implemented, wired, and tested. The phase's own code-review fix-pass caught and closed 3 Critical + 8 Warning issues (data-loss-on-restore, silent stock-deduction contract violation, mispriced abrasive surcharge with no override) before this verification ran — all 11 fixes were independently re-derived from current source in this pass, not accepted on the review report's word alone. Current gates: 1016/1017 tests green, `tsc -b` clean, production build green, calculator output-equivalence/render-count/sequence tripwires green, zero debt markers in touched files.

---

*Verified: 2026-07-07T16:25:09Z*
*Verifier: Claude (gsd-verifier)*
