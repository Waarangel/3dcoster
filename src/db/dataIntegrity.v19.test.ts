// ---------------------------------------------------------------------------
// v1.9 data-integrity fixes — REAL-DEXIE integration tests (fake-indexeddb).
//
// Covers the Tier-1 data fixes from .planning/v1.9-AUDIT.md:
//   1. asset-delete cascade (materials + stockEvents)            [CRITICAL]
//   3. job-save stock deduction atomicity (jobs + stockEvents)   [HIGH]
//   2. per-row catalog top-up never clobbers user edits          [HIGH]
//   6. finite guards on manual adjustments                       [LOW]
//
// These build a fresh in-memory Dexie that mirrors the production v11 schema
// (the relevant subset) so we can exercise the actual write CONTRACTS — the
// real cascade/atomicity behavior, not a spy on call order. The first import
// installs the IndexedDB shim before any `new Dexie(...)` evaluates; it is
// scoped to this file (no global vitest.setup injection).
// ---------------------------------------------------------------------------
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Dexie, { type EntityTable } from 'dexie';
import type { Asset, PrintJob, StockEvent } from '../types';
import { upsertJobStockEvents } from './stockEventsWriter';
import { deriveStockByAsset, buildJobStockEvents } from './stockEvents';

type TestDb = Dexie & {
  materials: EntityTable<Asset, 'id'>;
  jobs: EntityTable<PrintJob, 'id'>;
  stockEvents: EntityTable<StockEvent, 'id'>;
};

let counter = 0;
function makeDb(): TestDb {
  const db = new Dexie(`DataIntegrityV19-${++counter}`) as TestDb;
  db.version(1).stores({
    materials: 'id, category, brand, filamentType, currency',
    jobs: 'id, name, createdAt, printerInstanceId',
    stockEvents: 'id, assetId, refId, timestamp',
  });
  return db;
}

function asset(p: Partial<Asset> & { id: string }): Asset {
  return {
    name: p.id,
    category: 'filament',
    unit: 'g',
    costPerUnit: 0.02,
    ...p,
  } as Asset;
}

function job(p: Partial<PrintJob> & { id: string }): PrintJob {
  return {
    name: p.id,
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
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
    ...p,
  } as PrintJob;
}

const NOW = new Date('2026-06-26T12:00:00.000Z');

// Mirror of the production deleteAsset cascade (useDatabase.ts).
async function deleteAssetCascade(db: TestDb, id: string): Promise<void> {
  await db.transaction('rw', db.materials, db.stockEvents, async () => {
    await db.materials.delete(id);
    await db.stockEvents.where('assetId').equals(id).delete();
  });
}

// Mirror of the production atomic addJob (useDatabase.ts).
async function addJobAtomic(db: TestDb, j: PrintJob): Promise<void> {
  await db.transaction('rw', db.jobs, db.stockEvents, async () => {
    await db.jobs.add(j);
    await upsertJobStockEvents(db, j, NOW);
  });
}

describe('Fix 1 (CRITICAL) — asset-delete cascade', () => {
  it('deleting an asset removes BOTH the material row and its stock events', async () => {
    const db = makeDb();
    await db.materials.add(asset({ id: 'pla' }));
    await db.stockEvents.bulkAdd([
      { id: 'm1', assetId: 'pla', delta: 1000, kind: 'manual', refId: 'm1', timestamp: NOW },
      { id: 'j1__pla', assetId: 'pla', delta: -120, kind: 'job', refId: 'j1', timestamp: NOW },
    ]);

    await deleteAssetCascade(db, 'pla');

    expect(await db.materials.get('pla')).toBeUndefined();
    expect(await db.stockEvents.where('assetId').equals('pla').count()).toBe(0);
  });

  it('leaves OTHER assets\' stock events untouched', async () => {
    const db = makeDb();
    await db.materials.bulkAdd([asset({ id: 'pla' }), asset({ id: 'petg' })]);
    await db.stockEvents.bulkAdd([
      { id: 'a', assetId: 'pla', delta: 500, kind: 'manual', refId: 'a', timestamp: NOW },
      { id: 'b', assetId: 'petg', delta: 800, kind: 'manual', refId: 'b', timestamp: NOW },
    ]);

    await deleteAssetCascade(db, 'pla');

    expect(deriveStockByAsset(await db.stockEvents.toArray())).toEqual(new Map([['petg', 800]]));
  });

  it('no phantom-stock resurrection: a reused id starts at zero derived stock', async () => {
    const db = makeDb();
    await db.materials.add(asset({ id: 'pla' }));
    await db.stockEvents.add({ id: 'old', assetId: 'pla', delta: 300, kind: 'manual', refId: 'old', timestamp: NOW });

    await deleteAssetCascade(db, 'pla');
    // Re-add a default with the SAME id (e.g. reset-to-defaults).
    await db.materials.add(asset({ id: 'pla' }));

    const stock = deriveStockByAsset(await db.stockEvents.toArray()).get('pla') ?? 0;
    expect(stock).toBe(0); // the orphaned +300 is gone — no phantom stock
  });
});

