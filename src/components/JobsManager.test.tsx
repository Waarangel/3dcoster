import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Quote } from '../types';

// ---------------------------------------------------------------------------
// JobsManager Recent Quotes — Phase 16 gap closure plan 16-11 (D-19).
//
// Tests target the inline subcomponents `RecentQuotesSection` and
// `SaleBackRefLink` (exported from JobsManager.tsx specifically for this
// test file). Mocking useQuotes lets us drive the section's state without
// standing up the full JobsManager + react-window stack.
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

const { RecentQuotesSection, SaleBackRefLink } = await import('./JobsManager');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

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
    (b) => b.textContent?.trim() === text,
  ) as HTMLButtonElement | undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecentQuotesSection — zero-quotes hidden (D-19)', () => {
  it('renders nothing when the job has no quotes', async () => {
    quotesFixture = [];
    await act(async () => { root!.render(<RecentQuotesSection jobId="job-1" />); });
    expect(container!.textContent ?? '').not.toContain('Recent Quotes');
  });

  it("filters out legacy 'draft' rows from the v7→v8 backfill (G6 lock)", async () => {
    quotesFixture = [makeQuote({ status: 'draft', quoteNumber: 99 })];
    await act(async () => { root!.render(<RecentQuotesSection jobId="job-1" />); });
    // Only a 'draft' row exists → section hides entirely.
    expect(container!.textContent ?? '').not.toContain('Recent Quotes');
    expect(container!.textContent ?? '').not.toContain('Q-0099');
  });
});

describe('RecentQuotesSection — status pills', () => {
  it('renders all 4 visible statuses with correct pill labels', async () => {
    quotesFixture = [
      makeQuote({ quoteNumber: 1, status: 'sent' }),
      makeQuote({ quoteNumber: 2, status: 'accepted' }),
      makeQuote({ quoteNumber: 3, status: 'declined' }),
      makeQuote({ quoteNumber: 4, status: 'converted', convertedAt: new Date('2026-05-22'), convertedToSaleId: 'sale-99' }),
    ];
    await act(async () => { root!.render(<RecentQuotesSection jobId="job-1" />); });
    const text = container!.textContent ?? '';
    expect(text).toContain('Sent');
    expect(text).toContain('Accepted');
    expect(text).toContain('Declined');
    expect(text).toContain('Converted');
  });
});

describe('RecentQuotesSection — status transitions', () => {
  it("Mark Accepted writes { status: 'accepted', decisionAt: <Date> }", async () => {
    const sentQuote = makeQuote({ status: 'sent' });
    quotesFixture = [sentQuote];
    await act(async () => { root!.render(<RecentQuotesSection jobId="job-1" />); });
    const btn = buttonByText('Mark Accepted');
    expect(btn).toBeDefined();
    await act(async () => { btn!.click(); });
    expect(updateQuoteSpy).toHaveBeenCalledTimes(1);
    const payload = updateQuoteSpy.mock.calls[0][0];
    expect(payload.id).toBe(sentQuote.id);
    expect(payload.status).toBe('accepted');
    expect(payload.decisionAt).toBeInstanceOf(Date);
  });

  it("Mark Declined writes { status: 'declined', decisionAt: <Date> }", async () => {
    const sentQuote = makeQuote({ status: 'sent' });
    quotesFixture = [sentQuote];
    await act(async () => { root!.render(<RecentQuotesSection jobId="job-1" />); });
    const btn = buttonByText('Mark Declined');
    expect(btn).toBeDefined();
    await act(async () => { btn!.click(); });
    expect(updateQuoteSpy).toHaveBeenCalledTimes(1);
    expect(updateQuoteSpy.mock.calls[0][0].status).toBe('declined');
    expect(updateQuoteSpy.mock.calls[0][0].decisionAt).toBeInstanceOf(Date);
  });

  it("Reopen on a declined quote clears decisionAt and resets status to 'sent'", async () => {
    const declined = makeQuote({ status: 'declined', decisionAt: new Date('2026-04-01') });
    quotesFixture = [declined];
    await act(async () => { root!.render(<RecentQuotesSection jobId="job-1" />); });
    const btn = buttonByText('Reopen');
    expect(btn).toBeDefined();
    await act(async () => { btn!.click(); });
    expect(updateQuoteSpy).toHaveBeenCalledTimes(1);
    expect(updateQuoteSpy.mock.calls[0][0].status).toBe('sent');
    expect(updateQuoteSpy.mock.calls[0][0].decisionAt).toBeUndefined();
  });

  it("Convert to Sale on an accepted quote is DISABLED (plan 16-12 wires the action)", async () => {
    quotesFixture = [makeQuote({ status: 'accepted' })];
    await act(async () => { root!.render(<RecentQuotesSection jobId="job-1" />); });
    const btn = buttonByText('Convert to Sale');
    expect(btn).toBeDefined();
    expect(btn!.disabled).toBe(true);
  });
});

