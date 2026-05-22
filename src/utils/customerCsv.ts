import Papa from 'papaparse';
import type { Customer } from '../types';

/**
 * Phase 15.1 — CL-03 customer CSV importer parser + builder.
 *
 * Sibling of `csvHelpers.ts` (which parses assets). Per D-08 we keep customer
 * parsing isolated from asset parsing rather than genericizing CsvImportModal<T>.
 *
 * Public surface:
 * - `parseCustomerCsv(csvString, existingCustomers)` → `CustomerCsvParseResult`
 * - `buildCustomersForImport(rows, existingById, selected, duplicateMode)` → `Customer[]`
 *
 * Locked decisions consumed here:
 * - D-09: Name OR Email required (empty-both rows rejected); malformed email rejected
 * - D-07 / D-10: email-match dedup (case-insensitive after trim)
 * - D-11: merge semantics — only NON-EMPTY incoming fields overwrite existing values
 * - UI-SPEC discretion #8: emails normalized to LOWERCASE on write
 * - UI-SPEC discretion #14: single `address` column (no address1/address2 split)
 */

export interface ParsedCustomerRow {
  rowNumber: number;                  // 1-indexed; header is row 1, data starts at row 2
  data: Record<string, string>;       // raw row data (header-keyed; already lowercased headers)
  customer: Partial<Customer> | null; // null when row is invalid (will not be imported)
  errors: string[];                   // user-facing strings; empty array means valid
  warnings: string[];
  isDuplicate: boolean;               // email matches an existing library record
  existingCustomerId?: string;        // set iff isDuplicate
}

export interface CustomerCsvParseResult {
  rows: ParsedCustomerRow[];
  globalErrors: string[];             // empty CSV / Papa parse failures
}

/**
 * Parse a CSV string into validated, dedup-tagged customer rows.
 *
 * @param csvString  Raw CSV text (header row + data rows).
 * @param existingCustomers  Current library customers — used to flag email-match duplicates.
 */
export function parseCustomerCsv(
  csvString: string,
  existingCustomers: Customer[],
): CustomerCsvParseResult {
  const globalErrors: string[] = [];

  if (!csvString.trim()) {
    return { rows: [], globalErrors: ['CSV file is empty'] };
  }

  const parsed = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase(),
  });

  // PapaParse is forgiving — surface its diagnostics but still build whatever rows it parsed.
  if (parsed.errors && parsed.errors.length > 0) {
    for (const err of parsed.errors) {
      if (err && err.message) globalErrors.push(err.message);
    }
  }

  const rows: ParsedCustomerRow[] = [];
  const dataRows = parsed.data ?? [];

  for (let i = 0; i < dataRows.length; i++) {
    const raw = dataRows[i] ?? {};
    const { customer, errors, warnings } = validateCustomerRow(raw);
    rows.push({
      rowNumber: i + 2, // header is row 1, first data row is row 2
      data: raw,
      customer,
      errors,
      warnings,
      isDuplicate: false,
    });
  }

  checkCustomerDuplicates(rows, existingCustomers);

  return { rows, globalErrors };
}

/**
 * Validate a single CSV row against the D-09 Name-OR-Email rule and the email
 * format heuristic. Returns the trimmed/lowercased `Partial<Customer>` when
 * valid, or `null` when the row should not be imported.
 *
 * Fields populated only when non-empty after trim (so downstream merge logic
 * can rely on "truthy = user provided this value").
 */
function validateCustomerRow(
  row: Record<string, string>,
): { customer: Partial<Customer> | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nameRaw = row.name;
  const emailRaw = row.email;

  const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
  const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';

  // D-09: Name OR Email required.
  if (!name && !email) {
    errors.push('Name or Email required');
    return { customer: null, errors, warnings };
  }

  // Email format check (only when present — D-09: email is optional when name is provided).
  if (email && !email.includes('@')) {
    errors.push('Email format invalid');
    return { customer: null, errors, warnings };
  }

  const customer: Partial<Customer> = {};
  if (name) customer.name = name;
  // UI-SPEC discretion #8: normalize email to lowercase on write.
  if (email) customer.email = email.toLowerCase();

  const company = typeof row.company === 'string' ? row.company.trim() : '';
  if (company) customer.company = company;

  // UI-SPEC discretion #14: single `address` column.
  const address = typeof row.address === 'string' ? row.address.trim() : '';
  if (address) customer.address = address;

  const notes = typeof row.notes === 'string' ? row.notes.trim() : '';
  if (notes) customer.notes = notes;

  return { customer, errors, warnings };
}

