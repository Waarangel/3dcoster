import { describe, it, expect } from 'vitest';
import {
  parseCustomerCsv,
  buildCustomersForImport,
  type ParsedCustomerRow,
} from './customerCsv';
import type { Customer } from '../types';

// Tiny CSV string builder so each test stays readable.
const csv = (headers: string[], ...rows: string[][]) =>
  [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

describe('parseCustomerCsv (Phase 15.1 — CL-03 / D-09 / D-07)', () => {
  it('Test 1: empty string → globalErrors = ["CSV file is empty"], rows empty', async () => {
    const result = await parseCustomerCsv('', []);
    expect(result.globalErrors).toEqual(['CSV file is empty']);
    expect(result.rows).toEqual([]);
  });

  it('Test 2: header-only CSV → 0 rows, no global errors', async () => {
    const result = await parseCustomerCsv('name,email,company,address,notes', []);
    expect(result.rows).toEqual([]);
    expect(result.globalErrors).toEqual([]);
  });

  it('Test 3: row with only name → 1 row, customer.name preserved, customer.email undefined', async () => {
    const result = await parseCustomerCsv(
      csv(['name', 'email', 'company', 'address', 'notes'], ['Alice', '', '', '', '']),
      [],
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.customer).not.toBeNull();
    expect(row.customer?.name).toBe('Alice');
    expect(row.customer?.email).toBeUndefined();
    expect(row.errors).toEqual([]);
  });

  it('Test 4: row with only email in uppercase → customer.email is lowercased (discretion #8)', async () => {
    const result = await parseCustomerCsv(
      csv(['name', 'email'], ['', 'ALICE@EXAMPLE.COM']),
      [],
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.customer).not.toBeNull();
    expect(row.customer?.email).toBe('alice@example.com');
    expect(row.customer?.name).toBeUndefined();
    expect(row.errors).toEqual([]);
  });

  it('Test 5: row with both name and email blank (whitespace only) → "Name or Email required"', async () => {
    const result = await parseCustomerCsv(
      csv(['name', 'email', 'company'], ['   ', '  ', 'AcmeCo']),
      [],
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.customer).toBeNull();
    expect(row.errors).toEqual(['Name or Email required']);
  });

  it('Test 6: row with email "not-an-email" (no @) → "Email format invalid"', async () => {
    const result = await parseCustomerCsv(
      csv(['name', 'email'], ['Bob', 'not-an-email']),
      [],
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.customer).toBeNull();
    expect(row.errors).toEqual(['Email format invalid']);
  });

  it('Test 7: uppercase headers (NAME, EMAIL, COMPANY, ADDRESS, NOTES) → case-insensitive parsing', async () => {
    const result = await parseCustomerCsv(
      csv(
        ['NAME', 'EMAIL', 'COMPANY', 'ADDRESS', 'NOTES'],
        ['Carol', 'carol@x.com', 'AcmeCo', '12 Lane', 'note here'],
      ),
      [],
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.customer?.name).toBe('Carol');
    expect(row.customer?.email).toBe('carol@x.com');
    expect(row.customer?.company).toBe('AcmeCo');
    expect(row.customer?.address).toBe('12 Lane');
    expect(row.customer?.notes).toBe('note here');
    expect(row.errors).toEqual([]);
  });

  it('Test 8: extra unknown column (phone) → ignored silently; known columns parse fine', async () => {
    const result = await parseCustomerCsv(
      csv(['name', 'email', 'phone'], ['Dan', 'dan@x.com', '555-1234']),
      [],
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.customer?.name).toBe('Dan');
    expect(row.customer?.email).toBe('dan@x.com');
    // phone is in row.data (raw) but not on the customer object.
    expect((row.customer as Record<string, unknown>).phone).toBeUndefined();
    expect(row.errors).toEqual([]);
  });

  it('Test 9: existing Alice@Example.com matched by incoming alice@example.com (case-insensitive)', async () => {
    const existing: Customer[] = [
      { id: 'c-1', createdAt: new Date('2026-01-01'), email: 'Alice@Example.com' },
    ];
    const result = await parseCustomerCsv(
      csv(['name', 'email'], ['Alice Smith', 'alice@example.com']),
      existing,
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.isDuplicate).toBe(true);
    expect(row.existingCustomerId).toBe('c-1');
  });
});

describe('buildCustomersForImport (Phase 15.1 — D-11 merge semantics)', () => {
  it('Test 10: non-duplicate row → output Customer has fresh UUID, createdAt Date, lastUsedAt undefined', () => {
    const row: ParsedCustomerRow = {
      rowNumber: 2,
      data: {},
      customer: { name: 'NewName', email: 'new@x.com' },
      errors: [],
      warnings: [],
      isDuplicate: false,
    };
    const result = buildCustomersForImport(
      [row],
      new Map(),
      new Set([2]),
      'skip',
    );
    expect(result).toHaveLength(1);
    const out = result[0];
    expect(typeof out.id).toBe('string');
    expect(out.id.length).toBeGreaterThan(0);
    expect(out.createdAt).toBeInstanceOf(Date);
    expect(out.lastUsedAt).toBeUndefined();
    expect(out.name).toBe('NewName');
    expect(out.email).toBe('new@x.com');
  });

  it('Test 11: duplicate row + skip mode → output array excludes it', () => {
    const existing: Customer = {
      id: 'c-1',
      createdAt: new Date('2026-01-01'),
      email: 'a@x.com',
      name: 'OldName',
    };
    const row: ParsedCustomerRow = {
      rowNumber: 2,
      data: {},
      customer: { name: 'NewName', email: 'a@x.com' },
      errors: [],
      warnings: [],
      isDuplicate: true,
      existingCustomerId: 'c-1',
    };
    const result = buildCustomersForImport(
      [row],
      new Map([[existing.id, existing]]),
      new Set([2]),
      'skip',
    );
    expect(result).toHaveLength(0);
  });

  it('Test 12: duplicate row + overwrite mode with only name set → preserves all other existing fields (D-11)', () => {
    const oldDate = new Date('2025-12-01');
    const oldLastUsed = new Date('2026-02-15');
    const existing: Customer = {
      id: 'c-1',
      createdAt: oldDate,
      lastUsedAt: oldLastUsed,
      name: 'OldName',
      email: 'a@x.com',
      company: 'OldCo',
      address: '123 Old St',
      notes: 'old notes',
    };

    const row: ParsedCustomerRow = {
      rowNumber: 2,
      data: {},
      // CSV row supplies ONLY `name` — all other fields are blank/missing.
      customer: { name: 'NewName' },
      errors: [],
      warnings: [],
      isDuplicate: true,
      existingCustomerId: 'c-1',
    };

    const result = buildCustomersForImport(
      [row],
      new Map([[existing.id, existing]]),
      new Set([2]),
      'overwrite',
    );

    expect(result).toHaveLength(1);
    const merged = result[0];

    // The D-11 invariant: only `name` overwrites; everything else preserved.
    expect(merged.name).toBe('NewName');
    expect(merged.email).toBe('a@x.com');
    expect(merged.company).toBe('OldCo');
    expect(merged.address).toBe('123 Old St');
    expect(merged.notes).toBe('old notes');
    expect(merged.id).toBe('c-1');
    expect(merged.createdAt).toBe(oldDate);
    expect(merged.lastUsedAt).toBe(oldLastUsed);
  });
});

// Phase 21 SEC-03 — formula-injection + Unicode pass-through.
//
// This describe block locks PARSER PASS-THROUGH behavior: every test asserts
// that `parseCustomerCsv` returns customer fields character-for-character
// identical to the raw CSV input. No formula escaping, no NFC/NFD Unicode
// normalization, no surrogate-pair collapse.
//
// Crucially, this block does NOT test `sanitizeCsvCell` — that helper is the
// EXPORT-path concern and is owned by `src/utils/csvHelpers.test.ts` (plan
// 21-01). The separation is intentional: the parser must stay clean so that
// values round-tripped through CSV import → IndexedDB → CSV export are
// sanitized exactly once (at the export boundary). If escaping logic is ever
// added to `customerCsv.ts` by mistake, these tests fail loudly — preserving
// round-trip identity and trapping the regression at PR time.
describe('Phase 21 SEC-03 — formula-injection + Unicode pass-through', () => {
  it('Test 13: formula-injection in name → parser preserves "=HYPERLINK(...)" byte-for-byte', async () => {
    // The raw cell value contains commas, so we hand-build a properly RFC-4180
    // quoted CSV. Embedded double-quotes are escaped by doubling (`""`).
    const csvString =
      'name,email,company,address,notes\n' +
      '"=HYPERLINK(""https://evil.com"",""click"")",,,,';
    const result = await parseCustomerCsv(csvString, []);
    expect(result.globalErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.customer).not.toBeNull();
    expect(row.errors).toEqual([]);
    expect(row.customer!.name).toBe('=HYPERLINK("https://evil.com","click")');
  });

  it('Test 14: formula-injection in notes → parser preserves "+CMD|\' /C calc\'!A0" byte-for-byte', async () => {
    // The raw cell value contains a single-quote and `!` but no commas — the
    // `csv` helper produces valid CSV here without extra quoting.
    const csvString = csv(
      ['name', 'email', 'company', 'address', 'notes'],
      ['safe customer', '', '', '', "+CMD|' /C calc'!A0"],
    );
    const result = await parseCustomerCsv(csvString, []);
    expect(result.globalErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.customer).not.toBeNull();
    expect(row.errors).toEqual([]);
    expect(row.customer!.notes).toBe("+CMD|' /C calc'!A0");
  });

  it('Test 15: Unicode (Latin diacritic) in name → "Müller" preserved without NFC/NFD normalization', async () => {
    const csvString = csv(
      ['name', 'email', 'company', 'address', 'notes'],
      ['Müller', '', '', '', ''],
    );
    const result = await parseCustomerCsv(csvString, []);
    expect(result.globalErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.customer).not.toBeNull();
    expect(row.errors).toEqual([]);
    expect(row.customer!.name).toBe('Müller');
    // Code-point integrity check — rules out NFC↔NFD normalization changing the
    // ü character class. The first code point must equal the raw input's first
    // code point exactly.
    expect(row.customer!.name!.codePointAt(0)).toBe('Müller'.codePointAt(0));
  });

  it('Test 16: Unicode (CJK ideographs) in name → "张三" preserved as two distinct code points', async () => {
    const csvString = csv(
      ['name', 'email', 'company', 'address', 'notes'],
      ['张三', '', '', '', ''],
    );
    const result = await parseCustomerCsv(csvString, []);
    expect(result.globalErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.customer).not.toBeNull();
    expect(row.errors).toEqual([]);
    expect(row.customer!.name).toBe('张三');
    // Two CJK ideographs preserved as separate code points (spreading a string
    // iterates by code point, not by UTF-16 unit).
    expect([...row.customer!.name!].length).toBe(2);
  });

  it('Test 17: emoji in notes → "Great client 🎉" preserved with surrogate pair intact', async () => {
    const csvString = csv(
      ['name', 'email', 'company', 'address', 'notes'],
      ['Customer', '', '', '', 'Great client 🎉'],
    );
    const result = await parseCustomerCsv(csvString, []);
    expect(result.globalErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.customer).not.toBeNull();
    expect(row.errors).toEqual([]);
    expect(row.customer!.notes).toBe('Great client 🎉');
  });
});
