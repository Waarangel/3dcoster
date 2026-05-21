---
phase: 12-schema-foundation
plan: 02
subsystem: database
tags: [dexie, vitest, testing, migration, indexeddb, typescript]

requires:
  - phase: 12-schema-foundation/12-01
    provides: "Phase 12 plan 01 (types.ts schema additions) — backfill.ts is consumed by Plan 03 which also imports from types.ts"

provides:
  - "Pure exported function `backfillTagsOnJob(job: Record<string, unknown>): void` in src/db/backfill.ts"
  - "5-case Vitest unit test suite for backfillTagsOnJob in src/db/backfill.test.ts (jsdom-safe, no Dexie import)"
  - "Automated coverage of SCHEMA-01 (b) — the v6 migration row-mutation body"

affects:
  - "12-schema-foundation/12-03 — Plan 03 imports backfillTagsOnJob from ./backfill and passes it as the modify() callback"
  - "Phase 15 (tags) — backfillTagsOnJob ensures all existing jobs have tags=[] before Phase 15 reads them"

tech-stack:
  added: []
  patterns:
    - "Pure helper extraction for jsdom-safe migration testing: extract modify() body into a zero-import pure function, test independently of Dexie"
    - "Sibling test placement: src/db/backfill.test.ts beside src/db/backfill.ts (no __tests__/ subfolder)"

key-files:
  created:
    - src/db/backfill.ts
    - src/db/backfill.test.ts
  modified: []

key-decisions:
  - "backfillTagsOnJob lives in its own module (not exported from database.ts) to keep it importable from jsdom tests without triggering new Dexie() side effects"
  - "Array.isArray guard (not ??=) — defends against non-array DevTools-edited corruption modes: null, string, number, object"
  - "Record<string, unknown> parameter type (not PrintJob) — honest: Dexie passes a proxy over a raw IndexedDB row at migration time, not a typed PrintJob"

patterns-established:
  - "Pattern: pure-function extraction of migration body for automated testing — avoids jsdom/IndexedDB incompatibility (RESEARCH Pitfall 3)"
  - "Pattern: zero-import helper file for DB utilities that need jsdom-safe unit tests"

requirements-completed:
  - SCHEMA-01

duration: 4min
completed: 2026-05-21
---

# Phase 12 Plan 02: backfillTagsOnJob Helper Summary

**Pure `backfillTagsOnJob` helper extracted into `src/db/backfill.ts` with 5 automated Vitest unit tests, converting SCHEMA-01 (b) from manual-UAT-only into an automated assertion**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-21T08:38:00Z
- **Completed:** 2026-05-21T08:40:15Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2 created

## Accomplishments

- Created `src/db/backfill.ts` — pure exported function `backfillTagsOnJob(job: Record<string, unknown>): void` with `Array.isArray` defensive guard and JSDoc with 5 input/output examples (per user-global CLAUDE.md Tool Usage Examples standard)
- Created `src/db/backfill.test.ts` — 5 Vitest cases covering missing field, array preserved, string corruption, null, and number corruption; all pass; sibling to source (no `__tests__/` subfolder)
- Both files have zero Dexie/database imports — fully jsdom-safe, no IndexedDB side effects on import
- Plan 03 (Wave 2) can now `import { backfillTagsOnJob } from './backfill'` and pass it as the `modify()` callback in the v6 upgrade block

## Task Commits

1. **Task 1: RED — backfill.test.ts (5 failing tests)** - `1b69d19` (test)
2. **Task 2: GREEN — backfill.ts implementation** - `f89c803` (feat)

## Files Created/Modified

- `src/db/backfill.ts` — pure `backfillTagsOnJob(job: Record<string, unknown>): void` helper; JSDoc with 5 examples; `Array.isArray` guard; zero imports
- `src/db/backfill.test.ts` — sibling test file at `src/db/` (not in `__tests__/`); 5 `it()` cases; imports only `vitest` + `./backfill`; no dexie/database imports

## Test File Details

Test file location: `src/db/backfill.test.ts` (sibling of source — matches repo convention; zero `__tests__/` folders in the project)

5 test case names:
1. `sets tags=[] when the field is missing (most common v5 path)`
2. `preserves an existing array of tags (idempotency / re-run safety)`
3. `replaces a string tags value with [] (manually-edited IndexedDB corruption)`
4. `replaces null tags with [] (null-injected row)`
5. `replaces a number tags value with [] (broad Array.isArray guard)`

## Implementation Details

Guard line in `backfill.ts`: `if (!Array.isArray(job.tags)) job.tags = [];`

This single statement handles all non-array corruption modes: `undefined` (missing field), `null`, `"string"`, `42`, `{}` — anything that is not an array gets replaced with `[]`.

## Decisions Made

- Placed `backfillTagsOnJob` in a standalone `src/db/backfill.ts` module (not exported from `database.ts`) so the test can import it without triggering `new Dexie('3DCosterDB')` at module top-level (RESEARCH Pitfall 4)
- Used `Record<string, unknown>` parameter type — Dexie's `modify()` callback receives a proxy over a raw IndexedDB row, not a typed `PrintJob`; this matches the v5 upgrade callback signature at `database.ts:57`
- 5 examples in JSDoc block (not the minimum 3) — covers all test-case corruption modes, making the docstring self-documenting

## Deviations from Plan

### Pre-existing Environment Issue (out of scope, not auto-fixed)

`npx tsc -b` exits non-zero in the worktree with errors in `AssetLibrary.tsx`, `JobsManager.tsx`, and `vite.config.ts` — `Cannot find module 'react-window'` and `Cannot find module 'rollup-plugin-visualizer'`. These packages are declared in `package.json` but are not installed in the worktree's `node_modules`. The errors are pre-existing (present before any file from this plan was written — confirmed by reverting all local changes and re-running `tsc -b`). The main project directory passes `tsc -b` cleanly. My new files (`backfill.ts`, `backfill.test.ts`) are referenced in zero `tsc -b` error lines. Logged to `deferred-items.md` for the orchestrator.

No auto-fixes applied to out-of-scope pre-existing errors per deviation scope boundary rules.

### Auto-fixed Issues

None — plan executed exactly as written.

## Issues Encountered

None beyond the pre-existing `tsc -b` environment issue documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 03 (Wave 2) can now `import { backfillTagsOnJob } from './backfill'` in `database.ts` and use it as the `modify()` callback in the v6 upgrade block
- `src/db/backfill.ts` is ready; no further changes to this file expected in Phase 12

---
*Phase: 12-schema-foundation*
*Completed: 2026-05-21*
