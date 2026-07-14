// @vitest-environment node
/**
 * tests/security/hosted-quote-enumerability.test.ts
 *
 * PRO-03's single most important regression test (43-RESEARCH.md
 * Validation Architecture: "the anon-listing regression test... should be
 * automated, not just manually eyeballed once"). Confirms the anon role
 * cannot list `public.hosted_quotes` via raw PostgREST, with or without a
 * token filter — the ONLY anon-reachable data path is the
 * `get_hosted_quote` / `approve_quote_decision` SECURITY DEFINER RPCs
 * (supabase/migrations/0001_pro_backend.sql, Pitfall 1 in 43-RESEARCH.md).
 *
 * This is a LIVE integration test against the real Supabase project — it
 * uses raw `fetch` (no `@supabase/supabase-js` dependency, matching the
 * server-side helper style in api/lib/supabaseRest.ts) against
 * `${SUPABASE_URL}/rest/v1/hosted_quotes` with only the anon apikey header.
 *
 * Per the plan (Wave 0 gap, acknowledged): when `SUPABASE_URL` /
 * `SUPABASE_ANON_KEY` are not present in the test environment, this file
 * is SKIPPED WITH REASON (visible in the vitest run output as "skipped",
 * never silently passing) rather than treated as green.
 */
import { describe, it, expect } from 'vitest';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const hasLiveEnv = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

const SKIP_REASON =
  'SKIPPED: SUPABASE_URL / SUPABASE_ANON_KEY not set in this test environment — ' +
  'this is a live-project regression test (Wave 0 gap acknowledged in 43-RESEARCH.md); ' +
  'set both env vars to run it against the real eu-central-1 project before the 43-07 PRO-03 gate.';

const PROBE_TOKEN = '00000000-0000-0000-0000-000000000000';

async function anonGet(path: string): Promise<Response> {
  return fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
}

/** Empty array (RLS-scoped-to-nothing) or an outright 401/403 both satisfy "cannot list." */
async function assertNoRowsListable(res: Response): Promise<void> {
  if (res.status === 200) {
    const body = (await res.json()) as unknown;
    expect(Array.isArray(body) ? body.length : -1).toBe(0);
    return;
  }
  expect([401, 403]).toContain(res.status);
}

describe.skipIf(!hasLiveEnv)('hosted_quotes anon enumerability (PRO-03 core gate)', () => {
  it('anon GET /rest/v1/hosted_quotes?select=* cannot list any row (no token filter)', async () => {
    const res = await anonGet('/rest/v1/hosted_quotes?select=*');
    await assertNoRowsListable(res);
  });

  it('anon GET /rest/v1/hosted_quotes?token=eq.<uuid>&select=* is likewise blocked (reads must go through the RPC, not the table)', async () => {
    const res = await anonGet(`/rest/v1/hosted_quotes?token=eq.${PROBE_TOKEN}&select=*`);
    await assertNoRowsListable(res);
  });

  it('anon GET /rest/v1/entitlements?select=* cannot list any row', async () => {
    const res = await anonGet('/rest/v1/entitlements?select=*');
    await assertNoRowsListable(res);
  });
});

if (!hasLiveEnv) {
  describe('hosted_quotes anon enumerability (PRO-03 core gate)', () => {
    it.skip(SKIP_REASON, () => {
      // Intentionally empty — the skip itself (with a descriptive test
      // name) is the "skipped-with-reason" signal this plan requires.
    });
  });
}
