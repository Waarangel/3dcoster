/**
 * Support-nudge gating + external-link helper.
 *
 * A calm, occasional prompt that invites a user to support 3DCoster AFTER they
 * hit a real value moment (recording a sale, creating a PDF quote). The gate
 * keeps it from ever nagging: at most once per cooldown window, never twice in
 * one session, and never again once the user has clicked through to support.
 *
 * Pure logic only — the React/toast wiring lives in components/SupportNudge.tsx.
 */

const STORAGE_KEY = '3dcoster-support-nudge';

/** Buy Me a Coffee destination (kept in sync with the Footer + landing support card). */
export const SUPPORT_URL = 'https://buymeacoffee.com/3dcoster';

/** Minimum gap between nudges — roughly one calendar quarter. */
export const SUPPORT_NUDGE_COOLDOWN_DAYS = 90;
const COOLDOWN_MS = SUPPORT_NUDGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export interface SupportNudgeState {
  /** Epoch ms the nudge was last shown — starts the cooldown. */
  lastShown?: number;
  /** True once the user has clicked through to support — suppresses forever. */
  clicked?: boolean;
}

/** Resets on page reload — stops two value moments in one session double-firing. */
let shownThisSession = false;

function readState(): SupportNudgeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SupportNudgeState) : {};
  } catch {
    return {};
  }
}

function writeState(next: SupportNudgeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage full or unavailable — fail silently; the nudge is non-critical.
  }
}

/** Whether the nudge is allowed to appear right now. */
export function shouldShowSupportNudge(now: number = Date.now()): boolean {
  if (shownThisSession) return false;
  const state = readState();
  if (state.clicked) return false;
  if (state.lastShown !== undefined && now - state.lastShown < COOLDOWN_MS) return false;
  return true;
}

/** Records that the nudge was shown — starts the cooldown and locks the session. */
export function markSupportNudgeShown(now: number = Date.now()): void {
  shownThisSession = true;
  writeState({ ...readState(), lastShown: now });
}

/** Records that the user clicked through — suppresses the nudge permanently. */
export function markSupportNudgeClicked(): void {
  writeState({ ...readState(), clicked: true });
}

/** Opens the support page in the system browser (Tauri-safe); web falls back to a new tab. */
export function openSupportLink(): void {
  if (typeof __IS_TAURI__ !== 'undefined' && __IS_TAURI__) {
    import('@tauri-apps/plugin-shell')
      .then(({ open }) => open(SUPPORT_URL))
      .catch(() => window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer'));
  } else {
    window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer');
  }
}

/** Test-only: clears the in-memory session lock between cases. */
export function _resetSupportNudgeSessionForTest(): void {
  shownThisSession = false;
}
