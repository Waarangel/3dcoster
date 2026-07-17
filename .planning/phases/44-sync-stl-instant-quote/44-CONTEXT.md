# Phase 44: Sync & STL Instant Quote - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Two free-floor, no-backend capabilities (SYNC-01, CONN-02):

1. **File-based device sync** — user syncs their full database between devices via a JSON file in a user-owned cloud folder (Dropbox/Drive), with last-write-wins semantics, schema-version checks on import, a pre-commit change summary, and corruption guards (atomic writes, multi-tab safety). No backend, no account.
2. **STL/3MF instant quote** — user uploads an STL or 3MF, the app computes an in-browser mesh-volume estimate (Three.js, lazy-loaded) and pre-fills estimated filament weight + material cost into the calculator, with units detection, an explicit infill input, a non-manifold warning, and a visible "this is an estimate — review before quoting" disclaimer. Never an auto-price.

**Research spike REQUIRED before planning** (locked in ROADMAP): file-based sync conflict detection — BroadcastChannel lock patterns for multi-tab races, atomic JSON write in Tauri — is likely underestimated. Tombstone mechanics (D-06) join that spike's scope.

</domain>

<decisions>
## Implementation Decisions

### Sync workflow & placement (SYNC-01)
- **D-01: Folder once, then automatic.** User picks a sync folder once (their Dropbox/Drive/OneDrive folder); the app auto-writes the sync file after changes and checks for a newer file on launch, prompting to merge. Sync is opt-in — nothing happens until a folder is chosen.
- **D-02: Auto where possible, manual elsewhere.** Desktop (Tauri fs) and Chromium web (File System Access API, persisted directory handle) get the full auto flow. Safari/Firefox get manual export/import with a small note ("automatic sync needs Chrome/Edge or the desktop app"). Everyone gets sync; capability degrades gracefully.
- **D-03: Lives in the extended Backup/Restore section.** The Settings Data tab becomes one home for Backup, Restore & Sync — setup, status ("last synced 2h ago"), and manual actions all there. Reuse `BackupRestoreSection` patterns. No new chrome elsewhere (no header indicator).
- **D-04: Debounced auto-write.** Any data write (job saved, sale recorded, setting changed) schedules a batched sync-file write ~10–30s later, so the folder is always near-current. Multi-tab safety via the BroadcastChannel lock validated in the research spike.

### Merge semantics & summary (SYNC-01)
- **D-05: `updatedAt` on every store as the LWW basis.** Every store gains an `updatedAt` stamped on each write (additive optional field — no Dexie version bump; `backupSchema` DATE_FIELDS follows). Records without one (legacy data) are treated as older than any stamped record.
- **D-06: Deletions propagate via tombstones.** A delete leaves a `{id, deletedAt}` marker that syncs; the other device removes its copy unless it was edited AFTER the deletion (edit wins per LWW). Tombstones pruned after a retention window (planner picks the window; research spike validates mechanics).
- **D-07: Merge summary = per-store counts + expandable detail.** Headline per store ("Jobs: 4 added, 2 updated, 1 deleted") with an expandable list naming affected records; true conflicts (both devices edited the same record since last sync) flagged distinctly. Confirmation before commit is locked by the roadmap success criterion.
- **D-08: Auto-snapshot before every merge.** Before applying a merge, the app silently writes a pre-merge backup (reusing `buildBackupFile`) kept locally, with a "Restore pre-merge state" affordance in the Data tab for a while afterward. One-click undo for a bad merge. The merge itself runs in one Dexie transaction (same all-or-nothing discipline as `restoreBackup`).

