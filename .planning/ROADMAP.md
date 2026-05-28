# Roadmap: 3DCoster

**Project:** 3D printing cost calculator (Web + Tauri desktop) — local-first, free tier.
**Status:** v1.3 Hardening shipped 2026-05-28. Awaiting v1.4 milestone definition.

---

## Milestones

- ✅ **v1.0 Multi-Material Support** — Phases 1–6 (shipped 2026-04-15) — pre-GSD-archive
- ✅ **v1.1 Polish & Foundation** — Phases 7–11 (shipped 2026-05-20) — pre-GSD-archive
- ✅ **v1.2 Quote-to-Customer** — Phases 12–17 (shipped 2026-05-25) — [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Hardening** — Phases 18–26 (shipped 2026-05-28) — [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- 📋 **v1.4** — not yet defined. Carry-over backlog candidates listed below.

Active scope is empty. Use `/gsd:new-milestone` to scope v1.4.

---

## Phases

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

### 📋 v1.4 [Name TBD] — not yet defined

Run `/gsd:new-milestone` to scope. Carryover backlog below.

---

## Progress

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

---

## Backlog (carried into v1.4 candidates)

From v1.3 accepted deferrals:

- **Customer CSV export** — Phase 21 SC#5 specified a UAT for an unbuilt feature; user deprioritized 2026-05-28. When built, route through `sanitizeCsvCell` per Phase 21 D-02.
- **VoiceOver UAT (Phase 19)** — Structural a11y complete; screen-reader phrasing confirmation deferred from v1.3.
- **Phase 04 + Phase 09 `human_needed` VERIFICATION.md** — v1.0/v1.1 era carryover; address in v1.4 retro pass if needed.
- **Phase 15/17/20 stale CONTEXT.md `open_questions`** — Planning-time artifacts; phases shipped successfully despite them.

From v1.2 carryover (already deferred into v1.3 backlog, still pending):

- **TAGS-F4** — Tag colors (rich tag rendering)
- **DUP-F1** — Quick-duplicate UI (richer row-action surface, e.g. job-detail panel or batch-action menu)
