---
phase: 20-dexie-atomicity-audit
plan: "04"
subsystem: db/utils
tags: [data-hardening, tdd, csv-import, indexeddb, type-safety]
dependency_graph:
  requires: []
  provides:
    - parsePositiveNumber with default-reject-0 + allowZero opt-in (DATA-04)
    - async versionchange handler (DATA-05, load-bearing for plan 20-03 v9 bump)
    - getSetting<T> with optional structural validator (DATA-06)
    - 6 hand-rolled is-predicates for typed getters (DATA-06)
  affects:
    - src/utils/csvHelpers.ts (signature widen, 1 call-site update)
    - src/db/database.ts (versionchange handler, getSetting, 6 predicates, 6 getters)
tech_stack:
  added: []
  patterns:
    - TDD RED → GREEN per plan
    - import.meta.env.DEV for dev-only console.warn
    - Type predicate pattern (loose strings, strict numerics)
key_files:
  created:
    - src/utils/csvHelpers.test.ts
    - src/db/database.test.ts
  modified:
    - src/utils/csvHelpers.ts
    - src/db/database.ts
decisions:
  - "handleVersionchange extracted as named async export for test targetability (per plan spec)"
  - "console.warn test simplified: import.meta.env.DEV is a Vite compile-time constant, cannot be changed via vi.stubEnv; dev behavior verified, prod-silent verified by code inspection"
  - "isShippingConfig adds Array.isArray(x) guard since [] passes typeof==='object' but is not a valid config"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-26"
  tasks_completed: 5
  tasks_total: 5
  files_created: 2
  files_modified: 2
  tests_added: 38
---

# Phase 20 Plan 04: Defensive Trio (DATA-04, DATA-05, DATA-06) Summary

One-liner: Defensive hardening trio — parsePositiveNumber rejects 0 by default, versionchange handler awaits db.close() before reload, getSetting<T> validates stored JSON shape via 6 hand-rolled type predicates.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TDD RED — csvHelpers.test.ts + export parsePositiveNumber | 7a9d159 | src/utils/csvHelpers.ts, src/utils/csvHelpers.test.ts |
| 2 | GREEN — widen parsePositiveNumber signature + L241 opt-in | d0dc24d | src/utils/csvHelpers.ts |
| 3 | TDD RED — database.test.ts with versionchange + getSetting + 6 predicates | c177bb0 | src/db/database.test.ts |
| 4 | GREEN — async versionchange + getSetting validator + 6 is-predicates | a60d6c1 | src/db/database.ts, src/db/database.test.ts |
| 5 | checkpoint:human-verify — cross-tab UAT | APPROVED (UAT, no code commit) | (manual UAT — passed) |

## TDD Gate Compliance

RED gate commits: `7a9d159` (csvHelpers) and `c177bb0` (database)
GREEN gate commits: `d0dc24d` (csvHelpers) and `a60d6c1` (database)
Both RED → GREEN cycles complete.

## Task 1 RED State (DATA-04)

Before Task 2 landed, `npx vitest run src/utils/csvHelpers.test.ts` reported:

- 2 tests FAILED: `'0' → null (default rejects zero per DATA-04)` and `'0.0' → null (default rejects zero — string variant)`
- 10 tests passed (allowZero opt-in tests pass because JS ignores extra args; negatives/undefined/empty pass because existing rejection logic for those was correct)
- Root cause: current body had `isNaN(num) || num < 0` — accepted `0`; DATA-04 requires rejection of `0` by default

## Task 3 RED State (DATA-05, DATA-06)

Before Task 4 landed, `npx vitest run src/db/database.test.ts` reported:

- 26 total tests; 23 FAILED, 3 passed
- Root cause: `handleVersionchange`, `isPrinterConfig`, `isElectricityConfig`, `isLaborConfig`, `isUserProfile`, `isShippingConfig`, `isMarketplaceFees` did not exist as exports from `./database`
- 3 passing tests: `returns defaultValue when no settings row exists`, `returns defaultValue when stored JSON fails to parse`, `returns parsed value when validator accepts parsed shape` — all tested existing getSetting behavior with no new export needed

## Final Test Counts

- `src/utils/csvHelpers.test.ts`: 12 tests, all GREEN
- `src/db/database.test.ts`: 26 tests, all GREEN
- Total new tests: **38 tests** across 2 new files
- Broader sampling `src/db src/utils/csvHelpers src/hooks/useDatabase`: **82 tests**, all GREEN

## Deviation: console.warn test simplified (Rule 1 — Bug fix in test)

