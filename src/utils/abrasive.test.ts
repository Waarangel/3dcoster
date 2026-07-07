import { describe, it, expect } from 'vitest';
import { detectIsAbrasive, resolveIsAbrasive, resolveNozzleType } from './abrasive';

describe('detectIsAbrasive', () => {
  it('flags CF filament types as abrasive', () => {
    expect(detectIsAbrasive('PLA-CF', 'Bambu PLA-CF')).toBe(true);
    expect(detectIsAbrasive('PETG-CF', 'eSun PETG-CF')).toBe(true);
    expect(detectIsAbrasive('PET-CF', 'Polymaker PET-CF')).toBe(true);
    expect(detectIsAbrasive('PA6-CF', 'Bambu PA6-CF')).toBe(true);
    expect(detectIsAbrasive('PPA-CF', 'Bambu PPA-CF')).toBe(true);
  });

  it('flags glow/metal-fill names as abrasive even on a plain filamentType', () => {
    expect(detectIsAbrasive('PLA', 'Glow in the Dark PLA')).toBe(true);
    expect(detectIsAbrasive('PLA', 'Copper Metal-Fill PLA')).toBe(true);
  });

  it('does not flag plain PLA/PETG as abrasive', () => {
    expect(detectIsAbrasive('PLA', 'Bambu PLA Basic')).toBe(false);
    expect(detectIsAbrasive('PETG', 'eSun PETG')).toBe(false);
    expect(detectIsAbrasive(undefined, 'Generic Filament')).toBe(false);
  });
});

describe('resolveIsAbrasive', () => {
  it('auto-detects when isAbrasive is undefined', () => {
    expect(resolveIsAbrasive({ filamentType: 'PLA-CF', name: 'Bambu PLA-CF', isAbrasive: undefined })).toBe(true);
    expect(resolveIsAbrasive({ filamentType: 'PLA', name: 'Bambu PLA Basic', isAbrasive: undefined })).toBe(false);
  });

  it('explicit override wins over auto-detect (true overrides a non-match)', () => {
    expect(resolveIsAbrasive({ filamentType: 'PLA', name: 'Bambu PLA Basic', isAbrasive: true })).toBe(true);
  });

  it('explicit override wins over auto-detect (false overrides a match)', () => {
    expect(resolveIsAbrasive({ filamentType: 'PLA-CF', name: 'Bambu PLA-CF', isAbrasive: false })).toBe(false);
  });
});

describe('resolveNozzleType', () => {
  it('defaults undefined nozzleType to brass', () => {
    expect(resolveNozzleType({ nozzleType: undefined })).toBe('brass');
  });

  it('returns explicit hardened/ruby as-is', () => {
    expect(resolveNozzleType({ nozzleType: 'hardened' })).toBe('hardened');
    expect(resolveNozzleType({ nozzleType: 'ruby' })).toBe('ruby');
  });

  it('returns explicit brass as-is', () => {
    expect(resolveNozzleType({ nozzleType: 'brass' })).toBe('brass');
  });
});
