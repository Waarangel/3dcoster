# Roadmap: 3DCoster

**Project:** 3D printing cost calculator (Web + Tauri desktop) — local-first, free tier.
**Status:** v1.9 Hardening **SHIPPED 2026-07-03** (tag `v1.9.0`). Next: v2.0 milestone (Cost-Truth engine + hosted/Pro backend + GDPR) — run `/gsd:new-milestone`.

---

## Milestones

- ✅ **v1.0 Multi-Material Support** — Phases 1–6 (shipped 2026-04-15) — pre-GSD-archive
- ✅ **v1.1 Polish & Foundation** — Phases 7–11 (shipped 2026-05-20) — pre-GSD-archive
- ✅ **v1.2 Quote-to-Customer** — Phases 12–17 (shipped 2026-05-25) — [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Hardening** — Phases 18–26 (shipped 2026-05-28) — [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- ⚠️ **v1.4 – v1.7 — shipped OUTSIDE GSD** (ad-hoc, 2026-05-29 → 2026-06-19). GSD management lapsed after v1.3; these were tracked via CHANGELOG + ad-hoc planning, not GSD phases. Highlights: v1.5 CSV export + roadmap page; v1.6 backup/restore + 3dcoster.com + CSP; v1.7 **Linux desktop builds** + 12 printers + calculator correctness fixes.
- ✅ **v1.8 Inventory & Sales Reporting** — Phases 27–32 (shipped 2026-06-25, desktop tag `v1.8.0`). **GSD revived here.** Material inventory tracking (#20) + PDF sales report (#33) + filament-picker search + off-by-100× rate warnings.
- ✅ **v1.9 Hardening** — Phases 34–37 (shipped 2026-07-03, desktop tag `v1.9.0`) — [milestones/v1.9-ROADMAP.md](milestones/v1.9-ROADMAP.md). 14/15 requirements (PERF-11 deferred to v2.0). Data-loss + marketplace-fee/FX + net-margin fixes, A11Y Tier 4, perf, 0 CVEs.
- 📋 **v2.0 Cost-Truth & Insight** — NOT YET SCOPED — run `/gsd:new-milestone`. Greenlit pool: 11 Cost-Truth features (docs/ROADMAP.md, internal), hosted/Pro backend, GDPR cookie-consent + privacy policy, marketing-site redesign branch, CostCalculator split + PERF-11, tab-in-URL, guided onboarding (Tier 3.1).

> **Phase-numbering note:** v1.9 starts at **Phase 34** (continue-numbering). v1.8 used Phases 27–32; an in-flight branch holds **Phase 33** (not present on this branch). Starting at 34 avoids collision.

---

## Phases

<details>
<summary>✅ v1.9 Hardening (Phases 34–37) — SHIPPED 2026-07-03</summary>

- [x] Phase 34: Live papercut fixes (2/2 plans) — completed 2026-06-25
- [x] Phase 35: Accessibility Tier 4 (5/5 plans) — completed 2026-06-26
- [x] Phase 36: Performance Tier 5 (2/2 plans) — completed 2026-06-26
- [x] Phase 37: Code health (STRETCH) (2/2 plans) — completed 2026-06-26

**Outcome:** 11 plans, 14/15 requirements (PERF-11 reverted as a pricing regression → v2.0). Plus release-review/audit/UAT-driven fixes: Asset-Library scoped reset (data-loss), deleted-defaults persistence, marketplace-fee FX + net margin, 19→0 CVEs. See [milestones/v1.9-ROADMAP.md](milestones/v1.9-ROADMAP.md).

</details>

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

*(No active milestone — v1.9 phase details archived to [milestones/v1.9-ROADMAP.md](milestones/v1.9-ROADMAP.md). Next milestone: v2.0 via `/gsd:new-milestone`.)*

---

## Progress

*(No active phases.)*

<details>
<summary>✅ v1.9 Hardening progress (Phases 34–37) — all complete</summary>

| Phase                                   | Milestone | Plans | Status      | Completed |
| --------------------------------------- | --------- | ----- | ----------- | --------- |
| 34. Live papercut fixes                 | v1.9      | 2/2 | Complete   | 2026-06-25 |
| 35. Accessibility Tier 4                | v1.9      | 5/5 | Complete   | 2026-06-26 |
| 36. Performance Tier 5                  | v1.9      | 2/2 | Complete   | 2026-06-26 |
| 37. Code health (STRETCH)               | v1.9      | 2/2   | Complete    | 2026-06-26 |

</details>

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

Deferred to v2.0 (per v1.9 REQUIREMENTS.md + v1.9 close):

- **PERF-11** — pricing `useEffect` double-render fix. Reverted in v1.9 (dep-trim desynced profit/margin on consecutive same-field edits); correct fix pairs with the CostCalculator God-component split (audit 6.1).
- **Tab-in-URL** — browser Back from `/app` exits to the marketing site (in-app tabs are React state). Fix = active tab in the URL (`?tab=`); pairs with the redesign / `/app` seam work. *(UAT finding, 2026-06-26)*
- **etsy_offsite_ad in RecordSaleModal picker** — fee engine supports it; the Record Sale marketplace picker doesn't surface it. *(v1.9 release review, 2026-07-03; also in docs/ROADMAP.md backlog)*
- **UX-onboarding** — Guided first-run setup funnel (add printer → add filament → price). Audit 3.1 — headline UX feature, v2.0.
- **UX-empty-states** — Real empty states for FilamentSelector + Printers. Audit 3.3 — low-risk; could be pulled into v1.9 if scope allows.
- **UX-calc-flow** — Per-asset source currency, inline filament price override, CSV post-import summary, collapse optional calculator sections. Audit 3.4 / 3.5 — feature work, v2.0.
- **HYG-godcomponents** — Split the four 800+ LOC God-components (`CostCalculator`, `JobsManager`, `AssetLibrary`, `useDatabase`) + `SettingsModal`; move `db.*.put` into the hook layer. Audit 6.1–6.4 — large refactors, too risky for a hardening release.
- **Tier 2 brand cohesion** — Belongs on redesign branch `test/design-skills-experiment`; ships with v2.0 + paid-tier launch.

From v1.3 / v1.2 accepted deferrals (still pending):

- **Customer CSV export** — `sanitizeCsvCell` ready when the feature lands.
- **VoiceOver UAT (Phase 19)** — structural a11y complete; screen-reader phrasing confirmation deferred.
- **TAGS-F4** — tag colors. **DUP-F1** — quick-duplicate UI in a richer surface.
