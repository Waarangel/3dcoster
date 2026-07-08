/**
 * Profit-per-PRINT-hour for the calculator — the industry "profit per print hour"
 * (PPH) metric, framed correctly as MACHINE-throughput, NOT a wage.
 *
 * value = (sellingPrice − cost) ÷ printTimeHours  (cost is the net cost the caller
 * passes — typically trueCost + platform fee). Graded against the desktop-FDM
 * benchmark where ~$1–5 per print-hour is the typical healthy machine-hour range
 * (higher is better; below $1 is thin; negative is a loss). This is the honest
 * frame: $1/hr is FINE here, because the printer ran it unattended.
 */

export type PrintHourTone = 'bad' | 'warn' | 'good' | 'na';

/** $/print-hour. Desktop-FDM machine-hour benchmark — see research note above. */
export const PRINT_HOUR_SWEET_SPOT = { min: 1, max: 5 } as const;

export interface PrintHourProfitInput {
  sellingPrice: number;
  cost: number;
  printTimeHours: number;
}

export interface PrintHourProfitResult {
  value: number | null;
  tone: PrintHourTone;
}

function finite(n: number | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export function computePrintHourProfit(input: PrintHourProfitInput): PrintHourProfitResult {
  const hrs = finite(input.printTimeHours);
  if (hrs === null || hrs <= 0) return { value: null, tone: 'na' };

  const sell = finite(input.sellingPrice) ?? 0;
  const cost = finite(input.cost) ?? 0;
  const value = (sell - cost) / hrs;
  if (!Number.isFinite(value)) return { value: null, tone: 'na' };

  let tone: PrintHourTone;
  if (value < 0) tone = 'bad';
  else if (value < PRINT_HOUR_SWEET_SPOT.min) tone = 'warn';
  else tone = 'good';

  return { value, tone };
}
