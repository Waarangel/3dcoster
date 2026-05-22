# 3DCoster

## What This Is

3DCoster is a 3D printing cost calculator that helps hobbyists and small businesses accurately price their prints. It runs as a web app (Vercel) and desktop app (Tauri), storing all data locally in IndexedDB. The core application is free forever — paid tiers (when launched) cover white-label branding, hosted infrastructure, live marketplace/accounting integrations, and automation/AI.

## Core Value

Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.

## Current Milestone: v1.2 Quote-to-Customer

**Goal:** Turn 3DCoster from a personal cost calculator into a tool that produces professional, customer-ready quotes — with proper tax handling, customer details, an organized job library, and a real PDF deliverable.

**Target features:**
- Tax / VAT on jobs — three-layer model: region/country lookup default → Settings override → per-job override (activates the existing `it.todo` in `costCalc.test.ts`)
- Customer details on jobs — optional name / email / address persisted per saved job
- Editable tags + filter/search on `JobsManager` — user-defined string tags, chip filter, free-text search across title/customer/tags
- Printable PDF quote — client-side PDF library (jspdf / pdf-lib / react-pdf — chosen during plan-phase research), **lazy-loaded** to stay under Phase 11's 300 KB gz main-chunk gate; free tier renders "Made with 3DCoster" footer (white-label deferred to paid tier)
- Quick duplicate — one-click duplicate of a saved job in `JobsManager`
- Etsy ToS compliance helper — inline checklist / guidance for sellers, surfaced on the job edit screen and the PDF
- UI consistency sweep — Input `compact` rollout, `<InfoTooltip>` replacing descriptive placeholders, `features.ts` dead-badge cleanup (resolves [todos/ui-consistency-sweep.md](todos/ui-consistency-sweep.md))

All items sit on the FREE side of the free/paid line per [docs/ROADMAP.md](../docs/ROADMAP.md) "Guiding Principle" (2026-05-19).

**Why this slot:** v1.1 delivered the polish foundation (primitives, empty states, skeletons, cost-calc tests, perf budget). v1.2 is the first feature milestone built on that foundation — every Quote-to-Customer surface (PDF, tag chips, tax row, customer fields) uses the shared `ui/` primitives from the start and slots into the 300 KB gz / virtualized lists Phase 11 established. The Stimalo line — "free for the person; paid when the tool wears your brand or works while you sleep" — defines the cut: PDF quote is free with footer, white-label is paid (v2.0+).

## Next Milestone (planned, not yet defined): v1.3 TBD

Not yet defined. Will be scoped after v1.2 ships, informed by what surfaces in customer-facing usage.

## Requirements

### Validated (shipped)

**Core (pre-GSD):**
- ✓ Single-filament cost calculation per job
- ✓ Printer depreciation and nozzle wear calculation
- ✓ Job save/edit/delete with break-even tracking
- ✓ Sales recording with marketplace fee calculation
- ✓ Session storage form persistence
- ✓ Post-processing materials tracking (consumables, finishing)
- ✓ Asset library with CSV import/export
- ✓ Multi-currency (18 currencies) + regional unit auto-switching
- ✓ PWA / offline support + Tauri desktop builds

**v1.0 Multi-Material Support (shipped 2026-04-15):**
- ✓ Multiple filaments per job with per-filament weight and cost tracking
- ✓ G-code import (Bambu Studio, PrusaSlicer, Cura, OrcaSlicer, SuperSlicer, IdeaMaker)
- ✓ Auto-match each imported filament independently
- ✓ Per-filament price override persisted on saved jobs
- ✓ Nozzle wear uses correct per-material density (fixed pre-existing PLA-only bug)
- ✓ Dexie migration to `filaments[]` array (single-filament jobs preserved)
- ✓ JobsManager displays all filaments per job
- ✓ 3MF Multi-Plate Project Import (Bambu `tray_info_idx` mapping)

**Outside-milestone single features:**
- ✓ Default profit margin setting (2026-05-18) — user-configurable in Settings → Pricing
- ✓ Printer maintenance alerts (500h intervals)

**v1.1 Polish & Foundation (shipped 2026-05-20):**
- ✓ Shared `src/components/ui/` primitives used across 14 main components; grep-based lint guard + pre-commit hook (Phase 7)
- ✓ Empty-state components with CTAs on Asset library / Jobs / Printer Settings (Phase 8)
- ✓ Skeleton loading components shown during initial IndexedDB load (Phase 9)
- ✓ Vitest unit-test coverage for cost-calculation logic — material, electricity, depreciation, nozzle wear, labor, failure rate (Phase 10)
- ✓ vite `manualChunks` splits vendor (react-vendor / dexie-vendor / vendor) + JobsManager and AssetLibrary virtualization via react-window v2; 300 KB gz build gate enforced (Phase 11)

### Active (v1.2)

Requirements are gathered during the new-milestone workflow and tracked in [REQUIREMENTS.md](REQUIREMENTS.md). Validated requirements move here after phase completion.

### Out of Scope (for v1.2)

