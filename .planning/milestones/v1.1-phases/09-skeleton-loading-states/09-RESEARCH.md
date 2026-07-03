# Phase 9: Skeleton Loading States - Research

**Researched:** 2026-05-19
**Phase requirement IDs:** UI-05
**Domain:** React 19 / TypeScript per-consumer loading UI replacing a global "Loading…" gate
**Confidence:** HIGH (every claim verified against current source — no library/version research needed; the change is wiring + a 1-file primitive on top of Phase 7/8 foundations)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Loading gate moves per-consumer.** App.tsx drops the global `if (isLoading)` block at [src/App.tsx:149-155](src/App.tsx:149) and the OR-chain at [src/App.tsx:106](src/App.tsx:106) (or keeps `isLoading` as a derived value only if a consumer still needs aggregate state — planner decides). AssetLibrary, JobsManager, and PrinterSettings each read their own loading flag from their respective hooks (`useAssets`, `useJobs`, `usePrinterInstances`) and render their own skeleton.

**D-02 — Single `Skeleton` primitive** in `src/components/ui/Skeleton.tsx`. Variants `'line' | 'card' | 'circle'`. Configurable `width`, `height`, `rounded`. `animate-pulse` built in. Exported from `src/components/ui/index.ts`.

**D-03 — Three composed list skeletons** (`AssetListSkeleton`, `JobsListSkeleton`, `PrinterListSkeleton`) defined inside their respective consumer files — NOT in a separate `skeletons/` directory. Co-location keeps shapes in sync with real layouts.

**D-04 — Tailwind `animate-pulse`** on every skeleton element. Already used at [src/pages/LandingPage.tsx:16](src/pages/LandingPage.tsx:16). No custom CSS, no keyframes, no new deps.

**D-05 — Skeleton renders immediately** when `isLoading` is true. No debounce, no minimum display duration. A single-frame flash on instant loads is acceptable.

**D-06 — Scope is exactly three list screens:** AssetLibrary, JobsManager, PrinterSettings. Calculator tab, marketing surfaces, modals, and any other UI continue to render without skeletons.

**D-07 — CostCalculator empty-dropdown flash is acceptable.** Do NOT patch CostCalculator selectors. The empty-dropdown moment is too brief and too rare to justify the change.

**D-08 — No NEW badge for `skeleton-loading`.** Skeletons fall on the Phase 7 side of the visibility line. Do NOT register a feature key in `src/features.ts` for this phase.

**D-09 — No broader "Loading…" sweep.** Scope is exactly the App.tsx Loading text removal called out by UI-05 plus the three list-screen skeletons. Other inline "Loading…" strings (SettingsModal, UserProfileModal) stay.

**D-10 — Render order is canonical and explicit:**
```
isLoading
  ? <ListSkeleton/>
  : shouldShowEmptyState(items, isLoading)
    ? <EmptyState/>
    : <RealList/>
```
Skeleton never co-exists with EmptyState or RealList. `shouldShowEmptyState` already returns `!isLoading && items.length === 0`, so the predicate alone is sufficient — but the planner SHOULD use the explicit `isLoading ? skeleton : predicate-check` structure for readability.

**D-11 — Lint guard stays green.** `Skeleton.tsx` lives in `src/components/ui/` (excluded from scan). The three composed list skeletons in consumer files compose only `<Skeleton>` and `<div>`; no raw `<button>`, `<input>`, `<select>`, or `<textarea>` introduced.

### Claude's Discretion

- The exact dimensions of each Skeleton variant (line height, card padding, etc.) — planner picks values that match the real list rows' shapes; constraint: skeleton row count should approximate the real list's first-paint row count (3–5 rows is a safe default).
- The exact aggregation of remaining App.tsx `isLoading` flags (settings/profile/fees) — planner decides whether they're still needed anywhere else or can be dropped entirely.

### Deferred Ideas (OUT OF SCOPE)

- Broader inline "Loading…" sweep across modals (SettingsModal, UserProfileModal, etc.)
- Skeleton support for CostCalculator selectors during initial asset/printer load
- Skeleton variants beyond `line`/`card`/`circle` (e.g., `table-row`, `chart`)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-05 | "Skeleton loading components are shown during initial IndexedDB load — assets list, jobs list, and printer list each have their own skeleton shape matching the final content layout. The plain 'Loading…' text in App.tsx is removed." | Existing Architecture (App.tsx loading flag landscape), Per-Consumer Integration (3 consumer maps), Skeleton Primitive Shape, Pitfalls 1-3 (hook ordering, flash, render-after-load) |
</phase_requirements>

---

## Summary

Phase 9 is **pure presentational refactor on top of fully locked decisions**. CONTEXT.md D-01..D-11 lock the primitive shape, render order, animation choice, and badge omission. There are no library trade-offs, no API to choose, and no new tools to install. The work is:

1. **One new primitive** — `src/components/ui/Skeleton.tsx` exporting a `<Skeleton>` component with three variants and basic dimension props. Add to `src/components/ui/index.ts`. Mirror `Card.tsx` / `EmptyState.tsx` conventions.
2. **Three co-located composed skeletons** — `AssetListSkeleton`, `JobsListSkeleton`, `PrinterListSkeleton` defined inside their consumer files (not a `skeletons/` folder).
3. **Surgical App.tsx edit** — remove lines 106 (`const isLoading = …`) and 149-155 (the `if (isLoading) return …` block). The eight per-hook `isLoading: xxxLoading` destructurings get pruned to only the three the consumers need (`assetsLoading`, `jobsLoading`, `instancesLoading`).
4. **Three consumer wirings** — AssetLibrary, JobsManager, PrinterSettings each accept an `isLoading` prop from App.tsx, then render `isLoading ? <ListSkeleton/> : shouldShowEmptyState(items, isLoading) ? <EmptyState/> : <RealList/>` per D-10.
5. **Activate the predicate** — `shouldShowEmptyState` (currently dead code per 08-REVIEW IN-01) is re-exported from `src/components/ui/index.ts` and called in all three consumers.

The integration is mechanical because Phase 8 already wired `EmptyState` into the exact JSX block each consumer uses. The only structural risk is **hook-ordering**: each consumer's existing `if (jobs.length === 0)` (JobsManager) or `{items.length === 0 ?}` (AssetLibrary/PrinterSettings) sits AFTER all hook declarations, so adding the `isLoading` branch in the same position is safe (Pitfall 1).

**One material concern surfaced** and is flagged for the planner: removing the global App.tsx gate means CostCalculator (the always-visible default tab) now renders with potentially-undefined `materials`, `printers`, `printerInstances`, `userProfile`, `shippingConfig`, `marketplaceFees`. Every consumer in the codebase already defaults arrays to `[]` (verified in useDatabase.ts) and object hooks return their default object synchronously on first paint (the `useState(default…)` pattern, verified at useDatabase.ts:233, 254, 275, 303, 337, 386). So CostCalculator will not crash — but the planner MUST verify each prop's first-paint value is safe. The empty-dropdown flash D-07 calls out is the visible symptom of this; verified non-crashing.

**Primary recommendation:** Two-plan split.

- **Plan 09-01 (Wave 1):** Ship the `Skeleton` primitive + add `shouldShowEmptyState` to the `ui/index.ts` barrel + unit tests for variants and `animate-pulse` class. No consumer wiring yet. Build/lint must pass with the primitive present but unused.
- **Plan 09-02 (Wave 2):** Modify App.tsx (remove gate, prune isLoading flags, drill `isLoading` props down to three consumers) and wire each of the three consumers (AssetLibrary, JobsManager, PrinterSettings) with their composed list skeleton + D-10 render order. Manual UAT on cold-reload + visual fidelity check.

This split keeps the foundation reviewable on its own and lets the consumer wiring fail loudly if the primitive contract was wrong.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Skeleton bar rendering (one `<div>` per variant with `animate-pulse`) | Browser / Client (primitive in `src/components/ui/`) | — | Pure presentational; no state, no data, no side effects |
| Composed list-shape skeletons (3–5 rows mirroring real list) | Browser / Client (each consumer file) | — | Lives next to the real layout so shapes stay in sync per D-03 |
| Per-consumer loading-gate logic (`isLoading ? skeleton : predicate ? empty : list`) | Browser / Client (each consumer component) | — | Each hook owns its loading flag; the per-consumer order is the canonical D-10 contract |
| `isLoading` prop drilling from App.tsx → 3 consumers | Browser / Client (App.tsx) | — | App.tsx already owns the hook calls; adding 3 prop wires is the minimal-blast change |
| `shouldShowEmptyState` predicate (now load-bearing) | Browser / Client (`src/components/ui/EmptyState.tsx`) | — | Already implemented, tested, and exported from `EmptyState.tsx`; this phase makes it the canonical guard in all three consumers and re-exports it from the `ui` barrel |
| Tailwind `animate-pulse` animation | CDN / Static (Tailwind compiled CSS) | — | Already in the bundle (used at LandingPage.tsx:16); no new utility, no config change |
| Lint enforcement | Build-time / Pre-commit (Node script) | — | Existing `scripts/lint-no-raw-html.mjs`; the `src/components/ui/` exclusion already covers `Skeleton.tsx` |

**No backend, no API, no database tier touched.** Phase 9 is 100% client presentational. No new packages.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component runtime | `[VERIFIED: package.json:25]` — already in use; no change |
| TypeScript | ~5.9.3 | Type safety | `[VERIFIED: package.json:48]` — `tsc -b` rule per CLAUDE.md |
| Tailwind CSS | ^4.1.18 | All styling utility classes (incl. `animate-pulse`) | `[VERIFIED: package.json:47]` — `animate-pulse` is a built-in Tailwind utility, no plugin needed |
| vitest | ^4.1.4 | Unit test runner | `[VERIFIED: package.json:52]` — already configured (`vitest.config.ts`); used by `src/components/ui/EmptyState.test.ts` and `src/utils/threeMfParser.test.ts` |
| jsdom | ^29.0.2 | DOM env for vitest | `[VERIFIED: package.json:45]` — `environment: 'jsdom'` per vitest.config.ts:5 |
| react-dom (`renderToStaticMarkup`) | ^19.2.0 | String-render tests for the primitive | `[VERIFIED: package.json:26]` — used by `EmptyState.test.ts:3` precedent; no RTL needed |

