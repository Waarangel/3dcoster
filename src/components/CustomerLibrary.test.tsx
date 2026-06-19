import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Customer } from '../types';

// ---------------------------------------------------------------------------
// CustomerLibrary — Phase 23 plan 23-02 (TEST-03).
//
// Covers per ROADMAP §Phase 23 SC#3:
//   1. Search-filter behavior (narrow visible rows by query)
//   2. Empty state (no customers → EmptyState, isLoading → skeleton)
//   3. CL-01 sort lock (lastUsedAt desc, undefined-first)
//   4. Delete confirmation flow (window.confirm → onDeleteCustomer)
//   5. Edit modal open/close (CustomerEditModal opens/closes without save)
//
// No testing-library (D-08). Raw createRoot + act per project convention
// (Phase 19 D-21, Phase 22 D-21). Real <Modal> primitive (D-07).
// Data via props only — useDatabase hook not needed.
// db is mocked (component calls db.sales.filter(...).count() on delete path).
//
// react-window <List> is mocked to render all rows directly so jsdom's
// zero-height viewport doesn't hide virtualized rows — standard test-layer
// pattern for virtualized components (not a production behavior change).
// ---------------------------------------------------------------------------

// ─── Spies (must be created before vi.mock factory references them) ─────────
const onAddCustomerSpy = vi.fn<(c: Customer) => Promise<void>>().mockResolvedValue();
const onUpdateCustomerSpy = vi.fn<(c: Customer) => Promise<void>>().mockResolvedValue();
const onDeleteCustomerSpy = vi.fn<(id: string) => Promise<void>>().mockResolvedValue();
const onBulkImportCustomersSpy = vi.fn<(toImport: Customer[]) => Promise<void>>().mockResolvedValue();

// db.sales.filter().count() spy — returns 0 by default (no sales linked to customer)
const dbSalesFilterCountSpy = vi.fn().mockResolvedValue(0);

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock db so CustomerLibrary's handleDelete can call db.sales.filter().count()
// without a real IndexedDB. Returns 0 (no past sales) by default.
vi.mock('../db/database', () => ({
  db: {
    sales: {
      filter: () => ({
        count: dbSalesFilterCountSpy,
      }),
    },
  },
}));

// Mock react-window <List> to render all rows directly (avoids jsdom
// zero-height viewport hiding virtualized rows). Production behavior unchanged.
vi.mock('react-window', () => ({
  List: ({ rowCount, rowComponent: RowComponent, rowProps, style }: {
    rowCount: number;
    rowComponent: React.ComponentType<{ index: number; style: React.CSSProperties; [k: string]: unknown }>;
    rowProps: Record<string, unknown>;
    style?: React.CSSProperties;
  }) => {
    const rows = [];
    for (let i = 0; i < rowCount; i++) {
      rows.push(<RowComponent key={i} index={i} style={{}} {...rowProps} />);
    }
    return <div role="list" style={style}>{rows}</div>;
  },
  useDynamicRowHeight: () => () => 88,
}));

// Dynamic import AFTER mocks
const { CustomerLibrary } = await import('./CustomerLibrary');

