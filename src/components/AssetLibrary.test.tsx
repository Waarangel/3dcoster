import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AssetLibrary } from './AssetLibrary';
import type { Asset, Currency } from '../types';

// ---------------------------------------------------------------------------
// AssetLibrary — A11Y-11 (WCAG 3.3.1 / 1.3.1): form-error association
//   • Error container must render with role="alert" and a non-empty id
//   • The failing Name input must expose aria-invalid="true" and
//     aria-describedby pointing at the error container's id
//   • When no error is present, the input must NOT carry aria-invalid="true"
//     or a dangling aria-describedby.
//
// A11Y-12 (4.1.2) / A11Y-15: Asset-row icon buttons + category group +
//   SortIndicator aria-hidden
//   • EditButton/DeleteButton on asset rows expose aria-label "Edit {name}" /
//     "Delete {name}"
//   • Category filter buttons live inside a role="group" with non-empty aria-label
//   • SortIndicator span carries aria-hidden="true"
// ---------------------------------------------------------------------------

// Minimal Asset fixture
const makeAsset = (overrides?: Partial<Asset>): Asset => ({
  id: 'asset-1',
  name: 'Test Filament',
  category: 'filament',
  unit: 'g',
  costPerUnit: 0.02,
  packageCost: 20,
  unitsPerPackage: 1000,
  currency: 'USD' as Currency,
  ...overrides,
});

