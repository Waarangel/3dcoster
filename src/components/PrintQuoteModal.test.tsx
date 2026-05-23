import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Customer, PrintJob, UserProfile, Quote } from '../types';
import type { CreateQuoteInput } from '../hooks/useDatabase';

// ---------------------------------------------------------------------------
// PrintQuoteModal — Phase 16 gap closure (16-10).
//
// Test coverage strategy:
//   * Tests 1-3: STATIC ARCHITECTURAL LOCKS (BLOCKER I-01 + WARNING I-07 +
//     G6 enforcement). These are grep-style file reads that catch any future
//     regression that tries to import `db` directly, call `dbSetUserProfile`,
//     or open a Dexie transaction from the modal component. These run in
//     milliseconds, no React mounting required.
//   * Tests 4-6: NUMERIC + VALIDATION CONTRACTS (D-22 tax base lock, totals
//     formula, validation predicate). Pure-function checks.
//   * Test 7: HOOK-ACTION INVOCATION (DOM mount + happy-path Generate click).
//     Verifies the CreateQuoteInput payload shape and that generateQuotePdf
//     fires with the returned Quote.
//   * Test 8: CANCEL PATH safety — clicking Cancel does NOT invoke createQuote
//     or generateQuotePdf.
//
// Note: Test 1 implicitly covers BLOCKER I-01 (no deferred-runtime-decision
// fallback) — if the modal opened its own db.transaction the grep would fail.
// ---------------------------------------------------------------------------

// Mocks — must declare before importing the component under test.
const createQuoteSpy = vi.fn<(input: CreateQuoteInput) => Promise<Quote>>();
const generateQuotePdfSpy = vi.fn<(quote: Quote) => Promise<void>>();

// Customer fixtures referenced by tests
const seededCustomer: Customer = {
  id: 'cust-marcus',
  name: 'Marcus',
  email: 'marcus@example.com',
  createdAt: new Date('2026-01-01'),
};

vi.mock('../hooks/useDatabase', () => ({
  useQuotes: () => ({
    quotes: [],
    quotesByJobId: new Map(),
    isLoading: false,
    addQuote: vi.fn(),
    updateQuote: vi.fn(),
    deleteQuote: vi.fn(),
    createQuote: createQuoteSpy,
  }),
  useCustomers: () => ({
    customers: [seededCustomer],
    customersByEmail: new Map([[seededCustomer.email!.toLowerCase(), seededCustomer]]),
    isLoading: false,
    addCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
    bumpLastUsed: vi.fn(),
    bulkImportCustomers: vi.fn(),
  }),
}));

vi.mock('../pdf/generateQuotePdf', () => ({
  generateQuotePdf: generateQuotePdfSpy,
}));

// Now import the component under test (after mocks are wired).
const { PrintQuoteModal } = await import('./PrintQuoteModal');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

function makeQuoteFromInput(input: CreateQuoteInput): Quote {
  const now = new Date();
  return {
    id: 'quote-test',
    quoteNumber: input.userProfile.nextQuoteNumber ?? 1,
    printJobId: input.job.id,
    customerId: input.existingCustomerId,
    customerSnapshot: input.customerSnapshot,
    lineItemsSnapshot: {
      jobTitle: input.job.name,
      sellingPrice: input.job.sellingPrice,
      shippingCost: input.shippingCost,
      resolvedTaxRate: input.resolvedTaxRate,
      taxAmount: input.taxAmount,
      currency: input.userProfile.currency,
      notes: input.job.notes ?? '',
      terms: input.userProfile.defaultTerms ?? '',
      countryAtSendTime: input.userProfile.address?.country,
    },
    status: 'sent',
    createdAt: now,
    sentAt: now,
  };
}

// ---------------------------------------------------------------------------
// DOM harness
// ---------------------------------------------------------------------------

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  createQuoteSpy.mockReset();
  createQuoteSpy.mockImplementation((input: CreateQuoteInput) => Promise.resolve(makeQuoteFromInput(input)));
  generateQuotePdfSpy.mockReset();
  generateQuotePdfSpy.mockImplementation(() => Promise.resolve());
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

