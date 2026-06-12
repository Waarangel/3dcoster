import type Dexie from 'dexie';
import {
  BACKUP_STORES,
  DATE_FIELDS,
  MAX_RECORDS_PER_STORE,
  type BackupStoreName,
} from './backupSchema';

// ---------------------------------------------------------------------------
// Backup restore — the security core. A backup file is UNTRUSTED INPUT that
// gets written into the entire database, so everything here is
// validate-everything-then-write-once:
//
//   1. validateBackupFile checks the whole file structurally and rehydrates
//      Date fields. ANY failure rejects the ENTIRE file — no partial
//      restores, no best-effort row skipping (a half-restored database is
//      worse than a failed restore).
//   2. restoreBackup wraps clear()+bulkPut() of all 8 stores in ONE Dexie
//      transaction — a crash or error mid-restore rolls back to the
//      pre-restore state.
//
// Records carrying __proto__/constructor/prototype keys at the top level are
// treated as hostile (whole-file rejection). This check is defense-in-depth,
// not the sole guard: JSON.parse creates such names as plain own properties
// (never touching Object.prototype), and IndexedDB's structured clone strips
// prototype linkage on write AND read — so nested occurrences are inert by
// spec. Security review 2026-06-12 confirmed no pollution path via bulkPut
// or the {...record} spreads in useDatabase.
//
// Settings rows: keys are NOT allowlisted on purpose. A backup made by a
// NEWER app version may carry settings keys this version doesn't know;
// restoring them verbatim preserves the user's data for after they update.
// Safe because every settings consumer reads via getSetting() with a
// type-guard validator (db/database.ts) — unknown rows are simply inert.
// Follows the hand-rolled type-guard convention from db/database.ts —
// deliberately no schema library dependency.
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export type ValidationResult =
  | { ok: true; file: ValidatedBackup }
  | { ok: false; error: string };

/** Post-validation shape: records rehydrated, ready for bulkPut. */
export interface ValidatedBackup {
  stores: Record<BackupStoreName, Record<string, unknown>[]>;
  counts: Record<BackupStoreName, number>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasForbiddenKey(record: Record<string, unknown>): string | null {
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_KEYS.has(key)) return key;
  }
  return null;
}

/**
 * Rehydrates the store's DATE_FIELDS on a shallow copy of the record.
 * Returns an error string instead of the record when a present date value
 * does not parse — silent coercion to Invalid Date would corrupt sort
 * indexes (createdAt/soldAt) downstream.
 */
function rehydrateRecord(
  store: BackupStoreName,
  record: Record<string, unknown>,
): { record: Record<string, unknown> } | { error: string } {
  const fields = DATE_FIELDS[store];
  if (fields.length === 0) return { record };

  const copy: Record<string, unknown> = { ...record };
  for (const field of fields) {
    if (!(field in copy) || copy[field] == null) continue; // optional + absent
    const raw = copy[field];
    const date = typeof raw === 'string' || raw instanceof Date ? new Date(raw) : null;
    if (date === null || Number.isNaN(date.getTime())) {
      return { error: `${store}: field "${field}" is not a valid date` };
    }
    copy[field] = date;
  }
  return { record: copy };
}

/**
 * Validates the parsed JSON structurally and rehydrates Date fields.
 * Whole-file semantics: the first failure rejects everything.
 */
export function validateBackupFile(parsed: unknown): ValidationResult {
  if (!isPlainRecord(parsed)) {
    return { ok: false, error: 'Backup file is not a JSON object' };
  }
  if (!isPlainRecord(parsed.meta)) {
    return { ok: false, error: 'Backup file is missing its meta section' };
  }
  if (!isPlainRecord(parsed.data)) {
    return { ok: false, error: 'Backup file is missing its data section' };
  }

  const data = parsed.data as Record<string, unknown>;
  const stores = {} as ValidatedBackup['stores'];
  const counts = {} as ValidatedBackup['counts'];

  for (const store of BACKUP_STORES) {
    const rows = data[store];
    if (!Array.isArray(rows)) {
      return { ok: false, error: `Backup is missing the "${store}" section or it is not a list` };
    }
    if (rows.length > MAX_RECORDS_PER_STORE) {
      return { ok: false, error: `${store}: too many records (${rows.length}) — this doesn't look like a real backup` };
    }

    const validated: Record<string, unknown>[] = [];
    for (const row of rows) {
      if (!isPlainRecord(row)) {
        return { ok: false, error: `${store}: contains a non-object record` };
      }
      const evilKey = hasForbiddenKey(row);
      if (evilKey) {
        return { ok: false, error: `${store}: record contains a forbidden key ("${evilKey}") — file rejected` };
      }
      if (store === 'settings') {
        if (typeof row.key !== 'string' || typeof row.value !== 'string') {
          return { ok: false, error: 'settings: each row must have a string key and a string value' };
        }
      } else if (typeof row.id !== 'string' || row.id.length === 0) {
        return { ok: false, error: `${store}: record is missing a string id` };
      }

      const rehydrated = rehydrateRecord(store, row);
      if ('error' in rehydrated) {
        return { ok: false, error: rehydrated.error };
      }
      validated.push(rehydrated.record);
    }

    stores[store] = validated;
    counts[store] = validated.length;
  }

  return { ok: true, file: { stores, counts } };
}

/**
 * Replace-all restore: validates the parsed backup (throwing with the
 * validation message on failure, BEFORE any write), then clears and rewrites
 * all 8 stores inside one atomic transaction. Dexie rolls the transaction
 * back automatically if anything throws mid-restore.
 *
 * Callers must trigger a full page reload after this resolves — the boot
 * reconciles are gated by per-session module flags and the settings hooks
 * read once on mount, so a reactive refresh would leave stale state (same
 * reasoning as handleVersionchange in db/database.ts).
 */
export async function restoreBackup(database: Dexie, parsed: unknown): Promise<void> {
  const result = validateBackupFile(parsed);
  if (!result.ok) {
    throw new Error(result.error);
  }

  if (!database.isOpen()) await database.open();

  const tables = BACKUP_STORES.map(store => database.table(store));
  await database.transaction('rw', tables, async () => {
    for (const store of BACKUP_STORES) {
      const table = database.table(store);
      await table.clear();
      await table.bulkPut(result.file.stores[store]);
    }
  });
}
