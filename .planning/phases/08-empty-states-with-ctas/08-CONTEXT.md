# Phase 8: Empty States with CTAs - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an empty-state UI to the three main list screens (AssetLibrary, JobsManager, PrinterSettings) so each shows an icon/illustration, a headline, supporting copy, and a primary CTA button that drives the user to the next action when its underlying list is empty.

This phase ships visible UX improvement on top of Phase 7's primitive foundation. It is the FIRST phase that introduces a NEW shared component (`EmptyState`) into `src/components/ui/` after the Phase 7 cleanup.

**In scope:**
- New `src/components/ui/EmptyState.tsx` primitive — icon/illustration slot, title, description, CTA label, CTA onClick props
- Wire the empty state into `AssetLibrary.tsx`, `JobsManager.tsx`, and `PrinterSettings.tsx` for the strict "list has zero items" case
- Three per-screen inline SVG icons (one for Assets, one for Jobs, one for Printers)
- Three copy blocks (headline + supporting paragraph) in the existing JobsManager voice
- Three CTA wiring decisions: Assets CTA opens the existing Add Material flow; Printers CTA opens the existing Add Printer flow; Jobs CTA switches the active tab to Calculator
- NEW badge registration in `src/features.ts` under key `empty-states`; rendered as absolute overlay on the relevant tab heading (not inline, not on the CTA button)
- Lint guard from Phase 7 stays green — no raw `<button>` introduced

**Out of scope:**
- Filter-no-result empty states (e.g., "No materials matching 'PETG'") — separate UX problem, deferred to a later phase
- Skeleton loading states — Phase 9 owns those; empty state must NOT render while data is still loading
- New screens (e.g., search results) — only the three list screens listed above
- Replacing the existing inline "No materials found" text in AssetLibrary's filter path — left as-is for now
- Marketing pages (consistent with Phase 7 scope rule)

</domain>

<decisions>
## Implementation Decisions

### Component shape
- **D-01:** Build a single reusable `EmptyState` primitive in `src/components/ui/` (alongside Button, Input, Select, Textarea, Card). Add to `src/components/ui/index.ts` barrel export. Reason: foundation-first principle from Phase 7 — future empty states (filter-no-result, search-no-result, etc.) get the component for free.

### Visual / illustration
- **D-02:** Per-screen inline SVG icons. One distinct icon per screen — concept-specific (e.g., a box/stack for Assets, a printer for Printers, a calculator/job-card for Jobs). Inline SVG, styled with `currentColor` + Tailwind classes. Size in the 48–64px range. No external asset files, no emoji, no shared generic icon.
- **D-03:** Visual register matches the existing app: clean, minimal, monochromatic on the dark-slate background. NOT marketing-style decorative illustration.

### CTA behavior
- **D-04:** Assets empty-state CTA opens the existing Add Material flow inside `AssetLibrary.tsx`. Reuse the existing handler that the current Add Material button triggers; do not invent a new modal.
- **D-05:** Printers empty-state CTA opens the existing Add Printer form/flow inside `PrinterSettings.tsx`. Reuse the existing handler.
- **D-06:** Jobs empty-state CTA switches the active tab to Calculator (since jobs are created from the Calculator, not from inside JobsManager). Wire via whatever existing tab-state mechanism `App.tsx` uses — the planner must investigate and reuse, not invent new routing.

### Trigger scope
- **D-07:** Empty state shows ONLY when the underlying list is truly empty (`assets.length === 0`, `jobs.length === 0`, `printerInstances.length === 0`). It does NOT trigger on filter-no-result. The existing `<p>No materials found</p>` filter text in `AssetLibrary.tsx:838,990` stays as-is for this phase.
- **D-08:** Empty state must NOT render while data is still loading. Coordinate with the existing `dexieIsLoading` / hook-loading patterns so initial paint shows the existing "Loading…" text, not a flashing empty state. Phase 9 will replace "Loading…" with skeletons — empty-state-vs-skeleton ordering is also Phase 9's responsibility, but Phase 8 must not regress the current load behavior.

### Copy tone
- **D-09:** Match the existing JobsManager empty-state voice: direct headline + supportive paragraph explaining the value (e.g., "No jobs saved yet" + "Use the Cost Calculator to create and save print jobs. Track sales and see how many copies you need to break even."). Planner writes the exact headline/description text for AssetLibrary and PrinterSettings in this same register.

### NEW badge
- **D-10:** Register feature key `empty-states` in `src/features.ts` with release date matching the phase ship date. Render the badge as an absolute overlay on the relevant tab heading (per project memory: badge must never push, wrap, shrink, or reflow siblings). Do NOT place it on the CTA button (avoids double-click confusion) and do NOT place it inline anywhere that consumes layout width.

