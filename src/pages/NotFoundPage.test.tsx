import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';
import { MarketingThemeScope } from '../components/marketing/MarketingThemeScope';

// ---------------------------------------------------------------------------
// Gap closure G-46-18 (46-12 Task 2) — friendly themed NotFound page.
//
// Mirrors the project's own component-mount test harness (createRoot + act,
// no @testing-library/react — see TermsPage.test.tsx / ScrollToTop.test.tsx).
//
// Behavior coverage (per the plan's <behavior> block):
//   1. Friendly "Page not found" heading + short explanatory sentence.
//   2. A home link (role link, href "/") built with react-router Link.
//   3. A meta[name="robots"][content="noindex"] is present in document.head
//      while mounted, removed on unmount, idempotent under StrictMode's
//      mount->unmount->mount double-invoke (no duplicates).
//   4. Mounting a MemoryRouter with the MarketingLayout-equivalent wrapper
//      (MarketingThemeScope + Outlet, exactly as wired in src/main.tsx) plus
//      a path="*" -> NotFoundPage route and an unknown initial entry
//      resolves to NotFoundPage — proving the catch-all itself works, not
//      just the component in isolation.
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

function queryRobotsMeta(): HTMLMetaElement | null {
  return document.head.querySelector('meta[name="robots"][content="noindex"]');
}

describe('NotFoundPage', () => {
  it('renders a friendly heading and explanatory sentence', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/whatever']}>
          <NotFoundPage />
        </MemoryRouter>,
      );
    });

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/page not found/i);
    // A short explanatory sentence beyond just the heading.
    expect(text.length).toBeGreaterThan('Page not found'.length + 10);
  });

  it('exposes a home link built with react-router Link', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/whatever']}>
          <NotFoundPage />
        </MemoryRouter>,
      );
    });

    const homeLink = container.querySelector('a[href="/"]');
    expect(homeLink).not.toBeNull();
    expect(homeLink?.getAttribute('href')).toBe('/');
  });

  it('injects a noindex robots meta tag while mounted and removes it on unmount', async () => {
    expect(queryRobotsMeta()).toBeNull();

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/whatever']}>
          <NotFoundPage />
        </MemoryRouter>,
      );
    });

    expect(queryRobotsMeta()).not.toBeNull();

    act(() => root.unmount());

    expect(queryRobotsMeta()).toBeNull();
  });

  it('leaves exactly one noindex meta after a StrictMode mount->unmount->mount double-invoke', async () => {
    // Simulate StrictMode's dev-mode double-invoke by mounting, unmounting,
    // and remounting synchronously within one act — this is the same
    // create -> remove -> create sequence StrictMode performs on every
    // effect, and it must never leave two metas behind.
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/whatever']} key="a">
          <NotFoundPage />
        </MemoryRouter>,
      );
    });
    act(() => root.unmount());

    const secondContainer = document.createElement('div');
    document.body.appendChild(secondContainer);
    const secondRoot = createRoot(secondContainer);

    await act(async () => {
      secondRoot.render(
        <MemoryRouter initialEntries={['/whatever']} key="b">
          <NotFoundPage />
        </MemoryRouter>,
      );
    });

    expect(document.head.querySelectorAll('meta[name="robots"][content="noindex"]').length).toBe(1);

    act(() => secondRoot.unmount());
    secondContainer.remove();
  });

  it('resolves via the MarketingLayout catch-all for an unknown location', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/this-route-does-not-exist']}>
          <Routes>
            <Route
              element={
                <MarketingThemeScope>
                  <Outlet />
                </MarketingThemeScope>
              }
            >
              <Route path="/" element={<div>Home</div>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/page not found/i);
  });
});
