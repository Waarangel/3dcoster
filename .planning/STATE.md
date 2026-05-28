---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: v1.3 Hardening
status: executing
stopped_at: Phase 22.1 context gathered
last_updated: "2026-05-28T12:18:32.309Z"
last_activity: 2026-05-28 -- Phase 22.1 planning complete
progress:
  total_phases: 9
  completed_phases: 7
  total_plans: 35
  completed_plans: 31
  percent: 78
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25)

**Core value:** Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.
**Current focus:** Phase 22.1 — Break-even formula reconciliation

## Current Position

Phase: 24
Plan: Not started
Status: Ready to execute
Next: Pick any independent phase: 19 (Modal primitive), 20 (Dexie atomicity), 21 (CSV + URL security). Phase 19 must complete before Phase 22; Phase 22 before Phase 23.
Last activity: 2026-05-28 -- Phase 22.1 planning complete

## v1.3 Phase Order Reference

| Phase | Theme | Severity | Effort | Dependencies |
|-------|-------|----------|--------|--------------|
| 18 | Tauri fs:scope fix | CRITICAL | XS (~30 min) | none |
| 19 | `<Modal>` primitive + a11y migration | 2 CRITICAL + most A11Y | M (~1 day) | none |
| 20 | Dexie atomicity audit | 1 HIGH + 2 MED + 3 LOW | S (~0.5-1 day) | none |
| 21 | CSV + URL security | 2 HIGH + 1 MED | S (~0.5 day) | none |
| 22 | JobsManager decomposition + perf | HYG + PERF batch | L (~1-2 days) | Phase 19 |
| 23 | Test coverage hardening | 3 HIGH (missing tests) | M (~1 day) | Phase 22 (soft) |
| 24 | Nyquist contracts + Phase 13 visual UAT | 5 NYQ items | M (~1 day, mostly doc) | none, parallel-safe |
| 25 | Doc + hygiene + polish + bundle health | final batch | S (~1 day) | Phases 19, 20, 21, 22, 23 |

## Performance Metrics

**Velocity:**

- Total plans completed: 57
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
| 15.1 | 5 | - | - |
| 18 | 1 | - | - |
| 24 | 6 | - | - |
| 25 | 5 | - | - |
| 19 | 6 | - | - |
| 20 | 4 | - | - |
| 21 | 3 | - | - |
| 22 | 6 | - | - |

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
| Phase 15 P15-03 | 4min | 2 tasks | 3 files |
| Phase 15 P04 | 5 | 1 tasks | 1 files |
| Phase 15 P05 | 7 | 2 tasks | 3 files |
| Phase 15-tags-search-quick-duplicate P10 | 25 | 1 tasks | 1 files |

## Accumulated Context

### Roadmap Evolution

