import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TermsPage } from './TermsPage';

// ---------------------------------------------------------------------------
// Phase 42-03 — TermsPage smoke test (GDPR-03).
// Phase 43-02 — the price-absence guard below was intentionally INVERTED:
// Phase 42 blocked a price leak until pricing was finalized (D-06); Phase 43
// is the phase that finalizes it, so this test now asserts the real price
// IS present and matches the locked D-02/D-03 values (re-based to USD in
// plan 45-14: USD 7.99/mo, USD 79/yr).
//
// Follows the project's component-mount test harness (createRoot + act,
// no @testing-library/react — see ScrollToTop.test.tsx / App.test.tsx).
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('TermsPage', () => {
  it('renders the terms of service', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/terms']}>
          <TermsPage />
        </MemoryRouter>,
      );
    });

    expect(document.body.textContent ?? '').toContain('Terms of Service');
  });

  it('mentions both the free tier and the Pro tier', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/terms']}>
          <TermsPage />
        </MemoryRouter>,
      );
    });

    const text = document.body.textContent ?? '';
    expect(text).toContain('Free tier');
    expect(text).toContain('Pro tier');
  });

  it('contains the concrete Pro-tier price figures and names Paddle as Merchant of Record', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/terms']}>
          <TermsPage />
        </MemoryRouter>,
      );
    });

    const text = document.body.textContent ?? '';
    // Phase 43-02: the real, final price (D-02/D-03) must now be present —
    // this is the inverse of the Phase 42 price-leak guard. Re-based to USD
    // in plan 45-14 (G-45-BILLING-CURRENCY).
    expect(text).toContain('USD 7.99');
    expect(text).toContain('USD 79');
    expect(text).toMatch(/Merchant of Record/i);
    expect(text).toMatch(/Paddle/i);
  });

  it('states no free trial and lapse-safe existing hosted-quote links', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/terms']}>
          <TermsPage />
        </MemoryRouter>,
      );
    });

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/no (free )?trial/i);
    expect(text).toMatch(/stay live/i);
  });
});
