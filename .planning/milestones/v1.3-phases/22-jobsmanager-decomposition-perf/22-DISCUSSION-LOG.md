# Phase 22: JobsManager decomposition + perf - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 22-jobsmanager-decomposition-perf
**Areas discussed:** useCustomerPicker shape, RecordSaleModal extraction, SaleRow + small homes (PICKER_VISIBLE_LIMIT + SearchIcon), Perf details + useSales lift

---

## useCustomerPicker shape

### What does the hook return?

| Option | Description | Selected |
|--------|-------------|----------|
| State + handlers (recommended) | Hook owns query/open/activeIndex/filteredCustomers/visibleCustomers + handleKeyDown + handlePickCustomer wrapper. Consumer passes onPick(c) callback for the side-effect (filling its own setters). Most boilerplate eliminated; consumers stay declarative. | ✓ |
| Pure state hook | Hook returns only { query, open, activeIndex, visibleCustomers, filteredCustomers, setQuery, setOpen, setActiveIndex, reset } per ROADMAP success criterion #3 wording. Consumer wires its own onKeyDown and pick logic. Minimal abstraction; max consumer control; ~60 LOC handler still duplicated. | |
| Headless component <CustomerPicker> | Component renders the combobox Input + listbox + overflow footer + empty-state, takes onPick prop. Larger abstraction, removes JSX duplication too (~80 LOC dropdown listbox is duplicated today between JobsManager and PrintQuoteModal). | |

**User's choice:** State + handlers. Hook signature locks as `useCustomerPicker(customers, { onPick })` returning `{ query, open, activeIndex, visibleCustomers, filteredCustomers, setQuery, setOpen, setActiveIndex, handleKeyDown, reset }`. Hook owns the full keyDown logic including the CR-04 Escape stopPropagation.

### Data source

| Option | Description | Selected |
|--------|-------------|----------|
| Take customers as arg (recommended) | useCustomerPicker(customers, { onPick }) — hook stays pure-presentational. Consumer already calls useCustomers() for customersByEmail + bumpLastUsed + addCustomer anyway. Easier testing. | ✓ |
| Call useCustomers() inside the hook | Hook subscribes itself. Consumers stop passing customers in. BUT consumers still need useCustomers() separately for the auto-link side effect, so they'd subscribe twice. | |

**User's choice:** Take customers as arg.

---

## RecordSaleModal extraction

### Sale write logic

| Option | Description | Selected |
|--------|-------------|----------|
| Inside RecordSaleModal (recommended) | Modal owns handleRecordSale + the auto-link + the atomic Convert transaction. Parent passes onSave(sale, opts) only for closing/cleanup notification. Self-contained component; testable as a unit. addSale/updateSale/bumpLastUsed/addCustomer pulled from useSales/useCustomers inside the modal. | ✓ |
| Parent passes onSave callback | Modal collects form state and calls onSave({ sale, editingSale, convertingFromQuote, autoLinkCustomer }) — parent JobsManager runs the actual db.transaction + addCustomer/bumpLastUsed. Keeps modal presentational; concentrates DB writes in one place. More props/handlers cross the boundary. | |
| Extract write to a hook | New useRecordSale() hook owns handleRecordSale logic + auto-link + atomic Convert. Both JobsManager (legacy) and the new RecordSaleModal consume it. Cleanest separation but adds a third concept and only has one consumer for now. | |

**User's choice:** Inside RecordSaleModal. The 149-LOC handleRecordSale and the picker state both leave JobsManager.

### Props API — diverge from ROADMAP literal?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal calls useCustomers() (recommended) | Modal subscribes internally; props drop customers + customersByEmail. Cleaner API, fewer props, JobsManager doesn't need useCustomers for the modal path. Diverges from ROADMAP literal wording (which would be updated in CONTEXT/STATE notes). | ✓ |
| Follow ROADMAP literally | JobsManager keeps useCustomers() and passes customers + customersByEmail as props. Honors the success criterion text verbatim. Slightly more coupling at the call site. | |

**User's choice:** Modal calls useCustomers(). ROADMAP criterion #1 prop list will be re-noted in STATE.md after Phase 22 ships.

---

## SaleRow + small homes

### SaleRow scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full <details> + body + buttons (recommended) | <SaleRow sale={...} jobId={...} onEdit={...} onDelete={...} /> renders the whole accordion. JobCard maps recentSales → <SaleRow>. Aligns with ROADMAP #6 ('standalone testable component for the per-sale <details> accordion'). Independently unit-testable; symmetric with <QuoteRow> at line 149. | ✓ |
| Body only (no <details>) | <SaleRow> renders the expanded customer block + Edit/Delete; JobCard keeps the <details>/<summary> wrapper. Smaller component; <details> stays where the summaryLabel + SaleFromQuoteSubtext live. | |

**User's choice:** Full <details> + body + buttons.

### PICKER_VISIBLE_LIMIT home (HYG-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Inside useCustomerPicker.ts (recommended) | Constant co-located with the hook that uses it. Exported for tests; consumers don't import it directly (the hook returns visibleCustomers already sliced). Matches ROADMAP #4 alternative. One file holds the limit + the slice. | ✓ |
| src/utils/format.ts | Lives next to other formatting/limit constants. Exported by name; both pickers import it. Slightly more discoverable for non-picker uses (but no other use exists today). | |
| New src/components/customerPickerConfig.ts | Dedicated module per REQUIREMENTS HYG-02 wording. Single-export file. Most ceremonious; only justified if more picker config emerges. | |

**User's choice:** Inside useCustomerPicker.ts.

### SearchIcon home (HYG-03)

