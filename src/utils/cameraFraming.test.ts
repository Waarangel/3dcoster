import { describe, it, expect } from 'vitest';
import {
  boundingSphereRadius,
  computeFramingDistance,
  computeCameraFraming,
  FRAMING_MARGIN,
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
