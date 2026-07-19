// ---------------------------------------------------------------------------
// SyncMergeSummary — TDD suite written BEFORE the component (Task 2, RED).
//
// Contract locks (per 44-06-PLAN.md Task 2 <behavior>):
//  - Per-store headline renders added/updated/deleted counts for every store
//    with a non-zero total.
//  - A store with conflicts > 0 shows a distinctly-flagged conflict marker.
//  - Expanding a store row reveals the affected record names/ids.
//  - onConfirm fires ONLY on an explicit Confirm click; onCancel fires ONLY
//    on an explicit Cancel click. Neither fires on mount.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { SyncMergeSummary } from './SyncMergeSummary';
import { BACKUP_STORES, type BackupStoreName } from '../utils/backupSchema';
import type { MergePlan, MergeSummary, StoreMergeCounts } from '../utils/syncMerge';

function emptyCounts(): StoreMergeCounts {
  return { added: 0, updated: 0, deleted: 0, conflicts: 0 };
}

/** A fully-populated no-op MergePlan — tests override just the stores they need. */
function makePlan(overrides: Partial<Record<BackupStoreName, {
  counts?: Partial<StoreMergeCounts>;
  winners?: Record<string, unknown>[];
  deleteIds?: string[];
}>> = {}): MergePlan {
  const winnersByStore = {} as MergePlan['winnersByStore'];
  const deleteIdsByStore = {} as MergePlan['deleteIdsByStore'];
  const summary = {} as MergeSummary;
  for (const store of BACKUP_STORES) {
    const override = overrides[store];
    winnersByStore[store] = override?.winners ?? [];
    deleteIdsByStore[store] = override?.deleteIds ?? [];
    summary[store] = { ...emptyCounts(), ...override?.counts };
  }
  return { winnersByStore, deleteIdsByStore, tombstonesToWrite: [], summary };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root!.unmount(); });
  container!.remove();
  container = null;
  root = null;
});

function render(ui: React.ReactElement) {
  act(() => { root!.render(ui); });
}

function text(): string {
  return container!.textContent ?? '';
}

function findButton(pattern: RegExp): HTMLButtonElement {
  const btn = Array.from(container!.querySelectorAll('button')).find(b => pattern.test(b.textContent ?? ''));
  if (!btn) throw new Error(`no button matching ${pattern}`);
  return btn;
}

describe('SyncMergeSummary — per-store headline + conflict flag', () => {
  it('renders per-store added/updated/deleted counts for a store with a non-zero total', () => {
    const plan = makePlan({
      jobs: { counts: { added: 4, updated: 2, deleted: 1 } },
    });
    render(<SyncMergeSummary plan={plan} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(text()).toMatch(/Jobs/);
    expect(text()).toMatch(/4 added/);
    expect(text()).toMatch(/2 updated/);
    expect(text()).toMatch(/1 deleted/);
  });

  it('does not render a headline row for a store with zero changes', () => {
    const plan = makePlan({
      jobs: { counts: { added: 1 } },
      // materials left at all-zero counts — must not appear.
    });
    render(<SyncMergeSummary plan={plan} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(text()).not.toMatch(/Assets/);
  });

  it('flags a store with a true conflict distinctly', () => {
    const plan = makePlan({
      quotes: { counts: { updated: 1, conflicts: 1 } },
    });
    render(<SyncMergeSummary plan={plan} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(text()).toMatch(/conflict/i);
  });

  it('does not show a conflict marker for a store with zero conflicts', () => {
    const plan = makePlan({
      jobs: { counts: { added: 1 } },
    });
    render(<SyncMergeSummary plan={plan} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(text()).not.toMatch(/conflict/i);
  });
});

describe('SyncMergeSummary — expandable per-record detail', () => {
  it('reveals affected record names when a store row is expanded', () => {
    const plan = makePlan({
      jobs: {
        counts: { updated: 1 },
        winners: [{ id: 'job-1', name: 'Dragon Miniature', updatedAt: new Date().toISOString() }],
      },
    });
    render(<SyncMergeSummary plan={plan} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(text()).not.toMatch(/Dragon Miniature/);

    const rowToggle = findButton(/Jobs/);
    act(() => { rowToggle.click(); });

    expect(text()).toMatch(/Dragon Miniature/);
  });

  it('reveals deleted record ids when a store row is expanded', () => {
    const plan = makePlan({
      customers: {
        counts: { deleted: 1 },
        deleteIds: ['cust-42'],
      },
    });
    render(<SyncMergeSummary plan={plan} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const rowToggle = findButton(/Customers/);
    act(() => { rowToggle.click(); });

    expect(text()).toMatch(/cust-42/);
  });
});

describe('SyncMergeSummary — confirm/cancel gating', () => {
  it('never calls onConfirm on mount', () => {
    const onConfirm = vi.fn();
    const plan = makePlan({ jobs: { counts: { added: 1 } } });
    render(<SyncMergeSummary plan={plan} onConfirm={onConfirm} onCancel={vi.fn()} />);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm only on an explicit Confirm click', () => {
    const onConfirm = vi.fn();
    const plan = makePlan({ jobs: { counts: { added: 1 } } });
    render(<SyncMergeSummary plan={plan} onConfirm={onConfirm} onCancel={vi.fn()} />);

    act(() => { findButton(/merge changes/i).click(); });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel only on an explicit Cancel click', () => {
    const onCancel = vi.fn();
    const plan = makePlan({ jobs: { counts: { added: 1 } } });
    render(<SyncMergeSummary plan={plan} onConfirm={vi.fn()} onCancel={onCancel} />);

    expect(onCancel).not.toHaveBeenCalled();
    act(() => { findButton(/cancel/i).click(); });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('moves focus to Cancel on mount (staged-confirm accessibility pattern)', () => {
    const plan = makePlan({ jobs: { counts: { added: 1 } } });
    render(<SyncMergeSummary plan={plan} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(document.activeElement).toBe(findButton(/cancel/i));
  });
});