### STL upload experience (CONN-02)
- **D-09: One drop zone, routed by file type.** Extend the existing import drop zone: `.gcode` → slicer parse (exact numbers, current behavior), `.stl` → mesh estimate, `.3mf` → slicer metadata when present (current `threeMfParser` path), mesh estimate otherwise. The UI tells the user which path it took ("exact from slicer" vs "estimated from mesh").
- **D-10: Estimate computed against the selected filament, PLA fallback.** Use the density + price of the filament already selected in the form's first filament row; if none is selected, assume PLA (1.24 g/cm³) and say so in the estimate breakdown. Changing the filament re-computes.
- **D-11: Small rotatable 3D preview.** A compact viewport (rotate/zoom) next to the estimate numbers with model dimensions overlaid — the preview makes the units warning concrete (a 2cm cube vs a 2inch cube is visibly different). Three.js is already loaded for the mesh math.
- **D-12: Review card → explicit Apply.** Parsing opens an estimate card: preview, dimensions, infill input, warnings, estimated weight + cost, and the disclaimer — with an explicit "Apply to calculator" button that pre-fills the filament weight. Nothing touches the form until the maker acts. This is the "maker-reviewed estimate, never an auto-price" framing made mechanical.

### Estimate model & guards (CONN-02)
- **D-13: Shells + infill weight model.** Approximate slicer reality: standard wall count + top/bottom thickness (solid material derived from mesh surface area) plus infill% of the remaining interior volume. The breakdown shows both components. Not pure volume × infill (underestimates real prints), not a magic correction factor.
- **D-14: Infill defaults to 15%, remembers last used.** Starts at 15% (PrusaSlicer/Bambu Studio default); once the user changes it, their last value persists via localStorage (same pattern as the Quote Variants discount default — NOT a UserProfile/Dexie field).
- **D-15: Units guard = heuristic + one-click convert.** If the bounding box looks implausible for mm (roughly: under ~5mm or over ~500mm on every axis — planner tunes thresholds), show "This looks like it might be in inches — [Treat as inches]" with one click rescaling ×25.4. A manual mm/inch toggle stays available regardless.
- **D-16: Non-manifold = warn, estimate anyway.** Clear "mesh has errors — volume may be inaccurate" warning on the estimate card (and the flag carries if applied to the form), but numbers are still produced. Blocking would make the feature feel broken; the maker-reviewed framing covers the uncertainty.

