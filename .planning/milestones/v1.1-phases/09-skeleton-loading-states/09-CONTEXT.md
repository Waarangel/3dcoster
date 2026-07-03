# Phase 9: Skeleton Loading States - Context

**Gathered:** 2026-05-19
**Status:** Ready for research / planning

<domain>
## Phase Boundary

Replace App.tsx's monolithic `if (isLoading) → "Loading…"` gate (currently at [src/App.tsx:106](src/App.tsx:106) + [:149-155](src/App.tsx:149)) with per-consumer skeleton components on the three list screens (AssetLibrary, JobsManager, PrinterSettings). The app shell, marketing surfaces, and Calculator tab render immediately while underlying data loads.

This phase activates Phase 8's `shouldShowEmptyState(items, isLoading)` predicate ([src/components/ui/EmptyState.tsx:34-36](src/components/ui/EmptyState.tsx:34)) — currently unused (flagged in 08-REVIEW.md IN-01) — by making each list consumer call it to choose between skeleton, empty state, and real content.

**In scope:**
- New `src/components/ui/Skeleton.tsx` primitive with variants (line / card / circle) and configurable width/height/rounded — added to `src/components/ui/index.ts` barrel
- Three composed list skeletons (`AssetListSkeleton`, `JobsListSkeleton`, `PrinterListSkeleton`) co-located in their respective consumer files so they stay in sync with the real list shapes they mirror
- AssetLibrary, JobsManager, PrinterSettings each render: `isLoading ? <ListSkeleton/> : shouldShowEmptyState(items, isLoading) ? <EmptyState/> : <RealList/>`
- App.tsx removes the global `isLoading` OR-chain block; app shell, marketing surfaces, header, UpdateBanner, and Calculator tab render immediately
- Tailwind `animate-pulse` for the shimmer effect (already used at [src/pages/LandingPage.tsx:16](src/pages/LandingPage.tsx:16); zero new CSS)
- Phase 7 lint guard stays green — Skeleton primitive lives in `src/components/ui/` (excluded from scan); composed list skeletons use only the shared primitive, no raw HTML form elements

**Out of scope:**
- Calculator tab skeleton (the brief empty-dropdown flash in CostCalculator selectors is acceptable; matches post-onboarding state)
- Marketing pages (Landing, Download, FAQ, etc.) — no list views
- Modal-level loading states (SettingsModal, UserProfileModal, MaintenanceAlertModal keep their existing patterns)
- Sweep audit of every inline "Loading…" string — scope limited to the App.tsx removal called out by UI-05
- NEW badge — skeletons appear only during initial load (the moment users are least likely to notice a badge); falls on the Phase 7 side of the visibility line
- Debounce / minimum-display timers — skeletons render immediately when `isLoading` is true
- Shimmer gradient effect — Tailwind `animate-pulse` is sufficient

</domain>

<decisions>
## Implementation Decisions

### Loading-state architecture
- **D-01:** Loading gate moves per-consumer. App.tsx drops the global `if (isLoading)` block at [src/App.tsx:149-155](src/App.tsx:149) and the OR-chain at [src/App.tsx:106](src/App.tsx:106) (or keeps `isLoading` as a derived value only if a consumer still needs aggregate state — planner decides). AssetLibrary, JobsManager, and PrinterSettings each read their own loading flag from their respective hooks (`useAssets`, `useJobs`, `usePrinterInstances`) and render their own skeleton. Reason: makes Phase 8's `shouldShowEmptyState(items, isLoading)` predicate load-bearing and allows the user to interact with the header, tabs, and Calculator while non-list data is still loading.