### Supporting (already in repo)
| Symbol | Source | Purpose | When to Use |
|--------|--------|---------|-------------|
| `<Card>` | `src/components/ui/Card.tsx` | Visual register reference (slate-800, rounded-xl, border-slate-700) | Card-variant skeleton mirrors these tokens; planner does NOT need to import `<Card>` inside the skeleton |
| `<EmptyState>`, `shouldShowEmptyState` | `src/components/ui/EmptyState.tsx` | The "what comes after skeleton" branch | Each consumer renders `<EmptyState>` after isLoading false + items empty; predicate is the D-10 guard |
| Tailwind `animate-pulse` | Tailwind preset | Opacity-based shimmer animation | Apply to skeleton primitive root OR per-bar (Pitfall 4 — parent is cleaner) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `<div>` skeleton with inline classes per consumer | A `<Skeleton>` primitive | CONTEXT D-02 locks the primitive choice. Hand-rolled would duplicate 3× and drift from the canonical visual register |
| `react-loading-skeleton` npm package | Hand-authored primitive | Adds ~25 KB dep + new build vector; D-02 doesn't forbid it explicitly, but the rest of the milestone's pattern (Phase 7/8 hand-authored primitives, no new deps) and D-04's "no custom CSS, no keyframes, no new dependencies" rule out adding a library. Skipped. |
| CSS keyframes shimmer (linear-gradient sweep) | `animate-pulse` | D-04 explicitly: "Shimmer gradient effect — Tailwind `animate-pulse` is sufficient." Skipped. |
| `@testing-library/react` for skeleton render test | `renderToStaticMarkup` (already used by `EmptyState.test.ts:3`) | RTL adds new deps + new test pattern mid-milestone. The existing `renderToStaticMarkup` pattern from Phase 8 already proves the test approach works. **Recommendation: mirror `EmptyState.test.ts` exactly.** |

**Installation:** None. No new packages.

**Version verification:** Skipped — no new packages. All dependencies pinned in `package.json` and unchanged since Phase 8.

---

## Package Legitimacy Audit

Not applicable — **zero new packages installed** in this phase. The Skeleton primitive, three composed list skeletons, and consumer wirings are hand-authored against existing primitives. No `npm install` step in any plan.

---

## Existing Architecture (verified against source)

### App.tsx loading-flag landscape (verbatim line-numbered map)

The current global gate aggregates **eight** per-hook loading flags and short-circuits the whole render. Phase 9 must dismantle this in two steps: (1) remove the gate, (2) prune flags that no consumer reads.

```
src/App.tsx:44-104        // Hook calls with isLoading destructurings
src/App.tsx:106           // const isLoading = assetsLoading || settingsLoading || jobsLoading || printersLoading || instancesLoading || profileLoading || shippingLoading || feesLoading
src/App.tsx:149-155       // if (isLoading) { return <"Loading...">; }
```

**Per-hook flag inventory:**

| # | Variable | Line | Source hook | Reads `isLoading`? | Consumer screen | Phase 9 disposition |
|---|----------|------|-------------|--------------------|--|----|
| 1 | `assetsLoading` | App.tsx:47 | `useAssets()` (useDatabase.ts:10) | ✓ aggregate | **AssetLibrary**, CostCalculator (materials), JobsManager (materials), PrinterSettings (printer assets indirectly via `usePrinters`) | **KEEP** — drill to AssetLibrary as `isLoading` prop |
| 2 | `settingsLoading` | App.tsx:62 | `useAllSettings()` (useDatabase.ts:419 — composition of `usePrinterSettings` + `useElectricitySettings`) | ✓ aggregate | Calculator (electricity), PrinterSettings (electricity) — but both use `useState(default…)` so first-paint value is the default object, never undefined | **DROP** — no skeleton needed; default object renders fine |
| 3 | `jobsLoading` | App.tsx:67 | `useJobs()` (useDatabase.ts:426) | ✓ aggregate | **JobsManager** | **KEEP** — drill to JobsManager as `isLoading` prop |
| 4 | `printersLoading` | App.tsx:75 | `usePrinters()` (useDatabase.ts:135 — wraps `useAssets`) | ✓ aggregate | CostCalculator (printers list), PrinterSettings (printers list — for the "select printer model" dropdown in the add-form, not the instance list itself) | **DROP** — same loading state as `assetsLoading` since `usePrinters` reuses `useAssets`; not the flag driving PrinterSettings' skeleton |
| 5 | `instancesLoading` | App.tsx:80 | `usePrinterInstances()` (useDatabase.ts:188) | ✓ aggregate | **PrinterSettings** | **KEEP** — drill to PrinterSettings as `isLoading` prop |
| 6 | `profileLoading` | App.tsx:90 | `useUserProfile()` (useDatabase.ts:304) | ✓ aggregate | All four tabs read `userProfile.currency`, `userProfile.laborHourlyRate`, etc. via `useState(defaultProfile)` (useDatabase.ts:303) — first-paint value is `defaultProfile`, never undefined | **DROP** — default object pattern; no skeleton needed |
| 7 | `shippingLoading` | App.tsx:96 | `useShippingConfig()` (useDatabase.ts:338) | ✓ aggregate | Calculator (shipping cost field), JobsManager (sale form shipping). Both use `useState(defaultShipping)` — never undefined | **DROP** — default object; no skeleton |
| 8 | `feesLoading` | App.tsx:103 | `useMarketplaceFees()` (useDatabase.ts:387) | ✓ aggregate | SettingsModal only (not in scope; the modal opens on user action, by which time data has loaded) | **DROP** — default object; no skeleton |

**Net result after Phase 9:**
- 3 `isLoading` flags survive (assetsLoading, jobsLoading, instancesLoading) — drilled to consumers
- 5 `isLoading` flags removed from destructurings (settingsLoading, printersLoading, profileLoading, shippingLoading, feesLoading)
- The aggregate `const isLoading = … ` line is deleted entirely
- The `if (isLoading) return <"Loading…">` block is deleted entirely

