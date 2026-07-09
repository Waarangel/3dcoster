---
phase: 40-insight-layer
verified: 2026-07-09T14:01:48Z
status: passed
score: 26/26 plan-level must-haves verified; 3/3 phase-goal success criteria verified; 3/3 requirement IDs satisfied
overrides_applied: 0
---

# Phase 40: Insight Layer Verification Report

**Phase Goal:** Users can see decision-grade analytics derived from their existing jobs and sales data — without entering anything new
**Verified:** 2026-07-09T14:01:48Z
**Status:** passed
**Re-verification:** No — initial verification (5 plans across 4 waves, commits `3ca6c37`..`8aee3cd`)

## Context

Phase 40 shipped in 5 plans: (01) pure derivation math (`insights.ts`) absorbing Phase 33's utils, (02) extraction of a shared `PeriodPicker`/`resolveDateRange`, (03) the Insights tab itself with wage headline + product ranking, (04) per-printer payback/ROI cards + reconciliation of the pre-existing `PrinterSettings` recovery bar onto the same derivation, and (05) the what-if simulator + formal retirement/absorption of the parked Phase 33 branch.

Per the verification brief, three human-verify checkpoints were run and approved in-browser during execution (40-03 Insights tab walkthrough, 40-04 payback-surface agreement, 40-05 what-if simulator after a fix round). Those approvals are cited as the human-verification evidence for the UI-judgment truths below (visual distinction, tooltip tone, live numeric plausibility, cross-surface agreement, focus-trap/keyboard behavior) — they are not re-litigated here. This report independently re-derives every code-level, wiring, and math claim from current source rather than trusting SUMMARY.md prose.

