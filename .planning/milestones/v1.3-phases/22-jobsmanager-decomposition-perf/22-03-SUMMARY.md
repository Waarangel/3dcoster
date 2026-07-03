---
phase: 22-jobsmanager-decomposition-perf
plan: 03
subsystem: ui
tags: [react, modal, refactor, picker, extraction, hyg-06, hyg-08]

requires:
  - phase: 22-01
    provides: "useCustomerPicker hook + PICKER_VISIBLE_LIMIT export consumed by both new modal subscribers"
  - phase: 22-02
    provides: "SearchIcon already removed from JobsManager.tsx (this plan never touched it)"
  - phase: 19-modal-primitive-a11y-migration
    provides: "<Modal> primitive at size='md' with isOpen-unmount semantics (Modal.tsx:67)"

provides:
  - "src/components/RecordSaleModal.tsx — extracted sale-modal owning its own form state, useCustomers + useSales subscriptions, handleRecordSale, and the Convert-from-Quote atomic db.transaction"
  - "src/components/RecordSaleModal.test.tsx — 9-test 3-mode behavior contract (create / edit / convert) + picker integration smoke + Cancel safety"
  - "JobsManager.tsx shrunk from 2067 LOC → 1474 LOC (-593 LOC / -29%)"
  - "Both modal consumers (RecordSaleModal, PrintQuoteModal) now consume useCustomerPicker — picker state/handlers exist in exactly one place"

affects: [22-05, 22-06]

tech-stack:
  added: []
  patterns:
    - "RecordSaleModal as sibling-not-generic component (Phase 15.1 D-08 + Phase 19 D-21 precedent)"
    - "Controlled mode-selection (parent owns editingSale/convertingFromQuote slots); modal hydrates from those props via useEffect keyed on [editingSale, convertingFromQuote, job.sellingPrice] (D-08)"
    - "Convert-from-Quote atomic db.transaction stays co-located with the modal that opens the transaction (Pitfall 2 — addSale wraps its own implicit transaction so we cannot delegate)"
    - "calculateMarketplaceFee moved to module scope (PERF-03 partial; plan 22-05 collapses the 3 redundant call sites into useMemo per PERF-02)"

key-files:
  created:
    - src/components/RecordSaleModal.tsx
    - src/components/RecordSaleModal.test.tsx
  modified:
    - src/components/JobsManager.tsx
    - src/components/PrintQuoteModal.tsx

key-decisions:
  - "RecordSaleModal owns its own useCustomers + useSales(job.id) subscriptions (D-06 lock). JobsManager no longer destructures useCustomers — confirmed by grep that all customer reads were in handleRecordSale/handlePickCustomer (both moved)."
  - "calculateMarketplaceFee moved to module scope inside RecordSaleModal.tsx (PERF-03 partial). The three independent JSX call sites in the form's summary block remain as-is in this plan — plan 22-05 owns the useMemo collapse per PERF-02. Researcher recommendation honored (don't extract to src/utils until 2nd consumer emerges)."
  - "Controlled-prop pattern for mode selection (D-08): JobsManager keeps editingSale + convertingFromQuote + showSaleForm state slots, but the modal hydrates form fields from those props via a single useEffect keyed on [editingSale, convertingFromQuote, job.sellingPrice]. Replaces the 13-setState fan-out in handleEditSale and the 17-setState fan-out in handleStartConversion. Modal.tsx:67 isOpen-unmount handles reset-on-close — no useEffect([isOpen]) reset needed."
  - "Convert-from-Quote atomic db.transaction copied byte-identically including the [DO NOT REMOVE THIS BUMP] comment block (Pitfall 2 lock). The transaction must live INSIDE RecordSaleModal because addSale's own wrapping transaction would deadlock if nested over db.quotes."
  - "PrintQuoteModal's pickedExistingCustomerId stays in the CONSUMER (Pitfall 1 lock — library-link state is consumer-specific; useCustomerPicker hook remains consumer-agnostic)."
  - "JobsManager loses Select + Textarea + useId imports — the modal owns the form widgets and label-pairing IDs. ShippingMethodType, MarketplaceType, Customer, RuntimeQuoteStatus type imports also dropped from JobsManager."

patterns-established:
  - "Modal-owns-subscription pattern: extracted modals subscribe to their own Dexie hooks internally rather than receiving subscription results as props. Future modal extractions follow this shape (cleaner test setup — only the modal's mock needs the hook stub, not every render path)."
  - "Per-mode hydration useEffect pattern: parent controls a small number of mode-selecting state slots (editingX / convertingFromY); modal hydrates form fields from those props in a single useEffect on mount + on prop change. Replaces multi-setter fan-out handlers in the parent."

