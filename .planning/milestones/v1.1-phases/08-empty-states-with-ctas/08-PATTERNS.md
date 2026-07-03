# Phase 8: Empty States with CTAs - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 13 (6 created, 7 modified)
**Analogs found:** 13 / 13 (no gaps — every file has a strong in-repo analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/ui/EmptyState.tsx` | component (presentational primitive) | request-response (props in → JSX out, stateless) | `src/components/ui/Card.tsx` | exact (same dir, same primitive shape, same Tailwind-class composition pattern) |
| `src/components/ui/EmptyState.test.ts` | test | n/a | `src/utils/threeMfParser.test.ts` | role-match (only test file in repo; same vitest harness) |
| `src/components/ui/icons/PackageIcon.tsx` | component (SVG primitive) | request-response (props → svg) | inline SVGs at `src/App.tsx:189-192` and `src/components/AssetLibrary.tsx:365-367` | partial (inline SVGs exist; no extracted icon component yet — first of its kind) |
| `src/components/ui/icons/ClipboardListIcon.tsx` | component (SVG primitive) | request-response | same as above | partial |
| `src/components/ui/icons/PrinterIcon.tsx` | component (SVG primitive) | request-response | same as above | partial |
| `src/components/ui/icons/index.ts` | barrel | n/a | `src/components/ui/index.ts` | exact |
| `src/components/ui/index.ts` (modify) | barrel | n/a | `src/components/ui/index.ts` (itself) | exact (one-line append) |
| `src/components/AssetLibrary.tsx` (modify) | container component | event-driven (handler invocation) | `src/components/PrinterSettings.tsx:79-81` (existing Add button + handler reuse pattern) | role-match (CTA wiring reuses existing `startAdding` handler at line 312) |
| `src/components/JobsManager.tsx` (modify) | container component | event-driven | `src/components/JobsManager.tsx:193-207` (current empty-state branch — replaced in place) | exact (replacing an existing empty state with the new primitive in the same location) |
| `src/components/PrinterSettings.tsx` (modify) | container component | event-driven | `src/components/PrinterSettings.tsx:197-199` (current one-line empty state) | exact (replacing in place; reuse `setShowAddForm`) |
| `src/App.tsx` (modify — pass `onSwitchTab`) | container component | event-driven | `App.tsx:133-136` (`handleEditJob` → `setActiveTab('calculator')` plumbed via `onEditJob`) | exact (identical pattern — same handler shape, same destination tab) |
| `src/App.tsx` (modify — NewBadge overlay) | container component | n/a | `src/App.tsx:193` (`<NewBadge feature="settings-modal" className="absolute -top-1 -right-1" />`) | exact (correct overlay pattern already in the same file) |
| `src/features.ts` (modify) | config | n/a | `src/features.ts:21` (`'default-profit-margin': new Date('2026-05-18')`) | exact (one-line append in the same registry object) |

---

## Pattern Assignments

### `src/components/ui/EmptyState.tsx` (component, request-response)

**Analog:** `src/components/ui/Card.tsx` (closest primitive shape — stateless, props in → div out, composes Tailwind classes from prop values)

**Imports pattern** (from `Card.tsx:1-2` — type-only import + value import idiom):
```tsx
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
```

For EmptyState, the imports diverge slightly because (a) it needs `ReactNode` for the icon/description, and (b) it consumes the `Button` primitive. Mirror Card's `import type` discipline:
```tsx
import type { ReactNode } from 'react';
import { Button } from './Button';
```

**Props interface pattern** (from `Card.tsx:6-9`):
```tsx
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}
```

Apply the same `interface ComponentNameProps` convention (verified across Button, Card, Input, Select). Use the locked shape from UI-SPEC.md "EmptyState Primitive Contract" — `icon: ReactNode`, `title: string`, `description: string | ReactNode`, `cta?: { label; onClick }`, `className?: string`.

**Core render pattern** (from `Card.tsx:24-38` — `forwardRef` + className composition + default param destructuring):
```tsx
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className = '', children, ...props }, ref) => {
    const baseStyles = 'rounded-xl';

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
```

**Decision for EmptyState — skip `forwardRef`.** Research Pattern 10 (RESEARCH.md line 499-500) explicitly justifies this: EmptyState is composite (icon + heading + body + CTA), unlikely to need a ref. The simpler `export function` named export matches `Card.tsx:24`'s underlying intent without the wrapper. Verified canonical boilerplate from RESEARCH.md Pattern 10 (lines 478-495):
```tsx
export function EmptyState({ icon, title, description, cta, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="flex justify-center mb-4 text-slate-500">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">{description}</p>
      {cta && (
        <div className="mt-6 flex justify-center">
          <Button variant="primary" btnSize="md" onClick={cta.onClick}>
            {cta.label}
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Default-prop pattern** (from `Card.tsx:25`): `className = ''` defaulted in destructuring — apply identically.

**Tailwind class composition pattern** (from `Card.tsx:31`): template-literal joined with spaces. The EmptyState render contract uses interpolation in the same shape: `` `text-center py-12 ${className}` `` — matches.

**Button CTA wiring** (from `Button.tsx:15-21, 42-55` — the primitive that EmptyState must compose):
```tsx
// Button.tsx:15-21 — props use btnSize NOT size (TypeScript HTML-attr conflict)
export const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  ...
};

// Button.tsx:43 — destructure with `btnSize` (not `size`)
({ variant = 'primary', btnSize = 'md', fullWidth = false, ... })
```

EmptyState's CTA MUST use `<Button variant="primary" btnSize="md">` (NOT `size="md"`). This is also gated by D-11's lint guard — any raw `<button>` inside EmptyState would fail `npm run build`.

**No `displayName` needed** — only `forwardRef` components require it. The `export function` form auto-names.

---

### `src/components/ui/EmptyState.test.ts` (test)

**Analog:** `src/utils/threeMfParser.test.ts` (the ONLY existing test in the repo per RESEARCH.md line 52)

**Imports pattern** (from `threeMfParser.test.ts:1-3`):
```typescript
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';
import { parseThreeMf } from './threeMfParser';
```

Apply: `import { describe, it, expect } from 'vitest';` plus the SUT import. For component tests, also import `renderToStaticMarkup` from `react-dom/server` (already in deps via React — RESEARCH.md Validation Architecture, lines 906-921).

**describe/it pattern** (from `threeMfParser.test.ts:57-78`):
```typescript
describe('parseThreeMf', () => {
  // --- 3MF-01: per-plate extraction ---
  it('Test 1 (3MF-01): extracts per-plate filaments and print time from a valid sliced ZIP', async () => {
    const file = await makeSlicedZip(MULTI_PLATE_XML);
    const result = await parseThreeMf(file);

    expect(result.isSliced).toBe(true);
    expect(result.plates).toHaveLength(2);
    ...
  });

  // --- 3MF-02: cross-plate aggregation ---
  it('Test 2 (3MF-02): aggregates filamentsByType and totalPrintTimeHours across plates', async () => {
    ...
  });
});
```

Apply this exact structure for EmptyState. Each `it` block has a leading line-comment with a requirement-style ID (UI-SPEC.md "Phase Requirements → Test Map" uses UI-04). RESEARCH.md Validation Architecture (lines 882-893) lists the 5 required `it` blocks:

| Test ID | Behavior |
|---------|----------|
| UI-04 trigger logic | `shouldShowEmptyState(items=[], isLoading=true)` → false |
| UI-04 trigger logic | `shouldShowEmptyState(items=[], isLoading=false)` → true |
| UI-04 trigger logic | `shouldShowEmptyState(items=[x], isLoading=false)` → false |
| UI-04 render | EmptyState renders title + description; no `<button` when `cta` omitted |
| UI-04 render | EmptyState renders `<button` (from Button primitive) when `cta` provided |

**No-RTL constraint** (RESEARCH.md Anti-Patterns line 542): Do NOT `npm install @testing-library/react`. Use `renderToStaticMarkup` from `react-dom/server` for the render assertions:
```typescript
import { renderToStaticMarkup } from 'react-dom/server';
import { EmptyState } from './EmptyState';

it('renders title and description', () => {
  const html = renderToStaticMarkup(
    <EmptyState icon={<svg />} title="Test" description="Desc" />
  );
  expect(html).toContain('Test');
  expect(html).toContain('Desc');
  expect(html).not.toContain('<button');
});
```

**Vitest config compatibility** (`vitest.config.ts`):
```typescript
include: ['src/**/*.test.ts'],
```

The path `src/components/ui/EmptyState.test.ts` matches the glob. **CAUTION**: the include pattern is `*.test.ts` not `*.test.tsx`. Since the test will contain JSX, it must either (a) be named `.test.ts` (matches the glob) AND use `React.createElement` calls instead of JSX literal, OR (b) be named `.test.tsx` AND the `include` glob must be widened. **Recommend option (a)** — keep the test file as `.test.ts` and use `React.createElement` (which is what JSX compiles to anyway). This avoids touching `vitest.config.ts` and stays consistent with the file list above. Alternative: name it `.test.ts` but enable JSX in TS files — Vite already handles this for `.tsx` only. Planner should verify by running `npm test` after writing one assertion.

**Helper-fn extraction pattern** — RESEARCH.md Validation Architecture (lines 900-905) recommends exporting a pure predicate `shouldShowEmptyState<T>(items: T[], isLoading: boolean): boolean` from `EmptyState.tsx` so the trigger logic can be tested without rendering. Mirror the helper-fn style at `threeMfParser.test.ts:5-19` (top-of-file helpers, then `describe` block).

---

### `src/components/ui/icons/PackageIcon.tsx` (component, request-response)

**Analog (closest in-repo):** inline SVG at `src/components/AssetLibrary.tsx:365-367` (Import CSV icon — same shape: inline SVG with `currentColor`, `strokeLinecap="round"`, `strokeLinejoin="round"`):

```tsx
// AssetLibrary.tsx:365-367
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
</svg>
```

**Secondary analog:** `src/App.tsx:189-192` (Settings gear icon — same Heroicons-style structure, 24×24 viewBox, currentColor stroke).

**Pattern observations to copy:**
- `viewBox="0 0 24 24"` (NOT 48×48) — RESEARCH.md Example 6 (line 833) explicitly chose 24 viewBox for crisper rendering at `w-12 h-12` consumer size. Existing inline SVGs in the codebase also all use 24×24.
- `fill="none"` and `stroke="currentColor"` — required so consumers can tint via Tailwind text color (EmptyState passes `text-slate-500` on the wrapper, icon inherits).
- `strokeLinecap="round" strokeLinejoin="round"` — matches the Lucide aesthetic locked by UI-SPEC line 199.
- `strokeWidth={1.5}` (NOT 2) — RESEARCH.md Pattern 11 (line 519) explicitly states 1.5 for the Lucide outline look; existing SVGs in AssetLibrary/App use 2 because they're Heroicons-style, but UI-SPEC locks Lucide aesthetic for the Phase 8 icons.

**Imports pattern** (RESEARCH.md Pattern 11, line 510):
```tsx
import type { SVGProps } from 'react';
```

Use `import type` — matches the type-only-import discipline from `Card.tsx:1` and `Button.tsx:1`.

**Component pattern** (RESEARCH.md Pattern 11, lines 512-528 — canonical boilerplate):
```tsx
export function PackageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* path data */}
    </svg>
  );
}
```

**Prop spread placement** (RESEARCH.md Pattern 11, line 530): `{...props}` LAST on the `<svg>` element, BEFORE the path children. This lets consumers override `className`, add `aria-label`, etc., while preserving the locked defaults if not overridden. **Important nuance**: if a consumer passes `strokeWidth={2}`, the spread will override the locked `1.5`. This is intentional — UI-SPEC line 209 says "consumers can override (e.g., w-16 h-16 if a screen needs a larger anchor)."

**Path data** — copy verbatim from RESEARCH.md Example 6 (lines 769-772 for Package, 795-800 for ClipboardList, 822-825 for Printer). All three are hand-derived from Lucide MIT-licensed icons (`package`, `clipboard-list`, `printer`).

### `src/components/ui/icons/ClipboardListIcon.tsx`

Same analog and same pattern as `PackageIcon.tsx`. Only the inner `<path>` / `<rect>` children differ. Use the path data at RESEARCH.md Example 6 lines 795-800.

### `src/components/ui/icons/PrinterIcon.tsx`

Same analog and same pattern as `PackageIcon.tsx`. Use the path data at RESEARCH.md Example 6 lines 822-825.

---

### `src/components/ui/icons/index.ts` (barrel)

**Analog:** `src/components/ui/index.ts` (the existing barrel pattern — verified lines 1-5):

```typescript
export { Button, ButtonLink, getButtonClasses } from './Button';
export { Input } from './Input';
export { Select } from './Select';
export { Textarea } from './Textarea';
export { Card } from './Card';
```

**Apply identical style** — one `export { Name } from './File'` line per export:
```typescript
export { PackageIcon } from './PackageIcon';
export { ClipboardListIcon } from './ClipboardListIcon';
export { PrinterIcon } from './PrinterIcon';
```

**Critical convention** (RESEARCH.md Pattern 8, line 441): Do NOT re-export the icons through the top-level `src/components/ui/index.ts`. They live in their own `icons/` namespace so consumers import via `from './ui/icons'` (or `from '../components/ui/icons'`). This keeps the primitive surface focused.

---

### `src/components/ui/index.ts` (modify — add EmptyState export)

**Analog:** itself, lines 1-5 (shown above).

**Pattern: one-line append.** After the `Card` export, add:
```typescript
export { EmptyState } from './EmptyState';
```

**Optional** (RESEARCH.md Pattern 8, line 429): also export the type if any external consumer needs to forward props:
```typescript
export type { EmptyStateProps } from './EmptyState';
```

Note the existing barrel does NOT re-export `ButtonProps`, `CardProps`, etc., so the type export is non-standard for this codebase. **Recommend skipping the type export** unless a concrete consumer requires it — keep the barrel symmetric with existing entries.

---

### `src/components/AssetLibrary.tsx` (modify — insert empty-state branch)

**Closest analog (CTA handler reuse):** `src/components/AssetLibrary.tsx:312-320, 379-385` — the existing `startAdding` function and its current call site at the "+ Add" button.

**Existing handler** (lines 312-320 — reuse, do NOT duplicate):
```tsx
const startAdding = () => {
  // Pre-select category based on current filter
  const defaultCategory = filterCategory === 'all' ? 'consumable' : filterCategory;
  setFormData({ category: defaultCategory });
  setEditingId(null);
  setShowCustomCategory(false);
  setCustomCategoryInput('');
  setIsAdding(true);
};
```

**Existing call site for reference** (lines 379-385):
```tsx
<Button
  btnSize="sm"
  onClick={startAdding}
  className="flex-1 sm:flex-none"
>
  + Add {filterCategory === 'all' ? 'Asset' : getCategoryLabel(filterCategory).replace(/s$/, '')}
</Button>
```

**Imports pattern to extend** (existing imports at lines 1-5):
```tsx
import { useState, useMemo } from 'react';
import type { Asset, AssetCategory, BuiltInCategory } from '../types';
import { NewBadge } from './NewBadge';
import { CsvImportModal } from './CsvImportModal';
import { Button, Input, Select } from './ui';
```

Append the new imports as additional named imports — the existing `from './ui'` line should grow to include `EmptyState`:
```tsx
import { Button, Input, Select, EmptyState } from './ui';
import { PackageIcon } from './ui/icons';
```

**Insertion-point pattern** (RESEARCH.md Pattern 6, lines 346-365): Insert the empty-state branch IMMEDIATELY after the top header block (lines 353-389) and BEFORE the filter/search row (line 391). Wrap everything currently at lines 391-1066 in a `?:` ternary with the empty-state on the truthy branch. Do NOT hide the top-right "+ Add Asset" / "Import CSV" buttons in the empty case (they remain visible above the conditional).

**CTA wiring** (RESEARCH.md Example 1, lines 631-637):
```tsx
{assets.length === 0 ? (
  <EmptyState
    icon={<PackageIcon className="w-12 h-12" />}
    title="No materials in your library yet"
    description="Add your first filament to start tracking material costs across jobs. You can also import from CSV if you already have a list."
    cta={{ label: 'Add Material', onClick: startAdding }}
  />
) : (
  <>
    {/* existing filter tabs, search, form, tables, pagination — line 391 through 1066 */}
  </>
)}
```

**Modal preservation pattern**: the `<CsvImportModal />` at line 1069+ stays OUTSIDE the conditional — it must remain mountable even in the empty case (so a user can still trigger import via the top-right button).

---

### `src/components/JobsManager.tsx` (modify — replace lines 193-207 in place)

**Closest analog:** itself, lines 193-207 (the current empty-state branch being replaced — this is an in-place rewrite, exact match).

**Current code** (verified lines 193-207):
```tsx
if (jobs.length === 0) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-4">My Print Jobs</h2>
      <div className="text-center py-12">
        <p className="text-slate-400 mb-2">No jobs saved yet</p>
        <p className="text-slate-500 text-sm">
          Use the Cost Calculator to create and save print jobs.
          <br />
          Track sales and see how many copies you need to break even.
        </p>
      </div>
    </div>
  );
}
```

**Preservation rule** (RESEARCH.md Pattern 4, lines 276-279):
- **KEEP** the outer wrapper `<div className="bg-slate-800 rounded-xl p-6 border border-slate-700">` — UI-SPEC's render contract is explicit: consumers wrap.
- **KEEP** the `<h2>My Print Jobs</h2>` heading — removing it silently regresses screen context.
- **REPLACE** ONLY the inner `<div className="text-center py-12">…</div>` — EmptyState's own contract already provides `text-center py-12`.

**Props interface modification** (RESEARCH.md Pattern 1, lines 172-188): Add `onSwitchTab` to the existing `JobsManagerProps` interface at lines 6-15:
```tsx
interface JobsManagerProps {
  jobs: PrintJob[];
  materials: Material[];
  printers: PrinterConfig[];
  printerInstances: PrinterInstance[];
  shippingConfig: ShippingConfig;
  userCurrency: Currency;
  onDeleteJob: (id: string) => Promise<void>;
  onEditJob: (job: PrintJob) => void;
  onSwitchTab: (tab: 'calculator' | 'jobs' | 'materials' | 'settings') => void;  // NEW
}
```

**Destructure in function signature** (existing pattern at line 17):
```tsx
export function JobsManager({ jobs, materials, printers, printerInstances, shippingConfig, userCurrency, onDeleteJob, onEditJob, onSwitchTab }: JobsManagerProps) {
```

**Imports to extend** (existing line 4: `import { Button, Input, Select } from './ui';`):
```tsx
import { Button, Input, Select, EmptyState } from './ui';
import { ClipboardListIcon } from './ui/icons';
```

**Replacement code** (RESEARCH.md Example 2, lines 663-682) — preserve `<br/>` via `ReactNode` description:
```tsx
if (jobs.length === 0) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-4">My Print Jobs</h2>
      <EmptyState
        icon={<ClipboardListIcon className="w-12 h-12" />}
        title="No jobs saved yet"
        description={
          <>
            Use the Cost Calculator to create and save print jobs.
            <br />
            Track sales and see how many copies you need to break even.
          </>
        }
        cta={{ label: 'Open Calculator', onClick: () => onSwitchTab('calculator') }}
      />
    </div>
  );
}
```

**Pitfall to flag** (RESEARCH.md Pitfall 5, lines 604-611): the JobsManager copy MUST preserve the inline `<br/>`. Pass JSX (`<>…<br/>…</>`), NOT a plain string. UI-SPEC's Copywriting Contract table flattens the line break — this is a documentation artifact, not an intent to remove the break.

---

### `src/components/PrinterSettings.tsx` (modify — replace lines 197-199 in place)

**Closest analog:** itself, lines 197-199 (the current one-line empty state — exact in-place rewrite).

**Current code** (verified lines 197-200):
```tsx
{/* Printer Instances List */}
{printerInstances.length === 0 ? (
  <p className="text-slate-500 text-sm">No printers added yet. Add your first printer to start tracking.</p>
) : (
  <div className="space-y-3">
    ...instance list...
  </div>
)}
```

**Existing handler** (line 26 — reuse, do NOT duplicate):
```tsx
const [showAddForm, setShowAddForm] = useState(false);
```

**Existing Add button reference** (lines 79-81 — preserves visibility in the populated state):
```tsx
<Button btnSize="sm" onClick={() => setShowAddForm(true)}>
  + Add Printer
</Button>
```

**Preservation rule** (RESEARCH.md Pattern 5, lines 314-316 + line 334): The outer panel wrapper (lines 73-82) including the `<h2>My Printers</h2>` heading and the always-visible top-right `+ Add Printer` button stay UNCHANGED. They are outside the conditional. Only the `<p>` on line 199 is replaced.

**Imports to extend** (existing line 3: `import { Button, Input, Select } from './ui';`):
```tsx
import { Button, Input, Select, EmptyState } from './ui';
import { PrinterIcon } from './ui/icons';
```

**Replacement code** (RESEARCH.md Example 3, lines 699-710):
```tsx
{printerInstances.length === 0 ? (
  <EmptyState
    icon={<PrinterIcon className="w-12 h-12" />}
    title="No printers added yet"
    description="Add your first printer to track depreciation, electricity costs, and maintenance intervals across every job."
    cta={{ label: 'Add Printer', onClick: () => setShowAddForm(true) }}
  />
) : (
  <div className="space-y-3">
    {/* existing instance list — lines 200-346 unchanged */}
  </div>
)}
```

**Subtlety to flag** (RESEARCH.md Pattern 5, line 334): When empty, the user sees TWO Add Printer affordances — the always-visible top-right button at lines 79-81 AND the empty-state CTA. This is intentional (CTA-in-context); do NOT remove the top-right button.

---

### `src/App.tsx` (modify — pass `onSwitchTab` to JobsManager)

**Closest analog:** `src/App.tsx:133-136` (`handleEditJob` already uses `setActiveTab('calculator')` from a JobsManager-originated event, plumbed via the existing `onEditJob` prop). The new `onSwitchTab` prop is the same pattern.

**Existing precedent pattern** (lines 133-136):
```tsx
// Handle editing a job - switch to calculator and load job data
const handleEditJob = (job: PrintJob) => {
  setEditingJob(job);
  setActiveTab('calculator');
};
```

And the prop wiring at lines 287-298:
```tsx
{activeTab === 'jobs' && (
  <JobsManager
    jobs={jobs}
    materials={materials}
    printers={printers}
    printerInstances={printerInstances}
    shippingConfig={shippingConfig}
    userCurrency={userProfile.currency}
    onDeleteJob={deleteJob}
    onEditJob={handleEditJob}
  />
)}
```

**Modification — add `onSwitchTab` prop** (RESEARCH.md Pattern 1, lines 167-171):
```tsx
<JobsManager
  ...existing props...
  onSwitchTab={setActiveTab}
/>
```

Pass `setActiveTab` directly — it's already typed as `Dispatch<SetStateAction<Tab>>` from line 37 (`useState<Tab>('calculator')`), which is assignment-compatible with the prop signature `(tab: 'calculator' | 'jobs' | 'materials' | 'settings') => void`. No need to wrap.

**Anti-pattern to avoid** (RESEARCH.md Anti-Patterns line 539): Do NOT export the `Tab` type union from App.tsx to import in JobsManager. Type the prop callback directly to avoid a cross-file type dependency.

---

### `src/App.tsx` (modify — add NewBadge overlay to tabs)

**Closest analog:** `src/App.tsx:193` — the CORRECT overlay pattern, in the same file:
```tsx
<NewBadge feature="settings-modal" className="absolute -top-1 -right-1" />
```

This is on the gear-icon button (line 184-194), which has `className="relative …"` (line 186) — host has positioning context, badge overlays absolutely without consuming layout width. Project memory's anti-pattern documentation describes this exact pattern as the canonical one.

**Anti-pattern to NOT copy:** `src/App.tsx:258` (existing pre-Phase-8 inline badge):
```tsx
{tab.id === 'settings' && <NewBadge feature="printer-maintenance-alerts" />}
```

No `className="absolute -top-1 -right-1"` — this is inline placement inside a flex container, which violates project memory's anti-pattern rule. RESEARCH.md Pattern 7 (lines 395-398) explicitly flags this as a PRE-EXISTING issue. **DO NOT fix it in Phase 8** (out of scope per RESEARCH.md Open Question 3); just do NOT copy it.

**Tab button host structure** (verified lines 246-263) — `relative` class already on each `<button>` (line 250: `… relative whitespace-nowrap …`). Positioning context is ready; no host changes needed.

**Modification pattern** (RESEARCH.md Example 4, lines 716-734):
```tsx
{tabs.map(tab => (
  <button
    key={tab.id}
    onClick={() => setActiveTab(tab.id)}
    className={`px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap min-h-[44px] flex items-center gap-1 ${
      activeTab === tab.id ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
    }`}
  >
    <span className="sm:hidden">{tab.shortLabel}</span>
    <span className="hidden sm:inline">{tab.label}</span>
    {tab.id === 'settings' && <NewBadge feature="printer-maintenance-alerts" />}
    {/* NEW — overlay badge on Phase 8 affected tabs */}
    {(tab.id === 'jobs' || tab.id === 'materials' || tab.id === 'settings') && (
      <NewBadge feature="empty-states" className="absolute -top-1 -right-1" />
    )}
    {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
  </button>
))}
```

**Decision flag** (RESEARCH.md Open Question 1, lines 983-986): Whether to badge all three tabs (jobs/materials/settings) or just one. RESEARCH recommends Option A (all three with shared `feature="empty-states"` key — the first-seen window clears all three simultaneously). Surface for user confirmation at plan-check.

---

### `src/features.ts` (modify — register `'empty-states'` entry)

**Closest analog:** itself, lines 5-22 — append into the same registry object.

**Existing pattern** (verified lines 5-22):
```typescript
export const featureReleases: Record<string, Date> = {
  'per-unit-licensing': new Date('2026-01-24'),
  'author-min-price': new Date('2026-01-24'),
  ...
  'default-profit-margin': new Date('2026-05-18'),
  // Add new features here with their release date
};
```

**Pattern observations:**
- Key uses kebab-case strings, plural where appropriate (`'marketplace-fees'`, `'custom-carriers'`, `'custom-marketplaces'`). The phase 8 key is `'empty-states'` (plural, kebab-case) — matches the convention.
- Value is `new Date('YYYY-MM-DD')` — ISO date string.
- New entries are appended BEFORE the trailing `// Add new features here…` comment (verified at line 22).

**Modification** (RESEARCH.md Pattern 9 + Example 5):
```typescript
'empty-states': new Date('2026-05-19'),  // Use actual ship date when the feature lands on main
```

**Key-collision check** (RESEARCH.md Pitfall 6, lines 614-619): Verified `'empty-states'` is NOT already in the registry. The closest existing key is `'settings-modal'` (line 10) — no collision.

---

## Shared Patterns

### Pattern A: Primitive component shape (applies to `EmptyState.tsx` + all icon files)

**Source:** `src/components/ui/Card.tsx:1-40` (closest existing primitive); `src/components/ui/Button.tsx:1-77` (sibling)

**Apply to:** `EmptyState.tsx`, `PackageIcon.tsx`, `ClipboardListIcon.tsx`, `PrinterIcon.tsx`

**Concrete contract:**
1. Type-only imports use `import type` (Card.tsx:1, Button.tsx:1).
2. Props typed via `interface ComponentNameProps` (Button.tsx:13: `interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, BaseButtonProps {}`; Card.tsx:6: `interface CardProps extends HTMLAttributes<HTMLDivElement>`).
3. `className?: string` parameter defaulted to `''` in destructuring (Card.tsx:25, Button.tsx:43).
4. Tailwind classes composed via template literals with interpolation (Card.tsx:31).
5. **Special — `btnSize` not `size`**: when consuming Button, use `btnSize="md"` NOT `size="md"` (Button.tsx:43; CLAUDE.md project instructions explicitly call this out — TypeScript conflict with HTML attribute).
6. Export style: `export function Name(...)` for simple components, `export const Name = forwardRef(...)` only when ref forwarding is needed (Button uses forwardRef; Card uses forwardRef; EmptyState does NOT need it per RESEARCH.md Pattern 10).

### Pattern B: Barrel export style (applies to `src/components/ui/index.ts` + new `src/components/ui/icons/index.ts`)

**Source:** `src/components/ui/index.ts:1-5`

**Apply to:** `src/components/ui/index.ts` modification + new `src/components/ui/icons/index.ts`

**Concrete contract:**
- One line per export: `export { Name } from './File';`
- No re-exports across nested namespaces (icons barrel does NOT pollute the top-level `ui/index.ts`).
- No default exports anywhere — named exports only.
- No type re-exports unless a consumer concretely needs the type (none of Button, Card, Input currently re-export their `Props` types — keep symmetric).

### Pattern C: Existing CTA-handler reuse (applies to all three consumers)

**Source:**
- `AssetLibrary.tsx:312-320` → `startAdding`
- `PrinterSettings.tsx:26, 79-81` → `setShowAddForm(true)`
- `App.tsx:37, 133-136` → `setActiveTab` (precedent via `onEditJob`/`handleEditJob`)

**Apply to:** AssetLibrary, JobsManager, PrinterSettings empty-state CTAs

**Concrete contract:** The empty-state CTA's `onClick` MUST invoke an existing handler. Do NOT introduce new modals, new routing, or new state machinery for the CTA. The handler already exists — find it and pass it through.

| Consumer | Handler | Wiring |
|----------|---------|--------|
| AssetLibrary | `startAdding` (line 312) | `cta={{ label: 'Add Material', onClick: startAdding }}` |
| JobsManager | `onSwitchTab('calculator')` (new prop, mirrors `onEditJob`) | `cta={{ label: 'Open Calculator', onClick: () => onSwitchTab('calculator') }}` |
| PrinterSettings | `setShowAddForm(true)` (line 26) | `cta={{ label: 'Add Printer', onClick: () => setShowAddForm(true) }}` |

### Pattern D: NewBadge overlay (applies to App.tsx tab badges)

**Source:** `src/App.tsx:193` — the only correct overlay in the codebase:
```tsx
<NewBadge feature="settings-modal" className="absolute -top-1 -right-1" />
```

Host requirement (line 186): `className="relative …"` on the parent button — already present on tab buttons (line 250).

**Apply to:** all three new badges in `App.tsx` tab map.

**Concrete contract:**
- Host MUST be `relative` (already true for tab buttons).
- Badge MUST receive `className="absolute -top-1 -right-1"`.
- Badge MUST NOT be rendered inline (no className) inside flex containers — see project memory anti-pattern and `App.tsx:258` (pre-existing violation that Phase 8 must NOT copy).
- Badge MUST NOT be placed on the CTA button inside EmptyState (D-10 forbids it — double-click confusion).

### Pattern E: Test file shape (applies to `EmptyState.test.ts`)

**Source:** `src/utils/threeMfParser.test.ts:1-78` (the only existing test)

**Apply to:** `src/components/ui/EmptyState.test.ts`

**Concrete contract:**
- `import { describe, it, expect } from 'vitest';` (test-runner globals NOT used; explicit imports per the existing file's line 2).
- One top-level `describe('ComponentOrFunctionName', () => { … })` block.
- Each `it` block has a leading line-comment with a requirement ID (e.g., `// --- UI-04 trigger: …`).
- Pure-function tests (no React rendering) for the trigger predicate.
- For component-output tests, use `renderToStaticMarkup` from `react-dom/server` (NOT @testing-library/react — not installed, not to be installed in this phase per RESEARCH.md Anti-Patterns line 542).
- File extension `.test.ts` to match `vitest.config.ts` glob `src/**/*.test.ts`. Use `React.createElement` if needed to keep `.test.ts` extension valid for JSX content.

### Pattern F: Loading-flag coordination (applies to all consumers — but no code change needed)

**Source:** `src/App.tsx:106, 149-155` — the global `isLoading` gate

```tsx
// line 106
const isLoading = assetsLoading || settingsLoading || jobsLoading || printersLoading || instancesLoading || profileLoading || shippingLoading || feesLoading;

// lines 149-155
if (isLoading) {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="text-slate-400">Loading...</div>
    </div>
  );
}
```

**Apply to:** D-08 compliance verification (no code change — verify-only).

**Concrete contract** (RESEARCH.md Pitfall 2, lines 569-577): The global gate at line 106-155 already prevents the empty-state-flash race. None of the three consumers needs a local `!isLoading` check. The planner's verification plan should explicitly assert: "With any `*Loading` flag true, App.tsx renders 'Loading...' and never reaches a consumer's empty-state branch."

---

## No Analog Found

No files in Phase 8 lack a strong in-repo analog. Every new file is either:
- A primitive in the same shape as an existing primitive (Card → EmptyState, inline-SVG → extracted Icon), OR
- A modification to a file whose existing pattern is the analog (in-place replacements at JobsManager:193-207, PrinterSettings:197-199), OR
- A one-line append into an existing registry (features.ts, ui/index.ts), OR
- A test file matching the only existing test's harness style.

The icon-component pattern is "new" in the sense that no `src/components/ui/icons/*.tsx` exists yet — but inline SVGs with the same prop/attribute pattern exist throughout the codebase (App.tsx:189-192, AssetLibrary.tsx:365-367), and RESEARCH.md Pattern 11 + Example 6 provide the canonical extraction shape.

---

## Metadata

**Analog search scope:**
- `src/components/ui/` (Button.tsx, Card.tsx, index.ts) — primitive shape
- `src/components/` (NewBadge.tsx, AssetLibrary.tsx, JobsManager.tsx, PrinterSettings.tsx) — consumer wiring + badge overlay
- `src/App.tsx` — tab state, NewBadge overlay precedent, JobsManager prop wiring
- `src/features.ts` — feature key/date format
- `src/utils/threeMfParser.test.ts` — test harness style
- `vitest.config.ts` — test glob include pattern

**Files scanned:** 9 source files read in full or in targeted ranges.

**Pattern extraction date:** 2026-05-19

**Confidence:** HIGH — every analog cited has been read directly; every line number reference has been verified against the current source.
