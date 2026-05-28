---
phase: 23-test-coverage-hardening
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/components/CustomerCsvImportModal.test.tsx
  - src/components/CustomerEditModal.test.tsx
  - src/components/CustomerEditModal.tsx
  - src/components/CustomerLibrary.test.tsx
  - src/components/JobsManager.test.tsx
  - src/db/backfill.test.ts
  - src/db/backfill.ts
  - src/db/database.migrations.test.ts
  - src/hooks/useDatabase.ts
  - src/utils/duplicateJob.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-05-28
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 23 ships six deliverables: D-01 email-lowercase normalization in `CustomerEditModal.tsx`, D-02 reconcile helper in `backfill.ts` + wiring in `useDatabase.ts`, three new Customer-UI test files (TEST-01/02/03), TEST-04 real-Dexie migration test, TEST-05 `dbJobsPutSpy` retype, and TEST-06 DUP-02 split. The implementation is broadly correct and follows established project patterns. No critical/blocker issues found.

Three warnings and three info items were identified. The most substantive is a false-positive test assertion in `CustomerEditModal.test.tsx` (WR-01): the `toContain('at least one of Name or Email')` check passes trivially because the identical text exists in a *static* helper paragraph always visible in the DOM, meaning the test cannot distinguish between the error banner appearing and normal form state. The other two warnings are a v7Db connection leak path in the migration test and a missing guard in the email reconcile useEffect that allows it to run when the customers array is frozen-empty (though idempotent).

D-04 lock is honored: `fake-indexeddb/auto` appears only in `src/db/database.migrations.test.ts` and nowhere in `vitest.setup.ts` (which does not exist). D-08 lock is honored: no `@testing-library` imports in any of the three new test files. WR-01 reconcile-flag hardening is correctly applied to `customerEmailLowercaseRan`. DUP-02 split (TEST-06) preserves all six `expect()` lines byte-identically. `dbJobsPutSpy` retype (TEST-05) is correct.

---

## Warnings

### WR-01: Validation-error assertion always passes — static helper text masks the check

**File:** `src/components/CustomerEditModal.test.tsx:196`
**Issue:** The test for "Name-OR-Email validation" asserts:
```typescript
expect(bodyText).toContain('at least one of Name or Email');
```
This assertion ALWAYS passes regardless of whether `handleSubmit` set `formError`, because `CustomerEditModal.tsx:99` renders a *static* helper paragraph with identical text (`Provide at least one of Name or Email.`) that is always in the DOM when `isOpen=true`. The test therefore cannot detect a regression where the validation branch silently removes the `setFormError(...)` call — `onSaveSpy.mock.calls.length === 0` (line 192) remains the only effective correctness guard for this scenario.

**Fix:** Assert on the dynamic error banner specifically, not the static helper:
```typescript
// Replace the toContain with a specific query for the dynamic error element
const errorBanner = document.body.querySelector('.bg-red-500\\/10');
expect(errorBanner).not.toBeNull();
expect(errorBanner!.textContent).toContain('Provide at least one of Name or Email to save.');
```
Alternatively: assert the form error text is distinct from the static helper, e.g. assert `toContain('to save.')` — that suffix appears only in the dynamic `formError` string (`CustomerEditModal.tsx:65`) and not in the static paragraph.

---

### WR-02: v7Db connection not tracked — unclosed if bulkAdd throws before `v7Db.close()`

**File:** `src/db/database.migrations.test.ts:112-120`
**Issue:** The `v7Db` local variable is created inside the `it` block and is not referenced by `afterEach`. If `v7Db.table('jobs').bulkAdd(...)` or `v7Db.table('sales').bulkAdd(...)` throws, execution skips `v7Db.close()` at line 120, leaving an open connection to `dbName`. The `afterEach` calls `Dexie.delete(dbName)`, which in real IndexedDB requires all connections to close first (triggers the `blocked` event and may hang or fail). With `fake-indexeddb` the risk is lower, but the pattern is non-robust and would cause a real-IDB hang if the test were ever promoted to a real database.

**Fix:** Wrap the v7 setup phase in a try/finally:
```typescript
const v7Db = new Dexie(dbName);
v7Db.version(7).stores({
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
});
try {
  await v7Db.open();
  await v7Db.table('jobs').bulkAdd([jobA, jobB, jobC]);
  await v7Db.table('sales').bulkAdd([saleA]);
} finally {
  v7Db.close();
}
```

