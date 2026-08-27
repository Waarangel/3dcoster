---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Cost-Truth & Insight
status: in_progress
last_updated: "2026-07-03T00:00:00.000Z"
last_activity: 2026-07-03
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md. Milestone roadmap: [ROADMAP.md](ROADMAP.md) (Phases 38–45). Source of requirements: .planning/REQUIREMENTS.md (27 v1 requirements, 100% mapped).

**Core value:** Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.
**Current focus:** Phase 38 — Foundation (not started; roadmap created 2026-07-03)

## Current Position

Phase: 38 — Foundation
Plan: 38-01 complete; 38-02..38-05 drafted (pending review)
Status: Research spike DONE (38-RESEARCH.md — reducer design for the pricing interlink settled, PERF-11 post-mortem, equivalence-test strategy, tab-in-URL design). Plan 38-01 (output-equivalence harness) EXECUTED: 12 mount-based golden scenarios pass against the pre-split component (commit bc6c90c), incl. the consecutive same-field-edit case that caused the v1.9 revert. Plans 38-02..38-05 pre-drafted from the research; review them via `/gsd:plan-phase 38` before executing.
Last activity: 2026-08-27 — Phase 38 research + harness + plan drafts (on branch claude/status-check-k98qja, needs merge to main)

## v2.0 Phase Order Reference

| Phase | Theme | Requirements | Key constraint |
|-------|-------|--------------|----------------|
| 38 | Foundation — CostCalculator split + tab-in-URL | FOUND-01, FOUND-02, FOUND-03 | Highest-risk code change in milestone; gates all new cost inputs and new tabs. Research spike REQUIRED before planning. |
| 39 | Cost Realism — failure engine, TOU electricity, maintenance amortization | FAIL-01..04, TOU-01..02, WEAR-01..02 | Depends on Phase 38 section components. New Dexie stores (failureEvents, maintenanceEvents). Must not silently reprice history. |
| 40 | Insight Layer — hourly wage, printer ROI, what-if simulator | INS-01, INS-02, INS-03 | Depends on Phase 38 tab-in-URL (Insights tab slot). Pure derivation only — no Dexie writes for insight values. |
| 41 | Quick-Win Features — reprice alerts, spool lifecycle, tax threshold, Quote Variants | CONN-01, CONN-03, LIFE-01, LIFE-02 | Independent of backend. Can partially overlap with Phase 39 or 40. Tax threshold data MEDIUM confidence — show "data current as of" note. |
| 42 | GDPR & Onboarding — consent banner, privacy policy, ToS, wizard | GDPR-01, GDPR-02, GDPR-03, ONBD-01 | HARD GATE before Phase 43. Must be live in production and network-verified (zero analytics before consent) before backend ships. |
| 43 | Pro Backend — Supabase auth, hosted quote pages, billing | PRO-01, PRO-02, PRO-03, PRO-04 | Depends on Phase 42. Research spike REQUIRED. Backend = Supabase eu-central-1 (locked). PRO-03 requires security review gate. |
| 44 | Sync & STL Instant Quote — file-based sync, STL volume estimate | SYNC-01, CONN-02 | Depends on Phase 43 (sync format must include final v2.0 Dexie schema). Research spike REQUIRED for sync conflict handling. Three.js must be lazy-loaded (300 KB gz gate). |
| 45 | Brand & Launch — Cost-Truth Dark redesign merge | BRAND-01 | Depends on Phase 43 (Pro pricing must exist before redesign fills pricing spots). Frontend work from existing branch `test/design-skills-experiment`. |

> **Phase-numbering:** v1.9 used Phases 34–37. Phase 33 reserved on `feat/insight-pricing-coach` branch. v2.0 starts at Phase 38.

## Performance Metrics

**Velocity:**

- Total plans completed (lifetime): 70
- Average duration: —
- Total execution time: —

*Updated after each plan completion.*

**v1.9 Hardening (reference):** 4 phases (34–37), 11 plans, 14/15 requirements, ~7 days incl. 1-week review/UAT hold.
**v1.3 Hardening (reference — the model for structured milestones):** 10 phases (18–26), 43 plans, 56 tasks, 53 requirements, 4 days, audit verdict `passed`.

## Accumulated Context

### Roadmap Evolution

