---
phase: 22-jobsmanager-decomposition-perf
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/components/CustomerLibrary.tsx
  - src/components/JobsManager.test.tsx
  - src/components/JobsManager.tsx
  - src/components/PrintQuoteModal.tsx
  - src/components/RecordSaleModal.test.tsx
  - src/components/RecordSaleModal.tsx
  - src/components/SaleRow.test.tsx
  - src/components/SaleRow.tsx
  - src/components/ui/icons/SearchIcon.tsx
  - src/components/ui/icons/index.ts
  - src/hooks/useCustomerPicker.test.tsx
  - src/hooks/useCustomerPicker.ts
  - src/hooks/useDatabase.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-05-27
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 22 (JobsManager decomposition + perf) extracted RecordSaleModal and
SaleRow from JobsManager, introduced the useCustomerPicker hook, lifted the
break-even calculator to module scope (PERF-01), memoized marketplace fees
(PERF-02), and added a dedicated useAllSales hook (PERF-07). The structural
work is sound:

- **Convert-from-Quote atomic transaction (Pitfall 2)** is preserved verbatim
  in `RecordSaleModal.handleRecordSale` (`db.transaction('rw', db.sales,
  db.quotes, db.jobs, ...)` at lines 358-369). The Quote patch +
  `copiesSold` bump + Sale write run in one tx — matches the pre-refactor
  flow at the byte level. No regression.
- **PERF-01 `breakEvenMap`** dependency set `[searchedJobs, salesByJob]` is
  complete. `computeBreakEvenInfo` reads only `job` fields and the explicit
  `salesByJob` arg — no closure over component state. Verified safe.
- **PERF-02 `marketplaceFee` memo** deps `[saleQuantity, salePrice,
  saleMarketplace]` are complete. `calculateMarketplaceFee` is a
  module-scope pure function with zero closure capture.
- **useCustomerPicker hook** correctly excludes the consumer-specific
  `pickedExistingCustomerId` slot (Pitfall 1 respected). `reset` is stable
  via `useCallback([])`. WR-04 ArrowDown-on-empty no-op and CR-04 Escape
  `stopPropagation` are intact.
- **Type safety**: no new `as any` introductions; the two
  `breakEvenMap.get(job.id)!` non-null assertions are sound (Map is built
  from the same `searchedJobs` array that feeds the row list, so the
  invariant holds).

That said, the review found 3 warnings and 4 info-level issues — most are
pre-existing pre-Phase 22 patterns that survive into the new layout, but
two are introduced or exposed by the refactor and should be addressed
before this ships.

## Warnings

### WR-01: Dead `userProfile` prop on RecordSaleModal — accepted but never used

**File:** `src/components/RecordSaleModal.tsx:60` (also `JobsManager.tsx:1406`)

**Issue:** `RecordSaleModalProps` declares `userProfile: UserProfile` (line
60) and the import on line 4 destructures `UserProfile` from `../types`.
The parent `JobsManager.tsx:1406` passes `userProfile={userProfile}` to
the modal. But the component function on line 70 destructures only
`{ job, userCurrency, shippingConfig, editingSale, convertingFromQuote,
isOpen, onClose }` — `userProfile` is NEVER read inside RecordSaleModal.

This is a leftover from the pre-Phase 22 inlined code, where JobsManager
had `userProfile` in scope and the inline modal body could have referenced
it. The prop was carried over but never wired into RecordSaleModal's
body. Result: every render of JobsManager unnecessarily passes
`userProfile` through props, and the modal's interface lies about needing
it.

**Fix:** Either (a) remove `userProfile` from `RecordSaleModalProps`
entirely AND drop the prop pass at `JobsManager.tsx:1406`, OR (b) wire it
into the handler if there's a future need (e.g., for tax computation on
Sale records — see the `TODO(future-sale-pdf)` at line 296). Preference is
(a) since the TODO already exists and the prop is misleading dead
plumbing.

```typescript
// RecordSaleModal.tsx — drop line 60
export interface RecordSaleModalProps {
  job: PrintJob;
  // userProfile: UserProfile;   ← remove
  userCurrency: Currency;
  ...
}

// JobsManager.tsx:1404-1413 — drop the prop pass
<RecordSaleModal
  job={selectedJob}
  userCurrency={userCurrency}
  shippingConfig={shippingConfig}
  ...
/>
```

Also remove the now-unused `UserProfile` import from line 4 of
`RecordSaleModal.tsx`.

---

### WR-02: Hydration effect can clobber in-progress form edits when `job.sellingPrice` changes mid-modal

**File:** `src/components/RecordSaleModal.tsx:114-155`