### Claude's Discretion
- Sync file naming/format details (single file vs per-device files, envelope shape evolving from `backupSchema`), tombstone retention window, debounce interval within the ~10–30s band
- First-run sync setup flow copy and the Safari/Firefox note wording
- Conflict-summary UI composition (modal vs panel), pre-merge snapshot retention policy
- Wall-count / top-bottom-thickness assumptions in the shells model (pick sensible slicer defaults; surface them in the breakdown if cheap)
- Disclaimer wording/placement on the estimate card and any flag shown on the form after Apply
- Web Worker vs main-thread-with-yields for mesh math (requirement locks "never blocks the main thread" — mechanism is planner's call), file-size limits, parse-failure UX
- NEW-badge registration (both sync and STL estimate are user-facing → `src/features.ts`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — SYNC-01 + CONN-02 exact text (CONN-02 locks: Three.js lazy-load + CI guard, units detection, infill surfaced, non-manifold warning, estimate framing)
- `.planning/ROADMAP.md` §Phase 44 — 4 success criteria, research flag (BroadcastChannel lock + atomic Tauri write), dependency note (sync format must include all v2.0 stores in final shape — Dexie v12 is that shape)

### Sync foundation in code
- `src/utils/backupSchema.ts` — `BACKUP_FORMAT_VERSION`, `BACKUP_STORES`, `DATE_FIELDS`, envelope types — the sync file format evolves from this
- `src/utils/backupExport.ts` — `buildBackupFile` (full-DB read, meta envelope with `appSchemaVersion`), web Blob vs Tauri fs save paths (incl. "forbidden path:" error mapping)
- `src/utils/backupRestore.ts` — validate-everything-then-write-once discipline, whole-file rejection, `__proto__` hostile-key guard, single-transaction write, `STORES_ABSENT_IN_LEGACY_BACKUPS` pattern for additive stores — the merge path must keep ALL of these properties
- `src/components/BackupRestoreSection.tsx` — the Settings Data-tab surface D-03 extends
- `src/db/database.ts` — Dexie v12 stores (incl. `failureEvents`, `maintenanceEvents`), `handleVersionchange` multi-tab reload pattern (relevant to multi-tab sync safety)

### STL/3MF foundation in code
- `src/utils/threeMfParser.ts` — existing 3MF zip handling WITH zip-bomb guards (v1.9 security work) — mesh-path 3MF reading must not bypass these
- `src/components/GcodeImport.tsx` — the existing drop-zone → parse → pre-fill flow D-09 extends; the exact/estimate distinction hangs off this
- `src/utils/gcodeParser.ts` — `findBestFilamentMatch` and the pre-fill contract into the calculator
- `scripts/assert-no-static-pdf-import.mjs` — the CI dynamic-import gate to clone for Three.js (CONN-02 locks "same CI gate as jsPDF")

### Bundle & platform constraints
- `vite.config.ts` — manualChunks + 300 KB gz main-chunk gate; port 4173; `__IS_TAURI__` define
- `src-tauri/` capabilities/fs scope — sync-folder writes on desktop need scope consideration (fs scope was deliberately narrowed in v1.9; don't silently widen)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildBackupFile` / `serializeBackup` / `restoreBackup` — the sync export/import core already exists; sync adds the merge path (vs full-replace), `updatedAt`/tombstone awareness, and the folder plumbing
- `validateBackupFile` — schema-version check + rejection messaging that SYNC-01's "reject incompatible exports with a clear message" criterion needs is already built for restore; reuse/extend rather than re-implement
- `threeMfParser.ts` zip handling + zip-bomb guards — 3MF mesh path builds on it
- `GcodeImport.tsx` drop zone + calculator pre-fill contract — D-09's single entry point
- `useToast`, `ConfirmModal`, `Button`/`Card` UI kit — merge summary modal, sync status, estimate card
- `useLocalStorage` — D-14 infill persistence (Quote Variants discount precedent)
- `src/features.ts` NEW-badge registry — both features are user-facing

### Established Patterns
- Validate-everything-then-write-once + single Dexie transaction (backupRestore) — merge commit must inherit this
- Additive-only schema fields (no version bump for optional fields) — `updatedAt` follows; a tombstone store WOULD be a new Dexie store (version bump to v13, migration discipline applies)
- Lazy-load + CI guard (jsPDF precedent, PDF-04 lesson) — Three.js must follow exactly
- `__IS_TAURI__` compile-time branching — sync folder access is the biggest web/desktop divergence in the phase
- No-nag conventions — sync stays quiet (status text, not toasts on every write)

### Integration Points
- Settings Data tab (`BackupRestoreSection`) — sync setup/status home (D-03)
- Calculator import drop zone — STL/3MF entry (D-09); estimate Apply writes through the existing pre-fill path, not a new one
- Every `useDatabase` write helper — `updatedAt` stamping (D-05) and delete→tombstone (D-06) touch the write layer centrally; prefer a shared wrapper over 30 call-site edits
- Launch sequence in `App.tsx` — newer-sync-file check on open (D-01)

</code_context>

<specifics>
## Specific Ideas

- The 3D preview exists to make the units problem *visible*, not just warned about — the user should be able to see "that's a 2-inch cube, not 2mm" at a glance (D-11 + D-15 work together)
- "Exact from slicer" vs "estimated from mesh" is a trust distinction the UI should state explicitly — G-code numbers and mesh numbers must never look interchangeable (D-09)
- Cost-truth brand: the shells+infill model was chosen specifically because pure volume × infill *underestimates* — an underestimating estimator would betray the product's core promise (D-13)

</specifics>

<deferred>
## Deferred Ideas

- **Live folder watching / real-time sync** — the phase syncs on launch + debounced writes; watching the folder for changes while the app is open is a future enhancement
- **Per-record accept/skip in the merge summary** — full record-level review UI was considered and rejected for this phase (D-07 keeps LWW simple); revisit only if real merge complaints appear
- **Print-time estimate from mesh** — CONN-02 scopes weight + material cost only; estimating print time from geometry is a different (much harder) problem

</deferred>

---

*Phase: 44-sync-stl-instant-quote*
*Context gathered: 2026-07-16*
