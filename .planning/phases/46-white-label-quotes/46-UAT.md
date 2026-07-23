---
status: diagnosed
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
expected: On desktop, Settings → Profile shows Account & Pro AND the Branding section; the Share-quote button is PRESENT on quote rows (publishing works on both web and desktop per G-46-6 / D-08).
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
  root_cause: "For a NEW email, signInWithOtp (default shouldCreateUser: true) takes GoTrue's signup path and sends the 'Confirm signup' dashboard template, which still contains only {{ .ConfirmationURL }} — no {{ .Token }}. The 46-02 live fix (2026-07-22) patched only the 'Magic link or OTP' template, so existing users get link+code while new users get a link-only email. The link opens the default browser (no PKCE code_verifier there), so no session is created anywhere. Proven by production auth logs: 13:32 mail_type 'confirmation' (fail) vs 13:41 same user, mail_type 'magic_link' → OTP login success via the same UI. Session persistence is NOT a defect (Pro session survived full relaunch during test 4)."
  artifacts:
    - path: "Supabase dashboard (fqidldxuwpfvhsejalbd) → Authentication → Email Templates → 'Confirm signup'"
      issue: "missing {{ .Token }} — primary fault"
    - path: "src/hooks/useProAuth.ts"
      issue: "shouldCreateUser left at default true without accounting for the signup-template branch; emailRedirectTo sends desktop link-clicks to a browser that can never complete PKCE (secondary)"
    - path: "src/components/pro/SignInModal.tsx"
      issue: "copy promises link+code unconditionally; code step renders even when the sent email had no code (cosmetic)"
    - path: "supabase/config.toml"
      issue: "local [auth.email] drifts from production (confirmations, otp_length); templates not captured as config-as-code (contributing)"
  missing:
    - "Add {{ .Token }} to the 'Confirm signup' template (mirror the 46-02 Magic Link fix); live-verify with a fresh email"
    - "Decide shouldCreateUser explicitly; adjust first-time modal copy; document production email templates in repo to stop drift"
  debug_session: .planning/debug/new-user-otp-email-template.md

- gap_id: G-46-4
  truth: "Reopening the Sign in for Pro modal after an abandoned attempt lets the user start over (enter an email and request a new code)."
  status: failed
  reason: "User reported: email field is restricted/disabled, modal stuck waiting for the verification code from a previous attempt."
  severity: major
  test: 4
  root_cause: "useProAuth.status is trapped at 'link-sent' with no user-driven exit, and SignInModal (which owns that hook instance) is permanently mounted — App.tsx:363-366 renders it unconditionally and Modal.tsx:67 unmounts only the Modal's children on close. The only exits from 'link-sent' are a real Supabase auth event or an app restart. On reopen, codeStepVisible (SignInModal.tsx:58) disables the email input (line 115); resetAndClose (61-65) clears local email/code but cannot touch status — hence the EMPTY yet disabled email field. Close paths are inconsistent: code-step Cancel → resetAndClose; X/backdrop/Escape → raw onClose (stale email survives). Tests missed it because SignInModal.test.tsx mocks useProAuth with a frozen status (24-34), making transitions inexpressible."
  artifacts:
    - path: "src/hooks/useProAuth.ts"
      issue: "status state machine has no user-driven exit from 'link-sent'; no reset action in the ProAuth interface"
    - path: "src/components/pro/SignInModal.tsx"
      issue: "derives email-input disabled from trapped status (58, 115); resetAndClose can't reset status (61-65); X/backdrop/Escape bypass reset (93)"
    - path: "src/App.tsx"
      issue: "permanent SignInModal mount (363-366) — nothing self-heals on close"
    - path: "src/components/pro/SignInModal.test.tsx"
      issue: "frozen-status mock erases the exact integration seam that broke"
  missing:
    - "resetSignIn() action in useProAuth (setStatus('signed-out') when not signed in)"
    - "route ALL SignInModal close paths through one handler that calls it (pass resetAndClose as the Modal's onClose)"
    - "'Use a different email' affordance on the code step; lifecycle tests with transitionable status: send → close (each path) → reopen ⇒ editable email step"
  debug_session: .planning/debug/signin-modal-stuck-link-sent.md

- gap_id: G-46-6
  truth: "ALL Pro features — including Share-quote publishing — work on BOTH web and desktop for v2.0 launch. No web-only Pro features."
  status: failed
  reason: "User reported (repeated product decision): 'I keep discussing this - ALL Pro features need to work on web and desktop for v2.0 launch. No exceptions.' The phase shipped Share-quote publishing as web-only (button absent on desktop); that scoping contradicts the launch requirement."
  severity: major
  test: 6
  root_cause: "A single deliberate self-gate — `if (__IS_TAURI__) return null; // D-12: Pro is web-only` at ShareQuoteButton.tsx:38 — kept in place by an explicit 46-02 planner scope decision (46-02-PLAN.md:49: 'Do not remove ShareQuoteButton's gate'), which resolved 46-RESEARCH Open Question 1 narrowly and conflicts with the founder's standing parity requirement. All three mount sites are unconditional; desktop plumbing (auth, entitlement, CSP for *.supabase.co, VITE_SUPABASE_* in release.yml, usePublishedQuote.refreshStatuses) already works on desktop. Browser-API audit found no blocker (clipboard call is try/catch-guarded with toast fallback; no window.open in the publish flow). ShareQuoteButton.test.tsx:100-105 pins the wrong behavior and must be inverted. NOTE: BillingPanel.tsx:50 is a second, separate web-only Pro gate (Paddle billing) — not required for Share-quote parity but implicated by the literal 'no web-only Pro features' rule; founder decision needed."
  artifacts:
    - path: "src/components/pro/ShareQuoteButton.tsx"
      issue: "line 38 — the sole desktop gate for Share-quote (plus stale D-12 comment block, lines 11-23)"
    - path: "src/components/pro/ShareQuoteButton.test.tsx"
      issue: "lines 100-105 — asserts 'renders nothing under __IS_TAURI__'; must be inverted"
    - path: "src/components/pro/BillingPanel.tsx"
      issue: "line 50 — separate deliberate web-only billing gate; needs founder call, out of this gap's minimal scope"
    - path: ".planning/phases/46-white-label-quotes/46-02-PLAN.md"
      issue: "line 49 — the documented scope decision this fix supersedes"
  missing:
    - "Remove the ShareQuoteButton __IS_TAURI__ gate and rewrite the D-12 comment"
    - "Invert the desktop test; record that G-46-6 supersedes 46-02-PLAN's 'Do not remove' instruction"
    - "Optional polish: tauri-plugin-clipboard-manager; 'open hosted page' via @tauri-apps/plugin-shell open() (UpdateBanner.tsx:70-83 pattern, shell:default already granted)"
  debug_session: .planning/debug/desktop-share-quote-parity.md
