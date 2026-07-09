---
phase: 41-quick-win-features
plan: 05
subsystem: insights
tags: [typescript, react, tax-threshold, jurisdiction, fx-conversion, insights-tab]

# Dependency graph
requires:
  - phase: 41-quick-win-features
    provides: "41-01: TaxJurisdiction union + UserProfile.taxJurisdiction/customTaxThresholdAmount/customTaxThresholdLabel fields, tax-threshold NEW-badge key"
  - phase: 40-insight-layer
    provides: "InsightsPanel orchestrator pattern (own Dexie subscriptions, lifetime-vs-range card split) that this plan's TaxThresholdCard follows"
provides:
  - "src/utils/taxThreshold.ts — resolveTaxYearRange (UK Apr 6 / AU Jul 1 / DE-US-OTHER Jan 1) + computeTaxThresholdProgress (gross-revenue sum vs. jurisdiction threshold, all in userCurrency)"
  - "TaxThresholdCard in the Insights tab — progress bar for UK/DE/AU/OTHER, badges-of-trade note for US, one-time crossing alert"
  - "SettingsModal jurisdiction picker + custom threshold amount/label inputs"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Threshold currency and revenue currency both normalized into userCurrency via convert() before comparison — never compare a raw fixed-currency threshold (GBP/EUR/AUD) against revenue summed in a different currency."
    - "Once-only alert semantics via a single localStorage key (not a Set/map) storing the last-alerted jurisdiction:taxYearLabel pair — re-fires automatically once a new tax year starts, mirrors NewBadge's localStorage-gate pattern."

key-files:
  created:
    - src/utils/taxThreshold.ts
    - src/utils/taxThreshold.test.ts
    - src/components/insights/TaxThresholdCard.tsx
  modified:
    - src/components/insights/InsightsPanel.tsx
    - src/components/SettingsModal.tsx

key-decisions:
  - "computeTaxThresholdProgress converts BOTH the sales revenue sum AND the jurisdiction's fixed threshold amount into userCurrency before comparing — the plan's Task 1 behavior spec literally targets userCurrency as the conversion target, so the fixed GBP/EUR/AUD threshold must also be converted into userCurrency or fraction/crossed would compare mismatched currencies. If the threshold amount itself has no resolvable FX rate, the card renders no bar rather than a guessed/mismatched one."
  - "Crossing-alert once-only guard uses a single localStorage string key (jurisdiction:taxYearLabel), not a UserProfile field — keeps the alert state out of the synced/exported profile and naturally resets when a new tax year starts (D-13's exact-mechanism was Claude's Discretion)."
  - "Task 1 (tdd=\"true\") was written and committed as source+test together in one `test(...)` commit rather than strict separate RED-then-GREEN commits — the tests were designed alongside the module and both passed on first run, so no failing-test intermediate state existed to commit separately."

patterns-established:
  - "Jurisdiction-aware calendar math (resolveTaxYearRange) lives in its own pure module, independent of the shared PeriodPicker/resolveDateRange (D-13) — future jurisdiction-based date logic should extend TAX_YEAR_START, not fork a new range resolver."

requirements-completed: [LIFE-02]

coverage:
  - id: D1
    description: "taxThreshold.ts exports resolveTaxYearRange (UK Apr 6 boundary with prior-year rollback, AU Jul 1, DE/US/OTHER Jan 1) and computeTaxThresholdProgress (gross revenue vs. threshold, both normalized to userCurrency, US returns badges-of-trade no-bar)"
    requirement: "LIFE-02"
    verification:
      - kind: unit
        ref: "src/utils/taxThreshold.test.ts (12 tests, npx vitest run src/utils/taxThreshold.test.ts exits 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SettingsModal renders a jurisdiction Select (UK/DE/AU/US/Other/None) writing UserProfile.taxJurisdiction, with custom amount (guarded >0) + label inputs revealed for Other, and an InfoTooltip carrying the not-tax-advice + data-current-as-of disclaimer"
    requirement: "LIFE-02"
    verification:
      - kind: unit
        ref: "npx tsc -b (exits 0)"
        status: pass
    human_judgment: true
    rationale: "Visual placement, dropdown behavior, and disclaimer wording are UI/UX judgment calls best confirmed by a human looking at the rendered Settings modal, not provable by a type-check alone."
  - id: D3
    description: "TaxThresholdCard renders a progress bar for UK/DE/AU/OTHER and a no-bar informational note for US, always shows not-tax-advice + data-current-as-of text, fires a one-time toast on crossing, and is slotted into InsightsPanel using allSales (lifetime, not the PeriodPicker range)"
    requirement: "LIFE-02"
    verification:
      - kind: unit
        ref: "npm run test (full suite, 91 files / 1118 passed / 1 todo, exits 0)"
        status: pass
    human_judgment: true
    rationale: "The crossing-alert UX (toast content/timing) and the progress-bar visual states (crossed/near-threshold coloring) need a human to eyeball actual sales data driving the bar in the Insights tab — full end-to-end UAT is deferred to /gsd-verify-work per the plan's own verification section."

