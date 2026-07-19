import { describe, it, expect } from 'vitest';
import {
  boundingSphereRadius,
  computeFramingDistance,
  computeCameraFraming,
  computeEffectiveFovDegrees,
  computeProjectedExtent,
  derivePaneAspect,
  derivePaneSize,
  FRAMING_MARGIN,
  MIN_PANE_ASPECT,
  MAX_PANE_ASPECT,
  MIN_PANE_PX,
  MAX_PANE_PX,
} from './cameraFraming';

const FOV_DEGREES = 45;

/** The regression check: at the computed distance, does the frustum's half-height
 *  at that distance fully contain the bounding sphere? If not, the model clips. */
function fitsInFrustum(radius: number, distance: number, fovDegrees: number): boolean {
  const halfHeightAtDistance = distance * Math.tan((fovDegrees * Math.PI) / 180 / 2);
  return halfHeightAtDistance >= radius;
}

describe('boundingSphereRadius', () => {
  it('returns half the space diagonal for a cube (not half the edge length)', () => {
    const radius = boundingSphereRadius({ x: 40, y: 40, z: 40 });
    // Previous bug used maxDim/2 = 20 as a stand-in radius — the real
    // bounding-sphere radius of a 40mm cube is 20*sqrt(3) ≈ 34.64.
    expect(radius).toBeCloseTo(20 * Math.sqrt(3), 5);
    expect(radius).toBeGreaterThan(20);
  });

  it('returns half the largest dimension for a degenerate flat/line shape', () => {
    const radius = boundingSphereRadius({ x: 10, y: 0, z: 0 });
    expect(radius).toBeCloseTo(5, 5);
  });
});

describe('computeFramingDistance', () => {
  it('increases with radius', () => {
    const small = computeFramingDistance(10, FOV_DEGREES);
    const large = computeFramingDistance(100, FOV_DEGREES);
    expect(large).toBeGreaterThan(small);
  });

  it('increases with margin', () => {
    const tight = computeFramingDistance(50, FOV_DEGREES, 1.0);
    const loose = computeFramingDistance(50, FOV_DEGREES, 1.5);
    expect(loose).toBeGreaterThan(tight);
  });

  it('increases as FOV narrows (a narrower lens needs more distance to fit the same object)', () => {
    const wideFov = computeFramingDistance(50, 90);
    const narrowFov = computeFramingDistance(50, 20);
    expect(narrowFov).toBeGreaterThan(wideFov);
  });

  it('falls back to a safe non-zero distance for a zero-size (degenerate) radius', () => {
    expect(computeFramingDistance(0, FOV_DEGREES)).toBeGreaterThan(0);
  });
});