---

### WR-03: Email-lowercase reconcile useEffect fires on frozen-empty customers array

**File:** `src/hooks/useDatabase.ts:821-844`
**Issue:** The new `customerEmailLowercaseRan` useEffect guards on `customers === undefined` (line 823) but not on an empty array. When Dexie emits `[]` (a user with zero customers), the effect enters the async block, calls `reconcileCustomerEmailLowercase([])`, gets back `[]` (patches), skips the `bulkPut`, and sets the flag. This is functionally correct because the helper is idempotent and the write is skipped. However, the `cancelled` guard at line 828 is only reached after the synchronous `reconcileCustomerEmailLowercase(customers)` call completes — there is no `await` between lines 827 and 828, so in practice the cancellation window between the reconcile call and the flag-set is zero ticks. This is not a bug, but the comment at line 832 ("if we returned early via the `cancelled` guard above, the flag stays false") is misleading: the `cancelled` return path exits BEFORE setting the flag, which is correct, but the comment implies a possible early-return from the `if (patches.length > 0)` block, which does NOT trigger `cancelled` — it falls through to line 834 and sets the flag unconditionally. The code is correct; the comment is slightly misleading.

**Fix:** Update the comment at lines 832-833 to accurately describe what "cancelled" covers:
```typescript
// WR-01: mark only on full completion. The `cancelled` guard at line 828
// covers the case where the cleanup function fired while the synchronous
// reconcile call was executing (timing gap exists even for sync calls due
// to React's concurrent-mode scheduling). If `patches.length === 0`, we
// still set the flag — nothing to write means the reconcile succeeded.
customerEmailLowercaseRan = true;
```

---

## Info

### IN-01: `mockResolvedValue()` without argument — minor vitest type mismatch

**File:** `src/components/CustomerEditModal.test.tsx:27`, `src/components/CustomerEditModal.test.tsx:45`, `src/components/CustomerCsvImportModal.test.tsx:23`, `src/components/CustomerCsvImportModal.test.tsx:36`
**Issue:** `vi.fn<(...) => Promise<void>>().mockResolvedValue()` is called with no argument. Vitest's `mockResolvedValue` is typed to require a value argument matching the resolved type. For `Promise<void>` this argument should be `undefined`. Calling with no argument works at runtime (resolves with `undefined`), but some stricter vitest/TypeScript version combinations emit a type error. This is the same pattern already established in `RecordSaleModal.test.tsx`, so it is a pre-existing convention rather than a new defect; however, the pattern propagates to three new files.
**Fix:** Pass explicit `undefined`: `mockResolvedValue(undefined)`. Low urgency since `Promise<void>` semantically permits this.

---

### IN-02: DUP-02 fixture `jobWithCustomerAndTaxRate` instantiated at `describe` scope — reconstructed on every `it` call

**File:** `src/utils/duplicateJob.test.ts:39-48`
**Issue:** `jobWithCustomerAndTaxRate` is declared at `describe` scope (not inside `beforeEach`) and `duplicateJob()` is called independently in each of the 6 `it` blocks. `duplicateJob` spread-copies its input so the shared fixture object is not mutated. This is safe under the current implementation. If a future change to `duplicateJob` caused it to mutate the input, all 6 tests would share the mutated object and produce confusing results. The D-09 `by-value isolation` suite already tests for input mutation, so the risk is theoretical.
**Fix:** No immediate change required. If a future test addition needs a fresh fixture, move the declaration inside `beforeEach`. Not blocking.

---

### IN-03: `CustomerLibrary.test.tsx` react-window mock does not match production `List` prop signature exactly

**File:** `src/components/CustomerLibrary.test.tsx:51-65`
**Issue:** The mock `List` accepts `{ rowCount, rowComponent, rowProps, style }` but the production `List` call at `CustomerLibrary.tsx:284-292` also passes `role`, `rowHeight`, and `overscanCount`. The mock silently ignores extra props via TypeScript's excess-property-check bypass (the function signature uses destructuring which drops unknown keys). This is intentional — the mock comment explains the zero-height viewport rationale. The `useDynamicRowHeight` mock returns `() => () => 88` meaning the hook call returns a function `() => 88`, which matches `rowHeight` being a function. This is correct. No functional issue; noting for awareness.
**Fix:** None needed. The mock accurately reflects the test's intent and the production prop names are irrelevant to the mock's rendering logic.

---

_Reviewed: 2026-05-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
