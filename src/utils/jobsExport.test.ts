// ---------------------------------------------------------------------------
// Jobs & Sales CSV export — TDD suite written BEFORE src/utils/jobsExport.ts.
//
// Contract locks:
//  - Every cell passes through sanitizeCsvCell at the cell-serialization
//    boundary (Phase 21 SEC-01 / D-02 invariant extended to these exports).
//  - Money values are written VERBATIM with a per-row `currency` column —
//    never live-FX-converted (historical snapshots are immutable).
//  - Deprecated fields (PrintJob.customer, PrintJob.quoteNumber,
//    Sale.customerName, Sale.convertedFromQuoteId) never appear as columns.
//  - Dates serialize as ISO 8601 and round-trip losslessly.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import {
  generateJobsExportCsv,
  generateSalesExportCsv,
  buildExportFilename,
  JOBS_EXPORT_COLUMNS,
  SALES_EXPORT_COLUMNS,
} from './jobsExport';
import type { PrintJob, Sale } from '../types';

const TRIGGER_CHARS = new Set(['=', '+', '-', '@']);

const BASE_JOB: PrintJob = {
  id: 'job-1',
  name: 'Benchy',
  createdAt: new Date('2026-06-01T10:30:00.000Z'),
  updatedAt: new Date('2026-06-02T08:00:00.000Z'),
  filaments: [{ filamentId: 'fil-pla-red', grams: 120 }],
  printTimeHours: 4.5,
  printerInstanceId: 'printer-instance-1',
  modelCost: 2.5,
  prepTimeMinutes: 10,
  postProcessingMinutes: 15,
  materialsUsed: [],
  failureRate: 5,
  costPerUnit: 8.25,
  sellingPrice: 20,
  copiesSold: 3,
};

const BASE_SALE: Sale = {
  id: 'sale-1',
  jobId: 'job-1',
  quantity: 2,
  unitPrice: 20,
  totalRevenue: 40,
  soldAt: new Date('2026-06-05T14:45:30.000Z'),
};

const EMPTY_NAMES = new Map<string, string>();

function parseRows(csv: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return result.data;
}

function parseHeaders(csv: string): string[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return result.meta.fields ?? [];
}

