---
phase: 20-dexie-atomicity-audit
plan: "01"
subsystem: database
tags: [atomicity, dexie, transactions, data-integrity, DATA-01]
dependency_graph:
  requires: []
  provides: [DATA-01-closed, useDatabase-sale-tx-scaffold]
  affects: [src/hooks/useDatabase.ts, src/hooks/useDatabase.test.ts]
tech_stack:
  added: []
  patterns:
    - "db.transaction('rw', db.sales, db.jobs, async () => { ... }) — mirrors Convert-to-Sale at JobsManager.tsx:1490"
    - "Wave 0 jsdom IDB spike pattern: detect env capability before committing to test approach"
key_files:
  created:
    - src/hooks/useDatabase.test.ts
  modified:
    - src/hooks/useDatabase.ts
decisions:
  - "Wave 0 spike FAILED: jsdom lacks IndexedDB → call-order assertions only; rollback proof deferred to Phase 23 TEST-04 (fake-indexeddb)"
  - "Transaction table list: db.sales + db.jobs only (no db.quotes — mirrors DATA-01 requirement, not Convert-to-Sale)"
  - "Body logic verbatim in all three mutations — no refactoring of inner logic, only the transaction envelope added"
  - "makeMinimalJob/makeMinimalSale exported from test file for DATA-02 plan reuse"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-26"
  tasks_completed: 2
  files_modified: 2
---

# Phase 20 Plan 01: Wrap addSale/deleteSale/updateSale in Dexie transactions — DATA-01 Summary

**One-liner:** Atomic multi-store sale mutations via `db.transaction('rw', db.sales, db.jobs)` wrapping all three `useSales` hooks, closing CODE-AUDIT #4 (HIGH).

---

## What Was Built

Three sale mutation functions in `src/hooks/useDatabase.ts` were non-atomic: a tab crash or exception thrown between `db.sales.add/delete/put` and the subsequent `db.jobs.put` (copiesSold bump) left the database in a half-written state. The existing `reconcileCopiesSoldFromSales` self-heal at useDatabase.ts:470 masked this on next page load, but the data-integrity invariant was violated mid-flight.

Each mutation is now wrapped in `await db.transaction('rw', db.sales, db.jobs, async () => { ... })`, mirroring the in-production Convert-to-Sale template at `JobsManager.tsx:1490`. The transaction commits as a single atomic IDB unit — on failure the entire mutation rolls back.

### Files Changed

**`src/hooks/useDatabase.ts`** (addSale L573, deleteSale L588, updateSale L610):
- `addSale`: `db.sales.add` + `db.jobs.put` now wrapped in a single transaction
- `deleteSale`: `db.sales.delete` + `db.jobs.put` now wrapped in a single transaction
- `updateSale`: `db.sales.get/put` + `db.jobs.put` delta now wrapped in a single transaction
- No body logic changed — only the transaction envelope added
- No new imports
- Public Promise signature unchanged

**`src/hooks/useDatabase.test.ts`** (new file):
- Wave 0 spike test documenting jsdom IDB limitation
- 6 call-order assertion tests (3 mutations × 2 tests: order assertion + success-path sanity)
- `makeMinimalJob`/`makeMinimalSale` fixtures exported for DATA-02 plan reuse

---

## Wave 0 Spike Verdict

**FAILED — jsdom lacks IndexedDB.**

The IDB `add` call throws `"indexedDB is not defined"` before the transaction zone even starts in the jsdom test environment. The `vi.spyOn(db.jobs, 'put').mockRejectedValueOnce(...)` rollback assertion approach (RESEARCH.md A2) cannot be validated without real IndexedDB.

**Fallback applied:** Call-order assertions — `vi.spyOn(db, 'transaction')` proves the transaction envelope is correctly applied to each mutation with `('rw', db.sales, db.jobs, expect.any(Function))`.

**Atomicity proof deferred to Phase 23 TEST-04** when `fake-indexeddb` will enable real Dexie rollback assertions. The breadcrumb for the Phase 23 author is:
- Test file: `src/hooks/useDatabase.test.ts`
- Existing call-order tests in `describe('useSales transactions (DATA-01)')`
- Wave 0 verdict comment at the top of the file

---

## Tests Added

| Test | Describe | Behavior | Status |
|------|----------|----------|--------|
| jsdom IDB availability check | Wave 0 spike | Documents environment — always passes | ✅ |
| addSale: opens db.transaction over db.sales and db.jobs | DATA-01/addSale | Call-order: transaction called with correct args | ✅ |
| addSale: success path | DATA-01/addSale | Fixture sanity + API surface check | ✅ |
| deleteSale: opens db.transaction over db.sales and db.jobs | DATA-01/deleteSale | Call-order: transaction called with correct args | ✅ |
| deleteSale: success path | DATA-01/deleteSale | Fixture sanity + API surface check | ✅ |
| updateSale: opens db.transaction over db.sales and db.jobs | DATA-01/updateSale | Call-order: transaction called with correct args | ✅ |
| updateSale: success path (delta math) | DATA-01/updateSale | Delta arithmetic sanity | ✅ |

**Total: 7 tests** (1 Wave 0 spike + 6 mutation tests). All passing.

---

## Verification

- `npx vitest run src/hooks/useDatabase.test.ts` — 7/7 passing, ~560ms
- `npx tsc -b` — zero new errors introduced by this plan's changes (pre-existing errors in react-window, jspdf, Tauri modules are unrelated to this plan and present in the worktree environment prior to this work)
- `grep -c "db.transaction('rw', db.sales, db.jobs," src/hooks/useDatabase.ts` returns 4 (3 actual transaction calls + 1 comment reference — ≥ 3 required)
- Full suite: 20/22 test files passing (2 pre-existing failures: JobsManager.test.tsx missing react-window, generateQuotePdf.test.ts missing @tauri-apps modules — unrelated to this plan)

---

## Deviations from Plan

None — plan executed exactly as written.

The Wave 0 spike outcome (jsdom lacks IDB) was anticipated as one of two possible outcomes in the plan spec. The "fallback to call-order assertions" path was pre-described in the `<behavior>` block. No unexpected issues arose.

---

## Known Stubs

None. This is a hardening-only plan with no UI changes or data stubs.

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan wraps existing database writes in transactions — it reduces the attack surface by eliminating the mid-write partial state window.

Threat register items T-20-01-DATA-INTEGRITY and T-20-01-RACE-CONDITION from the plan's threat model are now mitigated: `addSale`/`deleteSale`/`updateSale` each run as atomic IDB transactions, eliminating the partial-write corruption vector and serializing concurrent writes within the transaction zone.

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (TDD RED) | 2b1416a | test(20-01): Wave 0 spike — document jsdom IDB limitation, add call-order test scaffold |
| Task 2 (TDD GREEN) | 20a0f14 | feat(20-01): wrap addSale/deleteSale/updateSale in db.transaction — DATA-01 |

---

## Self-Check

### Files exist:
- `src/hooks/useDatabase.test.ts` — ✅ FOUND
- `src/hooks/useDatabase.ts` (modified) — ✅ FOUND

### Commits exist:
- 2b1416a — ✅
- 20a0f14 — ✅

## Self-Check: PASSED
