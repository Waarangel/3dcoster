---
phase: 16-printable-pdf-quote
plan: "08"
status: complete
gap_closure: true
gap_ids: [H]
decisions: [D-21]
executed: 2026-05-23T13:44:00Z
executed_by: orchestrator-inline
key-files:
  modified:
    - src/components/CostCalculator.tsx
    - src/components/CostCalculator.test.tsx
    - src/components/JobsManager.tsx
---

# 16-08 SUMMARY — D-21 tax-rate persistence fix

## Goal achieved

Gap H closed. The CostCalculator save sites no longer persist the raw
`taxRateOverride` (which is `undefined` for blank input). Both save
sites now serialize `tax.ratePercent` — the `calculateTax` result
computed from the resolved tax source. The PDF generator reads
`job.taxRate` directly, so the tax row now appears for every job
where a default tax rate is configured, regardless of whether the
user filled the per-job override field.

## What changed

### `src/components/CostCalculator.tsx`
Two save sites updated:
- **Update path** (line 589): `taxRate: taxRateOverride` → `taxRate: tax.ratePercent`
- **Create path** (line 624): `taxRate: taxRateOverride` → `taxRate: tax.ratePercent`

The local `tax` constant (line 492) is the existing `calculateTax(sellingPrice, taxSource.rate)`
useMemo result. It is already in scope at both save sites — no new
helper required. The `taxAmount` field already serialized correctly
(`tax.taxAmount` post-Phase 13); the bug was always asymmetric
(amount right, rate wrong).

The form state `taxRateOverride` is unchanged — still the live-edit
value the user types.

### `src/components/CostCalculator.test.tsx`
Replaced `it.todo` placeholder with `describe('D-21 tax save site regression', ...)`
containing 5 tests:

| # | Test | Purpose |
|---|------|---------|
| 1 | source: zero `taxRate: taxRateOverride` | Static contract — fails RED, passes GREEN |
| 2 | source: two `taxRate: tax.ratePercent` | Static contract — fails RED, passes GREEN |
| 3 | chain: blank override + 13% default → ratePercent === 13 | The bug scenario |
| 4 | chain: explicit 7% override + 13% default → 7 | Override wins per resolver |
| 5 | chain: explicit 0% override + 13% default → 0 | Explicit zero respected |

Test 1 + 2 form the lock — any future regression that reverts the save
sites to the raw override will fail vitest immediately.

### `src/components/JobsManager.tsx`
Added the D-21 audit comment per case B (no defect found):

```ts
// TODO(future-sale-pdf): D-21 audit 2026-05-23 — when Sale gains taxRate
// (e.g., Sale PDF invoicing in v2), persist the RESOLVED rate from
// resolveTaxRate(), NOT the raw form override. Mirror the
// CostCalculator.tsx D-21 fix at lines 589 + 624. Sale today (Phase 14
// shape) has shippingCost/marketplace/marketplaceFee but no taxRate
// field — audit-clean as of 2026-05-23.
```

The grep audit (`grep -n "taxRate" src/components/JobsManager.tsx`)
returned zero matches before the comment was added. The `Sale` interface
in `src/types.ts` confirms: shippingCost, marketplace, marketplaceFee
are present; `taxRate?: number` is not. Phase 14 SUMMARY (per the
plan reference) corroborates this. The TODO locks the contract for
any future Sale-PDF feature.

## D-21 audit — Sale-write path

| Check | Result |
|-------|--------|
| `grep -n taxRate src/components/JobsManager.tsx` (pre-fix) | 0 matches |
| Sale interface includes `taxRate` field | No |
| `handleRecordSale` writes Sale.taxRate | No |
| Symmetric fix required? | No — case B |
| Audit-clean TODO comment added? | Yes (1 occurrence) |

## Historical data

Per D-21 explicitly: **no backfill**. The fix is forward-only.
Pre-fix PrintJob records with `taxRate === undefined` remain as-is.
The VERIFICATION.md report acknowledges Sale-PDF doesn't exist yet so
the inconsistency is invisible to end users today; new jobs saved
after this commit persist the correct rate.

## Verification

| Gate | Result |
|------|--------|
| `grep -c 'taxRate: taxRateOverride' src/components/CostCalculator.tsx` | **0** ✓ |
| `grep -c 'taxRate: tax.ratePercent' src/components/CostCalculator.tsx` | **2** ✓ |
| `grep -c 'TODO(future-sale-pdf): D-21' src/components/JobsManager.tsx` | **1** ✓ |
| `npx tsc -b` | exit 0 ✓ |
| `npx vitest run` (full suite) | **182 passed, 1 todo, 0 failed** (was 177 pre-plan) ✓ |
| `npx vitest run src/utils/taxResolution.test.ts` (resolver untouched) | passes ✓ |
| Resolver source diff | zero changes ✓ |

## Commits

- `b7c3961`: test(16-08): add D-21 regression tests for tax save sites (RED)
- `b443d77`: fix(16-08): D-21 — save resolved taxRate not raw override (GREEN)
- (this SUMMARY commit)

## Self-Check: PASSED

All success criteria met. D-21 fix is in, tested, and locked.
Field-name note: the plan referenced `tax.ratePercent` consistently
and that field name matches the `calculateTax` return shape
(`{ taxAmount: number; ratePercent: number }`); the resolver's own
`rate` field would also have been valid (`taxSource.rate`), but
`tax.ratePercent` is preferred because `calculateTax` is the
single point that already serialized `taxAmount` correctly —
keeping both fields sourced from the same function is the
least-surprise wiring.
