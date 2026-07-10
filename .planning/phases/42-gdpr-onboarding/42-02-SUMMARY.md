---
phase: 42-gdpr-onboarding
plan: 02
subsystem: ui
tags: [onboarding, react-hooks, dexie, first-run, wizard]

# Dependency graph
requires: []
provides:
  - "UserProfile.onboardingStep + onboardingCompletedAt fields (no Dexie migration, DB at v12)"
  - "useOnboarding hook: step/isDone/shouldShow/advanceStep/complete/skip derivation over useUserProfile + usePrinterInstances"
  - "OnboardingOverlay + OnboardingStep: 3-step guided first-run wizard mounted in App.tsx"
  - "'onboarding-wizard' NEW-badge registry key in features.ts"
affects: [42-03-legal-pages, 42-04-playwright-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Baseline-count-on-step-entry pattern: capture a live-query count (materials.length, jobs.length) in a ref when a step begins, advance when the count increases past it — needed because the printer/filament catalog is pre-seeded on a brand-new DB, so a raw count===0 check never fires for the filament/price-a-job steps"
    - "step > 0 override on an auto-skip gate: a derived shouldShow flag that both auto-skips a never-started wizard AND resumes a mid-progress one needs the auto-skip condition to stop applying once step has advanced past 0, otherwise the wizard's own first write (adding a printer) immediately re-triggers its own skip condition"

key-files:
  created:
    - src/hooks/onboarding/useOnboarding.ts
    - src/hooks/onboarding/useOnboarding.test.ts
    - src/components/onboarding/OnboardingOverlay.tsx
    - src/components/onboarding/OnboardingStep.tsx
    - src/components/onboarding/OnboardingOverlay.test.tsx
  modified:
    - src/types.ts
    - src/App.tsx
    - src/features.ts

key-decisions:
  - "shouldShow's auto-skip (instances.length===0) only applies while onboardingStep is still 0 (never started); once step > 0 the overlay stays visible/resumable regardless of owned-printer count — otherwise the wizard's own step-0 tile write immediately hides the overlay before the filament/price-a-job steps can show, breaking the locked 'resumes after reload' must-have"
  - "Filament/job step advance uses a baseline-count-on-entry pattern (capture count in a ref when the step is entered, advance when the live count increases past it) instead of a raw count===0 check, because both the printer and filament catalogs are auto-seeded into db.materials on a brand-new DB (see useAssets init in useDatabase.ts) — a raw empty-count check would never fire"
  - "Filament quick-add tiles advance directly (advanceStep(2)) without writing to Dexie, since the top-3 catalog filaments already exist in db.materials from the auto-seed — the tile is a confirmation, not an add. A genuinely new filament added via 'Mine isn't listed' still advances through the baseline-count effect"
  - "Step 2 (price-a-job) advance is keyed on useJobs().jobs.length increasing past its entry baseline (a saved job persists a computed cost) — the plan's 'first cost calculation appears' phrasing doesn't name a concrete hook, and a saved PrintJob is the only persisted signal available; ephemeral in-progress calculator state has no live-query hook to observe"
  - "Skip and 'Mine isn't listed' controls use the shared Button primitive (variant='ghost') instead of raw <button> elements, per the project's lint:no-raw-html gate and CLAUDE.md icon/button conventions — the plan's prose didn't specify primitive usage for these two controls"

patterns-established:
  - "Baseline-count-on-step-entry advance detection for wizard steps whose target collection is pre-seeded, not empty by default"

requirements-completed: [ONBD-01]

coverage:
  - id: D1
    description: "UserProfile gains onboardingStep/onboardingCompletedAt (optional, non-indexed, no Dexie migration) and useOnboarding derives step/isDone/shouldShow correctly, including auto-skip for a never-started wizard and resume for one already in progress"
    requirement: "ONBD-01"
    verification:
      - kind: unit
        ref: "src/hooks/onboarding/useOnboarding.test.ts (12 tests: isDone, shouldShow auto-skip/resume, step resolution, advanceStep/complete/skip persistence)"
        status: pass
    human_judgment: false
  - id: D2
    description: "OnboardingOverlay renders the current step via OnboardingStep, returns null when shouldShow is false, and every step exposes a skip control that triggers permanent completion"
    requirement: "ONBD-01"
    verification:
      - kind: unit
        ref: "src/components/onboarding/OnboardingOverlay.test.tsx (7 tests: visibility, skip affordance + completion, step content for all 3 steps, mine-isn't-listed navigation)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The wizard is mounted live in App.tsx (inside ToastProvider, wired to real navigateToTab), auto-skips for a returning user who already owns a printer, resumes a partially completed wizard across reloads, and never re-shows after completion/skip — verified end-to-end in a real browser session (clear IndexedDB, add printer/filament/job through the real UI, reload mid-wizard, reload after completion)"
    requirement: "ONBD-01"
    verification: []
    human_judgment: true
    rationale: "Full end-to-end behavior (real Dexie writes across reloads, real tab navigation, the completion toast firing at the right moment) requires a running browser session against the real app, not a mocked-hook unit test. tsc -b and the full 1159-test suite are green with the overlay live in App.tsx's existing tests, but the actual UAT walkthrough in the plan's <verification> section is deferred to /gsd-verify-work."

# Metrics
duration: ~35min
completed: 2026-07-10
status: complete
---

# Phase 42 Plan 02: Onboarding Wizard Summary

**Skippable, resumable 3-step guided first-run wizard (add printer → add filament → price first job) that navigates the real app UI via Phase 38 tab routing, writes through the real addInstance path, and persists progress in UserProfile.onboardingStep/onboardingCompletedAt with zero Dexie migration.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-10T06:58:00Z (approx, from session start)
- **Completed:** 2026-07-10T07:06:00Z
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- `UserProfile.onboardingStep`/`onboardingCompletedAt` added as optional, non-indexed fields — no Dexie version bump (DB stays at v12), mirroring the `taxJurisdiction` precedent
- `useOnboarding` hook derives `step`/`isDone`/`shouldShow`/`advanceStep`/`complete`/`skip` purely from the existing `useUserProfile` + `usePrinterInstances` hooks; auto-skip is keyed on OWNED printer instances (empty on first run), never the pre-seeded printer/material catalog
- `OnboardingOverlay` + `OnboardingStep` render the 3 real-UI steps as a floating card: printer step writes a real `PrinterInstance` via the same `addInstance` path `PrinterSettings` uses; filament/price-a-job steps use a baseline-count-on-entry pattern (materials.length / jobs.length) to detect a real add or saved job, since the catalog is pre-seeded and a raw empty-count check would never fire
- Every step always renders the skip control; skip and completion both persist `onboardingCompletedAt` so a returning/completed user is never re-shown or re-seeded (T-42-06)
- Mounted live in `App.tsx` inside `<ToastProvider>`, wired to the existing `navigateToTab`; registered `'onboarding-wizard'` in `features.ts` for the NEW-badge system
- Full test suite green (1159 passed, 1 todo, 96 files), `tsc -b` clean, `lint:no-raw-html` clean

## Task Commits

Each task was committed atomically (plus one necessary correctness fix discovered mid-Task-2):

1. **Task 1: UserProfile onboarding fields + useOnboarding hook + auto-skip/first-run detection** - `55e8ce4` (feat)
2. **Fix: resume mid-wizard despite auto-skip once a printer exists** - `3dbe7b9` (fix — Rule 2, see Deviations)
3. **Task 2: OnboardingOverlay + OnboardingStep — 3 real-UI steps, quick-add tiles, skip, completion toast** - `10b741b` (feat)
4. **Task 3: Mount overlay in App.tsx + register NEW badge in features.ts + wire tab navigation** - `8029dff` (feat)

_No TDD RED-only commits were needed — Task 1's tests were written and passed alongside the GREEN implementation in the same commit; Task 2's component tests likewise passed on first run._

## Files Created/Modified
- `src/types.ts` - `UserProfile.onboardingStep?: number` + `onboardingCompletedAt?: string`, non-indexed, no migration
- `src/hooks/onboarding/useOnboarding.ts` - pure derivation hook: step/isDone/shouldShow/advanceStep/complete/skip
- `src/hooks/onboarding/useOnboarding.test.ts` - 12 tests (isDone, shouldShow auto-skip + resume, step resolution, persistence)
- `src/components/onboarding/OnboardingStep.tsx` - presentational floating step card (skip, step indicator, tiles, secondary action, optional manual Next), uses the shared `Button` primitive throughout
- `src/components/onboarding/OnboardingOverlay.tsx` - container: consumes `useOnboarding` + real Dexie hooks, renders the current step, writes through the real `addInstance` path, baseline-count effects for filament/job steps
- `src/components/onboarding/OnboardingOverlay.test.tsx` - 7 tests (visibility, skip + completion, step content, mine-isn't-listed navigation)
- `src/App.tsx` - mounts `<OnboardingOverlay navigateToTab={navigateToTab} />` inside `<ToastProvider>`, after the main app tree
- `src/features.ts` - registers `'onboarding-wizard': new Date('2026-07-09')` in `featureReleases`

## Decisions Made
- `shouldShow`'s auto-skip only applies while `onboardingStep` is still 0 (never started); once `step > 0`, the overlay stays visible/resumable regardless of owned-printer count. See Deviations — this was a necessary fix, not part of the original plan text.
- Filament/job step advance uses a baseline-count-on-entry pattern (ref captured on step entry, advance when the live count increases past it), not a raw `count === 0` check, because both the printer and filament catalogs are auto-seeded into `db.materials` on a brand-new DB.
- Filament quick-add tiles advance directly (`advanceStep(2)`) without a Dexie write, since the top-3 catalog filaments already exist from the auto-seed — the tile is a confirmation tap, not an add. A genuinely new filament via "Mine isn't listed" still advances through the baseline-count effect.
- Step 2 (price-a-job) advance is keyed on `useJobs().jobs.length` increasing past its entry baseline (a saved job persists a computed cost) — the plan's "first cost calculation appears" phrasing names no concrete hook, and a saved `PrintJob` is the only persisted signal available.
- Skip and "Mine isn't listed" render via the shared `Button` primitive (`variant="ghost"`) instead of raw `<button>` elements, satisfying `lint:no-raw-html` and the project's icon/button conventions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Auto-skip broke wizard resume mid-flow**
- **Found during:** Task 2 (implementing OnboardingOverlay's step-0 → step-1 advance)
- **Issue:** Task 1's `shouldShow` formula (`instances.length === 0`) is a locked must-have for auto-skipping a returning user who already owns a printer — but it does not distinguish that case from a user who is mid-wizard and just added their FIRST printer via the wizard's own step-0 tile. The instant that write lands, `instances.length` goes from 0 to 1, `shouldShow` flips false, and the overlay would unmount before ever showing the filament/price-a-job steps — directly contradicting the plan's own locked must-have "A partially completed wizard resumes from the saved step after a reload."
- **Fix:** Added a `step > 0` override to `shouldShow`: auto-skip now only applies to a never-started wizard (`onboardingStep` still 0/unset). Once real progress exists (`step > 0`), the overlay stays visible and resumable regardless of owned-printer count. Verified this doesn't regress the literal Task 1 acceptance test (auto-skip with `onboardingStep` unset + an existing printer instance still returns `shouldShow: false`).
- **Files modified:** `src/hooks/onboarding/useOnboarding.ts`, `src/hooks/onboarding/useOnboarding.test.ts` (added a new resume-mid-wizard test)
- **Verification:** All 12 useOnboarding tests pass (11 original + 1 new), `tsc -b` clean.
- **Committed in:** `3dbe7b9` (standalone fix commit, landed between Task 1 and Task 2 since it corrects Task-1-owned files)

**2. [Rule 3 - Blocking] Raw `<button>` elements failed `lint:no-raw-html`**
- **Found during:** Task 2 commit (pre-commit hook)
- **Issue:** `OnboardingStep.tsx`'s skip control and "Mine isn't listed" secondary action were written as raw `<button>` elements, which the project's `lint:no-raw-html` git hook blocks for anything outside `src/components/ui/`.
- **Fix:** Replaced both with the shared `Button` primitive (`variant="ghost"`, `btnSize="sm"`, with compact padding overrides so they read as inline text controls rather than full-size buttons).
- **Files modified:** `src/components/onboarding/OnboardingStep.tsx`
- **Verification:** `lint:no-raw-html` passes; all 7 OnboardingOverlay tests (which query for these buttons by text content) still pass unchanged.
- **Committed in:** `10b741b` (Task 2 commit — fixed before the commit succeeded, no separate commit needed)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Deviation 1 was necessary to satisfy the plan's own locked must-have (resume after reload) that a literal reading of Task 1's shouldShow spec would otherwise have broken. Deviation 2 was a mechanical fix to satisfy an existing repo-wide lint gate. No scope creep — both fixes stay within the plan's own stated behavior contract.

## Issues Encountered
None beyond the two deviations above.

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- The onboarding wizard is fully wired and live in `App.tsx`; auto-skip, resume-after-reload, and permanent skip/completion are all covered by unit tests against mocked hooks.
- 42-03 (legal pages) and 42-04 (Playwright gate) have no code dependency on this plan.
- Full end-to-end verification (real browser, real IndexedDB, actual reload mid-wizard) is deferred to `/gsd-verify-work` per this plan's own `<verification>` section (D3 above) — the plan's UAT script (clear IndexedDB → reload → add printer/filament/job → reload) should be run there.

## Self-Check: PASSED

All 8 created/modified files verified present on disk. All 4 commit hashes (`55e8ce4`, `3dbe7b9`, `10b741b`, `8029dff`) verified present in git log.

---
*Phase: 42-gdpr-onboarding*
*Completed: 2026-07-10*
