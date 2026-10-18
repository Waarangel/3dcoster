import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { SaveToLibraryModal } from './SaveToLibraryModal';
import type { LibraryChoice, ManualLinePromptItem } from '../../utils/manualCostLines';

// ---------------------------------------------------------------------------
// SaveToLibraryModal — Phase 47.1 (D-04). Presenter only: every row defaults to
// "Keep as one-off"; Cancel/Escape abort (the parent does not save).
// ---------------------------------------------------------------------------

const items: ManualLinePromptItem[] = [
  { section: 'postProcessing', line: { id: 'l1', name: 'Auger', cost: 200 } },
  { section: 'packaging', line: { id: 'l2', name: 'Gift wrap', cost: 3.5 } },
];

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) { act(() => { root!.unmount(); }); root = null; }
  if (container) { container.remove(); container = null; }
});

type Props = Partial<React.ComponentProps<typeof SaveToLibraryModal>>;

async function renderModal(props: Props = {}) {
  const onConfirm = (props.onConfirm ?? vi.fn<(c: LibraryChoice[]) => Promise<void>>().mockResolvedValue()) as Mock<(c: LibraryChoice[]) => Promise<void>>;
  const onCancel = props.onCancel ?? vi.fn();
  await act(async () => {
    root!.render(
      <SaveToLibraryModal
        isOpen
        items={items}
        currencySymbol="$"
        confirmLabel="Save job"
        {...props}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
  });
  return { onConfirm, onCancel };
}

const buttonByText = (text: string) =>
  Array.from(document.body.querySelectorAll('button')).find(b => (b.textContent ?? '').trim() === text) as HTMLButtonElement | undefined;

const selectByLabel = (label: string) =>
  document.body.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);

async function choose(select: HTMLSelectElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    setter.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('SaveToLibraryModal', () => {
  it('renders nothing when closed', async () => {
    await renderModal({ isOpen: false });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows the title, one row per item with section label and 2dp cost', async () => {
    await renderModal();
    const text = document.body.textContent ?? '';
    expect(text).toContain('Add to your asset library?');
    expect(text).toContain('Auger');
    expect(text).toContain('Post-processing');
    expect(text).toContain('$200.00');
    expect(text).toContain('Gift wrap');
    expect(text).toContain('Packaging');
    expect(text).toContain('$3.50');
  });

  it('defaults every row to "Keep as one-off" and offers no category Select', async () => {
    await renderModal();
    expect(selectByLabel('Library choice for Auger')!.value).toBe('keep');
    expect(selectByLabel('Library choice for Gift wrap')!.value).toBe('keep');
    expect(selectByLabel('Library category for Auger')).toBeNull();
    const keepOption = Array.from(selectByLabel('Library choice for Auger')!.options).find(o => o.value === 'keep');
    expect(keepOption?.textContent).toBe('Keep as one-off');
  });

  it('shows a Tools-default category Select only for post-processing rows set to Add', async () => {
    await renderModal();
    await choose(selectByLabel('Library choice for Auger')!, 'add');
    const category = selectByLabel('Library category for Auger');
    expect(category).not.toBeNull();
    expect(category!.value).toBe('tool');
    expect(Array.from(category!.options).map(o => o.textContent)).toEqual(['Tools', 'Finishing', 'Consumables']);

    await choose(selectByLabel('Library choice for Gift wrap')!, 'add');
    expect(selectByLabel('Library category for Gift wrap')).toBeNull();
  });

  it('confirm passes one LibraryChoice per item (all keep by default)', async () => {
    const { onConfirm } = await renderModal();
    await act(async () => { buttonByText('Save job')!.click(); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual([
      { lineId: 'l1', section: 'postProcessing', add: false, category: 'tool' },
      { lineId: 'l2', section: 'packaging', add: false, category: 'tool' },
    ]);
  });

  it('confirm reflects Add choices and the chosen category', async () => {
    const { onConfirm } = await renderModal();
    await choose(selectByLabel('Library choice for Auger')!, 'add');
    await choose(selectByLabel('Library category for Auger')!, 'finishing');
    await choose(selectByLabel('Library choice for Gift wrap')!, 'add');
    await act(async () => { buttonByText('Save job')!.click(); });
    const choices = onConfirm.mock.calls[0][0] as LibraryChoice[];
    expect(choices[0]).toEqual({ lineId: 'l1', section: 'postProcessing', add: true, category: 'finishing' });
    expect(choices[1].add).toBe(true);
    expect(choices[1].section).toBe('packaging');
  });

  it('uses the supplied confirm label', async () => {
    await renderModal({ confirmLabel: 'Update job' });
    expect(buttonByText('Update job')).toBeDefined();
  });

  it('Cancel button calls onCancel and not onConfirm', async () => {
    const { onConfirm, onCancel } = await renderModal();
    await act(async () => { buttonByText('Cancel')!.click(); });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape calls onCancel', async () => {
    const { onCancel } = await renderModal();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('while confirm is pending the button is disabled, reads "Saving…", and Cancel/Escape are ignored', async () => {
    let resolve!: () => void;
    const pending = new Promise<void>(r => { resolve = r; });
    const onConfirm = vi.fn(() => pending);
    const { onCancel } = await renderModal({ onConfirm });
    await act(async () => { buttonByText('Save job')!.click(); });

    const saving = buttonByText('Saving…');
    expect(saving).toBeDefined();
    expect(saving!.disabled).toBe(true);

    await act(async () => { buttonByText('Cancel')!.click(); });
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => { resolve(); await pending; });
  });

  it('renders an inline error and stays open when onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Disk full'));
    const { onCancel } = await renderModal({ onConfirm });
    await act(async () => { buttonByText('Save job')!.click(); });
    expect(document.body.textContent).toContain('Disk full');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    expect(buttonByText('Save job')!.disabled).toBe(false);
  });

  it('falls back to a generic message for non-Error rejections', async () => {
    const onConfirm = vi.fn().mockRejectedValue('nope');
    await renderModal({ onConfirm });
    await act(async () => { buttonByText('Save job')!.click(); });
    expect(document.body.textContent).toContain('Could not save — please try again.');
  });
});
