---
phase: 07-styling-primitives-pass
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - scripts/lint-no-raw-html.mjs
  - src/components/AssetLibrary.tsx
  - src/components/BambuImport.tsx
  - src/components/CostCalculator.tsx
  - src/components/CsvImportModal.tsx
  - src/components/FilamentSelector.tsx
  - src/components/GcodeImport.tsx
  - src/components/Header.tsx
  - src/components/ImageCarousel.tsx
  - src/components/JobsManager.tsx
  - src/components/MaintenanceAlertModal.tsx
  - src/components/PrinterSettings.tsx
  - src/components/SettingsModal.tsx
  - src/components/UpdateBanner.tsx
  - src/components/UserProfileModal.tsx
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 7 refactored raw HTML form elements across 14 main app components to shared
`Button`/`Input`/`Select` primitives and added a grep-based lint guard wired into
`npm run build` and `pre-commit`. The refactor preserved props verbatim per
decision D-08 and the `AssetLibrary` form-submit semantics (the one `<form>` in
the app) survive intact — every `Button` inside that form carries an explicit
`type="button"` or `type="submit"`, avoiding the documented foot-gun (Pitfall 1).

However, two correctness defects in the lint guard itself put the entire
phase-7 contract at risk:

1. The pre-commit lint script silently breaks on Windows because `EXCLUDE_DIR`
   uses POSIX path separators while `path.join` returns backslash-separated
   paths on Windows — meaning the `src/components/ui/*` primitives (which by
   definition contain raw `<button>`/`<input>`/etc.) are NOT excluded on
   Windows runners and the script will fail every Windows pre-commit / CI
   build.
2. The `allow-raw-html` opt-out match is too loose (`prevLine.includes(...)`),
   accepting any string that contains that substring as a valid opt-out
   (including negations like `// not-allow-raw-html`).

Additionally, several refactored components retain pre-existing debt that this
phase had a chance to address (debug `console.log` left in `CostCalculator`,
inconsistent destructive-action styling in `JobsManager`).

## Critical Issues

### CR-01: Lint script EXCLUDE_DIR fails on Windows path separators

**File:** `scripts/lint-no-raw-html.mjs:12,28`
**Issue:** `EXCLUDE_DIR = 'src/components/ui'` is compared against paths built
with `path.join()`, which on Windows produces `src\components\ui\Button.tsx`.
`file.startsWith('src/components/ui')` returns `false` for the
backslash-separated path, so the primitives directory is NOT excluded on
Windows. The script then scans `ui/Button.tsx`, `ui/Input.tsx`, etc., finds the
raw `<button>`/`<input>`/`<select>`/`<textarea>` elements (no `allow-raw-html`
comments — and adding them would be wrong, because the primitives ARE the
escape hatch), prints them as violations, and exits 1.

Verified behavior:
```
$ node -e "console.log('src\\\\components\\\\ui\\\\Button.tsx'.startsWith('src/components/ui'))"
false
```

This breaks the `pre-commit` hook AND `npm run build` for any developer on
Windows. The project ships a Windows desktop build via Tauri (per
`.claude/CLAUDE.md` § "Desktop App Release Process"), so Windows contributors
are an explicit user. CI is currently Linux/macOS-only per `.github/workflows/`,
which is why the failure was not caught.

**Fix:**
```js
// scripts/lint-no-raw-html.mjs
import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';

const SCAN_DIRS = ['src/components'];
// Build EXCLUDE_DIR with the OS path separator so startsWith works
// on both POSIX and Windows.
const EXCLUDE_DIR = join('src/components', 'ui');
const PATTERN = /<(button|input|select|textarea)([\s>\/]|$)/;
// ... rest unchanged
```

Alternatively, normalize the file path before comparison:
```js
const normalized = file.split(sep).join('/');
if (normalized.startsWith(EXCLUDE_DIR)) continue;
```

### CR-02: Lint opt-out match is substring-based, accepts false-positive markers

**File:** `scripts/lint-no-raw-html.mjs:33`
**Issue:** The opt-out check is `prevLine.includes('allow-raw-html')`. Any
substring containing those characters silently disables the guard. Examples
that should NOT count as opt-outs but currently do:

