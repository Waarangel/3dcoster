# Roadmap: 3DCoster v1.1 — Polish & Foundation

**Milestone:** v1.1 Polish & Foundation
**Defined:** 2026-05-19
**Phase range:** 7–12 (v1.0 ended at Phase 6)
**Requirements:** 11 total (UI-01–UI-07, TEST-01–TEST-02, PERF-01–PERF-02)
**Coverage:** 11/11 — 100%

**Constraints encoded in this roadmap:**
- All phases are FREE tier — no paid-tier work in this milestone
- All phases are LOCAL-ONLY — no backend, no Supabase, no API calls
- Phase 7 is foundational: its primitives must be available before Phases 8–10 add new UI surfaces

---

## Phases

- [x] **Phase 7: Styling Primitives Pass** — Replace raw HTML form elements in main components with shared ui/ primitives (completed 2026-05-19)
- [ ] **Phase 8: Empty States with CTAs** — Every blank screen guides users with an empty-state component
- [ ] **Phase 9: Skeleton Loading States** — Skeleton shapes replace plain "Loading..." text during IndexedDB load
- [ ] **Phase 10: Dark Mode** — First-class light/dark/system theme toggle; all surfaces correct in both themes
- [ ] **Phase 11: Cost-Calculation Unit Tests** — Full vitest coverage of cost-calc logic, runs on every CI build
- [ ] **Phase 12: Performance Optimization** — manualChunks vendor split + list virtualization for jobs and assets

---

## Phase Details

### Phase 7: Styling Primitives Pass
**Goal**: All raw `<button>`, `<input>`, `<select>`, and `<textarea>` elements across the 14 main app components (CONTEXT.md D-01 expanded scope) are replaced with shared `src/components/ui/` primitives, and a grep-based lint guard prevents regression
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. All 14 in-scope main components (SettingsModal, CostCalculator, PrinterSettings, JobsManager, AssetLibrary, CsvImportModal, UserProfileModal, BambuImport, GcodeImport, ImageCarousel, UpdateBanner, FilamentSelector, Header, MaintenanceAlertModal) contain zero raw `<button>`, `<input>`, `<select>`, or `<textarea>` elements outside `// allow-raw-html` opt-outs — confirmed by `node scripts/lint-no-raw-html.mjs`
  2. All replaced elements preserve existing behavior: correct variants, sizes, disabled states, type coercion, validation, and onChange/onClick handlers (D-08)
  3. Grep-based lint guard is active at build time — `npm run build` chains `node scripts/lint-no-raw-html.mjs` and a pre-commit hook blocks raw form-element introduction
  4. No behavioral regression: AssetLibrary form-submit semantics intact; SettingsModal tab switching works; CostCalculator inputs accept and coerce numeric values
**Plans**: 3 plans
**Plans**:
- [x] 07-03-PLAN.md — Wave 0: Install lint guard (script + package.json + pre-commit hook) and refactor 9 lightweight components (MaintenanceAlertModal, UpdateBanner, FilamentSelector, Header, GcodeImport, ImageCarousel, CsvImportModal, UserProfileModal, BambuImport); finishes with 5 adversarial lint tests
- [x] 07-01-PLAN.md — Wave 1: Refactor SettingsModal (44), CostCalculator (32), PrinterSettings (18) — heaviest tier (94 raw elements)
- [x] 07-02-PLAN.md — Wave 1: Refactor AssetLibrary (40, contains the only `<form>`) and JobsManager (13) — medium tier (53 raw elements)
**Note**: Internal refactoring only — no user-visible change. No NEW badge. Phases 8, 9, and 10 depend on this pass so they build new UI surfaces on consistent primitives from the start.

