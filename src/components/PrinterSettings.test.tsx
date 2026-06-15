import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { PrinterSettings } from './PrinterSettings';
import type { PrinterConfig } from '../types';

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

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderSettings(onAddPrinter: (c: PrinterConfig) => void) {
  act(() => {
    root.render(
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