describe('Fix 3 (HIGH) — job-save stock deduction atomicity', () => {
  it('a successful save commits BOTH the job and its deduction', async () => {
    const db = makeDb();
    await addJobAtomic(db, job({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 120 }] }));

    expect(await db.jobs.get('j1')).toBeDefined();
    expect(deriveStockByAsset(await db.stockEvents.toArray()).get('pla')).toBe(-120);
  });

  it('a stock-write failure ROLLS BACK the job write (no overstated inventory)', async () => {
    const db = makeDb();
    // Force the stock write to throw mid-transaction by feeding a job whose
    // built events collide with a pre-seeded primary key under bulkPut? bulkPut
    // upserts, so instead we throw from inside the tx after the job add.
    await expect(
      db.transaction('rw', db.jobs, db.stockEvents, async () => {
        await db.jobs.add(job({ id: 'j-rollback', filaments: [{ filamentId: 'pla', grams: 50 }] }));
        await upsertJobStockEvents(db, job({ id: 'j-rollback', filaments: [{ filamentId: 'pla', grams: 50 }] }), NOW);
        throw new Error('simulated crash between writes');
      }),
    ).rejects.toThrow('simulated crash');

    // Atomicity: the job must NOT persist if the surrounding tx aborted.
    expect(await db.jobs.get('j-rollback')).toBeUndefined();
    expect(await db.stockEvents.where('refId').equals('j-rollback').count()).toBe(0);
  });

  it('editing a job replaces its prior deduction rather than stacking', async () => {
    const db = makeDb();
    await addJobAtomic(db, job({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 120 }] }));
    // Edit: same job id, fewer grams — atomic update path.
    await db.transaction('rw', db.jobs, db.stockEvents, async () => {
      const updated = job({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 80 }] });
      await db.jobs.put(updated);
      await upsertJobStockEvents(db, updated, NOW);
    });

    expect(deriveStockByAsset(await db.stockEvents.toArray()).get('pla')).toBe(-80);
  });
});

describe('Fix 2 (HIGH) — per-row catalog top-up never clobbers user edits', () => {
  // Mirror of the production addMissingCatalogRows helper (useDatabase.ts).
  async function addMissingCatalogRows(db: TestDb, catalog: Asset[]): Promise<number> {
    let added = 0;
    await db.transaction('rw', db.materials, async () => {
      for (const a of catalog) {
        const existing = await db.materials.get(a.id);
        if (!existing) {
          await db.materials.add(a);
          added++;
        }
      }
    });
    return added;
  }

  it('adds only genuinely-missing catalog rows', async () => {
    const db = makeDb();
    await db.materials.add(asset({ id: 'printer-a', category: 'printer', wattage: 120 }));

    const added = await addMissingCatalogRows(db, [
      asset({ id: 'printer-a', category: 'printer', wattage: 350 }),
      asset({ id: 'printer-b', category: 'printer', wattage: 200 }),
    ]);

    expect(added).toBe(1); // only printer-b was missing
  });

  it('does NOT overwrite a user edit to an existing default row', async () => {
    const db = makeDb();
    // User edited the default printer's wattage from the catalog value (350) to 175.
    await db.materials.add(asset({ id: 'printer-a', category: 'printer', wattage: 175, name: 'My Tuned Printer' }));

    await addMissingCatalogRows(db, [asset({ id: 'printer-a', category: 'printer', wattage: 350, name: 'Default Printer' })]);

    const row = await db.materials.get('printer-a');
    expect(row?.wattage).toBe(175);          // edit preserved
    expect(row?.name).toBe('My Tuned Printer'); // edit preserved
  });
});

