# STL test fixtures (Phase 44-02)

`stlParser.test.ts` needs three mesh shapes to exercise the volume/area/
bounding-box/non-manifold math (D-13/D-15/D-16). Rather than committing
binary `.stl` blobs to the repo, all three are **generated programmatically**
at test time by a small builder inlined in `stlParser.test.ts`
(`buildCubePositions` / `buildOpenCubePositions` / `buildNoisyCubePositions`).
This keeps the fixtures readable in the diff, avoids binary-blob review
friction, and matches the plan's documented discretion ("Generate the
synthetic fixtures programmatically in the test setup if committing binaries
is undesirable").

The builder produces a raw `Float32Array` position buffer in the exact shape
`STLLoader.parse()` returns (non-indexed, 9 floats per triangle — 3 vertices
× {x,y,z}), which is what `stlParser.ts`'s pure functions consume directly.
No `.stl` binary encode/decode round-trip is exercised here; that belongs to
`STLLoader` itself (a third-party, already-tested dependency) and to the
worker integration added in plan 44-05, not to this pure-math unit suite.

## Fixture 1 — unit cube (watertight)

A 10mm × 10mm × 10mm axis-aligned cube, 12 triangles, consistent outward
winding (verified by hand: every face's `(v2-v1)×(v3-v1)` cross product
points away from the cube center — see the builder comments).

- **Known volume:** 10 × 10 × 10 = 1000 mm³ = **1.0 cm³**
- **Known surface area:** 6 faces × 100 mm² = 600 mm² = **6.0 cm²**
- **Known bounding box size:** `{x: 10, y: 10, z: 10}`
- **Manifold:** every edge is shared by exactly 2 triangles → `detectNonManifold` must return `false`.

## Fixture 2 — open cube (deliberately non-manifold)

The same 12-triangle cube with one triangle removed. This leaves 3 edges
with only 1 adjacent triangle each (a boundary hole) instead of 2.

- **Manifold:** `detectNonManifold` must return `true`.

## Fixture 3 — "real slicer export" cube (float rounding noise)

The same watertight 12-triangle cube, but every vertex occurrence gets a
tiny deterministic jitter (~1e-6, well under the default 1e-5 weld
tolerance) applied to its coordinates — simulating the float32 rounding
noise a real CAD/slicer STL export introduces when the "same" conceptual
vertex is written out multiple times (once per adjacent triangle, since STL
has no shared-vertex/index concept). This is a synthetic stand-in for a real
slicer-exported file, not a literal downloaded sample — documented here so
a future audit doesn't mistake it for real third-party provenance.

- **Manifold:** still a fully closed cube conceptually. `detectNonManifold`
  must return `false` (welding at the default epsilon must absorb the noise
  and NOT false-positive per Pitfall 4).
