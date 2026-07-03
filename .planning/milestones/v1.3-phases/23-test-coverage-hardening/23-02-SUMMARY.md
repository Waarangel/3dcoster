---
phase: 23-test-coverage-hardening
plan: "02"
subsystem: customer-ui-tests
tags: [test, customer, csv, library, cl-01]
requirements: [TEST-02, TEST-03]

dependency_graph:
  requires: []
  provides:
    - TEST-02: first test coverage for CustomerCsvImportModal
    - TEST-03: first test coverage for CustomerLibrary + CL-01 sort lock
  affects:
    - src/components/CustomerCsvImportModal.tsx (covered, unchanged)
    - src/components/CustomerLibrary.tsx (covered, unchanged)

tech_stack:
  added: []
  patterns:
    - raw createRoot + act (D-08 lock, Phase 19/22 convention)
    - real Modal primitive in tests (D-07 lock)
    - vi.mock for react-window List to flatten virtualized rows in jsdom
    - vi.mock for db.sales to stub async count() on delete path

key_files:
  created:
    - src/components/CustomerCsvImportModal.test.tsx
    - src/components/CustomerLibrary.test.tsx
  modified: []

decisions:
  - react-window List mocked to render all rows flat — jsdom has no viewport height; production code unchanged
  - db.sales.filter().count() mocked to return 0 — avoids IndexedDB in test, props-only data flow preserved
  - simulateFileUpload uses click() for controlled radios/checkboxes — dispatchEvent('change') does not trigger React synthetic handlers

metrics:
  duration: ~6 minutes
  completed: 2026-05-28
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 23 Plan 02: Customer CSV Import Modal + Customer Library Tests Summary

**One-liner:** Two test files covering CustomerCsvImportModal (TEST-02, 6 tests) and CustomerLibrary (TEST-03, 7 tests including CL-01 sort lock), using raw createRoot + act with real Modal primitive; all 451 suite tests green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CustomerCsvImportModal.test.tsx — TEST-02 | 0e3c15f | src/components/CustomerCsvImportModal.test.tsx |
| 2 | CustomerLibrary.test.tsx — TEST-03 + CL-01 | f7af7e2 | src/components/CustomerLibrary.test.tsx |

## TEST-02: CustomerCsvImportModal.test.tsx

**6 `it()` blocks across 5 `describe` groups:**

1. Non-CSV file (name doesn't end .csv) shows "Please select a .csv file." error — `onImportCustomers` not called, modal stays on upload step
2. Valid CSV (header + 2 data rows) transitions from upload step to preview step — dedup-mode radio group and Import button appear
3. Dedup-mode toggle (skip → overwrite) increases import count from 1 to 2 when a duplicate row exists; toggling back restores count
4. Deselecting all checkboxes disables the Import button (importCount === 0)
5. Import call shape with 2 selected rows: `onImportCustomers` called once with array of 2 Customer-shaped objects (id, name/email present)
6. With dedup-mode=skip, duplicate rows excluded from import call (only fresh row in result)

**Scaffold:** Dynamic import after module-scope spies. `simulateFileUpload()` helper using `Object.defineProperty(input, 'files')` + dispatched change event + async flush. Controlled radio/checkbox interactions use `.click()` (not `dispatchEvent('change')`) to trigger React synthetic handlers.

## TEST-03: CustomerLibrary.test.tsx

**7 `it()` blocks across 5 `describe` groups:**

1. Search filter: typing "ali" into the search input hides Bob/Carol/Dave, keeps Alice
2. Empty state: `customers=[], isLoading=false` shows "No customers yet"
3. Loading state: `isLoading=true` shows skeleton, NOT the empty state title
4. **CL-01 sort lock**: 4-customer fixture (2 undefined lastUsedAt, 1 recent, 1 old) renders in order: Never Used A, Never Used B, Used Recently, Used Long Ago — matches `undefined-first then desc by lastUsedAt, tiebreaker name-asc`
5. Delete: `window.confirm` stubbed true → `onDeleteCustomer('c-del')` called once
6. Delete cancel: `window.confirm` stubbed false → `onDeleteCustomer` not called
7. Edit open/close: clicking Edit shows "Edit customer" modal; clicking Cancel removes it; `onUpdateCustomer` not called

**Key deviation from plan:** `react-window` `List` is vi.mocked to render all rows flat into the DOM. The plan suggested `container.style.height = '800px'` but in jsdom `70vh` evaluates to 0px regardless of container height, so the mock is the correct fix. The mock wraps react-window's `List` with a plain `<div role="list">` that renders all rows directly — production behavior unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] react-window not installed in worktree**
- **Found during:** Task 2 first test run
- **Issue:** `Failed to resolve import "react-window"` — worktree node_modules was nearly empty
- **Fix:** `npm install` to populate the worktree's node_modules
- **Files modified:** node_modules (not committed — gitignored)

**2. [Rule 1 - Bug] vi.mock for react-window needed instead of container height hack**
- **Found during:** Task 2 design
- **Issue:** Plan suggested `container.style.height = '800px'` but jsdom ignores `70vh` regardless of container height — react-window would still render 0 rows
- **Fix:** vi.mock for `react-window` renders all rows via a plain list wrapper. This is the established pattern for testing virtualized lists in jsdom.

**3. [Rule 1 - Bug] git stash pop created conflict in src/components/ui/index.ts**
- **Found during:** Task 1 tsc verification
- **Issue:** Pre-commit tsc check used `git stash` which conflicted with worktree-diverged file
- **Fix:** Resolved conflict by keeping the HEAD version (Modal + SidePanel exports preserved)
- **Files modified:** src/components/ui/index.ts (conflict resolution, content unchanged from HEAD)

## Gates Green

| Gate | Result |
|------|--------|
| `npm test -- CustomerCsvImportModal CustomerLibrary` | 13/13 pass |
| `npm test` (full suite) | 451 pass, 1 todo |
| `npx tsc -b` | Pre-existing errors only (react-window types, jspdf-autotable, @tauri-apps) — none introduced by this plan |
| `git diff --stat src/components/CustomerCsvImportModal.tsx src/components/CustomerLibrary.tsx` | Empty (production code byte-identical) |

## Known Stubs

None — both test files wire real data (props-only) and real assertions.

## Threat Flags

None — this plan adds only test files. Production code (CustomerCsvImportModal.tsx, CustomerLibrary.tsx) is byte-identical pre/post this plan. No new attack surface introduced.

## Self-Check: PASSED

- [x] `src/components/CustomerCsvImportModal.test.tsx` exists (282 lines)
- [x] `src/components/CustomerLibrary.test.tsx` exists (326 lines)
- [x] Commit 0e3c15f exists (Task 1)
- [x] Commit f7af7e2 exists (Task 2)
- [x] Full test suite green (451 tests)
- [x] Production code byte-identical (confirmed by empty `git diff`)
