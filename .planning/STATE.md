---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Hardening
status: completed
stopped_at: Completed 37-02-PLAN.md — HYG-12.2 + HYG-12.3; Phase 37 + v1.9 milestone complete. 760 tests green + tsc -b clean.
last_updated: "2026-06-26T13:48:21.389Z"
last_activity: 2026-06-26 -- Phase 37 marked complete
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 11
  completed_plans: 11
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md. Milestone roadmap: [ROADMAP.md](ROADMAP.md) (Phases 34–37). Source of requirements: `docs/CALCULATOR_APP_AUDIT.md` (Tiers 3–6).

**Core value:** Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.
**Current focus:** Phase 37 — code-health-stretch

## Current Position

Phase: 37 — COMPLETE
Plan: 2 of 2 (COMPLETE)
Status: Phase 37 complete
Last activity: 2026-06-26 -- Phase 37 marked complete

## v1.9 Phase Order Reference

| Phase | Theme | Requirements | Severity note | Notes |
|-------|-------|--------------|---------------|-------|
| 34 | Live papercut fixes | FIX-01..FIX-04 | live user papercuts | Web-mostly; partly built (FIX-01 on `fix/pwa-reload-uncontrolled`; FIX-02 = cherry-pick `4da205f`). Fast first phase. |
| 35 | Accessibility Tier 4 | A11Y-10..A11Y-15 | A11Y-10 + A11Y-11 are WCAG **Critical** | Settings + Asset surfaces; depends on 34. |
| 36 | Performance Tier 5 | PERF-09..PERF-11 | bites at scale | JobsManager + Calculator hotspots; depends on 34. |
| 37 | Code health | HYG-11..HYG-12 | **STRETCH / optional** | Droppable if timeboxed without affecting milestone success. |

> **Phase-numbering:** continue-numbering from v1.8 (Phases 27–32). Phase 33 is on an in-flight branch (not present here). v1.9 starts at **Phase 34** to avoid collision.

## Performance Metrics

**Velocity:**

- Total plans completed (lifetime): 70
- Average duration: —
- Total execution time: —

*Updated after each plan completion. v1.9 plan counts populated during `/gsd:plan-phase`.*

**v1.3 Hardening (reference — the model this milestone follows):** 10 phases (18–26), 43 plans, 56 tasks, 53 requirements, 4 days, audit verdict `passed`.

## Accumulated Context

### Roadmap Evolution

