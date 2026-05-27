# Phase 22: JobsManager decomposition + perf - Research

**Researched:** 2026-05-27
**Domain:** React component decomposition, custom hook extraction, Dexie liveQuery subscription management, react-window row-height cache invalidation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01 through D-27 are all locked (see 22-CONTEXT.md for full text)
- Core locked choices: `useCustomerPicker` signature, `RecordSaleModal` prop shape (drops `customers`/`customersByEmail` props — modal subscribes internally), `SaleRow` props, plan execution order, `tsc -b` over `tsc --noEmit`, no `features.ts` entry, no `<NewBadge>`, hardening-only milestone

### Claude's Discretion

- `onSaved?` vs `onSaveComplete` vs none (recommend `onSaved?` optional)
- `computeBreakEvenInfo` in `JobsManager.tsx` module scope vs `src/utils/breakEven.ts` (recommend module scope until 2nd consumer)
- `calculateMarketplaceFee` in `RecordSaleModal.tsx` module scope vs `src/utils/marketplaceFee.ts` (recommend module scope)
- PERF-07 shape: `useAllSales()` vs `useSalesByJob()` (recommend `useAllSales()`)
- `useCustomerPicker.test.ts` pattern: raw `createRoot`+`act` vs `renderHook` (confirm from `PrintQuoteModal.test.tsx`)
- `SaleFromQuoteSubtext` move to `SaleRow.tsx` (recommend yes)
- `src/components/ui/icons/index.ts` barrel: pre-declare future icons or keep clean with just `SearchIcon` (recommend clean)
- File ordering for `useAllSales` insertion in `useDatabase.ts` (recommend right after `useSales`)

### Deferred Ideas (OUT OF SCOPE)

- `<JobCard>` further decomposition
- `<QuoteRow>` relocation to its own file
- `<OrdersSection>` extraction
- Customer picker inline "Create new" CTA
- `<ConfirmDialog>` primitive
- Other icon extractions (ChevronRight, Tag, X)
- `src/utils/breakEven.ts` extraction
- `src/utils/marketplaceFee.ts` extraction
- Replace `<details>` with custom accordion primitive in `<SaleRow>`
- App.tsx-level lift of all sales subscription

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HYG-02 | `PICKER_VISIBLE_LIMIT = 8` centralized into `useCustomerPicker.ts`, exported; both consumers import from there | Verified: `JobsManager.tsx:993` has `const PICKER_VISIBLE_LIMIT = 8`; `PrintQuoteModal.tsx:31` has identical duplicate |
| HYG-03 | `SearchIcon` SVG extracted to `src/components/ui/icons/SearchIcon.tsx`; `JobsManager` + `CustomerLibrary` import it | Verified: duplicate exists at `JobsManager.tsx:974` and `CustomerLibrary.tsx:387`; `ui/icons/` directory already has 3 icons + barrel |
| HYG-06 | `<RecordSaleModal>` extracted to `src/components/RecordSaleModal.tsx`; owns state + `handleRecordSale` + atomic tx | Verified: target block is `JobsManager.tsx:1837-2092` (Modal + content); `handleRecordSale` at lines 1377-1525 |
| HYG-07 | `<SaleRow>` extracted from `<JobCard>` as standalone `<details>` accordion component | Verified: extraction target is `JobsManager.tsx:742-802` (map loop body) |
| HYG-08 | `useCustomerPicker(customers, { onPick })` hook consolidates picker state triplet + memos + keyDown | Verified: both `JobsManager.tsx:1080-1370` and `PrintQuoteModal.tsx:69-178` have identical picker patterns |
| PERF-01 | `breakEvenMap = useMemo<Map<string, BreakEvenInfo>>(...)` replaces per-call `getBreakEvenInfo` recomputation | Verified: `getBreakEvenInfo` useCallback at `JobsManager.tsx:1180-1210`; called at lines 881, 1806; passed in rowProps |
| PERF-02 | `calculateMarketplaceFee` called once per render (stored in `const marketplaceFee`) | Verified: called 3× independently at lines 2061, 2064, 2070 |
| PERF-03 | `calculateMarketplaceFee` hoisted to module scope | Verified: currently defined as non-pure arrow function inside `JobsManager` at lines 1155-1165 |
| PERF-04 | `useDynamicRowHeight` in `CustomerLibrary` gains `key: searchQuery` | Verified: `CustomerLibrary.tsx:153` has no `key` arg; search state name is `searchQuery` (line 115) |
| PERF-07 | Global `useSales()` call lifted to a standalone hook; JobsManager drops the duplicated subscription | Verified: `JobsManager.tsx:1070-1071` has TWO `useSales` calls — scoped (`selectedJobId`) and global (no arg) |

</phase_requirements>

---

## Summary

Phase 22 decomposes `JobsManager.tsx` (currently 2,100 LOC) by extracting three components and one hook, plus closing five performance findings. The work is high-confidence because every extraction target has already been located and measured in the source, the dependency tree is shallow (all new code compiles against existing stable types), and the project has strong precedents for every pattern being applied.

The dominant risk in this phase is not new capability — it is safe extraction without behavioral regression. The three areas requiring close attention are: (1) the `pickedExistingCustomerId` slot in `PrintQuoteModal`'s `handlePickCustomer` that does NOT appear in `JobsManager`'s equivalent — this is a deliberate divergence, not a bug, and the hook must accommodate both consumers; (2) the Convert-from-Quote atomic Dexie transaction that must move verbatim with `RecordSaleModal` because it cannot be expressed through the `addSale` hook without deadlock; (3) the `JobsManager.test.tsx` mock shape must be extended for `useAllSales` alongside `useSales` in plan 22-06.

The phase is a pure structural refactor — zero user-visible change, zero `features.ts` entries, zero `<NewBadge>` JSX. All six plans have clear input/output file sets with minimal overlap.

