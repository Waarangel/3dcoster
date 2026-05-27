---
phase: 21-csv-url-security
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/utils/csvHelpers.ts
  - src/utils/csvHelpers.test.ts
  - src/utils/urlSecurity.ts
  - src/utils/urlSecurity.test.ts
  - src/components/JobsManager.tsx
  - src/components/JobsManager.test.tsx
  - src/utils/customerCsv.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-27
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 21 ships three security hardening tasks: SEC-01 (CSV formula injection
guard via `sanitizeCsvCell` at every `Papa.unparse` boundary), SEC-02
(render-time URL guard via `isSafeHttpUrl` at the JobCard `<a href={modelUrl}>`
render site), and SEC-03 (parser pass-through regression lock in
`customerCsv.test.ts`).

The implementation respects the locked decisions in `21-CONTEXT.md`. All four
`Papa.unparse` call sites in `csvHelpers.ts` apply `sanitizeCsvCell` at the
cell-serialization boundary (D-02 / D-03). `isSafeHttpUrl` correctly rejects
`javascript:`, `data:`, `vbscript:`, `file:`, `mailto:`, schemeless, empty,
whitespace-only, and undefined inputs while accepting `http(s)://` with
trim+lowercase normalization. The JobsManager render-time guard renders the
unsafe URL as a `<span>` text child (not as an `href`), so the value cannot
execute even though it is shown to the user (D-07 self-healing UX). React
auto-escapes the text content, so there is no XSS via the fallback path.

The D-05 (urlSecurity) and D-08 / D-09 (customerCsv / csvHelpers) documented
case lists are all covered by the new test blocks. JobsManager integration
tests cover a representative URL subset (`https://`, `javascript:`,
`data:text/html`, empty, undefined); the unit predicate covers the full D-05
list.

Findings below are quality-tier — no security defect blocks shipping. The two
warnings flag a documented-but-narrow trigger-character scope (OWASP also
calls out `\t` and `\r`) and a defensive null-guard gap on `isSafeHttpUrl`.
The info items are test-coverage and docstring nits.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `sanitizeCsvCell` does not block `\t` / `\r` leading characters (OWASP CSV-injection extended trigger set)

**File:** `src/utils/csvHelpers.ts:443-451`
**Issue:** The OWASP "CSV Injection" guidance and several spreadsheet products
recognise a wider trigger set than the four characters this implementation
covers. In particular, leading tab (`\t`, 0x09) and leading carriage return
(`\r`, 0x0D) can be used to reposition the active cell pointer in some
spreadsheet products, which then re-interpret a following `=`, `+`, `-`, or
`@` as a formula. The current code only inspects the first character against
`{=, +, -, @}` and lets cells like `"\t=SUM(A1)"` pass through unchanged.

D-01 in `21-CONTEXT.md` explicitly locks the four-character list, so this is
not a regression against the planned scope — but the review prompt flags it as
an adversarial completeness check, and the helper docstring claims the trigger
set is "the four leading-char triggers that Excel, LibreOffice Calc, and
Numbers treat as formula starts," which understates what those products
actually do. Either tighten the docstring to acknowledge the deferred triggers
or extend the trigger set.

**Fix:** Either (a) extend the guard to also catch `\t` (0x09) and `\r` (0x0D)
— this is a single-line change and preserves the idempotence invariant because
`'` is still not in the extended trigger set — or (b) amend the docstring to
explicitly note that tab/CR are deferred and link the decision back to D-01.

```ts
// Option (a) — extended trigger set:
if (
  first === 0x3d || first === 0x2b || first === 0x2d || first === 0x40 ||
  first === 0x09 || first === 0x0d
) {
  return "'" + value;
}
```

If choosing (b), add a single sentence to the docstring:

```ts
 * Tab (\t) and carriage return (\r) are NOT prefixed here — D-01 locks the
 * trigger set to the four leading chars above. OWASP's extended list is
 * deferred until a real-world exploit surfaces.
```

### WR-02: `isSafeHttpUrl` crashes on `null` input instead of returning `false`

