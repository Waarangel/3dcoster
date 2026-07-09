---
phase: 41-quick-win-features
plan: 04
subsystem: quotes-pdf
tags: [react, jspdf, dexie, typescript, quote-variants]

# Dependency graph
requires:
  - phase: 41-quick-win-features (41-01)
    provides: Quote.variantsSnapshot by-value optional field in types.ts (quantities/discountsPercent/unitPrices/currency)
provides:
  - "generateQuotePdf.renderLineItems variant branch — one autoTable row per tier when quote.variantsSnapshot is present, unchanged single-row layout otherwise"
  - "generateQuotePdf.renderTotals 'Variant options total' informational line (Σ qty×unitPrice) so the tier table always has a matching total"
  - "PrintQuoteModal Quantity-variants section — toggle + 3 editable qty/discount% tier rows, deriving unitPrice[i] = sellingPrice × (1 − discount%), persisted to variantsSnapshot at Generate time"
  - "CreateQuoteInput.variantsSnapshot (useDatabase.ts) — additive field threading the snapshot onto the createQuote-built Quote payload"
  - "RecordSaleModal tier picker — renders when convertingFromQuote.variantsSnapshot is present, seeds Quantity/Price from the chosen tier"
affects: [41-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PDF renderer branch-on-snapshot-presence: renderLineItems/renderTotals check quote.variantsSnapshot and read ONLY from it + lineItemsSnapshot (D-17 G4 by-value rule) — no new function signature, no PrintJob/UserProfile reads."
    - "Discount-default persistence via useLocalStorage (not a new Dexie store) for a modal-scoped 'remember my last input' preference — mirrors existing localStorage precedents (maintenanceDismissed.ts, NewBadge.tsx)."
    - "Convert-to-Sale variant seeding: a picker sets the SAME controlled inputs (quantity/price) the non-variant flow already uses, so handleRecordSale's totalRevenue math needed zero changes."

key-files:
  created: []
  modified:
    - src/pdf/generateQuotePdf.ts
    - src/pdf/generateQuotePdf.test.ts
    - src/components/PrintQuoteModal.tsx
    - src/components/PrintQuoteModal.test.tsx
    - src/hooks/useDatabase.ts
    - src/components/RecordSaleModal.tsx
    - src/components/RecordSaleModal.test.tsx

key-decisions:
  - "renderTotals gains an informational 'Variant options total' line (Σ qty×unitPrice) rather than replacing Subtotal — keeps the D-22 tax-base lock and existing Subtotal/Tax/Total math untouched while making the tier table above read as complete, per the plan's explicit escape hatch."
  - "Quantity-variants discount defaults persist via localStorage (useLocalStorage hook), not a new UserProfile/Dexie field — quantities and the toggle itself reset per quote; only discount % carries over (D-06 'remembered as defaults')."
  - "Edit mode (D-27) hydrates the variants section from the Quote's own saved variantsSnapshot, not from the persisted localStorage defaults, so re-opening an existing variant quote shows its actual saved numbers."
  - "Convert-to-Sale tier picker lives in RecordSaleModal.tsx, not JobsManager.tsx — see Deviations."

patterns-established:
  - "A tier picker that seeds pre-existing controlled inputs (rather than introducing parallel quantity/price state) keeps a single source of truth for what gets persisted downstream — zero changes to handleRecordSale's totalRevenue computation were needed."

requirements-completed: [CONN-03]

coverage:
  - id: D1
    description: "generateQuotePdf renders one autoTable row per tier (Qty/Unit Price/Amount) when quote.variantsSnapshot is present, and the original single-row layout when absent"
    requirement: "CONN-03"
    verification:
      - kind: unit
        ref: "src/pdf/generateQuotePdf.test.ts#CONN-03 D-08 variants tier table"
        status: pass
    human_judgment: false
  - id: D2
    description: "PrintQuoteModal Quantity-variants section: 3 editable qty/discount% tier fields (default 1/10/50, 0%), unitPrice[i] derives correctly (20 @ 10% → 18), variantsSnapshot present in createQuote payload only when enabled"
    requirement: "CONN-03"
    verification:
      - kind: unit
        ref: "src/components/PrintQuoteModal.test.tsx#PrintQuoteModal — CONN-03 Quantity variants (D-05..D-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "RecordSaleModal tier picker renders only for variant quotes; selecting a tier seeds Quantity/Price and the committed Sale carries that tier's quantity/unitPrice/totalRevenue; non-variant quotes convert unchanged"
    requirement: "CONN-03"
    verification:
      - kind: unit
        ref: "src/components/RecordSaleModal.test.tsx#RecordSaleModal — CONN-03 tier picker (D-08)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Lazy-load discipline preserved: no static jspdf import outside generateQuotePdf.ts"
    verification:
      - kind: other
        ref: "node scripts/assert-no-static-pdf-import.mjs (run after npm run build)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Manual UAT: enable variants on a quote, generate PDF → one branded doc with three tier rows and a matching Variant options total; convert → tier picker records the chosen quantity/price"
    human_judgment: true
    rationale: "Visual PDF layout and end-to-end UI flow require human eyes on the rendered document and the Convert-to-Sale modal, not just unit assertions on extracted text/DOM."

# Metrics
duration: ~35min
completed: 2026-07-09
status: complete
---

# Phase 41 Plan 04: Quote Variants PDF (CONN-03) Summary

**Tiered 1pc/10pc/50pc (editable) quote pricing riding the existing jsPDF quote engine — one branded PDF tier table, maker-controlled per-tier discount %, and a Convert-to-Sale tier picker, with zero cost-model changes.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-09T13:23:00Z (approx)
- **Completed:** 2026-07-09T13:31:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- `generateQuotePdf.renderLineItems` branches on `quote.variantsSnapshot`: N tier rows (Qty/Unit Price/Amount) when present, byte-identical single-row layout when absent — reads only `variantsSnapshot` + `lineItemsSnapshot` per the D-17 G4 by-value rule, no signature change.
- `generateQuotePdf.renderTotals` gains an informational "Variant options total" line (Σ qty×unitPrice) so a multi-row tier table always has a matching total on the page, without touching the existing Subtotal/Shipping/Tax/Total math (D-22 lock untouched).
- `PrintQuoteModal` gained a "Quantity variants" toggle with three editable quantity fields (default 1/10/50) and per-tier discount % fields; `unitPrice[i] = sellingPrice × (1 − clamp(discount%, 0, 100)/100)` — maker-controlled, never touches `calculateCost`/`priceFromMargin` (D-06). Discount defaults persist via `localStorage` (no new Dexie store) so the next quote pre-fills the maker's last-used discounts; quantities and the toggle reset per quote. `variantsSnapshot` is computed once at Generate time and flows to both the create path (`CreateQuoteInput.variantsSnapshot`, additive field on `useDatabase.ts`'s `createQuote`) and the edit path (direct Quote patch).
- `RecordSaleModal` renders a tier picker ("{qty} @ {unitPrice}" buttons) whenever the source Quote carries a `variantsSnapshot`; selecting a tier seeds the modal's existing Quantity/Price inputs, which remain the sole source of truth for the recorded Sale — `totalRevenue = quantity × unitPrice` in `handleRecordSale` needed no changes. A non-variant Quote converts exactly as before (no picker).

