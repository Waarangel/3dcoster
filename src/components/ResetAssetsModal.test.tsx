import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ResetAssetsModal } from './ResetAssetsModal';

// ---------------------------------------------------------------------------
// ResetAssetsModal — FIX-03 (Phase 34, plan 02); presenter API since v1.9.
//
// Styled confirm modal replacing window.confirm() on the destructive "Reset"
// action in AssetLibrary. The caller owns the scope-aware copy and passes
// isOpen / title / body / confirmLabel; this component renders + guards the call.
// ---------------------------------------------------------------------------

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) { act(() => { root!.unmount(); }); root = null; }
  if (container) { container.remove(); container = null; }
});

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === text,
  ) as HTMLButtonElement | undefined;
}

describe('ResetAssetsModal', () => {
  // Test 1: open renders the caller-provided title + body
  it('renders the provided title and body when open', async () => {
    await act(async () => {
      root!.render(
        <ResetAssetsModal
          isOpen
          title="Reset Filaments"
          body="This will restore the default filament list. This action cannot be undone."
          confirmLabel="Reset Filaments"
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const body = document.body.textContent ?? '';
    expect(body).toContain('Reset Filaments');
    expect(body.toLowerCase()).toContain('restore the default filament list');
  });

  // Test 2: a custom-category clear shows the destructive copy verbatim
  it('renders a custom-category clear confirmation', async () => {
    await act(async () => {
      root!.render(
        <ResetAssetsModal
          isOpen
          title="Reset Tester"
          body="This will remove all Tester assets. This action cannot be undone."
          confirmLabel="Reset Tester"
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });
    const body = (document.body.textContent ?? '').toLowerCase();
    expect(body).toContain('remove all tester assets');
  });

  // Test 3: confirm calls onConfirm once; cancel calls onClose, not onConfirm
  it('confirm calls onConfirm; cancel calls onClose only', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root!.render(
        <ResetAssetsModal
          isOpen
          title="Reset Printers"
          body="This will restore the default printer list. Your custom printers are kept. This action cannot be undone."
          confirmLabel="Reset Printers"
          onConfirm={onConfirm}
          onClose={onClose}
        />
      );
    });
    const confirmBtn = buttonByText('Reset Printers');
    expect(confirmBtn).toBeDefined();
    await act(async () => { confirmBtn!.click(); });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // -- cancel path --
    act(() => { root!.unmount(); });
    const onConfirm2 = vi.fn();
    const onClose2 = vi.fn();
    root = createRoot(container!);
    await act(async () => {
      root!.render(
        <ResetAssetsModal
          isOpen
          title="Reset All"
          body="This will restore all default materials. Your custom categories are kept. This action cannot be undone."
          confirmLabel="Reset All"
          onConfirm={onConfirm2}
          onClose={onClose2}
        />
      );
    });
    const cancelBtn = buttonByText('Cancel');
    expect(cancelBtn).toBeDefined();
    await act(async () => { cancelBtn!.click(); });
    expect(onClose2).toHaveBeenCalledTimes(1);
    expect(onConfirm2).not.toHaveBeenCalled();
  });

  // Test 4: rendering open modal does NOT auto-call onConfirm (no auto/Enter-through destroy)
  it('rendering the open modal does not auto-call onConfirm', async () => {
    const onConfirm = vi.fn();
    await act(async () => {
      root!.render(
        <ResetAssetsModal
          isOpen
          title="Reset Printers"
          body="..."
          confirmLabel="Reset Printers"
          onConfirm={onConfirm}
          onClose={vi.fn()}
        />
      );
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // Test 5: closed state (isOpen=false) renders no dialog
  it('renders nothing when isOpen is false', async () => {
    await act(async () => {
      root!.render(
        <ResetAssetsModal
          isOpen={false}
          title=""
          body=""
          confirmLabel=""
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