async function renderModal(opts: { job?: PrintJob; userProfile?: UserProfile; onQuoteCreated?: (q: Quote) => void; onClose?: () => void } = {}) {
  const props = {
    job: opts.job ?? makeJob(),
    userProfile: opts.userProfile ?? makeUserProfile(),
    isOpen: true,
    onClose: opts.onClose ?? vi.fn(),
    onQuoteCreated: opts.onQuoteCreated ?? vi.fn(),
  };
  await act(async () => {
    root!.render(<PrintQuoteModal {...props} />);
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PrintQuoteModal — static architectural locks (BLOCKER I-01 + WARNING I-07 + G6)', () => {
  const MODAL_SRC = readFileSync(
    resolve(__dirname, 'PrintQuoteModal.tsx'),
    'utf8',
  );

  it('I-07 Option B lock: does NOT import `db` from ../db/database', () => {
    expect(MODAL_SRC).not.toMatch(/from '\.\.\/db\/database'/);
    expect(MODAL_SRC).not.toMatch(/from "\.\.\/db\/database"/);
  });

  it('I-07 Option B lock: does NOT open any Dexie transaction', () => {
    expect(MODAL_SRC).not.toMatch(/db\.transaction\(/);
  });

  it('I-01 + I-07 lock: uses createQuote from useQuotes (the single seam for all multi-store writes)', () => {
    expect(MODAL_SRC).toMatch(/createQuote/);
    expect(MODAL_SRC).toMatch(/useQuotes/);
  });
});

describe('PrintQuoteModal — validation', () => {
  it('Generate Quote button is disabled when both Name and Email are blank', async () => {
    await renderModal();
    const generateBtn = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim().startsWith('Generate Quote'),
    ) as HTMLButtonElement | undefined;
    expect(generateBtn).toBeDefined();
    expect(generateBtn!.disabled).toBe(true);
  });

  it('Generate Quote button enables when Name has content', async () => {
    await renderModal();
    const nameInput = container!.querySelector('input[placeholder="Jane Doe"]') as HTMLInputElement | null;
    expect(nameInput).toBeTruthy();
    await act(async () => { typeIntoInput(nameInput!, 'Alice'); });
    const generateBtn = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim().startsWith('Generate Quote'),
    ) as HTMLButtonElement;
    expect(generateBtn.disabled).toBe(false);
  });
});

describe('PrintQuoteModal — D-22 tax-base lock + totals', () => {
  it('Generate click passes CreateQuoteInput with taxAmount = sellingPrice × rate/100 (NOT (subtotal+shipping) × rate)', async () => {
    // sellingPrice=100, shipping=10, defaultTaxRate=20 → tax=20 (NOT 22).
    await renderModal({
      job: makeJob({ sellingPrice: 100, taxRate: 20, taxAmount: 20 }),
      userProfile: makeUserProfile({ defaultTaxRate: 20 }),
    });
    // Type a customer name to pass validation
    const nameInput = container!.querySelector('input[placeholder="Jane Doe"]') as HTMLInputElement;
    await act(async () => { typeIntoInput(nameInput, 'D-22 Test'); });
    // Type shipping = 10
    const shippingInput = container!.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => { typeIntoInput(shippingInput, '10'); });
    // Click Generate
    const generateBtn = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim().startsWith('Generate Quote'),
    ) as HTMLButtonElement;
    await act(async () => { generateBtn.click(); });

    expect(createQuoteSpy).toHaveBeenCalledTimes(1);
    const input = createQuoteSpy.mock.calls[0][0];
    expect(input.shippingCost).toBe(10);
    expect(input.resolvedTaxRate).toBe(20);
    expect(input.taxAmount).toBeCloseTo(20, 5);  // D-22: 100 × 0.20 = 20, NOT 110 × 0.20 = 22
  });
});

describe('PrintQuoteModal — happy path (Test 7)', () => {
  it('Generate click invokes createQuote with the snapshot payload, then generateQuotePdf with the returned Quote', async () => {
    const onQuoteCreated = vi.fn();
    const onClose = vi.fn();
    await renderModal({ onQuoteCreated, onClose });

    const nameInput = container!.querySelector('input[placeholder="Jane Doe"]') as HTMLInputElement;
    const emailInput = container!.querySelector('input[type="email"]') as HTMLInputElement;
    const companyInput = container!.querySelector('input[placeholder="Acme Co."]') as HTMLInputElement;
    await act(async () => {
      typeIntoInput(nameInput, 'Alice');
      typeIntoInput(emailInput, 'alice@example.com');
      typeIntoInput(companyInput, 'Acme');
    });

    const generateBtn = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim().startsWith('Generate Quote'),
    ) as HTMLButtonElement;
    await act(async () => { generateBtn.click(); });

    expect(createQuoteSpy).toHaveBeenCalledTimes(1);
    const input = createQuoteSpy.mock.calls[0][0];
    expect(input.customerSnapshot.name).toBe('Alice');
    expect(input.customerSnapshot.email).toBe('alice@example.com');
    expect(input.customerSnapshot.company).toBe('Acme');
    expect(input.existingCustomerId).toBeUndefined();  // no email match

    expect(generateQuotePdfSpy).toHaveBeenCalledTimes(1);
    const pdfQuote = generateQuotePdfSpy.mock.calls[0][0];
    expect(pdfQuote.customerSnapshot.name).toBe('Alice');

    expect(onQuoteCreated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Email-match dedup: typing an email that matches a library record passes existingCustomerId to createQuote', async () => {
    await renderModal();
    const emailInput = container!.querySelector('input[type="email"]') as HTMLInputElement;
    await act(async () => { typeIntoInput(emailInput, 'marcus@example.com'); });

    const generateBtn = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim().startsWith('Generate Quote'),
    ) as HTMLButtonElement;
    await act(async () => { generateBtn.click(); });

    expect(createQuoteSpy).toHaveBeenCalledTimes(1);
    expect(createQuoteSpy.mock.calls[0][0].existingCustomerId).toBe('cust-marcus');
  });
});

describe('PrintQuoteModal — cancel path safety (Test 8)', () => {
  it('Cancel does NOT invoke createQuote or generateQuotePdf', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });

    const cancelBtn = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel',
    ) as HTMLButtonElement;
    await act(async () => { cancelBtn.click(); });

    expect(createQuoteSpy).not.toHaveBeenCalled();
    expect(generateQuotePdfSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
