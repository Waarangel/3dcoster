# Phase 20: Dexie Atomicity Audit — Research

**Researched:** 2026-05-26
**Domain:** Dexie 4 multi-store transactions, upgrade-callback patterns, runtime settings validation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Atomicity wrap scope — all 3 sale mutations.** `addSale` (DATA-01), `deleteSale`, and `updateSale` will each be wrapped in `db.transaction('rw', db.sales, db.jobs, ...)`. The existing Convert-to-Sale transaction is the template. Test coverage extends to all three (not just `addSale`).

2. **`parsePositiveNumber` API — `allowZero?: boolean` parameter (DATA-04).**
   ```ts
   function parsePositiveNumber(
     value: string | undefined,
     opts?: { allowZero?: boolean },
   ): number | null
   ```
   Default rejects `0`. Only `packageCost` opts in with `{ allowZero: true }`. Single function, no rename churn.

3. **`getSetting<T>` validator — hand-rolled per-key validators (DATA-06).** Optional third parameter, a type predicate `(parsed: unknown) => parsed is T`. Each typed getter (`getPrinter`, `getElectricity`, `getLabor`, `getUserProfile`, `getShipping`, `getMarketplaceFees`) passes its own hand-rolled `is`-predicate. No new dependency. Return `defaultValue` silently on rejection; `console.warn` only in dev (`import.meta.env.DEV`).

4. **DATA-03 reconcile — schema bump v8→v9 + upgrade-callback reconcile.**
   - **Part A (forward fix):** `backfillQuotesFromJobs` upgrade callback reads `currency` from `tx.table('settings').get('userProfile')` inside the upgrade transaction. Currency parameter threaded through to the pure helper.
   - **Part B (reconcile, per `[[feedback_reconcile_legacy_data]]`):** New v9 schema bump walks `db.quotes`, reads the user's current `userProfile.currency` from settings, and re-stamps any quote where `lineItemsSnapshot.currency === 'USD'` AND user's actual currency ≠ `'USD'`. Idempotent. Logs reconcile count in dev.
   - **Plan order:** DATA-05 `async versionchange` handler ships **before or with** DATA-03 v9 reconcile (the v9 schema bump triggers `versionchange` in other tabs; the new async handler must be in place when it fires).

5. **`createQuote` transaction body (DATA-02).** The existing `createQuote` already owns the transaction. Fix is moving the `nextQuoteNumber` read from the React state argument to a `tx.table('settings').get('userProfile')` call inside the transaction body. Currency / defaultTaxRate may continue to come from the React state arg.

6. **`versionchange` handler (DATA-05).**
   ```ts
   db.on('versionchange', async () => {
     await db.close();
     window.location.reload();
   });
   ```

### Claude's Discretion

- The exact JSDoc and module placement of the six hand-rolled `is`-predicates (researcher recommends co-locating each with the getter that uses it; alternative: dedicated `src/db/validators.ts`).
- Whether the v9 reconcile logs the patch count via `console.info` or `console.debug` (researcher recommends `console.info` gated on `import.meta.env.DEV`).
- Whether the addSale/deleteSale/updateSale transaction-boundary tests live as one `describe('useSales transactions')` block or three separate files.

### Deferred Ideas (OUT OF SCOPE)

- **Zod integration** — rejected for DATA-06. Today's surface is too narrow. Revisit if validation surface grows beyond ~6 keys.
- **Typed-key registry for validators** — less call-site code but harder to grep. Revisit if validator count grows.
- **Settings shape versioning** — formal `version` field per setting record is overkill at current scale.
- **`fake-indexeddb` integration + real-Dexie migration test** — Phase 23 TEST-04. Phase 20 stays at pure-helper fallback for migration tests.
- **Concurrent-tab automated test for `createQuote` no-collision** — needs real IDB; deferred to Phase 23. Phase 20 documents manual two-tab UAT.
- **`useDatabase.ts` decomposition** — Phase 22 territory.
- **Customer-UI tests** — Phase 23.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | `addSale` wraps `db.sales.add` + job `copiesSold` bump in a single `db.transaction('rw', db.sales, db.jobs, ...)` — matches Convert-to-Sale pattern. Closes CODE-AUDIT #4 (HIGH). | V2 quotes the exact Convert-to-Sale template at `JobsManager.tsx:1490`. V5 confirms no side effects in the body need to move out. |
| DATA-02 | `createQuote` reads `nextQuoteNumber` from `db.settings.get('userProfile')` INSIDE the transaction, not from the React state argument. Eliminates concurrent-tab quote-number collisions. Closes CODE-AUDIT #11 (MEDIUM). | V3 confirms the existing tx scope already includes `db.settings`; only the read site changes. Q2 confirms `tx.table('settings').get()` is awaitable. |
| DATA-03 | `backfillQuotesFromJobs` upgrade callback reads `currency` from the settings record inside the upgrade transaction; never hardcodes `'USD'`. Closes CODE-AUDIT #12 (MEDIUM). | V6 confirms the hardcode at `backfill.ts:232` (note: CONTEXT.md called out `database.ts:124` which is where the helper is *called*; the literal lives in `backfill.ts:232`). Part B v9 reconcile per standing rule. |
| DATA-04 | `parsePositiveNumber` accepts `0` only via opt-in `{ allowZero: true }`. Printer `wattage`/`purchasePrice` surface a validation error on `0`. Closes CODE-AUDIT #23 (LOW). | V1 audits all 9 call sites; CONTEXT.md table verified accurate. No 10th site. |
| DATA-05 | `versionchange` handler becomes `async () => { await db.close(); window.location.reload(); }`. Closes CODE-AUDIT #24 (LOW). | Dexie docs + community pattern confirm `db.close()` is the safe idiom. Plan-order note: DATA-05 must ship before/with DATA-03 v9 bump. |
| DATA-06 | `getSetting<T>` adds runtime schema validator at JSON-parse boundary. Falls back to `defaultValue` on structural mismatch. Closes CODE-AUDIT #25 (LOW). | Validator pattern is type-predicate based; six hand-rolled `is`-predicates, one per typed getter. |
</phase_requirements>

---

## Phase Summary

This is a hardening-only phase. Every multi-store Dexie mutation in `useDatabase.ts` and the v7→v8 / v8→v9 upgrade paths runs atomically; the `versionchange` handler closes the connection before reload; `getSetting<T>` validates the parsed JSON shape; `parsePositiveNumber` rejects `0` by default. No user-visible behavior changes.

The good news the planner needs to hear up-front: **all six requirements are surgical edits.** Three transactions to wrap (DATA-01), one tx-scoped read to add (DATA-02), one currency parameter to thread + one v9 reconcile to author (DATA-03), one helper signature to widen + 9 call sites to touch (DATA-04), one event handler to make async (DATA-05), one helper to accept an optional validator + six predicates to write (DATA-06). The Convert-to-Sale transaction at `JobsManager.tsx:1490` is a working, in-production template for DATA-01. The existing v8 upgrade callback at `database.ts:121-128` already uses the exact `async tx => { ... await tx.table(...) ... }` pattern that DATA-03 needs — confirming the Dexie 4 API surface is stable and available.