- v1.0 Phases 1–6 shipped (Multi-Material Support, 2026-04-15)
- v1.1 Phases 7–11 shipped (Polish & Foundation, 2026-05-20)
- v1.2 Phases 12–17 shipped (Quote-to-Customer, 2026-05-25) — inserted 15.1, closure 17
- v1.3 Phases 18–26 shipped (Hardening, 2026-05-28) — inserted 22.1, closure 26
- v1.4–v1.7 shipped ad-hoc OUTSIDE GSD (2026-05-29 → 2026-06-19) — management lapsed; tracked via CHANGELOG
- v1.8 Phases 27–32 shipped (Inventory & Sales Reporting, 2026-06-25) — GSD revived; desktop tag `v1.8.0`. Phase 33 on an in-flight branch.
- **v1.9 Phases 34–37 created 2026-06-25 (Hardening, sequel to v1.3)** — coarse, 4 phases mirroring requirement categories: 34 Live papercut fixes (FIX), 35 Accessibility Tier 4 (A11Y, 2 WCAG Critical), 36 Performance Tier 5 (PERF), 37 Code health STRETCH (HYG). Started at Phase 34 (continue-numbering; 33 reserved on a branch). 15 requirements, 100% coverage. Phase 37 marked STRETCH/optional — cut first if timeboxed.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- [v1.9 Roadmap 2026-06-25]: Continue-numbering at Phase 34 (NOT reset, NOT inferred from local `phases/` dir which only holds 01–26). v1.8 used 27–32; Phase 33 is on an in-flight branch not present here. Start at 34 to avoid collision.
- [v1.9 Roadmap 2026-06-25]: 4-phase coarse structure mirroring requirement categories. Phase 34 first because it is web-mostly + partly pre-built (fast win, low coupling to the audit-driven phases). Phases 35/36 sequenced after 34 since they brush the same Settings/Asset/JobsManager surfaces.
- [v1.9 Roadmap 2026-06-25]: Phase 37 (HYG-11/12) marked STRETCH/optional in its goal — droppable without affecting milestone success if the milestone runs long.
- [v1.9 Roadmap 2026-06-25]: Tier 2 brand cohesion (redesign branch), Tier 3.1 guided onboarding (v2.0 headline), and Tier 6.1–6.4 God-component splits (refactor risk) explicitly OUT of v1.9.
- [35-01 2026-06-26]: Settings tabs use roving tabindex (not aria-activedescendant) — native `<button>` tabs make tabIndex toggling the idiomatic APG fit; automatic activation (arrow selects + moves focus) since the panel renders synchronously. A11Y-12 needed no source change for the Settings marketplace section (already used labelled EditButton/DeleteButton) — closed with a confirming test; the Asset-row portion of A11Y-12 remains for plan 35-02, so A11Y-12 stays Pending in REQUIREMENTS traceability until then.
- [35-03 2026-06-26]: FilamentSelector trigger uses aria-labelledby (not htmlFor) to preserve the existing Button ref pattern. Brand submenu uses static aria-label={brand} (not aria-labelledby) per RESEARCH Pitfall 5 — trigger text is dynamic so labelledby on the menu would produce dynamic name changes while open. No live region or aria-activedescendant needed — existing .focus() calls on arrow-key nav already announce items.
- [35-04 2026-06-26]: A11Y-14 chip hit target uses min-w/min-h 24px (not AAA 44px) per LOCKED context decision — glyph stays text-[10px], bounding box enlarged without visual change at rest. A11Y-15 break-even bar aria-valuetext template: "{N} of {M} copies sold[ — break-even reached]".
- [35-05 2026-06-26]: InfoTooltip button label changed from verbose {text} prop to canonical "More information"; Escape handler calls e.stopPropagation() to prevent parent modal from intercepting. App.tsx full-render impractical in jsdom (Dexie DB hooks); used minimal replica subtrees in App.a11y.test.tsx per plan guidance.
- [36-01 2026-06-26]: jobId kept in OrdersQuoteRows type signature (renamed _jobId) for API stability after PERF-09 removed internal quotesByJobId.get(jobId) usage. Source-contract test filters comment/JSDoc lines before counting useQuotes() calls (naive regex matches documentation references too).
- [36-02 2026-06-26]: Pricing useEffect dep array trimmed to [trueCost, lastEdited] (Option A, dep trimming). Test for "removed deps not on dep-array line" uses line-by-line scanning, not a broad regex — the PERF-11 rationale comment itself mentions the removed dep names on a single line, causing a false-match in the naive approach.

### Pending Todos

- FIX-01 is built on `fix/pwa-reload-uncontrolled` — Phase 34 plan should reconcile/merge that branch's work rather than rebuild.
- FIX-02 is a cherry-pick of `4da205f` from the redesign branch (`test/design-skills-experiment`) — verify it picks cleanly and leaves `#hash` anchors alone.
- A11Y-10 + A11Y-11 are WCAG **Critical** — prioritize within Phase 35. (A11Y-10 ✅ closed in 35-01; A11Y-11 remains, scheduled in 35-02.)
- v1.9 is hardening-only: no `src/features.ts` entries / NEW badges (per project memory: badges only for user-perceivable new features; papercut fixes and a11y/perf are not new features).

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-06-26T09:25:00Z
Stopped at: Completed 37-02-PLAN.md — HYG-12.2 + HYG-12.3; Phase 37 + v1.9 milestone complete. 760 tests green + tsc -b clean.
Resume file: None

## Operator Next Steps

- v1.9 Hardening milestone COMPLETE. All 4 phases (34–37), 11 plans done. Next: run `/gsd:verify-work` for v1.9 milestone closure, then prepare the v1.9 release (CHANGELOG entry, version bump, desktop tag).
