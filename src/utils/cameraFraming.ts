// ---------------------------------------------------------------------------
// Pure camera-framing math for the MeshEstimateCard 3D preview (Phase 44-05).
//
// Deliberately has NO `three` import so it stays testable without pulling in
// the lazy `three` chunk (assert-no-static-three-import.mjs) and without a
// WebGL/jsdom canvas context. The preview's useEffect calls this with plain
// {x,y,z} objects derived from THREE.Box3, then applies the returned
// position/target/near/far back onto the real THREE.PerspectiveCamera.
//
// Bug fixed here (Task 4 human-verify round 1 — reported "3D Preview gets
// cutoff, dimensions of the display area do not match the model"): the
// previous camera placement positioned the camera at `center + maxDim` along
// each axis — a naive heuristic with no relationship to the camera's FOV.
// For a cube, the bounding-sphere radius (~0.87 * maxDim) is LARGER than the
// frustum half-height at that distance (~0.41 * maxDim at 45deg FOV), so the
// model was clipped by the preview viewport on every upload. This module
// derives the camera distance from the bounding-sphere radius and the
// camera's vertical FOV using the standard "fit sphere in frustum" formula:
//   distance = radius * margin / sin(fov / 2)
// with a margin so the model never touches the edges. It also derives near/
// far clip planes from that same distance/radius so a 2mm model and a 300mm
// model both frame and clip correctly without hardcoded constants.
// ---------------------------------------------------------------------------

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraFraming {
  position: Vec3;
  target: Vec3;
  near: number;
  far: number;
}

/** 20% breathing room so the model doesn't touch the viewport edges. */
export const FRAMING_MARGIN = 1.2;

/** Isometric-ish viewing direction (matches the original camera angle). */
const VIEW_DIRECTION: Vec3 = { x: 1, y: 1, z: 1 };

function normalize(v: Vec3): Vec3 {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/**
 * Bounding-sphere radius of an axis-aligned box, given its full size (x/y/z
 * extents). This is always >= half of the box's largest single dimension —
 * using "largest dimension / 2" as a stand-in radius (the previous bug)
 * under-fits any box that isn't a perfect 1D line, e.g. a cube's true
 * radius is ~0.87x its edge length, not 0.5x.
 */
export function boundingSphereRadius(size: Vec3): number {
  return Math.sqrt((size.x / 2) ** 2 + (size.y / 2) ** 2 + (size.z / 2) ** 2);
}

/**
 * Distance from a bounding sphere's center the camera must sit at so the
 * whole sphere fits inside the vertical FOV, plus `margin` breathing room.
 * Standard "fit sphere in frustum" formula: radius * margin / sin(fov / 2).
 */
export function computeFramingDistance(
  radius: number,
  verticalFovDegrees: number,
  margin: number = FRAMING_MARGIN
): number {
  const safeRadius = radius > 0 ? radius : 1;
  const fovRadians = (verticalFovDegrees * Math.PI) / 180;
  return (safeRadius * margin) / Math.sin(fovRadians / 2);
}

/**
 * Computes the camera position (offset from center along an isometric
 * direction), the look-at target (the box center), and near/far clip planes
 * that bracket the model regardless of its scale — 2mm and 300mm models both
 * frame and clip correctly since near/far derive from distance/radius rather
 * than fixed constants.
 *
 * Assumes a square (aspect = 1) viewport, so the vertical FOV also bounds
 * the horizontal extent — true for MeshEstimateCard's fixed square preview.
 */
export function computeCameraFraming(
  center: Vec3,
  size: Vec3,
  verticalFovDegrees: number,
  margin: number = FRAMING_MARGIN
): CameraFraming {
  const radius = boundingSphereRadius(size);
  const distance = computeFramingDistance(radius, verticalFovDegrees, margin);
  const direction = normalize(VIEW_DIRECTION);

  return {
    position: {
      x: center.x + direction.x * distance,
      y: center.y + direction.y * distance,
      z: center.z + direction.z * distance,
    },
    target: { ...center },
    near: Math.max(distance - radius * 2, distance * 0.01),
    far: distance + radius * 10,
  };
}
