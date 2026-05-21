---
phase: 13-tax-model-ui-sweep
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/data/taxRates.ts
  - src/utils/taxResolution.ts
  - src/utils/taxResolution.test.ts
  - src/utils/costCalc.ts
  - src/utils/costCalc.test.ts
  - src/components/SettingsModal.tsx
  - src/components/AssetLibrary.tsx
  - src/components/JobsManager.tsx
  - src/components/PrinterSettings.tsx
  - src/components/CostCalculator.tsx
  - src/App.tsx
  - src/components/UserProfileModal.tsx
  - src/components/GcodeImport.tsx
  - src/features.ts
findings:
  critical: 0
  warning: 7
  info: 5
  total: 12
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 13 introduces the tax-model fallback chain (`resolveTaxRate`), the `calculateTax`
helper, the per-job tax override UI, the Settings default tax field, and the breakdown
tax row with provenance tooltip. The core math and resolver are sound and
well-tested. Tests cover the documented chain (override → settings → eu-average →
region → manual), the US marketplace-facilitator note append, the de-dup guard,
and the staleness threshold.

No CRITICAL defects found. Surface bugs are all degraded-UX or maintainability
concerns rather than correctness failures. The most pressing items are:

1. **WR-01** — `editingJob` reset effect overwrites in-progress edits when
   `materials` changes (data-loss surface introduced into Phase 13 via the new
   `setTaxRateOverride` line; pre-existing pattern, but Phase 13 hooked into it).
2. **WR-02** — `taxRateOverride` is *not* persisted to sessionStorage while every
   other in-progress field is — refresh mid-edit silently drops the override.
3. **WR-03** — The locked US marketplace-facilitator string is duplicated across
   `taxResolution.ts`, `taxRates.ts`, the test, and `SettingsModal.tsx`. The
   de-dup guard relies on byte-exact equality.

## Warnings

### WR-01: editingJob effect overwrites user edits when materials list updates

**File:** `src/components/CostCalculator.tsx:183-222`
**Issue:** The "populate from editingJob" effect lists both `editingJob` and
`materials` in its dependency array. Inside, it unconditionally calls
`setPrintName`, `setSellingPrice`, `setTaxRateOverride(editingJob.taxRate)`
(line 197 — added in this phase), `setTargetProfit`, `setProfitMarginPercent`,
etc.

If a user opens an existing job for edit, adjusts the tax override / selling
price / profit margin, and then in another tab (or via a side effect) the
`materials` array reference rotates (App.tsx already memoizes it, but any
addAsset / updateAsset / deleteAsset / bulkImport mutation produces a new
reference), this effect re-fires and **silently resets all of those fields back
to the saved-job values** — including the Phase 13 `taxRateOverride`.

The `materials` dep is only legitimately needed for the filament-row
reconciliation block at line 211-220. Phase 13 added the
`setTaxRateOverride(editingJob.taxRate)` line to this effect, so the data-loss
surface now includes the tax override.

**Fix:** Split the effect — keep one effect on `[editingJob]` for the scalar
fields (name, taxRateOverride, sellingPrice, etc.), and one on
`[editingJob, materials]` for filament-row reconciliation only. Or guard the
scalar resets behind a ref that tracks whether `editingJob.id` actually
changed:

```ts
const lastEditingJobId = useRef<string | null>(null);
useEffect(() => {
  if (!editingJob) return;
  const isJobSwitch = editingJob.id !== lastEditingJobId.current;
  lastEditingJobId.current = editingJob.id;
  if (isJobSwitch) {
    setPrintName(editingJob.name);
    setTaxRateOverride(editingJob.taxRate);
    setSellingPrice(editingJob.sellingPrice);
    // ...all the other scalar resets
  }
  // filament-row reconciliation (always runs when materials change)
  const restoredRows = (editingJob.filaments ?? []).map(/* ... */);
  setFilamentRows(restoredRows.length > 0 ? restoredRows : [makeDefaultRow(userCurrency)]);
}, [editingJob, materials]);
```

---

### WR-02: taxRateOverride is not persisted to sessionStorage