**Primary recommendation:** Plan the work in four plans matching the ROADMAP suggestion (20-01 addSale + delete/update transaction wrap; 20-02 createQuote tx-scoped read; 20-03 backfillQuotesFromJobs currency + v9 reconcile; 20-04 defensive trio). Ship 20-04 (versionchange + parsePositiveNumber + getSetting validator) **before or bundled with** 20-03 (v9 reconcile triggers `versionchange` in other tabs and the new async handler must be in place when it fires).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Atomic multi-store sale writes | Database / Storage | — | Sales + jobs persistence; runs in IndexedDB via Dexie transaction zone |
| Quote-number monotonic increment | Database / Storage | — | Settings record read+write must be tx-scoped; no client-side caching |
| Schema migration (v7→v8, v8→v9) | Database / Storage | — | Runs inside Dexie upgrade transaction; no UI/network access available |
| Settings JSON validation | Database / Storage | — | Boundary between persisted JSON and typed runtime objects; no UI involvement |
| `versionchange` cross-tab coordination | Browser / Client | Database / Storage | Browser event fires in tab; handler closes Dexie connection + triggers reload |
| CSV import number parsing | Browser / Client | — | Pure helper in import pipeline; no DB involvement |

All Phase 20 work concentrates in the Database/Storage tier. The only cross-tier capability is the `versionchange` reload (DATA-05), which couples a browser event to a Dexie close. No frontend-server, no API, no CDN — local-first, IndexedDB-only.

---

## Open Questions — Answers

### Q1. Does Dexie 4's `db.transaction('rw', ...)` accept a closure that returns a Promise from `db.jobs.put`?

**Answer: YES, confirmed by both official docs and the in-codebase working example.**

Dexie 4's transaction signature is `db.transaction(mode, ...tables, scopeFn)` where `scopeFn` is either a synchronous function returning a Promise OR a native `async` function. Operations like `db.jobs.put()` return Dexie Promises that resolve within the transaction zone.

**Confirming code excerpt — Convert-to-Sale (the template), `src/components/JobsManager.tsx:1490-1501`:**

```ts
await db.transaction('rw', db.sales, db.quotes, db.jobs, async () => {
  await db.sales.add(sale);
  await db.quotes.put(quotePatch);
  const jobRow = await db.jobs.get(sale.jobId);
  if (jobRow) {
    await db.jobs.put({
      ...jobRow,
      copiesSold: jobRow.copiesSold + sale.quantity,
      updatedAt: new Date(),
    });
  }
});
```

This pattern is already in production. The three DATA-01 mutations should mirror it verbatim.

**Two existing in-codebase callers also confirm the pattern works:** `useDatabase.ts:470` (copiesSold reconcile transaction) and `useDatabase.ts:520` (tag normalize reconcile transaction). Both have shipped and are running in production.

