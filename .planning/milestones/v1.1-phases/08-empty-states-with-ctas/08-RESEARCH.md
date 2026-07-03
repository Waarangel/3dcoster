# Phase 8: Empty States with CTAs - Research

**Researched:** 2026-05-19
**Domain:** React 19 / TypeScript UI primitives + integration into three existing tab panels
**Confidence:** HIGH (every claim verified against current source — no library/version research needed; all integration unknowns resolved by direct file read)

## Summary

This phase is **pure UI plumbing on top of fully locked design and behavior decisions**. CONTEXT.md D-01..D-11 and UI-SPEC.md lock the prop shape, copy, render contract, color, spacing, typography, icon style, and CTA wiring strategy. No alternative architectures to evaluate; no library to install; no version verification needed (Phase 7 just established the primitive pattern this extends).

Research therefore concentrates on **de-risking the four integration touchpoints**: (1) the `App.tsx` tab setter for the Jobs CTA, (2) the existing Add Material / Add Printer handlers the consumer CTAs must reuse, (3) the exact replacement scope at `JobsManager.tsx:193-207` and `PrinterSettings.tsx:198-199`, and (4) the NewBadge placement target on the tab heading. All four are now mapped to exact symbols and line numbers. A fifth concern — the lint guard's directory exclusion for the new `src/components/ui/icons/` subdirectory — is verified to already pass via `startsWith` semantics; **no guard edit required**.

One material gotcha surfaced and is flagged for the planner: `useAssets` **auto-seeds defaults** on first run (`src/hooks/useDatabase.ts:21-23`). The AssetLibrary empty state is therefore not first-run UX — it only appears after the user manually deletes all assets. The empty-state primitive still ships, but UAT must confirm the trigger condition matches user intent.

**Primary recommendation:** Two-plan split — Plan 1 ships the `EmptyState` primitive, three icon components, the `src/components/ui/icons/` barrel, the `src/components/ui/index.ts` barrel update, the `src/features.ts` registration, and one unit test asserting render-when-empty / no-render-when-non-empty. Plan 2 wires the three consumers + adds the NewBadge overlay to the relevant tab(s). This keeps the foundation reviewable on its own and lets the consumer wiring fail loudly if the primitive was wrong.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| EmptyState rendering (icon + heading + body + CTA) | Browser / Client (primitive in `src/components/ui/`) | — | Pure presentational React component; no state, no data fetching, no side effects |
| Empty-state trigger logic (`!isLoading && list.length === 0`) | Browser / Client (each consumer component) | — | Consumer-owned because the loading flag is per-hook; the primitive must stay agnostic |
| Add Material / Add Printer handler invocation | Browser / Client (consumer component local state) | — | Existing handlers (`startAdding`, `setShowAddForm`) already live in consumer; CTA reuses them |
| Tab switching (Jobs → Calculator) | Browser / Client (App.tsx state) | — | `activeTab` state is already lifted to App.tsx; a new `onSwitchTab` prop drills it down to `JobsManager` |
| NewBadge first-seen tracking | Browser / Client (localStorage via `NewBadge.tsx`) | — | Already implemented in Phase 5; this phase only registers a new feature key |
| Feature release registry | Browser / Client (`src/features.ts`) | — | Static module; one-line addition |
| Lint enforcement of "no raw `<button>` in EmptyState" | Build-time / Pre-commit (Node script) | — | Existing `scripts/lint-no-raw-html.mjs`; no change needed — `src/components/ui/` already excluded |

**No backend, no API, no database tier touched.** This phase is 100% client presentational + a small registry update.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component runtime | `[VERIFIED: package.json]` — already in use; no change |
| TypeScript | 5.9.3 | Type safety | `[VERIFIED: package.json]` — already in use; no change |
| Tailwind CSS | 4.1.18 | All styling (utility classes) | `[VERIFIED: package.json]` — every primitive uses Tailwind; consistent with Phase 7 |
| vitest | 4.1.4 | Unit test runner | `[VERIFIED: package.json]` — already configured (`vitest.config.ts`); used by `src/utils/threeMfParser.test.ts` |
| jsdom | 29.0.2 | DOM env for vitest | `[VERIFIED: package.json]` — already configured as `environment: 'jsdom'` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/components/ui/Button` | internal | CTA button inside EmptyState | Required by D-11 — lint guard would block any raw `<button>` |
| `src/components/NewBadge` | internal | Overlay badge on tab heading | Required by D-10 — uses existing `feature` + `className` API |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-authored inline SVG | Lucide React library | Adds ~50KB dep + new build vector; CONTEXT.md D-02 explicitly forbids external icon dep. Skipped. |
| `@testing-library/react` for the empty-state unit test | Pure function-level test on the trigger condition | Project has no React Testing Library installed (verified via `grep -E "testing-library" package.json` — no matches) and only one existing test (parser logic, not component). **Recommendation: write a non-rendering test that asserts the trigger condition logic** (`shouldShowEmptyState(items, isLoading)`) rather than introducing RTL infrastructure mid-phase. See Validation Architecture section. |

**Installation:** None. No new packages.

**Version verification:** Skipped — no new packages. All dependencies already pinned in `package.json`.

## Package Legitimacy Audit

Not applicable — **zero new packages installed** in this phase. EmptyState and the three icons are hand-authored against existing primitives. NewBadge integration is one-line registry edit. No `npm install` step in any plan.

## Architecture Patterns

### System Architecture Diagram

```
                   ┌─────────────────────────────────────────┐
                   │  App.tsx (tab controller + hooks)        │
                   │                                          │
                   │  useAssets() ──► assets, assetsLoading   │
                   │  useJobs()   ──► jobs, jobsLoading       │
                   │  usePrinterInstances() ──► instances,    │
                   │                            instancesLoading│
                   │                                          │
                   │  activeTab state + setActiveTab          │
                   │     │                                    │
                   │     ├──► tab buttons (NewBadge overlay   │
                   │     │     attached here)                 │
                   │     │                                    │
                   │     └──► main: <{Consumer} props…/>      │
                   └─────────────────────────────────────────┘
                              │
                              │ (props drilled, including new
                              │   onSwitchTab for JobsManager)
                              ▼
        ┌─────────────────────┬────────────────────────┬─────────────────────┐
        │  AssetLibrary       │  JobsManager           │  PrinterSettings    │
        │                     │                        │                     │
        │  if (assets.len==0) │  if (jobs.len==0)      │  if (instances.len  │
        │    <EmptyState      │    <EmptyState         │       ==0)          │
        │      icon={Package} │      icon={ClipboardList}│  <EmptyState     │
        │      title=…        │      title=…           │    icon={Printer}  │
        │      cta={          │      cta={             │    title=…         │
        │        label='Add   │        label='Open     │    cta={           │
        │          Material', │          Calculator',  │      label='Add    │
        │        onClick:     │        onClick:        │        Printer',  │
        │          startAdding│          onSwitchTab(  │      onClick:     │
        │      }}/>           │            'calculator')│       setShowAddFormn│
        │                     │      }}/>              │    }}/>            │
        └──────────┬──────────┴───────────┬────────────┴──────────┬──────────┘
                   │                       │                       │
                   └───────────────────────┴───────────────────────┘
                                          │
                                          ▼
                              ┌──────────────────────────┐
                              │ src/components/ui/       │
                              │   EmptyState.tsx          │
                              │   (presentational only)   │
                              │     uses ▼                │
                              │   Button (Phase 7)        │
                              │                          │
                              │   icons/                  │
                              │     PackageIcon.tsx       │
                              │     ClipboardListIcon.tsx │
                              │     PrinterIcon.tsx       │
                              │     index.ts (barrel)     │
                              └──────────────────────────┘
