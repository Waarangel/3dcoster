import { describe, it, expect } from 'vitest';
import {
  computeSignedVolumeCm3,
  computeSurfaceAreaCm2,
  computeBoundingBoxMm,
  detectNonManifold,
  computeMeshEstimate,
} from './stlParser';

// ---------------------------------------------------------------------------
// Fixture builders — see src/test/fixtures/stl/README.md for provenance and
// known-value documentation. All three build a non-indexed Float32Array
// position buffer in the exact shape STLLoader.parse() returns (9 floats
// per triangle), which is what stlParser.ts's pure functions consume.
// ---------------------------------------------------------------------------

/** The 12-triangle cube face list, verified by hand for consistent outward winding (see README). */
const CUBE_TRIANGLES: Array<[string, string, string]> = [
  ['E', 'F', 'G'], ['E', 'G', 'H'],
  ['B', 'A', 'D'], ['B', 'D', 'C'],
  ['B', 'C', 'G'], ['B', 'G', 'F'],
  ['A', 'E', 'H'], ['A', 'H', 'D'],
  ['D', 'H', 'G'], ['D', 'G', 'C'],
  ['A', 'B', 'F'], ['A', 'F', 'E'],
];

const CUBE_VERTICES: Record<string, [number, number, number]> = {
  A: [0, 0, 0], B: [1, 0, 0], C: [1, 1, 0], D: [0, 1, 0],
  E: [0, 0, 1], F: [1, 0, 1], G: [1, 1, 1], H: [0, 1, 1],
};

/** Tiny deterministic pseudo-random jitter, well under the default 1e-5 weld epsilon. */
function jitter(seed: number): number {
  const frac = Math.sin(seed * 12.9898) * 43758.5453;
  return (frac - Math.floor(frac) - 0.5) * 2e-6;
}

function buildCubePositions(size: number, triangles: Array<[string, string, string]>, withJitter: boolean): Float32Array {
  const floats: number[] = [];
  let vertexIndex = 0;
  for (const tri of triangles) {
    for (const label of tri) {
      const [x, y, z] = CUBE_VERTICES[label];
      const jx = withJitter ? jitter(vertexIndex * 3) : 0;
      const jy = withJitter ? jitter(vertexIndex * 3 + 1) : 0;
      const jz = withJitter ? jitter(vertexIndex * 3 + 2) : 0;
      floats.push(x * size + jx, y * size + jy, z * size + jz);
      vertexIndex++;
    }
  }
  return new Float32Array(floats);
}

/** Fixture 1: watertight 10mm unit cube. */
function buildWatertightCube(size = 10): Float32Array {
  return buildCubePositions(size, CUBE_TRIANGLES, false);
}

/** Fixture 2: same cube with one triangle removed (deliberately non-manifold — open edge). */
function buildOpenCube(size = 10): Float32Array {
  return buildCubePositions(size, CUBE_TRIANGLES.slice(0, -1), false);
}

/** Fixture 3: same watertight cube with float-rounding-noise jitter (simulates a real slicer export). */
function buildNoisyCube(size = 10): Float32Array {
  return buildCubePositions(size, CUBE_TRIANGLES, true);
}

describe('stlParser', () => {
  describe('computeSignedVolumeCm3 (volume)', () => {
    it('returns 1.0 cm3 for a 10mm unit cube (volume)', () => {
      const position = buildWatertightCube(10);
      expect(computeSignedVolumeCm3(position)).toBeCloseTo(1.0, 3);
    });

    it('is unaffected by float rounding noise within weld tolerance (volume)', () => {
      const position = buildNoisyCube(10);
      expect(computeSignedVolumeCm3(position)).toBeCloseTo(1.0, 3);
    });
  });

  describe('computeSurfaceAreaCm2', () => {
    it('returns 6.0 cm2 for a 10mm unit cube', () => {
      const position = buildWatertightCube(10);
      expect(computeSurfaceAreaCm2(position)).toBeCloseTo(6.0, 3);
    });
  });

  describe('computeBoundingBoxMm', () => {
    it('returns size {x:10,y:10,z:10} for a 10mm unit cube', () => {
      const position = buildWatertightCube(10);
      const bbox = computeBoundingBoxMm(position);
      expect(bbox.min).toEqual({ x: 0, y: 0, z: 0 });
      expect(bbox.max).toEqual({ x: 10, y: 10, z: 10 });
      expect(bbox.size).toEqual({ x: 10, y: 10, z: 10 });
    });
  });

  describe('detectNonManifold (manifold)', () => {
    it('returns false for a closed watertight cube (manifold)', () => {
      const position = buildWatertightCube(10);
      expect(detectNonManifold(position)).toBe(false);
    });

    it('returns true for a cube with one triangle removed — open edge (manifold)', () => {
      const position = buildOpenCube(10);
      expect(detectNonManifold(position)).toBe(true);
    });

    it('does not false-positive on a real-slicer-style export with float rounding noise (manifold)', () => {
      const position = buildNoisyCube(10);
      expect(detectNonManifold(position)).toBe(false);
    });
  });

  describe('computeMeshEstimate', () => {
    it('returns volume, surface area, bounding box, and non-manifold flag in one pass', () => {
      const position = buildWatertightCube(10);
      const result = computeMeshEstimate(position);
      expect(result.volumeCm3).toBeCloseTo(1.0, 3);
      expect(result.surfaceAreaCm2).toBeCloseTo(6.0, 3);
      expect(result.boundingBoxMm.size).toEqual({ x: 10, y: 10, z: 10 });
      expect(result.isNonManifold).toBe(false);
    });
  });
});