**Caveat — Dexie transaction zone rules** (from official docs, [Dexie.transaction()](https://dexie.org/docs/Dexie/Dexie.transaction())):

- Inside the scope function, **do not await any non-Dexie Promise** — calling a non-IDB-compatible Promise (e.g., `fetch`, `setTimeout`, `navigator.x`) loses the transaction zone and causes `PrematureCommitError` or `TransactionInactiveError`.
- All `db.X.Y()` calls return Dexie Promises that maintain the zone — these are safe.
- There is **no automatic retry** on transaction failure. A thrown error rolls back and propagates to the caller. (This matters for V5 below.)

[CITED: https://dexie.org/docs/Dexie/Dexie.transaction()]
[VERIFIED: codebase grep — `db.transaction(` appears at 4 in-production call sites with the exact `async () => { ... }` shape]

### Q2. Can `tx.table('settings').get('userProfile')` inside an upgrade callback be awaited safely?

**Answer: YES, confirmed by both official docs and the in-codebase v8 upgrade.**

Dexie 4 supports `async (tx) => { ... }` upgrade callbacks. Inside the callback you can call `await tx.table(name).X()` for any standard Dexie operation: `.get()`, `.put()`, `.toArray()`, `.bulkAdd()`, `.toCollection().modify()`. The upgrade runs inside its own Dexie transaction, so the same zone rules as `db.transaction()` apply.

**Confirming code excerpt — the existing v8 upgrade, `src/db/database.ts:121-128`:**

```ts
}).upgrade(async tx => {
  const jobs = await tx.table('jobs').toArray();
  const sales = await tx.table('sales').toArray();
  const quotes = backfillQuotesFromJobs(jobs, sales);
  if (quotes.length > 0) {
    await tx.table('quotes').bulkAdd(quotes);
  }
});
```

This is the exact pattern DATA-03 will extend. The DATA-03 forward fix adds **one line**:

```ts
}).upgrade(async tx => {
  const jobs = await tx.table('jobs').toArray();
  const sales = await tx.table('sales').toArray();
  const settingsRow = await tx.table('settings').get('userProfile');  // NEW
  const currency = settingsRow ? (JSON.parse(settingsRow.value) as UserProfile).currency : 'USD';  // NEW
  const quotes = backfillQuotesFromJobs(jobs, sales, currency);  // NEW signature
  if (quotes.length > 0) {
    await tx.table('quotes').bulkAdd(quotes);
  }
});
```

[CITED: https://dexie.org/docs/Version/Version.upgrade()]
[VERIFIED: codebase — `database.ts:121` already ships async upgrade callback with `await tx.table(...)` in production since Phase 16]

**Historical caveat (no longer applies):** [Dexie issue #612](https://github.com/dexie/Dexie.js/issues/612) (2017) reported async upgrade handlers running interleaved across version bumps. This bug predates Dexie 3 and is not reproducible in Dexie 4.2.1 (our pinned version) — the existing v8 upgrade is empirical evidence. Researcher recommends keeping the v9 upgrade independent of any other version-bump callback to avoid edge cases where multiple upgrades chain on a fresh-install device.

### Q3. Is there a Dexie idiom for "run upgrade callback only when X condition" so the v9 reconcile is a no-op when not needed?

**Answer: NO — the no-op guard is implemented inside the callback body.**

Dexie has no declarative "skip if" hook. The upgrade callback runs unconditionally whenever Dexie opens a database whose stored version is below the schema's declared version. The idiomatic pattern is to make the callback **idempotent by construction** so that a no-op case pays only the cost of the scan.

**Recommended v9 callback shape:**

```ts
db.version(9).stores({ /* same as v8 */ }).upgrade(async tx => {
  const settingsRow = await tx.table('settings').get('userProfile');
  if (!settingsRow) return;  // brand-new device → no quotes to reconcile

  let userCurrency: string;
  try {
    userCurrency = (JSON.parse(settingsRow.value) as UserProfile).currency;
  } catch {
    return;  // corrupt settings → bail out silently, won't make it worse
  }

  if (userCurrency === 'USD') return;  // no drift possible

  const quotes = await tx.table('quotes').toArray();
  const stale = quotes.filter(q => q.lineItemsSnapshot?.currency === 'USD');
  if (stale.length === 0) return;  // already reconciled or no USD-stamped quotes

  // Patch in place — bulkPut maintains transaction zone.
  const patched = stale.map(q => ({
    ...q,
    lineItemsSnapshot: { ...q.lineItemsSnapshot, currency: userCurrency },
  }));
  await tx.table('quotes').bulkPut(patched);

  if (import.meta.env.DEV) {
    console.info(`[v9 reconcile] patched ${patched.length} quotes from USD → ${userCurrency}`);
  }
});
```

**Three layers of no-op protection** mean a fresh-install user, a USD user, or a returning user pays only one tx settings read + one quotes scan. Idempotent on re-run (the second run finds zero stale rows).

[ASSUMED] The exact `lineItemsSnapshot.currency === 'USD'` filter is a researcher recommendation — the planner should confirm this matches the locked behavior. Alternative: filter on quotes whose `createdAt` predates a specific date (less precise but doesn't rely on the snapshot shape).

---

## Validation Findings

### V1. parsePositiveNumber call-site audit — actual file vs. CONTEXT.md table

**Result: CONTEXT.md table is ACCURATE. No drift. No 10th site missed.**

Direct grep against `src/utils/csvHelpers.ts`:

```
213:    const purchasePrice = parsePositiveNumber(row.purchaseprice);
214:    const wattage = parsePositiveNumber(row.wattage);
229:    const lifespan = parsePositiveNumber(row.expectedlifespanhours);
232:    const nozzleCost = parsePositiveNumber(row.nozzlecost);
235:    const nozzleLifespan = parsePositiveNumber(row.nozzlelifespancm3);
241:    const packageCost = parsePositiveNumber(row.packagecost);
242:    const unitsPerPackage = parsePositiveNumber(row.unitsperpackage);
268:    const lifespan = parsePositiveNumber(row.lifespanunits);
398:function parsePositiveNumber(value: string | undefined): number | null {
```

8 call sites + 1 definition = 9 lines mentioning the name. The CONTEXT.md table lists 8 call sites; the "9 sites" wording in the CONTEXT.md prose refers to grep matches including the definition. The CONTEXT.md table is correct.

**Confirmed call-site → allowZero mapping:**

| Line | Field | allowZero? | Why |
|------|-------|------------|-----|
| 213 | `purchasePrice` | no | Printer with $0 cost is nonsense data |
| 214 | `wattage` | no | Wattage 0 silently zeros electricity cost (CODE-AUDIT #23 trigger) |
| 229 | `expectedLifespanHours` | no | Lifespan 0 makes amortization NaN |
| 232 | `nozzleCost` | no | $0 nozzle replacement is nonsense |
| 235 | `nozzleLifespanCm3` | no | Lifespan 0 → divide-by-zero |
| 241 | `packageCost` | **yes** | Free packaging is real (e.g., recycled boxes, freebie samples) |
| 242 | `unitsPerPackage` | no | Already has secondary `<= 0` guard at line 256; opt-in or not, the downstream guard catches it. Safe either way; CONTEXT.md says no |
| 268 | `lifespan` (material) | no | Material lifespan 0 → divide-by-zero in nozzle wear calc |

**Important observation — line 256 already has a secondary guard:**

```ts
if (unitsPerPackage === null || unitsPerPackage <= 0) {
  errors.push('Units per package must be greater than zero');
}
```

This pre-existing guard catches `0` for `unitsPerPackage` regardless of whether `parsePositiveNumber` rejects it. The DATA-04 fix removes the *need* for the secondary guard at line 256 but doesn't require removing it. The planner can decide:

- **Conservative (researcher recommends):** Keep the line 256 guard. The error message is more user-friendly than `null` returning silently. The function `parsePositiveNumber` returning `null` already triggers the same code path.
- **Aggressive:** Remove the line 256 guard. Saves 2 lines. Risk: any future call site that fails to follow up `parsePositiveNumber` with a `null` check loses the guard.

[VERIFIED: direct file grep on `src/utils/csvHelpers.ts` 2026-05-26]

### V2. Convert-to-Sale transaction template — exact signature for planner mirroring

**Result: Template confirmed at `JobsManager.tsx:1490-1501`.** CONTEXT.md description matches exactly.

Exact signature from current source (verbatim):

```ts
await db.transaction('rw', db.sales, db.quotes, db.jobs, async () => {
  await db.sales.add(sale);
  await db.quotes.put(quotePatch);
  const jobRow = await db.jobs.get(sale.jobId);
  if (jobRow) {
    await db.jobs.put({
      ...jobRow,
      copiesSold: jobRow.copiesSold + sale.quantity,
      updatedAt: new Date(),
    });
  }
});
```

**Specialized templates for DATA-01:**

DATA-01 only touches `db.sales` and `db.jobs` (no `db.quotes`). The mirror is:

```ts
// addSale — currently useDatabase.ts:572-583
const addSale = useCallback(async (sale: Sale) => {
  await db.transaction('rw', db.sales, db.jobs, async () => {
    await db.sales.add(sale);
    const job = await db.jobs.get(sale.jobId);
    if (job) {
      await db.jobs.put({
        ...job,
        copiesSold: job.copiesSold + sale.quantity,
        updatedAt: new Date(),
      });
    }
  });
}, []);

// deleteSale — currently useDatabase.ts:585-596
const deleteSale = useCallback(async (sale: Sale) => {
  await db.transaction('rw', db.sales, db.jobs, async () => {
    await db.sales.delete(sale.id);
    const job = await db.jobs.get(sale.jobId);
    if (job) {
      await db.jobs.put({
        ...job,
        copiesSold: Math.max(0, job.copiesSold - sale.quantity),
        updatedAt: new Date(),
      });
    }
  });
}, []);

// updateSale — currently useDatabase.ts:601-615
const updateSale = useCallback(async (updated: Sale) => {
  await db.transaction('rw', db.sales, db.jobs, async () => {
    const previous = await db.sales.get(updated.id);
    await db.sales.put(updated);
    if (previous && previous.quantity !== updated.quantity) {
      const job = await db.jobs.get(updated.jobId);
      if (job) {
        const delta = updated.quantity - previous.quantity;
        await db.jobs.put({
          ...job,
          copiesSold: Math.max(0, job.copiesSold + delta),
          updatedAt: new Date(),
        });
      }
    }
  });
}, []);
```

These are drop-in replacements — same external signature, same behavior on success, atomic on failure.

[VERIFIED: source read on `src/hooks/useDatabase.ts` and `src/components/JobsManager.tsx`]

### V3. `createQuote` already-transactional confirmation

**Result: CONFIRMED.** `createQuote` already opens `db.transaction('rw', db.quotes, db.customers, db.settings, ...)`. The bug is precisely as CONTEXT.md describes: `nextQuoteNumber` is read from `input.userProfile` (React state) at line 843, **before** the transaction opens. The transaction body at line 893 then writes back `nextNum + 1` via `setUserProfile`, but two tabs reading the same React snapshot will both compute the same `nextNum` and write the same `quoteNumber`.

**Exact current bug line — `src/hooks/useDatabase.ts:843`:**

```ts
const nextNum = userProfile.nextQuoteNumber ?? 1;  // ← read from React state, OUTSIDE tx
```

**Required fix (move read INSIDE the tx body, line 893):**

```ts
await db.transaction('rw', db.quotes, db.customers, db.settings, async () => {
  // Read authoritative nextQuoteNumber from tx-scoped settings snapshot.
  const settingsRow = await tx.table('settings').get('userProfile');
  // ^ NOTE: the existing tx scope function takes no parameter; researcher recommends
  // refactoring to `async (tx) => { ... }` to receive the Transaction.
  // Alternative: use `db.settings.get('userProfile')` — Dexie's transaction zone
  // routes this through the open tx. Both work; explicit tx is more readable.

  let nextNum = 1;
  if (settingsRow) {
    try {
      nextNum = (JSON.parse(settingsRow.value) as UserProfile).nextQuoteNumber ?? 1;
    } catch {
      // Corrupt settings — fall through to nextNum = 1. Will be re-stamped on write.
    }
  }

  // ... existing customer auto-create / put logic ...
  // ... build quotePayload with quoteNumber: nextNum ...
  await db.quotes.add(quotePayload);
  await setUserProfile({ ...userProfile, nextQuoteNumber: nextNum + 1 });
});
```

**Important nuance** — the existing tx body uses `setUserProfile(...)` which calls `db.settings.put(...)` under the hood. The React `userProfile` state is still used for the OTHER fields written back (currency, defaultTaxRate, defaultTerms, address). Only `nextQuoteNumber` needs the tx-scoped read.

**Compile-time risk:** the existing arrow function at line 893 is `async () => { ... }` (no `tx` param). The fix changes it to `async (tx) => { ... }`. This is a one-line signature change with no other call sites affected.

[VERIFIED: source read `useDatabase.ts:841-907`]

### V4. Dexie version pinned in `package.json`

**Result: `"dexie": "^4.2.1"`, `"dexie-react-hooks": "^4.2.0"`.**

Excerpt from `package.json:25-26`:

```json
"dexie": "^4.2.1",
"dexie-react-hooks": "^4.2.0",
```

**API surface used in Phase 20** (all confirmed stable in Dexie 4.x):

| API | First documented | Stable in 4.2 | In-codebase usage |
|-----|------------------|---------------|-------------------|
| `db.transaction(mode, ...tables, scopeFn)` | Dexie 1.x | YES | Convert-to-Sale @ JobsManager.tsx:1490; reconcile @ useDatabase.ts:470, 520, 893 |
| `tx.table(name).get(key)` (inside upgrade async callback) | Dexie 1.4 (async support) | YES | v8 upgrade @ database.ts:121-128 (.toArray pattern) |
| `db.version(n).stores({...}).upgrade(async tx => {...})` | Dexie 1.4 | YES | v5, v6, v8 upgrades @ database.ts |
| `db.on('versionchange', handler)` | Dexie 1.x | YES | Current handler @ database.ts:133 |
| `db.close()` | Dexie 1.x | YES | Not currently used in codebase (DATA-05 adds it) |

[VERIFIED: `package.json:25-26`, Dexie official docs, in-codebase callers]

### V5. Side effects in `addSale` / `deleteSale` / `updateSale` bodies

**Result: NONE. The three mutations are pure DB calls — no analytics, telemetry, hook callbacks, or console logs inside the bodies.**

Direct grep on `src/hooks/useDatabase.ts` for `console`, `analytic`, `telemetry`, `toast`:

```
68:        console.error('Error initializing assets:', error);
482:        console.error('copiesSold reconcile failed:', err);
527:        console.error('tag normalize reconcile failed:', err);
673:        console.error('Sale→Customer backfill (D-32) failed:', err);
```

All four matches are in unrelated init/reconcile paths, NOT inside `addSale`/`deleteSale`/`updateSale`. The three sale mutation bodies (lines 572-615) contain only:

- `db.sales.add` / `delete` / `put`
- `db.sales.get` (updateSale only)
- `db.jobs.get` / `put`
- Spread / arithmetic

**Why this matters:** Dexie has **no automatic retry** on transaction failure (confirmed by [Dexie.transaction docs](https://dexie.org/docs/Dexie/Dexie.transaction())). The planner does not need to worry about side effects being replayed. If the planner adds a `console.warn` or `toast` for UAT debugging, it should sit OUTSIDE the transaction body — but currently nothing needs to move.

[VERIFIED: direct grep + line-by-line read of useDatabase.ts:572-615]

### V6. v7→v8 upgrade `backfillQuotesFromJobs` wrapping + hardcoded USD location

**Result: The upgrade callback IS wrapped (it runs inside Dexie's upgrade transaction). The `'USD'` literal lives at `src/db/backfill.ts:232`, not `database.ts:124`.**

**Upgrade callback location — `src/db/database.ts:121-128`:**

```ts
}).upgrade(async tx => {
  const jobs = await tx.table('jobs').toArray();
  const sales = await tx.table('sales').toArray();
  const quotes = backfillQuotesFromJobs(jobs, sales);
  if (quotes.length > 0) {
    await tx.table('quotes').bulkAdd(quotes);
  }
});
```

The `await tx.table('quotes').bulkAdd(quotes)` write IS inside the Dexie upgrade transaction — atomic by construction. If the user closes the tab mid-upgrade, Dexie rolls back the bulkAdd and the v8 schema stays unapplied; the next open retries cleanly.

**Hardcoded `'USD'` location — `src/db/backfill.ts:232`:**

```ts
lineItemsSnapshot: {
  jobTitle: job.name,
  sellingPrice: job.sellingPrice ?? 0,
  shippingCost: 0,
  resolvedTaxRate: job.taxRate ?? 0,
  taxAmount: job.taxAmount ?? 0,
  // Currency sentinel — migration runs without UserProfile access. See module JSDoc.
  currency: 'USD',  // ← LINE 232
  notes: job.notes ?? '',
  // ...
}
```

The CONTEXT.md said "L124" but that refers to where `backfillQuotesFromJobs` is *called* from `database.ts`. The literal itself is in `backfill.ts:232`. The fix flows through both files:

1. Change `backfillQuotesFromJobs` signature in `src/db/backfill.ts` to accept `currency: string` as a third parameter; replace `currency: 'USD'` at line 232 with `currency`.
2. Read `currency` in the v8 upgrade callback in `src/db/database.ts:121-128` via `await tx.table('settings').get('userProfile')` + JSON parse; pass it to the helper call at line 124.
3. **Decision the planner must lock:** what happens if `settingsRow` is undefined (brand-new install)? The settings record only exists after `useUserProfile()` has run once. A new user opening v8 for the first time may have **no** settings record at all. The safe default is `'USD'` (matches current behavior). This makes the forward fix a no-op for new users — which is correct, because new users have no pre-v1.2 PrintJob.quoteNumber rows to backfill anyway.

[VERIFIED: direct read of `database.ts:121-128` and `backfill.ts:225-237`]

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest@^4.1.4` ([package.json:61](package.json:61)) with `@vitest/coverage-v8@^4.1.4` |
| Config file | `vitest.config.ts` |
| Environment | `jsdom` (no IndexedDB; pure-helper fallback pattern in use) |
| Quick run command | `npx vitest run src/db/ src/utils/csvHelpers` |
| Full suite command | `npm test` (= `vitest run`) |
| Build chain | `npm run build` runs `vitest run --coverage` before `tsc -b && vite build` |

### Phase 20 Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? | Phase Scope |
|--------|----------|-----------|-------------------|--------------|-------------|
| DATA-01 (a) | `addSale` rolls back sale row if jobs.put throws mid-tx | unit (mocked Dexie) | `npx vitest run src/hooks/useDatabase.test.ts -t "addSale rolls back"` | ❌ Wave 0 — new file `src/hooks/useDatabase.test.ts` | **Phase 20** |
| DATA-01 (b) | `deleteSale` rolls back sale row if jobs.put throws mid-tx | unit (mocked Dexie) | `npx vitest run src/hooks/useDatabase.test.ts -t "deleteSale rolls back"` | ❌ Wave 0 — same file as above | **Phase 20** |
| DATA-01 (c) | `updateSale` rolls back sale row if jobs.put throws mid-tx | unit (mocked Dexie) | `npx vitest run src/hooks/useDatabase.test.ts -t "updateSale rolls back"` | ❌ Wave 0 — same file | **Phase 20** |
| DATA-02 (auto) | `createQuote` reads `nextQuoteNumber` from settings inside tx — verified via mocked Dexie or by asserting `tx.table('settings').get` is called before `db.quotes.add` | unit (mocked Dexie) | `npx vitest run src/hooks/useDatabase.test.ts -t "createQuote tx-scoped read"` | ❌ Wave 0 — same file | **Phase 20** |
| DATA-02 (manual) | Two near-simultaneous `createQuote` calls in two tabs produce distinct quote numbers | manual UAT (no real IDB in jsdom) | — | — UAT script in plan | **Phase 20** (UAT) + **Phase 23** (real-IDB automated test via TEST-04) |
| DATA-03 (a) | `backfillQuotesFromJobs(jobs, sales, currency)` propagates currency to `lineItemsSnapshot.currency` | unit | `npx vitest run src/db/backfill.test.ts -t "currency parameter"` | ✅ extend existing `src/db/backfill.test.ts` | **Phase 20** |
| DATA-03 (b) | v8 upgrade callback reads currency from settings and passes it to helper | unit (pure-helper fallback) | `npx vitest run src/db/database.migrations.test.ts -t "v8 currency"` | ✅ extend existing | **Phase 20** |
| DATA-03 (c) | v9 reconcile is idempotent: rerunning the pure helper on already-reconciled quotes returns 0 patches | unit (pure helper) | `npx vitest run src/db/backfill.test.ts -t "v9 reconcile idempotent"` | ❌ Wave 0 — new pure helper `reconcileQuoteCurrency` in `src/db/backfill.ts` | **Phase 20** |
| DATA-03 (d) | Real-Dexie v9 upgrade test (open v8 fixture, reopen at v9, assert quotes patched) | integration (real Dexie) | — needs `fake-indexeddb` | — Wave 0 | **Phase 23 TEST-04** (deferred) |
| DATA-04 (a) | `parsePositiveNumber('0')` returns `null` (default) | unit | `npx vitest run src/utils/csvHelpers.test.ts -t "rejects 0"` | ❌ Wave 0 — new file `src/utils/csvHelpers.test.ts` | **Phase 20** |
| DATA-04 (b) | `parsePositiveNumber('0', { allowZero: true })` returns `0` | unit | `npx vitest run src/utils/csvHelpers.test.ts -t "allows 0 opt-in"` | ❌ same as above | **Phase 20** |
| DATA-04 (c) | All 9 call sites compile (TS will verify) | type-check | `tsc -b` (already in build chain) | ✅ build chain | **Phase 20** |
| DATA-05 (a) | `versionchange` handler awaits `db.close()` before reload | unit | `npx vitest run src/db/database.test.ts -t "versionchange awaits close"` | ❌ Wave 0 — new `src/db/database.test.ts` (small surface, can co-locate with migrations test) | **Phase 20** |
| DATA-05 (b) | Cross-tab reload works in real browser (no aborted-tx warnings in console) | manual UAT | — | — UAT script in plan | **Phase 20 UAT** |
| DATA-06 (a) | `getSetting('foo', defaultValue, validator)` returns `defaultValue` if stored JSON fails validator | unit | `npx vitest run src/db/database.test.ts -t "getSetting validator rejects malformed shape"` | ❌ Wave 0 — co-located | **Phase 20** |
| DATA-06 (b) | Each of 6 hand-rolled `is`-predicates correctly identifies its shape | unit | `npx vitest run src/db/database.test.ts -t "isPrinterConfig|isElectricityConfig|..."` | ❌ Wave 0 — co-located | **Phase 20** |
| DATA-06 (c) | `console.warn` fires in dev when validator rejects; silent in prod | unit (mock `import.meta.env.DEV`) | `npx vitest run src/db/database.test.ts -t "validator warns in dev"` | ❌ Wave 0 — co-located | **Phase 20** |

### Sampling Rate

- **Per task commit:** `npx vitest run src/db src/utils/csvHelpers src/hooks/useDatabase` (scoped to changed files)
- **Per wave merge:** `npm test` (full Vitest suite)
- **Phase gate:** Full suite green + `npm run build` exits 0 before `/gsd:verify-work`

### Wave 0 Gaps

The following test files must be authored before any task ships its implementation:

- [ ] `src/hooks/useDatabase.test.ts` — covers DATA-01 (3 mutations) + DATA-02 tx-scoped read. **New file.**
- [ ] `src/utils/csvHelpers.test.ts` — covers DATA-04 `parsePositiveNumber` default vs. `{ allowZero: true }`. **New file.** (Phase 21 SEC will ALSO add to this file — coordinate with phase ordering.)
- [ ] `src/db/database.test.ts` — covers DATA-05 versionchange handler + DATA-06 `getSetting` validator + 6 `is`-predicates. **New file.** (Small surface; do not stuff into migrations test.)
- [ ] Extend `src/db/backfill.test.ts` — add tests for DATA-03 currency parameter + v9 reconcile pure helper. **Existing file, extend.**
- [ ] Extend `src/db/database.migrations.test.ts` — add v8 currency-flowthrough fixture. **Existing file, extend.**

**Mocking Dexie:** The DATA-01/02 transaction-boundary tests need a way to simulate "jobs.put throws mid-tx" so the test asserts the sale row was rolled back. Two viable approaches:

1. **Mock `db.jobs.put` via Vitest spy** — `vi.spyOn(db.jobs, 'put').mockRejectedValueOnce(new Error('simulated'))`. Dexie still rolls back because the throw propagates out of the scope function. Verify: after the call rejects, `await db.sales.get(saleId)` returns undefined.
2. **Use Dexie's `tx.abort()`** — explicit abort inside the test's `db.transaction` call. Less realistic but cleaner. Researcher recommends approach (1) — closer to the real failure mode.

[ASSUMED] The Vitest-spy approach has not been verified empirically in this codebase. The planner should treat this as a Wave 0 risk: the first DATA-01 test must prove the rollback assertion works against jsdom before the rest of the test plan locks in.

---

## Implementation Notes per Requirement

### DATA-01 — Three sale mutations transactional

**Files:** `src/hooks/useDatabase.ts:572-615`
**Pattern source:** `src/components/JobsManager.tsx:1490-1501` (Convert-to-Sale)
**Transaction shape:** `db.transaction('rw', db.sales, db.jobs, async () => { ... })`
**Tables touched:** `db.sales`, `db.jobs` (no quotes — that's Convert-to-Sale only)
**Landmines:**
- The `reconcileCopiesSoldFromSales` self-healing path at `useDatabase.ts:458-488` will hide rollback bugs by reconciling on the next page load. Tests must assert the rollback BEFORE the reconcile runs, i.e., immediately after the failed transaction returns.
- `useLiveQuery` consumers (`useSales`, `useJobs`) auto-re-emit when sales/jobs change. A failed tx → no emission. A partially-applied tx → two emissions. Tests assert emission count = 0 (or = 1 on success), not arbitrary state.
- Convert-to-Sale at `JobsManager.tsx:1505` already calls `addSale(sale)` in the non-conversion branch. Wrapping `addSale` does NOT break this — the outer call still gets the same Promise back.

**Code excerpts:** see V2 above.

### DATA-02 — `createQuote` tx-scoped settings read

**File:** `src/hooks/useDatabase.ts:841-907`
**Transaction shape:** existing `db.transaction('rw', db.quotes, db.customers, db.settings, async (tx) => { ... })` — adding `tx` parameter to scope function
**Tables touched:** unchanged (`quotes`, `customers`, `settings`)
**Landmines:**
- The current scope function is `async () => { ... }` (no `tx` arg). Changing to `async (tx) => { ... }` is a 1-character edit. Alternative: skip the tx parameter and use `db.settings.get('userProfile')` — Dexie's transaction zone routes this through the open tx. **Researcher recommends the explicit `tx` param** for readability and to make the test assertion (spy on `tx.table('settings').get`) cleaner.
- `setUserProfile(...)` at line 903 is a top-level helper that calls `db.settings.put` internally. It WILL participate in the open transaction zone (no change needed). Do not refactor it to `tx.table('settings').put(...)` unless you also lift the JSON.stringify into the tx body — it's marginal cleanup not in scope.
- The React `userProfile` argument is STILL the source of truth for `currency`, `defaultTaxRate`, `defaultTerms`, `address`, `defaultProfitMargin`. Only `nextQuoteNumber` changes source.

**Code excerpt:** see V3 above.

### DATA-03 — Backfill currency + v9 reconcile

**Files:**
- `src/db/backfill.ts:187-249` (`backfillQuotesFromJobs` signature widens to accept `currency: string`)
- `src/db/backfill.ts:232` (literal `'USD'` replaced with `currency` parameter)
- `src/db/database.ts:121-128` (v8 upgrade reads settings, passes currency to helper)
- `src/db/database.ts` (NEW v9 schema + upgrade callback after current line 128)
- `src/db/backfill.ts` (NEW pure helper `reconcileQuoteCurrency(quotes, currency): Quote[]` for v9 testability)

**Transaction shape:**
- v8 fix: existing async upgrade callback gains one read + one parameter pass
- v9 new: `db.version(9).stores({ /* unchanged */ }).upgrade(async tx => { /* see Q3 answer */ })`

**Tables touched:** v8 reads `settings`; v9 reads `settings` + `quotes`, writes `quotes`.

**Plan-order dependency:** **DATA-05 (versionchange handler) must ship before or with this DATA-03 v9 bump.** When a user opens v9 in one tab, every OTHER tab fires `versionchange`. Without the async-close handler, those tabs reload mid-write. Bundle DATA-03 + DATA-05 in plan 20-04 OR ship DATA-05 first in 20-04 then DATA-03 in 20-03 with a hard wait-for-merge marker.

**Landmines:**
- The v8 currency fix only affects users who run the v7→v8 upgrade AFTER this Phase 20 ships. Users who already migrated to v8 with the USD hardcode (between Phase 16 ship and Phase 20 ship) need the v9 reconcile.
- Brand-new installs have NO `settings` record on first open of v9. The v9 callback handles this via the `if (!settingsRow) return;` early-out. No reconcile happens, no error thrown.
- The v9 schema stanza must be IDENTICAL to v8 (same table list, same indices). Only the version number changes and a new `.upgrade(async tx => { /* reconcile */ })` attaches.
- The reconcile pure helper `reconcileQuoteCurrency` should be in `src/db/backfill.ts` next to `backfillQuotesFromJobs` — keeps the migration-test pattern consistent.
- `[[feedback_reconcile_legacy_data]]` standing rule applies: **the planner MUST include Part B (v9 reconcile)** alongside Part A (forward fix). Do not let the planner ship "just the forward fix and call DATA-03 done."

**Code excerpt:** see Q3 above.

### DATA-04 — `parsePositiveNumber` allowZero opt-in

**File:** `src/utils/csvHelpers.ts:398-403` (definition) + 8 call sites at lines 213, 214, 229, 232, 235, 241, 242, 268
**Transaction shape:** N/A (pure helper)
**Landmines:**
- The 8th call site (line 268, material lifespan) is in the material branch, NOT the printer branch. Easy to miss when scanning the file top-to-bottom.
- `unitsPerPackage` at line 242 has a redundant `<= 0` guard at line 256. See V1 for the conservative-vs-aggressive cleanup decision.
- The audit table in CONTEXT.md says line 241 is `packageCost` — confirmed in the file. The `{ allowZero: true }` opt-in is ONLY for line 241.

**Signature:**
```ts
function parsePositiveNumber(
  value: string | undefined,
  opts?: { allowZero?: boolean },
): number | null {
  if (!value?.trim()) return null;
  const num = Number(value.trim());
  if (isNaN(num)) return null;
  if (opts?.allowZero ? num < 0 : num <= 0) return null;
  return num;
}
```

### DATA-05 — Async versionchange handler

**File:** `src/db/database.ts:133`
**Current:** `db.on('versionchange', () => { window.location.reload(); });`
**Replacement:**
```ts
db.on('versionchange', async () => {
  await db.close();
  window.location.reload();
});
```

**Landmines:**
- Returning `false` from a `versionchange` handler suppresses Dexie's default close behavior. The current handler implicitly returns `undefined`. The async handler returns a Promise<void> which Dexie ignores. **This is correct** — we WANT the default close behavior plus the explicit close-then-reload sequence.
- `db.close()` is synchronous-Promise (resolves on next microtask). The `await` is short. The `window.location.reload()` happens once the close resolves.
- This handler must ship BEFORE or WITH any new schema version (DATA-03 v9). See DATA-03 landmine note.

### DATA-06 — getSetting validator + 6 hand-rolled predicates

**File:** `src/db/database.ts:138-208`
**Replacement for `getSetting<T>`:**
```ts
export async function getSetting<T>(
  key: string,
  defaultValue: T,
  validator?: (parsed: unknown) => parsed is T,
): Promise<T> {
  const setting = await db.settings.get(key);
  if (!setting) return defaultValue;
  try {
    const parsed = JSON.parse(setting.value);
    if (validator && !validator(parsed)) {
      if (import.meta.env.DEV) {
        console.warn(`[getSetting] validator rejected stored "${key}"; using default`);
      }
      return defaultValue;
    }
    return parsed as T;
  } catch {
    return defaultValue;
  }
}
```

**Six predicates to author** (each ~5 lines, co-located with the getter):

- `isPrinterConfig(x: unknown): x is PrinterConfig` — checks `typeof x === 'object'`, has string `id`, string `name`, numeric `purchasePrice`, etc.
- `isElectricityConfig(x: unknown): x is ElectricityConfig` — has numeric `costPerKwh`.
- `isLaborConfig(x: unknown): x is LaborConfig` — has numeric `hourlyRate`.
- `isUserProfile(x: unknown): x is UserProfile` — has string `currency`, numeric `laborHourlyRate`, optional fields all `unknown`-typed.
- `isShippingConfig(x: unknown): x is ShippingConfig` — has numeric `maxDeliveryRadiusKm`, etc.
- `isMarketplaceFees(x: unknown): x is MarketplaceFees` — has the union of fields from the `defaultMarketplaceFees` snapshot.

**Landmines:**
- The `Currency` union type is a runtime-unknown string. The predicate should accept ANY string for `currency` — narrowing to the 18 valid currencies would reject any future addition to the union and crash old settings. **Be loose with string fields, strict with numeric fields.**
- `address` on `UserProfile` is optional and an object. Predicate should accept `undefined` OR an object with optional string fields.
- The fall-through `defaultValue` return is critical — every existing call site already has a `?? default` chain expecting a valid object. The validator never returns `undefined` or throws.

[ASSUMED] The six predicates are researcher-recommended shapes. The planner should treat each as a small Wave 0 task with its own test — six `expect(isFoo({...})).toBe(true)` + six `expect(isFoo({broken: 'shape'})).toBe(false)`.

---

## Dependencies & Plan Order Sensitivity

**Hard constraint:** DATA-05 (versionchange async close) MUST ship before or with DATA-03 (v9 schema bump). When v9 lands, every other open tab fires `versionchange` and reloads. Without the async-close handler, in-flight transactions in those tabs are aborted mid-write.

**Recommended plan order (4 plans, matches ROADMAP):**

| Plan | Closes | Notes |
|------|--------|-------|
| 20-01 | DATA-01 | Three sale mutations transactional + new test file. Independent. |
| 20-02 | DATA-02 | createQuote tx-scoped read + new test + manual two-tab UAT documented. Independent. |
| 20-04 | DATA-05, DATA-04, DATA-06 | "Defensive trio" — async versionchange handler + parsePositiveNumber opt-in + getSetting validator. **Must merge before or with 20-03.** |
| 20-03 | DATA-03 | Backfill currency forward fix + v9 reconcile pure helper + v9 schema bump + extended migration test. Hard-depends on 20-04 being merged first. |

**Why not bundle 20-04 and 20-03 into a single plan?** Because 20-04 has three independent defensive items that don't share files with 20-03 — keeping them separate makes review smaller and reverts surgical. The hard dependency is captured by the plan-order in the phase doc.

**Alternative — bundle for solo-dev velocity:** Combine 20-03 and 20-04 into one plan (defensive + reconcile together). Acceptable; researcher's recommendation is the 4-plan split for review hygiene.

**Plans 20-01 and 20-02 are fully independent** — they touch only `useDatabase.ts` and a new test file. They can ship in either order, in parallel, or together.

---

## Risks & Landmines

### R1. jsdom does not implement IndexedDB

**Impact:** Phase 20 cannot run real-Dexie integration tests. The DATA-01 transaction rollback test, the DATA-02 two-tab collision test, and the v9 reconcile end-to-end test all need real IDB.

**Mitigation:** Pure-helper fallback (the same pattern used in `database.migrations.test.ts`) covers DATA-03 helper + v9 reconcile helper. Transaction-boundary tests for DATA-01/02 use Vitest spies on `db.jobs.put` to simulate mid-tx throw. Concurrent-tab test for DATA-02 is documented as manual UAT in the plan and deferred to Phase 23 TEST-04 for automation. **CONTEXT.md already locks this trade-off** — researcher concurs.

[ASSUMED] The Vitest spy approach works against the Dexie zone — the planner should treat the first DATA-01 test as Wave 0 risk-validation. If spies leak across the transaction zone, fallback to "test the read-then-write sequence in isolation" without claiming atomicity coverage.

### R2. Dexie automatic transaction retry — does NOT exist

**Impact:** Some IndexedDB libraries (e.g., idb-keyval, raw IDB callbacks) silently retry on transient errors. Side effects (analytics, console logs, network calls) inside the tx body would replay.

**Confirmed via [Dexie docs](https://dexie.org/docs/Dexie/Dexie.transaction()):** Dexie has NO automatic retry. A thrown error rolls back the transaction and propagates to the caller. The caller MAY catch and retry, but Dexie itself never does.

**Why this matters for Phase 20:** The planner does not need to design "side-effect safety" into the new transaction bodies. V5 above confirms there are no side effects to worry about anyway. If a future task adds `console.warn(...)` inside an `addSale` tx body, the warn would fire ONCE on the rollback path — fine.

### R3. Upgrade callback gotchas (Dexie 4)

**Cross-version interleaving** ([issue #612](https://github.com/dexie/Dexie.js/issues/612), Dexie 2017): historical bug where async upgrade callbacks from versions 2, 3, 4, ... ran in parallel on the same transaction. Not reproducible in Dexie 4.2.1 — the existing v8 upgrade ships in production.

**One-shot semantics:** Each upgrade callback runs ONCE per device when the user first opens the new version. There is no re-run. The v9 reconcile must be idempotent BY CONSTRUCTION (early-outs at every step) so that if it failed mid-write and the user reopens v9, the second open's no-write upgrade still leaves the system in a valid state.

**No conditional skip:** Dexie has no "run upgrade only if X" hook. The callback runs unconditionally; the no-op shape is inside the body (see Q3).

**No UserProfile React access:** The upgrade transaction runs at `db.open()` time, before any React component has mounted. Settings must come from `tx.table('settings').get('userProfile')`, not from a hook.

### R4. The `useLiveQuery` cache and partial-write phantom emissions

**Currently:** When `addSale` writes to `db.sales`, `useLiveQuery(() => db.sales.toArray())` re-emits. When it writes to `db.jobs`, the jobs liveQuery also re-emits. With the current non-atomic shape, a tab crash between writes produces a half-state visible in the UI (Sale row exists, copiesSold stale).

**After Phase 20:** The transaction commits as a single atomic IDB unit. liveQuery emits ONCE per successful commit — both `db.sales` and `db.jobs` consumers re-render together. On a rollback, ZERO emissions fire. This is a UX win, not a regression: the inconsistent intermediate state stops existing.

**Test implication:** Tests should NOT assert "exactly N emissions" because liveQuery batching/coalescing can vary. Tests assert FINAL state after the await resolves OR rejects.

### R5. `parsePositiveNumber` cross-cutting with Phase 21 SEC

Phase 21 (CSV + URL security) will add `customerCsv.test.ts` formula-injection cases AND will likely co-locate the new `csvHelpers.test.ts` file for `sanitizeCsvCell`. If Phase 20 creates `src/utils/csvHelpers.test.ts` for `parsePositiveNumber`, Phase 21 just adds describe blocks to the same file. Coordinate: Phase 20 ships first → Phase 21 extends. Or Phase 20 leaves `parsePositiveNumber` tests at a `describe('parsePositiveNumber')` block inside an existing test file (`csvHelpers.test.ts` is fine even if empty — author it during Wave 0).

### R6. Phase 23 TEST-04 hard-couples to Phase 20 DATA-03

The v9 reconcile is the FIRST real customer for the `fake-indexeddb` integration that TEST-04 ships. Phase 23 will reopen a v8 fixture, run the v9 migration, and assert quotes are patched. The Phase 20 plan should leave a comment/breadcrumb in the v9 upgrade callback so Phase 23's test author knows where to plug in.

[ASSUMED] Phase 23 has not yet scheduled `fake-indexeddb`. The v9 reconcile in Phase 20 is testable today via the pure-helper fallback. Phase 23 just upgrades the integration depth.

---

## Project Constraints (from CLAUDE.md)

The 3DCoster CLAUDE.md (`.claude/CLAUDE.md` in the worktree) requires:

- Dev server pinned to port 4173 (no impact on Phase 20 — no dev server work).
- Test verification: TypeScript via `tsc -b` (NOT `tsc --noEmit`) — Vercel build runs strict checks. The build chain in `package.json:8` already runs `tsc -b` after Vitest.
- `<NewBadge>` feature flagging — N/A for Phase 20 (no user-visible changes; per project memory rule "If end users will never see the change → DO NOT add a NewBadge").
- Dexie via `Dexie.js@^4.2.1` — confirmed.
- React 19, TypeScript, Tailwind, Vite — all stable, no version conflicts in Phase 20 scope.

The user's standing `[[feedback_reconcile_legacy_data]]` rule applies to DATA-03 — Phase 20 MUST ship the v9 reconcile alongside the forward fix. The CONTEXT.md already locks this.

---

## Sources

### Primary (HIGH confidence)

- [Dexie.transaction() — official docs](https://dexie.org/docs/Dexie/Dexie.transaction()) — transaction scope function signature, async/await support, no automatic retry, PrematureCommitError causes
- [Dexie Version.upgrade() — official docs](https://dexie.org/docs/Version/Version.upgrade()) — upgrade callback signature, async support
- [Dexie.on.versionchange — official docs](https://dexie.org/docs/Dexie/Dexie.on.versionchange) — default close-and-warn behavior, override via returning false
- [Dexie.PrematureCommitError — official docs](https://dexie.org/docs/DexieErrors/Dexie.PrematureCommitError) — what causes it, how to avoid
- In-codebase: `src/components/JobsManager.tsx:1490-1501` (Convert-to-Sale template), `src/db/database.ts:121-128` (existing async upgrade), `src/hooks/useDatabase.ts:893` (existing 3-store transaction)
- `package.json:25` — Dexie 4.2.1 pin

### Secondary (MEDIUM confidence)

- [Dexie issue #612 — Native async/await and upgrade handlers (2017)](https://github.com/dfahlander/Dexie.js/issues/612) — historical interleaving bug; not reproducible in current version, but worth knowing
- [Dexie issue #1186 — PrematureCommitError when async method only occasionally awaits](https://github.com/dfahlander/Dexie.js/issues/1186) — transaction zone escape modes
- [Medium article — IndexedDB Manipulation with Dexie](https://hohanga.medium.com/indexeddb-manipulation-with-dexie-transactions-and-versioning-2c3df077af64) — community pattern reference for versioning + upgrade

### Tertiary (LOW confidence — flagged for validation)

- [ASSUMED] The Vitest-spy approach for testing `db.jobs.put` throw-during-tx works against Dexie's zone management. Wave 0 risk-validation needed.
- [ASSUMED] The exact v9 reconcile filter (`lineItemsSnapshot.currency === 'USD'`) is researcher recommendation. The planner should confirm against the locked behavior — alternative is to filter by `createdAt` date predating the v9 ship.
- [ASSUMED] The six hand-rolled `is`-predicate shapes are researcher-suggested. Each is a small Wave 0 task with its own test.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact v9 reconcile filter `lineItemsSnapshot.currency === 'USD'` matches the locked behavior | Q3, DATA-03 | If the filter is wrong (e.g., legacy quotes don't have `lineItemsSnapshot.currency` at all), the v9 upgrade is a no-op and the legacy USD-stamped quotes stay wrong. Recovery: re-ship a v10 with a corrected filter. Low blast radius. |
| A2 | Vitest spies on `db.jobs.put` work against Dexie's transaction zone | Test Wave 0 | If spies break the zone, the DATA-01/02 transaction-boundary tests cannot assert rollback. Recovery: fall back to "test the read-then-write sequence in isolation" or defer to Phase 23 TEST-04 for real-IDB coverage. Plan must include this as a Wave 0 spike. |
| A3 | Brand-new install opens v9 without a settings record and the v9 callback's `if (!settingsRow) return` early-out is the correct behavior | DATA-03 implementation note | If the planner wants v9 to fail loudly on a missing settings record, the early-out becomes a thrown error. Recovery: change the v9 callback to throw if settings is missing — but this would break first-open for any v9 user, which is the wrong behavior. The early-out IS correct. |
| A4 | The six hand-rolled `is`-predicate shapes (loose strings, strict numerics) match the runtime expectations of every typed-getter consumer | DATA-06 implementation note | If a consumer hook expects a stricter shape (e.g., `currency` must be in the `Currency` union), a stored value with `currency: 'XYZ'` would slip through. Recovery: tighten the specific predicate after observing test failures. Low risk — every consumer already has `?? default` fallbacks. |
| A5 | The Phase 20 plan should be 4 plans (one per ROADMAP suggestion) versus bundled into fewer plans | Plan Order Sensitivity | If 4-plan split adds review overhead disproportionate to the change size, bundle 20-03 + 20-04 into one plan. Low risk — researcher's recommendation, not load-bearing. |

---

## Open Questions (researcher to planner)

1. **`parsePositiveNumber` rename vs. opt-in.** CONTEXT.md locks `{ allowZero: true }`. The audit's literal wording was "rename to `parseStrictlyPositiveNumber` OR add `allowZero?: boolean` param." The opt-in is the right call (no churn). Researcher confirms no concerns.

2. **`unitsPerPackage` line 256 secondary guard.** Keep or remove? Researcher recommends KEEP (better error message; downstream safety). Planner to confirm.

3. **Plan 20-03 / 20-04 bundle or split.** Researcher recommends split with hard dependency. Solo-dev workflow can collapse to single plan if review velocity matters more than surface-area separation.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Dexie | All DATA-XX | ✓ | 4.2.1 | — |
| dexie-react-hooks | DATA-01/02 via `useLiveQuery` consumers | ✓ | 4.2.0 | — |
| Vitest | All test work | ✓ | 4.1.4 | — |
| jsdom | Test environment | ✓ | (bundled with vitest 4.1.4) | — |
| `fake-indexeddb` | Real-Dexie migration test (DATA-03 v9 end-to-end) | ✗ | — | **Pure-helper fallback** (existing `database.migrations.test.ts` pattern); real-IDB test deferred to Phase 23 TEST-04 |
| TypeScript | Compile check (DATA-04 call-site coverage) | ✓ | (via `tsc -b` in build chain) | — |

**Missing dependencies with fallback:** `fake-indexeddb` — defer real-IDB tests to Phase 23 per CONTEXT.md lock.

**Missing dependencies with no fallback:** None.

---

## RESEARCH COMPLETE

Three findings the planner needs to internalize before writing plans:

1. **The Convert-to-Sale transaction at `JobsManager.tsx:1490-1501` is a working in-production template** — the three DATA-01 mutations (`addSale` at useDatabase.ts:572, `deleteSale` at :585, `updateSale` at :601) can copy/paste this pattern with `db.sales` + `db.jobs` (no `db.quotes`). The existing async-upgrade callback at `database.ts:121-128` proves Dexie 4.2.1 fully supports `async tx => { ... await tx.table(...).get() ... }` for the DATA-03 currency fix.

2. **The hardcoded `'USD'` lives in `src/db/backfill.ts:232`, not `database.ts:124`** — CONTEXT.md's line reference points to the *caller*, not the literal. DATA-03 is a two-file change: widen `backfillQuotesFromJobs` to accept `currency`, read it from `tx.table('settings').get('userProfile')` in the v8 upgrade callback. Pair it with a new v9 upgrade callback that walks `db.quotes` and re-stamps USD entries when user's actual currency ≠ 'USD' — three layers of no-op protection make the v9 callback safe for fresh installs and USD users. **DATA-05 (async versionchange handler) MUST ship before or with the v9 schema bump** because v9 fires `versionchange` in every other open tab.

3. **No automatic Dexie retry, no side effects in the sale mutation bodies** — V5 grep confirms no console/analytics/telemetry inside `addSale`/`deleteSale`/`updateSale`. Dexie's [official docs](https://dexie.org/docs/Dexie/Dexie.transaction()) confirm zero automatic retry. The planner does not need to design "side-effect safety" into transaction bodies for Phase 20. Tests assert final IDB state after the await; emission-count assertions on `useLiveQuery` are unreliable (batching/coalescing).