**Issue:** The hydration `useEffect` has deps `[editingSale,
convertingFromQuote, job.sellingPrice]`. If the parent re-renders with a
new `job.sellingPrice` value while the modal is open (e.g., a concurrent
liveQuery emission after the user updated the job's selling price in
another browser tab, or after the `copiesSold` reconcile fires
post-Convert), the effect re-runs and CLOBBERS every form field — even
in EDIT or CONVERT mode where `job.sellingPrice` is irrelevant to the
hydration target.

In EDIT mode the effect re-hydrates from `editingSale.unitPrice` (line
119), discarding any user edit to the quantity/customer fields since the
modal opened. In CONVERT mode it re-hydrates from
`convertingFromQuote.lineItemsSnapshot.sellingPrice` (line 132), same
clobber. Only the CREATE branch (line 145) actually consumes
`job.sellingPrice` — yet all three branches re-run on any change to it.

**Fix:** Drop `job.sellingPrice` from the dep array and consume it once at
mount via `useState`'s initializer for the CREATE branch, OR gate the
effect body on the mode discriminator:

```typescript
useEffect(() => {
  if (editingSale) {
    setSaleQuantity(editingSale.quantity);
    // ... hydrate from editingSale only
  } else if (convertingFromQuote) {
    setSaleQuantity(1);
    setSalePrice(convertingFromQuote.lineItemsSnapshot.sellingPrice);
    // ... hydrate from quote only
  }
  // CREATE-mode hydration moved to useState initializers so it
  // runs once at mount, not on every job.sellingPrice change
}, [editingSale, convertingFromQuote]);

// Then change line 86:
const [salePrice, setSalePrice] = useState(() =>
  editingSale?.unitPrice
  ?? convertingFromQuote?.lineItemsSnapshot.sellingPrice
  ?? job.sellingPrice
);
```

(The Modal.tsx:67 unmount-on-close behavior already guarantees a fresh
mount per open, so the lazy initializer fires exactly when needed.)

---

### WR-03: Module-scope `*Ran` flags in useDatabase.ts persist across HMR and across tests, hiding regressions

**File:** `src/hooks/useDatabase.ts:12, 16, 19`

**Issue:** Three module-scope mutable flags
(`saleCustomerBackfillRan`, `copiesSoldReconcileRan`, `tagsNormalizeRan`)
gate one-time-per-page-load reconcile effects. They live at module top
level, which means:

1. **Vite HMR**: when `useDatabase.ts` is edited during development, the
   module reloads but the flags reset, causing reconciles to re-run on
   every save. Currently benign because the reconciles are idempotent,
   but DEFEATS the "once per page load" optimization intent.
2. **Test isolation**: any test that imports `useDatabase` (even
   indirectly) inherits whatever flag state the previous test left
   behind. If test A runs `useJobs()` and `copiesSoldReconcileRan`
   flips to `true`, test B's mount will SKIP the reconcile entirely.
   The current tests don't depend on this, but the flag pollution is a
   foot-gun for future tests that DO want to assert the reconcile fires.
3. **Multiple React roots**: SSR/portal renders sharing the module would
   see flag state from each other.

The `eslint-disable-next-line react-hooks/exhaustive-deps` on lines 487,
532, 717 hides the dep-array trick (`[customers === undefined]`) — the
combo of module flag + boolean dep is fragile.

This is pre-existing (not Phase 22-introduced) but Phase 22 added
`useAllSales` next to these and didn't address them. Worth flagging
because the next surface that needs a similar reconcile will likely
copy-paste this pattern.

**Fix:** Move the flags into a per-`db`-instance ref or scope them inside
a top-level provider that owns the lifecycle (e.g., a `BackfillBoundary`
component that runs reconciles once on mount and exposes a ready
boolean to children). At minimum, document the foot-gun in a comment
block at the top of the file and add an explicit test helper
(`__resetBackfillFlagsForTest()`) so future tests can reset cleanly.

## Info

### IN-01: `RecordSaleModal` async `handleRecordSale` errors are unhandled

**File:** `src/components/RecordSaleModal.tsx:230, 622-624`

**Issue:** `handleRecordSale` (line 230) is async and may throw from any of
its `await` calls (`addCustomer`, `bumpLastUsed`, `updateSale`,
`addSale`, `db.transaction`). The Button consumer (line 622) wires
`onClick={handleRecordSale}` directly — React passes the returned Promise
to the synthetic event handler, which ignores rejections. The user sees
no error feedback; the modal stays open with the form pristine.

The Convert-from-Quote tx is the highest-risk path (`db.transaction` can
fail due to quota exhaustion, schema mismatch, or concurrent write
conflict). A silent failure here would be especially bad — the user
would think the Sale recorded successfully (modal closed via the optimistic
`onClose()` at line 378) but the rollback discarded all writes.

**Fix:** Wrap the body in `try/catch` and surface errors via local state.
Mirrors the `PrintQuoteModal.handleGenerateQuote` pattern (lines 164-241
of PrintQuoteModal.tsx) which already does this correctly.

