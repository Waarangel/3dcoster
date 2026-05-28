---
phase: 23-test-coverage-hardening
plan: "04"
subsystem: testing
tags: [vitest, typescript, test-hygiene, spy-typing, dup-02, lock-comment]

requires:
  - phase: 15-tags-search-quick-duplicate
    provides: "DUP-02 duplicateJob() contract and T-15-03 threat-model mitigation that the lock comment references"

provides:
  - "dbJobsPutSpy in JobsManager.test.tsx typed as PrintJob (not any) — TEST-05"
  - "DUP-02 D-15 locked contract split into 6 named it() blocks — TEST-06"
  - "D-10 lock comment rewrite: shape-vs-assertion distinction explicit, T-15-03 reference preserved"

affects: [23-test-coverage-hardening, future-JobsManager-tests]

tech-stack:
  added: []
  patterns:
    - "Spy typing: vi.fn<(arg: SpecificType) => Promise<void>>() — no any; matches RecordSaleModal.test.tsx:30"
    - "One it() per assertion in locked contracts — CI failure names the specific property"

key-files:
  created: []
  modified:
    - src/components/JobsManager.test.tsx
    - src/utils/duplicateJob.test.ts

key-decisions:
  - "TEST-05: retype spy from any to PrintJob; remove obsolete eslint-disable comment; drop undefined arg from mockResolvedValue() — matches canonical RecordSaleModal.test.tsx:30 pattern"
  - "TEST-06: split 6-assertion it() into 6 named it() blocks; each repeats const dup = duplicateJob(...) setup — shape refactor per D-09; all 6 expect() lines byte-identical"
  - "D-10 lock comment rewritten verbatim: documents that shape changes are allowed but assertion expressions are locked and T-15-03 threat-model mitigation is preserved"
  - "JobsManager.test.tsx was already failing pre-plan due to react-window not installed in worktree; confirmed pre-existing, not introduced by this plan"

patterns-established:
  - "Lock comment v2 shape: explicitly distinguishes assertion lock from shape lock, references threat-model mitigation"

requirements-completed: [TEST-05, TEST-06]

duration: 3min
completed: 2026-05-28
---

# Phase 23 Plan 04: Two Test Hygiene Fixes Summary

**`dbJobsPutSpy` retyped from `any` to `PrintJob` (TEST-05) and DUP-02 D-15 locked contract split from one 6-assert `it()` into 6 named `it()` blocks with D-10 lock comment rewrite (TEST-06)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-28T14:39:45Z
- **Completed:** 2026-05-28T14:42:36Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- TEST-05: `dbJobsPutSpy` in `JobsManager.test.tsx` now uses `vi.fn<(job: PrintJob) => Promise<void>>()` — typo-detection on `dbJobsPutSpy.mock.calls[0][0]` accesses is restored; obsolete `eslint-disable-next-line @typescript-eslint/no-explicit-any` comment removed
- TEST-06: Single 6-assertion `it()` block in `duplicateJob.test.ts` DUP-02 D-15 describe split into 6 named `it()` blocks (12 total tests passing, up from 7); all 6 `expect()` expressions byte-identical per D-09 lock
- D-10: Lock comment rewritten to verbatim D-10 text — explicitly states that assertion expressions are locked but shape refactoring is permitted, preserving T-15-03 threat-model reference

## Task Commits

Each task was committed atomically:

1. **Task 1: Retype dbJobsPutSpy in JobsManager.test.tsx — TEST-05** - `49b9e1f` (fix)
2. **Task 2: Split DUP-02 D-15 packed contract into 6 named it() blocks + rewrite lock comment — TEST-06** - `9d35246` (refactor)

**Plan metadata:** (final commit — this summary file)

## Files Created/Modified
- `src/components/JobsManager.test.tsx` — `dbJobsPutSpy` retyped from `any` to `PrintJob`; eslint-disable comment removed; `.mockResolvedValue(undefined)` → `.mockResolvedValue()`
- `src/utils/duplicateJob.test.ts` — lock comment rewritten per D-10; single `it()` split into 6 named `it()` blocks; all 6 `expect()` lines byte-identical

## Decisions Made
- TEST-05 and TEST-06 committed as separate commits for grep-ability in git log (per D-10 recommendation)
- `const dup = duplicateJob(jobWithCustomerAndTaxRate)` is repeated in each of the 6 `it()` blocks (permitted shape refactoring per D-09/D-10; fixture constant stays at describe scope)
- `JobsManager.test.tsx` test run was already broken before this plan due to `react-window` not installed in the worktree — confirmed pre-existing via baseline check; our type edit introduces no new failures

## Deviations from Plan

None — plan executed exactly as written.

The only notable observation: `npm test -- src/components/JobsManager.test.tsx` could not pass (pre-existing `react-window` missing from worktree node_modules). This is an environment issue pre-dating this plan, confirmed by running the test against the baseline commit before our edit. The TypeScript type edit is correct and all grep acceptance criteria pass; no new tsc errors were introduced.

## Issues Encountered
- `react-window` not installed in worktree node_modules — `JobsManager.test.tsx` fails at import resolution with "Failed to resolve import react-window". This was present on the baseline commit before any edits. The test was already broken; our change did not introduce this failure. The type fix (TEST-05) is verified via grep acceptance criteria and tsc diff.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- TEST-05 and TEST-06 are closed; CI signal quality improved
- TEST-01 through TEST-04 are handled by sibling Wave 1 plans (23-01, 23-02, 23-03)
- `react-window` package installation issue should be resolved before running the full test suite in this worktree

---
*Phase: 23-test-coverage-hardening*
*Completed: 2026-05-28*
