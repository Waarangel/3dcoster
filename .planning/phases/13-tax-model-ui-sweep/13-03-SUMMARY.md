---
phase: 13-tax-model-ui-sweep
plan: 03
subsystem: ui
tags: [tax, settings, infotooltip, ui-sweep, newbadge, react, typescript]

# Dependency graph
requires:
  - phase: 13-tax-model-ui-sweep
    provides: "Plan 13-01 supplies resolveTaxRate() and tooltipForSource() — consumed by CostCalculator Tax row (Plan 05); this plan only writes the Settings field that seeds userProfile.defaultTaxRate"
provides:
  - "Default Tax Rate field in SettingsModal 'Costs & Rates' tab (TAX-01)"
  - "UI-09 partial: 3 descriptive <p> blocks migrated to InfoTooltip on label (electricity, hourly rate, profit margin)"
  - "UI-08 partial: 3 numeric inputs in SettingsModal upgraded with compact prop (Custom Carrier Cost, Custom Marketplace Percent, Custom Marketplace Fixed)"
  - "default-tax-rate NewBadge JSX site (registry entry deferred to Plan 13-06)"
affects: [13-05-cost-breakdown-tax-row, 13-06-newbadge-registry-cleanup, 13-04-cost-calculator-tax-input]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "InfoTooltip-on-label pattern (label className 'flex items-center gap-1.5'; children <span> + <InfoTooltip>; trailing <p> deleted) — UI-09 sweep mechanic"
    - "Empty-string-not-zero unset state for optional numeric inputs (value=`?? ''`, onChange writes `undefined` on empty) — D-04 + Pitfall 3 contract, mirrored from PrinterSettings.tsx:152-153"
    - "Anti-pattern-safe NewBadge on h3 heading: `relative inline-block` host, `absolute top-0 left-full ml-2 pointer-events-none` badge — does not push siblings"

key-files:
  created: []
  modified:
    - "src/components/SettingsModal.tsx — InfoTooltip import + Default Tax Rate section + 3 label migrations + 3 compact additions"

key-decisions:
  - "Default Tax Rate slots into existing 'Costs & Rates' tab below Default Profit Margin — NO new 'Pricing' tab created (Discrepancy 1 resolution from RESEARCH)"
  - "InfoTooltip text branches on userCurrency at render time (no helper extraction); ternary inside JSX keeps the locked D-11 string visible in the file for grep audits"
  - "Default Profit Margin's `?? 30` default is intentionally preserved — D-04 contract is specific to Default Tax Rate, not a global rule"
  - "Delivery-tab fuel-cost descriptive <p> (line ~308 baseline, now shifted) is intentionally retained — out of UI-09 scope for this plan per RESEARCH inventory"

patterns-established:
  - "Pattern S2 (InfoTooltip-on-label): canonical migration recipe for SettingsModal numeric inputs — replicated 3x in this plan and reusable in CostCalculator and other surfaces"
  - "Pattern S1 (h3 NewBadge): now confirmed twice in SettingsModal (Default Profit Margin + Default Tax Rate) — anti-pattern-safe host idiom validated"

requirements-completed: [TAX-01, UI-08, UI-09]

# Metrics
duration: ~2min
completed: 2026-05-21
---

# Phase 13 Plan 03: Tax Model UI Sweep — SettingsModal Field + Tooltip Migration Summary

**Default Tax Rate field added below Default Profit Margin in SettingsModal Costs & Rates tab with empty-when-unset semantics + 3 descriptive `<p>` blocks migrated to InfoTooltip-on-label + 3 numeric inputs converted to `compact`.**

## Performance

- **Duration:** ~2 min (commits at 11:03:29 and 11:05:08 EDT)
- **Started:** 2026-05-21T15:03:00Z (approx)
- **Completed:** 2026-05-21T15:05:08Z
- **Tasks:** 2
- **Files modified:** 1 (`src/components/SettingsModal.tsx`)

