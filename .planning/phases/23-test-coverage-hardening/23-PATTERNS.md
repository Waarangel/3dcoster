# Phase 23: Test Coverage Hardening - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 10 (3 new test files, 1 file replacement, 6 modifications)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/CustomerEditModal.test.tsx` | test | request-response | `src/components/RecordSaleModal.test.tsx` | exact |
| `src/components/CustomerCsvImportModal.test.tsx` | test | request-response | `src/components/RecordSaleModal.test.tsx` | exact |
| `src/components/CustomerLibrary.test.tsx` | test | request-response | `src/components/RecordSaleModal.test.tsx` | exact |
| `src/db/database.migrations.test.ts` (REPLACE) | test | CRUD | `src/db/database.migrations.test.ts` (existing + `src/db/backfill.test.ts:46-110`) | exact |
| `src/components/CustomerEditModal.tsx` (MODIFY) | component | request-response | `src/components/CustomerEditModal.tsx` line 79 | self |
| `src/db/backfill.ts` (MODIFY) | utility | transform | `src/db/backfill.ts` — `reconcileCopiesSoldFromSales` / `backfillCustomersFromSales` | exact |
| `src/hooks/useDatabase.ts` (MODIFY) | hook | event-driven | `src/hooks/useDatabase.ts` lines 467-567 (copiesSold + fixedCosts reconcile useEffects) | exact |
| `src/components/JobsManager.test.tsx` (MODIFY) | test | request-response | `src/components/RecordSaleModal.test.tsx` line 30 | exact |
| `src/utils/duplicateJob.test.ts` (MODIFY) | test | transform | `src/utils/duplicateJob.test.ts` lines 35-55 (existing DUP-02 block) | self |
| `package.json` (MODIFY) | config | - | `package.json` devDependencies block | self |

---

## Pattern Assignments

### `src/components/CustomerEditModal.test.tsx` (test, request-response) — TEST-01

**Analog:** `src/components/RecordSaleModal.test.tsx`

**Imports pattern** (RecordSaleModal.test.tsx lines 1-4):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Customer } from '../types';
```

**Spy declarations BEFORE vi.mock** (RecordSaleModal.test.tsx lines 20-36):
```typescript
// ─── Spies (must be created before vi.mock factory references them) ────────
const onSaveSpy = vi.fn<(c: Customer) => Promise<void>>().mockResolvedValue();
const onCloseSpy = vi.fn<() => void>();
```
Rule: spies are module-scope `const` with explicit generic type signature. Declared BEFORE the `vi.mock` call — avoids vitest hoisting bugs (CONTEXT.md D-08, RecordSaleModal.test.tsx lines 23-37 pattern).

**vi.mock for useDatabase** (RecordSaleModal.test.tsx lines 46-64):
```typescript
vi.mock('../hooks/useDatabase', () => ({
  useCustomers: () => ({
    customers: [],
    customersByEmail: new Map(),
    isLoading: false,
    addCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
    bumpLastUsed: vi.fn(),
    bulkImportCustomers: vi.fn(),
  }),
}));
```
For CustomerEditModal TEST-01: no useDatabase mock needed (modal takes `onSave` as prop). The `vi.mock` block is omitted or minimal.

**Dynamic import AFTER mocks** (RecordSaleModal.test.tsx line 76):
```typescript
const { CustomerEditModal } = await import('./CustomerEditModal');
```
MUST be a top-level `await import(...)` after the `vi.mock()` calls — this is the vitest pattern for components that use mocked modules.

**DOM harness + beforeEach/afterEach** (RecordSaleModal.test.tsx lines 164-196):
```typescript
let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  onSaveSpy.mockClear();
  onCloseSpy.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});
