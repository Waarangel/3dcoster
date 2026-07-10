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
});