**Primary recommendation:** Execute plans in the locked order (22-01 → 22-02 → 22-03 → 22-04 → 22-05 → 22-06). Plans 22-01 and 22-02 can run in parallel; 22-03 and 22-04 can run in parallel after 22-01 completes; 22-05 runs after 22-03; 22-06 runs last.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Customer picker state/keyDown | Custom hook (`useCustomerPicker`) | Component (consumer fills form fields) | State is shared between two components; hook owns the combobox lifecycle, consumer owns what `onPick` does |
| Record Sale form state + submit | `RecordSaleModal` component | `useCustomers` + `useSales` (subscriptions) | Modal owns all local form state; Dexie subscriptions are internal; parent only passes job context |
| Sale accordion row display | `SaleRow` component | `JobCard` parent (passes onEdit/onDelete) | Per-row concerns (customer details, edit/delete buttons) belong in an isolated row component |
| Break-even computation | `JobsManager` module scope (`computeBreakEvenInfo`) | `useMemo` Map at component root | Pure function; Map built once per render cycle using `[searchedJobs, salesByJob]` deps |
| Marketplace fee computation | `RecordSaleModal` module scope | `useMemo` inside modal | Pure function; single consumer; memoized with `[saleQuantity, salePrice, saleMarketplace]` deps |
| Global sales subscription | `useAllSales()` hook in `useDatabase.ts` | JobsManager (consumer) | Lifts a liveQuery subscription so it is defined once and shared; parallel to `useSales(jobId?)` |
| SearchIcon SVG | `src/components/ui/icons/SearchIcon.tsx` | Barrel re-export via `index.ts` | Already established icon home; three existing icons confirm the pattern |

---

## Standard Stack

No new external packages in this phase. All work uses existing project dependencies.

### Core (already installed)

| Library | Confirmed Version | Purpose in Phase 22 |
|---------|------------------|---------------------|
| React 19 | — (project-installed) | `useMemo`, `useCallback`, `useId`, `useState`, `useEffect` |
| Dexie 4 / dexie-react-hooks | — (project-installed) | `useLiveQuery` for `useAllSales`; transaction atomicity for Convert-from-Quote |
| react-window v2 | — (project-installed) | `useDynamicRowHeight` `key` arg (PERF-04) |
| TypeScript (tsc -b) | — (project-installed) | Build verification; `tsc -b` required (not `--noEmit`) |
| Vitest + jsdom | — (project-installed) | `createRoot` + `act` tests for new components/hooks |

**No `npm install` step required for this phase.** [ASSUMED: package.json already contains all needed deps; confirmed by reading existing file imports]

### Package Legitimacy Audit

> Not applicable — this phase installs zero new packages.

---

## Architecture Patterns

### System Architecture Diagram

```
JobsManager.tsx (orchestrator, shrinks ~400+ LOC)
│
├── useAllSales()         ← NEW (useDatabase.ts) — global sales subscription
├── useSales(jobId)       ← UNCHANGED — scoped subscription
├── breakEvenMap (useMemo)← NEW — O(1) Map<jobId, BreakEvenInfo>
│
├── <JobCard>
│   └── <SaleRow>         ← EXTRACTED — per-sale <details> accordion
│       └── <SaleFromQuoteSubtext>  ← MOVED — local non-exported component
│
├── <RecordSaleModal>     ← EXTRACTED
│   ├── <Modal size="md"> ← Phase 19 primitive
│   ├── useCustomerPicker(customers, {onPick})  ← NEW hook
│   ├── useCustomers()    ← internal subscription
│   ├── useSales(jobId)   ← internal subscription for addSale/updateSale
│   └── calculateMarketplaceFee() ← hoisted to module scope
│
└── <PrintQuoteModal>     ← MIGRATED (22-03)
    └── useCustomerPicker(customers, {onPick})  ← replaces duplicate picker state

src/hooks/useCustomerPicker.ts   ← NEW
src/components/ui/icons/SearchIcon.tsx  ← NEW
src/components/ui/icons/index.ts        ← UPDATED (add SearchIcon export)
```

Data flow for break-even:
```
allSales (useAllSales) → salesByJob Map (useMemo) → breakEvenMap (useMemo)
                                                      ↓
                                        getBreakEvenInfo(job) = breakEvenMap.get(job.id)!
```

### Recommended Project Structure (additions only)

```
src/
├── hooks/
│   ├── useDatabase.ts          # UPDATED: add useAllSales after useSales
│   └── useCustomerPicker.ts    # NEW
├── components/
│   ├── JobsManager.tsx         # SHRINKS ~400+ LOC
│   ├── RecordSaleModal.tsx     # NEW
│   ├── SaleRow.tsx             # NEW
│   ├── PrintQuoteModal.tsx     # UPDATED: migrate to useCustomerPicker
│   ├── CustomerLibrary.tsx     # UPDATED: add key: searchQuery to useDynamicRowHeight
│   └── ui/
│       └── icons/
│           ├── index.ts        # UPDATED: add SearchIcon export
│           └── SearchIcon.tsx  # NEW
```

### Pattern 1: useCustomerPicker hook

**What:** Encapsulates the combobox picker state triplet (`query`, `open`, `activeIndex`), the `filteredCustomers` / `visibleCustomers` memos, the `handleKeyDown` (including Escape `stopPropagation`), and a `pick(c)` function that calls `onPick(c)` then resets internal UI state.

**When to use:** Any component that renders the customer combobox — currently `RecordSaleModal` and `PrintQuoteModal`.

**Signature (D-01 locked):**
```typescript
// Source: 22-CONTEXT.md D-01 + code evidence at JobsManager.tsx:1080-1370
export function useCustomerPicker(
  customers: Customer[],
  { onPick }: { onPick: (c: Customer) => void }
): {
  query: string;
  open: boolean;
  activeIndex: number;
  visibleCustomers: Customer[];
  filteredCustomers: Customer[];
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  pick: (c: Customer) => void;  // wires onClick on listbox rows
  reset: () => void;
}
```

**PICKER_VISIBLE_LIMIT:** Lives in `useCustomerPicker.ts`, exported as named constant. Consumer code never imports it (hook returns pre-sliced `visibleCustomers`).

