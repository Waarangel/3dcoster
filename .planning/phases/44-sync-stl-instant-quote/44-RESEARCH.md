# Phase 44: Sync & STL Instant Quote - Research

**Researched:** 2026-07-17
**Domain:** Cross-tab/cross-process file coordination (Web Locks/BroadcastChannel), Tauri 2 filesystem scope + atomic writes, File System Access API persisted directories, Dexie tombstone-based sync merge, in-browser STL/3MF mesh volume estimation (Three.js, lazy-loaded)
**Confidence:** MEDIUM — every locked decision (D-01..D-16) has a verified implementation path; the two areas flagged LOW are the Tauri persisted-scope plugin's exact capability wiring (needs a spike-in-plan smoke test) and WebKitGTK/Linux Web Locks coverage (feature-detect + fallback covers it regardless).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sync workflow & placement (SYNC-01)**
- **D-01: Folder once, then automatic.** User picks a sync folder once (their Dropbox/Drive/OneDrive folder); the app auto-writes the sync file after changes and checks for a newer file on launch, prompting to merge. Sync is opt-in — nothing happens until a folder is chosen.
- **D-02: Auto where possible, manual elsewhere.** Desktop (Tauri fs) and Chromium web (File System Access API, persisted directory handle) get the full auto flow. Safari/Firefox get manual export/import with a small note ("automatic sync needs Chrome/Edge or the desktop app"). Everyone gets sync; capability degrades gracefully.
- **D-03: Lives in the extended Backup/Restore section.** The Settings Data tab becomes one home for Backup, Restore & Sync — setup, status ("last synced 2h ago"), and manual actions all there. Reuse `BackupRestoreSection` patterns. No new chrome elsewhere (no header indicator).
- **D-04: Debounced auto-write.** Any data write (job saved, sale recorded, setting changed) schedules a batched sync-file write ~10–30s later, so the folder is always near-current. Multi-tab safety via the BroadcastChannel lock validated in the research spike.

**Merge semantics & summary (SYNC-01)**
- **D-05: `updatedAt` on every store as the LWW basis.** Every store gains an `updatedAt` stamped on each write (additive optional field — no Dexie version bump; `backupSchema` DATE_FIELDS follows). Records without one (legacy data) are treated as older than any stamped record.
- **D-06: Deletions propagate via tombstones.** A delete leaves a `{id, deletedAt}` marker that syncs; the other device removes its copy unless it was edited AFTER the deletion (edit wins per LWW). Tombstones pruned after a retention window (planner picks the window; research spike validates mechanics).
- **D-07: Merge summary = per-store counts + expandable detail.** Headline per store ("Jobs: 4 added, 2 updated, 1 deleted") with an expandable list naming affected records; true conflicts (both devices edited the same record since last sync) flagged distinctly. Confirmation before commit is locked by the roadmap success criterion.
- **D-08: Auto-snapshot before every merge.** Before applying a merge, the app silently writes a pre-merge backup (reusing `buildBackupFile`) kept locally, with a "Restore pre-merge state" affordance in the Data tab for a while afterward. One-click undo for a bad merge. The merge itself runs in one Dexie transaction (same all-or-nothing discipline as `restoreBackup`).

**STL upload experience (CONN-02)**
- **D-09: One drop zone, routed by file type.** Extend the existing import drop zone: `.gcode` → slicer parse (exact numbers, current behavior), `.stl` → mesh estimate, `.3mf` → slicer metadata when present (current `threeMfParser` path), mesh estimate otherwise. The UI tells the user which path it took ("exact from slicer" vs "estimated from mesh").
- **D-10: Estimate computed against the selected filament, PLA fallback.** Use the density + price of the filament already selected in the form's first filament row; if none is selected, assume PLA (1.24 g/cm³) and say so in the estimate breakdown. Changing the filament re-computes.
- **D-11: Small rotatable 3D preview.** A compact viewport (rotate/zoom) next to the estimate numbers with model dimensions overlaid — the preview makes the units warning concrete (a 2cm cube vs a 2inch cube is visibly different). Three.js is already loaded for the mesh math.
- **D-12: Review card → explicit Apply.** Parsing opens an estimate card: preview, dimensions, infill input, warnings, estimated weight + cost, and the disclaimer — with an explicit "Apply to calculator" button that pre-fills the filament weight. Nothing touches the form until the maker acts. This is the "maker-reviewed estimate, never an auto-price" framing made mechanical.

**Estimate model & guards (CONN-02)**
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

### Deferred Ideas (OUT OF SCOPE)

- **Live folder watching / real-time sync** — the phase syncs on launch + debounced writes; watching the folder for changes while the app is open is a future enhancement
- **Per-record accept/skip in the merge summary** — full record-level review UI was considered and rejected for this phase (D-07 keeps LWW simple); revisit only if real merge complaints appear
- **Print-time estimate from mesh** — CONN-02 scopes weight + material cost only; estimating print time from geometry is a different (much harder) problem
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | User can sync between devices via file-based export/merge (user-owned folder e.g. Dropbox/Drive) with last-write-wins semantics, schema-version checks on import, and corruption guards (atomic writes, multi-tab safety) — free floor, no backend | Web Locks API primary-tab/critical-section pattern (multi-tab safety), Tauri write-temp-then-rename + `tauri-plugin-persisted-scope` (desktop atomic writes + folder access across restarts), File System Access API `createWritable()` (web-side atomicity is native), Dexie v13 tombstone store + `updatedAt` LWW extension of the existing `validateBackupFile`/`restoreBackup` contract |
| CONN-02 | User can get an instant local quote from an STL/3MF upload — in-browser mesh-volume estimate (Three.js lazy-loaded behind the same dynamic-import discipline as jsPDF + CI guard) with all three accuracy guards: units detection (mm/inch), infill-factor assumption surfaced, non-manifold mesh warning — framed as a maker-reviewed estimate, never an auto-price | `three` npm package (STLLoader + ThreeMFLoader addons), signed-tetrahedron volume formula, surface-area-based shells+infill weight model, edge-adjacency non-manifold heuristic, Web Worker feasibility for STLLoader.parse() math, vite manualChunks + `assert-no-static-*-import.mjs`-style CI gate cloned for `three` |
</phase_requirements>

## Summary