describe('Convert to Sale (D-20)', () => {
  it("Convert to Sale button is ENABLED on accepted Quote when onStartConversion is provided", async () => {
    quotesFixture = [makeQuote({ status: 'accepted', quoteNumber: 5 })];
    const onStartConversion = vi.fn();
    await act(async () => {
      root!.render(<RecentQuotesSection jobId="job-1" onStartConversion={onStartConversion} />);
    });
    const btn = buttonByText('Convert to Sale');
    expect(btn).toBeDefined();
    expect(btn!.disabled).toBe(false);
  });

  it("Convert to Sale click fires onStartConversion with the Quote", async () => {
    const quote = makeQuote({ id: 'quote-aa', status: 'accepted', quoteNumber: 5 });
    quotesFixture = [quote];
    const onStartConversion = vi.fn();
    await act(async () => {
      root!.render(<RecentQuotesSection jobId="job-1" onStartConversion={onStartConversion} />);
    });
    const btn = buttonByText('Convert to Sale');
    await act(async () => { btn!.click(); });
    expect(onStartConversion).toHaveBeenCalledTimes(1);
    expect(onStartConversion.mock.calls[0][0].id).toBe('quote-aa');
    expect(onStartConversion.mock.calls[0][0].quoteNumber).toBe(5);
  });

  it("Convert to Sale stays DISABLED when onStartConversion is not provided (backwards-compat with plan 16-11 default)", async () => {
    quotesFixture = [makeQuote({ status: 'accepted' })];
    await act(async () => {
      root!.render(<RecentQuotesSection jobId="job-1" />);
    });
    const btn = buttonByText('Convert to Sale');
    expect(btn).toBeDefined();
    expect(btn!.disabled).toBe(true);
  });

  it.todo("transactional rollback (db.transaction rolls back both Sale and Quote on failure) — verified by plan 16-13 UAT integration coverage (requires fake-indexeddb to mock cleanly)");
});

describe('SaleBackRefLink — D-19', () => {
  it("renders '← Q-NNNN' when a Quote with the convertedFromQuoteId exists", async () => {
    const q = makeQuote({ id: 'quote-xyz', quoteNumber: 7, status: 'converted', convertedToSaleId: 'sale-7' });
    quotesFixture = [q];
    await act(async () => {
      root!.render(<SaleBackRefLink convertedFromQuoteId="quote-xyz" jobId="job-1" />);
    });
    expect(container!.textContent ?? '').toContain('← Q-0007');
  });

  it("data anomaly (Quote deleted) → renders NOTHING rather than a broken link", async () => {
    quotesFixture = [];  // the referenced quote doesn't exist
    await act(async () => {
      root!.render(<SaleBackRefLink convertedFromQuoteId="quote-missing" jobId="job-1" />);
    });
    expect(container!.textContent ?? '').toBe('');
    expect(container!.querySelector('button')).toBeNull();
  });
});