### Component shape
- **D-02:** Single `Skeleton` primitive lives in `src/components/ui/Skeleton.tsx` alongside Button, Input, Select, Textarea, Card, EmptyState. Variants: `'line' | 'card' | 'circle'`. Configurable: `width`, `height`, `rounded`. Animation built in (uses `animate-pulse` by default; no opt-out needed for v1). Exported from `src/components/ui/index.ts` barrel.
- **D-03:** Three composed list skeletons (`AssetListSkeleton`, `JobsListSkeleton`, `PrinterListSkeleton`) are defined inside their consumer files (`AssetLibrary.tsx`, `JobsManager.tsx`, `PrinterSettings.tsx`) — not in a separate file or a `skeletons/` directory. Reason: co-location with the real list keeps the skeleton's shape (row count, column widths, button placement) in sync with the real layout when that layout changes.

### Animation
- **D-04:** Use Tailwind's `animate-pulse` class on each skeleton element. Already used in `src/pages/LandingPage.tsx:16` so the project has precedent. No custom CSS, no keyframes, no new dependencies. Plays correctly on the slate-800 background.

### Flicker prevention
- **D-05:** Skeleton renders immediately when `isLoading` is true. No debounce. No minimum display duration. A single-frame flash on instant loads is acceptable — matches how the current "Loading…" text behaves and avoids a blank screen for the first 150ms. Even one frame signals "data is coming."

### Scope
- **D-06:** Skeleton scope is exactly the three list screens named in UI-05: assets list (AssetLibrary), jobs list (JobsManager), printer list (PrinterSettings). The Calculator tab, marketing surfaces, modals, and any other UI continue to render without skeletons.

### CostCalculator empty-dropdown flash
- **D-07:** When the app shell renders before assets/printers finish loading, the Calculator tab's asset/printer dropdowns will be briefly empty. This is acceptable. CostCalculator already handles empty selectors gracefully (no crash, matches the post-onboarding state). Do NOT patch CostCalculator to add inline skeleton bars in its selectors — that's scope creep and the empty-dropdown moment is too brief and too rare to justify.

### NEW badge
- **D-08:** No NEW badge for `skeleton-loading`. Skeletons are a quality-of-life improvement, not a feature users seek out. They appear only during initial load — the moment users are least likely to notice a badge. Phase 7 (primitives pass, invisible refactor) had no badge; Phase 8 (empty states, user-discoverable on every blank screen) did. Skeletons fall on the Phase 7 side of that line. Do NOT register a feature key in `src/features.ts` for this phase.

### Inline "Loading…" sweep
- **D-09:** Phase 9's scope is exactly the App.tsx Loading text removal called out by UI-05 plus the three list-screen skeletons. Do NOT audit and remove inline "Loading…" strings in other components (e.g., SettingsModal, UserProfileModal). Those have their own loading patterns that may legitimately use plain text. A broader sweep can be a follow-up phase if needed.

### Empty-state vs skeleton ordering (resolves Phase 8 D-08)
- **D-10:** Each list consumer renders in this exact order:
  ```
  isLoading
    ? <ListSkeleton/>
    : shouldShowEmptyState(items, isLoading)
      ? <EmptyState/>
      : <RealList/>
  ```
  Skeleton never co-exists with EmptyState or RealList. `shouldShowEmptyState` (from Phase 8) already returns `!isLoading && items.length === 0`, so the predicate alone is sufficient — but the planner SHOULD use the explicit `isLoading ? skeleton : predicate-check` structure for readability.

### Lint guard
- **D-11:** Phase 7's `lint:no-raw-html` guard stays active. The new `Skeleton` primitive lives in `src/components/ui/` (excluded from the scan). The three composed list skeletons in consumer files compose only `<Skeleton>` and `<div>` — they introduce no raw `<button>`, `<input>`, `<select>`, or `<textarea>`. `npm run build` and the pre-commit hook will catch any regression.

### Claude's discretion
- The exact dimensions of each Skeleton variant (line height, card padding, etc.) — planner picks values that match the real list rows' shapes; constraint: skeleton row count should approximate the real list's first-paint row count (3-5 rows is a safe default).
- The exact aggregation of remaining App.tsx `isLoading` flags (settings/profile/fees) — planner decides whether they're still needed anywhere else or can be dropped entirely.