/**
 * Mutate `rows` in place: flag rows whose email matches an existing customer
 * record. Match key is `(email || '').trim().toLowerCase()`. Existing records
 * with an empty email are excluded from the lookup (an unknown empty key can't
 * be matched to itself meaningfully).
 *
 * D-07: case-insensitive after trim — both the existing record and the CSV row
 * are normalized to lowercase before comparison.
 */
function checkCustomerDuplicates(rows: ParsedCustomerRow[], existing: Customer[]): void {
  const existingMap = new Map<string, string>();
  for (const c of existing) {
    const key = (c.email || '').trim().toLowerCase();
    if (key) existingMap.set(key, c.id);
  }

  for (const row of rows) {
    if (!row.customer) continue;
    // row.customer.email is already lowercased in validateCustomerRow.
    const key = (row.customer.email || '').toLowerCase();
    if (!key) continue;
    const existingId = existingMap.get(key);
    if (existingId) {
      row.isDuplicate = true;
      row.existingCustomerId = existingId;
    }
  }
}

/**
 * Build the array of Customer records to bulkPut. Caller controls which rows
 * import via `selected` (a Set of `rowNumber`s) and how to handle email-matched
 * duplicates via `duplicateMode`.
 *
 * Semantics:
 * - Rows with `customer === null` (invalid) are always skipped.
 * - Rows not in `selected` are skipped.
 * - Non-duplicates → NEW Customer with fresh UUID + createdAt (no lastUsedAt —
 *   D-03 semantics: created via import is not "used in business" yet).
 * - Duplicates + `duplicateMode === 'skip'` → skipped.
 * - Duplicates + `duplicateMode === 'overwrite'` → merge: preserves existing
 *   `id`, `createdAt`, `lastUsedAt` and any field not present in the CSV row.
 *   Only NON-EMPTY incoming fields overwrite existing values (D-11 — empty CSV
 *   cells preserve the manually-typed library values).
 */
export function buildCustomersForImport(
  rows: ParsedCustomerRow[],
  existingById: Map<string, Customer>,
  selected: Set<number>,
  duplicateMode: 'skip' | 'overwrite',
): Customer[] {
  const out: Customer[] = [];

  for (const row of rows) {
    if (!row.customer) continue;
    if (!selected.has(row.rowNumber)) continue;
    if (row.isDuplicate && duplicateMode === 'skip') continue;

    if (row.isDuplicate && row.existingCustomerId) {
      // D-11: merge — only non-empty incoming fields overwrite existing values.
      // Empty CSV cells preserve manually-typed library values (notes, address, etc.).
      const existing = existingById.get(row.existingCustomerId);
      if (!existing) continue;

      const merged: Customer = { ...existing };
      // Field-by-field conditional spread — DO NOT do `{...existing, ...row.customer}`
      // because validateCustomerRow already omits empty fields, but using a literal spread
      // would still overwrite any field that IS present in row.customer. We want the same
      // behavior expressed explicitly so the merge rule is auditable.
      const inc = row.customer;
      if (inc.name) merged.name = inc.name;
      if (inc.email) merged.email = inc.email;
      if (inc.company) merged.company = inc.company;
      if (inc.address) merged.address = inc.address;
      if (inc.notes) merged.notes = inc.notes;
      out.push(merged);
    } else {
      const id = generateCustomerId(row.rowNumber);
      out.push({
        id,
        createdAt: new Date(),
        // lastUsedAt intentionally omitted — D-03: imported rows aren't "used in business" yet.
        ...row.customer,
      } as Customer);
    }
  }

  return out;
}

// crypto.randomUUID() with the fallback documented in PATTERNS.md §4.
function generateCustomerId(rowNumber: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `customer-${Date.now()}-${rowNumber}`;
}
