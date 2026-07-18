---
phase: 44-sync-stl-instant-quote
plan: 02
subsystem: geometry-math
tags: [three, stl, 3mf, mesh, volume, weight-model, units-heuristic, vite, ci-gate]

# Dependency graph
requires:
  - phase: 44-sync-stl-instant-quote (plan 01)
    provides: NEW-badge keys (sync-devices, stl-estimate) registered in src/features.ts; syncMerge.ts and backupSchema.ts SyncFile envelope (unrelated to this plan's mesh math but shares the phase's feature registry)
provides:
  - Pure, worker-callable mesh geometry math (volume, surface area, bounding box, non-manifold detection) with no `three` dependency
  - Shells+infill weight model with named slicer-default constants (anti-underestimate guarantee, D-13)
  - mm/inch bounding-box heuristic + immutable x25.4 convert (D-15)
  - `three` npm dependency installed and pinned, routed to a dedicated lazy-loaded Vite chunk
  - assert-no-static-three-import.mjs CI gate cloned from the jsPDF precedent, wired into the build chain
affects: [44-05 (STL/3MF worker + preview UI that consumes stlParser/meshWeightModel/unitsHeuristic and performs the actual three dynamic import)]

# Tech tracking
tech-stack:
  added: [three@0.185.1, "@types/three@0.185.1 (dev)"]
  patterns:
    - "Pure math modules operate only on raw Float32Array/plain-object inputs (no three import) so they stay worker-callable and unit-testable without pulling the three chunk into test runs"
    - "Named-constant slicer-preset citation (Pitfall 5) — no magic numbers inside weight-model math"
    - "vite manualChunks ordering discipline: /src/utils/ branch, then the lazy-dependency branch (pdf, now three), then node_modules fallback — cloned per-dependency"

key-files:
  created:
    - src/utils/stlParser.ts
    - src/utils/stlParser.test.ts
    - src/utils/meshWeightModel.ts
    - src/utils/meshWeightModel.test.ts
    - src/utils/unitsHeuristic.ts
    - src/utils/unitsHeuristic.test.ts
    - src/test/fixtures/stl/README.md
    - scripts/assert-no-static-three-import.mjs
  modified:
    - package.json (three + @types/three dependencies; build script gate chain)
    - package-lock.json
    - vite.config.ts (manualChunks 'three' route)

key-decisions:
  - "stlParser.ts deliberately has no `three` import — it consumes the raw non-indexed Float32Array position buffer that STLLoader.parse() produces, keeping it structured-clonable for the 44-05 worker and testable without the three chunk"
  - "detectNonManifold welds vertices to a 1e-5 default epsilon before building the edge-adjacency map, so real slicer-export float rounding noise does not false-positive a closed mesh as non-manifold (Pitfall 4)"
  - "meshWeightModel's shell (solid) volume approximates top/bottom footprint area as a fixed 1/3 fraction of total surface area (box-equivalent heuristic) since the model's locked input shape (volumeCm3, surfaceAreaCm2, infillPercent, densityGCm3) carries no separate footprint area — documented as an intentional simplification, not a hidden magic number"
  - "Package-legitimacy checkpoint for `three` was approved by the user (typed 'approved') per RESEARCH.md's documented [SUS]-false-positive audit trail (13yr history, official mrdoob/three.js repo, millions of weekly downloads)"

patterns-established:
  - "Pattern: lazy-loaded third-party dependency chunk + assert-no-static-*-import.mjs CI gate, now established twice (jsPDF, three) — future lazy dependencies should clone this exact pair (manualChunks branch ordered before node_modules + a dist-scan static-import regex gate) rather than inventing a new mechanism"

requirements-completed: [CONN-02]

