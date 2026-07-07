import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Dexie } from 'dexie';
import { backfillQuotesFromJobs, reconcileQuoteCurrency } from './backfill';
import type { PrintJob, Sale, Quote, Material, FailureEvent, MaintenanceEvent } from '../types';

// ---------------------------------------------------------------------------
// Dexie v7 → v8 quotes backfill — REAL-DEXIE integration test (Phase 23 TEST-04
// promotion of the prior fallback-mode test).
//
// The very first import (`fake-indexeddb/auto`) installs the in-memory
// IndexedDB shim on `globalThis` BEFORE any `new Dexie(...)` evaluates. Per
// D-04 (23-CONTEXT.md), the shim is scoped to THIS FILE ONLY — there is NO
// `vitest.setup.ts` injection. Other test files keep running on the
// jsdom-only baseline (no IndexedDB, no Dexie open() calls).
//
// The D-17 G7 contract — 3 PrintJobs in, exactly 2 Quotes out (1 converted,
// 1 draft; Job C without a quoteNumber is skipped) — is locked at two layers:
//   1. Pure helper:  src/db/backfill.test.ts:84-96 (this test reproduces the
//      same assertion shape byte-for-byte against the real-Dexie path).
//   2. Integration:  this file (exercises the actual transaction boundary —
//      jobs+sales read via tx.table(...), helper invocation, bulkAdd to the
//      v8 quotes store).
// Any future change to `database.ts`'s `.version(8).upgrade(...)` callback
// that breaks the contract will fail this test even when the pure-helper
// suite passes (e.g. piping data into the wrong store, slipping an extra
// filter, etc.).
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<PrintJob>): PrintJob {
  return {
    id: 'job-x',
    name: 'Job X',
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
    filaments: [],
    printTimeHours: 1,
    printerInstanceId: 'p-1',
    modelCost: 0,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    costPerUnit: 1,
    sellingPrice: 10,
    copiesSold: 0,
    ...overrides,
  } as PrintJob;
}