The planner SHOULD also remove the unused destructurings (cleanliness — TypeScript's `noUnusedLocals` will flag them on the next build). This is a "Claude's discretion" call already authorized in CONTEXT D-01 ("planner decides whether they're still needed anywhere else or can be dropped entirely").

### Phase 8 wiring that Phase 9 modifies

Phase 8 already inserted `<EmptyState>` into all three consumers. Phase 9 wraps each of those branches in the D-10 order. Exact integration points:

**AssetLibrary** ([src/components/AssetLibrary.tsx:406-413](src/components/AssetLibrary.tsx:406)):
```tsx
{assets.length === 0 ? (
  <EmptyState
    icon={<PackageIcon className="w-12 h-12" />}
    title="No materials in your library yet"
    description="Add your first filament to start tracking material costs across jobs. You can also import from CSV if you already have a list."
    cta={{ label: 'Add Material', onClick: startAddingFilament }}
  />
) : (
  <>
    {/* filter tabs, search, form, mobile/desktop tables — lines 414-1090 */}
  </>
)}
```
Phase 9 replaces the bare `assets.length === 0` check with the D-10 ternary; sandwiches in `<AssetListSkeleton/>` and `shouldShowEmptyState(assets, isLoading)`.

**JobsManager** ([src/components/JobsManager.tsx:195-207](src/components/JobsManager.tsx:195)):
```tsx
if (jobs.length === 0) {
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
This is an **early return**, distinct from AssetLibrary's inline ternary. Phase 9 either: (a) keeps the early-return pattern but adds an isLoading early-return before it (cleanest), or (b) converts to a single-return ternary (more refactoring). **Recommend (a)** — matches Pitfall 4 from 08-RESEARCH and preserves the Sale Form / Delete Confirmation modal mount points below line 207.

**PrinterSettings** ([src/components/PrinterSettings.tsx:199-206](src/components/PrinterSettings.tsx:199)):
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
    {/* instance list */}
  </div>
)}
```
Phase 9 wraps the same way as AssetLibrary — inline ternary, no early return needed.

### Real list-row shapes (verbatim, for skeleton-shape mirroring)

The planner needs these to size each composed list skeleton (D-03: "skeleton row count should approximate the real list's first-paint row count (3-5 rows is a safe default)").

**AssetLibrary — desktop materials table** ([AssetLibrary.tsx:867-1017](src/components/AssetLibrary.tsx:867)):
Materials table (default view, filter='all', non-printer). Per-row structure:
- 6 columns: `Material` (with notes + tags below name), `Brand`, `Type` (badge), `Cost/Unit` (right-aligned monospaced), `Package` (right-aligned monospaced), `Actions` (Edit + Delete buttons)
- Row container: `<tr className="text-slate-300">` with `<td className="py-2">` cells
- Approximate row height: ~36px without notes/tags, ~56-64px with notes/tags
- Default `itemsPerPage` is 10 (App.tsx:312 — `userProfile.assetLibraryItemsPerPage ?? 10`)
- **Recommend 5 skeleton rows** at ~40px each to approximate first viewport before scroll

**AssetLibrary — mobile card view** ([AssetLibrary.tsx:741-865](src/components/AssetLibrary.tsx:741)):
Per-row card structure:
- Outer: `<div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">`
- Header row: name + badge (justify-between)
- Optional brand, notes, tags rows
- Grid of `Cost/Unit`, `Package` rows (or 4 grid cells for printers)
- Action buttons (Edit + Delete, full-width)
- Approximate card height: ~180-220px
- **Recommend 3 skeleton cards** on mobile (~190px each)

Tailwind responsive classes (`md:hidden` / `hidden md:block`) mean the planner needs BOTH a desktop and mobile representation, OR a single representation that uses Tailwind responsive classes to switch (cleaner). **Recommend the latter** — `AssetListSkeleton` renders mobile cards on `md:hidden` and table rows on `hidden md:block`.

**JobsManager — job cards list** ([JobsManager.tsx:212-344](src/components/JobsManager.tsx:212)):
Per-row card structure:
- Outer: `<div className="p-4 rounded-lg border bg-slate-700/50 border-slate-600">`
- Top row (flex justify-between):
  - LEFT: `<h3>` job name + status badge ("Break-even reached" or "X more to break even") + filament summary line + print time
  - RIGHT: revenue figure + "X sold" subtext
- Card height: ~80-100px collapsed (no expanded details shown by default)
- Wrapper: `<div className="bg-slate-800 rounded-xl p-6 border border-slate-700"> <h2>My Print Jobs</h2> …`
- **Recommend 4 skeleton job rows** at ~90px each

**PrinterSettings — printer instance list** ([PrinterSettings.tsx:207-352](src/components/PrinterSettings.tsx:207)):
Per-row structure:
- Outer: `<div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">`
- Flex container:
  - LEFT: `<h3>` nickname + config name + metadata row (`X hours printed · $Y/hr cost · Z jobs · W units sold`) + recovery progress bar with caption
  - RIGHT: Edit + Delete buttons (flex gap-2)
- Card height: ~96-112px
- Wrapper: `<div className="bg-slate-800 rounded-xl p-6 border border-slate-700"> ...top bar with "+ Add Printer" button...`
- **Recommend 2-3 skeleton printer rows** at ~100px each (printer instance counts are typically low — 1-3 machines)

### Visual register (must match Phase 7 Card primitive)

All three composed list skeletons live inside the existing slate-800 panel wrappers (already in source — Phase 9 does NOT change the wrappers). The skeleton bars themselves use:
- Base bar color: `bg-slate-700` (matches the inner row background in real cards — `bg-slate-700/50` for rows; the skeleton bar is the un-translucent variant since there's no inner content)
- Border-radius: `rounded` (small) for line bars; `rounded-xl` for card-variant placeholders
- Border: none on bars themselves; row cards inherit `border border-slate-600` from outer
- Animation: `animate-pulse` on the parent of bar groups (Pitfall 4)

---

## Skeleton Primitive Shape (canonical recommendation)

### Prop contract

```typescript
// src/components/ui/Skeleton.tsx
import type { HTMLAttributes } from 'react';

type SkeletonVariant = 'line' | 'card' | 'circle';

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: SkeletonVariant;
  width?: string;     // Tailwind class or arbitrary value, e.g., 'w-24', 'w-1/2', '[120px]'
  height?: string;    // Same — e.g., 'h-4', 'h-12'
  rounded?: string;   // Override default radius, e.g., 'rounded-full', 'rounded-xl', 'rounded-none'
}

const variantStyles: Record<SkeletonVariant, string> = {
  line:   'h-4 w-full rounded',                       // text-line bar; ~16px high; full-width by default
  card:   'h-24 w-full rounded-xl',                   // card placeholder; ~96px; matches Card.tsx border-radius
  circle: 'h-10 w-10 rounded-full',                   // avatar/icon placeholder; 40px square
};

export function Skeleton({
  variant = 'line',
  width,
  height,
  rounded,
  className = '',
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className={`bg-slate-700 animate-pulse ${variantStyles[variant]} ${width ?? ''} ${height ?? ''} ${rounded ?? ''} ${className}`.trim()}
      {...props}
    />
  );
}
```

**Convention reasoning (verified against existing primitives):**
- `export function` named export — matches `Card.tsx:24` and `EmptyState.tsx:15`.
- `interface SkeletonProps` — matches `InputProps`, `ButtonProps`, `CardProps`, `EmptyStateProps`.
- No `forwardRef` — `Card.tsx:24` uses `forwardRef` for layout primitives; `EmptyState.tsx:15` does NOT because it's composite. Skeleton is a leaf primitive but unlikely to need a ref (callers don't measure it). Match `EmptyState.tsx`'s simpler signature.
- `Omit<HTMLAttributes<HTMLDivElement>, 'children'>` — Skeleton is a void element conceptually; children would never have a meaningful render. Excluding the `children` prop in the type prevents misuse.
- `width` / `height` / `rounded` as Tailwind-class STRINGS (not numeric pixels) — matches the project's utility-first pattern. Caller writes `<Skeleton width="w-1/3" />`, not `<Skeleton width={120} />`.
- `className` as the final escape hatch — every existing primitive (`Button`, `Input`, `Select`, `Textarea`, `Card`, `EmptyState`) accepts it last for one-off overrides.
- `role="status"`, `aria-label="Loading"`, `aria-busy="true"` — accessibility minimum for screen readers. Note: only the **outer** parent of a skeleton group needs `role="status"` to avoid spammy SR announcements; per-bar Skeleton instances inherit context. The planner may choose to drop the role from individual bars when wrapping them in a parent. Recommend keeping for the v1 primitive — composed skeletons can override with `role={undefined}` if needed.

### Pattern: `animate-pulse` on the bar vs the parent (resolves Pitfall 4)

Tailwind's `animate-pulse` animates `opacity` from `1 → 0.5 → 1` on the element it's applied to. Nested children DO NOT inherit the keyframe (each animated element runs its own keyframe in lockstep — no DOM-tree drift), BUT applying `animate-pulse` to N children means N independent animation timers running.

**Recommended pattern: animate the parent group, not each bar.** In composed list skeletons:

```tsx
// Inside AssetLibrary.tsx — composed skeleton
function AssetListSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="bg-slate-700 h-10 rounded" />   {/* row 1 */}
      <div className="bg-slate-700 h-10 rounded" />   {/* row 2 */}
      ...
    </div>
  );
}
```

But this contradicts D-04's "Use Tailwind's `animate-pulse` class on each skeleton element" — D-04 reads ambiguously between "every bar gets the class" and "use this technique on the skeleton". **Reasonable reading: the primitive bakes `animate-pulse` into the bar by default (so callers don't forget), AND composed skeletons may wrap a group in a parent `animate-pulse` and avoid the inner bars duplicating it.** Two options:

| Option | Where to put `animate-pulse` | Tradeoff |
|--------|------------------------------|----------|
| A. On every `<Skeleton>` bar (current primitive default) | Built into primitive | Simplest mental model; each bar pulses; minor perf cost from N timers (negligible for ≤20 bars) |
| B. Allow disabling per-bar via prop, then animate parent | Need `animated?: boolean` prop (default true) | More API surface; cleaner for dense compositions |

**Recommend Option A for v1** — D-02 says "Animation built in (uses `animate-pulse` by default; no opt-out needed for v1)." This is the locked decision. The composed skeleton patterns shown in this research keep each bar pulsing independently. If a perf or visual issue surfaces post-ship, a v1.2 phase can add the opt-out.

### File location

```
src/components/ui/
├── Button.tsx
├── ButtonLink (re-export)
├── Card.tsx
├── EmptyState.tsx
├── EmptyState.test.ts
├── Input.tsx
├── Select.tsx
├── Skeleton.tsx          # NEW
├── Skeleton.test.ts      # NEW
├── Textarea.tsx
├── icons/                # Phase 8 sub-barrel — unchanged
│   ├── ClipboardListIcon.tsx
│   ├── PackageIcon.tsx
│   ├── PrinterIcon.tsx
│   └── index.ts
└── index.ts              # MODIFIED — add Skeleton + shouldShowEmptyState exports
```

### Barrel updates ([src/components/ui/index.ts](src/components/ui/index.ts))

```typescript
export { Button, ButtonLink, getButtonClasses } from './Button';
export { Input } from './Input';
export { Select } from './Select';
export { Textarea } from './Textarea';
export { Card } from './Card';
export { EmptyState, shouldShowEmptyState } from './EmptyState';  // CHANGED — add shouldShowEmptyState
export { Skeleton } from './Skeleton';                             // NEW
export type { SkeletonProps } from './Skeleton';                   // OPTIONAL — only if consumers import the type
```

The `shouldShowEmptyState` re-export is part of activating it (resolves IN-01). Each consumer then imports it directly from `./ui` alongside `EmptyState` and `Skeleton`.

---

## Per-Consumer Integration Plan

### A. AssetLibrary

**File:** `src/components/AssetLibrary.tsx`

**Add to props interface (line 8-18):**
```typescript
interface AssetLibraryProps {
  assets: Asset[];
  isLoading: boolean;           // NEW — drilled from App.tsx
  onAddAsset: (asset: Asset) => void;
  onUpdateAsset: (asset: Asset) => void;
  onDeleteAsset: (id: string) => void;
  onBulkImportAssets: (assets: Asset[]) => Promise<void>;
  onResetMaterials: () => void;
  onResetPrinters: () => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
}
```

**Destructure (line 61-71):**
```typescript
export function AssetLibrary({
  assets,
  isLoading,                    // NEW
  onAddAsset,
  // ...rest unchanged
}: AssetLibraryProps) {
```

**Add imports (line 5-6):**
```typescript
import { Button, Input, Select, EmptyState, Skeleton, shouldShowEmptyState } from './ui';
import { PackageIcon } from './ui/icons';
```

**Define composed skeleton inside the file (after line 60, before `export function AssetLibrary`):**
```typescript
function AssetListSkeleton() {
  return (
    <>
      {/* Mobile cards — 3 placeholder cards */}
      <div className="md:hidden space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton variant="line" width="w-32" />          {/* name */}
              <Skeleton variant="line" width="w-16" height="h-5" rounded="rounded-full" />  {/* badge */}
            </div>
            <Skeleton variant="line" width="w-24" />            {/* brand */}
            <Skeleton variant="line" width="w-full" />          {/* notes/tags */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50">
              <Skeleton variant="line" />
              <Skeleton variant="line" />
              <Skeleton variant="line" />
              <Skeleton variant="line" />
            </div>
            <div className="flex gap-2 pt-2">
              <Skeleton variant="line" height="h-9" className="flex-1" />
              <Skeleton variant="line" height="h-9" className="flex-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table — 5 placeholder rows */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-left border-b border-slate-700">
              <th className="pb-2 font-medium"><Skeleton variant="line" width="w-20" /></th>
              <th className="pb-2 font-medium"><Skeleton variant="line" width="w-16" /></th>
              <th className="pb-2 font-medium"><Skeleton variant="line" width="w-12" /></th>
              <th className="pb-2 font-medium text-right"><Skeleton variant="line" width="w-16" className="ml-auto" /></th>
              <th className="pb-2 font-medium text-right"><Skeleton variant="line" width="w-16" className="ml-auto" /></th>
              <th className="pb-2 font-medium text-right"><Skeleton variant="line" width="w-16" className="ml-auto" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {[0, 1, 2, 3, 4].map(i => (
              <tr key={i}>
                <td className="py-2"><Skeleton variant="line" width="w-32" /></td>
                <td className="py-2"><Skeleton variant="line" width="w-24" /></td>
                <td className="py-2"><Skeleton variant="line" width="w-16" /></td>
                <td className="py-2"><Skeleton variant="line" width="w-20" className="ml-auto" /></td>
                <td className="py-2"><Skeleton variant="line" width="w-20" className="ml-auto" /></td>
                <td className="py-2"><Skeleton variant="line" width="w-24" className="ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
```

**Replace the existing empty-state ternary (line 406-1092):**

CURRENT structure (line 365-1101 — the whole component return):
```jsx
return (
  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
    <div className="flex flex-col sm:flex-row …">{/* header bar — line 366-404 */}</div>

    {assets.length === 0 ? (
      <EmptyState ... />
    ) : (
      <>
        {/* filter tabs, search, form, mobile/desktop tables, pagination — line 414-1090 */}
      </>
    )}

    <CsvImportModal ... />
  </div>
);
```

NEW structure (D-10 order):
```jsx
return (
  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
    <div className="flex flex-col sm:flex-row …">{/* header bar — UNCHANGED */}</div>

    {isLoading ? (
      <AssetListSkeleton />
    ) : shouldShowEmptyState(assets, isLoading) ? (
      <EmptyState
        icon={<PackageIcon className="w-12 h-12" />}
        title="No materials in your library yet"
        description="Add your first filament to start tracking material costs across jobs. You can also import from CSV if you already have a list."
        cta={{ label: 'Add Material', onClick: startAddingFilament }}
      />
    ) : (
      <>
        {/* filter tabs, search, form, mobile/desktop tables, pagination — UNCHANGED */}
      </>
    )}

    <CsvImportModal ... />
  </div>
);
```

**Subtle:** The header bar at line 366-404 includes the `+ Add Asset` and `Import CSV` buttons. CONTEXT D-01 and the existing Phase 8 structure both keep these visible across all branches (empty + populated). Keep them visible during loading too — the user can click Add Asset even before existing assets load. This is consistent with the "header/tabs interactive during load" verification hint (CONTEXT line 114).

**App.tsx update (line 303-315):**
```jsx
{activeTab === 'materials' && (
  <AssetLibrary
    assets={assets}
    isLoading={assetsLoading}     {/* NEW */}
    onAddAsset={addAsset}
    onUpdateAsset={updateAsset}
    ...
  />
)}
```

### B. JobsManager

**File:** `src/components/JobsManager.tsx`

**Add to props interface (line 7-17):**
```typescript
interface JobsManagerProps {
  jobs: PrintJob[];
  isLoading: boolean;             // NEW
  materials: Material[];
  printers: PrinterConfig[];
  printerInstances: PrinterInstance[];
  shippingConfig: ShippingConfig;
  userCurrency: Currency;
  onDeleteJob: (id: string) => Promise<void>;
  onEditJob: (job: PrintJob) => void;
  onSwitchTab: (tab: 'calculator' | 'jobs' | 'materials' | 'settings') => void;
}
```

**Destructure (line 19):**
```typescript
export function JobsManager({ jobs, isLoading, materials, printers, printerInstances, shippingConfig, userCurrency, onDeleteJob, onEditJob, onSwitchTab }: JobsManagerProps) {
```

**Add imports (line 4-5):**
```typescript
import { Button, Input, Select, EmptyState, Skeleton, shouldShowEmptyState } from './ui';
import { ClipboardListIcon } from './ui/icons';
```

**Define composed skeleton (before `export function JobsManager`):**
```typescript
function JobsListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="p-4 rounded-lg border bg-slate-700/50 border-slate-600">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton variant="line" width="w-40" />                                 {/* job name */}
                <Skeleton variant="line" width="w-32" height="h-5" rounded="rounded-full" />  {/* status badge */}
              </div>
              <Skeleton variant="line" width="w-3/4" />                                  {/* filament summary + print time */}
            </div>
            <div className="text-right space-y-1">
              <Skeleton variant="line" width="w-20" height="h-6" className="ml-auto" />  {/* revenue figure */}
              <Skeleton variant="line" width="w-16" className="ml-auto" />               {/* "X sold" */}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Replace the early return (lines 195-207) with a D-10 dispatch:**

CURRENT:
```jsx
if (jobs.length === 0) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-4">My Print Jobs</h2>
      <EmptyState ... />
    </div>
  );
}

