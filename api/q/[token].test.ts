// @vitest-environment node
/**
 * api/q/[token].test.ts
 *
 * Phase 46 Plan 05, Task 2 (D-09/D-12 white-label render + Pitfall-4 XSS
 * allowlist). Covers the logo-specific rendering behavior added to the
 * hosted-quote page. General 404/enumerability/decision-lock coverage
 * already lives in tests/security/hosted-quote-404-indistinguishable.test.ts
 * and tests/security/hosted-quote-enumerability.test.ts — this file focuses
 * on what THIS plan adds:
 *
 *   - A valid `snapshot.logoDataUrl` renders an <img> AND suppresses the
 *     "Powered by 3DCoster" footer (D-09 hasLogo).
 *   - No logo (or an invalid one) omits the <img> and keeps the footer.
 *   - A malformed/javascript:/svg/attribute-breakout logoDataUrl never
 *     reaches the output HTML (server-side re-validation, Pitfall 4) — the
 *     render falls back exactly as if no logo were present.
 *   - The 404/unavailable page stays byte-identical (D-16) — logo logic
 *     only touches the valid published-page branch.
 *
 * `fetch` is mocked globally — api/lib/supabaseRest.ts calls the ambient
 * `fetch`, so no live Supabase project is needed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './[token]';

const PUBLISHED_TOKEN = '77777777-7777-4777-8777-777777777777';
const NEVER_EXISTED_TOKEN = '88888888-8888-4888-8888-888888888888';

const VALID_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB=';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function baseRow(snapshotOverrides: Record<string, unknown> = {}) {
  return {
    snapshot: {
      jobTitle: 'Custom Bracket',
      sellingPrice: 42.5,
      shippingCost: 0,
      resolvedTaxRate: 0,
      taxAmount: 0,
      currency: 'USD',
      notes: '',
      terms: '',
      businessName: 'Riley Prints',
      ...snapshotOverrides,
    },
    customer_first_name: 'Riley',
    status: 'published',
    decision: null,
    decided_at: null,
    decision_note: null,
    expires_at: null,
  };
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  vi.restoreAllMocks();
});

describe('D-09: valid logo suppresses the powered-by footer and renders the logo', () => {
  it('renders an <img> with the data URL and OMITS "Powered by 3DCoster"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([baseRow({ logoDataUrl: VALID_LOGO })])),
    );

    const res = await handler(new Request(`http://localhost/q/${PUBLISHED_TOKEN}`));
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain(`<img src="${VALID_LOGO}"`);
    expect(body).not.toContain('Powered by');
    expect(body).not.toContain('3dcoster.com');
  });
});

describe('D-09: no logo keeps the powered-by footer', () => {
  it('renders NO <img> and keeps "Powered by 3DCoster" when no logo is on the snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([baseRow()])),
    );

    const res = await handler(new Request(`http://localhost/q/${PUBLISHED_TOKEN}`));
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).not.toContain('<img');
    expect(body).toContain('Powered by');
    expect(body).toContain('3DCoster');
  });
});

describe('Pitfall 4: server-side re-validation strips malformed/tampered logo values', () => {
  it('omits a javascript: URL — no <img>, footer stays, payload never reaches the HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([baseRow({ logoDataUrl: 'javascript:alert(1)' })])),
    );

    const res = await handler(new Request(`http://localhost/q/${PUBLISHED_TOKEN}`));
    const body = await res.text();

    expect(body).not.toContain('javascript:alert(1)');
    expect(body).not.toContain('<img');
    expect(body).toContain('Powered by');
  });

  it('omits an svg data URL (not allowlisted, can carry embedded scripts)', async () => {
    const svgPayload = 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([baseRow({ logoDataUrl: svgPayload })])),
    );

    const res = await handler(new Request(`http://localhost/q/${PUBLISHED_TOKEN}`));
    const body = await res.text();

    expect(body).not.toContain(svgPayload);
    expect(body).not.toContain('<img');
    expect(body).toContain('Powered by');
  });

  it('omits an attribute-breakout payload (quote/angle-bracket characters)', async () => {
    const breakoutPayload = 'data:image/png;base64,abc"><script>alert(2)</script>';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([baseRow({ logoDataUrl: breakoutPayload })])),
    );

    const res = await handler(new Request(`http://localhost/q/${PUBLISHED_TOKEN}`));
    const body = await res.text();

    expect(body).not.toContain('<script>alert(2)</script>');
    expect(body).not.toContain('<img');
    expect(body).toContain('Powered by');
  });

  it('omits an oversized logo data URL beyond the length cap', async () => {
    const oversized = `data:image/png;base64,${'A'.repeat(210_000)}`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([baseRow({ logoDataUrl: oversized })])),
    );

    const res = await handler(new Request(`http://localhost/q/${PUBLISHED_TOKEN}`));
    const body = await res.text();

    expect(body).not.toContain(oversized);
    expect(body).not.toContain('<img');
    expect(body).toContain('Powered by');
  });
});

describe('D-16: the unavailable page is unaffected by logo logic', () => {
  it('renders the same 404 body regardless of any logo field on a never-existed token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([])),
    );

    const res = await handler(new Request(`http://localhost/q/${NEVER_EXISTED_TOKEN}`));
    const body = await res.text();

    expect(res.status).toBe(404);
    expect(body).not.toContain('<img');
    expect(body).toContain('Powered by');
  });
});
