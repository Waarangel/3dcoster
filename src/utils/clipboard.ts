/**
 * Truthfully copy text to the OS clipboard.
 *
 * G-46-6R fix: `navigator.clipboard?.writeText(url)` optional-chains to
 * `undefined` when the WebView exposes no clipboard (observed on desktop
 * Tauri), which resolves without throwing — a caller relying on try/catch
 * around that expression never sees a failure and ends up claiming "copied"
 * when nothing was copied. This function guards every step explicitly and
 * returns an honest boolean instead: `true` only after `writeText` actually
 * resolves, `false` in every other case. It never throws.
 *
 * @example
 *   await copyToClipboard('https://3dcoster.com/q/abc123') → true  (copied)
 *   await copyToClipboard('https://3dcoster.com/q/abc123') → false (no clipboard / denied / rejected)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined') return false;
    const clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== 'function') return false;

    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
