import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { GeneratePdfButton } from './CostCalculator';
import type { PrintJob } from '../types';

// ---------------------------------------------------------------------------
// CostCalculator — Generate PDF button disabled-state tests
// Tests use the extracted GeneratePdfButton subcomponent which has a focused
// prop surface (editingJob, sellingPrice, isGenerating, onGenerate) to avoid
// mounting the full CostCalculator prop surface.
// ---------------------------------------------------------------------------

// Minimal PrintJob fixture for testing disabled-state
const makeJob = (overrides: Partial<PrintJob> = {}): PrintJob => ({
  id: 'test-job-1',
  name: 'Test Print',
  createdAt: new Date(),
  updatedAt: new Date(),
  filaments: [],
  printTimeHours: 1,
  printerInstanceId: 'printer-1',
  modelCost: 0,
  prepTimeMinutes: 0,
  postProcessingMinutes: 0,
  materialsUsed: [],
  failureRate: 5,
  costPerUnit: 2.50,
  sellingPrice: 5.00,
  copiesSold: 0,
  ...overrides,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

describe('CostCalculator — Generate PDF button', () => {
  it('disables Generate PDF button when no editingJob is provided', () => {
    act(() => {
      root.render(
        <GeneratePdfButton
          editingJob={null}
          sellingPrice={10}
          isGenerating={false}
          onGenerate={vi.fn()}
        />
      );
    });
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(true);
  });

  it('disables Generate PDF button when sellingPrice is 0', () => {
    act(() => {
      root.render(
        <GeneratePdfButton
          editingJob={makeJob()}
          sellingPrice={0}
          isGenerating={false}
          onGenerate={vi.fn()}
        />
      );
    });
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(true);
  });

  it('enables Generate PDF button when editingJob is set AND sellingPrice > 0', () => {
    act(() => {
      root.render(
        <GeneratePdfButton
          editingJob={makeJob()}
          sellingPrice={5.00}
          isGenerating={false}
          onGenerate={vi.fn()}
        />
      );
    });
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(false);
  });

  it('shows "Set a selling price first" title when sellingPrice <= 0', () => {
    act(() => {
      root.render(
        <GeneratePdfButton
          editingJob={makeJob()}
          sellingPrice={0}
          isGenerating={false}
          onGenerate={vi.fn()}
        />
      );
    });
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn!.title).toBe('Set a selling price first');
  });
});
