import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastProvider } from '../ui';

// ---------------------------------------------------------------------------
// BillingPanel — Phase 43-06 (PRO-04).
//
// createRoot + act per project precedent (ShareQuoteButton.test.tsx).
// useProAuth / useEntitlement / lib/paddle are mocked directly so every
// billing state renders without a Supabase client or a Paddle account.
//
// Locked assertions:
//   - Prices are USD 7.99 (monthly) and USD 79 (annual) — byte-identical to
//     the ToS values from plan 43-02 (re-based to USD in plan 45-14).
//   - NO trial copy anywhere, in any state (D-04).
//   - Renders nothing under __IS_TAURI__ (D-12 desktop degrade).
//   - Cancel copy states existing shared links stay live (D-11 lapse-safe).
// ---------------------------------------------------------------------------

vi.stubGlobal('__IS_TAURI__', false);

let mockUser: { id: string; email?: string } | null = { id: 'user-1', email: 'maker@example.com' };

vi.mock('../../hooks/useProAuth', () => ({
  useProAuth: () => ({
    session: mockUser ? { user: mockUser } : null,
    user: mockUser,
    isSignedIn: mockUser !== null,
    status: mockUser ? 'signed-in' : 'signed-out',
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
  }),
}));

interface MockEntitlement {
  isPro: boolean;
  plan: string | null;
  status: string | null;
  currentPeriodEnd: Date | null;
}

let mockEntitlement: MockEntitlement = { isPro: false, plan: null, status: null, currentPeriodEnd: null };
const refreshSpy = vi.fn(async () => {});

vi.mock('../../hooks/useEntitlement', () => ({
  useEntitlement: () => ({ ...mockEntitlement, refresh: refreshSpy }),
  isProStatus: (status: string | null | undefined) => status === 'active' || status === 'past_due',
}));

let mockConfigured = true;
const openCheckoutSpy = vi.fn(
  async (_priceId: string, _options: { userId: string; email?: string }) => {},
);

vi.mock('../../lib/paddle', () => ({
  openCheckout: (priceId: string, options: { userId: string; email?: string }) =>
    openCheckoutSpy(priceId, options),
  isBillingConfigured: () => mockConfigured,
  PADDLE_PRICE_IDS: {
    get monthly() {
      return mockConfigured ? 'pri_monthly_123' : undefined;
    },
    get annual() {
      return mockConfigured ? 'pri_annual_456' : undefined;
    },
  },
}));

const { BillingPanel } = await import('./BillingPanel');

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function renderPanel(): Promise<void> {
  await act(async () => {
    root!.render(
      <ToastProvider>
        <BillingPanel />
      </ToastProvider>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockUser = { id: 'user-1', email: 'maker@example.com' };
  mockEntitlement = { isPro: false, plan: null, status: null, currentPeriodEnd: null };
  mockConfigured = true;
  openCheckoutSpy.mockClear();
  refreshSpy.mockClear();
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
  vi.stubGlobal('__IS_TAURI__', false);
});

describe('BillingPanel', () => {
  it('renders nothing under __IS_TAURI__ (D-12 desktop degrade)', async () => {
    vi.stubGlobal('__IS_TAURI__', true);
    await renderPanel();
    expect(container!.textContent).toBe('');
  });

  it('renders nothing when signed out', async () => {
    mockUser = null;
    await renderPanel();
    expect(container!.textContent).toBe('');
  });

  it('shows both plans with the exact ToS prices and no trial copy', async () => {
    await renderPanel();

    const text = container!.textContent ?? '';
    expect(text).toContain('USD 7.99');
    expect(text).toContain('per month');
    expect(text).toContain('USD 79');
    expect(text).toContain('per year');
    expect(text).toContain('2 months free');
    // D-04: no trial state, no trial copy — the free tier is the trial.
    expect(text.toLowerCase()).not.toContain('trial');
    // D-11 lapse-safe stated up front.
    expect(text).toContain('existing shared links stay live');
  });

  it('opens the monthly checkout with the monthly price id + user identity', async () => {
    await renderPanel();

    const button = container!.querySelector<HTMLButtonElement>(
      '[aria-label="Subscribe to 3DCoster Pro monthly"]',
    );
    expect(button).not.toBeNull();
    await act(async () => {
      button!.click();
    });

    expect(openCheckoutSpy).toHaveBeenCalledWith('pri_monthly_123', {
      userId: 'user-1',
      email: 'maker@example.com',
    });
  });

  it('opens the annual checkout with the annual price id', async () => {
    await renderPanel();

    const button = container!.querySelector<HTMLButtonElement>(
      '[aria-label="Subscribe to 3DCoster Pro annual"]',
    );
    expect(button).not.toBeNull();
    await act(async () => {
      button!.click();
    });

    expect(openCheckoutSpy).toHaveBeenCalledWith('pri_annual_456', {
      userId: 'user-1',
      email: 'maker@example.com',
    });
  });

  it('degrades to a quiet note (no subscribe buttons, no crash) when billing env is absent', async () => {
    mockConfigured = false;
    await renderPanel();

    const text = container!.textContent ?? '';
    expect(text).toContain('not available just yet');
    expect(container!.querySelectorAll('button[aria-label^="Subscribe"]').length).toBe(0);
    expect(openCheckoutSpy).not.toHaveBeenCalled();
  });

  it('shows plan, renewal date, and lapse-safe cancel copy for an active Pro user', async () => {
    mockEntitlement = {
      isPro: true,
      plan: 'monthly',
      status: 'active',
      currentPeriodEnd: new Date('2026-08-14T00:00:00Z'),
    };
    await renderPanel();

    const text = container!.textContent ?? '';
    expect(text).toContain('Monthly plan');
    expect(text).toContain('Renews');
    // D-11: cancelling keeps existing published links live — stated plainly.
    expect(text).toContain('never takes down quote links');
    // No subscribe buttons while Pro.
    expect(container!.querySelectorAll('button[aria-label^="Subscribe"]').length).toBe(0);
    // Still no trial copy in the Pro state (D-04).
    expect(text.toLowerCase()).not.toContain('trial');
  });

  it('surfaces the past_due dunning grace state without dropping Pro', async () => {
    mockEntitlement = {
      isPro: true,
      plan: 'annual',
      status: 'past_due',
      currentPeriodEnd: new Date('2026-08-01T00:00:00Z'),
    };
    await renderPanel();

    const text = container!.textContent ?? '';
    expect(text).toContain('Annual plan');
    expect(text).toContain('Payment issue');
    expect(text).toContain('Pro stays active');
  });
});
