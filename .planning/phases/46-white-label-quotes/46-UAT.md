---
status: complete
phase: 46-white-label-quotes
source: [46-VERIFICATION.md]
started: 2026-07-23T09:20:00Z
updated: 2026-07-23T16:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Desktop OTP sign-in through the real SignInModal UI
expected: On desktop (`npm run tauri dev`), Profile → "Sign in for Pro" → email → the emailed one-time code (8 digits in production) typed into the code field completes sign-in. (Headless verifyOtp round-trip already PASSED 2026-07-23; this checks the in-UI path.)
result: pass

### 2. Desktop session persistence across relaunch
expected: After test 1, fully quit and relaunch the desktop app — still signed in, no re-auth prompt (WebView localStorage persistence, RESEARCH A1).
result: issue
reported: "hmmm, I got this email [Supabase Auth 'Confirm your email address' with a confirmation link, from noreply@mail.app.supabase.io]. I clicked to confirm my email and it opened 3D Coster but free version"
severity: major

### 3. Signed-out desktop network silence (free floor)
expected: Signed OUT on desktop, with devtools/network attached to the WebView: normal calculator use fires zero requests to *.supabase.co.
result: pass
note: "Verified by Claude against the dev server (same code as the WebView) — signed-out calculator use produced zero *.supabase.co requests in the network log (2026-07-23)."

### 4. Pro-signed-in logo upload / preview / remove / persistence
expected: With a Pro-entitled session, Settings → Profile → Branding shows "Upload logo" (no Pro chip). Uploading a PNG previews at ~64×64, persists across reload, and Remove clears it. (Needs an entitlement row — seed one or wait for billing test data.)
result: pass
note: "Pro entitlement seeded via scripts/seed-pro-entitlement-uat.sql (2026-07-23) for both test accounts; user verified signed-in Pro session (waarangel@gmail.com) after app relaunch cleared the stuck modal (G-46-4 workaround)."

### 5. Oversized / non-image upload rejection
expected: Under the same Pro session, a >5MB file or a non-image file shows a friendly error toast and stores nothing.
result: pass

### 6. Desktop Pro surface visual check
expected: On desktop, Settings → Profile shows Account & Pro AND the Branding section; the Share-quote button stays ABSENT everywhere on desktop (publishing remains web-only).
result: issue
reported: "I keep discussing this - ALL Pro features need to work on web and desktop for v2.0 launch. No exceptions."
severity: major

## Summary

total: 6
passed: 4
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-46-2
  truth: "After signing in once on desktop, quitting and relaunching the app keeps the user signed in with no re-auth prompt (WebView localStorage persistence)."
  status: failed
  reason: "User reported: got a Supabase 'Confirm your email address' link email (default confirmation template, not the OTP code template); clicking the link opened 3DCoster in a free (signed-out) state instead of a signed-in Pro desktop session."
  severity: major
  test: 2
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis

- gap_id: G-46-4
  truth: "Reopening the Sign in for Pro modal after an abandoned attempt lets the user start over (enter an email and request a new code)."
  status: failed
  reason: "User reported: email field is restricted/disabled, modal stuck waiting for the verification code from a previous attempt. Root cause (verified in code): useProAuth status sticks at 'link-sent' — SignInModal.resetAndClose clears email/code state but nothing ever resets status, and the modal stays mounted, so codeStepVisible stays true with an empty, disabled email field. Also: the Modal's X/backdrop close calls onClose directly (email state survives) while Cancel calls resetAndClose — inconsistent."
  severity: major
  test: 4
  artifacts: [src/components/pro/SignInModal.tsx, src/hooks/useProAuth.ts]
  missing: ["a reset path for ProAuthStatus 'link-sent' (e.g. cancelLinkRequest() in useProAuth called on modal close, or a 'Use a different email' affordance in the code step)"]

- gap_id: G-46-6
  truth: "ALL Pro features — including Share-quote publishing — work on BOTH web and desktop for v2.0 launch. No web-only Pro features."
  status: failed
  reason: "User reported (repeated product decision): 'I keep discussing this - ALL Pro features need to work on web and desktop for v2.0 launch. No exceptions.' The phase shipped Share-quote publishing as web-only (button absent on desktop); that scoping contradicts the launch requirement."
  severity: major
  test: 6
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