Note: this is a pre-existing concern (`handleRecordSale` was unwrapped in
JobsManager pre-Phase 22 too) but Phase 22 made it more visible by
isolating the modal, and the Convert-from-Quote tx makes the
consequences worse than in the pre-refactor world.

---

### IN-02: `RecordSaleModal` customer auto-create runs OUTSIDE the Convert-from-Quote transaction

**File:** `src/components/RecordSaleModal.tsx:272-294, 358-369`

**Issue:** The customer side-effect (auto-create via `addCustomer` OR
silent-link via `bumpLastUsed`) runs at lines 272-294, BEFORE the
Convert-from-Quote `db.transaction` at lines 358-369. If the inner
transaction fails (Quote patch, Sale write, or copiesSold bump rolls
back), the customer write at line 292 (`addCustomer(newCustomer)`)
has ALREADY committed independently — leaving an orphan customer row in
the library that points to a sale that was rolled back.

This is the same atomicity flavor as Pitfall 2 from RESEARCH but for
the customer write, not the Quote write. The Pitfall 2 lock explicitly
addresses Quote+Sale+Job atomicity; customer atomicity wasn't part of
the lock scope.

**Fix:** Either (a) include `db.customers` in the Convert tx scope and
move the `await addCustomer(...) / await bumpLastUsed(...)` call inside
the tx callback, OR (b) document that customer writes are deliberately
non-atomic (an orphan library entry is harmless — the user can delete it
via CustomerLibrary if they notice).

Pre-existing behavior (existed in JobsManager pre-refactor) but worth
flagging in this review because Phase 22 surfaced the atomic tx as a
locked behavior contract via Pitfall 2 — symmetry suggests this should
either be locked too or explicitly excluded.

---

### IN-03: `useSales(selectedJobId || undefined)` triggers a duplicate global subscription when no job is selected

**File:** `src/components/JobsManager.tsx:984, 988`

**Issue:** Line 984 calls `useSales(selectedJobId || undefined)` to get
the scoped per-job feed. When `selectedJobId` is `null` (no job
expanded), the `undefined` arg makes `useSales` issue the global
`db.sales.orderBy('soldAt').reverse().toArray()` query. Line 988
ALSO subscribes via `useAllSales()` which issues the SAME global
query. Two `useLiveQuery` subscriptions to the identical Dexie
query fire when no job is selected.

Dexie's liveQuery probably dedupes the underlying observer, but this
still doubles the React re-render cost (two `useState` calls flip on
each emission, two re-render cycles).

Pre-existing (line 984's `useSales(selectedJobId || undefined)` was
already there pre-Phase 22) but Phase 22 introduced `useAllSales` next
to it without addressing the overlap.

**Fix:** Change line 984 to `useSales(selectedJobId ?? '__none__')` — a
sentinel jobId that matches no rows — so the no-selection state returns
an empty scoped array instead of triggering the global query. Then
`useAllSales` is the sole global subscriber. Confirm via a Dexie
trace that the sentinel doesn't allocate a where-clause cursor on every
emission.

Alternative: gate the `useSales` call behind `selectedJobId !== null`
with a conditional hook (not allowed by React rules — would require a
separate `<SelectedJobSalesProvider>` subcomponent).

---

### IN-04: Comment at `RecordSaleModal.tsx:229` references stale line numbers from pre-refactor JobsManager

**File:** `src/components/RecordSaleModal.tsx:229, 117, 130, 142`

**Issue:** Multiple comments reference line numbers from the
pre-refactor JobsManager that no longer exist. Examples:

- Line 229: `// ─── handleRecordSale (ported verbatim from
  JobsManager.tsx:1272-1420) ───`
- Line 117: `// (mirror of handleEditSale at JobsManager.tsx:1154-1171)`
- Line 130: `// handleStartConversion at JobsManager.tsx:1130-1151`
- Line 142: `// (mirror of resetSaleForm at JobsManager.tsx:1110-1124`

After plan 22-03 deleted the inline `handleRecordSale` /
`handleEditSale` / `handleStartConversion` / `resetSaleForm` from
JobsManager.tsx, the cited line numbers point to unrelated code (or to
the wrong half of the file). A future maintainer following the
comment will land in the wrong place.

**Fix:** Drop the line-number references and keep just the conceptual
breadcrumb (e.g., `// Ported verbatim from pre-Phase 22 JobsManager
handleRecordSale`), OR delete the breadcrumb entirely since the
extracted code now stands on its own.

Same drift exists in `useCustomerPicker.ts:52` (`// Copied verbatim from
JobsManager.tsx:1280-1287.`) and line 87 (`// Ported verbatim from
JobsManager.tsx:1317-1370`). Same fix applies.

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