**handlePickCustomer divergence between consumers — CRITICAL FINDING:**
- `JobsManager.tsx:1305-1314` sets 4 sale-customer form fields. NEVER sets `saleCustomerNotes`. Does NOT set a `pickedExistingCustomerId` equivalent.
- `PrintQuoteModal.tsx:132-141` sets 4 quote-customer form fields AND sets `pickedExistingCustomerId(c.id)`.

The `pickedExistingCustomerId` is a `PrintQuoteModal`-ONLY concept (used at `createQuote` time to link the library record). It does NOT belong in the hook. The `onPick` callback in `PrintQuoteModal`'s usage must:

```typescript
// PrintQuoteModal consumer's onPick (passed to useCustomerPicker):
const handlePickCustomer = (c: Customer) => {
  setQuoteCustomerName(c.name ?? '');
  setQuoteCustomerEmail(c.email ?? '');
  setQuoteCustomerCompany(c.company ?? '');
  setQuoteCustomerAddress(c.address ?? '');
  setPickedExistingCustomerId(c.id);  // PrintQuoteModal-local state; NOT in hook
};
```

The hook's internal `pick(c)` calls `onPick(c)` then resets `{ query: '', open: false, activeIndex: 0 }`. The consumer's `onPick` fills its own form fields. This is correct per D-04.

### Pattern 2: RecordSaleModal useEffect form hydration

**What:** Modal's local form state resets/hydrates when `isOpen` transitions false→true (or when `editingSale`/`convertingFromQuote` changes while open).

**IMPORTANT — HYG-09 interaction:** `Modal.tsx:67` shows `if (!isOpen) return null;` — children are unmounted when closed. This means `useEffect` on `isOpen` is needed ONLY for HYDRATION (filling fields from props) because reset-on-close is handled by unmount. The implementation in `RecordSaleModal` should use `useEffect` keyed on `[editingSale, convertingFromQuote]` to hydrate, not reset.

```typescript
// Source: Modal.tsx:67 + JobsManager.tsx:1232-1275 (handleStartConversion + handleEditSale)
useEffect(() => {
  if (editingSale) {
    setSaleQuantity(editingSale.quantity);
    setSalePrice(editingSale.unitPrice);
    // ... fill other fields from editingSale
  } else if (convertingFromQuote) {
    setSaleQuantity(1);
    setSalePrice(convertingFromQuote.lineItemsSnapshot.sellingPrice);
    // ... fill from quote snapshot (see JobsManager.tsx:1243-1255)
    setSaleShippingCost(convertingFromQuote.lineItemsSnapshot.shippingCost);
  } else {
    // Create mode: reset to defaults
    setSaleQuantity(1);
    setSalePrice(job.sellingPrice);
    // ...
  }
}, [editingSale, convertingFromQuote, job.sellingPrice]);
```

### Pattern 3: breakEvenMap useMemo

**What:** Single-pass Map built from `searchedJobs` + `salesByJob`.

**PERF-01 dependency set — CONFIRMED:**
`computeBreakEvenInfo(job, salesByJob)` is a pure function of `job` (its fields: `copiesSold`, `sellingPrice`, `costPerUnit`, `modelCost`) and `salesByJob.get(job.id)` (to sum `totalRevenue`). No other `JobsManager`-scope variables are captured. The dependency set `[searchedJobs, salesByJob]` is complete — no hidden closure captures.

```typescript
// Source: JobsManager.tsx:1180-1210 (getBreakEvenInfo body)
const breakEvenMap = useMemo(
  () => new Map(searchedJobs.map(j => [j.id, computeBreakEvenInfo(j, salesByJob)])),
  [searchedJobs, salesByJob]
);
```

`rowProps.getBreakEvenInfo` becomes `(job: PrintJob) => breakEvenMap.get(job.id)!` — function wrapper preserved so `JobRowProps` type shape is unchanged (D-19).

### Pattern 4: useAllSales (PERF-07)

**Recommended shape (option a — confirmed):**

```typescript
// Source: useDatabase.ts:569-574 (useSales implementation reference)
export function useAllSales(): Sale[] {
  const sales = useLiveQuery(
    () => db.sales.orderBy('soldAt').reverse().toArray(),
    []
  );
  return sales ?? [];
}
```

Insert position: immediately after `useSales` closing `}` at `useDatabase.ts:650`. Before `useCustomers` at line 654. [ASSUMED: exact line numbers may shift by ±5 due to any prior edits in the session]

**JobsManager change:**
```typescript
// BEFORE (JobsManager.tsx:1070-1071):
const { sales, addSale, updateSale, deleteSale } = useSales(selectedJobId || undefined);
const { sales: allSales } = useSales();

// AFTER:
const { sales, addSale, updateSale, deleteSale } = useSales(selectedJobId || undefined);
const allSales = useAllSales();  // + add useAllSales to import from '../hooks/useDatabase'
```

### Anti-Patterns to Avoid

- **Don't call `useSales()` inside `RecordSaleModal` globally:** Modal only needs `addSale`/`updateSale`/`deleteSale` from `useSales(job.id)` — scoped. The global subscription stays in JobsManager.
- **Don't copy `pickedExistingCustomerId` into the hook:** It is a `PrintQuoteModal`-only concept for the `createQuote` library-link path. The hook returns only combobox UI state.
- **Don't call `addSale` inside the Convert-from-Quote branch:** The inline atomic transaction at `JobsManager.tsx:1505-1516` is intentionally NOT delegated to `addSale` because `addSale` has its own internal transaction — nesting would deadlock or break rollback. The comment at lines 1486-1494 must move verbatim with the code.
- **Don't use `tsc --noEmit` for verification:** Project requires `tsc -b` (Vercel runs `tsc -b && vite build`; `noUnusedLocals`/`noUnusedParameters` only enforced by `tsc -b`).
- **Don't add `key` prop to `<Modal>` around `<RecordSaleModal>`:** Phase 19 `Modal.tsx:67` already unmounts children when `isOpen=false`, so `key` forcing remount is redundant.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialog behavior | Custom overlay | `<Modal>` primitive (Phase 19) | Focus-trap, Escape-to-close, aria-labelledby already built; `<RecordSaleModal>` wraps it at `size="md"` |
| Live IndexedDB queries | Manual Dexie subscription | `useLiveQuery` (dexie-react-hooks) | Handles re-render on data changes; already used by all hooks |
| Atomic multi-table write | Sequential await calls | `db.transaction('rw', ...)` | Convert-from-Quote requires Sale + Quote + Job update to be atomic; existing pattern at JobsManager.tsx:1505-1516 |
| Row height invalidation | Custom resize observer | `useDynamicRowHeight({ key })` | Already built in react-window v2; `key` is the documented cache-bust arg (Phase 15 precedent) |