- v1.0 Phases 1–6 shipped (Multi-Material Support milestone, completed 2026-04-15)
- Phase 5 added mid-milestone: Printer Maintenance Alerts
- Phase 6 added mid-milestone: 3MF Multi-Plate Project Import
- v1.1 Phases 7–11 redefined 2026-05-19 as Polish & Foundation (Quote-to-Customer deferred to v1.2)
- v1.1 shipped 2026-05-20 — all 5 phases complete
- v1.2 Phases 12–16 defined 2026-05-20 (Quote-to-Customer)
- Phase 17 added 2026-05-25 mid-milestone — closure phase for PDF-04 (Rollup circular chunk defeats jsPDF lazy-loading) + tax rounding divergence (PrintQuoteModal vs CostCalculator). Surfaced by /gsd:audit-milestone v1.2.
- Phase 24 edited: added Phase 18 code review carryover (WR-01/02/03) to Phase 24 scope
- Phase 22.1 inserted after Phase 22: Break-even formula reconciliation — Calculator's formula wins; persist depreciation+nozzleWear on PrintJob; one-time reconcile helper for legacy IndexedDB jobs; folds in WR-01/WR-02 from Phase 22 code review. Surfaced during Phase 22 UAT. (URGENT)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.3 Phase 18 plan 01 — 2026-05-25]: Option C (per-permission inline scope on fs:allow-write-file, $HOME/**/*) chosen; UAT-D Result A confirmed audit bug was real and reproducible; @tauri-apps/api pinned to 2.10.1 to align with Rust crate 2.10.2; DESK-01 closed

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
- [Phase 15]: [v1.2 Phase 15-03]: parseTagsInput shares the D-02 transform with normalizeTagsOnJob via _normalizeTagToken private helper — whitelist regex appears in executable code exactly once (backfill.ts:55); TAGS_MAX=10 constant centralizes the D-02 cap. Empty input returns undefined NOT [] per D-02 line 43 lock.
- [Phase 15]: [v1.2 Phase 15-03]: Tags NewBadge uses label-inline (NOT absolute-overlay) per D-13 + project memory rule — mirrors Model URL pattern exactly; absolute-overlay reserved for square icon buttons in Plans 15-04 and 15-05.
- [Phase ?]: [v1.2 Phase 15-04]: D-05 cache-key tri-key shipped — useDynamicRowHeight invalidates on selectedJobId|chip-filter|debounced-search; react-window resets row heights and scrolls to top on any filter change (TAGS-04 contract)
- [Phase ?]: [v1.2 Phase 15-04]: searchedJobs reuses existing salesByJob Map (all sales) instead of building a parallel index from per-selected-job sales — caught a latent D-06 bug where the plan's literal pattern would have missed customer matches on non-selected jobs
- [Phase ?]: [v1.2 Phase 15-04]: Filter sub-header sits OUTSIDE react-window List (page-level sticky), per PATTERNS.md No-Analog rule — react-window v2 List has no native header slot above virtualized rows
- [Phase ?]: [v1.2 Phase 15-05]: JobCard tag chips D-11 shipped — byte-identical to AssetLibrary chip styling; non-interactive <span> in mt-1 flex-wrap wrapper between filament/print-time meta and price block
- [Phase ?]: [v1.2 Phase 15-05]: [⋯] Quick Duplicate (D-07 + DUP-01) shipped — overflowOpenJobId parent state enforces one-menu-open-at-a-time; click-outside on window closes; handleDuplicate composes nextCopyName + duplicateJob + db.jobs.add; 2s ring-2 ring-blue-400 highlight on new row substitutes for toast (No-Analog rule)
- [Phase ?]: [v1.2 Phase 15-05]: D-12 tag normalize reconcile wired into useJobs init via tagsNormalizeRan module flag — mirrors copiesSoldReconcileRan exactly; shallow-copy jobs + tags array before mutation so liveQuery cache is never touched; error path swallows + resets flag for retry
- [Phase ?]: [v1.2 Phase 15-05]: D-13 NewBadge wiring complete — 3 features.ts entries (tags/search-jobs/quick-duplicate, all 2026-05-24); 3 JSX consumers in JobsManager (tags label-inline, search-jobs + quick-duplicate absolute-overlay); plus tags label-inline already in CostCalculator from Plan 15-03; absolute-overlay count in JobsManager is exactly 3 (pdf-quote + 2 new), NOT 4
- [v1.2 Phase 15 verification 2026-05-24]: verdict gaps-found — Gap A (CostCalc tag input removed), Gap B (title-click + hover icon tag editor), Gap C (chip filter withdrawn, TAGS-02 superseded by TAGS-03 per user product feedback). Phase 15 remains OPEN; completed_phases stays at 4; next command is `/gsd:plan-phase 15 --gaps`. Automated chain green (tsc 0 errors / 263 vitest pass / build clean / main chunk 62.0 KB gz). DUP-02 D-15 contract PASS; TAGS-03 search PASS; TAGS-01/TAGS-04/DUP-01 outstanding pending gap closure or live UAT.
- [v1.2 Phase 15 verification amendment 2026-05-24]: Gap D added — Quick Duplicate `[⋯]` row-action UI WITHDRAWN per user product feedback (single-item overflow is the wrong pattern; labelless button with floating NEW badge is confusing). DUP-01 marked Withdrawn-from-v1.2 in REQUIREMENTS.md; ROADMAP SC#5 rescoped to helper-only (DUP-02 contract). The `duplicateJob` helper + 7-case Vitest contract stay locked for v1.3+ consumption (job-detail panel or batch-action menu). Gap-closure plan must remove `[⋯]` overflow + Duplicate menu item + post-duplicate scroll/highlight + `quick-duplicate` features.ts entry; MUST NOT touch `src/utils/duplicateJob.ts` or its tests. gaps_open: 3 → 4.

### Pending Todos

- **User-decided insert: Phase 15.1 Customer Library** — to be added via `/gsd:phase add` between Phases 15 and 16. Scope: Customer as first-class asset with bulk import + dropdown picker in the Record Sale modal. Will deduplicate customers across sales (picks up the deferred CUST-F1 item from REQUIREMENTS.md). Replaces the current freeform-per-sale model with a library-backed picker (still allowing freeform entry for one-off buyers). Phase 16 PDF customer-block contract should be designed source-agnostic so it works against both the inline `Sale.customer` shape (current) and the library-backed customer (post-15.1).
- Phase 16 plan-phase must empirically measure jsPDF gz chunk size (`npm install jspdf jspdf-autotable && npm run build && ls -lh dist/assets/pdf-*.js`) before locking the library — three research sources disagree on exact size
- Phase 16 plan-phase must test font fetch strategy in `npm run tauri:dev` (Tauri WKWebView may reject fetch('/fonts/...') — fallback is base64 embed in lazy chunk)
- Phase 16 plan-phase must update its ROADMAP success criterion #1 wording: PDF customer block reads from `Sale.customer` (with `sale.customerName` legacy fallback) per D-21, NOT from `PrintJob.customer`

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-28T00:45:28.486Z
Stopped at: Phase 22.1 context gathered
Resume file: .planning/phases/22.1-break-even-formula-reconciliation/22.1-CONTEXT.md