coverage:
  - id: D1
    description: "computeSignedVolumeCm3 of a 10mm unit cube STL returns 1.0 cm3 within tolerance (signed-tetrahedron formula)"
    requirement: "CONN-02"
    verification:
      - kind: unit
        ref: "src/utils/stlParser.test.ts#returns 1.0 cm3 for a 10mm unit cube (volume)"
        status: pass
    human_judgment: false
  - id: D2
    description: "detectNonManifold flags a deliberately broken (open-edge) mesh and does NOT flag known-good watertight fixtures, including one with float-rounding noise (vertex welding, Pitfall 4)"
    requirement: "CONN-02"
    verification:
      - kind: unit
        ref: "src/utils/stlParser.test.ts#returns true for a cube with one triangle removed — open edge (manifold)"
        status: pass
      - kind: unit
        ref: "src/utils/stlParser.test.ts#does not false-positive on a real-slicer-style export with float rounding noise (manifold)"
        status: pass
    human_judgment: false
  - id: D3
    description: "estimateWeightGrams (shells+infill) returns a strictly higher weight than pure volume x infill x density for the same mesh (D-13 anti-underestimate)"
    requirement: "CONN-02"
    verification:
      - kind: unit
        ref: "src/utils/meshWeightModel.test.ts#returns a total strictly greater than pure volume x infill x density (D-13 anti-underestimate)"
        status: pass
    human_judgment: false
  - id: D4
    description: "detectUnitsWarning flags a bounding box implausible for mm (every axis < 5mm or every axis > 500mm) and the x25.4 convert corrects it (D-15)"
    requirement: "CONN-02"
    verification:
      - kind: unit
        ref: "src/utils/unitsHeuristic.test.ts#corrects a units-warning-triggering size into a plausible mm size after conversion (D-15)"
        status: pass
    human_judgment: false
  - id: D5
    description: "three is never statically imported outside its dynamic-import boundary — assert-no-static-three-import.mjs fails the build if a non-three chunk statically references the three chunk"
    requirement: "CONN-02"
    verification:
      - kind: other
        ref: "npm run build (dist scan via node scripts/assert-no-static-three-import.mjs — exits 0, prints '✓ three chunk: no static import from any non-three chunk in dist/assets/')"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min (continuation session; original session crashed mid-Task-1 on an API auth error after the Task 0 checkpoint was approved and npm install had already run)
completed: 2026-07-18
status: complete
---

# Phase 44 Plan 2: STL Instant Quote Geometry Math + Three.js Lazy-Load Discipline Summary

**Signed-tetrahedron STL volume/area/non-manifold math, a shells+infill weight model with named slicer-default constants, an mm/inch bounding-box heuristic, and `three` wired into its own CI-gated lazy chunk — all pure and worker-callable ahead of the 44-05 worker/UI.**

## Performance

- **Duration:** ~35 min (this continuation session; a prior session crashed mid-Task-1 after the Task 0 package-legitimacy checkpoint was approved)
- **Completed:** 2026-07-18T14:25Z
- **Tasks:** 4 (Task 0 checkpoint + Tasks 1-3), all complete
- **Files modified:** 10

## Accomplishments
- `src/utils/stlParser.ts` — pure, worker-callable geometry math (volume, surface area, bounding box, non-manifold detection) with vertex welding to avoid float-rounding false positives; zero `three` import
- `src/utils/meshWeightModel.ts` — shells+infill weight model that strictly exceeds pure volume×infill×density (D-13), with named Bambu/Prusa "Standard"-preset constants and a PLA density fallback
- `src/utils/unitsHeuristic.ts` — every-axis mm/inch plausibility guard + immutable ×25.4 convert (D-15)
- `three@0.185.1` + `@types/three` installed (package-legitimacy checkpoint approved by user) and routed to a dedicated lazy-loaded Vite chunk
- `scripts/assert-no-static-three-import.mjs` cloned from the jsPDF precedent, wired into the build chain as the final gate — build verified green with the main chunk at 98.3 KB gzipped (well under the 300 KB PERF-01 budget)

## Task Commits

Each task was committed atomically:

1. **Task 0: Package-legitimacy checkpoint** — approved by user prior to this session (see Recovery Notes below); no code commit for this task itself.
2. **Task 1: Install three + stlParser.ts geometry math** — RED: `3ad9026` (test, prior session) · install: `fb86f5b` (chore) · GREEN: `4deaff9` (feat)
3. **Task 2: meshWeightModel.ts + unitsHeuristic.ts** — RED: `16c02a4` (test) · GREEN: `955b74e` (feat)
4. **Task 3: three bundle chunk + CI gate** — `d1d4bb0` (feat)

**Plan metadata:** _pending — this commit_

_Note: TDD tasks have separate RED (test) and GREEN (feat) commits per the TDD execution protocol._

## Files Created/Modified
- `src/utils/stlParser.ts` - Signed-tetrahedron volume, surface area, bounding box, edge-adjacency non-manifold detection with vertex welding
- `src/utils/stlParser.test.ts` - 8 tests covering volume/area/bbox/manifold on synthetic cube fixtures (watertight, open, jittered)
- `src/test/fixtures/stl/README.md` - Fixture provenance and known-value documentation (programmatic fixtures, not committed binaries)
- `src/utils/meshWeightModel.ts` - `estimateWeightGrams`, `WALL_COUNT`/`TOP_BOTTOM_LAYERS`/`LINE_WIDTH_MM`/`LAYER_HEIGHT_MM` named constants
- `src/utils/meshWeightModel.test.ts` - 6 tests: anti-underestimate guarantee, breakdown sum, clamp behavior, PLA fallback, named constants
- `src/utils/unitsHeuristic.ts` - `detectUnitsWarning`, `convertInchesToMm`, `MM_MIN_PLAUSIBLE`/`MM_MAX_PLAUSIBLE`/`INCH_TO_MM`
- `src/utils/unitsHeuristic.test.ts` - 7 tests: small/large/normal/mixed-axis cases, immutable convert, round-trip correction, named constants
- `scripts/assert-no-static-three-import.mjs` - CI gate scanning `dist/assets/` for static references to the three chunk
- `vite.config.ts` - `manualChunks` branch routing `three`/`three-stdlib` to a dedicated chunk, ordered before the `node_modules` fallback
- `package.json` - `three` (runtime) + `@types/three` (dev) dependencies; build script appends the new CI gate
- `package-lock.json` - lockfile update for the new dependencies

