# Phase 22: JobsManager decomposition + perf - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 11 (7 new + 4 major modifications)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/hooks/useCustomerPicker.ts` | hook | event-driven | `src/components/JobsManager.tsx:1080-1370` (picker state + keyDown) | exact |
| `src/hooks/useCustomerPicker.test.ts` | test | event-driven | `src/components/PrintQuoteModal.test.tsx` (createRoot+act, no RTL) | exact |
| `src/components/RecordSaleModal.tsx` | component | request-response | `src/components/PrintQuoteModal.tsx` (sibling modal with useCustomers + form state) | exact |
| `src/components/RecordSaleModal.test.tsx` | test | request-response | `src/components/PrintQuoteModal.test.tsx` (renderModal + createRoot+act) | exact |
| `src/components/SaleRow.tsx` | component | CRUD | `src/components/JobsManager.tsx:149-230` (`<QuoteRow>` per-row component pattern) | exact |
| `src/components/ui/icons/SearchIcon.tsx` | utility | — | `src/components/ui/icons/PackageIcon.tsx` (SVGProps function component) | exact |
| `src/components/ui/icons/index.ts` | config | — | `src/components/ui/icons/index.ts` (existing barrel, add one export) | exact |
| `src/hooks/useDatabase.ts` (add `useAllSales`) | hook | CRUD | `src/hooks/useDatabase.ts:569-650` (`useSales` / `useCustomers` pattern) | exact |
| `src/components/JobsManager.tsx` (shrink) | component | CRUD | self — removing picker triplet, inline modal, inline functions | n/a |
| `src/components/PrintQuoteModal.tsx` (migrate picker) | component | request-response | `src/hooks/useCustomerPicker.ts` (new hook it consumes) | n/a |
| `src/components/CustomerLibrary.tsx` (PERF-04) | component | CRUD | `src/components/JobsManager.tsx:1666-1668` (bi-key useDynamicRowHeight) | exact |

---

## Pattern Assignments

### `src/hooks/useCustomerPicker.ts` (hook, event-driven)

**Analog:** `src/components/JobsManager.tsx:1080-1370`

**Imports pattern** — copy from `src/hooks/useLocalStorage.ts:1` and `src/components/JobsManager.tsx:1`:
```typescript
import { useState, useMemo, useCallback } from 'react';
import type { Customer } from '../types';
```

**State triplet pattern** (`src/components/JobsManager.tsx:1080-1082`):
```typescript
const [customerPickerQuery, setCustomerPickerQuery] = useState('');
const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
const [customerPickerActiveIndex, setCustomerPickerActiveIndex] = useState(0);
```
In the hook, rename to `query`, `open`, `activeIndex` (short names; consumers destructure with their own aliases).

**filteredCustomers + visibleCustomers memos** (`src/components/JobsManager.tsx:1280-1293`):
```typescript
const filteredCustomers = useMemo<Customer[]>(() => {
  const q = customerPickerQuery.trim().toLowerCase();
  if (!q) return [];
  return customers.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q)
  );
}, [customers, customerPickerQuery]);

const visibleCustomers = useMemo<Customer[]>(
  () => filteredCustomers.slice(0, PICKER_VISIBLE_LIMIT),
  [filteredCustomers]
);
```

**handleKeyDown — the full 60-LOC handler, source of truth** (`src/components/JobsManager.tsx:1317-1370`):
```typescript
const handlePickerKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    // WR-04 fix: do not open an empty dropdown.
    if (visibleCustomers.length === 0) return;
    if (!customerPickerOpen) {
      setCustomerPickerOpen(true);
      setCustomerPickerActiveIndex(0);
    } else {
      setCustomerPickerActiveIndex(i => (i + 1) % visibleCustomers.length);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setCustomerPickerActiveIndex(i =>
      visibleCustomers.length === 0 ? 0 : (i - 1 + visibleCustomers.length) % visibleCustomers.length
    );
  } else if (e.key === 'Enter') {
    if (customerPickerOpen) {
      const picked = visibleCustomers[customerPickerActiveIndex];
      if (picked) {
        e.preventDefault();
        void handlePickCustomer(picked);
      } else if (customerPickerQuery.trim()) {
        e.preventDefault();
        setCustomerPickerOpen(false);
      }
    }
  } else if (e.key === 'Escape') {
    if (customerPickerOpen) {
      e.preventDefault();
      // CR-04 fix: prevent the surrounding Modal's document-level Escape
      // listener from also firing — without stopPropagation, Escape on the
      // picker would close the parent modal and lose the user's in-progress entry.
      e.stopPropagation();
      setCustomerPickerOpen(false);
    }
  } else if (e.key === 'Tab') {
    // Per UI-SPEC §5: Tab closes the dropdown and advances focus naturally (do NOT auto-pick)
    setCustomerPickerOpen(false);
  }
}, [customerPickerOpen, customerPickerActiveIndex, customerPickerQuery, visibleCustomers, handlePickCustomer]);
```

