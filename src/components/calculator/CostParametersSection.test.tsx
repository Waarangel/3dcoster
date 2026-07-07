// ---------------------------------------------------------------------------
// Phase 39 (39-05, Task 2): CostParametersSection hint-row tests. Locks the
// "props-in, callbacks-out, no Dexie access, no business math" contract while
// covering the three new Apply-gated suggestion rows (failure rate, TOU start
// time, maintenance amortization).
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { CostParametersSection } from './CostParametersSection';
import type { CalculatorFieldIds } from './fieldIds';
import type { Material } from '../../types';

const ids: CalculatorFieldIds = {
  printName: 'printName',
  printerSelect: 'printerSelect',
  modelUrl: 'modelUrl',
  modelCost: 'modelCost',
  authorMinPrice: 'authorMinPrice',
  gramsBase: 'gramsBase',
  printTime: 'printTime',
  failureRate: 'failureRate',
  prepTime: 'prepTime',
  postProcessing: 'postProcessing',
  shippingMethod: 'shippingMethod',
  shippingDistance: 'shippingDistance',
  carrierCost: 'carrierCost',
  sellingPlatform: 'sellingPlatform',
  profitMargin: 'profitMargin',
  targetProfit: 'targetProfit',
  sellingPrice: 'sellingPrice',
  taxRate: 'taxRate',
};

const nonFilaments: Material[] = [];

function baseProps() {
  return {
    printTimeHours: 2,
    onPrintTimeHoursChange: vi.fn(),
    failureRate: 5,
    onFailureRateChange: vi.fn(),
    prepTimeMinutes: 0,
    onPrepTimeMinutesChange: vi.fn(),
    postProcessingMinutes: 0,
    onPostProcessingMinutesChange: vi.fn(),
    materialsUsed: [],
    materialsInProfile: [],
    nonFilaments,
    currencySymbol: '$',
    onAddMaterialUsage: vi.fn(),
    onUpdateMaterialUsage: vi.fn(),
    onRemoveMaterialUsage: vi.fn(),
    ids,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(ui);
  });
}

function unmount() {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
}

