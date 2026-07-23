---
status: testing
phase: 46-white-label-quotes
source: [46-VERIFICATION.md]
started: 2026-07-23T09:20:00Z
updated: 2026-07-23T09:20:00Z
---

## Current Test

number: 1
name: Desktop OTP sign-in through the real SignInModal UI
expected: |
  On a desktop build (`npm run tauri dev` with VITE_SUPABASE_* set), Profile → "Sign in for Pro"
  → enter email → one email arrives → typing the (currently 8-digit) code into the code field
  signs you in to a visible Pro state.
awaiting: user response

## Tests

### 1. Desktop OTP sign-in through the real SignInModal UI
expected: On desktop (`npm run tauri dev`), Profile → "Sign in for Pro" → email → the emailed one-time code (8 digits in production) typed into the code field completes sign-in. (Headless verifyOtp round-trip already PASSED 2026-07-23; this checks the in-UI path.)
result: [pending]

### 2. Desktop session persistence across relaunch
expected: After test 1, fully quit and relaunch the desktop app — still signed in, no re-auth prompt (WebView localStorage persistence, RESEARCH A1).
result: [pending]

### 3. Signed-out desktop network silence (free floor)
expected: Signed OUT on desktop, with devtools/network attached to the WebView: normal calculator use fires zero requests to *.supabase.co.
result: [pending]

### 4. Pro-signed-in logo upload / preview / remove / persistence
expected: With a Pro-entitled session, Settings → Profile → Branding shows "Upload logo" (no Pro chip). Uploading a PNG previews at ~64×64, persists across reload, and Remove clears it. (Needs an entitlement row — seed one or wait for billing test data.)
result: [pending]

### 5. Oversized / non-image upload rejection
expected: Under the same Pro session, a >5MB file or a non-image file shows a friendly error toast and stores nothing.
result: [pending]

### 6. Desktop Pro surface visual check
expected: On desktop, Settings → Profile shows Account & Pro AND the Branding section; the Share-quote button stays ABSENT everywhere on desktop (publishing remains web-only).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