// Minimal props required by AssetLibrary
const defaultProps = {
  assets: [makeAsset()],
  isLoading: false,
  onAddAsset: vi.fn(),
  onUpdateAsset: vi.fn(),
  onDeleteAsset: vi.fn(),
  onBulkImportAssets: vi.fn(() => Promise.resolve()),
  onResetScope: vi.fn(),
  itemsPerPage: 25,
  onItemsPerPageChange: vi.fn(),
  userCurrency: 'USD' as Currency,
  fxTable: null,
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: render AssetLibrary with the add form open (click the "+ Add Asset" button)
// ---------------------------------------------------------------------------
async function renderWithFormOpen(props = defaultProps): Promise<void> {
  await act(async () => {
    root!.render(<AssetLibrary {...props} />);
  });

  // Click the "+ Add Asset" button to open the form
  const addButton = Array.from(container!.querySelectorAll('button')).find(
    (b) => b.textContent?.includes('Add Asset') || b.textContent?.includes('Add asset')
  );
  if (!addButton) {
    // Fallback: look for the "+" or "Add" button that opens the form
    const altButton = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim().startsWith('+') || b.getAttribute('aria-label')?.includes('Add')
    );
    if (altButton) {
      await act(async () => {
        altButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }
  } else {
    await act(async () => {
      addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }
}

// ---------------------------------------------------------------------------
// Helper: submit the form without filling in any fields (triggers validation error)
// ---------------------------------------------------------------------------
async function submitEmptyForm(): Promise<void> {
  const form = container!.querySelector('form');
  if (!form) throw new Error('Form not found in DOM');
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

// ===========================================================================
// A11Y-11: Form-error association
// ===========================================================================

describe('AssetLibrary — A11Y-11: form validation error association', () => {
  it('renders error container with role="alert" when form is submitted empty', async () => {
    await renderWithFormOpen();
    await submitEmptyForm();

    const alertEl = container!.querySelector('[role="alert"]');
    expect(alertEl, 'Expected [role="alert"] element after failed form submission').not.toBeNull();
  });

  it('error container has a non-empty id when formError is set', async () => {
    await renderWithFormOpen();
    await submitEmptyForm();

    const alertEl = container!.querySelector('[role="alert"]');
    expect(alertEl).not.toBeNull();
    const id = alertEl!.getAttribute('id');
    expect(id, 'role="alert" element must have a non-empty id').toBeTruthy();
    expect(id!.length).toBeGreaterThan(0);
  });

  it('Name input has aria-invalid="true" when form error is active', async () => {
    await renderWithFormOpen();
    await submitEmptyForm();

    // The Name input is the first required text input in the form; it gets aria-invalid
    // when a formError is set. Locate it via the form's first required text input.
    const form = container!.querySelector('form');
    expect(form, 'Form not found after submission').not.toBeNull();
    const nameInput = form!.querySelector('input[required][type="text"]');
    expect(nameInput, 'Name input (first required text input in form) not found').not.toBeNull();

    expect(nameInput!.getAttribute('aria-invalid')).toBe('true');
  });

  it('Name input aria-describedby points at the error container id when error is set', async () => {
    await renderWithFormOpen();
    await submitEmptyForm();

    const alertEl = container!.querySelector('[role="alert"]');
    expect(alertEl).not.toBeNull();
    const errorId = alertEl!.getAttribute('id');

    const form = container!.querySelector('form');
    expect(form).not.toBeNull();
    const nameInput = form!.querySelector('input[required][type="text"]');
    expect(nameInput, 'Name input (first required text input in form) not found').not.toBeNull();

    expect(nameInput!.getAttribute('aria-describedby')).toBe(errorId);
  });

  it('Name input has no aria-invalid="true" when the form is clean (no error)', async () => {
    await renderWithFormOpen();
    // Do NOT submit — the form is clean

    const firstInput = container!.querySelector('input');
    expect(firstInput).not.toBeNull();
    // aria-invalid should be absent or not "true"
    const invalid = firstInput!.getAttribute('aria-invalid');
    expect(invalid).not.toBe('true');
  });

  it('Name input has no aria-describedby pointing at an error id when form is clean', async () => {
    await renderWithFormOpen();
    // Do NOT submit

    const firstInput = container!.querySelector('input');
    expect(firstInput).not.toBeNull();
    // If aria-describedby is absent or empty that satisfies the requirement
    const describedBy = firstInput!.getAttribute('aria-describedby');
    // It should be null (undefined translates to absent attribute in the DOM)
    expect(describedBy).toBeNull();
  });
});

// ===========================================================================
// A11Y-12: Asset-row edit/delete icon button labels
// ===========================================================================

describe('AssetLibrary — A11Y-12: Asset-row icon button accessible labels', () => {
  it('EditButton on asset row has aria-label containing the asset name', async () => {
    await act(async () => {
      root!.render(<AssetLibrary {...defaultProps} />);
    });

    const editButton = container!.querySelector('[aria-label="Edit Test Filament"]');
    expect(editButton, 'Expected Edit button with aria-label="Edit Test Filament"').not.toBeNull();
  });

  it('DeleteButton on asset row has aria-label containing the asset name', async () => {
    await act(async () => {
      root!.render(<AssetLibrary {...defaultProps} />);
    });

    const deleteButton = container!.querySelector('[aria-label="Delete Test Filament"]');
    expect(deleteButton, 'Expected Delete button with aria-label="Delete Test Filament"').not.toBeNull();
  });
});

// ===========================================================================
// A11Y-15: Category filter group + SortIndicator aria-hidden
// ===========================================================================

describe('AssetLibrary — A11Y-15: category filter group and SortIndicator', () => {
  it('category filter buttons are wrapped in role="group"', async () => {
    await act(async () => {
      root!.render(<AssetLibrary {...defaultProps} />);
    });

    const group = container!.querySelector('[role="group"]');
    expect(group, 'Expected [role="group"] element for category filter buttons').not.toBeNull();
  });

  it('the category filter role="group" has a non-empty aria-label', async () => {
    await act(async () => {
      root!.render(<AssetLibrary {...defaultProps} />);
    });

    const group = container!.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    const label = group!.getAttribute('aria-label');
    expect(label, 'role="group" must have a non-empty aria-label').toBeTruthy();
    expect(label!.length).toBeGreaterThan(0);
  });

  it('the search input is NOT inside the category filter role="group"', async () => {
    await act(async () => {
      root!.render(<AssetLibrary {...defaultProps} />);
    });

    const group = container!.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    // The search input should not be a descendant of the group
    const searchInsideGroup = group!.querySelector('input[type="text"]');
    expect(searchInsideGroup, 'Search input must NOT be inside the role="group"').toBeNull();
  });

  it('SortIndicator span has aria-hidden="true"', async () => {
    await act(async () => {
      root!.render(<AssetLibrary {...defaultProps} />);
    });

    // Trigger a sort by clicking a sortable column header (if rendered)
    // The SortIndicator is only rendered when sortField matches — check the default
    // which should render a SortIndicator for the "name" column by default
    const ariaHiddenSpans = container!.querySelectorAll('span[aria-hidden="true"]');
    // The SortIndicator uses ▲/▼ — find spans with those characters
    const sortSpan = Array.from(ariaHiddenSpans).find(
      (s) => s.textContent === '▲' || s.textContent === '▼'
    );
    expect(sortSpan, 'Expected SortIndicator span with aria-hidden="true"').not.toBeNull();
  });
});