```

Data flow:
1. `App.tsx` subscribes to all data hooks and exposes `assetsLoading`, `jobsLoading`, `instancesLoading` (already present today, names verified at `App.tsx:46-104`).
2. Existing global `isLoading` short-circuits to the "Loading..." screen (`App.tsx:149-155`) before any consumer renders — so the per-consumer `length === 0` guard is reached only after every hook has loaded. **This satisfies D-08 with no new code; the planner just needs to confirm the guard order, not introduce new loading logic.**
3. Each consumer renders `<EmptyState .../>` only on the strict zero-items branch.
4. CTAs invoke handlers that already exist (Add Material / Add Printer) or a new prop callback (`onSwitchTab` for the Jobs case).

### Recommended Project Structure

```
src/
├── components/
│   ├── ui/
│   │   ├── EmptyState.tsx       # NEW — primitive
│   │   ├── index.ts             # MODIFIED — add EmptyState export
│   │   └── icons/               # NEW subdirectory
│   │       ├── PackageIcon.tsx
│   │       ├── ClipboardListIcon.tsx
│   │       ├── PrinterIcon.tsx
│   │       └── index.ts         # NEW — barrel for the three icons
│   ├── AssetLibrary.tsx         # MODIFIED — empty-state branch
│   ├── JobsManager.tsx          # MODIFIED — replace lines 193-207
│   └── PrinterSettings.tsx      # MODIFIED — replace line 198-199
├── features.ts                  # MODIFIED — register 'empty-states'
└── App.tsx                      # MODIFIED — pass onSwitchTab to JobsManager,
                                 #           add NewBadge overlay to relevant tab
```

### Pattern 1: Tab-state setter signature

**What:** App.tsx owns tab state. Use the existing setter — do not invent routing.

**Source verified:** `src/App.tsx:17, 37, 142-148, 249`

```typescript
// src/App.tsx:17
type Tab = 'calculator' | 'jobs' | 'materials' | 'settings';

// src/App.tsx:37 — source-of-truth state
const [activeTab, setActiveTab] = useState<Tab>('calculator');

// src/App.tsx:249 — how existing tab buttons set it
onClick={() => setActiveTab(tab.id)}
```

**For the Jobs CTA**, add a callback prop to `JobsManager`:

```typescript
// In App.tsx, where <JobsManager .../> is rendered (line 287-298):
<JobsManager
  ...existing props...
  onSwitchTab={setActiveTab}   // NEW — pass the setter directly
/>

// In JobsManager.tsx — add to props interface:
interface JobsManagerProps {
  ...existing...
  onSwitchTab: (tab: 'calculator' | 'jobs' | 'materials' | 'settings') => void;
}

// CTA wiring:
cta={{
  label: 'Open Calculator',
  onClick: () => onSwitchTab('calculator'),
}}
```

**Pattern precedent:** `handleEditJob` in App.tsx already calls `setActiveTab('calculator')` from a JobsManager-originated event (`App.tsx:133-136`, plumbed via `onEditJob` prop). Reuse that exact pattern for the empty-state CTA. Do NOT export the literal string `'calculator'` from JobsManager — keep the tab-id vocabulary in App.tsx and pass typed values via props.

**Type-narrowing note:** Importing the `Tab` type into JobsManager would require exporting it from App.tsx. The cleaner pattern is to type the prop callback signature directly (as shown above) without importing the union — TypeScript will structurally compare and `setActiveTab` will be assignment-compatible.

### Pattern 2: AssetLibrary Add Material handler

**What:** The existing "+ Add Asset / + Add Material" button uses `startAdding` (a local function in AssetLibrary).

**Source verified:** `src/components/AssetLibrary.tsx:312-320, 381`

```typescript
// src/components/AssetLibrary.tsx:312-320
const startAdding = () => {
  // Pre-select category based on current filter
  const defaultCategory = filterCategory === 'all' ? 'consumable' : filterCategory;
  setFormData({ category: defaultCategory });
  setEditingId(null);
  setShowCustomCategory(false);
  setCustomCategoryInput('');
  setIsAdding(true);
};

// Used by the existing button at line 381:
<Button btnSize="sm" onClick={startAdding} ...>
  + Add {filterCategory === 'all' ? 'Asset' : getCategoryLabel(filterCategory).replace(/s$/, '')}
</Button>
```

**For the empty-state CTA**, simply reuse `startAdding`:

```typescript
cta={{ label: 'Add Material', onClick: startAdding }}
```

When the library is empty, `filterCategory` defaults to `'all'` (`AssetLibrary.tsx:73`) so `startAdding` will set the new asset's category to `'consumable'`. **The CTA copy says "Add Material" but `startAdding` defaults to category `'consumable'`** — this is a minor mismatch between the locked copy and the actual default. The planner has two options:

1. **Accept the mismatch.** When empty, opening the form pre-selected to `'consumable'` is fine — user can switch to `filament` via the in-form dropdown. The CTA label "Add Material" is generic enough.
2. **Wrap the handler** to set `formData.category = 'filament'` before calling `setIsAdding(true)`. This better matches the headline "No materials in your library yet" → user clicks Add Material → form opens pre-set to filament.

**Recommend Option 1** for minimal blast radius. The planner should call this out and let the user confirm at plan-check time.

### Pattern 3: PrinterSettings Add Printer handler

**What:** The existing "+ Add Printer" button toggles `showAddForm` local state.

**Source verified:** `src/components/PrinterSettings.tsx:26, 79-81`

```typescript
// src/components/PrinterSettings.tsx:26
const [showAddForm, setShowAddForm] = useState(false);

// src/components/PrinterSettings.tsx:79-81 — existing button
<Button btnSize="sm" onClick={() => setShowAddForm(true)}>
  + Add Printer
