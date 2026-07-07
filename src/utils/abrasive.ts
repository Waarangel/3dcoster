// ---------------------------------------------------------------------------
// Abrasive-material detection + nozzle-type resolution (Phase 39 WEAR-01,
// D-13). Pure module — no React, no Dexie, no IO — mirrors the pure-module
// contract established by src/utils/costCalc.ts (lines 12-14) and
// src/db/stockEvents.ts.
// ---------------------------------------------------------------------------
import type { Asset, FilamentType, PrinterInstance } from '../types';

// Pattern 4 (39-PATTERNS.md): CF/GF/carbon/glass/glow/metal-fill substrings.
// Matches against both the FilamentType literal (e.g. 'PLA-CF', 'PETG-CF',
// 'PA6-CF', 'PPA-CF', 'PET-CF') and the free-text asset name (covers
// "Glow in the Dark PLA", "Metal-Fill Copper", etc. that aren't captured by
// the FilamentType union alone).
const ABRASIVE_PATTERNS = /CF|GF|carbon|glass|glow|metal/i;

/**
 * Auto-detect matcher: does this filamentType/name combination indicate an
 * abrasive material (carbon-fiber, glass-fiber, glow-in-the-dark, metal-fill)?
 * Pure pattern match — does NOT consult any override; see `resolveIsAbrasive`
 * for the override-aware version consumers should actually call.
 *
 * Examples:
 *   detectIsAbrasive('PLA-CF', 'Bambu PLA-CF') → true
 *   detectIsAbrasive('PETG-CF', 'eSun PETG-CF') → true
 *   detectIsAbrasive('PLA', 'Glow in the Dark PLA') → true (name match)
 *   detectIsAbrasive('PLA', 'Bambu PLA Basic') → false
 */
export function detectIsAbrasive(filamentType: FilamentType | undefined, name: string): boolean {
  if (filamentType && ABRASIVE_PATTERNS.test(filamentType)) return true;
  return ABRASIVE_PATTERNS.test(name);
}

/**
 * Override-aware abrasive resolution (D-13): an explicit `Asset.isAbrasive`
 * always wins over the auto-detect matcher. `undefined` means "use
 * auto-detect" — the same optional-field backward-compat pattern already
 * used throughout Asset (see lowStockThreshold).
 *
 * Examples:
 *   resolveIsAbrasive({ filamentType: 'PLA-CF', name: 'Bambu PLA-CF' }) → true (auto-detect)
 *   resolveIsAbrasive({ filamentType: 'PLA', name: 'Bambu PLA', isAbrasive: true }) → true (override)
 *   resolveIsAbrasive({ filamentType: 'PLA-CF', name: 'Bambu PLA-CF', isAbrasive: false }) → false (override wins)
 */
export function resolveIsAbrasive(asset: Pick<Asset, 'filamentType' | 'name' | 'isAbrasive'>): boolean {
  if (asset.isAbrasive !== undefined) return asset.isAbrasive;
  return detectIsAbrasive(asset.filamentType, asset.name);
}

/**
 * Resolves a PrinterInstance's nozzle type, defaulting unset instances to
 * 'brass' per the documented default-to-brass semantic (src/types.ts
 * PrinterInstance.nozzleType doc comment). ALL brass-gating logic in Plans
 * 04/05 MUST go through this resolver — never a literal `=== 'brass'` check
 * on the raw optional field, which would silently exclude every pre-Phase-39
 * instance (nozzleType undefined) from abrasive-hours tracking.
 *
 * Examples:
 *   resolveNozzleType({ nozzleType: undefined, ... }) → 'brass'
 *   resolveNozzleType({ nozzleType: 'hardened', ... }) → 'hardened'
 *   resolveNozzleType({ nozzleType: 'ruby', ... }) → 'ruby'
 */
export function resolveNozzleType(instance: Pick<PrinterInstance, 'nozzleType'>): 'brass' | 'hardened' | 'ruby' {
  return instance.nozzleType ?? 'brass';
}