**File:** `src/components/CostCalculator.tsx:147-180`
**Issue:** The form-persistence effect serializes every in-progress field —
`printName`, `filamentRows`, `sellingPrice`, `profitMarginPercent`, `marketplace`,
`shippingMethod`, etc. — but conspicuously omits `taxRateOverride`. Every other
"current edit" value survives a page refresh; the user's tax override does not.

This produces an asymmetric persistence behavior that will confuse users: type
a 20% override, refresh, return to the form, see selling price preserved but
tax field empty.

**Fix:** Add `taxRateOverride` to the persisted `formState` object and the deps
array. Also restore it in the lazy initializer at line 129 — currently it only
reads `editingJob?.taxRate`, missing the "new job, refresh mid-edit" case.

```ts
// In the persist effect (line 151-173):
const formState = {
  // ...existing fields
  taxRateOverride,  // ← add this
};

// In the deps array (line 175-180):
}, [
  // ...existing deps
  taxRateOverride,  // ← add this
]);

// In the initializer (line 129):
const [taxRateOverride, setTaxRateOverride] = useState<number | undefined>(() => {
  if (editingJob) return editingJob.taxRate;
  return getStoredValue('taxRateOverride', undefined);
});
```

---

### WR-03: US marketplace-facilitator string is duplicated across four files

**File:** `src/utils/taxResolution.ts:12-13`, `src/data/taxRates.ts:27`,
`src/utils/taxResolution.test.ts:7-8`, `src/components/SettingsModal.tsx:275`
**Issue:** The exact same long string literal —
`"Most US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state."`
— lives in four separate locations. The `tooltipForSource` de-dup guard at
`taxResolution.ts:112` (`if (userCurrency === 'USD' && !base.includes(US_NOTE))`)
relies on the byte-for-byte equality between the local `US_NOTE` constant and
the inline copy carried in `taxRates.ts`'s US row's `note` field.

If anyone updates one copy (e.g., fixing a typo, adding a state name) without
updating the others, the guard silently fails and the USD breakdown tooltip
appends the note **twice** for region-default US users. The test at line 117-131
locks the "exactly once" invariant via fixture, but it uses its own duplicated
copy (line 7-8) — if production drifts, the fixture drifts too, and the test
keeps passing while the user sees doubled text.

**Fix:** Export `US_NOTE` from `taxRates.ts` and import it everywhere:

```ts
// In src/data/taxRates.ts:
export const US_MARKETPLACE_FACILITATOR_NOTE =
  'Most US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state.';

// US row uses it inline:
{ currency: 'USD', region: 'US', label: 'United States', rate: 0, rateAsOf: '2025-01-01',
  note: US_MARKETPLACE_FACILITATOR_NOTE },
```

Then `taxResolution.ts`, the test, and `SettingsModal.tsx` all import the same
constant. The de-dup guard is now backed by reference equality.

---

### WR-04: console.log left in production code path

**File:** `src/components/CostCalculator.tsx:234`
**Issue:**
```ts
console.log('Auto-selecting printer:', printerInstances[0].id, 'from instances:', printerInstances.map(p => p.id));
```
This fires every time the auto-selection effect runs (which happens on any
`printerInstances` reference change). It pollutes the console on every Asset
Library mutation that touches printers, and leaks the user's printer IDs to
any extension or analytics consumer that hooks `console.log`.

**Fix:** Remove the `console.log`. The branch comment alone documents the
intent.

```ts
if (!hasValidSelection) {
  setSelectedInstanceId(printerInstances[0].id);
}
```

---

### WR-05: Comment claims "half-away-from-zero" but Math.round is half-to-positive-infinity

**File:** `src/utils/costCalc.ts:122`
**Issue:** Comment reads
`// Tax: Math.round(sellingPrice * ratePercent) / 100 — half-away-from-zero rounding to 2 decimals.`
JavaScript's `Math.round` uses **half-to-positive-infinity** (also called
"asymmetric round half up"): `Math.round(0.5) === 1`, `Math.round(-0.5) === 0`.
"Half-away-from-zero" would be `Math.round(-0.5) === -1`.

