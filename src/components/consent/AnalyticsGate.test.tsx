import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalyticsGate } from './AnalyticsGate';
import { setAnalyticsConsent } from '../../utils/consent';

// ---------------------------------------------------------------------------
// AnalyticsGate — Phase 42 GDPR-01/T-42-02/T-42-03
//
// 1. Renders null (no <Analytics />) when useAnalyticsConsent() is false —
//    verified indirectly: no insights script is injected into document.head.
// 2. Renders <Analytics /> when useAnalyticsConsent() is true — the script
//    is injected into document.head and window.va is defined.
// 3. On transition from true -> false after having mounted, removes the
//    insights script from document.head and deletes window.va/vaq/vam.
// ---------------------------------------------------------------------------

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function insightsScript(): Element | null {
  return document.head.querySelector('script[src*="insights/script.js"]');
}

beforeEach(() => {
  // @vercel/analytics resolves its script src differently in "development"
  // mode (NODE_ENV==='test' is treated as development by the library, using
  // a debug script URL that does not match the production "insights/script.js"
  // path). Stub NODE_ENV to 'production' so this test exercises the same
  // script-src / cleanup-selector path that runs in the real deployed app.
  vi.stubEnv('NODE_ENV', 'production');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  setAnalyticsConsent(false);
  insightsScript()?.remove();
  delete (window as Window & { va?: unknown }).va;
  delete (window as Window & { vaq?: unknown }).vaq;
  delete (window as Window & { vam?: unknown }).vam;
});

afterEach(() => {
  if (root) { act(() => { root!.unmount(); }); root = null; }
  if (container) { container.remove(); container = null; }
  setAnalyticsConsent(false);
  vi.unstubAllEnvs();
});

describe('AnalyticsGate', () => {
  it('injects no analytics script when consent is false', async () => {
    await act(async () => {
      root!.render(<AnalyticsGate />);
    });
    expect(insightsScript()).toBeNull();
  });

  it('injects the analytics script and sets window.va when consent is true', async () => {
    setAnalyticsConsent(true);
    await act(async () => {
      root!.render(<AnalyticsGate />);
    });
    expect(insightsScript()).not.toBeNull();
    expect(typeof (window as Window & { va?: unknown }).va).toBe('function');
  });

  it('strips the script and window globals on revoke after having mounted', async () => {
    setAnalyticsConsent(true);
    await act(async () => {
      root!.render(<AnalyticsGate />);
    });
    expect(insightsScript()).not.toBeNull();

    setAnalyticsConsent(false);
    await act(async () => {
      root!.render(<AnalyticsGate />);
    });

    expect(insightsScript()).toBeNull();
    expect((window as Window & { va?: unknown }).va).toBeUndefined();
    expect((window as Window & { vaq?: unknown }).vaq).toBeUndefined();
    expect((window as Window & { vam?: unknown }).vam).toBeUndefined();
  });
});