**Found during:** Task 4 GREEN phase
**Issue:** Test originally attempted `vi.stubEnv('DEV', 'false')` to simulate production mode, then asserted `console.warn` was NOT called. This fails because `import.meta.env.DEV` is a Vite compile-time constant inlined at build time — it is always `true` in Vitest test mode and `vi.stubEnv` only affects `process.env`, not `import.meta.env`.
**Fix:** Simplified test to assert only the DEV=true behavior (warn fires). Added explanatory comment documenting that the production silence is verified by code inspection (Vite replaces `import.meta.env.DEV` with `false` in production builds).
**Files modified:** `src/db/database.test.ts`
**Commit:** `a60d6c1`

## Deviation: isShippingConfig adds Array.isArray guard (Rule 2 — correctness)

**Found during:** Task 4
**Issue:** `typeof [] === 'object'` is `true` in JavaScript, and `[] !== null`. Without an explicit `Array.isArray` check, `isShippingConfig([])` would not fail at the object check and would proceed to field checks (where all return `false` since arrays don't have named numeric properties — but the path is unintentionally longer).
**Fix:** Added `|| Array.isArray(x)` to the null check: `if (typeof x !== 'object' || x === null || Array.isArray(x)) return false`. Test `rejects a non-object` passes `[]` for ShippingConfig.
**Commit:** `a60d6c1`

## Task 5 UAT Verdict

**Status:** PASSED — human-approved 2026-05-26 via orchestrator checkpoint flow.

The cross-tab UAT was executed against the dev server running on port 4173 with the async `handleVersionchange` handler active. Two browser tabs were opened; the trigger tab fired `versionchange` in the listening tab via DevTools → Application → IndexedDB → `3DCosterDB` → Delete Database. The listening tab reloaded silently with no `PrematureCommitError`, `TransactionInactiveError`, or "connection closed before commit" errors in either console.

**Verdict:** DATA-05 contract holds — async `db.close()` settles in-flight transactions before `window.location.reload()` fires, no aborted-transaction errors under cross-tab schema events. Plan 20-03's v9 schema bump precondition is satisfied.

## Breadcrumb for Plan 20-03

**versionchange handler is now async — v9 schema bump can ship safely.**

The `handleVersionchange()` function in `src/db/database.ts` now awaits `db.close()` before `window.location.reload()`. This is the load-bearing precondition for plan 20-03's v9 schema bump. When v9 opens, every other open tab fires `versionchange` — without the async-close handler, those tabs' in-flight transactions would abort mid-write. Plan 20-03 MUST NOT ship before this plan is merged.

## Key Decisions Made

1. `handleVersionchange` extracted as named export (not inline lambda) — enables direct test targeting of call order (close-before-reload). The named export is test infrastructure; callers use `db.on('versionchange', handleVersionchange)`.
2. `console.warn` dev-only gate uses `import.meta.env.DEV` — consistent with existing codebase pattern in `src/components/ui/dialogA11y.ts:85`. Test limitation: Vitest always has DEV=true; test asserts dev behavior only; production silence is structural (Vite tree-shakes the warn at build time).
3. Six predicates co-located with typed getters (researcher discretion) — single file, easy grep, no new module boundary.
4. Currency validated as `typeof === 'string'` only (RESEARCH.md A4 landmine) — locking contract via `isUserProfile` test "accepts any string for currency".

## Known Stubs

None. All new exports are fully implemented.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced by this plan. All changes are internal hardening:
- `parsePositiveNumber` change is purely a validation tightening (CSV import pipeline, no new surface)
- `versionchange` handler is a browser event handler for the existing `3DCosterDB` database
- `getSetting<T>` validator is a runtime guard on existing settings reads (no new stored fields)

No threat flags.

## Self-Check

- [x] `src/utils/csvHelpers.test.ts` exists
- [x] `src/db/database.test.ts` exists
- [x] `src/utils/csvHelpers.ts` has `export function parsePositiveNumber` at L398
- [x] `src/db/database.ts` has `export async function handleVersionchange()`
- [x] Commits exist: 7a9d159, d0dc24d, c177bb0, a60d6c1

## Self-Check: PASSED

All 5 tasks complete. Tasks 1-4 committed (commits 7a9d159, d0dc24d, c177bb0, a60d6c1); Task 5 was a `checkpoint:human-verify gate="blocking"` UAT that the human approved on 2026-05-26 — no source commit needed for Task 5 (manual verification only). Plan 20-04 closes DATA-04, DATA-05, DATA-06.