| Option | Description | Selected |
|--------|-------------|----------|
| src/components/ui/icons/SearchIcon.tsx (recommended) | Matches ROADMAP #5 verbatim. New ui/icons/ subfolder establishes a home for future extracted icons. Barrel export via ui/icons/index.ts; JobsManager + CustomerLibrary import from there. | ✓ |
| src/components/ui/SearchIcon.tsx | Lives at ui/ root next to Button/Input/Card/Modal. No new subfolder. Cleaner for one icon, but the project has 3+ duplicated icons today and grouping them in icons/ now avoids ui/ root sprawl later. | |

**User's choice:** src/components/ui/icons/SearchIcon.tsx with a new ui/icons/index.ts barrel.

---

## Perf details + useSales lift

### breakEvenMap home (PERF-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level useMemo at component root (recommended) | const breakEvenMap = useMemo(...) keyed on [searchedJobs, salesByJob]. Computed once per render; rowProps + the non-virtualized branch + the JobCard summary use .get(job.id). computeBreakEvenInfo lifts to module scope. | ✓ |
| Inside rowProps useMemo only | Map built where rowProps already memoizes. Doesn't help the non-virtualized branch (line 1806) which would still need its own lookup. | |

**User's choice:** Top-level useMemo at component root. `rowProps.getBreakEvenInfo` stays a function that closes over the map (so `JobRowProps` shape is preserved and existing tests at `JobsManager.test.tsx:340` still mount).

### Marketplace fee (PERF-02 + PERF-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Hoist + memoize result in modal (recommended) | Lift calculateMarketplaceFee to module scope. In RecordSaleModal: const marketplaceFee = useMemo(...). Closes both PERF-02 + PERF-03. | ✓ |
| Hoist only | Move to module scope; keep three call sites in JSX. Closes PERF-03 but not PERF-02. | |
| Single const (no useMemo) | Hoist + compute in a const at function-body top. Pure fn so memoization is overhead. Closes both findings via the const. | |

**User's choice:** Hoist + memoize result in modal.

### useSales global lift (PERF-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Add `allSales` to useDatabase + drop in JobsManager (recommended) | Extract useAllSales() (or add allSales to a future combined hook). JobsManager keeps useSales(selectedJobId) for the scoped subscription, drops the duplicate useSales() global call. Two subscriptions become one (the global one feeds salesByJob). Small change; closes PERF-07 cleanly. | ✓ |
| Lift to App.tsx + prop-drill | App.tsx subscribes to allSales, passes through to JobsManager. Single global subscription app-wide. More refactor surface; touches the App tab plumbing. | |
| Defer PERF-07 to v1.4 | Mark #10 as not-ship-this-phase. ROADMAP allows it. Reduces phase surface; leaves duplicate subscription for now. | |

**User's choice:** Add useAllSales (or equivalent) to useDatabase. Researcher picks the exact shape per D-23.

---

## Edge items

| Option | Description | Selected |
|--------|-------------|----------|
| Ship as written (recommended) | PERF-04 = add key: searchQuery to CustomerLibrary's useDynamicRowHeight call. RecordSaleModal.test.tsx covers 3 modes (create / edit / convert-from-quote) using raw createRoot + act. No new test library. | ✓ |
| Skip RecordSaleModal.test.tsx — cover in Phase 23 | Roll the RecordSaleModal test into Phase 23. Reduces Phase 22 surface but disconnects test-from-extraction. | |
| Discuss further | Open one of these for deeper discussion. | |

**User's choice:** Ship as written.

---

## Claude's Discretion

- Exact name of the `<RecordSaleModal>` `onSaved` callback prop (recommend keeping optional, start unused)
- Whether `computeBreakEvenInfo` lifts to `src/utils/breakEven.ts` or stays at module scope (recommend module scope until 2nd consumer)
- Whether `calculateMarketplaceFee` lifts to `src/utils/marketplaceFee.ts` or stays at module scope (recommend module scope until 2nd consumer)
- Researcher picks between PERF-07 shape (a) `useAllSales` vs (b) `useSalesByJob` (recommend (a))
- Whether `useCustomerPicker.test.ts` uses raw `createRoot` + `act` vs `renderHook` (recommend whatever convention `PrintQuoteModal.test.tsx` uses)
- Whether `SaleFromQuoteSubtext` moves to `SaleRow.tsx` as local component (recommend yes)
- Whether new `ui/icons/index.ts` barrel pre-declares other icon extractions or stays clean (recommend clean)
- Exact insertion order for `useAllSales` in `useDatabase.ts` (recommend right after `useSales`)

## Deferred Ideas

- `<JobCard>` further decomposition (header/actions/orders) — backlog if JobCard re-grows >300 LOC
- `<QuoteRow>` relocation to its own file — hygiene win, not in any audit finding
- `<OrdersSection>` extraction — not in any audit finding
- Customer picker capabilities (inline "Create new customer" CTA from empty-state dropdown) — v1.4+
- `<ConfirmDialog>` primitive — Phase 19 deferred, Phase 22 also defers
- Other icon extractions (ChevronRight, Tag, X) — on-demand when next-touched
- `src/utils/breakEven.ts` extraction — promote on 2nd consumer
- `src/utils/marketplaceFee.ts` extraction — promote on 2nd consumer
- Replace `<details>` with custom accordion primitive in `<SaleRow>` — only if future a11y review flags it
- App.tsx-level lift of all sales subscription + prop-drilling — rejected for the smaller `useAllSales` shape
- PrintQuoteModal's picker JSX dedup beyond hook consumption (`<CustomerPickerDropdown>` headless component) — backlog if 3rd consumer surfaces
