---
status: root-cause-found
gap: G-46-2 (Phase 46 UAT test 2)
created: 2026-07-23
investigator: gsd-debugger (find_root_cause_only — no source edits)
---

# Debug Session: New-user sign-in sends "Confirm signup" email with no OTP code

## Symptom

- **Expected (truth):** Signing in on the desktop app sends ONE email containing a magic
  link AND an 8-digit one-time code; typing the code into SignInModal signs the user in;
  session persists across relaunch.
- **Actual (user, verbatim):** "hmmm, I got this email [Supabase Auth 'Confirm your email
  address' with a confirmation link, from noreply@mail.app.supabase.io]. I clicked to
  confirm my email and it opened 3D Coster but free version"
- User attempted sign-in with **waarangel@gmail.com — a brand-new email** (existing user
  marcusjdickinson@gmail.com had passed test 1 with the same UI the same day).

## Evidence

### 1. Production auth logs (project fqidldxuwpfvhsejalbd, 2026-07-23, via MCP get_logs service=auth)

Complete timeline of the failure and the user's self-recovery:

| Time (UTC) | Event | Meaning |
|---|---|---|
| 13:32:28 | `POST /otp` → `user_confirmation_requested`; `mail.send` with **`mail_type: "confirmation"`** (referer `http://localhost:4173/app`) | `signInWithOtp` for a NON-EXISTENT user auto-created the account and GoTrue sent the **"Confirm signup" template**, NOT the magic-link template |
| 13:32:49 | `GET /verify` → 303, `user_signedup` | User clicked the confirmation link **in their default browser**; server confirmed the email and 303-redirected to `redirect_to` (localhost:4173/app) |
| 13:32:58 | `GET /verify` → 403 "One-time token not found" (remote_addr 172.253.7.52 — Google infra) | Second hit on the same one-time link (mail-client prefetch/re-click); already consumed |
| 13:41:04 | `POST /otp` → `user_recovery_requested`; `mail.send` with **`mail_type: "magic_link"`** | User retried "Send magic link" — now an EXISTING confirmed user, so the (fixed in 46-02) Magic Link template fired |
| 13:41:15 | `POST /verify` → 200, `login_method: "otp"` | User typed the 8-digit code from the second email — **signed in successfully** |

`auth.users` corroborates: waarangel@gmail.com `created_at 13:32:27`,
`confirmation_sent_at 13:32:27`, `email_confirmed_at 13:32:49`,
`last_sign_in_at 13:41:15` (the retry, not the link click).

Key contrast in the logs: **`mail_type: "confirmation"` (13:32) vs `mail_type: "magic_link"` (13:41).**
Two different templates serve the same client call depending on whether the user already exists.

### 2. Client code (read in full, no fault found in the happy-path logic itself)

- `src/hooks/useProAuth.ts:95-101` — `signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/app' } })`.
  **`shouldCreateUser` is not passed** → supabase-js default `true` → new emails silently
  create a user and take the signup-confirmation path.
- `src/lib/supabaseClient.ts:39-50` — `flowType: 'pkce'`, `detectSessionInUrl: true`,
  `persistSession: true` (localStorage in the Tauri WebView, threat model T-43-09/T-46-04).
- `src/components/pro/SignInModal.tsx` — one email step + one code step; the copy promises
  "a magic link and a one-time code" unconditionally. The code step (`status === 'link-sent'`)
  shows regardless of which template the server actually sent — there is no code in a
  "Confirm signup" email for the user to type.

### 3. Phase docs — the 46-02 fix only covered ONE of the two templates

