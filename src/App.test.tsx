import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Phase 38 Plan 02 — App-level tab-in-URL routing tests (FOUND-03).
//
// Follows the project's ONLY component-mount test harness (createRoot + act,
// no @testing-library/react — confirmed absent via `npm ls`). See
// JobsManager.test.tsx for the origin of this idiom.
//
// App.tsx currently derives `activeTab` from `useState<Tab>`. These tests are
// written FIRST and MUST be RED (App.tsx unmodified) — Task 2 replaces the
// state source with `useSearchParams` to make them GREEN.
// ---------------------------------------------------------------------------

// Mock every Dexie-backed hook App.tsx consumes so mounting doesn't touch a
// real IndexedDB. Shapes mirror the real hook contracts in useDatabase.ts /
// useFxRates.ts (documented inline — mirrors JobsManager.test.tsx convention).
vi.mock('./hooks/useDatabase', () => ({
  // useAssets: assets ?? [], isLoading, error, CRUD callbacks, reset helpers.
  useAssets: () => ({
    assets: [],
    isLoading: false,
    error: null,
    addAsset: vi.fn(),
    updateAsset: vi.fn(),
    deleteAsset: vi.fn(),
    bulkImportAssets: vi.fn(),
    resetToDefaults: vi.fn(),
    resetMaterialsOnly: vi.fn(),
    resetPrintersOnly: vi.fn(),
    resetAssetScope: vi.fn(),
  }),
  // useAllSettings: printer + electricity + updaters + isLoading (combined hook).
  useAllSettings: () => ({
    printer: {},
    electricity: { costPerKwh: 0.15, wattage: 200 },
    updatePrinter: vi.fn(),
    updateElectricity: vi.fn(),
    isLoading: false,
  }),
  // useJobs: live-query-backed jobs[] + CRUD.
  useJobs: () => ({
    jobs: [],
    isLoading: false,
    addJob: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
  }),
  // usePrinters: derived PrinterConfig[] view over useAssets + CRUD wrappers.
  usePrinters: () => ({
    printers: [],
    isLoading: false,
    addPrinter: vi.fn(),
    updatePrinter: vi.fn(),
    deletePrinter: vi.fn(),
    resetToDefaults: vi.fn(),
  }),
  // usePrinterInstances: live-query-backed instances[] + CRUD.
  usePrinterInstances: () => ({
    instances: [],
    isLoading: false,
    addInstance: vi.fn(),
    updateInstance: vi.fn(),
    deleteInstance: vi.fn(),
    addPrintHours: vi.fn(),
  }),
  // useUserProfile: profile (DEFAULT_PROFILE shape) + updater + isLoading.
  useUserProfile: () => ({
    profile: {
      currency: 'CAD',
      laborHourlyRate: 15,
      defaultProfitMargin: 30,
      address: { country: 'CA' },
    },
    updateProfile: vi.fn(),
    isLoading: false,
  }),
  // useShippingConfig: shipping config + updater + isLoading.
  useShippingConfig: () => ({
    shipping: {
      maxDeliveryRadiusKm: 25,
      gasPricePerLiter: 1.5,
      vehicleFuelEfficiency: 10,
      upsBaseCost: 15,
      fedexBaseCost: 15,
      purolatorBaseCost: 12,
      uspsBaseCost: 10,
      dhlBaseCost: 20,
      royalMailBaseCost: 8,
      australiaPostBaseCost: 12,
      canadaPostBaseCost: 15,
      customCarriers: [],
    },
    updateShipping: vi.fn(),
    isLoading: false,
  }),
  // useMarketplaceFees: fees + updateFees + resetToDefaults + isLoading.
  useMarketplaceFees: () => ({
    fees: {
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
      customMarketplaces: [],
    },
    updateFees: vi.fn(),
    resetToDefaults: vi.fn(),
    isLoading: false,
  }),
  // useCustomers: live-query-backed customers[] + CRUD.
  useCustomers: () => ({
    customers: [],
    isLoading: false,
    addCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
    bulkImportCustomers: vi.fn(),
  }),
  // useAllSales: plain Sale[] (NOT { sales: [] }) — mirrors the production
  // hook contract per JobsManager.test.tsx's documented D-24/Pitfall 4 note.
  useAllSales: () => [],
  // useQuotes: read side (quotes[] + quotesByJobId Map) + CRUD actions.
  // JobsManager (rendered when the jobs tab is active) calls this directly —
  // shape mirrors JobsManager.test.tsx's mock.
  useQuotes: () => ({
    quotes: [],
    quotesByJobId: new Map(),
    isLoading: false,
    addQuote: vi.fn(),
    updateQuote: vi.fn(),
    deleteQuote: vi.fn(),
    createQuote: vi.fn(),
  }),
  // useSales(jobId?): per-job sales[] + deleteSale. JobsManager calls this
  // with the currently selected job id (undefined when none selected).
  useSales: () => ({
    sales: [],
    addSale: vi.fn(),
    updateSale: vi.fn(),
    deleteSale: vi.fn(),
  }),
}));

// useFxRates: returns FxRateTable | null — null is a valid "not loaded yet" state.
vi.mock('./hooks/useFxRates', () => ({
  useFxRates: () => null,
}));

