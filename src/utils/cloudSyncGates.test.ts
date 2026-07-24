import { describe, it, expect } from 'vitest';
import {
  needsRiskyConfirmation,
  pushPreMergeSnapshot,
  RISKY_DELETION_THRESHOLD,
  RISKY_DIVERGENCE_DAYS,
  MAX_PRE_MERGE_SNAPSHOTS,
  PRE_MERGE_SNAPSHOT_TTL_HOURS,
} from './cloudSyncGates';
import { BACKUP_STORES } from './backupSchema';
import type { MergePlan, MergeSummary, StoreMergeCounts } from './syncMerge';

function emptyCounts(): StoreMergeCounts {
  return { added: 0, updated: 0, deleted: 0, conflicts: 0 };
}

function makePlan(overrides: Partial<Record<string, Partial<StoreMergeCounts>>> = {}): MergePlan {
  const summary = {} as MergeSummary;
  for (const store of BACKUP_STORES) {
    summary[store] = { ...emptyCounts(), ...(overrides[store] ?? {}) };
  }
  return {
    winnersByStore: {} as MergePlan['winnersByStore'],
    deleteIdsByStore: {} as MergePlan['deleteIdsByStore'],
    tombstonesToWrite: [],
    summary,
  };
}

describe('needsRiskyConfirmation', () => {
  it('returns false for a routine merge with a few adds/updates and no deletes', () => {
    const plan = makePlan({ jobs: { added: 2, updated: 1 } });
    expect(needsRiskyConfirmation(plan, new Date('2026-07-20T00:00:00.000Z'), new Date('2026-07-23T00:00:00.000Z'))).toBe(false);
  });

  it('returns false when lastSyncedAt is undefined and the plan has only small changes', () => {
    const plan = makePlan({ jobs: { added: 1 } });
    expect(needsRiskyConfirmation(plan, undefined, new Date())).toBe(false);
  });

  it(`returns true when total deletions across stores exceed RISKY_DELETION_THRESHOLD (${RISKY_DELETION_THRESHOLD})`, () => {
    const plan = makePlan({
      jobs: { deleted: 6 },
      sales: { deleted: 6 },
    });
    expect(needsRiskyConfirmation(plan, undefined, new Date())).toBe(true);
  });

  it('returns false when total deletions equal RISKY_DELETION_THRESHOLD exactly (not "exceed")', () => {
    const plan = makePlan({ jobs: { deleted: RISKY_DELETION_THRESHOLD } });
    expect(needsRiskyConfirmation(plan, undefined, new Date())).toBe(false);
  });

  it(`returns true when (now - lastSyncedAt) exceeds RISKY_DIVERGENCE_DAYS (${RISKY_DIVERGENCE_DAYS}) and the plan has any changes`, () => {
    const plan = makePlan({ jobs: { added: 1 } });
    const lastSyncedAt = new Date('2026-05-01T00:00:00.000Z');
    const now = new Date('2026-07-23T00:00:00.000Z'); // well over 30 days later
    expect(needsRiskyConfirmation(plan, lastSyncedAt, now)).toBe(true);
  });

  it('returns false for a long divergence when the plan has NO changes at all', () => {
    const plan = makePlan();
    const lastSyncedAt = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-07-23T00:00:00.000Z');
    expect(needsRiskyConfirmation(plan, lastSyncedAt, now)).toBe(false);
  });

  it('does not import or depend on useSyncFolder needsConfirmation (Pitfall 4 — separate contract)', () => {
    // A routine merge that WOULD trip file-sync's needsConfirmation (any
    // change at all) must NOT trip this looser cloud-sync gate.
    const plan = makePlan({ jobs: { added: 1, updated: 1 } });
    expect(needsRiskyConfirmation(plan, new Date(), new Date())).toBe(false);
  });
});

describe('pushPreMergeSnapshot', () => {
  interface Entry {
    mergedAt: string;
    label: string;
  }

  function entry(mergedAt: string, label: string): Entry {
    return { mergedAt, label };
  }

  it(`keeps only the last ${MAX_PRE_MERGE_SNAPSHOTS} entries, dropping the oldest`, () => {
    const now = new Date('2026-07-23T12:00:00.000Z');
    const existing: Entry[] = [
      entry('2026-07-23T09:00:00.000Z', 'a'),
      entry('2026-07-23T10:00:00.000Z', 'b'),
      entry('2026-07-23T11:00:00.000Z', 'c'),
    ];
    const result = pushPreMergeSnapshot(existing, entry('2026-07-23T11:30:00.000Z', 'd'), now);
    expect(result).toHaveLength(MAX_PRE_MERGE_SNAPSHOTS);
    expect(result.map(e => e.label)).toEqual(['b', 'c', 'd']);
  });

  it(`prunes entries older than the ~${PRE_MERGE_SNAPSHOT_TTL_HOURS}h TTL window`, () => {
    const now = new Date('2026-07-23T12:00:00.000Z');
    const existing: Entry[] = [
      entry('2026-07-22T00:00:00.000Z', 'stale'), // 36h old — past the 24h TTL
    ];
    const result = pushPreMergeSnapshot(existing, entry('2026-07-23T11:00:00.000Z', 'fresh'), now);
    expect(result.map(e => e.label)).toEqual(['fresh']);
  });

  it('returns a new array and never mutates the input', () => {
    const now = new Date('2026-07-23T12:00:00.000Z');
    const existing: Entry[] = [entry('2026-07-23T11:00:00.000Z', 'a')];
    const frozenLength = existing.length;
    pushPreMergeSnapshot(existing, entry('2026-07-23T11:30:00.000Z', 'b'), now);
    expect(existing).toHaveLength(frozenLength);
  });

  it('starts empty and accepts the first entry', () => {
    const now = new Date('2026-07-23T12:00:00.000Z');
    const result = pushPreMergeSnapshot([], entry('2026-07-23T11:59:00.000Z', 'first'), now);
    expect(result.map(e => e.label)).toEqual(['first']);
  });
});
