import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Quote } from '../types';

// ---------------------------------------------------------------------------
// JobsManager Orders section — Phase 16 second extension (D-23..D-32).
//
// Tests target the exported subcomponents OrdersQuoteRows (per-job
// Pending+Declined Quote rows) and SaleFromQuoteSubtext (informational
// `from Q-NNNN` text on Sale rows). Mocking useQuotes lets us drive the
// section's state without standing up the full JobsManager + react-window
// stack.
// ---------------------------------------------------------------------------

const updateQuoteSpy = vi.fn<(quote: Quote) => Promise<void>>();
let quotesFixture: Quote[] = [];

vi.mock('../hooks/useDatabase', () => ({
  useQuotes: () => {
    const quotesByJobId = new Map<string, Quote[]>();
    for (const q of quotesFixture) {
      const list = quotesByJobId.get(q.printJobId);
      if (list) list.push(q);
      else quotesByJobId.set(q.printJobId, [q]);
    }
    return {
      quotes: quotesFixture,
      quotesByJobId,
      isLoading: false,
      addQuote: vi.fn(),
      updateQuote: updateQuoteSpy,
      deleteQuote: vi.fn(),
      createQuote: vi.fn(),
    };
  },
  useCustomers: () => ({
    customers: [],
    customersByEmail: new Map(),
    isLoading: false,
    addCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
    bumpLastUsed: vi.fn(),
    bulkImportCustomers: vi.fn(),
  }),
  useSales: () => ({
    sales: [],
    addSale: vi.fn(),
    updateSale: vi.fn(),
    deleteSale: vi.fn(),
  }),
}));

const { OrdersQuoteRows, SaleFromQuoteSubtext } = await import('./JobsManager');

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  const now = new Date('2026-05-23T12:00:00Z');
  return {
    id: 'quote-' + Math.random().toString(36).slice(2, 9),
    quoteNumber: 1,
    printJobId: 'job-1',
    customerId: undefined,
    customerSnapshot: { name: 'Alice', email: 'alice@example.com' },
    lineItemsSnapshot: {
      jobTitle: 'Test',
      sellingPrice: 100,
      shippingCost: 0,
      resolvedTaxRate: 0,
      taxAmount: 0,
      currency: 'USD',
      notes: '',
      terms: '',
      countryAtSendTime: undefined,
    },
    status: 'sent',
    createdAt: now,
    sentAt: now,
    ...overrides,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  updateQuoteSpy.mockReset();
  updateQuoteSpy.mockImplementation(() => Promise.resolve());
  quotesFixture = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) { act(() => { root!.unmount(); }); root = null; }
  if (container) { container.remove(); container = null; }
});

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(container!.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === text,
  ) as HTMLButtonElement | undefined;
}

// ---------------------------------------------------------------------------
// OrdersQuoteRows — D-23 + D-24 + D-26
// ---------------------------------------------------------------------------

describe('OrdersQuoteRows — visibility & filtering (D-23, D-24, D-26)', () => {
  it('renders nothing when the job has no quotes', async () => {
    quotesFixture = [];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" />); });
    expect(container!.textContent ?? '').toBe('');
  });

  it("filters out 'converted' quotes (D-26 — represented by their Sale row, not a separate row)", async () => {
    quotesFixture = [makeQuote({ status: 'converted', quoteNumber: 99, convertedAt: new Date(), convertedToSaleId: 's-1' })];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" />); });
    expect(container!.textContent ?? '').toBe('');
  });

  it("filters out legacy 'draft' rows (G6 migration-only)", async () => {
    quotesFixture = [makeQuote({ status: 'draft', quoteNumber: 88 })];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" />); });
    expect(container!.textContent ?? '').toBe('');
  });

  it('renders Pending pill for status=sent', async () => {
    quotesFixture = [makeQuote({ status: 'sent', quoteNumber: 1 })];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" />); });
    expect(container!.textContent ?? '').toContain('Pending');
  });

  it("renders Pending pill for legacy status=accepted (D-24 — 'accepted' is no longer a distinct UI state)", async () => {
    quotesFixture = [makeQuote({ status: 'accepted', quoteNumber: 2 })];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" />); });
    expect(container!.textContent ?? '').toContain('Pending');
  });

  it('renders Declined pill for status=declined', async () => {
    quotesFixture = [makeQuote({ status: 'declined', quoteNumber: 3 })];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" />); });
    expect(container!.textContent ?? '').toContain('Declined');
  });
});

