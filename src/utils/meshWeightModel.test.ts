import { describe, it, expect } from 'vitest';
import {
  estimateWeightGrams,
  WALL_COUNT,
  TOP_BOTTOM_LAYERS,
  LINE_WIDTH_MM,
  LAYER_HEIGHT_MM,
} from './meshWeightModel';

// Reference mesh: 1cm3 unit cube (volume 1 cm3, surface area 6 cm2 — matches
// the stlParser.test.ts unit-cube fixture) at a common 15% infill.
const CUBE_VOLUME_CM3 = 1.0;
const CUBE_SURFACE_AREA_CM2 = 6.0;
const INFILL_PERCENT = 15;
const PLA_DENSITY_G_CM3 = 1.24;

describe('meshWeightModel', () => {
  describe('estimateWeightGrams (shells exceed pure infill)', () => {
    it('returns a total strictly greater than pure volume x infill x density (D-13 anti-underestimate)', () => {
      // Arrange
      const pureInfillGrams = CUBE_VOLUME_CM3 * (INFILL_PERCENT / 100) * PLA_DENSITY_G_CM3;

      // Act
      const breakdown = estimateWeightGrams({
        volumeCm3: CUBE_VOLUME_CM3,
        surfaceAreaCm2: CUBE_SURFACE_AREA_CM2,
        infillPercent: INFILL_PERCENT,
        densityGCm3: PLA_DENSITY_G_CM3,
      });

      // Assert
      expect(breakdown.totalGrams).toBeGreaterThan(pureInfillGrams);
    });

    it('returns shellGrams and infillGrams that sum to totalGrams', () => {
      // Arrange / Act
      const breakdown = estimateWeightGrams({
        volumeCm3: CUBE_VOLUME_CM3,
        surfaceAreaCm2: CUBE_SURFACE_AREA_CM2,
        infillPercent: INFILL_PERCENT,
        densityGCm3: PLA_DENSITY_G_CM3,
      });

      // Assert
      expect(breakdown.shellGrams + breakdown.infillGrams).toBeCloseTo(breakdown.totalGrams, 6);
      expect(breakdown.shellGrams).toBeGreaterThan(0);
    });

    it('clamps shell volume so it never exceeds the mesh total volume (tiny mesh, huge relative surface area)', () => {
      // Arrange: a mesh with a surface area disproportionate to its volume
      // (e.g. a very thin/complex shape) should never report a shell weight
      // heavier than the mesh solid-filled at 100%.
      const solidGrams = 0.001 * PLA_DENSITY_G_CM3;

      // Act
      const breakdown = estimateWeightGrams({
        volumeCm3: 0.001,
        surfaceAreaCm2: 500,
        infillPercent: INFILL_PERCENT,
        densityGCm3: PLA_DENSITY_G_CM3,
      });

      // Assert
      expect(breakdown.totalGrams).toBeLessThanOrEqual(solidGrams + 1e-6);
      expect(breakdown.infillGrams).toBeGreaterThanOrEqual(0);
    });
  });

  describe('estimateWeightGrams (PLA density fallback, D-10)', () => {
    it('falls back to PLA 1.24 g/cm3 and records usedPlaFallback when density is undefined', () => {
      // Arrange / Act
      const withFallback = estimateWeightGrams({
        volumeCm3: CUBE_VOLUME_CM3,
        surfaceAreaCm2: CUBE_SURFACE_AREA_CM2,
        infillPercent: INFILL_PERCENT,
      });
      const withExplicitPla = estimateWeightGrams({
        volumeCm3: CUBE_VOLUME_CM3,
        surfaceAreaCm2: CUBE_SURFACE_AREA_CM2,
        infillPercent: INFILL_PERCENT,
        densityGCm3: PLA_DENSITY_G_CM3,
      });

      // Assert
      expect(withFallback.usedPlaFallback).toBe(true);
      expect(withFallback.totalGrams).toBeCloseTo(withExplicitPla.totalGrams, 6);
    });

    it('does not report usedPlaFallback when an explicit density is provided', () => {
      // Arrange / Act
      const breakdown = estimateWeightGrams({
        volumeCm3: CUBE_VOLUME_CM3,
        surfaceAreaCm2: CUBE_SURFACE_AREA_CM2,
        infillPercent: INFILL_PERCENT,
        densityGCm3: 1.04, // e.g. ABS
      });

      // Assert
      expect(breakdown.usedPlaFallback).toBe(false);
    });
  });

  describe('named constants (Pitfall 5 — no magic numbers)', () => {
    it('exports the slicer-preset constants used by the shell math', () => {
      expect(WALL_COUNT).toBe(3);
      expect(TOP_BOTTOM_LAYERS).toBe(4);
      expect(LINE_WIDTH_MM).toBeCloseTo(0.42, 5);
      expect(LAYER_HEIGHT_MM).toBeCloseTo(0.2, 5);
    });
  });
});
