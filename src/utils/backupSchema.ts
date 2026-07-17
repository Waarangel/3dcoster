// ---------------------------------------------------------------------------
// Backup file contract — types and constants only, no logic. Safe to import
// from anywhere (UI, export, restore, tests) without pulling in Dexie.
// ---------------------------------------------------------------------------

/**
 * Envelope format version. Bump ONLY when the backup file shape itself
 * changes incompatibly — NOT on app releases and NOT on Dexie schema bumps
 * (older-data healing is the Dexie upgrade chain + boot reconciles' job).
 */
export const BACKUP_FORMAT_VERSION = 1 as const;

/** Backup files larger than this are rejected BEFORE .text()/JSON.parse. */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

/**
 * Per-store record ceiling enforced inside validateBackupFile itself, so the
 * util stays DoS-safe even for future callers that bypass the UI's byte gate.
 * Far above any real sole-trader dataset (years of jobs ≈ thousands).
 */
export const MAX_RECORDS_PER_STORE = 100_000;

export interface BackupMeta {
  /** Envelope format version (this file's contract), not the Dexie version. */
  backupFormatVersion: number;
  /** db.verno at export time — diagnostics only; restore does NOT gate on it. */
  appSchemaVersion: number;
  /** APP_VERSION at export time — diagnostics only. */
  appVersion: string;
  /** ISO 8601 export timestamp. */
  exportedAt: string;
}

/**
 * Each store is a plain array of its records exactly as Dexie returns them
 * (Date fields flattened to ISO strings by JSON.stringify on export, and
 * rehydrated per DATE_FIELDS on restore). Settings VALUES stay opaque JSON
 * strings — the live store schema is {key, value-string}, and the read-time
 * validators in db/database.ts already guard their consumption.
 */
export interface BackupData {
  materials: unknown[];
  printers: unknown[];
  printerInstances: unknown[];
  jobs: unknown[];
  sales: unknown[];
  settings: { key: string; value: string }[];
  customers: unknown[];
  quotes: unknown[];
  stockEvents: unknown[];
  failureEvents: unknown[];
  maintenanceEvents: unknown[];
}

export interface BackupFile {
  meta: BackupMeta;
  data: BackupData;
}

/**
 * A tombstone marks a deleted record so the deletion can propagate to other
 * devices during a sync merge (SYNC-01 D-06). `store` disambiguates the id
 * across BACKUP_STORES (ids are not globally unique). `deletedAt` is the
 * timestamp the deletion happened locally — computeMerge (44-01 Task 2)
 * compares it against the surviving record's `updatedAt` to implement
 * edit-wins semantics.
 */
export interface SyncTombstone {
  id: string;
  store: BackupStoreName;
  deletedAt: Date;
}

/** Date fields on a SyncTombstone that must be rehydrated on read (mirrors DATE_FIELDS). */
export const TOMBSTONE_DATE_FIELDS = ['deletedAt'] as const;

/**
 * Tombstone retention window (SYNC-01, RESEARCH.md Open Question 1). Longer
 * than any realistic offline gap between two synced devices, but bounded so
 * the tombstone list cannot grow unbounded across a long-lived install.
 * computeMerge prunes tombstones older than this on every merge.
 */
export const SYNC_TOMBSTONE_RETENTION_DAYS = 90;

/** Per-device sync metadata carried in the sync file envelope. */
export interface SyncFileMeta {
  /** Stable per-device UUID, minted client-side on first sync setup. */
  deviceId: string;
  /** ISO 8601 timestamp of this device's last successful sync. */
  lastSyncedAt: string;
}

/**
 * The sync file envelope = the backup envelope (meta + data, validated by
 * validateBackupFile unchanged) PLUS tombstones + syncMeta. Keeping SyncFile
 * as an extension of BackupFile (rather than a parallel shape) is what lets
 * validateSyncFile (syncMerge.ts, Task 2) delegate structural validation to
 * validateBackupFile verbatim instead of re-implementing it.
 */
export interface SyncFile extends BackupFile {
  tombstones: SyncTombstone[];
  syncMeta: SyncFileMeta;
}

/**
 * The 9 store names in fixed order — the single source of truth for
 * iteration in export, validation, and the restore transaction.
 */
export const BACKUP_STORES = [
  'materials', 'printers', 'printerInstances', 'jobs',
  'sales', 'settings', 'customers', 'quotes', 'stockEvents',
  'failureEvents', 'maintenanceEvents',
] as const;
export type BackupStoreName = (typeof BACKUP_STORES)[number];

/**
 * Explicit per-store Date-field map (from src/types.ts). Restore rehydrates
 * EXACTLY these fields back to Date objects — deliberately NOT a blanket
 * "revive anything ISO-shaped" reviver, which would corrupt free-text fields
 * (a note containing an ISO string must stay a string). An optional field
 * that is absent stays absent; a present value that does not parse to a
 * valid Date fails validation for the whole file.
 */
export const DATE_FIELDS: Record<BackupStoreName, readonly string[]> = {
  // Phase 41 LIFE-01 (D-09): Asset.openedAt is a Date field — rehydrate it
  // on restore. dryingLog is intentionally NOT listed here: it's an array of
  // ISO date-only STRINGS by design (D-10) and must stay strings.
  // Phase 44-01 (SYNC-01, D-05): 'updatedAt' appended to every store below —
  // the LWW basis for sync merges. Additive only, existing fields preserved.
  materials: ['openedAt', 'updatedAt'],
  printers: ['updatedAt'],
  printerInstances: ['purchaseDate', 'updatedAt'],
  jobs: ['createdAt', 'updatedAt'],
  sales: ['soldAt', 'updatedAt'],
  // Settings rows gain a stamped updatedAt in 44-03 for row-level LWW.
  settings: ['updatedAt'],
  customers: ['createdAt', 'lastUsedAt', 'updatedAt'],
  // Phase 43-04 (PRO-02): publishedAt/hostedDecisionAt/hostedExpiresAt are
  // the three additive Date fields on Quote's hosted-quote publish metadata
  // (src/types.ts) — all three must round-trip or a restored backup would
  // silently downgrade them to strings (Rule 1: hostedExpiresAt wasn't named
  // explicitly in the plan's action text but is a Date-typed field with the
  // exact same round-trip requirement as the other two).
  quotes: ['createdAt', 'sentAt', 'decisionAt', 'convertedAt', 'publishedAt', 'hostedDecisionAt', 'hostedExpiresAt', 'updatedAt'],
  stockEvents: ['timestamp', 'updatedAt'],
  failureEvents: ['failedAt', 'updatedAt'],
  maintenanceEvents: ['occurredAt', 'updatedAt'],
};