</Button>
```

**For the empty-state CTA**:

```typescript
cta={{ label: 'Add Printer', onClick: () => setShowAddForm(true) }}
```

Nothing else to wire — the existing form at `PrinterSettings.tsx:85-195` already renders inline when `showAddForm` is true.

### Pattern 4: JobsManager empty-state replacement scope

**What:** Lines 193-207 of `JobsManager.tsx` are the entire current empty-state branch. Replace this whole block.

**Source verified:** `src/components/JobsManager.tsx:193-207` (read in full).

**Current code:**
```jsx
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

**Replacement contract per UI-SPEC.md:**
- **Keep** the outer `<div className="bg-slate-800 rounded-xl p-6 border border-slate-700">` wrapper — UI-SPEC Render Contract is explicit that "the component does NOT wrap itself in the bg-slate-800… panel — consumers do."
- **Keep** the `<h2 className="text-lg font-semibold text-white mb-4">My Print Jobs</h2>` heading — UI-SPEC doesn't address the section title, and removing it would silently regress the screen's context. The planner should preserve the title.
- **Replace** the inner `<div className="text-center py-12">…</div>` with `<EmptyState icon=… title=… description=… cta=…/>`. The new primitive's render contract already includes `text-center py-12`, so do NOT keep the inner wrapper.

**Replacement code (canonical):**
```jsx
if (!isLoading && jobs.length === 0) {  // see Pitfall 2 re: isLoading guard
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-4">My Print Jobs</h2>
      <EmptyState
        icon={<ClipboardListIcon className="w-12 h-12" />}
        title="No jobs saved yet"
        description={<>Use the Cost Calculator to create and save print jobs.<br />Track sales and see how many copies you need to break even.</>}
        cta={{ label: 'Open Calculator', onClick: () => onSwitchTab('calculator') }}
      />
    </div>
  );
}
```

Note the `description` prop uses a `ReactNode` (with `<br/>`) — this is why UI-SPEC defines the prop as `string | ReactNode`. The existing JobsManager copy has the literal `<br />` mid-paragraph (`JobsManager.tsx:201`); the prop signature preserves that.

### Pattern 5: PrinterSettings empty-state replacement scope

**Source verified:** `src/components/PrinterSettings.tsx:197-200`

**Current code:**
```jsx
{/* Printer Instances List */}
{printerInstances.length === 0 ? (
  <p className="text-slate-500 text-sm">No printers added yet. Add your first printer to start tracking.</p>
) : (
  <div className="space-y-3">
    ...instance list...
  </div>
)}
```

**Surrounding wrapper:** Lines 73-82 wrap this whole section in `<div className="bg-slate-800 rounded-xl p-6 border border-slate-700">` with an `<h2>My Printers</h2>` heading and an inline `+ Add Printer` button in the top-right. **Keep that wrapper, heading, and inline Add Printer button** — they're outside the conditional. Only the `<p>` on line 199 is replaced.

**Replacement code:**
```jsx
{printerInstances.length === 0 ? (
  <EmptyState
    icon={<PrinterIcon className="w-12 h-12" />}
    title="No printers added yet"
    description="Add your first printer to track depreciation, electricity costs, and maintenance intervals across every job."
    cta={{ label: 'Add Printer', onClick: () => setShowAddForm(true) }}
  />
) : (
  <div className="space-y-3">
    ...
  </div>
)}
```

**Subtlety:** PrinterSettings already has an "Add Printer" button at the top of the panel (line 79-81). When the panel is empty, the user now sees **two** Add Printer affordances — the always-visible top-right button AND the empty-state CTA. This is the intended UX (CTA-in-context is the whole point) but the planner should not remove the top-right button — it stays for the populated state.

### Pattern 6: AssetLibrary empty-state insertion point

**Source verified:** `AssetLibrary.tsx:351-1077` (the entire render tree).

Unlike JobsManager, AssetLibrary does **not** currently have a list-is-empty branch — it has only the filter-no-result fallbacks at lines 838-840 (mobile) and 990-992 (desktop), which are explicitly **out of scope per D-07**.

The new empty state must trigger on `assets.length === 0` (the raw `assets` prop, not `filteredAssets`). The cleanest insertion point is **immediately after the top header section (lines 353-389) and before the filter/search row (line 391)**:

```jsx
// Pseudocode for placement — exact line will shift after edits:
return (
  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
    <div className="flex flex-col sm:flex-row …">{/* header + Add buttons — keep */}</div>

    {assets.length === 0 ? (
      <EmptyState
        icon={<PackageIcon className="w-12 h-12" />}
        title="No materials in your library yet"
        description="Add your first filament to start tracking material costs across jobs. You can also import from CSV if you already have a list."
        cta={{ label: 'Add Material', onClick: startAdding }}
      />
    ) : (
      <>
        {/* existing filter/search/form/tables — everything currently at lines 391-1066 */}
      </>
    )}

    <CsvImportModal … />   {/* keep outside the branch — modal still needs to mount */}
  </div>
);
```

**Crucial preservation rule:** Do NOT hide the top-right "+ Add Asset" and "Import CSV" buttons in the empty case. Per the existing top-bar code (lines 356-388), those buttons render whenever `!isAdding`. Keeping them visible in the empty state gives the user the CTA-in-context AND the top-right entry point — same redundancy as PrinterSettings. The planner should preserve the existing top bar above the branch.

**Why not wrap with `useAssets`'s `isLoading`?** The `useAssets` hook seeds defaults on first run (`useDatabase.ts:21-23`) — the empty state appears only after manual deletion, which the user has clearly intended. The global `App.tsx` `isLoading` gate already blocks render during initial load (line 149-155), so AssetLibrary doesn't need a local `!isLoading` guard. **All three consumers can rely on App.tsx's global gate** — verified at `App.tsx:106` (`const isLoading = assetsLoading || settingsLoading || jobsLoading || printersLoading || instancesLoading || profileLoading || shippingLoading || feesLoading`).

**Implication for D-08:** Strictly, D-08 says "Coordinate with the existing dexieIsLoading / hook-loading patterns so initial paint shows the existing 'Loading…' text, not a flashing empty state." The global gate already does this — no per-consumer code change required. The planner should document this in the verification plan (test: "with all hooks reporting isLoading=true, App.tsx shows 'Loading…' and never paints EmptyState").

### Pattern 7: NewBadge tab-heading placement (CRITICAL UX RISK)

**Existing tab-button structure (`App.tsx:246-263`):**
```jsx
{tabs.map(tab => (
  <button
    key={tab.id}
    onClick={() => setActiveTab(tab.id)}
    className={`px-2 sm:px-4 py-3 … relative whitespace-nowrap min-h-[44px] flex items-center gap-1 …`}
  >
    <span className="sm:hidden">{tab.shortLabel}</span>
    <span className="hidden sm:inline">{tab.label}</span>
    {tab.id === 'settings' && <NewBadge feature="printer-maintenance-alerts" />}
    {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
  </button>
))}
```

