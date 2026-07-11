---
phase: 42-gdpr-onboarding
plan: 05
subsystem: ui
tags: [onboarding, react-hooks, dexie, first-run, wizard, gap-closure, tdd]

# Dependency graph
requires:
  - phase: 42-gdpr-onboarding
    provides: "useOnboarding hook, OnboardingOverlay/OnboardingStep wizard, UserProfile.onboardingStep/onboardingCompletedAt (Plan 02)"
provides:
  - "Deterministic step-0 printer tile advance (await addInstance → advanceStep(1)) closing the tile-autoskip race diagnosed in .planning/debug/onboarding-tile-autoskip-race.md"
  - "Non-mocked real-Dexie (fake-indexeddb) integration test for OnboardingOverlay, guarding the tile-click → advance → reload-resume path that the mocked unit suite cannot observe"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic tile-advance pattern: a wizard quick-add tile that writes to Dexie should await the write then explicitly call the step-advance function itself, rather than relying on an effect that reacts to the SAME live-query signal that also gates the wizard's own visibility — avoids a same-render race between a reactive useLiveQuery value and a not-yet-updated one-shot profile state"
    - "Non-mocked real-Dexie (fake-indexeddb) integration test as the regression-proof for timing races invisible to fully-mocked unit tests (mirrors PrinterSettings.test.tsx precedent, applied here to a hook-composition race rather than a single-component form flow)"

key-files:
  created:
    - src/components/onboarding/OnboardingOverlay.integration.test.tsx
  modified:
    - src/components/onboarding/OnboardingOverlay.tsx
    - src/components/onboarding/OnboardingOverlay.test.tsx

key-decisions:
  - "Fix confined entirely to the step-0 tile onClick (await addInstance, then advanceStep(1)) — useOnboarding.ts's shouldShow formula and auto-skip machinery (D-09) are left byte-for-byte unchanged, per the plan's critical_constraints, so the pre-existing 12 useOnboarding.test.ts auto-skip/resume assertions needed zero edits"
  - "The pre-existing step-0 auto-advance effect (instances.length > 0 → advanceStep(1)) is kept in place, not removed, as a best-effort catch for a manual printer add via 'Mine isn't listed' → real Printers tab; advanceStep(1) is idempotent so the tile's deterministic call and the effect's fallback call can never double-advance or conflict"
  - "Task 1's real-Dexie integration test is self-contained per test (each test repeats the full tile-click flow rather than relying on state carried over from a prior test) since beforeEach clears all four Dexie tables before every test — this makes 'reload resumes at the filament step' robust to Vitest's per-test isolation contract instead of accidentally coupling to run order"

patterns-established:
  - "Deterministic-advance-over-effect-reaction: when a UI action both writes to a reactive Dexie store AND must advance app state gated on a derivation of that same store's live value, the write's own completion handler — not a passive effect watching the derived value — should trigger the state advance"

requirements-completed: [ONBD-01]

coverage:
  - id: D1
    description: "The step-0 quick-add printer tile awaits the printer write and then deterministically persists onboardingStep=1, so the wizard advances to the filament step instead of unmounting — closing the UAT-reported major gap"
    requirement: "ONBD-01"
    verification:
      - kind: integration
        ref: "src/components/onboarding/OnboardingOverlay.integration.test.tsx#tile click advances to the filament step AND persists onboardingStep"
        status: pass
      - kind: unit
        ref: "src/components/onboarding/OnboardingOverlay.test.tsx#clicking the first printer quick-add tile calls addInstance and advanceStep(1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A reload mid-wizard (fresh mount, hooks re-read from Dexie) resumes at the persisted filament step instead of losing progress"
    requirement: "ONBD-01"
    verification:
      - kind: integration
        ref: "src/components/onboarding/OnboardingOverlay.integration.test.tsx#reload resumes at the filament step"
        status: pass
    human_judgment: false
  - id: D3
    description: "Auto-skip (D-09) for a user who already owns a printer before the wizard ever starts is unchanged — useOnboarding.ts's shouldShow formula was not touched by this fix"
    requirement: "ONBD-01"
    verification:
      - kind: unit
        ref: "src/hooks/onboarding/useOnboarding.test.ts (12 tests, unmodified — all still pass, including auto-skip cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Non-mocked, real-Dexie (fake-indexeddb) integration test exists and is proven to have reproduced the exact reported bug (RED) before the fix landed (GREEN) — the diagnosed missing test"
    requirement: "ONBD-01"
    verification:
      - kind: integration
        ref: "src/components/onboarding/OnboardingOverlay.integration.test.tsx (2 tests, both failed pre-fix on the real assertions — missing settings row / empty overlay, not a setup error — and both pass post-fix)"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-07-11
status: complete
---

# Phase 42 Plan 05: Onboarding Tile-Autoskip Race Gap Closure Summary