### Phase 8: Empty States with CTAs
**Goal**: Every blank screen in the app shows an empty-state component with an illustration, headline, supporting copy, and a primary CTA button that drives the user to the next action
**Depends on**: Phase 7 (empty-state component uses shared Button primitive from Phase 7's pass)
**Requirements**: UI-04
**Success Criteria** (what must be TRUE):
  1. The Asset library screen with zero assets shows an empty-state component (icon/illustration + headline + supporting copy + CTA button leading to "Add Asset")
  2. The Jobs screen with zero saved jobs shows an empty-state component with a CTA leading to the cost calculator
  3. The Printer Settings screen with no printers configured shows an empty-state component with a CTA leading to "Add Printer"
  4. All three empty-state CTA buttons use the shared `Button` primitive from `src/components/ui/` — no raw `<button>` introduced
**Plans**: 2 plans
**Plans**:
- [ ] 08-01-PLAN.md — Wave 1: Create EmptyState primitive + shouldShowEmptyState predicate + unit tests; three Lucide-style icon components (Package, ClipboardList, Printer) + icons sub-barrel; add EmptyState to top-level ui barrel; register `empty-states` in src/features.ts
- [ ] 08-02-PLAN.md — Wave 2: Wire EmptyState into AssetLibrary, JobsManager (with new onSwitchTab prop drilled from App.tsx), and PrinterSettings; add NewBadge `empty-states` overlay on jobs/materials/settings tab buttons; manual UAT checkpoint verifies CTA interactions and badge layout
**UI hint**: yes
**NEW Badge**: yes — `empty-states` registered in `src/features.ts`; badge placed as absolute overlay on the relevant tab or section heading (not inline, not on the CTA itself to avoid double-click confusion)

### Phase 9: Skeleton Loading States
**Goal**: Skeleton loading components replace the plain "Loading..." text during initial IndexedDB load for all three list views
**Depends on**: Phase 7 (skeleton card shape uses shared Card primitive for visual consistency)
**Requirements**: UI-05
**Success Criteria** (what must be TRUE):
  1. The assets list, jobs list, and printer list each show a skeleton component during initial IndexedDB load — each skeleton matches the approximate shape and row count of the real content layout
  2. The plain "Loading..." text in `App.tsx` is removed; no plain-text loading fallback remains anywhere in the three list views
  3. Skeleton components are replaced by real content (or Phase 8 empty states) once data loads — no flicker, no skeleton persisting after load
**Plans**: TBD
**UI hint**: yes

### Phase 10: Dark Mode
**Goal**: Users can toggle between Light, Dark, and System themes from Settings; preference persists across sessions; every existing surface renders correctly in both themes with no hardcoded color leaks
**Depends on**: Phase 7 (consistent primitive classes make theme token application tractable); Phases 8 and 9 should complete before Phase 10 so their new surfaces are themeable from the start
**Requirements**: UI-06, UI-07
**Success Criteria** (what must be TRUE):
  1. A Light / Dark / System toggle control is present in Settings; user selection persists in localStorage and survives page reload
  2. System mode reads the OS-level preference at load time and reacts in real time to OS theme changes without a manual page reload
  3. Every existing surface — calculator, jobs list, asset library, printer settings, settings modal, profile modal, update banner, maintenance alert modal — renders correctly in both light and dark themes with no hardcoded `slate-900` leaks and no contrast failures
  4. Marketing pages (Landing, Download, FAQ, etc.) render correctly in both themes — no white-on-white or black-on-black surfaces
  5. The theme implementation uses CSS custom properties or a Tailwind `dark:` class strategy (not per-component duplication); the chosen approach is recorded in PROJECT.md Key Decisions at phase completion
**Plans**: TBD
**UI hint**: yes
**NEW Badge**: yes — `dark-mode` registered in `src/features.ts`; badge placed as absolute overlay on the theme toggle control in Settings

### Phase 11: Cost-Calculation Unit Tests
**Goal**: Vitest unit tests cover all cost-calculation factors in CostCalculator.tsx and run automatically under `npm test` and on every CI/build pass
**Depends on**: Phase 7 completing (ensures the component under test is in its final clean state); no other UI phase dependency — can execute in parallel with Phases 8–10 if desired
**Requirements**: TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. Unit tests cover all calculation factors: material cost (multi-filament, per-filament weight), electricity, printer depreciation, nozzle wear (per-material density via `getMaterialDensity`), labor (prep + post-processing time), failure-rate adjustment, and model amortization
  2. A named pending/skipped test for the tax/VAT factor is included with a note that it activates when v1.2 lands — the suite is extensible without rework
  3. `npm test` exits with code 0 on a clean codebase; the test suite is integrated so CI fails the build if any test fails
  4. All tests are deterministic: no IndexedDB dependency, no browser API dependency, no network calls
**Plans**: TBD

### Phase 12: Performance Optimization
**Goal**: Vite produces explicit vendor chunks that keep the main app bundle under 300 KB gzipped; jobs and asset lists use virtualization for lists exceeding 100 items and remain smooth under 4× CPU throttle
**Depends on**: Nothing — this is a build-config and rendering change; no dependency on prior v1.1 phases. Can execute in parallel with any other phase.
**Requirements**: PERF-01, PERF-02
**Success Criteria** (what must be TRUE):
  1. `vite.config.ts` defines `build.rollupOptions.output.manualChunks` splitting at minimum the React runtime and Dexie into separate vendor chunks — confirmed visible in the generated `dist/assets/` output filenames
  2. The main app chunk is under 300 KB gzipped — verified via `npm run build` and inspecting chunk sizes
  3. The jobs list and asset library list use virtualization (react-window or react-virtual) when item count exceeds 100; scrolling a 500-item test list under 4× CPU slowdown in DevTools produces no dropped frames
  4. Lists with fewer than 100 items render identically to pre-Phase-12 — no regressions for the common case
**Plans**: TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Styling Primitives Pass | 3/3 | Complete    | 2026-05-19 |
| 8. Empty States with CTAs | 0/2 | Not started | - |
| 9. Skeleton Loading States | 0/TBD | Not started | - |
| 10. Dark Mode | 0/TBD | Not started | - |
| 11. Cost-Calculation Unit Tests | 0/TBD | Not started | - |
| 12. Performance Optimization | 0/TBD | Not started | - |

---

## Coverage Map

| Requirement | Phase | Category |
|-------------|-------|----------|
| UI-01 | Phase 7 | UI |
| UI-02 | Phase 7 | UI |
| UI-03 | Phase 7 | UI |
| UI-04 | Phase 8 | UI |
| UI-05 | Phase 9 | UI |
| UI-06 | Phase 10 | UI |
| UI-07 | Phase 10 | UI |
| TEST-01 | Phase 11 | Test |
| TEST-02 | Phase 11 | Test |
| PERF-01 | Phase 12 | Performance |
| PERF-02 | Phase 12 | Performance |

**Mapped: 11/11** — no orphans

---

## Dependency Graph

```
Phase 7 (Primitives Pass)  <-- foundation for all UI phases
  └── Phase 8 (Empty States)      -- uses Button primitive from Phase 7
  └── Phase 9 (Skeleton States)   -- uses Card primitive from Phase 7
  └── Phase 10 (Dark Mode)        -- Phase 7 + 8 + 9 should complete first
                                     so new surfaces are themeable at once

Phase 11 (Unit Tests)      -- depends on Phase 7 only (component in final state)
                              can run in parallel with Phases 8–10

Phase 12 (Performance)     -- no UI dependency; can run in parallel with any phase
```

---

*Roadmap created: 2026-05-19*
*Phase 7 plans created: 2026-05-19*
*Phase 8 plans created: 2026-05-19*
*Overwrites previous ROADMAP.md (v1.1 Quote-to-Customer — deferred to v1.2 per 2026-05-19 milestone swap)*
