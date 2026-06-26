import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

// ---------------------------------------------------------------------------
// ConfirmModal — A11Y C-03.
//
// The shared styled confirm dialog that replaced ad-hoc window.confirm() calls
// for destructive actions. The load-bearing contract: onConfirm fires ONLY when
// the user explicitly clicks the danger button — NEVER on mount (no auto-confirm),
// and NEVER on Cancel/Escape/backdrop.
//
// Raw createRoot + act per project precedent (SettingsModal.test.tsx).
// ConfirmModal renders via Modal → createPortal(…, document.body), so all DOM
// queries target document.body (not the container div).
// ---------------------------------------------------------------------------

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

function renderModal(props: Partial<React.ComponentProps<typeof ConfirmModal>> = {}) {
  const onConfirm = props.onConfirm ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  act(() => {
    root!.render(
      <ConfirmModal
        isOpen={props.isOpen ?? true}
        title={props.title ?? 'Delete customer'}
        body={props.body ?? 'Delete Jane Doe? They have no past sales linked.'}
        confirmLabel={props.confirmLabel ?? 'Delete'}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );
  });
  return { onConfirm, onClose };
}

// The danger confirm button is the one whose visible text is the confirmLabel
// AND which carries no aria-label (the header Close button has aria-label="Close").
function getConfirmButton(label = 'Delete'): HTMLButtonElement | null {
  const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'));
  return (
    buttons.find(b => (b.textContent ?? '').trim() === label && !b.getAttribute('aria-label')) ?? null
  );
}

function getCancelButton(): HTMLButtonElement | null {
  const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'));
  return buttons.find(b => (b.textContent ?? '').trim() === 'Cancel') ?? null;
}

describe('ConfirmModal', () => {
  it('renders the title and body when open', () => {
    renderModal({ title: 'Delete printer', body: 'Delete this printer instance?' });
    expect(document.body.textContent).toContain('Delete printer');
    expect(document.body.textContent).toContain('Delete this printer instance?');
  });

  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('does NOT call onConfirm on mount (no auto-confirm)', () => {
    const { onConfirm } = renderModal();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm only when the danger button is clicked, then closes', async () => {
    const { onConfirm, onClose } = renderModal();

    const confirmBtn = getConfirmButton();
    expect(confirmBtn).not.toBeNull();

    await act(async () => {
      confirmBtn!.click();
      await Promise.resolve();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking Cancel calls onClose but NOT onConfirm', async () => {
    const { onConfirm, onClose } = renderModal();

    const cancelBtn = getCancelButton();
    expect(cancelBtn).not.toBeNull();

    await act(async () => {
      cancelBtn!.click();
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pressing Escape calls onClose but NOT onConfirm', async () => {
    const { onConfirm, onClose } = renderModal();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error and does NOT close when onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Delete failed on disk'));
    const { onClose } = renderModal({ onConfirm });

    const confirmBtn = getConfirmButton();
    await act(async () => {
      confirmBtn!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Failure keeps the dialog open so the user sees what went wrong.
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Delete failed on disk');
  });

  it('uses a custom confirmLabel on the danger button', () => {
    renderModal({ confirmLabel: 'Remove' });
    expect(getConfirmButton('Remove')).not.toBeNull();
  });
});