**Rename in hook:** Replace `customerPickerOpen` → `open`, `customerPickerQuery` → `query`, `customerPickerActiveIndex` → `activeIndex`. Update dep array identically.

**pick() + reset() pattern** (new in hook — derived from `JobsManager.tsx:1305-1314` pick-plus-reset inline):
```typescript
const pick = useCallback((c: Customer) => {
  onPick(c);
  setQuery('');
  setOpen(false);
  setActiveIndex(0);
}, [onPick]);

const reset = useCallback(() => {
  setQuery(''); setOpen(false); setActiveIndex(0);
}, []);
```

**PICKER_VISIBLE_LIMIT constant** (`src/components/JobsManager.tsx:993` — source to delete, move here):
```typescript
export const PICKER_VISIBLE_LIMIT = 8;
```
Export it; consumers that need the overflow-footer text import it from here.

**Return shape** (D-02, confirmed by research):
```typescript
return {
  query, open, activeIndex,
  visibleCustomers, filteredCustomers,
  setQuery, setOpen, setActiveIndex,
  handleKeyDown, pick, reset,
};
```

---

### `src/hooks/useCustomerPicker.test.ts` (test, event-driven)

**Analog:** `src/components/PrintQuoteModal.test.tsx`

**Import pattern** (`src/components/PrintQuoteModal.test.tsx:1-5`):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Customer } from '../types';
```

**Mock pattern** (`src/components/PrintQuoteModal.test.tsx:42-62`) — no `useDatabase` mock needed (hook takes customers as arg); no external deps to mock.

**Container setup pattern** (`src/components/PrintQuoteModal.test.tsx:155-176`):
```typescript
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

**Thin wrapper component for hook test** (research Pattern confirmed — no `renderHook`):
```typescript
function PickerHarness({ customers, onPick }: { customers: Customer[], onPick: (c: Customer) => void }) {
  const { query, open, activeIndex, handleKeyDown, pick, visibleCustomers } =
    useCustomerPicker(customers, { onPick });
  return (
    <div>
      <input
        data-testid="picker-input"
        value={query}
        onKeyDown={handleKeyDown}
        onChange={() => {}}
      />
      <span data-testid="open">{String(open)}</span>
      <span data-testid="active-index">{String(activeIndex)}</span>
      {visibleCustomers.map(c => (
        <button key={c.id} data-testid={`option-${c.id}`} onClick={() => pick(c)}>{c.name}</button>
      ))}
    </div>
  );
}
```

**Act-dispatch pattern** (`src/components/PrintQuoteModal.test.tsx:194-200`):
```typescript
function fireKeyDown(input: HTMLElement, key: string) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}
```

**Coverage targets** (research §Wave 0): ArrowDown open/cycle, ArrowUp wrap last→first, Enter-with-match calls onPick, Enter-with-no-match closes without calling onPick, Escape closes AND stops propagation (CR-04), Tab closes without picking, filteredCustomers empty on blank query, visibleCustomers sliced to PICKER_VISIBLE_LIMIT.

---

### `src/components/RecordSaleModal.tsx` (component, request-response)

**Analog:** `src/components/PrintQuoteModal.tsx`