- White-label PDF quote (paid tier, v2.0+) — only the free-tier "Made with 3DCoster" footer variant ships in v1.2
- Live marketplace / accounting integrations (Etsy API, QuickBooks, etc.) — paid tier
- Hosted sync / multi-device sync — paid tier
- E2E tests (Playwright / Cypress) — separate later milestone
- Light/dark/system theme toggle — app ships dark-only by design (decision locked in v1.1)
- Tag autocomplete from prior jobs (deferred — v1.2 ships editable string tags + chip filter + free-text search only)

## Context

- v1.0 (Multi-Material Support) shipped 2026-04-15 across 6 phases
- Default Profit Margin shipped 2026-05-18 (single-feature, outside milestone)
- v1.1 (Polish & Foundation) shipped 2026-05-20 across Phases 7–11
- Roadmap: [docs/ROADMAP.md](../docs/ROADMAP.md)
- Free/paid principle: "Free for the person; paid when the tool wears your brand to your customers, or works while you sleep"
- Codebase map: `.planning/codebase/`
- 2026-05-19 audit confirmed G-code import and Multi-material shipped; 5 items partially shipped (re-scoped); 23 items genuinely outstanding in roadmap
- v1.2 phase numbering continues from v1.1 — next phase is **Phase 12**

## Constraints

- **Tech stack**: React 18 + TypeScript + Vite + Tailwind + Dexie.js (no changes to stack)
- **No backend**: All data local — schema changes via Dexie migrations
- **Backward compat**: All v1.0 jobs/sales must continue to work after v1.1 schema changes
- **Free forever promise**: Core calculator + every cost-model improvement stays free
- **Port**: Dev server runs on port 4173 (pinned in `vite.config.ts`)
- **NEW Badge rule**: Every new feature gets a NEW badge — register in `src/features.ts`, place as absolute overlay (never inline that disrupts layout)

## Key Decisions

| Decision | Rationale | Milestone | Outcome |
|----------|-----------|-----------|---------|
| Replace `filamentId`/`filamentGrams` with `filaments[]` array | Clean model, avoids two code paths | v1.0 | ✓ Shipped |
| Per-filament weight (not ratio-based) | Most accurate, maps to slicer output | v1.0 | ✓ Shipped |
| Single row default, "+" to add more | Keeps single-filament UX (majority case) | v1.0 | ✓ Shipped |
| Auto-match per filament on import | Form is the review step | v1.0 | ✓ Shipped |
| Max 16 filament rows | Matches Bambu AMS Hub max capacity | v1.0 | ✓ Shipped |
| Export `getMaterialDensity` for nozzle wear | Fixes pre-existing PLA-only bug | v1.0 | ✓ Shipped |
| Default profit margin in `UserProfile` | Same shape as `laborHourlyRate` (personal pricing default) | 2026-05-18 | ✓ Shipped |
| Free/paid line = branding + hosted + integrations + automation | Stimalo / Obsidian / Cal.com / Tailscale convergence | 2026-05-19 | Adopted |
| Free-tier-first milestone arc (v1.1–v1.6 free, then v2.0 paid) | Maximize free value before paying backend complexity tax | 2026-05-19 | Adopted |
| v1.1 = Polish & Foundation (not Quote-to-Customer) | Foundation-first compounds across 5+ subsequent milestones; foundation-last creates rework debt | v1.1 | ✓ Shipped 2026-05-20 |
| PDF quote: free with footer, white-label paid (white-label deferred to paid tier) | Stimalo line — peak willingness-to-pay moment + organic marketing | v1.2 | Pending |
| Tax/VAT: region lookup default + Settings override + per-job override | Region table covers the 90% case (EU 27 + UK + AU + CA + US no-tax + etc.); Settings handles power users selling outside their region; per-job override handles edge cases. Three layers ship together — no half-feature. | v1.2 | Pending |
| PDF quote rendered via client-side PDF library, lazy-loaded | Real .pdf download (vs print dialog) gives a better seller UX; library lazy-loaded so Phase 11's 300 KB gz main-chunk gate stays intact. Specific lib (jspdf / pdf-lib / react-pdf) decided during plan-phase research. | v1.2 | Pending |
| Tags ship as editable strings + chip filter + free-text search (no autocomplete, no PDF chips) | Minimum viable tag UX — covers organize + recall. Autocomplete and PDF tag rendering deferred until tag usage signals demand. | v1.2 | Pending |
| UI consistency sweep folded into v1.2 (not standalone milestone) | Pending todo `ui-consistency-sweep.md` is small and touches the same forms v1.2 adds fields to — better to apply once than twice. | v1.2 | Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-22 — Phase 15.1 Customer Library complete (inserted phase): Customers tab with virtualized list + CSV bulk import + Record Sale combobox picker; Dexie v6→v7 customers store; per-Sale customer remains a by-value snapshot. v1.2 milestone: Phases 12–15.1 complete (5 of 6 phases); Phase 16 (Printable PDF Quote) is the final v1.2 phase.*