## Task Commits

Each task was committed atomically:

1. **Task 1: Variants tier table in generateQuotePdf.renderLineItems (branch on variantsSnapshot) + tests** - `f5a8ac0` (test)
2. **Task 2: Quantity-variants section in PrintQuoteModal — editable qty + per-tier discount %, unit-price derivation, variantsSnapshot persistence** - `59eba21` (feat)
3. **Task 3: Convert-to-Sale tier picker for variant quotes in RecordSaleModal (plan named JobsManager — see Deviations)** - `6141b38` (feat)

**Plan metadata:** (pending — final docs commit follows this SUMMARY)

_Note: Task 1 is committed as `test` because its net diff is dominated by test additions alongside the small renderer branch; the renderer change itself has no independent commit since it was authored test-first for this task._

## Files Created/Modified
- `src/pdf/generateQuotePdf.ts` - `renderLineItems` variant branch (N tier rows) + `renderTotals` "Variant options total" line
- `src/pdf/generateQuotePdf.test.ts` - N-row assertion for a 3-tier snapshot, unchanged 1-row assertion without variants, Variant options total sum assertion
- `src/components/PrintQuoteModal.tsx` - Quantity-variants toggle + 3 tier rows, `variantUnitPrices` derivation, `variantsSnapshot` construction at Generate time, edit-mode hydration from the Quote's own snapshot
- `src/components/PrintQuoteModal.test.tsx` - unit-price derivation test, variantsSnapshot-present/absent tests, discount clamp test
- `src/hooks/useDatabase.ts` - `CreateQuoteInput.variantsSnapshot` (additive), threaded onto the `createQuote`-built Quote payload
- `src/components/RecordSaleModal.tsx` - tier picker UI, `selectedTierIndex` state, hydration-effect tier-0 seeding for variant quotes
- `src/components/RecordSaleModal.test.tsx` - no-picker-without-variants test, picker-renders-and-seeds-tier-0 test, tier-selection-flows-to-committed-Sale test

