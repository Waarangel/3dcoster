import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Customer, PrintJob, UserProfile, ShippingConfig, Sale, Quote } from '../types';

// ---------------------------------------------------------------------------
// RecordSaleModal — Phase 22 plan 22-03 (HYG-06).
//
// Locks the 3-mode behavior contract per ROADMAP success criterion #11:
//   1. CREATE mode  — submit fires addSale with correct Sale shape
//   2. EDIT mode    — form hydrates from editingSale; submit fires updateSale
//   3. CONVERT mode — submit fires the atomic db.transaction (NOT addSale).
//                     Pitfall 2 lock — convert path bypasses addSale.
// + picker integration smoke + Cancel safety.
//
// No third-party render-hook library. Raw createRoot + act per project
// precedent (PrintQuoteModal.test.tsx is the reference).
// ---------------------------------------------------------------------------

// ─── Spies (must be created before vi.mock factory references them) ────────
const addSaleSpy = vi.fn<(s: Sale) => Promise<void>>().mockResolvedValue();
const updateSaleSpy = vi.fn<(s: Sale) => Promise<void>>().mockResolvedValue();
const addCustomerSpy = vi.fn<(c: Customer) => Promise<void>>().mockResolvedValue();
const bumpLastUsedSpy = vi.fn<(id: string) => Promise<void>>().mockResolvedValue();

// db.transaction spy — invokes the callback so inner db.sales/quotes/jobs spies fire
const dbSalesAddSpy = vi.fn<(s: Sale) => Promise<void>>().mockResolvedValue();
const dbQuotesPutSpy = vi.fn<(q: Quote) => Promise<void>>().mockResolvedValue();
const dbJobsGetSpy = vi.fn<(id: string) => Promise<PrintJob | undefined>>().mockResolvedValue(undefined);
const dbJobsPutSpy = vi.fn<(j: PrintJob) => Promise<void>>().mockResolvedValue();
const txSpy = vi.fn(async (..._args: unknown[]) => {
  // Last arg is the async callback (mode, ...tables, fn) — invoke it so
  // inner db.sales.add / db.quotes.put / db.jobs.get / db.jobs.put fire.
  const fn = _args[_args.length - 1] as () => Promise<void>;
  return fn();
});

// ─── Customer fixture used by useCustomers mock ────────────────────────────
const seededCustomer: Customer = {
  id: 'cust-marcus',
  name: 'Marcus',
  email: 'marcus@example.com',
  createdAt: new Date('2026-01-01'),
};

vi.mock('../hooks/useDatabase', () => ({
  useCustomers: () => ({
    customers: [seededCustomer],
    customersByEmail: new Map([[seededCustomer.email!.toLowerCase(), seededCustomer]]),
    isLoading: false,
    addCustomer: addCustomerSpy,
    updateCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
    bumpLastUsed: bumpLastUsedSpy,
    bulkImportCustomers: vi.fn(),
  }),
  useSales: () => ({
    sales: [],
    addSale: addSaleSpy,
    updateSale: updateSaleSpy,
    deleteSale: vi.fn(),
    getTotals: () => ({ totalQuantity: 0, totalRevenue: 0 }),
  }),
}));

vi.mock('../db/database', () => ({
  db: {
    sales: { add: dbSalesAddSpy },
    quotes: { put: dbQuotesPutSpy },
    jobs: { get: dbJobsGetSpy, put: dbJobsPutSpy },
    transaction: txSpy,
  },
}));

// Now import the component under test (after mocks are wired)
const { RecordSaleModal } = await import('./RecordSaleModal');

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<PrintJob> = {}): PrintJob {
  return {
    id: 'job-test',
    name: 'Test Print',
    createdAt: new Date('2026-05-23'),
    updatedAt: new Date('2026-05-23'),
    filaments: [],
    printTimeHours: 1,
    printerInstanceId: 'p-1',
    modelCost: 0,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    costPerUnit: 5,
    sellingPrice: 100,
    copiesSold: 0,
    quoteNumber: 1,
    taxRate: 13,
    taxAmount: 13,
    ...overrides,
  } as PrintJob;
}

function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    currency: 'USD',
    laborHourlyRate: 25,
    defaultTaxRate: 13,
    nextQuoteNumber: 1,
    ...overrides,
  } as UserProfile;
}

