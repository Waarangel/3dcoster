import { useEffect, useState } from 'react';
import type { Quote } from '../types';
import { Button, Textarea, Modal } from './ui';
import { formatQuoteNumber } from '../utils/format';

// ---------------------------------------------------------------------------
// DeclineQuoteModal — Phase 16 second extension (D-28).
//
// Small confirmation-style modal mirroring CustomerEditModal's chrome
// (also mirrors the JobsManager delete-confirm modals deleteSaleConfirmId /
// deleteConfirmJobId). Captures an OPTIONAL free-form decline reason that
// gets persisted to Quote.declineReason.
//
// Open via setDecliningQuote(quote); close via setDecliningQuote(null).
// On Confirm: onConfirm({ reason }) — parent does the db.quotes.put with
// status='declined' + decisionAt + declineReason in one updateQuote call.
//
// Per project convention: confirmation flows use modals, not inline
// expanders or browser prompt(). DeclineQuoteModal is the third such modal
// in this codebase (Delete Job + Delete Sale being the others).
// ---------------------------------------------------------------------------

export interface DeclineQuoteModalProps {
  /** The Quote being declined, or null when the modal is closed. */
  quote: Quote | null;
  /**
   * Called when the user clicks "Confirm decline". `reason` is the trimmed
   * free-form text; empty string means the user declined without providing
   * a reason. Parent is responsible for the actual db.quotes.put (status
   * flip + decisionAt + declineReason persistence).
   */
  onConfirm: (args: { reason: string }) => Promise<void>;
  /** Called when the user clicks Cancel or presses Escape. */
  onClose: () => void;
}

export function DeclineQuoteModal({ quote, onConfirm, onClose }: DeclineQuoteModalProps) {
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = quote !== null;

  // Reset state when modal opens (Modal unmounts children on close, but we still
  // need fresh state on each open).
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setIsSaving(false);
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await onConfirm({ reason: reason.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline the quote.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={quote ? `Decline quote ${formatQuoteNumber(quote.quoteNumber)}` : ''}
      size="md"
    >
      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-300">
          Mark this quote as declined?{' '}
          <span className="text-slate-400">You can reopen it later if the customer changes their mind.</span>
        </p>
        <div>
          <label className="block text-xs text-slate-400 mb-1" htmlFor="decline-reason-input">
            Reason (optional)
          </label>
          <Textarea
            id="decline-reason-input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Too expensive, timing didn't work, went with someone else…"
          />
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 p-4 pt-2 border-t border-slate-700">
        <Button variant="secondary" btnSize="md" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          btnSize="md"
          onClick={() => { void handleConfirm(); }}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Confirm decline'}
        </Button>
      </div>
    </Modal>
  );
}
