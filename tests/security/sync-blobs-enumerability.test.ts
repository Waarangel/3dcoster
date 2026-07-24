// @vitest-environment node
/**
 * tests/security/sync-blobs-enumerability.test.ts
 *
 * Phase 47's core regression test (mirrors
 * tests/security/hosted-quote-enumerability.test.ts byte-for-byte in
 * structure). Confirms the anon role cannot list `public.sync_blobs` via
 * raw PostgREST, with or without a user_id filter — the ONLY anon-reachable
 * surface for this table is none at all: cloud sync is a signed-in Pro
 * path, so unlike hosted_quotes there isn't even an anon-callable RPC.
 * `download_sync_blob` / `upload_sync_blob` / `reset_sync_blob` are all
 * granted to `authenticated` only (supabase/migrations/0002_cloud_sync.sql,
 * T-47-03).
 *
 * This is a LIVE integration test against the real Supabase project — it
 * uses raw `fetch` (no `@supabase/supabase-js` dependency, matching the
 * server-side helper style in api/lib/supabaseRest.ts) against
 * `${SUPABASE_URL}/rest/v1/sync_blobs` with only the anon apikey header.
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
  'this is a live-project regression test (Phase 47 Wave 0 gap, mirrors the ' +
  '43-RESEARCH.md hosted-quote precedent); set both env vars to run it against ' +
  'the real eu-central-1 project before/after the 47-02 Task 3 apply-migration gate.';

const PROBE_USER_ID = '00000000-0000-0000-0000-000000000000';

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

describe.skipIf(!hasLiveEnv)('sync_blobs anon enumerability (T-47-03 core gate)', () => {
  it('anon GET /rest/v1/sync_blobs?select=* cannot list any row (no filter)', async () => {
    const res = await anonGet('/rest/v1/sync_blobs?select=*');
    await assertNoRowsListable(res);
  });

  it('anon GET /rest/v1/sync_blobs?user_id=eq.<uuid>&select=* is likewise blocked', async () => {
    const res = await anonGet(`/rest/v1/sync_blobs?user_id=eq.${PROBE_USER_ID}&select=*`);
    await assertNoRowsListable(res);
  });

  it('anon POST /rest/v1/rpc/upload_sync_blob is rejected (RPC is authenticated-only, not anon-reachable)', async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upload_sync_blob`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ciphertext: 'probe', p_expected_version: 0 }),
    });
    // Anon has no EXECUTE grant on this function — PostgREST returns 401/403
    // (permission denied) rather than 404, since the RPC route itself
    // exists in the schema, only the grant is missing.
    expect([401, 403]).toContain(res.status);
  });
});

if (!hasLiveEnv) {
  describe('sync_blobs anon enumerability (T-47-03 core gate)', () => {
    it.skip(SKIP_REASON, () => {
      // Intentionally empty — the skip itself (with a descriptive test
      // name) is the "skipped-with-reason" signal this plan requires.
    });
  });
}