function makeShippingConfig(): ShippingConfig {
  return {
    upsBaseCost: 0,
    fedexBaseCost: 0,
    dhlBaseCost: 0,
    purolatorBaseCost: 0,
    uspsBaseCost: 0,
    royalMailBaseCost: 0,
    australiaPostBaseCost: 0,
    canadaPostBaseCost: 0,
    maxDeliveryRadiusKm: 50,
    gasPricePerLiter: 0,
    vehicleFuelEfficiency: 0,
    customCarriers: [],
  } as unknown as ShippingConfig;
}

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-existing',
    jobId: 'job-test',
    quantity: 3,
    unitPrice: 99,
    totalRevenue: 297,
    soldAt: new Date('2026-05-20'),
    customer: { name: 'Existing Buyer', email: 'buyer@example.com' },
    shippingMethod: 'local_pickup',
    shippingCost: 0,
    marketplace: 'facebook_local',
    marketplaceFee: 0,
    ...overrides,
  } as Sale;
}

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-convert',
    quoteNumber: 42,
    printJobId: 'job-test',
    customerSnapshot: { name: 'Quote Buyer', email: 'quote@example.com', company: 'QuoteCo' },
    lineItemsSnapshot: {
      jobTitle: 'Test Print',
      sellingPrice: 150,
      shippingCost: 12,
      resolvedTaxRate: 13,
      taxAmount: 19.5,
      currency: 'USD',
      notes: '',
      terms: '',
      countryAtSendTime: undefined,
    },
    status: 'sent',
    createdAt: new Date('2026-04-01'),
    sentAt: new Date('2026-04-01'),
    ...overrides,
  } as Quote;
}

// ─── DOM harness ───────────────────────────────────────────────────────────

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  addSaleSpy.mockClear();
  updateSaleSpy.mockClear();
  addCustomerSpy.mockClear();
  bumpLastUsedSpy.mockClear();
  dbSalesAddSpy.mockClear();
  dbQuotesPutSpy.mockClear();
  dbJobsGetSpy.mockClear();
  dbJobsGetSpy.mockResolvedValue(undefined);
  dbJobsPutSpy.mockClear();
  txSpy.mockClear();
  txSpy.mockImplementation(async (..._args: unknown[]) => {
    const fn = _args[_args.length - 1] as () => Promise<void>;
    return fn();
  });
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

interface RenderOpts {
  job?: PrintJob;
  editingSale?: Sale | null;
  convertingFromQuote?: Quote | null;
  onClose?: () => void;
  onSaved?: () => void;
}

async function renderModal(opts: RenderOpts = {}) {
  const props = {
    job: opts.job ?? makeJob(),
    userProfile: makeUserProfile(),
    userCurrency: 'USD' as const,
    shippingConfig: makeShippingConfig(),
    editingSale: opts.editingSale ?? null,
    convertingFromQuote: opts.convertingFromQuote ?? null,
    isOpen: true,
    onClose: opts.onClose ?? vi.fn(),
    onSaved: opts.onSaved ?? vi.fn(),
  };
  await act(async () => {
    root!.render(<RecordSaleModal {...props} />);
  });
  return props;
}

function typeIntoInput(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButton(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === text,
  ) as HTMLButtonElement | undefined;
}