## Accomplishments
- TAX-01 Settings half wired — `userProfile.defaultTaxRate` is now editable and persists via existing `onUserProfileChange` callback; empty-string-not-zero unset contract enforced per D-04 + Pitfall 3
- UI-09 SettingsModal portion complete — 3 descriptive `<p>` blocks (electricity, hourly rate, profit margin) replaced by InfoTooltip on `flex items-center gap-1.5` labels with verbatim copy preserved
- UI-08 SettingsModal portion complete — Custom Carrier Cost + Custom Marketplace Percent + Custom Marketplace Fixed inputs now use the `compact` Input variant
- NewBadge for `default-tax-rate` emitted with anti-pattern-safe absolute positioning on a `relative inline-block` h3 host (matches Default Profit Margin pattern; registry entry deferred to Plan 13-06)
- D-11 marketplace-facilitator note locked verbatim into JSX (USD-only branch); non-USD users see the plain "Default tax rate applied to new jobs" fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Default Tax Rate field with NewBadge h3 and InfoTooltip-branched label** — `f1f924a` (feat)
2. **Task 2: Migrate 3 descriptive `<p>` blocks and sweep 3 non-compact numeric inputs** — `cd461f3` (refactor)

_Note: Plan is `tdd="true"` per frontmatter, but the existing SettingsModal has no Vitest spec — verification gate is `npx tsc -b` + the plan's grep acceptance criteria (manual UAT deferred to phase wrap-up per VALIDATION.md). No new test file added per "No framework install needed" in VALIDATION.md Wave 0._

## Files Created/Modified
- `src/components/SettingsModal.tsx` — Added `InfoTooltip` import; added Default Tax Rate `<div>` section below Default Profit Margin inside the `activeTab === 'costs'` block; rewrote 3 labels from `block` to `flex items-center gap-1.5` with `<span>` + `<InfoTooltip>` children; deleted the 3 corresponding `<p className="text-xs text-slate-500 mt-2">` description blocks; added `compact` prop to 3 numeric `<Input>` elements (newCarrierCost line 532, newMarketplacePercent line 785, newMarketplaceFixed line 794).

## Decisions Made
- **Tab placement** — Default Tax Rate slots into the existing 'Costs & Rates' tab (`activeTab === 'costs'`) and sits BELOW Default Profit Margin (which is the more frequently edited setting per RESEARCH Example 4). No new 'Pricing' tab was created, resolving the CONTEXT/ROADMAP terminology discrepancy in favor of the actual code.
- **Tooltip text inline ternary** — The InfoTooltip text branches on `userCurrency === 'USD'` directly in JSX rather than via a helper. This keeps the D-11 locked string grep-visible in `SettingsModal.tsx` for future audits.
- **Default Profit Margin's `?? 30`** preserved — the D-04 empty-when-unset contract is specific to Default Tax Rate (which feeds the resolveTaxRate fallback chain in Plan 13-01); Default Profit Margin has a sensible default (30%) and is not part of the same chain.
- **`compact` delta verified** — pre=28, post-Task-1=29, post-Task-2=32. Delta of +3 in Task 2 confirms exactly the 3 specified inputs received the prop and no others were touched.

## Deviations from Plan

None — plan executed exactly as written.

The cross-plan dependency note (re: `resolveTaxRate`/`tooltipForSource` from Plan 13-01) did not apply to this plan because Plan 03's scope writes ONLY to `userProfile.defaultTaxRate` via the existing `onUserProfileChange` callback — no consumer of `resolveTaxRate` was added. The InfoTooltip body strings are inline literals, not calls to `tooltipForSource`. Plan 13-05 (Cost Breakdown Tax row) is where the cross-plan import will land.

## Issues Encountered

**Pre-existing TypeScript errors on baseline commit `a705e40`** (out of scope):

```
src/components/AssetLibrary.tsx(2,67): error TS2307: Cannot find module 'react-window'
src/components/JobsManager.tsx(2,67): error TS2307: Cannot find module 'react-window'
vite.config.ts(5,28): error TS2307: Cannot find module 'rollup-plugin-visualizer'
```