## Decisions Made
- `renderTotals` gains the "Variant options total" informational line instead of overriding Subtotal, per the plan's explicit escape hatch ("if a tier table without a matching total reads as broken"). Subtotal/Tax/Total continue to reflect the base single-tier snapshot untouched — the D-22 tax-base lock is preserved exactly.
- Discount-default persistence uses `useLocalStorage` (existing hook, existing precedent in the codebase) rather than a new `UserProfile` field, satisfying the plan's "do NOT add a new Dexie store" constraint while still remembering the maker's last-used discounts across quotes.
- Edit mode (D-27) re-hydrates the variants section from `editingQuote.variantsSnapshot` (not from the persisted localStorage defaults) so reopening a saved variant quote shows its actual recorded numbers, not the maker's most-recent unrelated defaults.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `useDatabase.ts`'s `createQuote` had no `variantsSnapshot` field to thread through**
- **Found during:** Task 2 (Quantity-variants section in PrintQuoteModal)
- **Issue:** `createQuote` (the transactional hook action PrintQuoteModal is architecturally required to use — never opens `db` directly) builds the `Quote` payload internally from `CreateQuoteInput`. That input type had no `variantsSnapshot` field, so the create path could not persist the snapshot onto new Quotes at all.
- **Fix:** Added an optional `variantsSnapshot?: Quote['variantsSnapshot']` field to `CreateQuoteInput` and threaded it straight onto the `quotePayload` object inside the existing transaction — no other behavior change, no new transaction scope, no schema/version change (the field itself is already optional on `Quote` from 41-01).
- **Files modified:** `src/hooks/useDatabase.ts`
- **Verification:** `npx tsc -b` clean; `PrintQuoteModal.test.tsx` asserts `createQuoteSpy` receives `variantsSnapshot` when enabled and `undefined` when disabled; full `backupExport.test.ts` suite still green (no schema regression).
- **Committed in:** `59eba21` (Task 2 commit)

**2. [Rule 3 - Blocking, file-location correction] Convert-to-Sale tier picker implemented in `RecordSaleModal.tsx`, not `JobsManager.tsx`**
- **Found during:** Task 3 (Convert-to-Sale tier picker)
- **Issue:** The plan's `files_modified` frontmatter and Task 3's `<action>` named `JobsManager.tsx` as the file to modify. Reading the actual architecture (confirmed by `RecordSaleModal.tsx`'s own header comment: "modal owns the entire sale-form lifecycle including the Convert-from-Quote atomic db.transaction... internally"), `JobsManager.tsx` only controls `RecordSaleModal`'s open/close state and passes `convertingFromQuote` as a prop — it does not own `saleQuantity`/`salePrice` state or the Sale-commit transaction. Implementing the picker in `JobsManager.tsx` would have required either duplicating that form state (violating the existing HYG-06/plan-22-03 extraction) or threading picker selection back through additional props with no clean seam.
- **Fix:** Implemented the tier picker entirely inside `RecordSaleModal.tsx`: a `selectedTierIndex` state, a picker UI rendered only when `convertingFromQuote.variantsSnapshot` is present, and a `handleSelectTier` callback that seeds the modal's pre-existing `saleQuantity`/`salePrice` controlled inputs. No `JobsManager.tsx` changes were needed — `convertingFromQuote` already carries the full `Quote` object (including `variantsSnapshot`) via the existing prop, since `Quote.variantsSnapshot` was added to the type in 41-01.
- **Files modified:** `src/components/RecordSaleModal.tsx` (instead of `src/components/JobsManager.tsx`)
- **Verification:** `npx vitest run src/components/RecordSaleModal.test.tsx` (13/13 pass, including 3 new tier-picker tests); `npx tsc -b` clean; full `npm run test` suite green (1106 passed | 1 todo).
- **Committed in:** `6141b38` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking — both required to complete Task 2/Task 3 given the existing architecture)
**Impact on plan:** Both auto-fixes were structural corrections required by the existing codebase architecture (the transactional hook boundary in Task 2, the RecordSaleModal ownership boundary in Task 3), not scope creep. All plan acceptance criteria are met; no cost-model math was touched in either case.

## Issues Encountered
None beyond the two deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CONN-03 (Quote Variants PDF) is fully wired end-to-end: PrintQuoteModal → Quote.variantsSnapshot (by-value) → generateQuotePdf tier table → Convert-to-Sale tier picker.
- `npx tsc -b` exits 0; `npx vitest run src/pdf/generateQuotePdf.test.ts src/components/PrintQuoteModal.test.tsx src/components/RecordSaleModal.test.tsx` all green; full `npm run test` (1106 tests) green; `node scripts/assert-no-static-pdf-import.mjs` passes after a fresh `npm run build`.
- No blockers for 41-05 (final wave-2/3 plan in this phase).
- Manual/UAT still pending (deferred to `/gsd-verify-work` per the plan's `<verification>` block): visually confirm the 3-tier PDF layout and the Convert-to-Sale picker in a running app.

---
*Phase: 41-quick-win-features*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: src/pdf/generateQuotePdf.ts
- FOUND: src/pdf/generateQuotePdf.test.ts
- FOUND: src/components/PrintQuoteModal.tsx
- FOUND: src/components/PrintQuoteModal.test.tsx
- FOUND: src/hooks/useDatabase.ts
- FOUND: src/components/RecordSaleModal.tsx
- FOUND: src/components/RecordSaleModal.test.tsx
- FOUND: f5a8ac0
- FOUND: 59eba21
- FOUND: 6141b38
