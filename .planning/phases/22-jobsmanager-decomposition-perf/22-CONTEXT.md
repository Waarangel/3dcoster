# Phase 22: JobsManager decomposition + perf - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

`JobsManager.tsx` is no longer a 2,100-line god-component. The Record Sale form is its own modal at `src/components/RecordSaleModal.tsx`, the customer picker is a reusable hook at `src/hooks/useCustomerPicker.ts` consumed by both consumers, `<SaleRow>` is extracted from `<JobCard>` for the per-sale `<details>` accordion, and the per-job render path is O(1) `Map<string, BreakEvenInfo>` lookup instead of recomputation. Closes 10 audit findings: HYG-02 (PICKER_VISIBLE_LIMIT centralize), HYG-03 (SearchIcon extract), HYG-06 (RecordSaleModal extract), HYG-07 (SaleRow extract), HYG-08 (useCustomerPicker hook), PERF-01 (breakEvenMap), PERF-02 (marketplaceFee memoize), PERF-03 (marketplaceFee hoist), PERF-04 (CustomerLibrary row-height key), PERF-07 (useSales lift).

**In scope:**
- New `src/hooks/useCustomerPicker.ts` — takes `(customers, { onPick })`, returns `{ query, open, activeIndex, visibleCustomers, filteredCustomers, setQuery, setOpen, setActiveIndex, handleKeyDown, reset }`. Owns the full ~60-LOC keyDown handler including the Escape `stopPropagation` that prevents the surrounding Modal from also closing (mirrors `JobsManager.tsx:1356-1365` + `PrintQuoteModal.tsx:162-167` patterns verbatim).
- New `src/components/RecordSaleModal.tsx` — owns its own state, `handleRecordSale` logic, the customer auto-link side-effect (D-06/D-07 from Phase 15.1), and the Convert-from-Quote atomic `db.transaction('rw', db.sales, db.quotes, db.jobs, ...)` block (the inline atomic tx today at `JobsManager.tsx:1505-1516` moves WITH the modal). Calls `useSales()` and `useCustomers()` internally. Uses the Phase 19 `<Modal>` primitive. Consumes `useCustomerPicker`.
- New `src/components/SaleRow.tsx` — extracted from `<JobCard>`, owns the full `<details>` accordion (summary line + customer block + Edit/Delete buttons + the optional `SaleFromQuoteSubtext`). Symmetric with `<QuoteRow>` at `JobsManager.tsx:149`.
- New `src/components/ui/icons/SearchIcon.tsx` + new `src/components/ui/icons/index.ts` barrel — establishes the home for future extracted icons (ChevronRight, Tag, X candidates).
- `JobsManager.tsx` shrinks by at least 400 lines (target: under 1,500 lines total). The Record Sale `<Modal isOpen={...}><div className="p-4">…</div></Modal>` block at lines 1837-2092 is replaced by `<RecordSaleModal isOpen={...} {...} />`. The picker state triplet + memos + 60-LOC keyDown handler + `PICKER_VISIBLE_LIMIT` const all leave JobsManager.
- `breakEvenMap = useMemo<Map<string, BreakEvenInfo>>(...)` built once at the JobsManager component root, keyed on `[searchedJobs, salesByJob]`. Pure `computeBreakEvenInfo(job, salesByJob)` helper hoisted to module scope (or a new `src/utils/breakEven.ts` if it ends up reused). All three consumers — `rowProps.getBreakEvenInfo`, JobCard's `info={breakEvenMap.get(job.id)!}`, and the non-virtualized branch at line 1806 — go through `.get(job.id)` instead of recomputing.
- `calculateMarketplaceFee` hoisted to module scope (or `src/utils/marketplaceFee.ts`) as a pure function. Inside RecordSaleModal: `const marketplaceFee = useMemo(() => calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace), [saleQuantity, salePrice, saleMarketplace])` — computed once per render, used in the 3 JSX sites that currently call it independently (`saleTotal`/`marketplaceFeeRow`/`netRevenue`).
- `useDatabase.ts` gains a slot for the global sales subscription so JobsManager drops the duplicate `useSales()` call at line 1071. Two viable shapes (researcher recommends one): (a) new `useAllSales()` standalone hook that wraps `useLiveQuery(() => db.sales.orderBy('soldAt').reverse().toArray())`; or (b) `useSales(jobId?)` already supports the global case when `jobId` is undefined — instead lift the `salesByJob` Map construction itself into a new `useSalesByJob()` hook. Researcher picks; both close PERF-07.
- `CustomerLibrary.tsx:153` — `useDynamicRowHeight({ defaultRowHeight: 88 })` gains `key: customerSearchQuery` (the existing search-input state at that file). Single-line change. PERF-04.
- New `RecordSaleModal.test.tsx` — covers the 3 modes ROADMAP success criterion #11 names (create / edit / convert-from-quote) using raw `createRoot` + `act` (Phase 19 D-21 + project precedent; no `@testing-library/react`).
- New `useCustomerPicker.test.ts` — covers the keyDown handler edge cases that today live in JobsManager (ArrowDown wrap, Enter-with-match, Enter-with-no-match, Escape stopPropagation, Tab close-without-pick). Pure hook test using `renderHook` from React test-utils or the raw `createRoot` host-component pattern (researcher picks; matches whatever convention `PrintQuoteModal.test.tsx` already uses for picker tests).
- Existing `JobsManager.test.tsx` mount must work against the decomposed structure — researcher confirms which existing assertions need re-targeting (the mock `useSales: () => ({...})` at line 47 may need to expand if PERF-07 ships a new hook).

