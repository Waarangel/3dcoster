import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Quote } from '../types';
import { DeclineQuoteModal } from './DeclineQuoteModal';

// ---------------------------------------------------------------------------
// DeclineQuoteModal — Phase 16 second extension D-28.
// Captures optional free-form decline reason via a confirmation modal.
// ---------------------------------------------------------------------------

function makeQuote(): Quote {
  return {
    id: 'q-x',
    quoteNumber: 42,
    printJobId: 'job-1',
    customerId: undefined,
    customerSnapshot: { name: 'Test' },
    lineItemsSnapshot: {
      jobTitle: 'Test',
      sellingPrice: 100,
      shippingCost: 0,
      resolvedTaxRate: 0,
      taxAmount: 0,
      currency: 'USD',
      notes: '',
      terms: '',
    },
    status: 'sent',
    createdAt: new Date(),
    sentAt: new Date(),
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) { act(() => { root!.unmount(); }); root = null; }
  if (container) { container.remove(); container = null; }
});

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === text,
  ) as HTMLButtonElement | undefined;
}

function typeInto(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('DeclineQuoteModal', () => {
  it('renders nothing when quote is null', async () => {
    await act(async () => {
      root!.render(<DeclineQuoteModal quote={null} onConfirm={vi.fn()} onClose={vi.fn()} />);
    });
    // Modal portals to document.body; closed Modal renders nothing → no [role="dialog"]
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders with the quote number in the title when quote is provided', async () => {
    await act(async () => {
      root!.render(<DeclineQuoteModal quote={makeQuote()} onConfirm={vi.fn()} onClose={vi.fn()} />);
    });
    expect(document.body.textContent ?? '').toContain('Decline quote Q-0042');
  });

  it('Confirm decline with reason → onConfirm called with trimmed reason; onClose called', async () => {
    const onConfirm = vi.fn<(args: { reason: string }) => Promise<void>>().mockResolvedValue();
    const onClose = vi.fn();
    await act(async () => {
      root!.render(<DeclineQuoteModal quote={makeQuote()} onConfirm={onConfirm} onClose={onClose} />);
    });
    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => { typeInto(textarea, '  Too expensive  '); });

    const confirmBtn = buttonByText('Confirm decline');
    expect(confirmBtn).toBeDefined();
    await act(async () => { confirmBtn!.click(); });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual({ reason: 'Too expensive' });  // trimmed
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Confirm decline with no reason → onConfirm called with empty string (optional)', async () => {
    const onConfirm = vi.fn<(args: { reason: string }) => Promise<void>>().mockResolvedValue();
    await act(async () => {
      root!.render(<DeclineQuoteModal quote={makeQuote()} onConfirm={onConfirm} onClose={vi.fn()} />);
    });
    const confirmBtn = buttonByText('Confirm decline');
    await act(async () => { confirmBtn!.click(); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual({ reason: '' });
  });

  it('Cancel → onClose called; onConfirm NOT called', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root!.render(<DeclineQuoteModal quote={makeQuote()} onConfirm={onConfirm} onClose={onClose} />);
    });
    const cancelBtn = buttonByText('Cancel');
    await act(async () => { cancelBtn!.click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
