import { describe, it, expect, afterEach } from 'vitest';
import { copyToClipboard } from './clipboard';

// ---------------------------------------------------------------------------
// copyToClipboard — G-46-6R fix for the ShareQuoteButton.tsx:79 false-positive.
//
// `navigator.clipboard?.writeText(url)` optional-chains to `undefined` when
// the WebView exposes no clipboard (desktop Tauri), which resolves without
// throwing — the caller's try/catch never fires and the toast falsely claims
// "copied". copyToClipboard() replaces that with a function that returns a
// TRUTHFUL boolean in every case and never throws, so the caller can branch
// the toast copy on the real result.
// ---------------------------------------------------------------------------

const originalClipboard = navigator.clipboard;

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: originalClipboard,
    configurable: true,
    writable: true,
  });
});

function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    value,
    configurable: true,
    writable: true,
  });
}

describe('copyToClipboard', () => {
  it('returns true when the clipboard API is present and writeText resolves', async () => {
    const writeText = () => Promise.resolve();
    stubClipboard({ writeText });

    const result = await copyToClipboard('https://3dcoster.com/q/abc');

    expect(result).toBe(true);
  });

  it('returns false without throwing when navigator.clipboard is undefined', async () => {
    stubClipboard(undefined);

    await expect(copyToClipboard('https://3dcoster.com/q/abc')).resolves.toBe(false);
  });

  it('returns false without throwing when writeText is not a function', async () => {
    stubClipboard({ writeText: undefined });

    await expect(copyToClipboard('https://3dcoster.com/q/abc')).resolves.toBe(false);
  });

  it('returns false without throwing when writeText rejects', async () => {
    const writeText = () => Promise.reject(new Error('denied'));
    stubClipboard({ writeText });

    await expect(copyToClipboard('https://3dcoster.com/q/abc')).resolves.toBe(false);
  });
});
