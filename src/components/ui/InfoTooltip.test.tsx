import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InfoTooltip } from './InfoTooltip';

// ---------------------------------------------------------------------------
// InfoTooltip — A11Y-04 multi-instance unique-id contract
// Asserts that each InfoTooltip instance generates a unique tooltip id via
// useId(), so multiple visible tooltips on the same page (e.g., SettingsModal
// Costs & Rates tab with 6+ InfoTooltips) never share an id.
// ---------------------------------------------------------------------------

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

describe('InfoTooltip', () => {
  it('renders without colliding ids when two instances are mounted', async () => {
    await act(async () => {
      root!.render(
        <>
          <InfoTooltip text="First tip" />
          <InfoTooltip text="Second tip" />
        </>
      );
    });

    // Open both tooltips so their span[role="tooltip"] elements render
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(2);

    await act(async () => {
      buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const tooltipSpans = container!.querySelectorAll('[role="tooltip"]');
    expect(tooltipSpans.length).toBe(2);

    const id1 = tooltipSpans[0].getAttribute('id');
    const id2 = tooltipSpans[1].getAttribute('id');

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it('does not reuse the static "info-tooltip-content" id', async () => {
    await act(async () => {
      root!.render(<InfoTooltip text="Some tip" />);
    });

    // Open the tooltip
    const button = container!.querySelector('button') as HTMLButtonElement;
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // The old static id must not appear anywhere in the DOM
    expect(container!.querySelector('#info-tooltip-content')).toBeNull();

    // The tooltip span must be present with a non-static id
    const tooltip = container!.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.getAttribute('id')).not.toBe('info-tooltip-content');
  });
});
