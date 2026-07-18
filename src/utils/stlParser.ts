// ---------------------------------------------------------------------------
// Pure mesh geometry math for the STL/3MF instant quote (CONN-02).
//
// Deliberately has NO `three` import — it operates on the raw, non-indexed
// Float32Array position buffer that STLLoader.parse()/ThreeMFLoader.parse()
// produce (9 floats per triangle: 3 vertices × {x,y,z}). This keeps the file
// worker-callable (structured-clonable Float32Array in/out) and unit-testable
// without pulling the `three` chunk into any test or non-mesh code path.
//
// Volume: signed-tetrahedron-per-triangle summation (divergence theorem) —
// the standard, exact closed-mesh volume formula used by slicers themselves.
// Requires the mesh's triangle winding to be consistent (all outward, or all
// inward) across the whole surface; STL guarantees consistent winding by
// spec, so a well-formed export always satisfies this.
//
// Non-manifold detection: an edge shared by exactly 2 triangles is manifold;
// any other count (1 = boundary/hole, 3+ = self-intersecting/duplicate
// geometry) is flagged. STLLoader returns a non-indexed geometry (3 duplicate
// vertices per triangle, no shared-index buffer), so raw float equality would
// never find a matching edge — vertices are welded to a small tolerance
// (rounded to ~1e-5) before the edge-adjacency map is built (Pitfall 4).
// ---------------------------------------------------------------------------

const FLOATS_PER_TRIANGLE = 9; // 3 vertices × {x, y, z}
const MM3_TO_CM3 = 1000; // 10mm = 1cm, so mm^3 -> cm^3 divides by 10^3
const MM2_TO_CM2 = 100; // mm^2 -> cm^2 divides by 10^2

/** Default vertex-welding tolerance for the non-manifold edge-adjacency map. */
const DEFAULT_WELD_EPSILON = 1e-5;

export interface BoundingBoxMm {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
}

export interface MeshGeometryResult {
  volumeCm3: number;
  surfaceAreaCm2: number;
  boundingBoxMm: BoundingBoxMm;
  isNonManifold: boolean;
}

/**
 * Signed-tetrahedron-per-triangle volume sum (divergence theorem), returned
 * as an absolute value in cm³. Requires consistent triangle winding across
 * the mesh (guaranteed by the STL spec for a well-formed export).
 */
export function computeSignedVolumeCm3(position: Float32Array): number {
  let volumeMm3 = 0;
  for (let i = 0; i < position.length; i += FLOATS_PER_TRIANGLE) {
    const v1x = position[i], v1y = position[i + 1], v1z = position[i + 2];
    const v2x = position[i + 3], v2y = position[i + 4], v2z = position[i + 5];
    const v3x = position[i + 6], v3y = position[i + 7], v3z = position[i + 8];
    volumeMm3 += (
      v1x * (v2y * v3z - v2z * v3y) -
      v1y * (v2x * v3z - v2z * v3x) +
      v1z * (v2x * v3y - v2y * v3x)
    ) / 6;
  }
  return Math.abs(volumeMm3) / MM3_TO_CM3;
}

/** Sum of ½|cross(v2-v1, v3-v1)| per triangle, returned in cm². */
export function computeSurfaceAreaCm2(position: Float32Array): number {
  let areaMm2 = 0;
  for (let i = 0; i < position.length; i += FLOATS_PER_TRIANGLE) {
    const v1x = position[i], v1y = position[i + 1], v1z = position[i + 2];
    const v2x = position[i + 3], v2y = position[i + 4], v2z = position[i + 5];
    const v3x = position[i + 6], v3y = position[i + 7], v3z = position[i + 8];

    const ux = v2x - v1x, uy = v2y - v1y, uz = v2z - v1z;
    const vx = v3x - v1x, vy = v3y - v1y, vz = v3z - v1z;

    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;

    areaMm2 += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
  }
  return areaMm2 / MM2_TO_CM2;
}

/** Axis-aligned bounding box (min/max/size) of the mesh, in mm. */
export function computeBoundingBoxMm(position: Float32Array): BoundingBoxMm {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < position.length; i += 3) {
    const x = position[i], y = position[i + 1], z = position[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
  };
}

/**
 * Edge-adjacency non-manifold check with vertex welding (Pitfall 4). An edge
 * shared by exactly 2 triangles is manifold; any other count is flagged.
 * Vertices are rounded to `epsilon` before keying so float rounding noise
 * from real slicer/CAD exports does not fracture a genuinely shared vertex
 * into false-distinct ones (which would false-positive every closed mesh).
 */
export function detectNonManifold(position: Float32Array, epsilon: number = DEFAULT_WELD_EPSILON): boolean {
  const key = (x: number, y: number, z: number): string =>
    `${Math.round(x / epsilon)},${Math.round(y / epsilon)},${Math.round(z / epsilon)}`;

  const edgeCounts = new Map<string, number>();
  for (let i = 0; i < position.length; i += FLOATS_PER_TRIANGLE) {
    const verts = [0, 1, 2].map(v => key(
      position[i + v * 3], position[i + v * 3 + 1], position[i + v * 3 + 2]
    ));
    for (let e = 0; e < 3; e++) {
      const a = verts[e];
      const b = verts[(e + 1) % 3];
      const edgeKey = a < b ? `${a}|${b}` : `${b}|${a}`;
      edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) ?? 0) + 1);
    }
  }

  for (const count of edgeCounts.values()) {
    if (count !== 2) return true;
  }
  return false;
}

/** Computes volume, surface area, bounding box, and the non-manifold flag from a single position pass. */
export function computeMeshEstimate(position: Float32Array): MeshGeometryResult {
  return {
    volumeCm3: computeSignedVolumeCm3(position),
    surfaceAreaCm2: computeSurfaceAreaCm2(position),
    boundingBoxMm: computeBoundingBoxMm(position),
    isNonManifold: detectNonManifold(position),
  };
}
