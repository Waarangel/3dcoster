// ---------------------------------------------------------------------------
// Phase 21 SEC-02 — render-time URL guard
//
// Tests for `isSafeHttpUrl`, the predicate that gates `<a href={...}>` render
// sites against `javascript:` / `data:` / `vbscript:` / `file:` stored-XSS
// payloads. Implementation rule is locked by D-04: trim → lowercase → require
// `http://` or `https://` prefix. Encoded-payload / `new URL()` coverage is
// deferred per 21-CONTEXT.md `<deferred>`.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { isSafeHttpUrl } from './urlSecurity';

describe('isSafeHttpUrl (Phase 21 SEC-02 — render-time URL guard)', () => {
  // -- valid http(s) --
  it("'http://example.com' → true", () => {
    expect(isSafeHttpUrl('http://example.com')).toBe(true);
  });
  it("'https://example.com' → true", () => {
    expect(isSafeHttpUrl('https://example.com')).toBe(true);
  });
  it("'HTTPS://Example.com' → true (case-normalized via toLowerCase)", () => {
    expect(isSafeHttpUrl('HTTPS://Example.com')).toBe(true);
  });
  it("'  https://example.com  ' → true (whitespace trimmed before prefix check)", () => {
    expect(isSafeHttpUrl('  https://example.com  ')).toBe(true);
  });

  // -- dangerous schemes blocked --
  it("'JavaScript:alert(1)' → false (case-normalized → javascript:)", () => {
    expect(isSafeHttpUrl('JavaScript:alert(1)')).toBe(false);
  });
  it("'  javascript:alert(1)' → false (whitespace trim does not save it)", () => {
    expect(isSafeHttpUrl('  javascript:alert(1)')).toBe(false);
  });
  it("'javascript:alert(1)' → false", () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
  });
  it("'data:text/html,<script>alert(1)</script>' → false", () => {
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });
  it("'vbscript:msgbox(1)' → false", () => {
    expect(isSafeHttpUrl('vbscript:msgbox(1)')).toBe(false);
  });
  it("'file:///etc/passwd' → false", () => {
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
  });
  it("'mailto:user@example.com' → false", () => {
    expect(isSafeHttpUrl('mailto:user@example.com')).toBe(false);
  });

  // -- empty / undefined / non-URL --
  it("'' → false", () => {
    expect(isSafeHttpUrl('')).toBe(false);
  });
  it("'   ' → false (whitespace-only)", () => {
    expect(isSafeHttpUrl('   ')).toBe(false);
  });
  it("undefined → false", () => {
    expect(isSafeHttpUrl(undefined)).toBe(false);
  });
  it("'foo' → false (plain word, no scheme)", () => {
    expect(isSafeHttpUrl('foo')).toBe(false);
  });
  it("'http:foo' → false (no double-slash — does not match `http://` prefix)", () => {
    expect(isSafeHttpUrl('http:foo')).toBe(false);
  });
});
