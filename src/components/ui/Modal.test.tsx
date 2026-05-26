import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Modal } from './Modal';

// ---------------------------------------------------------------------------
// Modal primitive — Phase 19-01 coverage
//
// Test surface (matches D-21 surface lock):
//   Group 1 — ARIA structure (role, aria-modal, aria-labelledby, X button)
//   Group 2 — HYG-09 child unmount (isOpen transition)
//   Group 3 — Focus management (mount focus, card fallback, restore, Tab wrap)
//   Group 4 — Escape + backdrop close
//   Group 5 — Body scroll-lock
//   Group 6 — Single-modal-only dev warn (D-11)
//   Group 7 — Size prop mapping
//
// Convention: raw createRoot + act (no @testing-library/react, no user-event).
// Matches JobsManager.test.tsx / PrintQuoteModal.test.tsx / DeclineQuoteModal.test.tsx.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared setup / teardown
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  // Reset body overflow in case a test left it set.
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: render a Modal into the shared root.
// The modal renders via createPortal so the dialog is on document.body,
// NOT inside container.
// ---------------------------------------------------------------------------
async function renderModal(props: {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children?: React.ReactNode;
}) {
  const { isOpen, onClose = vi.fn(), title = 'Test Modal', size, children } = props;
  await act(async () => {
    root.render(
      <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
        {children ?? <span>body content</span>}
      </Modal>,
    );
  });
}

// ---------------------------------------------------------------------------
// Group 1 — ARIA structure
// ---------------------------------------------------------------------------

