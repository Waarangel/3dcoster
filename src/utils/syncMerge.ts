import { hasForbiddenKey, isPlainRecord, validateBackupFile } from './backupRestore';
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_STORES,
  SYNC_TOMBSTONE_RETENTION_DAYS,
  type BackupData,
  type BackupMeta,
  type BackupStoreName,
  type SyncFile,
  type SyncFileMeta,
  type SyncTombstone,
} from './backupSchema';

// ---------------------------------------------------------------------------
// Sync merge planner — pure functions only. No Dexie, no React, no I/O.
//
// validateSyncFile delegates ALL structural/forbidden-key/record-count
// validation to validateBackupFile (backupRestore.ts) and adds only the
// schema-version gate + tombstones/syncMeta presence checks on top — it does
// NOT re-implement or weaken the __proto__/constructor/prototype rejection
// (T-44-01-01). computeMerge is a pure planner: it returns the winners to
// write and the ids to delete, but performs no writes itself. The
// transactional executor (applyMerge) is plan 44-03's job.
// ---------------------------------------------------------------------------

export type SyncValidationResult =
  | { ok: true; file: SyncFile }
  | { ok: false; error: string };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDate(raw: unknown): Date | undefined {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? undefined : raw;
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function validateTombstones(raw: unknown): { ok: true; tombstones: SyncTombstone[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Sync file is missing its tombstones list or it is not an array' };
  }
  const tombstones: SyncTombstone[] = [];
  for (const entry of raw) {
    if (!isPlainRecord(entry)) {
      return { ok: false, error: 'tombstones: contains a non-object record' };
    }
    const evilKey = hasForbiddenKey(entry);
    if (evilKey) {
      return { ok: false, error: `tombstones: record contains a forbidden key ("${evilKey}") — file rejected` };
    }
    if (typeof entry.id !== 'string' || entry.id.length === 0) {
      return { ok: false, error: 'tombstones: entry is missing a string id' };
    }
    if (typeof entry.store !== 'string' || !(BACKUP_STORES as readonly string[]).includes(entry.store)) {
      return { ok: false, error: `tombstones: entry has an unrecognized store "${String(entry.store)}"` };
    }
    const deletedAt = toDate(entry.deletedAt);
    if (!deletedAt) {
      return { ok: false, error: 'tombstones: entry has a missing or invalid deletedAt' };
    }
    tombstones.push({ id: entry.id, store: entry.store as BackupStoreName, deletedAt });
  }
  return { ok: true, tombstones };
}

function validateSyncMeta(raw: unknown): { ok: true; syncMeta: SyncFileMeta } | { ok: false; error: string } {
  if (!isPlainRecord(raw)) {
    return { ok: false, error: 'Sync file is missing its syncMeta section' };
  }
  if (typeof raw.deviceId !== 'string' || raw.deviceId.length === 0) {
    return { ok: false, error: 'syncMeta: missing a string deviceId' };
  }
  if (typeof raw.lastSyncedAt !== 'string' || !toDate(raw.lastSyncedAt)) {
    return { ok: false, error: 'syncMeta: missing or invalid lastSyncedAt' };
  }
  return { ok: true, syncMeta: { deviceId: raw.deviceId, lastSyncedAt: raw.lastSyncedAt } };
}

/**
 * Validates a parsed sync file: structure + forbidden-key + record counts
 * (delegated to validateBackupFile, unchanged), PLUS the schema-version gate
 * and the tombstones/syncMeta envelope fields unique to sync files. Any
 * failure rejects the WHOLE file — same discipline as validateBackupFile.
 */
export function validateSyncFile(parsed: unknown): SyncValidationResult {
  const structural = validateBackupFile(parsed);
  if (!structural.ok) {
    return { ok: false, error: structural.error };
  }

  // validateBackupFile already confirmed parsed is a plain record with
  // plain-record meta/data sections — safe to narrow here.
  const record = parsed as Record<string, unknown>;
  const meta = record.meta as Record<string, unknown>;

  if (meta.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      error:
        `This sync file was made by a different app version (format ${String(meta.backupFormatVersion)}) ` +
        'and cannot be merged safely — export a fresh backup instead.',
    };
  }

  const tombstonesResult = validateTombstones(record.tombstones);
  if (!tombstonesResult.ok) return tombstonesResult;

  const syncMetaResult = validateSyncMeta(record.syncMeta);
  if (!syncMetaResult.ok) return syncMetaResult;

  return {
    ok: true,
    file: {
      meta: meta as unknown as BackupMeta,
      data: structural.file.stores as unknown as BackupData,
      tombstones: tombstonesResult.tombstones,
      syncMeta: syncMetaResult.syncMeta,
    },
  };
}

