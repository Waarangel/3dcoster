---
phase: 25-doc-hygiene-polish-bundle-health
reviewed: 2026-05-26T12:39:22Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/components/CustomerLibrary.tsx
  - src/components/CustomerCsvImportModal.tsx
  - src/utils/csvHelpers.ts
  - src/components/JobsManager.tsx
  - src/components/PrintQuoteModal.tsx
  - src/components/ImageCarousel.tsx
  - src/components/JobsManager.test.tsx
  - src/pdf/jspdf-augment.d.ts
  - src/pdf/generateQuotePdf.ts
  - vite.config.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-05-26T12:39:22Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This batch is genuinely narrow — polish, hygiene, type-augmentation, and bundle-chunk
tweaks. No new business logic, no new schema/migration shapes, no public API surface
changes that I could see. Build correctness should hold.

The adversarial pass surfaced one substantive type-safety regression introduced by the
jspdf module augmentation (POL-03): it declares `lastAutoTable` as an unconditional
field on every jsPDF instance, but the field is only present *after* `autoTable()` has
been invoked. The single in-repo consumer is correctly ordered, so there is no live
defect today — but the augmentation lies to TypeScript, neutering the safety the
removal of `(doc as any)` was supposed to buy. Best fixed as a one-character change
(`?:`) before this ships.

The POL-04 overflow-menu outside-click + Escape handler is correctly implemented and
covered by tests. One subtle quality issue: the same `e.stopPropagation()` reasoning
that protects the Convert-to-Sale row from accidental close also lets clicks on
Convert-to-Sale leave the overflow menu open — minor UX nit, not a bug.