**File:** `src/utils/urlSecurity.ts:18-24`
**Issue:** The signature is `isSafeHttpUrl(value: string | undefined): boolean`
and the only explicit guard is `if (value === undefined) return false;`. If a
caller passes `null` (e.g. via a typed-as-`any` payload from IndexedDB, a JSON
parse path, or a future call site that hasn't been TS-checked yet),
`value.trim()` throws `TypeError: Cannot read properties of null`. The
predicate is meant to be a *safety* helper — failing closed (return `false`)
is strictly safer than throwing.

Today the only call site is `JobsManager.tsx:625` and `PrintJob.modelUrl` is
typed `string | undefined` (`src/types.ts:303`), so the crash is unreachable
*right now*. But the helper is positioned as reusable ("Reusable for future
render sites (PDF embedder, eventual quote-share pages)" per D-04). A second
caller is exactly the moment this regresses.

**Fix:** Widen the early return to also reject `null` and any non-string.

```ts
export function isSafeHttpUrl(value: string | undefined | null): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('http://') || normalized.startsWith('https://');
}
```

This costs nothing, keeps the existing test contract intact (every existing
test still passes), and removes the only way the predicate can be made to
throw.

## Info

### IN-01: D-05 test list is fully covered at the unit level; the JobsManager integration tests skip `vbscript:` and `file:///`

**File:** `src/components/JobsManager.test.tsx:633-751`
**Issue:** The render-time guard integration block covers a representative
subset of D-05 (valid `https://`, `javascript:`, `data:text/html`, undefined,
empty). It does NOT exercise `vbscript:` or `file:///etc/passwd` through the
JSX path. The unit predicate in `urlSecurity.test.ts` does cover those, so
this is defense-in-depth coverage, not a behavioural gap.

**Fix:** Optionally add one more case to the JobCard integration block to
exercise the predicate-to-JSX wiring with another dangerous scheme:

```ts
it("rejects a vbscript: URL (renders as plain-text fallback)", () => {
  renderJobCardWithModelUrl('vbscript:msgbox(1)');
  const block = findModelSourceBlock();
  expect(block!.querySelector('a')).toBeNull();
  const fallback = block!.querySelector('span[title]');
  expect(fallback!.textContent).toBe('vbscript:msgbox(1)');
});
```

### IN-02: `sanitizeCsvCell` test block omits the OWASP extended triggers (`\t`, `\r`) — coverage matches the documented scope but does not lock it

**File:** `src/utils/csvHelpers.test.ts:56-89`
**Issue:** The Phase 21 SEC-01 describe block covers D-09 verbatim — `=`,
`+`, `-`, `@`, passthrough, empty, embedded trigger (`foo=bar`), idempotence
smoke. There is no test asserting `sanitizeCsvCell('\t=SUM(A1)')` returns
`'\t=SUM(A1)'` unchanged, which means a future contributor "fixing" the
trigger set to also catch `\t` would not break a test — but a contributor
narrowing the trigger set would also not break one. The describe block locks
the documented behavior; it doesn't lock the boundary.

**Fix:** If WR-01 is resolved by extending the trigger set, add two
assertions:

```ts
it("'\\t=SUM(A1)' → \"'\\t=SUM(A1)\" (OWASP extended trigger)", () => {
  expect(sanitizeCsvCell('\t=SUM(A1)')).toBe("'\t=SUM(A1)");
});
it("'\\r=SUM(A1)' → \"'\\r=SUM(A1)\" (OWASP extended trigger)", () => {
  expect(sanitizeCsvCell('\r=SUM(A1)')).toBe("'\r=SUM(A1)");
});
```

If WR-01 is resolved by amending the docstring instead, add the inverse
passthrough assertions to lock the documented boundary:

```ts
it("'\\t=SUM(A1)' → '\\t=SUM(A1)' (D-01 scope — leading tab is intentionally NOT a trigger)", () => {
  expect(sanitizeCsvCell('\t=SUM(A1)')).toBe('\t=SUM(A1)');
});
```

### IN-03: `customerCsv.test.ts` Unicode tests use `codePointAt(0)` but do not assert string length — partial normalization would slip past Test 15

**File:** `src/utils/customerCsv.test.ts:265-281`
**Issue:** Test 15 (`Müller`) asserts `row.customer!.name === 'Müller'` and
`row.customer!.name!.codePointAt(0) === 'Müller'.codePointAt(0)`. The
string-equality check would catch full NFC↔NFD normalization. But if a
hypothetical regression normalized only certain code points (e.g. stripping
a combining diaeresis but leaving the base `u`), the first code point would
still match `u` and the `===` check would pass against a different `'Müller'`
literal source… actually no: `===` is full string equality, so partial
mutation IS caught. This finding is informational only — the existing
assertion set is sufficient.

Test 16 (`张三`) usefully asserts `[...name].length === 2`, locking
surrogate-pair / code-point integrity. Test 15 could borrow the same shape
for symmetry.

**Fix:** Optional — add a length assertion to Test 15 to make the
code-point-integrity intent explicit:

```ts
// 'Müller' in NFC is 6 code points (M, ü, l, l, e, r); NFD would be 7.
expect([...row.customer!.name!].length).toBe(6);
```

### IN-04: `sanitizeCsvCell` accepts non-string input at runtime; signature is `value: string` but no runtime guard

**File:** `src/utils/csvHelpers.ts:443-451`
**Issue:** Mirrors WR-02 but lower-stakes because the only callers are inside
`csvHelpers.ts` itself, all of which feed pre-converted strings (`String(value)`
on line 337). A future contributor importing `sanitizeCsvCell` and feeding it
`null` / `undefined` / a number would either crash (`value.length` /
`charCodeAt` on null/undefined) or get nonsense back (`charCodeAt` on a number
coerces to NaN, the check fails, returns the number — TypeScript won't catch
this if the call site uses `any`).

The export-only-from-`csvHelpers.ts` boundary keeps the risk small. Worth
noting because the helper docstring frames it as a general-purpose sanitizer
("every cell handed to `Papa.unparse` in this file passes through
`sanitizeCsvCell` at the cell-serialization boundary").

**Fix:** Optional defensive guard, matching WR-02's pattern:

```ts
export function sanitizeCsvCell(value: string): string {
  if (typeof value !== 'string' || value.length === 0) return value as string;
  // ... existing logic
}
```

Or leave as-is and rely on the four in-file call sites that already feed
strings.

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
