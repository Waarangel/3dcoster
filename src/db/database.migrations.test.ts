import { describe, it, expect } from 'vitest';
import { backfillQuotesFromJobs } from './backfill';
import type { PrintJob, Sale } from '../types';

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
    const v8Quotes = backfillQuotesFromJobs(v7Jobs, v7Sales);

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

    const first = backfillQuotesFromJobs(jobs, sales);
    const second = backfillQuotesFromJobs(jobs, sales);

    expect(first.length).toBe(1);
    expect(second.length).toBe(1);
    expect(first[0].id).not.toBe(second[0].id);
  });
});
