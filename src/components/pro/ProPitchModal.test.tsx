import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProPitchModal } from './ProPitchModal';

// ---------------------------------------------------------------------------
// ProPitchModal — Phase 43-04 (D-10: the ONE pitch surface for Share quote).
// Raw createRoot + act per project precedent (ConfirmModal.test.tsx).
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

function renderModal(props: Partial<React.ComponentProps<typeof ProPitchModal>> = {}) {
  const onClose = props.onClose ?? vi.fn();
  const onSignIn = props.onSignIn ?? vi.fn();
  act(() => {
    root!.render(
      <ProPitchModal isOpen={props.isOpen ?? true} onClose={onClose} onSignIn={onSignIn} />,
    );
  });
  return { onClose, onSignIn };
}

describe('ProPitchModal', () => {
  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('presents the full Pro bundle: hosted quote links AND white-label branding', () => {
    renderModal();
    expect(document.body.textContent).toContain('Unlock 3DCoster Pro');
    expect(document.body.textContent).toContain('Approve or Decline');
    expect(document.body.textContent).toContain('white-label branding');
    expect(document.body.textContent).toContain('Made with 3DCoster');
  });

  it('"Not now" closes without signing in', async () => {
    const { onClose, onSignIn } = renderModal();
    const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'));
    const notNowBtn = buttons.find(b => (b.textContent ?? '').trim() === 'Not now');
    expect(notNowBtn).not.toBeUndefined();
    await act(async () => { notNowBtn!.click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('"Sign in for Pro" closes the pitch and triggers sign-in', async () => {
    const { onClose, onSignIn } = renderModal();
    const signInBtn = document.body.querySelector<HTMLButtonElement>('button[aria-label="Sign in for Pro"]');
    expect(signInBtn).not.toBeNull();
    await act(async () => { signInBtn!.click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
