// ---------------------------------------------------------------------------
// Phase 21 SEC-02 — render-time URL guard
//
// Tests for `isSafeHttpUrl`, the predicate that gates `<a href={...}>` render
// sites against `javascript:` / `data:` / `vbscript:` / `file:` stored-XSS
// payloads.
//
// v1.9 hardening: the implementation moved from a `startsWith('http://')`
// prefix check to a WHATWG `URL` parse. The valid-http(s) and dangerous-scheme
// cases below are unchanged; the new block covers encoded-scheme / control-char
// payloads that a naive prefix check would have let through.
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
  it("'foo' → false (plain word, no scheme — fails URL parse)", () => {
    expect(isSafeHttpUrl('foo')).toBe(false);
  });
  it("'/relative/path' → false (relative URL — no protocol)", () => {
    expect(isSafeHttpUrl('/relative/path')).toBe(false);
  });
  it("'//example.com' → false (protocol-relative — no scheme)", () => {
    expect(isSafeHttpUrl('//example.com')).toBe(false);
  });

  // -- WHATWG-parser edge cases the old prefix check missed --
  it("'\\thttp://evil.com' → true after trim (leading tab stripped, valid http)", () => {
    // The function trims input, so a leading whitespace control char does not
    // change the resolved protocol — it is a genuine http URL once trimmed.
    expect(isSafeHttpUrl('\thttp://evil.com')).toBe(true);
  });
  it("'java\\nscript:alert(1)' → false (embedded newline does not forge http)", () => {
    expect(isSafeHttpUrl('java\nscript:alert(1)')).toBe(false);
  });
  it("'jav\\tascript:alert(1)' → false (embedded tab does not forge http)", () => {
    expect(isSafeHttpUrl('jav\tascript:alert(1)')).toBe(false);
  });
  it("'ht!tp://example.com' → false (malformed scheme → URL parse throws)", () => {
    expect(isSafeHttpUrl('ht!tp://example.com')).toBe(false);
  });
  it("'blob:https://example.com/uuid' → false (blob: is not http/https)", () => {
    expect(isSafeHttpUrl('blob:https://example.com/uuid')).toBe(false);
  });
});
