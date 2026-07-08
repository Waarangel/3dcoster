// ---------------------------------------------------------------------------
// Pure period-range resolution (Phase 40 INS-01, D-04). RED stub — see
// periodRange.test.ts for the behavior contract this must satisfy.
// ---------------------------------------------------------------------------
import type { SalesReportRange } from './salesReportAggregates';

export type RangeMode = 'month' | 'quarter' | 'year' | 'ytd' | 'custom';

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface PeriodParts {
  year: number;
  month: number;
  quarter: number;
  customStart: string;
  customEnd: string;
}

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

export function resolveDateRange(_mode: RangeMode, _parts: PeriodParts): SalesReportRange {
  throw new Error('not implemented');
}
