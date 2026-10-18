import { useEffect, useState } from 'react';
import type { AssetCategory } from '../../types';
import { Button, Modal, Select } from '../ui';
import {
  DEFAULT_POST_PROCESSING_ASSET_CATEGORY,
  POST_PROCESSING_ASSET_CATEGORIES,
  type LibraryChoice,
  type ManualLinePromptItem,
} from '../../utils/manualCostLines';

// ---------------------------------------------------------------------------
// SaveToLibraryModal — Phase 47.1 (D-04).
//
// Pre-save popup: "Add to your asset library?" One row per one-off line the user
// has not been asked about. Every row defaults to "Keep as one-off". Cancel,
// Escape or the backdrop call onCancel — the parent then does NOT save the job.
// Presenter only: no Dexie, no entitlement/platform check (D-06 — free everywhere).
// The job always keeps each line by value (D-03); this popup only decides which
// lines ALSO become library assets for future jobs.
// ---------------------------------------------------------------------------

export interface SaveToLibraryModalProps {
  isOpen: boolean;
  items: ManualLinePromptItem[];
  currencySymbol: string;
  /** "Save job" or "Update job", matching the action the user started. */
  confirmLabel: string;
  onConfirm: (choices: LibraryChoice[]) => Promise<void>;
  /** Cancel / Escape / backdrop: return to editing without saving. */
  onCancel: () => void;
}

interface RowDecision {
  add: boolean;
  category: AssetCategory;
}

const SECTION_LABELS = { postProcessing: 'Post-processing', packaging: 'Packaging' } as const;
const DEFAULT_DECISION: RowDecision = { add: false, category: DEFAULT_POST_PROCESSING_ASSET_CATEGORY };

const rowKey = (item: ManualLinePromptItem) => `${item.section}:${item.line.id}`;

export function SaveToLibraryModal({ isOpen, items, currencySymbol, confirmLabel, onConfirm, onCancel }: SaveToLibraryModalProps) {
  const [decisions, setDecisions] = useState<Record<string, RowDecision>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh state on each open: every row back to "Keep as one-off".
  useEffect(() => {
    if (isOpen) {
      setDecisions({});
      setIsSaving(false);
      setError(null);
    }
  }, [isOpen]);

  const decisionFor = (item: ManualLinePromptItem): RowDecision => decisions[rowKey(item)] ?? DEFAULT_DECISION;

  const updateDecision = (item: ManualLinePromptItem, patch: Partial<RowDecision>) => {
    setDecisions(prev => ({ ...prev, [rowKey(item)]: { ...(prev[rowKey(item)] ?? DEFAULT_DECISION), ...patch } }));
  };

  const handleConfirm = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await onConfirm(items.map(item => {
        const { add, category } = decisionFor(item);
        return { lineId: item.line.id, section: item.section, add, category };
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save — please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isSaving) return;
    onCancel();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Add to your asset library?" size="md">
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-300">
          These one-off costs aren&apos;t in your asset library. Add any you&apos;ll use again so you can pick them on
          future jobs. This job keeps the cost you entered either way.
        </p>
        {items.map(item => {
          const decision = decisionFor(item);
          const { name, cost } = item.line;
          return (
            <div key={rowKey(item)} className="rounded-lg bg-slate-700/50 p-3 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-slate-100 break-words min-w-0">{name}</span>
                <span className="text-xs text-slate-400 shrink-0">
                  {SECTION_LABELS[item.section]} · {currencySymbol}{cost.toFixed(2)}
                </span>
              </div>
              <Select
                aria-label={`Library choice for ${name}`}
                value={decision.add ? 'add' : 'keep'}
                onChange={e => updateDecision(item, { add: e.target.value === 'add' })}
                disabled={isSaving}
              >
                <option value="keep">Keep as one-off</option>
                <option value="add">Add to library</option>
              </Select>
              {item.section === 'postProcessing' && decision.add && (
                <Select
                  aria-label={`Library category for ${name}`}
                  value={decision.category}
                  onChange={e => updateDecision(item, { category: e.target.value })}
                  disabled={isSaving}
                >
                  {POST_PROCESSING_ASSET_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
              )}
            </div>
          );
        })}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 p-4 pt-2 border-t border-slate-700">
        <Button variant="secondary" btnSize="md" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="primary" btnSize="md" onClick={() => { void handleConfirm(); }} disabled={isSaving}>
          {isSaving ? 'Saving…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
