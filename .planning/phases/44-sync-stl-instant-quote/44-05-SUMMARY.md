---
phase: 44-sync-stl-instant-quote
plan: 05
subsystem: ui
tags: [three, web-worker, stl, 3mf, dropzone, mesh-estimate, camera-framing]

# Dependency graph
requires:
  - phase: 44-02
    provides: computeMeshEstimate geometry math (volume/area/non-manifold) + three manualChunks route + assert-no-static-three-import CI gate
provides:
  - Web Worker (meshEstimate.worker.ts) that parses STL/non-sliced-3MF off the main thread and runs the 44-02 math
  - MeshEstimateCard review UI: rotatable 3D preview, dims, infill input (persisted), units warning + convert, non-manifold warning, weight/cost breakdown, disclaimer, Apply
  - GcodeImport routing: .stl and non-sliced .3mf go down the mesh-estimate path; exact g-code/sliced-3MF paths unchanged; visible "exact from slicer" vs "estimated from mesh" labeling
  - cameraFraming.ts: pure bounding-sphere-in-frustum camera distance/clip-plane math + pane aspect/size derivation, unit-testable without WebGL
affects: [44-sync-stl-instant-quote closure, any future 3D preview work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Worker-only three consumption: three/addons loaders dynamic-imported inside a module Worker; WebGL preview rendering stays main-thread (required for a canvas) but also dynamic-imports three — assert-no-static-three-import enforces this at build time"
    - "Bounding-sphere-in-frustum camera framing (distance = radius * margin / sin(fov/2)) instead of a maxDim heuristic, derived and tested in a pure util (cameraFraming.ts) with no three dependency"
    - "Pane aspect/size derived from an exact isometric corner-projection of the model's bounding box, clamped to sane min/max, so the preview canvas matches model proportions instead of a fixed square"

key-files:
  created:
    - src/workers/meshEstimate.worker.ts
    - src/workers/meshEstimate.worker.test.ts
    - src/components/MeshEstimateCard.tsx
    - src/components/MeshEstimateCard.test.tsx
    - src/utils/cameraFraming.ts
    - src/utils/cameraFraming.test.ts
  modified:
    - src/components/GcodeImport.tsx
    - src/components/calculator/CostFormSection.tsx
    - vite.config.ts

key-decisions:
  - "Worker sums volume/area/vertex-count across all mesh geometries in a multi-object 3MF Group and reports object count (Open Question 2 default: sum all, surface count)"
  - "Camera framing uses distance = radius * margin / sin(fov/2) against the model's bounding-sphere radius, not axis-aligned maxDim — the latter clips for any shape whose bounding-sphere radius exceeds the frustum half-height at that distance (round-1 human-verify finding)"
  - "Preview pane wrapper needs explicit self-start (not just a square canvas) because the parent flex container's default align-items:stretch was stretching the bordered wrapper to the taller sibling info column, independent of the canvas's own aspect (round-2 human-verify finding)"

patterns-established:
  - "Pure camera/pane-geometry math lives outside any three-touching file so it can be unit-tested without a WebGL/jsdom render — same shape as stlParser.ts's no-three rule from 44-02"

requirements-completed: [CONN-02]

coverage:
  - id: D1
    description: "Worker parses STL + non-sliced 3MF off the main thread, sums multi-object geometry, returns the estimate + preview position, and never blocks the main thread; three imported only dynamically"
    requirement: CONN-02
    verification:
      - kind: unit
        ref: "src/workers/meshEstimate.worker.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "MeshEstimateCard shows preview + dims + infill (15% default, persisted) + units/non-manifold warnings + weight/cost breakdown + disclaimer; Apply pre-fills grams via onImport; nothing applies pre-click"
    requirement: CONN-02
    verification:
      - kind: unit
        ref: "src/components/MeshEstimateCard.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "3D preview renders and rotates/zooms smoothly, frames the model fully (no clipping), and the pane matches the model's actual proportions"
    requirement: CONN-02
    verification:
      - kind: unit
        ref: "src/utils/cameraFraming.test.ts"
        status: pass
      - kind: manual_procedural
        ref: "Task 4 human-verify checkpoint (3 rounds: initial finding = clipping, round 2 finding = vertical-stretch pane, round 3 = approved)"
        status: pass
    human_judgment: true
    rationale: "WebGL render quality, rotate/zoom feel, and visual proportion-matching can only be confirmed by a human looking at the rendered canvas — this is exactly what the plan's checkpoint gate exists for, and it has already been run and approved."
  - id: D4
    description: "Drop zone routes .stl and non-sliced .3mf to the mesh estimate path; exact g-code/sliced-3MF paths are unchanged; path labeled 'exact from slicer' vs 'estimated from mesh'"
    requirement: CONN-02
    verification:
      - kind: e2e
        ref: "src/components/GcodeImport.test.tsx (existing suite, unchanged branches still pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Units mm/inch warning appears for inch-scale uploads and 'Treat as inches' rescales preview + numbers; Apply pre-fills the first filament row grams"
    requirement: CONN-02
    verification:
      - kind: manual_procedural
        ref: "Task 4 human-verify checkpoint step 4-5"
        status: pass
    human_judgment: true
    rationale: "Confirmed live by the user during the Task 4 checkpoint (inches rescale + Apply pre-fill both explicitly verified as working in the approval message)."

# Metrics
duration: 41min
completed: 2026-07-19
status: complete
---

# Phase 44 Plan 05: STL/3MF Instant Quote UI Summary

**Web Worker STL/3MF mesh parsing (dynamic three import) feeding a reviewable MeshEstimateCard with bounding-sphere camera framing, units/non-manifold guards, and an explicit Apply-to-calculator step — no auto-pricing.**

## Performance

- **Duration:** 41 min (dev work; checkpoint approval wait time not counted)
- **Started:** 2026-07-19T09:23:02-04:00
- **Completed:** 2026-07-19T09:59:10-04:00 (round-3 checkpoint approval afterward)
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint, approved after 2 fix rounds)
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments
- `meshEstimate.worker.ts`: module Worker that dynamic-imports `three/addons` loaders (STLLoader, ThreeMFLoader), parses STL and non-sliced 3MF, sums multi-object mesh geometry, runs `computeMeshEstimate` from 44-02's `stlParser.ts`, and postMessages the result + transferable preview position array — parse math never blocks the main thread, and `three` is never statically imported.
- `MeshEstimateCard.tsx`: the maker-facing review UI — rotatable/zoomable 3D preview, bbox dimensions, infill % input (default 15, persisted to `stl-estimate-infill` via `useLocalStorage`), units mm/inch warning with one-click "Treat as inches" convert, non-manifold warning, weight/cost breakdown recomputed live off infill/filament/units changes, and the "This is an estimate — review before quoting" disclaimer. "Apply to calculator" is the ONLY thing that calls `onApply` (existing `onImport` contract) — nothing pre-fills on mount.
- `GcodeImport.tsx` routing: `.stl` and non-sliced `.3mf` now open the mesh-estimate path instead of the old 3MF "hasn't been sliced" error; exact g-code and sliced-3MF paths are byte-for-byte unchanged; drop zone visibly labels "exact from slicer" vs "estimated from mesh" (D-09 trust distinction).
- `cameraFraming.ts`: pure, three-free camera-framing math (bounding-sphere-in-frustum distance + derived near/far clip planes) plus pane aspect/size derivation from an exact isometric corner-projection of the model's bbox — added mid-plan to fix two human-verify findings (see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 1: meshEstimate.worker.ts (RED)** - `7d9184b` (test)
2. **Task 1: meshEstimate.worker.ts (GREEN)** - `1da380b` (feat)
3. **Task 2: MeshEstimateCard.tsx (RED)** - `2e7bee8` (test)
4. **Task 2: MeshEstimateCard.tsx (GREEN)** - `2c16a9c` (feat)
5. **Task 3: GcodeImport.tsx routing** - `786afb7` (feat)
6. **Task 4 human-verify round-1 fix: camera framing** - `60f10d2` (fix)
7. **Task 4 human-verify round-2 fix: pane aspect/stretch** - `e6ca1ce` (fix)