For Phase 13 this is harmless because `calculateTax` returns 0 immediately when
`sellingPrice <= 0` (line 131), so the negative-rounding semantics never run.
But the comment is incorrect, and the test at `costCalc.test.ts:464-468` echoes
the wrong claim ("centime rounding, half-away-from-zero"). If anyone ever
removes the `sellingPrice <= 0` guard expecting half-away-from-zero semantics,
they'll get a -0.5 → 0 surprise.

**Fix:** Update the comment to reflect actual semantics:
```ts
// Tax: Math.round(sellingPrice * ratePercent) / 100 — half-to-positive-infinity
// rounding to 2 decimals (matches JS Math.round; sellingPrice <= 0 short-circuits
// to 0 so negative rounding semantics are unreachable here).
```
And update the matching test comment at `costCalc.test.ts:464`.

---

### WR-06: selectedPrinter falls back to `null`, but downstream signature expects `undefined`

**File:** `src/components/CostCalculator.tsx:241`
**Issue:**
```ts
const selectedPrinter = printers.find(p => p.id === selectedInstance?.printerConfigId) || printers[0] || null;
```
The terminal `|| null` returns `null` when `printers` is empty. Downstream,
`calculateCost`'s `CalcInput.selectedPrinter` is typed `PrinterConfig | undefined`
(`src/utils/costCalc.ts:31`), and the same is true for `calculateElectricityCost`,
`calculateDepreciation`, `calculateNozzleWear`.

`null` is not assignable to `PrinterConfig | undefined` under strict null checks.
The runtime guard `selectedPrinter ? ... : 0` happens to short-circuit on `null`
(falsy), so the math is correct — but the type contract is violated, and a
future maintainer using `selectedPrinter?.foo` or `selectedPrinter !== undefined`
would get unexpected branches.

**Fix:** Change the terminal fallback from `null` to `undefined`:
```ts
const selectedPrinter = printers.find(p => p.id === selectedInstance?.printerConfigId) || printers[0] || undefined;
```
Or restructure as `printers.find(...) ?? printers[0]` (returns `undefined`
naturally when both fail) and rely on TypeScript's narrowing.

---

### WR-07: Tax row shows "Tax (20.0%) — $0.00" when sellingPrice is 0 but rate is set

