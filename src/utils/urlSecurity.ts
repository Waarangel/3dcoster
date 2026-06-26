// ---------------------------------------------------------------------------
// Phase 21 SEC-02 — render-time URL guard
//
// `isSafeHttpUrl` is the predicate that gates `<a href={...}>` render sites
// against stored-XSS payloads (`javascript:`, `data:`, `vbscript:`, `file:`).
//
// v1.9 hardening (Tier-2 SEC): the original prefix check
// (`startsWith('http://' | 'https://')`) was upgraded to a WHATWG `URL` parse.
// The parser resolves the *actual* protocol — so encoded schemes, embedded
// control characters (e.g. `\thttp://evil`, `java\nscript:`), and other
// edge cases that defeat a naive string match are all rejected because the
// only protocols that pass are `http:`/`https:`. Behavior for genuine
// http(s) URLs is unchanged; this is a strict tightening, not a behavior swap.
// Signature is preserved so every existing render site upgrades at once.
// ---------------------------------------------------------------------------

export function isSafeHttpUrl(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    // Malformed / relative / scheme-less input → not a safe absolute http(s) URL.
    return false;
  }
}
