# Phase 1: Data Foundation - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning
**Source:** Design spec (docs/superpowers/specs/2026-04-14-multi-material-support-design.md)

<domain>
## Phase Boundary

This phase establishes the data layer for multi-material support. It delivers:
1. A new `FilamentUsage` type in `src/types.ts`
2. An updated `PrintJob` interface replacing `filamentId`/`filamentGrams` with `filaments: FilamentUsage[]`
3. A Dexie database migration (v4→v5) that converts existing jobs to the new shape

No UI changes in this phase — the app will not compile fully until Phase 3 updates consumers, but the types and migration must land first.

</domain>

<decisions>
## Implementation Decisions

### FilamentUsage Type
- `filamentId: string` — references Asset with category 'filament'
- `grams: number` — weight in grams for this filament
- `pricePerGram?: number` — optional user-editable override (NEW: persists on saved jobs for historical accuracy)
- `currency?: Currency` — currency for the price override

### PrintJob Changes
- Remove `filamentId: string` and `filamentGrams: number`
- Add `filaments: FilamentUsage[]`
- When `pricePerGram` is undefined (migrated jobs), form falls back to asset library `costPerUnit`

### Database Migration (v4→v5)
- Same indexes (filaments[] is not indexed)
- Migration logic:
  - If `filamentId` exists and is non-empty: create `filaments: [{ filamentId, grams: filamentGrams || 0 }]`
  - If `filamentId` is undefined/empty: create `filaments: []`
  - Delete `filamentId` and `filamentGrams` from job record
  - `pricePerGram` intentionally omitted from migrated jobs (form falls back to asset library)

### Claude's Discretion
- Whether to temporarily stub consumers (CostCalculator, JobsManager, etc.) to keep compilation working, or accept temporary compilation errors until Phase 3

</decisions>

<specifics>
## Specific Ideas

- The existing `MaterialUsage` type (for post-processing consumables) is separate and unchanged
- `Material` is a type alias for `Asset` — maintain backward compatibility
- The `CostBreakdown.filament` field stays as `number` (single total) — no structural change needed

</specifics>

<deferred>
## Deferred Ideas

- Per-filament cost breakdown display — v2
- AMS slot management — separate feature

</deferred>

---

*Phase: 01-data-foundation*
*Context gathered: 2026-04-14 via design spec extraction*
