import { describe, it, expect } from 'vitest';
import { selectMarginBand, MARGIN_BAND_MIN } from './pricingCoach';

describe('selectMarginBand', () => {
  it('SC3 — guidance changes as margin changes (distinct band + message)', () => {
    const thin = selectMarginBand(22);
    const wholesale = selectMarginBand(45);
    const strong = selectMarginBand(70);
    expect(thin.key).toBe('thin');
    expect(wholesale.key).toBe('wholesale');
    expect(strong.key).toBe('strong');
    // the dynamic proof: the rendered text differs across margins
    expect(new Set([thin.text, wholesale.text, strong.text]).size).toBe(3);
  });

  it('selects bands on the confirmed ladder (0 / 30 / 50 / 70 lower bounds, inclusive)', () => {
    expect(selectMarginBand(0).key).toBe('thin');
    expect(selectMarginBand(29.9).key).toBe('thin');
    expect(selectMarginBand(MARGIN_BAND_MIN.wholesale).key).toBe('wholesale'); // 30
    expect(selectMarginBand(49.9).key).toBe('wholesale');
    expect(selectMarginBand(MARGIN_BAND_MIN.healthy).key).toBe('healthy'); // 50
    expect(selectMarginBand(69.9).key).toBe('healthy');
    expect(selectMarginBand(MARGIN_BAND_MIN.strong).key).toBe('strong'); // 70
    expect(selectMarginBand(120).key).toBe('strong');
  });

  it('grades a negative margin as a loss (bad tone)', () => {
    const r = selectMarginBand(-5);
    expect(r.key).toBe('loss');
    expect(r.tone).toBe('bad');
  });

  it('assigns the expected tones', () => {
    expect(selectMarginBand(22).tone).toBe('warn');
    expect(selectMarginBand(45).tone).toBe('ok');
    expect(selectMarginBand(60).tone).toBe('good');
    expect(selectMarginBand(80).tone).toBe('good');
  });

  it('interpolates the (rounded) margin into the message for graded bands', () => {
    expect(selectMarginBand(45.04).text).toContain('45%');
    expect(selectMarginBand(45.06).text).toContain('45.1%');
  });

  it('handles NaN/Infinity safely — neutral band, never "NaN%" or a throw', () => {
    const nan = selectMarginBand(NaN);
    expect(nan.key).toBe('neutral');
    expect(nan.text).not.toContain('NaN');
    expect(() => selectMarginBand(Infinity)).not.toThrow();
    expect(selectMarginBand(Infinity).key).toBe('neutral');
  });
});