- `// not-allow-raw-html-here` — negation
- `// TODO: should we allow-raw-html in modals?` — discussion
- `// disallow-raw-html` — opposite intent
- A comment block from an unrelated tool that happens to mention the marker

The intent (per `07-CONTEXT.md` D-04) is "an opt-out comment marker
`// allow-raw-html` on the line above any intentionally-raw element." The
current implementation is permissive in a way that erodes the guard's
correctness over time.

**Fix:** Match a word-boundary token, not a substring:
```js
const ALLOW_RE = /\ballow-raw-html\b/;
// ...
if (!ALLOW_RE.test(prevLine)) {
  violations.push(`${relative('.', file)}:${i + 1}: ${lines[i].trim()}`);
}
```

`\b` ensures `allow-raw-html` is matched as a whole token (so
`not-allow-raw-html` and `disallow-raw-html` no longer match, because the `-`
boundary is on the left side of `allow`).

## Warnings

### WR-01: `console.log` debug statement shipped in CostCalculator auto-select effect

**File:** `src/components/CostCalculator.tsx:215`
**Issue:**
```ts
if (!hasValidSelection) {
  console.log('Auto-selecting printer:', printerInstances[0].id, 'from instances:', printerInstances.map(p => p.id));
  setSelectedInstanceId(printerInstances[0].id);
}
```
Production debug logging fires every time a stored printer ID is invalid OR
the user has no selection yet. This pollutes the browser console on every
fresh visit and on every printer-list change, leaking internal IDs to anyone
inspecting devtools. Per project conventions ("never use arbitrary
numbers ... messaging that conveys no data available"), debug spam is not
appropriate for shipped code.

This is pre-existing code, but Phase 7 touched this file and could have
removed it; either way the next maintenance pass should delete the line.

**Fix:**
```ts
if (!hasValidSelection) {
  setSelectedInstanceId(printerInstances[0].id);
}
```
If observability is genuinely needed, gate behind `import.meta.env.DEV`.

### WR-02: AssetLibrary uses `!formData.purchasePrice` / `!formData.wattage` — rejects zero

**File:** `src/components/AssetLibrary.tsx:218,246`
**Issue:**
```ts
if (!formData.name || !formData.purchasePrice || !formData.wattage) {
  setFormError('Name, purchase price, and wattage are required');
  return;
}
// ...
if (!formData.name || !formData.unit || !formData.packageCost || !formData.unitsPerPackage) {
  setFormError('Name, unit, package cost, and units per package are required');
  return;
}
```
Falsy-coercion validation treats `0` as "missing". A user who genuinely wants
to record a free printer (`purchasePrice = 0`, e.g., a donated unit or a
freebie used purely to track wear), or a wattage of 0 for a tracking placeholder,
will hit a misleading "required" error. Similarly `packageCost = 0` (free
samples) and `unitsPerPackage = 0` (the latter is genuinely invalid but the
error text "required" is wrong — it's a value constraint, not a missing field).

The dedicated check on line 250 (`formData.unitsPerPackage <= 0 → "must be
greater than zero"`) already proves the author knew zero needed handling;
the same logic should apply to other numeric fields with explicit messaging.

This is pre-existing logic (not introduced by Phase 7), but the styling pass
modified surrounding JSX and the validation is now adjacent to the changed
code. Flagged for visibility.

**Fix:**
```ts
if (!formData.name || formData.purchasePrice === undefined || formData.wattage === undefined) {
  setFormError('Name, purchase price, and wattage are required');
  return;
}
if (formData.purchasePrice < 0 || formData.wattage <= 0) {
  setFormError('Purchase price must be ≥ 0 and wattage must be > 0');
  return;
}
```

### WR-03: JobsManager Delete button bypasses `variant="danger"`, inconsistent destructive styling

**File:** `src/components/JobsManager.tsx:489-494`
**Issue:**
```tsx
<Button
  onClick={confirmDeleteJob}
  className="bg-red-600 hover:bg-red-700"
>
  Delete
</Button>
```
The button has no `variant` prop, so it inherits `variant="primary"`
(blue), then overrides via `className` to red. Every other destructive
action in the codebase uses `variant="danger"` (which renders as
`bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30` —
a softer red-on-translucent style). The confirmation modal's primary
destructive button now looks visually different from the inline Delete
buttons elsewhere in the same component (e.g., line 312-318).

Per phase decision D-06 ("accept primitive defaults over preservation,
consistency is the goal") and the milestone's stated purpose ("give every
subsequent feature a consistent component foundation"), this is exactly the
type of one-off override the phase was supposed to eliminate.

**Fix:** Either use `variant="danger"` for consistency with the rest of the
codebase, or add a new `variant="destructive-solid"` to `Button.tsx` if a
solid-red confirmation style is genuinely needed app-wide. Don't override
ad-hoc.

### WR-04: AssetLibrary inline `<button>` tab markers have no rationale comment

**File:** `src/components/AssetLibrary.tsx:393,405`
**Issue:**
```tsx
{/* allow-raw-html */}
<button
  onClick={() => handleFilterChange('all')}
  className={`px-4 py-1 min-h-[40px] text-sm rounded-lg transition-colors ...`}
>
```
The opt-out comments here are bare — no reason given. Every other
`allow-raw-html` comment in the codebase includes a justification (e.g.,
`accent-blue-500 would break under Input base styles (L-4)`,
`hidden file picker — primitive base styles would bleed through hidden`).
These two opt-outs are also questionable on their merits — the styling
(`px-4 py-1 min-h-[40px] text-sm rounded-lg transition-colors` with active
state) is a straightforward `Button` use case with `btnSize="sm"` + custom
className, identical to the filter buttons in `SettingsModal.tsx:180` which
also opted out for tab semantics.

If the intent is "tab buttons need raw `<button>` because Button primitive
forces a min-h-[36px]/[44px] etc.", say so explicitly. Without rationale,
a future maintainer can't tell whether to refactor or leave it.

**Fix:** Either add a justification comment (`{/* allow-raw-html: filter
tab — Button primitive's min-h conflicts with tab-bar 40px target */}`)
or refactor to `Button` if a viable variant exists.

### WR-05: AssetLibrary `searchedAssets` recomputes `getCategoryLabel(a.category)` per row, per keystroke

**File:** `src/components/AssetLibrary.tsx:104-115`
**Issue:** Not a correctness bug, but flagged because the styling pass left
the inline search fully un-debounced. Every keystroke in the search input
runs `displayAssets.filter(a => …getCategoryLabel(a.category)…)`, which for
a typical 50–200-asset library is fine, but for users with imported
libraries of 1000+ filaments (likely after a CSV mass-import) this fires
synchronously on every render.

The performance-out-of-scope clause in the review charter excludes O(n²)
algorithms, so this is borderline. Flagging because the search-on-keystroke
pattern is a readability/correctness concern: the filter doesn't reset
`currentPage` consistently when the result count shrinks below the current
page, which can show an empty page until the user clicks. Confirmed at
line 426: `onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}`
DOES reset to page 1, so this is fine. **Withdrawing this as a finding** —
behavior is correct.

(Left in the report as a transparency note rather than deleted: the review
caught and dismissed the false positive.)

## Info

### IN-01: `MaintenanceAlertModal` Escape-listener cleanup only registered when modal is open

**File:** `src/components/MaintenanceAlertModal.tsx:21-25`
**Issue:**
```ts
if (alert !== null) {
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}
```
The cleanup function is only returned inside the `if`. When `alert === null`,
the effect runs to completion with no cleanup. This is correct behavior
(no listener was registered, so no cleanup needed), but the pattern is
fragile — a future refactor that pulls the `addEventListener` outside the
`if` will silently leak listeners. The `SettingsModal.tsx:62-65` and
`UserProfileModal.tsx:30-33` use the same fragile shape.

**Fix:** Move the listener registration inside the effect unconditionally
and gate on `alert !== null` inside the handler, OR use the conventional:
```ts
useEffect(() => {
  if (alert === null) return;
  const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [alert, onDismiss]);
```
This makes the cleanup obviously paired with the registration.

### IN-02: `JobsManager._getPrinterName` is dead code preserved with `void`

**File:** `src/components/JobsManager.tsx:185-191`
**Issue:**
```ts
const _getPrinterName = (printerInstanceId: string) => { /* ... */ };
void _getPrinterName; // Silence unused warning
```
Helper function kept "for potential future use" via the `void` escape
hatch. This violates the project rule "never use arbitrary numbers / if
data isn't there, say so" by analogy: dead code with a `void` silencer is
worse than no code, because the next reader assumes intent that doesn't
exist.

**Fix:** Delete `_getPrinterName` and the `void` line. If a future feature
needs it, recover it from git history. Speculative scaffolding is debt.

### IN-03: `UpdateBanner.compareVersions` silently misbehaves on >3-segment versions

**File:** `src/components/UpdateBanner.tsx:14-23`
**Issue:**
```ts
for (let i = 0; i < 3; i++) {
  if (latestParts[i] > currentParts[i]) return true;
  if (latestParts[i] < currentParts[i]) return false;
}
return false;
```
Hard-coded `i < 3` ignores any 4th+ segment (e.g., `1.3.1.1` vs `1.3.1.2`).
If the project ever ships a build-suffix tag (`v1.3.1+build5` → split
yields `['1', '3', '1+build5']`, parsed via `Number` → `[1, 3, NaN]`),
the comparison silently returns `false` on the NaN comparisons (`NaN > N`
and `NaN < N` are both false). Result: a real update is missed.

This is pre-existing; flagged because Phase 7 touched this file. Out of
strict scope, but the project's "act like a senior developer" stance argues
for surfacing it.

**Fix:** Use a battle-tested semver compare or:
```ts
function compareVersions(current: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const c = parse(current), l = parse(latest);
  const len = Math.max(c.length, l.length);
  for (let i = 0; i < len; i++) {
    const cv = c[i] ?? 0, lv = l[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}
```

### IN-04: `FilamentSelector` hover-submenu `setTimeout` cleanup missing on unmount

**File:** `src/components/FilamentSelector.tsx:31,71-87`
**Issue:**
```ts
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
// ...
const handleBrandMouseLeave = () => {
  timeoutRef.current = setTimeout(() => { setHoveredBrand(null); }, 200);
};
```
The setTimeout is cleared in `handleBrandMouseEnter` / `handleSubMenuMouseEnter`,
but if the component unmounts while a timeout is pending, the callback fires
on an unmounted component, attempting `setHoveredBrand(null)` and triggering
React's "can't update state on unmounted component" warning (silenced in
React 18+, but still incorrect).

**Fix:** Add an unmount cleanup effect:
```ts
useEffect(() => {
  return () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };
}, []);
```

---

## Phase-Specific Verification

**Form-submit semantics in `AssetLibrary.tsx` (the only `<form>` in the app):**
all six `Button` elements inside the `<form>` (lines 444–680) carry explicit
`type` props — `type="submit"` only on the Add/Update action (l.669), and
`type="button"` on the Cancel-custom-category (l.474), `+ New` (l.494),
Add-tag (l.639), Remove-tag (l.655), and Cancel (l.673). The documented
foot-gun (Pitfall 1: Button has no default type, defaults to "submit"
inside a form) is correctly avoided. The Enter-to-submit behavior is
preserved (Tag input at l.634 explicitly `e.preventDefault()`s Enter
before calling `addTag()`, so Enter on tag input does not submit the form;
Enter on every other field DOES submit, matching HTML-default form UX).

**`// allow-raw-html` opt-outs:** all 12 instances were located and reviewed.
Most include a justification (e.g., "accent-blue-500 would break under
Input base styles", "hidden file picker"). Two in `AssetLibrary.tsx`
(l.393, l.405) lack justification — see WR-04.

**Prop preservation per D-08:** spot-checked `Input`/`Select` replacements
in `SettingsModal.tsx` (the heaviest file). All `value`, `onChange`,
`step`, `min`, `max`, `placeholder`, `disabled`, and `required` props
are passed through verbatim.

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