describe('computeCameraFraming', () => {
  it('places the camera along the isometric (1,1,1) direction offset from center', () => {
    const center = { x: 0, y: 0, z: 0 };
    const framing = computeCameraFraming(center, { x: 40, y: 40, z: 40 }, FOV_DEGREES);
    // Equal offset on all three axes confirms the (1,1,1) direction.
    expect(framing.position.x).toBeCloseTo(framing.position.y, 5);
    expect(framing.position.y).toBeCloseTo(framing.position.z, 5);
    expect(framing.position.x).toBeGreaterThan(0);
  });

  it('targets the box center (not the origin)', () => {
    const center = { x: 12, y: -3, z: 7 };
    const framing = computeCameraFraming(center, { x: 10, y: 10, z: 10 }, FOV_DEGREES);
    expect(framing.target).toEqual(center);
  });

  it('offsets from an off-origin center by the same distance as from the origin', () => {
    const atOrigin = computeCameraFraming({ x: 0, y: 0, z: 0 }, { x: 40, y: 40, z: 40 }, FOV_DEGREES);
    const offCenter = computeCameraFraming({ x: 100, y: 50, z: -20 }, { x: 40, y: 40, z: 40 }, FOV_DEGREES);
    const originDistance = Math.sqrt(
      atOrigin.position.x ** 2 + atOrigin.position.y ** 2 + atOrigin.position.z ** 2
    );
    const offCenterOffset = {
      x: offCenter.position.x - 100,
      y: offCenter.position.y - 50,
      z: offCenter.position.z - -20,
    };
    const offCenterDistance = Math.sqrt(
      offCenterOffset.x ** 2 + offCenterOffset.y ** 2 + offCenterOffset.z ** 2
    );
    expect(offCenterDistance).toBeCloseTo(originDistance, 5);
  });

  it('brackets near/far around the computed distance', () => {
    const framing = computeCameraFraming({ x: 0, y: 0, z: 0 }, { x: 40, y: 40, z: 40 }, FOV_DEGREES);
    const distance = Math.sqrt(
      framing.position.x ** 2 + framing.position.y ** 2 + framing.position.z ** 2
    );
    expect(framing.near).toBeGreaterThan(0);
    expect(framing.near).toBeLessThan(distance);
    expect(framing.far).toBeGreaterThan(distance);
  });

  // The regression test that would have caught the reported bug: for a range
  // of model sizes (2mm to 300mm, cube and non-cube), the computed distance
  // must always fully contain the bounding sphere within the frustum.
  it.each([
    { name: '2mm cube', size: { x: 2, y: 2, z: 2 } },
    { name: '40mm cube', size: { x: 40, y: 40, z: 40 } },
    { name: '300mm cube', size: { x: 300, y: 300, z: 300 } },
    { name: 'thin 300x300x1mm plate', size: { x: 300, y: 300, z: 1 } },
    { name: 'tall 20x20x150mm column', size: { x: 20, y: 20, z: 150 } },
  ])('fully frames a $name with no clipping, at every FOV', ({ size }) => {
    for (const fov of [30, 45, 60, 75]) {
      const radius = boundingSphereRadius(size);
      const distance = computeFramingDistance(radius, fov);
      expect(fitsInFrustum(radius, distance, fov)).toBe(true);
    }
  });

  it('demonstrates the previous bug would have failed the fits-in-frustum check for a cube', () => {
    // Previous (buggy) camera placement: distance = maxDim * sqrt(3) (camera
    // offset by maxDim on each of 3 axes), using maxDim as a stand-in radius.
    const size = { x: 40, y: 40, z: 40 };
    const maxDim = 40;
    const buggyDistance = maxDim * Math.sqrt(3);
    const realRadius = boundingSphereRadius(size);
    expect(fitsInFrustum(realRadius, buggyDistance, FOV_DEGREES)).toBe(false);

    // The fixed formula fits.
    const fixedDistance = computeFramingDistance(realRadius, FOV_DEGREES, FRAMING_MARGIN);
    expect(fitsInFrustum(realRadius, fixedDistance, FOV_DEGREES)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Round 2 (Task 4 human-verify): pane aspect derived from model proportions,
// and the two-axis frustum fit needed once the pane is no longer square.
// ---------------------------------------------------------------------------

describe('computeEffectiveFovDegrees', () => {
  it('equals the vertical FOV for a square viewport (aspect = 1)', () => {
    expect(computeEffectiveFovDegrees(45, 1)).toBeCloseTo(45, 10);
  });

  it('equals the vertical FOV for a landscape viewport (aspect > 1) — horizontal FOV is wider, not binding', () => {
    expect(computeEffectiveFovDegrees(45, 2)).toBeCloseTo(45, 10);
  });

  it('is narrower than the vertical FOV for a portrait viewport (aspect < 1) — horizontal FOV binds', () => {
    const effective = computeEffectiveFovDegrees(45, 0.5);
    expect(effective).toBeLessThan(45);
    expect(effective).toBeGreaterThan(0);
  });

  it('narrows further as the viewport gets more portrait (smaller aspect)', () => {
    const mild = computeEffectiveFovDegrees(45, 0.8);
    const extreme = computeEffectiveFovDegrees(45, MIN_PANE_ASPECT);
    expect(extreme).toBeLessThan(mild);
  });
});

describe('computeProjectedExtent', () => {
  it('exactly matches the analytic isometric-projection extent for a cube (width = s*sqrt(2), height = 4s/sqrt(6))', () => {
    const s = 10;
    const { width, height } = computeProjectedExtent({ x: s, y: s, z: s });
    expect(width).toBeCloseTo(s * Math.sqrt(2), 5);
    expect(height).toBeCloseTo((4 * s) / Math.sqrt(6), 5);
  });

  it('grows the width for a model widened along x/z while height is unchanged by a y-only change', () => {
    const base = computeProjectedExtent({ x: 10, y: 10, z: 10 });
    const widened = computeProjectedExtent({ x: 40, y: 10, z: 40 });
    expect(widened.width).toBeGreaterThan(base.width);
  });

  it('grows the height for a model heightened along y', () => {
    const base = computeProjectedExtent({ x: 10, y: 10, z: 10 });
    const heightened = computeProjectedExtent({ x: 10, y: 100, z: 10 });
    expect(heightened.height).toBeGreaterThan(base.height);
  });

  it('falls back to world +X as the right axis when viewDirection is parallel to worldUp (degenerate cross product)', () => {
    const { width, height } = computeProjectedExtent({ x: 10, y: 10, z: 10 }, { x: 0, y: 1, z: 0 });
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});

describe('derivePaneAspect', () => {
  it('matches the exact analytic aspect for a cube (sqrt(3)/2, unclamped since it is within bounds)', () => {
    expect(derivePaneAspect({ x: 10, y: 10, z: 10 })).toBeCloseTo(Math.sqrt(3) / 2, 5);
  });

  it('clamps to MIN_PANE_ASPECT for a very tall thin column (portrait)', () => {
    expect(derivePaneAspect({ x: 5, y: 1000, z: 5 })).toBeCloseTo(MIN_PANE_ASPECT, 5);
  });

  it('produces a landscape aspect for a very wide thin plate, asymptotically approaching sqrt(3) for this isometric view (a box can never actually reach MAX_PANE_ASPECT=2 under a (1,1,1)/up=(0,1,0) projection — width depends only on the x/z half-extents while height always retains a y contribution, so MAX_PANE_ASPECT is a defensive upper clamp, not a reachable value)', () => {
    const aspect = derivePaneAspect({ x: 100000, y: 1, z: 100000 });
    expect(aspect).toBeGreaterThan(1);
    expect(aspect).toBeLessThan(MAX_PANE_ASPECT);
    expect(aspect).toBeCloseTo(Math.sqrt(3), 2);
  });

  it('derivePaneSize still honors MAX_PANE_ASPECT as a hard upper clamp even though no box reaches it via derivePaneAspect (defense in depth for future projection changes)', () => {
    expect(derivePaneSize(MAX_PANE_ASPECT).width / derivePaneSize(MAX_PANE_ASPECT).height).toBeCloseTo(
      MAX_PANE_ASPECT,
      1
    );
  });

  it('produces a smaller aspect for a taller model than a wider one', () => {
    const tall = derivePaneAspect({ x: 20, y: 200, z: 20 });
    const wide = derivePaneAspect({ x: 200, y: 20, z: 200 });
    expect(tall).toBeLessThan(wide);
  });
});

describe('derivePaneSize', () => {
  it('returns the original 220x220 square for aspect = 1 (backward-compatible with the fixed preview size)', () => {
    expect(derivePaneSize(1)).toEqual({ width: 220, height: 220 });
  });

  it('produces a portrait pane (height > width) for aspect < 1', () => {
    const { width, height } = derivePaneSize(MIN_PANE_ASPECT);
    expect(height).toBeGreaterThan(width);
  });

  it('produces a landscape pane (width > height) for aspect > 1', () => {
    const { width, height } = derivePaneSize(MAX_PANE_ASPECT);
    expect(width).toBeGreaterThan(height);
  });

  it('never exceeds MAX_PANE_PX or drops below MIN_PANE_PX on either axis, across the full clamped aspect range', () => {
    for (const aspect of [MIN_PANE_ASPECT, 0.8, 1, 1.5, MAX_PANE_ASPECT]) {
      const { width, height } = derivePaneSize(aspect);
      expect(width).toBeLessThanOrEqual(MAX_PANE_PX);
      expect(width).toBeGreaterThanOrEqual(MIN_PANE_PX);
      expect(height).toBeLessThanOrEqual(MAX_PANE_PX);
      expect(height).toBeGreaterThanOrEqual(MIN_PANE_PX);
    }
  });

  it('preserves the requested aspect ratio after any min/max clamping (scales both dimensions together, never distorts)', () => {
    const { width, height } = derivePaneSize(MAX_PANE_ASPECT);
    expect(width / height).toBeCloseTo(MAX_PANE_ASPECT, 1);
  });

  it('internally clamps an out-of-range aspect the same as derivePaneAspect would have (defensive — matches the MAX_PANE_ASPECT result)', () => {
    expect(derivePaneSize(10)).toEqual(derivePaneSize(MAX_PANE_ASPECT));
    expect(derivePaneSize(0.01)).toEqual(derivePaneSize(MIN_PANE_ASPECT));
  });
});

describe('two-axis frustum fit for non-square panes', () => {
  /** Mirrors `fitsInFrustum` but also checks the horizontal frustum plane —
   *  needed once the pane (and therefore camera.aspect) is no longer square. */
  function fitsInFrustum2D(radius: number, distance: number, vFovDegrees: number, aspect: number): boolean {
    const vFovRadians = (vFovDegrees * Math.PI) / 180;
    const hFovRadians = 2 * Math.atan(Math.tan(vFovRadians / 2) * aspect);
    const vHalfHeight = distance * Math.tan(vFovRadians / 2);
    const hHalfWidth = distance * Math.tan(hFovRadians / 2);
    return vHalfHeight >= radius - 1e-6 && hHalfWidth >= radius - 1e-6;
  }

  it.each([
    { name: 'portrait pane (2mm cube)', size: { x: 2, y: 2, z: 2 }, aspect: MIN_PANE_ASPECT },
    { name: 'portrait pane (40mm cube)', size: { x: 40, y: 40, z: 40 }, aspect: 0.75 },
    { name: 'landscape pane (300mm cube)', size: { x: 300, y: 300, z: 300 }, aspect: MAX_PANE_ASPECT },
    { name: 'landscape pane (thin plate)', size: { x: 300, y: 300, z: 1 }, aspect: 1.5 },
  ])('fully frames a $name on BOTH axes at every FOV', ({ size, aspect }) => {
    for (const fov of [30, 45, 60, 75]) {
      const radius = boundingSphereRadius(size);
      const distance = computeFramingDistance(radius, fov, FRAMING_MARGIN, aspect);
      expect(fitsInFrustum2D(radius, distance, fov, aspect)).toBe(true);
    }
  });

  it('demonstrates that ignoring aspect (the pre-fix single-axis distance) clips a portrait pane horizontally', () => {
    const size = { x: 40, y: 40, z: 40 };
    const radius = boundingSphereRadius(size);
    const portraitAspect = MIN_PANE_ASPECT;

    // Old behavior: distance computed as if aspect were always 1 (vFov only).
    const squareOnlyDistance = computeFramingDistance(radius, FOV_DEGREES, FRAMING_MARGIN, 1);
    expect(fitsInFrustum2D(radius, squareOnlyDistance, FOV_DEGREES, portraitAspect)).toBe(false);

    // Fixed: passing the real aspect widens the distance enough to fit both axes.
    const aspectAwareDistance = computeFramingDistance(radius, FOV_DEGREES, FRAMING_MARGIN, portraitAspect);
    expect(fitsInFrustum2D(radius, aspectAwareDistance, FOV_DEGREES, portraitAspect)).toBe(true);
  });

  it('computeCameraFraming passes aspect through to the distance calculation (position offset grows for a portrait pane)', () => {
    const center = { x: 0, y: 0, z: 0 };
    const size = { x: 40, y: 40, z: 40 };
    const square = computeCameraFraming(center, size, FOV_DEGREES, FRAMING_MARGIN, 1);
    const portrait = computeCameraFraming(center, size, FOV_DEGREES, FRAMING_MARGIN, MIN_PANE_ASPECT);

    const squareDistance = Math.sqrt(square.position.x ** 2 + square.position.y ** 2 + square.position.z ** 2);
    const portraitDistance = Math.sqrt(
      portrait.position.x ** 2 + portrait.position.y ** 2 + portrait.position.z ** 2
    );
    expect(portraitDistance).toBeGreaterThan(squareDistance);
  });
});