// ---------------------------------------------------------------------------
// computeMerge
// ---------------------------------------------------------------------------

export interface StoreMergeCounts {
  added: number;
  updated: number;
  deleted: number;
  conflicts: number;
}

export type MergeSummary = Record<BackupStoreName, StoreMergeCounts>;

export interface MergeInput {
  localByStore: Record<BackupStoreName, Record<string, unknown>[]>;
  remoteByStore: Record<BackupStoreName, Record<string, unknown>[]>;
  localTombstones: SyncTombstone[];
  remoteTombstones: SyncTombstone[];
  /** This device's last successful sync timestamp — undefined on first-ever sync. */
  lastSyncedAt: Date | string | undefined;
  /** Reference "now" for tombstone retention pruning — pass real Date.now() in production, fixed in tests. */
  now: Date;
}

export interface MergePlan {
  winnersByStore: Record<BackupStoreName, Record<string, unknown>[]>;
  deleteIdsByStore: Record<BackupStoreName, string[]>;
  tombstonesToWrite: SyncTombstone[];
  summary: MergeSummary;
}

function getRecordId(store: BackupStoreName, record: Record<string, unknown>): string | undefined {
  const raw = store === 'settings' ? record.key : record.id;
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

function emptyCounts(): StoreMergeCounts {
  return { added: 0, updated: 0, deleted: 0, conflicts: 0 };
}

function isWithinRetention(deletedAt: Date, now: Date): boolean {
  return now.getTime() - deletedAt.getTime() <= SYNC_TOMBSTONE_RETENTION_DAYS * MS_PER_DAY;
}

/**
 * Pure merge planner: NO Dexie access, NO writes. Resolves last-write-wins
 * (D-05), tombstone edit-wins in BOTH directions (D-06 — a remote tombstone
 * vs a surviving local edit, AND a local tombstone vs a resurrecting remote
 * edit), per-store added/updated/deleted counts with a distinct conflict
 * flag (D-07), and retention-pruned tombstone propagation.
 *
 * Records with NO updatedAt are treated as older than any stamped record —
 * they never win a comparison against a stamped record or survive a
 * tombstone. Equal timestamps keep local (deterministic tiebreak).
 */
export function computeMerge(input: MergeInput): MergePlan {
  const { localByStore, remoteByStore, localTombstones, remoteTombstones, now } = input;
  const lastSyncedAt = toDate(input.lastSyncedAt);

  const winnersByStore = {} as MergePlan['winnersByStore'];
  const deleteIdsByStore = {} as MergePlan['deleteIdsByStore'];
  const summary = {} as MergeSummary;
  const tombstonesToWrite: SyncTombstone[] = [];

  for (const store of BACKUP_STORES) {
    const winners: Record<string, unknown>[] = [];
    const deleteIds: string[] = [];
    const counts = emptyCounts();

    const localMap = new Map<string, Record<string, unknown>>();
    for (const rec of localByStore[store] ?? []) {
      const id = getRecordId(store, rec);
      if (id) localMap.set(id, rec);
    }
    const remoteMap = new Map<string, Record<string, unknown>>();
    for (const rec of remoteByStore[store] ?? []) {
      const id = getRecordId(store, rec);
      if (id) remoteMap.set(id, rec);
    }
    const localTombMap = new Map<string, SyncTombstone>();
    for (const t of localTombstones) if (t.store === store) localTombMap.set(t.id, t);
    const remoteTombMap = new Map<string, SyncTombstone>();
    for (const t of remoteTombstones) if (t.store === store) remoteTombMap.set(t.id, t);

    const allIds = new Set<string>([
      ...localMap.keys(),
      ...remoteMap.keys(),
      ...localTombMap.keys(),
      ...remoteTombMap.keys(),
    ]);

    for (const id of allIds) {
      const localRecord = localMap.get(id);
      const remoteRecord = remoteMap.get(id);
      const localTomb = localTombMap.get(id);
      const remoteTomb = remoteTombMap.get(id);

      // Case: locally deleted, remote still has a copy — resurrect if the
      // remote edit postdates the local deletion (mirror of the primary
      // tombstone rule below).
      if (localTomb && remoteRecord) {
        const remoteUpdatedAt = toDate(remoteRecord.updatedAt);
        if (remoteUpdatedAt && remoteUpdatedAt.getTime() > localTomb.deletedAt.getTime()) {
          winners.push(remoteRecord);
          counts.added += 1;
          // Local tombstone superseded — dropped, not carried forward.
        } else if (isWithinRetention(localTomb.deletedAt, now)) {
          tombstonesToWrite.push(localTomb);
        }
        continue;
      }

      // Primary rule (D-06 truth): a remote tombstone deletes the local
      // record UNLESS the local record's updatedAt is missing or <= the
      // tombstone's deletedAt.
      if (remoteTomb && localRecord) {
        const localUpdatedAt = toDate(localRecord.updatedAt);
        if (localUpdatedAt && localUpdatedAt.getTime() > remoteTomb.deletedAt.getTime()) {
          // Edit wins — record survives, tombstone dropped.
        } else {
          deleteIds.push(id);
          counts.deleted += 1;
          if (isWithinRetention(remoteTomb.deletedAt, now)) {
            tombstonesToWrite.push(remoteTomb);
          }
        }
        continue;
      }

      // Both sides deleted — keep the later deletion for propagation.
      if (localTomb && remoteTomb) {
        const keep = remoteTomb.deletedAt.getTime() >= localTomb.deletedAt.getTime() ? remoteTomb : localTomb;
        if (isWithinRetention(keep.deletedAt, now)) tombstonesToWrite.push(keep);
        continue;
      }

      // Tombstone with no counterpart on the other side — keep for future propagation.
      if (localTomb) {
        if (isWithinRetention(localTomb.deletedAt, now)) tombstonesToWrite.push(localTomb);
        continue;
      }
      if (remoteTomb) {
        if (isWithinRetention(remoteTomb.deletedAt, now)) tombstonesToWrite.push(remoteTomb);
        continue;
      }

      // Both sides have a live record — LWW.
      if (localRecord && remoteRecord) {
        const localUpdatedAt = toDate(localRecord.updatedAt);
        const remoteUpdatedAt = toDate(remoteRecord.updatedAt);

        if (
          lastSyncedAt &&
          localUpdatedAt &&
          remoteUpdatedAt &&
          localUpdatedAt.getTime() > lastSyncedAt.getTime() &&
          remoteUpdatedAt.getTime() > lastSyncedAt.getTime()
        ) {
          counts.conflicts += 1;
        }

        const localTime = localUpdatedAt ? localUpdatedAt.getTime() : -Infinity;
        const remoteTime = remoteUpdatedAt ? remoteUpdatedAt.getTime() : -Infinity;
        if (remoteTime > localTime) {
          winners.push(remoteRecord);
          counts.updated += 1;
        }
        // Equal or local-newer: keep local, no write.
        continue;
      }

      // Remote-only — add.
      if (remoteRecord) {
        winners.push(remoteRecord);
        counts.added += 1;
        continue;
      }

      // Local-only — nothing to do, stays as-is.
    }

    winnersByStore[store] = winners;
    deleteIdsByStore[store] = deleteIds;
    summary[store] = counts;
  }

  return { winnersByStore, deleteIdsByStore, tombstonesToWrite, summary };
}