**Key insight:** Every capability needed for Phase 22 already exists in the codebase — the work is reorganizing, not building new infrastructure.

---

## Runtime State Inventory

> Not applicable — Phase 22 is a pure structural refactor with no schema changes, no string renames, and no data migration. No stored data, live service config, OS-registered state, secrets/env vars, or build artifacts are affected.

**None — verified by phase scope review: zero schema changes, zero field renames, zero IndexedDB migration.**

---

## Common Pitfalls

### Pitfall 1: pickedExistingCustomerId leaking into the hook

**What goes wrong:** Implementor sees `handlePickCustomer` in both files, sees `setPickedExistingCustomerId(c.id)` in `PrintQuoteModal.tsx:137`, and tries to add that as a hook return value or internal call.

**Why it happens:** The two `handlePickCustomer` implementations LOOK identical at first glance but `PrintQuoteModal`'s sets an extra `pickedExistingCustomerId` state used at `createQuote` time for library linking. `JobsManager`'s does NOT — it does the library linking in `handleRecordSale` via `customersByEmail` lookup, not by caching the picked ID.

**How to avoid:** The hook's `onPick(c)` callback is the consumer's responsibility. The hook ONLY resets `{ query, open, activeIndex }`. The consumer's `onPick` callback fills whatever form fields it needs, including any consumer-specific state like `pickedExistingCustomerId`.

**Warning signs:** TypeScript error on `pickedExistingCustomerId` not in `useCustomerPicker` return type; or PrintQuoteModal losing the library-link at `createQuote` time.

### Pitfall 2: Convert-from-Quote atomic tx being split or dropped

**What goes wrong:** When moving `handleRecordSale` to `RecordSaleModal`, the inline `db.transaction('rw', db.sales, db.quotes, db.jobs, ...)` at `JobsManager.tsx:1505-1516` is replaced with a call to `addSale(sale)` because "that's what addSale is for."

