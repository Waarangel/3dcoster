// ---------------------------------------------------------------------------
// mm/inch bounding-box heuristic for the STL/3MF instant quote (CONN-02, D-15).
//
// STL/3MF files carry no embedded unit — a model authored in inches and one
// authored in mm both arrive as bare floats. If every axis of the bounding
// box looks implausible for millimeters (too small or too large), warn the
// user and offer a one-click x25.4 rescale. A manual mm/inch toggle stays
// available regardless of this heuristic (D-15) — this module only powers
// the warning + one-click convert, not a forced/auto conversion.
// ---------------------------------------------------------------------------

/** Below this on EVERY axis, the model is implausibly small for mm (tuning: planner-owned, D-15). */
export const MM_MIN_PLAUSIBLE = 5;
/** Above this on EVERY axis, the model is implausibly large for mm (tuning: planner-owned, D-15). */
export const MM_MAX_PLAUSIBLE = 500;
/** 1 inch in millimeters. */
export const INCH_TO_MM = 25.4;

export interface SizeMm {
  x: number;
  y: number;
  z: number;
}

/**
 * Flags a bounding box as implausible for millimeters only when EVERY axis
 * is out of the plausible range (a single short/flat axis on an otherwise
 * normal part must not trigger a false warning).
 */
export function detectUnitsWarning(sizeMm: SizeMm): boolean {
  const axes = [sizeMm.x, sizeMm.y, sizeMm.z];
  const allTooSmall = axes.every((value) => value < MM_MIN_PLAUSIBLE);
  const allTooLarge = axes.every((value) => value > MM_MAX_PLAUSIBLE);
  return allTooSmall || allTooLarge;
}

/**
 * Rescales a raw position buffer from inches to millimeters (x25.4).
 * Returns a NEW Float32Array — the input buffer is never mutated.
 */
export function convertInchesToMm(position: Float32Array): Float32Array {
  const converted = new Float32Array(position.length);
  for (let i = 0; i < position.length; i++) {
    converted[i] = position[i] * INCH_TO_MM;
  }
  return converted;
}