```

**renderModal helper** (RecordSaleModal.test.tsx lines 206-221):
```typescript
async function renderModal(opts: RenderOpts = {}) {
  const props = {
    isOpen: true,
    onSave: opts.onSave ?? onSaveSpy,
    onClose: opts.onClose ?? onCloseSpy,
    initialCustomer: opts.initialCustomer ?? undefined,
  };
  await act(async () => {
    root!.render(<CustomerEditModal {...props} />);
  });
  return props;
}
```

**typeIntoInput + findButton helpers** (RecordSaleModal.test.tsx lines 223-236):
```typescript
function typeIntoInput(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButton(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === text,
  ) as HTMLButtonElement | undefined;
}
```

**Key test assertions for TEST-01 (email-lowercase lock)**:
The primary new assertion is the D-01 contract: after typing `John@Example.com` and clicking "Save customer", assert `onSaveSpy.mock.calls[0][0].email === 'john@example.com'`. Confirm `CustomerEditModal.tsx` line 79 has been changed from `email: email.trim() || undefined` to `email: email.trim().toLowerCase() || undefined` before writing this test.

**Props shape for CustomerEditModal** (from `src/components/CustomerEditModal.tsx` lines 5-10):
```typescript
interface CustomerEditModalProps {
  isOpen: boolean;
  initialCustomer?: Customer;
  onSave: (customer: Customer) => Promise<void>;
  onClose: () => void;
}
```

---

### `src/components/CustomerCsvImportModal.test.tsx` (test, request-response) — TEST-02

**Analog:** `src/components/RecordSaleModal.test.tsx`

Same scaffold as TEST-01 (spy declarations, dynamic import, beforeEach/afterEach, DOM harness). Adapt for this component's props shape.

**Props shape for CustomerCsvImportModal** (from `src/components/CustomerCsvImportModal.tsx` lines 22-27):
```typescript
interface CustomerCsvImportModalProps {
  isOpen: boolean;
  existingCustomers: Customer[];
  onImportCustomers: (toImport: Customer[]) => Promise<void>;
  onClose: () => void;
}
```

**Spy declarations** (declare before vi.mock, same pattern as RecordSaleModal.test.tsx lines 20-24):
```typescript
const onImportCustomersSpy = vi.fn<(toImport: Customer[]) => Promise<void>>().mockResolvedValue();
const onCloseSpy = vi.fn<() => void>();
```

**No useDatabase mock needed** — modal receives all data via props (`existingCustomers`, `onImportCustomers`). No vi.mock for hooks unless the component internally calls a hook beyond what props provide.

---

### `src/components/CustomerLibrary.test.tsx` (test, request-response) — TEST-03

**Analog:** `src/components/RecordSaleModal.test.tsx`

Same scaffold. Component receives all data via props — no hook mocking required.

**Props shape for CustomerLibrary** (from `src/components/CustomerLibrary.tsx` lines 12-20):
```typescript
interface CustomerLibraryProps {
  customers: Customer[];
  isLoading: boolean;
  onAddCustomer: (c: Customer) => Promise<void>;
  onUpdateCustomer: (c: Customer) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onBulkImportCustomers: (toImport: Customer[]) => Promise<void>;
}
```

**Spy declarations**:
```typescript
const onAddCustomerSpy = vi.fn<(c: Customer) => Promise<void>>().mockResolvedValue();
const onUpdateCustomerSpy = vi.fn<(c: Customer) => Promise<void>>().mockResolvedValue();
const onDeleteCustomerSpy = vi.fn<(id: string) => Promise<void>>().mockResolvedValue();
const onBulkImportCustomersSpy = vi.fn<(toImport: Customer[]) => Promise<void>>().mockResolvedValue();
```

**CL-01 sort-order lock** — TEST-03's primary assertion per CONTEXT.md canonical_refs §15.1-CONTEXT.md CL-01: customers with `lastUsedAt` desc, `undefined`-first. Provide a sorted fixture and assert the rendered order matches CL-01.

---

### `src/db/database.migrations.test.ts` (test, CRUD — FULL REPLACEMENT) — TEST-04

**Analog:** Current `src/db/database.migrations.test.ts` (to be REPLACED) + `src/db/backfill.test.ts` lines 46-110 for fixture shape.

**New file top-of-file import** (D-04 — scoped to this file only):
```typescript
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Dexie } from 'dexie';
```
`import 'fake-indexeddb/auto'` MUST be the very first import. No `vitest.setup.ts` injection — blast radius is this file only per D-04.

**D-17 G7 fixture** (from `src/db/backfill.test.ts` lines 46-110 — reuse verbatim):
```typescript
// Fixture factories — mirror backfill.test.ts:46-77 exactly
function makeJob(overrides: Partial<PrintJob>): PrintJob {
  return {
    id: 'job-x', name: 'Job X',
    createdAt: new Date('2026-04-01'), updatedAt: new Date('2026-04-01'),
    filaments: [], printTimeHours: 1, printerInstanceId: 'p-1',
    modelCost: 0, prepTimeMinutes: 0, postProcessingMinutes: 0,
    materialsUsed: [], failureRate: 0, costPerUnit: 1, sellingPrice: 10, copiesSold: 0,
    ...overrides,
  } as PrintJob;
}

function makeSale(overrides: Partial<Sale>): Sale {
  return {
    id: 'sale-x', jobId: 'job-x', quantity: 1, unitPrice: 10,
    totalRevenue: 10, soldAt: new Date('2026-04-05'),
    ...overrides,
  } as Sale;
}

