---
phase: 20-dexie-atomicity-audit
reviewed: 2026-05-26T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/db/database.ts
  - src/db/database.test.ts
  - src/db/backfill.ts
  - src/db/backfill.test.ts
  - src/db/database.migrations.test.ts
  - src/hooks/useDatabase.ts
  - src/hooks/useDatabase.test.ts
  - src/utils/csvHelpers.ts
  - src/utils/csvHelpers.test.ts
findings:
  critical: 4
  warning: 4
  info: 2
  total: 10
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-26
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 20 introduces Dexie transaction wrapping (DATA-01), tx-scoped quote-number reads (DATA-02), the v8/v9 currency reconcile (DATA-03), `parsePositiveNumber` zero-rejection (DATA-04), async `handleVersionchange` (DATA-05), and six `is*` type-predicates (DATA-06). The atomicity work and the versionchange fix are correct. However, four blockers were found: a `undefined`-currency write in the v9 upgrade, a `quotePayload!` definite-assignment that returns `undefined` on transaction failure, two structural type-predicates that omit required array fields (`customCarriers` / `customMarketplaces`), and a tautological DATA-02 test that does not exercise the production hook. Four warnings cover a non-atomic `deleteJob`, a stale error message after the `allowZero` change, a false-positive test spy, and the `db.customers.get` vs `tx.customers.get` discrepancy inside `createQuote`.

---

## Critical Issues

### CR-01: v9 upgrade stamps `undefined` as currency when UserProfile.currency is missing from stored JSON

**File:** `src/db/database.ts:170-175`

**Issue:** Layer 2 of the v9 reconcile upgrade parses `settingsRow.value` and assigns `userCurrency = (JSON.parse(...) as UserProfile).currency`. The TypeScript cast is to `UserProfile`, but at runtime the stored JSON may be a partial object where `.currency` is `undefined` — for example a profile saved before the `currency` field was added, or a row written by a future schema change. In that case:

1. No exception is thrown, so the `catch { return; }` guard does NOT fire.
2. `userCurrency` is `undefined` at runtime (the declared type `string` is wrong).
3. `reconcileQuoteCurrency(quotes, undefined)` is called.
4. Inside the helper, `if (currency === 'USD') return [];` does NOT early-return (`undefined !== 'USD'`).
5. Every quote whose `lineItemsSnapshot.currency === 'USD'` gets patched with `currency: undefined as Currency` — silently corrupting every existing quote.

The `try/catch` only protects against JSON parse failure, not a successfully-parsed object with a missing field.

**Fix:**
```typescript
let userCurrency: string;
try {
  const parsed = JSON.parse(settingsRow.value) as UserProfile;
  // Guard: if currency is absent or not a string, bail (same as corrupt path).
  if (typeof parsed.currency !== 'string' || !parsed.currency) return;
  userCurrency = parsed.currency;
} catch {
  return;
}
```

---

### CR-02: `quotePayload!` returns `undefined` to callers when the transaction throws before the scope function executes

**File:** `src/hooks/useDatabase.ts:877,933`

**Issue:** `quotePayload` is declared with the definite-assignment assertion (`!`) outside the transaction and assigned inside it. If `db.transaction(...)` rejects before the scope function runs — for example because the DB is closed (versionchange handler fires mid-flight), or because the browser's IDB transaction aborts at open-time — the `await db.transaction(...)` at line 879 throws, the assignment at line 897 never executes, and `return quotePayload;` at line 933 returns `undefined` typed as `Quote`. The definite-assignment `!` silences the TypeScript check but does not prevent the runtime undefined.

Callers such as `PrintQuoteModal` that immediately call `generateQuotePdf(quote)` on the returned value will then crash with a null-dereference on `quote.quoteNumber` or similar.

Note: the more common failure path — an exception thrown **inside** the scope function — is correctly propagated by `await db.transaction()` and reaches the caller as a rejected promise, so `return quotePayload` is never reached in that case. The risk is specifically the case where the transaction **itself fails to open** (the scope function is never called).

