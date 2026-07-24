import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPage } from './PrivacyPage';

// ---------------------------------------------------------------------------
// Phase 42-03 — PrivacyPage smoke test (GDPR-02).
//
// Follows the project's component-mount test harness (createRoot + act,
// no @testing-library/react — see ScrollToTop.test.tsx / App.test.tsx).
//
// Proves the policy renders and names every real processor from the
// data-flow inventory, not a generic placeholder list.
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

describe('PrivacyPage', () => {
  it('renders the privacy policy', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/privacy']}>
          <PrivacyPage />
        </MemoryRouter>,
      );
    });

    expect(document.body.textContent ?? '').toContain('Privacy Policy');
  });

  it('names every real processor from the data-flow inventory', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/privacy']}>
          <PrivacyPage />
        </MemoryRouter>,
      );
    });

    const text = document.body.textContent ?? '';
    expect(text).toContain('Vercel');
    expect(text).toContain('Formspree');
    expect(text).toContain('Frankfurter');
    expect(text).toContain('currency-api');
    expect(text).toContain('GitHub');
    expect(text).toContain('jsDelivr');
    expect(text).toContain('Supabase');
  });

  it('discloses the maker logo as part of a published hosted quote', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/privacy']}>
          <PrivacyPage />
        </MemoryRouter>,
      );
    });

    const text = document.body.textContent ?? '';
    expect(text).toContain('business logo');
    expect(text).toContain('white-label branding');
  });

  it('names the privacy contact address', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/privacy']}>
          <PrivacyPage />
        </MemoryRouter>,
      );
    });

    expect(document.body.textContent ?? '').toContain('privacy@3dcoster.com');
  });

  // Phase 47-01 — cloud sync disclosure drift guard (D-05/D-08/D-13/D-14).
  // Traces to the docs/DATA-FLOW-INVENTORY.md sync-blob row added in 47-01
  // Task 1. Fails if the policy ever silently drops the cloud-sync
  // disclosure, its zero-knowledge/encryption claim, its ~90-day retention
  // window, or its self-serve deletion affordance.
  it('discloses the end-to-end encrypted cloud sync blob, retention window, and self-serve deletion', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/privacy']}>
          <PrivacyPage />
        </MemoryRouter>,
      );
    });

    const text = document.body.textContent ?? '';
    expect(text).toContain('cloud sync');
    expect(text).toMatch(/end-to-end encrypted/i);
    expect(text).toMatch(/zero-knowledge/i);
    expect(text).toMatch(/90 days/);
    expect(text).toMatch(/delete it yourself/i);
  });
});