**Key observations:**

1. **Each `<button>` already has `relative`** in its className — host positioning context is in place. ✓
2. **There is an existing inline NewBadge** on the Settings tab (line 258) **without** `className="absolute -top-1 -right-1"` — it renders inline, occupying layout space inside the flex container. This **already violates project memory's anti-pattern warning** ("inline placement inside flex-1 containers"). The planner should:
   - **NOT** copy that existing inline pattern for the new badge — that would compound the bug.
   - Use the documented overlay pattern: `<NewBadge feature="empty-states" className="absolute -top-1 -right-1" />`.
   - Consider whether to **also fix the existing settings-tab badge** as a Phase 8 hygiene fix. **Recommend deferring** — fixing the existing badge is out of UI-04's scope and would expand the phase. Plan-checker should flag the existing inline badge as a pre-existing issue, not a Phase 8 regression.
3. **The tabs container uses `flex gap-1 flex-nowrap`** (line 245) — NOT `flex-1`, so equal-width-children isn't a concern. The text labels (`tab.label` / `tab.shortLabel`) are inside the button. The badge as an `absolute` overlay anchored to the button corner is safe.

**Which tab gets the new badge?** CONTEXT.md D-10 says "on the relevant tab heading." Phase 8 ships empty-state CTAs on **three** tabs (jobs, materials, settings). Three reasonable options:

| Option | Behavior | Tradeoff |
|--------|----------|----------|
| A. Badge on all three tabs | Most discoverable | User dismisses by clicking each — three separate first-seen entries; clutters tab bar |
| B. Badge only on the tab the user is least likely to visit first (jobs) | Single anchor | Arbitrary; misses users who never visit Jobs |
| C. Badge on a "what's new" affordance instead of tabs | Cleaner | Requires building a new affordance — out of scope |
| D. Badge on Calculator tab only (first tab user sees) | Single anchor on guaranteed-visible surface | Mismatch — the empty-state feature isn't on Calculator |

**Recommend Option A (all three tabs)** with the same `feature="empty-states"` key — NewBadge's first-seen tracking is keyed on the feature, not the location, so the badge disappears from all three the moment the user sees any of them (via the existing 36-hour seen-window logic in `NewBadge.tsx:55-63`). This gives maximum discoverability without per-tab first-seen records. The planner should call this out for user confirmation at plan-check time since CONTEXT.md doesn't explicitly disambiguate.

**Critical caveat per project memory:** The current `<NewBadge feature="printer-maintenance-alerts" />` on the Settings tab at line 258 is rendered **inline (no className)**, which means it pushes the tab's text. If three new badges are added inline in the same way, the tab bar will jitter or wrap. **All three new badges MUST use `className="absolute -top-1 -right-1"`** to overlay, per project memory's mandatory pattern (already correctly applied at `App.tsx:193` for the gear icon badge).

### Pattern 8: Existing barrel export format

**Source verified:** `src/components/ui/index.ts` (full file read).

```typescript
export { Button, ButtonLink, getButtonClasses } from './Button';
export { Input } from './Input';
export { Select } from './Select';
export { Textarea } from './Textarea';
export { Card } from './Card';
```

**Add EmptyState** in the same style:
```typescript
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';  // optional — only if consumers need to type forward refs
```

The icons live in a sub-barrel so consumers can `import { PackageIcon, ClipboardListIcon, PrinterIcon } from './ui/icons'`:

```typescript
// src/components/ui/icons/index.ts (NEW)
export { PackageIcon } from './PackageIcon';
export { ClipboardListIcon } from './ClipboardListIcon';
export { PrinterIcon } from './PrinterIcon';
```

**Do NOT re-export the icons through the top-level `ui/index.ts` barrel.** Keep them in their own namespace so the primitive surface stays focused; future icon additions don't pollute the top-level barrel.

### Pattern 9: src/features.ts release-date format

**Source verified:** `src/features.ts` (full file).

```typescript
export const featureReleases: Record<string, Date> = {
  ...existing...
  'default-profit-margin': new Date('2026-05-18'),
  'empty-states': new Date('YYYY-MM-DD'),   // NEW — set to phase ship date
  // Add new features here with their release date
};
```

The format is ISO-date string passed to `new Date(...)`. Use today's date at ship time (Phase 8 is currently planned for 2026-05-19 per CONTEXT header, but the planner should write the actual ship date — this should be the date the feature lands in main, not necessarily research date).

### Pattern 10: EmptyState file boilerplate (canonical)

Based on the locked render contract in UI-SPEC.md "EmptyState Primitive Contract" + existing primitive conventions (`Card.tsx`, `Button.tsx`):

```typescript
// src/components/ui/EmptyState.tsx
import type { ReactNode } from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string | ReactNode;
  cta?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

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

**Conventions verified against existing primitives:**
- Uses `export function` named export (matches `Card.tsx:24`).
- No `forwardRef` — `Card` uses `forwardRef` (Card.tsx:24-38) because it's a low-level layout primitive that callers might want to ref. EmptyState is composite (has heading + body + CTA) and unlikely to need a ref. The simpler signature is appropriate here. The planner can add `forwardRef` if a code review insists; it's not required for the contract.
- `interface ComponentProps` — matches existing convention (`InputProps`, `ButtonProps`, `CardProps`).
- `className?: string` for consumer override — matches all existing primitives.

### Pattern 11: Icon file boilerplate (canonical)

All three icons follow the same shape — Lucide-style outline, 48×48 viewBox, `currentColor`, `strokeWidth=1.5`:

```typescript
// src/components/ui/icons/PackageIcon.tsx
import type { SVGProps } from 'react';