**Fix:** Assign a sensible initial value and throw after the await if it's still unset, or restructure to return from inside the scope:

```typescript
let quotePayload: (Quote & { status: RuntimeQuoteStatus }) | undefined;

await db.transaction('rw', db.quotes, db.customers, db.settings, async (tx) => {
  // ... existing body ...
  quotePayload = { ... };
  // ...
});

if (!quotePayload) {
  throw new Error('createQuote: transaction completed without assigning quotePayload');
}
return quotePayload;
```

---

### CR-03: `isShippingConfig` and `isMarketplaceFees` predicates accept stored objects that are missing required array fields, causing runtime crashes downstream

**File:** `src/db/database.ts:317-331` (`isShippingConfig`), `src/db/database.ts:343-358` (`isMarketplaceFees`)

**Issue:** Both `ShippingConfig.customCarriers` and `MarketplaceFees.customMarketplaces` are **non-optional** required fields in their respective TypeScript interfaces (`src/types.ts:447` and `src/types.ts:506`). Neither `isShippingConfig` nor `isMarketplaceFees` checks that these array fields exist. As a result:

- A settings row saved before those fields were added (or a row with a corrupt/missing array) passes the validator.
- `getSetting` returns the parsed object typed as `ShippingConfig` / `MarketplaceFees`.
- Any caller that does `shipping.customCarriers.forEach(...)` or `fees.customMarketplaces.map(...)` receives a `TypeError: Cannot read properties of undefined` at runtime.

This is the same class of bug the `is*` predicates were introduced to prevent — the predicates are structurally incomplete against their own interfaces.

`isShippingConfig` already correctly uses `Array.isArray(x)` to reject arrays at the top level but does not check `customCarriers`. `isMarketplaceFees` has no array check at all.

**Fix:**
```typescript
export function isShippingConfig(x: unknown): x is ShippingConfig {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return typeof o.maxDeliveryRadiusKm === 'number'
    && typeof o.gasPricePerLiter === 'number'
    && typeof o.vehicleFuelEfficiency === 'number'
    && typeof o.upsBaseCost === 'number'
    && typeof o.fedexBaseCost === 'number'
    && typeof o.purolatorBaseCost === 'number'
    && typeof o.uspsBaseCost === 'number'
    && typeof o.dhlBaseCost === 'number'
    && typeof o.royalMailBaseCost === 'number'
    && typeof o.australiaPostBaseCost === 'number'
    && typeof o.canadaPostBaseCost === 'number'
    && Array.isArray(o.customCarriers);   // ADD THIS
}

export function isMarketplaceFees(x: unknown): x is MarketplaceFees {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.facebookShippedPercent === 'number'
    // ... existing numeric checks ...
    && typeof o.amazonHandmadePercent === 'number'
    && Array.isArray(o.customMarketplaces);   // ADD THIS
}
```

**Note:** Adding these checks means existing users who saved settings before `customCarriers`/`customMarketplaces` were introduced will now fall back to `defaultValue`. The defaults both set these arrays to `[]`, which is the correct safe fallback. This is the desired behavior.

---

### CR-04: DATA-02 test in `useDatabase.test.ts` is tautological — it does not exercise the production `createQuote` implementation

**File:** `src/hooks/useDatabase.test.ts:211-322`

**Issue:** The DATA-02 test at line 212 purports to prove that `createQuote` reads `nextQuoteNumber` from the tx-scoped settings (not from the React state arg). However, the test never calls `createQuote` — it manually invokes `db.transaction(...)` directly in the test body, which is the exact expression the `txSpy` intercepts. The spy records a call from the test itself, not from the hook.

The assertions:
- `expect(txSpy).toHaveBeenCalledWith('rw', db.quotes, db.customers, db.settings, expect.any(Function))` — true because the test called it.
- `expect(callOrder).toEqual(['tx.table(settings).get', 'db.quotes.add'])` — true because the test's own inline scope function uses `mockTx.table('settings').get(...)`.
- `expect(passedPayload.quoteNumber).toBe(7)` — true because the test's own inline scope builds `quotePayload` with `nextNum = 7`.

