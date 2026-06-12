// ---------------------------------------------------------------------------
// Full backup restore — TDD suite written BEFORE src/utils/backupRestore.ts.
//
// Contract locks (the security core — restore writes untrusted JSON into the
// entire database):
//  - validateBackupFile rejects the WHOLE file on any structural failure;
//    restoreBackup never writes anything for an invalid file.
//  - Prototype-pollution-shaped keys (__proto__, constructor, prototype) in
//    any record are treated as hostile — whole-file rejection, no pollution.
//  - Date rehydration follows DATE_FIELDS exactly: listed fields come back
//    as Date instances; ISO-shaped strings in free-text fields stay strings;
//    an unparseable value in a date field fails validation.
//  - Restore is one atomic transaction: a mid-restore failure rolls back to
//    the pre-restore state.
// ---------------------------------------------------------------------------

import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { buildBackupFile, serializeBackup } from './backupExport';
import { validateBackupFile, restoreBackup } from './backupRestore';
import type { BackupFile } from './backupSchema';

let dbCounter = 0;
function makeTestDb(): Dexie {
  const db = new Dexie(`BackupRestoreTest-${++dbCounter}`);
  db.version(10).stores({
    materials: 'id, category, brand, filamentType, currency',
    printers: 'id, name',
    printerInstances: 'id, printerConfigId, nickname',
    jobs: 'id, name, createdAt, printerInstanceId',
    sales: 'id, jobId, soldAt',
    settings: 'key',
    customers: 'id, name, email, lastUsedAt',
    quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
  });
  return db;
}

async function seedFullDb(db: Dexie): Promise<void> {
  await db.table('materials').put({ id: 'mat-1', name: 'PLA White', category: 'filament', currency: 'CAD' });
  await db.table('printerInstances').put({
    id: 'pi-1', printerConfigId: 'pc-1', nickname: 'Office A1', printHours: 120,
    purchaseDate: new Date('2025-11-02T00:00:00.000Z'),
  });
  await db.table('jobs').put({
    id: 'job-1', name: 'Benchy',
    createdAt: new Date('2026-06-01T10:30:00.000Z'),
    updatedAt: new Date('2026-06-02T08:00:00.000Z'),
    filaments: [{ filamentId: 'mat-1', grams: 120 }],
    printTimeHours: 4, printerInstanceId: 'pi-1', modelCost: 0,
    prepTimeMinutes: 0, postProcessingMinutes: 0, materialsUsed: [],
    failureRate: 5, costPerUnit: 8, sellingPrice: 20, copiesSold: 1,
    // Free text that LOOKS like a date — must stay a string after restore.
    notes: 'Customer asked for delivery by 2026-07-01T00:00:00.000Z sharp',
  });
  await db.table('sales').put({
    id: 'sale-1', jobId: 'job-1', quantity: 1, unitPrice: 20, totalRevenue: 20,
    soldAt: new Date('2026-06-05T14:45:30.000Z'), currency: 'CAD',
  });
  await db.table('customers').put({
    id: 'cust-1', name: 'Farah', email: 'farah@example.com',
    createdAt: new Date('2026-05-22T09:00:00.000Z'),
    lastUsedAt: new Date('2026-06-05T14:45:30.000Z'),
  });
  await db.table('quotes').put({
    id: 'q-1', quoteNumber: 42, printJobId: 'job-1', customerSnapshot: {},
    lineItemsSnapshot: { jobTitle: 'Benchy', sellingPrice: 20, shippingCost: 0, resolvedTaxRate: 0, taxAmount: 0, currency: 'CAD', notes: '', terms: '' },
    status: 'sent',
    createdAt: new Date('2026-06-03T12:00:00.000Z'),
    sentAt: new Date('2026-06-03T12:00:00.000Z'),
    decisionAt: new Date('2026-06-04T12:00:00.000Z'),
    convertedAt: new Date('2026-06-05T12:00:00.000Z'),
  });
  await db.table('settings').put({ key: 'userProfile', value: '{"currency":"CAD","laborHourlyRate":25}' });
}

/** Export from a db and run it through real JSON to flatten Dates. */
async function exportViaJson(db: Dexie): Promise<unknown> {
  return JSON.parse(serializeBackup(await buildBackupFile(db)));
}

function validFileFixture(): Promise<unknown> {
  const db = makeTestDb();
  return (async () => {
    await seedFullDb(db);
    return exportViaJson(db);
  })();
}

