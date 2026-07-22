import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { db, setSetting, settingsKeys, setFxRateTable } from '../db/database';
import { useDisplayPrice } from './useDisplayPrice';
import type { FxRateTable } from '../utils/fxConvert';
import type { UserProfile } from '../types';

// ---------------------------------------------------------------------------
// useDisplayPrice — Phase 45-12 (G-45-CURRENCY, BRAND-01).
//
// Same raw createRoot + act harness as useFailureRate.test.tsx / other hook
// tests in this codebase (no renderHook library installed).
// ---------------------------------------------------------------------------

function Harness({ onReady }: { onReady: (result: ReturnType<typeof useDisplayPrice>) => void }) {
  const result = useDisplayPrice();
  onReady(result);
  return <div data-testid="display-currency">{result.displayCurrency}</div>;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latest: ReturnType<typeof useDisplayPrice> | null = null;

function stubLanguage(tag: string) {
  Object.defineProperty(navigator, 'language', { value: tag, configurable: true });
}

const TABLE_EUR_GBP: FxRateTable = {
  base: 'USD',
  date: '2026-07-01',
  cachedAt: Date.now(),
  rates: { EUR: 0.92, GBP: 0.79, USD: 1 },
};

function minimalProfile(currency: UserProfile['currency']): UserProfile {
  return { currency, laborHourlyRate: 20 };
}

beforeEach(async () => {
  await db.settings.clear();
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
  latest = null;
});

async function render() {
  await act(async () => {
    root!.render(<Harness onReady={(r) => { latest = r; }} />);
    await Promise.resolve();
  });
  // Flush any pending microtasks from the two mount effects (userProfile read + useFxRates).
  await act(async () => { await Promise.resolve(); });
}

describe('useDisplayPrice', () => {
  it('resolves via locale when no stored profile exists, with a non-null approx once FX loads', async () => {
    stubLanguage('en-GB');
    await setFxRateTable(TABLE_EUR_GBP);
    await render();

    expect(latest!.displayCurrency).toBe('GBP');
    expect(latest!.monthly.approx).not.toBeNull();
    expect(latest!.monthly.approx).toMatch(/^£/);
    expect(latest!.monthly.billingLabel).toBe('USD 7.99');
    expect(latest!.annual.billingLabel).toBe('USD 79');
    expect(latest!.freePrice).toBe('£0');
  });

  it('stored preference wins over locale', async () => {
    stubLanguage('en-GB');
    await setSetting(settingsKeys.userProfile, minimalProfile('JPY'));
    await setFxRateTable({ ...TABLE_EUR_GBP, rates: { ...TABLE_EUR_GBP.rates, JPY: 148 } });
    await render();

    expect(latest!.displayCurrency).toBe('JPY');
  });

  it('shows billing labels alone (approx null) when no FX table is cached', async () => {
    stubLanguage('en-GB');
    await render();

    expect(latest!.monthly.approx).toBeNull();
    expect(latest!.annual.approx).toBeNull();
    expect(latest!.monthly.billingLabel).toBe('USD 7.99');
    expect(latest!.annual.billingLabel).toBe('USD 79');
    expect(latest!.freePrice).toBe('$0');
  });

  it('USD visitor sees the billing label alone (same-currency, no approx)', async () => {
    stubLanguage('en-US');
    await setFxRateTable(TABLE_EUR_GBP);
    await render();

    expect(latest!.displayCurrency).toBe('USD');
    expect(latest!.monthly.approx).toBeNull();
    expect(latest!.monthly.billingLabel).toBe('USD 7.99');
    expect(latest!.freePrice).toBe('$0');
  });
});
