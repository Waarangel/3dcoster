import { describe, it, expect } from 'vitest';
import { detectUnitsWarning, convertInchesToMm, MM_MIN_PLAUSIBLE, MM_MAX_PLAUSIBLE, INCH_TO_MM } from './unitsHeuristic';

describe('unitsHeuristic', () => {
  describe('detectUnitsWarning', () => {
    it('returns true when every axis is below MM_MIN_PLAUSIBLE (looks like inches, tiny bounding box)', () => {
      // Arrange
      const sizeMm = { x: 0.5, y: 0.4, z: 0.3 };

      // Act
      const warning = detectUnitsWarning(sizeMm);

      // Assert
      expect(warning).toBe(true);
    });

    it('returns true when every axis is above MM_MAX_PLAUSIBLE (looks like inches, huge bounding box)', () => {
      // Arrange
      const sizeMm = { x: 600, y: 700, z: 800 };

      // Act
      const warning = detectUnitsWarning(sizeMm);

      // Assert
      expect(warning).toBe(true);
    });

    it('returns false for a normal 40mm print (plausible mm range)', () => {
      // Arrange
      const sizeMm = { x: 40, y: 40, z: 40 };

      // Act
      const warning = detectUnitsWarning(sizeMm);

      // Assert
      expect(warning).toBe(false);
    });

    it('returns false when only some axes are out of the plausible range (not every axis)', () => {
      // Arrange: a thin, flat part — one axis is small but the others are plausible
      const sizeMm = { x: 2, y: 40, z: 40 };

      // Act
      const warning = detectUnitsWarning(sizeMm);

      // Assert
      expect(warning).toBe(false);
    });
  });

  describe('convertInchesToMm', () => {
    it('multiplies every coordinate by INCH_TO_MM (25.4) and returns a NEW array', () => {
      // Arrange
      const original = new Float32Array([0.5, 0.4, 0.3, 1, 1, 1]);
      const originalCopy = original.slice();

      // Act
      const converted = convertInchesToMm(original);

      // Assert
      expect(converted).not.toBe(original);
      expect(original).toEqual(originalCopy); // immutability — original untouched
      for (let i = 0; i < original.length; i++) {
        expect(converted[i]).toBeCloseTo(original[i] * INCH_TO_MM, 4);
      }
    });

    it('corrects a units-warning-triggering size into a plausible mm size after conversion (D-15)', () => {
      // Arrange: sub-5mm-per-axis size that is actually inches
      const tinySizeMm = { x: 0.5, y: 0.5, z: 0.5 };
      expect(detectUnitsWarning(tinySizeMm)).toBe(true);

      // Act: convert the underlying position data and recompute the size
      const position = new Float32Array([0, 0, 0, 0.5, 0.5, 0.5]);
      const converted = convertInchesToMm(position);
      const convertedSizeMm = { x: converted[3] - converted[0], y: converted[4] - converted[1], z: converted[5] - converted[2] };

      // Assert
      expect(detectUnitsWarning(convertedSizeMm)).toBe(false);
    });
  });

  describe('named constants', () => {
    it('exports the tunable plausibility thresholds and the inch-to-mm factor', () => {
      expect(MM_MIN_PLAUSIBLE).toBe(5);
      expect(MM_MAX_PLAUSIBLE).toBe(500);
      expect(INCH_TO_MM).toBeCloseTo(25.4, 5);
    });
  });
});
