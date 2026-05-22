---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Quote-to-Customer
status: completed
stopped_at: "Phase 14 closed — ready for Phase 15.1 planning (Customer Library, user-decided insert via /gsd:phase add) before resuming the original Phase 15/16 sequence"
last_updated: "2026-05-22T13:00:26.763Z"
last_activity: 2026-05-22 -- Phase 14 closed; user approved D-21..D-24 mid-UAT scope reversal
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 14
  completed_plans: 14
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-20)

**Core value:** Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.
**Current focus:** Phase 15.1 planning queued (Customer Library — user-decided insert via /gsd:phase add) before resuming the original Phase 15/16 sequence

## Current Position

Phase: 14 (customer-details-etsy-helper) — COMPLETE
Plan: 4 of 4 (all complete)
Status: Complete — Phase 14 closed 2026-05-22 with user-approved D-21..D-24 mid-UAT scope reversal (customer-on-sale, conditional Etsy, Recent Sales accordion)
Last activity: 2026-05-22 -- Phase 14 closed; user approved D-21..D-24 mid-UAT scope reversal

## Performance Metrics

**Velocity:**

- Total plans completed: 21
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 7 | 3 | - | - |
| 09 | 2 | - | - |
| 11 | 6 | - | - |
| 12 | 4 | - | - |
| 13 | 6 | - | - |
| 14 | 4 | - | - |

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
| Phase 13 P06 | 3min | 2 tasks | 3 files |

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
- [Phase ?]: [v1.2 Phase 13-06]: UI-10 audit complete — featureReleases registry pruned from 12 to 4 entries; default-tax-rate (2026-05-21) added to resolve Plan 03's orphan JSX; Pitfall 6 sequencing (JSX-first, cross-repo gate, then registry) successfully enforced
- [v1.2 Phase 14 closure 2026-05-22]: All 4 requirements (CUST-01, CUST-02, ETSY-01, ETSY-02) verified PASS against the LOCKED revised contract D-21..D-24 (14-CONTEXT.md). Mid-UAT scope reversal: customer details moved from PrintJob to Sale (D-21); Etsy section now conditional on `marketplace === 'etsy'` (D-22); Recent Sales list became a `<details>`-based accordion with per-sale customer block (D-23); features.ts entries kept their original 2026-05-21 ship dates but JSX consumers moved (D-24 — customer-details now in JobsManager Record Sale modal, etsy-helper still in CostCalculator but conditionally rendered). Pre-existing bug fix-up: shipping/packaging/marketplace now persist on PrintJob so Edit re-hydrates true cost (commit `7b14260`). New affordances: Edit + Delete buttons on sale rows (commits `c56870f`, `5ec4aa7`). Dexie schema unchanged (v6); main bundle 49.8 KB gzipped; 110/110 tests passing.
- [v1.2 Phase 16 dependency update — 2026-05-22]: Phase 16 PDF customer block MUST now pull from `Sale.customer` (with `sale.customerName` legacy-read fallback), NOT from `PrintJob.customer`. Phase 16 plan-phase MUST read 14-VERIFICATION.md as part of its `<read_first>` to pick up this revised contract. ETSY-02 PDF-exclusion contract is unchanged (Phase 16 must still exclude `PrintJob.etsyChecks`).

### Pending Todos

- **User-decided insert: Phase 15.1 Customer Library** — to be added via `/gsd:phase add` between Phases 15 and 16. Scope: Customer as first-class asset with bulk import + dropdown picker in the Record Sale modal. Will deduplicate customers across sales (picks up the deferred CUST-F1 item from REQUIREMENTS.md). Replaces the current freeform-per-sale model with a library-backed picker (still allowing freeform entry for one-off buyers). Phase 16 PDF customer-block contract should be designed source-agnostic so it works against both the inline `Sale.customer` shape (current) and the library-backed customer (post-15.1).
- Phase 16 plan-phase must empirically measure jsPDF gz chunk size (`npm install jspdf jspdf-autotable && npm run build && ls -lh dist/assets/pdf-*.js`) before locking the library — three research sources disagree on exact size
- Phase 16 plan-phase must test font fetch strategy in `npm run tauri:dev` (Tauri WKWebView may reject fetch('/fonts/...') — fallback is base64 embed in lazy chunk)
- Phase 16 plan-phase must update its ROADMAP success criterion #1 wording: PDF customer block reads from `Sale.customer` (with `sale.customerName` legacy fallback) per D-21, NOT from `PrintJob.customer`

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-22T12:51:30Z
Stopped at: Phase 14 closed — ready for Phase 15.1 planning (Customer Library, user-decided insert via /gsd:phase add) before resuming the original Phase 15/16 sequence
Resume file: .planning/phases/14-customer-details-etsy-helper/14-VERIFICATION.md