// ─── DOM harness ─────────────────────────────────────────────────────────────

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  onAddCustomerSpy.mockClear();
  onUpdateCustomerSpy.mockClear();
  onDeleteCustomerSpy.mockClear();
  onBulkImportCustomersSpy.mockClear();
  dbSalesFilterCountSpy.mockClear();
  dbSalesFilterCountSpy.mockResolvedValue(0);
  container = document.createElement('div');
  container.style.height = '800px';
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer>): Customer {
  return {
    id: `cust-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Test Customer',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface RenderOpts {
  customers?: Customer[];
  isLoading?: boolean;
}

async function renderLibrary(opts: RenderOpts = {}) {
  const props = {
    customers: opts.customers ?? [],
    isLoading: opts.isLoading ?? false,
    onAddCustomer: onAddCustomerSpy,
    onUpdateCustomer: onUpdateCustomerSpy,
    onDeleteCustomer: onDeleteCustomerSpy,
    onBulkImportCustomers: onBulkImportCustomersSpy,
  };
  await act(async () => {
    root!.render(<CustomerLibrary {...props} />);
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomerLibrary — search-filter behavior (Test 1)', () => {
  it('typing a query narrows visible rows to matching customers only', async () => {
    const customers = [
      makeCustomer({ id: 'c-alice', name: 'Alice', email: 'alice@example.com' }),
      makeCustomer({ id: 'c-bob', name: 'Bob', email: 'bob@example.com' }),
      makeCustomer({ id: 'c-carol', name: 'Carol', email: 'carol@example.com' }),
      makeCustomer({ id: 'c-dave', name: 'Dave', email: 'dave@example.com' }),
    ];
    await renderLibrary({ customers });

    // All 4 rows visible initially
    expect(document.body.textContent ?? '').toContain('Alice');
    expect(document.body.textContent ?? '').toContain('Bob');
    expect(document.body.textContent ?? '').toContain('Carol');
    expect(document.body.textContent ?? '').toContain('Dave');

    // Type "ali" into the search input (placeholder: "Search by name, email, or company")
    const searchInput = document.body.querySelector(
      'input[placeholder="Search by name, email, or company"]'
    ) as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();

    await act(async () => {
      typeIntoInput(searchInput!, 'ali');
    });

    // Only Alice remains visible
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain('Alice');
    expect(bodyText).not.toContain('Bob');
    expect(bodyText).not.toContain('Carol');
    expect(bodyText).not.toContain('Dave');
  });
});

describe('CustomerLibrary — empty state (Test 2)', () => {
  it('renders empty-state copy when customers is empty and isLoading is false', async () => {
    await renderLibrary({ customers: [], isLoading: false });
    // EmptyState title from CustomerLibrary.tsx: "No customers yet"
    expect(document.body.textContent ?? '').toContain('No customers yet');
  });

  it('renders skeleton (not empty-state) when isLoading is true', async () => {
    await renderLibrary({ customers: [], isLoading: true });
    // Skeleton renders, EmptyState title must NOT appear
    expect(document.body.textContent ?? '').not.toContain('No customers yet');
  });
});

describe('CustomerLibrary — CL-01 sort lock (Test 3)', () => {
  it('renders customers in lastUsedAt DESC order with undefined-first', async () => {
    // Reference: .planning/phases/15.1-customer-library/15.1-CONTEXT.md §CL-01
    // Sort contract: undefined lastUsedAt FIRST (never-used floats to top),
    // then descending by lastUsedAt date. Tiebreaker: name asc.

    // Fixture provided in a NON-sorted order to verify the component sorts correctly:
    const customers: Customer[] = [
      // C1: lastUsedAt = 2026-05-01 (recent)
      { id: 'c1', name: 'Used Recently', createdAt: new Date('2025-01-01'), lastUsedAt: new Date('2026-05-01') },
      // C2: lastUsedAt = undefined (never used — should float to top)
      { id: 'c2', name: 'Never Used A', createdAt: new Date('2025-01-01'), lastUsedAt: undefined },
      // C3: lastUsedAt = 2025-01-01 (old)
      { id: 'c3', name: 'Used Long Ago', createdAt: new Date('2025-01-01'), lastUsedAt: new Date('2025-01-01') },
      // C4: lastUsedAt = undefined (never used — should also float to top, tiebreaker: name asc puts before Never Used B)
      { id: 'c4', name: 'Never Used B', createdAt: new Date('2025-01-01'), lastUsedAt: undefined },
    ];

    await renderLibrary({ customers });

    // Collect rendered customer name elements.
    // CustomerRowItem renders: <div className="text-sm font-medium text-white truncate">{name}</div>
    const nameEls = document.body.querySelectorAll<HTMLElement>('div.text-sm.font-medium.text-white.truncate');
    const renderedNames = Array.from(nameEls).map(el => (el.textContent ?? '').trim());

    // Expected CL-01 order:
    // 1st: undefined-lastUsedAt group, name-asc tiebreaker: "Never Used A" < "Never Used B"
    // 2nd: undefined-lastUsedAt group: "Never Used B"
    // 3rd: used-recently (2026-05-01 > 2025-01-01 → first in desc order): "Used Recently"
    // 4th: used-long-ago (2025-01-01): "Used Long Ago"
    expect(renderedNames[0]).toBe('Never Used A');
    expect(renderedNames[1]).toBe('Never Used B');
    expect(renderedNames[2]).toBe('Used Recently');
    expect(renderedNames[3]).toBe('Used Long Ago');
  });
});

describe('CustomerLibrary — delete confirmation flow (Test 4)', () => {
  it('clicking Delete → confirm → calls onDeleteCustomer with the customer id', async () => {
    const customer = makeCustomer({ id: 'c-del', name: 'Delete Me', email: 'del@example.com' });
    await renderLibrary({ customers: [customer] });

    // Stub window.confirm to auto-confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    // Find and click the Delete button. CustomerRowItem now renders an
    // icon-only DeleteButton labelled `aria-label="Delete {name}"`.
    const deleteBtn = document.body.querySelector(
      `button[aria-label="Delete ${customer.name}"]`
    ) as HTMLButtonElement | null;
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn!.click();
      // Allow async db.sales.filter().count() to resolve
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // window.confirm should have been called
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    // onDeleteCustomer should be called with the customer's id
    expect(onDeleteCustomerSpy).toHaveBeenCalledTimes(1);
    expect(onDeleteCustomerSpy.mock.calls[0][0]).toBe('c-del');

    confirmSpy.mockRestore();
  });

  it('dismissing the confirmation does NOT call onDeleteCustomer', async () => {
    const customer = makeCustomer({ id: 'c-keep', name: 'Keep Me' });
    await renderLibrary({ customers: [customer] });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const deleteBtn = document.body.querySelector(
      `button[aria-label="Delete ${customer.name}"]`
    ) as HTMLButtonElement | null;
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn!.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onDeleteCustomerSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});

describe('CustomerLibrary — edit modal open/close (Test 5)', () => {
  it('clicking Edit opens CustomerEditModal; closing it removes the modal from DOM', async () => {
    const customer = makeCustomer({ id: 'c-edit', name: 'Edit Me', email: 'edit@example.com' });
    await renderLibrary({ customers: [customer] });

    // The CustomerEditModal should not be visible initially (isOpen=false keeps it closed)
    expect(document.body.textContent ?? '').not.toContain('Edit customer');

    // Find and click the Edit button (icon-only, labelled `Edit {name}`)
    const editBtn = document.body.querySelector(
      `button[aria-label="Edit ${customer.name}"]`
    ) as HTMLButtonElement | null;
    expect(editBtn).not.toBeNull();

    await act(async () => {
      editBtn!.click();
    });

    // CustomerEditModal title: the modal renders an h3 with the title from Modal prop
    // CustomerLibrary passes initialCustomer → CustomerEditModal title is "Edit customer"
    expect(document.body.textContent ?? '').toContain('Edit customer');

    // Close the modal by clicking Cancel
    const cancelBtn = findButton('Cancel');
    expect(cancelBtn).not.toBeUndefined();

    await act(async () => {
      cancelBtn!.click();
    });

    // Modal should be closed — "Edit customer" no longer in DOM
    expect(document.body.textContent ?? '').not.toContain('Edit customer');

    // onUpdateCustomer was NOT called (we only tested open/close, not save)
    expect(onUpdateCustomerSpy).not.toHaveBeenCalled();
  });
});
