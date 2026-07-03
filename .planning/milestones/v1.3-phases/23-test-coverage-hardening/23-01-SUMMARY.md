---
phase: 23-test-coverage-hardening
plan: 01
subsystem: customer-library
tags: [test, customer, modal, reconcile, email-lowercase, D-01, D-02, D-03]
dependency-graph:
  requires:
    - reconcileCopiesSoldFromSales (analog shape for new helper)
    - fixedCostsReconcileRan (WR-01 useEffect pattern analog)
    - RecordSaleModal.test.tsx (test scaffold analog)
    - Modal primitive (Phase 19 — real primitive rendered per D-07)
  provides:
    - reconcileCustomerEmailLowercase pure helper
    - customerEmailLowercaseRan module flag + useEffect wiring in useCustomers
    - CustomerEditModal.test.tsx (first test coverage; locks D-01)
    - CustomerEditModal email lowercase canonicalization on save
  affects:
    - src/components/CustomerEditModal.tsx (handleSubmit one-line change)
    - src/db/backfill.ts (helper added)
    - src/db/backfill.test.ts (5 new it blocks)
    - src/hooks/useDatabase.ts (import + flag + useEffect)
tech-stack:
  added: []
  patterns:
    - Reconcile helper pattern (pure, no Dexie imports, returns patched-rows-only, idempotent)
    - WR-01 useEffect wiring (flag set AFTER bulkPut await, never before)
    - Raw createRoot + act test scaffold (D-08 — no @testing-library)
    - Real Modal primitive in tests (D-07 — Modal NOT stubbed)
key-files:
  created:
    - src/components/CustomerEditModal.test.tsx
    - .planning/phases/23-test-coverage-hardening/deferred-items.md
  modified:
    - src/db/backfill.ts
    - src/db/backfill.test.ts
    - src/components/CustomerEditModal.tsx
    - src/hooks/useDatabase.ts
decisions:
  - D-01 honored: CustomerEditModal.tsx line 79 canonicalizes email via email.trim().toLowerCase()
  - D-02 honored: reconcileCustomerEmailLowercase pure helper + customerEmailLowercaseRan module flag + WR-01-hardened useEffect in useCustomers
  - D-03 honored: Sale.customer.email NEVER touched (only db.customers rows). The 2 new "Sale.customer" mentions in useDatabase.ts are DOCUMENTATION COMMENTS explicitly affirming non-touch, not code that mutates Sale rows.
  - D-07 honored: real Modal primitive rendered in test (no stub); Escape exercised via document keydown to hit dialogA11y handler
  - D-08 honored: zero @testing-library imports; raw createRoot + act scaffold mirrors RecordSaleModal.test.tsx
  - D-11 honored: test file at src/components/CustomerEditModal.test.tsx (sibling to source)
metrics:
  duration: ~12 min
  completed: 2026-05-28
requirements: [TEST-01, TEST-02]
---

# Phase 23 Plan 01: Customer Email-Lowercase + First CustomerEditModal Coverage Summary

JWT-of-test-coverage: 3-piece atomic landing — email-lowercase canonicalization in modal (D-01) + reconcile helper for legacy IndexedDB rows (D-02) + first-ever CustomerEditModal.test.tsx (TEST-01) locks the D-01 contract.

## What Shipped

### 1. `reconcileCustomerEmailLowercase` pure helper (D-02)

New `export function reconcileCustomerEmailLowercase(customers: Customer[]): Customer[]` in `src/db/backfill.ts`. Placed AFTER `reconcileCopiesSoldFromSales` and BEFORE `reconcileFixedCostsAtSave` per 23-PATTERNS.md `reconcile-helper-shape`. Mirrors the analog's contract:

- Pure — no Dexie imports, no React imports, no IO
- Returns ONLY patched rows (empty array when nothing needs patching)
- Idempotent at the row level (rows already lowercase skip with `continue`)
- Spread-copy semantics — never mutates the input array

5 Vitest cases added to `src/db/backfill.test.ts` under
`describe('reconcileCustomerEmailLowercase (Phase 23 D-02)', ...)`:

