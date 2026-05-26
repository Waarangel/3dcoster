import { describe, it, expect } from 'vitest';
import { backfillTagsOnJob, normalizeTagsOnJob, parseTagsInput, backfillQuotesFromJobs, backfillCustomersFromSales, reconcileCopiesSoldFromSales } from './backfill';
import type { PrintJob, Sale, Customer } from '../types';

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
    const quotes = backfillQuotesFromJobs(jobs, sales, 'USD');
    expect(quotes.length).toBe(2);
  });

  it("Job A (has sales) → status='converted' with convertedToSaleId=saleA.id + customerSnapshot from sale", () => {
    const quotes = backfillQuotesFromJobs(jobs, sales, 'USD');
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
    const quotes = backfillQuotesFromJobs(jobs, sales, 'USD');
    const qB = quotes.find(q => q.printJobId === 'job-b');
    expect(qB).toBeDefined();
    expect(qB!.status).toBe('draft');
    expect(qB!.quoteNumber).toBe(43);
    expect(qB!.convertedToSaleId).toBeUndefined();
    expect(qB!.customerSnapshot.name).toBe('');
    expect(qB!.convertedAt).toBeUndefined();
  });

  it('Job C (no quoteNumber) produces NO Quote — PrintJob row is untouched', () => {
    const quotes = backfillQuotesFromJobs(jobs, sales, 'USD');
    expect(quotes.find(q => q.printJobId === 'job-c')).toBeUndefined();
  });

  it("backfilled lineItemsSnapshot lifts sellingPrice + taxRate/taxAmount from the PrintJob, defaults currency='USD'", () => {
    const quotes = backfillQuotesFromJobs(jobs, sales, 'USD');
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
    const quotes = backfillQuotesFromJobs([jobMulti], [oldSale, newSale], 'USD');
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
    const quotes = backfillQuotesFromJobs([jobLegacy], [legacySale], 'USD');
    expect(quotes.length).toBe(1);
    expect(quotes[0].status).toBe('converted');
    expect(quotes[0].customerSnapshot.name).toBe('Legacy Larry');
  });

  it("threads the currency parameter into every emitted Quote's lineItemsSnapshot.currency (DATA-03 forward fix)", () => {
    const quotes = backfillQuotesFromJobs(jobs, sales, 'CAD');
    expect(quotes.length).toBe(2);
    for (const q of quotes) {
      expect(q.lineItemsSnapshot.currency).toBe('CAD');
    }
  });

  it("threads 'USD' when explicitly passed (locks the new-user default)", () => {
    const quotes = backfillQuotesFromJobs(jobs, sales, 'USD');
    for (const q of quotes) {
      expect(q.lineItemsSnapshot.currency).toBe('USD');
    }
  });
});

// ---------------------------------------------------------------------------
// backfillCustomersFromSales — second extension D-32 (gap K fix)
// ---------------------------------------------------------------------------

function makeSale(overrides: Partial<Sale>): Sale {
  return {
    id: 'sale-x',
    jobId: 'job-x',
    quantity: 1,
    unitPrice: 50,
    totalRevenue: 50,
    soldAt: new Date('2026-03-15'),
    ...overrides,
  } as Sale;
}

