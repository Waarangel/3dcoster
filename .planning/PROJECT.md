# 3DCoster

## What This Is

3DCoster is a 3D printing cost calculator that helps hobbyists and small businesses accurately price their prints. It runs as a web app (Vercel) and desktop app (Tauri), storing all data locally in IndexedDB. The core application is free forever — paid tiers (when launched) cover white-label branding, hosted infrastructure, live marketplace/accounting integrations, and automation/AI.

## Core Value

Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.

## Current Milestone: v1.1 Polish & Foundation

**Goal:** Establish a consistent component foundation so every subsequent free-tier milestone is built on the same primitives — no rework when v1.2+ features ship.

**Target features:**
- [x] Styling primitives pass — raw `<button>`/`<input>`/`<select>`/`<textarea>` replaced across 14 main components with shared `src/components/ui/` primitives; grep-based lint guard + pre-commit hook active (Phase 7, shipped 2026-05-19)
- Empty states with CTAs for every blank screen (assets, jobs, printers)
- Skeleton loading states (replaces "Loading…" text)
- Dark mode — first-class light/dark/system theme toggle
- Unit tests for cost-calculation logic (vitest infra already exists)
- Performance optimization — vite `manualChunks` for vendor split + list virtualization for jobs/assets

All items sit on the FREE side of the free/paid line per [docs/ROADMAP.md](../docs/ROADMAP.md) "Guiding Principle" (2026-05-19).

**Why this slot:** The 2026-05-19 audit flagged the styling-primitives pass as the highest-leverage outstanding item (the `ui/` primitives already exist but main components don't use them). Shipping 5+ more free-tier feature milestones on raw HTML primitives means redoing every styling decision later. Foundation-first compounds; foundation-last creates rework debt.

## Next Milestone (planned, not yet defined): v1.2 Quote-to-Customer

Tax/VAT, Quick duplicate, Customer details on jobs, Editable tags + filter/search, Printable PDF quote (free tier with "Made with 3DCoster" footer), Etsy ToS compliance helper. All items deferred from v1.1; will be defined as v1.2 once v1.1 ships.

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

### Active (v1.1)

- [ ] All `<button>`/`<input>`/`<select>` in CostCalculator, JobsManager, PrinterSettings use shared `src/components/ui/` primitives
- [ ] Every empty screen (assets, jobs, printers) shows an empty-state component (illustration + headline + CTA)
- [ ] Skeleton loading components shown during initial IndexedDB load (replaces plain "Loading..." text)
- [ ] First-class theme toggle (light / dark / system) in Settings, with all surfaces rendering both themes correctly
- [ ] Unit-test coverage for cost-calculation logic in CostCalculator (material, electricity, depreciation, nozzle wear, labor, failure rate)
- [ ] vite `manualChunks` splits vendor from app code; jobs and asset lists use virtualization for >100 items

### Out of Scope (for v1.1)

- All v1.2 features (Quote-to-Customer suite — Tax/VAT, customer details, tags, PDF quote, Etsy ToS helper, Quick duplicate)
- E2E tests (Playwright/Cypress setup) — separate later milestone
- Full design-system overhaul (typography scale, animation tokens) — primitives pass is the minimum viable foundation
- Customizable theme colors — light/dark/system only in v1.1

## Context

- v1.0 (Multi-Material Support) shipped 2026-04-15 across 6 phases
- Default Profit Margin shipped 2026-05-18 (single-feature, outside milestone)
- Roadmap: [docs/ROADMAP.md](../docs/ROADMAP.md)
- Free/paid principle: "Free for the person; paid when the tool wears your brand to your customers, or works while you sleep"
- Codebase map: `.planning/codebase/`
- 2026-05-19 audit confirmed G-code import and Multi-material shipped; 5 items partially shipped (re-scoped); 23 items genuinely outstanding in roadmap

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
| v1.1 = Polish & Foundation (not Quote-to-Customer) | Foundation-first compounds across 5+ subsequent milestones; foundation-last creates rework debt | v1.1 | Pending |
| PDF quote: free with footer, white-label paid (deferred to v1.2) | Stimalo line — peak willingness-to-pay moment + organic marketing | v1.2 | Deferred |

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
*Last updated: 2026-05-19 — Phase 7 (Styling Primitives Pass) shipped: 14 main components refactored onto shared UI primitives, lint guard active*
