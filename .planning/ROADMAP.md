# Roadmap: 3DCoster

**Project:** 3D printing cost calculator (Web + Tauri desktop) — local-first, free tier.
**Status:** v1.9 Hardening **in planning** (Phases 34–37). v1.8 shipped 2026-06-25; v1.4–v1.7 shipped outside GSD.

---

## Milestones

- ✅ **v1.0 Multi-Material Support** — Phases 1–6 (shipped 2026-04-15) — pre-GSD-archive
- ✅ **v1.1 Polish & Foundation** — Phases 7–11 (shipped 2026-05-20) — pre-GSD-archive
- ✅ **v1.2 Quote-to-Customer** — Phases 12–17 (shipped 2026-05-25) — [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Hardening** — Phases 18–26 (shipped 2026-05-28) — [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- ⚠️ **v1.4 – v1.7 — shipped OUTSIDE GSD** (ad-hoc, 2026-05-29 → 2026-06-19). GSD management lapsed after v1.3; these were tracked via CHANGELOG + ad-hoc planning, not GSD phases. Highlights: v1.5 CSV export + roadmap page; v1.6 backup/restore + 3dcoster.com + CSP; v1.7 **Linux desktop builds** + 12 printers + calculator correctness fixes.
- ✅ **v1.8 Inventory & Sales Reporting** — Phases 27–32 (shipped 2026-06-25, desktop tag `v1.8.0`). **GSD revived here.** Material inventory tracking (#20) + PDF sales report (#33) + filament-picker search + off-by-100× rate warnings.
- 🔨 **v1.9 Hardening** — Phases 34–37 (IN PLANNING). Sequel to v1.3 Hardening — no new user-facing features; every requirement closes a live papercut or a `docs/CALCULATOR_APP_AUDIT.md` Tier 3–6 finding. Clears the runway for v2.0.

> **Phase-numbering note:** v1.9 starts at **Phase 34** (continue-numbering). v1.8 used Phases 27–32; an in-flight branch holds **Phase 33** (not present on this branch). Starting at 34 avoids collision.

---

## Phases

### 🔨 v1.9 Hardening (Phases 34–37) — IN PLANNING

- [x] **Phase 34: Live papercut fixes** — PWA Reload reliability, ScrollToTop nav, styled "Reset all" confirm, edit-job scroll-to-banner
- [x] **Phase 35: Accessibility Tier 4** — Settings arrow-key tabs, form-error ARIA association, icon-button labels, FilamentSelector name, tag-chip target size, AA cleanups
- [ ] **Phase 36: Performance Tier 5** — lift per-row `useQuotes()`, `materialsById` Map, pricing `useEffect` double-render fix
- [ ] **Phase 37: Code health (STRETCH)** — index-mutation immutability fixes + minor consistency cleanups (droppable if timeboxed)

<details>
<summary>✅ v1.3 Hardening (Phases 18–26) — SHIPPED 2026-05-28</summary>

- [x] Phase 18: Tauri fs:scope fix (1/1 plans) — completed 2026-05-25
- [x] Phase 19: Modal primitive + a11y migration (6/6 plans) — completed 2026-05-26
- [x] Phase 20: Dexie atomicity audit (4/4 plans) — completed 2026-05-26
- [x] Phase 21: CSV + URL security (3/3 plans) — completed 2026-05-27
- [x] Phase 22: JobsManager decomposition + perf (6/6 plans) — completed 2026-05-27
- [x] Phase 22.1: Break-even formula reconciliation (INSERTED) (4/4 plans) — completed 2026-05-27
- [x] Phase 23: Test coverage hardening (4/4 plans) — completed 2026-05-28
- [x] Phase 24: Nyquist contracts + Phase 13 visual UAT + Phase 18 review carryover (6/6 plans) — completed 2026-05-25
- [x] Phase 25: Doc + hygiene + polish + bundle health (5/5 plans) — completed 2026-05-26
- [x] Phase 26: v1.3 cleanup (INSERTED — closes audit tech_debt before tag) (4/4 plans) — completed 2026-05-28

**Outcome:** 43 plans, 56 tasks, 53 requirements satisfied. Audit verdict: passed. See [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) for phase-by-phase delivery + [milestones/v1.3-MILESTONE-AUDIT.md](milestones/v1.3-MILESTONE-AUDIT.md) for the closure audit.

</details>

<details>
<summary>✅ v1.8 Inventory & Sales Reporting (Phases 27–32) — SHIPPED 2026-06-25</summary>

Material inventory tracking (#20: stockEvents ledger, deduct-on-job, low-stock badges) + PDF sales report (#33: dedicated Reports tab, month/quarter/year/YTD/custom, branded PDF + CSV) + filament-picker search + Bambu PLA Pure + off-by-100× rate warnings + fuel-price per-gallon fix. Desktop tag `v1.8.0`; full 3-reviewer release-diff review (0 CRITICAL). Phase 33 lives on an in-flight branch (not on this branch).

</details>

<details>
<summary>✅ v1.2 Quote-to-Customer (Phases 12–17) — SHIPPED 2026-05-25</summary>

See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) — 7 phases (includes inserted Phase 15.1 Customer Library + closure Phase 17 PDF-04 fix), 45 plans, 30 requirements (28 satisfied, 2 withdrawn).

</details>

<details>
<summary>✅ v1.1 Polish & Foundation (Phases 7–11) — SHIPPED 2026-05-20</summary>

Pre-GSD-archive. Phase artifacts under `.planning/phases/07-styling-primitives-pass` through `.planning/phases/11-performance-optimization`.

</details>

<details>
<summary>✅ v1.0 Multi-Material Support (Phases 1–6) — SHIPPED 2026-04-15</summary>

Pre-GSD-archive. Phase artifacts under `.planning/phases/01-data-foundation` through `.planning/phases/06-3mf-multi-plate-project-import`.

</details>

---

## Phase Details

### Phase 34: Live papercut fixes
**Goal**: Four live user-facing papercuts are gone — updates reload reliably, navigation lands at the top of the page, the most destructive action is properly guarded, and confirming an edit-job jump puts the user where they need to be.
**Depends on**: Nothing (first v1.9 phase; mostly already built — FIX-01 done on `fix/pwa-reload-uncontrolled`, FIX-02 is cherry-pick `4da205f`)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04
**Success Criteria** (what must be TRUE):
  1. The "A new version is available · Reload" button reloads onto the new version even on a hard-refreshed / uncontrolled page (no controlling service worker), not just on a warm-controlled page.
  2. Navigating between routes via footer/nav links lands the user at the top of the destination page; in-page `#hash` anchors still jump to their target (left untouched).
  3. The Asset "Reset all" action opens the app's styled confirm modal showing the item counts about to be deleted, instead of a native `window.confirm()`.
  4. Confirming an edit-job jump scrolls the calculator to the "Editing…" banner so the user can see which job they are editing.
**Plans**: 2 plans
- [x] 34-01-PLAN.md — Web-shell fixes: PWA Reload regression (FIX-01, verify) + ScrollToTop on route nav (FIX-02, cherry-pick)
- [x] 34-02-PLAN.md — Calculator fixes: styled Reset-all confirm modal with counts (FIX-03) + scroll-to-Editing-banner on edit-job jump (FIX-04)
**UI hint**: yes

### Phase 35: Accessibility Tier 4
**Goal**: Close the real Tier 4 accessibility gaps so keyboard and assistive-technology users can operate Settings, perceive form errors, and identify every interactive control — meeting the targeted WCAG success criteria. (A11Y-10 and A11Y-11 are WCAG **Critical**.)
**Depends on**: Phase 34 (sequential; shares Settings + Asset surfaces — land papercuts first to avoid churn)
**Requirements**: A11Y-10, A11Y-11, A11Y-12, A11Y-13, A11Y-14, A11Y-15
**Success Criteria** (what must be TRUE):
  1. **(WCAG Critical — A11Y-10)** Settings inner tabs are navigable with Left/Right arrow keys, and focus moves to the active panel on tab switch (WCAG 2.4.3).
  2. **(WCAG Critical — A11Y-11)** Form-error containers announce as `role="alert"`, and failing inputs expose `aria-invalid` + `aria-describedby` pointing at their error text (WCAG 3.3.1 / 1.3.1).
  3. Every icon-only edit/delete button (Settings carriers/marketplaces, Asset rows) has a descriptive `aria-label` (WCAG 4.1.2).
  4. The FilamentSelector menu has an accessible name and its submenu announces selection correctly via a live region / `aria-activedescendant` (WCAG 4.1.2); tag-remove chip buttons meet the minimum target size and are discoverable on touch (no longer 14px / opacity-0 at rest) (WCAG 2.5.5 / 2.5.8).
  5. The remaining AA cleanups land: main `tabpanel` `tabIndex={-1}` for post-switch focus; break-even bar exposes `role="progressbar"` with values; `InfoTooltip` is Escape-dismissable with a concise label; mobile "Back to site" link is labelled; category filter is a labelled `role="group"`.
**Plans**: 5 plans
- [x] 35-01-PLAN.md — SettingsModal: roving-tabindex arrow-key tab nav + panel focus (A11Y-10, WCAG Critical) + marketplace icon-button labels (A11Y-12)
- [x] 35-02-PLAN.md — AssetLibrary: form-error ARIA association (A11Y-11, WCAG Critical) + asset-row icon labels (A11Y-12) + category role=group + SortIndicator aria-hidden (A11Y-15)
- [x] 35-03-PLAN.md — FilamentSelector: trigger label association + brand-submenu aria-label (A11Y-13)
- [x] 35-04-PLAN.md — JobsManager: 24×24 tag-chip hit target + focus ring (A11Y-14) + break-even role=progressbar (A11Y-15)
- [x] 35-05-PLAN.md — App.tsx + InfoTooltip: main tabpanel tabIndex + back-to-site link label + InfoTooltip concise label/Escape (A11Y-15)
**UI hint**: yes

### Phase 36: Performance Tier 5
**Goal**: Remove the three render/subscription hotspots that bite at scale so the Jobs and Calculator surfaces stay responsive with large datasets, with no behavioral change.
**Depends on**: Phase 34 (sequential; PERF-09 touches JobsManager rows that the papercut work also brushes)
**Requirements**: PERF-09, PERF-10, PERF-11
**Success Criteria** (what must be TRUE):
  1. There is no per-row Dexie subscription duplication for quotes — `useQuotes()` is lifted to the `JobsManager` parent and `quotesForJob` is passed down as a prop, so a 80-job list holds one quotes subscription, not one per visible row.
  2. `getFilamentName` resolves filament names via a `materialsById` Map built once, not an `O(N×M)` `Array.find` per filament per render.
  3. The pricing `useEffect` no longer triggers a double render per keystroke — it is moved to an event-handler pattern (or its dep array is trimmed so the values it sets are not in its deps).
**Plans**: TBD
**UI hint**: yes

### Phase 37: Code health (STRETCH)
**Goal**: **(STRETCH / optional — droppable without affecting milestone success if timeboxed.)** Eliminate the remaining immutability violations and minor consistency rough edges flagged by the audit, leaving the codebase clean for the v2.0 refactor work. Cut this phase first if v1.9 runs long.
**Depends on**: Phase 36 (last; lowest priority, no downstream dependents)
**Requirements**: HYG-11, HYG-12
**Success Criteria** (what must be TRUE):
  1. The 3 remaining index-mutation immutability violations are converted to immutable updates (new objects/arrays, no in-place index assignment).
  2. Minor consistency cleanups land: `updatePackagingMaterial` rewritten via `map`; `useAssets` init reads batched with `Promise.all`; `as UserProfile` / `as Currency` casts replaced with validated narrowing (matching the v9 migration pattern).
**Plans**: TBD

---

## Progress

| Phase                                   | Milestone | Plans | Status      | Completed |
| --------------------------------------- | --------- | ----- | ----------- | --------- |
| 34. Live papercut fixes                 | v1.9      | 2/2 | Complete   | 2026-06-25 |
| 35. Accessibility Tier 4                | v1.9      | 5/5 | Complete   | 2026-06-26 |
| 36. Performance Tier 5                  | v1.9      | 0/?   | Not started | -         |
| 37. Code health (STRETCH)               | v1.9      | 0/?   | Not started | -         |

<details>
<summary>✅ v1.3 Hardening progress (Phases 18–26) — all complete</summary>

| Phase                                                | Milestone | Plans  | Status   | Completed   |
| ---------------------------------------------------- | --------- | ------ | -------- | ----------- |
| 18. Tauri fs:scope fix                               | v1.3      | 1/1    | Complete | 2026-05-25  |
| 19. Modal primitive + a11y migration                 | v1.3      | 6/6    | Complete | 2026-05-26  |
| 20. Dexie atomicity audit                            | v1.3      | 4/4    | Complete | 2026-05-26  |
| 21. CSV + URL security                               | v1.3      | 3/3    | Complete | 2026-05-27  |
| 22. JobsManager decomposition + perf                 | v1.3      | 6/6    | Complete | 2026-05-27  |
| 22.1 Break-even formula reconciliation (INSERTED)    | v1.3      | 4/4    | Complete | 2026-05-27  |
| 23. Test coverage hardening                          | v1.3      | 4/4    | Complete | 2026-05-28  |
| 24. Nyquist contracts + Phase 13 UAT + 18 carryover  | v1.3      | 6/6    | Complete | 2026-05-25  |
| 25. Doc + hygiene + polish + bundle health           | v1.3      | 5/5    | Complete | 2026-05-26  |
| 26. v1.3 cleanup (INSERTED)                          | v1.3      | 4/4    | Complete | 2026-05-28  |

</details>

---

## Backlog (carried forward)

Deferred to v2.0 (per v1.9 REQUIREMENTS.md):

- **UX-onboarding** — Guided first-run setup funnel (add printer → add filament → price). Audit 3.1 — headline UX feature, v2.0.
- **UX-empty-states** — Real empty states for FilamentSelector + Printers. Audit 3.3 — low-risk; could be pulled into v1.9 if scope allows.
- **UX-calc-flow** — Per-asset source currency, inline filament price override, CSV post-import summary, collapse optional calculator sections. Audit 3.4 / 3.5 — feature work, v2.0.
- **HYG-godcomponents** — Split the four 800+ LOC God-components (`CostCalculator`, `JobsManager`, `AssetLibrary`, `useDatabase`) + `SettingsModal`; move `db.*.put` into the hook layer. Audit 6.1–6.4 — large refactors, too risky for a hardening release.
- **Tier 2 brand cohesion** — Belongs on redesign branch `test/design-skills-experiment`; ships with v2.0 + paid-tier launch.

From v1.3 / v1.2 accepted deferrals (still pending):

- **Customer CSV export** — `sanitizeCsvCell` ready when the feature lands.
- **VoiceOver UAT (Phase 19)** — structural a11y complete; screen-reader phrasing confirmation deferred.
- **TAGS-F4** — tag colors. **DUP-F1** — quick-duplicate UI in a richer surface.
