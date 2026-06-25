# Phase 35: Accessibility Tier 4 — Research

**Researched:** 2026-06-25
**Domain:** WCAG 2.x ARIA remediation — React 18 + Vitest + jsdom
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Tag chip hit target (A11Y-14):** 24×24px minimum via padding/hit-area enlargement; visual
  glyph stays subtle at rest, revealed on hover/focus. Keyboard must work at all times even
  when `opacity-0`. Not adopting AAA 44×44.
- **Settings tabs (A11Y-10):** WAI-ARIA APG Tabs pattern — roving tabindex + arrow-key nav
  (Left/Right, Home/End). Research pins the exact implementation details.
- **Form errors (A11Y-11):** `role="alert"` on the error container; `aria-invalid="true"` +
  `aria-describedby` on the failing input pointing at the error text's id. Use existing `useId`.
- **FilamentSelector (A11Y-13):** Give menu/trigger an accessible name; submenu announces via
  live region or `aria-activedescendant`. Research pins which mechanism fits the existing impl.
- **Icon buttons (A11Y-12):** Descriptive `aria-label` on every icon-only edit/delete button,
  reusing `EditButton`/`DeleteButton`/`IconButton` label convention from `src/components/ui`.
- **A11Y-15 cleanups:** `main[role="tabpanel"]` gets `tabIndex={-1}`; break-even bar gets
  `role="progressbar"` with values; InfoTooltip gets concise label + Escape-dismiss; mobile
  Back-to-site link gets label; category filter gets `role="group"` + label; SortIndicator and
  per-unit `invisible` patterns cleaned up.

### Claude's Discretion
- Exact roving-tabindex vs aria-activedescendant choice for Settings tabs.
- Exact live region vs aria-activedescendant mechanism for FilamentSelector submenu.
- Test file structure and individual assertion strategy.

### Deferred Ideas (OUT OF SCOPE)
- AAA target sizes (2.5.5 44×44).
- Tier 6 God-component splits.
- Tier 2 brand cohesion.
- Tier 3 onboarding.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| A11Y-10 | Settings inner tabs: Left/Right arrow-key nav; focus moves to panel on switch. | APG Tabs pattern verified — roving tabindex; panel `tabIndex={-1}` + `.focus()`. |
| A11Y-11 | Form errors: `role="alert"` on container; `aria-invalid` + `aria-describedby` on input. | WAI-ARIA spec confirmed; AssetLibrary already uses `useId`; CostCalculator uses toast (no inline error). |
| A11Y-12 | Icon-only edit/delete buttons (Settings carriers/marketplaces, Asset rows) get descriptive `aria-label`. | `EditButton`/`DeleteButton` pattern already correct in most places; audit shows specific raw `<button>` outliers in SettingsModal marketplace section (~788-792). |
| A11Y-13 | FilamentSelector menu accessible name; submenu announces correctly. | Existing `aria-label="Filaments"` on `role="menu"` is partially correct; trigger button lacks accessible name beyond text; submenu has no `aria-label`; recommend `aria-label` on submenu menu container. |
| A11Y-14 | Tag chip ✕ buttons meet 24×24 hit target; keyboard-focusable and focus-visible at all times. | WCAG 2.5.8 AA: 24×24 bounding box OR adequate spacing. Current `w-3.5 h-3.5` (14px) chip button must gain padding to reach 24×24 bounding box. focus-visible must override opacity-0. |
| A11Y-15 | Remaining AA cleanups (tabpanel tabIndex, progressbar ARIA, InfoTooltip, back-link label, category group, SortIndicator). | Each sub-item is a targeted single-line or two-line change. InfoTooltip needs Escape keydown handler and shorter `aria-label`. |
</phase_requirements>

---

## Summary

This phase is pure WCAG remediation — no new features, no visual redesign beyond the locked
tag-chip hit-target change. The codebase has **strong a11y foundations** already: `dialogA11y.ts`
implements a production-quality focus trap/restore, `useId` is used throughout for label
association, `role="tablist"` and `role="tab"` are already declared on both the main App tabs and
the Settings modal tabs. The gaps are well-scoped: missing keyboard interaction handlers,
missing ARIA attributes on a handful of form inputs, and a few cleanups to existing markup.

Two items are WCAG Critical and must be prioritized within this phase. A11Y-10 (Settings inner
tabs missing arrow-key navigation) violates WCAG 2.4.3 (Focus Order) because the tab widget
declares the ARIA role but does not implement the mandatory keyboard contract. A11Y-11 (form
errors in AssetLibrary not programmatically associated) violates WCAG 3.3.1 and 1.3.1 because
AT users hear the error announced but cannot determine which field is failing.

The remaining items (A11Y-12 through A11Y-15) are High and Medium severity. None require new
infrastructure — all patterns already exist in the codebase and need only to be applied in the
identified locations.

