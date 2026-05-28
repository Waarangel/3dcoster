---
phase: 23-test-coverage-hardening
plan: 03
subsystem: testing
tags: [vitest, dexie, fake-indexeddb, migration, integration-test, indexeddb]

# Dependency graph
requires:
  - phase: 16-quotes-mvp
    provides: D-17 G7 backfill contract (3-job → 2-quote v7→v8 lock) and src/db/backfill.ts pure helper
  - phase: 20-currency-data-drift
    provides: DATA-03 v9 reconcileQuoteCurrency helper (kept at pure-helper layer in this plan)
  - phase: 23-test-coverage-hardening
    provides: D-04 (per-test fake-indexeddb scope), D-05 (full-file replacement), D-14 (same path), D-17 (G7 lock)
provides:
  - Real-Dexie v7→v8 integration test that exercises the actual upgrade transaction boundary
  - fake-indexeddb@^6.2.5 devDependency available for future migration tests
  - Pattern for per-test IndexedDB shim usage with zero global side effects
affects: [future-migration-tests, useDatabase.test.ts (potential v9 reconcile depth upgrade), any future Dexie schema version bump]

# Tech tracking
tech-stack:
  added:
    - "fake-indexeddb@^6.2.5 (devDependency only) — in-memory IndexedDB shim for Node test runs"
  patterns:
    - "Per-test fake-indexeddb shim: 'import \"fake-indexeddb/auto\"' as line 1 of a single test file, no vitest.setup.ts injection — D-04 blast-radius lock"
    - "Unique DB name per test via crypto.randomUUID() + afterEach Dexie.delete(dbName) cleanup — prevents cross-test state leakage in fake-indexeddb's in-memory store"
    - "Two-layer migration test contract: pure-helper coverage in src/db/backfill.test.ts is the FIRST line of defense; real-Dexie integration test echoes the SAME D-17 G7 assertions byte-identically at the transaction boundary"

key-files:
  created: []
  modified:
    - "package.json (fake-indexeddb devDep)"
    - "package-lock.json (fake-indexeddb resolved + integrity)"
    - "src/db/database.migrations.test.ts (FULL REPLACEMENT — fallback-mode → real-Dexie integration)"

key-decisions:
  - "Resolved fake-indexeddb to v6.2.5 (npm picked the latest in the v6.x range; >=6.0.0 satisfies Dexie v4 + IDB v3 compat per the plan's 23-CONTEXT.md D-04)"
  - "v9 currency reconcile describe block kept at the pure-helper layer per CONTEXT 'Claude's discretion' — reconcileQuoteCurrency is exhaustively covered in src/db/backfill.test.ts:515-583 (a real-Dexie depth upgrade would add no new signal under TEST-04 scope)"
  - "Test upgrade callback hardcodes currency='USD' (mirrors database.ts's fall-through default when no settings row exists) — the settings-read prelude in production is orthogonal to the D-17 G7 fixture contract being tested"
  - "v7 test schema includes only the tables the upgrade callback reads (jobs, sales) — minimal surface, no copy of production's full multi-store v7 declaration; the v8 quotes store uses the exact production schema string for indexes"

patterns-established:
  - "Per-test IndexedDB shim isolation: D-04 lock structurally enforced because vitest.setup.ts does not exist in the repo at all — there is no surface for global injection, and the single 'fake-indexeddb/auto' import in database.migrations.test.ts is the only place the shim is loaded"
  - "Migration test as 'echo' of the pure-helper contract: the 10 D-17 G7 assertion lines are byte-identical to src/db/backfill.test.ts:84-96 — any future drift between the integration boundary and the helper boundary fails BOTH suites together, making contract violations impossible to hide"

requirements-completed: [TEST-04]

# Metrics
duration: ~6min
completed: 2026-05-28
---

# Phase 23 Plan 03: Real-Dexie v7→v8 Migration Test Summary

**Promoted `src/db/database.migrations.test.ts` from pure-helper fallback to a real-Dexie integration test via `fake-indexeddb@^6.2.5` (devDep, per-test scope, zero global injection), locking the D-17 G7 3-job → 2-quote contract at the actual transaction boundary.**

## Performance

- **Duration:** ~6 min (excluding the upstream human-verify checkpoint wait)
- **Started:** 2026-05-28T14:41:50Z (post-approval)
- **Completed:** 2026-05-28T14:47:44Z
- **Tasks:** 3 (1 human-verify checkpoint + 2 atomic executor commits)
- **Files modified:** 3 (package.json, package-lock.json, src/db/database.migrations.test.ts)

## Accomplishments

