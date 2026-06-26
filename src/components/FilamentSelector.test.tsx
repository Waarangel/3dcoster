import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FilamentSelector } from './FilamentSelector';
import type { Material } from '../types';

// ---------------------------------------------------------------------------
// FilamentSelector — A11Y-13 accessible name tests
//
// Verifies:
//   1. The <label>Filament</label> has id="filament-trigger-label"
//   2. The trigger <Button> has aria-labelledby="filament-trigger-label"
//   3. Each open brand submenu role="menu" has aria-label equal to the brand name
//   4. The main menu role="menu" retains aria-label="Filaments" (regression guard)
//
// Convention: raw createRoot + act (no @testing-library/react), matching
// the project convention in Modal.test.tsx, InfoTooltip.test.tsx, etc.
// ---------------------------------------------------------------------------

const mockMaterials: Material[] = [
  {
    id: 'f1',
    name: 'PLA Basic',
    brand: 'Generic',
    category: 'filament',
  },
  {
    id: 'f2',
    name: 'PLA Matte',
    brand: 'Bambu',
    category: 'filament',
  },
];

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
  vi.restoreAllMocks();
});

describe('FilamentSelector — A11Y-13 accessible names', () => {
  it('has id="filament-trigger-label" on the Filament label', async () => {
    await act(async () => {
      root!.render(
        <FilamentSelector
          materials={mockMaterials}
          selectedFilamentId=""
          onSelect={vi.fn()}
          onPriceChange={vi.fn()}
          onCurrencyChange={vi.fn()}
        />,
      );
    });

    const label = container!.querySelector('label');
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe('Filament');
    expect(label!.getAttribute('id')).toBe('filament-trigger-label');
  });

  it('has aria-labelledby="filament-trigger-label" on the trigger button', async () => {
    await act(async () => {
      root!.render(
        <FilamentSelector
          materials={mockMaterials}
          selectedFilamentId=""
          onSelect={vi.fn()}
          onPriceChange={vi.fn()}
          onCurrencyChange={vi.fn()}
        />,
      );
    });

    // The trigger is the button with aria-haspopup="menu"
    const trigger = container!.querySelector('button[aria-haspopup="menu"]');
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute('aria-labelledby')).toBe('filament-trigger-label');
  });

  it('main menu role="menu" retains aria-label="Filaments" (regression guard)', async () => {
    await act(async () => {
      root!.render(
        <FilamentSelector
          materials={mockMaterials}
          selectedFilamentId=""
          onSelect={vi.fn()}
          onPriceChange={vi.fn()}
          onCurrencyChange={vi.fn()}
        />,
      );
    });

    // Open the main menu
    const trigger = container!.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const mainMenu = container!.querySelector('[role="menu"][aria-label="Filaments"]');
    expect(mainMenu).not.toBeNull();
  });

  it('open brand submenu role="menu" has aria-label equal to the brand name', async () => {
    await act(async () => {
      root!.render(
        <FilamentSelector
          materials={mockMaterials}
          selectedFilamentId=""
          onSelect={vi.fn()}
          onPriceChange={vi.fn()}
          onCurrencyChange={vi.fn()}
        />,
      );
    });

    // Open the main menu
    const trigger = container!.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Click the first brand menuitem to open its submenu
    const brandButtons = container!.querySelectorAll('[role="menuitem"][aria-haspopup="menu"]');
    expect(brandButtons.length).toBeGreaterThan(0);
    const firstBrandButton = brandButtons[0] as HTMLButtonElement;
    // The brand name is the text content of the button (excluding the SVG chevron)
    // We find all direct text nodes — the text node before the SVG is the brand name
    const brandName = Array.from(firstBrandButton.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim())
      .find((t) => t && t.length > 0) ?? firstBrandButton.textContent?.trim() ?? '';
    expect(brandName).toBeTruthy();

    await act(async () => {
      firstBrandButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // The submenu should now be present with aria-label equal to the brand name
    const submenus = container!.querySelectorAll('[role="menu"]');
    // There will be multiple role="menu" elements (main + submenu); find the one
    // with the brand name as its aria-label
    const brandSubmenu = Array.from(submenus).find(
      (el) => el.getAttribute('aria-label') === brandName,
    );
    expect(brandSubmenu).not.toBeNull();
    expect(brandSubmenu).toBeDefined();
  });
});
