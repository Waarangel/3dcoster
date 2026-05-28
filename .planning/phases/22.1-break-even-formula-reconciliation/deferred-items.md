# Phase 22.1 Deferred Items

Items discovered during plan 22.1-01 execution that are out of scope for this
plan. Logged per executor Rule 1 (scope boundary).

## Pre-existing test infrastructure issues in worktree

Two test files and the TypeScript build report failures NOT caused by any
22.1-01 change. They are caused by missing `node_modules` packages in this
worktree's install:

1. **`src/pdf/generateQuotePdf.test.ts`** — fails to resolve
   `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, and `jspdf-autotable`.
   Pre-existing in this worktree (these packages are not installed under
   `node_modules/`).
2. **`src/components/JobsManager.test.tsx`** — fails to resolve `react-window`.
   Pre-existing (package not installed under `node_modules/`).
3. **`npx tsc -b`** — reports 22 pre-existing errors, all in `src/pdf/` and
   `vite.config.ts`, caused by the same missing packages plus
   `rollup-plugin-visualizer`. None of the 22 errors reference the four
   files modified by plan 22.1-01 (`src/types.ts`, `src/db/backfill.ts`,
   `src/db/backfill.test.ts`, `src/hooks/useDatabase.ts`).

These are environment-setup issues for the worktree, not Phase 22.1 work.
The orchestrator should install missing dependencies before the full suite
green-gate, or the worktree should be re-spawned after `npm install` runs
in the main checkout.

Plan 22.1-01's own scoped verification — `npm test -- backfill.test.ts` —
passes cleanly: 53/53 tests, including all 4 new `reconcileFixedCostsAtSave`
cases.