function makeExistingCustomer(overrides: Partial<Customer>): Customer {
  return {
    id: 'cust-' + Math.random().toString(36).slice(2, 9),
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as Customer;
}

describe('backfillCustomersFromSales (D-32 / gap K)', () => {
  it('returns empty array when there are no sales', () => {
    expect(backfillCustomersFromSales([], [])).toEqual([]);
  });

  it("emits a Customer for a Sale.customer with name+email when not already in library", () => {
    const sale = makeSale({
      id: 's-logan',
      customer: { name: 'Logan', email: 'logan@fleetstreet.com', company: 'Fleet Street Barber' },
    });
    const out = backfillCustomersFromSales([sale], []);
    expect(out.length).toBe(1);
    expect(out[0].name).toBe('Logan');
    expect(out[0].email).toBe('logan@fleetstreet.com');
    expect(out[0].company).toBe('Fleet Street Barber');
    expect(out[0].lastUsedAt?.getTime()).toBe(sale.soldAt.getTime());
  });

  it("dedups against existing Library customer by email (case-insensitive, trimmed)", () => {
    const existing = [makeExistingCustomer({ email: 'logan@fleetstreet.com', name: 'Logan' })];
    const sale = makeSale({
      customer: { name: 'Logan', email: 'LOGAN@fleetstreet.com  ' },  // capitalized + trailing space
    });
    const out = backfillCustomersFromSales([sale], existing);
    expect(out).toEqual([]);
  });

  it("falls back to name-key dedup when Sale.customer has no email", () => {
    const existing = [makeExistingCustomer({ name: 'Walk-in Buyer' })];
    const sale = makeSale({ customer: { name: 'walk-in buyer' } });  // case-insensitive name match
    const out = backfillCustomersFromSales([sale], existing);
    expect(out).toEqual([]);
  });

  it("skips Sales with no usable identity (no customer, no customerName, OR only whitespace)", () => {
    const s1 = makeSale({ customer: undefined });
    const s2 = makeSale({ customer: { name: '   ', email: '' } });
    const s3 = makeSale({ customerName: '   ' });
    expect(backfillCustomersFromSales([s1, s2, s3], [])).toEqual([]);
  });

  it("falls back to legacy Sale.customerName when Sale.customer is undefined (pre-Phase-14 records)", () => {
    const sale = makeSale({ customer: undefined, customerName: 'Legacy Larry' });
    const out = backfillCustomersFromSales([sale], []);
    expect(out.length).toBe(1);
    expect(out[0].name).toBe('Legacy Larry');
    expect(out[0].email).toBeUndefined();
  });

  it("aggregates multiple Sales for the same customer; lastUsedAt = most-recent soldAt", () => {
    const oldSale = makeSale({
      id: 's-old',
      customer: { name: 'Repeat Buyer', email: 'repeat@test.com' },
      soldAt: new Date('2026-01-01'),
    });
    const newSale = makeSale({
      id: 's-new',
      customer: { name: 'Repeat Buyer', email: 'repeat@test.com' },
      soldAt: new Date('2026-04-01'),
    });
    const out = backfillCustomersFromSales([oldSale, newSale], []);
    expect(out.length).toBe(1);  // single row, not two
    expect(out[0].lastUsedAt?.toISOString().slice(0, 10)).toBe('2026-04-01');
  });

  it("idempotent — running the helper twice with the freshly-inserted Customers in existingCustomers emits nothing on the second pass", () => {
    const sale = makeSale({ customer: { name: 'Once', email: 'once@test.com' } });
    const firstPass = backfillCustomersFromSales([sale], []);
    expect(firstPass.length).toBe(1);

    // Simulate the just-inserted Customer being in the library now
    const secondPass = backfillCustomersFromSales([sale], firstPass);
    expect(secondPass).toEqual([]);
  });

  it("when multiple Sales for the same customer have partial field coverage, merges non-empty fields across them", () => {
    const s1 = makeSale({
      customer: { name: 'Patchy', email: 'patchy@test.com' },
      soldAt: new Date('2026-01-01'),
    });
    const s2 = makeSale({
      customer: { name: 'Patchy', email: 'patchy@test.com', company: 'Patch Co', address: '12 Patch Ln' },
      soldAt: new Date('2026-02-01'),
    });
    const out = backfillCustomersFromSales([s1, s2], []);
    expect(out.length).toBe(1);
    expect(out[0].company).toBe('Patch Co');
    expect(out[0].address).toBe('12 Patch Ln');
  });
});

// ---------------------------------------------------------------------------
// reconcileCopiesSoldFromSales — second extension hotfix (post Convert-to-Sale regression)
// ---------------------------------------------------------------------------

describe('reconcileCopiesSoldFromSales — self-heal job.copiesSold', () => {
  function makeJobC(overrides: Partial<PrintJob>): PrintJob {
    return {
      id: 'job-x',
      name: 'Job X',
      createdAt: new Date(),
      updatedAt: new Date(),
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
  function makeSaleC(overrides: Partial<Sale>): Sale {
    return {
      id: 'sale-x',
      jobId: 'job-x',
      quantity: 1,
      unitPrice: 10,
      totalRevenue: 10,
      soldAt: new Date(),
      ...overrides,
    } as Sale;
  }

  it('returns empty when every job.copiesSold already matches its sales sum (idempotent / no-op)', () => {
    const jobs = [makeJobC({ id: 'a', copiesSold: 2 })];
    const sales = [makeSaleC({ jobId: 'a', quantity: 1 }), makeSaleC({ id: 'sb', jobId: 'a', quantity: 1 })];
    expect(reconcileCopiesSoldFromSales(jobs, sales)).toEqual([]);
  });

  it('emits a patch when job.copiesSold is BELOW the sales sum (the gap the regression created)', () => {
    const jobs = [makeJobC({ id: 'a', copiesSold: 0 })];
    const sales = [
      makeSaleC({ id: 's1', jobId: 'a', quantity: 1 }),
      makeSaleC({ id: 's2', jobId: 'a', quantity: 1 }),
    ];
    expect(reconcileCopiesSoldFromSales(jobs, sales)).toEqual([{ id: 'a', copiesSold: 2 }]);
  });

  it('emits a patch when job.copiesSold is ABOVE the sales sum (e.g. manual DB edit / deleted Sale that did not decrement)', () => {
    const jobs = [makeJobC({ id: 'a', copiesSold: 5 })];
    const sales = [makeSaleC({ id: 's1', jobId: 'a', quantity: 1 })];
    expect(reconcileCopiesSoldFromSales(jobs, sales)).toEqual([{ id: 'a', copiesSold: 1 }]);
  });

  it('sums Sale.quantity (not Sale count) — a Sale of qty=3 counts as 3', () => {
    const jobs = [makeJobC({ id: 'a', copiesSold: 0 })];
    const sales = [makeSaleC({ jobId: 'a', quantity: 3 })];
    expect(reconcileCopiesSoldFromSales(jobs, sales)).toEqual([{ id: 'a', copiesSold: 3 }]);
  });

  it('handles multiple jobs in one pass; only emits patches for the drifted ones', () => {
    const jobs = [
      makeJobC({ id: 'a', copiesSold: 0 }),  // drifted (expected 1)
      makeJobC({ id: 'b', copiesSold: 2 }),  // correct
      makeJobC({ id: 'c', copiesSold: 5 }),  // drifted (expected 0 — no sales)
    ];
    const sales = [
      makeSaleC({ jobId: 'a', quantity: 1 }),
      makeSaleC({ id: 's2', jobId: 'b', quantity: 2 }),
    ];
    const out = reconcileCopiesSoldFromSales(jobs, sales);
    expect(out).toHaveLength(2);
    expect(out).toContainEqual({ id: 'a', copiesSold: 1 });
    expect(out).toContainEqual({ id: 'c', copiesSold: 0 });
  });

  it('orphan Sales (jobId pointing at a deleted job) are silently ignored — no spurious patches', () => {
    const jobs = [makeJobC({ id: 'a', copiesSold: 0 })];
    const sales = [
      makeSaleC({ jobId: 'a', quantity: 1 }),
      makeSaleC({ id: 'orphan', jobId: 'job-that-was-deleted', quantity: 99 }),
    ];
    const out = reconcileCopiesSoldFromSales(jobs, sales);
    expect(out).toEqual([{ id: 'a', copiesSold: 1 }]);
  });

  it('empty input — no jobs, no sales — returns empty', () => {
    expect(reconcileCopiesSoldFromSales([], [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normalizeTagsOnJob — Phase 15 D-12 reconcile (per [[reconcile-legacy-data]])
//
// Mirrors the backfillTagsOnJob describe block structure — six cases asserting
// the D-02 normalization rules (lowercase + trim + dedupe + cap-at-10 + the
// /[^a-z0-9\s\-_]/g whitelist), plus the idempotency short-circuit.
// ---------------------------------------------------------------------------

describe('normalizeTagsOnJob (Phase 15 D-12)', () => {
  it('lowercases + trims existing tags', () => {
    const job: { tags?: string[] } = { tags: ['PLA', '  Phone-Stand  '] };
    const changed = normalizeTagsOnJob(job);
    expect(changed).toBe(true);
    expect(job.tags).toEqual(['pla', 'phone-stand']);
  });

  it('dedupes case-insensitively', () => {
    const job: { tags?: string[] } = { tags: ['pla', 'PLA', 'Pla'] };
    normalizeTagsOnJob(job);
    expect(job.tags).toEqual(['pla']);
  });

  it('strips emoji and punctuation via /[^a-z0-9\\s\\-_]/g whitelist', () => {
    const job: { tags?: string[] } = { tags: ['pla!!', 'phone💀stand', '@@@'] };
    normalizeTagsOnJob(job);
    expect(job.tags).toEqual(['pla', 'phonestand']);  // '@@@' → '' → dropped
  });

  it('caps at 10 tags, silently dropping the rest', () => {
    const job: { tags?: string[] } = { tags: Array.from({ length: 15 }, (_, i) => `tag${i}`) };
    normalizeTagsOnJob(job);
    expect(job.tags).toHaveLength(10);
  });

  it('returns false (no mutation) when already canonical', () => {
    const job: { tags?: string[] } = { tags: ['pla', 'phone-stand'] };
    const changed = normalizeTagsOnJob(job);
    expect(changed).toBe(false);
    expect(job.tags).toEqual(['pla', 'phone-stand']);
  });

  it('returns false when tags is undefined (Phase 12 backfill not yet run)', () => {
    const job: { tags?: string[] } = {};
    const changed = normalizeTagsOnJob(job);
    expect(changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseTagsInput — Phase 15 D-02 (input-path parse, shared with normalizeTagsOnJob)
//
// Six+ cases asserting the D-02 rules:
//   - comma split → trim → lowercase → filter empty → whitelist /[^a-z0-9\s\-_]/g
//   - dedupe via Set
//   - cap-at-10
//   - empty input → undefined (NOT [] — preserves "no tags ever set" semantic per D-02)
//   - multi-word tags preserved (comma is the only delimiter; spaces stay inside a tag)
// ---------------------------------------------------------------------------

describe('parseTagsInput (Phase 15 D-02)', () => {
  it('basic normalize — lowercases + trims + filters empty', () => {
    expect(parseTagsInput('PLA, phone-stand,  GLOSS ')).toEqual(['pla', 'phone-stand', 'gloss']);
  });

  it('dedupes case-insensitively (Set after lowercase)', () => {
    expect(parseTagsInput('a, A, a')).toEqual(['a']);
  });

  it('preserves multi-word tags — comma is the only delimiter, internal spaces stay', () => {
    expect(parseTagsInput('phone stand, pla')).toEqual(['phone stand', 'pla']);
  });

  it('empty input returns undefined (NOT [])', () => {
    expect(parseTagsInput('')).toBeUndefined();
  });

  it('whitespace-and-commas-only input returns undefined', () => {
    expect(parseTagsInput('   ,,,  ')).toBeUndefined();
  });

  it('caps at 10 tags — extras silently dropped', () => {
    const fifteen = Array.from({ length: 15 }, (_, i) => `tag${i}`).join(',');
    const out = parseTagsInput(fifteen);
    expect(out).toHaveLength(10);
  });

  it('strips emoji and punctuation via /[^a-z0-9\\s\\-_]/g whitelist — entries that strip to empty are dropped', () => {
    // 'emoji💀' → 'emoji', '@@@' → '' (dropped)
    expect(parseTagsInput('emoji💀,@@@')).toEqual(['emoji']);
  });

  it('returns undefined when every entry strips to empty', () => {
    expect(parseTagsInput('💀,@@@,!!!')).toBeUndefined();
  });
});
