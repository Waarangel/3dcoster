import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import { BACKUP_STORES, type BackupStoreName } from '../utils/backupSchema';
import type { MergePlan } from '../utils/syncMerge';

// ---------------------------------------------------------------------------
// SyncMergeSummary — the D-07 pre-commit change summary + confirm gate.
// Renders per-store added/updated/deleted counts, a distinctly-flagged true
// conflict marker, and an expandable per-store detail list. Commits ONLY on
// an explicit Confirm click (roadmap success criterion 2) — this component
// never calls onConfirm itself, it only wires the click.
//
// Deviation from the plan's literal prop wording (Rule 2 — missing
// critical): the plan's <action> names the prop as `MergeSummary` (counts
// only), but its own <behavior> requires expanding a row to "name the
// affected records" — record names/ids are NOT present in MergeSummary
// (counts-only), they only exist on MergePlan's winnersByStore/
// deleteIdsByStore. This component takes the full MergePlan (which embeds
// MergeSummary as `plan.summary`) so the expand-to-names behavior is
// actually satisfiable.
//
// winnersByStore does not itself distinguish "added" from "updated" per
// record (computeMerge merges both cases into one winners array) — the
// expanded detail therefore lists them under one "Added/updated" bucket per
// store, while the headline count above it still shows the exact
// added/updated/deleted split.
//
// Accessibility: mirrors BackupRestoreSection's staged-confirm pattern —
// focus moves to Cancel (the safe default) on mount.
// ---------------------------------------------------------------------------

const STORE_LABELS: Record<BackupStoreName, string> = {
  materials: 'Assets',
  printers: 'Printers',
  printerInstances: 'Printer Instances',
  jobs: 'Jobs',
  sales: 'Sales',
  settings: 'Settings',
  customers: 'Customers',
  quotes: 'Quotes',
  stockEvents: 'Stock Events',
  failureEvents: 'Failure Events',
  maintenanceEvents: 'Maintenance Events',
};

function recordLabel(store: BackupStoreName, record: Record<string, unknown>): string {
  const nameField = record.name ?? record.nickname ?? record.quoteNumber;
  if (typeof nameField === 'string' && nameField.length > 0) return nameField;
  const idField = store === 'settings' ? record.key : record.id;
  return typeof idField === 'string' ? idField : 'record';
}

export interface SyncMergeSummaryProps {
  plan: MergePlan;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SyncMergeSummary({ plan, onConfirm, onCancel }: SyncMergeSummaryProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState<Set<BackupStoreName>>(new Set());

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  const rows = BACKUP_STORES
    .map(store => ({ store, counts: plan.summary[store] }))
    .filter(({ counts }) => counts.added > 0 || counts.updated > 0 || counts.deleted > 0);

  const toggleExpanded = (store: BackupStoreName) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(store)) next.delete(store);
      else next.add(store);
      return next;
    });
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Review sync changes</h3>
        <p className="text-sm text-slate-400">
          Another device made changes since your last sync. Review what will change before merging.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No changes to merge.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ store, counts }) => {
            const isOpen = expanded.has(store);
            const winners = plan.winnersByStore[store];
            const deletedIds = plan.deleteIdsByStore[store];
            return (
              <li key={store} className="border border-slate-700 rounded-lg overflow-hidden">
                <Button
                  type="button"
                  variant="ghost"
                  fullWidth
                  onClick={() => toggleExpanded(store)}
                  aria-expanded={isOpen}
                  className="!justify-between gap-2 !rounded-none text-left font-normal"
                >
                  <span className="text-sm text-slate-200">
                    <span className="font-medium text-white">{STORE_LABELS[store]}:</span>{' '}
                    {counts.added} added, {counts.updated} updated, {counts.deleted} deleted
                  </span>
                  {counts.conflicts > 0 && (
                    <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-300 rounded">
                      {counts.conflicts} conflict{counts.conflicts === 1 ? '' : 's'} — newer copy kept
                    </span>
                  )}
                </Button>
                {isOpen && (
                  <div className="px-3 pb-3 text-xs text-slate-400 space-y-1">
                    {winners.length > 0 && (
                      <p>Added/updated: {winners.map(w => recordLabel(store, w)).join(', ')}</p>
                    )}
                    {deletedIds.length > 0 && (
                      <p>Deleted: {deletedIds.join(', ')}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2 pt-2 border-t border-slate-700">
        <Button variant="primary" btnSize="sm" onClick={onConfirm}>
          Merge changes
        </Button>
        <Button ref={cancelButtonRef} variant="secondary" btnSize="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