**Why it happens:** `addSale` wraps its own `db.transaction('rw', db.sales, db.jobs, ...)` (Phase 20 DATA-01). Calling `addSale` inside an outer `db.transaction` that also writes to `db.quotes` either (a) creates a nested transaction (Dexie supports this but the scope must be a subset — `db.quotes` is NOT in `addSale`'s transaction scope, so it would NOT be atomic) or (b) simply doesn't include the Quote patch + copiesSold bump.

**How to avoid:** Copy the block at `JobsManager.tsx:1481-1516` verbatim. Preserve the comment at lines 1486-1494 that explains WHY `addSale` is not used here.

**Warning signs:** Quote status stays `'sent'` after a conversion (Quote patch didn't fire); or break-even progress doesn't advance on conversion (copiesSold bump dropped).

### Pitfall 3: Modal HYG-09 unmount behavior changing useEffect semantics

**What goes wrong:** `RecordSaleModal` adds a `useEffect(() => { /* reset all fields */ }, [isOpen])` on the assumption that it needs to clean up state on close — but the Modal already unmounts children on close, so the effect fires after unmount (no-op) and a new one fires on remount (blank state). The effect-on-close is dead code that adds confusion.

**Why it happens:** Engineers accustomed to always-mounted modals (legacy pattern before Phase 19) write cleanup effects as a habit.

**How to avoid:** Use `useEffect` ONLY for HYDRATION (fill fields from `editingSale` / `convertingFromQuote` props when they change). State defaults handle the blank-create-mode case at initialization. See Pattern 2 above.

**Warning signs:** Fields pre-populating from the wrong sale when switching quickly between Edit/Create modes; or extra renders on open.

### Pitfall 4: JobsManager.test.tsx mock missing useAllSales

**What goes wrong:** Plan 22-06 adds `useAllSales` to `useDatabase.ts`. `JobsManager.test.tsx:19` has a `vi.mock('../hooks/useDatabase', ...)` factory that returns specific named exports. When `JobsManager.tsx` imports `useAllSales` from `useDatabase`, the test mock doesn't expose it → `TypeError: useAllSales is not a function`.

**Why it happens:** Vitest module mocks enumerate exports explicitly; adding a new export to the real module doesn't auto-add it to the mock factory.

**How to avoid:** In plan 22-06, add `useAllSales: () => []` to the mock object at `JobsManager.test.tsx:47` alongside the existing `useSales` mock. Note that `useSales` currently returns `{ sales: [], addSale: vi.fn(), ... }` (an object), while `useAllSales` should return `[]` (a plain array) — these are different shapes per the D-23 decision.

**Current mock shape (VERIFIED from `JobsManager.test.tsx:47-52`):**
```typescript
useSales: () => ({
  sales: [],
  addSale: vi.fn(),
  updateSale: vi.fn(),
  deleteSale: vi.fn(),
}),
```

**New mock entry to add in plan 22-06:**
```typescript
useAllSales: () => [],
```

**Warning signs:** `TypeError: useAllSales is not a function` in test output after plan 22-06.

### Pitfall 5: SearchIcon SVG markup divergence

**What goes wrong:** When creating `SearchIcon.tsx`, the implementor copies from `JobsManager.tsx:974-987` but the CONTEXT specifies CustomerLibrary's version is canonical.

**Why it happens:** The CONTEXT.md comments at `JobsManager.tsx:971` say "mirrors CustomerLibrary.tsx:382 verbatim" — but a future edit to either file might have introduced drift.

**How to avoid:** Copy from `CustomerLibrary.tsx:387-399`. Both are identical: `viewBox="0 0 24 24"`, `strokeWidth={2}`, path `M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"`. Confirmed matching at time of research.

**Warning signs:** Subtle visual difference in icon rendering; or test that greps the SVG path string fails.

### Pitfall 6: rowProps.getBreakEvenInfo must remain a function (not Map)

**What goes wrong:** Implementor changes `rowProps.getBreakEvenInfo` from `(job: PrintJob) => BreakEvenInfo` to `Map<string, BreakEvenInfo>` in `JobRowProps` and `rowProps` to eliminate the wrapper function.

**Why it happens:** Seems cleaner to pass the Map directly.

**How to avoid:** D-19 is locked: `getBreakEvenInfo` stays as a function in `JobRowProps` because changing the type forces updates to every call site in `JobRow` and `JobCard`, and the existing `JobsManager.test.tsx:340-382` `renderJobCard` helper passes a `makeBreakEvenInfo()` object for the `info` prop (not `getBreakEvenInfo`). The function wrapper `(job) => breakEvenMap.get(job.id)!` closes over the Map — zero signature change to `JobRowProps`.

---

## Researcher Decisions (D-13, D-22, D-23, D-24 confirmed)

### D-13: SaleFromQuoteSubtext relocation — CONFIRMED: Move to SaleRow.tsx

**Evidence:** `SaleFromQuoteSubtext` (currently exported at `JobsManager.tsx:314-323`) is consumed at ONE location: `JobsManager.tsx:753` inside the `<details>` accordion map that becomes `<SaleRow>`. After extraction, its only consumer is `SaleRow.tsx`. Moving it to `SaleRow.tsx` as a non-exported local component removes an orphan export from `JobsManager.tsx`.

The test at `JobsManager.test.tsx:62` imports `SaleFromQuoteSubtext` from `./JobsManager` for direct unit testing. After the move, the test file must update this import to `./SaleRow`. The `JobCard` export and `OrdersQuoteRows` export continue to be tested via `JobsManager.test.tsx` directly. The `SaleFromQuoteSubtext` test can be either moved to a `SaleRow.test.tsx` or updated to import from `./SaleRow`.

**Decision:** Move to `SaleRow.tsx` as a LOCAL (non-exported) component. Re-export only if tests need to mount it directly (they do — add `export` to the function in `SaleRow.tsx` so tests can import it).

### D-22: CustomerLibrary search-input state name — CONFIRMED: `searchQuery`

**Evidence (VERIFIED from source):** `CustomerLibrary.tsx:115`:
```typescript
const [searchQuery, setSearchQuery] = useState('');
```

The variable name is `searchQuery` — NOT `customerSearchQuery`, NOT `query`. The CONTEXT.md assumption was correct. The PERF-04 change is:

```typescript
// CustomerLibrary.tsx:153 — BEFORE:
const customerRowHeightCache = useDynamicRowHeight({ defaultRowHeight: 88 });

// AFTER:
const customerRowHeightCache = useDynamicRowHeight({ defaultRowHeight: 88, key: searchQuery });
```

### D-23: PERF-07 hook shape — CONFIRMED: useAllSales() returning Sale[]

**Evidence from useDatabase.ts:569-574:**
```typescript
export function useSales(jobId?: string) {
  const sales = useLiveQuery(
    () => jobId
      ? db.sales.where('jobId').equals(jobId).toArray()
      : db.sales.orderBy('soldAt').reverse().toArray(),
    [jobId]
  );
  // ...
  return { sales: sales ?? [], addSale, updateSale, deleteSale, getTotals };
}
```

`useSales()` with no arg already does the global query. The global call at `JobsManager.tsx:1071` destructures only `sales`:
```typescript
const { sales: allSales } = useSales();
```

The `allSales` variable is consumed ONLY to build `salesByJob` at `JobsManager.tsx:1088-1096`. A new `useAllSales(): Sale[]` hook:
- Avoids creating a second `addSale`/`updateSale`/`deleteSale` set (which the global call creates but never uses)
- Returns `[]` not `{ sales: [] }`, so it's clear it is data-only
- Mirrors `useCustomers()` return shape (also returns entity array directly)
- Easier to mock: `useAllSales: () => []`

**Shape confirmed:**
```typescript
export function useAllSales(): Sale[] {
  const sales = useLiveQuery(
    () => db.sales.orderBy('soldAt').reverse().toArray(),
    []
  );
  return sales ?? [];
}
```

### D-24: Test mock shape for useAllSales — CONFIRMED

**Evidence from JobsManager.test.tsx:19-53:**
The current `vi.mock('../hooks/useDatabase', ...)` returns:
- `useQuotes: () => { quotes, quotesByJobId, isLoading, addQuote, updateQuote, deleteQuote, createQuote }`
- `useCustomers: () => { customers, customersByEmail, isLoading, addCustomer, updateCustomer, deleteCustomer, bumpLastUsed, bulkImportCustomers }`
- `useSales: () => { sales: [], addSale: vi.fn(), updateSale: vi.fn(), deleteSale: vi.fn() }`

With `useAllSales(): Sale[]` (shape (a)), the mock addition is:
```typescript
useAllSales: () => [],
```

This is a PLAIN ARRAY, not an object with a `sales` key. Different from `useSales` mock shape. The mock must be added to the existing `vi.mock` factory at `JobsManager.test.tsx:19`.

### Picker keyDown handler parity — CONFIRMED: Functionally identical, one structural note

**Diff between `JobsManager.tsx:1317-1370` and `PrintQuoteModal.tsx:143-178`:**

Both handlers are functionally byte-identical across all 5 key branches (ArrowDown, ArrowUp, Enter, Escape, Tab). The structural difference is:
- `JobsManager` version has more inline comments (WR-04 fix comment on ArrowDown, WR-01 fix comment on Enter, CR-04 fix comment on Escape) — these are documentation-only
- `PrintQuoteModal` version has a one-line comment on Escape: `// don't bubble to the modal's Esc-close handler`
- Both have `e.stopPropagation()` on Escape

**The ArrowDown WR-04 guard is in BOTH:** `if (visibleCustomers.length === 0) return;` — this is NOT a divergence. Both files have it.

**The WR-01 Enter behavior is in BOTH:** `if (customerPickerOpen)` guard before acting on Enter. No divergence.

**Conclusion:** Both can collapse into the single hook implementation. Use `JobsManager`'s version as the source (more documented). Preserve ALL comments when porting to the hook — they document important UX decisions.

### Picker hook test convention — CONFIRMED: raw createRoot + act

**Evidence from `PrintQuoteModal.test.tsx:1-6`:**
```typescript
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
```

No `renderHook` import. No `@testing-library/react`. The test mounts a full component with `createRoot` and queries the DOM.

**For `useCustomerPicker.test.ts`:** Because the hook has no JSX output (pure state + handlers), the test must mount a thin wrapper component that exercises the hook and exposes results through the DOM (e.g., data attributes on a host `<div>`). Pattern:

```typescript
// Wrapper component for hook tests (no @testing-library/react)
function PickerHarness({ customers, onPick }: { customers: Customer[], onPick: (c: Customer) => void }) {
  const { query, open, activeIndex, handleKeyDown, pick } = useCustomerPicker(customers, { onPick });
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
    </div>
  );
}
```

### breakEvenMap dependency set — CONFIRMED: [searchedJobs, salesByJob] is complete

**Evidence from `JobsManager.tsx:1180-1210` (`getBreakEvenInfo` body):**

The function body reads:
- `salesByJob.get(job.id)` — from the `salesByJob` dep ✓
- `job.copiesSold`, `job.sellingPrice`, `job.costPerUnit`, `job.modelCost` — from `job` prop which comes from `searchedJobs[i]` ✓
- No other variables from the `JobsManager` scope (no `userCurrency`, no `shippingConfig`, etc.)

`computeBreakEvenInfo(job: PrintJob, salesByJob: Map<string, Sale[]>): BreakEvenInfo` takes both as arguments. The `useMemo` dep array `[searchedJobs, salesByJob]` is complete.

**One subtlety:** `salesByJob` is itself a `useMemo` of `allSales`. After plan 22-06, `allSales` comes from `useAllSales()`. The dep chain is:
```
useAllSales() → allSales (Sale[]) → salesByJob (useMemo [allSales]) → breakEvenMap (useMemo [searchedJobs, salesByJob])
```
No hidden captures. The existing `salesByJob` dep propagation is correct.

---

## Code Examples

### useCustomerPicker — hook internals

```typescript
// Source: JobsManager.tsx:1280-1370 (adapted to hook form)
export const PICKER_VISIBLE_LIMIT = 8;

export function useCustomerPicker(
  customers: Customer[],
  { onPick }: { onPick: (c: Customer) => void }
) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredCustomers = useMemo<Customer[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [customers, query]);

  const visibleCustomers = useMemo<Customer[]>(
    () => filteredCustomers.slice(0, PICKER_VISIBLE_LIMIT),
    [filteredCustomers]
  );

  const pick = useCallback((c: Customer) => {
    onPick(c);
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
  }, [onPick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visibleCustomers.length === 0) return;  // WR-04: don't open empty dropdown
      if (!open) { setOpen(true); setActiveIndex(0); }
      else { setActiveIndex(i => (i + 1) % visibleCustomers.length); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => visibleCustomers.length === 0 ? 0 : (i - 1 + visibleCustomers.length) % visibleCustomers.length);
    } else if (e.key === 'Enter') {
      if (open) {
        const picked = visibleCustomers[activeIndex];
        if (picked) { e.preventDefault(); pick(picked); }
        else if (query.trim()) { e.preventDefault(); setOpen(false); }
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();  // CR-04: prevent parent Modal's Escape listener from also firing
        setOpen(false);
      }
    } else if (e.key === 'Tab') {
      setOpen(false);  // UI-SPEC §5: Tab closes without auto-pick
    }
  }, [open, activeIndex, query, visibleCustomers, pick]);

  const reset = useCallback(() => {
    setQuery(''); setOpen(false); setActiveIndex(0);
  }, []);

  return { query, open, activeIndex, visibleCustomers, filteredCustomers,
           setQuery, setOpen, setActiveIndex, handleKeyDown, pick, reset };
}
```

### RecordSaleModal — reduced skeleton

```typescript
// Source: JobsManager.tsx:1006-2092 (key patterns, condensed)
export function RecordSaleModal({
  job, userProfile, userCurrency, shippingConfig,
  editingSale, convertingFromQuote, isOpen, onClose, onSaved
}: RecordSaleModalProps) {
  const { customers, customersByEmail, bumpLastUsed, addCustomer } = useCustomers();
  const { sales: _sales, addSale, updateSale } = useSales(job.id);

  // Form state
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  // ... (4 customer fields, saleCustomerNotes, shippingMethod, shippingCost, marketplace)

  // Picker integration (D-09)
  const handlePickCustomer = useCallback((c: Customer) => {
    setSaleCustomerName(c.name ?? '');
    setSaleCustomerEmail(c.email ?? '');
    setSaleCustomerCompany(c.company ?? '');
    setSaleCustomerAddress(c.address ?? '');
    // D-05: DO NOT setSaleCustomerNotes
  }, []);
  const picker = useCustomerPicker(customers, { onPick: handlePickCustomer });

  // Hydration effect (unmount handles reset — Modal.tsx:67 — no reset-on-close needed)
  useEffect(() => {
    if (editingSale) { /* fill from editingSale */ }
    else if (convertingFromQuote) { /* fill from quote snapshot */ }
    else { setSalePrice(job.sellingPrice); /* default create mode */ }
  }, [editingSale, convertingFromQuote, job.sellingPrice]);

  // Memoized fee (PERF-02 + PERF-03)
  const marketplaceFee = useMemo(
    () => calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace),
    [saleQuantity, salePrice, saleMarketplace]
  );

  // handleRecordSale: ports JobsManager.tsx:1377-1525 verbatim
  // (including Convert-from-Quote atomic tx at 1505-1516)
  const handleRecordSale = async () => { /* ... */ };

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={`${editingSale ? 'Edit Sale' : 'Record Sale'} - ${job.name}`}
      size="md"
    >
      <div className="p-4">
        {convertingFromQuote && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-xs text-blue-300 mb-3">
            Converting {formatQuoteNumber(convertingFromQuote.quoteNumber)} — review and adjust if needed.
          </div>
        )}
        {/* ... form JSX from JobsManager.tsx:1843-2091 */}
      </div>
    </Modal>
  );
}
```

### SaleRow — extraction target boundaries

```typescript
// Source: JobsManager.tsx:742-802 (the map body becomes SaleRow.tsx)
// JobCard call site BEFORE (80 LOC):
{recentSales.slice(0, 5).map(sale => { /* 60 LOC */ })}

// JobCard call site AFTER (D-14):
{recentSales.slice(0, 5).map(s => (
  <SaleRow key={s.id} sale={s} jobId={job.id} onEdit={onEditSale} onDelete={onDeleteSale} />
))}
```

`SaleRow` props (D-11):
```typescript
interface SaleRowProps {
  sale: Sale;
  jobId: string;
  onEdit: (s: Sale) => void;
  onDelete: (s: Sale) => void;
}
```

`SaleFromQuoteSubtext` moves with it as a local export (needed by tests).

### ui/icons barrel update

```typescript
// Source: src/components/ui/icons/index.ts (current content at lines 1-3)
// Current:
export { PackageIcon } from './PackageIcon';
export { ClipboardListIcon } from './ClipboardListIcon';
export { PrinterIcon } from './PrinterIcon';

// Add in plan 22-02:
export { SearchIcon } from './SearchIcon';
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `getBreakEvenInfo` useCallback per-render | `breakEvenMap` useMemo + O(1) lookup | Eliminates double-computation on every virtualized row render |
| Duplicate picker state in 2 components | `useCustomerPicker` hook | Single source of truth for keyboard navigation; one test suite |
| `calculateMarketplaceFee` called 3× per render | `const marketplaceFee = useMemo(...)` | 2 fewer computations per keystroke in the sale form |
| `useSales()` global + scoped double subscription | `useAllSales()` + `useSales(jobId)` | Separate subscription with clear intent; explicit return type `Sale[]` |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (project-installed) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |
| TypeScript check | `tsc -b` (required; not `tsc --noEmit`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | New File? |
|--------|----------|-----------|-------------------|-----------|
| HYG-08 | `useCustomerPicker` keyDown branches (ArrowDown open/cycle, ArrowUp wrap, Enter-match, Enter-no-match, Escape stopPropagation, Tab no-pick) | Unit (hook) | `npm test -- useCustomerPicker` | Wave 0: `src/hooks/useCustomerPicker.test.ts` |
| HYG-08 | `visibleCustomers` sliced to PICKER_VISIBLE_LIMIT | Unit (hook) | `npm test -- useCustomerPicker` | Wave 0 |
| HYG-08 | `filteredCustomers` empty on blank query | Unit (hook) | `npm test -- useCustomerPicker` | Wave 0 |
| HYG-06 | `RecordSaleModal` create mode — form submits, `addSale` called | Component | `npm test -- RecordSaleModal` | Wave 0: `src/components/RecordSaleModal.test.tsx` |
| HYG-06 | `RecordSaleModal` edit mode — form hydrated from `editingSale` prop | Component | `npm test -- RecordSaleModal` | Wave 0 |
| HYG-06 | `RecordSaleModal` convert-from-quote — atomic tx fires (spy on `db.transaction`) | Component | `npm test -- RecordSaleModal` | Wave 0 |
| HYG-02/03/07 | `JobsManager.test.tsx` mount passes post-decomposition | Regression | `npm test -- JobsManager` | Exists — may need mock update for `useAllSales` in plan 22-06 |
| PERF-01 | `breakEvenMap` not rebuilt on non-job renders (verify dep array completeness) | Unit | Covered implicitly by JobsManager integration test | Exists |
| PERF-02/03 | `calculateMarketplaceFee` called once — verify via spy | Component | `npm test -- RecordSaleModal` | Wave 0 |
| PERF-04 | `useDynamicRowHeight` called with `key: searchQuery` | Static grep lock in test | `npm test -- CustomerLibrary` | Optional — grep assert in existing or new test |

### Wave 0 Gaps (files to create before implementation)

- [ ] `src/hooks/useCustomerPicker.test.ts` — covers keyDown branches + filteredCustomers + visibleCustomers + PICKER_VISIBLE_LIMIT
- [ ] `src/components/RecordSaleModal.test.tsx` — covers 3 modes: create, edit, convert-from-quote; use raw `createRoot` + `act` pattern (matches `PrintQuoteModal.test.tsx`)

### Sampling Rate

- **Per task commit:** `npm test -- <new-file>` (fast, targeted)
- **Per wave merge (end of each plan):** `npm test` (full suite)
- **Phase gate:** `tsc -b && npm test` fully green before `/gsd:verify-work`

---

## Environment Availability

> Step 2.6: All dependencies are project-internal (no external services, CLIs, or databases beyond Dexie/IndexedDB via jsdom). Phase is code/config-only changes to TypeScript source files.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `tsc -b`, `npm test` | ✓ | (project baseline) | — |
| Vitest + jsdom | Test suite | ✓ | (project-installed) | — |
| TypeScript | `tsc -b` verification | ✓ | (project-installed) | — |
| Dexie / dexie-react-hooks | `useLiveQuery` in `useAllSales` | ✓ | (project-installed) | — |
| react-window v2 | `useDynamicRowHeight key:` | ✓ | (project-installed) | — |

**Missing dependencies with no fallback:** None.

---

## Security Domain

> `security_enforcement` is absent from config.json — treated as enabled. However, this phase contains no new input handling, no new network calls, no new file I/O, and no new authentication surfaces. The security domain is not materially applicable to a structural refactor of existing UI state management.

### ASVS Categories Applicable

| ASVS Category | Applies | Rationale |
|---------------|---------|-----------|
| V2 Authentication | No | No auth changes |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | No access control changes |
| V5 Input Validation | Carried forward | `handleRecordSale` validation (`saleQuantity <= 0` guard) moves with the function verbatim — no regression |
| V6 Cryptography | No | No crypto changes |

**Known Threat Patterns:** None new. The existing `isSafeHttpUrl` import in `JobsManager.tsx` (line 15) is unrelated to this phase's extractions and stays in `JobsManager.tsx`.

---

## Open Questions

1. **`SaleFromQuoteSubtext` test import update**
   - What we know: `JobsManager.test.tsx:62` imports `SaleFromQuoteSubtext` from `'./JobsManager'` for direct unit testing
   - What's unclear: Whether the test suite runner resolves relative imports correctly if `SaleFromQuoteSubtext` moves to `SaleRow.tsx` with re-export
   - Recommendation: Export `SaleFromQuoteSubtext` from `SaleRow.tsx` and update the `JobsManager.test.tsx` import in the same plan 22-04 commit. Include in the plan as an explicit task step.

2. **PrintQuoteModal `customerPickerInputRef` dead code**
   - What we know: `PrintQuoteModal.tsx:72` has `const customerPickerInputRef = useRef<HTMLInputElement | null>(null)` which is wired to the picker `<Input ref={...}>` but `JobsManager.tsx:1083-1086` has a comment confirming this is dead code (never `.focus()`'d anywhere)
   - What's unclear: Whether `PrintQuoteModal`'s ref is similarly dead (it likely is, by the same logic)
   - Recommendation: When migrating `PrintQuoteModal` to `useCustomerPicker` in plan 22-03, drop the `customerPickerInputRef` entirely (it's not in the hook's return shape, and the CONTEXT.md comment explicitly says it was removed from `JobsManager` as dead code). Document the removal.

3. **`useId()` calls in RecordSaleModal**
   - What we know: `JobsManager.tsx:1041-1049` has 9 `useId()` calls for label/input pairing (A11Y-07 from Phase 19)
   - What's unclear: Whether any of these IDs are referenced in tests by DOM queries that would break after the modal extracts
   - Recommendation: The `JobsManager.test.tsx` tests don't mount the Record Sale modal (they test `OrdersQuoteRows`, `SaleFromQuoteSubtext`, and `JobCard`). No existing test should break. `RecordSaleModal.test.tsx` will create its own test DOM.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-window v2`'s `useDynamicRowHeight` accepts a `key` string argument — confirmed by Phase 15 precedent at `JobsManager.tsx:1666-1668` | PERF-04 change | Low: pattern already works in JobsManager; adding it to CustomerLibrary is the same API call |
| A2 | `useSales(job.id)` inside `RecordSaleModal` gives access to `addSale`/`updateSale`/`deleteSale` for the job's scope | RecordSaleModal pattern | Low: `useDatabase.ts:569` confirms `useSales(jobId?)` works with a jobId arg |
| A3 | `PrintQuoteModal.tsx`'s `customerPickerInputRef` is dead code (never `.focus()`'d) — follows same comment in `JobsManager.tsx:1083-1086` | PrintQuoteModal migration | Low: no functional impact if removed; worst case is re-adding it |
| A4 | Exact line numbers in `useDatabase.ts` for `useAllSales` insertion position (referenced as "after line 650") may have shifted | useAllSales insertion | Very low: functional content (useSales return brace) is the landmark, not the line number |

**If this table is empty:** No — 4 assumptions remain. All are LOW risk with clear mitigations.

---

## Sources

### Primary (HIGH confidence — verified from source code in this session)

- `src/components/JobsManager.tsx` — lines 974, 993, 1070-1071, 1080-1370, 1155-1210, 1280-1370, 1377-1525, 1666-1668, 1780-1833, 1837-2092, 2045-2091 — all extraction targets read directly
- `src/components/PrintQuoteModal.tsx` — lines 31, 55-178 — picker duplication confirmed; `pickedExistingCustomerId` divergence identified
- `src/components/CustomerLibrary.tsx` — lines 115, 153, 387-399 — `searchQuery` variable name confirmed; `SearchIcon` canonical version confirmed
- `src/hooks/useDatabase.ts` — lines 569-650 — `useSales` shape confirmed; insertion point for `useAllSales` confirmed
- `src/components/ui/Modal.tsx` — full file — HYG-09 unmount behavior confirmed (line 67: `if (!isOpen) return null`)
- `src/components/ui/icons/index.ts` — barrel structure confirmed; `SearchIcon` slot is absent
- `src/components/JobsManager.test.tsx` — lines 1-100, 330-410 — mock shape confirmed; `createRoot`+`act` pattern confirmed; `renderJobCard` helper shape confirmed
- `src/components/PrintQuoteModal.test.tsx` — lines 1-70 — test convention confirmed: `createRoot`+`act`, NO `renderHook`
- `.planning/config.json` — `nyquist_validation: true` confirmed

### Secondary (MEDIUM confidence)

- `.planning/phases/22-jobsmanager-decomposition-perf/22-CONTEXT.md` — all 27 decisions (authoritative for this phase)
- `.planning/ROADMAP.md` — Phase 22 success criteria (lines 143-163)
- `.planning/REQUIREMENTS.md` — HYG-02/03/06/07/08, PERF-01/02/03/04/07 requirement text

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all patterns verified from existing source
- Architecture: HIGH — every extraction target located and boundary-checked
- Pitfalls: HIGH — identified from direct code reading + comparison of duplicate implementations
- Researcher decisions (D-13/22/23/24): HIGH — all verified from source

**Research date:** 2026-05-27
**Valid until:** 2026-06-10 (30-day window; stable codebase)