Gates re-confirmed independently during this verification pass:
- `npx tsc -b` → clean, exit 0
- `npx vitest run` → **1087 passed / 1 todo, 89 files**
- `npx vitest run src/utils/insights.test.ts src/utils/periodRange.test.ts` → **44 passed** (isolated re-run of the phase's new pure-math test files)
- `node scripts/lint-no-raw-html.mjs` → passed
- `npm run build` → clean; main chunk 87.4 KB gzipped (well under the 300 KB budget)
- Debt-marker scan (`TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`) across all 15 phase-touched files → 0 matches (one unrelated pre-existing `ADD_TAG_PLACEHOLDER` constant name in `JobsManager.tsx`, not a debt marker)
- `console.log`/`debugger` scan across the same 15 files → 0 matches (two pre-existing `console.error` calls in `JobsManager.tsx` CSV-export catch blocks, not new to this phase)
- `git log --oneline --all | grep <15 task commit hashes>` → all 15 commits present
- `git worktree list` / `git branch --list feat/insight-pricing-coach` / `git tag --list archive/*` → worktree `3DCoster-insight` absent, branch deleted, `archive/phase-33-ui` tag present

## Goal Achievement

### Observable Truths (ROADMAP Phase 40 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open an Insights tab and see a ranked list of products by profit per printer-hour, top/bottom clearly distinguished | ✓ VERIFIED | `App.tsx` registers `'insights'` in `Tab`/`VALID_TABS`/tabs array (lines 24, 30, 237) with the same roving-tabindex/`aria-selected` pattern as other tabs (lines 371-397); renders `<InsightsPanel onSwitchTab={setActiveTab} onEditJob={handleEditJob} />` with **no data props** (line 508). `ProductRanking.tsx` renders `computeProductRanking`'s `ranked` list with a `border-l-4` top/bottom accent + "Top earner"/"Lowest earner" badges (lines 83-91) and a separate "No sales yet" heading for `unsold` (lines 60-72). Human-verify checkpoint (40-03 Task 3) approved this rendering against real seeded data |
| 2 | User can see a per-printer payback tracker showing cumulative NET PROFIT against purchase cost, expressed as "paid off" or "net +/- $X" | ✓ VERIFIED | `computePrinterPayback` (`insights.ts:305-435`) computes `cumulativeNetProfit = saleProfitSum - maintenanceCumulativeCost - failureScrapCost` (net of fees via `computePerSaleProfit`, minus logged maintenance/failure costs) — never gross revenue. `PrinterROI.tsx` renders "Paid off on \<date\>" / "net +/-$X" verdict text (lines 109-128). `PrinterSettings.tsx` recovery bar reads the **same** `computePrinterPayback` call with identical argument shape (lines 117-130), removing the prior gross `job.sellingPrice × copiesSold` math (grep confirms zero live occurrences, only a removal comment at line 489) — closes D-16/RESEARCH P-01. ROADMAP wording corrected to "NET PROFIT" (line 149), confirmed present. Human-verify checkpoints (40-04 Task 3) approved both the numbers and cross-surface agreement |
| 3 | User can open a what-if simulator for a saved job and move sliders for filament price, electricity rate, failure rate to see live margin response, without overwriting the saved job | ✓ VERIFIED | `WhatIfSimulator.tsx` renders exactly 3 `type="range"` inputs (filament price, electricity rate, failure rate — lines 256-321), each driving `computeScenario` (`insights.ts:593-650`) which routes exclusively through `calculateCost` (costCalc.ts). `grep` across the file for `db.` / `.put(` / `.add(` / `onUpdateJob` returns zero matches — no Dexie write, confirming the read-only invariant. Two entry points wired to the identical component: `JobsManager.tsx` row `IconButton` (lines 842-853, 1874-1878) and `InsightsPanel.tsx` job picker (lines 138-165). Modal primitive provides `role="dialog"`, `aria-modal="true"`, focus trap, and Escape-to-close (`Modal.tsx:48-77`). Human-verify checkpoint (40-05 Task 4) approved after a fix round that corrected a reconciliation-residual defect (`12fd88b`) |

**Score:** 3/3 phase-goal truths verified

### Plan-Level Must-Haves (all 26 across 5 plans, checked against current source)

**40-01 (Foundation math) — 6/6 verified**

| # | Must-have truth | Status | Evidence |
|---|------------------|--------|----------|
| 1 | `computeProductRanking` groups by normalized title, ranks sold products by net profit-per-printer-hour, unsold separate | ✓ VERIFIED | `insights.ts:104-187`; `normalizeProductKey` is trim+lowercase only (line 47); unsold branch at lines 155-157 |
| 2 | `computeWageHeadline` = net profit / labor hours, hours summed once per unique job, target gap when supplied | ✓ VERIFIED | `insights.ts:208-250`; `laborJobIds` is a `Set` (line 219), hours computed once per unique job id (lines 230-235); `gap` computed at line 240 |
| 3 | `computePrinterPayback` = cumulative NET profit (sale profit − maintenance − failure scrap) vs. purchase price, paid-off flag, break-even date | ✓ VERIFIED | `insights.ts:305-435`; deductions at lines 343-367; `paidOff`/`breakEvenDate`/`projectedDate` at lines 370-395 |
| 4 | `computePrinterPayback` flags missing purchase price, Unassigned bucket for jobs with no printer | ✓ VERIFIED | `missingPurchasePrice` at line 336; `UNASSIGNED_KEY` bucket built at lines 410-432, never carries `paidOff`/dates |
| 5 | `computeScenario` recomputes margin/profit/break-even via `calculateCost` with slider overrides, returns deltas | ✓ VERIFIED | `insights.ts:593-650`; `calculateCost` called at lines 603, 621; `deltas` object returned at lines 644-647 |
| 6 | Ported Phase 33 utils (`printHourProfit`, `pricingCoach`, `costAllocation`) + tests pass byte-identically | ✓ VERIFIED | All 3 files + `.test.ts` present on disk; part of the 1087-test green run |

**40-02 (PeriodPicker extraction) — 3/3 verified**

| # | Must-have truth | Status | Evidence |
|---|------------------|--------|----------|
| 1 | `resolveDateRange` behaviorally equivalent to the old inline logic for every mode | ✓ VERIFIED | `periodRange.ts:60-97`; `periodRange.test.ts` 7 cases including Dec/Q4 boundaries, all pass |
| 2 | `PeriodPicker` renders mode Select + mode-specific controls with a11y labels, callback range | ✓ VERIFIED | `PeriodPicker.tsx:59-127`; every control has `useId`-paired `<label htmlFor>` |
| 3 | `ReportsSection` consumes extracted util/component, unchanged output | ✓ VERIFIED | `ReportsSection.tsx:6,10,40,128` imports/renders both; default mode unchanged at `'month'` (no `defaultMode` prop passed); full suite green |

**40-03 (Insights tab, wage + ranking) — 7/7 verified**

| # | Must-have truth | Status | Evidence |
|---|------------------|--------|----------|
| 1 | Insights tab reachable at `/app?tab=insights`, same roving-tabindex/`aria-selected` keyboard behavior | ✓ VERIFIED (+ human checkpoint) | `App.tsx:24,30,237,371-397`; 40-03 Task 3 human-verify checkpoint approved URL + keyboard behavior |
| 2 | True-hourly-wage headline + target gap, no per-product wage column, no judgment score | ✓ VERIFIED | `WageInsight.tsx` renders one aggregate stat + optional gap phrase (lines 29-37); no per-row wage anywhere in `ProductRanking.tsx` |
| 3 | Product ranking with top/bottom distinguished + separate unsold "No sales yet" heading | ✓ VERIFIED | `ProductRanking.tsx:60-72,83-91` |
| 4 | Benchmark tooltip is rule-of-thumb framing, not single-source citation | ✓ VERIFIED | `ProductRanking.tsx:19-22` — "typical $1–5 per printer-hour range reported across several... guides — a rough, corroborated range, not a single authoritative figure" |
| 5 | Shared `PeriodPicker` narrows the period; all-time is default | ✓ VERIFIED | `InsightsPanel.tsx:46,120` — `defaultMode="all-time"`; `periodRange.ts:13,63-67` adds `'all-time'` additively (ReportsSection's `'month'` default provably unchanged) |
| 6 | Optional target hourly wage settable in Settings "Costs & Rates" | ✓ VERIFIED | `types.ts:542` `targetHourlyRate?: number`; `SettingsModal.tsx:515-522` wired input |
| 7 | `InsightsPanel` owns its own Dexie hooks — no data prop-drilling through App.tsx | ✓ VERIFIED | `InsightsPanel.tsx:35-43` calls `useJobs`/`useAllSales`/`usePrinterInstances`/`usePrinters`/`useMaterials`/`useFailureEvents`/`useMaintenanceEvents`/`useUserProfile`/`useFxRates` directly; `App.tsx:508` passes only `onSwitchTab`/`onEditJob` callbacks |

**40-04 (Printer ROI + reconciliation) — 5/5 verified**

| # | Must-have truth | Status | Evidence |
|---|------------------|--------|----------|
| 1 | Per-printer payback tracker: cumulative NET profit vs purchase price, "paid off" or "net +/- $X" | ✓ VERIFIED (+ human checkpoint) | `PrinterROI.tsx:106-128`; 40-04 Task 3 checkpoint approved rendering against real data |
| 2 | Paid-off printer shows actual date; not-yet-paid-off shows projected date with explainable tooltip | ✓ VERIFIED (+ human checkpoint) | `PrinterROI.tsx:112,120-123`; `PROJECTION_TOOLTIP_TEXT` names the 90-day trailing pace basis (line 16); checkpoint approved tooltip tone |
| 3 | Crossing payback fires one-time toast, suppressed for already-paid-off printers at launch | ✓ VERIFIED (+ human checkpoint) | `PrinterROI.tsx:36-50` — `initialPaidOffIds` ref snapshot on first render, toast only for ids flipping false→true thereafter; checkpoint approved one-time firing, no storm |
| 4 | Missing purchase price shows CTA to Printer Settings; Unassigned sales shown, never silently dropped; never gates the section on printer assignment | ✓ VERIFIED (+ human checkpoint) | `PrinterROI.tsx:89-99` (CTA), `:75-87` (Unassigned row); section renders unconditionally per printer instance, no assignment gate |
| 5 | `PrinterSettings.tsx` recovery bar consumes the SAME `computePrinterPayback` — no disagreeing numbers | ✓ VERIFIED (+ human checkpoint) | `PrinterSettings.tsx:105-130` calls `computePrinterPayback` with the identical argument list `InsightsPanel.tsx` uses; old gross-math grep returns nothing live; checkpoint approved cross-surface agreement |

**40-05 (What-if simulator + phase closure) — 5/5 verified**

| # | Must-have truth | Status | Evidence |
|---|------------------|--------|----------|
| 1 | Simulator opens from a JobsManager job-row action AND an Insights job picker — one shared component | ✓ VERIFIED (+ human checkpoint) | `JobsManager.tsx:1874-1878` and `InsightsPanel.tsx:165` both render `<WhatIfSimulator>`; 40-05 Task 4 checkpoint approved parity after a fix round |
| 2 | Exactly 3 sliders (filament price, electricity rate, failure rate), live delta chips vs saved job | ✓ VERIFIED (+ human checkpoint) | `WhatIfSimulator.tsx:256-321` (3 `type="range"` inputs only); `MetricRow` renders delta chips (lines 100-140); checkpoint approved after reconciliation-residual fix `12fd88b` |
| 3 | Lives in shared Modal (focus trap, Escape, aria); closing discards the scenario | ✓ VERIFIED (+ human checkpoint) | `Modal.tsx:48,76-77`; `WhatIfSimulator.tsx:184-196` `resetToSaved()` called in `handleClose` |
| 4 | Never writes to Dexie, never mutates the saved job | ✓ VERIFIED | `grep -n "db\.\|updateJob\|onUpdateJob\|\.put(\|\.add("` across `WhatIfSimulator.tsx` → 0 matches |
| 5 | Phase 33 records archived, ROADMAP note updated, success-criterion-2 wording corrected to net-profit | ✓ VERIFIED | `.planning/phases/33-insight-pricing-coach/README.md` present, "ABSORBED INTO PHASE 40"; `ROADMAP.md:149,171` net-profit wording + note present; `git worktree list` / `branch --list` / `tag --list archive/*` confirm branch+worktree retired, archive tag `archive/phase-33-ui` present |

**Score:** 26/26 plan-level must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/insights.ts` | Pure derivations: ranking, wage, payback, scenario | ✓ VERIFIED | 650 lines, zero React/Dexie imports, exports match plan's `exports` list |
| `src/utils/insights.test.ts` | Unit tests for all derivations | ✓ VERIFIED | Part of the 44-test isolated pass |
| `src/utils/printHourProfit.ts`, `pricingCoach.ts`, `costAllocation.ts` (+ tests) | Ported Phase 33 pure utils | ✓ VERIFIED | Present, part of green full suite |
| `src/utils/periodRange.ts` | `RangeMode` + `resolveDateRange`, single home | ✓ VERIFIED | Only declaration site (grep-confirmed) |
| `src/components/ui/PeriodPicker.tsx` | Reusable period control | ✓ VERIFIED | Re-exported from `src/components/ui/index.ts`, consumed by both ReportsSection and InsightsPanel |
| `src/components/insights/InsightsPanel.tsx` | Insights orchestrator | ✓ VERIFIED | Owns hooks, no data props from App.tsx |
| `src/components/insights/WageInsight.tsx` | Wage headline | ✓ VERIFIED | Single aggregate stat, no per-product column |
| `src/components/insights/ProductRanking.tsx` | Ranking + unsold list | ✓ VERIFIED | Top/bottom badges, rule-of-thumb tooltip |
| `src/components/insights/PrinterROI.tsx` | Payback/ROI cards | ✓ VERIFIED | Verdict text, tooltip, CTA, Unassigned line, one-time toast |
| `src/components/insights/WhatIfSimulator.tsx` | 3-slider modal simulator | ✓ VERIFIED | 367 lines, read-only, Modal-based |
| `src/features.ts` | `insights-tab`, `what-if-simulator`, `log-failure` NEW-badge keys | ✓ VERIFIED | Lines 27, 30, 33 |
| `.planning/phases/33-insight-pricing-coach/` | Archived Phase 33 GSD records | ✓ VERIFIED | SPEC + 3 plans/summaries + README present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `InsightsPanel.tsx` | `insights.ts` | `computeProductRanking`/`computeWageHeadline`/`computePrinterPayback` | ✓ WIRED | Lines 9, 69-96 |
| `InsightsPanel.tsx` | `PeriodPicker.tsx` | reused component, `defaultMode="all-time"` | ✓ WIRED | Lines 10, 120 |
| `ReportsSection.tsx` | `periodRange.ts` / `PeriodPicker.tsx` | `resolveDateRange` + `<PeriodPicker>` | ✓ WIRED | Lines 6, 10, 40, 128 |
| `PrinterSettings.tsx` | `insights.ts` | `computePrinterPayback` (recovery bar) | ✓ WIRED | Lines 16, 117-130; same call shape as InsightsPanel |
| `PrinterROI.tsx` | `insights.ts` | `computePrinterPayback` result consumed as props | ✓ WIRED | `PrinterROIProps.payback: PrinterPaybackResult[]` |
| `PrinterROI.tsx` | `ui/toast` | `useToast().success` one-time celebration | ✓ WIRED | Lines 6, 29, 48 |
| `WhatIfSimulator.tsx` | `insights.ts` | `computeScenario` | ✓ WIRED | Lines 11, 208-213 |
| `JobsManager.tsx` | `WhatIfSimulator.tsx` | row `IconButton` opens shared modal | ✓ WIRED | Lines 16, 842-853, 1874-1878 |
| `InsightsPanel.tsx` | `WhatIfSimulator.tsx` | job picker opens shared modal | ✓ WIRED | Lines 16, 138-165 |
| `App.tsx` | `InsightsPanel.tsx` | tab render, callbacks only | ✓ WIRED | Line 508 — no data props |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| INS-01 | 01, 02, 03 | True hourly wage + product ranking, own panel/tab, no App.tsx prop-drilling | ✓ SATISFIED | `WageInsight`/`ProductRanking`/`InsightsPanel` own-hooks pattern confirmed |
| INS-02 | 01, 04 | Per-printer payback/ROI from existing depreciation + sales data | ✓ SATISFIED | `PrinterROI` + reconciled `PrinterSettings` recovery bar, single source of truth |
| INS-03 | 01, 05 | What-if margin sensitivity sliders with live response | ✓ SATISFIED | `WhatIfSimulator`, 3 sliders, read-only, 2 entry points |

All 3 requirement IDs from `REQUIREMENTS.md` are checked `[x]` complete, mapped to Phase 40 in the traceability table (lines 121-123), and independently confirmed implemented in current source. No orphaned requirements.

### Anti-Patterns Found

None blocking. Money math has exactly two homes (`computePerSaleProfit`, `calculateCost`) across every phase-touched file — grep-confirmed, no forked formula. `RangeMode` has exactly one declaration site. The old gross `job.sellingPrice × copiesSold` payback math is fully removed from `PrinterSettings.tsx` (only a removal-comment reference remains). Debt-marker and `console.log`/`debugger` scans across all 15 phase-touched files returned 0 new matches (one pre-existing constant name coincidentally containing "PLACEHOLDER", two pre-existing `console.error` calls in unrelated CSV-export catch blocks — neither introduced by this phase).

### Human Verification Required

None beyond what the three approved checkpoints already covered. Per the verification brief, checkpoints for 40-03 (Insights tab walkthrough: URL/keyboard, wage headline, product ranking visuals, tooltip tone, period-picker interaction), 40-04 (payback verdict rendering, tooltip, one-time toast, CTA, Unassigned line, cross-surface agreement with PrinterSettings), and 40-05 (dual-entry-point parity, live slider plausibility, Modal focus-trap/close-discards behavior — after a fix round for a reconciliation-residual defect) were run and approved by the user in-browser during execution. The code-level facts underlying each (component structure, prop wiring, absence of Dexie writes, single-source derivation calls) are independently re-derived from current source in this report, not accepted on SUMMARY.md's word.

### Gaps Summary

No gaps. All 3 ROADMAP phase-goal success criteria and all 26 plan-level must-haves across the 5 plans are verified against current source. Full build gate is green: 1087/1088 tests (1 todo) passed, `tsc -b` clean, `lint:no-raw-html` clean, production build clean under budget (87.4 KB gzipped main chunk). The dual-payback-surface risk flagged by RESEARCH P-01/D-16 is closed — `PrinterSettings.tsx` and `PrinterROI.tsx` call the identical `computePrinterPayback` with identical arguments. Phase 33's branch and worktree are formally retired with history preserved via `archive/phase-33-ui`. No regressions found in `ReportsSection.tsx` (still defaults to `'month'`, unchanged behavior) or the shared `PeriodPicker`/`RangeMode` (single declaration site, additive `'all-time'` mode).

---

*Verified: 2026-07-09T14:01:48Z*
*Verifier: Claude (gsd-verifier)*
