# Requirements: 3DCoster — v1.9 Hardening

**Defined:** 2026-06-25
**Core Value:** Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes — from a free, local-first tool.

> Sequel to **v1.3 Hardening**. No new user-facing features — every requirement closes a live papercut or an audit finding from `docs/CALCULATOR_APP_AUDIT.md` (Tiers 3–6). Goal: clean the runway for the v2.0 milestone. REQ-IDs continue v1.3's numbering.

## v1.9 Requirements

### Live papercut fixes (FIX)

- [x] **FIX-01**: The web "A new version is available · Reload" banner reliably reloads onto the new version, including on uncontrolled pages (fresh first load or hard refresh). *(Built on `fix/pwa-reload-uncontrolled`.)* — closed in 34-01 (verified PASSED).
- [x] **FIX-02**: Navigating between routes (e.g. footer links) lands at the top of the next page instead of keeping the previous scroll offset. *(ScrollToTop — cherry-pick `4da205f` from the redesign branch; `#hash` anchors left alone.)* — closed in 34-01 (verified PASSED).
- [x] **FIX-03**: The destructive Asset "Reset all" action uses the app's styled confirm modal (showing item counts) instead of `window.confirm()`. *(Audit 3.2.)* — closed in 34-02 (verified PASSED).
- [x] **FIX-04**: Confirming an edit-job jump scrolls the calculator to the "Editing…" banner. *(Audit 3.6.)* — closed in 34-02 (verified PASSED).

### Accessibility — Tier 4 (A11Y)

- [x] **A11Y-10**: Settings inner tabs support Left/Right arrow-key navigation, and focus moves to the panel on tab switch. *(Audit 4.1, WCAG 2.4.3.)* — closed in 35-01 (roving tabindex + Home/End + focus-to-panel).
- [x] **A11Y-11**: Form errors are programmatically associated — error containers use `role="alert"`; failing inputs set `aria-invalid` and `aria-describedby`. *(Audit 4.2, WCAG 3.3.1 / 1.3.1.)*
- [x] **A11Y-12**: Icon-only edit/delete buttons (Settings carriers/marketplaces, Asset rows) have descriptive `aria-label`s. *(Audit 4.3, WCAG 4.1.2.)*
- [x] **A11Y-13**: The FilamentSelector menu has an accessible name and its submenu announces correctly (live region / `aria-activedescendant`). *(Audit 4.4, WCAG 4.1.2.)* — closed in 35-03 (trigger aria-labelledby + brand submenu aria-label).
- [x] **A11Y-14**: Tag-remove chip buttons meet the minimum target size and are discoverable on touch (not 14px / opacity-0 at rest). *(Audit 4.5, WCAG 2.5.5 / 2.5.8.)*
- [x] **A11Y-15**: Remaining AA cleanups — main `tabpanel` `tabIndex={-1}` for post-switch focus; break-even bar `role="progressbar"` with values; `InfoTooltip` Escape-dismiss + concise label; mobile "Back to site" link label; category filter `role="group"` label; SortIndicator / per-unit label patterns. *(Audit 4.6.)*

### Performance — Tier 5 (PERF)

- [x] **PERF-09**: `useQuotes()` is lifted out of per-row components to the `JobsManager` parent (passed as a `quotesForJob` prop), eliminating one live Dexie subscription per visible job row. *(Audit 5.1.)*
- [x] **PERF-10**: `getFilamentName` resolves via a `materialsById` Map instead of `O(N×M)` `Array.find` per render. *(Audit 5.2.)*
- [x] **PERF-11**: The pricing `useEffect` no longer double-renders per keystroke — moved to an event-handler pattern or trimmed deps. *(Audit 5.3.)* — closed in 36-02 (dep array trimmed to [trueCost, lastEdited]; eslint-disable with PERF-11 rationale).

### Code health — stretch (HYG)

- [ ] **HYG-11**: The 3 remaining index-mutation immutability violations are converted to immutable updates. *(Audit Tier 6 "Already solid" note.)*
- [ ] **HYG-12**: Minor consistency cleanups — `updatePackagingMaterial` via `map`; batched `useAssets` init reads (`Promise.all`); `as UserProfile` / `as Currency` casts tightened to validated narrowing. *(Audit 6.5.)*

## Deferred (future milestone)

### UX / onboarding (→ v2.0)

- **UX-onboarding**: Guided first-run setup funnel (add printer → add filament → price). *(Audit 3.1 — headline feature, not hardening.)*
- **UX-empty-states**: Real empty states for FilamentSelector + Printers explaining the calculator dependency. *(Audit 3.3 — low-risk; can be pulled into v1.9 if scope allows.)*
- **UX-calc-flow**: Per-asset source currency in asset forms; inline filament price override in the calc path; CSV post-import summary; collapse optional calculator sections by default. *(Audit 3.4 / 3.5 — feature work.)*

### Code health (→ before/within v2.0)

- **HYG-godcomponents**: Split the four 800+ LOC God-components (`CostCalculator`, `JobsManager`, `AssetLibrary`, `useDatabase`) and `SettingsModal`; move direct `db.*.put` calls into the hook layer. *(Audit 6.1–6.4 — large refactors, too risky to bundle into a hardening release.)*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Tier 2 brand cohesion / kill the `/app` seam | Belongs on the redesign branch (`test/design-skills-experiment`); ships with v2.0 + paid-tier launch |
| Guided first-run onboarding (audit 3.1) | Headline UX feature, not hardening — v2.0 |
| God-component decomposition (audit 6.1–6.4) | Large refactors carry regression risk in a hardening/release pass |
| New calculator capabilities (source currency, price override, section collapse) | Feature work — v2.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 34 — Live papercut fixes | Complete (34-01) |
| FIX-02 | Phase 34 — Live papercut fixes | Complete (34-01) |
| FIX-03 | Phase 34 — Live papercut fixes | Complete (34-02) |
| FIX-04 | Phase 34 — Live papercut fixes | Complete (34-02) |
| A11Y-10 | Phase 35 — Accessibility Tier 4 | Complete (35-01) |
| A11Y-11 | Phase 35 — Accessibility Tier 4 | Complete |
| A11Y-12 | Phase 35 — Accessibility Tier 4 | Complete |
| A11Y-13 | Phase 35 — Accessibility Tier 4 | Complete (35-03) |
| A11Y-14 | Phase 35 — Accessibility Tier 4 | Complete |
| A11Y-15 | Phase 35 — Accessibility Tier 4 | Complete |
| PERF-09 | Phase 36 — Performance Tier 5 | Complete |
| PERF-10 | Phase 36 — Performance Tier 5 | Complete |
| PERF-11 | Phase 36 — Performance Tier 5 | Complete (36-02) |
| HYG-11 | Phase 37 — Code health (STRETCH) | Pending |
| HYG-12 | Phase 37 — Code health (STRETCH) | Pending |

**Coverage:**
- v1.9 requirements: 15 total
- Mapped to phases: 15 / 15 (100%) ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-25*
*Last updated: 2026-06-25 — roadmap created; all 15 requirements mapped to Phases 34–37 (100% coverage)*
