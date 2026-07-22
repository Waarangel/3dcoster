// ---------------------------------------------------------------------------
// Phase 46 D-01 — canonical logo data-URL validator (the XSS allowlist).
//
// This is the SINGLE source of truth for validating a white-label maker
// logo before it is ever written to UserProfile.logoDataUrl or interpolated
// into hosted-page HTML (46-05's api/q/[token].ts). That server-side path
// CANNOT import from src/ (it's a separate Vercel function bundle), so
// 46-05 mirrors this exact regex verbatim with a comment pointing back here.
// Any change to the regex below MUST be mirrored there.
//
// RESEARCH.md Pitfall 4 / Security Domain STRIDE row: a logoDataUrl string
// interpolated into an `<img src="...">` attribute without validation is a
// stored-XSS vector (javascript: URLs, svg with embedded scripts, or a
// quote/attribute-breakout payload). The regex below only accepts the three
// raster mimetypes we ever produce (png/jpeg/webp) and only the base64
// alphabet — no whitespace, quotes, angle brackets, or other characters
// that could break out of an HTML attribute can pass.
// ---------------------------------------------------------------------------

/** Anchored allowlist: data:image/(png|jpeg|webp);base64,<base64 chars only> */
const LOGO_DATA_URL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

/**
 * Defense-in-depth cap on the total string length of a logo data URL.
 * A data URL is ~1.34x the underlying byte size (base64 overhead), so this
 * corresponds to roughly the ~150 KB soft cap discussed in RESEARCH.md Open
 * Question 3 (150_000 * 1.34 ≈ 201_000, rounded up to 205_000).
 */
export const MAX_LOGO_DATA_URL_LENGTH = 205_000;

/**
 * Validate that `value` is a safe, well-formed logo data URL.
 *
 * Only `data:image/(png|jpeg|webp);base64,<base64>` strings pass. Rejects
 * svg (not allowlisted — can carry embedded scripts), `javascript:` URLs,
 * any string containing characters outside the base64 alphabet (blocks
 * quote/space/angle-bracket attribute-breakout payloads), and any string
 * longer than MAX_LOGO_DATA_URL_LENGTH.
 *
 * Examples:
 *   isValidLogoDataUrl('data:image/png;base64,iVBORw0KGgo=') → true
 *   isValidLogoDataUrl('data:image/svg+xml;base64,PHN2Zz4=') → false (svg not allowlisted)
 *   isValidLogoDataUrl('javascript:alert(1)') → false
 *   isValidLogoDataUrl(undefined) → false
 */
export function isValidLogoDataUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  if (value.length > MAX_LOGO_DATA_URL_LENGTH) return false;
  return LOGO_DATA_URL_REGEX.test(value);
}
