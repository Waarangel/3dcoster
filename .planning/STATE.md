---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Quote-to-Customer
status: executing
stopped_at: Phase 12 context gathered
last_updated: "2026-05-21T12:59:07.439Z"
last_activity: 2026-05-21
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-20)

**Core value:** Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.
**Current focus:** Phase 12 — schema-foundation

## Current Position

Phase: 12 (schema-foundation) — EXECUTING
Plan: 3 of 4
Status: Ready to execute
Last activity: 2026-05-21

## Performance Metrics

**Velocity:**

- Total plans completed: 11
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 7 | 3 | - | - |
| 09 | 2 | - | - |
| 11 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

**v1.0 Reference Velocity (for calibration):**
| Phase 01-data-foundation P01 | 8min | 2 tasks | 2 files |
| Phase 02-gcode-parser P01 | 5min | 2 tasks | 2 files |
| Phase 03-calculator-ui-import P01 | 4min | 1 tasks | 1 files |
| Phase 03-calculator-ui-import P02 | 25min | 2 tasks | 2 files |
| Phase 03-calculator-ui-import P03 | 30min | 3 tasks | 1 files |
| Phase 04-jobs-display P01 | 8min | 2 tasks | 1 files |
| Phase 05-printer-maintenance-alerts P01 | 12min | 2 tasks | 4 files |
| Phase 06-3mf-multi-plate-project-import P01 | 10min | 2 tasks | 4 files |
| Phase 06-3mf-multi-plate-project-import P02 | 8min | 2 tasks | 2 files |

## Accumulated Context

### Roadmap Evolution

- v1.0 Phases 1–6 shipped (Multi-Material Support milestone, completed 2026-04-15)
- Phase 5 added mid-milestone: Printer Maintenance Alerts
- Phase 6 added mid-milestone: 3MF Multi-Plate Project Import
- v1.1 Phases 7–11 redefined 2026-05-19 as Polish & Foundation (Quote-to-Customer deferred to v1.2)
- v1.1 shipped 2026-05-20 — all 5 phases complete
- v1.2 Phases 12–16 defined 2026-05-20 (Quote-to-Customer)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.0 Phase 01]: Clean removal of filamentId/filamentGrams — no deprecated optional stubs (locked decision)
- [v1.0 Phase 01]: Dexie v5 migration returns modify() promise to ensure complete record conversion
- [v1.0 Phase 02]: Export getMaterialDensity from gcodeParser.ts — fixes pre-existing PLA-only density bug for nozzle wear and enables Phase 3 reuse
- [v1.0 Phase 03 P02]: FilamentRow is internal form state (not exported); distinct from DB FilamentUsage type
- [v1.0 Phase 03 P02]: makeDefaultRow is a function not a constant — captures userCurrency at call time
- [v1.0 Phase 03 P03]: FILAMENT_DENSITY constant removed — getMaterialDensity called per row for correct per-material nozzle wear
- [v1.0 Phase 03 P03]: handleSaveJob writes filaments: FilamentUsage[] — old filamentId/filamentGrams fields fully removed
- [v1.0 Phase 04]: Empty filaments array renders "No filament data" in italic muted text
- [v1.0 Phase 05]: Capture hoursBefore before awaits in handleSaveJob; compute hoursAfter from argument (React state pre-update pattern)
- [v1.0 Phase 05]: MAINTENANCE_INTERVAL=500 exported as named constant from maintenanceDismissed.ts
- [v1.0 Phase 06]: metresToGrams uses metres*100 for cm length — correct physics gives ~29.82g for 10m PLA 1.75mm
- [v1.0 Phase 06 P02]: processThreeMfFile is separate useCallback from processFile for clean 3MF vs gcode separation
- [v1.1 Roadmap 2026-05-19]: Free/paid line — all v1.1 work is free-tier, local-only; no Supabase, no API calls
- [v1.1 Roadmap 2026-05-19]: Styling primitives pass (Phase 7) is foundational — Phases 8, 9, 10 depend on its completion so new surfaces use consistent primitives
- [v1.1 Roadmap 2026-05-19]: Phase 10 (Dark Mode) removed; app ships dark-only by design (Slate-based theme already in place, zero `dark:` Tailwind classes used). UI-06/UI-07 moved to Out of Scope. Phases 11/12 renumbered to 10/11.
- [v1.1 Roadmap 2026-05-19]: NEW badge rule applies — empty-state CTAs are user-visible (badge required); primitives pass is invisible internal work (no badge)
- [v1.1 Roadmap 2026-05-19]: Vitest infra exists (one test: threeMfParser.test.ts); Phase 10 adds cost-calc tests (renumbered from 11 after Dark Mode removal); tax/VAT test included as pending/skipped, activates in v1.2
- [v1.2 Roadmap 2026-05-20]: 5-phase coarse structure (12–16); UI sweep folded into Phases 13+14 where forms overlap; ETSY helper folded into Phase 14 (co-located CostCalculator section); DUP folded into Phase 15 (co-located JobsManager work)
- [v1.2 Roadmap 2026-05-20]: Phase 16 (PDF) hard-gates on Phases 13+14 both merged — PDF must render correct tax row and customer block from day one
- [v1.2 Roadmap 2026-05-20]: `build.modulePreload: false` is mandatory in vite.config.ts before Phase 16 ships; CI assertion script required
- [v1.2 Roadmap 2026-05-20]: Tax applies to sellingPrice not subtotal — the existing it.todo in costCalc.test.ts is the activation point and must be first in Phase 13

### Pending Todos

- Phase 16 plan-phase must empirically measure jsPDF gz chunk size (`npm install jspdf jspdf-autotable && npm run build && ls -lh dist/assets/pdf-*.js`) before locking the library — three research sources disagree on exact size
- Phase 16 plan-phase must test font fetch strategy in `npm run tauri:dev` (Tauri WKWebView may reject fetch('/fonts/...') — fallback is base64 embed in lazy chunk)
- Phase 12 plan-phase must decide quote number storage location (`job.quoteNumber` vs `UserProfile.nextQuoteNumber` counter) before writing the v6 migration

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-21T01:17:05.874Z
Stopped at: Phase 12 context gathered
Resume file: .planning/phases/12-schema-foundation/12-CONTEXT.md