**Primary recommendation:** Implement in three groups ordered by criticality: (1) A11Y-10 +
A11Y-11 (WCAG Critical), (2) A11Y-12 + A11Y-13 (High, icon buttons + FilamentSelector), (3)
A11Y-14 + A11Y-15 (High/Medium, tag chip + AA cleanups). Wave structure can run 2 and 3 in
parallel since they touch different files.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Keyboard navigation (tabs, menus) | Browser / Client | — | Pure DOM keyboard event handling; no server involvement |
| ARIA attribute injection | Browser / Client | — | React props render to DOM; AT reads DOM directly |
| Form error association | Browser / Client | — | `useId` + `aria-describedby` wired at render time in React |
| Focus management on tab switch | Browser / Client | — | Imperative `panelRef.current?.focus()` after state update |
| Hit target sizing | Browser / Client | — | CSS padding on button element; no backend |
| Test verification | Dev tooling | — | Vitest + jsdom assertions on DOM attributes |

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component framework | Already in use |
| TypeScript | in project | Type safety for ARIA props | Already in use |
| Vitest | ^4.1.4 | Test runner | Already in use |
| jsdom | via Vitest | DOM simulation for tests | Already in use |

### No new runtime packages required

This phase is ARIA attribute changes + event handler additions only. No new npm packages are
needed. All ARIA patterns are native HTML attributes.

### Testing — no new packages required for core coverage

The project's existing test convention is raw `createRoot + act` (not `@testing-library/react`
or `userEvent`). This is established by `Modal.test.tsx`, `InfoTooltip.test.tsx`, and others.
New tests for this phase MUST follow that convention.

`axe-core` / `vitest-axe` would add value for automated ARIA validation but are NOT required.
The test coverage plan below uses targeted DOM attribute assertions (the project's established
pattern) which are equally authoritative for the specific attributes being set.

