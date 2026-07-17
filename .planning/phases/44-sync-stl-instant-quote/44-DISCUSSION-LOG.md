# Phase 44: Sync & STL Instant Quote - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 44-sync-stl-instant-quote
**Areas discussed:** Sync workflow & placement, Merge semantics & summary, STL upload experience, Estimate model & guards

---

## Sync workflow & placement

### Core sync interaction model

| Option | Description | Selected |
|--------|-------------|----------|
| Folder once, then automatic (Recommended) | User picks a sync folder once; app auto-writes after changes and checks for a newer file on launch, prompting to merge | ✓ |
| Manual sync button | Explicit 'Sync now' / 'Import sync file' every time — smarter backup/restore | |
| Hybrid: manual write, auto-check | User exports manually; app auto-detects a newer file at launch | |

### Web fallback (Safari/Firefox can't auto-access a folder)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto where possible, manual elsewhere (Recommended) | Chromium web + desktop get folder-once auto; Safari/Firefox get manual export/import with a note | ✓ |
| Auto-sync is desktop-only | Web always manual; auto positioned as a desktop feature | |
| Manual everywhere this phase | Ship manual sync on all platforms now | |

### Sync UI placement

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Backup/Restore section (Recommended) | Data tab becomes 'Backup, Restore & Sync' — one home for data in/out | ✓ |
| Own Settings section + header status | Dedicated section plus an always-visible sync indicator | |
| Own Settings section only | Dedicated section, no persistent indicator | |

### Write timing

| Option | Description | Selected |
|--------|-------------|----------|
| Debounced after every change (Recommended) | Any data write schedules a batched sync-file write ~10–30s later | ✓ |
| On app open + close only | Write at launch and on close | |
| Manual 'Sync now' writes only | Auto-read on launch, writes always manual | |

---

## Merge semantics & summary

### Last-write-wins timestamp basis

| Option | Description | Selected |
|--------|-------------|----------|
| Add updatedAt everywhere (Recommended) | Every store gains updatedAt on each write; legacy unstamped records treated as older | ✓ |
| File-level timestamp | Whole file's exportedAt decides per differing record | |
| Hybrid: updatedAt on hot stores only | Stamp jobs/sales/quotes/materials; others fall back to file-level | |

### Deletion propagation

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — tombstones (Recommended) | {id, deletedAt} markers sync; edits after deletion win per LWW; pruned after retention window | ✓ |
| No — deletes don't sync this phase | Merges only add/update; deleted records can resurrect | |
| Deletes sync only via full-replace | Fast-forward when one side changed; deletes skipped on true merges | |

### Merge summary detail

| Option | Description | Selected |
|--------|-------------|----------|
| Counts + expandable detail (Recommended) | Per-store headline counts, expandable record list, conflicts flagged distinctly | ✓ |
| Per-store counts only | Just numbers, one Confirm button | |
| Full record-level review | Scrollable per-record diff with per-record accept/skip | |

### Safety net

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-snapshot before merge (Recommended) | Silent pre-merge backup via buildBackupFile + 'Restore pre-merge state' affordance | ✓ |
| Transaction-only | All-or-nothing Dexie transaction, no undo after commit | |
| Prompt to download backup first | Ask user to download a backup before merging | |

---

## STL upload experience

### Entry point

| Option | Description | Selected |
|--------|-------------|----------|
| One drop zone, routed by type (Recommended) | .gcode → exact slicer parse, .stl → mesh estimate, .3mf → metadata when present else mesh; UI states which path | ✓ |
| Separate 'Estimate from model' entry | Distinct upload surface just for mesh estimates | |
| Drop zone + dedicated estimate panel | Shared drop zone but mesh files open a dedicated modal | |

### Material for the estimate

| Option | Description | Selected |
|--------|-------------|----------|
| Selected filament, PLA fallback (Recommended) | Use the form's first selected filament; PLA 1.24 g/cm³ fallback, stated in breakdown; recomputes on change | ✓ |
| Ask after parsing | Material picker before anything pre-fills | |
| Always PLA, user adjusts | Always assume PLA with a visible note | |

### 3D preview

| Option | Description | Selected |
|--------|-------------|----------|
| Small rotatable preview (Recommended) | Compact rotate/zoom viewport with dimensions overlaid — makes the units warning concrete | ✓ |
| Static dimensions readout only | Bounding box + volume + triangle count as text | |
| Numbers only | No geometry feedback | |

### Apply flow

| Option | Description | Selected |
|--------|-------------|----------|
| Review card → Apply (Recommended) | Estimate card with explicit 'Apply to calculator'; nothing touches the form until the maker acts | ✓ |
| Instant pre-fill + estimate banner | Pre-fill immediately with a persistent estimate banner | |
| Review card, auto-apply on close | Card shows but applying is the default on dismiss | |

---

## Estimate model & guards

### Weight model

| Option | Description | Selected |
|--------|-------------|----------|
| Shells + infill model (Recommended) | Wall count + top/bottom solid (from surface area) + infill% of interior; breakdown shows both | ✓ |
| Volume × infill%, transparent | Simplest, but underestimates real prints | |
| Volume × infill + correction factor | Flat empirical multiplier — a magic number | |

### Infill default

| Option | Description | Selected |
|--------|-------------|----------|
| 15%, remember last used (Recommended) | PrusaSlicer/Bambu default; last value persists via localStorage | ✓ |
| Fixed 15% every time | Never remembers | |
| Fixed 20% every time | Cura default, more conservative | |

### Units guard

| Option | Description | Selected |
|--------|-------------|----------|
| Heuristic + one-click convert (Recommended) | Implausible bounding box triggers 'might be inches — [Treat as inches]' ×25.4 rescale; manual toggle always available | ✓ |
| Always-visible unit toggle only | Permanent mm/inch selector, no detection | |
| Warning text only | Warn but no in-app conversion | |

### Non-manifold handling

| Option | Description | Selected |
|--------|-------------|----------|
| Warn, estimate anyway (Recommended) | Clear 'volume may be inaccurate' warning, numbers still produced | ✓ |
| Warn + require acknowledgment | Apply disabled until user ticks an acknowledgment | |
| Block on serious errors | Severely broken meshes refuse to estimate | |

---

## Claude's Discretion

- Sync file naming/format details, tombstone retention window, debounce interval within ~10–30s
- First-run sync setup copy; Safari/Firefox fallback note wording
- Conflict-summary UI composition; pre-merge snapshot retention policy
- Wall-count / top-bottom-thickness assumptions in the shells model
- Disclaimer wording/placement; estimate flag after Apply
- Web Worker vs main-thread-with-yields for mesh math; file-size limits; parse-failure UX
- NEW-badge registration for both features

## Deferred Ideas

- Live folder watching / real-time sync while the app is open
- Per-record accept/skip in the merge summary
- Print-time estimate from mesh geometry
