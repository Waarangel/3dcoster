import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Quote, PrintJob, Sale, PrinterInstance, PrinterConfig, Material } from '../types';
import { reconcileFixedCostsAtSave } from '../db/backfill';

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
  // D-24 / Pitfall 4: useAllSales returns a plain Sale[] (NOT { sales: [] }) —
  // mirrors the production hook contract in useDatabase.ts. Getting the shape
  // wrong here surfaces as `TypeError: useAllSales is not a function` or
  // runtime errors when JobsManager destructures non-existent properties.
  useAllSales: () => [],
}));

// Mock the Dexie db so JobCard's onSaveTitle / onSubmitAddTag / onRemoveTag
// handlers (which call db.jobs.put inside the parent JobsManager) can be
// observed without standing up a real IndexedDB.
const dbJobsPutSpy = vi.fn<(job: PrintJob) => Promise<void>>().mockResolvedValue();
vi.mock('../db/database', () => ({ db: { jobs: { put: dbJobsPutSpy } } }));

const {
  OrdersQuoteRows,
  JobCard,
  ADD_TAG_PLACEHOLDER,
  computeBreakEvenInfo,
} = await import('./JobsManager');
const { JobsSummaryBar, FX_UNAVAILABLE_TITLE } = await import('./JobsSummaryBar');
const { computeJobsAggregates, formatFilament, formatHours } = await import('../utils/jobsAggregates');
const { SaleFromQuoteSubtext } = await import('./SaleRow');

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
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[]} updateQuote={updateQuoteSpy} />); });
    expect(container!.textContent ?? '').toBe('');
  });

  it("filters out 'converted' quotes (D-26 — represented by their Sale row, not a separate row)", async () => {
    const q = makeQuote({ status: 'converted', quoteNumber: 99, convertedAt: new Date(), convertedToSaleId: 's-1' });
    quotesFixture = [q];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} />); });
    expect(container!.textContent ?? '').toBe('');
  });

  it("filters out legacy 'draft' rows (G6 migration-only)", async () => {
    const q = makeQuote({ status: 'draft', quoteNumber: 88 });
    quotesFixture = [q];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} />); });
    expect(container!.textContent ?? '').toBe('');
  });

  it('renders Pending pill for status=sent', async () => {
    const q = makeQuote({ status: 'sent', quoteNumber: 1 });
    quotesFixture = [q];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} />); });
    expect(container!.textContent ?? '').toContain('Pending');
  });

  it("renders Pending pill for legacy status=accepted (D-24 — 'accepted' is no longer a distinct UI state)", async () => {
    const q = makeQuote({ status: 'accepted', quoteNumber: 2 });
    quotesFixture = [q];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} />); });
    expect(container!.textContent ?? '').toContain('Pending');
  });

  it('renders Declined pill for status=declined', async () => {
    const q = makeQuote({ status: 'declined', quoteNumber: 3 });
    quotesFixture = [q];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} />); });
    expect(container!.textContent ?? '').toContain('Declined');
  });
});

describe('OrdersQuoteRows — Pending row actions (D-25, D-29)', () => {
  it("Mark Accepted button is GONE (D-25 — removed entirely)", async () => {
    const q = makeQuote({ status: 'sent' });
    quotesFixture = [q];
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} onStartConversion={vi.fn()} onEditQuote={vi.fn()} onDeclineQuote={vi.fn()} />);
    });
    expect(buttonByText('Mark Accepted')).toBeUndefined();
  });

  it('Convert to Sale is ENABLED when onStartConversion provided; click fires it with the Quote', async () => {
    const quote = makeQuote({ id: 'q-aa', status: 'sent', quoteNumber: 5 });
    quotesFixture = [quote];
    const onStartConversion = vi.fn();
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[quote]} updateQuote={updateQuoteSpy} onStartConversion={onStartConversion} />);
    });
    const btn = buttonByText('Convert to Sale');
    expect(btn).toBeDefined();
    expect(btn!.disabled).toBe(false);
    await act(async () => { btn!.click(); });
    expect(onStartConversion).toHaveBeenCalledTimes(1);
    expect(onStartConversion.mock.calls[0][0].id).toBe('q-aa');
  });

  it("Convert to Sale stays DISABLED when onStartConversion is not provided", async () => {
    const q = makeQuote({ status: 'sent' });
    quotesFixture = [q];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} />); });
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
      root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[quote]} updateQuote={updateQuoteSpy} onStartConversion={vi.fn()} onEditQuote={onEditQuote} onDeclineQuote={onDeclineQuote} />);
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
    const q = makeQuote({ status: 'declined', declineReason: 'Too expensive' });
    quotesFixture = [q];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} />); });
    expect(container!.textContent ?? '').toContain('Reason: Too expensive');
  });

  it('Declined row WITHOUT declineReason omits the Reason sub-line', async () => {
    const q = makeQuote({ status: 'declined' });  // no declineReason
    quotesFixture = [q];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} />); });
    expect(container!.textContent ?? '').not.toContain('Reason:');
  });

  it("Reopen click clears declineReason + decisionAt and sets status='sent'", async () => {
    const declined = makeQuote({
      status: 'declined',
      decisionAt: new Date('2026-04-01'),
      declineReason: 'No budget',
    });
    quotesFixture = [declined];
    await act(async () => { root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[declined]} updateQuote={updateQuoteSpy} />); });
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

// ---------------------------------------------------------------------------
// JobCard edit-in-place (Gap E) — Phase 15 Round 2
//
// Tests assert the four acceptance contract bullets (a/b/c/d) from
// 15-VERIFICATION.md "Acceptance contract for Round 2".
// ---------------------------------------------------------------------------

function makeMinimalJob(overrides: Partial<PrintJob> = {}): PrintJob {
  return {
    id: 'job-1',
    name: 'Test Job',
    createdAt: new Date('2026-05-24T00:00:00Z'),
    updatedAt: new Date('2026-05-24T00:00:00Z'),
    filaments: [],
    printTimeHours: 1,
    printerInstanceId: 'p-1',
    modelCost: 0,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    costPerUnit: 1,
    sellingPrice: 10,
    copiesSold: 0,
    tags: undefined,
    ...overrides,
  } as PrintJob;
}

function makeBreakEvenInfo() {
  return {
    revenueEarned: 0,
    profitPerUnit: 9,
    breakEvenCopies: 1,
    remainingToBreakEven: 1,
    isBreakEven: false,
  };
}

