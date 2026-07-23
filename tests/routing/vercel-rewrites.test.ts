// @vitest-environment node
/**
 * tests/routing/vercel-rewrites.test.ts
 *
 * Gap closure G-46-18 (46-12) — regression guard on vercel.json, the config
 * this project owns. Two things must hold simultaneously and never drift
 * apart again:
 *
 *   1. A rewrite maps `/q/:token` to `/api/q/:token` so a published
 *      hosted-quote link actually reaches the Vercel serverless function
 *      (api/q/[token].ts) instead of hitting a platform 404. This was the
 *      LATENT PRODUCTION BUG identified in
 *      .planning/debug/hosted-link-open-blank-page.md — the function
 *      answered only at /api/q/{token}, and nothing routed /q/{token} there.
 *   2. The pre-existing SPA catch-all rewrite's negative-lookahead source
 *      still excludes BOTH `q/` and `api/`, so it can never swallow the new
 *      `/q/:token` rewrite and serve the SPA shell (or the raw function
 *      path) instead of the intended destination.
 *
 * This is a config-shape test (reads + JSON-parses vercel.json), not a live
 * HTTP test — the deferred preview-deploy HTTP verification is tracked as
 * launch-day checklist item 12 in docs/PRO-SECURITY-REVIEW.md (46-12 Task 3).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

interface VercelRewrite {
  source: string;
  destination: string;
}

interface VercelConfig {
  rewrites: VercelRewrite[];
}

const VERCEL_JSON_PATH = join(process.cwd(), 'vercel.json');

function loadVercelConfig(): VercelConfig {
  const raw = readFileSync(VERCEL_JSON_PATH, 'utf-8');
  return JSON.parse(raw) as VercelConfig;
}

// Sample UUID-shaped tokens for the negative-lookahead compile check below —
// mirrors the shape of real hosted_quotes.token values (uuid).
const SAMPLE_TOKEN = 'f83da8d4-e8df-4d33-be95-d546ce2e2918';

describe('vercel.json rewrites', () => {
  it('maps /q/:token to /api/q/:token so the hosted-quote function is reachable', () => {
    const config = loadVercelConfig();
    const qRewrite = config.rewrites.find((r) => r.source === '/q/:token');

    expect(qRewrite).toBeDefined();
    expect(qRewrite?.destination).toBe('/api/q/:token');
  });

  it('keeps the SPA catch-all source excluding both q/ and api/', () => {
    const config = loadVercelConfig();
    const spaRewrite = config.rewrites.find((r) => r.destination === '/');

    expect(spaRewrite).toBeDefined();
    // The negative-lookahead must still name both excluded prefixes.
    expect(spaRewrite?.source).toContain('q/');
    expect(spaRewrite?.source).toContain('api/');

    // Compile the SPA source as an anchored RegExp (Vercel treats `source`
    // as a path-to-regexp-style pattern; the negative-lookahead prefix is
    // already valid raw RegExp syntax, so anchoring it directly is a faithful
    // re-check of the exclusion behavior).
    const compiled = new RegExp(`^${spaRewrite!.source}$`);

    // Must NOT match /q/* or /api/* — those are handled by their own
    // rewrites/functions, never falling through to the SPA shell.
    expect(compiled.test(`/q/${SAMPLE_TOKEN}`)).toBe(false);
    expect(compiled.test(`/api/q/${SAMPLE_TOKEN}`)).toBe(false);

    // Must still match ordinary marketing/app routes so the SPA fallback
    // keeps working for everything else.
    expect(compiled.test('/')).toBe(true);
    expect(compiled.test('/features')).toBe(true);
    expect(compiled.test('/pricing')).toBe(true);
    expect(compiled.test('/app')).toBe(true);
  });
});