return (
  <div className="space-y-6">
    {/* Jobs List */}
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-4">My Print Jobs</h2>
      <div className="space-y-3">
        {jobs.map(job => {...})}
      </div>
    </div>
    {/* Sale Form Modal + Delete Confirmation Modal — lines 347-498 */}
  </div>
);
```

NEW (single return + ternary; keeps modal mount points reachable):
```jsx
return (
  <div className="space-y-6">
    {/* Jobs List */}
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-4">My Print Jobs</h2>

      {isLoading ? (
        <JobsListSkeleton />
      ) : shouldShowEmptyState(jobs, isLoading) ? (
        <EmptyState
          icon={<ClipboardListIcon className="w-12 h-12" />}
          title="No jobs saved yet"
          description={<>Use the Cost Calculator to create and save print jobs.<br />Track sales and see how many copies you need to break even.</>}
          cta={{ label: 'Open Calculator', onClick: () => onSwitchTab('calculator') }}
        />
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {...})}    {/* lines 217-342 unchanged */}
        </div>
      )}
    </div>

    {/* Sale Form Modal + Delete Confirmation Modal — lines 347-498 UNCHANGED */}
  </div>
);
```

**Important:** The conversion from early-return to single-return is the right call here — it keeps the Sale Form modal and Delete Confirmation modal mounted regardless of which branch the body renders. Pitfall 4 from 08-RESEARCH flagged this exact concern. In Phase 8 it was acceptable to keep the early return because the modals can't open in the empty state. But Phase 9 introduces the loading branch, which is genuinely transient — if there happen to be in-flight modal handlers from a previous mount (unlikely but theoretically possible during dev hot-reload), keeping the modals in the tree across branches is safer.

**App.tsx update (line 289-301):**
```jsx
{activeTab === 'jobs' && (
  <JobsManager
    jobs={jobs}
    isLoading={jobsLoading}        {/* NEW */}
    materials={materials}
    ...
  />
)}
```

### C. PrinterSettings

**File:** `src/components/PrinterSettings.tsx`

**Add to props interface (line 6-15):**
```typescript
interface PrinterSettingsProps {
  printers: PrinterConfig[];
  printerInstances: PrinterInstance[];
  isLoading: boolean;             // NEW
  jobs: PrintJob[];
  electricity: ElectricityConfig;
  onAddInstance: (instance: PrinterInstance) => void;
  onUpdateInstance: (instance: PrinterInstance) => void;
  onDeleteInstance: (id: string) => void;
  onElectricityChange: (config: ElectricityConfig) => void;
}
```

**Destructure (line 17-26):**
```typescript
export function PrinterSettings({
  printers,
  printerInstances,
  isLoading,                      // NEW
  jobs,
  electricity,
  onAddInstance,
  ...
}: PrinterSettingsProps) {
```

**Add imports (line 3-4):**
```typescript
import { Button, Input, Select, EmptyState, Skeleton, shouldShowEmptyState } from './ui';
import { PrinterIcon } from './ui/icons';
```

**Define composed skeleton (before `export function PrinterSettings`):**
```typescript
function PrinterListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton variant="line" width="w-32" />                       {/* nickname */}
                <Skeleton variant="line" width="w-24" />                       {/* config name */}
              </div>
              <Skeleton variant="line" width="w-3/4" />                        {/* metadata row */}
              <Skeleton variant="line" width="w-full" height="h-1.5" className="max-w-md" />  {/* recovery progress bar */}
              <Skeleton variant="line" width="w-2/3" height="h-3" className="max-w-md" />     {/* recovery caption */}
            </div>
            <div className="flex gap-2">
              <Skeleton variant="line" width="w-16" height="h-9" />            {/* Edit button */}
              <Skeleton variant="line" width="w-20" height="h-9" />            {/* Delete button */}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Replace lines 199-206 (the existing `{printerInstances.length === 0 ? <EmptyState/> : <div>list</div>}`):**

CURRENT:
```jsx
{/* Printer Instances List */}
{printerInstances.length === 0 ? (
  <EmptyState ... />
) : (
  <div className="space-y-3">
    {printerInstances.map(instance => {...})}
  </div>
)}
```

NEW:
```jsx
{/* Printer Instances List */}
{isLoading ? (
  <PrinterListSkeleton />
) : shouldShowEmptyState(printerInstances, isLoading) ? (
  <EmptyState
    icon={<PrinterIcon className="w-12 h-12" />}
    title="No printers added yet"
    description="Add your first printer to track depreciation, electricity costs, and maintenance intervals across every job."
    cta={{ label: 'Add Printer', onClick: () => setShowAddForm(true) }}
  />
) : (
  <div className="space-y-3">
    {printerInstances.map(instance => {...})}
  </div>
)}
```

**Important:** Lines 85-196 (the Add Printer form) and lines 357-369 (the Electricity panel) sit OUTSIDE the loading/empty branch. They render unconditionally. This means even during loading, the user can:
- See the "+ Add Printer" button in the top-right (line 80-82) and open the Add Printer form
- See the Electricity panel and edit the cost-per-kWh

This matches the "header/Calculator interactive during load" intent of D-01. No code change to those sections.

**App.tsx update (line 317-328):**
```jsx
{activeTab === 'settings' && (
  <PrinterSettings
    printers={printers}
    printerInstances={printerInstances}
    isLoading={instancesLoading}    {/* NEW */}
    jobs={jobs}
    electricity={electricity}
    ...
  />
)}
```

### Summary of App.tsx changes (Plan 09-02 wave 2)

1. **Remove** lines 106 (`const isLoading = …`) and 149-155 (`if (isLoading) { return … }`).
2. **Prune destructurings** — remove `isLoading: settingsLoading` (line 62), `isLoading: printersLoading` (line 75), `isLoading: profileLoading` (line 90), `isLoading: shippingLoading` (line 96), `isLoading: feesLoading` (line 103). Keep `isLoading: assetsLoading` (line 47), `isLoading: jobsLoading` (line 67), `isLoading: instancesLoading` (line 80).
3. **Add `isLoading` props** to three consumer call-sites:
   - `<AssetLibrary isLoading={assetsLoading} ... />` (line 304)
   - `<JobsManager isLoading={jobsLoading} ... />` (line 290)
   - `<PrinterSettings isLoading={instancesLoading} ... />` (line 318)

No other changes to App.tsx — the header, tabs, NewBadge overlays, modals, and Calculator/Footer all render outside the removed gate already.

---

## Common Pitfalls

### Pitfall 1: Hook-ordering after dropping the global gate

**What goes wrong:** A consumer's existing pre-list early return (e.g., JobsManager's `if (jobs.length === 0) return …` at line 195) was previously preceded only by hook declarations and pure computations. Phase 9 adds another early return for `isLoading`. If the planner places `if (isLoading) return <Skeleton/>` BEFORE the existing hook calls at the top of the function, React's hook-order invariant breaks at the next render (when `isLoading` flips from `true` to `false`, the same component instance suddenly calls more hooks).

**Why it happens:** `useState`, `useMemo`, `useCallback`, `useSales` (JobsManager:30-31) all live above the empty-state early return. Any new early return must come AFTER them.

**How to avoid:** For JobsManager, the recommended pattern (see B above) converts the early-return pattern to a single-return ternary, which avoids the hook-ordering question entirely. For AssetLibrary and PrinterSettings (which already use inline ternaries), the loading branch is added inside the existing ternary — no new early return is introduced. **The single-return pattern is strictly safer.**