**File:** `src/components/CostCalculator.tsx:1373-1387`
**Issue:** The breakdown's tax row is gated on `tax.ratePercent > 0`, not
`tax.taxAmount > 0`. When the user has set a tax override (e.g., 20%) but
sellingPrice is still 0 (e.g., they haven't entered a price yet), the row
renders "Tax (20.0%) — $0.00" and a "Total (with Tax) — $0.00" line. This is
arguably correct (rate is set, amount is naturally zero), but it appears
**below** the per-unit cost summary, where the user has only entered a tax rate
but no sell price. The "Total" line at $0.00 will look like a glitch.

The asymmetry in `calculateTax` reinforces this: line 128-130 returns
`ratePercent: 0` when rate is invalid, but line 131-133 returns
`ratePercent: ratePercent` (preserved) when sellingPrice is invalid — so the
gate fires on the latter case but not the former.

**Fix (one of):**
1. Tighten the gate to `tax.ratePercent > 0 && sellingPrice > 0`.
2. Or make `calculateTax` symmetric: zero out `ratePercent` when sellingPrice <= 0
   too. (This breaks the contract a bit — tooltip resolution uses `taxSource.rate`
   which is separate, so symmetry here is safe.)

Preferring option 1 (smaller blast radius):
```tsx
{tax.ratePercent > 0 && sellingPrice > 0 && (
  <div className="border-t border-slate-700 pt-2 mt-2">
    {/* ... */}
  </div>
)}
```

## Info

### IN-01: 22 EUR rows in TAX_RATES are unreachable (acknowledged dead reference data)

**File:** `src/data/taxRates.ts:43-68`
**Issue:** The `resolveTaxRate` chain short-circuits all `currency === 'EUR'`
calls to the `eu-average` branch (line 48-54 of `taxResolution.ts`) BEFORE the
`.find()` lookup. This means the 22 rows in `TAX_RATES` tagged `currency: 'EUR'`
(Austria through Spain, including the BG/HU/HR/RO placeholders) are never
hit by the resolver. The file comment at line 32-42 acknowledges this and
states the rows are "kept as reference data for future country-keyed lookup."

This is by design (per the EU-collapse pitfall lock — Pitfall 4), but the
codebase carries ~22 KB of dead data that no consumer reads. If the
"future country-keyed lookup" never lands, this stays as dead data forever.

**Fix:** No change needed today. Consider adding a TODO with a phase/issue
reference if there's no current plan to wire country-keyed lookup, so the
intent doesn't decay over time.

---

### IN-02: 9 supported currencies fall through to `manual` because TAX_RATES doesn't cover them

**File:** `src/data/taxRates.ts:24-70`
**Issue:** The `Currency` union in `types.ts:12-30` includes 17 currencies.
`TAX_RATES` provides currency-keyed coverage for 8 (USD, GBP, AUD, CAD, CZK,
DKK, PLN, SEK) plus the EUR-average branch. That leaves **NZD, CHF, NOK, JPY,
CNY, INR, BRL, MXN, ZAR** falling through to `kind: 'manual'`.

The "manual" tooltip ("Unknown region — enter manually. We don't have a default
rate for your currency yet.") is correct UX. But for currencies where a
straightforward national VAT/GST rate exists (NZD GST 15%, CHF VAT 8.1%, NOK
MVA 25%, JPY 10%, INR GST 18%), users sitting in those currencies will see
"Unknown region" even though their tax model is well-defined.

**Fix:** No change needed today — Phase 13 scope was explicitly "27 EU member
states + UK + AU + CA + US." Document the gap in `13-RESEARCH.md` or a
follow-up phase backlog item.

---

### IN-03: NZD branch in shipping but not in tax — minor inconsistency

**File:** `src/components/CostCalculator.tsx:378`, `src/data/taxRates.ts`
**Issue:** `availableShippingMethods` treats NZD as Oceania-adjacent (`if
(userCurrency === 'AUD' || userCurrency === 'NZD')` → adds Australia Post),
but `TAX_RATES` has no NZD row, so NZD users fall through to manual.

This is internally consistent with Phase 13 scope (NZD wasn't on the locked
list) but produces a mild UX asymmetry: NZD users get region-aware shipping
but generic-fallback tax.

**Fix:** Note for future phase. No action required now.

---

### IN-04: CostCalculator break-even shows '∞' while JobsManager normalizes to null

**File:** `src/components/CostCalculator.tsx:1450`,
`src/components/JobsManager.tsx:379-388`
**Issue:** `CostCalculator.breakEvenInfo.breakEvenCopies` can be `Infinity`
(line 441) and the JSX renders `'∞'`. `JobsManager.getBreakEvenInfo` normalizes
the same calculation to `null` (line 382-384) and renders a "cannot be
computed" badge instead.

Two views of the same metric use different sentinels. The `'∞'` glyph also
isn't accessibility-friendly (screen readers read it as "infinity symbol" which
is meaningful but not as clear as "cannot be computed at this price").

Pre-existing inconsistency (not introduced in Phase 13), but the
`CostCalculator` file is part of this review's scope so noting it. Consider
unifying on the `null` sentinel pattern and a shared "break-even unreachable"
copy.

---

### IN-05: Negative tax rate behavior is not unit-tested

**File:** `src/utils/costCalc.test.ts:447-488`
**Issue:** The `calculateTax` tests cover `ratePercent === 0` (line 449) and
the order-of-operations guard (line 475), but no test asserts the
`ratePercent < 0` branch. Production input is clamped to `[0, 99.9]` in both
SettingsModal (line 295) and CostCalculator (line 1250), so this is
defense-in-depth — but a regression that lets negative rates through to the
helper (e.g., a future flow bypassing the clamps) would not be caught.

**Fix:** Add one test:
```ts
it('returns 0 when ratePercent is negative (defense-in-depth guard)', () => {
  expect(calculateTax(100, -5)).toEqual({ taxAmount: 0, ratePercent: 0 });
});
```

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