// 3-job-2-quote fixture (D-17 G7 locked)
const jobA = makeJob({ id: 'job-a', quoteNumber: 42, sellingPrice: 100 });
const jobB = makeJob({ id: 'job-b', quoteNumber: 43, sellingPrice: 50 });
const jobC = makeJob({ id: 'job-c' });  // no quoteNumber — skipped
const saleA = makeSale({ id: 'sale-a', jobId: 'job-a', customer: { name: 'Alice', email: 'alice@example.com' } });
```

**Integration test pattern** — open v7 fixture, upgrade to v8, assert `db.quotes.toArray()`:
```typescript
describe('v7→v8 quotes migration (D-17 G7) — real Dexie via fake-indexeddb', () => {
  let db: Dexie;

  beforeEach(async () => {
    // Open at v7 schema; bulkAdd the 3-job-2-quote fixture; then close.
    db = new Dexie('test-3DCosterDB');
    db.version(7).stores({ jobs: 'id', sales: 'id' });
    await db.open();
    await (db as any).table('jobs').bulkAdd([jobA, jobB, jobC]);
    await (db as any).table('sales').bulkAdd([saleA]);
    await db.close();
  });

  afterEach(async () => {
    if (db.isOpen()) db.close();
    await Dexie.delete('test-3DCosterDB');
  });

  it('emits exactly 2 quotes with locked status mix after v7→v8 upgrade', async () => {
    // Reopen at v8 with upgrade callback that calls backfillQuotesFromJobs
    // (mirrors database.ts upgrade logic)
    // ... assert db.quotes.toArray() returns 2 rows, statuses converted + draft
  });
});
```
The assertion shape is byte-identical to `backfill.test.ts` lines 84-96 (the same D-17 G7 locked assertions).

**Existing assertions from backfill.test.ts lines 84-96 to reproduce in TEST-04**:
```typescript
expect(v8Quotes.length).toBe(2);
expect(v8Quotes.filter(q => q.status === 'converted').length).toBe(1);
expect(v8Quotes.filter(q => q.status === 'draft').length).toBe(1);

const converted = v8Quotes.find(q => q.status === 'converted')!;
expect(converted.printJobId).toBe('job-a');
expect(converted.convertedToSaleId).toBe('sale-a');
expect(converted.quoteNumber).toBe(42);

const draft = v8Quotes.find(q => q.status === 'draft')!;
expect(draft.printJobId).toBe('job-b');
expect(draft.convertedToSaleId).toBeUndefined();
expect(draft.quoteNumber).toBe(43);
```

---

### `src/components/CustomerEditModal.tsx` (component — MODIFY line 79) — D-01

**Change:** Single-line lowercase on email save. Current line 79:
```typescript
email: email.trim() || undefined,
```
New line 79:
```typescript
email: email.trim().toLowerCase() || undefined,
```
No other lines change. This aligns the modal with `customerCsv.ts:139-140` (UI-SPEC discretion #8).

---

### `src/db/backfill.ts` (utility — ADD helper) — D-02

**Analog:** `src/db/backfill.ts` — `reconcileCopiesSoldFromSales` (lines 414-432) and `backfillCustomersFromSales` (lines 309-389).

**New helper signature and docstring pattern** (mirror `reconcileCopiesSoldFromSales` lines 391-432):
```typescript
/**
 * reconcileCustomerEmailLowercase — Phase 23 D-02 one-time reconcile.
 *
 * Pure. Idempotent at the row level — rows whose email is already lowercase
 * or undefined are skipped. Returns ONLY the patched Customer rows (empty
 * array when nothing needs patching). No Dexie, no React, no IO.
 *
 * Examples:
 *   reconcileCustomerEmailLowercase([{ ...c, email: 'John@Example.com' }])
 *     → [{ ...c, email: 'john@example.com' }]
 *   reconcileCustomerEmailLowercase([{ ...c, email: 'john@example.com' }])
 *     → []  (already lowercase — idempotent)
 *   reconcileCustomerEmailLowercase([{ ...c, email: undefined }])
 *     → []  (no email — skip)
 */