This phase bundles two independently-shippable, backend-free features that share one property: both read untrusted binary/JSON input from outside the app (a sync file the user's cloud folder round-tripped, or an STL/3MF the user uploaded) and must convert it into either a merged database state or a reviewable estimate without silently corrupting data. The codebase already has strong precedent to build from — `backupSchema.ts`/`backupExport.ts`/`backupRestore.ts` is a validate-everything-then-write-once, single-Dexie-transaction backup/restore pipeline that the sync merge path extends rather than replaces, and `GcodeImport.tsx`/`threeMfParser.ts` is the existing drop-zone → parse → pre-fill pattern that the STL path plugs into as a third file-type branch.

The research spike's core finding: the multi-tab/multi-process race is real but the browser and Tauri give different amounts of help. On the web, `FileSystemFileHandle.createWritable()` is **already** atomic — it writes to a swap file and only replaces the real file on `close()` — so file corruption from a single writer is a non-issue there. What createWritable() does **not** solve is the lost-update problem: two tabs each reading the current sync file, merging in their own local changes, and writing back can still stomp on each other's merge if both race through read→merge→write concurrently. That is exactly what the Web Locks API (`navigator.locks.request`) is for — wrap the full read-merge-write critical section in a named exclusive lock, not just the low-level file write. BroadcastChannel is best understood as the *notification* layer (announce "sync file changed, other tabs should re-check") built on top of, not instead of, the Web Locks mutex — this reframes the research flag's "BroadcastChannel lock patterns" language: the actual primitive that provides mutual exclusion is Web Locks; BroadcastChannel's role is leader-election/messaging, and libraries like `broadcast-channel` (npm) already implement Web-Locks-backed leader election with a BroadcastChannel message fallback for browsers without Web Locks.

On desktop, Tauri's `@tauri-apps/plugin-fs` `writeFile()` has no built-in atomicity — the write-temp-then-`rename()` pattern must be hand-rolled (a small, well-understood addition). The harder desktop problem is scope: the app's `fs:allow-write-file` capability is currently narrowed to `$DOWNLOAD/$DOCUMENT/$DESKTOP` (v1.9 hardening), but a user's Dropbox/Google Drive/OneDrive folder is very unlikely to live under any of those three roots. Tauri 2 does auto-extend the fs scope to a dialog-picked path for the current session, but that extension does **not** survive an app restart — and D-01 requires "pick once, then automatic" across every future launch. The fix is the official `tauri-plugin-persisted-scope` (crates.io, Tauri org, v2-compatible), which persists fs+asset scope grants across restarts with a one-line Rust registration and zero JS API surface. This is the single most important desktop finding in this research: without it, D-01 cannot be honored as written (the user would have to re-pick the folder every launch).

For CONN-02, the four locked accuracy guards (D-13 shells+infill, D-14 infill default, D-15 units heuristic, D-16 non-manifold-warn) are all implementable with well-documented geometry math: STL binary parsing is a fixed 84-byte-header + 50-bytes-per-triangle format that `STLLoader.parse()` already handles, volume comes from the signed-tetrahedron-per-triangle sum (requires consistent triangle winding, which STL guarantees by spec), non-manifold detection is an edge-adjacency count (an edge shared by exactly 2 triangles is manifold; 1 is a boundary/hole; 3+ is non-manifold) keyed by rounded vertex coordinates because `STLLoader` returns a non-indexed (duplicated-vertex) `BufferGeometry`. `three`'s `ThreeMFLoader` addon parses non-sliced 3MF geometry directly (it bundles its own `fflate`-based unzip, separate from the existing `jszip` used for sliced-3MF metadata) — the two 3MF code paths (existing sliced-metadata reader vs. new mesh-geometry reader) are genuinely different tools solving different sub-problems, not redundant.

**Primary recommendation:** Extend the existing backup/restore contract (don't replace it) for sync — new `syncMeta`/tombstone plumbing sits alongside `backupSchema.ts`, reusing `validateBackupFile`'s validate-everything-then-write-once discipline for the merge commit. Guard the desktop sync-folder access with `tauri-plugin-persisted-scope` from day one (add it in the same plan that adds folder-picking) rather than treating it as a later hardening pass — its absence breaks D-01's core promise. For CONN-02, do all volume/area/non-manifold math with `STLLoader.parse()`'s returned `BufferGeometry` running inside a Web Worker (postMessage the ArrayBuffer, receive back plain numbers) — Three.js's parse/geometry code has no DOM dependency, and a worker sidesteps the "never blocks the main thread" requirement entirely instead of hand-tuning yield points.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sync folder selection & handle persistence | Browser/Client (File System Access API) or Desktop (Tauri fs+dialog) | — | No backend; the "server" is literally the user's OS-level cloud-sync folder. Platform-specific by construction (D-02). |
| Sync file read/merge/write orchestration | Browser/Client (React hooks + Dexie) | Database/Storage (Dexie transaction) | Merge logic runs entirely client-side against IndexedDB; no network tier exists in this feature. |
| Multi-tab/multi-writer coordination | Browser/Client (Web Locks API + BroadcastChannel) | — | Purely an in-browser concurrency primitive; not applicable to the single-window Tauri process except for the desktop-app-launched-twice edge case, which the same lock covers. |
| Tombstone storage & LWW resolution | Database/Storage (Dexie v13 store + `updatedAt` field) | Browser/Client (merge algorithm) | Tombstones are data (must survive reloads, sync, and pruning), so they belong in Dexie, not a transient in-memory set. |
| STL/3MF file parsing & mesh math | Browser/Client (Web Worker) | — | CPU-bound, no I/O beyond the initial file read; a worker isolates it from the render thread per CONN-02's "never blocks main thread" lock. |
| 3D preview rendering (D-11) | Browser/Client (main thread, WebGL canvas) | — | WebGL context creation requires the main thread (or OffscreenCanvas, which is unnecessary complexity for a small rotatable preview); only the math moves to the worker, not the renderer. |
| Estimate → calculator pre-fill | Browser/Client (existing `GcodeImport` → `onImport` contract) | — | Reuses the established one-way data flow into the calculator form; no new integration surface. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `three` | 0.185.1 (verify at plan time — three.js ships monthly) | STL/3MF mesh parsing (`STLLoader`, `ThreeMFLoader` addons) + small 3D preview renderer (D-11) | The de facto standard WebGL library; `STLLoader`/`ThreeMFLoader` are maintained-in-tree addons, not third-party forks. `[VERIFIED: npm registry — v0.185.1, published 2026-07-01, first published 2012-12-07, 312 versions, official mrdoob/three.js repo]` |
| `tauri-plugin-persisted-scope` | 2.3.7 (crates.io) | Persists Tauri fs+asset scope grants (incl. the user's picked sync folder) across app restarts | Official Tauri-org plugin (`tauri-apps/plugins-workspace`, v2 branch); without it, D-01's "pick once, then automatic" cannot survive a relaunch on desktop. `[VERIFIED: crates.io via cargo search — tauri-plugin-persisted-scope 2.3.7]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `broadcast-channel` (npm) | latest (verify at plan time) | Optional: Web-Locks-backed leader election + BroadcastChannel fallback, pre-built | Only if the hand-rolled `navigator.locks.request` primary-tab pattern (≈30 lines, see Code Examples) proves insufficient in practice — this codebase's "no-nag, minimal dependencies" convention favors the hand-rolled version first. `[ASSUMED — not verified against registry this session; flag for confirmation if adopted]` |
| Dexie v13 store (`syncTombstones` or similar) | N/A (schema addition, not a package) | Persist `{id, store, deletedAt}` tombstone markers per D-06 | New Dexie store = version bump (v12 → v13), following the exact `db.version(13).stores({...})` pattern already used for v11 (`stockEvents`) and v12 (`failureEvents`/`maintenanceEvents`) — no upgrade/backfill needed (starts empty). `[VERIFIED: codebase — src/db/database.ts v11/v12 precedent]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled Web Locks primary-tab pattern | `broadcast-channel` npm package's built-in `LeaderElection` | The package adds a dependency + its own message-protocol surface for a problem this app can solve in ~30 lines using only the (already-zero-dependency) Web Locks API; only reach for the package if edge cases (browsers without Web Locks) prove painful in practice. |
| Web Worker for mesh math | `scheduler.yield()` / chunked main-thread computation | Workers are the documented best practice for genuinely CPU-bound work with no main-thread coupling (web.dev: "you can block with long-running JavaScript without the complexity and cost of chunking and yielding"); yielding is better suited to work that's interleaved with rendering, which mesh-volume math is not. `[CITED: web.dev/articles/off-main-thread]` |
| `ThreeMFLoader` for non-sliced 3MF mesh geometry | Hand-rolled 3MF XML parser reusing the existing `jszip` dependency | Writing a correct 3MF geometry parser (mesh vertices/triangles from `3D/3dmodel.model` XML, plus material/transform resolution) is substantially more work than accepting `ThreeMFLoader`'s bundled `fflate` unzip (~8KB gz) as a second, purpose-different unzip implementation alongside `jszip` (used only for the existing sliced-3MF metadata path, which stays untouched). |
| Chromium File System Access API auto-write | IndexedDB-only + manual export button for every browser | Would silently regress the "auto where possible" half of D-02 for the majority Chromium user base; the manual fallback is explicitly reserved for Safari/Firefox only, which structurally lack the API. |

**Installation:**
```bash
npm install three
# src-tauri/Cargo.toml:
#   tauri-plugin-persisted-scope = "2"
# src-tauri/src/lib.rs (or main.rs):
#   .plugin(tauri_plugin_persisted_scope::init())
```

**Version verification:** Confirmed live this session —
```
npm view three version          → 0.185.1 (published 2026-07-01)
npm view three time.created     → 2012-12-07
cargo search tauri-plugin-persisted-scope → 2.3.7
```
Re-run both at plan/implementation time since `three` ships monthly and could have moved.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `three` | npm | 13+ yrs (first published 2012-12-07), 312 versions | ~9.4M–23M/wk | github.com/mrdoob/three.js (official) | **SUS** (automated "too-new" signal — false positive: the checker flags the *latest publish date*, 2026-07-01, not the package's actual age; three.js ships a new version monthly and is one of the most established libraries in the ecosystem) | **Approved with note** — the SUS verdict is a false positive from monthly-release cadence, not a legitimacy concern. Evidence: 13-year history, 312 versions, official repo, huge download volume. No `checkpoint:human-verify` needed, but the planner should record this override rationale so a future audit doesn't re-flag it as unexamined. |
| `tauri-plugin-persisted-scope` (Rust crate, not npm) | crates.io | Part of official `tauri-apps/plugins-workspace` monorepo | N/A (crates.io doesn't expose weekly downloads the same way) | github.com/tauri-apps/plugins-workspace (official Tauri org) | Not run through the npm-ecosystem legitimacy checker (Rust crate) — verified directly via `cargo search` + official Tauri docs (`v2.tauri.app/plugin/persisted-scope/`) | Approved — official first-party Tauri plugin, confirmed on crates.io. |
| `broadcast-channel` (npm) | npm | Not verified this session | Not verified this session | github.com/pubkey/broadcast-channel (per search results) | **Not evaluated** — listed only as an "Alternatives Considered" fallback, not part of the recommended stack | If the planner decides to adopt it instead of the hand-rolled Web Locks pattern, run `gsd-tools query package-legitimacy check --ecosystem npm broadcast-channel` and `npm view broadcast-channel version` before installing, and gate the install behind `checkpoint:human-verify` per the `[ASSUMED]` tag above. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `three` — disposition above is "Approved with note," not "removed," because the SUS signal is demonstrably a false positive (see Age/Downloads/Repo columns). The planner does not need a `checkpoint:human-verify` task for `three` itself, but should keep this audit table in the plan for traceability.

## Architecture Patterns

### System Architecture Diagram

**Sync flow (SYNC-01):**
```
App launch
   │
   ▼
[Read local sync-folder handle/path]──(no folder chosen)──▶ [Sync section shows "Set up sync"]
   │ (folder chosen)
   ▼
[Web Locks: acquire "sync-critical-section" lock]  ◀── (queues if another tab holds it)
   │
   ▼
[Read sync file from folder]──(missing/first run)──▶ [Write current DB as initial sync file] ──▶ release lock
   │ (exists)
   ▼
[Compare sync file's per-record updatedAt / tombstones vs local DB]
   │
   ▼
[Build merge summary: added/updated/deleted counts per store + true-conflict flags]
   │
   ▼
[Show confirm UI: "Jobs: 4 added, 2 updated, 1 deleted" + expandable detail]
   │ (user confirms)
   ▼
[Auto-snapshot current DB (buildBackupFile, kept locally)]
   │
   ▼
[Apply merge in ONE Dexie transaction: bulkPut winners, apply tombstone deletes]
   │
   ▼
[Write merged state back to sync file (web: createWritable() atomic swap;
 desktop: write-temp-then-rename)]
   │
   ▼
[Release Web Locks lock] ──▶ [BroadcastChannel: notify other same-origin tabs "sync file changed"]

Any local data write (job/sale/setting) anywhere in the app
   │
   ▼
[Debounce timer (~10-30s, D-04)] ──(more writes arrive)──▶ [reset timer]
   │ (timer fires)
   ▼
[Web Locks: acquire same "sync-critical-section" lock] ──▶ [merge-and-write cycle above]
```

**STL/3MF instant quote flow (CONN-02):**
```
User drops/selects file in the existing import drop zone (GcodeImport.tsx)
   │
   ▼
[Route by extension: .gcode → existing parser | .3mf → existing threeMfParser (sliced only) |
 .stl always, .3mf-without-slice_info → NEW mesh estimate path]
   │
   ▼
[Dynamic import('three') + STLLoader/ThreeMFLoader — same lazy-load discipline as jsPDF]
   │
   ▼
[Read file as ArrayBuffer, postMessage to a Web Worker]
   │
   ▼
   Web Worker:
   [STLLoader.parse(buffer) / ThreeMFLoader.parse(buffer) → BufferGeometry (position attribute only)]
   │
   ▼
   [Compute bounding box (units heuristic, D-15) → signed-tetrahedron volume →
    surface area → shells+infill weight (D-13) → edge-adjacency non-manifold check (D-16)]
   │
   ▼
   [postMessage back: { volumeCm3, surfaceAreaCm2, boundingBox, isNonManifold, weightG }]
   │
   ▼
[Main thread: render small rotatable preview (D-11) from the same geometry (re-parsed or transferred),
 open estimate review card: preview + dimensions + infill input (default 15%, D-14) +
 units/non-manifold warnings + weight/cost breakdown + disclaimer]
   │
   ▼
[User clicks "Apply to calculator" (D-12)] ──▶ [existing onImport() pre-fill contract, same as GcodeImport]
```

### Recommended Project Structure
```
src/
├── utils/
│   ├── backupSchema.ts          # existing — extend with syncMeta/tombstone types
│   ├── backupExport.ts          # existing — unchanged
│   ├── backupRestore.ts         # existing — reuse validateBackupFile for merge input validation
│   ├── syncMerge.ts             # NEW — LWW merge algorithm (pure functions, mirrors reconcile* helpers)
│   ├── syncLock.ts              # NEW — Web Locks + BroadcastChannel wrapper (acquireSyncLock, notifyPeers)
│   ├── syncFileIO.ts            # NEW — platform-branched read/write (__IS_TAURI__ split), atomic-write helper
│   ├── stlParser.ts             # NEW — volume/area/non-manifold math (pure, worker-callable)
│   ├── meshWeightModel.ts       # NEW — shells+infill weight calc (D-13), separate from stlParser for testability
│   └── unitsHeuristic.ts        # NEW — bounding-box mm/inch guard (D-15)
├── workers/
│   └── meshEstimate.worker.ts   # NEW — hosts STLLoader/ThreeMFLoader.parse + stlParser math off-thread
├── components/
│   ├── BackupRestoreSection.tsx # existing — extended into "Backup, Restore & Sync" (D-03)
│   ├── SyncSetup.tsx            # NEW — folder picker, status, manual sync actions
│   ├── SyncMergeSummary.tsx     # NEW — confirm UI (D-07)
│   ├── GcodeImport.tsx          # existing — extended with .stl routing (D-09)
│   └── MeshEstimateCard.tsx     # NEW — review card: preview + dims + infill + warnings + Apply (D-12)
├── db/
│   └── database.ts              # existing — v13 stanza adds the tombstone store
└── hooks/
    └── useDatabase.ts           # existing — updatedAt stamping centralized (see Pitfall 1)
```

### Pattern 1: Web Locks primary-critical-section wrapper (not "primary tab forever")
**What:** Wrap only the read-merge-write cycle in a short-lived exclusive Web Locks request, rather than the "hold-forever primary tab" pattern MDN documents for connection-sharing use cases.
**When to use:** Any time the app is about to read the sync file, merge, and write it back — both the debounced auto-write (D-04) and the launch-time newer-file check (D-01).
**Example:**
```typescript
// src/utils/syncLock.ts
// Source: MDN Web Locks API (https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
const SYNC_LOCK_NAME = '3dcoster-sync-critical-section';

export async function withSyncLock<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!('locks' in navigator)) {
    // Feature-detect: Safari <15.4 / older WebKitGTK. Falls through to
    // "best effort, no lock" — acceptable because D-02 already restricts
    // the AUTO path to Chromium web + desktop; anything without Web Locks
    // support is exceedingly unlikely to also qualify for the auto path.
    return fn();
  }
  return navigator.locks.request(SYNC_LOCK_NAME, { mode: 'exclusive' }, async () => fn());
}
```

### Pattern 2: Write-temp-then-rename atomic write (Tauri desktop only)
**What:** The web side gets atomicity for free from `FileSystemFileHandle.createWritable()` (swap-file-on-close is the browser's documented implementation). Tauri's `plugin-fs` `writeFile()` has no such guarantee, so it must be hand-rolled.
**When to use:** Every desktop sync-file write (both the debounced auto-write and the merge-commit write).
**Example:**
```typescript
// src/utils/syncFileIO.ts (desktop branch)
// Source: Tauri v2 fs plugin docs (https://v2.tauri.app/reference/javascript/fs/) — rename() is documented
// as a single filesystem rename operation; the temp-then-rename pattern is the community-documented
// way to get atomicity since the plugin does not provide it natively.
import { writeFile, rename, remove } from '@tauri-apps/plugin-fs';

export async function atomicWriteTauri(path: string, bytes: Uint8Array): Promise<void> {
  const tmpPath = `${path}.tmp-${Date.now()}`;
  await writeFile(tmpPath, bytes);
  try {
    await rename(tmpPath, path); // single fs op — old file replaced in one step
  } catch (err) {
    await remove(tmpPath).catch(() => {}); // best-effort cleanup on failure
    throw err;
  }
}
```

### Pattern 3: Web Worker mesh math (never blocks main thread)
**What:** Run `STLLoader`/`ThreeMFLoader` `.parse()` plus all volume/area/non-manifold computation inside a dedicated Web Worker; only the small rotatable preview render (D-11) touches the main thread/DOM.
**When to use:** Every STL/3MF mesh-estimate parse (CONN-02's explicit "never blocks the main thread" requirement).
**Example:**
```typescript
// src/workers/meshEstimate.worker.ts
// Source: three.js STLLoader docs (https://threejs.org/docs/pages/STLLoader.html) — parse() takes
// an ArrayBuffer/string and returns BufferGeometry with no DOM/renderer dependency, confirmed
// worker-safe for the parse+math portion (only WebGLRenderer needs the main thread / OffscreenCanvas).
self.onmessage = async (e: MessageEvent<{ buffer: ArrayBuffer; kind: 'stl' | '3mf' }>) => {
  const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
  const { ThreeMFLoader } = await import('three/addons/loaders/3MFLoader.js');
  const geometry = e.data.kind === 'stl'
    ? new STLLoader().parse(e.data.buffer)
    : extractFirstMeshGeometry(new ThreeMFLoader().parse(e.data.buffer));
  const result = computeMeshEstimate(geometry); // pure function: volume, area, bbox, non-manifold
  self.postMessage(result);
};
```

### Anti-Patterns to Avoid
- **Widening `fs:allow-write-file` scope to `$HOME/**`:** Solves the sync-folder-access problem but silently undoes the v1.9 hardening decision to narrow desktop fs scope. Use the dialog-picked-path auto-scope-extension + `tauri-plugin-persisted-scope` instead — narrower, and it's what the official plugin exists for.
- **Treating BroadcastChannel as the mutex:** BroadcastChannel has no built-in mutual exclusion — it's a pub/sub message bus. Using it alone (message "I'm writing now", hope nobody else is) is a race condition, not a lock. Web Locks provides the actual exclusion; BroadcastChannel is for cross-tab notification after the fact.
- **Computing STL volume from the raw (non-indexed) triangle list without vertex welding for the non-manifold check:** `STLLoader` returns 3 duplicate vertices per triangle (no shared-index buffer). An edge-adjacency count keyed by raw vertex object identity will never find matching edges. Round coordinates to a small epsilon (e.g., 1e-5) and key by the rounded tuple before building the edge-adjacency map.
- **Re-implementing 3MF mesh parsing from scratch to avoid a second unzip library:** `ThreeMFLoader`'s bundled `fflate` (~8KB gz) is a small, well-tested cost against a substantial hand-rolled parser; not worth the complexity or bug surface to save the bytes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-tab mutual exclusion | A custom localStorage-polling lock | `navigator.locks.request()` (Web Locks API) | Native, no polling, automatically released on tab crash/close — a hand-rolled localStorage lock cannot detect a crashed holder without a heartbeat/timeout scheme that Web Locks gives for free. |
| Desktop sync-folder scope persistence | A custom Rust command that re-registers `app.fs_scope().allow_directory()` on every launch, backed by a hand-rolled JSON file of remembered paths | `tauri-plugin-persisted-scope` | This is exactly the problem the official plugin solves; hand-rolling it duplicates a maintained first-party plugin for no benefit. |
| STL triangle parsing | A hand-written `DataView` byte-offset reader | `STLLoader.parse()` (three.js addon) | Handles both binary and ASCII STL, vertex-color extensions, and malformed-header edge cases that a minimal hand-rolled reader would miss. |
| 3MF mesh geometry parsing | A hand-written 3MF XML + zip reader | `ThreeMFLoader.parse()` (three.js addon) | 3MF's `3D/3dmodel.model` schema includes transforms, multiple objects, materials, and build-item references — meaningfully more complex than STL; the addon already handles it. |
| Mesh volume calculation | An ad-hoc "average of bounding box × some factor" | Signed-tetrahedron-per-triangle summation | The signed-tetrahedron method is the standard, exact closed-mesh volume formula (used by slicers themselves); anything else systematically mis-estimates non-box-like geometry. |

**Key insight:** Every "don't hand-roll" item above already has a maintained, purpose-built implementation one dependency away — the actual net-new code in this phase is the *glue* (merge algorithm, weight model, units heuristic, UI), not the underlying primitives.

## Common Pitfalls

### Pitfall 1: `updatedAt` stamping scattered across 8+ write call sites instead of centralized
**What goes wrong:** D-05 requires every store to stamp `updatedAt` on write. `jobs` already does this inline in `addJob`/`updateJob` (see `useDatabase.ts`); replicating that inline pattern across `useMaterials`, `usePrinters`, `usePrinterInstances`, `useSales`, `useCustomers`, `useQuotes`, `stockEventsWriter`, `useAssets` invites at least one missed call site, which silently breaks LWW for that store (an un-stamped record always loses per D-05's "no `updatedAt` = treated as older" rule — so a genuinely newer edit could be discarded on merge).
**Why it happens:** The codebase's CRUD hooks are one-function-per-store, independently maintained since Phase 1; there's no shared "write" choke point today.
**How to avoid:** Before writing merge logic, introduce one shared low-level write wrapper (e.g., `stampAndPut(table, record)`) that every CRUD hook's add/update routes through, and grep-audit every existing `db.<table>.add(`/`db.<table>.put(`/`bulkPut(` call site to confirm it either goes through the wrapper or has a documented reason not to (mirrors the existing `WR-01`/`WR-03` comment convention already used for the reconcile helpers).
**Warning signs:** A sync merge test where a locally-newer edit loses to a stale remote record because the local write never got `updatedAt`.

### Pitfall 2: Tombstones require deleting from a store that also participates in the backup/restore contract
**What goes wrong:** `restoreBackup`'s `clear()` + `bulkPut()` per store (see `backupRestore.ts`) has no concept of tombstones — a plain restore of an OLD backup would resurrect records that were legitimately deleted (and tombstoned) after that backup was made. This phase must not accidentally make full-database restore worse.
**Why it happens:** Tombstones are additive to the sync path, but `restoreBackup` is a separate, older code path (manual "Restore" button) that the sync merge logic must not silently change the behavior of.
**How to avoid:** Keep tombstone-aware merge (`syncMerge.ts`) and full-replace restore (`backupRestore.ts`) as two genuinely separate functions with different contracts — sync merge reads/writes tombstones, plain restore stays exactly as destructive/simple as it is today (a full backup restore is documented to the user as "replace everything," so resurrecting a since-deleted record via an old backup is expected, not a regression).
**Warning signs:** A test that restores an old backup and expects deleted-after-that-backup records to stay gone — this is the wrong expectation for the existing "Restore" button; only the "Sync" merge path is tombstone-aware.

### Pitfall 3: Assuming the Tauri dialog-picked folder scope survives past the current session
**What goes wrong:** Tauri 2's documented behavior is that a dialog-selected path auto-extends fs scope for that session. Without `tauri-plugin-persisted-scope` registered, the very next app launch would either fail to read/write the sync folder, or require re-showing the folder picker — silently breaking D-01's "pick once" promise on desktop.
**Why it happens:** The session-scoped auto-extension is easy to test manually within one dev session and looks like it "just works," masking the restart-persistence gap until real usage (close and reopen the app) surfaces it.
**How to avoid:** Add `tauri-plugin-persisted-scope` as part of the same plan/wave that adds folder-picking — not as a follow-up hardening item — and explicitly test "pick folder → quit app → relaunch → sync still works without re-prompting" before calling the desktop sync flow done.
**Warning signs:** Manual QA that never actually restarts the desktop app between picking the folder and testing sync.

### Pitfall 4: Non-manifold detection false-positives from STL export vertex-coordinate rounding noise
**What goes wrong:** Different slicers/exporters can emit near-duplicate vertices for what is conceptually the same shared vertex, due to floating-point rounding during export. A naive exact-equality edge-adjacency map will see these as different vertices, misreporting a perfectly valid closed mesh as non-manifold (every real triangle edge appears to have only 1 adjacent triangle instead of 2, because its "duplicate" partner is keyed slightly differently).
**Why it happens:** `STLLoader` intentionally returns a non-indexed geometry (no vertex welding) because STL itself has no shared-vertex concept — welding must happen downstream, and naive welding needs a tolerance, not exact float equality.
**How to avoid:** Weld vertices with a small tolerance (round each coordinate to ~5-6 significant decimal places, e.g., `Math.round(x * 1e5) / 1e5`, or use an integer-quantized key) before building the edge-adjacency map. Validate against a handful of known-good real-world STL exports (Bambu Studio/PrusaSlicer/Cura-sliced test files) as well as at least one deliberately broken mesh, so the non-manifold warning has genuine signal and doesn't fire on every legitimate upload.
**Warning signs:** The non-manifold warning appearing on files known to be printable/watertight in a slicer.

### Pitfall 5: Treating the shells+infill model's wall/top-bottom assumptions as configurable when they're actually fixed defaults
**What goes wrong:** D-13 locks the *shape* of the model (shells + infill%, not pure volume×infill) but explicitly leaves "wall-count / top-bottom-thickness assumptions" to the planner's discretion. If those constants end up scattered as magic numbers across the weight-calc code instead of one named, documented location, later tuning (or a future "advanced" mode) becomes a multi-file hunt.
**Why it happens:** The natural place to write the formula is inline in whatever function first needs it.
**How to avoid:** Isolate wall-count/top-bottom-thickness/line-width as named constants in `meshWeightModel.ts` with a comment citing the slicer default they mirror (e.g., "3 walls / 4 top-bottom layers ≈ PrusaSlicer/Bambu Studio 'Standard' preset"), separate from `stlParser.ts`'s pure geometry math — this is also the "surface them in the breakdown if cheap" hook the discretion note calls out.
**Warning signs:** A wall-count number appearing as a bare literal (`* 3` or `1.2`) inside the volume/area computation function itself.

## Code Examples

### Signed-tetrahedron volume from a non-indexed BufferGeometry
```typescript
// Source: STL volume calculation — signed tetrahedron method (WebSearch, cross-referenced
// against the standard divergence-theorem mesh-volume formula used in slicer/CAD tooling)
function computeSignedVolumeCm3(position: Float32Array): number {
  let volumeMm3 = 0;
  for (let i = 0; i < position.length; i += 9) {
    const v1x = position[i], v1y = position[i + 1], v1z = position[i + 2];
    const v2x = position[i + 3], v2y = position[i + 4], v2z = position[i + 5];
    const v3x = position[i + 6], v3y = position[i + 7], v3z = position[i + 8];
    // signed volume of the tetrahedron formed by the triangle and the origin
    volumeMm3 += (
      v1x * (v2y * v3z - v2z * v3y) -
      v1y * (v2x * v3z - v2z * v3x) +
      v1z * (v2x * v3y - v2y * v3x)
    ) / 6;
  }
  return Math.abs(volumeMm3) / 1000; // mm^3 -> cm^3
}
```

### Edge-adjacency non-manifold check (with vertex welding)
```typescript
// Source: non-manifold-edge detection — standard "each edge belongs to exactly 2 triangles"
// definition (WebSearch, cross-referenced against Open3D's is_edge_manifold documentation)
function detectNonManifold(position: Float32Array, epsilon = 1e-5): boolean {
  const key = (x: number, y: number, z: number) =>
    `${Math.round(x / epsilon)},${Math.round(y / epsilon)},${Math.round(z / epsilon)}`;
  const edgeCounts = new Map<string, number>();
  for (let i = 0; i < position.length; i += 9) {
    const verts = [0, 1, 2].map(v => key(
      position[i + v * 3], position[i + v * 3 + 1], position[i + v * 3 + 2]
    ));
    for (let e = 0; e < 3; e++) {
      const a = verts[e], b = verts[(e + 1) % 3];
      const edgeKey = a < b ? `${a}|${b}` : `${b}|${a}`;
      edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) ?? 0) + 1);
    }
  }
  // Manifold: every edge has exactly 2 adjacent triangles. 1 = boundary/hole
  // (also worth flagging), 3+ = genuinely non-manifold.
  for (const count of edgeCounts.values()) {
    if (count !== 2) return true;
  }
  return false;
}
```

### Vite manualChunks entry for `three` (mirrors the existing `pdf` chunk pattern)
```typescript
// Source: existing vite.config.ts manualChunks function (this codebase) — same ordering
// discipline that PDF-04 established: route BEFORE the generic node_modules fallback.
if (id.includes('/src/mesh-estimate/') || id.includes('/three/')
  || id.includes('/three-stdlib/') /* only if used */) {
  return 'three';
}
```
A sibling `scripts/assert-no-static-three-import.mjs`, cloned from `assert-no-static-pdf-import.mjs` with `pdf` → `three` string substitution, becomes the CI gate CONN-02 explicitly locks ("same CI gate as jsPDF").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `tauri-plugin-persisted-scope` as a separate v1-era community plugin, later archived | Official plugin folded into `tauri-apps/plugins-workspace` monorepo, actively versioned for Tauri 2 (v2.3.7) | v1→v2 Tauri migration (plugins-workspace consolidation) | The old standalone GitHub repo (`tauri-apps/tauri-plugin-persisted-scope`) is archived/read-only; installing from crates.io/the monorepo, not the old repo directly, is the current correct path. |
| Manual JSZip-based unzip for all ZIP-format 3D files | `three`'s `ThreeMFLoader` bundles its own `fflate`-based unzip internally | Ongoing (three.js addon design) | Don't expect `ThreeMFLoader` to reuse the app's existing `jszip` dependency — it brings its own, smaller (`fflate`) unzip implementation as a transitive cost. |
| `dexie-observable`/`dexie-syncable` for IndexedDB sync | Both deprecated; Dexie's own recommendation is either Dexie Cloud (hosted, out of scope — REQUIREMENTS.md explicitly defers `SYNC-02`/Dexie Cloud pending EU-residency confirmation) or a custom file-based LWW merge (this phase's approach) | Ongoing | Confirms this phase's from-scratch merge approach is the currently-correct choice for a no-backend requirement, not a workaround for missing tooling. |

**Deprecated/outdated:**
- `dexie-observable` / `dexie-syncable`: explicitly called out by Dexie's own docs as incompatible with Dexie Cloud and not recommended for new projects.
- The standalone (non-monorepo) `tauri-apps/tauri-plugin-persisted-scope` GitHub repo: archived; use the `plugins-workspace` v2-branch version instead.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `broadcast-channel` npm package details (exact version, current maintenance status) | Standard Stack → Supporting | Low — it's explicitly framed as an optional fallback, not the recommended path; if adopted, re-verify via `package-legitimacy check` + `npm view` before install per the audit table. |
| A2 | WebKitGTK (Linux Tauri webview) has adequate Web Locks API + BroadcastChannel coverage on the distro/version combinations the desktop app targets | Architecture Patterns → Pattern 1 / Architectural Responsibility Map | Medium — if a target Linux WebKitGTK version lacks Web Locks, the `withSyncLock` feature-detect fallback (`if (!('locks' in navigator))`) already degrades to "no lock," which is a real (if narrow) multi-tab-race window on that platform specifically. Recommend a runtime smoke test on the actual Linux CI/build image before shipping, not just a browser-compat-table assumption. |
| A3 | The desktop app is effectively single-window per user session (so the "multi-tab" race is mostly a web-app concern) | Summary / Architectural Responsibility Map | Low-Medium — if a user runs two instances of the desktop app simultaneously (e.g., via a portable copy, or OS allows multi-instance), the same Web Locks-based lock still applies (Web Locks work across separate processes hitting the same origin's storage partition in Tauri's WebView, same as browser tabs), so the risk is mitigated by the same primitive already chosen — this assumption affects only whether extra multi-instance-specific testing is warranted at plan time. |

**If this table is empty:** N/A — three items above need light confirmation, none are load-bearing enough to block planning.

## Open Questions (RESOLVED)

1. **Exact tombstone retention window**
   - RESOLVED (planning): Plan 44-01 sets `SYNC_TOMBSTONE_RETENTION_DAYS = 90`, matching the recommendation below.
   - What we know: D-06 requires pruning after "a retention window" and explicitly defers the exact number to the planner.
   - What's unclear: No product/legal constraint was surfaced during research that mandates a specific value (unlike, say, GDPR retention requirements elsewhere in this project).
   - Recommendation: Pick something safely longer than the realistic max gap between two devices syncing (e.g., 90 days) — long enough that a device that's been offline for a normal vacation/hiatus doesn't silently resurrect a deletion it never saw, short enough that the tombstone store doesn't grow unbounded for active users. Document the choice with the same reasoning-comment convention already used for `MAX_RECORDS_PER_STORE` etc. in `backupSchema.ts`.

2. **Whether `ThreeMFLoader.parse()`'s Group traversal reliably yields exactly one estimate-relevant mesh for the multi-plate/multi-object 3MF files this app already sees via the sliced path**
   - RESOLVED (planning): Plan 44-05 sums all mesh geometries in the loaded Group and surfaces the object count in the estimate-card breakdown, per the recommendation below.
   - What we know: The existing `threeMfParser.ts` already handles multi-plate sliced 3MF files (Bambu/Orca). A non-sliced 3MF opened via `ThreeMFLoader` for the mesh-estimate path could, in principle, also contain multiple objects/plates.
   - What's unclear: Whether D-13's weight model should sum volume across all meshes in the Group, or only estimate the first/largest one, when a non-sliced 3MF contains multiple objects.
   - Recommendation: Default to summing all mesh geometries found in the loaded Group (most conservative, matches "what would actually print" if all objects are on the plate); surface the object count in the estimate card breakdown so the user can tell at a glance if that's not what they expected. Confirm this reading during planning/UAT rather than guessing silently.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `three` (npm) | CONN-02 mesh parsing/preview | ✗ (not yet installed) | — | Install as part of this phase's plan; no fallback — the requirement is not satisfiable without it. |
| `tauri-plugin-persisted-scope` (Cargo) | SYNC-01 desktop folder persistence | ✗ (not yet installed) | — | Install as part of this phase's plan. If, at implementation time, the plugin proves incompatible with the pinned Tauri version, the fallback is a hand-rolled Rust command re-registering scope on launch from a remembered path in `settings` — strictly more work, documented here only as a last resort. |
| Web Locks API (`navigator.locks`) | SYNC-01 multi-tab safety | ✓ (Chromium web, WKWebView/macOS desktop, WebView2/Windows desktop) — ✗ possibly on older WebKitGTK/Linux desktop builds | Feature-detected at runtime | `withSyncLock` degrades to "no lock" (Pattern 1) — acceptable narrow risk per Assumption A2; recommend a Linux smoke test. |
| File System Access API (`showDirectoryPicker`) | SYNC-01 Chromium web auto-sync | ✓ Chromium-based browsers only, by design (D-02) | — | Safari/Firefox already fall back to manual export/import per D-02 — this is the intended, not accidental, degradation. |
| BroadcastChannel | SYNC-01 cross-tab notification | ✓ All modern browsers + Tauri webviews | — | Notification-only (not a correctness dependency, per Pattern 1's mutex/notification split); absence would only delay another tab noticing a sync-file change until its next natural poll/action. |

**Missing dependencies with no fallback:** `three`, `tauri-plugin-persisted-scope` — both must be installed during this phase's implementation; there is no substitute for either given the locked decisions.

**Missing dependencies with fallback:** none beyond the browser-API feature-detection paths already covered above (all of which have D-02-sanctioned degraded paths, not phase-blocking gaps).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (unit/integration, jsdom environment) + Playwright 1.61.1 (E2E) |
| Config file | `vitest.config.ts` (includes `src/**/*.test.{ts,tsx}`, `tests/**/*.test.ts`, `api/**/*.test.ts`); `playwright.config.ts` |
| Quick run command | `npx vitest run src/utils/syncMerge.test.ts src/utils/stlParser.test.ts` (or the relevant new test file) |
| Full suite command | `npm test` (vitest run — also wired into `npm run build` as a gate) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| SYNC-01 | Schema-version check rejects incompatible sync file with a clear message | unit | `npx vitest run src/utils/syncMerge.test.ts -t "schema version"` | ❌ Wave 0 (extends the existing `validateBackupFile` pattern — model on `backupRestore.test.ts`) |
| SYNC-01 | LWW merge: newer `updatedAt` wins per record; missing `updatedAt` treated as oldest | unit | `npx vitest run src/utils/syncMerge.test.ts -t "last-write-wins"` | ❌ Wave 0 |
| SYNC-01 | Tombstone delete propagates unless target was edited after the deletion (edit-wins) | unit | `npx vitest run src/utils/syncMerge.test.ts -t "tombstone"` | ❌ Wave 0 |
| SYNC-01 | Merge summary reports correct per-store added/updated/deleted counts | unit | `npx vitest run src/components/SyncMergeSummary.test.tsx` | ❌ Wave 0 |
| SYNC-01 | Merge commit is one atomic Dexie transaction (all-or-nothing) | integration | `npx vitest run src/utils/syncMerge.test.ts -t "transaction"` (fake-indexeddb, force a mid-merge throw) | ❌ Wave 0 |
| SYNC-01 | Concurrent-write race: two simulated tabs racing the debounced write don't both win | integration | `npx vitest run src/utils/syncLock.test.ts` (mock `navigator.locks`) | ❌ Wave 0 |
| SYNC-01 | Desktop atomic write survives a simulated mid-write failure (temp file present, real file untouched) | unit | `npx vitest run src/utils/syncFileIO.test.ts -t "atomic"` (mock `@tauri-apps/plugin-fs`) | ❌ Wave 0 |
| CONN-02 | STL volume computation matches a known reference value (e.g., a unit cube = 1cm³) | unit | `npx vitest run src/utils/stlParser.test.ts -t "volume"` | ❌ Wave 0 |
| CONN-02 | Non-manifold detection: flags a deliberately broken mesh, does not flag known-good watertight meshes | unit | `npx vitest run src/utils/stlParser.test.ts -t "manifold"` | ❌ Wave 0 (fixture files needed — see Wave 0 Gaps) |
| CONN-02 | Units heuristic flags an implausibly small/large bounding box and the one-click ×25.4 convert corrects it | unit | `npx vitest run src/utils/unitsHeuristic.test.ts` | ❌ Wave 0 |
| CONN-02 | Shells+infill weight model produces a higher estimate than pure volume×infill for the same mesh | unit | `npx vitest run src/utils/meshWeightModel.test.ts -t "shells exceed pure infill"` | ❌ Wave 0 |
| CONN-02 | Web Worker path never blocks: parse of a large STL does not block a concurrent main-thread interval/timer in a jsdom+worker-mocked test | integration | `npx vitest run src/workers/meshEstimate.worker.test.ts` | ❌ Wave 0 |
| CONN-02 | `three` chunk is never statically imported outside its own chunk (bundle-level regression guard) | build-gate | `node scripts/assert-no-static-three-import.mjs` (new, cloned from `assert-no-static-pdf-import.mjs`) | ❌ Wave 0 |
| CONN-02 | Apply-to-calculator pre-fills filament weight via the existing `onImport` contract, form untouched until Apply clicked | E2E/component | `npx vitest run src/components/MeshEstimateCard.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant quick-run vitest command for the file(s) touched.
- **Per wave merge:** `npm test` (full vitest suite).
- **Phase gate:** Full suite green + `npm run build` (which chains `assert-no-static-jspdf.mjs`, coverage thresholds, `tsc -b`, `vite build`, `assert-bundle-size.mjs`, `assert-no-pdf-preload.mjs`, `assert-no-static-pdf-import.mjs` — the new `assert-no-static-three-import.mjs` should be added to this same chain) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/utils/syncMerge.test.ts` — covers SYNC-01 LWW/tombstone/schema-version behavior
- [ ] `src/utils/syncLock.test.ts` — covers SYNC-01 multi-tab race safety (mocked `navigator.locks`)
- [ ] `src/utils/syncFileIO.test.ts` — covers SYNC-01 atomic-write behavior (both platforms, mocked I/O)
- [ ] `src/components/SyncMergeSummary.test.tsx` — covers SYNC-01 merge-summary UI
- [ ] `src/utils/stlParser.test.ts` — covers CONN-02 volume/area/non-manifold math; needs a small fixture set (a unit-cube STL with known volume, a deliberately non-manifold STL, and ideally one real slicer-exported STL)
- [ ] `src/utils/unitsHeuristic.test.ts` — covers CONN-02 mm/inch guard
- [ ] `src/utils/meshWeightModel.test.ts` — covers CONN-02 shells+infill weight model
- [ ] `src/workers/meshEstimate.worker.test.ts` — covers CONN-02 non-blocking guarantee
- [ ] `scripts/assert-no-static-three-import.mjs` — new CI gate, cloned from the existing jsPDF-family scripts
- [ ] Framework install: none needed (Vitest/Playwright already present) — only new fixture files and the new script above

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Sync/STL features are entirely local, no-account by design (free floor guarantee). |
| V3 Session Management | No | No session concept in this phase. |
| V4 Access Control | Partial | Tauri fs scope IS the access-control boundary for desktop sync (must stay narrowed to the user-picked folder via `tauri-plugin-persisted-scope`, never widened to `$HOME/**`). |
| V5 Input Validation | Yes | Both the sync file (JSON, potentially from another device/tampered) and the STL/3MF file (binary, user-supplied) are untrusted input requiring the same rigor as the existing backup-restore path: whole-file rejection on any structural violation, no partial/best-effort acceptance. |
| V6 Cryptography | No | No cryptographic operations in this phase (sync files are plain JSON in a folder the user already trusts, same threat model as the existing backup file). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Sync file forbidden-key injection (`__proto__`/`constructor`/`prototype`) via a tampered/malicious sync file dropped into the shared folder | Tampering | Reuse the existing `hasForbiddenKey` check from `backupRestore.ts` verbatim for the sync merge's per-record validation — do not write a second, potentially-weaker validator. |
| STL/3MF zip-bomb or oversized-file DoS (3MF is a ZIP; STL binary size is attacker-controllable) | Denial of Service | Mirror the existing `MAX_THREE_MF_BYTES` (200MB) and the `MAX_SLICE_CONFIG_BYTES` (8MB decompressed) guards already in `threeMfParser.ts`/`GcodeImport.tsx` for the new mesh-estimate 3MF path; add an analogous raw-byte cap for `.stl` uploads before parsing (STL has no compression, so the file-size cap alone is sufficient — no decompression-bomb vector exists for `.stl`). |
| Sync-file JSON parse of an oversized file blocking the main thread / exhausting memory | Denial of Service | Reuse `MAX_BACKUP_BYTES` (50MB) as the starting cap for sync files too — reject before `.text()`/`JSON.parse()`, exactly as `BackupRestoreSection.tsx` already does. |
| Desktop fs scope creep (a future edit accidentally widens `fs:allow-write-file` beyond the sync folder to satisfy a debugging shortcut) | Elevation of Privilege | Code-review checklist item: any diff touching `src-tauri/capabilities/*.json` in this phase must be scoped to the dialog-auto-extension + `tauri-plugin-persisted-scope` mechanism, never a static glob widening (per the explicit "don't silently widen" instruction in CONTEXT.md's canonical refs). |
| Cross-tab lock starvation (a crashed/hung tab holds the Web Locks lock forever, blocking all future syncs) | Denial of Service (self-inflicted) | Web Locks auto-releases on tab close/crash by spec (unlike a hand-rolled localStorage lock) — this is precisely why Pattern 1 recommends Web Locks over a custom mutex; still worth a defensive timeout inside the locked callback itself (e.g., abort the merge if it runs > N seconds) so a genuine infinite loop inside the callback can't hold the lock indefinitely even though the tab itself is alive. |

## Sources

### Primary (HIGH confidence)
None — no MCP documentation tools (Context7/Ref/etc.) were available in this environment; all findings below were WebSearch/WebFetch against official sources, so nothing qualifies as MCP-verified HIGH per this project's provenance rules. The npm/crates.io registry checks (`npm view three ...`, `cargo search tauri-plugin-persisted-scope`) are direct tool-verified facts and are cited inline in the relevant tables above.

### Secondary (MEDIUM confidence — WebSearch/WebFetch cross-checked against official docs)
- [MDN: Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) — primary-tab pattern, lock modes, deadlock avoidance
- [MDN: LockManager.request()](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request)
- [Tauri v2: File System plugin](https://v2.tauri.app/plugin/file-system/) — scope, permissions
- [Tauri v2: Persisted Scope plugin](https://v2.tauri.app/plugin/persisted-scope/) — setup, Cargo.toml/registration
- [tauri-apps/tauri discussion #9195: FS permissions dependent on dialog action](https://github.com/tauri-apps/tauri/discussions/9195) — dialog-selected-path auto-scope-extension
- [tauri-apps/plugins-workspace persisted-scope (v2 branch)](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/persisted-scope)
- [MDN: FileSystemFileHandle.createWritable()](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable) — swap-file/atomic-on-close behavior
- [Chrome for Developers: Persistent permissions for the File System Access API](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api) — Chrome 122+ persistent grants
- [three.js docs: STLLoader](https://threejs.org/docs/pages/STLLoader.html)
- [three.js docs: ThreeMFLoader](https://threejs.org/docs/pages/ThreeMFLoader.html)
- [three.js GitHub: examples/jsm/loaders/3MFLoader.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/loaders/3MFLoader.js) — bundled `fflate` unzip
- [web.dev: Use web workers to run JavaScript off the browser's main thread](https://web.dev/articles/off-main-thread)
- [web.dev: Optimize long tasks](https://web.dev/articles/optimize-long-tasks) — `scheduler.yield()` tradeoffs
- [GitHub: pubkey/broadcast-channel](https://github.com/pubkey/broadcast-channel) — Web-Locks-backed leader election
- [SitePen: Cross-tab Synchronization with the Web Locks API](https://www.sitepen.com/blog/cross-tab-synchronization-with-the-web-locks-api)
- [Dexie.js docs](https://dexie.org/docs/Dexie.js) — soft-delete/tombstone community pattern, Dexie Cloud/dexie-syncable deprecation notes
- [Open3D docs: Mesh (is_edge_manifold / is_watertight)](https://www.open3d.org/docs/0.11.1/tutorial/geometry/mesh.html) — non-manifold/watertight definitions
- [David Stutz: A Formal Definition of Watertight Meshes](https://davidstutz.de/a-formal-definition-of-watertight-meshes/)

### Tertiary (LOW confidence — flagged for validation)
- `broadcast-channel` npm package specifics (version, maintenance) — not independently verified this session; see Assumptions Log A1.
- WebKitGTK/Linux desktop Web Locks + BroadcastChannel support breadth — inferred from WebKit engine family, not directly tested; see Assumptions Log A2.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — `three` and `tauri-plugin-persisted-scope` versions verified live against their registries this session; no HIGH-tier MCP documentation source was available to cross-verify API details, so treat exact API signatures as needing a quick doc-check at implementation time.
- Architecture: MEDIUM-HIGH — the sync merge architecture directly extends an existing, well-tested codebase pattern (`backupSchema`/`backupExport`/`backupRestore`); the STL/3MF worker architecture is new but built entirely from documented, standard primitives.
- Pitfalls: MEDIUM — Pitfalls 1-3 are grounded directly in this codebase's actual code (`useDatabase.ts`, `backupRestore.ts`, Tauri capabilities file) and are high-confidence; Pitfalls 4-5 are inferred from general mesh-processing/slicer-defaults knowledge and should be validated against real STL fixtures during implementation.

**Research date:** 2026-07-17
**Valid until:** 30 days for the Tauri/browser-API findings (stable platform APIs); re-verify `three` version specifically at plan/implementation time since it ships monthly.
