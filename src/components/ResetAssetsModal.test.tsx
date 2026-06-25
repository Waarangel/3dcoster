import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ResetAssetsModal } from './ResetAssetsModal';

// ---------------------------------------------------------------------------
// ResetAssetsModal — FIX-03 (Phase 34, plan 02)
//
// Styled confirm modal replacing the window.confirm() on the destructive
// "Reset all" action in AssetLibrary. Built on the shared Modal primitive.
//
// Open via mode='printer' | mode='material'; closed via mode=null.
// Shows the count of items about to be replaced so the user sees the blast
// radius before confirming.
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
  // Test 1: 'printer' mode with N printers shows correct copy
  it('renders dialog with printer count when mode is printer', async () => {
    await act(async () => {
      root!.render(
        <ResetAssetsModal
          mode="printer"
          count={5}
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const body = document.body.textContent ?? '';
    expect(body).toContain('5');
    expect(body.toLowerCase()).toContain('printer');
  });

  // Test 2: 'material' mode with M materials shows correct copy
  it('renders dialog with material count when mode is material', async () => {
    await act(async () => {
      root!.render(
        <ResetAssetsModal
          mode="material"
          count={12}
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const body = document.body.textContent ?? '';
    expect(body).toContain('12');
    expect(body.toLowerCase()).toContain('material');
  });

  // Test 3: Confirm calls onConfirm once; Cancel calls onClose without calling onConfirm
  it('clicking confirm calls onConfirm exactly once; clicking cancel calls onClose and not onConfirm', async () => {
    // -- confirm path --
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    await act(async () => {
      root!.render(
        <ResetAssetsModal
          mode="printer"
          count={3}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      );
    });
    const confirmBtn = buttonByText('Reset printers');
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
          mode="material"
          count={7}
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

  // Test 4: Rendering open modal does NOT auto-call onConfirm (no auto/Enter-through destroy)
  it('rendering the open modal does not auto-call onConfirm', async () => {
    const onConfirm = vi.fn();
    await act(async () => {
      root!.render(
        <ResetAssetsModal
          mode="printer"
          count={2}
          onConfirm={onConfirm}
          onClose={vi.fn()}
        />
      );
    });
    // Verify modal is open
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    // onConfirm must NOT have been called on mount or render
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // Closed state: mode=null → no dialog
  it('renders nothing when mode is null', async () => {
    await act(async () => {
      root!.render(
        <ResetAssetsModal
          mode={null}
          count={0}
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