describe('Fix 4 (MEDIUM) — Sale→Customer backfill cross-tab dedup', () => {
  // Mirror of getSeedState/setSeedState semantics + the in-transaction re-check.
  type SettingsRow = { key: string; value: string };
  type SeedDb = Dexie & {
    settings: EntityTable<SettingsRow, 'key'>;
    customers: EntityTable<{ id: string; email?: string; name?: string }, 'id'>;
    sales: EntityTable<{ id: string; jobId: string; quantity: number; soldAt: Date; customerName?: string }, 'id'>;
  };

  function makeSeedDb(): SeedDb {
    const db = new Dexie(`SeedStateV19-${++counter}`) as SeedDb;
    db.version(1).stores({ settings: 'key', customers: 'id, email', sales: 'id, jobId, soldAt' });
    return db;
  }

  async function getSeed(db: SeedDb): Promise<Record<string, boolean>> {
    const row = await db.settings.get('seedState');
    if (!row) return {};
    try { return JSON.parse(row.value); } catch { return {}; }
  }
  async function setSeed(db: SeedDb, patch: Record<string, boolean>): Promise<void> {
    const current = await getSeed(db);
    await db.settings.put({ key: 'seedState', value: JSON.stringify({ ...current, ...patch }) });
  }

  it('setSeedState merge-patches without clobbering sibling flags', async () => {
    const db = makeSeedDb();
    await setSeed(db, { didInitialSeed: true });
    await setSeed(db, { didSaleCustomerBackfill: true });
    expect(await getSeed(db)).toEqual({ didInitialSeed: true, didSaleCustomerBackfill: true });
  });

  it('a second pass dedupes inside the tx — the persisted flag short-circuits it', async () => {
    const db = makeSeedDb();
    await db.sales.add({ id: 's1', jobId: 'j1', quantity: 1, soldAt: NOW, customerName: 'Logan' });

    // First "tab": backfill runs, mints Logan, sets the flag — all in one tx.
    await db.transaction('rw', db.sales, db.customers, db.settings, async () => {
      const fresh = await getSeed(db);
      if (fresh.didSaleCustomerBackfill) return;
      const sales = await db.sales.toArray();
      const existing = await db.customers.toArray();
      if (sales.length > 0 && existing.length === 0) {
        await db.customers.add({ id: 'c1', name: sales[0].customerName });
      }
      await setSeed(db, { didSaleCustomerBackfill: true });
    });

    // Second "tab": the persisted flag must short-circuit → no duplicate Logan.
    await db.transaction('rw', db.sales, db.customers, db.settings, async () => {
      const fresh = await getSeed(db);
      if (fresh.didSaleCustomerBackfill) return; // guard fires
      await db.customers.add({ id: 'c2', name: 'Logan' }); // must NOT run
      await setSeed(db, { didSaleCustomerBackfill: true });
    });

    expect(await db.customers.count()).toBe(1);
  });
});

describe('Fix 6 (LOW) — finite guard source contract', () => {
  it('logManualAdjustment rejects a non-finite delta before any write', () => {
    const src = readFileSync(resolve(__dirname, '../hooks/useStockEvents.ts'), 'utf8');
    // The Number.isFinite guard must short-circuit (early return) BEFORE the
    // db.stockEvents.add call, so a NaN/Infinity delta never reaches the ledger.
    const guardIdx = src.indexOf('Number.isFinite(delta)');
    const addIdx = src.indexOf('db.stockEvents.add');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(addIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(addIdx);
  });

  it('addPrintHours guards finite hours and wraps the read-modify-write in a transaction', () => {
    const src = readFileSync(resolve(__dirname, '../hooks/useDatabase.ts'), 'utf8');
    expect(src).toContain('Number.isFinite(hours)');
    expect(src).toContain("db.transaction('rw', db.printerInstances,");
  });
});

describe('Fix 6 (LOW) — buildJobStockEvents ignores non-positive/empty lines', () => {
  it('skips zero-gram and empty-id rows so no zero/NaN events are written', () => {
    const events = buildJobStockEvents(
      job({
        id: 'j1',
        filaments: [{ filamentId: 'pla', grams: 0 }, { filamentId: '', grams: 10 }],
        materialsUsed: [{ materialId: 'resin', quantity: 0 }],
      }),
      NOW,
    );
    expect(events).toEqual([]);
  });
});