**Step-0 printer quick-add tile now awaits `addInstance` then calls `advanceStep(1)` directly (mirroring the working step-1 filament tile), closing the same-render race between `shouldShow`'s `instances.length` check and the auto-advance effect that previously made the wizard unmount instead of advancing — proven by a new non-mocked, real-Dexie (fake-indexeddb) integration test written RED-first.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-11T13:19:00Z (approx)
- **Completed:** 2026-07-11T13:22:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Diagnosed root cause confirmed and closed: `useOnboarding.ts`'s `shouldShow` formula and `OnboardingOverlay.tsx`'s auto-advance effect both keyed off the identical `instances.length` 0→1 transition on the identical render, so the effect's `!shouldShow` guard short-circuited before `advanceStep(1)` could ever run — nothing persisted, and the overlay rendered `null` forever
- Step-0 tile `onClick` now `await`s `addInstance(instance)` then `await`s `advanceStep(1)` directly — a deterministic path that no longer depends on the racy effect, mirroring the non-racy step-1 filament tile's direct `advanceStep(2)` call
- New `OnboardingOverlay.integration.test.tsx` — a non-mocked, real-Dexie (fake-indexeddb) regression test — drives the REAL `OnboardingOverlay` + `useOnboarding` + `usePrinterInstances` + `useUserProfile` together (only `navigateToTab` stubbed); it reproduced the exact reported bug pre-fix (RED: `settings['userProfile']` row missing / overlay empty) and passes post-fix (GREEN: tile click advances to the filament step, `onboardingStep === 1` persisted, a simulated reload resumes at the filament step)
- `useOnboarding.ts`'s `shouldShow` formula and auto-skip machinery (D-09) left completely untouched — all 12 pre-existing `useOnboarding.test.ts` assertions pass unmodified, confirming no regression to a returning user who already owns a printer
- The existing step-0 auto-advance effect is preserved as a best-effort fallback for a manual printer add via "Mine isn't listed" → real Printers tab; `advanceStep(1)` is idempotent so the tile's deterministic call and the effect's fallback call cannot double-advance
- Full suite green (1168 passed, 1 todo, 99 files), `npx tsc -b` clean, `npm run build` clean

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: RED — real-Dexie (fake-indexeddb) integration regression test that reproduces the tile-autoskip race** - `c4271d7` (test)
2. **Task 2: GREEN — step-0 tile advances directly (await addInstance → advanceStep(1)); update mocked unit assertions; suite + build green** - `dd494b9` (fix)

## Files Created/Modified
- `src/components/onboarding/OnboardingOverlay.integration.test.tsx` - non-mocked real-Dexie integration test: tile-click → advance → persisted step; reload-resume at the filament step
- `src/components/onboarding/OnboardingOverlay.tsx` - step-0 tile `onClick` now `await`s `addInstance` then `await`s `advanceStep(1)`, with an explanatory comment on the deterministic-vs-fallback relationship to the existing auto-advance effect
- `src/components/onboarding/OnboardingOverlay.test.tsx` - added a mocked-harness assertion that the printer tile invokes `addInstance` once and `advanceStep(1)` directly (proves the onClick itself drives the advance, not a liveQuery transition)

## Decisions Made
- Fix confined entirely to the tile `onClick` — `useOnboarding.ts`'s `shouldShow` formula and auto-skip machinery are unchanged, per the plan's `critical_constraints`; zero edits needed to the 12 existing `useOnboarding.test.ts` assertions.
- The pre-existing step-0 auto-advance effect is kept as a fallback for the "Mine isn't listed" manual-add path; `advanceStep(1)`'s idempotency means the deterministic tile call and the fallback effect call can coexist safely.
- Each integration test is self-contained (repeats the full click flow) rather than depending on state carried over from a prior test, since `beforeEach` clears all Dexie tables before every test.

## Deviations from Plan
None - plan executed exactly as written. Both tasks matched their `<action>` and `<verify>` blocks with no unplanned fixes required.

## Issues Encountered
- The real-Dexie integration test emitted benign `"The current testing environment is not configured to support act(...)"` stderr warnings during the RED run (multiple concurrent real Dexie `useLiveQuery`/effect chains across `usePrinterInstances`/`useMaterials`/`useJobs`/`useUserProfile` racing ahead of the test's `waitForAsync` flushes). These warnings did not affect assertion correctness (RED failed on the intended assertions, not a setup error) and disappeared entirely once the fix landed and the async chain settled deterministically post-GREEN — no action needed.

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- The ONBD-01 onboarding wizard's step-0 → step-1 transition is now proven deterministic and reload-durable under a real Dexie regression test, closing the UAT-reported major gap (42-UAT.md test 1).
- Auto-skip (D-09) for a pre-existing printer owner remains fully covered and unregressed.
- Phase 42 (GDPR & Onboarding) remains a hard gate before Phase 43 (Pro Backend) — this gap-closure plan does not change that gate's status; re-run `/gsd-verify-work 42` or the phase's UAT script if a fresh sign-off pass is needed before declaring the phase done.

## Self-Check: PASSED

All 3 created/modified files verified present on disk. Both commit hashes (`c4271d7`, `dd494b9`) verified present in git log.

---
*Phase: 42-gdpr-onboarding*
*Completed: 2026-07-11*
