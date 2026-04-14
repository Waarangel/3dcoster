# 3DCoster — Multi-Material Support

## What This Is

3DCoster is a 3D printing cost calculator that helps hobbyists and small businesses accurately price their prints. It runs as a web app (Vercel) and desktop app (Tauri), storing all data locally in IndexedDB. This milestone adds multi-material support — the ability to track multiple filaments per print job, with accurate per-filament cost calculation and gcode import.

## Core Value

Accurate cost calculation for multi-material prints so users can price jobs correctly and maintain profitability.

## Requirements

### Validated

<!-- Inferred from existing codebase -->

- ✓ Single-filament cost calculation per job — existing
- ✓ G-code import from Bambu Studio, PrusaSlicer, Cura, OrcaSlicer, SuperSlicer, IdeaMaker — existing
- ✓ Auto-match imported filament type to user's asset library — existing
- ✓ Post-processing materials tracking (consumables, finishing) — existing
- ✓ Printer depreciation and nozzle wear calculation — existing
- ✓ Job save/edit/delete with break-even tracking — existing
- ✓ Sales recording with marketplace fee calculation — existing
- ✓ Session storage form persistence — existing

### Active

- [ ] Multiple filaments per job with per-filament weight and cost tracking
- [ ] G-code parser extracts all materials from multi-material prints (not just the first)
- [ ] UI supports add/remove filament rows with "+" button (max 16)
- [ ] Auto-match each imported filament independently
- [ ] Per-filament price override persisted on saved jobs
- [ ] Nozzle wear uses correct per-material density (fixes existing PLA-only bug)
- [ ] Database migration from single filamentId/filamentGrams to filaments[] array
- [ ] JobsManager displays all filaments per job

### Out of Scope

- Per-filament cost detail in CostBreakdown display — total is sufficient for now
- AMS slot management / filament inventory tracking — separate feature
- Backend sync / multi-device — no backend exists

## Context

- Full design spec at `docs/superpowers/specs/2026-04-14-multi-material-support-design.md`
- Codebase map at `.planning/codebase/`
- Code review knowledge graph built (443 nodes, 2360 edges)
- Graph verification confirmed spec's file list is accurate — no missed dependencies
- Key insight: G-code parser already detects multi-material data but discards it (`filamentType.split(';')[0]`)
- Existing `MaterialUsage` type handles post-processing materials — new `FilamentUsage` type needed for filaments
- Dexie migration from v4 to v5 handles data shape change

## Constraints

- **Tech stack**: React 18 + TypeScript + Vite + Tailwind + Dexie.js (no changes to stack)
- **No backend**: All data local — migration is IndexedDB schema upgrade, no server migration
- **Backward compat**: Existing single-filament jobs must work after migration
- **Port**: Dev server runs on port 5173

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Replace filamentId/filamentGrams with filaments[] array | Clean model, avoids two code paths for every filament operation | — Pending |
| Per-filament weight (not ratio-based) | Most accurate, maps to slicer output | — Pending |
| Single row default, "+" to add more | Keeps current UX for single-filament (majority case) | — Pending |
| Auto-match per filament on import | Form is the review step, no intermediate dialog needed | — Pending |
| Missing per-filament weight: total on first, zeros for rest | Preserves total data, zeros signal manual input needed | — Pending |
| Max 16 filament rows | Matches Bambu AMS Hub max capacity | — Pending |
| Export getMaterialDensity for nozzle wear | Fixes pre-existing bug where all materials assumed PLA density | — Pending |

---
*Last updated: 2026-04-14 after initialization*