</decisions>

<canonical_refs>
## Canonical Refs

- [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) — UI-05 spec
- [.planning/ROADMAP.md](.planning/ROADMAP.md) — Phase 9 goal + success criteria
- [.planning/phases/08-empty-states-with-ctas/08-CONTEXT.md](.planning/phases/08-empty-states-with-ctas/08-CONTEXT.md) — Phase 8 decisions, esp. D-08 (empty-state-vs-loading ordering deferred to Phase 9)
- [.planning/phases/08-empty-states-with-ctas/08-REVIEW.md](.planning/phases/08-empty-states-with-ctas/08-REVIEW.md) — IN-01 (shouldShowEmptyState is dead code today; Phase 9 activates it)
- [.planning/phases/08-empty-states-with-ctas/08-VERIFICATION.md](.planning/phases/08-empty-states-with-ctas/08-VERIFICATION.md) — confirms global `isLoading` gate is the current pattern Phase 9 must replace
- [.planning/phases/07-styling-primitives-pass/07-CONTEXT.md](.planning/phases/07-styling-primitives-pass/07-CONTEXT.md) — primitive pattern Phase 9 follows for `Skeleton.tsx`
- [src/App.tsx:106](src/App.tsx:106), [:149-155](src/App.tsx:149) — current loading gate (to be removed)
- [src/components/ui/EmptyState.tsx:34-36](src/components/ui/EmptyState.tsx:34) — `shouldShowEmptyState` predicate Phase 9 activates
- [src/components/ui/Card.tsx](src/components/ui/Card.tsx) — Phase 7 primitive defining visual register (rounded-xl, slate-800 bg)
- [src/pages/LandingPage.tsx:16](src/pages/LandingPage.tsx:16) — existing `animate-pulse` usage as precedent
- [CLAUDE.md](CLAUDE.md) — `tsc -b` rule, port 4173, NEW badge absolute-overlay rule (no badge in this phase but rule applies if planner adds anything)

</canonical_refs>

<dependencies>
## Dependencies

- Phase 7 (Styling Primitives Pass) — `Card` primitive's visual register (rounded-xl, slate-800 bg, slate-700 border) defines skeleton card shape; `lint:no-raw-html` guard stays active
- Phase 8 (Empty States with CTAs) — `shouldShowEmptyState` predicate is the integration point; `EmptyState` is rendered when not loading and items.length === 0

</dependencies>

<verification_hints>
## Verification Hints (for planner)

The Phase 9 verifier will check:
1. App.tsx no longer contains a "Loading…" string or a global `if (isLoading)` block that blocks the entire UI shell
2. `src/components/ui/Skeleton.tsx` exists and is exported from `src/components/ui/index.ts`
3. Each of AssetLibrary, JobsManager, PrinterSettings renders a skeleton when its respective loading flag is true
4. The order `loading → skeleton → empty state or real content` is correct in all three consumers (no skeleton co-existing with EmptyState or RealList)
5. `shouldShowEmptyState(items, isLoading)` is called in each consumer (no longer dead code)
6. Header, tabs, and Calculator tab remain interactive during the brief window where some data is still loading
7. `animate-pulse` is used (no custom shimmer CSS introduced)
8. `npm test`, `tsc -b`, `npm run lint:no-raw-html`, and `npm run build` all pass green
9. No NEW badge registered for skeleton-loading in `src/features.ts`

</verification_hints>

<deferred_ideas>
## Deferred Ideas (not Phase 9)

- Broader inline "Loading…" sweep across modals (SettingsModal, UserProfileModal, etc.) — could be its own polish phase if anomalies surface
- Skeleton support for CostCalculator selectors during initial asset/printer load — only if the empty-dropdown flash becomes user-visible enough to warrant scope
- Skeleton variants beyond line/card/circle (e.g., `table-row`, `chart`) — add as needed when v1.2+ surfaces appear

</deferred_ideas>