- `fake-indexeddb@^6.2.5` installed as devDependency only (no production bundle change; verified `npm run build` still green at 56.4 KB gzipped main chunk).
- `src/db/database.migrations.test.ts` fully replaced (-83 / +120 lines) — fallback-mode pure-helper test removed; new test opens a real Dexie v7 fixture, seeds the locked 3-job-2-quote fixture, closes, reopens at v8 with an upgrade callback that mirrors `database.ts:122-141` (read jobs+sales via `tx.table`, invoke `backfillQuotesFromJobs(_, _, 'USD')`, bulkAdd to the v8 `quotes` store), then asserts `db.table('quotes').toArray()` matches the D-17 G7 contract byte-identically with `src/db/backfill.test.ts:84-96`.
- v9 currency reconcile coverage preserved at the pure-helper layer (the simpler, already-exhaustive contract — TEST-04 only mandated v7→v8 promotion).
- D-04 blast-radius lock structurally enforced: `vitest.setup.ts` does not exist in the repo, so there is no surface for global IndexedDB shim injection. `grep -cE "import 'fake-indexeddb/auto'" src/**/*.test.ts` returns 1 (only `database.migrations.test.ts`).
- `src/db/backfill.test.ts` is untouched (D-05): pure-helper coverage preserved as the first line of defense.

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify fake-indexeddb npm package legitimacy (blocking human-verify)** — no commit; resolved by orchestrator-approved `approved` signal
2. **Task 2: Add fake-indexeddb to devDependencies** — `021997b` (chore)
3. **Task 3: Promote database.migrations.test.ts to real-Dexie v7→v8 integration** — `bd028ff` (test)

_Note: Task 3 was a single atomic commit (full-file replacement) rather than RED/GREEN/REFACTOR per the plan's `<action>` directive ("Delete the existing file content ... write a new file from scratch"). The contract being tested (D-17 G7) is already locked at the pure-helper layer in `src/db/backfill.test.ts`, so the integration-depth promotion does not have a meaningful RED phase — the assertions pass before and after, only the data source changes from pure-helper return to real-Dexie `.toArray()`. The plan's verification commands (`npm test`, `npx tsc -b`, `npm run build`) serve as the green gate._

## Files Created/Modified

- `package.json` — Added `"fake-indexeddb": "^6.2.5"` to `devDependencies`.
- `package-lock.json` — Added fake-indexeddb resolved version + integrity hash (lockfile updated automatically by npm).
- `src/db/database.migrations.test.ts` — Full replacement: new top-of-file docstring (10 lines, replaces the old 27-line fallback-mode docstring); `import 'fake-indexeddb/auto'` as line 1; new `describe('v7→v8 quotes migration (D-17 G7) — real Dexie via fake-indexeddb', ...)` block that opens a real v7 Dexie database, seeds the locked fixture, closes, reopens at v8 with the upgrade callback, and asserts the 10 D-17 G7 contract lines byte-identically with `src/db/backfill.test.ts:84-96`; v9 reconcile block kept at pure-helper layer with explanatory docstring.

## Decisions Made

- **Kept v9 reconcile at the pure-helper layer.** Per CONTEXT "Claude's discretion" — `reconcileQuoteCurrency` is already exhaustively covered in `src/db/backfill.test.ts:515-583` (5 cases: USD→user-currency patch, non-USD untouched, idempotency, no-op when user is USD, all-fields preserved). TEST-04 only mandated v7→v8 promotion; promoting v9 too would add no new signal and would be net-negative complexity for the fake-indexeddb adoption.
- **Hardcoded currency='USD' in the test upgrade callback.** Production reads `settings.get('userProfile')` for the currency string, falling through to 'USD' on missing/corrupt rows. The D-17 G7 fixture in `backfill.test.ts:84-96` already asserts against the 'USD' branch (no settings row in the fixture), so mirroring that branch in the integration test keeps the assertion shape byte-identical. The settings-read prelude is orthogonal to the D-17 G7 fixture contract and would only add brittleness if duplicated in the test.
- **Minimal v7 test schema.** The production v7 schema declares 7 stores (materials, printers, printerInstances, jobs, sales, settings, customers). The test only declares `jobs` and `sales` because that's all the upgrade callback reads. The v8 declaration in the test adds `quotes` with the exact production schema string `'id, quoteNumber, status, printJobId, customerId, sentAt'` so any future production index change would naturally surface as a schema mismatch when this test is reviewed alongside `database.ts`.

## Deviations from Plan

### Acceptance criterion threshold inconsistency (no fix required)

