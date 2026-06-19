import { describe, it, expect } from 'vitest';
import { computeSalesReport, type SalesReportRange } from './salesReportAggregates';
import type { Sale, PrintJob, Currency } from '../types';

const RANGE: SalesReportRange = {
  start: new Date('2026-06-01T00:00:00.000Z'),
  end: new Date('2026-06-30T23:59:59.999Z'),
  label: 'June 2026',
};

let n = 0;
function sale(p: Partial<Sale> = {}): Sale {
  return {
    id: `s${++n}`,
    jobId: 'j1',
    quantity: 1,
    unitPrice: 20,
    totalRevenue: 20,
    soldAt: new Date('2026-06-15T12:00:00.000Z'),
    currency: 'CAD',
    ...p,
  } as Sale;
}
const job = (costPerUnit: number, currency: Currency = 'CAD'): PrintJob =>
  ({ costPerUnit, currency } as unknown as PrintJob);
const jobs = new Map<string, PrintJob>([['j1', job(8)]]);

describe('computeSalesReport', () => {
  it('returns zeroed totals for an empty range', () => {
    const r = computeSalesReport([], jobs, RANGE, 'CAD', null);
    expect(r.saleCount).toBe(0);
    expect(r.grossRevenue).toBe(0);
    expect(r.profit).toBe(0);
    expect(r.byMarketplace).toEqual([]);
    expect(r.hasPartialData).toBe(false);
  });

  it('computes gross / fees / net / cost / profit for a single-currency sale', () => {
    const r = computeSalesReport(
      [sale({ totalRevenue: 50, marketplaceFee: 5, quantity: 2, marketplace: 'etsy' })],
      jobs, RANGE, 'CAD', null,
    );
    expect(r.saleCount).toBe(1);
    expect(r.itemCount).toBe(2);
    expect(r.grossRevenue).toBe(50);
    expect(r.fees).toBe(5);
    expect(r.netRevenue).toBe(45);
    expect(r.cost).toBe(16);          // costPerUnit 8 × qty 2
    expect(r.profit).toBe(29);        // 45 - 16
    expect(r.byMarketplace).toEqual([
      { marketplace: 'etsy', saleCount: 1, itemCount: 2, grossRevenue: 50, fees: 5, netRevenue: 45 },
    ]);
  });

  it('excludes sales outside the range and includes the exact boundaries', () => {
    const r = computeSalesReport([
      sale({ soldAt: new Date('2026-05-31T23:59:59.000Z'), totalRevenue: 999 }), // before
      sale({ soldAt: RANGE.start, totalRevenue: 10 }),                            // == start
      sale({ soldAt: RANGE.end, totalRevenue: 20 }),                              // == end
      sale({ soldAt: new Date('2026-07-01T00:00:01.000Z'), totalRevenue: 999 }), // after
    ], jobs, RANGE, 'CAD', null);
    expect(r.saleCount).toBe(2);
    expect(r.grossRevenue).toBe(30);
  });

  it('groups by marketplace and sorts by sale count', () => {
    const r = computeSalesReport([
      sale({ marketplace: 'etsy', totalRevenue: 10 }),
      sale({ marketplace: 'etsy', totalRevenue: 10 }),
      sale({ marketplace: undefined, totalRevenue: 10 }), // → 'none'
    ], jobs, RANGE, 'CAD', null);
    expect(r.byMarketplace.map(m => [m.marketplace, m.saleCount])).toEqual([
      ['etsy', 2],
      ['none', 1],
    ]);
  });

  it('nulls money totals (but keeps counts) when a currency cannot be converted', () => {
    const r = computeSalesReport(
      [sale({ currency: 'USD', totalRevenue: 30, marketplace: 'etsy' })], // USD, no table → no CAD rate
      jobs, RANGE, 'CAD', null,
    );
    expect(r.saleCount).toBe(1);
    expect(r.itemCount).toBe(1);
    expect(r.grossRevenue).toBeNull();
    expect(r.fees).toBeNull();
    expect(r.netRevenue).toBeNull();
    expect(r.profit).toBeNull();
    expect(r.hasPartialData).toBe(true);
    expect(r.byMarketplace[0]).toMatchObject({ marketplace: 'etsy', saleCount: 1, grossRevenue: null });
  });

  it('treats a sale whose job is missing as zero cost', () => {
    const r = computeSalesReport(
      [sale({ jobId: 'gone', totalRevenue: 40, marketplaceFee: 0 })],
      new Map(), RANGE, 'CAD', null,
    );
    expect(r.cost).toBe(0);
    expect(r.profit).toBe(40);
  });
});