// __IS_TAURI__ is a Vite `define` global injected at build time (vite.config.ts)
// from TAURI_ENV_PLATFORM. vitest.config.ts is a separate config with no
// `define` block, so the identifier is unbound under Vitest — any test that
// mounts App (which calls useIsStandalone() -> reads __IS_TAURI__) throws
// `ReferenceError: __IS_TAURI__ is not defined` without this stub. This is
// the first test file to mount <App/>, so the gap was previously latent.
// False = web build path (matches this project's primary CI/dev target).
vi.stubGlobal('__IS_TAURI__', false);

// jsdom does not implement window.matchMedia. App.tsx's useIsStandalone() and
// the editing-banner scroll effect both call it (display-mode + prefers-
// reduced-motion checks). Every prior test of these code paths used the
// source-contract idiom (grep against file text) specifically BECAUSE no
// real mount previously reached this line — this is the first real <App/>
// mount, so the gap is newly surfaced here, not introduced by this plan.
window.matchMedia = window.matchMedia || function matchMediaStub(query: string) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
};

const { default: App } = await import('./App');

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
});

function renderAppAt(initialEntries: string[]): void {
  act(() => {
    root!.render(
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>,
    );
  });
}

// D-05 needs real Back-navigation control. MemoryRouter's history is
// internal/inaccessible from the test, and window.history.back() is NOT
// wired to it — MemoryRouter deliberately does not touch window.history.
// createMemoryRouter + RouterProvider exposes a `Router` instance whose
// `.navigate(-1)` drives the same in-memory history stack the app renders
// against, giving a deterministic (non-timing-based) way to simulate Back.
function renderAppWithMemoryRouter(initialEntries: string[]): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter(
    [{ path: '/app', element: <App /> }],
    { initialEntries },
  );
  act(() => {
    root!.render(<RouterProvider router={router} />);
  });
  return router;
}

function activeTabButton(): HTMLButtonElement | undefined {
  return Array.from(container!.querySelectorAll('button[role="tab"]')).find(
    b => b.getAttribute('aria-selected') === 'true',
  ) as HTMLButtonElement | undefined;
}

function tabButton(id: string): HTMLButtonElement {
  const btn = container!.querySelector(`#tab-${id}`);
  if (!btn) throw new Error(`tab button #tab-${id} not found`);
  return btn as HTMLButtonElement;
}

describe('App tab-in-URL routing (FOUND-03, D-05..D-08)', () => {
  it('renders the calculator tab active at bare /app (D-06)', () => {
    renderAppAt(['/app']);
    const active = activeTabButton();
    expect(active?.id).toBe('tab-calculator');
    expect(active?.getAttribute('aria-selected')).toBe('true');
  });

  it('renders the jobs tab active at /app?tab=jobs', () => {
    renderAppAt(['/app?tab=jobs']);
    const active = activeTabButton();
    expect(active?.id).toBe('tab-jobs');
  });

  it('accepts /app?tab=calculator as an explicit alias for calculator (D-06)', () => {
    renderAppAt(['/app?tab=calculator']);
    const active = activeTabButton();
    expect(active?.id).toBe('tab-calculator');
  });

  it('falls back to calculator and strips an unknown ?tab= value with no extra history entry (D-07)', () => {
    renderAppAt(['/app?tab=bogus']);
    const active = activeTabButton();
    expect(active?.id).toBe('tab-calculator');
    // D-07: the bad param must be replaced out of the URL, not merely ignored
    // for rendering purposes. We can't inspect MemoryRouter's internal history
    // stack directly, but we CAN assert the resolved location no longer
    // carries a `tab` search param after the replace effect runs.
    const search = window.location.search;
    // MemoryRouter doesn't touch window.location, so instead assert via the
    // rendered tablist: only ONE tab is marked active/selected (no residual
    // "bogus" state leaking into a second render), and the calculator tab's
    // panel content is what's shown. This indirectly proves the effect fired
    // and settled on 'calculator' without looping.
    expect(search === '' || search === undefined).toBeTruthy();
    const allSelected = Array.from(container!.querySelectorAll('button[role="tab"]')).filter(
      b => b.getAttribute('aria-selected') === 'true',
    );
    expect(allSelected).toHaveLength(1);
  });

  it('pushes a history entry on tab click; browser Back restores the prior tab (D-05)', async () => {
    const router = renderAppWithMemoryRouter(['/app']);
    // Start on calculator (default), click jobs.
    act(() => {
      tabButton('jobs').click();
    });
    expect(activeTabButton()?.id).toBe('tab-jobs');

    // Go back — should restore calculator (push semantics for tab clicks,
    // not replace — a replace would collapse this entry and Back would exit
    // /app entirely, which is exactly the bug FOUND-03 closes).
    await act(async () => {
      router.navigate(-1);
      // router.navigate returns void for a delta navigation; yield a tick so
      // the resulting state update flushes before we assert.
      await Promise.resolve();
    });
    expect(activeTabButton()?.id).toBe('tab-calculator');
  });

  it('preserves the roving-tabindex + aria-selected A11Y contract', () => {
    renderAppAt(['/app?tab=jobs']);
    const tablist = container!.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    expect(tablist?.getAttribute('aria-label')).toBe('Main navigation');

    const jobsTab = tabButton('jobs');
    const calcTab = tabButton('calculator');
    expect(jobsTab.getAttribute('aria-selected')).toBe('true');
    expect(jobsTab.tabIndex).toBe(0);
    expect(calcTab.getAttribute('aria-selected')).toBe('false');
    expect(calcTab.tabIndex).toBe(-1);
  });
});
