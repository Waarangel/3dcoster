# Requirements: 3DCoster v1.1 — Polish & Foundation

**Defined:** 2026-05-19
**Core Value:** Establish a consistent component foundation so every subsequent free-tier milestone is built on the same primitives — no rework when v1.2+ features ship.

## v1.1 Requirements

Requirements for milestone v1.1. Each maps to exactly one roadmap phase. All requirements sit on the FREE side of the free/paid line per [docs/ROADMAP.md](../docs/ROADMAP.md) "Guiding Principle" (2026-05-19).

### UI

- [x] **UI-01**: All `<button>` elements in `CostCalculator.tsx`, `JobsManager.tsx`, and `PrinterSettings.tsx` are replaced with the shared `<Button>` / `<ButtonLink>` components from `src/components/ui/`, preserving existing behavior (variant, size, disabled, onClick)
- [x] **UI-02**: All `<input>`, `<select>`, and `<textarea>` elements in the three components above are replaced with shared `<Input>` / `<Select>` / `<Textarea>` primitives, preserving type coercion, validation, and onChange behavior
- [x] **UI-03**: A lint rule (eslint custom or comment-based) prevents new raw `<button>` / `<input>` / `<select>` elements from being added to main app components in the future — caught at build time
- [x] **UI-04**: Every empty screen in the app (Asset library with no assets, JobsManager with no jobs, PrinterSettings with no printers configured) shows an empty-state component with an icon/illustration, headline, supporting copy, and a primary CTA button that drives the user to the next action
- [ ] **UI-05**: Skeleton loading components are shown during initial IndexedDB load — assets list, jobs list, and printer list each have their own skeleton shape matching the final content layout. The plain "Loading…" text in [App.tsx](src/App.tsx) is removed

### Test

- [x] **TEST-01**: Unit tests cover the cost-calculation logic in CostCalculator.tsx — material cost (multi-filament), electricity, depreciation, nozzle wear (per-material density), labor (prep + post-processing), failure-rate adjustment, model amortization, and tax/VAT (when v1.2 lands, the tax tests will be additive)
- [x] **TEST-02**: Cost calc test suite runs under `npm test` and is exercised on every CI run / `npm run build`

### Performance

- [x] **PERF-01**: `vite.config.ts` defines `build.rollupOptions.output.manualChunks` that splits at minimum the React runtime and Dexie into separate vendor chunks; main app chunk is under 300 KB gzipped (currently ~189 KB gzipped pre-split, but the largest dep mix will benefit from explicit split)
- [x] **PERF-02**: JobsManager and Asset library lists use virtualization (react-window or react-virtual) when the list exceeds 100 items; lists of any size remain smooth on a low-end device equivalent (CPU 4× slowdown in DevTools)

## v2 / Future Requirements

Deferred to a future milestone.

### UI

- **UI-F1**: Full design-system token pass (typography scale, animation curves, elevation tokens) — primitives pass is the minimum viable foundation; the larger design-system effort comes later
- **UI-F2**: Customizable theme accent color (user picks brand color) — out of scope for v1.1, ties to white-label/paid tier

### Test

- **TEST-F1**: E2E tests (Playwright or Cypress) covering critical user flows (create job, save, edit, delete, calculate cost). Vitest unit-test infra is in scope for v1.1; E2E is a separate later milestone

## Out of Scope

Explicitly excluded from v1.1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| All v1.2 (Quote-to-Customer) features | Deferred per 2026-05-19 milestone-swap decision |
| Light/dark/system theme toggle (former UI-06, UI-07) | App ships dark-only by design; no toggle planned for v1.1+ (Phase 10 removed 2026-05-19) |
| Customizable theme colors / brand colors | Brand-color = paid tier; out of scope |
| Full design-system token pass | Primitives pass first; full token system is a later effort |
| Playwright / Cypress E2E tests | Vitest unit tests for cost calcs only in v1.1; E2E in a future milestone |
| Marketing-page redesign | Polish pass is scoped to the calculator app + JobsManager + Settings; marketing pages are static and out of scope here |
| Animation / motion design pass | Out of scope for v1.1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 7 | Complete |
| UI-02 | Phase 7 | Complete |
| UI-03 | Phase 7 | Complete |
| UI-04 | Phase 8 | Complete |
| UI-05 | Phase 9 | Pending |
| TEST-01 | Phase 10 | Validated |
| TEST-02 | Phase 10 | Validated |
| PERF-01 | Phase 11 | Complete |
| PERF-02 | Phase 11 | Complete |

**Coverage:**
- v1.1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-05-19*
*Last updated: 2026-05-19 — UI-06/UI-07 moved to Out of Scope; Phase 10 (Dark Mode) removed; subsequent phases renumbered (11→10, 12→11)*