These exist on the unmodified base commit and do not touch `src/components/SettingsModal.tsx`. Per the scope boundary rule, they were NOT fixed in this plan. The plan's verification gate "no NEW errors introduced" was preserved via baseline diff at `/tmp/13-03-baseline-errors.txt` vs `/tmp/13-03-final.txt` — empty diff confirms zero new errors. Logged for visibility; the orchestrator can decide whether to address these in a separate phase.

## User Setup Required

None — no external service configuration required.

## Verification Evidence

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `tsc -b` (vs baseline) | Zero new errors | Empty diff vs `/tmp/13-03-baseline-errors.txt` | PASS |
| `grep -c 'Default Tax Rate'` | ≥1 | 1 (the h3 text) | PASS |
| `grep -F "userProfile.defaultTaxRate ?? ''"` | Match | 1 match (Pitfall 3 lock) | PASS |
| `grep -F "defaultTaxRate: undefined"` | Match | 1 match (D-04 unset contract) | PASS |
| `grep -F 'feature="default-tax-rate"'` | Match | 1 match | PASS |
| Absolute badge positioning count | ≥2 | 2 (profit margin + tax rate) | PASS |
| D-11 USD verbatim string | Match | 1 match | PASS |
| Non-USD fallback string | Match | 1 match | PASS |
| `grep -c "activeTab === 'costs'"` | 1 | 1 (no new tab) | PASS |
| Default Profit Margin before Default Tax Rate | Yes | line 240 < line 266 | PASS |
| `grep -c InfoTooltip` (import + JSX) | ≥4 | 5 | PASS |
| Scoped <p> count in costs tab (lines 200-262) | 0 | 0 | PASS |
| Whole-file <p> count | 1 (delivery keeper) | 1 | PASS |
| Hourly Rate description text in InfoTooltip | Match | matched in `<InfoTooltip text="...">` | PASS |
| Profit Margin description text in InfoTooltip | Match | matched in `<InfoTooltip text="...">` | PASS |
| `compact` delta | +3 exactly | pre=29, post=32 → +3 | PASS |
| Custom Carrier `compact` adjacency | Within input | line 532 (2 above value={newCarrierCost}) | PASS |
| Custom Marketplace Percent `compact` adjacency | Within input | line 785 (2 above value={newMarketplacePercent}) | PASS |
| Custom Marketplace Fixed `compact` adjacency | Within input | line 794 (2 above value={newMarketplaceFixed}) | PASS |

## Threat Surface

No new threats introduced beyond those documented in the plan's `<threat_model>`. The clamp + finite-guard (T-13-08 mitigate) and verbatim string literal for the InfoTooltip body (T-13-09 mitigate) are in place. No new packages installed (T-13-SC accept). userProfile.defaultTaxRate inherits the existing localStorage threat model (T-13-10 accept).

## Known Stubs

None.

## Next Phase Readiness

- TAX-01 Settings half is shipped and persists via existing `userProfile` flow. Plan 13-05 can now consume `userProfile.defaultTaxRate` via `resolveTaxRate` (from Plan 13-01) to drive the Cost Breakdown Tax row.
- Plan 13-06 (NewBadge registry cleanup) must add `'default-tax-rate': new Date('2026-05-21')` to `src/features.ts` — the JSX consumer is now live and the badge will not render until the registry entry exists.
- UI-09 and UI-08 remain partially open — CostCalculator, AssetLibrary, JobsManager, PrinterSettings still have non-compact numeric inputs and descriptive `<p>` blocks per the plan's overall sweep scope. Plan 13-04 covers CostCalculator; others depend on per-phase planning.

## Self-Check: PASSED

- File `src/components/SettingsModal.tsx` modifications: FOUND (2 commits land here)
- Commit `f1f924a`: FOUND in git log
- Commit `cd461f3`: FOUND in git log
- SUMMARY.md at `.planning/phases/13-tax-model-ui-sweep/13-03-SUMMARY.md`: writing now (this file)

---
*Phase: 13-tax-model-ui-sweep*
*Plan: 03*
*Completed: 2026-05-21*