**Out of scope (redirected):**
- Any user-facing UI change. Hardening-only milestone — no `features.ts` entry, no `<NewBadge>` JSX, no copy or layout change beyond what extraction preserves byte-identically.
- Extracting `<JobCard>` further (e.g., into header / actions / orders subcomponents). Out of scope; would balloon the phase. `<JobCard>` keeps its current shape minus the inline `<details>` block (which moves into `<SaleRow>`).
- Extracting `<QuoteRow>` from `JobsManager.tsx:149`. Already a standalone exported function in the same file; Phase 22 leaves it where it is.
- Extracting the `<OrdersSection>` wrapper at line 333. Out of scope.
- Adding `customersByEmail` / `customers` to `<RecordSaleModal>` props. Modal owns its `useCustomers()` subscription per D-06 below — ROADMAP success criterion #1 prop list (which lists `customers, customersByEmail`) is updated in this CONTEXT.
- Customer picker styling / accessibility changes. The combobox role + listbox + `aria-activedescendant` JSX shipped in Phase 15.1 stays byte-identical post-extraction. Only the state/handler code moves.
- New customer-picker capabilities (e.g., creating a customer inline from the dropdown empty-state). Backlog for v1.4+.
- Replacing `<details>`/`<summary>` with a custom accordion primitive in `<SaleRow>`. Native `<details>` is correct; preserving the current `[&::-webkit-details-marker]:hidden` + `group-open:rotate-90` chevron styling.
- Customer Library row-height key beyond PERF-04. Other CustomerLibrary refactors (e.g., delete-confirm modal patterns) are out of scope.
- New `<ConfirmDialog>` primitive for the 2 inline Delete confirms still in JobsManager (Phase 19 deferred this). Continues deferred.
- The `useSales(selectedJobId || undefined)` scoped subscription stays at line 1070 — only the global `useSales()` at line 1071 is the PERF-07 target.
- Backward-compat shims for sales records or migration code. No schema change.

</domain>

<decisions>
## Implementation Decisions

### useCustomerPicker hook (HYG-08)

