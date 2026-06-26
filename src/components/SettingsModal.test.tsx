import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsModal } from './SettingsModal';
import type { ElectricityConfig, ShippingConfig, MarketplaceFees, UserProfile } from '../types';

// ---------------------------------------------------------------------------
// SettingsModal — A11Y-10 (roving tabindex + arrow-key nav) and
// A11Y-12 (marketplace icon-button aria-labels).
// Raw createRoot + act per project precedent (InfoTooltip.test.tsx).
//
// NOTE: SettingsModal renders via SidePanel → createPortal(…, document.body).
// All DOM queries target document.body (not the container div).
// ---------------------------------------------------------------------------

const defaultElectricity: ElectricityConfig = { costPerKwh: 0.15 };

const defaultShipping: ShippingConfig = {
  maxDeliveryRadiusKm: 20,
  gasPricePerLiter: 1.5,
  vehicleFuelEfficiency: 8,
  upsBaseCost: 12,
  fedexBaseCost: 14,
  purolatorBaseCost: 11,
  uspsBaseCost: 10,
  dhlBaseCost: 15,
  royalMailBaseCost: 8,
  australiaPostBaseCost: 9,
  canadaPostBaseCost: 10,
  customCarriers: [],
};

const defaultFees: MarketplaceFees = {
  facebookShippedPercent: 10,
  facebookMinFee: 0.8,
  facebookProcessingPercent: 2.9,
  etsyTransactionPercent: 6.5,
  etsyPaymentPercent: 3,
  etsyPaymentFixed: 0.25,
  etsyListingFee: 0.2,
  etsyOffsiteAdPercent: 15,
  kijijiFeaturedFee: 0,
  ebayFinalValuePercent: 12.9,
  ebayFixedFee: 0.3,
  amazonHandmadePercent: 15,
  customMarketplaces: [
    { id: 'mp-1', name: 'Etsy', feePercent: 6.5, fixedFee: 0.2 },
    { id: 'mp-2', name: 'eBay', feePercent: 12.9, fixedFee: 0.3 },
  ],
};

const defaultProfile: UserProfile = {
  currency: 'USD',
  laborHourlyRate: 20,
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
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

function renderModal(overrides: Partial<MarketplaceFees> = {}) {
  act(() => {
    root!.render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        electricity={defaultElectricity}
        shippingConfig={defaultShipping}
        marketplaceFees={{ ...defaultFees, ...overrides }}
        userCurrency="USD"
        userProfile={defaultProfile}
        onElectricityChange={vi.fn()}
        onShippingChange={vi.fn()}
        onMarketplaceFeesChange={vi.fn()}
        onResetMarketplaceFees={vi.fn()}
        onUserProfileChange={vi.fn()}
      />
    );
  });
}

// ---------------------------------------------------------------------------
// Helpers — query document.body because SidePanel renders via createPortal
// ---------------------------------------------------------------------------

function getTablist() {
  return document.body.querySelector('[role="tablist"]') as HTMLElement;
}

function getTabButtons() {
  return Array.from(document.body.querySelectorAll('[role="tab"]')) as HTMLElement[];
}

function getTabpanel() {
  return document.body.querySelector('[role="tabpanel"]') as HTMLElement;
}