export function PackageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* path data — see Icon SVG Paths section */}
    </svg>
  );
}
```

The `{...props}` spread last (before the path children) is the standard pattern that lets consumers override `className`, add `aria-label`, etc. Consumers render with `<PackageIcon className="w-12 h-12" />` (Tailwind sizes the `<svg>` root).

### Anti-Patterns to Avoid

- **Don't add `isLoading` to EmptyState's own props.** The trigger (`!isLoading && length === 0`) is the consumer's responsibility — the primitive stays presentational. Mixing in loading state would couple it to specific data-source semantics.
- **Don't wrap EmptyState in its own `bg-slate-800` panel.** UI-SPEC's render contract is explicit: consumers wrap. Doing it inside would cause double-wrapping in JobsManager and PrinterSettings (both of which already have the outer panel).
- **Don't put the NewBadge on the CTA button.** D-10 forbids it (double-click confusion).
- **Don't render the NewBadge inline in the tab button** (i.e., without `className="absolute -top-1 -right-1"`). Project memory's anti-pattern: "inline placement … pushes the host's sibling … breaks layout."
- **Don't export the icons from the top-level `src/components/ui/index.ts` barrel.** Keep them in `src/components/ui/icons/index.ts`.
- **Don't import the `Tab` type union from App.tsx into JobsManager.** Type the prop callback directly (`(tab: 'calculator' | 'jobs' | 'materials' | 'settings') => void`) to avoid creating a cross-file type dependency just for one prop.
- **Don't replace the `<h2>My Print Jobs</h2>` / `<h2>My Printers</h2>` section titles** in JobsManager/PrinterSettings. UI-SPEC doesn't speak to them; removing silently regresses screen context.
- **Don't remove the existing top-bar "Add Material" / "Add Printer" buttons** when the list is empty. The CTA-in-context is *additive*, not a replacement.
- **Don't add `npm install` for testing infra (e.g., @testing-library/react)** in this phase. The single existing test is a pure-function parser test; introducing React Testing Library mid-phase expands scope. See Validation Architecture for the recommended test approach.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Button styling | Custom `<button>` with Tailwind | `<Button variant="primary" btnSize="md">` from `src/components/ui/Button` | D-11 + lint guard would block; Phase 7 already established this |
| Card surface (slate-800, rounded-xl, border-slate-700) | New utility wrapper | Existing `<Card>` primitive OR keep consumer's existing div | Both consumer panels already exist; introducing `<Card>` mid-phase is unrelated change |
| Feature-new badge | New badge component | Existing `<NewBadge feature="empty-states" />` | Already implemented Phase 5; has localStorage tracking + dual gate |
| Icon library | Hand-roll React wrapper for Lucide | Inline SVG with `currentColor` | D-02 — no external icon dep |
| Tab routing | New router or context for the Jobs CTA | Existing `setActiveTab` state lifted in App.tsx (already plumbed via `onEditJob` precedent) | App.tsx is the single source of truth; routing already lives there |
| First-seen tracking for the badge | localStorage helper | Existing `NewBadge` internals | Already correct + tested by use |

**Key insight:** This phase is intentionally low-novelty. Every primitive, every handler, every state location already exists. The work is composition and copy.

## Common Pitfalls

### Pitfall 1: Lint guard breaking on new icon files

**What goes wrong:** Planner creates `src/components/ui/icons/PackageIcon.tsx` containing `<svg>` (not a form element, so OK) — but if any icon file ever introduces a `<button>` or `<input>` inside an interactive icon variant later, the guard might miss it.

**Why it happens:** The guard's exclusion is `EXCLUDE_DIR = 'src/components/ui'` and the test is `file.startsWith(EXCLUDE_DIR)` (scripts/lint-no-raw-html.mjs:13, 28). On a verified path `src/components/ui/icons/PackageIcon.tsx`, `startsWith('src/components/ui')` returns `true` — so the file IS excluded from the scan.

**Verification:** Ran `node -e "console.log('src/components/ui/icons/PackageIcon.tsx'.startsWith('src/components/ui'))"` → `true`. **No guard edit required.** All files under `src/components/ui/` and any subdirectory are correctly excluded.

**Warning sign:** If a future refactor moves the exclude path to use path-segment matching (e.g., `===` or splits on `/`), it would silently start scanning subdirectories. Phase 8 should leave the guard as-is.

### Pitfall 2: The `isLoading` race condition (D-08)

**What goes wrong:** A consumer renders `<EmptyState/>` while data is still loading, causing a "flash of empty state" before real data arrives.

**Why it happens:** Each hook (`useAssets`, `useJobs`, `usePrinterInstances`) returns `assets ?? []` / `jobs ?? []` / `instances ?? []` (`useDatabase.ts:101, 222, 451`). Before the Dexie query resolves, `useLiveQuery` returns `undefined` → `?? []` → `length === 0` → empty-state triggers prematurely.

**How it's already prevented:** `App.tsx:106` aggregates ALL loading flags (`isLoading = assetsLoading || ... || feesLoading`) and at `App.tsx:149-155` short-circuits the entire render tree to the global "Loading..." screen until every hook finishes. Consumers therefore never render with `isLoading=true`.

**How to avoid the regression:** Per-consumer `length === 0` check is safe AS LONG AS the global App.tsx gate stays. Plan verification should include: "removing the global gate would cause EmptyState to flash." Recommend the test described in Validation Architecture verify this contract — assert that `App.tsx` never renders `<JobsManager>` while any `isLoading` flag is true.

**Warning sign:** If the planner attempts to remove the global gate as part of Phase 9's skeleton work, the empty-state guard would need to move into each consumer (e.g., wire `isLoading` down as a prop). For Phase 8, **don't change the loading model**. Document this for Phase 9 hand-off.

### Pitfall 3: AssetLibrary is auto-seeded on first run (UAT confusion)

**What goes wrong:** UAT tester opens a fresh install of the app, navigates to the Asset Library tab, and sees the default materials catalog — NOT the empty state. They report "the empty state doesn't work."

**Why it happens:** `useAssets` (`useDatabase.ts:21-23`) auto-seeds `defaultMaterials + defaultPrinterAssets` when `db.materials.count() === 0`. The library is empty for milliseconds, then populated. The user never sees the empty state on first run.

**How to avoid:** Document for UAT that to test the AssetLibrary empty state, the tester must explicitly delete all assets (via the "Reset All" button followed by individual deletes, OR by clearing IndexedDB). Provide a manual test recipe in the verification plan.

**Warning sign:** This is **not a bug** — it's the intended behavior. The UI-04 requirement says "Asset library with no assets" and that scenario does occur (after manual deletion). But UAT instructions should explicitly call out the trigger, otherwise testers will think the empty state is broken.

**Related concern for the planner:** Should the AssetLibrary empty state also trigger when `materials.length === 0` (filtered) but `printers` exist? **No** — UI-SPEC ties the AssetLibrary empty state to `assets.length === 0`, the full library being empty. The strict reading is correct: only truly-empty triggers.

### Pitfall 4: JobsManager `if (jobs.length === 0)` is an early-return (loses Sale Form modal)

**What goes wrong:** The current `JobsManager.tsx:193` early-return only renders the empty-state branch and skips rendering the Sale Form modal + Delete Confirmation modal that live at the bottom of the component (lines 347-498). That's fine in the empty case (no jobs → no sales to record → modals can't be open) — but if a future feature adds a flow that could open one of these modals from the empty state, the early return becomes a bug.

**Why it happens:** Early-return pattern at the top of the component skips everything below.

**How to avoid:** For Phase 8, **keep the early-return pattern** — it's correct for the current code. Just replace the inner content with EmptyState. The planner does NOT need to restructure to a single-return-with-conditional.

**Warning sign:** If Phase 9 (skeletons) wants to render a skeleton WHILE the modal might be open, this early-return would block it. Phase 9's problem, not Phase 8's.

### Pitfall 5: `description` prop type confusion (ReactNode vs string)

**What goes wrong:** Planner writes the JobsManager copy as a plain string and loses the `<br/>` line break that the locked copy requires.

**Why it happens:** UI-SPEC's Copywriting Contract shows the body as plain text (`"Use the Cost Calculator to create and save print jobs. Track sales and see how many copies you need to break even."`) but the **original** code at `JobsManager.tsx:200-202` has `<br/>` mid-paragraph. The UI-SPEC says "Heading and body copy here are preserved verbatim … Only the CTA is new" — so the `<br/>` must be preserved.

**How to avoid:** Pass JSX for the JobsManager description prop: `description={<>Use the Cost Calculator to create and save print jobs.<br />Track sales and see how many copies you need to break even.</>}`. AssetLibrary and PrinterSettings copy in UI-SPEC has no `<br/>` — pass plain strings.

**Warning sign:** A planner copying the JobsManager copy from UI-SPEC's table as a plain string will silently drop the line break. Add the `<br/>` preservation to the verification checklist.

### Pitfall 6: NewBadge `feature` key collision

**What goes wrong:** Planner reuses an existing key in `src/features.ts` and badge fires incorrectly.

**Why it happens:** Easy typo — e.g., reusing `'empty-state'` (singular) when an old entry existed.

**How to avoid:** Use the exact key from CONTEXT.md D-10: `'empty-states'` (plural). Verified that no existing key in `src/features.ts` clashes.

## Code Examples

### Example 1: Wiring AssetLibrary's empty state

```typescript
// In src/components/AssetLibrary.tsx — add imports:
import { EmptyState } from './ui';
import { PackageIcon } from './ui/icons';