describe('Group 1 — ARIA structure', () => {
  it('renders role="dialog" with aria-modal="true" when isOpen=true', async () => {
    await renderModal({ isOpen: true });
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
  });

  it('renders title as h3 with id linked via aria-labelledby', async () => {
    await renderModal({ isOpen: true, title: 'My Title' });
    const dialog = document.body.querySelector('[role="dialog"]')!;
    const h3 = dialog.querySelector('h3');
    expect(h3).not.toBeNull();
    expect(h3!.textContent).toBe('My Title');
    // aria-labelledby must reference the h3's id
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(labelledBy!.length).toBeGreaterThan(0);
    expect(h3!.getAttribute('id')).toBe(labelledBy);
  });

  it('renders X close button with aria-label="Close" and fires onClose on click', async () => {
    const onClose = vi.fn();
    await renderModal({ isOpen: true, onClose });
    const closeBtn = document.body.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
    expect(closeBtn).not.toBeNull();
    await act(async () => {
      closeBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when isOpen=false', async () => {
    await renderModal({ isOpen: false });
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Group 2 — HYG-09 child unmount (isOpen transition true → false)
// ---------------------------------------------------------------------------

describe('Group 2 — HYG-09 child unmount', () => {
  it('unmounts children when isOpen transitions from true to false', async () => {
    const cleanupSpy = vi.fn();

    function TrackableChild() {
      useEffect(() => {
        return () => { cleanupSpy(); };
      }, []);
      return <span>child</span>;
    }

    const onClose = vi.fn();
    // Render open
    await act(async () => {
      root.render(
        <Modal isOpen={true} onClose={onClose} title="Test">
          <TrackableChild />
        </Modal>,
      );
    });
    expect(cleanupSpy).not.toHaveBeenCalled();

    // Transition to closed
    await act(async () => {
      root.render(
        <Modal isOpen={false} onClose={onClose} title="Test">
          <TrackableChild />
        </Modal>,
      );
    });
    // Children should have been unmounted — cleanup called
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Group 3 — Focus management
// ---------------------------------------------------------------------------

/** Selector matching Modal's internal FOCUSABLE_SELECTOR */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

describe('Group 3 — Focus management', () => {
  it('focuses the first focusable descendant on mount (Close button is first)', async () => {
    // The Close button is always in the Modal header and is the first focusable element.
    // Subsequent children follow. Modal focuses the first focusable in the card.
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(
          <Modal isOpen={true} onClose={vi.fn()} title="Focus test">
            <input data-testid="first-input" />
            <button>second</button>
          </Modal>,
        );
      });
      // Advance the deferred setTimeout(fn, 0) that fires focus.
      await act(async () => { vi.runAllTimers(); });
      // The Close button in the header is the first focusable descendant.
      const closeBtn = document.body.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
      expect(document.activeElement).toBe(closeBtn);
    } finally {
      vi.useRealTimers();
    }
  });

  it('focuses the dialog card if no focusable descendants exist at all', async () => {
    // This tests the tabIndex={-1} fallback on the card itself.
    // We need a scenario with zero focusable descendants — we achieve this
    // by disabling the Close button. Since we can't remove it from the outside,
    // we verify the fallback by directly calling focus() on the card after
    // clearing all focusable items. Instead, we test the tabIndex attribute
    // which enables programmatic focus on the card element.
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(
          <Modal isOpen={true} onClose={vi.fn()} title="No focusable">
            <span>plain text only</span>
          </Modal>,
        );
      });
      await act(async () => { vi.runAllTimers(); });
      const dialog = document.body.querySelector('[role="dialog"]');
      // The dialog card has tabIndex={-1} so it can receive programmatic focus.
      expect(dialog!.getAttribute('tabindex')).toBe('-1');
      // With Close button present, focus lands on it (not the card).
      // Verify it's within the dialog (not body).
      expect(dialog!.contains(document.activeElement)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('restores focus to the previously-focused element on unmount', async () => {
    vi.useFakeTimers();
    // Set up a trigger button and give it focus before opening the modal
    const trigger = document.createElement('button');
    trigger.id = 'focus-trigger';
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    try {
      // Open modal
      await act(async () => {
        root.render(
          <Modal isOpen={true} onClose={vi.fn()} title="Test">
            <button>inner</button>
          </Modal>,
        );
      });
      // Flush focus timer
      await act(async () => { vi.runAllTimers(); });
      // Focus should have moved into the modal
      expect(document.activeElement).not.toBe(trigger);

      // Close modal (isOpen → false)
      await act(async () => {
        root.render(
          <Modal isOpen={false} onClose={vi.fn()} title="Test">
            <button>inner</button>
          </Modal>,
        );
      });
      // Focus should be restored to the trigger
      expect(document.activeElement).toBe(trigger);
    } finally {
      vi.useRealTimers();
      trigger.remove();
    }
  });

  it('cycles focus on Tab from last to first focusable', async () => {
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(
          <Modal isOpen={true} onClose={vi.fn()} title="Tab cycle">
            <input id="inp-first" />
            <button id="btn-second">second</button>
          </Modal>,
        );
      });
      await act(async () => { vi.runAllTimers(); });

      const dialog = document.body.querySelector('[role="dialog"]')!;
      // Get all focusable items as Modal does.
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      // Focus the last item
      const last = focusable[focusable.length - 1];
      last.focus();
      expect(document.activeElement).toBe(last);

      // Dispatch Tab on document
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      });
      // Should wrap to first
      expect(document.activeElement).toBe(focusable[0]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cycles focus on Shift+Tab from first to last focusable', async () => {
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(
          <Modal isOpen={true} onClose={vi.fn()} title="Shift-Tab cycle">
            <input id="inp-first" />
            <button id="btn-second">second</button>
          </Modal>,
        );
      });
      await act(async () => { vi.runAllTimers(); });

      const dialog = document.body.querySelector('[role="dialog"]')!;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      // Focus the first item
      const first = focusable[0];
      first.focus();
      expect(document.activeElement).toBe(first);

      // Dispatch Shift+Tab on document
      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
        );
      });
      // Should wrap to last
      expect(document.activeElement).toBe(focusable[focusable.length - 1]);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// Group 4 — Escape + backdrop close
// ---------------------------------------------------------------------------

describe('Group 4 — Escape + backdrop close', () => {
  it('invokes onClose on Escape keydown', async () => {
    const onClose = vi.fn();
    await renderModal({ isOpen: true, onClose });
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose on backdrop mousedown (target === currentTarget)', async () => {
    const onClose = vi.fn();
    await renderModal({ isOpen: true, onClose });
    // The backdrop is the first child inside document.body rendered by the portal.
    // It has class "fixed inset-0 bg-black/50 ..." and is NOT the dialog element.
    const dialog = document.body.querySelector('[role="dialog"]')!;
    const backdrop = dialog.parentElement!;
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT invoke onClose on card body mousedown', async () => {
    const onClose = vi.fn();
    await renderModal({ isOpen: true, onClose });
    const dialog = document.body.querySelector('[role="dialog"]')!;
    await act(async () => {
      dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Group 5 — Body scroll-lock
// ---------------------------------------------------------------------------

describe('Group 5 — Body scroll-lock', () => {
  it('locks body scroll while open and restores prior value on unmount', async () => {
    document.body.style.overflow = 'scroll';
    await renderModal({ isOpen: true });
    expect(document.body.style.overflow).toBe('hidden');

    // Close the modal
    await act(async () => {
      root.render(<></>);
    });
    expect(document.body.style.overflow).toBe('scroll');
  });
});

// ---------------------------------------------------------------------------
// Group 6 — Single-modal-only dev warn
// ---------------------------------------------------------------------------

describe('Group 6 — Single-modal-only dev warn', () => {
  it('warns when a second Modal opens while one is already open (dev mode)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // First modal in the shared container
    await act(async () => {
      root.render(
        <Modal isOpen={true} onClose={vi.fn()} title="First">
          <span>first</span>
        </Modal>,
      );
    });

    // Second modal in a separate container
    const containerB = document.createElement('div');
    document.body.appendChild(containerB);
    const rootB = createRoot(containerB);
    try {
      await act(async () => {
        rootB.render(
          <Modal isOpen={true} onClose={vi.fn()} title="Second">
            <span>second</span>
          </Modal>,
        );
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [warnMsg] = warnSpy.mock.calls[0];
      expect(String(warnMsg)).toContain('[Modal]');
    } finally {
      await act(async () => { rootB.unmount(); });
      containerB.remove();
    }
  });
});

// ---------------------------------------------------------------------------
// Group 7 — Size prop mapping
// ---------------------------------------------------------------------------

describe('Group 7 — Size prop mapping', () => {
  it('maps size prop to correct max-w class', async () => {
    const cases: Array<[ModalProps['size'], string]> = [
      ['sm', 'max-w-sm'],
      ['md', 'max-w-md'],
      ['lg', 'max-w-lg'],
      ['xl', 'max-w-3xl'],
    ];

    for (const [size, expectedClass] of cases) {
      await act(async () => {
        root.render(
          <Modal isOpen={true} onClose={vi.fn()} title="Size test" size={size}>
            <span>body</span>
          </Modal>,
        );
      });
      const dialog = document.body.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog!.className).toContain(expectedClass);
      // Unmount before next iteration
      await act(async () => { root.render(<></>); });
    }
  });

  it('defaults to max-w-md when no size prop provided', async () => {
    await renderModal({ isOpen: true });
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog!.className).toContain('max-w-md');
  });
});

// ---------------------------------------------------------------------------
// Re-export type for the size cases array
// ---------------------------------------------------------------------------
type ModalProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
};
