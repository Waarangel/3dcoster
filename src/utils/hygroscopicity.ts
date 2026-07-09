// ---------------------------------------------------------------------------
// Hygroscopicity-class detection + moisture-risk resolution (Phase 41
// LIFE-01, D-11). Pure module — no React, no Dexie, no IO — mirrors the
// pure-module contract established by src/utils/abrasive.ts (Phase 39
// WEAR-01) and src/utils/costCalc.ts.
//
// Day-threshold table sourced from live web research (2026-07-09), closing
// 41-CONTEXT.md's D-11 research gap:
//   [CITED: Bambu Lab Wiki, Prusa Knowledge Base via search,
//    filamentcheatsheet.com "How to Dry and Store 3D Printing Filament",
//    siraya.tech "How to Dry PETG Filament for Perfect Prints"]
// Published guidance disagrees 2-3x between sources (e.g. nylon saturation
// ranges from ~24h worst-case to 3-5 days at 50% RH). The values below are
// the conservative-middle default across those sources — MEDIUM confidence,
// explicitly NOT lab-measured for any specific ambient humidity (the app has
// no humidity sensor — correctly out of scope). These exact numbers are
// user-confirmed and LOCKED (2026-07-09 plan-phase human-verify checkpoint;
// see 41-RESEARCH.md "Open Questions (RESOLVED)" Q1) — ship verbatim, do not
// re-derive or substitute.
// ---------------------------------------------------------------------------
import type { Asset, FilamentType, HygroscopicityClass } from '../types';

export type MoistureRisk = 'HIGH' | 'MEDIUM' | 'LOW';

// Pitfall 1 (41-RESEARCH.md): FilamentType has NO plain "Nylon"/"PA" entry —
// only the CF-nylon variants 'PA6-CF'/'PPA-CF' exist, and the default
// material catalog ships zero nylon rows. A classifier that only switches on
// FilamentType silently misclassifies every plain-nylon spool as LOW/Other.
// Match on name too, exactly mirroring ABRASIVE_PATTERNS's dual match in
// abrasive.ts.
export const HYGRO_PATTERNS = {
  high: {
    name: /nylon|pa6|pa11|pa12|polyamide/i,
    type: /^(PA6-CF|PPA-CF)$/,
  },
  medium: /PETG|PET|TPU|ABS|ASA|PC/i,
  low: /PLA|PVA/i,
} as const;

// Day thresholds derive from the cited guidance above, taking the
// conservative middle of the published ranges per class.
export const RISK_THRESHOLDS: Record<HygroscopicityClass, { mediumAtDays: number; highAtDays: number }> = {
  HIGH: { mediumAtDays: 1, highAtDays: 3 },     // Nylon/PA: MEDIUM after 1 day, HIGH after 3
  MEDIUM: { mediumAtDays: 3, highAtDays: 7 },   // PETG/TPU: MEDIUM after 3 days, HIGH after 7
  LOW: { mediumAtDays: 14, highAtDays: 30 },    // PLA: MEDIUM after 14 days, HIGH after 30
};

/**
 * Auto-detect matcher: does this filamentType/name combination indicate a
 * HIGH/MEDIUM/LOW hygroscopicity class? Pure pattern match — does NOT
 * consult any override; see `resolveHygroscopicityClass` for the
 * override-aware version consumers should actually call.
 *
 * Examples:
 *   detectHygroscopicityClass('PA6-CF', 'Bambu PA6-CF') → 'HIGH'
 *   detectHygroscopicityClass(undefined, 'PolyMide PA12') → 'HIGH' (name match, no bare-nylon FilamentType exists)
 *   detectHygroscopicityClass('PETG', 'eSun PETG') → 'MEDIUM'
 *   detectHygroscopicityClass('PLA', 'Bambu PLA Basic') → 'LOW'
 *   detectHygroscopicityClass(undefined, 'Unknown Filament') → 'LOW' (default)
 */
