import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Customer } from '../types';

// ---------------------------------------------------------------------------
// CustomerCsvImportModal — Phase 23 plan 23-02 (TEST-02).
//
// Covers the CSV import modal's two-step flow per ROADMAP §Phase 23 SC#2:
//   1. Upload non-CSV file → WR-06 error (file name check)
//   2. Upload valid CSV → Upload step transitions to Preview step
//   3. Dedup-mode toggle (skip vs overwrite) changes flagged rows
//   4. Row select/deselect updates import-button label/count
//   5. Confirm-import call shape (onImportCustomers with correct Customer[])
//
// No testing-library (D-08). Raw createRoot + act per project convention
// (Phase 19 D-21, Phase 22 D-21). Real <Modal> primitive (D-07).
// Data via props only — no useDatabase mock needed (component has no hook
// beyond what props provide per D-06).
// ---------------------------------------------------------------------------

// ─── Spies (must be created before vi.mock factory references them) ─────────
const onImportCustomersSpy = vi.fn<(toImport: Customer[]) => Promise<void>>().mockResolvedValue();
const onCloseSpy = vi.fn<() => void>();

// Now import the component under test (no vi.mock needed — component uses props only)
const { CustomerCsvImportModal } = await import('./CustomerCsvImportModal');

// ─── DOM harness ─────────────────────────────────────────────────────────────

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  onImportCustomersSpy.mockClear();
  onImportCustomersSpy.mockResolvedValue();
  onCloseSpy.mockClear();
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const existingCustomer: Customer = {
  id: 'cust-alice',
  name: 'Alice',
  email: 'alice@example.com',
  createdAt: new Date('2026-01-01'),
};

// Minimal valid CSV: header row + 2 data rows (one fresh, one duplicate)
const VALID_CSV = 'name,email\nBob,bob@example.com\nAlice,alice@example.com\n';
// CSV with only fresh rows (no duplicates)
const FRESH_CSV = 'name,email\nBob,bob@example.com\nCarol,carol@example.com\n';

function makeValidCsvFile(csvString: string = VALID_CSV): File {
  return new File([csvString], 'customers.csv', { type: 'text/csv' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface RenderOpts {
  existingCustomers?: Customer[];
}

async function renderModal(opts: RenderOpts = {}) {
  const props = {
    isOpen: true,
    existingCustomers: opts.existingCustomers ?? [],
    onImportCustomers: onImportCustomersSpy,
    onClose: onCloseSpy,
  };
  await act(async () => {
    root!.render(<CustomerCsvImportModal {...props} />);
  });
  return props;
}

/**
 * Simulate a file upload via the hidden file input.
 * Injects the file into the input's `files` property and dispatches a change event.
 */
async function simulateFileUpload(file: File): Promise<void> {
  const input = document.body.querySelector('input[type="file"]') as HTMLInputElement | null;
  expect(input).not.toBeNull();
  Object.defineProperty(input!, 'files', { value: [file], configurable: true });
  await act(async () => {
    input!.dispatchEvent(new Event('change', { bubbles: true }));
    // Flush async work: file.text() AND the dynamic import('papaparse') inside
    // parseCustomerCsv (lazy-loaded for bundle size). The module load needs
    // more than one tick; flush several macrotasks to let it settle + render.
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });
}

function findButton(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === text,
  ) as HTMLButtonElement | undefined;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomerCsvImportModal — upload step (Test 1): non-CSV file → WR-06 error', () => {
  it('shows an error message when file name does not end with .csv', async () => {
    await renderModal();

    // Verify the modal starts in the upload step (no import button visible)
    expect(findButton('Import 0 customers')).toBeUndefined();
    expect(findButton('Import 1 customer')).toBeUndefined();

    // Upload a file whose name doesn't end with .csv
    const badFile = new File(['hello world'], 'photo.png', { type: 'image/png' });
    await simulateFileUpload(badFile);

    // WR-06 error: modal shows the rejection message from processFile()
    // The exact copy is "Please select a .csv file." (CustomerCsvImportModal.tsx line 69)
    expect(document.body.textContent ?? '').toContain('Please select a .csv file.');

    // onImportCustomers was NOT called — modal stays on upload step
    expect(onImportCustomersSpy).not.toHaveBeenCalled();

    // No preview rows visible (still on upload step)
    expect(document.body.querySelector('input[type="checkbox"]')).toBeNull();
  });
});

describe('CustomerCsvImportModal — upload step (Test 2): valid CSV → preview step', () => {
  it('transitions to the preview step after a valid CSV is uploaded', async () => {
    await renderModal({ existingCustomers: [existingCustomer] });

    // Confirm starting on the upload step
    expect(document.body.textContent ?? '').toContain('Drop a .csv file here');

    // Upload a valid CSV
    await simulateFileUpload(makeValidCsvFile());

    // Preview step marker: the dedup-mode radio group is now visible
    const skipRadio = document.body.querySelector('input[type="radio"][name="customerDuplicateMode"]');
    expect(skipRadio).not.toBeNull();

    // Import button is visible (2 rows: 1 fresh Bob + 1 duplicate Alice; default skip=skip,
    // so Alice is not counted — 1 customer ready to import)
    const importBtn = findButton('Import 1 customer');
    expect(importBtn).not.toBeUndefined();
    expect(importBtn!.disabled).toBe(false);
  });
});

describe('CustomerCsvImportModal — preview step (Test 3): dedup-mode toggle', () => {
  it('switching from skip to overwrite increases the import count when duplicates exist', async () => {
    await renderModal({ existingCustomers: [existingCustomer] });
    await simulateFileUpload(makeValidCsvFile());

    // Default mode = skip. Alice (duplicate) is excluded → 1 customer.
    expect(findButton('Import 1 customer')).not.toBeUndefined();

    // Locate the "Update duplicates" radio (overwrite mode)
    const radios = document.body.querySelectorAll<HTMLInputElement>(
      'input[type="radio"][name="customerDuplicateMode"]'
    );
    // First radio = skip, second radio = overwrite
    const overwriteRadio = radios[1];
    expect(overwriteRadio).not.toBeUndefined();

    // Use click() which triggers React's onClick/onChange for controlled radio inputs
    await act(async () => {
      overwriteRadio.click();
    });

    // Now both rows count → import button label shows 2 customers
    expect(findButton('Import 2 customers')).not.toBeUndefined();

    // Switch back to skip
    const skipRadio = radios[0];
    await act(async () => {
      skipRadio.click();
    });
    expect(findButton('Import 1 customer')).not.toBeUndefined();
  });
});

describe('CustomerCsvImportModal — preview step (Test 4): row select/deselect', () => {
  it('deselecting all rows disables the import button', async () => {
    // Use fresh CSV with 2 rows (no duplicates) so all are pre-selected
    await renderModal();
    await simulateFileUpload(makeValidCsvFile(FRESH_CSV));

    // Both rows should be pre-selected → 2 customers
    const importBtn2 = findButton('Import 2 customers');
    expect(importBtn2).not.toBeUndefined();
    expect(importBtn2!.disabled).toBe(false);

    // Find and uncheck all checkboxes
    const checkboxes = document.body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);

    for (const checkbox of checkboxes) {
      if (checkbox.checked) {
        // Use click() to trigger React's controlled onChange for checkboxes
        await act(async () => {
          checkbox.click();
        });
      }
    }

    // With 0 selected, the import button should be disabled
    // (importCount === 0 → disabled per CustomerCsvImportModal.tsx line 229)
    const importBtnAfter = Array.from(document.body.querySelectorAll('button')).find(
      (b) => (b.textContent ?? '').includes('Import')
    ) as HTMLButtonElement | undefined;
    expect(importBtnAfter).not.toBeUndefined();
    expect(importBtnAfter!.disabled).toBe(true);
  });
});

