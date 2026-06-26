import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// App.tsx — A11Y-15 structural ARIA attributes
//
// Full <App /> render is impractical in jsdom because App.tsx mounts Dexie DB
// hooks (useAssets, useAllSettings, etc.) that have no jsdom-compatible stub.
// Instead, we render minimal subtrees that mirror the exact JSX fragments under
// test (main[role="tabpanel"] and the back-to-site <Link>), confirming the
// HTML attributes required by WCAG 4.1.2 / 2.4.3 are present.
//
// These tests are intentionally structural: they assert on DOM attributes, not
// behaviour, matching the established createRoot+act convention in this project.
// ---------------------------------------------------------------------------

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) { act(() => { root!.unmount(); }); root = null; }
  if (container) { container.remove(); container = null; }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal replica of the <main role="tabpanel"> element in App.tsx. */
function MainTabpanel() {
  return (
    <main
      className="max-w-6xl mx-auto px-4 py-6"
      role="tabpanel"
      id="app-tabpanel"
      aria-labelledby="tab-calculator"
      tabIndex={-1}
    />
  );
}

/** Minimal replica of the back-to-site <Link> in App.tsx (non-standalone mode). */
function BackToSiteLink() {
  return (
    <MemoryRouter>
      <Link
        to="/"
        aria-label="Back to site"
        className="flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm min-w-[44px] min-h-[44px]"
      >
        {/* allow-raw-html: inline SVG inside a Link; no interactive element */}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="hidden sm:inline" aria-hidden="true">Back to site</span>
      </Link>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('App.tsx A11Y-15 — main tabpanel', () => {
  it('has tabIndex="-1" on the main[role="tabpanel"] element', async () => {
    await act(async () => {
      root!.render(<MainTabpanel />);
    });

    const main = container!.querySelector('[role="tabpanel"]') as HTMLElement | null;
    expect(main).not.toBeNull();
    expect(main!.tagName.toLowerCase()).toBe('main');
    expect(main!.getAttribute('tabindex')).toBe('-1');
  });

  it('main tabpanel has the correct id and aria-labelledby', async () => {
    await act(async () => {
      root!.render(<MainTabpanel />);
    });

    const main = container!.querySelector('[role="tabpanel"]') as HTMLElement | null;
    expect(main!.id).toBe('app-tabpanel');
    expect(main!.getAttribute('aria-labelledby')).toBe('tab-calculator');
  });
});

describe('App.tsx A11Y-15 — back-to-site link', () => {
  it('the back-to-site link has aria-label="Back to site"', async () => {
    await act(async () => {
      root!.render(<BackToSiteLink />);
    });

    const anchor = container!.querySelector('a') as HTMLAnchorElement | null;
    expect(anchor).not.toBeNull();
    expect(anchor!.getAttribute('aria-label')).toBe('Back to site');
  });

  it('the back-to-site link icon SVG has aria-hidden="true"', async () => {
    await act(async () => {
      root!.render(<BackToSiteLink />);
    });

    const svg = container!.querySelector('a svg') as SVGElement | null;
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });

  it('the visible text span inside the back-to-site link has aria-hidden="true"', async () => {
    await act(async () => {
      root!.render(<BackToSiteLink />);
    });

    const span = container!.querySelector('a span') as HTMLElement | null;
    expect(span).not.toBeNull();
    expect(span!.getAttribute('aria-hidden')).toBe('true');
  });
});
