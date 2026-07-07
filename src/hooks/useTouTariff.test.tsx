import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTouTariff, MAX_TOU_BANDS } from './useTouTariff';
import type { ElectricityConfig, TouBand } from '../types';

// ---------------------------------------------------------------------------
// useTouTariff — Phase 39 TOU-01. Raw createRoot + act harness (project
// precedent for hook tests without React Testing Library, e.g. useFailureEvents.test.tsx).
// ---------------------------------------------------------------------------

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

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

// Harness component that exposes the hook's return value to the test via a ref-like callback.
function HookHarness({
  electricity,
  onElectricityChange,
  onResult,
}: {
  electricity: ElectricityConfig;
  onElectricityChange: (config: ElectricityConfig) => void;
  onResult: (result: ReturnType<typeof useTouTariff>) => void;
}) {
  const result = useTouTariff(electricity, onElectricityChange);
  onResult(result);
  return null;
}

function renderHook(electricity: ElectricityConfig, onElectricityChange: (c: ElectricityConfig) => void) {
  let latest: ReturnType<typeof useTouTariff> | null = null;
  act(() => {
    root!.render(
      <HookHarness
        electricity={electricity}
        onElectricityChange={onElectricityChange}
        onResult={r => { latest = r; }}
      />
    );
  });
  return () => latest!;
}

describe('useTouTariff — read', () => {
  it('returns flatRate + bands from the current ElectricityConfig', () => {
    const electricity: ElectricityConfig = {
      costPerKwh: 0.15,
      touBands: [makeBand()],
    };
    const getResult = renderHook(electricity, vi.fn());
    const result = getResult();

    expect(result.flatRate).toBe(0.15);
    expect(result.bands).toHaveLength(1);
    expect(result.bands[0].id).toBe('band-1');
  });

  it('returns an empty bands array when touBands is undefined', () => {
    const electricity: ElectricityConfig = { costPerKwh: 0.15 };
    const getResult = renderHook(electricity, vi.fn());
    const result = getResult();

    expect(result.bands).toEqual([]);
  });
});

describe('useTouTariff — max 3 bands (D-09)', () => {
  it('rejects adding a 4th band', () => {
    const onElectricityChange = vi.fn();
    const electricity: ElectricityConfig = {
      costPerKwh: 0.15,
      touBands: [
        makeBand({ id: 'b1' }),
        makeBand({ id: 'b2' }),
        makeBand({ id: 'b3' }),
      ],
    };
    const getResult = renderHook(electricity, onElectricityChange);
    const result = getResult();

    expect(result.bands).toHaveLength(MAX_TOU_BANDS);

    act(() => {
      result.upsertBand(makeBand({ id: 'b4' }));
    });

    expect(onElectricityChange).not.toHaveBeenCalled();
  });

  it('allows updating an existing band even when already at 3 bands', () => {
    const onElectricityChange = vi.fn();
    const electricity: ElectricityConfig = {
      costPerKwh: 0.15,
      touBands: [
        makeBand({ id: 'b1', ratePerKwh: 0.08 }),
        makeBand({ id: 'b2' }),
        makeBand({ id: 'b3' }),
      ],
    };
    const getResult = renderHook(electricity, onElectricityChange);
    const result = getResult();

    act(() => {
      result.upsertBand(makeBand({ id: 'b1', ratePerKwh: 0.09 }));
    });

    expect(onElectricityChange).toHaveBeenCalledTimes(1);
    const written = onElectricityChange.mock.calls[0][0] as ElectricityConfig;
    expect(written.touBands).toHaveLength(3);
    expect(written.touBands?.find(b => b.id === 'b1')?.ratePerKwh).toBe(0.09);
  });

  it('allows adding a band when fewer than 3 exist', () => {
    const onElectricityChange = vi.fn();
    const electricity: ElectricityConfig = { costPerKwh: 0.15, touBands: [makeBand({ id: 'b1' })] };
    const getResult = renderHook(electricity, onElectricityChange);
    const result = getResult();

    act(() => {
      result.upsertBand(makeBand({ id: 'b2' }));
    });

    expect(onElectricityChange).toHaveBeenCalledTimes(1);
    const written = onElectricityChange.mock.calls[0][0] as ElectricityConfig;
    expect(written.touBands).toHaveLength(2);
  });
});