**Imports pattern** (`src/components/PrintQuoteModal.tsx:1-9`):
```typescript
import { useEffect, useMemo, useCallback, useState } from 'react';
import type { PrintJob, UserProfile, ShippingConfig, Currency, Sale, Quote,
               MarketplaceType, ShippingMethodType, Customer } from '../types';
import { useSales, useCustomers } from '../hooks/useDatabase';
import { useCustomerPicker } from '../hooks/useCustomerPicker';
import { db } from '../db/database';
import { Button, Input, Select, Textarea, Modal } from './ui';
import { formatQuoteNumber } from '../utils/format';
import { formatCurrency } from '../utils/currency';
```
Note: `db` IS imported here (unlike `PrintQuoteModal`) because the Convert-from-Quote atomic transaction writes directly.

**Props interface pattern** (D-06 locked shape — no `customers`/`customersByEmail` props):
```typescript
interface RecordSaleModalProps {
  job: PrintJob;
  userProfile: UserProfile;
  userCurrency: Currency;
  shippingConfig: ShippingConfig;
  editingSale: Sale | null;
  convertingFromQuote: Quote | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}
```

**Internal subscription pattern** (`src/components/PrintQuoteModal.tsx:56-57`):
```typescript
const { customers, customersByEmail, bumpLastUsed, addCustomer } = useCustomers();
const { addSale, updateSale } = useSales(job.id);
```
Modal owns its own subscriptions — does NOT receive customers as props (D-06 decision).

**useCustomerPicker consumption pattern** (D-09 — hook drives picker, consumer fills form fields):
```typescript
const handlePickCustomer = useCallback((c: Customer) => {
  setSaleCustomerName(c.name ?? '');
  setSaleCustomerEmail(c.email ?? '');
  setSaleCustomerCompany(c.company ?? '');
  setSaleCustomerAddress(c.address ?? '');
  // D-05: DO NOT setSaleCustomerNotes — Notes is sale-level transaction context
}, []);
const picker = useCustomerPicker(customers, { onPick: handlePickCustomer });
```
Contrast with `PrintQuoteModal`'s `onPick` which also sets `setPickedExistingCustomerId(c.id)` — that is a PrintQuoteModal-only concept that must NOT be copied into the hook.

**Hydration effect pattern** (D-08 — keyed on editingSale/convertingFromQuote, NOT isOpen; Modal.tsx:67 unmounts children on close so reset-on-close is handled by unmount):
```typescript
useEffect(() => {
  if (editingSale) {
    setSaleQuantity(editingSale.quantity);
    setSalePrice(editingSale.unitPrice);
    // ... hydrate other fields from editingSale
  } else if (convertingFromQuote) {
    setSaleQuantity(1);
    setSalePrice(convertingFromQuote.lineItemsSnapshot.sellingPrice);
    // ... fill from quote snapshot
  } else {
    setSalePrice(job.sellingPrice);  // create mode defaults
    setSaleQuantity(1);
  }
}, [editingSale, convertingFromQuote, job.sellingPrice]);
```

**calculateMarketplaceFee at module scope** (PERF-03 — source at `JobsManager.tsx:1156-1165`):
```typescript
// Module scope — pure function, no React closures
function calculateMarketplaceFee(price: number, marketplace: MarketplaceType): number {
  switch (marketplace) {
    case 'facebook_shipped':
      return Math.max(0.80, price * 0.10) + price * 0.029;
    case 'etsy':
      return price * 0.065 + price * 0.03 + 0.45;
    default:
      return 0;
  }
}
```

**marketplaceFee useMemo** (PERF-02 — D-21):
```typescript
const marketplaceFee = useMemo(
  () => calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace),
  [saleQuantity, salePrice, saleMarketplace]
);
```
All three JSX sites that currently call `calculateMarketplaceFee` independently (`JobsManager.tsx:2061, 2064, 2070`) read `marketplaceFee` const instead.

**Modal wrapper pattern** (`src/components/JobsManager.tsx:1837-1848` — source structure to replicate):
```typescript
return (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={`${editingSale ? 'Edit Sale' : 'Record Sale'} - ${job.name}`}
    size="md"
  >
    <div className="p-4">
      {convertingFromQuote && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-xs text-blue-300 mb-3">
          Converting {formatQuoteNumber(convertingFromQuote.quoteNumber)} — review and adjust if needed.
        </div>
      )}
      {/* form body from JobsManager.tsx:1850-2091 */}
    </div>
  </Modal>
);
```
`size="md"` matches the existing Record Sale overlay (Phase 19 mapping). The `convertingFromQuote` blue banner is the first child — same visual order as today (Phase 19 D-17: no subtitle prop for this one case).