describe('OrdersQuoteRows — Pending row actions (D-25, D-29)', () => {
  it("Mark Accepted button is GONE (D-25 — removed entirely)", async () => {
    quotesFixture = [makeQuote({ status: 'sent' })];
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" onStartConversion={vi.fn()} onEditQuote={vi.fn()} onDeclineQuote={vi.fn()} />);
    });
    expect(buttonByText('Mark Accepted')).toBeUndefined();
  });

  it('Convert to Sale is ENABLED when onStartConversion provided; click fires it with the Quote', async () => {
    const quote = makeQuote({ id: 'q-aa', status: 'sent', quoteNumber: 5 });
    quotesFixture = [quote];
    const onStartConversion = vi.fn();
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" onStartConversion={onStartConversion} />);
    });
    const btn = buttonByText('Convert to Sale');
    expect(btn).toBeDefined();
    expect(btn!.disabled).toBe(false);
    await act(async () => { btn!.click(); });
    expect(onStartConversion).toHaveBeenCalledTimes(1);
    expect(onStartConversion.mock.calls[0][0].id).toBe('q-aa');
  });

  it("Convert to Sale stays DISABLED when onStartConversion is not provided", async () => {
    quotesFixture = [makeQuote({ status: 'sent' })];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" />); });
    const btn = buttonByText('Convert to Sale');
    expect(btn).toBeDefined();
    expect(btn!.disabled).toBe(true);
  });

  it("Overflow menu exposes Edit Quote + Mark Declined (D-29); clicking each fires the right callback", async () => {
    const quote = makeQuote({ id: 'q-bb', status: 'sent' });
    quotesFixture = [quote];
    const onEditQuote = vi.fn();
    const onDeclineQuote = vi.fn();
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" onStartConversion={vi.fn()} onEditQuote={onEditQuote} onDeclineQuote={onDeclineQuote} />);
    });
    const moreBtn = Array.from(container!.querySelectorAll('button')).find(
      (b) => (b.getAttribute('aria-label') ?? '') === 'More actions',
    ) as HTMLButtonElement;
    expect(moreBtn).toBeDefined();
    await act(async () => { moreBtn.click(); });

    const editItem = buttonByText('Edit Quote');
    const declineItem = buttonByText('Mark Declined');
    expect(editItem).toBeDefined();
    expect(declineItem).toBeDefined();

    await act(async () => { editItem!.click(); });
    expect(onEditQuote).toHaveBeenCalledTimes(1);
    expect(onEditQuote.mock.calls[0][0].id).toBe('q-bb');

    // Reopen menu, click Mark Declined
    await act(async () => { moreBtn.click(); });
    const declineItem2 = buttonByText('Mark Declined');
    await act(async () => { declineItem2!.click(); });
    expect(onDeclineQuote).toHaveBeenCalledTimes(1);
    expect(onDeclineQuote.mock.calls[0][0].id).toBe('q-bb');
  });
});

describe('OrdersQuoteRows — Declined row (D-28, D-29)', () => {
  it('Declined row shows Reason sub-line when declineReason is set', async () => {
    quotesFixture = [makeQuote({ status: 'declined', declineReason: 'Too expensive' })];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" />); });
    expect(container!.textContent ?? '').toContain('Reason: Too expensive');
  });

  it('Declined row WITHOUT declineReason omits the Reason sub-line', async () => {
    quotesFixture = [makeQuote({ status: 'declined' })];  // no declineReason
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" />); });
    expect(container!.textContent ?? '').not.toContain('Reason:');
  });

  it("Reopen click clears declineReason + decisionAt and sets status='sent'", async () => {
    const declined = makeQuote({
      status: 'declined',
      decisionAt: new Date('2026-04-01'),
      declineReason: 'No budget',
    });
    quotesFixture = [declined];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" />); });
    const btn = buttonByText('Reopen');
    expect(btn).toBeDefined();
    await act(async () => { btn!.click(); });
    expect(updateQuoteSpy).toHaveBeenCalledTimes(1);
    const payload = updateQuoteSpy.mock.calls[0][0];
    expect(payload.status).toBe('sent');
    expect(payload.decisionAt).toBeUndefined();
    expect(payload.declineReason).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SaleFromQuoteSubtext — D-30 (informational, not clickable)
// ---------------------------------------------------------------------------

describe('SaleFromQuoteSubtext — D-30 (informational, not interactive)', () => {
  it("renders 'from Q-NNNN · Quoted {relative}' as plain text", async () => {
    const q = makeQuote({ id: 'q-xyz', quoteNumber: 7, status: 'converted', convertedToSaleId: 'sale-7' });
    quotesFixture = [q];
    await act(async () => {
      root!.render(<SaleFromQuoteSubtext convertedFromQuoteId="q-xyz" jobId="job-1" />);
    });
    expect(container!.textContent ?? '').toContain('from Q-0007');
    expect(container!.textContent ?? '').toContain('Quoted');
  });

  it("is plain text (NOT a button) — D-30 lock", async () => {
    const q = makeQuote({ id: 'q-xyz', quoteNumber: 7 });
    quotesFixture = [q];
    await act(async () => {
      root!.render(<SaleFromQuoteSubtext convertedFromQuoteId="q-xyz" jobId="job-1" />);
    });
    expect(container!.querySelector('button')).toBeNull();
    expect(container!.querySelector('a')).toBeNull();
  });

  it("data anomaly (Quote deleted) → renders nothing", async () => {
    quotesFixture = [];
    await act(async () => {
      root!.render(<SaleFromQuoteSubtext convertedFromQuoteId="q-missing" jobId="job-1" />);
    });
    expect(container!.textContent ?? '').toBe('');
  });
});