describe('CostParametersSection — Phase 39 hint rows', () => {
  it('renders no failure-rate hint when empiricalFailureRate is null', () => {
    mount(<CostParametersSection {...baseProps()} empiricalFailureRate={null} />);
    expect(container!.textContent).not.toContain('Logged:');
    unmount();
  });

  it('renders the empirical failure-rate hint + Apply when empiricalFailureRate is non-null, and Apply calls the callback', () => {
    const onApplyEmpiricalFailureRate = vi.fn();
    mount(
      <CostParametersSection
        {...baseProps()}
        empiricalFailureRate={{ rate: 30, sampleSize: 10, provenance: 'exact' }}
        onApplyEmpiricalFailureRate={onApplyEmpiricalFailureRate}
      />
    );
    expect(container!.textContent).toContain('Logged: 30%');
    const applyButtons = Array.from(container!.querySelectorAll('button')).filter(b => b.textContent === 'Apply');
    expect(applyButtons.length).toBeGreaterThan(0);
    act(() => {
      applyButtons[0].click();
    });
    expect(onApplyEmpiricalFailureRate).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('shows "(printer avg)" qualifier for printer-fallback provenance', () => {
    mount(
      <CostParametersSection
        {...baseProps()}
        empiricalFailureRate={{ rate: 12, sampleSize: 6, provenance: 'printer-fallback' }}
      />
    );
    expect(container!.textContent).toContain('(printer avg)');
    unmount();
  });

  it('does not render the TOU start-time picker when touBandsConfigured is falsy', () => {
    mount(<CostParametersSection {...baseProps()} touBandsConfigured={false} />);
    expect(container!.querySelector('#tou-start-time')).toBeNull();
    unmount();
  });

  it('renders the TOU start-time picker when touBandsConfigured is true; empty value means flat rate', () => {
    mount(<CostParametersSection {...baseProps()} touBandsConfigured={true} touStartTime={undefined} />);
    const input = container!.querySelector('#tou-start-time') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input!.value).toBe('');
    unmount();
  });

  it('WR-09: shows an inline HH:MM warning for an invalid start time, and none when valid or empty', () => {
    // "9:30" is rejected by the strict zero-padded parser — the exact string
    // the Settings band editor errors on; the calculator must warn too instead
    // of silently pricing at the flat rate.
    mount(<CostParametersSection {...baseProps()} touBandsConfigured={true} touStartTime="9:30" />);
    expect(container!.textContent).toContain('Enter time as HH:MM');
    unmount();

    mount(<CostParametersSection {...baseProps()} touBandsConfigured={true} touStartTime="09:30" />);
    expect(container!.textContent).not.toContain('Enter time as HH:MM');
    unmount();

    mount(<CostParametersSection {...baseProps()} touBandsConfigured={true} touStartTime={undefined} />);
    expect(container!.textContent).not.toContain('Enter time as HH:MM');
    unmount();
  });

  it('renders a savings hint when touSavingsHint is provided', () => {
    mount(
      <CostParametersSection
        {...baseProps()}
        touBandsConfigured={true}
        touStartTime="20:00"
        touSavingsHint={{ cheapestStart: '23:00', saving: 1.23 }}
      />
    );
    expect(container!.textContent).toContain('Cheapest start: 23:00');
    expect(container!.textContent).toContain('1.23');
    unmount();
  });

  it('calls onTouStartTimeChange when the start-time input changes', () => {
    const onTouStartTimeChange = vi.fn();
    mount(
      <CostParametersSection
        {...baseProps()}
        touBandsConfigured={true}
        onTouStartTimeChange={onTouStartTimeChange}
      />
    );
    const input = container!.querySelector('#tou-start-time') as HTMLInputElement;
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      nativeSetter.call(input, '22:00');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onTouStartTimeChange).toHaveBeenCalledWith('22:00');
    unmount();
  });

  it('renders the manual maintenance-cost input unconditionally (D-14, new field)', () => {
    mount(<CostParametersSection {...baseProps()} maintenanceCostPerHour={0} />);
    expect(container!.querySelector('#maintenance-cost-per-hour')).not.toBeNull();
    unmount();
  });

  it('renders no amortized-maintenance hint when amortizedMaintenancePerHour is null', () => {
    mount(<CostParametersSection {...baseProps()} amortizedMaintenancePerHour={null} />);
    expect(container!.textContent).not.toContain('Amortized:');
    unmount();
  });

  it('renders the amortized-maintenance hint + Apply when available, and Apply calls the callback', () => {
    const onApplyAmortizedMaintenance = vi.fn();
    mount(
      <CostParametersSection
        {...baseProps()}
        amortizedMaintenancePerHour={{ amortizedPerHour: 0.35 }}
        onApplyAmortizedMaintenance={onApplyAmortizedMaintenance}
      />
    );
    expect(container!.textContent).toContain('Amortized: $0.35/hr');
    const applyButtons = Array.from(container!.querySelectorAll('button')).filter(b => b.textContent === 'Apply');
    expect(applyButtons.length).toBeGreaterThan(0);
    act(() => {
      applyButtons[applyButtons.length - 1].click();
    });
    expect(onApplyAmortizedMaintenance).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('calls onMaintenanceCostPerHourChange when the maintenance-cost input changes', () => {
    const onMaintenanceCostPerHourChange = vi.fn();
    mount(
      <CostParametersSection
        {...baseProps()}
        onMaintenanceCostPerHourChange={onMaintenanceCostPerHourChange}
      />
    );
    const input = container!.querySelector('#maintenance-cost-per-hour') as HTMLInputElement;
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      nativeSetter.call(input, '2.5');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onMaintenanceCostPerHourChange).toHaveBeenCalledWith(2.5);
    unmount();
  });

  it('imports NO db/useLiveQuery/hook (props-in/callbacks-out contract preserved)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(__dirname, './CostParametersSection.tsx'),
      'utf-8'
    );
    expect(source).not.toMatch(/useLiveQuery|from '\.\.\/\.\.\/db\/database'|useFailureRate|useTouTariff|useMaintenanceAmortization/);
  });
});