The hygiene pass also missed a parallel dead-ref in `PrintQuoteModal.tsx`
(`customerPickerInputRef` declared+assigned but never `.focus()`'d), and a duplicated
Q-NNNN formatter in the same file that should route through `formatQuoteNumber`.
A stale assertion in `JobsManager.test.tsx` (`Add tag via shortcut`) tests a label
that no longer exists in the source — the assertion is dead-positive.

The vite.config.ts `manualChunks` reorder is correctly ordered and the comments
explaining the deviation are excellent. No issues found in chunk routing logic.

## Critical Issues

_None._

## Warnings

### WR-01: jspdf augmentation declares `lastAutoTable` as unconditional, but it is set only after `autoTable()` runs

**File:** `src/pdf/jspdf-augment.d.ts:12`
**Issue:** The augmentation
```ts
declare module 'jspdf' {
  interface jsPDF { lastAutoTable: { finalY: number } }
}
```
makes `lastAutoTable` a required, always-present property on every `jsPDF` instance.
In practice, `jspdf-autotable` only sets this field *after* its first `autoTable(doc, …)`
invocation. A consumer reading `doc.lastAutoTable.finalY` on a freshly constructed
`new jsPDF()` will compile cleanly today but throw `TypeError: Cannot read properties of
undefined (reading 'finalY')` at runtime. The single in-repo consumer
(`generateQuotePdf.ts:161`) is correctly ordered after `autoTable(...)` on line 140, so
the bug is dormant — but POL-03's stated goal was to **replace** an `(doc as any)`
escape hatch with type safety, and an unconditional declaration removes the only
warning TS could have surfaced if someone reordered or added a second consumer.

**Fix:** Mark the field optional so consumers must narrow:
```ts
declare module 'jspdf' {
  interface jsPDF { lastAutoTable?: { finalY: number } }
}
```
Then update `generateQuotePdf.ts:161` to read defensively (the call site already
implicitly assumes `lastAutoTable` exists because `autoTable` ran on line 140 — a
non-null assertion is honest about that ordering invariant):
```ts
return doc.lastAutoTable!.finalY;
```
or equivalently, capture the return value via the autoTable handle (`autoTable` returns
a `UserOptions` shape with `finalY` on the user data) — see jspdf-autotable's own
typings for `previous.finalY`.

### WR-02: `PrintQuoteModal.customerPickerInputRef` declared and bound but never read — same dead-code pattern just removed from JobsManager (IN-06)

**File:** `src/components/PrintQuoteModal.tsx:68, 326`
**Issue:** Phase 25's `JobsManager.tsx:1041-1044` block explicitly removed an identically-named dead ref:
> "previously held a `customerPickerInputRef` here. It was wired to the picker `<Input ref={...}>` but never `.focus()`'d anywhere — pure dead code. Removed entirely."
The same pattern survives unchanged in `PrintQuoteModal.tsx` — `useRef<HTMLInputElement | null>(null)` on line 68, `ref={customerPickerInputRef}` on line 326, and zero `.focus()` calls or `.current` reads anywhere in the file. This is the textbook hygiene cleanup HYG-01/04/05 set out to do, and missing the sibling component looks like a hygiene scope leak.
**Fix:** Either remove the ref entirely (matching the JobsManager IN-06 fix verbatim), or wire an autofocus-on-open `useEffect` if focus-on-open was actually the intent. The mirrored JobsManager comment block already documents the right call.

### WR-03: PrintQuoteModal title duplicates Q-NNNN formatter logic instead of routing through `formatQuoteNumber`

**File:** `src/components/PrintQuoteModal.tsx:308`
**Issue:** The header title inlines
```ts
`Q-${String(editingQuote.quoteNumber).padStart(4, '0')}`
```
This is the exact body of `formatQuoteNumber` (verified at `src/utils/format.ts:2`). The util is *not* imported in this file — but `formatQuoteNumber` is the single source of truth for Q-NNNN rendering and is already used in `JobsManager.tsx`, `generateQuotePdf.ts`, and the test fixtures. If anyone ever changes the Q- format (e.g., to support a 5-digit ceiling), this inline copy will silently diverge. Code duplication of a centralized formatter is a hygiene smell, especially in a phase whose explicit goal is hygiene cleanup.
**Fix:** Import and use the helper:
```ts
import { formatQuoteNumber } from '../utils/format';
// …
{isEdit ? `Edit Quote ${editingQuote ? formatQuoteNumber(editingQuote.quoteNumber) : ''} — ${job.name}` : `Create Quote — ${job.name}`}
```

### WR-04: JobsManager.test.tsx asserts on a `aria-label` that does not exist in the source — assertion is dead-positive

**File:** `src/components/JobsManager.test.tsx:482`
**Issue:**
```ts
expect(gapEContainer.querySelector('button[aria-label="Add tag via shortcut"]')).toBeNull();
```
A repo-wide grep for `Add tag via shortcut` returns ZERO source matches. No element ever has this aria-label. `querySelector` will return `null` regardless of test conditions, so the assertion always passes — it tests nothing. Whatever shortcut affordance was intended to be guarded by this test was either renamed or removed; the assertion is now dead code that gives false test-coverage signal. This is exactly the kind of stale-assert that hygiene phases exist to catch.
**Fix:** Either delete the assertion or update it to the actual current aria-label. Cross-reference test (e) on lines 489-517 already asserts the empty-state Tag-icon affordance (`aria-label="Add tag"`) is the *only* "Add tag"-labeled element when `tags.length === 0` — so this assertion in (d) is likely meant to assert "no tag-add affordance when at the 10-tag cap." If that's the intent, fix it to:
```ts
// At cap, neither the + button nor the empty-state Tag icon should be present.
expect(gapEContainer.querySelectorAll('button[aria-label="Add tag"]')).toHaveLength(0);
```
(Test (d) line 476 already does the equivalent check via `.toBeNull()` on a single-element query. The line-482 assertion is redundant *and* mistargeted — delete it.)

## Info

### IN-01: QuoteRow `<li onClick={(e) => e.stopPropagation()}>` is defensive against a parent click handler that does not exist

**File:** `src/components/JobsManager.tsx:177`
**Issue:** The QuoteRow `<li>` has `onClick={(e) => e.stopPropagation()}`, but the parent JobCard `<div>` (line 419-426) has no onClick handler — and the `<ul>` rendering this row also has none. Defensive `stopPropagation` against a non-existent handler is harmless but contributes to confusion about what the click contract actually is. The pattern persists from when JobCard had a clickable root; consider documenting the invariant or removing if no longer needed.
**Fix:** Either delete the handler or add a comment explaining what future click chain it is guarding against (e.g., "guards future row-level click delegation").

### IN-02: Convert-to-Sale click does not close the overflow menu — minor UX divergence

**File:** `src/components/JobsManager.tsx:193-204`
**Issue:** The Convert-to-Sale Button is a sibling of the overflow toggle inside `overflowRef`. The mousedown outside-click handler (lines 157-160) only closes when the click target is *outside* `overflowRef.current`. So if a user opens the overflow menu (showing Edit Quote / Mark Declined), then clicks Convert-to-Sale, the menu stays open while the conversion modal launches. The conversion modal will overlay the menu, so users won't notice — but in keyboard-nav scenarios with the menu open the focus chain becomes ambiguous.
**Fix:** Either route Convert-to-Sale's onClick through `setOverflowOpen(false)` first, or move Convert-to-Sale *outside* `overflowRef` so outside-click closes the menu when Convert-to-Sale is clicked. Low priority — no user-visible bug, just an a11y nit.

### IN-03: `JobsManager.tsx` `OrdersSection` heading visible even when `OrdersQuoteRows` renders null and `children` is null

**File:** `src/components/JobsManager.tsx:332-366`
**Issue:** `OrdersSection` checks `hasQuotes` based on `visibleQuotes` (filtered via `quoteStatusToPill`), then renders `OrdersQuoteRows` (which performs the same filter independently) and `children`. If `recentSales` is non-empty but contains zero sales for which the child block renders content (e.g., the JobCard render block only iterates `recentSales.slice(0, 5)` — fine for now, but if a downstream change ever conditionally renders zero of N sales), the "Orders" heading would render with no rows beneath. Today this is safe. Mentioned only because the heading-visibility check is duplicated logic between `OrdersSection` and the child `OrdersQuoteRows`.
**Fix:** Consider lifting the visibility check to a single shared computation or passing `visibleQuotes` down as a prop to avoid the duplicated `.filter(q => quoteStatusToPill(q.status) !== null)` walk.

### IN-04: `JobsManager.test.tsx` line 482 comment ("Tag icon (the empty-state affordance) is ALSO hidden") is consistent with test (d) but contradicted by source

**File:** `src/components/JobsManager.test.tsx:480-482`
**Issue:** The comment claims "at the cap, the user removes via ✕ before adding more" — which is correct policy. But the next line then queries `aria-label="Add tag via shortcut"`, a label that does not exist (see WR-04). The comment is correct; the assertion is mistargeted. Mentioned separately from WR-04 because the comment itself is good documentation that just needs the assertion below it to actually test what the comment describes.
**Fix:** Replace the line-482 assertion as suggested in WR-04. The line-480 comment can stay verbatim.

### IN-05: `csvHelpers.parsePositiveNumber` accepts 0 — name is misleading

**File:** `src/utils/csvHelpers.ts:398-403`
**Issue:**
```ts
function parsePositiveNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const num = Number(value.trim());
  if (isNaN(num) || num < 0) return null;
  return num;
}
```
The function returns `0` for input `"0"` — it's actually parsing **non-negative** numbers. Callers that need strict positivity (e.g., `unitsPerPackage` on line 256) have to layer an additional `<= 0` check. This is correctly handled today, but the name primes future callers to skip that extra check. Not in scope of Phase 25's edits, but worth flagging during a hygiene review.
**Fix:** Either rename to `parseNonNegativeNumber` or tighten the body to `num <= 0` (and audit callers — line 217 wattage, line 213 purchase price, etc., all currently rely on the "0 is allowed" semantic for *some* defaults but reject `null`).

---

_Reviewed: 2026-05-26T12:39:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
