# Phase 8: Empty States with CTAs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 08-empty-states-with-ctas
**Areas discussed:** Component shape, Illustration / visual style, CTA action, Trigger scope, Copy tone

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Component shape — shared vs inline | Build one reusable EmptyState.tsx in src/components/ui/ vs per-screen inline JSX | ✓ |
| Illustration / visual style | Per-screen SVG vs single shared icon vs full illustration vs emoji | ✓ |
| CTA action — what each button does | Per-screen: open Add modal, switch tab, scroll, custom | ✓ |
| Empty-vs-filter scope — when does empty state show | Strict zero-asset vs include filter-no-result | ✓ |

**User selected all four areas.**

---

## Component Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Shared EmptyState in src/components/ui/ | Foundation-first; future empty states get it for free; matches Phase 7 principle | ✓ |
| Per-screen inline JSX | Less abstraction; visual drift likely; future empty states reinvent | |
| Shared component, but in src/components/ (not ui/) | Out of ui/ because it has 4-slot structure | |

**User's choice:** Shared EmptyState in `src/components/ui/`.
**Notes:** Consistent with Phase 7 D-01 (expand scope for foundation-first). EmptyState joins Button/Input/Select/Textarea/Card as a primitive.

---

## Illustration / Visual Style

| Option | Description | Selected |
|--------|-------------|----------|
| Per-screen inline SVG icons | Distinct identity per screen; no external assets; matches app aesthetic | ✓ |
| Single shared icon for all empty states | Maximum consistency; each screen feels indistinguishable when empty | |
| Per-screen full illustrations | Multi-color decorative; heavier; doesn't match calculator aesthetic | |
| Emoji / icon-font characters | Zero cost; inconsistent rendering; not on-brand | |

**User's choice:** Per-screen inline SVG icons.
**Notes:** Concept-specific (box for Assets, printer for Printers, calculator-card for Jobs). 48–64px, currentColor, Tailwind-styled. Lucide-style outline aesthetic.

---

## CTA Action

| Option | Description | Selected |
|--------|-------------|----------|
| Open the existing Add modal/form per screen | Assets→Add Material; Printers→Add Printer; Jobs→switch to Calculator tab | ✓ |
| Scroll/focus the existing inline form | Lighter-weight; only works if every screen has inline form | |
| Custom per-screen — I'll specify each | User specifies different behavior per screen | |

**User's choice:** Reuse existing Add flows per screen.
**Notes:** No new routing, no scope creep. Planner must trace App.tsx tab-switching state for the Jobs CTA.

---

## Trigger Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: only when list is truly empty | Matches roadmap criterion; filter-no-result deferred | ✓ |
| Both: empty list AND filter-no-result | More polished; three more interaction paths to test; different visual treatment | |
| Strict zero + clean up existing AssetLibrary filter text | Strict zero plus minor visual consistency cleanup | |

**User's choice:** Strict zero-items only.
**Notes:** Existing `<p>No materials found</p>` filter text in AssetLibrary stays as-is. Filter-no-result is a separate UX pass.

---

## Copy Tone

| Option | Description | Selected |
|--------|-------------|----------|
| Match existing JobsManager tone — functional + warm | Direct headline + supportive paragraph; reuse current voice | ✓ |
| Playful / casual | Conversational; doesn't match app's matter-of-fact voice | |
| Minimal / terse | Clean but loses value-explanation | |
| I'll write the copy myself | User writes exact copy before planning | |

**User's choice:** Match existing JobsManager voice.
**Notes:** Planner writes the exact AssetLibrary and PrinterSettings copy in the same direct-headline + supportive-paragraph register. JobsManager's existing copy serves as the reference template.

---

## Claude's Discretion

- Exact SVG path data for the three icons (Lucide-style outline, monochromatic, ~48-64px).
- Exact headline/description wording for AssetLibrary and PrinterSettings (planner writes in JobsManager voice).
- Plan structure (single plan vs primitive-first then three wiring plans) — planner decides based on dependency analysis.
- Whether to extract icons to `src/components/ui/icons/` or inline them in consumers (recommend tiny `icons/` subfolder).
- Exact `EmptyState` prop shape (e.g., `cta: { label; onClick }` vs separate props) — planner picks the API consistent with existing primitives.

## Deferred Ideas

- Filter-no-result empty states (smaller treatment, "Clear filters" CTA) — separate phase later.
- Search-no-result empty states — if/when search is added.
- Cleaning up `<p>No materials found</p>` filter text in AssetLibrary — defer to filter-no-result pass.
- Animation / micro-interaction on empty state appearance — keep static for Phase 8.