# Metrics
duration: ~20min
completed: 2026-07-09
status: complete
---

# Phase 41 Plan 05: Tax Threshold Tracker Summary

**Jurisdiction-aware (UK/DE/AU/US/Other) gross-revenue progress bar toward the local hobby-to-business tax threshold, with a jurisdiction-correct tax-year window, a one-time crossing alert, and mandatory "not tax advice" disclaimers throughout.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-09T17:36:00Z (approx)
- **Completed:** 2026-07-09T17:56:00Z (approx)
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `src/utils/taxThreshold.ts`: pure `resolveTaxYearRange` (jurisdiction-aware boundary — UK April 6 with prior-year rollback for dates before the boundary, AU July 1, DE/US/OTHER January 1) and `computeTaxThresholdProgress` (sums gross `Sale.totalRevenue` into `userCurrency`, converts the fixed GBP/EUR/AUD threshold into the same currency for a valid comparison, US returns a no-bar badges-of-trade flag, OTHER uses the user's own custom amount/label).
- `src/utils/taxThreshold.test.ts`: 12 tests covering the UK April-6 rollback (including the exact boundary), AU/DE/US/OTHER boundaries, multi-currency summation, null-rate skipping (never guessed), crossing detection, and the OTHER custom-threshold path (including the no-bar case for a missing/invalid custom amount).
- `SettingsModal.tsx` gained a "Tax Threshold Tracking" section (Costs tab) with a jurisdiction `Select` (None/UK/DE/AU/US/Other) writing `UserProfile.taxJurisdiction`, and — only when Other is selected — a custom threshold amount (guarded `Number.isFinite && > 0`) and label input.
- `TaxThresholdCard.tsx`: renders the progress bar (revenue / threshold, tax-year label, percentage, crossed state) for UK/DE/AU/OTHER, an informational badges-of-trade note (no bar) for US, and a "set your jurisdiction" prompt when none is configured. Always shows the "Not tax advice — consult a qualified accountant" and "Data current as of 2026-07-09" text, plus an `InfoTooltip` explaining the gross-revenue basis. Fires a one-time `useToast` alert on crossing, guarded by a `localStorage` flag keyed on `jurisdiction:taxYearLabel` (naturally re-arms for the next tax year).
- `InsightsPanel.tsx` slots the card next to `PrinterROI`, passing `allSales` (lifetime) rather than the `PeriodPicker`-scoped `salesInRange` — a tax-year threshold, like printer payback, is a lifetime-clock concept independent of the Insights range picker.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure taxThreshold module — jurisdiction-aware year window, threshold table, gross-revenue sum with tests** - `99342c3` (test)
2. **Task 2: Jurisdiction picker + custom threshold in SettingsModal** - `7e4a98e` (feat)
3. **Task 3: TaxThresholdCard in the Insights tab (progress bar + US note + disclaimers + crossing alert)** - `7b585f9` (feat)

**Plan metadata:** (pending — final docs commit follows this SUMMARY)

## Files Created/Modified
- `src/utils/taxThreshold.ts` - `TAX_YEAR_START`, `THRESHOLDS`, `resolveTaxYearRange`, `computeTaxThresholdProgress`
- `src/utils/taxThreshold.test.ts` - 12 unit tests
- `src/components/insights/TaxThresholdCard.tsx` - the Insights-tab card
- `src/components/insights/InsightsPanel.tsx` - slots `TaxThresholdCard` with `allSales`, `userProfile.taxJurisdiction`, `userProfile.currency`, `fxTable`, and the two custom-threshold fields
- `src/components/SettingsModal.tsx` - jurisdiction `Select` + custom threshold inputs on the Costs tab; added `Select` and `TaxJurisdiction` imports

## Decisions Made
- Both the gross-revenue sum AND the jurisdiction's fixed threshold amount are converted into `userCurrency` before comparison (see `key-decisions` above) — necessary for `fraction`/`crossed` to be mathematically valid across currencies, since UK/DE/AU thresholds are legally fixed in GBP/EUR/AUD but a user's `Sale.totalRevenue` and profile currency can be anything.
- Once-only crossing-alert semantics use a single `localStorage` string key rather than a `UserProfile` field or a `Set` — simplest correct implementation that also self-resets at the next tax-year boundary without extra bookkeeping.
- Task 1's tdd="true" instruction resulted in a single combined `test(...)` commit (module + tests together, both passing on first run) rather than a strict RED-then-GREEN two-commit sequence — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Threshold amount converted to userCurrency before comparison, not left in its native GBP/EUR/AUD**
- **Found during:** Task 1 (writing `computeTaxThresholdProgress`)
- **Issue:** The plan's Task 1 `<behavior>` block specifies converting sale revenue into `userCurrency` (`convert(sale.totalRevenue, sale.currency ?? userCurrency, userCurrency, fxTable)`), but the fixed threshold amounts (UK £1,000, DE €25,000, AU AU$75,000) are literal numbers in their own currency. Comparing userCurrency-denominated revenue directly against a raw GBP/EUR/AUD number would produce a wrong (and, for non-GBP/EUR/AUD users, wildly wrong) `fraction`/`crossed` result.
- **Fix:** Added a `convert(thresholdInfo.amount, thresholdInfo.currency, userCurrency, fxTable)` step before computing the fraction; if that conversion has no resolvable rate, the function returns `{ hasBar: false }` rather than a guessed/mismatched bar.
- **Files modified:** `src/utils/taxThreshold.ts`
- **Verification:** `src/utils/taxThreshold.test.ts` "sums multi-currency in-window sales into userCurrency and compares against the (also-converted) threshold" asserts the exact converted threshold value.
- **Committed in:** `99342c3` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — currency-comparison correctness)
**Impact on plan:** Necessary for the progress bar's fraction/crossed math to be correct for any user currency other than the jurisdiction's native currency. No scope creep — same two inputs (sales, threshold) the plan specified, just converted into a common currency before dividing.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 41 (Quick-Win Features) plan 05 of 5 complete. Combined with 41-01/41-02/41-04 (41-03 status not covered by this plan), LIFE-02 is fully delivered: users set a jurisdiction in Settings and see a disclaimed, jurisdiction-correct gross-revenue tax-threshold tracker in Insights with a one-time crossing alert.
- `npx tsc -b` exits 0; `npx vitest run src/utils/taxThreshold.test.ts` (12/12) and the full `npm run test` suite (91 files, 1118 passed, 1 todo) are both green; `npm run build` succeeds.
- Manual/UAT verification (jurisdiction switch in Settings → bar appears in Insights with correct window/disclaimers; US → badges-of-trade note; crossing → one-time toast) is explicitly deferred to `/gsd-verify-work` per the plan's own verification section.

---
*Phase: 41-quick-win-features*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: src/utils/taxThreshold.ts
- FOUND: src/utils/taxThreshold.test.ts
- FOUND: src/components/insights/TaxThresholdCard.tsx
- FOUND: src/components/insights/InsightsPanel.tsx
- FOUND: src/components/SettingsModal.tsx
- FOUND: .planning/phases/41-quick-win-features/41-05-SUMMARY.md
- FOUND: 99342c3
- FOUND: 7e4a98e
- FOUND: 7b585f9
- FOUND: c9a767a