export function reconcileCustomerEmailLowercase(customers: Customer[]): Customer[] {
  const out: Customer[] = [];
  for (const c of customers) {
    if (!c.email) continue;
    const lowered = c.email.toLowerCase();
    if (lowered === c.email) continue;  // idempotent: already canonical
    out.push({ ...c, email: lowered });
  }
  return out;
}
```

**Pattern rules** (from `reconcileCopiesSoldFromSales` and `backfillCustomersFromSales`):
- No Dexie imports — keeps module jsdom-safe (backfill.ts lines 4, 294, 435 all have this comment)
- Pure function — no IO, no side effects
- Returns ONLY the patched rows (not all rows) — callers do a conditional `bulkPut`
- Idempotent: rows already in canonical form contribute zero to the output array
- Spread-copy: `{ ...c, email: lowered }` — NEVER mutate the input (backfill.ts line 545 comment)

---

### `src/hooks/useDatabase.ts` (hook — ADD useEffect + module flag) — D-02

**Analog:** `src/hooks/useDatabase.ts` lines 518-567 (fixedCostsReconcileRan useEffect — best analog because it also reads `customers`/jobs within `useCustomers`) and lines 467-497 (copiesSoldReconcileRan).

**Module flag declaration** (mirror lines 21-27 of useDatabase.ts):
```typescript
// Phase 23 D-02 — process-lifetime flag for the email-lowercase reconcile.
// Same one-per-page-load pattern as the 4 existing reconciles above. Runs
// once inside useCustomers(); subsequent loads pay zero write cost because
// reconcileCustomerEmailLowercase is idempotent at the row level.
let customerEmailLowercaseRan = false;
```
Add immediately after `let fixedCostsReconcileRan = false;` (line 27).

**Import line update** (useDatabase.ts line 6):
```typescript
import { backfillCustomersFromSales, reconcileCopiesSoldFromSales, normalizeTagsOnJob, reconcileFixedCostsAtSave, reconcileCustomerEmailLowercase } from '../db/backfill';
```

**useEffect wiring inside `useCustomers()`** — place AFTER the existing `saleCustomerBackfillRan` useEffect (lines 773-797), BEFORE the `customersFrozen` useMemo (line 814). Mirror the copiesSold reconcile pattern (lines 467-498):
```typescript
// Phase 23 D-02: one-time reconcile to lowercase all customer email addresses
// in the library. Aligns db.customers with the CSV parser's canonical form
// (UI-SPEC discretion #8). Historical Sale.customer.email snapshots are NOT
// touched (CL-05 by-value lock). Guarded by customerEmailLowercaseRan so it
// runs exactly once per page load; helper is idempotent at the row level.
useEffect(() => {
  if (customerEmailLowercaseRan) return;
  if (customers === undefined) return;  // wait for the first liveQuery emission
  let cancelled = false;
  (async () => {
    try {
      const patches = reconcileCustomerEmailLowercase(customers);
      if (cancelled) return;  // do NOT set flag — never wrote
      if (patches.length > 0) {
        await db.customers.bulkPut(patches);
      }
      // WR-01: mark only on full completion. If we returned early via the
      // `cancelled` guard above, the flag stays false so a future mount retries.
      customerEmailLowercaseRan = true;
    } catch (err) {
      // Reconcile failures must NOT break the app — the picker still works
      // against mixed-case emails (customersByEmail already lowercases keys).
      // Flag stays false — next mount retries.
      console.error('customerEmailLowercase reconcile failed:', err);
    }
  })();
  return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [customers === undefined]);
```

**WR-01 rule** (from CONTEXT.md canonical_refs and useDatabase.ts lines 486-488, 555-557, 602-604): set `*Ran = true` AFTER `await` on the final write completes, NOT before. The `cancelled` early-return guard must NOT set the flag. The `saleCustomerBackfillRan` useEffect at line 776 sets the flag BEFORE the async block (pre-WR-01) — the new reconcile MUST follow the WR-01 pattern from copiesSoldReconcileRan and fixedCostsReconcileRan instead.

---

### `src/components/JobsManager.test.tsx` (test — MODIFY line 65) — TEST-05

**Change:** Single-line retype of `dbJobsPutSpy`. Current line 65:
```typescript
const dbJobsPutSpy = vi.fn<(job: any) => Promise<void>>().mockResolvedValue(undefined);
```
New line 65 (mirror RecordSaleModal.test.tsx line 30):
```typescript
const dbJobsPutSpy = vi.fn<(job: PrintJob) => Promise<void>>().mockResolvedValue();
```
Requires `PrintJob` to be present in the imports at the top of `JobsManager.test.tsx`. Check and add if missing.

**Pattern source** (RecordSaleModal.test.tsx line 30):
```typescript
const dbJobsPutSpy = vi.fn<(j: PrintJob) => Promise<void>>().mockResolvedValue();
```

---

### `src/utils/duplicateJob.test.ts` (test — MODIFY describe body) — TEST-06

**Current block to split** (duplicateJob.test.ts lines 35-56):
```typescript
describe('duplicateJob (DUP-02 D-15 locked contract)', () => {
  const jobWithCustomerAndTaxRate = makeMinimalJob({ ... });

  it('resets PII, tax, copiesSold, id; preserves tags (TAGS-F3)', () => {
    const dup = duplicateJob(jobWithCustomerAndTaxRate);
    expect(dup.customer).toBeUndefined();           // assertion 1
    expect(dup.taxRate).toBeUndefined();            // assertion 2
    expect(dup.copiesSold).toBe(0);                 // assertion 3
    expect(dup.id).not.toBe(jobWithCustomerAndTaxRate.id);        // assertion 4
    expect(dup.createdAt.getTime()).toBeGreaterThan(...);          // assertion 5
    expect(dup.tags).toEqual(jobWithCustomerAndTaxRate.tags);     // assertion 6
  });
});
```

**Target shape after split** (D-09/D-10): split the single `it` into 6 named `it` blocks; the 6 `expect()` expressions are byte-identical; only the fixture constant and `duplicateJob()` call are repeated per block. Update the lock comment per D-10 text.

**New lock comment** (D-10 exact text):
```typescript
// ---------------------------------------------------------------------------
// D-15 LOCKED test contract — CONTEXT.md lines 149-159 reproduced verbatim.
// Do NOT modify the assertion expressions below — they are the unit-test
// acceptance criteria for DUP-02 and are referenced by threat-model
// mitigation T-15-03. Shape refactoring (e.g., one it() per assertion,
// rename describe()) is permitted as long as every expect() line stays
// byte-identical and every threat-model mitigation remains locked.
// ---------------------------------------------------------------------------
```

---

### `package.json` (config — ADD devDependency)

**Change:** Add `fake-indexeddb` to devDependencies. The version must be compatible with Dexie v4 + IDB v3 (as documented in Dexie's README). Planner pins the version during implementation by running `npm install --save-dev fake-indexeddb` and verifying compatibility with the existing `dexie` version in package.json.

---

## Shared Patterns

### Test scaffold: raw `createRoot` + `act` (ALL 3 new test files)
**Source:** `src/components/RecordSaleModal.test.tsx` lines 1-196
**Apply to:** TEST-01, TEST-02, TEST-03
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) { act(() => { root!.unmount(); }); root = null; }
  if (container) { container.remove(); container = null; }
});
```
No `@testing-library/react`. Locked by Phase 19 D-21 and Phase 22 D-21.

### Spy typing pattern (ALL test files with db or hook spies)
**Source:** `src/components/RecordSaleModal.test.tsx` lines 21-30
**Apply to:** TEST-01, TEST-02, TEST-03, TEST-05 (JobsManager.test.tsx)
```typescript
// Typed spies — explicit generic, no `any`
const myActionSpy = vi.fn<(arg: SpecificType) => Promise<void>>().mockResolvedValue();
```
Spies MUST be `const` at module scope, declared BEFORE `vi.mock()` factory closure.

### Reconcile helper shape (backfill.ts new function)
**Source:** `src/db/backfill.ts` `reconcileCopiesSoldFromSales` lines 414-432 and `backfillCustomersFromSales` lines 309-389
**Apply to:** D-02 `reconcileCustomerEmailLowercase`
- Pure function, no Dexie import, no React import
- Returns `Customer[]` (ONLY patched rows)
- Idempotent: rows already canonical are skipped with a `continue`

### Reconcile useEffect wiring (useDatabase.ts)
**Source:** `src/hooks/useDatabase.ts` lines 518-567 (`fixedCostsReconcileRan` block)
**Apply to:** D-02 `customerEmailLowercaseRan` useEffect
- Guard: `if (flag) return; if (liveQueryData === undefined) return;`
- Cancellation token: `let cancelled = false;` + `return () => { cancelled = true; }`
- WR-01: set `*Ran = true` AFTER the final await, INSIDE the try block, NOT before
- `catch` block: `console.error(...)` only — never throw, never crash the UI
- dep array: `[liveQueryData === undefined]` — only re-evaluates on isLoading flip

### typeIntoInput DOM helper (ALL 3 new Customer-UI test files)
**Source:** `src/components/RecordSaleModal.test.tsx` lines 223-230
**Apply to:** TEST-01, TEST-02, TEST-03
```typescript
function typeIntoInput(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
```

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/components/`, `src/db/`, `src/hooks/`, `src/utils/`
**Files scanned:** 8 source files read directly
**Pattern extraction date:** 2026-05-28
