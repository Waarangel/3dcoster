---
phase: 19-modal-primitive-a11y-migration
reviewed: 2026-05-26T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - src/components/ui/Modal.tsx
  - src/components/ui/Modal.test.tsx
  - src/components/ui/index.ts
  - src/components/ui/Input.tsx
  - src/components/ui/Textarea.tsx
  - src/components/ui/Select.tsx
  - src/components/ui/auto-id.test.tsx
  - src/components/ui/InfoTooltip.tsx
  - src/components/ui/InfoTooltip.test.tsx
  - src/components/ui/CollapsibleSection.tsx
  - src/components/ui/CollapsibleSection.test.ts
  - src/components/PrintQuoteModal.tsx
  - src/components/PrintQuoteModal.test.tsx
  - src/components/SettingsModal.tsx
  - src/components/UserProfileModal.tsx
  - src/components/CustomerEditModal.tsx
  - src/components/MaintenanceAlertModal.tsx
  - src/components/CustomerCsvImportModal.tsx
  - src/components/DeclineQuoteModal.tsx
  - src/components/DeclineQuoteModal.test.tsx
  - src/components/CsvImportModal.tsx
  - src/components/JobsManager.tsx
  - src/components/CustomerLibrary.tsx
  - src/components/AssetLibrary.tsx
findings:
  critical: 4
  warning: 8
  info: 5
  total: 17
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-05-26
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 19 ships a respectable `Modal` primitive that captures the core WAI-ARIA dialog
contract (role="dialog", aria-modal, aria-labelledby, focus trap, scroll-lock, Escape +
backdrop close, single-modal dev guard) and consistently migrates 10+ modal surfaces.
The `useId()` auto-id work on Input/Textarea/Select and the InfoTooltip /
CollapsibleSection id collision fixes are correct and well-tested.

That said, the migration introduced four genuine correctness defects in the primitive
itself and one regression in `JobsManager` that the test surface does not catch:

1. **Focus trap escapes** when focus rests on a non-focusable element inside the
   dialog (including the card itself via its tabIndex=-1 fallback) — Tab/Shift+Tab
   compare `document.activeElement` against `first` / `last` and silently fall
   through to native browser tab order, letting focus leave the dialog.
2. **`isAnyModalOpen` module-level boolean is monotonically reset to `false` by
   any Modal's cleanup**, so two real overlapping Modals leave the flag wrong
   (and test 6 in `Modal.test.tsx` proves the corrupt state but doesn't assert on it).
3. **Focus restoration leaks** under React StrictMode dev double-invoke and on
   close-without-prior-focus.
4. **JobsManager's Record Sale customer picker Escape handler stopped calling
   `e.stopPropagation()`** (still does in `PrintQuoteModal`), so pressing Escape
   on the picker now closes the parent `Modal` along with the dropdown — a
   regression introduced when the inline overlay was migrated to the Modal primitive.
5. **`AssetLibrary` virtualized desktop tables put `<List role="list">` between
   `<div role="grid">` and its `role="row"` children**, breaking the grid → row →
   cell ARIA hierarchy. `aria-rowcount` is also placed on the inner `role="list"`,
   which is not a valid attribute for `list`.

Tests should be considered partially diagnostic, not exhaustive — Modal's "no
focusable descendants" fallback path is explicitly skipped (commented as such in
`Modal.test.tsx:185-211`), the focus-trap-escape case is not modeled at all,
and the single-modal flag's reset-correctness is not asserted.

---

## Critical Issues

### CR-01: Modal focus trap can be escaped via Tab from a non-focusable element

**File:** `src/components/ui/Modal.tsx:120-143`
**Issue:**
The Tab/Shift+Tab handler only preventDefaults when `document.activeElement === first`
(or `=== last` on Shift+Tab). If `activeElement` is any other element — including the
dialog card itself (which has `tabIndex={-1}` and IS focused by the empty-children
fallback at line 106), a tooltip span, a non-focusable `<div>` clicked by the user,
or `document.body` after focus was lost — Tab is not preventDefaulted and the browser's
default tab order moves focus to the next focusable element outside the dialog.

Sequence to reproduce:
1. Open `MaintenanceAlertModal` (no focusable children except the Close button).
2. Click the modal card's body region (`<div role="dialog" tabIndex={-1}>`).
   `document.activeElement` is now the card (or `document.body` if click landed on a
   non-focusable child like the `<p>` paragraph).
