import { useEffect, useState } from 'react';
import type { FailureEvent, Material, PrinterInstance } from '../types';
import { useFailureEvents, type LogFailureInput } from '../hooks/useFailureEvents';
import { Button, Input, Select, Textarea, Modal, InfoTooltip, useToast } from './ui';

// ---------------------------------------------------------------------------
// LogFailureModal — Phase 39 Plan 02 (FAIL-01).
//
// Form modal for logging a failed print, standalone (from the Reports
// Failures ledger, D-01) or pre-filled from a saved job row (JobsManager's
// per-row "Log Failure" action). Mirrors DeclineQuoteModal's chrome
// (Modal + reset-on-open effect + Confirm/Cancel footer).
//
// T-39-04 mitigation: %completion is clamped 0-100 at the form boundary and
// the reason field is a closed <Select> (whitelisted enum), so only valid
// values ever reach useFailureEvents().logFailure.
// ---------------------------------------------------------------------------

export interface LogFailureModalPrefill {
  printerInstanceId?: string;
  materialId?: string;
  jobId?: string;
  /** Total filament grams for the linked job (all filament rows summed) — used to compute gramsWasted = jobFilamentGrams × (%completion/100). */
  jobFilamentGrams?: number;
  /**
   * WR-08: the linked job's per-filament rows. When present, the stock
   * deduction is written per material (each row's grams × %completion) so a
   * multi-material job never dumps its TOTAL grams onto one material.
   */
  jobFilaments?: { filamentId: string; grams: number }[];
}

export interface LogFailureModalProps {
  isOpen: boolean;
  onClose: () => void;
  printerInstances: PrinterInstance[];
  /** Filament-category assets, used to populate the material Select. */
  filamentAssets: Material[];
  prefill?: LogFailureModalPrefill;
}

const REASON_OPTIONS: { value: FailureEvent['reason']; label: string }[] = [
  { value: 'adhesion', label: 'Bed adhesion failure' },
  { value: 'stringing', label: 'Stringing / blobs' },
  { value: 'clog', label: 'Nozzle clog' },
  { value: 'mechanical', label: 'Mechanical failure' },
  { value: 'power_loss', label: 'Power loss' },
  { value: 'other', label: 'Other' },
];

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function LogFailureModal({ isOpen, onClose, printerInstances, filamentAssets, prefill }: LogFailureModalProps) {
  const { logFailure } = useFailureEvents();
  const toast = useToast();

  const [printerInstanceId, setPrinterInstanceId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [percentComplete, setPercentComplete] = useState(50);
  const [reason, setReason] = useState<FailureEvent['reason']>('adhesion');
  const [notes, setNotes] = useState('');
  const [standaloneGrams, setStandaloneGrams] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isJobLinked = Boolean(prefill?.jobId);

  // Reset (and re-seed from prefill) whenever the modal transitions closed -> open.
  useEffect(() => {
    if (!isOpen) return;
    setPrinterInstanceId(prefill?.printerInstanceId ?? printerInstances[0]?.id ?? '');
    setMaterialId(prefill?.materialId ?? filamentAssets[0]?.id ?? '');
    setPercentComplete(50);
    setReason('adhesion');
    setNotes('');
    setStandaloneGrams(0);
    setIsSaving(false);
    setError(null);
    // Only re-seed when the modal opens or the prefill target changes — not on
    // every printerInstances/filamentAssets re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefill?.jobId, prefill?.printerInstanceId, prefill?.materialId]);

  const gramsWasted = isJobLinked
    ? (prefill?.jobFilamentGrams ?? 0) * (clampPercent(percentComplete) / 100)
    : (standaloneGrams > 0 ? standaloneGrams : undefined);

  // WR-08: per-material waste for multi-material jobs — each filament row's
  // own grams scaled by %completion, so PLA and PVA (etc.) each deduct their
  // real share instead of the dominant material absorbing the job total.
  const materialBreakdown = isJobLinked && prefill?.jobFilaments && prefill.jobFilaments.length > 0
    ? prefill.jobFilaments
        .filter(f => f.filamentId && f.grams > 0)
        .map(f => ({ materialId: f.filamentId, grams: f.grams * (clampPercent(percentComplete) / 100) }))
    : undefined;

  const handleSubmit = async () => {
    if (!printerInstanceId || !materialId) {
      setError('Select a printer and a material.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const input: LogFailureInput = {
        printerInstanceId,
        materialId,
        percentComplete: clampPercent(percentComplete),
        reason,
        notes: notes.trim() || undefined,
        failedAt: new Date(),
        jobId: prefill?.jobId,
        gramsWasted,
        materialBreakdown,
      };
      await logFailure(input);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not log the failure.';
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log a failed print" size="md">
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1" htmlFor="log-failure-printer">Printer</label>
          <Select
            id="log-failure-printer"
            selectSize="sm"
            value={printerInstanceId}
            onChange={(e) => setPrinterInstanceId(e.target.value)}
          >
            <option value="" disabled>Select a printer</option>
            {printerInstances.map((p) => (
              <option key={p.id} value={p.id}>{p.nickname}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1" htmlFor="log-failure-material">Material</label>
          <Select
            id="log-failure-material"
            selectSize="sm"
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
          >
            <option value="" disabled>Select a material</option>
            {filamentAssets.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1" htmlFor="log-failure-percent">
            % completion when it failed
            <InfoTooltip text="How far through the print it got before failing. Used to estimate wasted filament." />
          </label>
          <Input
            id="log-failure-percent"
            inputSize="sm"
            type="number"
            min={0}
            max={100}
            compact
            value={percentComplete}
            onChange={(e) => setPercentComplete(clampPercent(Number(e.target.value)))}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1" htmlFor="log-failure-reason">Reason</label>
          <Select
            id="log-failure-reason"
            selectSize="sm"
            value={reason}
            onChange={(e) => setReason(e.target.value as FailureEvent['reason'])}
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>

        {!isJobLinked && (
          <div>
            <label className="block text-xs text-slate-400 mb-1" htmlFor="log-failure-grams">
              Filament wasted (grams, optional)
            </label>
            <Input
              id="log-failure-grams"
              inputSize="sm"
              type="number"
              min={0}
              compact
              value={standaloneGrams}
              onChange={(e) => setStandaloneGrams(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1" htmlFor="log-failure-notes">Notes (optional)</label>
          <Textarea
            id="log-failure-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. first layer lifted at the corner"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 p-4 pt-2 border-t border-slate-700">
        <Button variant="secondary" btnSize="md" onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          btnSize="md"
          onClick={() => { void handleSubmit(); }}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Log failure'}
        </Button>
      </div>
    </Modal>
  );
}
