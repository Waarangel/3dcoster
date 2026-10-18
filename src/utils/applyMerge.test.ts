// ---------------------------------------------------------------------------
// applyMerge — TDD suite written BEFORE the implementation (Task 3, RED).
//
// Contract locks:
//  - Writes every store's winners (bulkPut), deletes, and tombstones inside
//    ONE Dexie transaction.
//  - A mid-apply failure rolls the WHOLE transaction back (mirrors
//    backupRestore.test.ts's restore-atomicity test — same forced-throw
//    technique against a real fake-indexeddb transaction).
//  - Winners are written VERBATIM — applyMerge never re-stamps updatedAt
//    (the merge already decided the authoritative record in computeMerge).
//  - Retention-expired tombstones are pruned after the plan is applied.
// ---------------------------------------------------------------------------

import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { applyMerge } from './applyMerge';
import { BACKUP_STORES, SYNC_TOMBSTONE_RETENTION_DAYS, type SyncTombstone } from './backupSchema';
import type { MergePlan, MergeSummary } from './syncMerge';

let dbCounter = 0;
function makeTestDb(): Dexie {
  const db = new Dexie(`ApplyMergeTest-${++dbCounter}`);
  db.version(1).stores({
    materials: 'id, category, brand, filamentType, currency',
    printers: 'id, name',
    printerInstances: 'id, printerConfigId, nickname',
    jobs: 'id, name, createdAt, printerInstanceId',
    sales: 'id, jobId, soldAt',
    settings: 'key',
    customers: 'id, name, email, lastUsedAt',
    quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
    stockEvents: 'id, assetId, refId, timestamp',
    failureEvents: 'id, printerInstanceId, materialId, jobId, failedAt',
    maintenanceEvents: 'id, printerInstanceId, partType, occurredAt',
    syncTombstones: 'id, store, deletedAt',
  });
  return db;
}

/** A fully-populated no-op MergePlan — tests overwrite just the stores they care about. */
function emptyPlan(): MergePlan {
  const winnersByStore = {} as MergePlan['winnersByStore'];
  const deleteIdsByStore = {} as MergePlan['deleteIdsByStore'];
  const summary = {} as MergeSummary;
  for (const store of BACKUP_STORES) {
    winnersByStore[store] = [];
    deleteIdsByStore[store] = [];
    summary[store] = { added: 0, updated: 0, deleted: 0, conflicts: 0 };
  }
  return { winnersByStore, deleteIdsByStore, tombstonesToWrite: [], summary };
}

