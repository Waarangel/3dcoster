import type { TouBand } from '../types';

// Pure time-of-use electricity math module (Phase 39 TOU-01/02). Mirrors the
// "pure module, no React/Dexie/IO" contract established by costCalc.ts.
// No React, no Dexie, no IO — resolveWeightedCostPerKwh is called BY
// calculateElectricityCost (costCalc.ts) to resolve the $/kWh rate; the
// wattage × duration multiplication itself is untouched (Plan 05).

const MINUTES_PER_DAY = 1440;

/**
 * Strictly parses a "HH:MM" 24h clock string into minutes-since-midnight
 * (0-1439). Returns null for anything malformed — callers must treat null as
 * "fall back to flat rate", never coerce to 0/NaN.
 *
 * Examples:
 *   parseHHMM('00:00') → 0
 *   parseHHMM('23:59') → 1439
 *   parseHHMM('9:30')  → null (must be zero-padded 2-digit hour)
 *   parseHHMM('24:00') → null (hour out of range)
 *   parseHHMM('bogus') → null
 */
export function parseHHMM(s: string | undefined): number | null {
  if (!s) return null;
  const match = /^([0-2]\d):([0-5]\d)$/.exec(s);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23) return null;
  return hours * 60 + minutes;
}

/** Which band (if any) covers a given clock-minute (0-1439), handling bands
 *  that wrap past midnight (startTime > endTime, e.g. 22:00 → 06:00). */
function bandCoversMinute(band: { startMin: number; endMin: number }, clockMinute: number): boolean {
  if (band.startMin === band.endMin) return false; // zero-width band never applies
  if (band.startMin < band.endMin) {
    // Same-day band: e.g. 09:00-17:00
    return clockMinute >= band.startMin && clockMinute < band.endMin;
  }
  // Overnight wrap: e.g. 22:00-06:00 covers [22:00, 24:00) U [00:00, 06:00)
  return clockMinute >= band.startMin || clockMinute < band.endMin;
}

/**
 * Wrap-aware overlap check between two bands' [start, end) minute windows
 * (WR-07). Two circular half-open arcs intersect iff one contains the other's
 * start minute. Malformed HH:MM values and zero-width bands (start === end,
 * which bandCoversMinute treats as never applying) report no overlap —
 * upsertBand's own HH:MM validation rejects malformed input separately.
 *
 * Examples:
 *   bandsOverlap({startTime:'22:00',endTime:'08:00'}, {startTime:'17:00',endTime:'23:00'}) → true (wraps midnight)
 *   bandsOverlap({startTime:'09:00',endTime:'17:00'}, {startTime:'17:00',endTime:'21:00'}) → false (half-open: 17:00 belongs to the second band only)
 *   bandsOverlap({startTime:'09:00',endTime:'17:00'}, {startTime:'12:00',endTime:'13:00'}) → true (containment)
 */
export function bandsOverlap(
  a: Pick<TouBand, 'startTime' | 'endTime'>,
  b: Pick<TouBand, 'startTime' | 'endTime'>,
): boolean {
  const aStart = parseHHMM(a.startTime);
  const aEnd = parseHHMM(a.endTime);
  const bStart = parseHHMM(b.startTime);
  const bEnd = parseHHMM(b.endTime);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  if (aStart === aEnd || bStart === bEnd) return false; // zero-width: covers no minutes
  return (
    bandCoversMinute({ startMin: aStart, endMin: aEnd }, bStart) ||
    bandCoversMinute({ startMin: bStart, endMin: bEnd }, aStart)
  );
}

/**
 * Resolves the duration-weighted average $/kWh rate for a print that starts
 * at `startTime` ("HH:MM") and runs for `durationHours`, given a set of TOU
 * bands. Falls back to `flatRate` unchanged when bands are absent/empty or
 * startTime is missing/malformed — never throws, never returns NaN.
 *
 * Implementation: walks the print minute-by-minute (integer arithmetic,
 * modulo 1440 for wrap-around) so overnight-crossing prints are handled
 * without a datetime library (YAGNI per RESEARCH.md).
 *
 * Examples:
 *   resolveWeightedCostPerKwh(undefined, 0.12, '20:00', 3) → 0.12 (no bands)
 *   resolveWeightedCostPerKwh([], 0.12, '20:00', 3) → 0.12 (empty bands)
 *   resolveWeightedCostPerKwh(bands, 0.12, undefined, 3) → 0.12 (no start time)
 *   resolveWeightedCostPerKwh(
 *     [{ id: 'off-peak', name: 'Off-Peak', ratePerKwh: 0.08, startTime: '23:00', endTime: '07:00' }],
 *     0.12, '23:00', 10,
 *   ) → 0.08 (fully within the overnight off-peak band, wraps past midnight)
 */
export function resolveWeightedCostPerKwh(
  bands: TouBand[] | undefined,
  flatRate: number,
  startTime: string | undefined,
  durationHours: number,
): number {
  if (!bands || bands.length === 0) return flatRate;
  const startMinute = parseHHMM(startTime);
  if (startMinute === null) return flatRate;
  if (!Number.isFinite(durationHours) || durationHours <= 0) return flatRate;

  const parsedBands = bands
    .map(b => {
      const startMin = parseHHMM(b.startTime);
      const endMin = parseHHMM(b.endTime);
      if (startMin === null || endMin === null) return null;
      return { rate: b.ratePerKwh, startMin, endMin };
    })
    .filter((b): b is { rate: number; startMin: number; endMin: number } => b !== null);

  if (parsedBands.length === 0) return flatRate;

  const totalMinutes = Math.round(durationHours * 60);
  if (totalMinutes <= 0) return flatRate;

  let weightedSum = 0;
  for (let i = 0; i < totalMinutes; i++) {
    const clockMinute = (startMinute + i) % MINUTES_PER_DAY;
    const matchedBand = parsedBands.find(b => bandCoversMinute(b, clockMinute));
    weightedSum += matchedBand ? matchedBand.rate : flatRate;
  }

  return weightedSum / totalMinutes;
}
