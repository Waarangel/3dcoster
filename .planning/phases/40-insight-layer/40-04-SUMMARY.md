---
phase: 40-insight-layer
plan: 04
subsystem: ui
tags: [react, typescript, dexie, insights, printer-roi, payback, toast]

# Dependency graph
requires:
  - phase: 40-insight-layer (40-01)
    provides: computePrinterPayback pure derivation util in src/utils/insights.ts (PrinterPaybackResult, Unassigned bucket)
  - phase: 40-insight-layer (40-03)
    provides: InsightsPanel orchestrator (owns its own Dexie hooks, onSwitchTab/onEditJob callback pattern, ranking/wage section slots)
provides:
  - PrinterROI component rendering one payback/ROI card per printer instance (actual/projected break-even date, projection-basis tooltip, missing-price CTA, Unassigned line)
  - One-time "paid for itself" celebration toast via shared useToast, suppressed for printers already paid off at mount
  - PrinterSettings.tsx recovery bar reconciled onto the SAME computePrinterPayback the Insights ROI card uses — the old gross job.sellingPrice × copiesSold asking-price math is removed
affects: [40-05-what-if-simulator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-surface single-source-of-truth: when two UI surfaces show the same derived number (Insights ROI card + PrinterSettings recovery bar), both call the same pure derivation function directly from their own hooks rather than one surface computing and passing the result to the other"
    - "Toast-on-transition suppressed-at-mount: snapshot already-true booleans (paidOff per printer id) into a ref on first render, only fire the celebratory toast for ids that flip from false→true in a later render — prevents a toast storm for pre-existing paid-off printers"

key-files:
  created:
    - src/components/insights/PrinterROI.tsx
  modified:
    - src/components/insights/InsightsPanel.tsx
    - src/components/PrinterSettings.tsx

key-decisions:
  - "PrinterROI computes payback from the FULL sales history, not the PeriodPicker-scoped range that wage/ranking use — payback is a lifetime cumulative metric, not a period metric, so it must not be narrowed by the same range control"
  - "PrinterSettings reads sales/failureEvents/maintenanceEvents/materials/fxTable via its own hooks (matching the existing MaintenanceSection sub-component precedent) instead of threading five new props through App.tsx"

requirements-completed: [INS-02]

coverage:
  - id: D1
    description: "Insights tab shows a per-printer payback tracker: cumulative NET profit (net of fees, minus that printer's logged maintenance + failure scrap costs) versus purchase price, expressed as 'paid off' or 'net +/- $X'"
    requirement: "INS-02"
    verification:
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint, step 2 — approved"
        status: pass
    human_judgment: true
    rationale: "Correct rendering against the user's real seeded printer/sale/ledger data requires visual confirmation of the verdict text and numbers"
  - id: D2
    description: "A paid-off printer shows its actual break-even date; a not-yet-paid-off printer shows a projected date from recent profit pace, explainable via tooltip"
    requirement: "INS-02"
    verification:
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint, step 2 (tooltip hover) — approved"
        status: pass
    human_judgment: true
    rationale: "Tooltip copy tone and date-plausibility need human judgment, not just presence-of-text assertions"
  - id: D3
    description: "Crossing payback fires a one-time 'paid for itself' toast via the shared useToast, suppressed for printers already paid off at feature launch"
    requirement: "INS-02"
    verification:
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint, step 6 — approved (toast confirmed one-time, no toast storm for pre-paid printers)"
        status: pass
    human_judgment: true
    rationale: "A state-transition toast requires a live interaction (recording a sale) and observing exactly one firing; not covered by an automated test in this plan"
  - id: D4
    description: "A printer with no purchase price shows an inline 'Add purchase price to track payback' CTA linking to Printer Settings; sales from jobs with no printer roll into an explicit 'Unassigned' line — nothing silently dropped, and the section never requires printer assignment"
    requirement: "INS-02"
    verification:
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint, steps 3-4 — approved"
        status: pass
    human_judgment: true
    rationale: "CTA click-through (tab switch) and Unassigned-line presence with real data need a human driving the app"
  - id: D5
    description: "PrinterSettings.tsx recovery bar consumes the SAME computePrinterPayback — the app never shows two disagreeing payback numbers for one printer"
    requirement: "INS-02"
    verification:
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint, step 5 — approved (both surfaces confirmed to agree)"
        status: pass
    human_judgment: true
    rationale: "Cross-surface numeric agreement on real data requires a human comparing two screens side by side"
  - id: D6
    description: "npx tsc -b and node scripts/lint-no-raw-html.mjs both exit 0 across all Task 1-2 files"
    requirement: "INS-02"
    verification:
      - kind: other
        ref: "npx tsc -b (exit 0); node scripts/lint-no-raw-html.mjs (exit 0), re-verified at continuation resume"
        status: pass
    human_judgment: false

# Metrics
duration: ~5min active work (Tasks 1-2) + human-verify checkpoint hold
completed: 2026-07-08
status: complete
---

# Phase 40 Plan 04: Printer ROI & Payback Reconciliation Summary

**Per-printer payback/ROI cards in the Insights tab (actual/projected break-even date, missing-price CTA, honest Unassigned line, one-time paid-off toast) reading from the same computePrinterPayback that now also drives the PrinterSettings recovery bar, closing the dual-payback-surface gap flagged by RESEARCH P-01 / decision D-16.**

## Performance

- **Duration:** ~5 min active implementation (Tasks 1-2, 19:51-19:54 local); checkpoint held for human verification before this continuation resumed and closed it out
- **Started:** 2026-07-08 (plan start, per prior executor)
- **Completed:** 2026-07-08 (continuation close-out)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Built `PrinterROI` (`src/components/insights/PrinterROI.tsx`): one card per printer instance driven by `computePrinterPayback`, showing "paid off on \<date\>" / "net −$X, projected to pay off ~\<month\>" / "net +$X", an `InfoTooltip` naming the recent-pace projection basis, a "Add purchase price to track payback" CTA (`onSwitchTab('settings')`) when purchase price is missing, and an "Unassigned" line so sales with no printer are never silently dropped
- Added a one-time "paid for itself" celebration toast via `useToast().success`, suppressed for printers already paid off at mount using a ref-based snapshot of paid-off ids taken on first render
- Extended `InsightsPanel` to read `printerInstances`/`printerConfigs`/`materials`/`failureEvents`/`maintenanceEvents` via its own hooks and compute payback from the **full** sales history (not the PeriodPicker-scoped range used for wage/ranking), since payback is a lifetime cumulative metric
- Reconciled `PrinterSettings.tsx`'s recovery bar onto `computePrinterPayback`, removing the old gross `job.sellingPrice − job.costPerUnit × copiesSold` asking-price math entirely (D-16 / RESEARCH P-01 closed) — the component now reads sales/ledger data via its own hooks, matching the existing `MaintenanceSection` sub-component precedent
- Surfaced a partial-data note in `PrinterSettings` when an FX conversion is unavailable, instead of silently showing a wrong number
- Human-verify checkpoint (Task 3) presented and **approved** by the user — both surfaces confirmed to agree; CTA, Unassigned line, and one-time toast all behaved correctly; scrap-cost basis (job-linked vs standalone failures) sanity-checked with no issues flagged

## Task Commits

Each task was committed atomically:

1. **Task 1: PrinterROI cards + one-time paid-off celebration toast** - `60bed05` (feat)
2. **Task 2: Reconcile the PrinterSettings recovery bar onto computePrinterPayback** - `512a3eb` (fix)
3. **Task 3: Human-verify payback cards + PrinterSettings recovery-bar agreement** - checkpoint, no code changes; approved by user this session (no commit — verification-only task)

**Plan metadata:** (this commit) `docs(40-04): complete printer-roi-and-payback-reconciliation plan`

## Files Created/Modified
- `src/components/insights/PrinterROI.tsx` - Per-printer payback/ROI cards: verdict text, projection tooltip, missing-price CTA, Unassigned line, one-time paid-off toast
- `src/components/insights/InsightsPanel.tsx` - Added printerInstances/printerConfigs/materials/failureEvents/maintenanceEvents hook reads and a `<PrinterROI>` section computed from full sales history
- `src/components/PrinterSettings.tsx` - Recovery bar recomputed from `computePrinterPayback`; removed gross asking-price math; reads sales/ledgers via own hooks; partial-data note for missing FX

## Decisions Made
- `PrinterROI` computes payback from the full sales history rather than the PeriodPicker-scoped range — payback is a lifetime cumulative metric and must not be narrowed by the same period control used for wage/ranking
- `PrinterSettings` pulls sales/failureEvents/maintenanceEvents/materials/fxTable via its own hooks (matching the `MaintenanceSection` precedent already in the file) rather than threading five new props through `App.tsx`

## Deviations from Plan

None - plan executed exactly as written. The plan explicitly offered a choice between hook-reads and prop-threading for `PrinterSettings`; hook-reads was chosen and documented above as a decision, not a deviation.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both payback surfaces (Insights ROI card, PrinterSettings recovery bar) now share one source of truth — no divergent-number risk remains for 40-05 or later phases
- `InsightsPanel` orchestrator pattern (own hooks, no data prop-drilling) continues to hold for 40-05 (what-if simulator) to extend
- No blockers for 40-05

---
*Phase: 40-insight-layer*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 3 key files (PrinterROI.tsx, InsightsPanel.tsx, PrinterSettings.tsx) confirmed present on disk. Both task commits (`60bed05`, `512a3eb`) confirmed present in `git log --oneline --all`. `npx tsc -b` and `node scripts/lint-no-raw-html.mjs` both re-verified exit 0 at continuation resume.
</content>
