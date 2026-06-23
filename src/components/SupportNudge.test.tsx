import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ToastProvider, Button } from './ui';
import { useSupportNudge } from './SupportNudge';
import { _resetSupportNudgeSessionForTest, SUPPORT_URL } from '../utils/supportNudge';

// ---------------------------------------------------------------------------
// SupportNudge — verifies the React/toast wiring around the gate logic
// (the gate itself is covered by utils/supportNudge.test.ts). Raw createRoot
// + act per project precedent (PrintQuoteModal/RecordSaleModal tests).
// ---------------------------------------------------------------------------

function Harness() {
  const show = useSupportNudge();
  return <Button onClick={show}>trigger</Button>;
}

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

let container: HTMLDivElement;
let root: Root;

describe('useSupportNudge', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetSupportNudgeSessionForTest();
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the MJ nudge toast after the delay, then opens support + suppresses on click', () => {
    act(() => {
      root.render(
        <ToastProvider>
          <Harness />
        </ToastProvider>
      );
    });

    click(container.querySelector('button')!);

    // Nothing before the post-success delay elapses.
    expect(document.body.textContent).not.toContain('I build 3DCoster solo');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(document.body.textContent).toContain('I build 3DCoster solo');

    const supportBtn = [...document.querySelectorAll('button')].find((b) =>
      /Buy me a coffee/.test(b.textContent ?? '')
    );
    expect(supportBtn).toBeTruthy();

    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    click(supportBtn!);

    expect(openSpy).toHaveBeenCalledWith(SUPPORT_URL, '_blank', 'noopener,noreferrer');
    const state = JSON.parse(localStorage.getItem('3dcoster-support-nudge') ?? '{}');
    expect(state.clicked).toBe(true);
  });

  it('stays silent when the gate is closed (user already clicked through)', () => {
    localStorage.setItem('3dcoster-support-nudge', JSON.stringify({ clicked: true }));

    act(() => {
      root.render(
        <ToastProvider>
          <Harness />
        </ToastProvider>
      );
    });

    click(container.querySelector('button')!);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(document.body.textContent).not.toContain('I build 3DCoster solo');
  });
});
