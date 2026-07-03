# Phase 7: Styling Primitives Pass - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 07-styling-primitives-pass
**Areas discussed:** Scope, Marketing pages, Lint guard strategy, Visual / behavior fidelity bar

---

## Scope — which components

| Option | Description | Selected |
|--------|-------------|----------|
| Expanded — all 14 main app components | Replace raw HTML in CostCalculator, JobsManager, PrinterSettings, SettingsModal, AssetLibrary, GcodeImport, BambuImport, CsvImportModal, MaintenanceAlertModal, UserProfileModal, UpdateBanner, FilamentSelector, Header, ImageCarousel. Sets the foundation correctly for all future feature milestones. | ✓ |
| Strict — 3 components only (audit named) | Replace raw HTML only in CostCalculator, JobsManager, PrinterSettings. Fastest but leaves SettingsModal (44 raw elements) and 10 others as future debt. | |
| Tiered — expanded but split into sub-phases | Phase 7a: the 3 audit-named components. Phase 7b: the rest. Better tracking but pushes phase numbering past 12. | |

**User's choice:** Expanded — all 14 main app components
**Notes:** Audit's strict count (3 components) was a spot-check, not the full extent of the inconsistency. Fresh grep at discussion time identified 14 main-app components using raw HTML. User chose expanded to lock in the foundation cleanly before v1.2+ feature milestones touch any of these surfaces.

---

## Marketing pages handling

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope | Marketing pages are content-heavy and intentionally styled differently. Defer to a separate marketing redesign milestone. | ✓ |
| Partial — form elements only | Only swap form/input elements in FeedbackPage; leave page layout alone. | |
| In scope — marketing pages too | Apply primitives everywhere. | |

**User's choice:** Out of scope
**Notes:** Marketing pages (FAQPage, FeedbackPage, LandingPage, etc.) have their own design language and will be handled in a separate marketing redesign milestone. Primitives pass focuses on the calculator app surface.

---

## Lint guard strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Grep-based CI/pre-commit check | Single-line grep script that fails on raw `<button>`/`<input>`/`<select>`/`<textarea>` in main components. ~10 lines of config. | ✓ |
| Custom ESLint rule | Write a custom ESLint rule banning the same elements. More robust, integrates with IDE, but ~50-100 lines of rule code + tests. | |
| Comment convention + PR review only | Document in CLAUDE.md; no automated check. | |

**User's choice:** Grep-based CI/pre-commit check
**Notes:** Lightest approach that still gives automated enforcement. Bypass mechanism via `// allow-raw-html` comment marker on the line above the element. Hook into both pre-commit and `npm run build` so it fails locally AND in CI.

---

## Visual / behavior fidelity bar

| Option | Description | Selected |
|--------|-------------|----------|
| Accept primitive defaults | Components shift to the look the primitives define. Some visual change is expected and IS the goal of the milestone. | ✓ |
| Preserve current per-component look | Add className overrides or new primitive variants to match the current look of each component. | |

**User's choice:** Accept primitive defaults
**Notes:** The audit identified inconsistency as the problem; consistency is the resolution. New primitive variants are added only if a real use case in the 14 components demands it (not speculatively). Behavior preservation (variant, disabled, type coercion, validation, onChange/onClick) is non-negotiable; visual change is acceptable.

---

## Claude's Discretion

The following implementation details are left to the planner and executor:

- **Refactor order across the 14 files** — recommended heaviest-first (SettingsModal → CostCalculator → PrinterSettings → JobsManager → modals → utility components), but planner can adjust.
- **Plan splitting** — whether to ship as one big plan or 2-3 plans grouped by component cluster. Recommended: 2-3 plans (heavy app surfaces → modals → utility) for reviewability.
- **Per-file refactor style** — finish each component before moving on (recommended) vs. all buttons everywhere then all inputs, etc.
- **Exact pre-commit hook installation mechanism** — husky vs. plain `.git/hooks/pre-commit` script. Planner decides based on what the project already has set up.

## Deferred Ideas

- **Marketing-page primitives pass** — `src/pages/FAQPage.tsx`, `src/pages/FeedbackPage.tsx`, `src/pages/LandingPage.tsx`. Out of scope for v1.1; queued for a future marketing redesign milestone.
- **Custom ESLint rule** for raw-HTML ban — if grep proves too fragile in practice (e.g. false positives from JSX inside string literals), upgrade in a later foundation pass.
- **Full design-system token pass** (typography scale, animation curves, elevation tokens) — separate later milestone; primitives pass is the MVP foundation.
- **`Modal` primitive** — multiple modals duplicate shell structure (backdrop, close button, escape handling). Could be extracted as `src/components/ui/Modal.tsx` in a later DX pass.