**Warning sign:** React Strict Mode will throw `Rendered fewer hooks than expected` errors in the console if the hook order changes between renders. If the planner sees that error on `npm run dev`, the cause is hook-after-return.

**Code-graph confirmation:** JobsManager's existing structure already conforms — its `if (jobs.length === 0)` is the FIRST early return in the function, at line 195, AFTER all `useState`/`useMemo`/`useCallback`/`useSales` calls (lines 20-191). The Phase 9 single-return refactor preserves this.

### Pitfall 2: `JobsManager._getPrinterName` dead-code silencer collides with the refactor

**What goes wrong:** Lines 186-193 of JobsManager.tsx contain a dead function `_getPrinterName` and a `void _getPrinterName;` warning silencer (08-REVIEW IN-03). It sits immediately above the line-195 early return. If the planner converts the early return to a single-return ternary AND deletes the dead function as part of cleanup, the `void` line goes too — but if the planner only does the conversion, the dead function still sits awkwardly above the new code.

**Why it happens:** Pre-existing tech debt from Phase 7 or earlier. 08-REVIEW IN-03 explicitly flagged it as "deletable" but out-of-scope for Phase 8.

**How to avoid:** Phase 9 is also NOT a cleanup phase for this debt. **Leave `_getPrinterName` and the `void` silencer in place.** Address as a separate cleanup commit. The planner should NOT bundle it with the skeleton refactor — Phase 9's blast radius stays minimal.

**Warning sign:** If a code reviewer suggests deleting the dead function during plan-check, push back — it's pre-existing and unrelated.

### Pitfall 3: Skeleton flashes after data loads (D-05's edge case)

**What goes wrong:** On an instant-cached read (e.g., user toggles tabs, IndexedDB has the data warm), `isLoading` flips from `true` to `false` within one frame. The skeleton renders for ~16ms, then disappears. On slower machines or first-cold-loads, the skeleton renders for 100-500ms (typical IndexedDB cold read on a low-end device). Either is acceptable per D-05 ("A single-frame flash on instant loads is acceptable").

**Why it happens:** D-05 explicitly accepts this. The skeleton renders immediately, no debounce.

**How to avoid:** No code-level avoidance — this is the locked behavior. The UAT manual test (see Validation Architecture below) must confirm the skeleton appears at least briefly on cold reload. If a future user complaint surfaces, a v1.2 phase can add a 100ms debounce to the skeleton's appearance. For Phase 9, do not pre-emptively debounce.

**Warning sign:** UAT tester reports "I never see the skeleton" — verify they're cold-reloading (Ctrl+Shift+R or DevTools "Empty Cache and Hard Reload"). Warm reload won't trigger the skeleton meaningfully because Dexie's `useLiveQuery` cache hits within a tick.

### Pitfall 4: `animate-pulse` parent vs per-bar (resolves at primitive level)

**What goes wrong:** A composed skeleton with 20 bars, each running its own `animate-pulse` animation, creates 20 independent animation timers. On low-end devices this could (theoretically) drop frames during initial paint.

**Why it happens:** Tailwind's `animate-pulse` is an opacity keyframe applied per-element. Browsers DO batch animation frames, so 20 timers != 20× the work — but each element still maintains its own animation state.

**How it's already prevented:** D-02 puts `animate-pulse` in the primitive (Option A from the table above). With ≤20 bars per composed skeleton and modern browser optimization, this is a non-issue. The single-frame-or-100ms skeleton lifetime means the user never sees enough of the animation to notice.

**How to avoid future regression:** If a v1.2 phase adds a dense skeleton (50+ bars), revisit Option B (opt-out prop + parent-level `animate-pulse`).

**Warning sign:** Lighthouse perf score drops on Phase 9. Unlikely — measured first-paint contribution of `animate-pulse` is sub-millisecond.

### Pitfall 5: CostCalculator first-paint with empty data (post-gate removal)

**What goes wrong:** App.tsx's removed gate means CostCalculator (the always-default-active tab) renders immediately with `materials = []`, `printers = []`, `printerInstances = []`. CostCalculator has filament-row dropdowns populated from `materials`, a printer-instance dropdown populated from `printerInstances`, etc. If any of these crash on an empty array, the app is broken on first paint.

**Why it happens:** D-01 explicitly removes the gate. D-07 explicitly accepts the empty-dropdown flash. But "accepts" requires the rendering not to crash.

**How to avoid:** Verified non-crashing — every hook in `useDatabase.ts` defaults arrays to `[]` (lines 101, 222, 451) and object hooks return their default object synchronously (lines 233, 254, 275, 303, 337, 386). CostCalculator's `<Select>` elements over `materials.map(...)` produce zero `<option>` elements when `materials = []`, which is a valid (if useless) `<select>` state. No crash.

**Verification step (Plan 09-02 manual UAT):** Cold-reload the app with IndexedDB cleared via DevTools (`Application → IndexedDB → 3DCoster → Clear`). Confirm Calculator tab renders (header visible, form fields visible, dropdowns empty/disabled, no console errors). Then wait for IndexedDB seed to complete (~200ms) and confirm dropdowns populate.

**Warning sign:** Console errors on first paint after gate removal. If `Cannot read property X of undefined` appears, one of the hooks isn't defaulting its data correctly. Trace via React DevTools to find the offender.

### Pitfall 6: Race condition between `shouldShowEmptyState` and `isLoading` flip

**What goes wrong:** When `isLoading` flips from `true` to `false` AND items is still `[]` (genuine empty state), the user sees skeleton → empty state in two consecutive frames. This is correct per D-10 but could look like a flicker.

**Why it happens:** D-10's order is `isLoading ? skeleton : predicate ? empty : list`. When isLoading flips, the predicate kicks in. No frame is skipped between branches.

**How to avoid:** This is the intended behavior. The predicate `!isLoading && items.length === 0` evaluates to `true` only after isLoading is false, so empty-state never renders during loading. The visual transition is fine — skeleton → empty state is a meaningful state change, not a flicker.

**Warning sign:** UAT reports "skeleton flickered to empty state and back to skeleton then to populated list." That would be three branch changes, indicating isLoading is toggling — likely a React StrictMode double-effect issue. If observed, check `useAssets`/`useJobs`/`usePrinterInstances` for any side-effect that resets `setIsLoading(true)` after the first resolve. Verified absent in `useDatabase.ts` (each hook sets `setIsLoading(false)` exactly once after the first DB count).

### Pitfall 7: TypeScript exhaustiveness on new `isLoading` prop

