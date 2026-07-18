// ---------------------------------------------------------------------------
// Shells + infill weight model for the STL/3MF instant quote (CONN-02, D-13).
//
// Locked shape (D-13): NOT pure volume x infill (which underestimates real
// prints — every real print has solid perimeter walls and top/bottom layers
// regardless of infill%), and NOT a magic correction factor. Instead: derive
// a solid "shell" volume from the mesh's surface area and the slicer's wall
// count + top/bottom layer defaults, clamp it so it never exceeds the mesh's
// total volume, then apply infill% only to the remaining interior volume.
//
// All wall/top-bottom/line-width/layer-height assumptions are named
// constants in ONE place (Pitfall 5) — never scattered as bare literals in
// the math below, mirroring the Bambu Studio / PrusaSlicer 0.2mm "Standard"
// profile defaults for a 0.4mm nozzle.
// ---------------------------------------------------------------------------

/** Wall loop count — Bambu Studio / PrusaSlicer "Standard" 0.2mm profile default. */
export const WALL_COUNT = 3;
/** Top + bottom solid layers — Bambu Studio / PrusaSlicer "Standard" 0.2mm profile default. */
export const TOP_BOTTOM_LAYERS = 4;
/** Extrusion line width (mm) — ~1.05x a 0.4mm nozzle, "Standard" profile default. */
export const LINE_WIDTH_MM = 0.42;
/** Layer height (mm) — "Standard" 0.2mm profile default. */
export const LAYER_HEIGHT_MM = 0.2;

/**
 * Fraction of total mesh surface area attributed to horizontal (top/bottom)
 * facing surfaces vs. vertical (wall) surfaces, used only because this model
 * receives a single scalar surfaceAreaCm2 rather than a footprint area. A
 * box-equivalent heuristic (2 of a box's 6 faces are top+bottom) — documented
 * here as an intentional simplification pending a footprint-aware refinement.
 */
const TOP_BOTTOM_AREA_FRACTION = 1 / 3;

/** PLA fallback density (g/cm3) when no material density is supplied (D-10). */
const PLA_DENSITY_G_CM3 = 1.24;

const MM_TO_CM = 1 / 10;

export interface WeightModelInput {
  volumeCm3: number;
  surfaceAreaCm2: number;
  infillPercent: number;
  densityGCm3?: number;
}

export interface WeightBreakdown {
  totalGrams: number;
  shellGrams: number;
  infillGrams: number;
  usedPlaFallback: boolean;
}

/**
 * Estimates print weight as solid shells (walls + top/bottom) plus
 * infill% of the remaining interior volume — never pure volume x infill,
 * which would underestimate every real print (D-13).
 */
export function estimateWeightGrams(input: WeightModelInput): WeightBreakdown {
  const { volumeCm3, surfaceAreaCm2, infillPercent } = input;
  const usedPlaFallback = input.densityGCm3 === undefined;
  const densityGCm3 = input.densityGCm3 ?? PLA_DENSITY_G_CM3;

  const wallThicknessCm = WALL_COUNT * LINE_WIDTH_MM * MM_TO_CM;
  const topBottomThicknessCm = TOP_BOTTOM_LAYERS * LAYER_HEIGHT_MM * MM_TO_CM;

  const wallAreaCm2 = surfaceAreaCm2 * (1 - TOP_BOTTOM_AREA_FRACTION);
  const topBottomAreaCm2 = surfaceAreaCm2 * TOP_BOTTOM_AREA_FRACTION;

  const wallVolumeCm3 = wallAreaCm2 * wallThicknessCm;
  const topBottomVolumeCm3 = topBottomAreaCm2 * topBottomThicknessCm;

  const rawShellVolumeCm3 = wallVolumeCm3 + topBottomVolumeCm3;
  const shellVolumeCm3 = Math.min(rawShellVolumeCm3, volumeCm3);

  const interiorVolumeCm3 = volumeCm3 - shellVolumeCm3;
  const infillVolumeCm3 = interiorVolumeCm3 * (infillPercent / 100);

  const shellGrams = shellVolumeCm3 * densityGCm3;
  const infillGrams = infillVolumeCm3 * densityGCm3;

  return {
    totalGrams: shellGrams + infillGrams,
    shellGrams,
    infillGrams,
    usedPlaFallback,
  };
}
