import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbJobsPutSpy = vi.fn<(job: any) => Promise<void>>().mockResolvedValue(undefined);
vi.mock('../db/database', () => ({ db: { jobs: { put: dbJobsPutSpy } } }));

const { OrdersQuoteRows, JobCard, ADD_TAG_PLACEHOLDER, computeBreakEvenInfo } = await import('./JobsManager');
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
          isSelected={false}
          info={makeBreakEvenInfo()}
          recentSales={undefined}
          getFilamentName={() => 'PLA'}
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
    quotesFixture = [makeQuote({ status: 'sent' })];
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" onStartConversion={vi.fn()} onEditQuote={vi.fn()} onDeclineQuote={vi.fn()} />);
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
    quotesFixture = [makeQuote({ status: 'sent' })];
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" onStartConversion={vi.fn()} onEditQuote={vi.fn()} onDeclineQuote={vi.fn()} />);
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
    quotesFixture = [makeQuote({ status: 'sent' })];
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" onStartConversion={vi.fn()} onEditQuote={vi.fn()} onDeclineQuote={vi.fn()} />);
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
    quotesFixture = [makeQuote({ status: 'sent' })];
    await act(async () => {
      root!.render(<OrdersQuoteRows jobId="job-1" onStartConversion={vi.fn()} onEditQuote={vi.fn()} onDeclineQuote={vi.fn()} />);
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
          // Model source block only renders inside `{isSelected && (...)}` —
          // expand the card so the block is reachable.
          isSelected={true}
          info={makeBreakEvenInfo()}
          recentSales={undefined}
          getFilamentName={() => 'PLA'}
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
});