export function detectHygroscopicityClass(filamentType: FilamentType | undefined, name: string): HygroscopicityClass {
  if (HYGRO_PATTERNS.high.name.test(name) || (filamentType !== undefined && HYGRO_PATTERNS.high.type.test(filamentType))) {
    return 'HIGH';
  }
  if ((filamentType !== undefined && HYGRO_PATTERNS.medium.test(filamentType)) || HYGRO_PATTERNS.medium.test(name)) {
    return 'MEDIUM';
  }
  if ((filamentType !== undefined && HYGRO_PATTERNS.low.test(filamentType)) || HYGRO_PATTERNS.low.test(name)) {
    return 'LOW';
  }
  return 'LOW';
}

/**
 * Override-aware hygroscopicity resolution (D-11): an explicit
 * `Asset.hygroscopicityOverride` always wins over the auto-detect matcher.
 * `undefined` means "use auto-detect" — the same optional-field
 * backward-compat pattern used throughout Asset (see `resolveIsAbrasive`).
 *
 * Examples:
 *   resolveHygroscopicityClass({ filamentType: 'PA6-CF', name: 'Bambu PA6-CF', hygroscopicityOverride: undefined }) → 'HIGH' (auto-detect)
 *   resolveHygroscopicityClass({ filamentType: 'PLA', name: 'Bambu PLA', hygroscopicityOverride: 'HIGH' }) → 'HIGH' (override)
 */
export function resolveHygroscopicityClass(asset: Pick<Asset, 'filamentType' | 'name' | 'hygroscopicityOverride'>): HygroscopicityClass {
  if (asset.hygroscopicityOverride !== undefined) return asset.hygroscopicityOverride;
  return detectHygroscopicityClass(asset.filamentType, asset.name);
}

/**
 * Resolves the current moisture-risk tier for a hygroscopicity class given
 * whole days since the spool was opened/last dried.
 *
 * Examples:
 *   resolveMoistureRisk('HIGH', 0) → 'LOW'
 *   resolveMoistureRisk('HIGH', 1) → 'MEDIUM'
 *   resolveMoistureRisk('HIGH', 3) → 'HIGH'
 *   resolveMoistureRisk('LOW', 13) → 'LOW'
 *   resolveMoistureRisk('LOW', 14) → 'MEDIUM'
 *   resolveMoistureRisk('LOW', 30) → 'HIGH'
 */
export function resolveMoistureRisk(hygroClass: HygroscopicityClass, daysSinceOpened: number): MoistureRisk {
  const t = RISK_THRESHOLDS[hygroClass];
  if (daysSinceOpened >= t.highAtDays) return 'HIGH';
  if (daysSinceOpened >= t.mediumAtDays) return 'MEDIUM';
  return 'LOW';
}

/**
 * Whole days since the spool's moisture-risk clock started: max(openedAt,
 * last dryingLog entry). Returns null when openedAt is unset (never opened —
 * callers must NOT treat this as LOW risk, it means "no data").
 * dryingLog entries are date-only ISO strings (yyyy-mm-dd, D-10) parsed as
 * local midnight so a same-day drying resets the clock to 0 days.
 *
 * Examples:
 *   daysSinceOpened({ openedAt: undefined }) → null
 *   daysSinceOpened({ openedAt: new Date('2026-06-27') }, new Date('2026-07-09')) → 12
 *   daysSinceOpened({ openedAt: new Date('2026-06-01'), dryingLog: ['2026-07-05'] }, new Date('2026-07-09')) → 4 (clock reset by the later drying entry)
 */
export function daysSinceOpened(asset: Pick<Asset, 'openedAt' | 'dryingLog'>, now: Date = new Date()): number | null {
  if (!asset.openedAt) return null;

  let clockStart = asset.openedAt;
  const lastDried = asset.dryingLog && asset.dryingLog.length > 0
    ? asset.dryingLog[asset.dryingLog.length - 1]
    : undefined;
  if (lastDried) {
    const parsed = new Date(`${lastDried}T00:00:00`);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > clockStart.getTime()) {
      clockStart = parsed;
    }
  }

  const diffMs = now.getTime() - clockStart.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}
