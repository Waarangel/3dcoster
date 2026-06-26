// ---------------------------------------------------------------------------
// Inventory ledger — Dexie writers (v1.8, feature #20, phase 28). Idempotent
// per job: a job's stock events are keyed by refId = job.id, so we delete the
// job's prior events and re-insert the current set on every save. This keeps
// derived stock correct across create / edit / delete with no double-counting.
// The pure event-building + derivation live in ./stockEvents (no Dexie import).
//
// All writers take the Dexie instance and resolve the stockEvents table via
// db.table(...). Inside an active db.transaction(...) Dexie returns the
// transaction-bound table, so upsert/remove run atomically with the job write.
//
// ATOMICITY CONTRACT (v1.9 DATA-03): atomicity with the job write only holds
// when the CALLER opens a single rw transaction over both `jobs` and
// `stockEvents` and calls `upsertJobStockEvents` inside it (the useJobs
// add/update path does exactly this). The standalone `applyJobStockEvents`
// below opens its OWN transaction over `stockEvents` only — it is for
// callers/tests that are NOT already inside a job-write transaction, and it is
// therefore NOT atomic with any external job write.
// ---------------------------------------------------------------------------
import Dexie from 'dexie';
import type { StockEvent } from '../types';
import { buildJobStockEvents, type BuildJobStockEventsOptions, type JobStockSource } from './stockEvents';

const stockEventsTable = (db: Dexie) => db.table<StockEvent, string>('stockEvents');

/**
 * Replace a job's stock events. When called inside an existing transaction
 * (the useJobs add/update path) the deduction is atomic with the job write.
 */
export async function upsertJobStockEvents(
  db: Dexie,
  job: JobStockSource,
  now: Date,
  options?: BuildJobStockEventsOptions,
): Promise<void> {
  const table = stockEventsTable(db);
  await table.where('refId').equals(job.id).delete();
  const events = buildJobStockEvents(job, now, options);
  if (events.length > 0) await table.bulkPut(events);
}

/** Drop a job's stock events (used inside the deleteJob transaction). */
export async function removeJobStockEvents(db: Dexie, jobId: string): Promise<void> {
  await stockEventsTable(db).where('refId').equals(jobId).delete();
}

/**
 * Standalone variant that owns its own transaction — for callers/tests that
 * aren't already inside one.
 *
 * Examples:
 *   await applyJobStockEvents(db, job, new Date());            // deduct on save
 *   await applyJobStockEvents(db, job, now, { includePackaging: false });
 */
export async function applyJobStockEvents(
  db: Dexie,
  job: JobStockSource,
  now: Date,
  options?: BuildJobStockEventsOptions,
): Promise<void> {
  await db.transaction('rw', stockEventsTable(db), () => upsertJobStockEvents(db, job, now, options));
}