**Plan metadata:** committed with this SUMMARY.

_TDD tasks (1, 2) each ran RED then GREEN; no separate refactor commit was needed._

## Files Created/Modified
- `src/workers/meshEstimate.worker.ts` - module Worker: dynamic three-addons import, STL/3MF parse, multi-object 3MF summing, calls `computeMeshEstimate`, postMessages estimate + transferable position buffer
- `src/workers/meshEstimate.worker.test.ts` - worker contract + non-blocking-main-thread test (mocked three addon imports)
- `src/components/MeshEstimateCard.tsx` - review card: preview, dims, infill input+persistence, units/non-manifold warnings, weight/cost breakdown, disclaimer, Apply wiring, `<NewBadge feature="stl-estimate" />`
- `src/components/MeshEstimateCard.test.tsx` - disclaimer, infill default+recompute, Apply wiring, no-apply-on-mount
- `src/utils/cameraFraming.ts` - `deriveCameraFraming` (bounding-sphere-in-frustum distance/near/far) + `derivePaneAspect`/`derivePaneSize` (isometric corner-projection based pane sizing)
- `src/utils/cameraFraming.test.ts` - regression coverage: cube/thin-plate/tall-column shapes at multiple FOVs, explicit proof the old maxDim heuristic clips
- `src/components/GcodeImport.tsx` - `.stl` accept + routing, non-sliced-`.3mf` routing (previously an error path), exact-vs-estimated path labeling, `.stl` size cap mirroring `MAX_THREE_MF_BYTES`
- `src/components/calculator/CostFormSection.tsx` - no functional change beyond what `onImport` already handled; touched to keep the Apply pre-fill contract wired
- `vite.config.ts` - confirmed/no material change to the existing 44-02 `three` manualChunks route (worker's dynamic import lands in the same chunk)

## Decisions Made
- Multi-object 3MF: sum volume/area/vertex data across all mesh geometries in the parsed Group and surface the object count (Open Question 2 default from RESEARCH.md).
- Camera framing switched from an axis-aligned `maxDim` heuristic to `distance = radius * margin / sin(fov/2)` against the model's bounding-sphere radius — the only formula that correctly frames every shape at a given FOV, not just cubes.
- Preview pane wrapper needs `self-start` in addition to matching the canvas's own derived aspect ratio, because a flex container's default `align-items: stretch` stretches the wrapper to its taller sibling regardless of the canvas's intrinsic size.

## Deviations from Plan

### Auto-fixed Issues (checkpoint-driven, human-verified)

**1. [Checkpoint round 1 fix] 3D preview clipped the model instead of fully framing it**
- **Found during:** Task 4 human-verify, round 1
- **Issue:** Camera was positioned at `center + maxDim` on each axis — a heuristic with no relationship to the camera's FOV. For a cube, the bounding-sphere radius (~0.87x edge length) is larger than the frustum half-height at that distance (~0.41x edge length at 45deg FOV), so every upload clipped.
- **Fix:** Added `src/utils/cameraFraming.ts` (`deriveCameraFraming`): distance derived from the model's bounding-sphere radius and the camera's FOV (`radius * margin / sin(fov/2)`), with derived near/far clip planes so both 2mm and 300mm models frame and clip correctly.
- **Files modified:** `src/utils/cameraFraming.ts` (new, 16 tests), `src/components/MeshEstimateCard.tsx` (wired the new framing into the preview `useEffect`)
- **Verification:** `cameraFraming.test.ts` covers cube/thin-plate/tall-column shapes at multiple FOVs plus a regression test proving the old maxDim-based distance would have failed; user re-verified visually in round 2/3.
- **Committed in:** `60f10d2`

**2. [Checkpoint round 2 fix] Preview pane was a fixed square, stretched vertically regardless of model proportions**
- **Found during:** Task 4 human-verify, round 2
- **Issue:** Two compounding bugs: (a) CSS — the canvas wrapper is a flex item in a container defaulting to `align-items: stretch`, so the bordered/background box stretched to the height of the taller adjacent info column even though the canvas itself always rendered square; (b) the pane was hardcoded 220x220 regardless of the model's actual bounding-box proportions.
- **Fix:** Added `self-start` to the wrapper (hugs the canvas on both axes, mobile flex-col and desktop flex-row layouts); added `derivePaneAspect`/`derivePaneSize` to `cameraFraming.ts` using an exact isometric corner-projection of the bbox, clamped to [2/3, 2] aspect and [160, 320]px.
- **Files modified:** `src/utils/cameraFraming.ts`, `src/components/MeshEstimateCard.tsx`
- **Verification:** additional `cameraFraming.test.ts` coverage for pane aspect/size derivation; user approved visually in round 3 ("preview pane hugs the render and matches model proportions").
- **Committed in:** `e6ca1ce`

**3. [Rule 2 - Missing critical, folded into round-1 fix] Renderer pixel-ratio cap**
- **Found during:** Task 4 human-verify, round 1
- **Issue:** WebGL renderer had no `setPixelRatio` cap, risking oversized framebuffers on high-DPI displays for large models.
- **Fix:** Added `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` alongside the camera-framing fix.
- **Files modified:** `src/components/MeshEstimateCard.tsx`
- **Committed in:** `60f10d2`

---

**Total deviations:** 3 checkpoint-driven fixes (2 rendering-correctness bugs found via human-verify, 1 missing-critical performance guard folded into the same fix). All were required for the Task 4 acceptance criteria (smooth rotate/zoom, correct framing, proportion-matched pane) and were re-verified by the user before final approval.
**Impact on plan:** No scope creep — all three fixes are corrections to the exact behavior Task 4's `<how-to-verify>` steps required, not new features.

## Issues Encountered
None beyond the two checkpoint-driven rendering fixes documented above, both resolved and user-approved.

## User Setup Required
None - no external service configuration required.

## Verification Evidence

- `npx vitest run src/workers/meshEstimate.worker.test.ts src/components/MeshEstimateCard.test.tsx src/utils/cameraFraming.test.ts` — 3 files, 55 tests, all passed (re-run at close-out, 2026-07-19)
- Full project suite (run earlier in the session): 1387 passed / 4 skipped / 1 todo
- `tsc -b` — clean
- `npm run build` — green, including `assert-no-static-three-import` and `assert-bundle-size` gates (main chunk 100.6 KB gzipped)
- Acceptance-criteria greps re-verified at close-out:
  - `meshEstimate.worker.ts`: 2 dynamic `await import('three...')`, 0 static `from 'three'`
  - `MeshEstimateCard.tsx`: 1x "review before quoting", 1x "stl-estimate-infill", 0 static `from 'three'`
  - `GcodeImport.tsx`: 9x `.stl`, 2x "estimated from mesh"/"exact from slicer"
- Task 4 human-verify checkpoint: **approved by user** (round 3), after two fix rounds documented above — preview hugs the render and matches model proportions, rotate/zoom smooth, inches rescale works, Apply pre-fills grams only on click.

## Next Phase Readiness
- This was the last plan of Wave 2 in Phase 44 (sync-stl-instant-quote). CONN-02 is now fully delivered (worker + review UI + routing + human-verified 3D preview).
- No blockers for Phase 44 closure or Phase 45 (Brand & Launch).

---
*Phase: 44-sync-stl-instant-quote*
*Completed: 2026-07-19*

## Self-Check: PASSED

All key files confirmed on disk (`src/workers/meshEstimate.worker.ts`, `src/workers/meshEstimate.worker.test.ts`, `src/components/MeshEstimateCard.tsx`, `src/components/MeshEstimateCard.test.tsx`, `src/utils/cameraFraming.ts`, `src/utils/cameraFraming.test.ts`, `src/components/GcodeImport.tsx`). All 8 commits confirmed in `git log` (7d9184b, 1da380b, 2e7bee8, 2c16a9c, 786afb7, 60f10d2, e6ca1ce, 9c4155d). Plan-scoped vitest re-run at close-out: 3 files / 55 tests, all passed.