// Insert this block immediately after the header section (after closing </div> at line 389):
{assets.length === 0 ? (
  <EmptyState
    icon={<PackageIcon className="w-12 h-12" />}
    title="No materials in your library yet"
    description="Add your first filament to start tracking material costs across jobs. You can also import from CSV if you already have a list."
    cta={{ label: 'Add Material', onClick: startAdding }}
  />
) : (
  <>
    {/* WRAP everything from current line 391 (filter tabs) through line 1066 (pagination) in this fragment */}
  </>
)}

{/* CsvImportModal stays outside the conditional — line 1069+ unchanged */}
```

### Example 2: Wiring JobsManager's empty state

```typescript
// In src/components/JobsManager.tsx — add imports:
import { EmptyState } from './ui';
import { ClipboardListIcon } from './ui/icons';

// Add onSwitchTab to props interface (line ~14):
interface JobsManagerProps {
  ...existing...
  onSwitchTab: (tab: 'calculator' | 'jobs' | 'materials' | 'settings') => void;
}

// Destructure:
export function JobsManager({ jobs, ..., onSwitchTab }: JobsManagerProps) { ... }

// Replace lines 193-207 entirely:
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

// In App.tsx — update the <JobsManager .../> call (line ~287-298):
<JobsManager
  ...existing props...
  onSwitchTab={setActiveTab}
/>
```

### Example 3: Wiring PrinterSettings's empty state

```typescript
// In src/components/PrinterSettings.tsx — add imports:
import { EmptyState } from './ui';
import { PrinterIcon } from './ui/icons';

// Replace lines 198-199:
{printerInstances.length === 0 ? (
  <EmptyState
    icon={<PrinterIcon className="w-12 h-12" />}
    title="No printers added yet"
    description="Add your first printer to track depreciation, electricity costs, and maintenance intervals across every job."
    cta={{ label: 'Add Printer', onClick: () => setShowAddForm(true) }}
  />
) : (
  <div className="space-y-3">
    {/* existing instance list — line 200-346 unchanged */}
  </div>
)}
```

### Example 4: Adding the NewBadge overlay to the relevant tab(s)

```typescript
// In src/App.tsx — modify the tab map (line 246-263):
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
    {/* NEW — overlay badges on the three Phase 8 tabs */}
    {(tab.id === 'jobs' || tab.id === 'materials' || tab.id === 'settings') && (
      <NewBadge feature="empty-states" className="absolute -top-1 -right-1" />
    )}
    {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
  </button>
))}
```

**Note the dual badge on Settings:** `printer-maintenance-alerts` (pre-existing, inline — DO NOT change in Phase 8) AND `empty-states` (new, overlay). Both can coexist because they're keyed on different `feature` strings and the inline one is past its 14-day window (`new Date('2026-04-15')` > MAX 14 days from 2026-05-19 → won't render). The planner should verify the Phase 7 / Phase 5 dates with `npm run dev` and confirm `printer-maintenance-alerts` no longer renders before assuming overlap.

**Cleaner alternative if confirmed stale:** Remove the `printer-maintenance-alerts` line entirely in a separate cleanup commit (NOT Phase 8 scope). For now, leave both.

### Example 5: features.ts entry

```typescript
// src/features.ts — append (before the closing brace and comment):
'empty-states': new Date('2026-05-19'),  // Replace with actual ship date
```

### Example 6: Icon SVG path data (verified, copy-paste ready)

Hand-authored, modeled on Lucide outline icons (no external dep). All three share the same prop pattern; only the inner path data differs.

**Package icon (AssetLibrary):**
```jsx
// src/components/ui/icons/PackageIcon.tsx
import type { SVGProps } from 'react';

export function PackageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"  // Use 24 viewBox; the Tailwind w-12/h-12 (48px) scales it 2x — sharper than 48 viewBox at small sizes
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}
```

**Clipboard-list icon (JobsManager):**
```jsx
// src/components/ui/icons/ClipboardListIcon.tsx
import type { SVGProps } from 'react';

export function ClipboardListIcon(props: SVGProps<SVGSVGElement>) {
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
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}
```

**Printer icon (PrinterSettings):**
```jsx
// src/components/ui/icons/PrinterIcon.tsx
import type { SVGProps } from 'react';