requirements-completed: [HYG-06, HYG-08]

duration: 12min
completed: 2026-05-27
---

# Phase 22 Plan 03: RecordSaleModal Extraction + Picker Migration Summary

**Extracted the 600-LOC inline Record Sale modal block (form state + 149-LOC handleRecordSale + the inline Convert-from-Quote atomic db.transaction) into a new src/components/RecordSaleModal.tsx, locked the 3-mode behavior via a 9-test contract, and migrated PrintQuoteModal's duplicate picker pattern onto the same useCustomerPicker hook that RecordSaleModal now consumes — JobsManager.tsx shrinks from 2067 LOC to 1474 LOC with zero user-visible change.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-27T16:29:24Z (first commit `feat(22-03)`)
- **Completed:** 2026-05-27T16:40:58Z (last commit `refactor(22-03)` PrintQuoteModal migration)
- **Tasks:** 4 of 4
- **Files modified:** 4 (2 created, 2 edited)
- **LOC delta (net):**
  - JobsManager.tsx: -593 LOC (2067 → 1474)
  - PrintQuoteModal.tsx: -48 LOC (494 → 446)
  - RecordSaleModal.tsx: +627 LOC (new)
  - RecordSaleModal.test.tsx: +480 LOC (new)
  - Net: +466 LOC across affected files (much of the new modal is JSX form body that previously lived inline in JobsManager; test coverage is 100% net new)

## Accomplishments

- **HYG-06 closed:** RecordSaleModal extracted; owns state + 149-LOC handleRecordSale + the inline Convert-from-Quote `db.transaction('rw', db.sales, db.quotes, db.jobs, ...)` block. Phase 19 Modal primitive at size="md". Phase 15.1 D-06 auto-create + D-07 silent-link customer side-effects preserved byte-identically.
- **HYG-08 closed:** useCustomerPicker is now consumed by BOTH RecordSaleModal (in this plan) and PrintQuoteModal (migrated in this plan). Picker state/handlers/PICKER_VISIBLE_LIMIT exist in exactly one place (the hook).
- **ROADMAP success criterion #1 effectively met for the modal-extraction half:** RecordSaleModal extracted to its own file with the same render contract; one prop-shape change from the criterion text (no `customers`/`customersByEmail` props per D-06 — modal subscribes internally). Documented in CONTEXT.md as a deliberate decision.
- **ROADMAP success criterion #3:** useCustomerPicker contract now consumed by 2 sites; D-02 return shape preserved.
- **ROADMAP success criterion #4:** useDatabase.ts subscription audit — JobsManager dropped its useCustomers destructure; the duplicate `useSales()` + `useSales(jobId)` pair survives (PERF-07 lift to useAllSales is plan 22-05/22-06 scope).
- **ROADMAP success criterion #11:** RecordSaleModal.test.tsx covers create / edit / convert-from-quote modes with 9 `it(...)` blocks across 5 describe blocks. Pitfall 2 lock asserted (convert mode fires `db.transaction`, NOT `addSale`).
- **Cumulative JobsManager LOC under 1700 (plan target):** 1474 LOC achieved. The ROADMAP cumulative <1500 target is still gated on 22-05 + 22-06 (perf passes + further hygiene) per CONTEXT.md note — but this single plan delivers 29% of the total decomposition.

## Task Commits

