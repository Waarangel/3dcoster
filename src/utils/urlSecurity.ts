// ---------------------------------------------------------------------------
// Phase 21 SEC-02 — render-time URL guard
//
// `isSafeHttpUrl` is the predicate that gates `<a href={...}>` render sites
// against stored-XSS payloads (`javascript:`, `data:`, `vbscript:`, `file:`).
//
// Implementation rule (locked by 21-CONTEXT.md D-04):
//   1. If `value` is undefined → false
//   2. Otherwise normalize: `value.trim().toLowerCase()`
//   3. Return true iff the normalized string starts with `http://` or `https://`
//
// The prefix check is intentionally minimal. Richer validation via the WHATWG
// URL parser (encoded payloads, hostname checks, etc.) is deferred — see
// 21-CONTEXT.md `<deferred>`. Save-time UX feedback is also deferred per D-06;
// this helper runs at the render boundary only.
// ---------------------------------------------------------------------------

export function isSafeHttpUrl(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('http://') || normalized.startsWith('https://');
}