### Lint guard
- **D-11:** The grep-based lint guard from Phase 7 stays active. The new `EmptyState` primitive lives in `src/components/ui/` (excluded from the guard's scan). The CTA button inside `EmptyState` MUST use the shared `Button` primitive — no raw `<button>` introduced anywhere. Phase 7's `npm run build` and pre-commit hook will catch any regression.

### Claude's Discretion
- The exact SVG path data for each icon — planner may pick from a small icon set (e.g., Lucide-style outline icons) or hand-author. Constraint: stylistically consistent across the three, monochromatic, ~48-64px.
- Exact headline/description wording for the AssetLibrary and PrinterSettings copy blocks — planner writes in the JobsManager voice (D-09) and the reviewer/UAT validates fit.
- Order of plans (whether to build `EmptyState` primitive first, then wire it in three separate plans, OR ship it in a single plan) — planner decides based on dependency analysis; the primitive must clearly ship before its consumers.
- Whether to extract the three icons into a small `src/components/ui/icons/` directory or inline them inside the consumer files. Recommend a tiny `icons/` subfolder so future empty states can reuse the icon shapes; planner makes the final call.
- Exact prop shape of `EmptyState` (e.g., `cta: { label: string; onClick: () => void } | undefined` vs separate `ctaLabel`/`ctaOnClick` props). Planner picks the ergonomic one consistent with existing primitives' API style.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope source of truth
- `.planning/REQUIREMENTS.md` — UI-04 (locked requirement)
- `.planning/ROADMAP.md` § Phase 8 — goal + success criteria + NEW badge note + UI hint
- `.planning/PROJECT.md` § Current Milestone — milestone-level rationale (v1.1 Polish & Foundation)

### Primitives to reuse (from Phase 7)
- `src/components/ui/Button.tsx` — Button primitive; use `variant="primary"` for empty-state CTAs; `btnSize` prop (NOT `size`)
- `src/components/ui/index.ts` — public exports; add `EmptyState` here once built
- `.planning/phases/07-styling-primitives-pass/07-CONTEXT.md` — Phase 7 decisions on primitive usage, especially D-08 (behavior preservation) and D-06 (visual change acceptable)

### Empty-state consumers (existing screens)
- `src/components/AssetLibrary.tsx` — currently has filter-no-result text (lines 838, 990); does NOT have a "library is empty" state today
- `src/components/JobsManager.tsx:193-207` — current empty state (headline + paragraph, no CTA, no illustration) — use as the canonical voice/tone reference
- `src/components/PrinterSettings.tsx:198-199` — current one-line empty state — replace with the new primitive

### NEW badge system
- `src/features.ts` — feature registry; add `'empty-states': new Date('...')` entry
- `src/components/NewBadge.tsx` — badge component; absolute overlay pattern documented in project memory ("badge must never push, wrap, shrink, or reflow siblings")

### Lint guard (Phase 7)
- `scripts/lint-no-raw-html.mjs` — active pre-commit + build-time guard
- `.git/hooks/pre-commit` — hook that runs the guard

### Codebase maps
- `.planning/codebase/CONVENTIONS.md` — naming, imports, error handling
- `.planning/codebase/STRUCTURE.md` — directory layout (note `src/components/ui/` reserved for primitives)
- `.planning/codebase/STACK.md` — React 19, Tailwind 4, Dexie

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/Button` — used directly for the CTA inside EmptyState. `variant="primary"`, default `btnSize="md"`.
- `src/components/ui/Card` — possible wrapper if the empty state needs to share the slate-800/rounded-xl/border-slate-700 surface of existing list panels. Verify each consumer's wrapper first — `JobsManager.tsx:195` already wraps its empty state in that surface; PrinterSettings does not.
- `src/components/NewBadge.tsx` — drop in alongside the relevant tab heading via the `<NewBadge feature="empty-states" />` pattern.

### Established Patterns
- Tailwind utility classes only; no CSS modules. Match existing dark theme: `bg-slate-800`, `text-white`, `text-slate-400`, `text-slate-500`, `rounded-xl`, `border border-slate-700`.
- React 19 functional components, hooks-only. Props typed with `interface ComponentNameProps`.
- `import { ... } from './ui'` barrel import pattern.
- Empty-state visuals currently follow `text-center py-12` vertical-rhythm style inside the panel wrapper (JobsManager).

### Integration Points
- `AssetLibrary.tsx` — empty-state branch placement: AssetLibrary's render returns a complex tree; planner must locate the right insertion point (top of the list section vs as a sibling to the existing form). Reuse whatever handler currently opens the Add Material flow for the CTA.
- `JobsManager.tsx:193` — replace the existing inline empty state with `<EmptyState ...>` rendered inside the existing slate-800 wrapper. CTA's `onClick` must invoke the existing tab-switch (Calculator tab) — investigate `App.tsx` for the active-tab state and the setter signature.
- `PrinterSettings.tsx:198` — replace the existing one-liner with `<EmptyState ...>`. CTA's `onClick` must invoke the existing Add Printer handler.
- `App.tsx` — likely holds the tab-switching state. Planner must trace how the existing tab buttons set the active tab so the Jobs CTA can drive it.

</code_context>

<specifics>
## Specific Ideas

- Tone reference: the existing JobsManager empty state copy is the voice template. Direct headline, supportive 1–2 sentence paragraph explaining the value/why-this-matters.
- Visual register: monochromatic outline-style icons (Lucide aesthetic, not marketing illustration). 48–64px, `currentColor`.
- Empty-state shows ONLY for the strict zero-items case. Filter-no-result is intentionally untouched.

</specifics>

<deferred>
## Deferred Ideas

- **Filter-no-result empty states** — e.g., "No materials matching 'PETG'" — uses a different visual treatment (smaller, no illustration, often with a "Clear filters" CTA). Worth its own phase later; not part of Phase 8.
- **Search-no-result empty states** — if/when search is added; same pattern as filter-no-result.
- **Cleaning up the existing inline `<p>No materials found</p>` filter text in AssetLibrary.tsx:838,990** — minor visual inconsistency, deferred until the filter-no-result pass.
- **Animation / micro-interaction on empty state appearance** — keep it static for Phase 8; revisit if a polish pass calls for fade/slide-in.

</deferred>

---

*Phase: 8-Empty States with CTAs*
*Context gathered: 2026-05-19*