The production `createQuote` function in `useDatabase.ts` could be deleted, replaced with `async () => ({} as Quote)`, or read from React state instead of from `tx`, and every one of these assertions would still pass. The test carries zero signal for the DATA-02 requirement.

The root cause is that `renderHook` + the real hook is unavailable in jsdom-without-IDB, so the test author wrote inline code that mimics the hook body — but that inline code IS the test oracle AND the subject under test simultaneously.

**Fix:** Acknowledge in the test file comment that DATA-02 has no test coverage at the hook level. Add a prominent `// NOT TESTED` marker or convert to a `it.todo(...)` so the coverage gap is explicit and not mistaken for a passing test. The existing "falls back to nextQuoteNumber=1" case (line 324) is a pure-logic test and is valid; only the first test case in this describe block is tautological.

```typescript
it.todo(
  'createQuote reads nextQuoteNumber from tx-scoped settings — deferred to Phase 23 TEST-04 (fake-indexeddb required)',
);
```

---

## Warnings

### WR-01: `deleteJob` is non-atomic — associated sales deletion and job deletion are separate IDB transactions

**File:** `src/hooks/useDatabase.ts:543-547`

**Issue:** `deleteJob` performs two sequential writes across two different IndexedDB auto-transactions:

```typescript
await db.sales.where('jobId').equals(id).delete();  // transaction 1
await db.jobs.delete(id);                            // transaction 2
```

