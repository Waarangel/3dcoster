---
status: diagnosed
phase: 46-white-label-quotes
source: [46-VERIFICATION.md, 46-08-SUMMARY.md, 46-09-SUMMARY.md, 46-10-SUMMARY.md]
started: 2026-07-23T09:20:00Z
updated: 2026-07-23T17:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Desktop OTP sign-in through the real SignInModal UI
expected: On desktop (`npm run tauri dev`), Profile → "Sign in for Pro" → email → the emailed one-time code (8 digits in production) typed into the code field completes sign-in. (Headless verifyOtp round-trip already PASSED 2026-07-23; this checks the in-UI path.)
result: pass

### 2. Desktop session persistence across relaunch
expected: After test 1, fully quit and relaunch the desktop app — still signed in, no re-auth prompt (WebView localStorage persistence, RESEARCH A1).
result: pass
note: "Re-verified live by founder during the 46-08 checkpoint (2026-07-23): fresh never-before-seen email → one-time code received (not link-only) → code entered in SignInModal → signed in → full quit + relaunch → still signed in. Founder typed 'approved'. (Original issue was the link-only 'Confirm signup' email for new users — fixed live via Management API, G-46-2 resolved.)"

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

### 6. Desktop Pro surface visual check (re-verify after G-46-6 fix)
expected: On desktop, Settings → Profile shows Account & Pro AND the Branding section; the Share-quote button is PRESENT on quote rows — both the signed-out "Share quote [Pro]" pitch chip and the signed-in Share/Unpublish control (publishing works on both web and desktop per G-46-6 / D-08).
result: issue
reported: "yes, Share Quote shows and it generates a quote link, which shows up in toast for about 3 seconds then disappears. I have no idea where the link is, or how to get to it in the future"
severity: major
note: "Parity itself confirmed (button present, publish works on desktop) — the issue is link retrievability after the transient toast."

### 7. First-time sign-in copy accuracy (46-09 D5)
expected: The "Sign in for Pro" modal's intro copy says a one-time code is emailed and that a brand-new account may need to confirm before the code works — no unconditional "magic link and one-time code" over-promise. Reads accurately and clearly.
result: pass

### 8. Production 'Confirm signup' template live fix (46-08 D3)
expected: Production 'Confirm signup' Supabase email template patched live to include {{ .Token }}, applied via Management API with founder approval, byte-for-byte GET-confirmed.
result: pass
note: "Manual-procedural verification recorded in 46-08-SUMMARY: founder approval ('Apply it for me') + Management API PATCH + GET re-read confirmation, 2026-07-23. Not re-presented — already human-verified."
coverage_id: 46-08/D3

### 9. Email templates captured as config-as-code (46-08 D1)
expected: docs/SUPABASE-EMAIL-TEMPLATES.md captures both production auth email templates (Magic Link + Confirm Signup) byte-for-byte, with launch-checklist item in docs/PRO-SECURITY-REVIEW.md.
result: pass
source: automated
coverage_id: 46-08/D1

### 10. supabase/config.toml production-reality annotations (46-08 D2)
expected: supabase/config.toml [auth.email] annotated with production-reality notes (no local-dev value changes).
result: pass
source: automated
coverage_id: 46-08/D2

### 11. resetSignIn() user-driven exit from link-sent (46-09 D1)
expected: resetSignIn() returns useProAuth.status from 'link-sent' to 'signed-out' (or 'unavailable' with a null client), and is a guaranteed no-op while signed in.
result: pass
source: automated
coverage_id: 46-09/D1

### 12. shouldCreateUser explicit (46-09 D2)
expected: signInWithEmail passes shouldCreateUser: true explicitly to signInWithOtp.
result: pass
source: automated
coverage_id: 46-09/D2

### 13. All SignInModal close gestures reset identically (46-09 D3)
expected: X/backdrop/Escape/email-step Cancel/code-step Cancel all route through the same resetAndClose, leaving an editable, empty email step on reopen.
result: pass
source: automated
coverage_id: 46-09/D3

