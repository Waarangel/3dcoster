// supabase/functions/delete-account/index.ts
//
// Phase 47 Plan 02, Task 2 (D-14 level-2 self-serve deletion). Called
// directly by a signed-in client (Settings -> Data -> "Delete account"),
// unlike `on-quote-decision` which is triggered by a DB webhook. This
// function:
//   1. Verifies the caller's bearer JWT against the Supabase Auth server
//      (never trusts a client-decoded token) to resolve the caller's own
//      user id — a user can only ever delete their OWN account, there is
//      no userId parameter accepted from the request body (T-47-07).
//   2. Calls `auth.admin.deleteUser(userId)` with the SERVICE ROLE client.
//      Every table that stores per-account data — `sync_blobs.user_id`,
//      `hosted_quotes.owner_id`, `entitlements.user_id` — declares
//      `on delete cascade` against `auth.users(id)` (0001_pro_backend.sql,
//      0002_cloud_sync.sql), so deleting the auth user atomically removes
//      the blob + entitlement + hosted quotes in one cascade. This
//      function never issues a manual per-table DELETE.
//
// The service-role key is read the same way as on-quote-decision's
// SUPABASE_SERVICE_ROLE_KEY — automatically injected into every Supabase
// Edge Function's environment, never something this codebase sets or
// stores itself, and it never leaves this function (not echoed in any
// response, never logged).
//
// Note (D-14 scope): billing-record legal retention is Paddle's
// responsibility as Merchant of Record — out of scope for this function,
// which only ever touches this project's own auth/DB records.
//
// Deploy (operator step, NOT run by this executor — no Supabase CLI
// credentials are configured in this session; part of 47-02-PLAN.md
// Task 3's [BLOCKING] checkpoint):
//   supabase functions deploy delete-account

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!bearerToken) {
    return jsonResponse({ error: 'Missing bearer token' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  // SUPABASE_SERVICE_ROLE_KEY is automatically injected into every
  // Supabase Edge Function's environment — it is never something this
  // codebase sets or stores itself, and it never leaves this function.
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('delete-account: missing SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY edge env');
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  // Verify the caller's JWT against the Auth server (never trust a
  // client-decoded token) — this resolves the caller's OWN user id. There
  // is no userId parameter accepted from the request body; a caller can
  // only ever delete the account their own valid session belongs to.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser(bearerToken);
  const userId = userData?.user?.id;
  if (userError || !userId) {
    console.error('delete-account: could not verify caller JWT', userError);
    return jsonResponse({ error: 'Invalid or expired session' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Cascade-based deletion: sync_blobs.user_id, hosted_quotes.owner_id,
  // and entitlements.user_id all declare `on delete cascade` against
  // auth.users(id) — this single call removes all of it (D-14 level 2).
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('delete-account: auth.admin.deleteUser failed', deleteError);
    return jsonResponse({ error: 'Account deletion failed' }, 502);
  }

  return jsonResponse({ deleted: true }, 200);
});
