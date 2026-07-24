import { BACKUP_STORES } from './backupSchema';
import type { MergePlan } from './syncMerge';

// ---------------------------------------------------------------------------
// Phase 47-05 (SYNC-02, D-09/D-11) — cloud-sync-only pure gates.
//
// PURE module: no Dexie, no React, no Supabase. Deliberately DOES NOT import
// or reuse useSyncFolder.ts's `needsConfirmation` predicate (RESEARCH.md
// Pitfall 4) — that predicate trips on ANY change (added/updated/deleted),
// which is correct for file-sync's occasional manual/desktop merge but would
// make "real-time, silent" cloud sync (D-09) prompt the user constantly.
// This file defines a DIFFERENT, deliberately looser, graduated contract:
// routine cloud merges apply silently, and only RISKY merges (mass deletion,
// or a long-offline divergence) surface a confirm gate.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * A merge whose total deletions (summed across every BACKUP_STORES table)
 * exceed this count is treated as risky and confirm-gated, even though it
 * would otherwise auto-apply silently. Realistic sole-trader datasets run
 * dozens-to-low-hundreds of records per store (RESEARCH.md Open Question 1)
 * — 10 is a reasoned starting point: comfortably above a normal cleanup of a
 * few stale jobs/customers, but well below "something deleted my whole
 * catalog," which is exactly the case D-09's risky gate exists to catch.
 */
export const RISKY_DELETION_THRESHOLD = 10;

/**
 * A device that has not successfully synced in longer than this many days is
 * treated as "long offline" — any change on reconnect is confirm-gated even
 * if the deletion count alone would not trip RISKY_DELETION_THRESHOLD,
 * because a long divergence window raises the odds that the remote data
 * reflects a much-changed account state the user should actively review
 * (RESEARCH.md Open Question 1 reasoned starting point).
 */
export const RISKY_DIVERGENCE_DAYS = 30;

/**
 * Rolling pre-merge snapshot window (D-11): at most this many prior-merge
 * snapshots are retained at once, oldest dropped first. Bounds the settings
 * key's size across a long-lived install while still giving "undo my last
 * few silent merges" real depth.
 */
export const MAX_PRE_MERGE_SNAPSHOTS = 3;

/**
 * Pre-merge snapshots older than this many hours are pruned regardless of
 * count — a rolling ~24h undo window (D-11), not a permanent archive.
 */
export const PRE_MERGE_SNAPSHOT_TTL_HOURS = 24;

/**
 * True when a computed cloud MergePlan should be confirm-gated instead of
 * applied silently (D-09). This is DELIBERATELY looser than file-sync's
 * `needsConfirmation` (which trips on any change): routine cloud merges —
 * a handful of adds/updates/deletes — must apply silently for cloud sync to
 * feel "real-time." Only a merge that deletes a lot, or reconciles a device
 * that has been offline a long time, warrants stopping the user.
 *
 * Examples:
 *   needsRiskyConfirmation(routinePlan, new Date('2026-07-20'), new Date('2026-07-23')) → false
 *   needsRiskyConfirmation(planWith11Deletions, undefined, new Date()) → true
 *   needsRiskyConfirmation(planWithOneAdd, new Date('2026-05-01'), new Date('2026-07-23')) → true (35 days offline)
 *
 * @returns true when the plan should be surfaced for user confirmation
 *          rather than applied silently
 */
export function needsRiskyConfirmation(
  plan: MergePlan,
  lastSyncedAt: Date | undefined,
  now: Date,
): boolean {
  let totalDeleted = 0;
  let hasAnyChange = false;
  for (const store of BACKUP_STORES) {
    const counts = plan.summary[store];
    totalDeleted += counts.deleted;
    if (counts.added > 0 || counts.updated > 0 || counts.deleted > 0) {
      hasAnyChange = true;
    }
  }

  if (totalDeleted > RISKY_DELETION_THRESHOLD) {
    return true;
  }

  if (lastSyncedAt && hasAnyChange) {
    const divergenceDays = (now.getTime() - lastSyncedAt.getTime()) / MS_PER_DAY;
    if (divergenceDays > RISKY_DIVERGENCE_DAYS) {
      return true;
    }
  }

  return false;
}

/**
 * True when a computed cloud MergePlan has zero adds/updates/deletes across
 * every BACKUP_STORES table — genuinely nothing to review. First-connect and
 * risky merges (D-09/D-10) must never surface a "Review sync changes" panel
 * for an empty plan (UAT gap-closure, 47-07 — a founder hit a review panel
 * reading "No changes to merge" on first connect); an empty plan applies
 * silently instead, same as a routine merge.
 *
 * Examples:
 *   isMergePlanEmpty(planWithNoChanges) → true
 *   isMergePlanEmpty(planWithOneAdd) → false
 */
export function isMergePlanEmpty(plan: MergePlan): boolean {
  for (const store of BACKUP_STORES) {
    const counts = plan.summary[store];
    if (counts.added > 0 || counts.updated > 0 || counts.deleted > 0) return false;
  }
  return true;
}

/**
 * Appends `entry` to `existing`, prunes entries older than
 * PRE_MERGE_SNAPSHOT_TTL_HOURS relative to `now`, then caps the result to the
 * newest MAX_PRE_MERGE_SNAPSHOTS entries (oldest dropped first) — the D-11
 * rolling pre-merge snapshot window. Pure: returns a new array, never
 * mutates `existing`.
 *
 * Examples:
 *   pushPreMergeSnapshot([], { mergedAt: '2026-07-23T00:00:00.000Z', ... }, now)
 *     → [entry] (first snapshot)
 *   pushPreMergeSnapshot(threeRecentEntries, newEntry, now)
 *     → newest 3 of the 4 (oldest dropped)
 *   pushPreMergeSnapshot([oneEntryFrom2DaysAgo], newEntry, now)
 *     → [newEntry] (the 2-day-old entry is past the 24h TTL and pruned)
 *
 * @returns a new array of at most MAX_PRE_MERGE_SNAPSHOTS entries, newest last
 */
export function pushPreMergeSnapshot<T extends { mergedAt: string }>(
  existing: readonly T[],
  entry: T,
  now: Date,
): T[] {
  const combined = [...existing, entry];
  const cutoff = now.getTime() - PRE_MERGE_SNAPSHOT_TTL_HOURS * MS_PER_HOUR;
  const withinTtl = combined.filter(item => new Date(item.mergedAt).getTime() >= cutoff);
  if (withinTtl.length <= MAX_PRE_MERGE_SNAPSHOTS) {
    return withinTtl;
  }
  return withinTtl.slice(withinTtl.length - MAX_PRE_MERGE_SNAPSHOTS);
}
