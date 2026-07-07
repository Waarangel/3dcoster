import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { PrinterSettings } from './PrinterSettings';
import { ToastProvider } from './ui';
import { db } from '../db/database';
import type { PrinterConfig, PrinterInstance } from '../types';

// ---------------------------------------------------------------------------
// PrinterSettings — the "add a custom printer model" flow (the new capability
// that lets users add a printer not in the default catalog). Raw createRoot +
// act per project precedent (RecordSaleModal.test.tsx).
// ---------------------------------------------------------------------------

const sampleModel: PrinterConfig = {
  id: 'bambu-p1s',
  name: 'Bambu Lab P1S',
  purchasePrice: 699,
  expectedLifespanHours: 6000,
  wattage: 100,
  nozzleCost: 8,
  nozzleLifespanCm3: 15000,
};

let container: HTMLDivElement;
let root: Root;

function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function setSelectValue(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(async () => {
  await db.maintenanceEvents.clear();
  await db.jobs.clear();
  await db.materials.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function waitForAsync() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

const sampleInstance: PrinterInstance = {
  id: 'inst-1',
  printerConfigId: 'bambu-p1s',
  nickname: 'Office A1',
  printHours: 100,
};

function renderSettings(onAddPrinter: (c: PrinterConfig) => void) {
  act(() => {
    root.render(
      <ToastProvider>
        <PrinterSettings
          printers={[sampleModel]}
          printerInstances={[]}
          isLoading={false}
          jobs={[]}
          userCurrency="USD"
          onAddInstance={() => {}}
          onUpdateInstance={() => {}}
          onDeleteInstance={() => {}}
          onAddPrinter={onAddPrinter}
        />
      </ToastProvider>
    );
  });
}

describe('PrinterSettings — add custom printer model', () => {
  it('saves a custom model via onAddPrinter with the entered specs and a custom- id', () => {
    const onAddPrinter = vi.fn();
    renderSettings(onAddPrinter);

    // Open the "Add Printer" form.
    const addBtn = [...container.querySelectorAll('button')].find((b) => /add printer/i.test(b.textContent || ''))!;
    act(() => addBtn.click());

    // Choose "Add a custom model…" in the Printer Model dropdown.
    const select = container.querySelector('select') as HTMLSelectElement;
    const customOption = [...select.options].find((o) => /custom model/i.test(o.textContent || ''))!;
    expect(customOption).toBeTruthy();
    act(() => setSelectValue(select, customOption.value));

    // The custom-model panel appears with 4 inputs (name, wattage, price, lifespan).
    const panel = [...container.querySelectorAll('div')].find(
      (d) => d.textContent?.includes('New Custom Model') && d.className.includes('border-blue-500')
    ) as HTMLDivElement;
    expect(panel).toBeTruthy();
    const inputs = panel.querySelectorAll('input');
    expect(inputs.length).toBe(4);

    act(() => {
      setInputValue(inputs[0] as HTMLInputElement, 'Sovol SV08');
      setInputValue(inputs[1] as HTMLInputElement, '170');
      setInputValue(inputs[2] as HTMLInputElement, '599');
      setInputValue(inputs[3] as HTMLInputElement, '5000');
    });

    const saveBtn = [...panel.querySelectorAll('button')].find((b) => /save model/i.test(b.textContent || ''))!;
    act(() => saveBtn.click());

    expect(onAddPrinter).toHaveBeenCalledTimes(1);
    const config = onAddPrinter.mock.calls[0][0] as PrinterConfig;
    expect(config.name).toBe('Sovol SV08');
    expect(config.wattage).toBe(170);
    expect(config.purchasePrice).toBe(599);
    expect(config.expectedLifespanHours).toBe(5000);
    expect(config.nozzleCost).toBeGreaterThan(0);
    expect(config.nozzleLifespanCm3).toBeGreaterThan(0);
    expect(config.id.startsWith('custom-')).toBe(true);
  });

  it('keeps Save Model disabled until the required fields are valid', () => {
    const onAddPrinter = vi.fn();
    renderSettings(onAddPrinter);

    const addBtn = [...container.querySelectorAll('button')].find((b) => /add printer/i.test(b.textContent || ''))!;
    act(() => addBtn.click());
    const select = container.querySelector('select') as HTMLSelectElement;
    const customOption = [...select.options].find((o) => /custom model/i.test(o.textContent || ''))!;
    act(() => setSelectValue(select, customOption.value));

    const panel = [...container.querySelectorAll('div')].find(
      (d) => d.textContent?.includes('New Custom Model') && d.className.includes('border-blue-500')
    ) as HTMLDivElement;
    const saveBtn = [...panel.querySelectorAll('button')].find((b) => /save model/i.test(b.textContent || '')) as HTMLButtonElement;

    // Nothing filled yet → disabled.
    expect(saveBtn.disabled).toBe(true);
    act(() => saveBtn.click());
    expect(onAddPrinter).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Phase 39 WEAR-01/02 (Plan 04 Task 2) — per-printer Maintenance drill-in.
// ---------------------------------------------------------------------------

function renderSettingsWithInstance(onUpdateInstance: (i: PrinterInstance) => void = () => {}) {
  act(() => {
    root.render(
      <ToastProvider>
        <PrinterSettings
          printers={[sampleModel]}
          printerInstances={[sampleInstance]}
          isLoading={false}
          jobs={[]}
          userCurrency="USD"
          onAddInstance={() => {}}
          onUpdateInstance={onUpdateInstance}
          onDeleteInstance={() => {}}
          onAddPrinter={() => {}}
        />
      </ToastProvider>
    );
  });
}

function openMaintenanceSection() {
  const maintenanceToggle = [...container.querySelectorAll('button')].find(
    (b) => /maintenance/i.test(b.textContent || '') && b.getAttribute('aria-expanded') !== null
  )!;
  act(() => maintenanceToggle.click());
  return maintenanceToggle;
}

describe('PrinterSettings — Maintenance drill-in', () => {
  it('each instance card shows a Maintenance section with a log button', async () => {
    renderSettingsWithInstance();
    await waitForAsync();

    openMaintenanceSection();
    const logBtn = [...container.querySelectorAll('button')].find((b) => /log maintenance/i.test(b.textContent || ''));
    expect(logBtn).toBeTruthy();
  });

  it('a printer with no events shows next-swap prediction as unavailable (500h fallback owns it)', async () => {
    renderSettingsWithInstance();
    await waitForAsync();

    openMaintenanceSection();
    expect(container.textContent).toContain('Not enough history yet');
  });

  it('shows event history, cumulative cost, and abrasive-hours once events exist', async () => {
    await db.maintenanceEvents.add({
      id: 'evt-1',
      printerInstanceId: 'inst-1',
      partType: 'nozzle',
      cost: 12,
      occurredAt: new Date('2026-01-01'),
      printerHoursAtEvent: 50,
    });

    renderSettingsWithInstance();
    await waitForAsync();

    openMaintenanceSection();
    expect(container.textContent).toMatch(/Nozzle/);
    expect(container.textContent).toMatch(/Cumulative maintenance cost/);
  });

  it('per-event delete uses a labelled icon button (DeleteButton, not raw button)', async () => {
    await db.maintenanceEvents.add({
      id: 'evt-1',
      printerInstanceId: 'inst-1',
      partType: 'belt',
      cost: 8,
      occurredAt: new Date('2026-01-01'),
      printerHoursAtEvent: 20,
    });

    renderSettingsWithInstance();
    await waitForAsync();

    openMaintenanceSection();
    const deleteBtn = [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Delete Belt maintenance event'
    );
    expect(deleteBtn).toBeTruthy();
  });
});