function dispatchKeydown(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

// ---------------------------------------------------------------------------
// A11Y-10: Roving tabindex + arrow-key navigation
// ---------------------------------------------------------------------------

describe('SettingsModal — A11Y-10: tablist arrow-key navigation', () => {
  it('renders the first tab with tabIndex=0 and all others with tabIndex=-1', () => {
    renderModal();

    const tabs = getTabButtons();
    expect(tabs.length).toBeGreaterThanOrEqual(4);

    // First tab (costs) is selected by default → tabIndex 0
    expect(tabs[0].getAttribute('tabIndex') ?? tabs[0].tabIndex.toString()).toBe('0');

    // All others → tabIndex -1
    for (let i = 1; i < tabs.length; i++) {
      const ti = tabs[i].getAttribute('tabIndex') ?? tabs[i].tabIndex.toString();
      expect(ti).toBe('-1');
    }
  });

  it('ArrowRight moves aria-selected to the next tab and updates tabIndex', async () => {
    renderModal();

    const tablist = getTablist();
    const tabs = getTabButtons();

    // Initially: first tab selected
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    await act(async () => {
      dispatchKeydown(tablist, 'ArrowRight');
    });

    const updatedTabs = getTabButtons();
    expect(updatedTabs[0].getAttribute('aria-selected')).toBe('false');
    expect(updatedTabs[1].getAttribute('aria-selected')).toBe('true');
    expect(updatedTabs[1].getAttribute('tabIndex') ?? updatedTabs[1].tabIndex.toString()).toBe('0');
    expect(updatedTabs[0].getAttribute('tabIndex') ?? updatedTabs[0].tabIndex.toString()).toBe('-1');
  });

  it('ArrowRight wraps from the last tab back to the first', async () => {
    renderModal();

    const tablist = getTablist();

    // Navigate to the last tab with repeated ArrowRight presses.
    // Each keydown is dispatched in its own act() so React flushes the
    // setActiveTab state update between presses — mirroring the real-world
    // case where each keypress re-renders before the next handler reads
    // activeTab (batching them in one act() would hit a stale closure).
    const tabCount = getTabButtons().length;
    for (let i = 0; i < tabCount - 1; i++) {
      await act(async () => {
        dispatchKeydown(tablist, 'ArrowRight');
      });
    }

    const tabs = getTabButtons();
    expect(tabs[tabs.length - 1].getAttribute('aria-selected')).toBe('true');

    // One more ArrowRight → wraps to first
    await act(async () => {
      dispatchKeydown(tablist, 'ArrowRight');
    });

    const wrappedTabs = getTabButtons();
    expect(wrappedTabs[0].getAttribute('aria-selected')).toBe('true');
    expect(wrappedTabs[wrappedTabs.length - 1].getAttribute('aria-selected')).toBe('false');
  });

  it('ArrowLeft moves aria-selected to the previous tab', async () => {
    renderModal();

    const tablist = getTablist();

    // Move to second tab first
    await act(async () => {
      dispatchKeydown(tablist, 'ArrowRight');
    });

    let tabs = getTabButtons();
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');

    // ArrowLeft → back to first
    await act(async () => {
      dispatchKeydown(tablist, 'ArrowLeft');
    });

    tabs = getTabButtons();
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('ArrowLeft wraps from the first tab to the last', async () => {
    renderModal();

    const tablist = getTablist();

    await act(async () => {
      dispatchKeydown(tablist, 'ArrowLeft');
    });

    const tabs = getTabButtons();
    expect(tabs[tabs.length - 1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  });

  it('Home moves aria-selected to the first tab', async () => {
    renderModal();

    const tablist = getTablist();

    // Move to last tab first
    await act(async () => {
      dispatchKeydown(tablist, 'End');
    });

    let tabs = getTabButtons();
    expect(tabs[tabs.length - 1].getAttribute('aria-selected')).toBe('true');

    // Home → back to first
    await act(async () => {
      dispatchKeydown(tablist, 'Home');
    });

    tabs = getTabButtons();
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[tabs.length - 1].getAttribute('aria-selected')).toBe('false');
  });

  it('End moves aria-selected to the last tab', async () => {
    renderModal();

    const tablist = getTablist();

    await act(async () => {
      dispatchKeydown(tablist, 'End');
    });

    const tabs = getTabButtons();
    expect(tabs[tabs.length - 1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  });

  it('the tabpanel has tabIndex=-1 to allow programmatic focus', () => {
    renderModal();

    const panel = getTabpanel();
    expect(panel).not.toBeNull();
    const ti = panel.getAttribute('tabIndex') ?? panel.tabIndex.toString();
    expect(ti).toBe('-1');
  });

  it('exactly one tab has tabIndex=0 at a time', async () => {
    renderModal();

    const tablist = getTablist();

    await act(async () => {
      dispatchKeydown(tablist, 'ArrowRight');
    });

    const tabs = getTabButtons();
    const zeroCount = tabs.filter(
      t => (t.getAttribute('tabIndex') ?? t.tabIndex.toString()) === '0'
    ).length;
    expect(zeroCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// A11Y-12: Marketplace icon-button aria-labels
// ---------------------------------------------------------------------------

describe('SettingsModal — A11Y-12: marketplace icon-button aria-labels', () => {
  it('navigates to the marketplaces tab', async () => {
    renderModal();

    const tabs = getTabButtons();
    const marketplacesTab = tabs.find(t => /marketplaces/i.test(t.textContent || ''))!;

    await act(async () => {
      marketplacesTab.click();
    });

    const panel = getTabpanel();
    expect(panel?.textContent).toMatch(/marketplace/i);
  });

  it('custom marketplace edit button has aria-label containing "Edit" and the marketplace name', async () => {
    renderModal();

    // Navigate to marketplaces tab
    const tabs = getTabButtons();
    const mktTab = tabs.find(t => /marketplaces/i.test(t.textContent || ''))!;

    await act(async () => {
      mktTab.click();
    });

    // Find edit buttons for custom marketplaces (EditButton builds aria-label="Edit {name}")
    const editButtons = Array.from(
      document.body.querySelectorAll('button[aria-label^="Edit "]')
    ) as HTMLButtonElement[];

    expect(editButtons.length).toBeGreaterThanOrEqual(1);
    expect(editButtons.some(b => b.getAttribute('aria-label') === 'Edit Etsy')).toBe(true);
  });

  it('custom marketplace delete button has aria-label containing "Delete" and the marketplace name', async () => {
    renderModal();

    const tabs = getTabButtons();
    const mktTab = tabs.find(t => /marketplaces/i.test(t.textContent || ''))!;

    await act(async () => {
      mktTab.click();
    });

    const deleteButtons = Array.from(
      document.body.querySelectorAll('button[aria-label^="Delete "]')
    ) as HTMLButtonElement[];

    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    expect(deleteButtons.some(b => b.getAttribute('aria-label') === 'Delete Etsy')).toBe(true);
  });

  it('no icon-only button in the marketplace panel lacks an aria-label', async () => {
    renderModal();

    const tabs = getTabButtons();
    const mktTab = tabs.find(t => /marketplaces/i.test(t.textContent || ''))!;

    await act(async () => {
      mktTab.click();
    });

    // All buttons in the panel that have a single SVG child (icon-only) must have aria-label
    const panel = getTabpanel();
    const iconOnlyButtons = Array.from(panel.querySelectorAll('button')).filter(btn => {
      const childCount = btn.children.length;
      const hasOnlySvg = childCount === 1 && btn.children[0].tagName === 'svg';
      return hasOnlySvg;
    });

    for (const btn of iconOnlyButtons) {
      expect(
        btn.getAttribute('aria-label'),
        `Icon-only button missing aria-label: "${btn.outerHTML.slice(0, 80)}"`
      ).toBeTruthy();
    }
  });
});
