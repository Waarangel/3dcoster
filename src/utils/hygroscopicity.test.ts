import { describe, it, expect } from 'vitest';
import {
  detectHygroscopicityClass,
  resolveHygroscopicityClass,
  resolveMoistureRisk,
  daysSinceOpened,
  RISK_THRESHOLDS,
} from './hygroscopicity';

describe('detectHygroscopicityClass', () => {
  it('flags CF-nylon FilamentTypes as HIGH', () => {
    expect(detectHygroscopicityClass('PA6-CF', 'Bambu PA6-CF')).toBe('HIGH');
    expect(detectHygroscopicityClass('PPA-CF', 'Bambu PPA-CF')).toBe('HIGH');
  });

  it('flags plain-nylon names as HIGH even though no bare-nylon FilamentType exists (Pitfall 1)', () => {
    expect(detectHygroscopicityClass(undefined, 'Bambu PA6 Nylon')).toBe('HIGH');
    expect(detectHygroscopicityClass(undefined, 'PolyMide PA12')).toBe('HIGH');
    expect(detectHygroscopicityClass('Other', 'Generic Polyamide Filament')).toBe('HIGH');
  });

  it('classifies PETG/TPU/ABS/ASA/PC as MEDIUM by type or name', () => {
    expect(detectHygroscopicityClass('PETG', 'eSun PETG')).toBe('MEDIUM');
    expect(detectHygroscopicityClass('TPU 95A', 'Bambu TPU')).toBe('MEDIUM');
    expect(detectHygroscopicityClass('ABS', 'Generic ABS')).toBe('MEDIUM');
    expect(detectHygroscopicityClass('ASA', 'Generic ASA')).toBe('MEDIUM');
    expect(detectHygroscopicityClass('PC', 'Polycarbonate Blend')).toBe('MEDIUM');
    expect(detectHygroscopicityClass(undefined, 'Some PETG-like filament')).toBe('MEDIUM');
  });

  it('classifies PLA/PVA as LOW', () => {
    expect(detectHygroscopicityClass('PLA', 'Bambu PLA Basic')).toBe('LOW');
    expect(detectHygroscopicityClass('PVA', 'Support PVA')).toBe('LOW');
  });

  it('defaults unknown filamentType/name combinations to LOW', () => {
    expect(detectHygroscopicityClass(undefined, 'Mystery Filament')).toBe('LOW');
    expect(detectHygroscopicityClass('Other', 'Unlabeled Spool')).toBe('LOW');
  });
});

describe('resolveHygroscopicityClass', () => {
  it('auto-detects when hygroscopicityOverride is undefined', () => {
    expect(resolveHygroscopicityClass({ filamentType: 'PA6-CF', name: 'Bambu PA6-CF', hygroscopicityOverride: undefined })).toBe('HIGH');
    expect(resolveHygroscopicityClass({ filamentType: 'PLA', name: 'Bambu PLA Basic', hygroscopicityOverride: undefined })).toBe('LOW');
  });

  it('explicit override wins over auto-detect', () => {
    expect(resolveHygroscopicityClass({ filamentType: 'PLA', name: 'Bambu PLA Basic', hygroscopicityOverride: 'HIGH' })).toBe('HIGH');
    expect(resolveHygroscopicityClass({ filamentType: 'PA6-CF', name: 'Bambu PA6-CF', hygroscopicityOverride: 'LOW' })).toBe('LOW');
  });
});

describe('RISK_THRESHOLDS (locked, user-confirmed values)', () => {
  it('matches the sourced day-threshold table exactly', () => {
    expect(RISK_THRESHOLDS).toEqual({
      HIGH: { mediumAtDays: 1, highAtDays: 3 },
      MEDIUM: { mediumAtDays: 3, highAtDays: 7 },
      LOW: { mediumAtDays: 14, highAtDays: 30 },
    });
  });
});

describe('resolveMoistureRisk', () => {
  it('HIGH class: LOW before day 1, MEDIUM at day 1, HIGH at day 3', () => {
    expect(resolveMoistureRisk('HIGH', 0)).toBe('LOW');
    expect(resolveMoistureRisk('HIGH', 1)).toBe('MEDIUM');
    expect(resolveMoistureRisk('HIGH', 2)).toBe('MEDIUM');
    expect(resolveMoistureRisk('HIGH', 3)).toBe('HIGH');
  });

  it('MEDIUM class: LOW before day 3, MEDIUM at day 3, HIGH at day 7', () => {
    expect(resolveMoistureRisk('MEDIUM', 2)).toBe('LOW');
    expect(resolveMoistureRisk('MEDIUM', 3)).toBe('MEDIUM');
    expect(resolveMoistureRisk('MEDIUM', 6)).toBe('MEDIUM');
    expect(resolveMoistureRisk('MEDIUM', 7)).toBe('HIGH');
  });

  it('LOW class: LOW before day 14, MEDIUM at day 14, HIGH at day 30', () => {
    expect(resolveMoistureRisk('LOW', 13)).toBe('LOW');
    expect(resolveMoistureRisk('LOW', 14)).toBe('MEDIUM');
    expect(resolveMoistureRisk('LOW', 29)).toBe('MEDIUM');
    expect(resolveMoistureRisk('LOW', 30)).toBe('HIGH');
  });
});

describe('daysSinceOpened', () => {
  it('returns null when openedAt is unset', () => {
    expect(daysSinceOpened({ openedAt: undefined, dryingLog: undefined })).toBeNull();
  });

  // Uses local Date constructors (not ISO 'Z' strings) throughout: the
  // implementation parses dryingLog date-only strings as LOCAL midnight
  // (`${entry}T00:00:00`, no 'Z'), so tests must build `now`/`openedAt` the
  // same way to avoid timezone-dependent flakiness in CI.
  it('returns whole days since openedAt when there is no drying log', () => {
    const now = new Date(2026, 6, 9, 12, 0, 0);
    const openedAt = new Date(2026, 5, 27, 12, 0, 0);
    expect(daysSinceOpened({ openedAt, dryingLog: undefined }, now)).toBe(12);
  });

  it('resets the clock to the latest dryingLog entry when it is after openedAt', () => {
    const now = new Date(2026, 6, 9, 0, 0, 0);
    const openedAt = new Date(2026, 5, 1, 0, 0, 0);
    expect(daysSinceOpened({ openedAt, dryingLog: ['2026-07-01', '2026-07-05'] }, now)).toBe(4);
  });

  it('ignores a dryingLog entry that predates openedAt (a fresh spool after an old log)', () => {
    const now = new Date(2026, 6, 9, 0, 0, 0);
    const openedAt = new Date(2026, 6, 8, 0, 0, 0);
    expect(daysSinceOpened({ openedAt, dryingLog: ['2026-06-01'] }, now)).toBe(1);
  });
});