function findInputByPlaceholder(placeholder: string): HTMLInputElement | null {
  return document.body.querySelector(`input[placeholder="${placeholder}"]`) as HTMLInputElement | null;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('RecordSaleModal — create mode (Test 1)', () => {
  it('submits a new Sale via addSale with quantity, unitPrice, jobId, and computed totalRevenue', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    await renderModal({ onClose, onSaved });

    // Default state: salePrice hydrates from job.sellingPrice (100); quantity = 1.
    // Bump quantity to 2 so totalRevenue diverges and verifies the math.
    const qtyInput = document.body.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => { typeIntoInput(qtyInput, '2'); });

    const recordBtn = findButton('Record Sale');
    expect(recordBtn).toBeDefined();
    await act(async () => { recordBtn!.click(); });

    expect(addSaleSpy).toHaveBeenCalledTimes(1);
    const sale = addSaleSpy.mock.calls[0][0];
    expect(sale.jobId).toBe('job-test');
    expect(sale.quantity).toBe(2);
    expect(sale.unitPrice).toBe(100);  // default from job.sellingPrice
    expect(sale.totalRevenue).toBe(200);
    expect(sale.id).toMatch(/^sale-/);

    // Convert-from-Quote path NOT taken
    expect(txSpy).not.toHaveBeenCalled();
    expect(updateSaleSpy).not.toHaveBeenCalled();

    // Lifecycle callbacks fired
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('D-06 auto-create: typing a customer with no email match calls addCustomer', async () => {
    await renderModal();
    const nameInput = findInputByPlaceholder('Jane Doe')!;
    const emailInput = findInputByPlaceholder('jane@example.com')!;
    await act(async () => {
      typeIntoInput(nameInput, 'New Buyer');
      typeIntoInput(emailInput, 'newbuyer@example.com');
    });

    const recordBtn = findButton('Record Sale');
    await act(async () => { recordBtn!.click(); });

    expect(addCustomerSpy).toHaveBeenCalledTimes(1);
    expect(bumpLastUsedSpy).not.toHaveBeenCalled();
    const newCustomer = addCustomerSpy.mock.calls[0][0];
    expect(newCustomer.name).toBe('New Buyer');
    expect(newCustomer.email).toBe('newbuyer@example.com');
  });

  it('D-07 silent link: typing an email that matches a library record calls bumpLastUsed (NOT addCustomer)', async () => {
    await renderModal();
    const emailInput = findInputByPlaceholder('jane@example.com')!;
    await act(async () => { typeIntoInput(emailInput, 'marcus@example.com'); });

    const recordBtn = findButton('Record Sale');
    await act(async () => { recordBtn!.click(); });

    expect(bumpLastUsedSpy).toHaveBeenCalledTimes(1);
    expect(bumpLastUsedSpy.mock.calls[0][0]).toBe('cust-marcus');
    expect(addCustomerSpy).not.toHaveBeenCalled();
  });
});

describe('RecordSaleModal — edit mode (Test 2)', () => {
  it('hydrates form fields from editingSale on first render', async () => {
    await renderModal({
      editingSale: makeSale({ quantity: 7, unitPrice: 250, customer: { name: 'Edit Buyer', email: 'edit@example.com' } }),
    });

    const qtyInput = document.body.querySelector('input[type="number"]') as HTMLInputElement;
    expect(qtyInput.value).toBe('7');

    const nameInput = findInputByPlaceholder('Jane Doe')!;
    expect(nameInput.value).toBe('Edit Buyer');

    const emailInput = findInputByPlaceholder('jane@example.com')!;
    expect(emailInput.value).toBe('edit@example.com');

    // Modal title flips to "Edit Sale"
    expect(document.body.textContent ?? '').toContain('Edit Sale');
  });

  it('Save Changes button calls updateSale (NOT addSale or db.transaction)', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    await renderModal({
      editingSale: makeSale({ quantity: 3, unitPrice: 99 }),
      onClose,
      onSaved,
    });

    const saveBtn = findButton('Save Changes');
    expect(saveBtn).toBeDefined();
    await act(async () => { saveBtn!.click(); });

    expect(updateSaleSpy).toHaveBeenCalledTimes(1);
    expect(addSaleSpy).not.toHaveBeenCalled();
    expect(txSpy).not.toHaveBeenCalled();

    const updated = updateSaleSpy.mock.calls[0][0];
    expect(updated.id).toBe('sale-existing');
    expect(updated.quantity).toBe(3);
    expect(updated.unitPrice).toBe(99);
    expect(updated.totalRevenue).toBe(297);
    expect(updated.customerName).toBeUndefined();  // legacy field dropped on update

    // Phase 15.1 — auto-create + bumpLastUsed do NOT fire on edit path
    expect(addCustomerSpy).not.toHaveBeenCalled();
    expect(bumpLastUsedSpy).not.toHaveBeenCalled();

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RecordSaleModal — convert-from-quote mode (Test 3 — Pitfall 2 lock)', () => {
  it('hydrates from Quote snapshot and shows the blue helper banner', async () => {
    await renderModal({
      convertingFromQuote: makeQuote({ quoteNumber: 42 }),
    });

    // Helper banner present with formatted quote number
    expect(document.body.textContent ?? '').toContain('Converting Q-0042');
    expect(document.body.textContent ?? '').toContain('review and adjust if needed');

    // salePrice hydrated from lineItemsSnapshot.sellingPrice (150)
    const priceInputs = document.body.querySelectorAll('input[type="number"]');
    // 1st number input = quantity; 2nd = price
    const priceInput = priceInputs[1] as HTMLInputElement;
    expect(priceInput.value).toBe('150');
  });

  it('submit fires db.transaction with rw mode + sales/quotes/jobs tables; addSale NOT called', async () => {
    // Seed the jobs.get spy so the inner copiesSold bump path executes too
    dbJobsGetSpy.mockResolvedValue(makeJob({ copiesSold: 4 }));

    const onClose = vi.fn();
    const onSaved = vi.fn();
    await renderModal({
      convertingFromQuote: makeQuote({ quoteNumber: 42 }),
      onClose,
      onSaved,
    });

    const recordBtn = findButton('Record Sale');
    expect(recordBtn).toBeDefined();
    await act(async () => { recordBtn!.click(); });

    // Pitfall 2 lock: atomic tx fired, addSale was NOT used
    expect(txSpy).toHaveBeenCalledTimes(1);
    expect(addSaleSpy).not.toHaveBeenCalled();

    // tx invoked with 'rw' mode + sales/quotes/jobs tables as positional args
    expect(txSpy.mock.calls[0][0]).toBe('rw');

    // Inner transaction body called all three writes
    expect(dbSalesAddSpy).toHaveBeenCalledTimes(1);
    expect(dbQuotesPutSpy).toHaveBeenCalledTimes(1);
    expect(dbJobsGetSpy).toHaveBeenCalledTimes(1);
    expect(dbJobsPutSpy).toHaveBeenCalledTimes(1);  // copiesSold bump path

    // Quote patch carries the runtime-narrowed status
    const quotePatch = dbQuotesPutSpy.mock.calls[0][0];
    expect(quotePatch.status).toBe('converted');
    expect(quotePatch.convertedToSaleId).toMatch(/^sale-/);
    expect(quotePatch.convertedAt).toBeInstanceOf(Date);

    // Sale carries the back-reference to the originating Quote
    const sale = dbSalesAddSpy.mock.calls[0][0];
    expect(sale.convertedFromQuoteId).toBe('quote-convert');

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RecordSaleModal — picker integration (Test 4 — D-05 lock)', () => {
  it('clicking a customer in the listbox fills Name/Email/Company/Address but NOT Notes', async () => {
    await renderModal();

    // Pre-fill Notes so we can prove it stays unchanged after pick
    const notesTextareas = document.body.querySelectorAll('textarea');
    // 1st textarea = address; 2nd = notes
    const notesTextarea = notesTextareas[1] as HTMLTextAreaElement;
    await act(async () => { typeIntoInput(notesTextarea, 'do not overwrite this'); });
    expect(notesTextarea.value).toBe('do not overwrite this');

    // Type into the picker to open the dropdown with the seeded customer
    const pickerInput = document.getElementById('customer-picker-input') as HTMLInputElement;
    expect(pickerInput).toBeTruthy();
    await act(async () => { typeIntoInput(pickerInput, 'mar'); });

    // Click the seeded customer's option
    const option = document.getElementById('customer-option-cust-marcus') as HTMLButtonElement | null;
    expect(option).toBeTruthy();
    await act(async () => { option!.click(); });

    // Form 4-field fill check
    const nameInput = findInputByPlaceholder('Jane Doe')!;
    const emailInput = findInputByPlaceholder('jane@example.com')!;
    expect(nameInput.value).toBe('Marcus');
    expect(emailInput.value).toBe('marcus@example.com');

    // D-05: Notes field UNCHANGED
    const notesAfterPick = document.body.querySelectorAll('textarea')[1] as HTMLTextAreaElement;
    expect(notesAfterPick.value).toBe('do not overwrite this');
  });
});

describe('RecordSaleModal — cancel path safety (Test 5)', () => {
  it('Cancel calls onClose; does NOT invoke addSale / updateSale / db.transaction', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });

    const cancelBtn = findButton('Cancel');
    expect(cancelBtn).toBeDefined();
    await act(async () => { cancelBtn!.click(); });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(addSaleSpy).not.toHaveBeenCalled();
    expect(updateSaleSpy).not.toHaveBeenCalled();
    expect(txSpy).not.toHaveBeenCalled();
  });
});

describe('WR-02 — hydration dep array stability (Phase 22.1 D-09)', () => {
  it('salePrice form state survives a useLiveQuery re-emission that mutates job.sellingPrice', async () => {
    // EDIT mode with editingSale.unitPrice = 50.
    // The hydration useEffect should ONLY re-fire on editingSale/convertingFromQuote
    // identity changes — NOT on job.sellingPrice mutations from a concurrent
    // useLiveQuery emission. After the parent re-renders with a mutated job
    // (e.g., user updated the job's selling price in another tab/component while
    // this modal sits open), the salePrice input MUST still reflect the
    // editingSale-driven value, not the new job.sellingPrice.
    const job = makeJob({ sellingPrice: 0 });
    const editingSale = makeSale({ unitPrice: 50 });
    const baseProps = {
      job,
      userCurrency: 'USD' as const,
      shippingConfig: makeShippingConfig(),
      editingSale,
      convertingFromQuote: null,
      isOpen: true,
      onClose: vi.fn(),
      onSaved: vi.fn(),
    };

    await act(async () => {
      root!.render(<RecordSaleModal {...baseProps} />);
    });

    // 1st number input = quantity; 2nd = price (mirror of Test 3 pattern)
    const numberInputsBefore = document.body.querySelectorAll('input[type="number"]');
    const priceInputBefore = numberInputsBefore[1] as HTMLInputElement;
    expect(priceInputBefore.value).toBe('50');

    // Simulate a useLiveQuery re-emission that mutates job.sellingPrice while
    // the modal is open — the parent re-renders with the same editingSale id
    // but a new job object whose sellingPrice has jumped to 999.
    await act(async () => {
      root!.render(
        <RecordSaleModal {...baseProps} job={{ ...job, sellingPrice: 999 }} />,
      );
    });

    const numberInputsAfter = document.body.querySelectorAll('input[type="number"]');
    const priceInputAfter = numberInputsAfter[1] as HTMLInputElement;
    expect(priceInputAfter.value).toBe('50');  // NOT '999' — hydration must NOT re-fire
  });
});
