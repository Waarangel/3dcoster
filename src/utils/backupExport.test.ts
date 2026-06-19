// ---------------------------------------------------------------------------
// Full backup export — TDD suite written BEFORE src/utils/backupExport.ts.
//
// Contract locks:
//  - buildBackupFile captures ALL 8 Dexie stores plus a meta envelope
//    (backupFormatVersion, appSchemaVersion = db.verno, appVersion,
//    exportedAt ISO timestamp).
//  - settings rows round-trip as opaque {key, value-string} pairs.
//  - serializeBackup is plain JSON: Date fields become ISO strings (their
//    rehydration is backupRestore's contract, tested there).
//  - buildBackupFilename: 3dcoster-backup-YYYY-MM-DD.json.
// ---------------------------------------------------------------------------

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { buildBackupFile, serializeBackup, buildBackupFilename } from './backupExport';
import { BACKUP_FORMAT_VERSION, BACKUP_STORES } from './backupSchema';

// Fresh v10-shaped Dexie per test — unique name isolates fake-indexeddb state
// (same pattern as database.migrations.test.ts).
let dbCounter = 0;
function makeTestDb(): Dexie {
  const db = new Dexie(`BackupExportTest-${++dbCounter}`);
  db.version(10).stores({
    materials: 'id, category, brand, filamentType, currency',
    printers: 'id, name',
    printerInstances: 'id, printerConfigId, nickname',
    jobs: 'id, name, createdAt, printerInstanceId',
    sales: 'id, jobId, soldAt',
    settings: 'key',
    customers: 'id, name, email, lastUsedAt',
    quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
    stockEvents: 'id, assetId, refId, timestamp',
  });
  return db;
}

const SEED_JOB = {
  id: 'job-1',
  name: 'Benchy',
  createdAt: new Date('2026-06-01T10:30:00.000Z'),
  updatedAt: new Date('2026-06-02T08:00:00.000Z'),
  filaments: [{ filamentId: 'fil-1', grams: 120 }],
  printTimeHours: 4,
  printerInstanceId: 'pi-1',
  modelCost: 0,
  prepTimeMinutes: 0,
  postProcessingMinutes: 0,
  materialsUsed: [],
  failureRate: 5,
  costPerUnit: 8,
  sellingPrice: 20,
  copiesSold: 1,
};

const SEED_SETTING = {
  key: 'userProfile',
  value: '{"currency":"CAD","laborHourlyRate":25}',
};

describe('buildBackupFile', () => {
  let db: Dexie;
  beforeEach(() => {
    db = makeTestDb();
  });

  it('captures every one of the 8 stores as an array, with seeded contents', async () => {
    await db.table('jobs').put(SEED_JOB);
    await db.table('settings').put(SEED_SETTING);
    await db.table('materials').put({ id: 'mat-1', name: 'PLA', category: 'filament' });

    const file = await buildBackupFile(db);

    for (const store of BACKUP_STORES) {
      expect(Array.isArray(file.data[store]), `data.${store} must be an array`).toBe(true);
    }
    expect(file.data.jobs).toHaveLength(1);
    expect((file.data.jobs[0] as typeof SEED_JOB).id).toBe('job-1');
    expect(file.data.materials).toHaveLength(1);
    expect(file.data.settings).toEqual([SEED_SETTING]);
    expect(file.data.sales).toEqual([]);
  });

  it('meta envelope carries format version, db schema version, app version, and ISO timestamp', async () => {
    await db.open();
    const file = await buildBackupFile(db);

    expect(file.meta.backupFormatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(file.meta.appSchemaVersion).toBe(db.verno);
    expect(typeof file.meta.appVersion).toBe('string');
    expect(file.meta.appVersion.length).toBeGreaterThan(0);
    // exportedAt parses back to a real date close to now
    const exportedAt = new Date(file.meta.exportedAt);
    expect(Number.isNaN(exportedAt.getTime())).toBe(false);
    expect(Math.abs(Date.now() - exportedAt.getTime())).toBeLessThan(60_000);
  });

  it('empty database exports a valid file with all-empty arrays', async () => {
    const file = await buildBackupFile(db);
    for (const store of BACKUP_STORES) {
      expect(file.data[store]).toEqual([]);
    }
  });

  it('settings values round-trip as opaque JSON strings, not re-parsed objects', async () => {
    await db.table('settings').put(SEED_SETTING);
    const file = await buildBackupFile(db);
    expect(typeof file.data.settings[0].value).toBe('string');
    expect(file.data.settings[0].value).toBe(SEED_SETTING.value);
  });
});

describe('serializeBackup', () => {
  it('produces JSON that parses back, with Date fields flattened to ISO strings', async () => {
    const db = makeTestDb();
    await db.table('jobs').put(SEED_JOB);

    const json = serializeBackup(await buildBackupFile(db));
    const parsed = JSON.parse(json);

    expect(parsed.meta.backupFormatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(parsed.data.jobs[0].createdAt).toBe('2026-06-01T10:30:00.000Z');
    expect(typeof parsed.data.jobs[0].createdAt).toBe('string');
  });
});

describe('buildBackupFilename', () => {
  it('matches 3dcoster-backup-YYYY-MM-DD.json', () => {
    expect(buildBackupFilename()).toMatch(/^3dcoster-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
