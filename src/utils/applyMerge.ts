import type Dexie from 'dexie';
import { pruneTombstones } from '../db/syncStamp';
import { BACKUP_STORES } from './backupSchema';
import type { MergePlan } from './syncMerge';

// ---------------------------------------------------------------------------
// applyMerge — the transactional executor for a MergePlan (44-01's
// computeMerge output). Mirrors restoreBackup's all-or-nothing transaction
// discipline (backupRestore.ts), but MERGES instead of replacing: it writes
// winners, applies deletes, and upserts tombstones for every store, all
// inside ONE Dexie transaction over the affected tables + syncTombstones. A
// thrown error mid-apply rolls the whole transaction back — Dexie's default
// behavior for any error inside a transaction scope.
//
// applyMerge NEVER re-decides a winner or re-stamps updatedAt — computeMerge
// already resolved LWW; this function only applies the plan verbatim.
// ---------------------------------------------------------------------------

/**
 * Applies a MergePlan atomically: bulkPut every store's winners, bulkDelete
 * every store's deleteIds, upsert the tombstones computeMerge decided to
 * keep for propagation, then prune retention-expired tombstones — all
 * inside one `db.transaction('rw', ...)`. A thrown error anywhere in this
 * sequence rolls the entire apply back to the pre-apply state.
 */
export async function applyMerge(database: Dexie, plan: MergePlan): Promise<void> {
  if (!database.isOpen()) await database.open();

  const tables = BACKUP_STORES.map(store => database.table(store));
  const syncTombstonesTable = database.table('syncTombstones');

  await database.transaction('rw', [...tables, syncTombstonesTable], async () => {
    for (const store of BACKUP_STORES) {
      const table = database.table(store);

      const winners = plan.winnersByStore[store];
      if (winners.length > 0) {
        // Written VERBATIM — no re-stamp. computeMerge already chose the
        // authoritative record (including its updatedAt); LWW is decided
        // there, not here.
        await table.bulkPut(winners);
      }

      const deleteIds = plan.deleteIdsByStore[store];
      if (deleteIds.length > 0) {
        await table.bulkDelete(deleteIds);
      }
    }

    if (plan.tombstonesToWrite.length > 0) {
      await syncTombstonesTable.bulkPut(plan.tombstonesToWrite);
    }

    // Runs LAST, inside the same transaction — a throw anywhere above never
    // reaches this line, so pruning only ever commits alongside a fully
    // applied plan.
    await pruneTombstones(database, new Date());
  });
}