**Convert-from-Quote atomic transaction** (`src/components/JobsManager.tsx:1481-1516` — copy verbatim WITH comments):
```typescript
// D-20 atomicity: Sale.add + Quote.put + job.copiesSold bump run in ONE
// Dexie transaction. Rollback leaves NEITHER persisted on any mid-
// transaction failure.
//
// The job.copiesSold bump MUST live here (not via useSales().addSale)
// because addSale wraps its own implicit write — calling it inside this
// explicit transaction would either deadlock or fail to participate in
// the atomic rollback.
// [DO NOT REMOVE THIS BUMP]
if (convertingFromQuote) {
  const quotePatch: Quote & { status: RuntimeQuoteStatus } = {
    ...convertingFromQuote,
    status: 'converted',
    convertedAt: new Date(),
    convertedToSaleId: sale.id,
  };
  await db.transaction('rw', db.sales, db.quotes, db.jobs, async () => {
    await db.sales.add(sale);
    await db.quotes.put(quotePatch);
    const jobRow = await db.jobs.get(sale.jobId);
    if (jobRow) {
      await db.jobs.put({
        ...jobRow,
        copiesSold: jobRow.copiesSold + sale.quantity,
        updatedAt: new Date(),
      });
    }
  });
}
```
DO NOT substitute with `addSale()` — that creates a nested transaction deadlock over `db.quotes` which is not in `addSale`'s scope.

---

### `src/components/RecordSaleModal.test.tsx` (test, request-response)

**Analog:** `src/components/PrintQuoteModal.test.tsx`

**Import pattern** (`src/components/PrintQuoteModal.test.tsx:1-8`):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { PrintJob, UserProfile, ShippingConfig, Sale, Quote } from '../types';
```
No `@testing-library/react` — project precedent is raw `createRoot` + `act`.

**vi.mock pattern** (`src/components/PrintQuoteModal.test.tsx:42-62`):
```typescript
vi.mock('../hooks/useDatabase', () => ({
  useCustomers: () => ({
    customers: [seededCustomer],
    customersByEmail: new Map([[seededCustomer.email!.toLowerCase(), seededCustomer]]),
    isLoading: false,
    addCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
    bumpLastUsed: vi.fn(),
    bulkImportCustomers: vi.fn(),
  }),
  useSales: () => ({
    sales: [],
    addSale: addSaleSpy,
    updateSale: updateSaleSpy,
    deleteSale: vi.fn(),
  }),
}));
// Also mock db.transaction for Convert-from-Quote branch:
vi.mock('../db/database', () => ({
  db: {
    sales: { add: vi.fn() },
    quotes: { put: vi.fn() },
    jobs: { get: vi.fn().mockResolvedValue(null), put: vi.fn() },
    transaction: vi.fn((_mode, _tables, fn) => fn()),
  },
}));
```

**renderModal helper** (`src/components/PrintQuoteModal.test.tsx:179-192`):
```typescript
async function renderModal(opts: { job?: PrintJob; editingSale?: Sale | null; convertingFromQuote?: Quote | null } = {}) {
  const props = {
    job: opts.job ?? makeJob(),
    userProfile: makeUserProfile(),
    userCurrency: 'USD' as const,
    shippingConfig: makeShippingConfig(),
    editingSale: opts.editingSale ?? null,
    convertingFromQuote: opts.convertingFromQuote ?? null,
    isOpen: true,
    onClose: vi.fn(),
    onSaved: vi.fn(),
  };
  await act(async () => { root!.render(<RecordSaleModal {...props} />); });
  return props;
}
```

**Three modes to cover** (ROADMAP criterion #11):
1. Create mode — form submits, `addSale` called with correct Sale shape
2. Edit mode — form hydrated from `editingSale` prop, `updateSale` called
3. Convert-from-Quote — `db.transaction` spy verifies atomic tx fires (NOT `addSale`)

---

### `src/components/SaleRow.tsx` (component, CRUD)

**Analog:** `src/components/JobsManager.tsx:149-230` (`<QuoteRow>`)

**File structure pattern** (`src/components/JobsManager.tsx:149`):
```typescript
// Local non-exported component moved here from JobsManager.tsx:314-323
export function SaleFromQuoteSubtext({ convertedFromQuoteId, jobId }: {
  convertedFromQuoteId: string; jobId: string;
}) { /* ... */ }