3. Press Tab. `activeElement` is neither `first` (Close) nor `last` (Got it). The
   handler returns without preventDefault. Native tab order advances focus to the
   first focusable element AFTER the portal in DOM order — i.e., somewhere on the
   page outside the dialog.

WAI-ARIA dialog modal contract is that focus MUST stay within the dialog while open.
This is the foundational guarantee a focus trap exists to provide.

**Fix:**
After re-querying the focusable list, also check whether the current `activeElement`
is contained by the card. If not (or if it's the card itself), reset focus to `first`
on Tab and to `last` on Shift+Tab.

```tsx
if (e.key === 'Tab') {
  const card = cardRef.current;
  if (!card) return;
  const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  if (focusable.length === 0) {
    // No focusable children — keep focus on the card itself.
    e.preventDefault();
    card.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const activeIsInsideFocusableList = active instanceof HTMLElement && focusable.includes(active);

  if (e.shiftKey) {
    if (!activeIsInsideFocusableList || active === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (!activeIsInsideFocusableList || active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
```

---

### CR-02: `isAnyModalOpen` flag is corrupted when two Modals overlap

**File:** `src/components/ui/Modal.tsx:60, 89, 164`
**Issue:**
The module-level `isAnyModalOpen` boolean is set to `true` on every mount and
unconditionally reset to `false` on every unmount cleanup. When two `Modal`
instances are open at the same time (which the warning at line 84-88 explicitly
acknowledges can happen — it just warns rather than preventing), the cleanup
that runs when the SECOND modal closes flips the flag to `false` even though the
first modal is still mounted. Subsequent modals will then not produce the warning
even when they truly should.

`Modal.test.tsx:380-411` ("warns when a second Modal opens while one is already
open") proves the flag can reach the "two modals open" state, but never asserts
what happens when one of them closes. The test's `afterEach` resets module
state by reloading the file context, masking this bug between tests.

In production this also means the `isAnyModalOpen` check at line 84 cannot be
trusted as a runtime invariant — it's an unreliable counter masquerading as a
guard.

**Fix:**
Replace the boolean with a numeric counter so concurrent modals are tracked correctly:

```tsx
// Module-level guard — count of currently-mounted, open Modals.
let openModalCount = 0;

// In the effect:
if (openModalCount > 0 && process.env.NODE_ENV !== 'production') {
  console.warn(
    '[Modal] A second Modal mounted while one is already open. This project enforces single-modal-only.',
  );
}
openModalCount += 1;

// In cleanup:
openModalCount = Math.max(0, openModalCount - 1);
```

A counter also gracefully handles React StrictMode's double mount in dev (see CR-03)
— the spurious dev cleanup decrements then the re-mount increments, so the final
state is correct.

---

### CR-03: Focus restoration is unstable under React 18 StrictMode

**File:** `src/components/ui/Modal.tsx:96, 156-162`
**Issue:**
In React 18 dev StrictMode, every `useEffect` runs `setup → cleanup → setup` on the
initial mount. With the current capture-on-mount pattern:

1. First setup: `previouslyFocused = document.activeElement` (e.g., the button that opened the modal).
2. First cleanup runs immediately (StrictMode): restores focus to `previouslyFocused`,
   sets `isAnyModalOpen = false`, restores body overflow.
3. Second setup: `previouslyFocused = document.activeElement` — but at this moment
   the FIRST setup may have already advanced focus into the dialog via
   `setTimeout(focusFirst, 0)` if the timer fired between the two effect invocations
   (in jsdom/Vitest with fake timers this is deterministic; in real browsers it's a
   race window). So `previouslyFocused` may now be a focusable inside the dialog
   that's about to be torn down. On real close, focus restores to a now-unmounted
   element, falling back to `document.body`.

Additionally, when `isOpen=true` is the initial render with no prior interaction
(e.g., a deep-link or auto-opened modal), `document.activeElement` is `document.body`.
The current code captures `body` as `previouslyFocused`, then on close calls
`body.focus()`. Setting focus to `<body>` is benign but a wasted call; more
problematic, the check `document.body.contains(previouslyFocused)` is always true
for `body` itself, so the restore unconditionally runs.

**Fix:**
1. Skip restoration when `previouslyFocused` is `document.body` (i.e., there was no
   meaningful prior focus to restore to).
2. Skip restoration when the captured element is inside the about-to-unmount dialog
   (covers the StrictMode race).

```tsx
const previouslyFocused = document.activeElement as HTMLElement | null;
const shouldRestore =
  previouslyFocused &&
  previouslyFocused !== document.body &&
  previouslyFocused instanceof HTMLElement;

// In cleanup:
if (
  shouldRestore &&
  document.body.contains(previouslyFocused) &&
  !cardRef.current?.contains(previouslyFocused)  // ← Strict-mode race guard
) {
  previouslyFocused.focus();
}
```

The card-contains check is cheap because `cardRef.current` is still defined at
cleanup time (the ref is cleared after cleanup runs).

---

### CR-04: JobsManager picker Escape now closes the entire Sale Modal

**File:** `src/components/JobsManager.tsx:1327-1331`
**Issue:**
Before Phase 19, the Record Sale form was an inline overlay — Escape on the
combobox picker just closed the dropdown because no parent listener was in play.
Phase 19 plan 05 migrated the overlay to the `Modal` primitive, which adds a
**document-level** `keydown` listener that closes the modal on Escape.

The PrintQuoteModal picker (`src/components/PrintQuoteModal.tsx:162-167`) was
correctly updated to call `e.stopPropagation()` so the Modal's listener never
sees the Escape event:

```tsx
} else if (e.key === 'Escape') {
  if (customerPickerOpen) {
    e.preventDefault();
    e.stopPropagation();  // don't bubble to the modal's Esc-close handler
    setCustomerPickerOpen(false);
  }
}
```

The JobsManager picker handler at line 1327-1331 was NOT updated:

```tsx
} else if (e.key === 'Escape') {
  if (customerPickerOpen) {
    e.preventDefault();
    setCustomerPickerOpen(false);
    // ❌ missing e.stopPropagation()
  }
}
```

Because React 18 delegates events at the React root (below `document`), and
`Modal.tsx` attaches its keydown listener directly to `document`, the native
event continues bubbling after the React synthetic handler runs. The Modal sees
Escape and invokes `onClose` → `resetSaleForm()` — losing the user's in-progress
sale entry every time they press Escape to dismiss the picker.

This is a real user-facing regression and is not covered by any test (no
JobsManager Modal-integration test exists; the existing `JobsManager.test.tsx`
focuses on JobCard/quotes plumbing).

**Fix:**
Mirror the PrintQuoteModal pattern verbatim:

```tsx
} else if (e.key === 'Escape') {
  if (customerPickerOpen) {
    e.preventDefault();
    e.stopPropagation();  // prevent the surrounding Modal's escape-close
    setCustomerPickerOpen(false);
  }
}
```

Long-term, consider exposing a Modal-level `onKeyDown` prop or a stopEscapeBubble
helper so consumers don't need to remember this incantation per-picker.

---

## Warnings

### WR-01: AssetLibrary nests `<List role="list">` inside `<div role="grid">`, breaking ARIA hierarchy

**File:** `src/components/AssetLibrary.tsx:1190-1219, 1223-1252`
**Issue:**
The Phase 19-06 migration added `role="list"` and `aria-rowcount` to the virtualized
`<List>` used in BOTH the printer and material desktop tables. Those Lists are
rendered as direct children of `<div role="grid" aria-rowcount={...}>`:

```tsx
<div role="grid" aria-rowcount={paginatedAssets.length + 1}>
  <div role="row">{/* header */}</div>
  {effectiveItemsPerPage > 50 ? (
    <List role="list" aria-rowcount={paginatedAssets.length} ... />  // ❌
  ) : (
    <div>{paginatedAssets.map(... <PrinterRow role="row" ... />)}</div>
  )}
</div>
```

This creates two ARIA problems:

1. **Grid → list → row is not a valid containment chain.** A `grid` expects `row`
   children (or `rowgroup` wrappers). Inserting `role="list"` breaks the screen
   reader's ability to enumerate grid rows. NVDA and JAWS will likely announce
   the grid header + the "list" but lose the rows entirely, or announce mismatched
   counts.

2. **`aria-rowcount` is not a valid attribute on `role="list"`.** Per the WAI-ARIA
   1.2 spec, `aria-rowcount` is only supported on `grid`, `table`, and `treegrid`.
   On a `list` it is silently ignored.

The same `aria-rowcount`-on-list issue is present in `CustomerLibrary.tsx:275-284`
and `JobsManager.tsx:1750-1760`, though those don't have the nesting-inside-grid
issue because they're standalone lists.

**Fix:**
For AssetLibrary's desktop tables (which are semantically grids), the inner List
should use `role="rowgroup"` and DROP `aria-rowcount` (the outer grid already
exposes that):

```tsx
<List
  role="rowgroup"
  rowComponent={PrinterRowAdapter}
  ...
/>
```

For the CustomerLibrary and JobsManager lists (which ARE semantically lists),
keep `role="list"` but drop `aria-rowcount` — `aria-setsize` on each `listitem`
is the spec-correct way to convey total count if needed, but most screen readers
report list length without explicit annotation.

---

### WR-02: Modal first-focus lands on the X (Close) button, not the first interactive content

**File:** `src/components/ui/Modal.tsx:99-108, 191-200`
**Issue:**
The FOCUSABLE_SELECTOR list is queried over the entire card, and the Close button
in the header is ALWAYS the first focusable descendant. This means EVERY modal
opens with focus on the Close button, so a user pressing Enter immediately
closes the modal — counter to the WAI-ARIA APG dialog example, which advises
focusing the first meaningful interactive control (e.g., the first form field,
or a primary action when there's no input to fill).

The test `Modal.test.tsx:162-183` ("focuses the first focusable descendant on
mount (Close button is first)") explicitly locks in this behavior with an
expect-assertion, so this is intentional — but it produces a worse-than-default
UX for every form-bearing modal (CustomerEditModal, PrintQuoteModal, SettingsModal,
etc., where the user expects to start typing into the first field).

**Fix:**
Add an opt-in `initialFocusRef` (or `initialFocusSelector` string) prop:

```tsx
export interface ModalProps {
  ...
  initialFocusRef?: React.RefObject<HTMLElement>;
}

// In focusFirst:
const focusFirst = () => {
  const card = cardRef.current;
  if (!card) return;
  if (initialFocusRef?.current && card.contains(initialFocusRef.current)) {
    initialFocusRef.current.focus();
    return;
  }
  const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  // Skip the Close button (first in DOM order) when other focusable descendants exist.
  const target = focusable.find(el => el.getAttribute('aria-label') !== 'Close') ?? focusable[0];
  if (target) target.focus();
  else card.focus();
};
```

Defaulting to "skip Close if other focusables exist" gives every existing consumer
a better default without requiring code changes.

---

### WR-03: Modal "no focusable descendants" fallback is not tested

**File:** `src/components/ui/Modal.tsx:106` ; `src/components/ui/Modal.test.tsx:185-211`
**Issue:**
Modal.tsx line 106 implements `card.focus()` as the fallback when there are no
focusable descendants, relying on the dialog card's `tabIndex={-1}` to make it
programmatically focusable. The test claiming to cover this path
(`Modal.test.tsx:185-211`) has an explicit code comment admitting it can't actually
trigger the fallback because the Close button is always present:

> // This tests the tabIndex={-1} fallback on the card itself.
> // We need a scenario with zero focusable descendants — we achieve this
> // by disabling the Close button. Since we can't remove it from the outside,
> // we verify the fallback by directly calling focus() on the card after
> // clearing all focusable items. Instead, we test the tabIndex attribute
> // which enables programmatic focus on the card element.

This means the `else { card.focus(); }` branch is uncovered by automated tests. If
a future refactor renames the close-button selector or breaks the FOCUSABLE_SELECTOR
list, the test will continue to pass while focus silently lands on `<body>`.

**Fix:**
Either remove the misleading test (and document the impossibility), or restructure
Modal to make this testable. The simplest approach is to extract the focus-first
logic into an exported helper:

```tsx
export function findInitialFocusTarget(card: HTMLElement): HTMLElement {
  const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return focusable[0] ?? card;
}
```

…and then test it directly with a card that has no focusable children.

---

### WR-04: CustomerCsvImportModal / CsvImportModal embed an interactive Back button inside the dialog heading

**File:** `src/components/CustomerCsvImportModal.tsx:172-189` ; `src/components/CsvImportModal.tsx:139-155`
**Issue:**
The `title` prop passed to `Modal` is a ReactNode that, in preview step, includes a
ghost `<Button>` for "Back to upload":

```tsx
const title = (
  <span className="flex items-center gap-3">
    {step === 'preview' && (
      <Button ... aria-label="Back to upload">…</Button>
    )}
    {step === 'upload' ? 'Import customers from CSV' : 'Preview customer import'}
  </span>
);
```

Modal renders this inside `<h3 id={titleId}>`, which means `aria-labelledby` on the
dialog references a heading that contains a button. Two consequences:

1. **HTML semantics:** flow content (buttons) inside headings is permitted by HTML5
   but discouraged because screen readers vary in how they announce the heading's
   accessible name. NVDA tends to read the button's accessible name as part of the
   heading; JAWS sometimes skips it entirely.
2. **Accessible name pollution:** the dialog's accessible name (via
   `aria-labelledby={titleId}`) now includes "Back to upload" plus the actual
   page title — users hear "Back to upload Preview customer import dialog" or similar.

**Fix:**
Move the Back button OUT of the title prop and into a body slot. Either:

(a) Render the Back button inside the body's first row (above the preview content), or
(b) Extend Modal's API with a `headerLeft?: ReactNode` prop that renders alongside
    but outside the `<h3>` (similar to how the Close button is already structurally
    separate from the title).

Option (b) is cleaner — the Close button already lives outside the `<h3>`; a
symmetric `headerLeft` slot would naturally accept the Back button.

---

### WR-05: `process.env.NODE_ENV` is used in client code without Vite import.meta.env guard

**File:** `src/components/ui/Modal.tsx:84`
**Issue:**
```tsx
if (isAnyModalOpen && process.env.NODE_ENV !== 'production') {
```

Vite does provide `process.env.NODE_ENV` via its `define` config for compatibility,
but the canonical Vite pattern is `import.meta.env.MODE !== 'production'` or
`import.meta.env.DEV`. If a future Vite or build-tool change drops the
`process.env` shim, this check will throw `ReferenceError: process is not defined`
in production at the worst possible moment — when a developer opens DevTools
and triggers a code path that touches this branch.

Notice also that `__IS_TAURI__` is documented in CLAUDE.md as the canonical
environment-detection global for this project; mixing `process.env.NODE_ENV` here
adds inconsistency.

**Fix:**
```tsx
if (isAnyModalOpen && import.meta.env.DEV) {
  console.warn(...);
}
```

`import.meta.env.DEV` is a hard-coded boolean Vite replaces at build time; no
shim required.

---

### WR-06: PrintQuoteModal's edit-mode title interpolation can render trailing whitespace + dash when quoteNumber is undefined

**File:** `src/components/PrintQuoteModal.tsx:286-288`
**Issue:**
```tsx
const modalTitle = isEdit
  ? `Edit Quote ${editingQuote ? `Q-${String(editingQuote.quoteNumber).padStart(4, '0')}` : ''} — ${job.name}`
  : `Create Quote — ${job.name}`;
```

`isEdit` is `editingQuote !== undefined`, but the inner ternary `editingQuote ? ... : ''`
defends against `editingQuote` being undefined again — meaning the author was
worried about a state where `isEdit === true` but `editingQuote === undefined`.
That case is impossible by construction (they're derived from the same prop), so
the dead inner ternary indicates either:

1. The author wasn't sure of the invariant (a code smell).
2. There's a subtle race where `editingQuote` could become undefined between the
   isEdit derivation and the title render — but since both are computed in the
   same render pass from the same prop, this isn't possible in React.

More substantively: `String(editingQuote.quoteNumber)` will produce `"undefined"` if
`quoteNumber` is somehow undefined on the Quote (legacy / corrupted data), giving
a title of "Edit Quote Q-undefined — JobName". The padStart wouldn't crash but the
output is wrong.

**Fix:**
Drop the dead ternary and add a defensive guard on quoteNumber:

```tsx
const modalTitle = editingQuote
  ? `Edit Quote ${formatQuoteNumber(editingQuote.quoteNumber)} — ${job.name}`
  : `Create Quote — ${job.name}`;
```

…using the existing `formatQuoteNumber` helper (already imported at line 12 of
DeclineQuoteModal). It handles missing/null quoteNumber correctly.

---

### WR-07: Modal Group 6 single-modal-warn test relies on module-level state from prior tests

**File:** `src/components/ui/Modal.test.tsx:380-411`
**Issue:**
The test mounts two modals via two `createRoot` instances in the same test, then
unmounts only the second (rootB). The first modal is still mounted at test end.
The `afterEach` then unmounts the shared `root`, which triggers the first modal's
cleanup. But because `isAnyModalOpen` is a module-level boolean shared across tests,
and Vitest does NOT reset module state between tests in the same file (unless
`vi.resetModules()` is called), any out-of-order cleanup leaves the flag in a
non-deterministic state for the next test run.

In practice it works because the afterEach manually resets `document.body.style.overflow`
and the warn happens during the test body itself (before any cleanup). But the test
neither asserts the post-cleanup state of `isAnyModalOpen` (which it can't access)
nor protects against state bleed.

If CR-02 is fixed by switching to a counter, this test should ALSO assert that
opening a third modal after closing one of the two still produces a warning — that's
the real invariant being tested.

**Fix:**
After CR-02's counter refactor, add a third leg:

```tsx
// ... existing setup ...
// Close the SECOND modal; first is still open.
await act(async () => { rootB.unmount(); });

// Open a THIRD modal in a new root.
const containerC = document.createElement('div');
document.body.appendChild(containerC);
const rootC = createRoot(containerC);
await act(async () => {
  rootC.render(<Modal isOpen={true} ... title="Third"><span/></Modal>);
});

// Third opening should ALSO produce a warning (one modal — the first — is still open).
expect(warnSpy).toHaveBeenCalledTimes(2);
```

---

### WR-08: CustomerEditModal's hydration useEffect keyed only on `initialCustomer?.id` misses non-id field changes

**File:** `src/components/CustomerEditModal.tsx:29-46`
**Issue:**
```tsx
useEffect(() => {
  if (initialCustomer) { ... setName(initialCustomer.name ?? ''); ... }
  else { ... }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [initialCustomer?.id]);
```

If a parent updates the same Customer in place (e.g. a refresh from Dexie that
returns a new object with the same id but a freshly-edited `notes` field), this
useEffect won't re-run, leaving the form showing stale values. The
`react-hooks/exhaustive-deps` lint disable hides the fact that `initialCustomer`
itself is the actual semantic dependency.

Today the only flow that opens this modal is "click Edit on a CustomerLibrary
row", and the parent immediately renders the modal once. So in practice the
modal never sees an updated `initialCustomer` mid-lifecycle. But the lock-in
relies on a fragile parent invariant.

**Fix:**
Either expand the dep array to `[initialCustomer]` (accepting that this re-hydrates
the form on every parent re-render, which may overwrite user edits — bad), or
hash the relevant fields:

```tsx
useEffect(() => {
  // ...
}, [
  initialCustomer?.id,
  initialCustomer?.name,
  initialCustomer?.email,
  initialCustomer?.company,
  initialCustomer?.address,
  initialCustomer?.notes,
]);
```

This still won't re-hydrate while the user is actively editing (because the
parent doesn't pass updated `initialCustomer` while the modal is open in normal
flows), but it documents the actual dependency and removes the lint suppression.

A cleaner pattern: gate hydration on the `isOpen` transition (false→true) instead
of `initialCustomer.id` changes. Hydration on open is the contract this modal
actually has.

---

## Info

### IN-01: `Modal.test.tsx` declares a local `type ModalProps` AFTER it's used

**File:** `src/components/ui/Modal.test.tsx:419-456`
**Issue:**
At line 420, `Array<[ModalProps['size'], string]>` references `ModalProps`. The
type alias is declared at line 453 (after the describe block that uses it). This
works because TypeScript hoists type declarations, but the placement is confusing
and looks like leftover scaffolding. Worse, this local `ModalProps` shadows the
real exported `ModalProps` from `Modal.tsx`, so a future divergence (e.g.,
adding a new `size` value to the real type) won't break this test.

**Fix:**
Import the real type at the top of the test file:

```tsx
import { Modal, type ModalProps } from './Modal';
```

…and delete the bottom-of-file local declaration.

---

### IN-02: SettingsModal's labels are not connected to their Inputs via htmlFor/id

**File:** `src/components/SettingsModal.tsx:198, 215, 236, 262, 310, 322, 332, ...`
**Issue:**
Phase 19-04 reviewed CustomerEdit and Phase 19-05 reviewed Record Sale, but
SettingsModal's many `<label>` elements still lack `htmlFor`. Input's auto-id
generates a unique id for each input, but with no `htmlFor`, screen readers
won't associate the label with the field. Each input ends up with no accessible
name (or an auto-name derived from placeholder, which varies by AT).

This is pre-existing (not a Phase 19 regression), but plan 19-02 introduced
Input/Textarea/Select auto-ids specifically so this kind of pairing would be
cheap. Following through here would unlock 20+ a11y improvements in one of the
most-used modals.

**Fix:**
For each `<label>…<Input ... /></label>` pair (or sibling pattern), thread a
`useId()` through:

```tsx
const costPerKwhId = useId();
// ...
<label htmlFor={costPerKwhId} className="..."><span>Cost per kWh ({currencySymbol})</span><InfoTooltip ... /></label>
<Input id={costPerKwhId} type="number" ... />
```

Out of strict Phase 19 scope but a cheap follow-on — mention in Phase 20 plan.

---

### IN-03: `CollapsibleSection.test.ts` (not `.tsx`) uses `React.createElement` everywhere

**File:** `src/components/ui/CollapsibleSection.test.ts`
**Issue:**
Vitest tolerates this — but mixing `.test.ts` and `.test.tsx` in the same
directory is a style inconsistency, and the `React.createElement` calls are
verbose compared to JSX. Other test files in the same directory (`Modal.test.tsx`,
`InfoTooltip.test.tsx`, `auto-id.test.tsx`) all use `.tsx`.

**Fix:**
Rename to `CollapsibleSection.test.tsx` and rewrite the calls with JSX:

```tsx
const html = renderToStaticMarkup(
  <CollapsibleSection title="Customer">
    <div>body content</div>
  </CollapsibleSection>
);
```

Cosmetic; no behavior change.

---

### IN-04: `JobsManager.tsx:1854` static `customer-picker-input` id collides if two pickers ever rendered simultaneously

**File:** `src/components/JobsManager.tsx:1854, 1858, 1862, 1887`
**Issue:**
The Record Sale modal uses hardcoded ids: `customer-picker-input`,
`customer-picker-listbox`, `customer-option-${c.id}`. Today only one
`JobsManager` is mounted per route AND the Modal primitive enforces
single-modal-open, so these strings cannot collide.

If a future feature renders two `JobsManager` instances on the same page (e.g.,
split-view dashboard), the ids would collide and aria-controls / aria-activedescendant
would break.

**Fix:**
Replace with `useId()` (same pattern as CustomerEditModal lines 21-25):

```tsx
const pickerInputId = useId();
const pickerListboxId = useId();
const optionIdPrefix = useId();
// ...
<Input id={pickerInputId} aria-controls={pickerListboxId} ... />
<div role="listbox" id={pickerListboxId}>
  {visibleCustomers.map((c, i) => (
    <button id={`${optionIdPrefix}-${c.id}`} ... />
  ))}
</div>
```

PrintQuoteModal's `print-quote-*` static ids have the same theoretical issue
but the modal is even less likely to be doubled.

---

### IN-05: MaintenanceAlertModal's title has a decorative SVG sized w-6 (24px) while every other Modal title's SVG is w-5 (20px)

**File:** `src/components/MaintenanceAlertModal.tsx:22-35` vs `SettingsModal.tsx:162-165`
**Issue:**
Title-line SVGs in `SettingsModal` are `w-5 h-5`, while `MaintenanceAlertModal`
uses `w-6 h-6` and `text-amber-400` (vs slate). This is a deliberate styling
choice (amber alert color) but the size discrepancy causes the modal header's
vertical padding to grow by ~4px in the maintenance case, breaking visual
consistency across modal headers.

**Fix:**
Either normalize on `w-5 h-5` for all title icons, or document the intentional
exception in a comment.

---

_Reviewed: 2026-05-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
