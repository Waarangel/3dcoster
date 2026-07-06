import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { LogMaintenanceModal } from './LogMaintenanceModal';
import type { PrinterInstance } from '../types';

// ---------------------------------------------------------------------------
// LogMaintenanceModal — Phase 39 Plan 04 Task 2. Raw createRoot + act per
// project precedent (RecordSaleModal.test.tsx).
// ---------------------------------------------------------------------------

const INSTANCE: PrinterInstance = {
  id: 'inst-1',
  printerConfigId: 'cfg-1',
  nickname: 'Office A1',
  printHours: 250,
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

function renderModal(
  onLogMaintenanceEvent = vi.fn().mockResolvedValue('maint-1'),
  onUpdateInstanceNozzleType = vi.fn(),
  onClose = vi.fn(),
) {
  act(() => {
    root.render(
      <LogMaintenanceModal
        isOpen={true}
        onClose={onClose}
        instance={INSTANCE}
        onLogMaintenanceEvent={onLogMaintenanceEvent}
        onUpdateInstanceNozzleType={onUpdateInstanceNozzleType}
      />
    );
  });
  return { onLogMaintenanceEvent, onUpdateInstanceNozzleType, onClose };
}

describe('LogMaintenanceModal', () => {
  it('renders partType, cost, date, and printer-hours-at-event fields', () => {
    renderModal();
    const selects = document.body.querySelectorAll('select');
    const inputs = document.body.querySelectorAll('input');
    expect(selects.length).toBeGreaterThanOrEqual(2); // partType + nozzleType (default partType is nozzle)
    expect(inputs.length).toBeGreaterThanOrEqual(3); // cost, date, hours
  });

  it('pre-fills printer-hours-at-event with the instance current printHours', () => {
    renderModal();
    const hoursInput = [...document.body.querySelectorAll('input')].find(
      i => i.type === 'number' && Number(i.value) === 250
    );
    expect(hoursInput).toBeTruthy();
  });

  it('shows a nozzleType Select only when partType is nozzle', () => {
    renderModal();
    // Default partType is 'nozzle' — nozzleType select present.
    let selects = document.body.querySelectorAll('select');
    expect(selects.length).toBe(2);

    // Switch partType to 'belt' — nozzleType select should disappear.
    const partTypeSelect = selects[0] as HTMLSelectElement;
    act(() => setSelectValue(partTypeSelect, 'belt'));

    selects = document.body.querySelectorAll('select');
    expect(selects.length).toBe(1);
  });

  it('submit calls onLogMaintenanceEvent with the form values', async () => {
    const { onLogMaintenanceEvent } = renderModal();

    const costInput = [...document.body.querySelectorAll('input')].find(i => i.type === 'number' && Number(i.value) === 0) as HTMLInputElement;
    act(() => setInputValue(costInput, '15'));

    const saveBtn = [...document.body.querySelectorAll('button')].find(b => /save/i.test(b.textContent || ''))!;
    await act(async () => { saveBtn.click(); });

    expect(onLogMaintenanceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        printerInstanceId: 'inst-1',
        partType: 'nozzle',
        cost: 15,
        printerHoursAtEvent: 250,
        nozzleType: 'brass',
      })
    );
  });

  it('updates the instance nozzleType on a nozzle-swap submit', async () => {
    const { onUpdateInstanceNozzleType } = renderModal();

    const nozzleTypeSelect = document.body.querySelectorAll('select')[1] as HTMLSelectElement;
    act(() => setSelectValue(nozzleTypeSelect, 'hardened'));

    const saveBtn = [...document.body.querySelectorAll('button')].find(b => /save/i.test(b.textContent || ''))!;
    await act(async () => { saveBtn.click(); });

    expect(onUpdateInstanceNozzleType).toHaveBeenCalledWith('inst-1', 'hardened');
  });

  it('does not update instance nozzleType for a non-nozzle part swap', async () => {
    const { onUpdateInstanceNozzleType } = renderModal();

    const partTypeSelect = document.body.querySelectorAll('select')[0] as HTMLSelectElement;
    act(() => setSelectValue(partTypeSelect, 'belt'));

    const saveBtn = [...document.body.querySelectorAll('button')].find(b => /save/i.test(b.textContent || ''))!;
    await act(async () => { saveBtn.click(); });

    expect(onUpdateInstanceNozzleType).not.toHaveBeenCalled();
  });
});