**If `vitest-axe` is added** (Claude's discretion): `npm view vitest-axe version` returns
`0.1.0` — this package is extremely low-version and not established. Use `axe-core` directly
(`4.12.1` verified on npm) by calling `new AxeBuilder(document).analyze()` inside a `beforeAll`
or `it` block. However, axe-core adds test setup complexity that the project hasn't adopted.
Recommendation: skip axe-core for this phase; rely on targeted attribute assertions per the
established convention.

---

## Package Legitimacy Audit

No new packages are installed in this phase. Section N/A.

---

## Architecture Patterns

### A11Y-10 — Settings Tabs: Roving Tabindex (LOCKED: roving tabindex)

**Decision:** Roving tabindex, not `aria-activedescendant`.

**Rationale:** The APG Tabs pattern (automatic activation variant) uses roving tabindex. The
existing buttons are native `<button>` elements — roving tabindex is natural (just toggle
`tabIndex` between `0` and `-1`). `aria-activedescendant` is typically used when the "focus"
owner is a container element (e.g., a listbox `div`), not when each item is a native interactive
element. [VERIFIED: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/]

**Exact pattern for SettingsModal.tsx (lines 200-224):**

```typescript
// Source: WAI-ARIA APG Tabs Automatic Activation example
// SettingsModal.tsx — add onKeyDown to the tablist div and tabIndex to each button

const tabIds = tabs.map(t => `settings-tab-${t.id}`);
const panelRef = useRef<HTMLDivElement>(null);

const handleTablistKeyDown = (e: React.KeyboardEvent) => {
  const idx = tabs.findIndex(t => t.id === activeTab);
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    const next = tabs[(idx + 1) % tabs.length];
    setActiveTab(next.id);
    // Focus the new tab button (roving tabindex: the newly active one has tabIndex=0)
    document.getElementById(`settings-tab-${next.id}`)?.focus();
    panelRef.current?.focus();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
    setActiveTab(prev.id);
    document.getElementById(`settings-tab-${prev.id}`)?.focus();
    panelRef.current?.focus();
  } else if (e.key === 'Home') {
    e.preventDefault();
    setActiveTab(tabs[0].id);
    document.getElementById(`settings-tab-${tabs[0].id}`)?.focus();
    panelRef.current?.focus();
  } else if (e.key === 'End') {
    e.preventDefault();
    setActiveTab(tabs[tabs.length - 1].id);
    document.getElementById(`settings-tab-${tabs[tabs.length - 1].id}`)?.focus();
    panelRef.current?.focus();
  }
};

// On each <button role="tab">:
// tabIndex={activeTab === tab.id ? 0 : -1}

// On the tabpanel <div>:
// ref={panelRef}
// tabIndex={-1}   ← allows programmatic focus without entering the tab sequence
```

**APG note on automatic vs manual activation:** APG recommends automatic activation when
"associated tab panels are displayed without noticeable latency." The Settings panel renders
synchronously in React — automatic activation applies. Arrow key = activate + move focus.
[CITED: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/]

**Focus-to-panel:** After switching tabs, call `panelRef.current?.focus()`. The panel needs
`tabIndex={-1}` to receive programmatic focus without entering the natural tab order (the user
then Tabs into the panel content). This is the APG-recommended approach for panels that contain
focusable content.
[VERIFIED: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/]

**Existing SettingsModal markup analysis:** Lines 200-227 show the tablist already has
`role="tablist"` and `aria-label="Settings sections"`. Each button already has `role="tab"`,
`aria-selected`, and `aria-controls="settings-panel"`. The panel already has `role="tabpanel"`,
`id="settings-panel"`, and `aria-labelledby`. What is missing:
- `onKeyDown` on the tablist container
- `tabIndex={activeTab === tab.id ? 0 : -1}` on each `<button role="tab">`
- `tabIndex={-1}` on the `<div role="tabpanel">`
- A `ref` on the tabpanel for programmatic focus

**App.tsx main tabs (A11Y-15 partial):** The main app tabpanel at line 314 already has
`role="tabpanel"` but lacks `tabIndex={-1}`. The main tablist arrow-key nav is NOT in scope for
A11Y-10 (audit only cites SettingsModal — the main tabs are less critical since they don't have
the same keyboard trap risk). However A11Y-15 lists the `tabIndex={-1}` on the main tabpanel as
an AA cleanup — add it there too.

---

### A11Y-11 — Form Error Association: role="alert" + aria-invalid + aria-describedby

**Target:** `AssetLibrary.tsx` — the `formError` state.

**CostCalculator note:** The audit cites `CostCalculator.tsx` alongside AssetLibrary for form
errors, but reading the code (line 687-695) reveals that CostCalculator uses **toast errors**
(`toast.error(...)`) rather than inline `formError` state. There is no inline form error `<div>`
to associate. The `role="alert"` pattern applies only to AssetLibrary's form.

**AssetLibrary existing code (lines 1084-1088):**
```jsx
{formError && (
  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-400">
    {formError}
  </div>
)}
```

**Missing:** `role="alert"` on the container; `aria-invalid="true"` on inputs that fail
validation; `aria-describedby` on those inputs pointing at the error element's id.

**Correct pattern:**
```typescript
// Source: WAI-ARIA spec + WCAG 3.3.1
// AssetLibrary.tsx — add formErrorId with useId() alongside existing nameId, etc.
const formErrorId = useId();

// The error container:
{formError && (
  <div
    id={formErrorId}
    role="alert"
    className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-400"
  >
    {formError}
  </div>
)}

// The Name input that is required:
<Input
  id={nameId}
  aria-invalid={formError ? 'true' : undefined}
  aria-describedby={formError ? formErrorId : undefined}
  ...
/>
```

**Important: `role="alert"` + conditional rendering timing.** `role="alert"` announces content
when the element **appears in the DOM** or when its **text content changes**. Both trigger
immediate announcement by AT. Conditionally rendering the element (it appears when `formError`
is set) is the correct pattern — the announcement fires on insertion.
[ASSUMED: based on ARIA spec behavior — verified via MDN/ARIA authoring practices but not
explicitly tested in this codebase]

**Which inputs get `aria-invalid` + `aria-describedby`?** The validation logic at lines 685-720
sets `formError` for: missing name (printers) / missing name+unit+packageCost (materials).
The name field is universally required. The simplest correct approach: when `formError` is set,
mark the name input `aria-invalid` (it is always the first required field). For the full
association, mark ALL required inputs that could be failing. Given the single error message
covers multiple fields, `aria-describedby` pointing to the single error id on the name input is
the minimum acceptable fix. The planner should add `aria-invalid` to all required fields that
participate in validation.

**`useId` already in scope:** AssetLibrary already imports and uses `useId` (line 1 and lines
499-514) — `formErrorId` is an additional `useId()` call following the existing pattern.

---

### A11Y-12 — Icon Button Labels: EditButton/DeleteButton Pattern

**Audit finding:** `SettingsModal.tsx:488-521` (custom carriers) and likely `~788-792` (custom
marketplaces) have icon-only edit/delete buttons.

**Reading the code:** Lines 549-556 in SettingsModal show that the carrier edit/delete buttons
**already use** `EditButton` and `DeleteButton` with the `label` prop (using `carrier.name`).
Lines 788-792 (marketplace section) need to be verified by the implementer but the same pattern
should apply.

**AssetLibrary.tsx:** Lines 337-338 and 396-397 already use `EditButton` and `DeleteButton` with
`label={asset.name}`. The shared icon-button pattern is already adopted in the correct places.

**Action for A11Y-12:** Audit confirms the issue. The implementer should scan SettingsModal
marketplace section (around line 788-792) and any other icon-only buttons that use raw `<button>`
elements instead of the shared components. Use `grep -n "svg\|pencil\|trash\|edit\|delete"` to
find any remaining raw icon buttons not using the shared components.

**Pattern (already established — do NOT deviate):**
```typescript
// From src/components/ui/IconButton.tsx — EditButton builds: aria-label={`Edit ${label}`}
<EditButton label={carrier.name} onClick={() => handleEdit(carrier.id)} />
<DeleteButton label={carrier.name} onClick={() => handleDelete(carrier.id)} />
```

---

### A11Y-13 — FilamentSelector Accessible Name + Submenu Announcement

**Reading the existing code (lines 290-430):**

The component already has:
- `aria-haspopup="menu"` and `aria-expanded` on the trigger button (line 310-311)
- `role="menu"` with `aria-label="Filaments"` on the main menu container (line 348)
- `role="menuitem"` on each brand button and filament button
- `aria-haspopup="menu"` and `aria-expanded` on brand items (lines 381-382)
- `role="menu"` on the submenu container (line 410) — but NO `aria-label` on the submenu

**What is actually missing:**

1. **Trigger button accessible name:** The trigger `<Button>` at line 298 displays text
   ("Select filament..." or the selected name). The trigger has no explicit `aria-label` but its
   text content serves as the accessible name. However, there is no `aria-labelledby` linking
   the trigger to the `<label>` at line 297 (`<label className="...">Filament</label>`). The
   label is a `<label>` element without a `htmlFor` attribute, so AT reads the trigger's text
   content (the selected filament name) but does not announce "Filament" as a field label.
   **Fix:** Add `id="filament-trigger-label"` to the label and `aria-labelledby` on the trigger.

2. **Submenu has no accessible name:** The submenu `<div role="menu">` at line 410 lacks
   `aria-label`. Per APG, a menu must have an accessible name via `aria-labelledby` or
   `aria-label`. Since the submenu opens in response to a brand button, give it
   `aria-label={brand}` (e.g., "Bambu" or "Generic").

3. **Active option announcement:** The component uses direct element focus (arrow keys call
   `brandRefs.current[index]?.focus()` and `filamentRefs.current[index][fIndex]?.focus()`).
   This means **focus already moves to each item**, so AT announces the menuitem text on
   focus — no additional `aria-activedescendant` or live region is needed.
   [VERIFIED: reading handleBrandKeyDown / handleFilamentKeyDown in the component]

**Decision (Claude's discretion — filing here):** Use `aria-label` directly on both menu
containers. No live region needed — the existing focus-based navigation already announces items.

**Exact changes:**
```typescript
// 1. Label element → add id
<label id="filament-trigger-label" className="block text-xs text-slate-400 mb-1">Filament</label>

// 2. Trigger Button → add aria-labelledby
<Button
  aria-labelledby="filament-trigger-label"
  aria-haspopup="menu"
  aria-expanded={isOpen}
  ...
>

// 3. Main menu div → aria-label already present ("Filaments") — leave as-is

// 4. Submenu div → add aria-label
<div
  role="menu"
  aria-label={brand}   // e.g., "Bambu", "Generic"
  onMouseEnter={...}
  ...
>
```

---

### A11Y-14 — Tag Chip ✕ Buttons: Hit Target + Focus Visibility

**Reading the existing code (JobsManager.tsx lines 535-548):**

Current chip button:
```jsx
<button
  type="button"
  onClick={...}
  aria-label={`Remove tag ${tag}`}
  className="ml-1 -mr-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm
             hover:bg-slate-500/60 hover:text-slate-100 transition-opacity opacity-0
             group-hover/chip:opacity-100 focus-visible:opacity-100 text-[10px] leading-none"
>
  ✕
</button>
```

**Issues:**
1. `w-3.5 h-3.5` = 14px bounding box — below WCAG 2.5.8's 24×24 minimum.
2. `opacity-0` at rest: the button IS keyboard focusable (no `tabIndex={-1}`) and does have
   `focus-visible:opacity-100` — this part is already partially correct. But the 14px size
   still fails 2.5.8.

**WCAG 2.5.8 AA — exact requirement:** The target bounding box must be at least 24×24 CSS
pixels, OR the target's center-circle of 24px diameter must not intersect any other target.
[VERIFIED: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html]

**Fix:** Increase hit area to 24×24 via padding while keeping the visual glyph small.

```jsx
// Source: WCAG 2.5.8 padding technique
<button
  type="button"
  onClick={...}
  aria-label={`Remove tag ${tag}`}
  className="ml-1 -mr-1 inline-flex items-center justify-center
             min-w-[24px] min-h-[24px]   /* 24×24 hit target */
             rounded-sm
             hover:bg-slate-500/60 hover:text-slate-100
             transition-opacity opacity-0
             group-hover/chip:opacity-100
             focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-blue-400
             text-[10px] leading-none"
>
  ✕
</button>
```

**Focus visibility:** The existing `focus-visible:opacity-100` already makes the button visible
on keyboard focus. The addition of `focus-visible:ring-1 focus-visible:ring-blue-400` provides
a clear focus ring. The chip's parent has `group/chip` for hover — on keyboard focus the button
becomes fully visible via `focus-visible:opacity-100`. This satisfies the locked decision
requirement to keep the "✕ visually subtle at rest and revealed on hover/focus."

**Touch users:** `min-h-[24px] min-w-[24px]` enlarges the touch/pointer bounding box to 24×24
regardless of hover state — satisfying the locked requirement.

**Note on spacing alternative:** The chips are tightly packed in `inline-flex flex-wrap` rows.
The spacing exception (adequate separation between targets) is unlikely to be satisfied given
adjacent chips. Enlarging the bounding box is the correct approach.

---

### A11Y-15 — AA Cleanups

**Sub-item by sub-item analysis based on code reading:**

#### 15a — `main[role="tabpanel"]` tabIndex={-1} (App.tsx:314)

```jsx
// Currently: no tabIndex
<main className="max-w-6xl mx-auto px-4 py-6" role="tabpanel" id="app-tabpanel" aria-labelledby={`tab-${activeTab}`}>

// Fix: add tabIndex={-1}
<main ... tabIndex={-1}>
```

This allows the tab activation handler (when implemented) to call `mainPanelRef.current?.focus()`
to place AT focus in the panel on tab switch. For the main app tabs, no arrow-key nav is
specified in A11Y-10 (that's Settings only) but `tabIndex={-1}` is still correct ARIA structure
so the tabpanel can receive programmatic focus if ever needed.

#### 15b — Break-even progressbar (JobsManager.tsx:707-714)

```jsx
// Currently: plain <div> with inline width style
<div className="h-2 bg-slate-600 rounded-full overflow-hidden">
  <div className={`h-full transition-all ${...}`} style={{ width: `${...}%` }} />
</div>

// Fix: outer container needs no change; inner bar becomes progressbar
<div className="h-2 bg-slate-600 rounded-full overflow-hidden">
  <div
    role="progressbar"
    aria-valuenow={job.copiesSold}
    aria-valuemin={0}
    aria-valuemax={info.breakEvenCopies}
    aria-valuetext={`${job.copiesSold} of ${info.breakEvenCopies} copies sold${info.isBreakEven ? ' — break-even reached' : ''}`}
    className={`h-full transition-all ${info.isBreakEven ? 'bg-green-500' : 'bg-blue-500'}`}
    style={{ width: `${Math.min(100, (job.copiesSold / info.breakEvenCopies) * 100)}%` }}
  />
</div>
```

[CITED: https://www.w3.org/WAI/ARIA/apg/patterns/meter/ — progressbar role with aria-valuenow/min/max]

#### 15c — InfoTooltip: concise aria-label + Escape dismiss (InfoTooltip.tsx)

**Current code (src/components/ui/InfoTooltip.tsx):**
```jsx
<button
  type="button"
  aria-label={text}   // ← the full tooltip text as the label (verbose)
  aria-describedby={open ? tooltipId : undefined}
  onFocus={() => setOpen(true)}
  onBlur={() => setOpen(false)}
  onClick={...}
>
```

**Issues:**
1. `aria-label={text}` uses the full tooltip paragraph as the button label. Screen readers will
   announce the entire text when the user reaches the button — before the tooltip is even open.
   This is verbose. The correct pattern is a short label ("More information" or "Help") with
   the full text in the tooltip.
2. No `onKeyDown` for Escape to dismiss the tooltip when open.

**Fix:**
```typescript
// Source: WAI-ARIA tooltip button pattern
<button
  type="button"
  aria-label="More information"   // concise — SR announces "More information, button"
  aria-describedby={open ? tooltipId : undefined}
  onFocus={() => setOpen(true)}
  onBlur={() => setOpen(false)}
  onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}
  onClick={...}
>
```

**Warning:** Changing `aria-label` from the full `text` prop to "More information" means the
button no longer announces the tooltip text on focus — only on hover/open. This is the
**correct** UX per the tooltip pattern (the tooltip itself, via `aria-describedby`, provides the
description when open). However, this is a behavioral change that the existing `InfoTooltip.test.tsx`
may test. The test file checks `aria-label` of the button — the planner must update the test
expectation.

**InfoTooltip.tsx is in `src/components/ui/`** — shared across many components. The change to
`aria-label` is safe because the label prop `text` is already exposed as the tooltip content.

#### 15d — Mobile "Back to site" link (App.tsx:200-209)

```jsx
// Currently — visible text hidden on mobile, no aria-label on the link
<Link
  to="/"
  className="flex items-center ... text-sm min-w-[44px] min-h-[44px]"
>
  <svg className="w-4 h-4" ... />
  <span className="hidden sm:inline">Back to site</span>
</Link>
```

On mobile the `<span>` is `hidden sm:inline` — CSS-hidden. CSS-hidden text (`hidden`) is
removed from the accessibility tree in some contexts. The icon SVG has no `aria-hidden` and
no accessible name. The link has no `aria-label`.

**Fix:**
```jsx
<Link
  to="/"
  aria-label="Back to site"
  className="flex items-center ... text-sm min-w-[44px] min-h-[44px]"
>
  <svg className="w-4 h-4" aria-hidden="true" ... />
  <span className="hidden sm:inline" aria-hidden="true">Back to site</span>
</Link>
```

Adding `aria-label="Back to site"` to the link ensures it has an accessible name regardless of
screen width. The visible text span can then also be marked `aria-hidden` to avoid double
announcement (the link's `aria-label` is used instead of children when both exist).

#### 15e — Category filter group (AssetLibrary.tsx:1027-1054)

```jsx
// Currently — buttons with aria-pressed but no group wrapper
<div className="flex gap-2 mb-4 flex-wrap items-center">
  <button aria-pressed={filterCategory === 'all'} ...>All</button>
  {allCategories.map(cat => (
    <button aria-pressed={filterCategory === cat} ...>{getCategoryLabel(cat)}</button>
  ))}
  ...
</div>
```

**Fix:** Wrap the filter buttons in a `role="group"` with `aria-label`:
```jsx
<div className="flex gap-2 mb-4 flex-wrap items-center">
  <div role="group" aria-label="Filter by category" className="flex gap-2 flex-wrap">
    <button aria-pressed={filterCategory === 'all'} ...>All</button>
    {allCategories.map(cat => (
      <button aria-pressed={filterCategory === cat} ...>{getCategoryLabel(cat)}</button>
    ))}
  </div>
  {/* Search input stays outside the group */}
  <div className="relative ml-auto ...">...</div>
</div>
```

#### 15f — SortIndicator `▲/▼` (AssetLibrary.tsx:475-478)

```jsx
const SortIndicator = ({ field, sortField, sortDirection }) => {
  if (sortField !== field) return null;
  return <span className="ml-1 text-[0.6em] align-middle">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
};
```

The column headers already use `role="columnheader"` with `aria-sort` attribute (lines
1446-1486) — this is the correct ARIA mechanism. The `▲/▼` symbols are visual redundancy for
sighted users. The fix is to add `aria-hidden="true"` to the SortIndicator span so screen
readers don't double-announce the sort direction (once from `aria-sort`, once from the symbol).

```jsx
return <span className="ml-1 text-[0.6em] align-middle" aria-hidden="true">{...}</span>;
```

#### 15g — Per-unit `invisible` + `aria-hidden` (CostCalculator.tsx:960-973)

Current code already handles this correctly:
```jsx
<label
  className={`... ${modelCost > 0 ? '' : 'invisible'}`}
  aria-hidden={modelCost > 0 ? undefined : true}
>
  <input tabIndex={modelCost > 0 ? 0 : -1} ... />
```

When `invisible`, `aria-hidden={true}` hides the label and `tabIndex={-1}` removes the checkbox
from keyboard sequence. This is the correct pattern — the audit noted it for "cleanup" but it
is already implemented correctly. No change needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap inside dialogs | Custom keydown + focus tracking | `useDialogA11y` (already in codebase) | Edge cases with dynamic children, StrictMode double-invoke; already solved |
| Tab panel focus management | Custom `setTimeout` + `document.getElementById` | `useRef` on panel + `.focus()` in handler | Direct ref access is synchronous and clean |
| Unique ID generation for ARIA | `Math.random()`, static strings | `useId()` (already used in both components) | React guarantees stable, hydration-safe, collision-free IDs |
| Screen-reader announcements | Custom `aria-live` region for every state change | `role="alert"` (error) / `role="status"` (non-urgent) | AT auto-announces on DOM insertion; no polling needed |
| Custom ARIA patterns | Novel ARIA roles or attributes not in the APG | Follow APG patterns exactly | Screen reader compatibility depends on known patterns |

---

## Common Pitfalls

### Pitfall 1: `role="alert"` with conditional rendering vs. always-present element

**What goes wrong:** Rendering `<div role="alert">` from scratch works (AT announces on insert).
But if the element is already in the DOM (e.g., always rendered with empty content) and you
change its text content, some AT may not re-announce. Conversely, if you render it conditionally
(only when `formError` is truthy), the insertion triggers announcement.
**How to avoid:** Use conditional rendering (`{formError && <div role="alert">...</div>}`) — the
element appears in the DOM only when there is an error, which guarantees announcement.
**Warning signs:** An always-present `<div role="alert" />` whose text is changed programmatically
may silently fail to announce in Safari/VoiceOver.
[ASSUMED: VoiceOver-specific behavior — well-documented across accessibility literature but not
tested in this session against VoiceOver specifically]

### Pitfall 2: `aria-invalid` without `aria-describedby` (or vice versa)

**What goes wrong:** `aria-invalid="true"` tells AT the field is invalid but not WHY.
`aria-describedby` provides the description but without `aria-invalid`, the field is not marked
as erroneous.
**How to avoid:** Always pair them. Both must be set when an error is active; both must be
removed (or set to `undefined`) when the error clears.
**Warning signs:** AT announces the description text on focus but does not announce "invalid" or
"error" before the description.

### Pitfall 3: `tabIndex={-1}` on tabpanel vs `tabIndex={0}`

**What goes wrong:** APG examples sometimes show `tabIndex={0}` on the tabpanel (keeps it in
the natural tab sequence, so Tab from the last tab in the tablist jumps to the panel). But if
the panel's first child is already focusable, adding `tabIndex={0}` to the panel creates an
extra Tab stop that does nothing visible.
**How to avoid:** Use `tabIndex={-1}` when the panel content already has focusable elements
(Settings tab has many inputs — Tab will land on the first input naturally). Use `tabIndex={0}`
only for panels with no focusable content (rare). Pair with programmatic `.focus()` after tab
switch.
[CITED: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/]

### Pitfall 4: Roving tabindex reset on rerender

**What goes wrong:** If `tabIndex` is derived from `activeTab` state in the render, it will
correctly reflect the selected tab. But if the component also has a `useEffect` or external
state that resets `activeTab`, ensure the focus does not stay on a `tabIndex={-1}` button.
**How to avoid:** The `tabIndex` prop is purely derived from `activeTab` — `activeTab === tab.id ? 0 : -1`.
React's reactive render handles this correctly.
**Warning signs:** AT reports two items with `tabIndex={0}` simultaneously (double-focus entry
point in the tablist).

### Pitfall 5: Labelling a menu with `aria-label` vs `aria-labelledby`

**What goes wrong:** If the menu's trigger button changes text (e.g., it shows the currently
selected filament name), using `aria-labelledby` pointing at the trigger will make the menu's
accessible name dynamic — which may confuse AT when the menu is already open.
**How to avoid:** Use a static `aria-label` on the menu container ("Filaments"). Reserve
`aria-labelledby` for menus whose name should track a visible element with stable text.

### Pitfall 6: `dialogA11y.ts` focus-trap interaction with panel focus

**What goes wrong:** `dialogA11y.ts` traps Tab inside the SidePanel (which wraps SettingsModal).
After arrow-key navigation switches a Settings tab and calls `panelRef.current?.focus()`, the
focus is still inside the dialog — the trap is NOT bypassed. This is correct and desired.
But if `panelRef` is on the `<div role="tabpanel">` which is inside the SidePanel's focus trap,
programmatic `.focus()` on the panel is always safe.
**How to avoid:** No action needed — the panel is a descendant of the dialog. The trap allows
focus to land anywhere inside the card element.
**Warning signs:** Focus escapes the modal after tab switch. Would indicate panelRef points
outside the dialog card.

### Pitfall 7: WCAG 2.5.8 — spacing exception vs bounding box

**What goes wrong:** Assuming that padding enlarges the "target" per WCAG 2.5.8. The spec
defines the target by its bounding box (computed by the browser). A button with `width: 14px`
but `padding: 5px` has a bounding box of 24×24px — this IS sufficient.
**How to avoid:** Use `min-w-[24px] min-h-[24px]` (or equivalent) on the button element itself,
not on a wrapper. Tailwind's `min-w-[24px]` sets a CSS min-width which is included in the
element's bounding box. The visual glyph inside can remain small.
[VERIFIED: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html]

---

## Code Examples

### Tabs: Roving Tabindex with Arrow Navigation

```typescript
// SettingsModal.tsx — complete tab keyboard handler
// Source: WAI-ARIA APG Tabs Automatic Activation example

const panelRef = useRef<HTMLDivElement>(null);

const handleTablistKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
  const currentIdx = tabs.findIndex(t => t.id === activeTab);
  let nextIdx: number | null = null;

  if (e.key === 'ArrowRight') {
    nextIdx = (currentIdx + 1) % tabs.length;
  } else if (e.key === 'ArrowLeft') {
    nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
  } else if (e.key === 'Home') {
    nextIdx = 0;
  } else if (e.key === 'End') {
    nextIdx = tabs.length - 1;
  }

  if (nextIdx !== null) {
    e.preventDefault();
    const nextTab = tabs[nextIdx];
    setActiveTab(nextTab.id);
    // Focus the new tab button
    document.getElementById(`settings-tab-${nextTab.id}`)?.focus();
    // Move focus to panel (panel has tabIndex={-1})
    panelRef.current?.focus();
  }
};

// Tablist container:
<div
  className="flex border-b border-slate-700"
  role="tablist"
  aria-label="Settings sections"
  onKeyDown={handleTablistKeyDown}
>
  {tabs.map(tab => (
    <button
      key={tab.id}
      role="tab"
      id={`settings-tab-${tab.id}`}
      tabIndex={activeTab === tab.id ? 0 : -1}   // ← roving tabindex
      aria-selected={activeTab === tab.id}
      aria-controls="settings-panel"
      onClick={() => setActiveTab(tab.id)}
      ...
    >
```

### Form Error: role="alert" + aria-invalid + aria-describedby

```typescript
// AssetLibrary.tsx
// Source: WAI-ARIA spec, WCAG 3.3.1

// Add alongside existing useId() calls:
const formErrorId = useId();

// Error container:
{formError && (
  <div
    id={formErrorId}
    role="alert"
    className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-400"
  >
    {formError}
  </div>
)}

// Required name input (already has id={nameId}):
<Input
  id={nameId}
  aria-invalid={formError ? 'true' : undefined}
  aria-describedby={formError ? formErrorId : undefined}
  ...
/>
```

### Tag Chip: 24×24 hit target

```jsx
// JobsManager.tsx — tag chip ✕ button
// Source: WCAG 2.5.8 AA bounding box technique

<button
  type="button"
  onClick={(e) => { e.stopPropagation(); void onRemoveTag(job, tag); }}
  aria-label={`Remove tag ${tag}`}
  className="ml-1 -mr-1 inline-flex items-center justify-center
             min-w-[24px] min-h-[24px]
             rounded-sm
             hover:bg-slate-500/60 hover:text-slate-100
             transition-opacity opacity-0
             group-hover/chip:opacity-100
             focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-blue-400
             text-[10px] leading-none"
>
  ✕
</button>
```

### Progressbar: break-even bar

```jsx
// JobsManager.tsx
// Source: WAI-ARIA progressbar role

<div
  role="progressbar"
  aria-valuenow={job.copiesSold}
  aria-valuemin={0}
  aria-valuemax={info.breakEvenCopies}
  aria-valuetext={`${job.copiesSold} of ${info.breakEvenCopies} copies${info.isBreakEven ? ' — break-even reached' : ''}`}
  className={`h-full transition-all ${info.isBreakEven ? 'bg-green-500' : 'bg-blue-500'}`}
  style={{ width: `${Math.min(100, (job.copiesSold / info.breakEvenCopies) * 100)}%` }}
/>
```

---

## Runtime State Inventory

Not applicable — this phase is code/ARIA attribute changes only. No runtime state is renamed or
migrated. The a11y changes are additive (new HTML attributes, new event handlers) and backward
compatible.

---

## Environment Availability

No external dependencies. Vitest + jsdom are already installed and running (`npm test` works).
Phase is code-only.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 + jsdom |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run --coverage` |

**Convention (MUST follow):** All new tests use raw `createRoot + act` — NOT `@testing-library/react`.
This is the established project convention shown in `Modal.test.tsx`, `InfoTooltip.test.tsx`, etc.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| A11Y-10 | Arrow keys move `aria-selected` and `tabIndex` in SettingsModal tablist | unit | `npm test -- --run src/components/SettingsModal.test.tsx` | Wave 0 gap |
| A11Y-11 | `role="alert"` present when formError set; `aria-invalid` + `aria-describedby` on name input | unit | `npm test -- --run src/components/AssetLibrary.test.tsx` | Wave 0 gap |
| A11Y-12 | EditButton/DeleteButton in SettingsModal have correct `aria-label` | unit | `npm test -- --run src/components/SettingsModal.test.tsx` | Wave 0 gap |
| A11Y-13 | FilamentSelector trigger has accessible name; submenu has `aria-label` | unit | `npm test -- --run src/components/FilamentSelector.test.tsx` | Wave 0 gap |
| A11Y-14 | Chip ✕ button bounding box ≥ 24×24; `focus-visible:opacity-100` class present | unit | `npm test -- --run src/components/JobsManager.test.tsx` | Wave 0 gap |
| A11Y-15 | progressbar has `aria-valuenow/min/max`; InfoTooltip button `aria-label` = "More information"; Back-to-site link `aria-label`; group role | unit | varies by component | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npm test -- --run` (full suite; fast, no coverage)
- **Per wave merge:** `npm test -- --run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

The following test files do not yet exist and must be created in Wave 0:

- [ ] `src/components/SettingsModal.test.tsx` — covers A11Y-10 (arrow-key nav tabIndex swap) and A11Y-12 (aria-labels)
- [ ] `src/components/AssetLibrary.test.tsx` — covers A11Y-11 (role="alert", aria-invalid, aria-describedby)
- [ ] `src/components/FilamentSelector.test.tsx` — covers A11Y-13 (trigger aria-labelledby, submenu aria-label)
- [ ] `src/components/JobsManager.test.tsx` — covers A11Y-14 (chip button hit target class, focus-visible) and A11Y-15 (progressbar attributes)
- [ ] `src/App.a11y.test.tsx` — covers A11Y-15 (tabpanel tabIndex, back-link aria-label)

**InfoTooltip.test.tsx already exists** — must be updated to reflect the new `aria-label="More information"` (changed from `aria-label={text}`).

---

## Security Domain

This phase contains no security-relevant changes. No auth, no data handling, no API calls, no
user input processing beyond what already exists. ASVS categories V2-V6 do not apply.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `role="alert"` announces correctly in Safari/VoiceOver when conditionally rendered | Pitfall 1 | Minor — conditional render is the safe pattern; persistent-element approach would be the fallback |
| A2 | CostCalculator uses toast for errors, not inline formError — no inline form error to associate | A11Y-11 research | Low — implementer should grep CostCalculator for any form-level error display not caught by search |
| A3 | SettingsModal marketplace section (~788-792) has raw icon buttons not yet using EditButton/DeleteButton | A11Y-12 | Low — if they already use the shared components, A11Y-12 scope narrows |

---

## Open Questions

1. **SettingsModal marketplace icon buttons (A11Y-12)**
   - What we know: Carriers section (lines 549-556) already correctly uses `EditButton`/`DeleteButton`
   - What's unclear: Whether the marketplace section (~788-792) uses the same or has raw `<button>` elements
   - Recommendation: Implementer should read those lines before estimating effort; likely a 2-line change

2. **InfoTooltip `aria-label` change impact**
   - What we know: `aria-label={text}` is used today; changing to "More information" changes what AT announces on focus
   - What's unclear: Whether any callers expect the button itself to announce the full tip text
   - Recommendation: Change to "More information" per ARIA tooltip pattern; update InfoTooltip.test.tsx expectation

3. **Main app tabs (App.tsx) — arrow-key nav scope**
   - What we know: A11Y-10 only cites SettingsModal; A11Y-15 only cites `tabIndex={-1}` for App.tsx main panel
   - What's unclear: Whether arrow-key nav on the main app tablist is also required for v1.9
   - Recommendation: Scope to what the audit explicitly specifies — add `tabIndex={-1}` to main panel (A11Y-15) but do NOT add arrow-key nav to the main tablist unless the planner decides to include it as a non-breaking extension

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `tabIndex` not set on tab buttons | Roving tabindex (0 for selected, -1 for others) | Keyboard users enter the tablist once, navigate with arrows |
| `aria-label={full-text}` on tooltip button | `aria-label="More information"` + tooltip content in `role="tooltip"` | AT announces short label on focus; full text on open |
| Click-only filter buttons | `aria-pressed` toggle buttons (already in place) | Screen readers know the pressed state — no change needed |

---

## Sources

### Primary (HIGH confidence)
- WAI-ARIA APG Tabs Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- WAI-ARIA APG Tabs Automatic Activation Example — https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/
- WCAG 2.5.8 Understanding — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WAI-ARIA APG Menu Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/menu/
- Codebase direct reads: SettingsModal.tsx, AssetLibrary.tsx, CostCalculator.tsx, FilamentSelector.tsx, JobsManager.tsx, App.tsx, InfoTooltip.tsx, dialogA11y.ts, IconButton.tsx

### Secondary (MEDIUM confidence)
- WCAG 2.5.5 Understanding (verified 2.5.8 is distinct) — https://www.w3.org/WAI/WCAG21/Understanding/target-size.html

### Tertiary (LOW confidence — marked [ASSUMED])
- VoiceOver/Safari `role="alert"` conditional render behavior (A1 above)

---

## Metadata

**Confidence breakdown:**
- A11Y-10 (tabs keyboard nav): HIGH — APG pattern verified, existing markup confirmed via code read
- A11Y-11 (form errors): HIGH — existing useId pattern confirmed, formError state confirmed, CostCalculator scoped to toast-only
- A11Y-12 (icon buttons): HIGH — shared button components already used in carriers; marketplace section [ASSUMED] per audit
- A11Y-13 (FilamentSelector): HIGH — existing code read; keyboard nav confirmed working; only aria-label additions needed
- A11Y-14 (chip target size): HIGH — WCAG 2.5.8 spec verified; Tailwind min-w/min-h pattern well-established
- A11Y-15 (AA cleanups): HIGH — each is a 1-3 line targeted change with clear ARIA spec backing

**Research date:** 2026-06-25
**Valid until:** 2026-09-25 (WCAG stable; React 19 stable; no fast-moving deps)