describe('CustomerCsvImportModal — preview step (Test 5): confirm-import call shape', () => {
  it('clicking Import calls onImportCustomers with an array of Customer-shaped objects', async () => {
    // 2 fresh rows, no duplicates, all pre-selected
    await renderModal();
    await simulateFileUpload(makeValidCsvFile(FRESH_CSV));

    const importBtn = findButton('Import 2 customers');
    expect(importBtn).not.toBeUndefined();
    expect(importBtn!.disabled).toBe(false);

    await act(async () => {
      importBtn!.click();
    });

    expect(onImportCustomersSpy).toHaveBeenCalledTimes(1);
    const toImport = onImportCustomersSpy.mock.calls[0][0];

    // Should have 2 entries (both rows selected, no duplicates to skip)
    expect(toImport).toHaveLength(2);

    // Each entry must be Customer-shaped (has id, name or email, createdAt)
    for (const c of toImport) {
      expect(c).toHaveProperty('id');
      expect(c.id).toBeTruthy();
      // At least one of name or email must be present (D-09 rule)
      expect(c.name || c.email).toBeTruthy();
    }

    // Verify specific row data matches the fixture
    const bob = toImport.find((c: Customer) => c.email === 'bob@example.com');
    const carol = toImport.find((c: Customer) => c.email === 'carol@example.com');
    expect(bob).not.toBeUndefined();
    expect(carol).not.toBeUndefined();
  });

  it('with dedup-mode=skip, duplicate rows are excluded from the import call', async () => {
    // existingCustomer Alice is a duplicate
    await renderModal({ existingCustomers: [existingCustomer] });
    await simulateFileUpload(makeValidCsvFile()); // VALID_CSV has Bob (fresh) + Alice (dup)

    // Default mode = skip → only Bob should be imported
    const importBtn = findButton('Import 1 customer');
    expect(importBtn).not.toBeUndefined();

    await act(async () => {
      importBtn!.click();
    });

    expect(onImportCustomersSpy).toHaveBeenCalledTimes(1);
    const toImport = onImportCustomersSpy.mock.calls[0][0];

    // Only Bob (fresh row) — Alice (dup) was skipped
    expect(toImport).toHaveLength(1);
    expect(toImport[0].email).toBe('bob@example.com');
  });
});
