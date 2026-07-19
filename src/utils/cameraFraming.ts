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
//
// Round 2 (Task 4 human-verify — reported "Viewing pane still doesn't
// conform to model dimensions for viewing... it's actually not a square,
// it's vertical. match model proportions plus padding"): two problems.
//
// 1. A CSS bug (fixed in MeshEstimateCard.tsx, not here): the preview's flex
//    wrapper stretched to the height of its taller sibling column because
//    the parent flex container never opted out of the default
//    `align-items: stretch`. The canvas itself always rendered square — the
//    bordered/background box around it was the part reported as "vertical".
// 2. A real feature gap: the preview pane was hardcoded to a fixed square
//    (220x220) regardless of the model's actual proportions. `derivePaneAspect`
//    below computes the model's on-screen aspect ratio (as seen from the same
//    isometric direction the camera sits at) via exact corner projection —
//    not an approximation — and `derivePaneSize` turns that into a clamped
//    pane width/height. Because the pane is no longer guaranteed square,
//    `computeFramingDistance`/`computeCameraFraming` gained an `aspect`
//    parameter: for a portrait pane (aspect < 1) the HORIZONTAL FOV is
//    narrower than the vertical FOV and becomes the binding constraint, so
//    the effective FOV used for the fit is min(vFov, hFov) — see
//    `computeEffectiveFovDegrees`.
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

/** World "up" used to build the camera's screen-space right/up basis for projection. */
const WORLD_UP: Vec3 = { x: 0, y: 1, z: 0 };

/** Pane aspect (width/height) bounds — keeps extreme plates/columns from producing an absurd pane. */
export const MIN_PANE_ASPECT = 2 / 3;
export const MAX_PANE_ASPECT = 2;

/** Same on-screen footprint (width * height) as the original fixed 220x220 preview. */
export const PANE_BASE_AREA_PX2 = 220 * 220;

/** Pane size bounds in CSS px — keeps the preview usable inside the card at any model proportion. */
export const MIN_PANE_PX = 160;
export const MAX_PANE_PX = 320;