1. Mixed-case email → patched row with lowercased email (output length 1)
2. Already-lowercase email → returns `[]` (idempotent)
3. Undefined email → skipped, returns `[]`
4. Mixed array (mixed-case, lowercase, undefined) → only the mixed-case row in output
5. Does NOT mutate input — input row's email still uppercase after the call

All 58 backfill tests pass (53 existing + 5 new).

### 2. `customerEmailLowercaseRan` useEffect wiring (D-02 + WR-01)

`src/hooks/useDatabase.ts`:

- Updated named-import line 6 to include `reconcileCustomerEmailLowercase`
- Added `let customerEmailLowercaseRan = false;` module flag immediately after `fixedCostsReconcileRan` declaration, with a comment block matching the existing flag-comment style
- New `useEffect` inside `useCustomers()` placed AFTER the `saleCustomerBackfillRan` useEffect and BEFORE the `customersFrozen` useMemo
- Pattern: mirrors `copiesSoldReconcileRan` (NOT `saleCustomerBackfillRan`, which is pre-WR-01)
- WR-01 hardening: `customerEmailLowercaseRan = true` is set ONLY AFTER `await db.customers.bulkPut(patches)` completes. The `cancelled` early-return guard does NOT set the flag. Catch block logs and does NOT set the flag — next mount retries.
- Cancellation token + `[customers === undefined]` dep array per 23-PATTERNS.md

### 3. `CustomerEditModal.tsx` email-lowercase save (D-01)

Single line change at line 79:

```diff
-        email: email.trim() || undefined,
+        email: email.trim().toLowerCase() || undefined,
```