## Decisions Made
- `stlParser.ts` has no `three` import by design — operates on the raw `Float32Array` position buffer, keeping it structured-clonable for the 44-05 Web Worker and fully unit-testable without pulling the `three` chunk into any test run.
- `detectNonManifold` welds vertices to a 1e-5 default tolerance before building the edge-adjacency map (Pitfall 4) — verified against a synthetic fixture with deterministic float jitter well under that tolerance.
- `meshWeightModel`'s shell (solid) volume approximates the top/bottom footprint contribution as a fixed 1/3 fraction of total surface area (a box-equivalent heuristic), since the locked `WeightModelInput` shape (`volumeCm3`, `surfaceAreaCm2`, `infillPercent`, `densityGCm3`) carries no separate footprint area. Documented inline as an intentional simplification rather than a hidden magic number; a future footprint-aware refinement is possible but out of scope here. The anti-underestimate guarantee (D-13) holds regardless of the exact fraction chosen, since any positive shell volume strictly increases the total above pure infill.
- Package-legitimacy checkpoint for `three` was resolved in a prior session: user reviewed the RESEARCH.md audit (13yr history, official `mrdoob/three.js` repo, millions of weekly downloads, [SUS] flag documented as a cadence false-positive) and typed "approved". This session did not re-ask; it reconciled the already-installed-but-uncommitted `package.json`/`package-lock.json` state into a proper `chore` commit recording the approval rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Recovery reconciliation — not a deviation rule, documented for traceability] Completed a crashed prior session's Task 1**
- **Found during:** Session start (orchestrator-provided recovery state)
- **Issue:** A prior executor crashed mid-Task-1 after an API auth error. `npm install three`/`@types/three` had already run (present in `node_modules`, `package.json`/`package-lock.json` uncommitted) and `src/utils/stlParser.ts` had been written but never verified against the RED test commit (`3ad9026`) or committed.
- **Fix:** Ran `npx vitest run src/utils/stlParser.test.ts` — all 8 tests passed against the existing implementation with no changes needed. Committed the package install (`fb86f5b`, chore) separately from the GREEN implementation (`4deaff9`, feat) to preserve clean atomic history.
- **Files modified:** package.json, package-lock.json, src/utils/stlParser.ts
- **Verification:** `npx vitest run src/utils/stlParser.test.ts` — 8/8 passing
- **Committed in:** `fb86f5b`, `4deaff9`

---

**Total deviations:** 0 auto-fixed under Rules 1-4 (no bugs, missing functionality, blockers, or architectural changes encountered). 1 recovery reconciliation documented above for audit traceability.
**Impact on plan:** None — plan executed exactly as written across all three tasks; the recovery step was purely continuity work, not a deviation from the plan's design.

## Issues Encountered
- Prior session crash (API auth error) left `stlParser.ts` implemented-but-uncommitted. On inspection the implementation exactly matched the plan's `<behavior>` spec and passed all RED-phase tests unchanged — no rewrite was necessary, only verification + commit.

## User Setup Required
None - no external service configuration required. The `three` package-legitimacy checkpoint required human approval, which was already obtained in the prior session (documented above).

## Next Phase Readiness
- `stlParser.ts`, `meshWeightModel.ts`, and `unitsHeuristic.ts` are pure, worker-callable, and fully tested — ready for 44-05 to wire them into a Web Worker + preview UI.
- The `three` dependency is installed, pinned, and CI-gated to its lazy chunk; 44-05's worker/preview is free to add the actual dynamic `import('three')` + `STLLoader`/`ThreeMFLoader` addon usage without re-litigating the bundle-size discipline — the `assert-no-static-three-import.mjs` gate will catch any accidental regression.
- No blockers for 44-05.

---
*Phase: 44-sync-stl-instant-quote*
*Completed: 2026-07-18*

## Self-Check: PASSED

All 9 claimed files found on disk; all 6 claimed commit hashes found in git log.
