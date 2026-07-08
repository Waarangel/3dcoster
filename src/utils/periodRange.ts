// ---------------------------------------------------------------------------
// Pure period-range resolution (Phase 40 INS-01, D-04). Extracted verbatim
// from ReportsSection.tsx's inline mode/year/month/quarter/custom state +
// range useMemo so the Reports tab and the Insights tab (40-03) share exactly
// one range-resolution implementation. RangeMode has a single home here —
// no other module may redeclare it (prohibition in 40-02-PLAN.md).
// ---------------------------------------------------------------------------
import type { SalesReportRange } from './salesReportAggregates';

export type RangeMode = 'month' | 'quarter' | 'year' | 'ytd' | 'custom';

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Input shape for resolveDateRange — quarter stays 0-based to match the pre-extraction code. */
export interface PeriodParts {
  year: number;
  month: number;   // 0-based
  quarter: number; // 0-based
  customStart: string; // ISO yyyy-mm-dd
  customEnd: string;   // ISO yyyy-mm-dd
}

// Module-scope so the "today" default isn't an impure call during render.
export function nowParts(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function endOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Resolve a RangeMode + PeriodParts into a concrete SalesReportRange.
 * Byte-identical to ReportsSection's pre-extraction inline `range` useMemo.
 *
 * Examples:
 *   resolveDateRange('month', { year: 2026, month: 5, quarter: 0, customStart: '', customEnd: '' })
 *     → { start: 2026-06-01T00:00:00.000, end: 2026-06-30T23:59:59.999, label: 'June 2026' }
 *   resolveDateRange('quarter', { year: 2026, month: 0, quarter: 1, customStart: '', customEnd: '' })
 *     → { start: 2026-04-01T00:00:00.000, end: 2026-06-30T23:59:59.999, label: 'Q2 2026' }
 *   resolveDateRange('custom', { year: 2026, month: 0, quarter: 0, customStart: '2026-04-15', customEnd: '2026-06-18' })
 *     → { start: 2026-04-15T00:00:00.000, end: 2026-06-18T23:59:59.999, label: '<localized From> – <localized To>' }
 *
 * Returns: SalesReportRange { start: Date, end: Date, label: string }
 */
export function resolveDateRange(mode: RangeMode, parts: PeriodParts): SalesReportRange {
  const { year, month, quarter, customStart, customEnd } = parts;

  if (mode === 'quarter') {
    const sm = quarter * 3;
    return {
      start: new Date(year, sm, 1, 0, 0, 0, 0),
      end: new Date(year, sm + 3, 0, 23, 59, 59, 999),
      label: `Q${quarter + 1} ${year}`,
    };
  }
  if (mode === 'year') {
    return {
      start: new Date(year, 0, 1, 0, 0, 0, 0),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
      label: String(year),
    };
  }
  if (mode === 'ytd') {
    const y = nowParts().year;
    return { start: new Date(y, 0, 1, 0, 0, 0, 0), end: endOfToday(), label: `${y} YTD` };
  }
  if (mode === 'custom') {
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T23:59:59.999`);
    return { start, end, label: `${start.toLocaleDateString()} – ${end.toLocaleDateString()}` };
  }
  return {
    start: new Date(year, month, 1, 0, 0, 0, 0),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
    label: `${MONTHS[month]} ${year}`,
  };
}