- v1.0 Phases 1–6 shipped (Multi-Material Support, 2026-04-15)
- v1.1 Phases 7–11 shipped (Polish & Foundation, 2026-05-20)
- v1.2 Phases 12–17 shipped (Quote-to-Customer, 2026-05-25) — inserted 15.1, closure 17
- v1.3 Phases 18–26 shipped (Hardening, 2026-05-28) — inserted 22.1, closure 26
- v1.4–v1.7 shipped ad-hoc OUTSIDE GSD (2026-05-29 → 2026-06-19)
- v1.8 Phases 27–32 shipped (Inventory & Sales Reporting, 2026-06-25) — GSD revived; desktop tag `v1.8.0`. Phase 33 on in-flight branch.
- v1.9 Phases 34–37 shipped (Hardening, 2026-07-03) — desktop tag `v1.9.0`. 14/15 requirements (PERF-11 deferred to v2.0).
- **v2.0 Phases 38–45 roadmapped 2026-07-03** — 8 phases, 27 requirements, 100% coverage. Wave structure: Foundation → Cost Realism + Insight + Quick Wins → GDPR (hard gate) → Pro Backend → Sync + STL → Brand.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- [v2.0 Roadmap 2026-07-03]: Continue-numbering at Phase 38. v1.9 used 34–37; Phase 33 reserved on `feat/insight-pricing-coach`; start at 38 to avoid collision.
- [v2.0 Roadmap 2026-07-03]: 8-phase structure derived from research consensus (all 4 research files converge on the same wave ordering independently). Coarse granularity applied: 8 phases for 27 requirements reflects natural delivery boundaries, not padding.
- [v2.0 Roadmap 2026-07-03]: Phase 38 (Foundation) is the highest-risk code change in the milestone. Research spike flagged as REQUIRED — must resolve useCostDerivedValues dep-array design and useReducer vs refined useEffect patterns before any code is touched. Output-equivalence tests (old vs new component, same numbers for N inputs) are the primary correctness gate.
- [v2.0 Roadmap 2026-07-03]: Phase 42 (GDPR) is a hard gate before Phase 43 (Pro Backend). The consent banner must be live in production and network-verified before any backend call ships user data off-device.
- [v2.0 Roadmap 2026-07-03]: Phase 43 (Pro Backend) research spike flagged REQUIRED — Supabase auth implementation (magic-link, httpOnly cookie, Tauri secure keyring) needs a concrete plan. Backend = Supabase eu-central-1 (locked per REQUIREMENTS.md). PRO-03 requires a formal security review gate (non-enumerable URLs, RLS, no PII in CDN caches).
- [v2.0 Roadmap 2026-07-03]: Phase 44 (Sync + STL) research spike flagged REQUIRED — file-based sync conflict detection (BroadcastChannel lock, atomic JSON write in Tauri) is likely underestimated per research SUMMARY.md. Sequenced after Phase 43 so the sync export format includes all v2.0 Dexie stores in their final shape.
- [v2.0 Roadmap 2026-07-03]: CONN-02 (STL instant quote) paired with SYNC-01 in Phase 44 — both are high-complexity free-floor features not on the critical path, both benefit from a later sequencing once the schema is stable.
- [v2.0 Roadmap 2026-07-03]: CONN-03 (Quote Variants PDF) placed in Phase 41 (Quick Wins), not Phase 39 or 43 — it rides the existing jsPDF engine, requires no new Dexie stores, and is independent of both the backend and the cost realism features.
- [v2.0 Roadmap 2026-07-03]: Phases 39, 40, and 41 all depend on Phase 38 but are otherwise independent of each other and can begin planning in parallel once Phase 38 is complete.
- [v2.0 Roadmap 2026-07-03]: Free-floor guarantee: every cost-model improvement (failure rate, TOU, maintenance amortization) ships to the free tier. No insight or cost feature requires an account.

### Pending Todos

- Phase 38 requires a research spike BEFORE plan creation — useCostDerivedValues dep-array design is the highest-risk decision in the milestone. Run `/gsd:plan-phase 38` with research enabled.
- PERF-11 is now addressed in Phase 38 (FOUND-02) as part of the CostCalculator split — the correct fix belongs with useCostDerivedValues, not a dep-trim patch.
- Backend choice is locked (Supabase eu-central-1) but Supabase auth implementation details need a concrete plan at Phase 43 planning time.
- ~~Pro tier pricing~~ RESOLVED 2026-08-27: founder set launch price at **€7.90/mo** (undercuts 3DPrintQuote €9.90 anchor). Logged in PROJECT.md Key Decisions. Apply to the three placeholder spots at Phase 43 (billing) / Phase 45 (marketing site).
- Tax threshold data for LIFE-02 is MEDIUM confidence — the UI must show "data current as of [date]" and "consult a qualified accountant" disclaimer.

### Blockers/Concerns

None currently — roadmap created, all requirements mapped, all gates documented.

## Session Continuity

Last session: 2026-08-27 (remote session, branch `claude/status-check-k98qja`)
Stopped at: Phase 38 research spike + equivalence harness (executed, 12/12 green, full suite 831 green) + draft plans 38-02..38-05. Pro price set (€7.90/mo). `feat/linux-desktop-build` assessed: already fully merged into main at v1.7.0 (merge f9c0298) — safe to delete remotely (see notes/linux-desktop-build-branch.md).
Resume file: None

## Operator Next Steps

- Merge branch `claude/status-check-k98qja` into main (docs + harness, no app-code changes)
- Delete the stale remote branch: `git push origin --delete feat/linux-desktop-build` (verified fully merged)
- Review draft plans via `/gsd:plan-phase 38` (research spike already done — 38-RESEARCH.md), then execute 38-02..38-05
- Phases 39, 40, 41 can be planned in parallel after Phase 38 completes
- Phase 42 (GDPR) must complete and be verified live in production before Phase 43 begins
- Phase 43 needs research spike at plan time (Supabase auth implementation, billing provider)
- Phase 44 needs research spike at plan time (sync conflict detection, atomic write)

## Deferred Items

Carried forward from v1.9 (acknowledged at v1.9 close 2026-07-03):

| Category | Item | v2.0 disposition |
|----------|------|-----------------|
| backlog | PERF-11 pricing dep-trim | Addressed in Phase 38 (FOUND-02) |
| backlog | Tab-in-URL browser navigation | Addressed in Phase 38 (FOUND-03) |
| backlog | etsy_offsite_ad in RecordSaleModal | Deferred to v3.0+ (MISC-01, not in v2.0 scope) |
| backlog | Guided first-run onboarding | Addressed in Phase 42 (ONBD-01) |
| backlog | CostCalculator God-component split | Addressed in Phase 38 (FOUND-01) |
| backlog | Cost-Truth Dark redesign merge | Addressed in Phase 45 (BRAND-01) |
| v1.3-carryover | Customer CSV export | Still pending — no v2.0 requirement |
| v1.3-carryover | VoiceOver UAT (Phase 19) | Still pending — no v2.0 requirement |
| v1.3-carryover | TAGS-F4 tag colors, DUP-F1 duplicate UI | Still pending — no v2.0 requirement |
