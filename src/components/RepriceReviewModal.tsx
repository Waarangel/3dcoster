import { useState } from 'react';
import type { AffectedJob } from '../utils/repriceAlert';
import type { Currency } from '../types';
import { Modal, Button, InfoTooltip } from './ui';
import { formatCurrency } from '../utils/currency';

// ---------------------------------------------------------------------------
// RepriceReviewModal — CONN-01 (Phase 41 Plan 02). Shared-Modal presenter for
// the jobs a material price change flagged as now under the user's target
// margin. Purely a review surface: applying a row calls back to the caller
// (which writes through the existing updateJob hook) and never mutates
// anything itself (T-41-02b — no bulk apply, D-04).
// ---------------------------------------------------------------------------

export interface RepriceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  affected: AffectedJob[];
  targetMargin: number;
  /** Fallback currency for rows that somehow lack one (should not happen in practice). */
  currency: Currency;
  onApply: (jobId: string, suggestedPrice: number) => void;
}

export function RepriceReviewModal({ isOpen, onClose, affected, targetMargin, currency, onApply }: RepriceReviewModalProps) {
  // D-04: per-job apply only. Track which rows have been applied THIS session
  // so re-opening the modal still shows the full history, but an applied row
  // is visibly settled and can't be double-applied by an accidental re-click.
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());

  const handleApply = (job: AffectedJob) => {
    onApply(job.jobId, job.suggestedPrice);
    setAppliedJobIds(prev => new Set(prev).add(job.jobId));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${affected.length} job${affected.length === 1 ? '' : 's'} below your ${targetMargin}% target`}
      size="lg"
    >
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-500 flex items-center gap-1">
          Each suggested price restores this job&apos;s {targetMargin}% target margin at the new material cost.
          <InfoTooltip text="Nothing is changed automatically. Apply writes the suggested price to that one job only — every other job stays exactly as saved." />
        </p>

        {affected.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No jobs are currently below target.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {affected.map(job => {
              const isApplied = appliedJobIds.has(job.jobId);
              return (
                <div
                  key={job.jobId}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{job.jobTitle}</div>
                    <div className="text-xs mt-0.5">
                      <span className="text-slate-400">old {job.oldMargin.toFixed(1)}%</span>
                      <span className="text-slate-500 mx-1">→</span>
                      <span className="text-amber-400">new {job.newMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-sm font-mono text-slate-200">
                      {formatCurrency(job.suggestedPrice, job.currency ?? currency)}
                    </div>
                    <Button
                      variant={isApplied ? 'secondary' : 'primary'}
                      btnSize="sm"
                      disabled={isApplied}
                      onClick={() => handleApply(job)}
                      aria-label={`Apply suggested price to ${job.jobTitle}`}
                    >
                      {isApplied ? 'Applied ✓' : 'Apply'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 p-4 pt-2 border-t border-slate-700">
        <Button variant="secondary" btnSize="md" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
