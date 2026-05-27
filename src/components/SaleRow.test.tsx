import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Sale } from '../types';
import { SaleRow } from './SaleRow';

// ---------------------------------------------------------------------------
// SaleRow smoke test — Phase 22 plan 22-04 (ROADMAP success criterion #6).
//
// Proves SaleRow is genuinely "standalone testable": mounts in isolation
// (no JobsManager context, no useQuotes mock required because fixture
// omits convertedFromQuoteId → SaleFromQuoteSubtext never renders).
//
// Three assertions:
//   1. <details> element renders
//   2. summary text contains the formatted "{quantity}x @ ${price}" label
//   3. clicking Edit invokes onEdit(sale) exactly once
//
// Convention: raw createRoot + act (no RTL dependency) — mirrors
// PrintQuoteModal.test.tsx and JobsManager.test.tsx.
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

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-test-1',
    jobId: 'j1',
    quantity: 2,
    unitPrice: 12.50,
    totalRevenue: 25.00,
    soldAt: new Date('2026-01-15T00:00:00Z'),
    ...overrides,
  } as Sale;
}

function mountSaleRow(opts: { sale?: Sale; onEdit?: (s: Sale) => void; onDelete?: (s: Sale) => void } = {}) {
  const sale = opts.sale ?? makeSale();
  const onEdit = opts.onEdit ?? vi.fn();
  const onDelete = opts.onDelete ?? vi.fn();
  act(() => {
    root!.render(<SaleRow sale={sale} jobId="j1" onEdit={onEdit} onDelete={onDelete} />);
  });
  return { sale, onEdit, onDelete };
}

describe('SaleRow', () => {
  it('renders a <details> element when mounted with a valid Sale fixture', () => {
    mountSaleRow();
    const details = container!.querySelector('details');
    expect(details).not.toBeNull();
  });

  it('summary text contains the formatted "{quantity}x @ ${price}" label', () => {
    mountSaleRow({ sale: makeSale({ quantity: 2, unitPrice: 12.50 }) });
    const summary = container!.querySelector('summary');
    expect(summary).not.toBeNull();
    // Live code format (SaleRow.tsx): `${sale.quantity}x @ $${sale.unitPrice.toFixed(2)}`
    // For quantity=2, unitPrice=12.50 → "2x @ $12.50"
    expect(summary!.textContent).toContain('2x @ $12.50');
  });

  it('invokes onEdit with the sale when the Edit button is clicked', () => {
    const onEdit = vi.fn();
    const { sale } = mountSaleRow({ onEdit });

    // Expand the <details> so the Edit button is rendered + clickable.
    act(() => {
      const details = container!.querySelector('details') as HTMLDetailsElement;
      details.open = true;
    });

    // Locate the Edit button by its visible text. SaleRow renders the
    // primary Button with literal "Edit" content (per SaleRow.tsx).
    const editBtn = Array.from(container!.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Edit'
    );
    expect(editBtn).toBeDefined();

    act(() => { editBtn!.click(); });

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(sale);
  });
});
