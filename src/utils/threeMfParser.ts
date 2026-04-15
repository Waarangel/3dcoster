import JSZip from 'jszip';
import { getMaterialDensity } from './gcodeParser';
import type { FilamentType } from '../types';

/**
 * Bambu Lab tray_info_idx → FilamentType mapping.
 * Source: https://github.com/Bambu-Research-Group/RFID-Tag-Guide/issues/42
 */
const BAMBU_TRAY_MAP: Record<string, FilamentType> = {
  // PLA family
  'GFA00': 'PLA',          // Bambu PLA Basic
  'GFA01': 'PLA Matte',    // Bambu PLA Matte
  'GFA02': 'PLA',          // Bambu PLA Metal
  'GFA03': 'PLA Tough',    // Bambu PLA Impact
  'GFA05': 'PLA Silk',     // Bambu PLA Silk
  'GFA07': 'PLA',          // Bambu PLA Marble
  'GFA08': 'PLA',          // Bambu PLA Sparkle
  'GFA09': 'PLA Tough',    // Bambu PLA Tough
  'GFA11': 'PLA',          // Bambu PLA Aero
  'GFA12': 'PLA',          // Bambu PLA Glow
  'GFA13': 'PLA',          // Bambu PLA Dynamic
  'GFA15': 'PLA',          // Bambu PLA Galaxy
  'GFA50': 'PLA-CF',       // Bambu PLA-CF
  'GFL00': 'PLA',          // PolyLite PLA
  'GFL01': 'PLA',          // PolyTerra PLA
  'GFL03': 'PLA',          // eSUN PLA+
  'GFL04': 'PLA',          // Overture PLA
  'GFL05': 'PLA Matte',    // Overture Matte PLA
  'GFL95': 'PLA',          // Generic PLA High Speed
  'GFL96': 'PLA Silk',     // Generic PLA Silk
  'GFL98': 'PLA-CF',       // Generic PLA-CF
  'GFL99': 'PLA',          // Generic PLA
  // PETG family
  'GFG00': 'PETG',             // Bambu PETG Basic
  'GFG01': 'PETG Translucent', // Bambu PETG Translucent
  'GFG02': 'PETG HF',          // Bambu PETG HF
  'GFG50': 'PETG-CF',          // Bambu PETG-CF
  'GFG60': 'PETG',             // PolyLite PETG
  'GFG96': 'PETG HF',          // Generic PETG HF
  'GFG97': 'PETG',             // Generic PCTG
  'GFG98': 'PETG-CF',          // Generic PETG-CF
  'GFG99': 'PETG',             // Generic PETG
  // ABS / ASA
  'GFB00': 'ABS',    // Bambu ABS
  'GFB01': 'ASA',    // Bambu ASA
  'GFB02': 'ASA',    // Bambu ASA-Aero
  'GFB50': 'ABS',    // Bambu ABS-GF
  'GFB51': 'ASA',    // Bambu ASA-CF
  'GFB60': 'ABS',    // PolyLite ABS
  'GFB61': 'ASA',    // PolyLite ASA
  'GFB98': 'ASA',    // Generic ASA
  'GFB99': 'ABS',    // Generic ABS
  // TPU
  'GFU00': 'TPU 95A',  // Bambu TPU 95A HF
  'GFU01': 'TPU 95A',  // Bambu TPU 95A
  'GFU02': 'TPU',       // Bambu TPU for AMS
  'GFU98': 'TPU',       // Generic TPU for AMS
  'GFU99': 'TPU',       // Generic TPU
  // PA / Nylon
  'GFN03': 'PA6-CF',   // Bambu PA-CF
  'GFN04': 'PA6-CF',   // Bambu PAHT-CF
  'GFN05': 'PA6-CF',   // Bambu PA6-CF
  'GFN06': 'PPA-CF',   // Bambu PPA-CF
  'GFN08': 'PA6-CF',   // Bambu PA6-GF
  'GFN96': 'PPA-CF',   // Generic PPA-GF
  'GFN97': 'PPA-CF',   // Generic PPA-CF
  'GFN98': 'PA6-CF',   // Generic PA-CF
  'GFN99': 'PA6-CF',   // Generic PA
  // PC
  'GFC00': 'PC',     // Bambu PC
  'GFC99': 'PC',     // Generic PC
  // Support / PVA
  'GFS00': 'PVA',    // Bambu Support W
  'GFS01': 'PVA',    // Bambu Support G
  'GFS04': 'PVA',    // Bambu PVA
  'GFS99': 'PVA',    // Generic PVA
};

export interface ThreeMfPlate {
  index: number;
  printTimeSeconds: number;
  filaments: Array<{ slot: number; type: string; trayInfoIdx?: string; grams: number }>;
}

export interface ThreeMfParseResult {
  plates: ThreeMfPlate[];
  /** Aggregated filament usage across all plates, keyed by resolved type */
  filamentsByType: Array<{ type: string; trayInfoIdx?: string; grams: number }>;
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
      const rawType = filEl.getAttribute('type') ?? 'Unknown';
      const trayInfoIdx = filEl.getAttribute('tray_info_idx') ?? undefined;
      const gramsAttr = filEl.getAttribute('used_g');
      const mAttr = filEl.getAttribute('used_m');

      // Resolve type: prefer Bambu tray_info_idx mapping over generic type
      const type = (trayInfoIdx && BAMBU_TRAY_MAP[trayInfoIdx]) ?? rawType;

      let grams = gramsAttr != null && gramsAttr !== '' ? parseFloat(gramsAttr) : 0;

      // Fallback: if used_g is absent or zero, compute from used_m (metres)
      if (grams === 0 && mAttr != null && mAttr !== '') {
        const metres = parseFloat(mAttr);
        if (metres > 0) {
          grams = metresToGrams(metres, rawType);
        }
      }

      // Filter out unused AMS slots (zero grams)
      if (grams > 0) {
        filaments.push({ slot, type, trayInfoIdx, grams });
      }
    }

    plates.push({ index, printTimeSeconds, filaments });
  }

  // Aggregate filament usage by type across all plates
  const typeMap = new Map<string, { grams: number; trayInfoIdx?: string }>();
  for (const plate of plates) {
    for (const f of plate.filaments) {
      const existing = typeMap.get(f.type);
      if (existing) {
        existing.grams += f.grams;
      } else {
        typeMap.set(f.type, { grams: f.grams, trayInfoIdx: f.trayInfoIdx });
      }
    }
  }
  const filamentsByType = Array.from(typeMap.entries()).map(([type, data]) => ({
    type,
    trayInfoIdx: data.trayInfoIdx,
    grams: data.grams,
  }));

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