- **D-01:** Signature is `useCustomerPicker(customers: Customer[], { onPick }: { onPick: (c: Customer) => void })`. Customers passed in as arg (not subscribed inside the hook) — keeps the hook pure-presentational and avoids double subscriptions in consumers that already need `useCustomers()` for `customersByEmail` / `bumpLastUsed` / `addCustomer` (the auto-link side effect). Easier to unit-test (no Dexie mock inside hook test).
- **D-02:** Return shape: `{ query, open, activeIndex, visibleCustomers, filteredCustomers, setQuery, setOpen, setActiveIndex, handleKeyDown, reset }`. Matches ROADMAP success criterion #3 verbatim; the addition over the criterion is making `handleKeyDown` and a `handlePickCustomer` wrapper part of the hook (researcher confirms `handlePickCustomer` is exposed via `handleKeyDown`'s Enter branch + optionally as a named return for consumers that need to wire onClick directly on listbox rows — current `JobsManager.tsx:1925` + `PrintQuoteModal.tsx:347` both do `onClick={() => { void handlePickCustomer(c); }}` so it must be reachable; recommend exposing as `pick` in the returned object).
- **D-03:** `handleKeyDown` ports the existing 60-LOC `useCallback` from JobsManager verbatim. Includes the Escape `e.stopPropagation()` that prevents the surrounding Modal's document-level Escape listener from also firing (CR-04 fix at JobsManager.tsx:1358-1365 — without it, Escape on the picker would close the parent Record Sale modal mid-entry). Tab closes the dropdown but does NOT auto-pick (UI-SPEC §5).
- **D-04:** `onPick` is invoked from inside the hook's keyDown handler on Enter-with-match AND from a separate `pick(c)` returned function the consumer wires to listbox `onClick`. Consumer's `onPick(c)` fills its own four setters (Name/Email/Company/Address — NEVER Notes per Phase 15.1 D-05). The hook then internally calls `setQuery('')` + `setOpen(false)` + `setActiveIndex(0)` (i.e., resets dropdown UI state automatically — consumer doesn't reset twice).
- **D-05:** `PICKER_VISIBLE_LIMIT = 8` lives in `src/hooks/useCustomerPicker.ts` (HYG-02). Exported for tests + for the overflow-footer JSX in the listbox (`Showing first {PICKER_VISIBLE_LIMIT} of {filteredCustomers.length} matches`). Consumer code doesn't import it directly because `visibleCustomers` is already sliced by the hook.

### RecordSaleModal extraction (HYG-06)

- **D-06:** Final prop signature is `{ job: PrintJob, userProfile: UserProfile, userCurrency: Currency, shippingConfig: ShippingConfig, editingSale: Sale | null, convertingFromQuote: Quote | null, isOpen: boolean, onClose: () => void, onSaved?: () => void }`. **Diverges from ROADMAP success criterion #1 literal wording** (which lists `customers, customersByEmail` as props): the modal subscribes via `useCustomers()` itself, so those two props drop. JobsManager loses both `useCustomers()` and the picker state — it only passes `job`/`editingSale`/`convertingFromQuote` from local state, plus the static props it already receives. ROADMAP criterion #1 will be re-noted in STATE.md after Phase 22 ships.
- **D-07:** Modal owns `handleRecordSale` (149-LOC fn at `JobsManager.tsx:1377-1525`) verbatim. Including: the customer auto-link side-effect (D-06 auto-create + D-07 silent link from Phase 15.1) and the Convert-from-Quote atomic `db.transaction('rw', db.sales, db.quotes, db.jobs, ...)` block at lines 1505-1516. `addSale` / `updateSale` come from the local `useSales()` call inside the modal. `bumpLastUsed` / `addCustomer` come from the local `useCustomers()`.
- **D-08:** `editingSale` and `convertingFromQuote` remain CONTROLLED by the parent (JobsManager owns the state slots that decide which row is being edited / converted). On Save (or on `onClose`), the modal calls `onClose()` and the parent clears its state slots. The modal's local form state still resets on `isOpen` transition false→true via a `useEffect` keyed on `editingSale`/`convertingFromQuote` (hydrates form fields from those props when they flip from null → non-null). Cleaner than the current `handleEditSale` / `handleStartConversion` setters fanning out 13 setState calls.
- **D-09:** Modal pulls picker state through `useCustomerPicker(customers, { onPick: handlePickCustomer })` where `handlePickCustomer(c)` sets the 4 sale-customer form fields. The picker JSX (combobox `<Input>` + listbox + overflow-footer + empty-state) moves byte-identically into the modal — only the surrounding state references rename. `aria-controls`/`id` strings (`customer-picker-input` / `customer-picker-listbox` / `customer-option-${c.id}`) stay the same.
- **D-10:** `<Modal size="md">` matches the current Record Sale overlay size (Phase 19 mapped it to `md`). Title prop receives the same template: `${editingSale ? 'Edit Sale' : 'Record Sale'} - ${job.name}`. The `convertingFromQuote` blue helper banner (lines 1844-1848) stays as the first child inside Modal — preserves current visual order (Phase 19 D-17 precedent: don't add a `subtitle` prop for this one case).

### SaleRow extraction (HYG-07)

- **D-11:** `<SaleRow sale={Sale} jobId={string} onEdit={(s) => void} onDelete={(s) => void} />` renders the full `<details>` block from `JobsManager.tsx:742-802`. Includes the summary line (`{quantity}x @ ${price} ({customerName})` + `SaleFromQuoteSubtext`), the customer block body, and the Edit/Delete Button row. Matches ROADMAP success criterion #6: "standalone testable component for the per-sale `<details>` accordion."
- **D-12:** Lives at `src/components/SaleRow.tsx`. Sibling to `RecordSaleModal.tsx` and the existing `<QuoteRow>` (which is currently inside `JobsManager.tsx` but exported — Phase 22 leaves `<QuoteRow>` where it is per scope).
- **D-13:** `SaleFromQuoteSubtext` (currently exported from `JobsManager.tsx:314`) — researcher decides whether to move it next to `<SaleRow>` (cleaner grouping) or leave it as the existing JobsManager.tsx export and import it in. Recommend moving to `SaleRow.tsx` as a non-exported local component since it's only used inside `<SaleRow>`'s summary line. If a test or other consumer needs it, re-export from there.
- **D-14:** JobCard maps `recentSales.slice(0, 5)` to `<SaleRow>` instances (preserves current 5-cap). The map at `JobsManager.tsx:725-803` reduces to: `{recentSales.slice(0, 5).map(s => <SaleRow key={s.id} sale={s} jobId={job.id} onEdit={onEditSale} onDelete={onDeleteSale} />)}`. Roughly 80 LOC inside JobCard collapses to one line.

### SearchIcon extraction (HYG-03)

- **D-15:** Lives at `src/components/ui/icons/SearchIcon.tsx`. New `src/components/ui/icons/index.ts` barrel exports it (and establishes the home for future ChevronRight / Tag / X extractions — out of scope this phase but the structure invites them).
- **D-16:** Local SearchIcon definitions deleted from BOTH `JobsManager.tsx:974` AND `CustomerLibrary.tsx:387`. Both files import from `src/components/ui/icons` (or `src/components/ui/icons/SearchIcon`). SVG markup must match the existing CustomerLibrary `SearchIcon` byte-identically (it's the canonical version — JobsManager's was copied from it per the existing comment at `JobsManager.tsx:971`).

### Perf — breakEvenMap (PERF-01)

- **D-17:** `computeBreakEvenInfo(job, salesByJob)` lifts to module scope as a pure function inside `JobsManager.tsx` (or a new `src/utils/breakEven.ts` if researcher prefers — recommend module-scope inside JobsManager.tsx because there's no second consumer today and the No-Analog rule says don't extract until 2+ surfaces need it). The body is the existing `getBreakEvenInfo` body at lines 1180-1209 with `salesByJob` taken as an argument instead of read from the `useCallback` closure.
- **D-18:** `const breakEvenMap = useMemo(() => new Map(searchedJobs.map(j => [j.id, computeBreakEvenInfo(j, salesByJob)])), [searchedJobs, salesByJob])` built at the JobsManager root (after `salesByJob` and `searchedJobs` are defined; before `rowProps`). The map is computed once per render; the three consumers — `rowProps.getBreakEvenInfo` (now a `(job) => breakEvenMap.get(job.id)!` lookup), the non-virtualized JSX branch at line 1806, and JobCard's `info={getBreakEvenInfo(job)}` at line 881 — all become O(1) `.get(job.id)` lookups.
- **D-19:** `rowProps.getBreakEvenInfo` is kept as a function (not a Map) in the rowProps shape — passing the function preserves JobRow's existing signature without forcing every consumer to learn about the Map. The function closes over `breakEvenMap` and does the lookup. This keeps the public surface of `JobRowProps` unchanged so the existing test mounts (`JobsManager.test.tsx:340-382` `renderJobCard` helper) work without modification.

### Perf — calculateMarketplaceFee (PERF-02 + PERF-03)

- **D-20:** `calculateMarketplaceFee(price: number, marketplace: MarketplaceType): number` lifts to module scope. Current location: `JobsManager.tsx:1156-1165`. Moves WITH `<RecordSaleModal>` since the modal is the only consumer — researcher recommends inside `RecordSaleModal.tsx` at module scope (no React closures, pure function). If a 2nd consumer emerges (e.g., a future PDF flow), promote to `src/utils/marketplaceFee.ts` then.
- **D-21:** Inside RecordSaleModal: `const marketplaceFee = useMemo(() => calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace), [saleQuantity, salePrice, saleMarketplace])`. The three JSX sites that currently call `calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace)` separately (lines 2061, 2064, 2070) all read the same `marketplaceFee` const. Closes both PERF-02 (three calls collapse to one) and PERF-03 (hoisted, no closure capture).

### Perf — CustomerLibrary row-height key (PERF-04)

- **D-22:** `CustomerLibrary.tsx:153` — change `useDynamicRowHeight({ defaultRowHeight: 88 })` to `useDynamicRowHeight({ defaultRowHeight: 88, key: searchQuery })` (where `searchQuery` is the existing local search-input state at that file; researcher confirms the exact local-variable name). One-line change. The `key` arg invalidates the height cache when the filtered set changes, mirroring the JobsManager bi-key pattern from Phase 15 plan 04 D-05.

### Perf — useSales global lift (PERF-07)

- **D-23:** Add a global-sales subscription to `useDatabase.ts`. Researcher picks the cleanest shape — two candidates:
  - **(a)** New `useAllSales(): Sale[]` standalone hook that wraps `useLiveQuery(() => db.sales.orderBy('soldAt').reverse().toArray(), [])`. JobsManager imports it, drops the duplicate `useSales()` call at line 1071, and continues using `useSales(selectedJobId || undefined)` for the scoped subscription at line 1070.
  - **(b)** New `useSalesByJob(): Map<string, Sale[]>` hook that owns the live subscription AND the Map construction (currently at `JobsManager.tsx:1088-1096`). JobsManager imports the Map directly.
  - Recommendation: **(a)** — smaller surface, doesn't move the salesByJob memo, easier to migrate `JobsManager.test.tsx`'s `useSales` mock at line 47.
- **D-24:** Test mock at `JobsManager.test.tsx:47` needs the new hook stubbed too (one extra `useAllSales: () => ({ sales: [...] })` or `useAllSales: () => []` depending on D-23 choice). Researcher confirms the exact shape after picking (a) or (b).

### Plan structure

- **D-25:** 6 plans, executed with light dependency coupling (matches ROADMAP). Plans build the foundation first (hook + utilities), then extract the components that consume them, then layer the perf changes:
  - **22-01:** `useCustomerPicker` hook + `useCustomerPicker.test.ts` + `PICKER_VISIBLE_LIMIT` centralized. Standalone — no consumer touched yet.
  - **22-02:** `SearchIcon` extract to `src/components/ui/icons/SearchIcon.tsx` + barrel; delete both local copies (JobsManager + CustomerLibrary).
  - **22-03:** `<RecordSaleModal>` extracted from JobsManager. Uses Phase 19 `<Modal>` primitive + new `useCustomerPicker` (so 22-01 must be done). Includes `RecordSaleModal.test.tsx` for 3 modes (create / edit / convert-from-quote). PrintQuoteModal also migrates to the new `useCustomerPicker` here (deletes the duplicate state triplet + memos + 60-LOC keyDown handler from `PrintQuoteModal.tsx:31-178`).
  - **22-04:** `<SaleRow>` extracted from `<JobCard>`. JobCard's `recentSales.slice(0, 5).map(...)` reduces to one line per row.
  - **22-05:** Perf bundle — `breakEvenMap` (PERF-01) + `calculateMarketplaceFee` hoist + memoize inside RecordSaleModal (PERF-02 + PERF-03) + `CustomerLibrary` row-height key (PERF-04). One plan because they're three orthogonal one-shot edits sharing the perf theme.
  - **22-06:** PERF-07 useSales lift + UAT + test re-mount verification. Adds the new hook to useDatabase.ts; JobsManager drops the duplicate subscription; JobsManager.test.tsx mock updated; manual UAT confirms break-even pill + revenue numbers still match across the JobsManager surface.
- **D-26:** Dependency chain — 22-01 must complete before 22-03 (RecordSaleModal consumes the hook). 22-02 is independent — runs in parallel with 22-01. 22-04 can run in parallel with 22-03 (different files). 22-05 must run after 22-03 (calculateMarketplaceFee changes land inside the new RecordSaleModal). 22-06 runs last so the test mock update happens against the final modal structure.
- **D-27:** Atomic commit per task within each plan (Phase 18/19/20/21 precedent). `gsd-sdk query commit` helper. No `--no-verify` ever. `tsc -b` for TypeScript verification (Vercel runs `tsc -b && vite build`). No `features.ts` entry, no `<NewBadge>` JSX — hardening-only milestone, zero visible UI change.

### Claude's Discretion

- The exact name of the `<RecordSaleModal>` `onSaved` callback prop — `onSaved` vs `onSaveComplete` vs none-at-all (just rely on `onClose` since save always closes). Recommend keeping `onSaved?` optional for future cases where the parent needs to react to a successful save (e.g., focusing a row after Convert-from-Quote completes); start unused.
- Whether `computeBreakEvenInfo` lifts to a new `src/utils/breakEven.ts` file or stays at module scope in `JobsManager.tsx`. Recommend module scope until a 2nd consumer surfaces (No-Analog rule from Phase 15 plan 04 + Phase 11 patterns).
- Whether `calculateMarketplaceFee` lifts to `src/utils/marketplaceFee.ts` or stays at module scope in `RecordSaleModal.tsx`. Same recommendation — module scope until 2nd consumer.
- Researcher's choice between PERF-07 shape (a) `useAllSales` vs (b) `useSalesByJob` per D-23. Recommend (a).
- Whether `useCustomerPicker.test.ts` uses the existing raw `createRoot` + `act` test pattern or `renderHook` from React test utilities. Recommend whatever convention the existing repo uses; `PrintQuoteModal.test.tsx` is the closest reference (researcher confirms its picker-test setup). If renderHook isn't already in use, prefer the raw pattern.
- Whether `SaleFromQuoteSubtext` (currently exported from `JobsManager.tsx:314`) moves to `SaleRow.tsx` (D-13) — recommend yes since `<SaleRow>` is the only consumer.
- Whether the new `src/components/ui/icons/index.ts` barrel pre-declares other icon extractions (ChevronRight / Tag / X) as TODOs or stays clean with just SearchIcon. Recommend clean — extract those icons only when they cause a real concrete duplication next phase.
- Exact file ordering for the `useDatabase.ts` insertion of `useAllSales` — recommend right after `useSales(jobId?)` since they're siblings.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 22 scope sources
- `.planning/ROADMAP.md` §"Phase 22: JobsManager decomposition + perf" — locked goal, all 11 success criteria, plan estimate (~6 plans), dependency on Phase 19
- `.planning/REQUIREMENTS.md` — full text of every requirement closed by this phase: HYG-02, HYG-03, HYG-06, HYG-07, HYG-08, PERF-01, PERF-02, PERF-03, PERF-04, PERF-07
- `.planning/PROJECT.md` — milestone v1.3 framing (hardening-only, no new user-facing features); Phase 22 is the biggest scope; depends on Phase 19's `<Modal>` primitive (shipped)
- `.planning/STATE.md` — current milestone position; Phase 22 unblocked because Phase 19 complete

### v1.2 audit sources (closure targets)
- `.planning/v1.2-CODE-AUDIT.md` §"MEDIUM findings" #16 (`getBreakEvenInfo` per-render recomputation) + #29 (all-rows re-render) — closed by PERF-01 breakEvenMap
- `.planning/v1.2-CODE-AUDIT.md` §"MEDIUM findings" #17 (`calculateMarketplaceFee` called 3x per sale-form render) — closed by PERF-02
- `.planning/v1.2-CODE-AUDIT.md` §"LOW findings" #31 (`calculateMarketplaceFee` defined inside the React component) — closed by PERF-03
- `.planning/v1.2-CODE-AUDIT.md` §"MEDIUM findings" #18 (`useDynamicRowHeight` no key in CustomerLibrary) — closed by PERF-04
- `.planning/v1.2-CODE-AUDIT.md` §"LOW findings" #30 (`useSales()` global call duplicated alongside scoped) — closed by PERF-07
- `.planning/v1.2-TECH-DEBT.md` §H2 (PICKER_VISIBLE_LIMIT duplicate) — closed by HYG-02
- `.planning/v1.2-TECH-DEBT.md` §H3 (`SearchIcon` SVG duplicate) — closed by HYG-03
- `.planning/v1.2-TECH-DEBT.md` §H6 + H7 (`<RecordSaleModal>` extract + `handleRecordSale` decomposition) — closed by HYG-06
- `.planning/v1.2-TECH-DEBT.md` §H8 (`<SaleRow>` extract from `<JobCard>`) — closed by HYG-07
- `.planning/v1.2-TECH-DEBT.md` §H9 + H10 (`useCustomerPicker` hook consolidation) — closed by HYG-08

### Prior phase context (carried-forward conventions)
- `.planning/phases/19-modal-primitive-a11y-migration/19-CONTEXT.md` — Phase 19 `<Modal>` primitive shipped with `{ isOpen, onClose, title, children, size }`; `<RecordSaleModal>` wraps it. D-17: convertingFromQuote helper banner stays as first child (no subtitle prop). D-19: explicitly DEFERRED HYG-06/07/08 to Phase 22 with the inline overlays wrapped-in-place. D-21: tests use raw `createRoot` + `act` (no `@testing-library/react`).
- `.planning/phases/15.1-customer-library/15.1-CONTEXT.md` — Customer picker pattern (CL-04). D-05: `handlePickCustomer` fills Name/Email/Company/Address — NEVER Notes (Notes is sale-level transaction context, not buyer-bound). D-06 auto-create + D-07 silent link side-effects fire from `handleRecordSale` at sale-commit time only (WR-05 fix: NEVER from pick-time).
- `.planning/phases/16-printable-pdf-quote/16-CONTEXT.md` — PrintQuoteModal context. The picker pattern at `PrintQuoteModal.tsx:31-178` is byte-identical to JobsManager's; both migrate to `useCustomerPicker` in plan 22-03. Convert-from-Quote atomic Dexie transaction at `JobsManager.tsx:1505-1516` moves WITH `<RecordSaleModal>` (D-07).
- `.planning/phases/20-dexie-atomicity-audit/20-CONTEXT.md` — D-01: `addSale`/`updateSale`/`deleteSale` wrapped in `db.transaction('rw', ...)` in `useDatabase.ts` (post-Phase 20). RecordSaleModal calls those hooks directly; the atomicity property carries through. The inline Convert-from-Quote tx at JobsManager.tsx:1505-1516 mirrors the addSale body verbatim — moving it WITH the modal doesn't change its atomicity.
- `.planning/phases/15-tags-search-quick-duplicate/15-CONTEXT.md` — Phase 15 plan 04 D-05: dynamic row-height bi-key invalidation. PERF-04 ports the SAME pattern (single-key on searchQuery) to CustomerLibrary.

### Existing code that the planner must read
- `src/components/JobsManager.tsx` — 2,100 LOC. Key sites:
  - **lines 374-812:** `<JobCard>` definition; sale `<details>` accordion at 742-802 = `<SaleRow>` extraction target (D-11/D-13/D-14)
  - **lines 1006-2099:** `JobsManager` main function (1,142 LOC body)
  - **lines 1070-1071:** duplicate `useSales()` calls — PERF-07 D-23 target
  - **lines 1080-1370:** picker state triplet + filteredCustomers/visibleCustomers memos + handlePickCustomer + handlePickerKeyDown — useCustomerPicker hook source
  - **lines 1156-1165:** `calculateMarketplaceFee` defined inside component — PERF-03 D-20 target
  - **lines 1180-1210:** `getBreakEvenInfo` useCallback — PERF-01 D-17/D-18 target
  - **lines 1280-1293:** filteredCustomers + visibleCustomers memos — moves to useCustomerPicker
  - **lines 1377-1525:** `handleRecordSale` (149 LOC, includes Convert-from-Quote atomic tx at 1505-1516) — moves to RecordSaleModal D-07
  - **lines 974-991:** local `SearchIcon` definition — delete in plan 22-02
  - **line 993:** `PICKER_VISIBLE_LIMIT = 8` — moves to useCustomerPicker.ts
  - **lines 1837-2092:** Record Sale Modal JSX block — replaced by `<RecordSaleModal isOpen={...} {...} />`
- `src/components/PrintQuoteModal.tsx` — duplicate picker. Key sites:
  - **line 31:** `PICKER_VISIBLE_LIMIT = 8` — delete (import from useCustomerPicker)
  - **lines 69-178:** picker state triplet + memos + handlePickerKeyDown — all migrate to useCustomerPicker consumption
  - **lines 307-373:** picker JSX (label + Input combobox + listbox + overflow-footer + empty-state) — stays byte-identical but reads from useCustomerPicker return
- `src/components/CustomerLibrary.tsx` — Key sites:
  - **line 153:** `useDynamicRowHeight({ defaultRowHeight: 88 })` — add `key: searchQuery` (PERF-04 D-22). Researcher confirms the local searchQuery variable name in this file.
  - **lines 235 + 387:** SearchIcon usage + local definition — local def deletes (HYG-03 D-16), import path updates.
- `src/components/ui/Modal.tsx` — Phase 19 primitive. Read for the `{ isOpen, onClose, title, children, size }` API contract. `<RecordSaleModal>` uses `size="md"` per Phase 19's size mapping (D-10 above).
- `src/hooks/useDatabase.ts` — Key sites:
  - **lines 569-650:** `useSales(jobId?)` — `useAllSales` (PERF-07 D-23a) inserts right after this
  - **lines 654+:** `useCustomers` — RecordSaleModal subscribes here for `customersByEmail` / `bumpLastUsed` / `addCustomer`
- `src/components/JobsManager.test.tsx` — Existing test file. Mocks `useSales` at line 47; needs `useAllSales` stub added (PERF-07 D-24). Mounting helper at line 340 (`renderJobCard`) survives untouched since `JobRowProps` shape is preserved (D-19).
- `src/types.ts` — `Customer`, `PrintJob`, `Sale`, `Quote`, `MarketplaceType`, `ShippingMethodType`, `BreakEvenInfo` definitions.

### Codebase + workflow refs
- `.planning/codebase/STRUCTURE.md` — `src/hooks/` is the home for `useCustomerPicker.ts` and `useAllSales` (D-01, D-23). `src/components/ui/` for primitives; new `ui/icons/` subfolder per D-15.
- `.planning/codebase/STACK.md` — React 19 (useMemo/useCallback/useId built-in), Vite 7, Tailwind 4, react-window v2, jsdom 29 for tests
- `.planning/codebase/CONVENTIONS.md` — `src/components/ui/` primitives use `forwardRef` (see Input.tsx); icons use plain function components (no ref needed). `src/hooks/` uses named exports.
- `~/.claude/CLAUDE.md` (global) — `tsc -b` for TypeScript verification (not `tsc --noEmit`); atomic commits; "use agents aggressively"; "every new user-facing feature gets a NEW badge" — explicitly NOT applicable to Phase 22 since zero new user-facing features. No `features.ts` entry.
- `.claude/CLAUDE.md` (project) — port 4173, Tauri 2 detection via `__IS_TAURI__`, Vercel deploys on `tsc -b && vite build`
- `~/.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/MEMORY.md` — NEW badge rule (NOT applicable; hardening-only); user feedback patterns (refinement vs contradiction; reconcile legacy data — NOT applicable here since no schema/derived-field change)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 19 `<Modal>` primitive** — `src/components/ui/Modal.tsx`. `<RecordSaleModal>` wraps it directly with `size="md"`. The Modal already owns auto-close-on-Escape, focus trap, body scroll-lock, and the auto-rendered X close button — RecordSaleModal contributes only the body content + handleRecordSale.
- **Phase 15.1 picker JSX (combobox + listbox + overflow-footer + empty-state)** — already locked-in WAI-ARIA accessible markup at `JobsManager.tsx:1885-1949` and `PrintQuoteModal.tsx:307-373`. Phase 22 preserves it byte-identically — only the state-management plumbing changes.
- **Phase 20 `useSales` transactions** — `useDatabase.ts:577-630` wrapped addSale/updateSale/deleteSale in `db.transaction('rw', db.sales, db.jobs, ...)`. RecordSaleModal calls these hooks directly post-extraction; atomicity is preserved automatically.
- **Phase 16 plan 16-12 atomic Convert-from-Quote transaction** — `JobsManager.tsx:1505-1516`. Pattern: `db.transaction('rw', db.sales, db.quotes, db.jobs, async () => { sales.add + quotes.put + jobs.put(copiesSold bump) })`. Moves verbatim into RecordSaleModal's handleRecordSale.
- **react-window v2 `useDynamicRowHeight` `key` arg** — Already in use at `JobsManager.tsx:1666-1669` (Phase 15 plan 04 D-05). PERF-04 ports the same pattern (single-key on searchQuery) to CustomerLibrary.
- **Existing `<QuoteRow>` sibling pattern** — `JobsManager.tsx:149-230`. Same level of abstraction `<SaleRow>` targets: per-row React component with a memoized prop signature, parent-supplied callbacks.

### Established Patterns
- **No `--no-verify` ever** — Phase 18/19/20/21 precedent
- **`tsc -b` over `tsc --noEmit`** — global CLAUDE.md rule; Vercel uses `tsc -b && vite build`. Required for the new hook + component to compile cleanly under project references
- **Atomic commit per task** — every plan in v1.3 has done this
- **Hardening-only milestone** — no `features.ts` entries, no `<NewBadge>` JSX, no copy or visual changes. Phase 22 is pure structural refactor + perf; users see no observable change
- **Tests use raw `createRoot` + `act`** — see `src/components/JobsManager.test.tsx`, `PrintQuoteModal.test.tsx`. No `@testing-library/react`. RecordSaleModal.test.tsx + useCustomerPicker.test.ts follow the same convention
- **Sibling-not-generic pattern** — Phase 15.1 D-08 + Phase 19 D-21. Applied here: `<RecordSaleModal>` and `<SaleRow>` are specific siblings to existing modals/rows, NOT polymorphic primitives
- **No-Analog rule** — Phase 15 plan 04 / Phase 11. Don't extract until 2+ consumers exist. Applied to:
  - `computeBreakEvenInfo` — stays at module scope in JobsManager.tsx (only JobsManager consumes it)
  - `calculateMarketplaceFee` — stays at module scope in RecordSaleModal.tsx (only RecordSaleModal consumes it)

### Integration Points
- **Plan-internal file isolation** — 22-01 touches only new files (useCustomerPicker.ts + test). 22-02 touches new icon file + barrel + 2 deletions (JobsManager local SearchIcon + CustomerLibrary local SearchIcon). 22-03 creates RecordSaleModal.tsx + test + edits JobsManager.tsx (large removal) + edits PrintQuoteModal.tsx (picker migration). 22-04 creates SaleRow.tsx + edits JobsManager.tsx (JobCard map collapse). 22-05 edits JobsManager.tsx (breakEvenMap) + RecordSaleModal.tsx (marketplaceFee hoist + memo) + CustomerLibrary.tsx (one-line key). 22-06 edits useDatabase.ts (new hook) + JobsManager.tsx (drop dup subscription) + JobsManager.test.tsx (mock update).
- **Phase 22 hard-dependency on Phase 19** — RecordSaleModal consumes `<Modal>`. Phase 19 shipped 2026-05-26; unblocked.
- **Phase 23 dependency** — Phase 23 (Test coverage hardening) "depends on Phase 22 (if components are refactored as part of decomp; otherwise independent)". Phase 22's `RecordSaleModal.test.tsx` (criterion #11) is a leading indicator for Phase 23's `CustomerEditModal.test.tsx` pattern.
- **PrintQuoteModal migration in 22-03** — non-trivial. The state triplet + 60-LOC keyDown handler + memos delete from PrintQuoteModal.tsx (lines 31-178). The picker JSX (lines 307-373) stays byte-identical but reads `query`/`open`/`activeIndex`/`visibleCustomers`/etc. from the hook return instead of local state. Existing `PrintQuoteModal.test.tsx` mount may need re-targeting depending on whether its picker assertions touch state names directly.
- **JobsManager.test.tsx mock update in 22-06** — `useSales` mock at line 47 already exists. Add `useAllSales` (or whichever shape D-23 picks) stub. The test file's `renderJobCard` helper at line 340 survives untouched (JobRowProps unchanged).

</code_context>

<specifics>
## Specific Ideas

- **useCustomerPicker keyDown reference** — copy the handler from `JobsManager.tsx:1317-1370` (it's the more recent / better-commented version with the CR-04 stopPropagation fix). Cross-check against `PrintQuoteModal.tsx:139-178` to confirm both branches share identical behavior. Any divergence found is a bug — surface to user before "porting verbatim."
- **Convert-from-Quote atomic tx port** — the `db.transaction('rw', db.sales, db.quotes, db.jobs, async () => { ... })` block at `JobsManager.tsx:1505-1516` must move INSIDE RecordSaleModal's handleRecordSale. The "MUST live here (not via useSales().addSale)" comment at lines 1486-1494 explains why the inline copiesSold bump exists; preserve the comment when moving.
- **SaleFromQuoteSubtext relocation** — current export at `JobsManager.tsx:314-330` is consumed only by `JobCard`'s sale summary line. After SaleRow extraction it's only consumed by SaleRow. Move it to a local (non-exported) component inside SaleRow.tsx; if a test or future consumer needs it, re-export. Removes the orphan export from JobsManager.tsx.
- **PICKER_VISIBLE_LIMIT location** — per D-05, lives in `useCustomerPicker.ts`. Export it as a named constant so tests + the overflow-footer JSX can read it. Consumer code doesn't import it (the hook returns pre-sliced `visibleCustomers`).
- **`useAllSales` shape recommendation** — `export function useAllSales(): Sale[] { const sales = useLiveQuery(() => db.sales.orderBy('soldAt').reverse().toArray(), []); return sales ?? []; }` mirrors `useCustomers` exactly. Single export, single subscription, signature matches what JobsManager.tsx:1071 destructures today (`const { sales: allSales } = useSales();`).
- **Picker hook test bar** — `useCustomerPicker.test.ts` must cover the keyDown branches at minimum: ArrowDown opens-then-cycles, ArrowUp wraps last→first, Enter-with-match calls onPick, Enter-with-no-match closes the dropdown WITHOUT calling onPick, Escape closes the dropdown AND stops propagation (the CR-04 fix), Tab closes the dropdown without picking. Plus filteredCustomers/visibleCustomers derive correctly from query + customers prop.

</specifics>

<deferred>
## Deferred Ideas

- **`<JobCard>` further decomposition** (header / actions / orders subcomponents) — out of scope this phase; would balloon the surface. Backlog item if JobCard re-grows to >300 LOC in a future phase.
- **`<QuoteRow>` relocation to its own file** — already a standalone exported function in `JobsManager.tsx:149`. Moving to its own file is a hygiene improvement but not in any audit finding. Backlog.
- **`<OrdersSection>` extraction** — Wrapper at `JobsManager.tsx:333`. Could be its own file; not in any audit finding. Backlog.
- **Customer picker capabilities** — inline "Create new customer" CTA from the empty-state dropdown row. New feature; v1.4+.
- **`<ConfirmDialog>` primitive** — for the 2 inline Delete confirms still in JobsManager. Phase 19 D-19 deferred this; Phase 22 doesn't pick it up either. Backlog for the next phase that adds confirm flows.
- **Other icon extractions** (ChevronRight at `JobsManager.tsx:934`, Tag at `JobsManager.tsx:953`, X across multiple modals) — `src/components/ui/icons/` barrel is established by HYG-03, but only `SearchIcon` migrates this phase. Extract the others on-demand when next-touched.
- **`src/utils/breakEven.ts` extraction** — `computeBreakEvenInfo` stays at module scope per the No-Analog rule. Promote if a 2nd consumer surfaces (e.g., a Dashboard tab in v1.5).
- **`src/utils/marketplaceFee.ts` extraction** — same; stays in RecordSaleModal until 2nd consumer.
- **Replace `<details>` with custom accordion primitive in `<SaleRow>`** — native `<details>` is correct + accessible. Backlog only if a future a11y review flags it.
- **App.tsx-level lift of all sales subscription + prop-drilling** — PERF-07 alternative shape. Rejected for the smaller `useAllSales` shape because it doesn't ripple through App.tsx tab plumbing.
- **PrintQuoteModal's picker JSX dedup beyond hook consumption** — the listbox + overflow-footer + empty-state JSX is ~50 LOC duplicated between JobsManager (now RecordSaleModal) and PrintQuoteModal. Phase 22 leaves the JSX duplicated; the hook only deduplicates the state + handler logic. Backlog for a future `<CustomerPickerDropdown>` headless-component extraction if a 3rd consumer surfaces.

</deferred>

---

*Phase: 22-jobsmanager-decomposition-perf*
*Context gathered: 2026-05-27*
