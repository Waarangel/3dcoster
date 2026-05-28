import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Customer } from '../types';

// ---------------------------------------------------------------------------
// CustomerEditModal — Phase 23 plan 23-01 (TEST-01).
//
// First test coverage for CustomerEditModal. Locks the D-01 email-lowercase
// contract (handleSubmit canonicalizes email via .toLowerCase() on save) plus
// 6 baseline behaviors:
//
//   1. D-01 lowercase lock (primary new assertion)
//   2. Add hydration (no initialCustomer → empty fields)
//   3. Edit hydration (initialCustomer → fields hydrated)
//   4. Name-OR-Email validation (both empty → onSave NOT called, error shown)
//   5. Submit-disable during save (in-flight save → button disabled)
//   6. Escape close (real Modal primitive Escape handling — D-07)
//   7. Error recovery (onSave rejects → error shown + isSaving reset)
//
// Scaffold: raw createRoot + act per project precedent (D-08). NO
// third-party testing-library imports. Real <Modal> primitive (D-07 — do
// NOT stub Modal).
// ---------------------------------------------------------------------------

// ─── Spies (must be created before vi.mock factory references them) ────────
const onSaveSpy = vi.fn<(c: Customer) => Promise<void>>().mockResolvedValue();
const onCloseSpy = vi.fn<() => void>();

// CustomerEditModal receives onSave via prop and does NOT import useDatabase
// (verified: src/components/CustomerEditModal.tsx imports only from '../types'
// and './ui'). No vi.mock('../hooks/useDatabase') needed.

// Now import the component under test (after spies are wired)
const { CustomerEditModal } = await import('./CustomerEditModal');

// ─── DOM harness ───────────────────────────────────────────────────────────

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  onSaveSpy.mockClear();
  // Reset to default resolve so reject-then-resolve cases don't bleed across tests
  onSaveSpy.mockResolvedValue();
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

// ─── Helpers ───────────────────────────────────────────────────────────────

interface RenderOpts {
  initialCustomer?: Customer;
  onSave?: (c: Customer) => Promise<void>;
  onClose?: () => void;
}