### 14. "Use a different email" recovery affordance (46-09 D4)
expected: 'Use a different email' on the code step returns to the editable email step without closing the modal.
result: pass
source: automated
coverage_id: 46-09/D4

### 15. ShareQuoteButton renders on desktop (46-10 D1)
expected: ShareQuoteButton renders on desktop (Tauri) for the signed-in Share/Unpublish control and the signed-out Pro pitch chip, with the __IS_TAURI__ gate removed.
result: pass
source: automated
coverage_id: 46-10/D1

### 16. Web Share-quote behaviors unchanged (46-10 D2)
expected: Existing signed-out (Pro chip → pitch modal) and signed-in (publish/unpublish/error toast) web behaviors remain unchanged after the gate removal.
result: pass
source: automated
coverage_id: 46-10/D2

### 17. UAT test-6 expectation corrected (46-10 D3)
expected: 46-UAT.md test-6 expected text corrected to assert the Share-quote button is PRESENT on desktop.
result: pass
source: automated
coverage_id: 46-10/D3

## Summary

total: 17
passed: 16
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-46-6R
  truth: "After publishing a quote on desktop or web, the hosted-quote link stays retrievable — the user can copy it on demand and find it again later from the quote row, not only in a transient toast."
  status: failed
  reason: "User reported: Share Quote shows and it generates a quote link, which shows up in toast for about 3 seconds then disappears. I have no idea where the link is, or how to get to it in the future"
  severity: major
  test: 6
  root_cause: "The hosted-quote URL IS durably persisted on the local Quote record (publishedUrl + hostedToken, written at usePublishedQuote.ts:160-168) but NO UI component ever reads it back — repo-wide, quote.publishedUrl has zero read sites outside the type declaration (types.ts:428) and the hook that writes it. For a published quote the UI renders only an inert 'Live link' text badge (JobsManager.tsx:317-321) and an 'Unpublish'-only button (ShareQuoteButton.tsx:116), so the only link surfaces are a one-shot clipboard write and a 5s auto-dismiss toast (DEFAULT_TOAST_DURATION=5000, toast/types.ts:27; no hover-pause). Desktop twist: ShareQuoteButton.tsx:79 uses `await navigator.clipboard?.writeText(url)` — when WKWebView exposes no navigator.clipboard, the optional chain resolves without throwing and the toast FALSELY claims 'link copied'; when writeText rejects, the catch shows the URL-only fallback toast the user saw. Republish mints a NEW token (D-13), so the old customer URL can't be recovered that way. Web shares the primary gap (link unrecoverable from UI after clipboard overwrite); 46-10's 'toast fallback = parity' assessed publish parity, not link retrievability, which no phase ever scoped."
  artifacts:
    - path: "src/components/pro/ShareQuoteButton.tsx"
      issue: "published state renders only 'Unpublish' (:116); false-positive 'copied' toast via optional-chained clipboard (:79-80); no duration override on the URL toast"
    - path: "src/components/JobsManager.tsx"
      issue: "'Live link' badge is inert text, not a link/copy control (:317-321)"
    - path: "src/hooks/usePublishedQuote.ts"
      issue: "data layer fine — writes publishedUrl/hostedToken (:160-168); nothing consumes them"
    - path: "src/components/ui/toast/ToastProvider.tsx"
      issue: "5s auto-dismiss, no hover-pause, plain-text content (contributing)"
  missing:
    - "Persistent 'Copy link' affordance (shared IconButton + descriptive aria-label per project convention) wherever publishStatus === 'published' — next to the Live-link badge and/or paired with Unpublish — reading quote.publishedUrl"
    - "Optional 'Open hosted page' action reusing the plugin-shell pattern (UpdateBanner.tsx:70-83, shell:default already granted)"
    - "Fix the false 'copied' claim by guarding on navigator.clipboard existence (consider tauri-plugin-clipboard-manager for reliable desktop copy)"
  debug_session: .planning/debug/hosted-quote-link-retrievability.md