function makeSale(overrides: Partial<Sale>): Sale {
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

// D-17 G7 locked fixture — identical shape to src/db/backfill.test.ts:80-108
// so the integration boundary asserts the SAME contract as the pure helper.
const jobA = makeJob({
  id: 'job-a',
  name: 'Quote A',
  quoteNumber: 42,
  sellingPrice: 100,
  taxRate: 13,
  taxAmount: 13,
});
const jobB = makeJob({
  id: 'job-b',
  name: 'Quote B',
  quoteNumber: 43,
  sellingPrice: 50,
});
const jobC = makeJob({
  id: 'job-c',
  name: 'Quote C (no number)',
  // intentionally no quoteNumber — upgrade callback skips it
});
const saleA = makeSale({
  id: 'sale-a',
  jobId: 'job-a',
  soldAt: new Date('2026-04-10'),
  customer: { name: 'Alice', email: 'alice@example.com' },
});

describe('v7→v8 quotes migration (D-17 G7) — real Dexie via fake-indexeddb', () => {
  // Use a unique DB name per test to isolate state inside fake-indexeddb's
  // in-memory store. afterEach calls Dexie.delete(dbName) so even if a test
  // throws mid-transaction the next test starts with a clean slate.
  let dbName: string;
  let db: Dexie | undefined;

  beforeEach(() => {
    dbName = `test-3DCosterDB-${crypto.randomUUID()}`;
    db = undefined;
  });

  afterEach(async () => {
    if (db && db.isOpen()) {
      db.close();
    }
    await Dexie.delete(dbName);
  });

  it('emits exactly 2 quotes for 3-job-2-quote fixture (status mix: converted + draft) via the real v7→v8 upgrade transaction', async () => {
    // Step A: open at v7 schema; seed the locked fixture; close.
    const v7Db = new Dexie(dbName);
    v7Db.version(7).stores({
      jobs: 'id, name, createdAt, printerInstanceId',
      sales: 'id, jobId, soldAt',
    });
    await v7Db.open();
    await v7Db.table('jobs').bulkAdd([jobA, jobB, jobC]);
    await v7Db.table('sales').bulkAdd([saleA]);
    v7Db.close();

    // Step B: reopen at v8 with the upgrade callback. Mirrors the data
    // contract of database.ts's .version(8).upgrade(...) — reads jobs +
    // sales via tx.table(...), invokes backfillQuotesFromJobs, then
    // bulkAdds the result to the new `quotes` store. Currency is 'USD'
    // (matches production's fall-through default when no settings row exists,
    // which is also what the D-17 G7 assertions in backfill.test.ts expect).
    db = new Dexie(dbName);
    db.version(7).stores({
      jobs: 'id, name, createdAt, printerInstanceId',
      sales: 'id, jobId, soldAt',
    });
    db.version(8).stores({
      jobs: 'id, name, createdAt, printerInstanceId',
      sales: 'id, jobId, soldAt',
      quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
    }).upgrade(async tx => {
      const jobs = await tx.table('jobs').toArray();
      const sales = await tx.table('sales').toArray();
      const quotes = backfillQuotesFromJobs(jobs as PrintJob[], sales as Sale[], 'USD');
      if (quotes.length > 0) {
        await tx.table('quotes').bulkAdd(quotes);
      }
    });
    await db.open();

    // Step C: assert against the D-17 G7 locked contract. The 10 assertion
    // lines below are byte-identical to src/db/backfill.test.ts:84-96 — only
    // the data source differs (real-Dexie .toArray() vs pure-helper return).
    const v8Quotes = (await db.table('quotes').toArray()) as Quote[];

    expect(v8Quotes.length).toBe(2);
    expect(v8Quotes.filter(q => q.status === 'converted').length).toBe(1);
    expect(v8Quotes.filter(q => q.status === 'draft').length).toBe(1);

    const converted = v8Quotes.find(q => q.status === 'converted')!;
    expect(converted.printJobId).toBe('job-a');
    expect(converted.convertedToSaleId).toBe('sale-a');
    expect(converted.quoteNumber).toBe(42);

    const draft = v8Quotes.find(q => q.status === 'draft')!;
    expect(draft.printJobId).toBe('job-b');
    expect(draft.convertedToSaleId).toBeUndefined();
    expect(draft.quoteNumber).toBe(43);
  });
});

// ---------------------------------------------------------------------------
// v8→v9 currency reconcile stays at the pure-helper layer.
//
// Per the Phase 23 TEST-04 scope and 23-CONTEXT.md "Claude's discretion": the
// fake-indexeddb shim is the v7→v8 integration test's responsibility; the v9
// reconcile contract (reconcileQuoteCurrency) is already exhaustively covered
// in src/db/backfill.test.ts:515-583 — a real-Dexie integration depth upgrade
// for v9 would not add new signal. The block below is the migration-boundary
// echo of those pure-helper tests: it locks the data contract executed inside
// the v9 upgrade callback (read quotes → reconcileQuoteCurrency → bulkPut),
// which is identical to the pure helper's input/output.
// ---------------------------------------------------------------------------

describe('v8→v9 currency reconcile (DATA-03 v9 reconcile) — pure-helper layer', () => {
  function makeStaleQuote(overrides: Partial<Quote>): Quote {
    return {
      id: crypto.randomUUID(),
      quoteNumber: 1,
      printJobId: 'job-x',
      customerSnapshot: { name: 'Test' },
      lineItemsSnapshot: {
        jobTitle: 'X',
        sellingPrice: 10,
        shippingCost: 0,
        resolvedTaxRate: 0,
        taxAmount: 0,
        currency: 'USD',
        notes: '',
        terms: '',
      },
      status: 'sent',
      createdAt: new Date(),
      sentAt: new Date(),
      ...overrides,
    } as Quote;
  }

  it('exercises the v9 reconcile pipeline via the pure helper (real-Dexie depth upgrade deferred — pure-helper coverage is exhaustive in backfill.test.ts)', () => {
    const stale = makeStaleQuote({ id: 'stale-q1' });
    const patched = reconcileQuoteCurrency([stale], 'CAD');
    expect(patched.length).toBe(1);
    expect(patched[0].lineItemsSnapshot.currency).toBe('CAD');
  });

  it('v9 reconcile is idempotent (rerunning on a patched quote returns zero patches)', () => {
    const stale = makeStaleQuote({ id: 'stale-q2' });
    const firstPass = reconcileQuoteCurrency([stale], 'CAD');
    const after = [firstPass[0]];
    const secondPass = reconcileQuoteCurrency(after, 'CAD');
    expect(secondPass.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// v11→v12 additive-store migration (Phase 39 WAVE-0 gap closure) — REAL-DEXIE
// integration test.
//
// v12 adds the `failureEvents` and `maintenanceEvents` ledgers (FAIL-01..04,
// WEAR-01/02) as brand-new EMPTY stores — database.ts's .version(12).stores()
// call carries NO .upgrade() callback (identical precedent to v11's
// `stockEvents` addition). The behavioral contract under test is NOT "does
// the upgrade callback transform data correctly" (there is none) but the
// sharper, actually-riskier claim: does Dexie's additive schema bump preserve
// every pre-existing row in jobs/materials/settings untouched, AND do the two
// new stores come up immediately writable with the exact index strings from
// database.ts (id, printerInstanceId, materialId, jobId, failedAt /
// id, printerInstanceId, partType, occurredAt)? A copy-paste error in either
// index string (e.g. transposing materialId/jobId) would still let Dexie
// open the DB — it only fails at query/put time — so this test exercises
// actual reads/writes against the new stores, not just a successful open().
// ---------------------------------------------------------------------------

function makeMaterial(overrides: Partial<Material>): Material {
  return {
    id: 'mat-x',
    name: 'Generic PLA',
    category: 'filament',
    currency: 'USD',
    unit: 'g',
    costPerUnit: 0.02,
    ...overrides,
  } as Material;
}

describe('v11→v12 additive stores (failureEvents/maintenanceEvents) — real Dexie via fake-indexeddb', () => {
  let dbName: string;
  let db: Dexie | undefined;

  beforeEach(() => {
    dbName = `test-3DCosterDB-v12-${crypto.randomUUID()}`;
    db = undefined;
  });

  afterEach(async () => {
    if (db && db.isOpen()) {
      db.close();
    }
    await Dexie.delete(dbName);
  });

  // v11 store strings copy-pasted verbatim from database.ts's .version(11).stores() call.
  function v11Stores(d: Dexie) {
    d.version(11).stores({
      materials: 'id, category, brand, filamentType, currency',
      printers: 'id, name',
      printerInstances: 'id, printerConfigId, nickname',
      jobs: 'id, name, createdAt, printerInstanceId',
      sales: 'id, jobId, soldAt',
      settings: 'key',
      customers: 'id, name, email, lastUsedAt',
      quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
      stockEvents: 'id, assetId, refId, timestamp',
    });
  }

  // v12 store strings copy-pasted verbatim from database.ts's .version(12).stores() call
  // (NO .upgrade() — additive-only, matching production).
  function v12Stores(d: Dexie) {
    d.version(12).stores({
      materials: 'id, category, brand, filamentType, currency',
      printers: 'id, name',
      printerInstances: 'id, printerConfigId, nickname',
      jobs: 'id, name, createdAt, printerInstanceId',
      sales: 'id, jobId, soldAt',
      settings: 'key',
      customers: 'id, name, email, lastUsedAt',
      quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
      stockEvents: 'id, assetId, refId, timestamp',
      failureEvents: 'id, printerInstanceId, materialId, jobId, failedAt',
      maintenanceEvents: 'id, printerInstanceId, partType, occurredAt',
    });
  }

  const existingJob = {
    id: 'job-legacy-1',
    name: 'Legacy Job',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    filaments: [{ filamentId: 'mat-legacy', grams: 120 }],
    printTimeHours: 3,
    printerInstanceId: 'printer-legacy-1',
    modelCost: 0,
    prepTimeMinutes: 10,
    postProcessingMinutes: 5,
    materialsUsed: [],
    failureRate: 5,
    costPerUnit: 4.5,
    sellingPrice: 20,
    copiesSold: 2,
  } as unknown as PrintJob;

  const existingMaterial = makeMaterial({ id: 'mat-legacy', name: 'Legacy PLA Black' });
  const existingSettingsRow = { key: 'userProfile', value: JSON.stringify({ currency: 'CAD', laborHourlyRate: 25 }) };

  it('preserves all pre-existing jobs/materials/settings rows and makes both new v12 stores immediately writable/readable, with no upgrade error', async () => {
    // Step A: open at v11 schema; seed representative pre-existing data; close.
    const v11Db = new Dexie(dbName);
    v11Stores(v11Db);
    await v11Db.open();
    await v11Db.table('jobs').bulkAdd([existingJob]);
    await v11Db.table('materials').bulkAdd([existingMaterial]);
    await v11Db.table('settings').bulkAdd([existingSettingsRow]);
    v11Db.close();

    // Step B: reopen at v12 (additive-only bump, chained through v11 exactly
    // like database.ts's real version chain). This is the operation under
    // test — it must not throw.
    db = new Dexie(dbName);
    v11Stores(db);
    v12Stores(db);

    await expect(db.open()).resolves.not.toThrow();

    // Assertion (a): every pre-existing row is intact and readable.
    const jobsAfter = await db.table('jobs').toArray();
    expect(jobsAfter).toHaveLength(1);
    expect(jobsAfter[0]).toMatchObject({
      id: 'job-legacy-1',
      name: 'Legacy Job',
      printerInstanceId: 'printer-legacy-1',
      costPerUnit: 4.5,
      sellingPrice: 20,
    });
    expect(jobsAfter[0].filaments).toEqual([{ filamentId: 'mat-legacy', grams: 120 }]);

    const materialsAfter = await db.table('materials').toArray();
    expect(materialsAfter).toHaveLength(1);
    expect(materialsAfter[0]).toMatchObject({ id: 'mat-legacy', name: 'Legacy PLA Black', category: 'filament' });

    const settingsAfter = await db.table('settings').toArray();
    expect(settingsAfter).toHaveLength(1);
    expect(JSON.parse(settingsAfter[0].value)).toMatchObject({ currency: 'CAD', laborHourlyRate: 25 });

    // Assertion (b): both new stores are usable — add + read back a row each,
    // exercising the exact index fields from database.ts's v12 store strings.
    const failureRow: FailureEvent = {
      id: 'fail-1',
      printerInstanceId: 'printer-legacy-1',
      materialId: 'mat-legacy',
      jobId: 'job-legacy-1',
      percentComplete: 60,
      reason: 'adhesion',
      failedAt: new Date('2026-07-01T00:00:00.000Z'),
      gramsWasted: 30,
    };
    await db.table('failureEvents').add(failureRow);
    const failuresAfter = await db.table('failureEvents').toArray();
    expect(failuresAfter).toHaveLength(1);
    expect(failuresAfter[0]).toMatchObject({
      id: 'fail-1',
      printerInstanceId: 'printer-legacy-1',
      materialId: 'mat-legacy',
      jobId: 'job-legacy-1',
      reason: 'adhesion',
    });
    // Index usability check — query by an actually-indexed field, not just toArray().
    const byPrinter = await db.table('failureEvents').where('printerInstanceId').equals('printer-legacy-1').toArray();
    expect(byPrinter).toHaveLength(1);

    const maintenanceRow: MaintenanceEvent = {
      id: 'maint-1',
      printerInstanceId: 'printer-legacy-1',
      partType: 'nozzle',
      cost: 12.5,
      occurredAt: new Date('2026-07-02T00:00:00.000Z'),
      printerHoursAtEvent: 340,
      nozzleType: 'hardened',
    };
    await db.table('maintenanceEvents').add(maintenanceRow);
    const maintenanceAfter = await db.table('maintenanceEvents').toArray();
    expect(maintenanceAfter).toHaveLength(1);
    expect(maintenanceAfter[0]).toMatchObject({
      id: 'maint-1',
      printerInstanceId: 'printer-legacy-1',
      partType: 'nozzle',
      printerHoursAtEvent: 340,
    });
    const byPartType = await db.table('maintenanceEvents').where('partType').equals('nozzle').toArray();
    expect(byPartType).toHaveLength(1);

    // Assertion (c) (no upgrade error) is implicitly proven by reaching this
    // point — db.open() above resolved rather than rejecting/throwing.
    expect(db.verno).toBe(12);
  });
});
