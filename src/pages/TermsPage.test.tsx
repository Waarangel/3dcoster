import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TermsPage } from './TermsPage';

// ---------------------------------------------------------------------------
// Phase 42-03 — TermsPage smoke test (GDPR-03).
//
// Follows the project's component-mount test harness (createRoot + act,
// no @testing-library/react — see ScrollToTop.test.tsx / App.test.tsx).
//
// Proves the page renders both the free tier and a price-free Pro-tier
// framework section (D-06 — no hard-coded Pro price this phase).
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

  it('does not contain a hard-coded Pro-tier price figure', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/terms']}>
          <TermsPage />
        </MemoryRouter>,
      );
    });

    const text = document.body.textContent ?? '';
    // Guard against a currency figure like "$9.90" or "€9.90/mo" sneaking in
    // before Phase 43 finalizes pricing (D-06).
    expect(text).not.toMatch(/[$€£]\s?\d/);
    expect(text).not.toMatch(/\d+(\.\d+)?\s?\/\s?(mo|month|yr|year)/i);
  });
});
