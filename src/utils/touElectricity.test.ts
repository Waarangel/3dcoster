import { describe, it, expect } from 'vitest';
import { resolveWeightedCostPerKwh, parseHHMM } from './touElectricity';
import type { TouBand } from '../types';

// ---------------------------------------------------------------------------
// Synthetic-fixture helper (mirrors costCalc.test.ts's override-factory idiom)
// ---------------------------------------------------------------------------

function makeBand(overrides: Partial<TouBand> = {}): TouBand {
  return {
    id: 'band-1',
    name: 'Off-Peak',
    ratePerKwh: 0.08,
    startTime: '23:00',
    endTime: '07:00',
    ...overrides,
  };
}

describe('parseHHMM', () => {
  it('parses a well-formed HH:MM string to minutes-since-midnight', () => {
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('09:30')).toBe(570);
    expect(parseHHMM('23:59')).toBe(1439);
  });

  it('returns null for an out-of-range hour', () => {
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('25:00')).toBeNull();
  });

  it('returns null for an out-of-range minute (regex enforces 00-59)', () => {
    expect(parseHHMM('12:60')).toBeNull();
  });

  it('returns null for malformed strings', () => {
    expect(parseHHMM('9:30')).toBeNull(); // not zero-padded
    expect(parseHHMM('bogus')).toBeNull();
    expect(parseHHMM('')).toBeNull();
    expect(parseHHMM(undefined)).toBeNull();
  });
});

describe('resolveWeightedCostPerKwh — fallback to flat rate', () => {
  it('returns the flat rate when bands is undefined', () => {
    expect(resolveWeightedCostPerKwh(undefined, 0.12, '20:00', 3)).toBe(0.12);
  });

  it('returns the flat rate when bands is an empty array', () => {
    expect(resolveWeightedCostPerKwh([], 0.12, '20:00', 3)).toBe(0.12);
  });

  it('returns the flat rate when startTime is undefined', () => {
    expect(resolveWeightedCostPerKwh([makeBand()], 0.12, undefined, 3)).toBe(0.12);
  });

  it('returns the flat rate when startTime is malformed ("HH:MM" strict check fails)', () => {
    expect(resolveWeightedCostPerKwh([makeBand()], 0.12, '9:30', 3)).toBe(0.12);
    expect(resolveWeightedCostPerKwh([makeBand()], 0.12, '25:00', 3)).toBe(0.12);
    expect(resolveWeightedCostPerKwh([makeBand()], 0.12, 'bogus', 3)).toBe(0.12);
  });

  it('returns the flat rate when every band has a malformed start/end time', () => {
    const badBand = makeBand({ startTime: 'bad', endTime: 'also-bad' });
    expect(resolveWeightedCostPerKwh([badBand], 0.12, '20:00', 3)).toBe(0.12);
  });

  it('returns the flat rate for non-finite or non-positive duration', () => {
    expect(resolveWeightedCostPerKwh([makeBand()], 0.12, '20:00', 0)).toBe(0.12);
    expect(resolveWeightedCostPerKwh([makeBand()], 0.12, '20:00', -1)).toBe(0.12);
    expect(resolveWeightedCostPerKwh([makeBand()], 0.12, '20:00', NaN)).toBe(0.12);
  });
});

describe('resolveWeightedCostPerKwh — same-day band', () => {
  it('applies the band rate when the whole print falls inside a same-day band', () => {
    const peakBand = makeBand({ startTime: '09:00', endTime: '17:00', ratePerKwh: 0.20 });
    // Print starts 10:00, runs 2h — fully inside [09:00, 17:00)
    expect(resolveWeightedCostPerKwh([peakBand], 0.12, '10:00', 2)).toBeCloseTo(0.20, 5);
  });

  it('blends flat rate and band rate when the print starts before the band and finishes inside it', () => {
    const peakBand = makeBand({ startTime: '09:00', endTime: '17:00', ratePerKwh: 0.20 });
    // Print starts 08:00, runs 2h → 1h flat (0.12) + 1h peak (0.20) = 0.16 average
    expect(resolveWeightedCostPerKwh([peakBand], 0.12, '08:00', 2)).toBeCloseTo(0.16, 5);
  });
});

describe('resolveWeightedCostPerKwh — overnight wrap-around (explicit case)', () => {
  it('applies the off-peak rate across a print that starts at 23:00 and crosses midnight into the band', () => {
    // Off-peak band 23:00 -> 07:00 (wraps past midnight). Print starts exactly
    // at 23:00 and runs 4h — fully inside the wrapped band the whole time.
    const offPeak = makeBand({ startTime: '23:00', endTime: '07:00', ratePerKwh: 0.08 });
    expect(resolveWeightedCostPerKwh([offPeak], 0.12, '23:00', 4)).toBeCloseTo(0.08, 5);
  });

  it('blends flat and off-peak rates for a print starting before an overnight band and running past its end', () => {
    // Off-peak 23:00 -> 07:00. Print starts 22:00, runs 10h (22:00 -> 08:00 next day):
    //   22:00-23:00 (1h) flat @ 0.12
    //   23:00-07:00 (8h) off-peak @ 0.08 (wraps midnight)
    //   07:00-08:00 (1h) flat @ 0.12
    // Weighted: (1*0.12 + 8*0.08 + 1*0.12) / 10 = (0.12 + 0.64 + 0.12) / 10 = 0.088
    const offPeak = makeBand({ startTime: '23:00', endTime: '07:00', ratePerKwh: 0.08 });
    expect(resolveWeightedCostPerKwh([offPeak], 0.12, '22:00', 10)).toBeCloseTo(0.088, 5);
  });

  it('handles a print that starts and ends entirely after midnight within a wrapped band', () => {
    const offPeak = makeBand({ startTime: '23:00', endTime: '07:00', ratePerKwh: 0.08 });
    // Starts 01:00 (already inside the wrapped window), runs 3h -> ends 04:00.
    expect(resolveWeightedCostPerKwh([offPeak], 0.12, '01:00', 3)).toBeCloseTo(0.08, 5);
  });
});

describe('resolveWeightedCostPerKwh — multiple bands (max 3 per D-09)', () => {
  it('picks the correct rate per minute across three distinct bands', () => {
    const bands: TouBand[] = [
      makeBand({ id: 'off-peak', startTime: '23:00', endTime: '07:00', ratePerKwh: 0.08 }),
      makeBand({ id: 'shoulder', startTime: '07:00', endTime: '17:00', ratePerKwh: 0.12 }),
      makeBand({ id: 'peak', startTime: '17:00', endTime: '21:00', ratePerKwh: 0.24 }),
    ];
    // Print starts 16:00, runs 2h -> 16:00-17:00 shoulder (1h @ 0.12), 17:00-18:00 peak (1h @ 0.24)
    // Weighted: (1*0.12 + 1*0.24) / 2 = 0.18
    expect(resolveWeightedCostPerKwh(bands, 0.15, '16:00', 2)).toBeCloseTo(0.18, 5);
  });
});
