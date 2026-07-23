/**
 * api/lib/logoDataUrl.ts
 *
 * Lockstep copy of src/utils/logoDataUrl.ts — api/ cannot import from src/
 * (separate Vercel Function deploy bundle, same reasoning as
 * api/lib/supabaseRest.ts not depending on @supabase/supabase-js). Keep this
 * regex and length cap BYTE-IDENTICAL to the canonical copy in
 * src/utils/logoDataUrl.ts. Any change there MUST be mirrored here.
 *
 * This is the SERVER half of the Pitfall-4 stored-XSS defense: the
 * `hosted_quotes.snapshot.logoDataUrl` value is interpolated into
 * server-rendered HTML (`<img src="...">`) that a maker's CUSTOMERS view
 * (api/q/[token].ts). The client already validates at publish-write time
 * (src/hooks/usePublishedQuote.ts), but this function re-validates at
 * render time so a malformed/tampered row in Supabase can never reach the
 * page — defense-in-depth, not "trust the client wrote a good value."
 */

/** Anchored allowlist: data:image/(png|jpeg|webp);base64,<base64 chars only> */
const LOGO_DATA_URL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

/**
 * Defense-in-depth cap on the total string length of a logo data URL.
 * A data URL is ~1.34x the underlying byte size (base64 overhead), so this
 * corresponds to roughly the ~150 KB soft cap discussed in 46-RESEARCH.md
 * Open Question 3 (150_000 * 1.34 ≈ 201_000, rounded up to 205_000).
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
