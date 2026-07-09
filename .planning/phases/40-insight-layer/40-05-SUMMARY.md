---
phase: 40-insight-layer
plan: 05
subsystem: ui
tags: [react, typescript, dexie, insights, what-if, simulator, git-worktree]

# Dependency graph
requires:
  - phase: 40-insight-layer (40-01)
    provides: computeScenario + buildCalcInputFromJob pure derivation utils in src/utils/insights.ts
  - phase: 40-insight-layer (40-03)
    provides: InsightsPanel orchestrator (own hooks, no data prop-drilling pattern)
  - phase: 40-insight-layer (40-04)
    provides: PrinterROI card precedent + InsightsPanel hook-reads pattern for supporting config
provides:
  - WhatIfSimulator shared Modal component with exactly three sliders (filament price, electricity rate, failure rate) and live delta chips vs the saved job
  - Two entry points into the same component (JobsManager job-row icon action, Insights tab job picker)
  - Archived Phase 33 GSD records on main (.planning/phases/33-insight-pricing-coach/), marked absorbed into Phase 40
  - ROADMAP.md corrected to net-profit wording (D-05) and Phase 33 note updated to reflect absorption + branch retirement
  - Phase 33 branch (feat/insight-pricing-coach) and its worktree formally retired, with an archive tag preserving history
