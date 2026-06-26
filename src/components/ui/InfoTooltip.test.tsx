import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InfoTooltip } from './InfoTooltip';

// ---------------------------------------------------------------------------
// InfoTooltip — A11Y tests
//
// 1. A11Y-04 multi-instance unique-id contract: each InfoTooltip instance
//    generates a unique tooltip id via useId() so multiple visible tooltips
//    on the same page never share an id.
//
// 2. A11Y-15 trigger label + Escape dismiss:
//    - Trigger button aria-label is "More information" (concise canonical
//      tooltip-trigger label per WAI-ARIA tooltip pattern), NOT the full text.
//    - Full text renders in role="tooltip" span (aria-describedby links them).
//    - Pressing Escape while the tooltip is open dismisses it (role="tooltip"
//      span removed from DOM); does not bubble to parent.
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

describe('InfoTooltip A11Y-15 — concise label + Escape dismiss', () => {
  it('trigger button has aria-label="More information" (not the full text prop)', async () => {
    await act(async () => {
      root!.render(<InfoTooltip text="This is a long descriptive tooltip sentence." />);
    });

    const button = container!.querySelector('button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.getAttribute('aria-label')).toBe('More information');
    expect(button.getAttribute('aria-label')).not.toBe('This is a long descriptive tooltip sentence.');
  });

  it('full text is still present in the role="tooltip" span when open', async () => {
    const tipText = 'Detailed explanation for the user.';
    await act(async () => {
      root!.render(<InfoTooltip text={tipText} />);
    });

    const button = container!.querySelector('button') as HTMLButtonElement;
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const tooltip = container!.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toBe(tipText);
  });

  it('aria-describedby on the button links to the tooltip id when open', async () => {
    await act(async () => {
      root!.render(<InfoTooltip text="Tip text." />);
    });

    const button = container!.querySelector('button') as HTMLButtonElement;

    // Before opening: no aria-describedby
    expect(button.getAttribute('aria-describedby')).toBeNull();

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // After opening: aria-describedby must point at the tooltip span's id
    const tooltip = container!.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tooltip).not.toBeNull();
    const tooltipId = tooltip.getAttribute('id');
    expect(tooltipId).toBeTruthy();
    expect(button.getAttribute('aria-describedby')).toBe(tooltipId);
  });

  it('pressing Escape while the tooltip is open closes it', async () => {
    await act(async () => {
      root!.render(<InfoTooltip text="Some tip." />);
    });

    const button = container!.querySelector('button') as HTMLButtonElement;

    // Open the tooltip via click
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container!.querySelector('[role="tooltip"]')).not.toBeNull();

    // Dispatch Escape keydown on the button
    await act(async () => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    // Tooltip span must be removed from the DOM
    expect(container!.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('pressing Escape when the tooltip is already closed has no effect', async () => {
    await act(async () => {
      root!.render(<InfoTooltip text="Some tip." />);
    });

    const button = container!.querySelector('button') as HTMLButtonElement;

    // Tooltip is initially closed
    expect(container!.querySelector('[role="tooltip"]')).toBeNull();

    // Dispatch Escape — must not throw or change state
    await act(async () => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container!.querySelector('[role="tooltip"]')).toBeNull();
  });
});