- `.planning/phases/46-white-label-quotes/46-02-SUMMARY.md` (lines 174, 220-222): Pitfall 2
  confirmed and fixed live 2026-07-22 — `{{ .Token }}` appended **to the "Magic link or OTP"
  template only** in the Supabase dashboard. Live round-trip proven with an existing user
  (8-digit code `74359066`). The **"Confirm signup" template was never touched** — it still
  contains only `{{ .ConfirmationURL }}` (exactly what the user's screenshot shows).
- `.planning/phases/46-white-label-quotes/46-RESEARCH.md` Pitfall 2 analyzed the dual-variable
  template question **only for the Magic Link template**; the new-user → confirmation-template
  branch was never identified in research, plan, or verification. Test coverage (headless
  round-trip + UAT test 1) used marcusjdickinson@gmail.com, already a confirmed user — so the
  new-user branch was structurally untested until UAT test 2 used a fresh email.

### 4. Local config drift (contributing, not causal)

`supabase/config.toml` `[auth.email]` has `enable_confirmations = false` and `otp_length = 6`.
This file governs **local dev only** — the hosted project has confirmations effectively on
for new signups (hence the confirmation email) and `otp_length = 8`. Config-as-code does not
reflect production dashboard state; nothing in the repo pins the production email templates.

## Hypotheses tested

1. **New users get the "Confirm signup" template (no `{{ .Token }}`) instead of the fixed
   Magic Link template — CONFIRMED** by `mail_type: "confirmation"` in the auth log at
   13:32:28 and by the same user receiving `mail_type: "magic_link"` (with working code)
   nine minutes later once they existed.
2. **The confirmation link cannot sign the desktop app in — CONFIRMED (two independent
   reasons):**
   - The link opens in the **default browser**, not the Tauri WebView. Even a successful
     exchange would put the session in the browser's localStorage, never the desktop app's.
   - The flow is **PKCE**: the `code_verifier` was stored in the Tauri WebView's
     localStorage when `signInWithOtp` ran. The browser that receives the `?code=` redirect
     has no verifier, so `detectSessionInUrl`'s exchange fails silently → the browser shows
     `http://localhost:4173/app` (the dev server serves the same SPA) **signed-out = "3D
     Coster but free version"**. The log shows no `token` grant after the 13:32:49 verify —
     only email confirmation happened.
3. **Client bug in SignInModal/useProAuth as the cause — REJECTED.** The same UI signed the
   same user in at 13:41:15 once the right template fired. The client's only faults are
   (a) not passing `shouldCreateUser` deliberately, and (b) UI copy promising a code that
   new users don't receive.
4. **Session persistence across relaunch (the literal test-2 truth) broken — REJECTED /
   NOT REPRODUCED.** Persistence was never actually exercised as written (the user re-authed
   with a new email instead), but UAT test 4's note provides direct evidence it works: the
   waarangel@gmail.com Pro session **survived a full app relaunch** (relaunch was used as the
   G-46-4 stuck-modal workaround, and the user was still signed in — seeded entitlement
   visible). Consistent with `persistSession: true` + WKWebView localStorage persistence
   (RESEARCH A1). No code/doc evidence of a persistence defect.

## Conclusion

**Root cause:** Supabase sends different email templates for the same `signInWithOtp` call
depending on user existence. For a brand-new email, GoTrue takes the signup path and sends
the **"Confirm signup" dashboard template, which still contains only `{{ .ConfirmationURL }}`
— no `{{ .Token }}`** (the 46-02 live fix patched only the "Magic link or OTP" template).
The new user therefore receives a link-only email; the link opens the default browser where
the PKCE exchange cannot complete (verifier lives in the Tauri WebView), landing on a
signed-out web build → "free version". Secondary client gap: `useProAuth.signInWithEmail`
leaves `shouldCreateUser` at its default (`true`) without accounting for the different email
template that path triggers, and SignInModal's copy/code-step assume a code is always sent.

**Fix direction (for gap-closure planner):**
1. **Supabase dashboard → Authentication → Email Templates → "Confirm signup":** add
   `{{ .Token }}` alongside `{{ .ConfirmationURL }}` (mirror the 46-02 Magic Link fix).
   `verifyOtp({ type: 'email' })` accepts signup-confirmation tokens, so the existing
   client code-entry path should then work for new users — live-verify with a fresh email
   (same discipline as the 46-02 checkpoint).
2. Consider capturing both production templates as config-as-code / docs so the next
   template drift is visible in review (config.toml drift noted above).
3. Optional client hardening: decide `shouldCreateUser` explicitly; make SignInModal copy
   accurate for first-time users ("check your email for a code — new accounts may need to
   confirm"); G-46-4 (stuck 'link-sent' status) is already tracked separately.
4. Session persistence needs no fix — re-verify test 2 as written after (1) lands.