describe('applyMerge — winners + deletes + tombstones', () => {
  it('writes every store\'s winners via bulkPut', async () => {
    const db = makeTestDb();
    const plan = emptyPlan();
    plan.winnersByStore.materials = [{ id: 'm1', name: 'PLA White', category: 'filament' }];
    plan.winnersByStore.customers = [{ id: 'c1', name: 'Farah', createdAt: new Date('2026-06-01') }];

    await applyMerge(db, plan);

    expect(await db.table('materials').get('m1')).toMatchObject({ name: 'PLA White' });
    expect(await db.table('customers').get('c1')).toMatchObject({ name: 'Farah' });
  });

  it('applies every store\'s deletes via bulkDelete', async () => {
    const db = makeTestDb();
    await db.table('materials').put({ id: 'm1', name: 'Stale', category: 'filament' });
    const plan = emptyPlan();
    plan.deleteIdsByStore.materials = ['m1'];

    await applyMerge(db, plan);

    expect(await db.table('materials').get('m1')).toBeUndefined();
  });

  it('deletes settings rows by their key (not "id")', async () => {
    const db = makeTestDb();
    await db.table('settings').put({ key: 'userProfile', value: '{}' });
    const plan = emptyPlan();
    plan.deleteIdsByStore.settings = ['userProfile'];

    await applyMerge(db, plan);

    expect(await db.table('settings').get('userProfile')).toBeUndefined();
  });

  it('writes tombstonesToWrite into syncTombstones', async () => {
    const db = makeTestDb();
    const plan = emptyPlan();
    // Relative to the real clock: applyMerge prunes tombstones older than
    // SYNC_TOMBSTONE_RETENTION_DAYS, so a fixed calendar date eventually expires.
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const tombstone: SyncTombstone = { id: 'm2', store: 'materials', deletedAt: new Date(Date.now() - ONE_DAY_MS) };
    plan.tombstonesToWrite = [tombstone];

    await applyMerge(db, plan);

    const stored = await db.table('syncTombstones').get('m2');
    expect(stored?.store).toBe('materials');
  });

  it('a job winner carrying one-off lines is written verbatim (47.1 MC-06)', async () => {
    const db = makeTestDb();
    const manualMaterials = [{ id: 'mm-1', name: 'Auger', cost: 200, libraryPrompted: true }];
    const manualPackaging = [{ id: 'mp-1', name: 'Gift wrap', cost: 3.5 }];
    const plan = emptyPlan();
    plan.winnersByStore.jobs = [{
      id: 'job-1', name: 'Benchy', createdAt: new Date('2026-06-01'), manualMaterials, manualPackaging,
    }];

    await applyMerge(db, plan);

    const stored = await db.table('jobs').get('job-1');
    expect(stored.manualMaterials).toEqual(manualMaterials);
    expect(stored.manualPackaging).toEqual(manualPackaging);
  });

  it('winners are written VERBATIM — applyMerge does not re-stamp updatedAt', async () => {
    const db = makeTestDb();
    const fixedUpdatedAt = new Date('2020-01-01T00:00:00.000Z');
    const plan = emptyPlan();
    plan.winnersByStore.materials = [{ id: 'm1', name: 'PLA', category: 'filament', updatedAt: fixedUpdatedAt }];

    await applyMerge(db, plan);

    const stored = await db.table('materials').get('m1');
    expect(stored.updatedAt).toEqual(fixedUpdatedAt);
  });
});

describe('applyMerge — atomicity', () => {
  it('a mid-apply failure rolls back the whole transaction to the pre-apply state', async () => {
    const db = makeTestDb();
    await db.table('materials').put({ id: 'original', name: 'Original', category: 'filament' });
    await db.open();

    const plan = emptyPlan();
    // materials is processed before quotes (BACKUP_STORES order) — its winner
    // should NOT persist once the later quotes write throws.
    plan.winnersByStore.materials = [{ id: 'new-material', name: 'New', category: 'filament' }];
    plan.winnersByStore.quotes = [{ id: 'q1', quoteNumber: 1, printJobId: 'job-1', status: 'sent' }];

    // Force the quotes store's write to fail mid-transaction (same technique
    // as backupRestore.test.ts's restore-atomicity test).
    const quotesTable = db.table('quotes');
    const realBulkPut = quotesTable.bulkPut.bind(quotesTable);
    quotesTable.bulkPut = (() => { throw new Error('simulated mid-merge crash'); }) as typeof quotesTable.bulkPut;

    await expect(applyMerge(db, plan)).rejects.toThrow();
    quotesTable.bulkPut = realBulkPut;

    // Everything rolled back: original record present, new winner absent.
    expect(await db.table('materials').count()).toBe(1);
    expect((await db.table('materials').get('original')).name).toBe('Original');
    expect(await db.table('materials').get('new-material')).toBeUndefined();
    expect(await db.table('quotes').get('q1')).toBeUndefined();
  });
});

describe('applyMerge — retention pruning', () => {
  it('prunes retention-expired tombstones after applying the plan', async () => {
    const db = makeTestDb();
    const now = Date.now();
    const stale = new Date(now - (SYNC_TOMBSTONE_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);
    // Pre-existing stale tombstone (not part of this plan's writes) — prune
    // sweeps the WHOLE store, not just the rows this apply touched.
    await db.table('syncTombstones').put({ id: 'pre-existing-stale', store: 'materials', deletedAt: stale });

    const plan = emptyPlan();
    plan.tombstonesToWrite = [{ id: 'fresh', store: 'materials', deletedAt: new Date(now) }];

    await applyMerge(db, plan);

    const remaining = await db.table('syncTombstones').toArray();
    expect(remaining.map((t: SyncTombstone) => t.id).sort()).toEqual(['fresh']);
  });
});