interface SaleRowProps {
  sale: Sale;
  jobId: string;
  onEdit: (s: Sale) => void;
  onDelete: (s: Sale) => void;
}

export function SaleRow({ sale, jobId, onEdit, onDelete }: SaleRowProps) {
  // ... extraction target: JobsManager.tsx:741-803 (the details block)
}
```
`SaleFromQuoteSubtext` exported (not just local) because `JobsManager.test.tsx:62` imports it directly for unit testing; after the move the test import updates to `./SaleRow`.

**QuoteRow props interface shape** (mirror of analog at `src/components/JobsManager.tsx:139-148`):
```typescript
// QuoteRow analog (lines 139-148):
interface QuoteRowProps {
  quote: Quote;
  pillKind: RuntimeQuoteStatus | 'declined';
  onConvert?: () => void;
  onEdit?: () => void;
  onDecline?: () => void;
  onReopen?: () => void;
}
```
SaleRow follows the same pattern: typed props, parent-supplied callbacks, no subscription inside the row component.

**Details accordion extraction target** (`src/components/JobsManager.tsx:741-803`):
```typescript
// THIS ENTIRE BLOCK becomes SaleRow's render output (extract verbatim):
<details
  key={sale.id}
  className="text-sm text-slate-400 bg-slate-800 px-3 py-2 rounded group"
  onClick={e => e.stopPropagation()}
>
  <summary className="flex justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
    <span className="flex items-center gap-2">
      <span className="text-xs text-slate-500 group-open:rotate-90 transition-transform">▸</span>
      {summaryLabel}
      {sale.convertedFromQuoteId && (
        <SaleFromQuoteSubtext convertedFromQuoteId={sale.convertedFromQuoteId} jobId={jobId} />
      )}
    </span>
    <span className="font-mono">${sale.totalRevenue.toFixed(2)}</span>
  </summary>
  {/* customer block + Edit/Delete buttons: lines 758-801 */}
</details>
```
`key` prop drops out — parent `map()` supplies it: `<SaleRow key={s.id} ... />`.

**JobCard call-site collapse** (D-14 target — `src/components/JobsManager.tsx:725-804`):
```typescript
// BEFORE (80 LOC map body):
{recentSales.slice(0, 5).map(sale => { /* 60 LOC inline */ })}

// AFTER (one line per row):
{recentSales.slice(0, 5).map(s => (
  <SaleRow key={s.id} sale={s} jobId={job.id} onEdit={onEditSale} onDelete={onDeleteSale} />
))}
```

---

### `src/components/ui/icons/SearchIcon.tsx` (utility, —)

**Analog:** `src/components/ui/icons/PackageIcon.tsx` (exact pattern)

**Full component pattern** (`src/components/ui/icons/PackageIcon.tsx:1-21`):
```typescript
import type { SVGProps } from 'react';

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
```
SVG markup copied from `src/components/CustomerLibrary.tsx:387-399` (canonical version per CONTEXT D-16). `strokeWidth={2}` (not 1.5 — PackageIcon uses 1.5, SearchIcon uses 2 per both existing copies). Props spread via `{...props}` for className/width/height overrides.

---

### `src/components/ui/icons/index.ts` (config, —)

**Analog:** existing `src/components/ui/icons/index.ts:1-3`

**Current content** (full file):
```typescript
export { PackageIcon } from './PackageIcon';
export { ClipboardListIcon } from './ClipboardListIcon';
export { PrinterIcon } from './PrinterIcon';
```

**After plan 22-02 — add one line:**
```typescript
export { SearchIcon } from './SearchIcon';
```
No pre-declarations for future icons (ChevronRight / Tag / X) — clean barrel per CONTEXT D-15 discretion.

---

### `src/hooks/useDatabase.ts` — add `useAllSales` (hook, CRUD)

**Analog:** `src/hooks/useDatabase.ts:569-650` (`useSales`) and `src/hooks/useDatabase.ts:654-655` (`useCustomers` opener)

**Insertion point:** immediately after `useSales` closing `}` at line 650, before the `// Hook for customer library` comment at line 652. Insert a blank line + comment block + function.