If the process is killed, the tab is closed, or the browser crashes between these two lines, the job is deleted but its sales remain as orphaned rows. The `reconcileCopiesSoldFromSales` reconcile does handle orphan sales (they're ignored when computing the sum), but they persist forever in IndexedDB, silently inflating the database size and potentially confusing future reads. Given that `addSale`, `deleteSale`, and `updateSale` were all wrapped in transactions as part of DATA-01, `deleteJob` is the only remaining non-atomic path.

**Fix:**
```typescript
const deleteJob = useCallback(async (id: string) => {
  await db.transaction('rw', db.jobs, db.sales, async () => {
    await db.sales.where('jobId').equals(id).delete();
    await db.jobs.delete(id);
  });
}, []);
```

---

### WR-02: `db.customers.get()` and `db.quotes.add()` inside `createQuote` use ambient-transaction propagation, which is a fragile implicit coupling

**File:** `src/hooks/useDatabase.ts:921-929`

**Issue:** Inside the `db.transaction('rw', db.quotes, db.customers, db.settings, async (tx) => { ... })` callback, the code calls `db.customers.get(existingCustomerId)` (line 922) and `db.quotes.add(quotePayload)` (line 929) via the global `db` object, not via the `tx` parameter. It also calls `setUserProfile(...)` (line 930), which internally calls `db.settings.put(...)`.

Dexie v3 supports **zone-based ambient transaction propagation**: calls to `db.someTable.op()` inside a transaction callback are silently routed through the running transaction if that table is in scope. This works correctly today, but it is fragile for several reasons:

1. If `db.customers`, `db.quotes`, or `db.settings` is accidentally removed from the `db.transaction(...)` table list, Dexie throws `IDBTransactionEvent: A request was placed against a transaction which is currently not active, or which is finished.` — a runtime-only error with no compile-time warning.
2. The `tx` parameter was added specifically (per DATA-02) to use `tx.table('settings').get(...)` for the settings read. Mixing `tx.table(...)` for reads and `db.someTable` for writes within the same callback is inconsistent and makes the transaction scope harder to audit.
3. The DATA-02 test (see CR-04) was written to test the tx parameter pattern, but the actual customer/quote writes revert to the ambient pattern.

**Fix:** Use `tx.table(...)` consistently for all IDB operations inside the scope, or use `db.customers.get(...)` consistently and document that ambient propagation is intentional:

```typescript
// Either this (explicit tx):
const existing = await tx.table('customers').get(existingCustomerId);
if (existing) await tx.table('customers').put({ ...existing, lastUsedAt: new Date() });
await tx.table('quotes').add(quotePayload);

// Or document the ambient pattern explicitly:
// NOTE: db.customers.get() / db.quotes.add() route through the ambient
// Dexie transaction automatically (zone propagation). The tables ARE
// in scope. This is intentional and equivalent to using tx.table().
```

---

### WR-03: Error message for `packageCost` is misleading after `allowZero: true` change

**File:** `src/utils/csvHelpers.ts:250-253`

**Issue:** After DATA-04 adds `allowZero: true` to the `packageCost` call at line 241, the error message at line 252 still reads:

```
'Package cost must be a positive number'
```

But `packageCost` of `0` is now valid (free packaging). The only case that returns `null` is a missing value, non-numeric value, or a negative number. The message is factually wrong — it implies zero is invalid when it is now accepted.

**Fix:**
```typescript
errors.push('Package cost must be a non-negative number (0 is allowed for free items)');
```

---

### WR-04: `useDatabase.test.ts` DATA-01 spy tests are self-verifying no-ops

**File:** `src/hooks/useDatabase.test.ts:103-121`, `135-149`, `160-178`

**Issue:** Each DATA-01 describe block for `addSale`, `deleteSale`, and `updateSale` sets up a `txSpy = vi.spyOn(db, 'transaction').mockResolvedValueOnce(undefined)`, then the test body **itself calls** `await db.transaction('rw', db.sales, db.jobs, async () => { ... })`. The spy intercepts that call and returns immediately (mock). The assertion `expect(txSpy).toHaveBeenCalledWith('rw', db.sales, db.jobs, expect.any(Function))` passes because the test itself invoked the spy, not the `addSale`/`deleteSale`/`updateSale` hook functions.

The second test in each describe group (`'success path: ...'`) is even weaker — it only asserts fixture sanity (`expect(sale.jobId).toBe(...)`) and `typeof db.transaction === 'function'`, neither of which relates to transaction wrapping in the production code.

This is documented in the Wave 0 file header comment, but the test results can mislead future readers into thinking DATA-01 is tested. The tests give false confidence.

**Fix:** Convert all three self-referential DATA-01 spy tests to `it.todo(...)` and retain only the genuine fixture-sanity assertions with clearly labeled comments. The explicit `jsdom IDB availability check` test at line 75 is a valid environment probe and should be kept.

---

## Info

### IN-01: `unitsPerPackage <= 0` guard is dead code after DATA-04

**File:** `src/utils/csvHelpers.ts:256`

**Issue:** The condition `if (unitsPerPackage === null || unitsPerPackage <= 0)` at line 256 has a dead branch. `parsePositiveNumber(row.unitsperpackage)` (without `allowZero`) returns either `null` or a number `> 0`. The `unitsPerPackage <= 0` sub-condition can never be true for a non-null value returned by `parsePositiveNumber`. This was arguably dead code before DATA-04 and is still dead code after. It is harmless, but it signals a misunderstanding of the invariant `parsePositiveNumber` now enforces.

**Fix:** Simplify to `if (unitsPerPackage === null)` for clarity, and update the error message to match:
```typescript
if (unitsPerPackage === null) {
  errors.push('Units per package must be a positive number greater than zero');
}
```

---

### IN-02: Fixture helpers `makeMinimalJob` / `makeMinimalSale` are duplicated across three test files

**File:** `src/hooks/useDatabase.test.ts:18-49`, `src/db/backfill.test.ts:46-77`, `src/db/database.migrations.test.ts:33-64`

**Issue:** Three test files each define nearly identical `makeMinimalJob` and `makeMinimalSale` factory functions. `useDatabase.test.ts` even re-exports them (`export { makeMinimalJob, makeMinimalSale }` at line 52) with a comment saying they are "duplicated from backfill.test.ts — keep in sync." The re-export is not consumed by any other test file (both `backfill.test.ts` and `database.migrations.test.ts` have their own independent copies), so the re-export is dead.

**Fix:** Extract to `src/db/test-fixtures.ts` and import from there in all three test files. The re-export in `useDatabase.test.ts` can be removed.

---

_Reviewed: 2026-05-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
