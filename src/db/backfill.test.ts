import { describe, it, expect } from 'vitest';
import { backfillTagsOnJob, backfillQuotesFromJobs } from './backfill';
import type { PrintJob, Sale } from '../types';

describe('backfillTagsOnJob', () => {
  it('sets tags=[] when the field is missing (most common v5 path)', () => {
    const job: Record<string, unknown> = { id: '1' };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual([]);
  });

  it('preserves an existing array of tags (idempotency / re-run safety)', () => {
    const job: Record<string, unknown> = { id: '1', tags: ['a', 'b'] };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual(['a', 'b']);
  });

  it('replaces a string tags value with [] (manually-edited IndexedDB corruption)', () => {
    const job: Record<string, unknown> = { id: '1', tags: 'oops' };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual([]);
  });

  it('replaces null tags with [] (null-injected row)', () => {
    const job: Record<string, unknown> = { id: '1', tags: null };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual([]);
  });

  it('replaces a number tags value with [] (broad Array.isArray guard)', () => {
    const job: Record<string, unknown> = { id: '1', tags: 42 };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// backfillQuotesFromJobs — Phase 16 gap closure D-17 G7 locked fixture
//
// The locked test: 3 PrintJobs in, exactly 2 Quotes out.
//   - Job A: quoteNumber=42, 1 Sale  → Quote(status='converted', convertedToSaleId=saleA.id)
//   - Job B: quoteNumber=43, 0 Sales → Quote(status='draft')
//   - Job C: no quoteNumber         → NO Quote emitted
// ---------------------------------------------------------------------------

function makeMinimalJob(overrides: Partial<PrintJob>): PrintJob {
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

describe('backfillQuotesFromJobs (D-17 G7 locked fixture)', () => {
  const jobA = makeMinimalJob({
    id: 'job-a',
    name: 'Quote A',
    quoteNumber: 42,
    sellingPrice: 100,
    taxRate: 13,
    taxAmount: 13,
  });
  const jobB = makeMinimalJob({
    id: 'job-b',
    name: 'Quote B',
    quoteNumber: 43,
    sellingPrice: 50,
  });
  const jobC = makeMinimalJob({
    id: 'job-c',
    name: 'Quote C (no number)',
    // intentionally no quoteNumber
  });

  const saleA = makeMinimalSale({
    id: 'sale-a',
    jobId: 'job-a',
    soldAt: new Date('2026-04-10'),
    customer: { name: 'Alice', email: 'alice@example.com' },
  });

  const jobs = [jobA, jobB, jobC];
  const sales = [saleA];

  it('emits exactly 2 Quotes for 3 PrintJobs (Job C without quoteNumber is skipped)', () => {
    const quotes = backfillQuotesFromJobs(jobs, sales);
    expect(quotes.length).toBe(2);
  });

  it("Job A (has sales) → status='converted' with convertedToSaleId=saleA.id + customerSnapshot from sale", () => {
    const quotes = backfillQuotesFromJobs(jobs, sales);
    const qA = quotes.find(q => q.printJobId === 'job-a');
    expect(qA).toBeDefined();
    expect(qA!.status).toBe('converted');
    expect(qA!.quoteNumber).toBe(42);
    expect(qA!.convertedToSaleId).toBe('sale-a');
    expect(qA!.customerSnapshot.name).toBe('Alice');
    expect(qA!.customerSnapshot.email).toBe('alice@example.com');
    expect(qA!.convertedAt).toBeInstanceOf(Date);
  });

  it("Job B (no sales) → status='draft' with no convertedToSaleId + empty customerSnapshot", () => {
    const quotes = backfillQuotesFromJobs(jobs, sales);
    const qB = quotes.find(q => q.printJobId === 'job-b');
    expect(qB).toBeDefined();
    expect(qB!.status).toBe('draft');
    expect(qB!.quoteNumber).toBe(43);
    expect(qB!.convertedToSaleId).toBeUndefined();
    expect(qB!.customerSnapshot.name).toBe('');
    expect(qB!.convertedAt).toBeUndefined();
  });

  it('Job C (no quoteNumber) produces NO Quote — PrintJob row is untouched', () => {
    const quotes = backfillQuotesFromJobs(jobs, sales);
    expect(quotes.find(q => q.printJobId === 'job-c')).toBeUndefined();
  });

  it("backfilled lineItemsSnapshot lifts sellingPrice + taxRate/taxAmount from the PrintJob, defaults currency='USD'", () => {
    const quotes = backfillQuotesFromJobs(jobs, sales);
    const qA = quotes.find(q => q.printJobId === 'job-a');
    expect(qA!.lineItemsSnapshot.sellingPrice).toBe(100);
    expect(qA!.lineItemsSnapshot.resolvedTaxRate).toBe(13);
    expect(qA!.lineItemsSnapshot.taxAmount).toBe(13);
    expect(qA!.lineItemsSnapshot.shippingCost).toBe(0);
    expect(qA!.lineItemsSnapshot.currency).toBe('USD');
    expect(qA!.lineItemsSnapshot.jobTitle).toBe('Quote A');
  });

  it('uses most-recent Sale when a job has multiple sales (sorted desc by soldAt)', () => {
    const jobMulti = makeMinimalJob({ id: 'job-m', quoteNumber: 99, name: 'Job M' });
    const oldSale = makeMinimalSale({
      id: 'sale-old',
      jobId: 'job-m',
      soldAt: new Date('2026-01-01'),
      customer: { name: 'Old Bob' },
    });
    const newSale = makeMinimalSale({
      id: 'sale-new',
      jobId: 'job-m',
      soldAt: new Date('2026-04-15'),
      customer: { name: 'New Carol' },
    });
    const quotes = backfillQuotesFromJobs([jobMulti], [oldSale, newSale]);
    expect(quotes.length).toBe(1);
    expect(quotes[0].status).toBe('converted');
    expect(quotes[0].convertedToSaleId).toBe('sale-new');
    expect(quotes[0].customerSnapshot.name).toBe('New Carol');
  });

  it('falls back to legacy customerName when Sale.customer is undefined (pre-Phase-14 records)', () => {
    const jobLegacy = makeMinimalJob({ id: 'job-l', quoteNumber: 7 });
    const legacySale = makeMinimalSale({
      id: 'sale-l',
      jobId: 'job-l',
      customer: undefined,
      customerName: 'Legacy Larry',
    });
    const quotes = backfillQuotesFromJobs([jobLegacy], [legacySale]);
    expect(quotes.length).toBe(1);
    expect(quotes[0].status).toBe('converted');
    expect(quotes[0].customerSnapshot.name).toBe('Legacy Larry');
  });
});