describe('useTouTariff — HH:MM validation (parseHHMM boundary)', () => {
  it('rejects a band with a malformed startTime', () => {
    const onElectricityChange = vi.fn();
    const electricity: ElectricityConfig = { costPerKwh: 0.15, touBands: [] };
    const getResult = renderHook(electricity, onElectricityChange);
    const result = getResult();

    act(() => {
      result.upsertBand(makeBand({ startTime: '9:30' })); // not zero-padded — invalid
    });

    expect(onElectricityChange).not.toHaveBeenCalled();
  });

  it('rejects a band with a malformed endTime', () => {
    const onElectricityChange = vi.fn();
    const electricity: ElectricityConfig = { costPerKwh: 0.15, touBands: [] };
    const getResult = renderHook(electricity, onElectricityChange);
    const result = getResult();

    act(() => {
      result.upsertBand(makeBand({ endTime: 'bogus' }));
    });

    expect(onElectricityChange).not.toHaveBeenCalled();
  });

  it('rejects a band with a non-finite rate', () => {
    const onElectricityChange = vi.fn();
    const electricity: ElectricityConfig = { costPerKwh: 0.15, touBands: [] };
    const getResult = renderHook(electricity, onElectricityChange);
    const result = getResult();

    act(() => {
      result.upsertBand(makeBand({ ratePerKwh: NaN }));
    });

    expect(onElectricityChange).not.toHaveBeenCalled();
  });

  it('accepts a valid band with strict HH:MM windows', () => {
    const onElectricityChange = vi.fn();
    const electricity: ElectricityConfig = { costPerKwh: 0.15, touBands: [] };
    const getResult = renderHook(electricity, onElectricityChange);
    const result = getResult();

    act(() => {
      result.upsertBand(makeBand());
    });

    expect(onElectricityChange).toHaveBeenCalledTimes(1);
    const written = onElectricityChange.mock.calls[0][0] as ElectricityConfig;
    expect(written.touBands).toHaveLength(1);
  });
});

describe('useTouTariff — setFlatRate', () => {
  it('writes a finite rate through onElectricityChange', () => {
    const onElectricityChange = vi.fn();
    const electricity: ElectricityConfig = { costPerKwh: 0.15 };
    const getResult = renderHook(electricity, onElectricityChange);
    const result = getResult();

    act(() => {
      result.setFlatRate(0.2);
    });

    expect(onElectricityChange).toHaveBeenCalledWith({ costPerKwh: 0.2 });
  });

  it('ignores a non-finite rate', () => {
    const onElectricityChange = vi.fn();
    const electricity: ElectricityConfig = { costPerKwh: 0.15 };
    const getResult = renderHook(electricity, onElectricityChange);
    const result = getResult();

    act(() => {
      result.setFlatRate(NaN);
    });

    expect(onElectricityChange).not.toHaveBeenCalled();
  });
});

describe('useTouTariff — removeBand', () => {
  it('removes a band by id', () => {
    const onElectricityChange = vi.fn();
    const electricity: ElectricityConfig = {
      costPerKwh: 0.15,
      touBands: [makeBand({ id: 'b1' }), makeBand({ id: 'b2' })],
    };
    const getResult = renderHook(electricity, onElectricityChange);
    const result = getResult();

    act(() => {
      result.removeBand('b1');
    });

    expect(onElectricityChange).toHaveBeenCalledTimes(1);
    const written = onElectricityChange.mock.calls[0][0] as ElectricityConfig;
    expect(written.touBands).toHaveLength(1);
    expect(written.touBands?.[0].id).toBe('b2');
  });

  it('is a no-op when the id does not match any band', () => {
    const onElectricityChange = vi.fn();
    const electricity: ElectricityConfig = { costPerKwh: 0.15, touBands: [makeBand({ id: 'b1' })] };
    const getResult = renderHook(electricity, onElectricityChange);
    const result = getResult();

    act(() => {
      result.removeBand('does-not-exist');
    });

    expect(onElectricityChange).not.toHaveBeenCalled();
  });
});