// ---------------------------------------------------------------------------
// Round-trip fidelity
// ---------------------------------------------------------------------------
describe('restore round-trip fidelity', () => {
  it('every DATE_FIELDS field comes back as a Date instance with equal epoch', async () => {
    const source = makeTestDb();
    await seedFullDb(source);
    const parsed = await exportViaJson(source);

    const target = makeTestDb();
    await restoreBackup(target, parsed);

    const job = await target.table('jobs').get('job-1');
    expect(job.createdAt).toBeInstanceOf(Date);
    expect(job.createdAt.getTime()).toBe(new Date('2026-06-01T10:30:00.000Z').getTime());
    expect(job.updatedAt).toBeInstanceOf(Date);

    const sale = await target.table('sales').get('sale-1');
    expect(sale.soldAt).toBeInstanceOf(Date);
    expect(sale.soldAt.getTime()).toBe(new Date('2026-06-05T14:45:30.000Z').getTime());

    const customer = await target.table('customers').get('cust-1');
    expect(customer.createdAt).toBeInstanceOf(Date);
    expect(customer.lastUsedAt).toBeInstanceOf(Date);

    const quote = await target.table('quotes').get('q-1');
    expect(quote.createdAt).toBeInstanceOf(Date);
    expect(quote.sentAt).toBeInstanceOf(Date);
    expect(quote.decisionAt).toBeInstanceOf(Date);
    expect(quote.convertedAt).toBeInstanceOf(Date);

    const instance = await target.table('printerInstances').get('pi-1');
    expect(instance.purchaseDate).toBeInstanceOf(Date);
  });

  it('optional date fields that are absent stay absent', async () => {
    const source = makeTestDb();
    await source.table('quotes').put({
      id: 'q-min', quoteNumber: 1, printJobId: 'job-x', customerSnapshot: {},
      lineItemsSnapshot: { jobTitle: 'X', sellingPrice: 1, shippingCost: 0, resolvedTaxRate: 0, taxAmount: 0, currency: 'USD', notes: '', terms: '' },
      status: 'sent',
      createdAt: new Date('2026-06-03T12:00:00.000Z'),
      sentAt: new Date('2026-06-03T12:00:00.000Z'),
      // no decisionAt / convertedAt
    });
    const target = makeTestDb();
    await restoreBackup(target, await exportViaJson(source));
    const quote = await target.table('quotes').get('q-min');
    expect('decisionAt' in quote).toBe(false);
    expect('convertedAt' in quote).toBe(false);
  });

  it('ISO-shaped strings in free-text fields stay strings (no blanket reviver)', async () => {
    const source = makeTestDb();
    await seedFullDb(source);
    const target = makeTestDb();
    await restoreBackup(target, await exportViaJson(source));
    const job = await target.table('jobs').get('job-1');
    expect(typeof job.notes).toBe('string');
    expect(job.notes).toContain('2026-07-01T00:00:00.000Z');
  });

  it('settings rows restore with values as opaque JSON strings', async () => {
    const source = makeTestDb();
    await seedFullDb(source);
    const target = makeTestDb();
    await restoreBackup(target, await exportViaJson(source));
    const row = await target.table('settings').get('userProfile');
    expect(typeof row.value).toBe('string');
    expect(row.value).toBe('{"currency":"CAD","laborHourlyRate":25}');
  });

  it('restoring an empty backup clears a populated database', async () => {
    const emptySource = makeTestDb();
    const parsed = await exportViaJson(emptySource);

    const target = makeTestDb();
    await seedFullDb(target);
    await restoreBackup(target, parsed);

    expect(await target.table('jobs').count()).toBe(0);
    expect(await target.table('settings').count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Validation — whole-file rejection, no writes
// ---------------------------------------------------------------------------
describe('validateBackupFile — structural rejection', () => {
  it.each([
    ['null root', null],
    ['string root', 'not an object'],
    ['missing meta', { data: {} }],
    ['missing data', { meta: {} }],
  ])('rejects %s', async (_label, parsed) => {
    const result = validateBackupFile(parsed);
    expect(result.ok).toBe(false);
  });

  it('rejects when a store is missing or not an array', async () => {
    const parsed = (await validFileFixture()) as BackupFile;
    const broken = { ...parsed, data: { ...parsed.data, jobs: { not: 'an array' } } };
    const result = validateBackupFile(broken);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/jobs/);
  });

  it('rejects a settings row with a non-string value', async () => {
    const parsed = (await validFileFixture()) as BackupFile;
    const broken = { ...parsed, data: { ...parsed.data, settings: [{ key: 'userProfile', value: { currency: 'CAD' } }] } };
    expect(validateBackupFile(broken).ok).toBe(false);
  });

  it('rejects a record missing a string id', async () => {
    const parsed = (await validFileFixture()) as BackupFile;
    const broken = { ...parsed, data: { ...parsed.data, materials: [{ name: 'no id' }] } };
    expect(validateBackupFile(broken).ok).toBe(false);
  });

  it('rejects an unparseable value in a DATE_FIELDS field', async () => {
    const parsed = (await validFileFixture()) as BackupFile;
    const jobs = (parsed.data.jobs as Record<string, unknown>[]).map(j => ({ ...j, createdAt: 'not-a-date' }));
    const broken = { ...parsed, data: { ...parsed.data, jobs } };
    const result = validateBackupFile(broken);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/createdAt/);
  });

  it('restoreBackup performs NO writes when validation fails', async () => {
    const target = makeTestDb();
    await seedFullDb(target);
    await expect(restoreBackup(target, { meta: {}, data: {} })).rejects.toThrow();
    // Original data fully intact
    expect(await target.table('jobs').count()).toBe(1);
    expect((await target.table('jobs').get('job-1')).name).toBe('Benchy');
  });
});

// ---------------------------------------------------------------------------
// DoS guard — the util must protect itself even when called without the UI's
// 50 MB byte gate (validateBackupFile is exported and may grow new callers).
// ---------------------------------------------------------------------------
describe('record-count cap', () => {
  it('rejects a store with more than MAX_RECORDS_PER_STORE rows, before per-record work', async () => {
    const { MAX_RECORDS_PER_STORE } = await import('./backupSchema');
    const parsed = (await validFileFixture()) as BackupFile;
    const flood = Array.from({ length: MAX_RECORDS_PER_STORE + 1 }, (_, i) => ({ id: `m-${i}` }));
    const broken = { ...parsed, data: { ...parsed.data, materials: flood } };
    const result = validateBackupFile(broken);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/too many/i);
  });
});

// ---------------------------------------------------------------------------
// Prototype-pollution defense
// ---------------------------------------------------------------------------
describe('prototype-pollution defense', () => {
  it.each(['__proto__', 'constructor', 'prototype'])(
    'rejects the whole file when a record carries a %s key, without polluting',
    async (evilKey) => {
      const parsed = (await validFileFixture()) as BackupFile;
      // JSON.parse creates plain own properties for these names — craft via JSON
      // to mirror a real attack payload rather than object-literal semantics.
      const evilRecord = JSON.parse(`{"id":"evil-1","name":"x","${evilKey}":{"polluted":true}}`);
      const broken = { ...parsed, data: { ...parsed.data, materials: [evilRecord] } };

      const result = validateBackupFile(broken);
      expect(result.ok).toBe(false);

      const target = makeTestDb();
      await expect(restoreBackup(target, broken)).rejects.toThrow();
      expect(await target.table('materials').count()).toBe(0);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    },
  );
});

// ---------------------------------------------------------------------------
// Transaction atomicity
// ---------------------------------------------------------------------------
describe('restore atomicity', () => {
  it('a mid-restore failure rolls back every store to the pre-restore state', async () => {
    const source = makeTestDb();
    await seedFullDb(source);
    const parsed = await exportViaJson(source);

    const target = makeTestDb();
    await target.table('jobs').put({
      id: 'original-job', name: 'Original',
      createdAt: new Date(), updatedAt: new Date(),
      filaments: [], printTimeHours: 1, printerInstanceId: 'pi-0', modelCost: 0,
      prepTimeMinutes: 0, postProcessingMinutes: 0, materialsUsed: [],
      failureRate: 0, costPerUnit: 1, sellingPrice: 2, copiesSold: 0,
    });
    await target.table('settings').put({ key: 'userProfile', value: '{"currency":"USD"}' });
    await target.open();

    // Force the LAST store's write to fail after earlier stores were cleared
    // and rewritten inside the transaction.
    const quotesTable = target.table('quotes');
    const realBulkPut = quotesTable.bulkPut.bind(quotesTable);
    quotesTable.bulkPut = (() => { throw new Error('simulated mid-restore crash'); }) as typeof quotesTable.bulkPut;

    await expect(restoreBackup(target, parsed)).rejects.toThrow();
    quotesTable.bulkPut = realBulkPut;

    // Everything rolled back: original record present, backup contents absent.
    expect(await target.table('jobs').count()).toBe(1);
    expect((await target.table('jobs').get('original-job')).name).toBe('Original');
    expect(await target.table('jobs').get('job-1')).toBeUndefined();
    expect((await target.table('settings').get('userProfile')).value).toBe('{"currency":"USD"}');
  });
});