**useCustomers opener pattern** (`src/hooks/useDatabase.ts:654-655`):
```typescript
export function useCustomers() {
  const customers = useLiveQuery(() => db.customers.toArray(), []);
```
`useAllSales` mirrors this shape exactly — single `useLiveQuery` call, returns the entity array directly (not wrapped in an object with CRUD methods).

**Full function to insert** (D-23 confirmed shape (a)):
```typescript
// Hook for reading all sales globally — used by JobsManager to build
// salesByJob Map. Separate from useSales(jobId) which also exposes
// addSale/updateSale/deleteSale for a specific job.
// Returns Sale[] directly (not { sales: [...] }) to make intent clear
// and simplify mock: `useAllSales: () => []`.
export function useAllSales(): Sale[] {
  const sales = useLiveQuery(
    () => db.sales.orderBy('soldAt').reverse().toArray(),
    []
  );
  return sales ?? [];
}
```

**JobsManager change** (`src/components/JobsManager.tsx:1070-1071`):
```typescript
// BEFORE:
const { sales, addSale, updateSale, deleteSale } = useSales(selectedJobId || undefined);
const { sales: allSales } = useSales();

// AFTER:
const { sales, addSale, updateSale, deleteSale } = useSales(selectedJobId || undefined);
const allSales = useAllSales();
```
Add `useAllSales` to the import from `'../hooks/useDatabase'`.

---

### `src/components/CustomerLibrary.tsx` — PERF-04 one-line change

**Analog:** `src/components/JobsManager.tsx:1666-1668` (Phase 15 bi-key useDynamicRowHeight)

**Target line** (`src/components/CustomerLibrary.tsx:153`):
```typescript
// BEFORE:
const customerRowHeightCache = useDynamicRowHeight({ defaultRowHeight: 88 });

// AFTER:
const customerRowHeightCache = useDynamicRowHeight({ defaultRowHeight: 88, key: searchQuery });
```
`searchQuery` is the exact local variable name confirmed at `CustomerLibrary.tsx:115`:
```typescript
const [searchQuery, setSearchQuery] = useState('');
```

---

### `src/components/JobsManager.tsx` — breakEvenMap (PERF-01)

**Analog:** `src/components/JobsManager.tsx:1180-1210` (getBreakEvenInfo body — becomes `computeBreakEvenInfo`)

**Module-scope pure function** (D-17 — stays inside JobsManager.tsx, not extracted to `src/utils/`):
```typescript
// Module scope — pure function; lifts from getBreakEvenInfo useCallback body.
// No second consumer today; stays here per No-Analog rule.
function computeBreakEvenInfo(job: PrintJob, salesByJob: Map<string, Sale[]>): BreakEvenInfo {
  const jobSales = salesByJob.get(job.id) ?? [];
  const actualRevenue = jobSales.reduce((sum, s) => sum + s.totalRevenue, 0);
  // ... body of JobsManager.tsx:1181-1209 verbatim
}
```

**breakEvenMap useMemo** (D-18 — placed after `salesByJob` and `searchedJobs` are defined, before `rowProps`):
```typescript
const breakEvenMap = useMemo(
  () => new Map(searchedJobs.map(j => [j.id, computeBreakEvenInfo(j, salesByJob)])),
  [searchedJobs, salesByJob]
);
```

**rowProps.getBreakEvenInfo wrapper** (D-19 — function signature unchanged in `JobRowProps`):
```typescript
// Wrap the Map lookup in a function so JobRowProps shape stays unchanged
// and JobsManager.test.tsx:340-382 renderJobCard helper needs no update.
getBreakEvenInfo: (job: PrintJob) => breakEvenMap.get(job.id)!,
```

---

### `src/components/JobsManager.test.tsx` — mock update (plan 22-06)

**Analog:** existing mock at `src/components/JobsManager.test.tsx:47-52`

**Current mock** (`src/components/JobsManager.test.tsx:47-52`):
```typescript
useSales: () => ({
  sales: [],
  addSale: vi.fn(),
  updateSale: vi.fn(),
  deleteSale: vi.fn(),
}),
```