describe('JobCard edit-in-place (Gap E)', () => {
  let gapEContainer: HTMLDivElement;
  let gapERoot: Root;

  beforeEach(() => {
    gapEContainer = document.createElement('div');
    document.body.appendChild(gapEContainer);
    gapERoot = createRoot(gapEContainer);
    dbJobsPutSpy.mockClear();
  });

  afterEach(() => {
    act(() => { gapERoot.unmount(); });
    gapEContainer.remove();
  });

  function renderJobCard(opts: {
    job: PrintJob;
    isEditingTitle?: boolean;
    isAddingTag?: boolean;
    onStartEditTitle?: (jobId: string) => void;
    onStartAddTag?: (jobId: string) => void;
    onSubmitAddTag?: (job: PrintJob, tagRaw: string) => Promise<void>;
    onRemoveTag?: (job: PrintJob, tag: string) => Promise<void>;
  }) {
    const noop = () => undefined;
    const noopAsync = async () => undefined;
    act(() => {
      gapERoot.render(
        <JobCard
          job={opts.job}
          userCurrency="USD"
          isSelected={false}
          info={makeBreakEvenInfo()}
          recentSales={undefined}
          getFilamentName={() => 'PLA'}
          getQuotesForJob={() => []}
          updateQuote={updateQuoteSpy}
          onToggleSelect={noop}
          onOpenSaleForm={noop}
          onEdit={noop}
          onDelete={noop}
          onGeneratePdf={noop}
          onEditSale={noop}
          onDeleteSale={noop}
          onStartConversion={undefined}
          onEditQuote={undefined}
          onDeclineQuote={undefined}
          isEditingTitle={opts.isEditingTitle ?? false}
          onStartEditTitle={opts.onStartEditTitle ?? noop}
          onCancelEditTitle={noop}
          onSaveTitle={noopAsync}
          isAddingTag={opts.isAddingTag ?? false}
          onStartAddTag={opts.onStartAddTag ?? noop}
          onCancelAddTag={noop}
          onSubmitAddTag={opts.onSubmitAddTag ?? noopAsync}
          onRemoveTag={opts.onRemoveTag ?? noopAsync}
        />,
      );
    });
  }

  it('(a) renders an inline title input in the title row when the title button is clicked', () => {
    const job = makeMinimalJob({ name: 'Phone Stand' });
    const onStartEditTitle = vi.fn();

    // Render with isEditingTitle=false initially — title shows as button
    renderJobCard({ job, onStartEditTitle, isEditingTitle: false });

    const titleButton = gapEContainer.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit job title"]',
    );
    expect(titleButton).not.toBeNull();
    expect(titleButton?.textContent).toBe('Phone Stand');
    expect(gapEContainer.querySelector('input[aria-label="Edit job title"]')).toBeNull();

    // Click the title button — parent should be told to open the title input
    act(() => {
      titleButton!.click();
    });
    expect(onStartEditTitle).toHaveBeenCalledWith('job-1');
    expect(onStartEditTitle).toHaveBeenCalledTimes(1);

    // Re-render with isEditingTitle=true — title is now an input in the title row
    renderJobCard({ job, onStartEditTitle, isEditingTitle: true });
    const titleInput = gapEContainer.querySelector<HTMLInputElement>(
      'input[aria-label="Edit job title"]',
    );
    expect(titleInput).not.toBeNull();
    expect(titleInput?.value).toBe('Phone Stand');
    // The title button is gone — replaced in place by the input
    expect(gapEContainer.querySelector('button[aria-label="Edit job title"]')).toBeNull();
  });

  it('(b) chip ✕ button calls onRemoveTag with the chip tag', () => {
    const job = makeMinimalJob({ tags: ['pla', 'phone-stand'] });
    const onRemoveTag = vi.fn<(job: PrintJob, tag: string) => Promise<void>>().mockResolvedValue(undefined);

    renderJobCard({ job, onRemoveTag });

    // Each chip carries a ✕ button with aria-label="Remove tag <tag>"
    const removePla = gapEContainer.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove tag pla"]',
    );
    const removePhoneStand = gapEContainer.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove tag phone-stand"]',
    );
    expect(removePla).not.toBeNull();
    expect(removePhoneStand).not.toBeNull();

    act(() => {
      removePla!.click();
    });
    expect(onRemoveTag).toHaveBeenCalledWith(job, 'pla');
    expect(onRemoveTag).toHaveBeenCalledTimes(1);
  });

  it('(c) clicking + opens an inline add-tag input with the D-16 usage-suggesting placeholder', () => {
    const job = makeMinimalJob({ tags: ['pla'] });
    const onStartAddTag = vi.fn();

    // Initial render — no input visible, + button present
    renderJobCard({ job, onStartAddTag, isAddingTag: false });
    const plusButton = gapEContainer.querySelector<HTMLButtonElement>(
      'button[aria-label="Add tag"]',
    );
    expect(plusButton).not.toBeNull();
    expect(plusButton?.textContent).toBe('+');
    expect(gapEContainer.querySelector('input[aria-label="Add tag"]')).toBeNull();

    act(() => {
      plusButton!.click();
    });
    expect(onStartAddTag).toHaveBeenCalledWith('job-1');

    // Re-render with isAddingTag=true — input replaces the + button
    renderJobCard({ job, onStartAddTag, isAddingTag: true });
    const addInput = gapEContainer.querySelector<HTMLInputElement>(
      'input[aria-label="Add tag"]',
    );
    expect(addInput).not.toBeNull();
    // The placeholder uses the EXPORTED constant — we assert via the constant
    // reference so the test never duplicates the literal string.
    expect(addInput?.placeholder).toBe(ADD_TAG_PLACEHOLDER);
    // Sanity check: the constant value itself matches the Round 2 D-16 lock.
    expect(ADD_TAG_PLACEHOLDER).toBe('trending, popular, out of date');
  });

  it('(d) when job.tags.length === 10 (D-02 cap), the + add-tag affordance is hidden', () => {
    const tags = Array.from({ length: 10 }, (_, i) => `tag${i}`);
    const job = makeMinimalJob({ tags });

    renderJobCard({ job });

    // No + button, no add-tag input — the affordance is fully hidden at the cap
    expect(gapEContainer.querySelector('button[aria-label="Add tag"]')).toBeNull();
    expect(gapEContainer.querySelector('input[aria-label="Add tag"]')).toBeNull();

    // Tag icon (the empty-state affordance) is ALSO hidden — it only shows when
    // tags.length === 0, never alongside chips. At the cap, the user removes via ✕
    // before adding more.
    expect(gapEContainer.querySelector('button[aria-label="Add tag via shortcut"]')).toBeNull();

    // All 10 chips are rendered (D-11: render every tag, no max-visible cap)
    const chipRemoveButtons = gapEContainer.querySelectorAll('button[aria-label^="Remove tag "]');
    expect(chipRemoveButtons).toHaveLength(10);
  });

  it('(e) when job.tags.length === 0, the Tag icon is the always-visible add-tag affordance and the + button is hidden', () => {
    const job = makeMinimalJob({ tags: undefined });
    const onStartAddTag = vi.fn();

    renderJobCard({ job, onStartAddTag, isAddingTag: false });

    // Empty state: + button is HIDDEN (the Tag icon takes its role)
    expect(gapEContainer.querySelector('button[aria-label="Add tag"]')).not.toBeNull();
    // The Tag icon button uses aria-label="Add tag" too (single affordance per state).
    // We assert there is exactly ONE element with this label — the Tag icon — and that
    // it contains an SVG (not a text "+" character).
    const addButtons = gapEContainer.querySelectorAll('button[aria-label="Add tag"]');
    expect(addButtons).toHaveLength(1);
    const addButton = addButtons[0] as HTMLButtonElement;
    expect(addButton.querySelector('svg')).not.toBeNull();
    expect(addButton.textContent).not.toBe('+');

    // No add-tag input rendered (not in addingTag state)
    expect(gapEContainer.querySelector('input[aria-label="Add tag"]')).toBeNull();

    // No chip ✕ buttons (no chips to remove)
    expect(gapEContainer.querySelectorAll('button[aria-label^="Remove tag "]').length).toBe(0);

    // Clicking the Tag icon opens the add-tag flow via handleStartAddTag
    act(() => {
      addButton.click();
    });
    expect(onStartAddTag).toHaveBeenCalledWith('job-1');
  });

  it('(f) tags=undefined and tags=[] both behave as empty state — Tag icon visible, + hidden', () => {
    // Sanity check: both shapes hit the same `(tags?.length ?? 0) === 0` branch.
    const jobUndef = makeMinimalJob({ tags: undefined });
    renderJobCard({ job: jobUndef });
    const undefBtn = gapEContainer.querySelector<HTMLButtonElement>('button[aria-label="Add tag"]');
    expect(undefBtn).not.toBeNull();
    expect(undefBtn?.querySelector('svg')).not.toBeNull();

    const jobEmpty = makeMinimalJob({ tags: [] });
    renderJobCard({ job: jobEmpty });
    const emptyBtn = gapEContainer.querySelector<HTMLButtonElement>('button[aria-label="Add tag"]');
    expect(emptyBtn).not.toBeNull();
    expect(emptyBtn?.querySelector('svg')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POL-04 — QuoteRow overflow menu closes on outside click + Escape
// ---------------------------------------------------------------------------

describe('POL-04 — QuoteRow overflow menu closes on outside-click + Escape', () => {
  function getMoreActionsBtn(): HTMLButtonElement | undefined {
    return Array.from(container!.querySelectorAll('button')).find(
      (b) => (b.getAttribute('aria-label') ?? '') === 'More actions',
    ) as HTMLButtonElement | undefined;
  }

  function getOverflowMenu(): Element | null {
    return container!.querySelector('[role="menu"]');
  }

  it('Test 1: outside mousedown closes the overflow menu when open', async () => {
    const q = makeQuote({ status: 'sent' });
    quotesFixture = [q];
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} onStartConversion={vi.fn()} onEditQuote={vi.fn()} onDeclineQuote={vi.fn()} />);
    });
    const moreBtn = getMoreActionsBtn();
    expect(moreBtn).toBeDefined();

    // Open the overflow menu
    await act(async () => { moreBtn!.click(); });
    expect(getOverflowMenu()).not.toBeNull();

    // Click outside (on document.body, outside the container)
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(getOverflowMenu()).toBeNull();
  });

  it('Test 2: Escape keydown closes the overflow menu when open', async () => {
    const q = makeQuote({ status: 'sent' });
    quotesFixture = [q];
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} onStartConversion={vi.fn()} onEditQuote={vi.fn()} onDeclineQuote={vi.fn()} />);
    });
    const moreBtn = getMoreActionsBtn();
    expect(moreBtn).toBeDefined();

    // Open the overflow menu
    await act(async () => { moreBtn!.click(); });
    expect(getOverflowMenu()).not.toBeNull();

    // Press Escape
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(getOverflowMenu()).toBeNull();
  });

  it('Test 3: listeners are removed on unmount (cleanup guard)', async () => {
    const q = makeQuote({ status: 'sent' });
    quotesFixture = [q];
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} onStartConversion={vi.fn()} onEditQuote={vi.fn()} onDeclineQuote={vi.fn()} />);
    });
    const moreBtn = getMoreActionsBtn();
    await act(async () => { moreBtn!.click(); });
    expect(getOverflowMenu()).not.toBeNull();

    // Unmount — afterEach will clean up root, but we verify here that Escape
    // after unmount does not throw (listeners removed)
    await act(async () => { root!.unmount(); });
    root = null;
    // If listeners leaked, this would try to call setOverflowOpen on an unmounted
    // component. Jest/vitest would surface a warning; this assert just confirms
    // no synchronous throw.
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }).not.toThrow();
  });

  it('Test 4: outside mousedown has no effect when menu is closed (no listeners registered)', async () => {
    const q = makeQuote({ status: 'sent' });
    quotesFixture = [q];
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" quotesForJob={[q]} updateQuote={updateQuoteSpy} onStartConversion={vi.fn()} onEditQuote={vi.fn()} onDeclineQuote={vi.fn()} />);
    });
    // Menu starts closed — outside click should do nothing (listeners not registered)
    expect(getOverflowMenu()).toBeNull();
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(getOverflowMenu()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 21 SEC-02 — render-time URL guard for the JobCard `Model source` block
//
// Locks D-06 (render-time only — empty modelUrl renders nothing) and D-07
// (invalid modelUrl renders as plain-text `<span title="...">`, not as an
// `<a href>`). The `isSafeHttpUrl` predicate is unit-tested in
// `src/utils/urlSecurity.test.ts`; these tests verify the JSX wiring inside
// JobCard.
// ---------------------------------------------------------------------------

describe('JobCard Model source render-time URL guard (Phase 21 SEC-02)', () => {
  let urlContainer: HTMLDivElement;
  let urlRoot: Root;

  beforeEach(() => {
    urlContainer = document.createElement('div');
    document.body.appendChild(urlContainer);
    urlRoot = createRoot(urlContainer);
  });

  afterEach(() => {
    act(() => { urlRoot.unmount(); });
    urlContainer.remove();
  });

  function renderJobCardWithModelUrl(modelUrl: string | undefined) {
    const noop = () => undefined;
    const noopAsync = async () => undefined;
    const job = makeMinimalJob({ modelUrl });
    act(() => {
      urlRoot.render(
        <JobCard
          job={job}
          userCurrency="USD"
          // Model source block only renders inside `{isSelected && (...)}` —
          // expand the card so the block is reachable.
          isSelected={true}
          info={makeBreakEvenInfo()}
          recentSales={undefined}
          getFilamentName={() => 'PLA'}
          getQuotesForJob={() => []}
          updateQuote={updateQuoteSpy}
          onToggleSelect={noop}
          onOpenSaleForm={noop}
          onEdit={noop}
          onDelete={noop}
          onGeneratePdf={noop}
          onEditSale={noop}
          onDeleteSale={noop}
          onStartConversion={undefined}
          onEditQuote={undefined}
          onDeclineQuote={undefined}
          isEditingTitle={false}
          onStartEditTitle={noop}
          onCancelEditTitle={noop}
          onSaveTitle={noopAsync}
          isAddingTag={false}
          onStartAddTag={noop}
          onCancelAddTag={noop}
          onSubmitAddTag={noopAsync}
          onRemoveTag={noopAsync}
        />,
      );
    });
  }

  function findModelSourceBlock(): Element | null {
    // The "Model source: " label is a unique anchor — find its parent <div>.
    const spans = Array.from(urlContainer.querySelectorAll('span'));
    const label = spans.find((s) => s.textContent === 'Model source: ');
    return label?.parentElement ?? null;
  }

  it("renders the existing <a href> for a valid https:// URL (safe-path is byte-identical)", () => {
    renderJobCardWithModelUrl('https://example.com/model.stl');

    const block = findModelSourceBlock();
    expect(block).not.toBeNull();

    const anchor = block!.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor!.getAttribute('href')).toBe('https://example.com/model.stl');
    expect(anchor!.getAttribute('target')).toBe('_blank');
    expect(anchor!.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor!.textContent).toBe('https://example.com/model.stl');
    // No fallback <span> with title for the safe path
    expect(block!.querySelector('span[title]')).toBeNull();
  });

  it("renders a plain <span title='...'> for a javascript: URL (D-07 fallback, NOT an <a href>)", () => {
    renderJobCardWithModelUrl('javascript:alert(1)');

    const block = findModelSourceBlock();
    expect(block).not.toBeNull();

    // No anchor rendered for the unsafe URL
    expect(block!.querySelector('a')).toBeNull();

    // Plain-text fallback: span containing the raw input, with a title warning
    const fallback = block!.querySelector('span[title]');
    expect(fallback).not.toBeNull();
    expect(fallback!.textContent).toBe('javascript:alert(1)');
    const title = fallback!.getAttribute('title') ?? '';
    // Title must mention how to fix it: http:// and https://
    expect(title).toContain('http://');
    expect(title).toContain('https://');
  });

  it("renders nothing (no label, no fallback) when modelUrl is undefined (D-06: outer truthy guard preserved)", () => {
    renderJobCardWithModelUrl(undefined);

    // The "Model source: " label is hidden when modelUrl is empty/undefined
    expect(findModelSourceBlock()).toBeNull();
  });

  it("renders nothing when modelUrl is the empty string (truthy guard catches '')", () => {
    renderJobCardWithModelUrl('');

    expect(findModelSourceBlock()).toBeNull();
  });

  it("rejects a `data:text/html,...` URL (renders as plain-text fallback)", () => {
    renderJobCardWithModelUrl('data:text/html,<script>alert(1)</script>');

    const block = findModelSourceBlock();
    expect(block).not.toBeNull();
    expect(block!.querySelector('a')).toBeNull();
    const fallback = block!.querySelector('span[title]');
    expect(fallback).not.toBeNull();
    expect(fallback!.textContent).toBe('data:text/html,<script>alert(1)</script>');
  });
});

