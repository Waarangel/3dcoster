import { describe, it, expect, vi } from 'vitest';
import { generateSalesReportPdfBytes } from './generateSalesReportPdf';
import type { SalesReportData } from '../utils/salesReportAggregates';

// Tauri plugins are only reached when __IS_TAURI__ is true; the bytes path never
// touches them, but mock them so the module graph resolves under vitest.
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: vi.fn() }));

function makeData(p: Partial<SalesReportData> = {}): SalesReportData {
  return {
    range: { start: new Date('2026-06-01'), end: new Date('2026-06-30'), label: 'June 2026' },
    userCurrency: 'CAD',
    saleCount: 3,
    itemCount: 5,
    grossRevenue: 150,
    fees: 12,
    netRevenue: 138,
    cost: 60,
    profit: 78,
    byMarketplace: [
      { marketplace: 'etsy', saleCount: 2, itemCount: 3, grossRevenue: 100, fees: 10, netRevenue: 90 },
      { marketplace: 'none', saleCount: 1, itemCount: 2, grossRevenue: 50, fees: 2, netRevenue: 48 },
    ],
    hasPartialData: false,
    ...p,
  };
}

const magic = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes.slice(0, 5));

describe('generateSalesReportPdf', () => {
  it('produces a valid, non-trivial PDF', async () => {
    const bytes = await generateSalesReportPdfBytes(makeData());
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(magic(bytes)).toBe('%PDF-');
  });

  it('renders the partial-data + empty-marketplace path without throwing', async () => {
    const bytes = await generateSalesReportPdfBytes(makeData({
      grossRevenue: null, fees: null, netRevenue: null, cost: null, profit: null,
      byMarketplace: [], hasPartialData: true,
    }));
    expect(magic(bytes)).toBe('%PDF-');
  });
});