**What goes wrong:** Adding `isLoading: boolean` to a Props interface (AssetLibrary, JobsManager, PrinterSettings) is a breaking type change. If any other caller imports the component (e.g., in tests, in storybook, in another phase's experimental code), they'll fail `tsc -b`.

**Why it happens:** Strict typing — once added to the interface, every render-site must provide it.

**How to avoid:** `tsc -b` per CLAUDE.md will catch this on `npm run build`. The three call-sites in App.tsx (verified above) are the only callers in the codebase (verified by grepping for `<AssetLibrary`, `<JobsManager`, `<PrinterSettings` — all in App.tsx only). No tests today render these components directly. Tauri build uses the same App.tsx. Marketing pages don't render the calculator.

**Warning sign:** `tsc -b` errors about missing `isLoading` prop on a call site outside App.tsx. If that happens, find the rogue call site and update it (or add `isLoading?: boolean` with a default to maintain backwards compat — but the planner should NOT take this shortcut because the prop is load-bearing for D-10).

### Pitfall 8: Composed skeleton placed inside JSX that mounts conditionally

**What goes wrong:** If the planner accidentally places `<AssetListSkeleton/>` outside the slate-800 panel wrapper, the skeleton renders against the slate-900 page background and looks broken.

**Why it happens:** Misreading the existing panel-wrapper structure.

**How to avoid:** Each consumer's existing panel wrapper (`<div className="bg-slate-800 rounded-xl p-6 border border-slate-700">`) is the **outer** wrapper. Phase 9's loading/empty/list branches all go INSIDE that wrapper. Verify by checking that the skeleton inherits the `p-6` parent padding and renders against `bg-slate-800`.

**Warning sign:** Skeleton appears with extra padding or wrong background. Confirm placement inside the existing `bg-slate-800` div.

### Pitfall 9: lint:no-raw-html guard incorrectly excluding new test file

**What goes wrong:** Planner creates `src/components/ui/Skeleton.test.ts` — the guard scans `src/components/` recursively and excludes anything under `src/components/ui/`. The test file IS excluded (correctly), but if any future refactor moves the exclusion to use path-segment matching, test files would start being scanned.

**Why it happens:** Same as Phase 8's Pitfall 1 — the guard uses `startsWith('src/components/ui')` which correctly includes subdirectories.

**How it's verified:** `src/components/ui/Skeleton.test.ts`.startsWith(`src/components/ui`) → `true`. No guard edit required. Verified in Phase 8 research (08-RESEARCH:566).

**Warning sign:** Lint guard fails on a `<div role="status">` line in `Skeleton.tsx`. (It won't — guard checks `<button|<input|<select|<textarea`, not `<div>`. But if the test file ever introduces a fixture with raw form HTML, the guard will catch it.)

### Pitfall 10: `<table>` skeleton on mobile breaks layout

**What goes wrong:** AssetLibrary's desktop view renders a `<table>` and the mobile view renders cards. The composed `AssetListSkeleton` (above) uses Tailwind responsive classes (`md:hidden` / `hidden md:block`) to conditionally render mobile cards vs desktop table. If the planner forgets the responsive switches, the table renders on mobile (overflow) or the cards render on desktop (wrong shape).

**Why it happens:** Easy to forget responsive classes when copying from one variant to the other.

**How to avoid:** The composed `AssetListSkeleton` recommendation above includes BOTH variants with correct responsive classes. The planner should NOT simplify this to a single variant. JobsManager and PrinterSettings only have one layout each (no responsive switch) so this Pitfall is AssetLibrary-specific.

**Warning sign:** Skeleton renders as a wide horizontally-scrolling table on a phone-width viewport.

---

## Patterns to Mirror

### From Phase 7 (Primitive structure)
- **File naming**: PascalCase `.tsx` for components, PascalCase `.test.ts` for tests, lowercase `index.ts` for barrels.
- **Export style**: Named exports (`export function Foo`), no default exports for primitives.
- **Prop interface naming**: `interface FooProps` adjacent to the component (matches `ButtonProps`, `InputProps`, `EmptyStateProps`).
- **Class concatenation**: Template literal with trailing `.trim()` on the className composition (matches `Card.tsx:31`, `Input.tsx:27`).
- **`className?: string` last in props** for consumer override (matches every primitive).
- **No `forwardRef` for composite primitives** (matches `EmptyState.tsx:15` — refs aren't needed for skeleton bars; matches Card's exception).

### From Phase 8 (Test structure)
- **Test framework**: vitest 4.1.4 with jsdom 29.0.2 already configured (vitest.config.ts:5).
- **Render testing**: `renderToStaticMarkup` from `react-dom/server` (avoids RTL install). Pattern verified in `EmptyState.test.ts:3`.
- **Test naming**: `Test N (req tag): description` format (matches `EmptyState.test.ts:8-25`).
- **Pure-predicate tests**: For `shouldShowEmptyState`, four branches: `(empty, loading)`, `(empty, not-loading)`, `(non-empty, loading)`, `(non-empty, not-loading)` — already covered by `EmptyState.test.ts:8-25`. **Phase 9 reuses these tests as-is**; no new predicate tests needed since the predicate itself is unchanged.

### From Phase 8 (Integration structure)
- **Imports from `./ui` barrel**: `import { Button, Input, Select, EmptyState, Skeleton, shouldShowEmptyState } from './ui';` — matches existing pattern at AssetLibrary.tsx:5.
- **Icons from `./ui/icons` sub-barrel**: Unchanged from Phase 8. No new icons in Phase 9 (skeleton bars don't need icons).
- **Single-return-with-ternary preferred over early-return** when the component has bottom-of-file modals or always-mounted content (JobsManager — applies to Phase 9).

### From Phase 8 (Lint guard)
- **Active guard** at `scripts/lint-no-raw-html.mjs` excludes `src/components/ui/**` and triggers on raw `<button>`, `<input>`, `<select>`, `<textarea>` outside opt-outs.
- **No guard edits** for Phase 9. The skeleton primitive uses `<div>` only; composed list skeletons use `<div>` + `<table>`/`<tr>`/`<td>` + `<thead>`/`<tbody>` — all are NOT in the guard's pattern.
- **No `// allow-raw-html` opt-out comments** introduced by Phase 9.

### From Phase 8 (Render contract)
- **Consumer wraps, primitive doesn't**: EmptyState lives inside the consumer's slate-800 panel wrapper. Skeleton follows the same rule — the composed list skeleton renders inside the consumer's panel wrapper, not as a self-wrapping panel.
- **D-10 order is canonical**: `isLoading ? skeleton : shouldShowEmptyState(items, isLoading) ? empty : list`. No co-existence states.

### NEW badge skip rationale (D-08)
- **No badge for Phase 9.** Skeletons are quality-of-life. They appear only during initial load (≤500ms typical). Users least likely to notice a badge during that window.
- **Do NOT register `skeleton-loading` in `src/features.ts`.** D-08 is explicit.
- **Guard against accidental introduction**: If a code reviewer suggests adding a badge during plan-check, push back with D-08. The Phase 7 invisible-refactor precedent (no badge) is the correct analogue, NOT Phase 8's user-discoverable empty state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skeleton bar styling | Custom `<div className="bg-slate-700 …">` in each consumer | `<Skeleton variant="line" />` from `src/components/ui/Skeleton` | Co-locating raw bars in 3 consumer files would drift in 3 directions; primitive keeps the visual register stable per D-02 |
| Pulse animation | Custom `@keyframes` in `index.css` | Tailwind's `animate-pulse` | D-04 explicit; already used at LandingPage.tsx:16 |
| Loading-flag aggregation | Re-introduce an `isLoading` aggregate in a parent | Pass per-consumer `isLoading` props from App.tsx | D-01 explicit — gate moves per-consumer; no aggregate |
| Empty-state-while-loading detection | Re-implement `(items, isLoading) => …` in each consumer | `shouldShowEmptyState` from `src/components/ui/EmptyState.tsx` | Already implemented + tested in Phase 8 (08-REVIEW IN-01); just re-export from barrel and call |
| Skeleton row composition | A `Skeleton.list` or `Skeleton.table` higher-order component | Co-located composed skeletons in consumer files | D-03 explicit — co-location keeps shape in sync with real list |
| Visual register tokens (slate-800, rounded-xl) | New tokens for skeletons | Reuse Phase 7's `Card` visual register (slate-700 bar background; slate-800 panel outer) | Phase 9 has no design-token mandate; consistency with Phase 7 is the right default |

**Key insight:** Phase 9 is intentionally low-novelty. The Skeleton primitive is ~40 lines. The three composed skeletons are 20-40 lines each. The App.tsx edit is a 6-line subtraction + 3-line addition. The consumer wirings are 3-line ternaries inserted at exact locations Phase 8 already opened up. The work is composition, not invention.

---

## Code Examples

### Example 1: Skeleton primitive (full file, copy-paste ready)

```typescript
// src/components/ui/Skeleton.tsx
import type { HTMLAttributes } from 'react';

type SkeletonVariant = 'line' | 'card' | 'circle';

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: SkeletonVariant;
  width?: string;     // Tailwind class, e.g., 'w-24', 'w-1/2'
  height?: string;    // Tailwind class, e.g., 'h-4', 'h-12'
  rounded?: string;   // Override default radius, e.g., 'rounded-full', 'rounded-xl'
}

const variantStyles: Record<SkeletonVariant, string> = {
  line:   'h-4 w-full rounded',
  card:   'h-24 w-full rounded-xl',
  circle: 'h-10 w-10 rounded-full',
};

export function Skeleton({
  variant = 'line',
  width,
  height,
  rounded,
  className = '',
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className={`bg-slate-700 animate-pulse ${variantStyles[variant]} ${width ?? ''} ${height ?? ''} ${rounded ?? ''} ${className}`.trim()}
      {...props}
    />
  );
}
```

### Example 2: Skeleton primitive tests (mirror `EmptyState.test.ts` style)

```typescript
// src/components/ui/Skeleton.test.ts
import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  // --- UI-05: Skeleton defaults render a div with animate-pulse and slate background ---
  it('Test 1 (UI-05 default render): renders a div with animate-pulse and bg-slate-700', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton));
    expect(html).toContain('animate-pulse');
    expect(html).toContain('bg-slate-700');
    expect(html).toMatch(/role="status"/);
  });

  // --- UI-05: line variant has h-4 + rounded ---
  it('Test 2 (UI-05 line variant): default variant has h-4 and rounded', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton, { variant: 'line' }));
    expect(html).toContain('h-4');
    expect(html).toContain('rounded');
  });

  // --- UI-05: card variant has h-24 + rounded-xl ---
  it('Test 3 (UI-05 card variant): renders h-24 and rounded-xl', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton, { variant: 'card' }));
    expect(html).toContain('h-24');
    expect(html).toContain('rounded-xl');
  });

  // --- UI-05: circle variant has rounded-full ---
  it('Test 4 (UI-05 circle variant): renders rounded-full', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton, { variant: 'circle' }));
    expect(html).toContain('rounded-full');
  });

  // --- UI-05: width and height props are applied ---
  it('Test 5 (UI-05 dimension props): width and height classes are appended', () => {
    const html = renderToStaticMarkup(
      React.createElement(Skeleton, { width: 'w-32', height: 'h-6' })
    );
    expect(html).toContain('w-32');
    expect(html).toContain('h-6');
  });

  // --- UI-05: rounded prop overrides default ---
  it('Test 6 (UI-05 rounded override): rounded prop is appended', () => {
    const html = renderToStaticMarkup(
      React.createElement(Skeleton, { rounded: 'rounded-2xl' })
    );
    expect(html).toContain('rounded-2xl');
  });

  // --- UI-05: className prop is appended last ---
  it('Test 7 (UI-05 className override): className is appended', () => {
    const html = renderToStaticMarkup(
      React.createElement(Skeleton, { className: 'my-custom-class' })
    );
    expect(html).toContain('my-custom-class');
  });
});
```

### Example 3: Barrel update

```typescript
// src/components/ui/index.ts
export { Button, ButtonLink, getButtonClasses } from './Button';
export { Input } from './Input';
export { Select } from './Select';
export { Textarea } from './Textarea';
export { Card } from './Card';
export { EmptyState, shouldShowEmptyState } from './EmptyState';   // CHANGED — adds shouldShowEmptyState
export { Skeleton } from './Skeleton';                              // NEW
export type { SkeletonProps } from './Skeleton';                    // OPTIONAL
```

### Example 4: AssetListSkeleton (responsive — mobile cards + desktop table)

See **Per-Consumer Integration Plan § A** above for the full code. Drop-in location: inside `AssetLibrary.tsx`, between the file imports and the `export function AssetLibrary`.

### Example 5: JobsListSkeleton

See **Per-Consumer Integration Plan § B** above.

### Example 6: PrinterListSkeleton

See **Per-Consumer Integration Plan § C** above.

### Example 7: App.tsx after edits (relevant fragments)

```typescript
// src/App.tsx — after edits

// Lines 44-54 (UNCHANGED — assetsLoading kept)
const {
  assets,
  isLoading: assetsLoading,
  ...
} = useAssets();

// Line 56-57 (UNCHANGED)
const materials = assets.filter(a => a.category !== 'printer');

// Lines 59-63 (CHANGED — settingsLoading destructure removed)
const {
  electricity,
  updateElectricity,
  // isLoading: settingsLoading,   ← REMOVED
} = useAllSettings();

// Lines 65-71 (UNCHANGED — jobsLoading kept)
const {
  jobs,
  isLoading: jobsLoading,
  ...
} = useJobs();

// Lines 73-76 (CHANGED — printersLoading destructure removed)
const {
  printers,
  // isLoading: printersLoading,   ← REMOVED
} = usePrinters();

// Lines 78-85 (UNCHANGED — instancesLoading kept)
const {
  instances: printerInstances,
  isLoading: instancesLoading,
  ...
} = usePrinterInstances();

// Lines 87-91 (CHANGED — profileLoading destructure removed)
const {
  profile: userProfile,
  updateProfile: updateUserProfile,
  // isLoading: profileLoading,    ← REMOVED
} = useUserProfile();

// Lines 93-97 (CHANGED — shippingLoading destructure removed)
const {
  shipping: shippingConfig,
  updateShipping: updateShippingConfig,
  // isLoading: shippingLoading,   ← REMOVED
} = useShippingConfig();

// Lines 99-104 (CHANGED — feesLoading destructure removed)
const {
  fees: marketplaceFees,
  updateFees: updateMarketplaceFees,
  resetToDefaults: resetMarketplaceFees,
  // isLoading: feesLoading,       ← REMOVED
} = useMarketplaceFees();

// Line 106 — REMOVED ENTIRELY:
// const isLoading = assetsLoading || settingsLoading || jobsLoading || printersLoading || instancesLoading || profileLoading || shippingLoading || feesLoading;

// Lines 149-155 — REMOVED ENTIRELY:
// if (isLoading) {
//   return (
//     <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
//       <div className="text-slate-400">Loading...</div>
//     </div>
//   );
// }

// Line 290 — CHANGED (add isLoading prop):
<JobsManager
  jobs={jobs}
  isLoading={jobsLoading}        {/* NEW */}
  materials={materials}
  ...
/>

// Line 304 — CHANGED (add isLoading prop):
<AssetLibrary
  assets={assets}
  isLoading={assetsLoading}      {/* NEW */}
  onAddAsset={addAsset}
  ...
/>

// Line 318 — CHANGED (add isLoading prop):
<PrinterSettings
  printers={printers}
  printerInstances={printerInstances}
  isLoading={instancesLoading}   {/* NEW */}
  jobs={jobs}
  ...
/>
```

---

## Runtime State Inventory

**Trigger:** Phase 9 is a UI feature addition + small refactor (App.tsx loading gate removal). Not a rename/refactor/migration phase. **Skipping the formal inventory per the protocol.**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema change, no string rename, no migration | None |
| Live service config | None — no external services involved | None |
| OS-registered state | None — no OS integration touched | None |
| Secrets/env vars | None — no auth or third-party API | None |
| Build artifacts | None — no rename of installed packages | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + lint guard + tests | ✓ | LTS (CI uses default) | — |
| npm | Package management | ✓ | lockfile v3 | — |
| React | Component runtime | ✓ | 19.2.0 | — |
| react-dom/server (`renderToStaticMarkup`) | Skeleton test render | ✓ | 19.2.0 | — |
| Tailwind v4 | Styling (incl. `animate-pulse`) | ✓ | 4.1.18 | — |
| vitest | Unit tests | ✓ | 4.1.4 | — |
| jsdom | DOM env for tests | ✓ | 29.0.2 | — |
| TypeScript | Type checking (`tsc -b` per CLAUDE.md) | ✓ | 5.9.3 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — `@testing-library/react` is NOT installed and **deliberately not added in this phase** (mirrors Phase 8's decision; `renderToStaticMarkup` covers the test surface).

---

## Validation Architecture

> Project config: `.planning/config.json` → `workflow.nyquist_validation: true`. Include validation strategy.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 + jsdom 29.0.2 |
| Config file | `vitest.config.ts` (root) — `environment: 'jsdom'`, `include: ['src/**/*.test.ts']` |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` (currently 3 suites: threeMfParser, EmptyState, Skeleton-to-be-added) |
| Estimated runtime | < 5 seconds for unit; ~15 seconds for full `npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-05 | `Skeleton` default render produces `animate-pulse` + `bg-slate-700` + `role="status"` | unit | `npm test` | ❌ Wave 0 |
| UI-05 | `Skeleton` line variant has `h-4` + `rounded` | unit | `npm test` | ❌ Wave 0 |
| UI-05 | `Skeleton` card variant has `h-24` + `rounded-xl` | unit | `npm test` | ❌ Wave 0 |
| UI-05 | `Skeleton` circle variant has `rounded-full` | unit | `npm test` | ❌ Wave 0 |
| UI-05 | `Skeleton` width/height/rounded props applied | unit | `npm test` | ❌ Wave 0 |
| UI-05 | `Skeleton` className prop appended last | unit | `npm test` | ❌ Wave 0 |
| UI-05 | `shouldShowEmptyState` (4-branch predicate) | unit | `npm test` | ✅ (already in `EmptyState.test.ts:8-25`) |
| UI-05 — App.tsx | "Loading..." text removed; no global gate block | automated grep | `! grep -rn '"Loading\.\.\.\|Loading…"' src/App.tsx` (after Phase 9 commit; should match zero lines) | n/a (assertion) |
| UI-05 — App.tsx | No global `if (isLoading)` block in App.tsx | automated grep | `! grep -n 'if (isLoading)' src/App.tsx` (after Phase 9 commit) | n/a |
| UI-05 — TypeScript | All consumer Props now require `isLoading: boolean` | automated | `tsc -b` (part of `npm run build`) | ✓ |
| UI-05 — Lint guard | Build succeeds; no raw form elements introduced | automated | `npm run lint:no-raw-html` | ✓ |
| UI-05 — Cold-reload UAT (AssetLibrary skeleton appears) | Visual; timing-sensitive | manual UAT | n/a (visual) | n/a |
| UI-05 — Cold-reload UAT (JobsManager skeleton appears) | Visual; timing-sensitive | manual UAT | n/a (visual) | n/a |
| UI-05 — Cold-reload UAT (PrinterSettings skeleton appears) | Visual; timing-sensitive | manual UAT | n/a (visual) | n/a |
| UI-05 — Cold-reload UAT (no flicker after load) | Visual | manual UAT | n/a | n/a |
| UI-05 — Cold-reload UAT (Calculator + header interactive during load) | Interaction | manual UAT | n/a | n/a |
| UI-05 — Empty-state ordering UAT (empty jobs, no flash of empty state) | Visual; data-dependent | manual UAT | Tester clears jobs DB; cold-reloads; confirms skeleton → empty state with NO intermediate flash | n/a |
| UI-05 — Tauri vs Web parity | Same skeleton renders in both builds | manual UAT | Run `npm run dev` (web) and `npm run tauri:dev` (desktop); compare | n/a |

### Sampling Rate

- **Per task commit:** `npm run lint:no-raw-html && tsc -b` (< 5 s)
- **Per wave merge:** `npm test && npm run build` (< 30 s)
- **Phase gate:** Full `npm run build` green + manual UAT script for the 5 visual/timing checks above
- **Max feedback latency:** 5 s for unit; 30 s for full build

### Wave 0 Gaps

- [ ] `src/components/ui/Skeleton.tsx` — primitive (Pattern Example 1)
- [ ] `src/components/ui/Skeleton.test.ts` — primitive tests (Pattern Example 2)
- [ ] `src/components/ui/index.ts` — add `Skeleton` export + `shouldShowEmptyState` re-export

*(Existing infrastructure — vitest, jsdom, `tsc -b`, `lint-no-raw-html.mjs` — covers everything else. No framework install needed.)*

### Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AssetLibrary skeleton appears during cold load | UI-05 | Timing-sensitive; depends on IndexedDB warm/cold state | DevTools → Application → IndexedDB → 3DCoster → Clear. Cold-reload (Ctrl+Shift+R). Switch to Materials tab. Confirm AssetListSkeleton (5 table rows or 3 mobile cards) appears with `animate-pulse` (visible as pulsing opacity). Confirm it's replaced by real materials after ~200-500ms. |
| JobsManager skeleton appears during cold load | UI-05 | Same as above | DevTools clear IDB. Cold-reload. Switch to Jobs tab. Confirm 4 placeholder job rows with pulse animation. Confirm replacement by empty state (no jobs default) or real jobs if any. |
| PrinterSettings skeleton appears during cold load | UI-05 | Same as above | DevTools clear IDB. Cold-reload. Switch to Settings tab. Confirm 3 placeholder printer rows. Confirm replacement by empty state (no printer instances default) or real instances if any. |
| No flicker after load | UI-05 D-05 | Visual transition quality | After cold-reload, observe each list — skeleton should transition smoothly to real content (no missing frame, no white flash, no jitter). Acceptable: single-frame opacity dip if Tailwind animation isn't done playing. |
| App shell + Calculator interactive during load | UI-05 D-01 | Interaction during transient state | Cold-reload with throttled CPU (DevTools → Performance → CPU 4× slowdown). While skeletons render on List tabs, click the header settings gear, navigate via tab buttons, type into Calculator inputs. Confirm all are responsive. |
| Empty-state-vs-skeleton ordering | UI-05 D-10 | Data-dependent timing | Cold-reload with empty jobs DB (no jobs saved). Switch to Jobs tab. Confirm: skeleton appears first → transitions to EmptyState (NOT a flash of empty state during loading). |
| Tauri parity | UI-05 D-06 | Cross-platform render | Run `npm run tauri:dev`. Confirm same behavior as web build. No platform-specific code paths in Phase 9 — should match exactly. |
| No NEW badge appears | UI-05 D-08 | Negative check | Confirm no badge on any tab heading for "skeleton-loading". Check `src/features.ts` — no `'skeleton-loading'` key registered. |

### Validation Sign-Off Criteria

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Skeleton.tsx, Skeleton.test.ts, index.ts barrel update)
- [ ] No watch-mode flags (vitest `run` not `watch`)
- [ ] Feedback latency < 5 s for unit; < 30 s for full build
- [ ] `nyquist_compliant: true` set in frontmatter once tests land and pass
- [ ] Manual UAT script executed and signed off (8 checks above)

---

## Security Domain

> `security_enforcement` not explicitly set in `.planning/config.json` — defaults to enabled. Phase 9 scope is purely client-side presentational UI with **zero new input handling, zero new data flow, zero external API**.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — no auth in app |
| V3 Session Management | no | n/a — local-only, no session |
| V4 Access Control | no | n/a — single-user local app |
| V5 Input Validation | no (transitive) | Skeleton accepts only Tailwind-class string props; rendered as `className` attribute on a `<div>`. No user input reaches the DOM. `width`/`height`/`rounded` props are NOT sanitized because they're developer-set, not user-set — same posture as every other primitive in `ui/`. |
| V6 Cryptography | no | n/a |
| V7 Error Handling | no | no new error paths |
| V8 Data Protection | no | no PII added |
| V9 Communication | no | no network call added |
| V10 Malicious Code | no | no new untrusted input |
| V11 Business Logic | no | trivial predicate, already covered by Phase 8 |
| V12 Files | no | no file I/O added |
| V13 API | no | no API call added |
| V14 Configuration | no | no config added |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via className injection from user data | Tampering | Not applicable — Skeleton's props are developer-set Tailwind class strings, never sourced from user input |
| Race condition on first-paint | Tampering | Mitigated by D-10 explicit render order + Pitfall 6 verification (no flash of empty-state during loading) |

**Conclusion:** Phase 9 has no security domain that requires new controls. The Skeleton primitive is purely presentational. Removing the App.tsx global loading gate does not introduce any new authorization or session-management concern — the app remains single-user, local-only, no auth.

---

## State of the Art

Not applicable — this phase introduces no new technology, library, or pattern that has evolved. Skeleton loaders as a UI pattern are ~10+ years old (originated at Facebook circa 2013). The Tailwind `animate-pulse` utility has been stable since Tailwind v2. The React functional + props pattern is unchanged.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Skeleton variant tokens (line=h-4 rounded, card=h-24 rounded-xl, circle=h-10 w-10 rounded-full) are visually acceptable | Skeleton Primitive Shape | Low — UAT can request token adjustments; trivial one-line change per variant |
| A2 | 5 skeleton rows for AssetLibrary desktop, 3 for mobile cards, 4 for JobsManager, 3 for PrinterSettings is appropriate | Per-Consumer Integration | Low — D-03 says "3-5 rows is a safe default"; UAT can adjust |
| A3 | Single-return refactor of JobsManager is safer than preserving the early-return pattern | Per-Consumer Integration § B + Pitfall 1 | Low — both patterns are valid; single-return additionally avoids hook-order concerns and keeps modal mount points stable |
| A4 | Default render values for object hooks (useUserProfile, useShippingConfig, useMarketplaceFees, useAllSettings) make first-paint safe after global gate removal | Pitfall 5 | Medium — verified via source read; if any hook elsewhere returns `undefined` on first paint without a default, CostCalculator could crash. Verification via cold-reload UAT will catch this. |
| A5 | `renderToStaticMarkup` test pattern is sufficient for Skeleton; RTL not needed | Validation Architecture | Low — mirrors Phase 8 precedent which works |
| A6 | Pruning unused `xxxLoading` destructurings in App.tsx is in scope and required (TypeScript `noUnusedLocals` would otherwise flag) | App.tsx changes | Low — CONTEXT D-01 explicitly authorizes this ("planner decides whether they're still needed anywhere else or can be dropped entirely") |
| A7 | Keeping the existing `_getPrinterName` dead code (08-REVIEW IN-03) is out of scope for Phase 9 | Pitfall 2 | Low — pre-existing tech debt; Phase 9 cleanup of unrelated code would compound the scope |
| A8 | `animate-pulse` per-bar (D-02 default) is acceptable on low-end hardware with ~20 bars total across all 3 list skeletons | Pitfall 4 | Low — modern browsers batch CSS animations; sub-second skeleton lifetime means perf hit is invisible. If observed, switch to Option B in future phase. |
| A9 | Tauri build needs no special handling because IndexedDB is identical across web/Tauri | Manual-Only Verifications | Low — verified by reading `src/db/database.ts` (uses Dexie's standard IndexedDB driver) and historical Phase 1 decisions |
| A10 | The new `isLoading` prop on AssetLibrary/JobsManager/PrinterSettings has no callers outside App.tsx | Pitfall 7 | Low — grepped for `<AssetLibrary`, `<JobsManager`, `<PrinterSettings` — only App.tsx references found. If a future test file renders them directly, the test will need the prop. |

**User-confirmation candidates:** A2 (row counts) is worth surfacing at plan-check — the planner should confirm 5/3/4/3 with the user, or note that UAT will validate. The rest are implementation details or verified-low-risk.

---

## Open Questions

1. **Should the existing `_getPrinterName` dead code (08-REVIEW IN-03) be cleaned up as part of Phase 9?**
   - What we know: It sits 2 lines above the early-return at JobsManager:195 that Phase 9 converts. Removing it is mechanically trivial.
   - What's unclear: Whether the planner should bundle the cleanup or leave it for a focused refactor phase.
   - Anchored in: CONTEXT D-09 says "Do NOT audit and remove inline 'Loading…' strings in other components… A broader sweep can be a follow-up phase if needed." This sweep-restriction posture is consistent with leaving `_getPrinterName` alone.
   - Recommendation: **NO — out of scope.** Address in a focused cleanup phase or as a follow-up commit.

2. **Should App.tsx pre-emptively drop the unused `settings`/`profile`/`shipping`/`fees`/`printers` `isLoading` destructurings, or leave them in place?**
   - What we know: TypeScript's `noUnusedLocals` strict-mode rule (per `tsconfig`) would flag unused destructured variables.
   - What's unclear: Whether the planner should drop them in the same wave as the App.tsx changes or as a separate cleanup.
   - Anchored in: CONTEXT D-01 explicitly authorizes "planner decides whether they're still needed anywhere else or can be dropped entirely." This is within Phase 9 scope.
   - Recommendation: **YES — drop them.** Otherwise `tsc -b` fails on the build. Phase 9 cannot ship with unused destructurings.

3. **Should the planner extract a `<ListSkeleton>` super-pattern shared across the 3 consumers, or keep them entirely separate?**
   - What we know: The three composed skeletons (AssetListSkeleton, JobsListSkeleton, PrinterListSkeleton) share the "row map" + "outer space-y-3" pattern but differ in per-row internals.
   - What's unclear: Whether co-location (D-03) precludes extracting a helper.
   - Anchored in: CONTEXT D-03 is explicit — "Three composed list skeletons (`AssetListSkeleton`, `JobsListSkeleton`, `PrinterListSkeleton`) are defined inside their consumer files… not in a separate file or a `skeletons/` directory."
   - Recommendation: **NO — keep them entirely separate.** Co-location is the locked decision; extraction is premature optimization for shapes that may drift.

4. **Should the cold-load skeleton briefly fade-in (CSS transition) rather than appear instantly?**
   - What we know: D-05 explicitly says "Skeleton renders immediately when `isLoading` is true. No debounce. No minimum display duration."
   - What's unclear: Whether a CSS opacity transition on the first paint is in or out of scope.
   - Anchored in: D-05 reads as "no timing manipulation." A CSS transition on the skeleton's first appearance would be 0ms→100ms opacity fade, which conflicts with "renders immediately."
   - Recommendation: **NO — no fade-in.** Tailwind `animate-pulse` is the only animation. If post-ship UAT requests softer first-paint, address in a v1.2 polish phase.

5. **Should AssetListSkeleton render BOTH mobile AND desktop layouts (responsive switching) or only one?**
   - What we know: The real AssetLibrary renders mobile cards (`md:hidden`) and desktop table (`hidden md:block`) — both are in the same JSX, switched by Tailwind responsive classes.
   - What's unclear: Whether the skeleton should mirror this responsive structure or just render one variant.
   - Anchored in: D-03 says "skeleton's shape (row count, column widths, button placement) in sync with the real layout" — implies mirroring.
   - Recommendation: **YES — render both with Tailwind responsive switches.** See Per-Consumer Integration § A pattern. Pitfall 10 covers the failure mode if forgotten.

---

## Sources

### Primary (HIGH confidence — direct source read)
- `src/App.tsx` (full file, 333 lines) — verified all 8 isLoading flag destructurings, gate location, consumer call-sites, NewBadge placement
- `src/components/AssetLibrary.tsx` (full file, 1104 lines) — verified `startAddingFilament` handler, existing EmptyState wiring, panel wrapper, mobile/desktop layout split
- `src/components/JobsManager.tsx` (full file, 503 lines) — verified `_getPrinterName` dead-code location, early-return at line 195, modal mounts at 347-498, props interface at 7-17
- `src/components/PrinterSettings.tsx` (full file, 373 lines) — verified `setShowAddForm` handler, existing EmptyState wiring at 199-206, Add Printer form (85-196), Electricity panel (357-369)
- `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Input.tsx`, `src/components/ui/EmptyState.tsx`, `src/components/ui/index.ts` — primitive conventions, prop interface patterns, barrel structure
- `src/components/ui/EmptyState.test.ts` — test pattern via `renderToStaticMarkup`
- `src/components/ui/icons/*` — sub-barrel structure (unchanged in Phase 9)
- `src/hooks/useDatabase.ts` (relevant ranges 1-460) — verified per-hook `isLoading` semantics, default-object patterns at lines 233/254/275/303/337/386, array-default patterns at 101/222/451
- `src/main.tsx` — confirmed the `PageLoading` Suspense fallback is for marketing-page lazy-loading (out of Phase 9 scope per D-09)
- `src/pages/LandingPage.tsx:16` — verified `animate-pulse` precedent
- `package.json`, `vitest.config.ts` — verified test framework, npm scripts, no new deps required
- `scripts/lint-no-raw-html.mjs` (full file) — verified `startsWith('src/components/ui')` exclusion covers test files
- `.planning/config.json` — confirmed `workflow.nyquist_validation: true`

### Secondary (MEDIUM confidence — context docs)
- `.planning/phases/09-skeleton-loading-states/09-CONTEXT.md` — locked decisions D-01..D-11
- `.planning/REQUIREMENTS.md` — UI-05 requirement text
- `.planning/ROADMAP.md` § Phase 9 — success criteria + dependency chain
- `.planning/phases/08-empty-states-with-ctas/08-CONTEXT.md` — Phase 8 D-08 (empty-state-vs-loading deferral)
- `.planning/phases/08-empty-states-with-ctas/08-RESEARCH.md` — primitive convention references, Pitfall framework
- `.planning/phases/08-empty-states-with-ctas/08-REVIEW.md:152-180` — IN-01 `shouldShowEmptyState` dead-code note (Phase 9 resolves this)
- `.planning/phases/08-empty-states-with-ctas/08-REVIEW.md:213-231` — IN-03 `_getPrinterName` dead-code note (Phase 9 leaves it alone)
- `.planning/phases/08-empty-states-with-ctas/08-VALIDATION.md` — validation strategy structure to mirror
- `.planning/phases/07-styling-primitives-pass/07-CONTEXT.md` — primitive system pattern precedent
- `.planning/phases/07-styling-primitives-pass/07-PATTERNS.md` — pattern map style + extraction approach
- `.planning/STATE.md` — milestone context, no concurrent work claims
- `.claude/CLAUDE.md` (project + global) — `tsc -b` rule, port 4173, NEW badge anti-pattern rule

### Tertiary (LOW confidence — not used)
None — every claim above is anchored in either direct source or locked CONTEXT decisions. No WebSearch findings, no library-version uncertainties.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json verified; no new packages
- Architecture (App.tsx loading-flag map): HIGH — every flag traced to exact line + consumer
- Skeleton primitive shape: HIGH — derived from existing primitive conventions
- Per-consumer integration: HIGH — every JSX block located by line number, replacement structure documented
- Pitfalls: HIGH — each pitfall has a verified prevention rule sourced from the codebase
- Validation: HIGH — vitest+jsdom already in repo; mirror Phase 8 patterns

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (30 days — stable, no fast-moving dependencies)

---

*Phase 9 research complete. Planner can proceed to two-plan structure (09-01 Skeleton primitive + barrel; 09-02 App.tsx gate removal + 3 consumer wirings).*