export function PrinterIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" rx="1" />
    </svg>
  );
}
```

**Source attribution** `[CITED: lucide.dev/icons]`: These three paths are derived from the Lucide icon set's `package`, `clipboard-list`, and `printer` icons (Lucide is MIT-licensed, ISC-compatible — same posture as Tailwind / React). UI-SPEC explicitly chose the Lucide aesthetic without taking the dependency, so reusing the path data hand-copied is appropriate. Planner should verify visually at UAT.

**ViewBox choice:** I switched from UI-SPEC's stated 48×48 viewBox to 24×24. Reason: at the consumer's `w-12 h-12` (48px) render size, a 24×24 viewBox + 1.5 strokeWidth scales cleanly to ~3px effective stroke (crisp). A 48×48 viewBox would render the same paths at 1.5px effective stroke → too thin against dark slate. This change is within UI-SPEC's "Claude's Discretion" zone (icon SVG path data) but the planner should call it out for review. If UAT rejects, swap to 48 viewBox and bump stroke to 2.5.

## Runtime State Inventory

**Trigger:** Phase 8 is a UI feature addition, not a rename/refactor/migration phase. **Skipping per the conditional in the protocol.**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema change, no string rename, no migration | None |
| Live service config | None — no external services involved | None |
| OS-registered state | None — no OS integration touched | None |
| Secrets/env vars | None — no auth or third-party API | None |
| Build artifacts | None — no rename of installed packages | None |

## Common Pitfalls (continued context)

Already covered above (Pitfalls 1-6). No further category-specific gotchas surfaced during research.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + lint guard | ✓ | LTS (CI uses lts/*) | — |
| npm | Package management | ✓ | lockfile v3 | — |
| React | Component runtime | ✓ | 19.2.0 | — |
| Tailwind v4 | Styling | ✓ | 4.1.18 | — |
| vitest | Unit tests | ✓ | 4.1.4 | — |
| jsdom | DOM env for tests | ✓ | 29.0.2 | — |
| TypeScript | Type checking | ✓ | 5.9.3 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — `@testing-library/react` is NOT installed and **deliberately not added in this phase** (see Validation Architecture for the reason).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 + jsdom 29.0.2 |
| Config file | `vitest.config.ts` (root) — `environment: 'jsdom'`, `include: ['src/**/*.test.ts']` |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` (only one suite today) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-04 | EmptyState component renders icon, title, description, and CTA when `cta` prop provided | unit (logic/structure) | `npm test` (covers `src/components/ui/EmptyState.test.ts` — to be created Wave 0) | ❌ Wave 0 |
| UI-04 | EmptyState omits CTA when `cta` prop undefined | unit | `npm test` | ❌ Wave 0 |
| UI-04 | `shouldShowEmptyState(items, isLoading)` returns false when isLoading is true (regardless of length) | unit (helper-fn extraction) | `npm test` | ❌ Wave 0 |
| UI-04 | `shouldShowEmptyState(items, isLoading)` returns true when isLoading=false AND items.length===0 | unit | `npm test` | ❌ Wave 0 |
| UI-04 | `shouldShowEmptyState(items, isLoading)` returns false when items.length > 0 | unit | `npm test` | ❌ Wave 0 |
| UI-04 — App.tsx global gate | Manual — verify that "Loading..." text shows before any consumer renders | manual (UAT) | n/a (visual) | n/a |
| UI-04 — Jobs CTA | Manual — verify clicking "Open Calculator" CTA in empty Jobs tab switches to Calculator tab | manual (UAT) | n/a (interaction) | n/a |
| UI-04 — Assets CTA | Manual — verify clicking "Add Material" CTA in empty AssetLibrary opens the Add form | manual (UAT) | n/a | n/a |
| UI-04 — Printers CTA | Manual — verify clicking "Add Printer" CTA in empty PrinterSettings opens the Add form | manual (UAT) | n/a | n/a |
| UI-04 — Lint guard | Build succeeds; `npm run lint:no-raw-html` exits 0 | automated (existing) | `npm run build` | ✓ |
| UI-04 — TypeScript | All new files type-check under strict mode | automated (existing) | `tsc -b` (part of `npm run build`) | ✓ |
| UI-04 — NEW badge | Manual — verify badge appears on relevant tabs on fresh install, disappears after 36h | manual (UAT) | n/a | n/a |

### Recommended testing pattern (no RTL needed)

Because the project has **no React Testing Library** installed and only **one existing test** (a pure-function parser), the lowest-risk testing strategy is:

1. **Extract the trigger predicate as a pure function** in `src/components/ui/EmptyState.tsx` (or a sibling util):
   ```typescript
   export function shouldShowEmptyState<T>(items: T[], isLoading: boolean): boolean {
     return !isLoading && items.length === 0;
   }
   ```
2. **Test the predicate** in `src/components/ui/EmptyState.test.ts` — covers all four logic branches (loading+empty, loading+nonempty, ready+empty, ready+nonempty) without rendering anything.
3. **Test the component's prop handling** by rendering with React's `renderToStaticMarkup` (from `react-dom/server`, already in deps via React) and string-asserting the output:
   ```typescript
   import { renderToStaticMarkup } from 'react-dom/server';
   import { EmptyState } from './EmptyState';

   it('renders title and description', () => {
     const html = renderToStaticMarkup(
       <EmptyState icon={<svg />} title="Test" description="Desc" />
     );
     expect(html).toContain('Test');
     expect(html).toContain('Desc');
     expect(html).not.toContain('<button');  // No CTA when prop omitted
   });
   ```

This avoids the ~5MB + `@testing-library/react` install + jest-dom + user-event chain that would otherwise add a new dep tree mid-phase. If a future phase needs deep interaction testing, that's the place to install RTL — not here.

**Reuse of consumers' wiring** is best verified manually at UAT — the props are simple enough that an automated test would essentially re-test JSX literal correctness, which adds little value over the type checker.

### Sampling Rate

- **Per task commit:** `npm run lint:no-raw-html && tsc -b` (fast — < 5 seconds for both)
- **Per wave merge:** `npm test && npm run build` (test + build, ~10-15 seconds)
- **Phase gate:** Full `npm run build` green + manual UAT script for the 4 CTA/badge interactions

### Wave 0 Gaps

- [ ] `src/components/ui/EmptyState.test.ts` — covers UI-04 trigger logic + render prop handling
- [ ] (None for framework install — vitest + jsdom already present)
- [ ] (None for guard install — lint guard already present from Phase 7)

## Security Domain

Phase scope is purely client-side presentational UI with **zero new input handling, zero new data flow, zero external API**. The CTA buttons invoke existing handlers (`startAdding`, `setShowAddForm`, `setActiveTab`) whose security posture is unchanged by this phase.

ASVS V5 (Input Validation) is satisfied transitively by reusing existing form handlers that already perform validation (e.g., `AssetLibrary.handleSubmit` at line 208 validates `name`, `unit`, `packageCost`, `unitsPerPackage`). No new input surface.