**1. [Rule 1 - Plan Inconsistency] Acceptance criterion `grep -cE "expect\(v8Quotes" ... ≥ 7` is unsatisfiable when assertions are byte-identical to backfill.test.ts:84-96**
- **Found during:** Task 3 (post-write acceptance verification)
- **Issue:** The plan's `<action>` step 5C says "copy the 10 assertion lines from `src/db/backfill.test.ts:84-96` BYTE-IDENTICALLY". The source-of-truth file has only 3 lines that match the regex `expect(v8Quotes` (the `.length`, `.filter(converted).length`, and `.filter(draft).length` lines); the other 7 lines reference the destructured `converted` and `draft` variables (e.g. `expect(converted.printJobId).toBe('job-a')`). So byte-identical reproduction inherently yields 3 regex matches, not 7+.
- **Fix:** None — followed the `<action>` byte-identical directive (which is more specific than the count threshold). All 10 D-17 G7 assertion lines are present at `src/db/database.migrations.test.ts:152-164`, matching the backfill.test.ts pattern exactly. The literal "≥7" appears to be a planner miscount and is documented here so future reviewers know the intent (D-17 G7 lock) was satisfied even though the literal regex count is 3.
- **Files modified:** None (no fix applied).
- **Verification:** All 10 D-17 G7 assertion lines visible in the new file; identical to `backfill.test.ts:84-96`.
- **Committed in:** N/A (no fix needed — documentation-only deviation).

---

**Total deviations:** 1 documentation-only inconsistency in the plan's acceptance threshold (no code fix needed; `<action>` directive followed exactly).
**Impact on plan:** Zero — the D-17 G7 contract intent is fully satisfied. The plan's verification block has the canonical gates (`npm test`, `npx tsc -b`, `npm run build`) and all pass.

## Issues Encountered

- **`Dexie` import shape:** The production `database.ts` uses `import Dexie, { type EntityTable } from 'dexie'` (default + named type import); the plan and PATTERNS.md specify `import { Dexie } from 'dexie'` (named only). Verified via `node_modules/dexie/dist/dexie.d.ts:1194` (`export declare var Dexie: DexieConstructor`) that the named export is supported. Used the plan's specified form. No issue — both work.
- **Bash sandbox restricted compound commands:** A few exploratory `&&`-chained verifications (e.g. `npm ls fake-indexeddb && grep ... && grep ...`) were denied by the sandbox after the install; ran each step as a separate Bash call instead. No impact on the plan.

## Self-Check: PASSED

- **Files exist:**
  - `src/db/database.migrations.test.ts` — FOUND (modified, +120/-83)
  - `.planning/phases/23-test-coverage-hardening/23-03-SUMMARY.md` — FOUND (this file)
- **Commits exist:**
  - `021997b` (chore Task 2) — FOUND in `git log --oneline -3`
  - `bd028ff` (test Task 3) — FOUND in `git log --oneline -3`
- **D-04 lock:** `grep 'fake-indexeddb' vitest.setup.ts` returns 0 lines (file does not exist; structurally impossible to inject globally).
- **D-05 preservation:** `git diff src/db/backfill.test.ts` returns empty (pure-helper coverage untouched).
- **D-17 G7 contract:** All 10 assertion lines at `src/db/database.migrations.test.ts:152-164` are byte-identical to `src/db/backfill.test.ts:84-96`.
- **Blast radius:** Exactly 1 test file imports `fake-indexeddb/auto` (verified via `grep -cE "import 'fake-indexeddb/auto'" src/**/*.test.ts`).
- **Test gates:** `npm test -- src/db/database.migrations.test.ts` (3/3 pass) + `npm test` full suite (436/437 pass, 1 todo, 0 fail across 28 files) + `npx tsc -b` (clean) + `npm run build` (green).

## Next Phase Readiness

- TEST-04 closed. The v7→v8 upgrade transaction boundary is now defended at the integration depth in addition to the pure-helper depth.
- `fake-indexeddb@^6.2.5` is available in `devDependencies` for any future migration test that needs real-Dexie integration depth. The plan-deferred candidates (per existing breadcrumbs in `src/hooks/useDatabase.test.ts`) are: v9 currency-reconcile depth upgrade and the cross-tab rollback scenario in `useDatabase.test.ts:62-94, 201`. Neither is in scope for any current phase plan — they remain as TODO breadcrumbs.
- No production code changed (only devDeps + one test file). The existing release process and gates (`npm run build`, GitHub Actions release workflow, Tauri desktop build) are unaffected.

---
*Phase: 23-test-coverage-hardening*
*Completed: 2026-05-28*