affects: [40-phase-closure, 45-brand-launch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ephemeral local-state modal: WhatIfSimulator holds only useState seeded from the saved job; it never touches Dexie, so closing (Escape/outside-click) always discards the scenario with zero persistence risk"
    - "Shared-component, two-caller wiring: JobsManager and InsightsPanel each own their own open/close state but render the identical WhatIfSimulator, avoiding any component fork between entry points"
    - "Reconciliation-residual fix for scenario deltas: computeScenario's cost/fixed-cost basis was reconciled onto the exact figures the saved job used, so a slider at rest reports a true zero delta instead of a residual from a slightly different basis"

key-files:
  created:
    - src/components/insights/WhatIfSimulator.tsx
  modified:
    - src/components/JobsManager.tsx
    - src/components/insights/InsightsPanel.tsx
    - src/features.ts
    - src/utils/insights.ts
    - src/App.test.tsx
    - .planning/ROADMAP.md
    - .planning/phases/33-insight-pricing-coach/ (archived, new directory)

key-decisions:
  - "Archive tag `archive/phase-33-ui` created at the branch tip (bcea107) BEFORE any destructive git operation, so all 9 unmerged Phase 33 UI commits remain permanently reachable for Phase 45 reference even after the branch is deleted"
  - "Deliberately did NOT merge feat/insight-pricing-coach — its calculator-embedded UI is superseded by the Phase 40 Insights tab per D-15; only the pure math utils were ported (in 40-01), and that porting is what closes out Phase 33's scope"
  - "Branch retirement executed by the orchestrator under explicit user delegation ('do what you think is best to clean things up') rather than the user running the destructive commands themselves, since the plan's Task 5 checkpoint is human-action-gated specifically for this destructive step"

requirements-completed: [INS-03]

coverage:
  - id: D1
    description: "User can open a what-if simulator for a saved job from a JobsManager job-row icon action AND from a job picker inside the Insights tab — one shared component, identical behavior"
    requirement: "INS-03"
    verification:
      - kind: manual_procedural
        ref: "Task 4 human-verify checkpoint, steps 2 and 6 — approved after a fix round"
        status: pass
    human_judgment: true
    rationale: "Cross-entry-point behavioral parity on real seeded data requires a human driving both surfaces"
  - id: D2
    description: "The simulator has exactly three sliders — filament price, electricity rate, failure rate — and recomputes margin, profit, and break-even live as they move, showing each value's delta versus the saved job"
    requirement: "INS-03"
    verification:
      - kind: manual_procedural
        ref: "Task 4 human-verify checkpoint, steps 3-4 — approved after reconciliation-residual fix (12fd88b)"
        status: pass
    human_judgment: true
    rationale: "Live numeric plausibility and delta-chip readability need visual human confirmation, and the first pass surfaced a real defect (negative-profit baseline) that automated checks did not catch"
  - id: D3
    description: "The simulator lives in the shared Modal primitive (focus trap, Escape, aria) and closing it discards the scenario — no save, no persistence"
    requirement: "INS-03"
    verification:
      - kind: manual_procedural
        ref: "Task 4 human-verify checkpoint, steps 5 and 7 — approved"
        status: pass
    human_judgment: true
    rationale: "Focus-trap/keyboard behavior and post-close saved-job-unchanged verification require a human interacting with the live app"
  - id: D4
    description: "The simulator never writes to Dexie and never mutates the saved job"
    requirement: "INS-03"
    verification:
      - kind: other
        ref: "grep across WhatIfSimulator.tsx finds no db.* write and no onUpdateJob call"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase 33 branch records archived into main's .planning/phases/33-insight-pricing-coach/ marked 'absorbed into Phase 40', ROADMAP 'Phase 33 reserved' note updated, and ROADMAP Phase 40 success criterion 2 corrected to net-profit wording"
    requirement: "INS-03"
    verification:
      - kind: other
        ref: "test -f .planning/phases/33-insight-pricing-coach/SPEC.md && grep -q 'NET PROFIT' .planning/ROADMAP.md (Task 3 automated verify — OK)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phase 33 branch (feat/insight-pricing-coach) and its worktree are retired, with all unmerged history preserved via an archive tag"
    requirement: "INS-03"
    verification:
      - kind: other
        ref: "git worktree list (no 3DCoster-insight entry), git branch --list feat/insight-pricing-coach (empty), git rev-parse archive/phase-33-ui = bcea107 — all confirmed post-retirement"
        status: pass
    human_judgment: false
  - id: D7
    description: "npx tsc -b, lint, and the full vitest suite exit clean across all Task 1-2 files plus the fix round"
    requirement: "INS-03"
    verification:
      - kind: other
        ref: "npx tsc -b (exit 0), lint (exit 0), npx vitest run (1087 passed, 89 files)"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min active work (Tasks 1-3 + fix round) + human-verify checkpoint hold + orchestrator-executed branch retirement
completed: 2026-07-09
status: complete
---

# Phase 40 Plan 05: What-If Simulator Summary

**Modal-based what-if margin simulator with three sliders (filament price, electricity rate, failure rate) and live delta chips, wired identically from a JobsManager job row and an Insights job picker, closing out Phase 40 by archiving and retiring the superseded Phase 33 branch.**

## Performance

- **Duration:** ~25 min active implementation (Tasks 1-3), plus a fix round after Task 4 human verification surfaced real defects, plus Task 5 branch retirement executed by the orchestrator under explicit user delegation
- **Started:** 2026-07-08
- **Completed:** 2026-07-09
- **Tasks:** 5 (3 auto + 1 human-verify checkpoint + 1 human-action checkpoint)
- **Files modified:** 8 (1 created, 7 modified, 1 archived directory)

## Accomplishments
- Built `WhatIfSimulator` (`src/components/insights/WhatIfSimulator.tsx`): a Modal-based component owning its own supporting config (electricity, printers, materials, printer instances) via hooks, seeded from the saved job's stored filament price, TOU/electricity rate, and failure rate, with exactly three keyboard-operable range sliders and live margin/profit/break-even delta chips computed through `computeScenario` — no forked pricing math, no Dexie write, no `onUpdateJob` call
- Wired two entry points to the identical shared component: a `What-if` `IconButton` + `NewBadge` in JobsManager's job-row action cluster (mirroring the existing LogFailure pattern), and a job picker inside `InsightsPanel`
- Registered `'what-if-simulator'` in `src/features.ts` (2026-07-08, v2.0 Phase 40)
- Archived the Phase 33 (`feat/insight-pricing-coach`) GSD records into `.planning/phases/33-insight-pricing-coach/` on main via `git show`, annotated "Absorbed into Phase 40"; corrected `ROADMAP.md` Phase 40 success criterion 2 to net-profit wording (D-05) and updated the "Phase 33 reserved" note
- **Fix round after Task 4 human verification** surfaced four real issues, all resolved before re-approval:
  - `12fd88b` — reconciled `computeScenario`'s cost/fixed-cost basis onto the exact figures the saved job used, fixing a negative-profit baseline defect (a slider at rest was reporting a nonzero delta due to a reconciliation residual between two slightly different cost bases)
  - `9a1ce67` — fixed a tooltip that auto-opened on mount, fixed a zero-value flash on first render (bonus/seed values briefly showing 0 before the job's real stored values populated), and added explicit "Saved: $X" baseline-source labels next to each slider so the delta basis is never ambiguous
  - `8aee3cd` — mocked `useElectricitySettings`/`useMaterials` in `App.test.tsx` so the new hook reads inside `WhatIfSimulator` didn't break the existing test suite
- **Task 5 — Phase 33 branch retirement**, executed by the orchestrator under explicit user delegation ("do what you think is best to clean things up"):
  - Created `archive/phase-33-ui` tag at the branch tip (`bcea107`) FIRST, so all 9 unmerged Phase 33 UI commits remain permanently reachable
  - `git worktree remove /Users/marcusdickinson/Projects/3DCoster-insight` — succeeded, worktree was clean
  - `git branch -D feat/insight-pricing-coach` — deleted
  - Verified post-retirement: `git worktree list` no longer shows `3DCoster-insight`; `git rev-parse archive/phase-33-ui` = `bcea107e30f135e4f3555dd98423eac65343d6e3`
  - Deliberately did **not** merge the branch — its calculator-embedded UI is superseded by the Phase 40 Insights tab per D-15; only the pure utils were ported (40-01)
- Human-verify checkpoint (Task 4) presented and **approved** by the user after the fix round

## Task Commits

Each task was committed atomically:

1. **Task 1: WhatIfSimulator modal, three sliders, live delta chips** - `e5aa577` (feat)
2. **Task 2: Wire both entry points (JobsManager + Insights)** - `96d6dec` (feat)
3. **Task 3: Archive Phase 33 records + correct ROADMAP (D-15 + D-05)** - `ed39168` (docs)
4. **Task 4: Human-verify checkpoint** - fix round after initial review:
   - `12fd88b` (fix) - reconcile computeScenario's cost/fixed-cost basis to the saved job
   - `9a1ce67` (fix) - fix tooltip auto-open, seed flash, and add baseline labels
   - `8aee3cd` (fix) - mock useElectricitySettings/useMaterials in App.test.tsx
   - approved by user after these fixes
5. **Task 5: Phase 33 branch retirement** - no commit (git worktree/branch operations only, executed by orchestrator per user delegation); archive tag `archive/phase-33-ui` created locally

**Plan metadata:** (this commit) `docs(40-05): complete what-if-simulator-and-phase-closure plan`

## Files Created/Modified
- `src/components/insights/WhatIfSimulator.tsx` - Modal-based what-if simulator: three sliders, live computeScenario recompute, delta chips, ephemeral local state only
- `src/components/JobsManager.tsx` - What-if row IconButton + NewBadge, internal modal state, renders `<WhatIfSimulator>`
- `src/components/insights/InsightsPanel.tsx` - Job picker that opens the same `<WhatIfSimulator>`
- `src/features.ts` - Added `'what-if-simulator'` feature key
- `src/utils/insights.ts` - Reconciled `computeScenario`'s cost/fixed-cost basis to eliminate the at-rest delta residual
- `src/App.test.tsx` - Added `useElectricitySettings`/`useMaterials` mocks
- `.planning/ROADMAP.md` - Net-profit wording (D-05), Phase 33 note updated to reflect absorption and branch retirement
- `.planning/phases/33-insight-pricing-coach/` - Archived SPEC + 33-0x plan/summary docs, annotated "Absorbed into Phase 40"

## Decisions Made
- Archive tag `archive/phase-33-ui` created at the branch tip before any destructive git operation, preserving all 9 unmerged Phase 33 UI commits for Phase 45 reference
- Did not merge `feat/insight-pricing-coach` — its UI is superseded by the Phase 40 Insights tab (D-15); only the pure math utils were ported
- Branch retirement executed by the orchestrator under explicit user delegation rather than the user running the destructive commands manually — the plan's Task 5 human-action checkpoint exists specifically to gate this destructive step behind human authorization, which was given explicitly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reconciled computeScenario's cost/fixed-cost basis to the saved job**
- **Found during:** Task 4 human-verify checkpoint (user reported a negative-profit baseline defect)
- **Issue:** `computeScenario`'s at-rest (no-slider-movement) delta was nonzero because its internal cost/fixed-cost basis diverged slightly from the exact figures the saved job used, producing a misleading negative-profit baseline before any slider was touched
- **Fix:** Reconciled `computeScenario` in `src/utils/insights.ts` onto the saved job's exact cost/fixed-cost basis so a slider at rest reports a true zero delta
- **Files modified:** `src/utils/insights.ts`
- **Commit:** `12fd88b`

**2. [Rule 1 - Bug] Fixed tooltip auto-open and zero-seed flash; added baseline labels**
- **Found during:** Task 4 human-verify checkpoint (user reported an unclear slider basis, a tooltip that opened on its own, and a zero-value flash on first render)
- **Issue:** An `InfoTooltip` was auto-opening on mount instead of on hover/focus; bonus/seed slider values briefly rendered as 0 before the job's real stored values populated; and sliders had no visible "what am I comparing against" label
- **Fix:** Fixed the tooltip's open-state trigger, seeded slider state synchronously from the job on first render (eliminating the zero flash), and added explicit "Saved: $X" baseline-source labels next to each slider
- **Files modified:** `src/components/insights/WhatIfSimulator.tsx`
- **Commit:** `9a1ce67`

**3. [Rule 3 - Blocking] Mocked useElectricitySettings/useMaterials in App.test.tsx**
- **Found during:** Task 4 fix round (running the full suite after the above fixes)
- **Issue:** `WhatIfSimulator`'s new hook reads (electricity settings, materials) were unmocked in `App.test.tsx`, breaking existing App-level tests that render the component tree including `WhatIfSimulator`'s entry points
- **Fix:** Added mocks for `useElectricitySettings` and `useMaterials` in `App.test.tsx`
- **Files modified:** `src/App.test.tsx`
- **Commit:** `8aee3cd`

---

**Total deviations:** 3 auto-fixed (2 bugs surfaced by human verification, 1 blocking test fix)
**Impact on plan:** All three fixes were necessary for correctness (baseline accuracy, UX clarity) or to keep the existing test suite green. No scope creep — no new sliders, no persistence added, no fourth data source.

## Issues Encountered
None beyond the fix-round items documented above (which are tracked as deviations, not open issues — all resolved and re-verified before Task 4 approval).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 40 (Insight Layer) is now fully complete: all 5 plans across 4 waves shipped (INS-01, INS-02, INS-03)
- Phase 33's scope is formally closed: pure utils ported in 40-01, UI superseded by the Phase 40 Insights tab, branch retired with an archive tag (`archive/phase-33-ui` = `bcea107`) preserving history for Phase 45 reference if any Cost-Truth Dark redesign work wants to consult the original Phase 33 UI approach
- `npx tsc -b` clean, lint clean, full vitest suite green (1087 passed, 89 files) at close-out
- No blockers for Phase 41 (Quick-Win Features) or later phases

---
*Phase: 40-insight-layer*
*Completed: 2026-07-09*

## Self-Check: PASSED

All key files (WhatIfSimulator.tsx, JobsManager.tsx, InsightsPanel.tsx, features.ts, insights.ts, App.test.tsx) confirmed present on disk. All task commits (`e5aa577`, `96d6dec`, `ed39168`, `12fd88b`, `9a1ce67`, `8aee3cd`) confirmed present in `git log --oneline --all`. Archive tag `archive/phase-33-ui` confirmed at `bcea107e30f135e4f3555dd98423eac65343d6e3`. Worktree `3DCoster-insight` confirmed removed (`git worktree list`); branch `feat/insight-pricing-coach` confirmed deleted (`git branch --list` empty). `npx tsc -b`, lint, and full vitest suite (1087 passed, 89 files) re-verified clean.
