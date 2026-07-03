---
phase: 16-printable-pdf-quote
plan: "12"
status: complete
gap_closure: true
gap_ids: [G]
decisions: [D-17, D-20]
executed: 2026-05-23T14:28:00Z
executed_by: orchestrator-inline
key-files:
  modified:
    - src/components/JobsManager.tsx
    - src/components/JobsManager.test.tsx
---

# 16-12 SUMMARY — Convert to Sale (D-20)

## Goal achieved

Gap G closed. Clicking `[Convert to Sale]` on an accepted Quote opens the
existing Record Sale modal pre-populated from the Quote's snapshot. On save,
the Sale write + Quote `status='converted'` patch commit atomically in a
single Dexie transaction. The Quote stays in Recent Quotes with the
`[Converted]` badge + `→ Sale on {date}` annotation (rendered automatically
by plan 16-11). The Sale shows up in Recent Sales with the `← Q-NNNN`
back-ref link (rendered automatically by plan 16-11's `SaleBackRefLink`).

## What changed

### Sale.shippingCost
Confirmed already present at `src/types.ts:359` (added in Phase 14). No
schema change required for this plan.

### `src/components/JobsManager.tsx`

**Imports**:
- Added `RuntimeQuoteStatus` to type imports
- Added `db` import from `'../db/database'` (needed for the multi-store transaction)

**State**:
- `const [convertingFromQuote, setConvertingFromQuote] = useState<Quote | null>(null);`

**Handler** — `handleStartConversion(quote)`:
- Locks the source Quote into state
- Pre-populates the Record Sale modal state cluster:
  - Customer: `name/email/company/address` from `quote.customerSnapshot`
  - Notes: blank (Quote does NOT carry notes per D-18; Sale.notes stays for the user)
  - `saleQuantity: 1` (D-04 single-row collapse)
  - `saleUnitPrice: quote.lineItemsSnapshot.sellingPrice`
  - `saleShippingCost: quote.lineItemsSnapshot.shippingCost`
- Opens the modal via `setShowSaleForm(true)`
- Selects the source job so `selectedJob` resolves correctly inside the modal

**resetSaleForm** extension:
- Now also clears `convertingFromQuote` so cancel-then-reopen doesn't carry
  stale conversion state.

**handleRecordSale** branch (the heart of D-20):
The legacy non-conversion path is preserved unchanged. The conversion path
branches on `convertingFromQuote`:

```ts
if (convertingFromQuote) {
  const quotePatch: Quote & { status: RuntimeQuoteStatus } = {
    ...convertingFromQuote,
    status: 'converted',         // narrow type — TypeScript refuses 'draft' here
    convertedAt: new Date(),
    convertedToSaleId: sale.id,
  };
  await db.transaction('rw', db.sales, db.quotes, async () => {
    await db.sales.add(sale);
    await db.quotes.put(quotePatch);
  });
} else {
  await addSale(sale);  // legacy path
}
```

`Sale.convertedFromQuoteId = convertingFromQuote?.id` is set on the Sale
payload (undefined when not converting, populated when converting).

**BLOCKER I-03 compile-time guard verified**:
- The quotePatch object's type is `Quote & { status: RuntimeQuoteStatus }`
- `RuntimeQuoteStatus = Exclude<QuoteStatus, 'draft'>`
- Any future commit that tries `status: 'draft'` here produces the tsc error:
  `Type '"draft"' is not assignable to type 'RuntimeQuoteStatus'.`
- Symmetric with the createQuote hook action's payload (useDatabase.ts) — both
  runtime write sites narrow status; only `src/db/backfill.ts` uses the wider
  `QuoteStatus` (for the legitimate v7→v8 'draft' backfill).

**Modal banner**:
- A blue banner above the modal body reads: `Converting Q-NNNN — review and
  adjust if needed.` Only rendered when `convertingFromQuote !== null`.

**Convert button wiring** (plan 16-11's QuoteRow):
- Added optional `onConvert?: () => void` prop to QuoteRow
- Plumbed `onStartConversion?: (quote: Quote) => void` through
  `RecentQuotesSection` (now accepts the callback as a prop) → wired in
  JobsManager via the existing rowProps useMemo + the standalone JobCard
  render path
- Added `onStartConversion?` to `JobCardProps` + `JobRowProps`
- When `onConvert` is provided, the button is enabled and clicking it calls
  `onStartConversion(quote)`; when absent (e.g., if RecentQuotesSection is
  used standalone in a test), the button stays disabled with the same
  hover-title behavior

### `src/components/JobsManager.test.tsx`

Added a `describe('Convert to Sale (D-20)', ...)` block with 3 tests + 1 todo:

| # | Test | Asserts |
|---|------|---------|
| 1 | Convert ENABLED when `onStartConversion` provided | `button.disabled === false` |
| 2 | Click fires `onStartConversion(quote)` | spy receives the quote with id + quoteNumber |
| 3 | Convert DISABLED when `onStartConversion` absent | `button.disabled === true` (backwards-compat with plan 16-11) |
| 4 | `it.todo`: transactional rollback | Deferred to plan 16-13 UAT — `fake-indexeddb` is not a devDep, so mocking Dexie's transaction rollback cleanly would require adding it; documented as integration-test scope |

## Acceptance criteria — all ✓

| Check | Result |
|-------|--------|
| `grep -c "shippingCost?: number" src/types.ts` | **2** ✓ (PrintJob + Sale) |
| `grep -c "convertingFromQuote" src/components/JobsManager.tsx` | **8** ✓ |
| `grep -c "handleStartConversion" src/components/JobsManager.tsx` | **4** ✓ |
| `grep -c "db.transaction" src/components/JobsManager.tsx` | **1** ✓ |
| `grep -c "status: 'converted'" src/components/JobsManager.tsx` | **1** ✓ |
| `grep -c "RuntimeQuoteStatus" src/components/JobsManager.tsx` | **3** ✓ (import + patch type + JSDoc) |
| `grep -c "convertedFromQuoteId" src/components/JobsManager.tsx` | **6** ✓ |
| `grep -c "convertedToSaleId" src/components/JobsManager.tsx` | **1** ✓ |
| `grep -c "setConvertingFromQuote(null)" src/components/JobsManager.tsx` | **1** ✓ (inside resetSaleForm) |
| `grep -c "Converting" src/components/JobsManager.tsx` | **4** ✓ (banner + comments) |
| `grep -c 'title="Available in next plan"' src/components/JobsManager.tsx` | **0** ✓ (Convert button no longer hard-disabled) |
| `npx tsc -b` | exit 0 ✓ |
| `npx vitest run` (full suite) | **216 passed, 2 todo** (was 213 pre-plan) ✓ |
| `node scripts/lint-no-raw-html.mjs` | exit 0 ✓ |
| `node scripts/assert-no-static-jspdf.mjs` | exit 0 ✓ |

## Deviations from plan

1. **Convert button onClick wired via prop, not direct handler**: the plan
   suggested wiring the button's `onClick` directly to a closure. To keep
   `QuoteRow` testable in isolation (plan 16-11 already exports
   `RecentQuotesSection`), I added an `onConvert` prop to `QuoteRow` and
   `onStartConversion` prop to `RecentQuotesSection`. The disabled state is
   driven by whether the callback is passed. This is functionally identical
   but more testable — the 3 new Convert tests use this seam.

2. **Sale-side customer auto-create/link path**: the plan's Task 2 step 3
   notes the 15.1-04 auto-link block fires when `!editingSale` + customer
   fields non-empty. Convert sets `editingSale=null` and pre-populates the
   customer fields, so the existing block does fire for the conversion case.
   No change needed there. The hook hierarchy is unchanged.

3. **Rollback test deferred**: documented `it.todo` citing plan 16-13 UAT
   as integration coverage, per the plan's explicit fallback for the
   no-fake-indexeddb case.

## Commits

- `3aef2b0`: feat(16-12): Convert to Sale — atomic Sale+Quote transaction with status narrowing (D-20)
- `b16e031`: test(16-12): 3 Convert to Sale tests + 1 it.todo for rollback (D-20)
- (this SUMMARY commit)

## Self-Check: PASSED
