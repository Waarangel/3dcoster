/**
 * Pure "Why this price?" coach — maps the user's current margin to a health band
 * and a dynamic, MJ/Cost-Truth-voice guidance line. The dynamic line is the moat
 * vs SlicePrice3D's static guide. NO new cost math — keyed off the net margin the
 * pricing interlink already computes.
 *
 * Ladder confirmed with the user 2026-06-25 (non-overlapping; channel-awareness
 * is out of scope for this phase — a later Channel Presets phase makes it per-channel):
 *   margin < 0        → loss
 *   0  ≤ margin < 30   → thin
 *   30 ≤ margin < 50   → wholesale
 *   50 ≤ margin < 70   → healthy
 *   margin ≥ 70        → strong
 */

export type MarginTone = 'bad' | 'warn' | 'ok' | 'good';

export interface MarginBand {
  key: 'loss' | 'thin' | 'wholesale' | 'healthy' | 'strong' | 'neutral';
  tone: MarginTone;
  text: string;
}

/** Lower bounds (inclusive) per band — named constants so a tweak is a one-liner. */
export const MARGIN_BAND_MIN = {
  thin: 0,
  wholesale: 30,
  healthy: 50,
  strong: 70,
} as const;

/** Band tone + message template. Exported so the ladder is inspectable/testable. */
export const MARGIN_BANDS: Record<MarginBand['key'], { tone: MarginTone; message: (m: number) => string }> = {
  loss: { tone: 'bad', message: () => 'You’re selling below cost — every sale loses money.' },
  thin: { tone: 'warn', message: (m) => `${m}% margin — thin. Below most maker pricing; risky once fees, failures, and taxes hit.` },
  wholesale: { tone: 'ok', message: (m) => `${m}% margin — keystone / wholesale range. Healthy for volume or B2B, lean for direct sales.` },
  healthy: { tone: 'good', message: (m) => `${m}% margin — healthy for direct-to-customer sales.` },
  strong: { tone: 'good', message: (m) => `${m}% margin — strong; room to discount, wholesale, or absorb marketplace fees.` },
  neutral: { tone: 'ok', message: () => 'Set a selling price to see how your margin looks.' },
};

export function selectMarginBand(marginPercent: number): MarginBand {
  if (!Number.isFinite(marginPercent)) {
    return { key: 'neutral', tone: MARGIN_BANDS.neutral.tone, text: MARGIN_BANDS.neutral.message(0) };
  }

  const display = Math.round(marginPercent * 10) / 10; // 1 decimal for display; band on raw value

  let key: MarginBand['key'];
  if (marginPercent < 0) key = 'loss';
  else if (marginPercent < MARGIN_BAND_MIN.wholesale) key = 'thin';
  else if (marginPercent < MARGIN_BAND_MIN.healthy) key = 'wholesale';
  else if (marginPercent < MARGIN_BAND_MIN.strong) key = 'healthy';
  else key = 'strong';

  const def = MARGIN_BANDS[key];
  return { key, tone: def.tone, text: def.message(display) };
}
