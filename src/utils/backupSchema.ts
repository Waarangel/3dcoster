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
}

export interface BackupFile {
  meta: BackupMeta;
  data: BackupData;
}

/**
 * The 9 store names in fixed order — the single source of truth for
 * iteration in export, validation, and the restore transaction.
 */
export const BACKUP_STORES = [
  'materials', 'printers', 'printerInstances', 'jobs',
  'sales', 'settings', 'customers', 'quotes', 'stockEvents',
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
  materials: [],
  printers: [],
  printerInstances: ['purchaseDate'],
  jobs: ['createdAt', 'updatedAt'],
  sales: ['soldAt'],
  settings: [],
  customers: ['createdAt', 'lastUsedAt'],
  quotes: ['createdAt', 'sentAt', 'decisionAt', 'convertedAt'],
  stockEvents: ['timestamp'],
};
