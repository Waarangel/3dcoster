import JSZip from 'jszip';
import { getMaterialDensity } from './gcodeParser';

export interface ThreeMfPlate {
  index: number;
  printTimeSeconds: number;
  filaments: Array<{ slot: number; type: string; grams: number }>;
}

export interface ThreeMfParseResult {
  plates: ThreeMfPlate[];
  /** Aggregated filament usage across all plates, keyed by filament type */
  filamentsByType: Array<{ type: string; grams: number }>;
  /** Total print time in hours (rounded to 2 decimal places) */
  totalPrintTimeHours: number;
  /** Number of build plates in the project */
  plateCount: number;
  /** false when Metadata/slice_info.config is absent (non-sliced 3MF) */
  isSliced: boolean;
}

/**
 * Convert filament length in metres to grams.
 * Uses 1.75mm diameter filament and a material-specific density.
 * Formula: volume_cm3 = pi * r_cm^2 * length_cm; grams = volume_cm3 * density
 */
function metresToGrams(metres: number, filamentType: string): number {
  const radiusCm = 1.75 / 2 / 10; // 0.0875 cm
  const lengthCm = metres * 100;   // metres → cm
  const volumeCm3 = Math.PI * radiusCm * radiusCm * lengthCm;
  const density = getMaterialDensity(filamentType);
  return volumeCm3 * density;
}

/**
 * Parse a sliced Bambu Studio / OrcaSlicer .3mf file.
 *
 * A sliced .3mf is a ZIP archive containing `Metadata/slice_info.config`,
 * an XML document with one <plate> element per build plate. Each plate
 * records per-filament weight (used_g), length (used_m), and print time
 * (prediction in seconds).
 *
 * Returns `isSliced: false` if the file is a non-sliced geometry-only 3MF
 * (i.e., slice_info.config is absent).
 */
export async function parseThreeMf(file: File): Promise<ThreeMfParseResult> {
  const zip = await JSZip.loadAsync(file);
  const sliceInfoFile = zip.file('Metadata/slice_info.config');

  if (!sliceInfoFile) {
    return {
      plates: [],
      filamentsByType: [],
      totalPrintTimeHours: 0,
      plateCount: 0,
      isSliced: false,
    };
  }

  const xmlText = await sliceInfoFile.async('text');
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');

  const plates: ThreeMfPlate[] = [];
  const plateEls = doc.querySelectorAll('plate');

  for (const plateEl of Array.from(plateEls)) {
    const indexMeta = plateEl.querySelector('metadata[key="index"]');
    const timeMeta = plateEl.querySelector('metadata[key="prediction"]');

    const index = indexMeta ? parseInt(indexMeta.getAttribute('value') ?? '0', 10) : 0;
    const printTimeSeconds = timeMeta ? parseFloat(timeMeta.getAttribute('value') ?? '0') : 0;

    const filaments: ThreeMfPlate['filaments'] = [];

    for (const filEl of Array.from(plateEl.querySelectorAll('filament'))) {
      const slot = parseInt(filEl.getAttribute('id') ?? '0', 10);
      const type = filEl.getAttribute('type') ?? 'Unknown';
      const gramsAttr = filEl.getAttribute('used_g');
      const mAttr = filEl.getAttribute('used_m');

      let grams = gramsAttr != null && gramsAttr !== '' ? parseFloat(gramsAttr) : 0;

      // Fallback: if used_g is absent or zero, compute from used_m (metres)
      if (grams === 0 && mAttr != null && mAttr !== '') {
        const metres = parseFloat(mAttr);
        if (metres > 0) {
          grams = metresToGrams(metres, type);
        }
      }

      // Filter out unused AMS slots (zero grams)
      if (grams > 0) {
        filaments.push({ slot, type, grams });
      }
    }

    plates.push({ index, printTimeSeconds, filaments });
  }

  // Aggregate filament usage by type across all plates
  const typeMap = new Map<string, number>();
  for (const plate of plates) {
    for (const f of plate.filaments) {
      typeMap.set(f.type, (typeMap.get(f.type) ?? 0) + f.grams);
    }
  }
  const filamentsByType = Array.from(typeMap.entries()).map(([type, grams]) => ({ type, grams }));

  // Sum prediction seconds across all plates, convert to hours
  const totalSeconds = plates.reduce((sum, p) => sum + p.printTimeSeconds, 0);
  const totalPrintTimeHours = Math.round((totalSeconds / 3600) * 100) / 100;

  return {
    plates,
    filamentsByType,
    totalPrintTimeHours,
    plateCount: plates.length,
    isSliced: true,
  };
}