- gap_id: G-46-2
  truth: "After signing in once on desktop, quitting and relaunching the app keeps the user signed in with no re-auth prompt (WebView localStorage persistence)."
  status: resolved
  resolved_by: 46-08-PLAN.md (primary — live template fix), 46-09-PLAN.md (client half — shouldCreateUser + copy)
  resolved_at: 2026-07-23
  reason: "User reported: got a Supabase 'Confirm your email address' link email (default confirmation template, not the OTP code template); clicking the link opened 3DCoster in a free (signed-out) state instead of a signed-in Pro desktop session."
  severity: major
  test: 2
  root_cause: "For a NEW email, signInWithOtp (default shouldCreateUser: true) takes GoTrue's signup path and sends the 'Confirm signup' dashboard template, which still contains only {{ .ConfirmationURL }} — no {{ .Token }}. The 46-02 live fix (2026-07-22) patched only the 'Magic link or OTP' template, so existing users get link+code while new users get a link-only email. The link opens the default browser (no PKCE code_verifier there), so no session is created anywhere. Proven by production auth logs: 13:32 mail_type 'confirmation' (fail) vs 13:41 same user, mail_type 'magic_link' → OTP login success via the same UI. Session persistence is NOT a defect (Pro session survived full relaunch during test 4)."
  debug_session: .planning/debug/new-user-otp-email-template.md

- gap_id: G-46-4
  truth: "Reopening the Sign in for Pro modal after an abandoned attempt lets the user start over (enter an email and request a new code)."
  status: resolved
  resolved_by: 46-09-PLAN.md
  resolved_at: 2026-07-23
  reason: "User reported: email field is restricted/disabled, modal stuck waiting for the verification code from a previous attempt."
  severity: major
  test: 4
  root_cause: "useProAuth.status is trapped at 'link-sent' with no user-driven exit, and SignInModal (which owns that hook instance) is permanently mounted — App.tsx:363-366 renders it unconditionally and Modal.tsx:67 unmounts only the Modal's children on close. The only exits from 'link-sent' are a real Supabase auth event or an app restart. On reopen, codeStepVisible (SignInModal.tsx:58) disables the email input (line 115); resetAndClose (61-65) clears local email/code but cannot touch status — hence the EMPTY yet disabled email field. Close paths are inconsistent: code-step Cancel → resetAndClose; X/backdrop/Escape → raw onClose (stale email survives). Tests missed it because SignInModal.test.tsx mocks useProAuth with a frozen status (24-34), making transitions inexpressible."
  debug_session: .planning/debug/signin-modal-stuck-link-sent.md

- gap_id: G-46-6
  truth: "ALL Pro features — including Share-quote publishing — work on BOTH web and desktop for v2.0 launch. No web-only Pro features."
  status: resolved
  resolved_by: 46-10-PLAN.md
  resolved_at: 2026-07-23
  reason: "User reported (repeated product decision): 'I keep discussing this - ALL Pro features need to work on web and desktop for v2.0 launch. No exceptions.' The phase shipped Share-quote publishing as web-only (button absent on desktop); that scoping contradicts the launch requirement."
  severity: major
  test: 6
  root_cause: "A single deliberate self-gate — `if (__IS_TAURI__) return null; // D-12: Pro is web-only` at ShareQuoteButton.tsx:38 — kept in place by an explicit 46-02 planner scope decision (46-02-PLAN.md:49: 'Do not remove ShareQuoteButton's gate'), which resolved 46-RESEARCH Open Question 1 narrowly and conflicts with the founder's standing parity requirement. All three mount sites are unconditional; desktop plumbing (auth, entitlement, CSP for *.supabase.co, VITE_SUPABASE_* in release.yml, usePublishedQuote.refreshStatuses) already works on desktop. Browser-API audit found no blocker. ShareQuoteButton.test.tsx pinned the wrong behavior — inverted by 46-10. NOTE: BillingPanel.tsx:50 is a second, separate web-only Pro gate (Paddle billing) — OPEN FOUNDER QUESTION, tracked in 46-10-SUMMARY, not part of this gap's fix."
  debug_session: .planning/debug/desktop-share-quote-parity.md