**Addition for useAllSales** (returns plain array — different shape from useSales):
```typescript
useAllSales: () => [],
```
Add this entry to the `vi.mock('../hooks/useDatabase', ...)` factory object. The array shape (not `{ sales: [] }`) matches `useAllSales`'s return type `Sale[]`.

---

## Shared Patterns

### Modal primitive (Phase 19)
**Source:** `src/components/ui/Modal.tsx`
**Apply to:** `RecordSaleModal.tsx`
**API:** `<Modal isOpen={boolean} onClose={() => void} title={string} size="sm"|"md"|"lg">`
**Key behavior:** `Modal.tsx:67` — `if (!isOpen) return null` — children unmount on close. This means `RecordSaleModal`'s `useEffect` for form state must be keyed on `[editingSale, convertingFromQuote]` for HYDRATION only — not on `[isOpen]` for reset (reset is handled by unmount).

### createRoot + act test convention
**Source:** `src/components/PrintQuoteModal.test.tsx:1-5` and `src/components/JobsManager.test.tsx:1-3`
**Apply to:** `RecordSaleModal.test.tsx`, `useCustomerPicker.test.ts`
```typescript
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
// NO import from '@testing-library/react'
```
Every interaction uses `act(() => { ... })`. Async renders use `await act(async () => { ... })`.

### vi.mock useDatabase factory
**Source:** `src/components/JobsManager.test.tsx:19-53` and `src/components/PrintQuoteModal.test.tsx:42-62`
**Apply to:** `RecordSaleModal.test.tsx`
Always declare `vi.mock` BEFORE importing the component under test (Vitest hoisting requirement). Import the component via `await import(...)` after mocks are registered.

### Named exports from hooks
**Source:** `src/hooks/useDatabase.ts:1`, `src/hooks/useLocalStorage.ts:3`
**Apply to:** `src/hooks/useCustomerPicker.ts`
All hooks use named exports (`export function useXxx`), not default exports. `useCustomerPicker.ts` follows the same pattern.

### tsc -b verification
**Apply to:** every plan commit
Use `tsc -b` (not `tsc --noEmit`) — Vercel runs `tsc -b && vite build` and enforces `noUnusedLocals`/`noUnusedParameters`. The new hook's unused `filteredCustomers` (if any consumer only uses `visibleCustomers`) must still be returned because tests validate the full return shape.

---

## No Analog Found

All files have close analogs. No entries.

---

## Critical Implementation Notes

| File | Note | Source |
|------|------|--------|
| `RecordSaleModal.tsx` | `pickedExistingCustomerId` must NOT be added to hook or RecordSaleModal — it is PrintQuoteModal-only for library-link at `createQuote` time | RESEARCH §Pitfall 1 |
| `RecordSaleModal.tsx` | Convert-from-Quote atomic `db.transaction` must NOT be replaced with `addSale()` — nested tx over `db.quotes` would deadlock | RESEARCH §Pitfall 2 |
| `RecordSaleModal.tsx` | No `useEffect([isOpen])` for reset — Modal unmounts children on close; only hydration effects needed | RESEARCH §Pitfall 3 |
| `JobsManager.test.tsx` | Add `useAllSales: () => []` (plain array) alongside existing `useSales: () => ({...})` (object) — different shapes | RESEARCH §Pitfall 4 |
| `SearchIcon.tsx` | Copy SVG from `CustomerLibrary.tsx:387-399` (canonical), not `JobsManager.tsx:974` | RESEARCH §Pitfall 5 |
| `JobsManager.tsx` | Keep `rowProps.getBreakEvenInfo` as a function `(job) => breakEvenMap.get(job.id)!`, not a Map | RESEARCH §Pitfall 6 |
| `SaleRow.tsx` | Export `SaleFromQuoteSubtext` (not just local) so `JobsManager.test.tsx:62` import can be updated to `./SaleRow` | RESEARCH §D-13 |
| `PrintQuoteModal.tsx` | Drop `customerPickerInputRef` entirely when migrating to `useCustomerPicker` — confirmed dead code | RESEARCH §Open Question 2 |

---

## Metadata

**Analog search scope:** `src/hooks/`, `src/components/`, `src/components/ui/icons/`
**Files scanned:** 12 source files read
**Pattern extraction date:** 2026-05-27
