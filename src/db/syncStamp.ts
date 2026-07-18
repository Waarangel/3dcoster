import type Dexie from 'dexie';
import type { Transaction } from 'dexie';
import { SYNC_TOMBSTONE_RETENTION_DAYS, type BackupStoreName, type SyncTombstone } from '../utils/backupSchema';

// ---------------------------------------------------------------------------
// Sync write layer (44-03) — the single choke-point every user-facing Dexie
// write routes through so every store participates in last-write-wins
// (SYNC-01 D-05, RESEARCH.md Pitfall 1). Scattering `updatedAt: new Date()`
// stamping across the ~8 independently-maintained CRUD hooks invites a
// missed call site, which silently breaks LWW for that store (an un-stamped
// newer edit loses on merge). These wrappers + a grep audit of every write
// site (useDatabase.ts) are the mitigation.
//
// writeTombstone/pruneTombstones implement the delete→tombstone half of
// SYNC-01 D-06: deleting a record must leave a `{id, store, deletedAt}`
// tombstone in `syncTombstones` so the deletion propagates to another device
// on the next sync merge (consumed by syncMerge.computeMerge, 44-01).
//
// Deliberately NOT typed against Dexie's full `Table<T, TKey, TInsertType>`
// interface — every call site passes a DIFFERENT concrete EntityTable (each
// with its own TKey/TInsertType), and constraining against the exact Dexie
// generic invites variance friction at every call site for no safety
// benefit here. `Writable<T>` below is the minimal write surface these
// helpers actually use.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Minimal write surface a Dexie EntityTable satisfies structurally. */
interface Writable<T> {
  add(item: T): Promise<unknown>;
  put(item: T): Promise<unknown>;
  bulkPut(items: readonly T[]): Promise<unknown>;
}

/**
 * Stamps `updatedAt` on a COPY of `record` (never mutates the input), writes
 * it via `table.add`, and returns the stamped record.
 */
export async function stampAndAdd<T extends object>(
  table: Writable<T>,
  record: T,
): Promise<T & { updatedAt: Date }> {
  const stamped = { ...record, updatedAt: new Date() };
  await table.add(stamped);
  return stamped;
}

/**
 * Stamps `updatedAt` on a COPY of `record` (never mutates the input), writes
 * it via `table.put`, and returns the stamped record.
 */
export async function stampAndPut<T extends object>(
  table: Writable<T>,
  record: T,
): Promise<T & { updatedAt: Date }> {
  const stamped = { ...record, updatedAt: new Date() };
  await table.put(stamped);
  return stamped;
}

/**
 * Stamps `updatedAt` on a COPY of every record (never mutates the inputs),
 * writes them via `table.bulkPut`, and returns the stamped records.
 */
export async function stampAndBulkPut<T extends object>(
  table: Writable<T>,
  records: readonly T[],
): Promise<(T & { updatedAt: Date })[]> {
  const stamped = records.map(record => ({ ...record, updatedAt: new Date() }));
  await table.bulkPut(stamped);
  return stamped;
}

/**
 * Inserts a `{ id, store, deletedAt }` tombstone into `syncTombstones`. `tx`
 * may be the live Dexie instance or an active Transaction — both expose
 * `.table(name)`, so this composes inside a caller's own
 * `db.transaction('rw', [...], ...)` scope (atomic with the delete it
 * accompanies), mirroring the caller-owns-the-transaction pattern already
 * used by `stockEventsWriter.ts`'s `upsertJobStockEvents`/`removeJobStockEvents`.
 */
export async function writeTombstone(
  tx: Dexie | Transaction,
  store: BackupStoreName,
  id: string,
): Promise<void> {
  // Dexie and Transaction each declare `.table()` via a DIFFERENT overload
  // set, so TypeScript cannot resolve a single generic call signature across
  // the `Dexie | Transaction` union. Narrow through a minimal structural
  // type instead — both classes satisfy it identically at runtime.
  const resolver = tx as { table(name: string): { put(item: SyncTombstone): Promise<unknown> } };
  await resolver.table('syncTombstones').put({ id, store, deletedAt: new Date() });
}

/**
 * Removes tombstones older than `SYNC_TOMBSTONE_RETENTION_DAYS` relative to
 * `now`. Safe to call inside an ambient Dexie transaction (Dexie's PSD zone
 * tracking routes the `db.table(...)` calls to the active transaction) or
 * standalone.
 */
export async function pruneTombstones(db: Dexie, now: Date): Promise<void> {
  const table = db.table<SyncTombstone, string>('syncTombstones');
  const cutoff = now.getTime() - SYNC_TOMBSTONE_RETENTION_DAYS * MS_PER_DAY;
  const stale = await table.filter(t => t.deletedAt.getTime() < cutoff).toArray();
  if (stale.length > 0) {
    await table.bulkDelete(stale.map(t => t.id));
  }
}
