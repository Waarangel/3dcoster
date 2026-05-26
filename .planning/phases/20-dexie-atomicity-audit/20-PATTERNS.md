# Phase 20: Dexie Atomicity Audit — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 8 (3 new test files, 5 modified source files)
**Analogs found:** 8 / 8 (every new/modified file has an in-codebase template)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/hooks/useDatabase.ts` (addSale L572, deleteSale L585, updateSale L601) | hook | atomic write (multi-store) | `src/components/JobsManager.tsx:1490-1501` (Convert-to-Sale tx) | **exact** |
| `src/hooks/useDatabase.ts` (createQuote L841-907) | hook | atomic write (read-then-write inside tx) | self — already transactional at L893; only the read site moves into the tx body | **self-baseline** |
| `src/db/database.ts` (versionchange L133, getSetting L138, typed getters L162-208) | data layer | event handler + read | self — baseline shapes already in file; widen `getSetting` signature; make handler async | **self-baseline** |
| `src/db/backfill.ts` (`backfillQuotesFromJobs` L187-249) | helper (pure) | read-only transform | self — widen signature with new `currency` param; new sibling `reconcileQuoteCurrency` pure helper next to it | **self-baseline** |
| `src/db/database.ts` (NEW v9 stanza + upgrade callback) | data layer | migration (read+write) | `src/db/database.ts:121-128` (existing v8 async-upgrade callback) | **exact** |
| `src/utils/csvHelpers.ts` (`parsePositiveNumber` L398 + 8 call sites) | helper (pure) | parse/validate | self — single-file local helper; widen signature with `{ allowZero?: boolean }` | **self-baseline** |
| **NEW** `src/hooks/useDatabase.test.ts` | test | unit (mocked Dexie, vi.spyOn) | `src/pdf/generateQuotePdf.test.ts:1-12` (vi.mock pattern) + `src/db/backfill.test.ts` (Dexie-domain fixtures) | role-match (no existing test mocks the live `db` module — Wave 0 risk) |
| **NEW** `src/utils/csvHelpers.test.ts` | test | unit (pure helper) | `src/utils/format.test.ts:1-36` (pure-helper describe-it-expect) | **exact** |
| **NEW** `src/db/database.test.ts` | test | unit (validator predicates + handler) | `src/db/backfill.test.ts:1-90` + `src/db/database.migrations.test.ts:1-32` (same `src/db/` directory neighbors) | role-match |
| Extend `src/db/backfill.test.ts` | test | unit (pure helper) | self — add `describe('reconcileQuoteCurrency')` block next to existing `describe('backfillQuotesFromJobs')` | **self-baseline** |
| Extend `src/db/database.migrations.test.ts` | test | unit (pure-helper fallback) | self — add v8 currency-flowthrough fixture next to existing 3-job→2-quote fixture | **self-baseline** |

---

## Pattern Assignments

### 1. `src/hooks/useDatabase.ts` — addSale/deleteSale/updateSale (hook, atomic multi-store write)

**Analog:** `src/components/JobsManager.tsx:1490-1501` (Convert-to-Sale — production-tested template)

**Core transaction pattern** (verbatim from analog, lines 1490-1501):
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

**Current (non-atomic) `addSale` shape — useDatabase.ts:572-583 (the diff surface):**
```ts
const addSale = useCallback(async (sale: Sale) => {
  await db.sales.add(sale);
  // Update job's copiesSold count
  const job = await db.jobs.get(sale.jobId);
  if (job) {
    await db.jobs.put({
      ...job,
      copiesSold: job.copiesSold + sale.quantity,
      updatedAt: new Date(),
    });
  }
}, []);
```

**Why this is the pattern to mirror:**
- The Convert-to-Sale tx scope function is the only multi-store sale write that currently runs atomically in production; the planner can copy the exact `db.transaction('rw', ...tables, async () => { ... })` shape verbatim.
- Drop `db.quotes` from the table list (sale mutations don't touch quotes) — keep `db.sales` + `db.jobs`.
- `deleteSale` (L585-596) and `updateSale` (L601-615) mirror the same `db.jobs.get` → spread → `db.jobs.put` body pattern with the arithmetic adjusted per mutation (subtract for delete, delta math for update).
- RESEARCH.md V5 confirms no side effects (console.warn/analytics) inside the existing bodies — safe to wrap with no extra refactor.

---

### 2. `src/hooks/useDatabase.ts` — `createQuote` L841-907 (hook, tx-scoped read)

**Analog:** self — already transactional. The fix moves the `nextQuoteNumber` read INSIDE the existing tx body.

**Current already-transactional baseline** (useDatabase.ts:841-907 condensed to the load-bearing lines):
```ts
const createQuote = useCallback(async (input: CreateQuoteInput): Promise<Quote> => {
  const { job, userProfile, customerSnapshot, existingCustomerId, shippingCost, resolvedTaxRate, taxAmount } = input;
  const nextNum = userProfile.nextQuoteNumber ?? 1;  // ← BUG (L843): read from React state, OUTSIDE tx

  // ... build quotePayload with quoteNumber: nextNum ...

  await db.transaction('rw', db.quotes, db.customers, db.settings, async () => {
    if (existingCustomerId) {
      const existing = await db.customers.get(existingCustomerId);
      if (existing) {
        await db.customers.put({ ...existing, lastUsedAt: new Date() });
      }
    } else if (newCustomerCandidate) {
      await db.customers.add(newCustomerCandidate);
    }
    await db.quotes.add(quotePayload);
    await setUserProfile({ ...userProfile, nextQuoteNumber: nextNum + 1 });
  });

  return quotePayload;
}, []);
```

**Why this is the pattern to mirror (and what NOT to disturb):**
- The transaction scope already includes `db.settings` — no `db.transaction(...)` signature change needed.
- The scope function is currently `async () => { ... }` (no `tx` arg). The DATA-02 fix changes it to `async (tx) => { ... }` and adds `await tx.table('settings').get('userProfile')` at the top of the body. Build `quotePayload` AFTER the tx-scoped read using the read's `nextNum`.
- `setUserProfile` at the bottom of the tx body already participates in the transaction zone via `db.settings.put` under the hood — DO NOT refactor to `tx.table('settings').put(...)` (out of scope; marginal cleanup).
- React `userProfile` state IS still the source of truth for `currency`, `defaultTaxRate`, `defaultTerms`, `address`, `defaultProfitMargin`. ONLY `nextQuoteNumber` source changes.

---

### 3. `src/db/database.ts` — versionchange handler L133 (data layer, event handler)

**Analog:** self — single-line handler currently in file.

**Current shape (L130-133):**
```ts
// Reload this tab if another tab loads a newer schema (SCHEMA-02 / D-10 / D-11).
// Without this, Dexie's default closes the connection and console.warn()s,
// which crashes the React tree via useLiveQuery references.
db.on('versionchange', () => { window.location.reload(); });
```

**Target replacement (DATA-05):**
```ts
db.on('versionchange', async () => {
  await db.close();
  window.location.reload();
});
```

**Why this is the pattern to mirror:**
- One-line surgical edit; comment block stays as is.
- `db.close()` is not currently used elsewhere in the codebase per RESEARCH.md V4 — DATA-05 introduces it.
- The handler returns `Promise<void>` instead of `undefined`; Dexie ignores both. No regression in the default close-then-reload semantics.
- **Plan-order constraint:** DATA-05 must ship before or with DATA-03 v9 schema bump — when v9 lands, every other open tab fires `versionchange`. Without the async-close handler, in-flight writes in those tabs abort mid-flight.

---

### 4. `src/db/database.ts` — `getSetting<T>` L138 + 6 typed getters L162-208 (data layer, read + validate)

**Analog:** self — baseline already in file; signature widens with optional `validator` param.

**Current `getSetting<T>` baseline (L138-146):**
```ts
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const setting = await db.settings.get(key);
  if (!setting) return defaultValue;
  try {
    return JSON.parse(setting.value) as T;
  } catch {
    return defaultValue;
  }
}
```

**Current typed getter shape (representative — L162-164):**
```ts
export async function getPrinter(defaultValue: PrinterConfig): Promise<PrinterConfig> {
  return getSetting(settingsKeys.printer, defaultValue);
}
```

**Target replacement (DATA-06) — verbatim from RESEARCH.md L642-662:**
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

**Why this is the pattern to mirror:**
- Each of the six typed getters (`getPrinter`, `getElectricity`, `getLabor`, `getUserProfile`, `getShippingConfig`, `getMarketplaceFees`) at L162, L170, L178, L186, L194, L202 follows the same one-liner `return getSetting(key, defaultValue)` shape. They become three-arg calls: `return getSetting(key, defaultValue, isFoo)`.
- Six new `is`-predicates co-locate with their getter (researcher recommendation; alternative `src/db/validators.ts` is dev-discretion per CONTEXT.md).
- "Be loose with string fields, strict with numeric fields" (RESEARCH.md DATA-06 landmine) — the `Currency` union should NOT be tightened to the 18 valid currencies in the predicate.

---

### 5. `src/db/backfill.ts` — `backfillQuotesFromJobs` L187 (helper, pure transform)

**Analog:** self — pure-helper signature widens with new `currency` param.

**Current signature (L187):**
```ts
export function backfillQuotesFromJobs(jobs: PrintJob[], sales: Sale[]): Quote[] {
```

**Current hardcoded literal (L225-236, the diff surface):**
```ts
out.push({
  id: crypto.randomUUID(),
  quoteNumber: job.quoteNumber,
  printJobId: job.id,
  customerId: undefined,
  customerSnapshot,
  lineItemsSnapshot: {
    jobTitle: job.name,
    sellingPrice: job.sellingPrice ?? 0,
    shippingCost: 0,
    resolvedTaxRate: job.taxRate ?? 0,
    taxAmount: job.taxAmount ?? 0,
    // Currency sentinel — migration runs without UserProfile access. See module JSDoc.
    currency: 'USD',  // ← LINE 232 — replace with `currency` parameter
    notes: job.notes ?? '',
```

**Why this is the pattern to mirror:**
- Widen signature to `backfillQuotesFromJobs(jobs, sales, currency: string): Quote[]`. Two-line patch: signature + L232 literal.
- The module JSDoc at L180-186 explicitly notes the USD sentinel was a known compromise; updating the comment block to reflect that the caller now passes user currency keeps documentation honest.
- A new sibling pure helper `reconcileQuoteCurrency(quotes: Quote[], currency: string): Quote[]` lands in this same file for v9 testability (RESEARCH.md DATA-03 implementation note) — its shape mirrors `backfillQuotesFromJobs` (input array → filter → patch → return).

---

### 6. `src/db/database.ts` — NEW v9 schema stanza + upgrade callback (data layer, migration)

**Analog:** `src/db/database.ts:121-128` (existing v8 async-upgrade callback — production-tested in Phase 16).

**Exact in-codebase template (verbatim, L112-128):**
```ts
db.version(8).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
  customers: 'id, name, email, lastUsedAt',
  quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',  // quoteNumber + status indexed per D-17
}).upgrade(async tx => {
  const jobs = await tx.table('jobs').toArray();
  const sales = await tx.table('sales').toArray();
  const quotes = backfillQuotesFromJobs(jobs, sales);
  if (quotes.length > 0) {
    await tx.table('quotes').bulkAdd(quotes);
  }
});
```

**Target v9 shape (RESEARCH.md Q3, after L128, schema stanza IDENTICAL to v8):**
```ts
db.version(9).stores({
  /* same as v8 — copy/paste exactly */
}).upgrade(async tx => {
  const settingsRow = await tx.table('settings').get('userProfile');
  if (!settingsRow) return;  // brand-new device → no quotes to reconcile

  let userCurrency: string;
  try {
    userCurrency = (JSON.parse(settingsRow.value) as UserProfile).currency;
  } catch {
    return;  // corrupt settings → bail out silently
  }
  if (userCurrency === 'USD') return;  // no drift possible

  const quotes = await tx.table('quotes').toArray();
  const patched = reconcileQuoteCurrency(quotes, userCurrency);  // pure helper from backfill.ts
  if (patched.length === 0) return;

  await tx.table('quotes').bulkPut(patched);

  if (import.meta.env.DEV) {
    console.info(`[v9 reconcile] patched ${patched.length} quotes from USD → ${userCurrency}`);
  }
});
```

**Why this is the pattern to mirror:**
- The v8 callback at L121-128 is the in-production `async tx => { ... await tx.table(...).X() ... }` template — three layers of no-op early-outs in v9 match the existing async/await idiom.
- Schema stanza IDENTICAL to v8 — only the version number changes. Researcher recommends keeping the v9 upgrade independent of any other version-bump callback (RESEARCH.md Q2 historical caveat).
- The v8 DATA-03 forward fix adds three lines to L121-128:
  - `const settingsRow = await tx.table('settings').get('userProfile');`
  - `const currency = settingsRow ? (JSON.parse(settingsRow.value) as UserProfile).currency : 'USD';`
  - `const quotes = backfillQuotesFromJobs(jobs, sales, currency);` (new signature)

---

### 7. `src/utils/csvHelpers.ts` — `parsePositiveNumber` L398 + 8 call sites (helper, parse/validate)

**Analog:** self — single-file local helper.

**Current signature + body (L398-403):**
```ts
function parsePositiveNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const num = Number(value.trim());
  if (isNaN(num) || num < 0) return null;
  return num;
}
```

**Representative call site (L211-220) — the bulk pattern:**
```ts
if (isPrinter) {
  // Printer-specific validation
  const purchasePrice = parsePositiveNumber(row.purchaseprice);
  const wattage = parsePositiveNumber(row.wattage);

  if (purchasePrice === null) {
    errors.push('Purchase price must be a positive number');
  } else {
    asset.purchasePrice = purchasePrice;
  }
```

**Target replacement (DATA-04) — RESEARCH.md L609-619:**
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

**Why this is the pattern to mirror:**
- 8 call sites at L213, L214, L229, L232, L235, L241, L242, L268 (RESEARCH.md V1 confirmed accurate against CONTEXT.md table).
- ONLY L241 (`packageCost`) opts in with `{ allowZero: true }`. Every other call site stays a one-arg invocation — default rejection of `0` is the desired new behavior.
- L256 has a secondary `<= 0` guard on `unitsPerPackage` — RESEARCH.md V1 recommends KEEP (better error message, defense-in-depth). Planner discretion.

---

### 8. NEW `src/hooks/useDatabase.test.ts` (test, unit with mocked Dexie)

**Analog (vi.mock idiom):** `src/pdf/generateQuotePdf.test.ts:1-12`
**Analog (Dexie domain fixtures):** `src/db/backfill.test.ts:1-90`

**`vi.mock` pattern excerpt (generateQuotePdf.test.ts:1-12):**
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Quote, JobCustomer, Currency } from '../types';
import { generateQuotePdfBytes, generateQuotePdf } from './generateQuotePdf';

// Mock Tauri plugin modules at the top level — required for the writeFile error mapping tests.
// These are hoisted by Vitest's module mock system and only take effect when __IS_TAURI__ is stubbed true.
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn(),
}));
```

**Dexie-domain fixture shape (backfill.test.ts:46-77):**
```ts
function makeMinimalJob(overrides: Partial<PrintJob>): PrintJob {
  return {
    id: 'job-x',
    name: 'Job X',
    createdAt: new Date('2026-04-01'),
    /* ... full minimum-viable PrintJob ... */
    ...overrides,
  } as PrintJob;
}
function makeMinimalSale(overrides: Partial<Sale>): Sale {
  return {
    id: 'sale-x',
    jobId: 'job-x',
    quantity: 1,
    unitPrice: 10,
    totalRevenue: 10,
    soldAt: new Date('2026-04-05'),
    ...overrides,
  } as Sale;
}
```

**Why these are the patterns to mirror:**
- **No existing test mocks the live `db` module** — `useDatabase.test.ts` is greenfield territory. The `vi.mock` idiom from generateQuotePdf.test.ts (mocking external modules at top level) is the closest pattern.
- Test approach (per RESEARCH.md DATA-01 test strategy + R1): use `vi.spyOn(db.jobs, 'put').mockRejectedValueOnce(new Error('simulated'))` to simulate mid-tx throw, then assert `await db.sales.get(saleId)` returns `undefined` after the call rejects.
- **Wave 0 risk (RESEARCH.md A2):** The Vitest-spy approach against Dexie's transaction zone has NOT been verified empirically in this codebase. The first DATA-01 test must prove the rollback assertion works against jsdom before the rest of the test plan locks in.
- Reuse the `makeMinimalJob` / `makeMinimalSale` fixture helpers from `src/db/backfill.test.ts` for type-safe minimal inputs.

---

### 9. NEW `src/utils/csvHelpers.test.ts` (test, unit pure helper)

**Analog:** `src/utils/format.test.ts:1-36` (exact-match: same directory, same role — pure-helper Vitest tests).

**Verbatim template (format.test.ts:1-36):**
```ts
import { describe, it, expect } from 'vitest';
import { formatQuoteNumber, customerNameSlug } from './format';

// ---------------------------------------------------------------------------
// Phase 16 — format utility tests (Wave 1, Plan 02)
// ---------------------------------------------------------------------------

describe('formatQuoteNumber', () => {
  it("formatQuoteNumber(1) → 'Q-0001'", () => {
    expect(formatQuoteNumber(1)).toBe('Q-0001');
  });

  it("formatQuoteNumber(0) → 'Q-0000' (edge case — counter seed is ?? 1, but defensive)", () => {
    expect(formatQuoteNumber(0)).toBe('Q-0000');
  });
});
```

**Why this is the pattern to mirror:**
- Same directory (`src/utils/`), same kind of helper (pure, no side effects), same test framework. Copy/paste the file header + describe/it/expect shape.
- DATA-04 needs only three tests minimum: `parsePositiveNumber('0')` returns `null`, `parsePositiveNumber('0', { allowZero: true })` returns `0`, `parsePositiveNumber('-1')` returns `null` (regression).
- **Coordination note (RESEARCH.md R5):** Phase 21 SEC will ALSO add `sanitizeCsvCell` tests to this file. Author with a `describe('parsePositiveNumber')` block so Phase 21 just appends additional `describe` blocks below.
- `parsePositiveNumber` is currently NOT exported (module-private). DATA-04 must export it OR add a public re-export — planner decides. Test imports it the same way.

---

### 10. NEW `src/db/database.test.ts` (test, unit validator predicates + event handler)

**Analog:** `src/db/backfill.test.ts:1-90` + `src/db/database.migrations.test.ts:1-32` (same directory, neighbor test files).

**Verbatim template (backfill.test.ts:1-3):**
```ts
import { describe, it, expect } from 'vitest';
import { backfillTagsOnJob, normalizeTagsOnJob, parseTagsInput, backfillQuotesFromJobs, backfillCustomersFromSales, reconcileCopiesSoldFromSales } from './backfill';
import type { PrintJob, Sale, Customer } from '../types';
```

**Predicate test shape (write fresh; six `is`-predicates × happy + unhappy path each):**
```ts
describe('isPrinterConfig', () => {
  it('accepts a well-formed PrinterConfig', () => {
    expect(isPrinterConfig({ id: 'p1', name: 'Bambu', purchasePrice: 500, wattage: 200 })).toBe(true);
  });

  it('rejects a missing numeric field', () => {
    expect(isPrinterConfig({ id: 'p1', name: 'Bambu' })).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isPrinterConfig(null)).toBe(false);
  });
});
```

**Why this is the pattern to mirror:**
- Same directory as `backfill.test.ts` and `database.migrations.test.ts` — same import style (`./backfill`, `./database`), same `describe/it/expect` shape, same `import type { ... }` discipline.
- Tests cover three surfaces in this single file (RESEARCH.md DATA-05/06 test plan): (a) `versionchange` handler awaits `db.close()`, (b) six `is`-predicates' happy + unhappy paths, (c) `getSetting` returns `defaultValue` when validator rejects + `console.warn` fires only in dev.
- For DATA-05 handler test, spy on `db.close` and `window.location.reload` to assert sequence (await close THEN reload).
- For DATA-06 dev-mode warn test, stub `import.meta.env.DEV` true/false (Vitest supports `vi.stubEnv`).
- **Small surface (RESEARCH.md Wave 0 Gaps):** Do NOT stuff this into `database.migrations.test.ts` — keep concerns separate.

---

### 11. Extend `src/db/backfill.test.ts` (test, unit pure helper — append `describe` block)

**Analog:** self — existing file with the exact `describe('backfillQuotesFromJobs (D-17 G7 locked fixture)')` block at L79.

**Pattern (append new `describe('reconcileQuoteCurrency')` block after the existing backfillQuotesFromJobs block):**
- Tests prove: (a) the helper patches `lineItemsSnapshot.currency === 'USD'` quotes to user's actual currency, (b) it leaves non-USD quotes untouched (idempotency), (c) re-running on patched quotes is a no-op (RESEARCH.md DATA-03 test plan c), (d) the helper accepts the new `currency: string` parameter on `backfillQuotesFromJobs` and propagates it to `lineItemsSnapshot.currency`.
- Reuse the existing `makeMinimalJob` / `makeMinimalSale` fixture helpers at L46-77 — no new fixture builders needed for the v9 reconcile tests.

---

### 12. Extend `src/db/database.migrations.test.ts` (test, unit pure-helper migration boundary)

**Analog:** self — existing 3-job → 2-quote D-17 G7 fixture at L66-115.

**Pattern (append new test inside the same `describe('v7→v8 quotes backfill (D-17 G7) — migration boundary')` block OR a new sibling `describe`):**
- New test: `it('v8 migration threads user currency from settings into lineItemsSnapshot.currency')` — exercises the new three-arg `backfillQuotesFromJobs(jobs, sales, currency)` signature with a fixture that includes a settings row.
- Researcher's recommendation in RESEARCH.md Wave 0 Gaps: extend, don't replace. The existing 3-job → 2-quote fixture stays unchanged; the new test adds the currency thread-through assertion.

---

## Shared Patterns

### Shared Pattern A: Async Dexie transaction scope function
**Source:** `src/components/JobsManager.tsx:1490-1501` (Convert-to-Sale)
**Apply to:** addSale, deleteSale, updateSale (DATA-01); createQuote tx body (DATA-02 — already in place, only the scope function signature gains a `tx` parameter)

```ts
await db.transaction('rw', db.X, db.Y, async (tx) => {
  // 1. Read tx-scoped state (await tx.table('settings').get(...) is safe inside this zone).
  // 2. Compute new state (no non-Dexie Promises — no fetch, setTimeout, navigator.X).
  // 3. Write via db.X.add / db.X.put / db.X.delete.
});
```

### Shared Pattern B: Async upgrade callback with tx.table reads
**Source:** `src/db/database.ts:121-128` (v8 upgrade)
**Apply to:** DATA-03 v8 currency forward fix + DATA-03 v9 reconcile

```ts
}).upgrade(async tx => {
  const fixtureRows = await tx.table('tableName').toArray();
  // ... pure-helper transform ...
  if (out.length > 0) {
    await tx.table('targetTable').bulkAdd(out);  // or bulkPut for reconcile
  }
});
```

### Shared Pattern C: Pure-helper testing in jsdom
**Source:** `src/db/backfill.test.ts:79-115` + `src/db/database.migrations.test.ts:66-115`
**Apply to:** v8 currency forward fix test, v9 reconcile idempotency test (both pure-helper fallback per RESEARCH.md R1)

The pattern is to extract Dexie-zone logic into a pure helper (`backfillQuotesFromJobs`, new `reconcileQuoteCurrency`), test the helper exhaustively in jsdom, and rely on the production Dexie wrapper to be exercised at the integration boundary by real users (Phase 23 TEST-04 adds `fake-indexeddb` for full integration).

### Shared Pattern D: vi.spyOn for mid-tx rollback assertions
**Source:** No in-codebase analog — Wave 0 risk-validation needed (RESEARCH.md A2)
**Apply to:** DATA-01 (three sale mutations), DATA-02 (createQuote tx-scoped read)

Recommended approach (RESEARCH.md test plan):
```ts
const spy = vi.spyOn(db.jobs, 'put').mockRejectedValueOnce(new Error('simulated mid-tx throw'));
await expect(addSale(sale)).rejects.toThrow();
expect(await db.sales.get(sale.id)).toBeUndefined();  // rolled back
spy.mockRestore();
```

If Vitest spies escape the Dexie transaction zone (Wave 0 risk), fall back to "test the read-then-write sequence in isolation" without claiming atomicity coverage — defer atomicity to Phase 23 TEST-04 real-IDB tests.

---

## No Analog Found

| File | Role | Data Flow | Reason | Mitigation |
|------|------|-----------|--------|------------|
| `src/hooks/useDatabase.test.ts` | test (mocked Dexie) | unit | No existing test in this codebase mocks the live `db` module. `vi.mock` is used in PDF tests for external modules but never against `./database`. | Wave 0 spike: prove `vi.spyOn(db.jobs, 'put').mockRejectedValueOnce(...)` works against Dexie's transaction zone before locking the test plan (RESEARCH.md A2). |

---

## Metadata

**Analog search scope:** `src/hooks/`, `src/db/`, `src/utils/`, `src/components/`, `src/pdf/`
**Files scanned:** 8 source files + 21 test files
**Key in-codebase templates verified in production:**
- `src/components/JobsManager.tsx:1490-1501` — Convert-to-Sale transaction (DATA-01 template)
- `src/db/database.ts:121-128` — async upgrade callback (DATA-03 template)
- `src/db/backfill.test.ts:46-77` — Dexie-domain fixture helpers (test analog)
- `src/utils/format.test.ts:1-36` — pure-helper test shape (`csvHelpers.test.ts` analog)
- `src/pdf/generateQuotePdf.test.ts:1-12` — vi.mock top-level pattern (`useDatabase.test.ts` analog)

**Pattern extraction date:** 2026-05-26

---

## PATTERN MAPPING COMPLETE

Three pattern-anchor files the planner MUST reference in every plan's `<read_first>` block:

1. **`src/components/JobsManager.tsx:1490-1501`** — the working in-production `db.transaction('rw', ...tables, async () => { ... })` template that every DATA-01 sale mutation and DATA-02 tx body must mirror. Reading this once tells the planner the exact shape, the table-list ordering, and the read-then-spread-then-put idiom for the inner job update.

2. **`src/db/database.ts:121-128`** — the existing async-upgrade callback (`}).upgrade(async tx => { ... await tx.table('X').Y() ... });`) that proves Dexie 4.2.1 fully supports the `await tx.table(...).get/toArray/bulkAdd/bulkPut` surface DATA-03 needs for both the v8 forward fix and the v9 reconcile. Schema stanza for v9 is identical to v8 — copy/paste with only the version number changed.

3. **`src/db/backfill.test.ts:1-115`** — the pure-helper-fallback test pattern that bypasses jsdom's missing IndexedDB. Both `backfillQuotesFromJobs` test extensions (DATA-03 forward fix) and the new `reconcileQuoteCurrency` tests (DATA-03 reconcile) follow this file's `makeMinimalJob`/`makeMinimalSale` fixture + `describe(helper)` shape — Phase 23 TEST-04 later upgrades the integration depth with `fake-indexeddb` without changing the assertion shape.
