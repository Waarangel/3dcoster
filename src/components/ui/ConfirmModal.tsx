import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

// ---------------------------------------------------------------------------
// ConfirmModal — shared styled confirmation dialog for destructive actions.
//
// A11Y C-03: replaces ad-hoc `window.confirm()` calls (which are unstyled,
// inconsistent, and bypass the app's focus-trap / theming) with the shared
// <Modal> primitive. Built on the same pattern as ResetAssetsModal: a pure
// presenter that NEVER auto-confirms on mount — the destructive `onConfirm`
// fires ONLY when the user explicitly clicks the danger button.
//
// Focus is returned to the triggering element on close by the underlying
// Modal/useDialogA11y lifecycle (it captures document.activeElement on open
// and restores it on cleanup).
// ---------------------------------------------------------------------------

export interface ConfirmModalProps {
  /** Whether the confirm dialog is open. */
  isOpen: boolean;
  /** Modal heading, e.g. "Delete customer". */
  title: string;
  /** Confirmation sentence describing exactly what the action will do. */
  body: string;
  /** Danger-button label. Default: "Delete". */
  confirmLabel?: string;
  /** Cancel-button label. Default: "Cancel". */
  cancelLabel?: string;
  /** Called only when the user explicitly clicks the danger confirm button. */
  onConfirm: () => Promise<void> | void;
  /** Called when the user clicks Cancel or presses Escape / backdrop. */
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  body,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setIsBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-300">{body}</p>
        {error && (
          <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 p-4 pt-2 border-t border-slate-700">
        <Button variant="secondary" btnSize="md" onClick={onClose} disabled={isBusy}>
          {cancelLabel}
        </Button>
        <Button
          variant="danger"
          btnSize="md"
          onClick={() => { void handleConfirm(); }}
          disabled={isBusy}
        >
          {isBusy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