// ---------------------------------------------------------------------------
// Header / column contract
// ---------------------------------------------------------------------------
describe('export column contracts', () => {
  it('jobs CSV header row equals JOBS_EXPORT_COLUMNS exactly', async () => {
    const csv = await generateJobsExportCsv([BASE_JOB], EMPTY_NAMES);
    expect(parseHeaders(csv)).toEqual([...JOBS_EXPORT_COLUMNS]);
  });

  it('sales CSV header row equals SALES_EXPORT_COLUMNS exactly', async () => {
    const csv = await generateSalesExportCsv([BASE_SALE], new Map([['job-1', BASE_JOB]]));
    expect(parseHeaders(csv)).toEqual([...SALES_EXPORT_COLUMNS]);
  });

  it('deprecated fields are absent from both column contracts', () => {
    const jobsCols = new Set<string>(JOBS_EXPORT_COLUMNS);
    const salesCols = new Set<string>(SALES_EXPORT_COLUMNS);
    // PrintJob.customer / PrintJob.quoteNumber are deprecated
    expect(jobsCols.has('customer')).toBe(false);
    expect(jobsCols.has('quote_number')).toBe(false);
    // Sale.customerName is deprecated; convertedFromQuoteId is internal
    expect(salesCols.has('customer_name_legacy')).toBe(false);
    expect(salesCols.has('converted_from_quote_id')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SEC-01 / D-02 — sanitizeCsvCell wiring (formula-injection guard)
// ---------------------------------------------------------------------------
describe('sanitizeCsvCell wiring — jobs export', () => {
  it('job name starting with = is single-quote prefixed in output', async () => {
    const job: PrintJob = { ...BASE_JOB, name: '=HYPERLINK("https://evil.com","click")' };
    const csv = await generateJobsExportCsv([job], EMPTY_NAMES);
    const row = parseRows(csv)[0];
    expect(row.name.startsWith("'=")).toBe(true);
  });

  it('trigger chars in notes, tags, model_url, marketplace, shipping_method are neutralized', async () => {
    const job: PrintJob = {
      ...BASE_JOB,
      notes: '+CMD()',
      tags: ['-evil-tag'],
      modelUrl: '@printables.com/x',
      marketplace: '=etsy',
      shippingMethod: '+local-post',
    };
    const csv = await generateJobsExportCsv([job], EMPTY_NAMES);
    const row = parseRows(csv)[0];
    expect(row.notes.startsWith("'+")).toBe(true);
    expect(row.tags.startsWith("'-")).toBe(true);
    expect(row.model_url.startsWith("'@")).toBe(true);
    expect(row.marketplace.startsWith("'=")).toBe(true);
    expect(row.shipping_method.startsWith("'+")).toBe(true);
  });

  it('no cell in jobs output starts with a trigger char (universal scan)', async () => {
    const job: PrintJob = {
      ...BASE_JOB,
      name: '=a',
      notes: '+b',
      tags: ['-c', '@d'],
      modelUrl: '@e',
      marketplace: '=f',
      shippingMethod: '-g',
    };
    const csv = await generateJobsExportCsv([job], EMPTY_NAMES);
    for (const row of parseRows(csv)) {
      for (const [col, val] of Object.entries(row)) {
        if (val.length > 0) {
          expect(
            TRIGGER_CHARS.has(val[0]),
            `jobs CSV cell [${col}]="${val}" starts with a trigger char`,
          ).toBe(false);
        }
      }
    }
  });
});

describe('sanitizeCsvCell wiring — sales export', () => {
  it('customer name, notes, and marketplace trigger chars are neutralized', async () => {
    const sale: Sale = {
      ...BASE_SALE,
      customer: { name: '=IMPORTXML("https://evil.com","//x")', email: '@evil.com' },
      notes: '-2+3',
      marketplace: '+ebay',
    };
    const csv = await generateSalesExportCsv([sale], new Map([['job-1', BASE_JOB]]));
    const row = parseRows(csv)[0];
    expect(row.customer_name.startsWith("'=")).toBe(true);
    expect(row.customer_email.startsWith("'@")).toBe(true);
    expect(row.notes.startsWith("'-")).toBe(true);
    expect(row.marketplace.startsWith("'+")).toBe(true);
  });

  it('a job name starting with a trigger char is neutralized in the denormalized job_name column', async () => {
    const evilJob: PrintJob = { ...BASE_JOB, name: '=SUM(A1)' };
    const csv = await generateSalesExportCsv([BASE_SALE], new Map([['job-1', evilJob]]));
    const row = parseRows(csv)[0];
    expect(row.job_name.startsWith("'=")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Currency snapshot preservation — NO live conversion
// ---------------------------------------------------------------------------
describe('currency snapshot preservation', () => {
  it('EUR job exports currency=EUR and selling_price verbatim', async () => {
    const job: PrintJob = { ...BASE_JOB, currency: 'EUR', sellingPrice: 20 };
    const row = parseRows(await generateJobsExportCsv([job], EMPTY_NAMES))[0];
    expect(row.currency).toBe('EUR');
    expect(row.selling_price).toBe('20');
  });

  it('GBP sale exports currency=GBP and money fields verbatim', async () => {
    const sale: Sale = { ...BASE_SALE, currency: 'GBP', unitPrice: 15.5, totalRevenue: 31 };
    const row = parseRows(await generateSalesExportCsv([sale], new Map()))[0];
    expect(row.currency).toBe('GBP');
    expect(row.unit_price).toBe('15.5');
    expect(row.total_revenue).toBe('31');
  });

  it('mixed-currency jobs each keep their own snapshot currency', async () => {
    const eur: PrintJob = { ...BASE_JOB, id: 'j-eur', currency: 'EUR', sellingPrice: 18 };
    const usd: PrintJob = { ...BASE_JOB, id: 'j-usd', currency: 'USD', sellingPrice: 22 };
    const rows = parseRows(await generateJobsExportCsv([eur, usd], EMPTY_NAMES));
    expect(rows[0].currency).toBe('EUR');
    expect(rows[0].selling_price).toBe('18');
    expect(rows[1].currency).toBe('USD');
    expect(rows[1].selling_price).toBe('22');
  });
});

// ---------------------------------------------------------------------------
// Empty / undefined handling
// ---------------------------------------------------------------------------
describe('empty and undefined field handling', () => {
  it('undefined optionals render as empty strings, never "undefined"/"null"', async () => {
    const row = parseRows(await generateJobsExportCsv([BASE_JOB], EMPTY_NAMES))[0];
    expect(row.tax_rate).toBe('');
    expect(row.notes).toBe('');
    expect(row.tags).toBe('');
    expect(row.marketplace).toBe('');
    expect(row.currency).toBe('');
    const csv = await generateJobsExportCsv([BASE_JOB], EMPTY_NAMES);
    expect(csv).not.toContain('undefined');
    expect(csv).not.toContain('null');
  });

  it('null shippingOverrideCost renders as empty string', async () => {
    const job: PrintJob = { ...BASE_JOB, shippingOverrideCost: null };
    const row = parseRows(await generateJobsExportCsv([job], EMPTY_NAMES))[0];
    expect(row.shipping_override_cost).toBe('');
  });

  it('empty filaments/materials arrays render as empty cells without crashing', async () => {
    const job: PrintJob = { ...BASE_JOB, filaments: [], materialsUsed: [], packagingMaterials: [] };
    const row = parseRows(await generateJobsExportCsv([job], EMPTY_NAMES))[0];
    expect(row.filaments).toBe('');
    expect(row.materials_used).toBe('');
    expect(row.packaging_materials).toBe('');
  });

  it('sale whose job is missing from jobsById gets empty job_name (deleted-job case)', async () => {
    const sale: Sale = { ...BASE_SALE, jobId: 'job-deleted' };
    const row = parseRows(await generateSalesExportCsv([sale], new Map()))[0];
    expect(row.job_name).toBe('');
  });

  it('sale with no customer and no legacy customerName exports empty customer cells', async () => {
    const row = parseRows(await generateSalesExportCsv([BASE_SALE], new Map()))[0];
    expect(row.customer_name).toBe('');
    expect(row.customer_email).toBe('');
  });

  it('legacy sale with only deprecated customerName falls back for customer_name', async () => {
    const sale: Sale = { ...BASE_SALE, customerName: 'Old Buyer' };
    const row = parseRows(await generateSalesExportCsv([sale], new Map()))[0];
    expect(row.customer_name).toBe('Old Buyer');
    expect(row.customer_email).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Date serialization — ISO 8601 lossless round-trip
// ---------------------------------------------------------------------------
describe('date serialization', () => {
  it('createdAt/updatedAt export as ISO strings that round-trip losslessly', async () => {
    const row = parseRows(await generateJobsExportCsv([BASE_JOB], EMPTY_NAMES))[0];
    expect(new Date(row.created_at).getTime()).toBe(BASE_JOB.createdAt.getTime());
    expect(new Date(row.updated_at).getTime()).toBe(BASE_JOB.updatedAt.getTime());
  });

  it('soldAt exports as ISO string and row order follows input order', async () => {
    const earlier: Sale = { ...BASE_SALE, id: 's-1', soldAt: new Date('2026-06-05T09:00:00.000Z') };
    const later: Sale = { ...BASE_SALE, id: 's-2', soldAt: new Date('2026-06-05T17:00:00.000Z') };
    const rows = parseRows(await generateSalesExportCsv([earlier, later], new Map()));
    expect(new Date(rows[0].sold_at).getTime()).toBe(earlier.soldAt.getTime());
    expect(new Date(rows[1].sold_at).getTime()).toBe(later.soldAt.getTime());
    expect(rows[0].id).toBe('s-1');
    expect(rows[1].id).toBe('s-2');
  });
});

// ---------------------------------------------------------------------------
// Nested-array flattening (one row per record, pipe-joined summaries)
// ---------------------------------------------------------------------------
describe('nested-array flattening', () => {
  it('multi-filament job stays one row with name:grams summary, resolving names via the map', async () => {
    const job: PrintJob = {
      ...BASE_JOB,
      filaments: [
        { filamentId: 'fil-pla-red', grams: 120 },
        { filamentId: 'fil-petg-black', grams: 40 },
      ],
    };
    const names = new Map([
      ['fil-pla-red', 'PLA Red'],
      ['fil-petg-black', 'PETG Black'],
    ]);
    const rows = parseRows(await generateJobsExportCsv([job], names));
    expect(rows).toHaveLength(1);
    expect(rows[0].filaments).toBe('PLA Red:120g|PETG Black:40g');
  });

  it('unresolvable filamentId falls back to the raw id', async () => {
    const row = parseRows(await generateJobsExportCsv([BASE_JOB], EMPTY_NAMES))[0];
    expect(row.filaments).toBe('fil-pla-red:120g');
  });

  it('materialsUsed flattens to name:quantity pipe-joined, resolving via the map', async () => {
    const job: PrintJob = {
      ...BASE_JOB,
      materialsUsed: [
        { materialId: 'mat-glue', quantity: 2 },
        { materialId: 'mat-box', quantity: 1 },
      ],
    };
    const names = new Map([['mat-glue', 'Glue Stick']]);
    const row = parseRows(await generateJobsExportCsv([job], names))[0];
    expect(row.materials_used).toBe('Glue Stick:2|mat-box:1');
  });

  it('tags join with | matching the assets export convention', async () => {
    const job: PrintJob = { ...BASE_JOB, tags: ['etsy', 'gift'] };
    const row = parseRows(await generateJobsExportCsv([job], EMPTY_NAMES))[0];
    expect(row.tags).toBe('etsy|gift');
  });
});

// ---------------------------------------------------------------------------
// Filename convention
// ---------------------------------------------------------------------------
describe('buildExportFilename', () => {
  it.each(['jobs', 'sales', 'assets'] as const)(
    "buildExportFilename('%s') matches 3dcoster-<entity>-YYYY-MM-DD.csv",
    entity => {
      expect(buildExportFilename(entity)).toMatch(
        new RegExp(`^3dcoster-${entity}-\\d{4}-\\d{2}-\\d{2}\\.csv$`),
      );
    },
  );

  // Scope segment — filtered exports name their scope so a partial file is
  // never mistaken for a full backup.
  it("scope appears between entity and date: ('assets', 'filament')", () => {
    expect(buildExportFilename('assets', 'filament')).toMatch(
      /^3dcoster-assets-filament-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  it("('jobs', 'filtered') names search-scoped exports", () => {
    expect(buildExportFilename('jobs', 'filtered')).toMatch(
      /^3dcoster-jobs-filtered-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  it('user-typed custom category scope is sanitized for the filesystem', () => {
    expect(buildExportFilename('assets', 'My Stuff!')).toMatch(
      /^3dcoster-assets-my-stuff-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  it('scope that sanitizes to nothing is omitted entirely', () => {
    expect(buildExportFilename('assets', '!!!')).toMatch(
      /^3dcoster-assets-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  it('overlong scope is truncated to 30 chars', () => {
    const scope = 'x'.repeat(80);
    const name = buildExportFilename('assets', scope);
    expect(name).toMatch(/^3dcoster-assets-x{30}-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