async function renderModal(opts: RenderOpts = {}) {
  const props = {
    isOpen: true,
    initialCustomer: opts.initialCustomer,
    onSave: opts.onSave ?? onSaveSpy,
    onClose: opts.onClose ?? onCloseSpy,
  };
  await act(async () => {
    root!.render(<CustomerEditModal {...props} />);
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

// CustomerEditModal uses useId + label htmlFor with the label text shown
// above each input. Walk from the visible label text to the associated
// input/textarea element via the htmlFor → id pairing.
function findInputByLabel(labelText: string): HTMLInputElement | HTMLTextAreaElement | null {
  const labels = Array.from(document.body.querySelectorAll('label'));
  const label = labels.find(l => (l.textContent ?? '').trim() === labelText);
  if (!label) return null;
  const forId = label.getAttribute('for');
  if (!forId) return null;
  const el = document.getElementById(forId);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el;
  return null;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('CustomerEditModal', () => {
  it('locks D-01: email is lowercased on save when user types mixed-case', async () => {
    await renderModal();

    const nameInput = findInputByLabel('Name') as HTMLInputElement;
    const emailInput = findInputByLabel('Email') as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    expect(emailInput).toBeTruthy();

    await act(async () => {
      typeIntoInput(nameInput, 'John');
      typeIntoInput(emailInput, 'John@Example.com');
    });

    const saveBtn = findButton('Save customer');
    expect(saveBtn).toBeTruthy();

    await act(async () => {
      saveBtn!.click();
    });

    expect(onSaveSpy.mock.calls.length).toBe(1);
    expect(onSaveSpy.mock.calls[0][0].email).toBe('john@example.com');
  });

  it('Add mode hydrates with empty fields when initialCustomer is undefined', async () => {
    await renderModal();

    const nameInput = findInputByLabel('Name') as HTMLInputElement;
    const emailInput = findInputByLabel('Email') as HTMLInputElement;
    const companyInput = findInputByLabel('Company') as HTMLInputElement;
    const addressInput = findInputByLabel('Address') as HTMLTextAreaElement;
    const notesInput = findInputByLabel('Notes') as HTMLTextAreaElement;

    expect(nameInput.value).toBe('');
    expect(emailInput.value).toBe('');
    expect(companyInput.value).toBe('');
    expect(addressInput.value).toBe('');
    expect(notesInput.value).toBe('');
  });

  it('Edit mode hydrates fields from initialCustomer', async () => {
    const initial: Customer = {
      id: 'c1',
      name: 'Alice',
      email: 'alice@x.com',
      company: 'Acme',
      createdAt: new Date('2026-01-01'),
    };
    await renderModal({ initialCustomer: initial });

    const nameInput = findInputByLabel('Name') as HTMLInputElement;
    const emailInput = findInputByLabel('Email') as HTMLInputElement;
    const companyInput = findInputByLabel('Company') as HTMLInputElement;

    expect(nameInput.value).toBe('Alice');
    expect(emailInput.value).toBe('alice@x.com');
    expect(companyInput.value).toBe('Acme');
  });

  it('Name-OR-Email validation: clicking Save with both empty does NOT call onSave and surfaces error message', async () => {
    await renderModal();

    const saveBtn = findButton('Save customer');
    expect(saveBtn).toBeTruthy();

    // The submit button is disabled by the form's submitDisabled gate when
    // both name and email are empty (CustomerEditModal.tsx line 60). The
    // button click does not fire submit when disabled. To exercise the
    // handleSubmit() validation branch (line 64-67), invoke the form's
    // submit directly via dispatchEvent.
    const form = document.body.querySelector('form');
    expect(form).toBeTruthy();
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSaveSpy.mock.calls.length).toBe(0);

    // Error message text from CustomerEditModal.tsx line 65
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain('at least one of Name or Email');
  });

  it('Save button is disabled mid-flight (isSaving toggle)', async () => {
    // Install a slow-resolving onSave so the in-flight state is observable.
    let resolveSave!: () => void;
    const slowSave = vi.fn<(c: Customer) => Promise<void>>(() =>
      new Promise<void>(resolve => { resolveSave = resolve; })
    );

    await renderModal({ onSave: slowSave });

    const nameInput = findInputByLabel('Name') as HTMLInputElement;
    await act(async () => {
      typeIntoInput(nameInput, 'John');
    });

    const saveBtn = findButton('Save customer');
    expect(saveBtn).toBeTruthy();
    expect(saveBtn!.disabled).toBe(false);  // pre-click — enabled because name is set

    // Click but do NOT resolve the promise — submit-disable state captured mid-flight.
    await act(async () => {
      saveBtn!.click();
    });

    // Re-query the button (its label may have changed to "Saving...")
    const midFlightBtn =
      findButton('Saving...') ?? findButton('Save customer');
    expect(midFlightBtn).toBeTruthy();
    expect(midFlightBtn!.disabled).toBe(true);

    // Resolve so cleanup doesn't dangle.
    await act(async () => {
      resolveSave();
    });
  });

  it('Escape closes the modal via real Modal primitive (D-07 — Escape handler attached to document)', async () => {
    await renderModal();

    // Modal attaches its Escape handler to document.addEventListener('keydown', ...)
    // (dialogA11y.ts line 163). Dispatching on document.body bubbles up.
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onCloseSpy.mock.calls.length).toBe(1);
  });

  it('Error recovery: when onSave rejects, error message renders and Save re-enables', async () => {
    const rejectingSave = vi.fn<(c: Customer) => Promise<void>>(() =>
      Promise.reject(new Error('boom'))
    );

    await renderModal({ onSave: rejectingSave });

    const nameInput = findInputByLabel('Name') as HTMLInputElement;
    await act(async () => {
      typeIntoInput(nameInput, 'John');
    });

    const saveBtn = findButton('Save customer');
    await act(async () => {
      saveBtn!.click();
    });

    // Wait one more microtask for the catch+finally chain to run
    await act(async () => {
      await Promise.resolve();
    });

    // Error message text from CustomerEditModal.tsx line 87
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain('Could not save customer');

    // isSaving back to false — Save button label is 'Save customer' (NOT 'Saving...')
    // and not disabled (name is still filled in).
    const recoveredBtn = findButton('Save customer');
    expect(recoveredBtn).toBeTruthy();
    expect(recoveredBtn!.disabled).toBe(false);
  });
});