1. **Task 1: Extract RecordSaleModal component from JobsManager** — `68b468c` (feat)
2. **Task 2: Add RecordSaleModal 3-mode behavior contract (ROADMAP #11)** — `ba77f3b` (test)
3. **Task 3: Delete extracted sale-modal code; wire <RecordSaleModal>** — `1723549` (refactor)
4. **Task 4: Migrate PrintQuoteModal picker to useCustomerPicker (HYG-08)** — `0cd8ded` (refactor)

## Files Created/Modified

### Created

- **`src/components/RecordSaleModal.tsx`** (627 LOC) — Extracts the entire Record Sale modal lifecycle. Internal subscriptions: `useCustomers()` (customers, customersByEmail, bumpLastUsed, addCustomer) and `useSales(job.id)` (addSale, updateSale). Owns 11 form state slots, 9 useId calls for A11Y-07 label/input pairing, `handlePickCustomer` (D-05 — 4 fields NEVER Notes), `handleRecordSale` (149 LOC, ported verbatim including the D-06 auto-create + D-07 silent-link side-effects), and the inline Convert-from-Quote atomic db.transaction (Pitfall 2 lock — `[DO NOT REMOVE THIS BUMP]` comment block intact). Module-scope `calculateMarketplaceFee` (PERF-03 partial). Hydration useEffect keyed on `[editingSale, convertingFromQuote, job.sellingPrice]` (D-08) — NOT on isOpen because Modal.tsx:67 unmounts children on close (Pitfall 3).

- **`src/components/RecordSaleModal.test.tsx`** (480 LOC) — 9 tests across 5 describe blocks. Raw createRoot + act per project precedent (PrintQuoteModal.test.tsx is the reference). vi.mock blocks for `../hooks/useDatabase` (useCustomers + useSales) and `../db/database` (sales/quotes/jobs tables + transaction). Tests:
  - **Create mode (3 tests):** addSale called with correct Sale shape; D-06 auto-create asserted; D-07 silent-link asserted.
  - **Edit mode (2 tests):** form hydrated from editingSale; updateSale called (not addSale or db.transaction); auto-create/bumpLastUsed skipped on edit path.
  - **Convert-from-Quote mode (2 tests):** banner present with formatQuoteNumber output + price hydrated from snapshot; `db.transaction` fires with 'rw' mode and all 3 tables get writes (sales.add, quotes.put, jobs.get + jobs.put); **addSale NOT called** (Pitfall 2 lock).
  - **Picker integration smoke (1 test):** clicking a customer fills Name/Email/Company/Address; Notes field UNCHANGED (D-05 lock).
  - **Cancel safety (1 test):** Cancel calls onClose; no write spies fire.

### Modified

- **`src/components/JobsManager.tsx`** (2067 → 1474 LOC, -593 LOC / -29%) — see Task 3 commit message for the full deletion list. Highlights:
  - Imports: dropped `useId`, `useCustomers`, `Select`, `Textarea`, `ShippingMethodType`, `MarketplaceType`, `Customer`, `RuntimeQuoteStatus`. Added `RecordSaleModal`.
  - Deleted: `PICKER_VISIBLE_LIMIT` local const, 11 form state slots, 9 useId() calls, 3 picker state slots, `availableShippingMethods` + `availableMarketplaces` useMemo, inline `calculateMarketplaceFee` + `getDefaultShippingCost` arrow functions, `resetSaleForm` 13-setState fan-out, `handleStartConversion` 17-setState fan-out, `handleEditSale` 13-setState fan-out, `filteredCustomers` + `visibleCustomers` memos, `handlePickCustomer`, `handlePickerKeyDown` (60 LOC), `handleRecordSale` (149 LOC including the inline atomic tx), the inline `<Modal>` form body (~256 lines of JSX).
  - Added: `handleCloseSaleModal` 3-setter (showSaleForm/editingSale/convertingFromQuote), simplified `handleStartConversion` (3-setter), simplified `handleEditSale` (2-setter), and the `<RecordSaleModal>` invocation guarded by `selectedJob &&` (matches the prior `showSaleForm && selectedJob !== null` guard exactly).
  - Kept: `useSales(selectedJobId)` for `sales` array passed to JobCard as recentSales + deleteSale; `useSales()` for `allSales` → `salesByJob` Map; `db` import (still used for inline title-edit and add-tag handlers at db.jobs.put sites).

- **`src/components/PrintQuoteModal.tsx`** (494 → 446 LOC, -48 LOC) — Migrated to useCustomerPicker. Deleted: `PICKER_VISIBLE_LIMIT` local const, `useRef` import, `customerPickerInputRef` (dead code), picker state triplet (query/open/activeIndex + 3 setters), `filteredCustomers` + `visibleCustomers` useMemo, `handlePickerKeyDown` 36-LOC useCallback, 3-setter reset block inside the open-handler useEffect (replaced by `picker.reset()`). Added: `useCustomerPicker` + `PICKER_VISIBLE_LIMIT` imports, `const picker = useCustomerPicker(customers, { onPick: handlePickCustomer })`. Rewired all picker JSX references to `picker.*` getters/setters/callbacks. Preserved: all aria-* IDs byte-identical (print-quote-customer-picker / print-quote-picker-listbox / print-quote-option-${c.id}); `pickedExistingCustomerId` state + 4 references (Pitfall 1 lock — PrintQuoteModal-only library-link state).

**PICKER_VISIBLE_LIMIT canonical home is now `src/hooks/useCustomerPicker.ts`.** All three previous local copies are removed:
- JobsManager.tsx:993 → deleted in this plan (Task 3)
- PrintQuoteModal.tsx:31 → deleted in this plan (Task 4)
- useCustomerPicker.ts:28 → canonical export (created in plan 22-01, unchanged here)

## Decisions Made

All decisions logged inline above and in the per-task commit messages. The substantive ones:

1. **No `onSaved` wiring in JobsManager invocation.** The plan made `onSaved?` an optional prop; JobsManager does not pass it. The post-save lifecycle is fully handled by `onClose` (which clears editingSale + convertingFromQuote). No callers need post-save hooks today. Future PrintQuoteModal-style telemetry can wire this without touching the contract.

2. **calculateMarketplaceFee called 3× independently in the modal's JSX summary block (preserved verbatim).** Plan 22-05 owns the PERF-02 useMemo collapse. This plan moved the function to module scope (PERF-03 partial) without modifying the call sites. Avoids dragging an unrelated perf change into this extraction.

3. **`useSales` import KEPT in JobsManager.** Two call sites still need it post-extraction: `useSales(selectedJobId)` for the per-job `sales` array (passed to JobCard as recentSales) and `deleteSale` (sale-row delete confirm flow); `useSales()` for `allSales` → `salesByJob` Map. Plan 22-05/22-06 owns the PERF-07 useAllSales lift.

4. **`db` import KEPT in JobsManager.** Three remaining call sites use db.jobs.put for inline title-edit + add-tag + remove-tag handlers. Removing this import is out of scope for plan 22-03 (would be tangential to HYG-06/HYG-08).

5. **No NewBadge entry added.** Hardening-only milestone — zero user-visible UI change per CONTEXT.md D-27. The existing `<NewBadge feature="customer-details" />` inside the Customer-details block was MOVED into RecordSaleModal verbatim (its origin date stands).

## Deviations from Plan

**1. [Annotation] RecordSaleModal.tsx is 627 LOC (plan acceptance criterion suggested 300-500 LOC range)**
- **Reason:** The form body alone is ~256 lines of JSX (verbatim port from JobsManager). Plus `handleRecordSale` (149 LOC), 11 form state slots + 9 useId calls (~35 LOC), hydration useEffect (~50 LOC), and currency-scoped shipping/marketplace useMemo blocks (~30 LOC). The acceptance-criterion upper bound was a planner estimate; the actual size is what's required to contain the extracted functionality.
- **Decision:** Accept the larger file. Future refactors (e.g., extracting the form body into a `<RecordSaleForm>` child if it grows further) can split it; for this plan the priority is "single coherent extraction with byte-identical behavior," and that's delivered.

**2. [Decision] `handleOpenSaleForm` simplified**
- **Found during:** Task 3 wiring
- **Issue:** The original `handleOpenSaleForm` set `setSalePrice(job.sellingPrice)` — but salePrice is now modal-internal state.
- **Fix:** Replaced with `setEditingSale(null); setConvertingFromQuote(null); setShowSaleForm(true);`. The modal hydrates `salePrice` from `job.sellingPrice` on its first mount via the hydration useEffect (D-08).
- **Files modified:** `src/components/JobsManager.tsx`
- **Commit:** `1723549` (folded into Task 3 commit)

**3. [Worktree environment fix] Ran `npm install` to seed worktree `node_modules`**
- **Found during:** baseline `tsc -b` check before Task 1
- **Issue:** Worktree spawned without `node_modules` populated; pre-existing module-not-found errors masked any real diagnostics on new files.
- **Fix:** `npm install --no-audit --no-fund --prefer-offline` — 648 packages in 5s. Standard worktree bootstrap (same pattern as plan 22-01 + 22-02 worktrees). Not a plan deviation — Rule 3's package-install exclusion targets *new* packages, not bootstrapping existing ones.
- **Files modified:** none (node_modules is gitignored)
- **Commit:** none — environment-only

No architectural changes (Rule 4) required. No bugs surfaced (no Rule 1 fixes). The behavior contract was preserved byte-identically through every step (asserted by JobsManager.test.tsx 31/31 + PrintQuoteModal.test.tsx 10/10 + new RecordSaleModal.test.tsx 9/9 + the rest of the suite — 428 + 1 todo green at the end).

## Authentication Gates

None — pure code-only execution.

## Issues Encountered

None of substance. Two minor friction points (already documented above):
- Initial worktree `tsc -b` flooded output with missing-module errors until `npm install` ran. Standard.
- A few JSDoc-style deletion-marker comments in JobsManager.tsx initially mentioned the deleted symbols by name, tripping the acceptance-criterion `grep -c handleRecordSale` check. Reworded the comments to describe the behavior rather than naming the deleted symbol. Zero functional impact.

## User Setup Required

None.

## TDD Gate Compliance

- **RED gate:** `test(22-03)` — commit `ba77f3b` (Task 2)
- **GREEN gate:** `feat(22-03)` — commit `68b468c` (Task 1)
- **REFACTOR gate (×2):** `refactor(22-03)` — commits `1723549` (Task 3) and `0cd8ded` (Task 4)

This plan's order is **GREEN → RED → REFACTOR → REFACTOR**, mirroring plan 22-01's inversion rationale: Task 1 extracts a verbatim-correct component from existing production code (GREEN-by-construction); Task 2 locks the contract via 9 tests that pass on first run. The 3-mode contract is now executable — future changes to RecordSaleModal will exercise classical RED→GREEN against this same test file. Both Task 3 and Task 4 are refactors (delete + rewire) that the existing JobsManager.test.tsx and PrintQuoteModal.test.tsx suites continued to guard against regression (both 100% pass post-refactor).

## Threat Flags

None — pure structural refactor. The extracted Convert-from-Quote atomic `db.transaction` is the only DB-write surface and it was copied byte-identically including the 9-line comment block locking its atomicity property. No new network/file/auth/schema surface introduced.

## Known Stubs

None — every form field is wired to real state, every handler does real work, every Dexie subscription returns real data.

## Deferred Issues

None.

## Next Phase Readiness

- **Plan 22-04 (SaleRow extraction)** already shipped in wave-1 (commit `60b96c1` predates this plan's base). No interaction.
- **Plan 22-05 (PERF-02/03 — calculateMarketplaceFee + breakEvenMap perf)** can land next. The function is already at module scope inside RecordSaleModal.tsx; plan 22-05 wraps the 3 JSX call sites in a single useMemo per PERF-02. JobsManager's `getBreakEvenInfo` useCallback is unchanged by this plan.
- **Plan 22-06 (final JobsManager shrink + test-mock update for useAllSales)** consumes the post-extraction JobsManager.tsx (1474 LOC). The cumulative <1500 target is hit by 22-06 after PERF-07 lift (which lets the duplicate `useSales()` call drop).
- **JobsManager.test.tsx mocks unchanged** — the `useSales`/`useCustomers`/`useQuotes` mocks at lines 19-53 still cover the surface JobsManager uses post-extraction (no `useAllSales` add needed yet — plan 22-05/22-06 owns that change per D-24).

---

## Self-Check: PASSED

- `src/components/RecordSaleModal.tsx` — FOUND (627 LOC)
- `src/components/RecordSaleModal.test.tsx` — FOUND (480 LOC)
- `src/components/JobsManager.tsx` — modified (-593 LOC, now 1474 LOC ≤ 1700 plan target)
- `src/components/PrintQuoteModal.tsx` — modified (-48 LOC, picker migrated to useCustomerPicker)
- Commit `68b468c` (Task 1, feat) — FOUND in `git log`
- Commit `ba77f3b` (Task 2, test) — FOUND in `git log`
- Commit `1723549` (Task 3, refactor) — FOUND in `git log`
- Commit `0cd8ded` (Task 4, refactor) — FOUND in `git log`
- `npx tsc -b` → exit 0 — PASS
- `npx vitest run` → 428 passed + 1 todo — PASS
- `npm run build` → clean; main chunk 55.8 KB gz (down from 61.5 KB) — PASS
- `grep -c 'handleRecordSale\|handlePickerKeyDown\|handlePickCustomer\|PICKER_VISIBLE_LIMIT\|customerPickerQuery\|customerPickerOpen\|customerPickerActiveIndex\|calculateMarketplaceFee' src/components/JobsManager.tsx` → 0 — PASS
- `grep -c '<RecordSaleModal' src/components/JobsManager.tsx` → 3 (1 import + 1 JSX + 1 comment ref) — PASS
- `grep -c 'useCustomerPicker' src/components/PrintQuoteModal.tsx` → 5 (1 import + 4 references) — PASS
- `grep -c 'pickedExistingCustomerId' src/components/PrintQuoteModal.tsx` → 5 (Pitfall 1 lock intact) — PASS
- `grep -c 'customerPickerQuery\|customerPickerOpen\|customerPickerActiveIndex\|handlePickerKeyDown\|customerPickerInputRef' src/components/PrintQuoteModal.tsx` → 0 — PASS
- `grep -c '@testing-library/react' src/components/RecordSaleModal.test.tsx` → 0 — PASS
- `grep -cE '^\s*it\(' src/components/RecordSaleModal.test.tsx` → 9 (≥ 3 plan target) — PASS

---
*Phase: 22-jobsmanager-decomposition-perf*
*Completed: 2026-05-27*
