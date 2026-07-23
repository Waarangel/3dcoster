import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastProvider } from '../ui';

// ---------------------------------------------------------------------------
// HostedLinkActions — G-46-6R (gap closure).
//
// Persistent Copy-link + Open-hosted-page affordance for a published quote's
// quote.publishedUrl. Raw createRoot + act + ToastProvider precedent from
// ShareQuoteButton.test.tsx. __IS_TAURI__ stubbed via vi.stubGlobal so the
// Open handler's web-vs-desktop branch is exercised deterministically.
// ---------------------------------------------------------------------------

vi.stubGlobal('__IS_TAURI__', false);

const { HostedLinkActions } = await import('./HostedLinkActions');

const TEST_URL = 'https://3dcoster.com/q/abc123';
const TEST_LABEL = 'Q-0007';

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let originalClipboard: Clipboard;

beforeEach(() => {
  originalClipboard = navigator.clipboard;
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
  Object.defineProperty(navigator, 'clipboard', {
    value: originalClipboard,
    configurable: true,
    writable: true,
  });
  vi.clearAllMocks();
  vi.stubGlobal('__IS_TAURI__', false);
});

function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    value,
    configurable: true,
    writable: true,
  });
}

function render() {
  act(() => {
    root!.render(
      <ToastProvider>
        <HostedLinkActions url={TEST_URL} label={TEST_LABEL} />
      </ToastProvider>,
    );
  });
}

function findByLabel(label: string): HTMLButtonElement | null {
  return document.body.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

describe('HostedLinkActions', () => {
  it('renders labelled Copy-link and Open-hosted-page controls', () => {
    render();

    expect(findByLabel(`Copy link for ${TEST_LABEL}`)).not.toBeNull();
    expect(findByLabel(`Open hosted page for ${TEST_LABEL}`)).not.toBeNull();
  });

  it('shows a success toast confirming the copy when the clipboard write succeeds', async () => {
    stubClipboard({ writeText: () => Promise.resolve() });
    render();

    await act(async () => {
      findByLabel(`Copy link for ${TEST_LABEL}`)!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const status = document.body.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.textContent).toContain(TEST_URL);
    expect((status!.textContent ?? '').toLowerCase()).toContain('copied');
  });

  it('shows a persistent, non-copied-claiming toast with the url when the clipboard write fails', async () => {
    vi.useFakeTimers();
    stubClipboard(undefined);
    render();

    await act(async () => {
      findByLabel(`Copy link for ${TEST_LABEL}`)!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain(TEST_URL);
    expect(bodyText.toLowerCase()).not.toContain('copied');

    // Non-transient: still present well past the default 5000ms auto-dismiss.
    act(() => { vi.advanceTimersByTime(60000); });
    expect(document.body.textContent ?? '').toContain(TEST_URL);

    vi.useRealTimers();
  });

  it('calls window.open with the url on web when Open is clicked', async () => {
    vi.stubGlobal('__IS_TAURI__', false);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render();

    await act(async () => {
      findByLabel(`Open hosted page for ${TEST_LABEL}`)!.click();
      await Promise.resolve();
    });

    expect(openSpy).toHaveBeenCalledWith(TEST_URL, '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('stops propagation on both handlers so the surrounding row click never fires', async () => {
    stubClipboard({ writeText: () => Promise.resolve() });
    const rowClick = vi.fn();
    act(() => {
      root!.render(
        <ToastProvider>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div onClick={rowClick}>
            <HostedLinkActions url={TEST_URL} label={TEST_LABEL} />
          </div>
        </ToastProvider>,
      );
    });

    await act(async () => {
      findByLabel(`Copy link for ${TEST_LABEL}`)!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rowClick).not.toHaveBeenCalled();
  });
});