function normalize(v: Vec3): Vec3 {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
 * Vertical FOV `verticalFovDegrees` implies a horizontal FOV of
 * `2 * atan(tan(vFov/2) * aspect)` for a perspective camera with the given
 * `aspect` (width/height). For a square viewport (aspect = 1) the two are
 * identical. For a portrait pane (aspect < 1) the horizontal FOV is
 * NARROWER than the vertical FOV, so it becomes the binding constraint for
 * fitting a sphere in the frustum — using the smaller of the two guarantees
 * the sphere fits on both axes (a narrower FOV always requires >= the
 * distance a wider FOV would).
 */
export function computeEffectiveFovDegrees(verticalFovDegrees: number, aspect: number): number {
  const vFovRadians = (verticalFovDegrees * Math.PI) / 180;
  const hFovRadians = 2 * Math.atan(Math.tan(vFovRadians / 2) * aspect);
  const hFovDegrees = (hFovRadians * 180) / Math.PI;
  return Math.min(verticalFovDegrees, hFovDegrees);
}

/**
 * Distance from a bounding sphere's center the camera must sit at so the
 * whole sphere fits inside the vertical FOV (or, for a non-square `aspect`,
 * the more restrictive of the vertical/horizontal FOV — see
 * `computeEffectiveFovDegrees`), plus `margin` breathing room. Standard "fit
 * sphere in frustum" formula: radius * margin / sin(fov / 2).
 */
export function computeFramingDistance(
  radius: number,
  verticalFovDegrees: number,
  margin: number = FRAMING_MARGIN,
  aspect: number = 1
): number {
  const safeRadius = radius > 0 ? radius : 1;
  const effectiveFovDegrees = computeEffectiveFovDegrees(verticalFovDegrees, aspect);
  const fovRadians = (effectiveFovDegrees * Math.PI) / 180;
  return (safeRadius * margin) / Math.sin(fovRadians / 2);
}

/**
 * Computes the camera position (offset from center along an isometric
 * direction), the look-at target (the box center), and near/far clip planes
 * that bracket the model regardless of its scale — 2mm and 300mm models both
 * frame and clip correctly since near/far derive from distance/radius rather
 * than fixed constants.
 *
 * `aspect` (width/height, default 1 = square) accounts for a non-square
 * preview pane — see `computeEffectiveFovDegrees`.
 */
export function computeCameraFraming(
  center: Vec3,
  size: Vec3,
  verticalFovDegrees: number,
  margin: number = FRAMING_MARGIN,
  aspect: number = 1
): CameraFraming {
  const radius = boundingSphereRadius(size);
  const distance = computeFramingDistance(radius, verticalFovDegrees, margin, aspect);
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

/**
 * The on-screen (width, height) extent of an axis-aligned box's 8 corners,
 * projected onto the screen-space right/up axes of a camera looking at the
 * box from `viewDirection` with the given `worldUp`. This is an EXACT
 * projection (not an approximation) — it reuses the same isometric
 * direction the camera is actually placed along, so the resulting aspect
 * ratio matches what the camera will really show.
 *
 * Degenerate case: if `viewDirection` is parallel to `worldUp` (looking
 * straight down/up), `cross(worldUp, viewDirection)` is the zero vector —
 * falls back to world +X as the screen-right axis.
 */
export function computeProjectedExtent(
  size: Vec3,
  viewDirection: Vec3 = VIEW_DIRECTION,
  worldUp: Vec3 = WORLD_UP
): { width: number; height: number } {
  const zAxis = normalize(viewDirection);
  const rawXAxis = cross(worldUp, zAxis);
  const rawXAxisLength = Math.sqrt(rawXAxis.x ** 2 + rawXAxis.y ** 2 + rawXAxis.z ** 2);
  const xAxis = rawXAxisLength > 1e-9 ? normalize(rawXAxis) : { x: 1, y: 0, z: 0 };
  const yAxis = cross(zAxis, xAxis);

  const half: Vec3 = { x: size.x / 2, y: size.y / 2, z: size.z / 2 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner: Vec3 = { x: sx * half.x, y: sy * half.y, z: sz * half.z };
        const px = dot(corner, xAxis);
        const py = dot(corner, yAxis);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
  }

  return { width: maxX - minX, height: maxY - minY };
}

/**
 * The preview pane's aspect ratio (width/height), derived from the model's
 * actual on-screen proportions at the fixed isometric viewing angle — a
 * wide/flat model gets a wide pane, a tall model gets a tall (portrait)
 * pane — clamped to [MIN_PANE_ASPECT, MAX_PANE_ASPECT] so extreme plates or
 * columns don't produce an absurd pane shape.
 */
export function derivePaneAspect(size: Vec3, viewDirection: Vec3 = VIEW_DIRECTION): number {
  const { width, height } = computeProjectedExtent(size, viewDirection);
  const safeHeight = height > 1e-9 ? height : 1e-9;
  return clamp(width / safeHeight, MIN_PANE_ASPECT, MAX_PANE_ASPECT);
}

/**
 * Turns a clamped pane aspect ratio into a concrete (width, height) in CSS
 * px, preserving the same on-screen footprint (PANE_BASE_AREA_PX2) as the
 * original fixed 220x220 square preview, then clamps both dimensions to
 * [MIN_PANE_PX, MAX_PANE_PX] — scaling both together so the aspect ratio
 * (and therefore the camera framing derived from it) is never distorted by
 * the clamp itself.
 */
export function derivePaneSize(aspect: number): { width: number; height: number } {
  const clampedAspect = clamp(aspect, MIN_PANE_ASPECT, MAX_PANE_ASPECT);
  let width = Math.sqrt(PANE_BASE_AREA_PX2 * clampedAspect);
  let height = Math.sqrt(PANE_BASE_AREA_PX2 / clampedAspect);

  if (width > MAX_PANE_PX || height > MAX_PANE_PX) {
    const scale = Math.min(MAX_PANE_PX / width, MAX_PANE_PX / height);
    width *= scale;
    height *= scale;
  }
  if (width < MIN_PANE_PX || height < MIN_PANE_PX) {
    const scale = Math.max(MIN_PANE_PX / width, MIN_PANE_PX / height);
    width *= scale;
    height *= scale;
  }

  return { width: Math.round(width), height: Math.round(height) };
}
