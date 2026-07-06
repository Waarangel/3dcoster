import { describe, it, expect } from 'vitest';
import { deriveMaintenanceAmortization, predictNextSwap } from './maintenanceAmortization';
import type { Asset, MaintenanceEvent, PrintJob, PrinterInstance } from '../types';

function makeInstance(overrides: Partial<PrinterInstance> = {}): PrinterInstance {
  return {
    id: 'inst-1',
    printerConfigId: 'cfg-1',
    nickname: 'Test Printer',
    printHours: 100,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<MaintenanceEvent> = {}): MaintenanceEvent {
  return {
    id: 'evt-1',
    printerInstanceId: 'inst-1',
    partType: 'nozzle',
    cost: 10,
    occurredAt: new Date('2026-01-01'),
    printerHoursAtEvent: 50,
    ...overrides,
  };
}

function makeJob(overrides: Partial<PrintJob> = {}): PrintJob {
  return {
    id: 'job-1',
    name: 'Test Job',
    createdAt: new Date(),
    updatedAt: new Date(),
    filaments: [],
    printTimeHours: 5,
    printerInstanceId: 'inst-1',
    modelCost: 0,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    costPerUnit: 0,
    sellingPrice: 0,
    copiesSold: 0,
    ...overrides,
  };
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'mat-pla',
    name: 'PLA Basic',
    category: 'filament',
    filamentType: 'PLA',
    ...overrides,
  };
}

describe('deriveMaintenanceAmortization', () => {
  it('computes amortized $/hr as total cost ÷ printer hours', () => {
    const events = [
      makeEvent({ id: 'e1', cost: 20 }),
      makeEvent({ id: 'e2', cost: 15, partType: 'belt' }),
    ];
    const instance = makeInstance({ printHours: 100 });
    const result = deriveMaintenanceAmortization(events, [], instance, new Map());
    expect(result).not.toBeNull();
    expect(result!.cumulativeCost).toBe(35);
    expect(result!.amortizedPerHour).toBeCloseTo(0.35);
  });

  it('returns null at 0 printer-hours (no divide-by-zero)', () => {
    const events = [makeEvent({ cost: 20 })];
    const instance = makeInstance({ printHours: 0 });
    const result = deriveMaintenanceAmortization(events, [], instance, new Map());
    expect(result).toBeNull();
  });

  it('returns null at negative printer-hours', () => {
    const instance = makeInstance({ printHours: -5 });
    const result = deriveMaintenanceAmortization([], [], instance, new Map());
    expect(result).toBeNull();
  });

  it('only counts events for the given instance', () => {
    const events = [
      makeEvent({ id: 'e1', cost: 20, printerInstanceId: 'inst-1' }),
      makeEvent({ id: 'e2', cost: 999, printerInstanceId: 'inst-OTHER' }),
    ];
    const instance = makeInstance({ printHours: 100 });
    const result = deriveMaintenanceAmortization(events, [], instance, new Map());
    expect(result!.cumulativeCost).toBe(20);
  });

  it('accumulates abrasiveHours from CF material jobs on a brass nozzle', () => {
    const assetsById = new Map<string, Asset>([
      ['mat-cf', makeAsset({ id: 'mat-cf', name: 'PLA-CF', filamentType: 'PLA-CF' })],
    ]);
    const jobs = [
      makeJob({ id: 'j1', printTimeHours: 6, filaments: [{ filamentId: 'mat-cf', grams: 100 }] }),
    ];
    const instance = makeInstance({ printHours: 100, nozzleType: 'brass' });
    const result = deriveMaintenanceAmortization([], jobs, instance, assetsById);
    expect(result!.abrasiveHours).toBe(6);
  });

  it('undefined nozzleType defaults to brass and still accumulates abrasiveHours', () => {
    const assetsById = new Map<string, Asset>([
      ['mat-cf', makeAsset({ id: 'mat-cf', name: 'PLA-CF', filamentType: 'PLA-CF' })],
    ]);
    const jobs = [
      makeJob({ id: 'j1', printTimeHours: 4, filaments: [{ filamentId: 'mat-cf', grams: 100 }] }),
    ];
    const instance = makeInstance({ printHours: 100, nozzleType: undefined });
    const result = deriveMaintenanceAmortization([], jobs, instance, assetsById);
    expect(result!.abrasiveHours).toBe(4);
  });

  it('does not accumulate abrasiveHours on a hardened nozzle', () => {
    const assetsById = new Map<string, Asset>([
      ['mat-cf', makeAsset({ id: 'mat-cf', name: 'PLA-CF', filamentType: 'PLA-CF' })],
    ]);
    const jobs = [
      makeJob({ id: 'j1', printTimeHours: 6, filaments: [{ filamentId: 'mat-cf', grams: 100 }] }),
    ];
    const instance = makeInstance({ printHours: 100, nozzleType: 'hardened' });
    const result = deriveMaintenanceAmortization([], jobs, instance, assetsById);
    expect(result!.abrasiveHours).toBe(0);
  });

  it('does not accumulate abrasiveHours for non-abrasive material', () => {
    const assetsById = new Map<string, Asset>([
      ['mat-pla', makeAsset({ id: 'mat-pla' })],
    ]);
    const jobs = [
      makeJob({ id: 'j1', printTimeHours: 6, filaments: [{ filamentId: 'mat-pla', grams: 100 }] }),
    ];
    const instance = makeInstance({ printHours: 100, nozzleType: 'brass' });
    const result = deriveMaintenanceAmortization([], jobs, instance, assetsById);
    expect(result!.abrasiveHours).toBe(0);
  });
});

