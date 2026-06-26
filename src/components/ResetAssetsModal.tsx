import { useState } from 'react';
import { Button, Modal } from './ui';

// ---------------------------------------------------------------------------
// ResetAssetsModal — FIX-03 (Phase 34, plan 02)
//
// Styled confirm modal for the destructive "Reset all" action in AssetLibrary,
// replacing the prior window.confirm() with a deliberate, counts-showing modal
// built on the shared <Modal> primitive.
//
// Presenter for the destructive "Reset" action in AssetLibrary. The caller owns
// the scope-aware copy (title / body / confirmLabel) because what a reset DOES
// depends on the selected category — restore a built-in category's defaults,
// restore everything, or clear a custom category. This component only renders the
// confirmation and guards the destructive call.
//
// Per threat model T-34-03: confirm is reachable ONLY via the danger button's
// onClick — no auto-confirm on mount, no default/Enter-through that destroys data.
// ---------------------------------------------------------------------------

export interface ResetAssetsModalProps {
  /** Whether the confirm dialog is open. */
  isOpen: boolean;
  /** Modal heading, e.g. "Reset Filaments" / "Reset Tester" / "Reset All". */
  title: string;
  /** Full confirmation sentence describing exactly what reset will do. */
  body: string;
  /** Danger-button label (matches the title). */
  confirmLabel: string;
  /** Called only when the user explicitly clicks the danger confirm button. */
  onConfirm: () => Promise<void> | void;
  /** Called when the user clicks Cancel or presses Escape / backdrop. */
  onClose: () => void;
}

export function ResetAssetsModal({ isOpen, title, body, confirmLabel, onConfirm, onClose }: ResetAssetsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
