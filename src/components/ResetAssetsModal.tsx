import { useState } from 'react';
import { Button, Modal } from './ui';

// ---------------------------------------------------------------------------
// ResetAssetsModal — FIX-03 (Phase 34, plan 02)
//
// Styled confirm modal for the destructive "Reset all" action in AssetLibrary,
// replacing the prior window.confirm() with a deliberate, counts-showing modal
// built on the shared <Modal> primitive.
//
// Usage: render persistently; pass mode='printer' | 'material' (open) or
// mode=null (closed). The count prop reflects the number of items about to
// be replaced so the user sees the blast radius before confirming.
//
// Per threat model T-34-03: confirm is reachable ONLY via the danger button's
// onClick — no auto-confirm on mount, no default/Enter-through that destroys data.
// ---------------------------------------------------------------------------

export interface ResetAssetsModalProps {
  /** 'printer' | 'material' = open in that mode; null = closed. */
  mode: 'printer' | 'material' | null;
  /** Number of items (printers or materials) about to be replaced. */
  count: number;
  /** Called only when the user explicitly clicks the danger confirm button. */
  onConfirm: () => Promise<void> | void;
  /** Called when the user clicks Cancel or presses Escape / backdrop. */
  onClose: () => void;
}

export function ResetAssetsModal({ mode, count, onConfirm, onClose }: ResetAssetsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = mode !== null;

  const isPrinter = mode === 'printer';

  const title = isPrinter ? 'Reset printers' : 'Reset materials';

  const countWord = count === 1
    ? (isPrinter ? '1 custom printer' : '1 material')
    : (isPrinter ? `${count} custom printers` : `${count} materials`);

  const body = isPrinter
    ? `This will replace your ${countWord} with the default printer list. This action cannot be undone.`
    : `This will replace your ${countWord} with the default list. This action cannot be undone.`;

  const confirmLabel = isPrinter ? 'Reset printers' : 'Reset materials';

  const handleConfirm = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset — please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-300">{body}</p>
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
          {isSaving ? 'Resetting…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