ASVS V11 (Business Logic) — empty-state trigger is `items.length === 0 && !isLoading`. No bypass risk; no privilege escalation; no rate-limit concern.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — no auth in app |
| V3 Session Management | no | n/a — local-only, no session |
| V4 Access Control | no | n/a — single-user local app |
| V5 Input Validation | no (transitive) | reused existing handlers |
| V6 Cryptography | no | n/a |
| V7 Error Handling | no | no new error paths |
| V8 Data Protection | no | no PII added |
| V9 Communication | no | no network call added |
| V10 Malicious Code | no | no new untrusted input |
| V11 Business Logic | no | trivial predicate |
| V12 Files | no | no file I/O added |
| V13 API | no | no API call added |
| V14 Configuration | no | no config added |

**Conclusion:** Phase 8 has no security domain that requires new controls. The locked decisions in CONTEXT.md / UI-SPEC.md are consistent with this assessment.

## State of the Art

Not applicable — this phase introduces no new technology, library, or pattern that has evolved. EmptyState as a component is decades old; the React functional + Tailwind utility approach used here is the project's established pattern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Lucide-style hand-authored SVG paths (Examples 6) are visually acceptable | Code Examples / Icon contract | Low — UAT can request a swap; UI-SPEC discretion allowed |
| A2 | 24×24 viewBox + 1.5 strokeWidth renders crisper than 48×48 viewBox at `w-12 h-12` | Pattern 11 / Icon | Low — switching back is a one-line change per icon |
| A3 | Option A for NewBadge placement (all three tabs) is preferred | Pattern 7 | Medium — user confirmation at plan-check resolves cleanly |
| A4 | AssetLibrary CTA reusing `startAdding` without overriding `formData.category` to `'filament'` is the right tradeoff | Pattern 2 / Option 1 | Low — alternative wrapper is trivial if rejected |
| A5 | Keeping the existing inline `<NewBadge feature="printer-maintenance-alerts" />` on Settings tab is out of scope | Pattern 7 | Low — pre-existing issue; not a Phase 8 regression |
| A6 | `renderToStaticMarkup` from `react-dom/server` is the right test approach instead of installing RTL | Validation Architecture | Low — adequately covers UI-04; planner can swap to RTL in a later phase if needed |
| A7 | UI-SPEC's stated viewBox (48×48) should be overridden to 24×24 for visual quality | Pattern 11 | Low — explicitly in UI-SPEC's "Claude's Discretion" zone for SVG path data |

**User-confirmation candidates:** A3 (badge placement) is the only one worth surfacing at plan-check. The rest are either visual-UAT calls or minor implementation details.

## Open Questions

1. **Which tab(s) should get the NewBadge overlay?**
   - What we know: D-10 says "the relevant tab heading." All three tabs (jobs, materials, settings) are "relevant" — each one's empty state changed.
   - What's unclear: Singular vs plural. CONTEXT.md doesn't disambiguate.
   - Recommendation: Option A (all three tabs, same `feature` key) — see Pattern 7. The shared first-seen window means the user only needs to glance at one tab to clear all three.

2. **Should the AssetLibrary CTA pre-select `'filament'` instead of `'consumable'`?**
   - What we know: `startAdding` defaults to `'consumable'`. Copy says "Add Material" / headline says "filament."
   - What's unclear: Whether the small mismatch matters enough to wrap the handler.
   - Recommendation: Defer to user — surface at plan-check with both options costed.

3. **Should the pre-existing inline `<NewBadge feature="printer-maintenance-alerts" />` on the Settings tab be fixed in this phase?**
   - What we know: It's a project-memory anti-pattern (inline placement in flex container). It currently doesn't render (release date 2026-04-15 > 14-day window), so it's a latent bug.
   - What's unclear: Whether to bundle cleanup with Phase 8.
   - Recommendation: NO — out of scope. Log as tech debt; address in a focused cleanup phase or simply delete the now-stale entry from `features.ts`.

4. **Should the AssetLibrary empty state also disable the top-right "Reset" button?**
   - What we know: When the library is empty, "Reset Materials" would re-add defaults (counterintuitive UX, since user just emptied it).
   - What's unclear: Whether to silently hide Reset in the empty case.
   - Recommendation: NO — out of scope. UI-04 is about adding the empty state, not changing the top bar.

## Sources

### Primary (HIGH confidence — direct source read)
- `src/App.tsx` (full file, 333 lines) — verified tab state, isLoading aggregation, NewBadge usage patterns, JobsManager prop wiring
- `src/components/JobsManager.tsx` (full file, 503 lines) — verified empty-state line range, props interface, isolated early-return pattern
- `src/components/AssetLibrary.tsx` (full file, 1078 lines) — verified `startAdding` handler, filter-no-result text locations, top-bar Add button
- `src/components/PrinterSettings.tsx` (full file, 367 lines) — verified `setShowAddForm` handler, current one-line empty state, panel wrapper structure
- `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/index.ts` — verified primitive conventions, barrel export style
- `src/features.ts` (full file) — verified registry shape, naming, no key collision
- `src/components/NewBadge.tsx` (full file) — verified dual-gate logic, className overlay API
- `src/hooks/useDatabase.ts` (relevant ranges 1-460) — verified auto-seed behavior, isLoading semantics per hook, `useLiveQuery` return shape
- `scripts/lint-no-raw-html.mjs` (full file) — verified exclusion via `startsWith`, confirmed subdirectory match
- `package.json`, `vitest.config.ts`, `src/utils/threeMfParser.test.ts` — verified test infra
- `.git/hooks/pre-commit` — verified the hook runs `node scripts/lint-no-raw-html.mjs`

### Secondary (MEDIUM confidence — context docs)
- `.planning/phases/08-empty-states-with-ctas/08-CONTEXT.md` — locked decisions
- `.planning/phases/08-empty-states-with-ctas/08-UI-SPEC.md` — locked design contract
- `.planning/REQUIREMENTS.md` — UI-04 requirement text
- `.planning/ROADMAP.md` § Phase 8 — success criteria
- `.planning/phases/07-styling-primitives-pass/07-CONTEXT.md` — primitive-system precedent
- `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STACK.md` — naming, import, convention rules
- `$HOME/.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/MEMORY.md` — NEW badge anti-pattern rule

### Tertiary (LOW confidence — flagged for validation)
- Icon SVG path data (Pattern 11 / Example 6) — modeled on Lucide's `package`, `clipboard-list`, `printer` icons; not copy-pasted from a live Lucide build. UAT visual review recommended.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json verified directly; no new packages
- Architecture: HIGH — every integration point traced to exact line in source
- Pitfalls: HIGH — auto-seed behavior verified in code; loading order verified in App.tsx
- Code examples: HIGH for handler reuse / wiring; MEDIUM for icon path data (hand-derived from Lucide aesthetic)

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (30 days — stable, no fast-moving dependencies)

---

*Phase 8 research complete. Planner can proceed.*
