import { isSafeHttpUrl } from './urlSecurity';

export interface Announcement {
  id: string;
  active: boolean;
  message: string;
  ctaLabel: string;
  url: string;
}

// Served via jsDelivr's CDN mirror of the repo. cdn.jsdelivr.net is already
// allow-listed in BOTH the web CSP (vercel.json) and the desktop CSP
// (tauri.conf.json), so no CSP change is needed. jsDelivr returns the raw JSON
// directly (no base64) and — unlike the GitHub API — has no rate limit. Edits
// to announcement.json on main propagate within jsDelivr's cache window
// (up to ~12h); force instantly by hitting
// https://purge.jsdelivr.net/gh/Waarangel/3dcoster@main/announcement.json
//
// SECURITY TRADEOFF (v1.9 hardening, audit M-2 — intentionally NOT pinned):
// This URL points at the *mutable* `@main` ref rather than an immutable commit
// SHA. Pinning to a SHA would require a redeploy to publish each notice, which
// breaks the deliberate "edit announcement.json on main, no redeploy" workflow.
// The integrity risk this accepts is bounded: the payload is validated by
// parseAnnouncement() (strict shape check), its message/ctaLabel are rendered
// as escaped React text (never dangerouslySetInnerHTML), and its `url` must
// pass isSafeHttpUrl(). So even a compromised repo/CDN can at worst surface a
// phishing CTA to an http(s) destination — no script execution, no XSS. That
// residual risk is accepted in exchange for the zero-deploy publishing flow.
export const ANNOUNCEMENT_URL =
  'https://cdn.jsdelivr.net/gh/Waarangel/3dcoster@main/announcement.json';

const DISMISS_KEY_PREFIX = 'dismissedAnnouncement:';

/**
 * Validate an untrusted remote payload into an Announcement, or return null.
 *
 * Security boundary: this is remote-controlled content. The `url` MUST pass
 * isSafeHttpUrl (blocks javascript:/data:/etc.), and message/ctaLabel are
 * returned as plain strings to be rendered as text (React escapes them — never
 * dangerouslySetInnerHTML). Any shape, type, or url violation → null (no banner).
 */
export function parseAnnouncement(raw: unknown): Announcement | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== 'string' || o.id.trim() === '') return null;
  if (typeof o.active !== 'boolean') return null;
  if (typeof o.message !== 'string' || o.message.trim() === '') return null;
  if (typeof o.ctaLabel !== 'string' || o.ctaLabel.trim() === '') return null;
  if (typeof o.url !== 'string' || !isSafeHttpUrl(o.url)) return null;

  return {
    id: o.id,
    active: o.active,
    message: o.message,
    ctaLabel: o.ctaLabel,
    url: o.url,
  };
}

export function announcementDismissKey(id: string): string {
  return `${DISMISS_KEY_PREFIX}${id}`;
}

/** Dismissal is tracked per-campaign id, so a NEW campaign re-shows to everyone. */
export function isAnnouncementDismissed(id: string): boolean {
  try {
    return localStorage.getItem(announcementDismissKey(id)) === '1';
  } catch {
    return false;
  }
}

export function markAnnouncementDismissed(id: string): void {
  try {
    localStorage.setItem(announcementDismissKey(id), '1');
  } catch {
    // Ignore storage failures (private mode / quota) — worst case the banner
    // reappears next load, which is acceptable.
  }
}