// ---------------------------------------------------------------------------
// PERF-08 — break-even formula round-trip (Phase 22.1)
//
// Locks the agreement between the Calculator's "Break-even Units" widget and
// the JobsManager pill's `breakEvenCopies` for the same job:
//   pill.breakEvenCopies === Math.ceil((modelCost + depreciation + nozzleWear) / profitPerUnit)
//
// Three cases assert the formula identity directly against computeBreakEvenInfo
// (pure module-scope helper — no JobsManager render needed). The fourth case
// cross-validates the no-op contract of reconcileFixedCostsAtSave from the
// consumer side: a newly-saved job that already has fixedCostsAtSave set must
// NOT be touched by the helper (returned-array length 0).
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<PrintJob> = {}): PrintJob {
  return {
    id: 'job-be-1',
    name: 'Round-trip Job',
    createdAt: new Date('2026-05-28T00:00:00Z'),
    updatedAt: new Date('2026-05-28T00:00:00Z'),
    filaments: [],
    printTimeHours: 1,
    printerInstanceId: 'pi-1',
    modelCost: 100,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    costPerUnit: 30,
    sellingPrice: 50,
    copiesSold: 0,
    ...overrides,
  } as PrintJob;
}

describe('PERF-08 — break-even formula round-trip (Phase 22.1)', () => {
  it('snapshotted job — pill breakEvenCopies === Math.ceil((modelCost + depreciation + nozzleWear) / profitPerUnit)', () => {
    // modelCost=100, depreciation=20, nozzleWear=5 → fixedTotal=125
    // sellingPrice=50, costPerUnit=30 → profitPerUnit=20
    // expected = Math.ceil(125/20) = 7
    const job = makeJob({
      modelCost: 100,
      fixedCostsAtSave: { depreciation: 20, nozzleWear: 5 },
      sellingPrice: 50,
      costPerUnit: 30,
      copiesSold: 0,
    });
    const info = computeBreakEvenInfo(job, new Map<string, Sale[]>());

    // Calculator-side reference (mirror CostCalculator.tsx:460-467 arithmetic).
    const fixedTotal = job.modelCost + job.fixedCostsAtSave!.depreciation + job.fixedCostsAtSave!.nozzleWear;
    const profitPerUnit = job.sellingPrice - job.costPerUnit;
    const expectedCalcBreakEven = profitPerUnit > 0
      ? Math.ceil(fixedTotal / profitPerUnit)
      : (fixedTotal > 0 ? Infinity : 0);

    expect(expectedCalcBreakEven).toBe(7);
    expect(info.breakEvenCopies).toBe(expectedCalcBreakEven);
  });

  it('legacy job (no snapshot) — pill falls back to Math.ceil(modelCost / profitPerUnit)', () => {
    // fixedCostsAtSave is undefined — the ?? 0 defaults should make the
    // numerator collapse to modelCost alone (pre-22.1 behavior preserved
    // for legacy IndexedDB jobs until reconcileFixedCostsAtSave backfills them).
    // modelCost=100, profitPerUnit=20 → expected = Math.ceil(100/20) = 5
    const job = makeJob({
      modelCost: 100,
      fixedCostsAtSave: undefined,
      sellingPrice: 50,
      costPerUnit: 30,
      copiesSold: 0,
    });
    const info = computeBreakEvenInfo(job, new Map<string, Sale[]>());
    expect(info.breakEvenCopies).toBe(5);
  });

  it('zero-modelCost + non-zero depreciation — pill returns finite breakEven (Infinity guard widened to fixedNumerator > 0)', () => {
    // modelCost=0 but fixedCostsAtSave.depreciation=20 + nozzleWear=5 → fixedNumerator=25
    // sellingPrice=50, costPerUnit=49 → profitPerUnit=1
    // expected = Math.ceil(25/1) = 25
    // Before the widened guard (`job.modelCost > 0 ? Infinity : 0`) this returned
    // 0 — silently hiding the fact that the job DOES have fixed costs to recover.
    const job = makeJob({
      modelCost: 0,
      fixedCostsAtSave: { depreciation: 20, nozzleWear: 5 },
      sellingPrice: 50,
      costPerUnit: 49,
      copiesSold: 0,
    });
    const info = computeBreakEvenInfo(job, new Map<string, Sale[]>());
    expect(info.breakEvenCopies).toBe(25);
  });

  it('reconcileFixedCostsAtSave is a no-op on newly-saved jobs (already-snapshotted job returns empty patch array)', () => {
    // must_haves.truths[5] consumer-side cross-validation.
    // A newly-saved job ALREADY carries fixedCostsAtSave (Task 2 writes it at
    // Save/Update time). Running the backfill helper over such a job must
    // return [] — proving the helper does not re-snapshot newly-saved jobs.
    const job = makeJob({
      id: 'job-already-snapshotted',
      modelCost: 100,
      fixedCostsAtSave: { depreciation: 20, nozzleWear: 5 },
      sellingPrice: 50,
      costPerUnit: 30,
      copiesSold: 0,
    });
    const printerInstance: PrinterInstance = {
      id: 'pi-1',
      printerConfigId: 'pc-1',
      nickname: 'Test Printer',
      printHours: 100,
      actualPurchasePrice: 1000,
      recoveryMonths: 12,
      estimatedMonthlyPrintHours: 40,
    };
    const printer: PrinterConfig = {
      id: 'pc-1',
      name: 'Bambu A1',
      purchasePrice: 1000,
      expectedLifespanHours: 10000,
      wattage: 100,
      nozzleCost: 5,
      nozzleLifespanCm3: 1000,
    };
    const material: Material = {
      id: 'm-1',
      name: 'PLA',
      category: 'filament',
      filamentType: 'PLA',
    };
    const result = reconcileFixedCostsAtSave([job], [printerInstance], [printer], [material]);
    expect(result).toEqual([]);
  });

  it('per-unit-licensed modelCost (modelCostPerUnit=true) — pill excludes modelCost from numerator (CR-02)', () => {
    // CR-02 regression: when modelCostPerUnit=true, the model fee is paid
    // per copy (licensing model — Etsy author resale, etc.) and rolled into
    // costPerUnit, NOT into fixed recovery. The Calculator widget zeroes it
    // out (CostCalculator.tsx:449-457) — the JobsManager pill must mirror.
    //
    // Fixture: modelCost=100, modelCostPerUnit=true, snapshot zeroed → the
    // numerator collapses to 0 → breakEvenCopies must be 0 (no fixed cost
    // to recover). Before the fix, the pill returned Math.ceil(100/20)=5,
    // contradicting the PERF-08 round-trip identity.
    const job = makeJob({
      modelCost: 100,
      modelCostPerUnit: true,
      sellingPrice: 50,
      costPerUnit: 30,
      copiesSold: 0,
      fixedCostsAtSave: { depreciation: 0, nozzleWear: 0 },
    });
    const info = computeBreakEvenInfo(job, new Map<string, Sale[]>());
    expect(info.breakEvenCopies).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Jobs summary totals bar — aggregates across ALL jobs (My Jobs tab header).
//
// computeJobsAggregates must derive profit consistently with
// computeBreakEvenInfo's cost model (fixedCostsAtSave snapshot + CR-02
// modelCostPerUnit exclusion) — no third formula. Money fields live in
// per-record snapshot currencies, so totals convert to the user's display
// currency via utils/fxConvert.convert; a missing rate yields null (UI shows
// "—"), never a raw cross-currency sum.
// ---------------------------------------------------------------------------

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-' + Math.random().toString(36).slice(2, 9),
    jobId: 'job-be-1',
    quantity: 1,
    unitPrice: 50,
    totalRevenue: 50,
    soldAt: new Date('2026-06-01T00:00:00Z'),
    ...overrides,
  };
}

function salesMap(...sales: Sale[]): Map<string, Sale[]> {
  const map = new Map<string, Sale[]>();
  for (const s of sales) {
    const list = map.get(s.jobId);
    if (list) list.push(s);
    else map.set(s.jobId, [s]);
  }
  return map;
}

describe('computeJobsAggregates — single-currency totals', () => {
  it('sums net revenue (totalRevenue - marketplaceFee), profit, grams x copiesSold, hours x copiesSold across jobs', () => {
    const jobA = makeJob({
      id: 'job-a',
      costPerUnit: 10,
      copiesSold: 2,
      modelCost: 20,
      fixedCostsAtSave: undefined,
      filaments: [{ filamentId: 'f1', grams: 50 }],
      printTimeHours: 2,
      currency: 'USD',
    });
    const jobB = makeJob({
      id: 'job-b',
      costPerUnit: 5,
      copiesSold: 0,
      modelCost: 0,
      fixedCostsAtSave: undefined,
      filaments: [{ filamentId: 'f1', grams: 100 }],
      printTimeHours: 3,
      currency: 'USD',
    });
    const sale = makeSale({ jobId: 'job-a', totalRevenue: 60, marketplaceFee: 5, currency: 'USD' });

    const agg = computeJobsAggregates([jobA, jobB], salesMap(sale), 'USD', null);

    // revenue: 60 - 5 = 55
    expect(agg.totalRevenue).toBe(55);
    // profit: 55 - (10*2 + 20) = 15; job-b contributes 0 cost (0 copies, no fixed costs)
    expect(agg.totalProfit).toBe(15);
    // grams: 50*2 + 100*0 = 100
    expect(agg.totalGrams).toBe(100);
    // hours: 2*2 + 3*0 = 4
    expect(agg.totalHours).toBe(4);
  });

  it('an unsold job with fixed costs drags profit negative (break-even cost model)', () => {
    const job = makeJob({
      id: 'job-unsold',
      costPerUnit: 10,
      copiesSold: 0,
      modelCost: 25,
      fixedCostsAtSave: undefined,
      filaments: [],
      printTimeHours: 1,
      currency: 'USD',
    });
    const agg = computeJobsAggregates([job], new Map(), 'USD', null);
    expect(agg.totalRevenue).toBe(0);
    expect(agg.totalProfit).toBe(-25);
  });

  it('treats a missing marketplaceFee as 0', () => {
    const job = makeJob({ id: 'job-a', costPerUnit: 0, copiesSold: 1, modelCost: 0, filaments: [], currency: 'USD' });
    const sale = makeSale({ jobId: 'job-a', totalRevenue: 40, marketplaceFee: undefined, currency: 'USD' });
    const agg = computeJobsAggregates([job], salesMap(sale), 'USD', null);
    expect(agg.totalRevenue).toBe(40);
  });
});

describe('computeJobsAggregates — cost model consistency with computeBreakEvenInfo', () => {
  it('includes fixedCostsAtSave depreciation + nozzleWear in job cost (Phase 22.1 D-01)', () => {
    const job = makeJob({
      id: 'job-snap',
      costPerUnit: 10,
      copiesSold: 1,
      modelCost: 0,
      fixedCostsAtSave: { depreciation: 20, nozzleWear: 5 },
      filaments: [],
      currency: 'USD',
    });
    const sale = makeSale({ jobId: 'job-snap', totalRevenue: 50, currency: 'USD' });
    const agg = computeJobsAggregates([job], salesMap(sale), 'USD', null);
    // 50 - (10*1 + 25) = 15
    expect(agg.totalProfit).toBe(15);
  });

  it('excludes modelCost from fixed costs when modelCostPerUnit=true (CR-02 mirror)', () => {
    const job = makeJob({
      id: 'job-lic',
      costPerUnit: 10,
      copiesSold: 1,
      modelCost: 100,
      modelCostPerUnit: true,
      fixedCostsAtSave: { depreciation: 0, nozzleWear: 0 },
      filaments: [],
      currency: 'USD',
    });
    const sale = makeSale({ jobId: 'job-lic', totalRevenue: 50, currency: 'USD' });
    const agg = computeJobsAggregates([job], salesMap(sale), 'USD', null);
    // model fee is amortized into costPerUnit, NOT fixed recovery: 50 - 10 = 40
    expect(agg.totalProfit).toBe(40);
  });
});

describe('computeJobsAggregates — display-time currency conversion', () => {
  // USD-based table: 1 USD = 0.5 EUR → 1 EUR = 2 USD
  const table = { base: 'USD' as const, rates: { EUR: 0.5 }, date: '2026-06-12' };

  it('converts per-record snapshot currencies into the user currency via the rate table', () => {
    const job = makeJob({
      id: 'job-eur',
      costPerUnit: 10,
      copiesSold: 1,
      modelCost: 0,
      fixedCostsAtSave: undefined,
      filaments: [],
      currency: 'EUR',
    });
    const sale = makeSale({ jobId: 'job-eur', totalRevenue: 30, currency: 'EUR' });
    const agg = computeJobsAggregates([job], salesMap(sale), 'USD', table);
    // 30 EUR = 60 USD revenue; cost 10 EUR = 20 USD → profit 40 USD
    expect(agg.totalRevenue).toBeCloseTo(60, 10);
    expect(agg.totalProfit).toBeCloseTo(40, 10);
  });

  it('returns null money totals (never a wrong number) when a record currency has no rate; grams/hours still computed', () => {
    const job = makeJob({
      id: 'job-zar',
      costPerUnit: 10,
      copiesSold: 2,
      modelCost: 0,
      filaments: [{ filamentId: 'f1', grams: 10 }],
      printTimeHours: 1.5,
      currency: 'ZAR',
    });
    const sale = makeSale({ jobId: 'job-zar', totalRevenue: 100, currency: 'ZAR' });
    const agg = computeJobsAggregates([job], salesMap(sale), 'USD', table);
    expect(agg.totalRevenue).toBeNull();
    expect(agg.totalProfit).toBeNull();
    expect(agg.totalGrams).toBe(20);
    expect(agg.totalHours).toBe(3);
  });

  it('does not leak a partially-converted job revenue into the totals when a later sale fails conversion', () => {
    // Job A fully converts; job B's sale currency (ZAR) has no rate. The
    // partial jobNetRevenue accumulated before the inner-loop break must be
    // discarded — money totals null, currency-free totals still complete.
    const jobA = makeJob({
      id: 'job-ok',
      costPerUnit: 10,
      copiesSold: 1,
      modelCost: 0,
      filaments: [{ filamentId: 'f1', grams: 10 }],
      printTimeHours: 1,
      currency: 'USD',
    });
    const jobB = makeJob({
      id: 'job-bad-sale',
      costPerUnit: 10,
      copiesSold: 2,
      modelCost: 0,
      filaments: [{ filamentId: 'f1', grams: 10 }],
      printTimeHours: 1,
      currency: 'EUR', // job currency IS convertible — only the sale's isn't
    });
    const saleOk = makeSale({ jobId: 'job-ok', totalRevenue: 50, currency: 'USD' });
    const saleEur = makeSale({ jobId: 'job-bad-sale', totalRevenue: 20, currency: 'EUR' });
    const saleZar = makeSale({ jobId: 'job-bad-sale', totalRevenue: 100, currency: 'ZAR' });
    const agg = computeJobsAggregates([jobA, jobB], salesMap(saleOk, saleEur, saleZar), 'USD', table);
    expect(agg.totalRevenue).toBeNull();
    expect(agg.totalProfit).toBeNull();
    expect(agg.totalGrams).toBe(30);
    expect(agg.totalHours).toBe(3);
  });

  it('falls back to the user currency for legacy records with no snapshot currency (identity, no table needed)', () => {
    const job = makeJob({
      id: 'job-legacy',
      costPerUnit: 10,
      copiesSold: 1,
      modelCost: 0,
      filaments: [],
      currency: undefined,
    });
    const sale = makeSale({ jobId: 'job-legacy', totalRevenue: 25, currency: undefined });
    const agg = computeJobsAggregates([job], salesMap(sale), 'CAD', null);
    expect(agg.totalRevenue).toBe(25);
    expect(agg.totalProfit).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// A11Y-14 — Tag chip ✕ button: 24×24 hit target + focus ring
//
// WCAG 2.5.8 AA: the bounding box of the remove button must be ≥ 24×24px.
// Implemented via Tailwind min-w-[24px] min-h-[24px] on the raw button element.
// Focus ring: focus-visible:ring-1 focus-visible:ring-blue-400.
// Reveal on focus: focus-visible:opacity-100 (chip stays subtle at rest — LOCKED).
// Keyboard-operable at all times (no tabIndex=-1).
// ---------------------------------------------------------------------------

describe('A11Y-14 — tag chip ✕ button hit target + focus ring', () => {
  let a11yContainer: HTMLDivElement;
  let a11yRoot: Root;

  beforeEach(() => {
    a11yContainer = document.createElement('div');
    document.body.appendChild(a11yContainer);
    a11yRoot = createRoot(a11yContainer);
    dbJobsPutSpy.mockClear();
  });

  afterEach(() => {
    act(() => { a11yRoot.unmount(); });
    a11yContainer.remove();
  });

  function renderChipJob() {
    const noop = () => undefined;
    const noopAsync = async () => undefined;
    const job = makeMinimalJob({ tags: ['test-tag'] });
    act(() => {
      a11yRoot.render(
        <JobCard
          job={job}
          userCurrency="USD"
          isSelected={false}
          info={makeBreakEvenInfo()}
          recentSales={undefined}
          getFilamentName={() => 'PLA'}
          getQuotesForJob={() => []}
          updateQuote={updateQuoteSpy}
          onToggleSelect={noop}
          onOpenSaleForm={noop}
          onEdit={noop}
          onDelete={noop}
          onGeneratePdf={noop}
          onEditSale={noop}
          onDeleteSale={noop}
          onStartConversion={undefined}
          onEditQuote={undefined}
          onDeclineQuote={undefined}
          isEditingTitle={false}
          onStartEditTitle={noop}
          onCancelEditTitle={noop}
          onSaveTitle={noopAsync}
          isAddingTag={false}
          onStartAddTag={noop}
          onCancelAddTag={noop}
          onSubmitAddTag={noopAsync}
          onRemoveTag={noopAsync}
        />,
      );
    });
    return a11yContainer.querySelector<HTMLButtonElement>('button[aria-label="Remove tag test-tag"]');
  }

  it('has min-w-[24px] class for 24px minimum width (WCAG 2.5.8 AA bounding box)', () => {
    const btn = renderChipJob();
    expect(btn).not.toBeNull();
    expect(btn!.className).toContain('min-w-[24px]');
  });

  it('has min-h-[24px] class for 24px minimum height (WCAG 2.5.8 AA bounding box)', () => {
    const btn = renderChipJob();
    expect(btn).not.toBeNull();
    expect(btn!.className).toContain('min-h-[24px]');
  });

  it('does NOT have the old w-3.5 h-3.5 fixed size classes', () => {
    const btn = renderChipJob();
    expect(btn).not.toBeNull();
    expect(btn!.className).not.toContain('w-3.5');
    expect(btn!.className).not.toContain('h-3.5');
  });

  it('has focus-visible:opacity-100 to reveal the button on keyboard focus (LOCKED reveal-on-focus)', () => {
    const btn = renderChipJob();
    expect(btn).not.toBeNull();
    expect(btn!.className).toContain('focus-visible:opacity-100');
  });

  it('has focus-visible:ring-1 for a visible keyboard focus ring', () => {
    const btn = renderChipJob();
    expect(btn).not.toBeNull();
    expect(btn!.className).toContain('focus-visible:ring-1');
  });

  it('does NOT have tabIndex="-1" — button stays keyboard-reachable at all times', () => {
    const btn = renderChipJob();
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute('tabindex')).not.toBe('-1');
  });

  it('retains aria-label starting with "Remove tag " for AT identification', () => {
    const btn = renderChipJob();
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute('aria-label')).toMatch(/^Remove tag /);
  });
});

// ---------------------------------------------------------------------------
// A11Y-15 (break-even bar portion) — role="progressbar" + value attributes
//
// WCAG 4.1.2: the inner break-even bar div must expose role="progressbar"
// with aria-valuenow, aria-valuemin=0, aria-valuemax, and a human-readable
// aria-valuetext ("N of M copies sold [— break-even reached]").
// Only applies when breakEvenCopies is non-null (renders inside the non-null
// branch of the conditional in JobCard).
// ---------------------------------------------------------------------------

describe('A11Y-15 — break-even bar progressbar ARIA', () => {
  let beContainer: HTMLDivElement;
  let beRoot: Root;

  beforeEach(() => {
    beContainer = document.createElement('div');
    document.body.appendChild(beContainer);
    beRoot = createRoot(beContainer);
    dbJobsPutSpy.mockClear();
  });

  afterEach(() => {
    act(() => { beRoot.unmount(); });
    beContainer.remove();
  });

  function renderWithBreakEven(opts: {
    copiesSold: number;
    breakEvenCopies: number;
    isBreakEven: boolean;
    modelCost?: number;
  }) {
    const noop = () => undefined;
    const noopAsync = async () => undefined;
    const job = makeMinimalJob({
      copiesSold: opts.copiesSold,
      modelCost: opts.modelCost ?? 50,
    });
    const info = {
      revenueEarned: 0,
      profitPerUnit: 9,
      breakEvenCopies: opts.breakEvenCopies,
      remainingToBreakEven: Math.max(0, opts.breakEvenCopies - opts.copiesSold),
      isBreakEven: opts.isBreakEven,
    };
    act(() => {
      beRoot.render(
        <JobCard
          job={job}
          userCurrency="USD"
          isSelected={true}
          info={info}
          recentSales={undefined}
          getFilamentName={() => 'PLA'}
          getQuotesForJob={() => []}
          updateQuote={updateQuoteSpy}
          onToggleSelect={noop}
          onOpenSaleForm={noop}
          onEdit={noop}
          onDelete={noop}
          onGeneratePdf={noop}
          onEditSale={noop}
          onDeleteSale={noop}
          onStartConversion={undefined}
          onEditQuote={undefined}
          onDeclineQuote={undefined}
          isEditingTitle={false}
          onStartEditTitle={noop}
          onCancelEditTitle={noop}
          onSaveTitle={noopAsync}
          isAddingTag={false}
          onStartAddTag={noop}
          onCancelAddTag={noop}
          onSubmitAddTag={noopAsync}
          onRemoveTag={noopAsync}
        />,
      );
    });
    return beContainer.querySelector('[role="progressbar"]');
  }

  it('renders a progressbar element inside the break-even bar when breakEvenCopies is non-null', () => {
    const bar = renderWithBreakEven({ copiesSold: 3, breakEvenCopies: 10, isBreakEven: false });
    expect(bar).not.toBeNull();
  });

  it('sets aria-valuenow to the number of copies sold', () => {
    const bar = renderWithBreakEven({ copiesSold: 3, breakEvenCopies: 10, isBreakEven: false });
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute('aria-valuenow')).toBe('3');
  });

  it('sets aria-valuemin to "0"', () => {
    const bar = renderWithBreakEven({ copiesSold: 3, breakEvenCopies: 10, isBreakEven: false });
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute('aria-valuemin')).toBe('0');
  });

  it('sets aria-valuemax to the break-even copies count', () => {
    const bar = renderWithBreakEven({ copiesSold: 3, breakEvenCopies: 10, isBreakEven: false });
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute('aria-valuemax')).toBe('10');
  });

  it('aria-valuetext mentions copies sold and break-even target', () => {
    const bar = renderWithBreakEven({ copiesSold: 3, breakEvenCopies: 10, isBreakEven: false });
    expect(bar).not.toBeNull();
    const text = bar!.getAttribute('aria-valuetext') ?? '';
    expect(text).toContain('3');
    expect(text).toContain('10');
  });

  it('aria-valuetext mentions "break-even reached" when isBreakEven is true', () => {
    const bar = renderWithBreakEven({ copiesSold: 10, breakEvenCopies: 10, isBreakEven: true });
    expect(bar).not.toBeNull();
    const text = bar!.getAttribute('aria-valuetext') ?? '';
    expect(text).toContain('break-even reached');
  });

  it('aria-valuetext does NOT mention "break-even reached" when isBreakEven is false', () => {
    const bar = renderWithBreakEven({ copiesSold: 3, breakEvenCopies: 10, isBreakEven: false });
    expect(bar).not.toBeNull();
    const text = bar!.getAttribute('aria-valuetext') ?? '';
    expect(text).not.toContain('break-even reached');
  });
});

// ---------------------------------------------------------------------------
// PERF-09 — useQuotes() lifted to parent; OrdersQuoteRows receives quotesForJob prop
//
// Source-contract: exactly one useQuotes() call in JobsManager.tsx (the parent).
// Behavior: OrdersQuoteRows renders the same quote list when driven by a
// quotesForJob prop (no internal useQuotes() call).
// Reopen: updateQuote prop is called with the expected payload (spy still fires).
// ---------------------------------------------------------------------------

describe('PERF-09 — OrdersQuoteRows driven by quotesForJob prop', () => {
  it('renders quote list from quotesForJob prop (Pending pill visible)', async () => {
    const quote = makeQuote({ status: 'sent', quoteNumber: 10 });
    const quotesForJob: Quote[] = [quote];
    await act(async () => {
      root!.render(
        <OrdersQuoteRows
          jobId="job-1"
          quotesForJob={quotesForJob}
          updateQuote={updateQuoteSpy}
        />
      );
    });
    expect(container!.textContent ?? '').toContain('Pending');
  });

  it('renders nothing when quotesForJob is empty', async () => {
    await act(async () => {
      root!.render(
        <OrdersQuoteRows
          jobId="job-1"
          quotesForJob={[]}
          updateQuote={updateQuoteSpy}
        />
      );
    });
    expect(container!.textContent ?? '').toBe('');
  });

  it('Reopen via updateQuote prop clears decisionAt + declineReason and sets status=sent', async () => {
    const declined = makeQuote({
      status: 'declined',
      decisionAt: new Date('2026-04-01'),
      declineReason: 'No budget',
    });
    await act(async () => {
      root!.render(
        <OrdersQuoteRows
          jobId="job-1"
          quotesForJob={[declined]}
          updateQuote={updateQuoteSpy}
        />
      );
    });
    const btn = buttonByText('Reopen');
    expect(btn).toBeDefined();
    await act(async () => { btn!.click(); });
    expect(updateQuoteSpy).toHaveBeenCalledTimes(1);
    const payload = updateQuoteSpy.mock.calls[0][0];
    expect(payload.status).toBe('sent');
    expect(payload.decisionAt).toBeUndefined();
    expect(payload.declineReason).toBeUndefined();
  });

  it('source-contract: useQuotes() is called exactly once (non-comment lines) in JobsManager.tsx', () => {
    const src = readFileSync(resolve(__dirname, 'JobsManager.tsx'), 'utf8');
    // Count only non-comment lines that contain a useQuotes() invocation.
    // Excludes: line-comments (//), block-comment lines (*), JSDoc lines (/**, */),
    // so the count reflects actual hook calls only.
    const callLines = src
      .split('\n')
      .filter(line => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/**') || trimmed.startsWith('*/')) return false;
        return /useQuotes\(\)/.test(line);
      });
    expect(callLines.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// PERF-10 — getFilamentName Map-based O(1) lookup output equivalence
// ---------------------------------------------------------------------------

describe('PERF-10 — getFilamentName output equivalence after Map refactor', () => {
  it('returns brand + filamentType (trimmed) for a known id', () => {
    const materials = [{ id: 'a', brand: 'Bambu', filamentType: 'PLA', name: 'PLA' }];
    const map = new Map(materials.map(m => [m.id, m]));
    const getName = (id: string) => {
      const f = map.get(id);
      return f ? `${(f as { brand?: string }).brand || ''} ${(f as { filamentType?: string; name: string }).filamentType || (f as { name: string }).name}`.trim() : 'Unknown';
    };
    expect(getName('a')).toBe('Bambu PLA');
  });

  it('falls back to name when filamentType is absent', () => {
    const materials = [{ id: 'b', brand: '', filamentType: undefined as unknown as string, name: 'Generic' }];
    const map = new Map(materials.map(m => [m.id, m]));
    const getName = (id: string) => {
      const f = map.get(id) as { brand?: string; filamentType?: string; name: string } | undefined;
      return f ? `${f.brand || ''} ${f.filamentType || f.name}`.trim() : 'Unknown';
    };
    expect(getName('b')).toBe('Generic');
  });

  it('returns "Unknown" for a missing id', () => {
    const materials: { id: string; brand: string; filamentType: string; name: string }[] = [];
    const map = new Map(materials.map(m => [m.id, m]));
    const getName = (id: string) => {
      const f = map.get(id);
      return f ? `${f.brand || ''} ${f.filamentType || f.name}`.trim() : 'Unknown';
    };
    expect(getName('missing')).toBe('Unknown');
  });
});

describe('formatFilament / formatHours', () => {
  it('shows grams below 1000 and kg at/above 1000', () => {
    expect(formatFilament(0)).toBe('0 g');
    expect(formatFilament(999)).toBe('999 g');
    expect(formatFilament(1000)).toBe('1.00 kg');
    expect(formatFilament(1500)).toBe('1.50 kg');
  });

  it('never displays "1000 g" — values that round up to 1000 switch to kg', () => {
    // 999.5 < 1000 but Math.round would render "1000 g"; the display rule is
    // keyed on what the user SEES (mirrors the formatHours 99.96 guard).
    expect(formatFilament(999.5)).toBe('1.00 kg');
    expect(formatFilament(999.4)).toBe('999 g');
  });

  it('shows one decimal under 100h and whole hours from 100h', () => {
    expect(formatHours(5)).toBe('5.0');
    expect(formatHours(99.94)).toBe('99.9');
    expect(formatHours(99.95)).toBe('100');
    expect(formatHours(150)).toBe('150');
  });

  it('never displays "100.0" — values that round up to 100.0 switch to whole hours', () => {
    // 99.96 < 100 but toFixed(1) would render "100.0"; the display rule is
    // keyed on what the user SEES, so this must render as "100".
    expect(formatHours(99.96)).toBe('100');
  });
});

describe('JobsSummaryBar — rendering', () => {
  it('renders all four totals formatted in the user currency', () => {
    act(() => {
      root!.render(
        <JobsSummaryBar
          aggregates={{ totalRevenue: 55, totalProfit: 15.5, totalGrams: 1500, totalHours: 4 }}
          userCurrency="USD"
        />,
      );
    });
    const text = container!.textContent ?? '';
    expect(text).toContain('Total Revenue');
    expect(text).toContain('Total Profit');
    expect(text).toContain('Filament Used');
    expect(text).toContain('Print Time');
    expect(text).toContain('$55.00');
    expect(text).toContain('$15.50');
    expect(text).toContain('1.50 kg');
    expect(text).toContain('4.0h');
  });

  it('null money totals render an em dash with a screen-reader explanation, while grams/hours still show', () => {
    act(() => {
      root!.render(
        <JobsSummaryBar
          aggregates={{ totalRevenue: null, totalProfit: null, totalGrams: 100, totalHours: 2 }}
          userCurrency="USD"
        />,
      );
    });
    // The explanation must be programmatically exposed (sr-only text), not
    // hidden in a mouse-only title attribute — WCAG 1.3.1. One per null total.
    const srExplanations = Array.from(container!.querySelectorAll('.sr-only')).filter(
      (el) => (el.textContent ?? '').includes(FX_UNAVAILABLE_TITLE),
    );
    expect(srExplanations).toHaveLength(2);
    // The visible dash stays for sighted users (with the tooltip as a bonus),
    // but is hidden from AT so "dash" isn't announced without context.
    const dashes = Array.from(container!.querySelectorAll('[aria-hidden="true"]')).filter(
      (el) => (el.textContent ?? '').trim() === '—',
    );
    expect(dashes).toHaveLength(2);
    const text = container!.textContent ?? '';
    expect(text).toContain('100 g');
    expect(text).toContain('2.0h');
    expect(text).not.toContain('$');
  });
});
