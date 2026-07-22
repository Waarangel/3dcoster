// Diagnostic: live email-OTP round-trip against the production Supabase project.
// Verifies checkpoint 46-02 Task 3 (Pitfall 2): the magic-link email template must
// deliver a 6-digit {{ .Token }} code that auth.verifyOtp accepts.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/verify-otp-roundtrip.mjs send <email>
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/verify-otp-roundtrip.mjs verify <email> <code>
// No secrets are stored in this file; the anon key is the public client key.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars');
  process.exit(2);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, flowType: 'pkce' },
});

const [mode, email, code] = process.argv.slice(2);

if (mode === 'send') {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    console.error('signInWithOtp FAILED:', error.status, error.message);
    process.exit(1);
  }
  console.log(`OTP email requested for ${email} at ${new Date().toISOString()}`);
} else if (mode === 'verify') {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) {
    console.error('verifyOtp FAILED:', error.status, error.message);
    process.exit(1);
  }
  console.log('verifyOtp OK — user id:', data.user?.id, '| session acquired:', Boolean(data.session));
  // Sign out immediately so the diagnostic leaves no live session server-side.
  await supabase.auth.signOut();
  console.log('signed out (diagnostic session revoked)');
} else {
  console.error('Unknown mode. Use: send <email> | verify <email> <code>');
  process.exit(2);
}
