import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { applyJobStockEvents, upsertJobStockEvents, removeJobStockEvents } from './stockEventsWriter';
import { deriveStockByAsset } from './stockEvents';
import type { StockEvent } from '../types';
import type { JobStockSource } from './stockEvents';

let counter = 0;
function makeDb(): Dexie {
  const db = new Dexie(`StockWriterTest-${++counter}`);
  db.version(1).stores({ stockEvents: 'id, assetId, refId, timestamp' });
  return db;
}
const table = (db: Dexie) => db.table<StockEvent, string>('stockEvents');
const NOW = new Date('2026-06-19T12:00:00.000Z');

function job(p: Partial<JobStockSource> & { id: string }): JobStockSource {
  return { filaments: [], materialsUsed: [], packagingMaterials: [], ...p };
}

describe('applyJobStockEvents', () => {
  it('writes one negative event per consumed asset on first save', async () => {
    const db = makeDb();
    await applyJobStockEvents(db, job({
      id: 'j1',
      filaments: [{ filamentId: 'pla', grams: 120 }],
      materialsUsed: [{ materialId: 'resin', quantity: 2 }],
    }), NOW);

    const all = await table(db).toArray();
    expect(all).toHaveLength(2);
    expect(deriveStockByAsset(all)).toEqual(new Map([['pla', -120], ['resin', -2]]));
  });

  it('is idempotent — re-saving the same job does not double-deduct', async () => {
    const db = makeDb();
    const j = job({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 120 }] });
    await applyJobStockEvents(db, j, NOW);
    await applyJobStockEvents(db, j, NOW); // e.g. StrictMode double-invoke / re-save

    expect(await table(db).count()).toBe(1);
    expect(deriveStockByAsset(await table(db).toArray()).get('pla')).toBe(-120);
  });

  it('reflects an edited job — old events replaced, not accumulated', async () => {
    const db = makeDb();
    await applyJobStockEvents(db, job({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 120 }] }), NOW);
    // user edits the job: less filament, and a material removed/added
    await applyJobStockEvents(db, job({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 80 }] }), NOW);

    expect(await table(db).count()).toBe(1);
    expect(deriveStockByAsset(await table(db).toArray()).get('pla')).toBe(-80);
  });

  it('only touches the edited job, leaving other jobs\' events intact', async () => {
    const db = makeDb();
    await applyJobStockEvents(db, job({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 100 }] }), NOW);
    await applyJobStockEvents(db, job({ id: 'j2', filaments: [{ filamentId: 'pla', grams: 50 }] }), NOW);
    await applyJobStockEvents(db, job({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 10 }] }), NOW);

    expect(deriveStockByAsset(await table(db).toArray()).get('pla')).toBe(-60); // 10 + 50
  });
});

describe('removeJobStockEvents', () => {
  it('clears a deleted job\'s events and leaves the rest', async () => {
    const db = makeDb();
    await applyJobStockEvents(db, job({ id: 'j1', filaments: [{ filamentId: 'pla', grams: 100 }] }), NOW);
    await applyJobStockEvents(db, job({ id: 'j2', filaments: [{ filamentId: 'pla', grams: 50 }] }), NOW);

    await db.transaction('rw', table(db), () => removeJobStockEvents(db, 'j1'));

    const remaining = await table(db).toArray();
    expect(remaining.every(e => e.refId === 'j2')).toBe(true);
    expect(deriveStockByAsset(remaining).get('pla')).toBe(-50);
  });
});

describe('upsertJobStockEvents (in-transaction)', () => {
  it('works when the caller owns the transaction (atomic with a job write)', async () => {
    const db = makeDb();
    const j = job({ id: 'j1', filaments: [{ filamentId: 'petg', grams: 200 }] });
    await db.transaction('rw', table(db), () => upsertJobStockEvents(db, j, NOW));
    expect(deriveStockByAsset(await table(db).toArray()).get('petg')).toBe(-200);
  });
});