describe('predictNextSwap', () => {
  it('tracks nozzle/belt/bed separately with per-part average intervals', () => {
    const events = [
      makeEvent({ id: 'n1', partType: 'nozzle', printerHoursAtEvent: 50 }),
      makeEvent({ id: 'n2', partType: 'nozzle', printerHoursAtEvent: 150 }),
      makeEvent({ id: 'b1', partType: 'belt', printerHoursAtEvent: 100 }),
      makeEvent({ id: 'b2', partType: 'belt', printerHoursAtEvent: 300 }),
    ];
    const jobs = [makeJob({ printTimeHours: 5 })];
    const instance = makeInstance({ printHours: 150 });
    const result = predictNextSwap(events, jobs, instance);

    expect(result.nozzle).not.toBeNull();
    expect(result.nozzle!.intervalHours).toBe(100);
    expect(result.belt).not.toBeNull();
    expect(result.belt!.intervalHours).toBe(200);
    expect(result.bed).toBeNull();
    expect(result.other).toBeNull();
  });

  it('returns null for a part with no swap history (500h fallback applies)', () => {
    const instance = makeInstance({ printHours: 100 });
    const result = predictNextSwap([], [], instance);
    expect(result.nozzle).toBeNull();
    expect(result.belt).toBeNull();
    expect(result.bed).toBeNull();
    expect(result.other).toBeNull();
  });

  it('returns null for a part with only a single logged swap (no interval derivable)', () => {
    const events = [makeEvent({ partType: 'nozzle', printerHoursAtEvent: 50 })];
    const instance = makeInstance({ printHours: 100 });
    const result = predictNextSwap(events, [], instance);
    expect(result.nozzle).toBeNull();
  });

  it('projects a future nextSwapDate using recent print pace', () => {
    const events = [
      makeEvent({ id: 'n1', partType: 'nozzle', printerHoursAtEvent: 0 }),
      makeEvent({ id: 'n2', partType: 'nozzle', printerHoursAtEvent: 100 }),
    ];
    const recentJobs = Array.from({ length: 5 }, (_, i) =>
      makeJob({ id: `j${i}`, printTimeHours: 3, createdAt: new Date() }),
    );
    const instance = makeInstance({ printHours: 100 });
    const result = predictNextSwap(events, recentJobs, instance);
    expect(result.nozzle).not.toBeNull();
    expect(result.nozzle!.nextSwapDate.getTime()).toBeGreaterThan(Date.now() - 1000);
  });
});
