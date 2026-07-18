import 'fake-indexeddb/auto';
import { describe, it, expect, afterAll } from 'vitest';
import Dexie from 'dexie';
import { stampAndAdd, stampAndPut, stampAndBulkPut, writeTombstone, pruneTombstones } from './syncStamp';
import { db } from './database';
import type { SyncTombstone } from '../utils/backupSchema';
import { SYNC_TOMBSTONE_RETENTION_DAYS } from '../utils/backupSchema';

// ---------------------------------------------------------------------------
// syncStamp.ts — TDD suite written BEFORE the implementation (Task 1, RED).
//
// stampAndAdd/stampAndPut/stampAndBulkPut are exercised against a throwaway
// Dexie instance (mirrors stockEventsWriter.test.ts's `makeDb()` pattern) so
// they stay decoupled from the real v13 schema. writeTombstone/pruneTombstones
// are exercised the same way against a minimal `syncTombstones` store.
//
// The v13 schema itself (db opens at verno 13 with an empty syncTombstones
// store, no backfill) is verified against the REAL singleton at the bottom —
// this is the only test file that opens it under fake-indexeddb.
// ---------------------------------------------------------------------------

interface Widget {
  id: string;
  name: string;
  updatedAt?: Date;
}

let counter = 0;
function makeDb(): Dexie {
  const testDb = new Dexie(`SyncStampTest-${++counter}`);
  testDb.version(1).stores({
    widgets: 'id, name',
    syncTombstones: 'id, store, deletedAt',
  });
  return testDb;
}
const widgets = (testDb: Dexie) => testDb.table<Widget, string>('widgets');
const tombstones = (testDb: Dexie) => testDb.table<SyncTombstone, string>('syncTombstones');

describe('stampAndAdd', () => {
  it('stamps a fresh updatedAt and writes the record', async () => {
    const testDb = makeDb();
    const record: Widget = { id: 'w1', name: 'Gadget' };

    const stamped = await stampAndAdd(widgets(testDb), record);

    expect(stamped.updatedAt).toBeInstanceOf(Date);
    const stored = await widgets(testDb).get('w1');
    expect(stored?.name).toBe('Gadget');
    expect(stored?.updatedAt).toEqual(stamped.updatedAt);
  });

  it('does NOT mutate the input record', async () => {
    const testDb = makeDb();
    const record: Widget = { id: 'w2', name: 'Gizmo' };

    await stampAndAdd(widgets(testDb), record);

    expect(record).not.toHaveProperty('updatedAt');
  });
});

describe('stampAndPut', () => {
  it('stamps a fresh updatedAt on overwrite', async () => {
    const testDb = makeDb();
    await widgets(testDb).put({ id: 'w1', name: 'Gadget' });

    const stamped = await stampAndPut(widgets(testDb), { id: 'w1', name: 'Gadget v2' });

    expect(stamped.updatedAt).toBeInstanceOf(Date);
    const stored = await widgets(testDb).get('w1');
    expect(stored?.name).toBe('Gadget v2');
    expect(stored?.updatedAt).toEqual(stamped.updatedAt);
  });

  it('does NOT mutate the input record', async () => {
    const testDb = makeDb();
    const record: Widget = { id: 'w1', name: 'Gadget' };

    await stampAndPut(widgets(testDb), record);

    expect(record).not.toHaveProperty('updatedAt');
  });
});

describe('stampAndBulkPut', () => {
  it('stamps a fresh updatedAt on every row', async () => {
    const testDb = makeDb();
    const records: Widget[] = [{ id: 'w1', name: 'A' }, { id: 'w2', name: 'B' }];

    const stamped = await stampAndBulkPut(widgets(testDb), records);

    expect(stamped.every(r => r.updatedAt instanceof Date)).toBe(true);
    const all = await widgets(testDb).toArray();
    expect(all).toHaveLength(2);
    expect(all.every(r => r.updatedAt instanceof Date)).toBe(true);
  });

  it('does NOT mutate any input record', async () => {
    const testDb = makeDb();
    const records: Widget[] = [{ id: 'w1', name: 'A' }];

    await stampAndBulkPut(widgets(testDb), records);

    expect(records[0]).not.toHaveProperty('updatedAt');
  });
});

describe('writeTombstone', () => {
  it('inserts a {id, store, deletedAt} row inside the passed transaction', async () => {
    const testDb = makeDb();

    await testDb.transaction('rw', tombstones(testDb), async (tx) => {
      await writeTombstone(tx, 'materials', 'm1');
    });

    const stored = await tombstones(testDb).get('m1');
    expect(stored).toBeDefined();
    expect(stored?.store).toBe('materials');
    expect(stored?.deletedAt).toBeInstanceOf(Date);
  });

  it('accepts the live Dexie instance directly (no ambient transaction)', async () => {
    const testDb = makeDb();

    await writeTombstone(testDb, 'sales', 's1');

    const stored = await tombstones(testDb).get('s1');
    expect(stored?.store).toBe('sales');
  });
});

describe('pruneTombstones', () => {
  it('removes tombstones older than the retention window, keeps recent ones', async () => {
    const testDb = makeDb();
    const now = new Date('2026-07-18T00:00:00.000Z');
    const stale = new Date(now.getTime() - (SYNC_TOMBSTONE_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);
    const fresh = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    await tombstones(testDb).bulkPut([
      { id: 'old', store: 'materials', deletedAt: stale },
      { id: 'recent', store: 'materials', deletedAt: fresh },
    ]);

    await pruneTombstones(testDb, now);

    const remaining = await tombstones(testDb).toArray();
    expect(remaining.map(t => t.id)).toEqual(['recent']);
  });

  it('is a no-op when no tombstones are stale', async () => {
    const testDb = makeDb();
    const now = new Date('2026-07-18T00:00:00.000Z');
    await tombstones(testDb).put({ id: 'recent', store: 'materials', deletedAt: now });

    await pruneTombstones(testDb, now);

    expect(await tombstones(testDb).count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// v13 schema — the real singleton, opened under fake-indexeddb.
// ---------------------------------------------------------------------------

describe('db v13 syncTombstones store', () => {
  afterAll(async () => {
    if (db.isOpen()) db.close();
  });

  it('opens at verno 13 with an empty syncTombstones store (no backfill)', async () => {
    await db.open();
    expect(db.verno).toBe(13);
    expect(await db.table('syncTombstones').count()).toBe(0);
  });
});
