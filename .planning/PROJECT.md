# 3DCoster

## What This Is

3DCoster is a 3D printing cost calculator that helps hobbyists and small businesses accurately price their prints. It runs as a web app (Vercel) and desktop app (Tauri), storing all data locally in IndexedDB. The core application is free forever — paid tiers (when launched) cover white-label branding, hosted infrastructure, live marketplace/accounting integrations, and automation/AI.

## Core Value

Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.

## Current Milestone: v1.1 Quote-to-Customer

**Goal:** Turn the cost calculator into a complete quoting tool — every saved job becomes something you can confidently send to a customer.

**Target features:**
- Tax/VAT on selling price (per-job + default in Settings)
- Quick duplicate of any saved job
- Customer details (name/email/phone) on saved jobs
- Editable tags on saved jobs (max 6) with filter + search
- Printable PDF quote with "Made with 3DCoster" footer (free tier)
- Etsy ToS compliance helper (origin/license flag + attestation export)

All items sit on the FREE side of the free/paid line per [docs/ROADMAP.md](../docs/ROADMAP.md) "Guiding Principle" (2026-05-19).

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

- [ ] Tax/VAT percentage on selling price (per-job override + default in Settings)
- [ ] Quick duplicate of any saved job
- [ ] Customer details (name/email/phone) on PrintJob
- [ ] Editable tags (max 6) on PrintJob with filter + search in JobsManager
- [ ] Printable PDF quote with cost breakdown + customer details + footer
- [ ] Etsy ToS origin/license flag on PrintJob + compliance attestation export

### Out of Scope (for v1.1)

- White-label PDF branding (paid Pro tier)
- Email delivery of quotes (hosted, paid tier)
- Shareable hosted quote links (hosted, paid tier)
- Customer database with cross-job history / CRM (full CRM is paid tier)
- Live Etsy / Shopify API integration for compliance status (paid tier)
- AMS slot management / filament inventory tracking (separate feature)

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
| v1.1 = Quote-to-Customer (6 items) | Most user-visible theme; all FREE-side | v1.1 | Pending |
| PDF quote: free with footer, white-label paid | Stimalo line — peak willingness-to-pay moment + organic marketing | v1.1 | Pending |

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
*Last updated: 2026-05-19 — Milestone v1.1 (Quote-to-Customer) initiated*
