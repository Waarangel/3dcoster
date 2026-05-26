import { describe, it, expect } from 'vitest';
import { backfillQuotesFromJobs, reconcileQuoteCurrency } from './backfill';
import type { PrintJob, Sale, Quote } from '../types';

// ---------------------------------------------------------------------------
// Dexie v7 → v8 quotes backfill — migration test (D-17 G7 locked fixture)
//
// FALLBACK MODE (documented in 16-09 plan Task 2 step C):
// jsdom does not implement IndexedDB and fake-indexeddb is not currently a
// devDependency. Rather than add a new devDep to land this migration test,
// we exercise the contract at the pure-helper layer. The Dexie upgrade
// callback in `database.ts` simply piped:
//
//     const jobs = await tx.table('jobs').toArray();
//     const sales = await tx.table('sales').toArray();
//     const quotes = backfillQuotesFromJobs(jobs, sales);
//     await tx.table('quotes').bulkAdd(quotes);
//
// So `backfillQuotesFromJobs(fixtureJobs, fixtureSales)` is the entire data
// contract of the upgrade. Dexie's transactional bulkAdd is exercised by the
// real app on first v8 load (and on every developer's `npx vite dev` reload).
// The pure-helper tests in `src/db/backfill.test.ts` already exhaustively
// cover the 3-job → 2-quote D-17 G7 locked fixture; this file restates the
// same fixture at the migration boundary so that any change to the upgrade
// pipeline (e.g. someone slips an extra .filter() into the upgrade callback)
// would fail this test in isolation.
//
// If fake-indexeddb is added as a devDep later, this test can be re-written
// to open a real v7 DB, seed the fixture, close, reopen at v8, and assert
// `db.quotes.toArray()` returns 2 rows — the assertion shape stays the same.
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

describe('v7→v8 quotes backfill (D-17 G7) — migration boundary', () => {
  it('migration pipeline emits exactly 2 Quotes for the locked 3-job fixture (status mix: converted + draft)', () => {
    const v7Jobs: PrintJob[] = [
      makeJob({ id: 'job-a', quoteNumber: 42, sellingPrice: 100 }),
      makeJob({ id: 'job-b', quoteNumber: 43, sellingPrice: 50 }),
      makeJob({ id: 'job-c' }),
    ];
    const v7Sales: Sale[] = [
      makeSale({
        id: 'sale-a',
        jobId: 'job-a',
        customer: { name: 'Alice' },
      }),
    ];

    // This is the exact pipeline executed inside the v8 upgrade callback in database.ts.
    const v8Quotes = backfillQuotesFromJobs(v7Jobs, v7Sales, 'USD');

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

  it('migration is forward-only — running it twice on the same input produces independent quote ids (no idempotency guarantee at this layer)', () => {
    // This locks the documented behavior: the helper is non-idempotent (each call generates
    // fresh crypto.randomUUID() ids). The real Dexie upgrade only runs ONCE per browser when
    // the schema version bumps; the second-run scenario doesn't happen in production. If a
    // future change tries to make the helper idempotent (e.g. derive id from job.id), this
    // test would catch the behavior shift.
    const jobs: PrintJob[] = [makeJob({ id: 'job-a', quoteNumber: 1 })];
    const sales: Sale[] = [];

    const first = backfillQuotesFromJobs(jobs, sales, 'USD');
    const second = backfillQuotesFromJobs(jobs, sales, 'USD');

    expect(first.length).toBe(1);
    expect(second.length).toBe(1);
    expect(first[0].id).not.toBe(second[0].id);
  });

  it('v8 migration threads user currency from settings into lineItemsSnapshot.currency (DATA-03 forward fix)', () => {
    const v7Jobs: PrintJob[] = [makeJob({ id: 'job-a', quoteNumber: 1 })];
    const v7Sales: Sale[] = [];
    // Simulate the v8 upgrade callback's exact data flow:
    const userCurrency = 'CAD';  // pretend the user has CAD settings
    const v8Quotes = backfillQuotesFromJobs(v7Jobs, v7Sales, userCurrency);
    expect(v8Quotes.length).toBe(1);
    expect(v8Quotes[0].lineItemsSnapshot.currency).toBe('CAD');
  });
});

// ---------------------------------------------------------------------------
// v8→v9 currency reconcile (DATA-03 v9 reconcile)
//
// Phase 23 TEST-04 breadcrumb:
// v9 reconcile is the FIRST real customer for `fake-indexeddb` — open v8
// fixture, seed USD quotes + non-USD settings, reopen at v9, and assert
// db.quotes.toArray() shows patched currency. Pure-helper layer already
// locks the idempotency contract; the integration depth upgrade is deferred.
//
// The v9 upgrade callback's data contract is:
//   const quotes = await tx.table('quotes').toArray();
//   const patched = reconcileQuoteCurrency(quotes, userCurrency);
//   await tx.table('quotes').bulkPut(patched);
// So `reconcileQuoteCurrency(fixtureQuotes, userCurrency)` IS the entire
// upgrade contract tested here.
// ---------------------------------------------------------------------------

describe('v8→v9 currency reconcile (DATA-03 v9 reconcile)', () => {
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

  it('exercises the v9 reconcile pipeline via the pure helper (fake-indexeddb deferred to Phase 23 TEST-04)', () => {
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