No other line in the modal touched. Aligns the modal with `customerCsv.ts:139-140` (UI-SPEC discretion #8). The behavior is permanently locked by the new test file's Test #1.

### 4. `CustomerEditModal.test.tsx` — first coverage (TEST-01)

New file at `src/components/CustomerEditModal.test.tsx` (~278 lines, 7 `it()` blocks). Scaffold byte-for-byte mirrors `RecordSaleModal.test.tsx` per 23-PATTERNS.md:

- Imports: `vitest`, `react-dom/client` (`createRoot`, `Root`), `react` (`act`). Zero `@testing-library` imports.
- Spies declared at module scope BEFORE any dynamic import.
- No `vi.mock('../hooks/useDatabase')` — the modal does NOT import useDatabase; it receives `onSave` as a prop. (Verified by reading the modal source.)
- Top-level `await import('./CustomerEditModal')` after spy declarations.
- DOM harness: container + root with beforeEach/afterEach mount/unmount.
- `typeIntoInput`, `findButton` helpers copied verbatim from RecordSaleModal.test.tsx.
- `findInputByLabel` helper added — walks from visible label text to the associated input via `htmlFor`/`id` pairing (CustomerEditModal uses `useId()` IDs).
- `renderModal({ initialCustomer? })` helper.

**7 tests, all passing:**

1. **D-01 lowercase lock**: Type `John@Example.com` → click Save → assert `onSaveSpy.mock.calls[0][0].email === 'john@example.com'`. This is the primary new contract assertion.
2. **Add hydration**: `initialCustomer=undefined` → all 5 inputs (`name`, `email`, `company`, `address`, `notes`) have empty `.value`.
3. **Edit hydration**: `initialCustomer={ name: 'Alice', email: 'alice@x.com', company: 'Acme', ... }` → fields hydrate.
4. **Name-OR-Email validation**: Submit with both empty → `onSaveSpy` NOT called, error message `at least one of Name or Email` rendered. Implementation detail: clicked the submit button doesn't fire when disabled; the test dispatches `submit` directly on the `<form>` to exercise the `handleSubmit` validation branch.
5. **Submit-disable mid-flight**: Slow-resolving `onSave` (manually-resolvable Promise) → Save button `disabled=true` while in-flight.
6. **Escape close**: `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))` → `onCloseSpy` fires. Confirms the real `<Modal>` primitive's Escape handler (attached at `dialogA11y.ts:163`) is wired.
7. **Error recovery**: `onSave` rejects → error text `Could not save customer` renders, Save button re-enables (NOT showing `Saving...`).

## Verification Results

| Gate | Result |
|------|--------|
| `npm test -- src/db/backfill.test.ts` | 58/58 pass (5 new + 53 existing) |
| `npm test -- src/components/CustomerEditModal.test.tsx` | 7/7 pass |
| `npm test` (full suite) | 386 pass + 1 todo (27 test files pass, 2 pre-existing failures — see Deferred Issues) |
| `npx tsc -b` on plan 23-01 files (backfill.ts, backfill.test.ts, CustomerEditModal.tsx, CustomerEditModal.test.tsx, useDatabase.ts) | 0 errors from plan files |

## Deviations from Plan

None at the rule level. All three tasks executed as planned. Two non-blocking observations:

### `Sale.customer` grep count drift

Acceptance criterion in Task 2 specified: `grep -c 'Sale.customer' src/hooks/useDatabase.ts` should return the same count as before this task. Pre-task baseline: 1 hit (line 778 — pre-existing `Sale.customer` mention in the saleCustomerBackfillRan comment). Post-task: 3 hits.

The 2 new hits are BOTH in MY OWN DOCUMENTATION COMMENTS — lines 36 and 812 — that explicitly affirm D-03 compliance ("Sale.customer historical snapshots are NEVER touched"). No code path mutates `Sale.customer`. The acceptance criterion's intent (verify Sales are NOT touched) is fully satisfied; the literal grep count drift is purely documentary. This is the correct interpretation of D-03 because the planner explicitly required the WR-01 hardening pattern, which includes failure-mode commentary, and the cleanest way to affirm D-03 in code is to mention `Sale.customer` in the "what we do NOT touch" comment block.

### `@testing-library/react` substring in a comment

The original Task 3 test file had a comment "// NO @testing-library/react. Real <Modal> primitive..." that violated the literal `grep -c "@testing-library/react"` returning 0 acceptance criterion. Reworded the comment to "NO third-party testing-library imports" to satisfy the literal substring grep while preserving the documentation intent.

## Deferred Issues (pre-existing on parent commit, not introduced by 23-01)

Captured in `.planning/phases/23-test-coverage-hardening/deferred-items.md`:

- `src/components/JobsManager.tsx`: missing `react-window` types (verified against parent commit 5832646 — pre-existing)
- `src/pdf/generateQuotePdf.ts` + `.test.ts`: missing `jspdf-autotable`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs` (verified against parent commit 5832646 — pre-existing)

These 2 test-file failures + ~20 tsc errors exist on the parent commit BEFORE any of plan 23-01's work. They are out of scope per the executor's scope boundary rule (only auto-fix issues directly caused by current task's changes). The full `npm test` exit code is non-zero ONLY because of these pre-existing failures — every test file my plan touches passes green.

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `1d811dd` | `test(23-01): add reconcileCustomerEmailLowercase pure helper + 5 Vitest cases` |
| 2 | `b1b4027` | `feat(23-01): wire customerEmailLowercase reconcile + flip modal to lowercase` |
| 3 | `2496d4a` | `test(23-01): add CustomerEditModal.test.tsx — locks D-01 + 6 baseline behaviors` |

## Threat Flags

None. Plan 23-01 stays within the existing threat surface declared by `<threat_model>` in 23-01-PLAN.md. No new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. T-23-02 (Sale.customer info-disclosure) is mitigated as planned by the D-03 lock.

## Self-Check: PASSED

Files verified:
- `src/db/backfill.ts` — contains `export function reconcileCustomerEmailLowercase`
- `src/db/backfill.test.ts` — contains `reconcileCustomerEmailLowercase` import and 5 new test cases
- `src/components/CustomerEditModal.tsx` — line 79 contains `email: email.trim().toLowerCase() || undefined`
- `src/components/CustomerEditModal.test.tsx` — 278 lines, 7 it() blocks, zero @testing-library imports
- `src/hooks/useDatabase.ts` — contains `customerEmailLowercaseRan` flag + useEffect wiring + import update

Commits verified in `git log --oneline 5832646..HEAD`:
- `1d811dd` — Task 1
- `b1b4027` — Task 2
- `2496d4a` — Task 3
