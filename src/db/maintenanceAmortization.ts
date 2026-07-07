// ---------------------------------------------------------------------------
// Maintenance amortization + next-swap prediction — pure helpers (Phase 39
// WEAR-01/02, D-14/D-15). No Dexie import here so the derivation logic is
// unit-testable in isolation, mirroring src/db/stockEvents.ts's sibling
// convention. The Dexie read wrapper lives in
// src/hooks/useMaintenanceAmortization.ts.
//
// These are PREDICTION/informational computations ONLY (RESEARCH.md
// Assumption A4) — they never modify calculateNozzleWear or per-job cost.
// ---------------------------------------------------------------------------
import type { Asset, MaintenanceEvent, PrintJob, PrinterInstance } from '../types';
import { resolveIsAbrasive, resolveNozzleType } from '../utils/abrasive';

export interface MaintenanceAmortization {
  amortizedPerHour: number;
  cumulativeCost: number;
  abrasiveHours: number;
}

export interface NextSwapPrediction {
  nextSwapDate: Date;
  intervalHours: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RECENT_PACE_WINDOW_DAYS = 30;
const MIN_JOBS_FOR_RECENT_PACE = 5;
const PART_TYPES: MaintenanceEvent['partType'][] = ['nozzle', 'belt', 'bed', 'other'];

/**
 * D-14: amortized $/hr = total maintenance cost (all part types) ÷ the
 * instance's current printer hours. Returns null at 0 (or negative/invalid)
 * printer-hours to avoid a divide-by-zero — the hint is hidden in that case,
 * per the plan's acceptance criteria.
 *
 * abrasiveHours (WEAR-01) is the cumulative print-time hours this instance
 * has spent on CF/GF-abrasive filaments WHILE its resolved nozzle type is
 * 'brass' — computed from the job list's dominant material per job, per
 * Pattern 4 (auto-detect + override) via resolveIsAbrasive.
 *
 * Examples:
 *   deriveMaintenanceAmortization([{cost:20,...},{cost:15,...}], jobs, instance-with-100h)
 *     → { amortizedPerHour: 0.35, cumulativeCost: 35, abrasiveHours: <computed> }
 *   deriveMaintenanceAmortization(events, jobs, {..., printHours: 0})
 *     → null
 */
export function deriveMaintenanceAmortization(
  events: readonly MaintenanceEvent[],
  jobs: readonly PrintJob[],
  instance: PrinterInstance,
  assetsById: ReadonlyMap<string, Asset>,
): MaintenanceAmortization | null {
  if (!(instance.printHours > 0)) return null;

  const instanceEvents = events.filter(e => e.printerInstanceId === instance.id);
  const cumulativeCost = instanceEvents.reduce((sum, e) => sum + e.cost, 0);
  const amortizedPerHour = cumulativeCost / instance.printHours;

  const abrasiveHours = deriveAbrasiveHours(jobs, instance, assetsById);

  return { amortizedPerHour, cumulativeCost, abrasiveHours };
}

/**
 * Cumulative print-time hours on abrasive (CF/GF/glow/metal-fill) filaments
 * for this instance, gated on the instance's resolved nozzle type being
 * 'brass' (undefined nozzleType resolves to brass via resolveNozzleType —
 * see src/utils/abrasive.ts doc comment). Hardened/ruby nozzles accumulate
 * zero abrasive-hours since they aren't accelerated by abrasive wear.
 */
function deriveAbrasiveHours(
  jobs: readonly PrintJob[],
  instance: PrinterInstance,
  assetsById: ReadonlyMap<string, Asset>,
): number {
  if (resolveNozzleType(instance) !== 'brass') return 0;

  let hours = 0;
  for (const job of jobs) {
    if (job.printerInstanceId !== instance.id) continue;
    const dominant = dominantFilamentAsset(job, assetsById);
    if (dominant && resolveIsAbrasive(dominant)) {
      hours += job.printTimeHours;
    }
  }
  return hours;
}

/** The highest-weight (by grams) filament asset used on a job, or undefined. */
function dominantFilamentAsset(job: PrintJob, assetsById: ReadonlyMap<string, Asset>): Asset | undefined {
  let best: { grams: number; assetId: string } | undefined;
  for (const f of job.filaments ?? []) {
    if (!f.filamentId || !(f.grams > 0)) continue;
    if (!best || f.grams > best.grams) best = { grams: f.grams, assetId: f.filamentId };
  }
  return best ? assetsById.get(best.assetId) : undefined;
}

/**
 * D-15: per-part-category next-swap prediction. For each part type
 * (nozzle/belt/bed/other), derives the average interval (in printer-hours)
 * between that part's own logged swaps, then projects forward from the
 * instance's CURRENT printer hours using the "recent pace" (trailing-30-day
 * avg printTimeHours/day for this instance; all-time average fallback if
 * fewer than 5 jobs fall in that window — RESEARCH.md Open Question 3).
 *
 * A part type with fewer than 2 logged swaps for this instance has no
 * derivable interval and returns null (App.tsx's existing 500h alert is the
 * fallback — D-15, this plan does not remove it).
 *
 * NOTE (WR-04): abrasive-hours do NOT accelerate the nozzle projection.
 * Every part type — nozzle included — is projected purely from its own
 * logged swap intervals. Because swaps are logged at real printer-hours,
 * abrasive wear is already reflected empirically in shorter observed
 * intervals; an explicit acceleration factor was considered and descoped
 * (recorded in the Phase 39 review fix pass). abrasiveHours (WEAR-01) is
 * surfaced as an informational figure via deriveMaintenanceAmortization.
 *
 * Examples:
 *   predictNextSwap(events, jobs, instance) with 3 nozzle swaps at 100h
 *   intervals → { nozzle: { intervalHours: 100, nextSwapDate: <projected> }, belt: null, ... }
 *   predictNextSwap([], jobs, instance) → { nozzle: null, belt: null, bed: null, other: null }
 */
export function predictNextSwap(
  events: readonly MaintenanceEvent[],
  jobs: readonly PrintJob[],
  instance: PrinterInstance,
): Record<MaintenanceEvent['partType'], NextSwapPrediction | null> {
  const instanceEvents = events.filter(e => e.printerInstanceId === instance.id);
  const pace = recentPaceHoursPerDay(jobs, instance);

  const result = {} as Record<MaintenanceEvent['partType'], NextSwapPrediction | null>;
  for (const partType of PART_TYPES) {
    result[partType] = predictForPartType(instanceEvents, instance, partType, pace);
  }
  return result;
}

function predictForPartType(
  instanceEvents: readonly MaintenanceEvent[],
  instance: PrinterInstance,
  partType: MaintenanceEvent['partType'],
  paceHoursPerDay: number,
): NextSwapPrediction | null {
  const partEvents = instanceEvents
    .filter(e => e.partType === partType)
    .slice()
    .sort((a, b) => a.printerHoursAtEvent - b.printerHoursAtEvent);

  if (partEvents.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < partEvents.length; i++) {
    intervals.push(partEvents[i].printerHoursAtEvent - partEvents[i - 1].printerHoursAtEvent);
  }
  const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  if (!(avgInterval > 0)) return null;

  const lastSwapHours = partEvents[partEvents.length - 1].printerHoursAtEvent;
  const hoursUntilSwap = Math.max(0, lastSwapHours + avgInterval - instance.printHours);

  if (!(paceHoursPerDay > 0)) {
    // No usable pace to project a calendar date — still return the interval
    // itself (informational), but the date can't be projected; fall back to
    // "now" rather than an invalid/Infinity date.
    return { intervalHours: avgInterval, nextSwapDate: new Date() };
  }

  const daysUntilSwap = hoursUntilSwap / paceHoursPerDay;
  const nextSwapDate = new Date(Date.now() + daysUntilSwap * MS_PER_DAY);

  return { intervalHours: avgInterval, nextSwapDate };
}

/**
 * "Recent pace" = trailing-30-day avg printTimeHours/day for this instance,
 * falling back to the all-time average if fewer than 5 jobs fall in that
 * window (RESEARCH.md Open Question 3 recommendation).
 */
function recentPaceHoursPerDay(jobs: readonly PrintJob[], instance: PrinterInstance): number {
  const instanceJobs = jobs.filter(j => j.printerInstanceId === instance.id);
  if (instanceJobs.length === 0) return 0;

  const cutoff = Date.now() - RECENT_PACE_WINDOW_DAYS * MS_PER_DAY;
  const recentJobs = instanceJobs.filter(j => j.createdAt.getTime() >= cutoff);

  if (recentJobs.length >= MIN_JOBS_FOR_RECENT_PACE) {
    const totalHours = recentJobs.reduce((s, j) => s + j.printTimeHours, 0);
    return totalHours / RECENT_PACE_WINDOW_DAYS;
  }

  // All-time average fallback.
  const oldestCreatedAt = instanceJobs.reduce(
    (min, j) => (j.createdAt.getTime() < min ? j.createdAt.getTime() : min),
    Date.now(),
  );
  const spanDays = Math.max(1, (Date.now() - oldestCreatedAt) / MS_PER_DAY);
  const totalHours = instanceJobs.reduce((s, j) => s + j.printTimeHours, 0);
  return totalHours / spanDays;
}
