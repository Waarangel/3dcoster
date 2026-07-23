# Supabase Auth Email Templates (config-as-code capture)

**Project:** `fqidldxuwpfvhsejalbd` (eu-central-1)
**Purpose:** The repo previously pinned neither of the two production auth email
templates anywhere. That silence is exactly how the 46-02 Magic Link fix
(appending `{{ .Token }}`) shipped without anyone noticing the sibling
"Confirm signup" template still needed the identical fix — the gap this
document exists to close (G-46-2). Both templates are captured here so the
next drift is visible in code review, not discovered live by a user.

**Provenance note:** Both bodies below are **byte-for-byte reads from the
production auth config** (`GET https://api.supabase.com/v1/projects/{ref}/config/auth`,
fields `mailer_templates_magiclink_content` /
`mailer_templates_confirmation_content`, read 2026-07-23). An earlier revision
of this document reconstructed them from secondhand evidence because no API
read path was wired up at the time; the live read showed both reconstructions
had drifted from Supabase's actual stock markup (different headings and link
copy), so they were replaced with the authoritative bodies — exactly the kind
of drift this document exists to make visible.

---

## Template: "Magic link or OTP"

**Status: FIXED live 2026-07-22** (per 46-02-SUMMARY Checkpoint Resolution item 1).
GoTrue sends this template when `signInWithOtp` is called for an email that
**already has a confirmed Supabase Auth user**.

```html
<h2>Your sign-in link</h2>

<p>Follow the link below to sign in. This link expires shortly and can only be used once.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
<p>Or enter this one-time sign-in code in the 3DCoster app: {{ .Token }}</p>
```

The final line is the fix: it was appended to Supabase's stock default. `{{ .Token }}` renders the numeric one-time code (8 digits on this
production project — see `otp_length` note in `supabase/config.toml` below).
Live-verified end-to-end 2026-07-22: an 8-digit code (`74359066`) was sent,
typed into `SignInModal`, and exchanged via `supabase.auth.verifyOtp` — session
acquired then revoked to leave no live session behind (46-02-SUMMARY,
"Post-checkpoint deviation").

---

## Template: "Confirm signup"

**Status: FIXED live 2026-07-23** (G-46-2; applied via the Management API with
founder approval during the 46-08 Task 2 checkpoint — live fresh-email
verification per that checkpoint).
GoTrue sends this template when `signInWithOtp` is called for an email that
has **no existing Supabase Auth user** — the call auto-creates the account and
routes through the signup-confirmation path instead of the magic-link path,
even though the client made the exact same `signInWithOtp` call in both cases.

### Pre-fix (broken) body — no code, link-only dead end

```html
<h2>Confirm your email address</h2>

<p>Follow the link below to confirm this email address and finish signing up.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm email address</a></p>
```

This was Supabase's stock default template, untouched (byte-for-byte API read
before the fix was applied). On desktop, clicking
this link opens the **default OS browser** (not the Tauri WebView), where the
PKCE `code_verifier` — stored in the WebView's own localStorage when
`signInWithOtp` ran — does not exist. `detectSessionInUrl`'s exchange fails
silently, and the browser lands on `http://localhost:4173/app` signed out
("free version"). See `.planning/debug/new-user-otp-email-template.md` for the
full production auth-log timeline that confirmed this root cause.

### Corrected body (LIVE since 2026-07-23) — mirrors the Magic Link fix exactly

```html
<h2>Confirm your email address</h2>

<p>Follow the link below to confirm this email address and finish signing up.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm email address</a></p>
<p>Or enter this one-time sign-in code in the 3DCoster app: {{ .Token }}</p>
```

**Why this fixes it:** `verifyOtp({ email, token, type: 'email' })` — the exact
call `useProAuth.verifyEmailCode` already makes — accepts tokens from BOTH the
magic-link/OTP template AND the signup-confirmation template; GoTrue does not
distinguish by which template the token was delivered in, only by whether the
supplied `type` matches how the token was issued. Once `{{ .Token }}` is
present in this template's rendered output, a brand-new user typing that code
into the existing `SignInModal` code-entry step (built in 46-02, currently
only proven against already-existing users) completes the exact same
in-WebView `verifyOtp` exchange that already works for existing users — no
new client code path is required. This is why Task 1 of this plan makes no
`src/` changes: the fix is entirely a dashboard template content change,
applied by the blocking checkpoint in Task 2.

---

## Why two templates exist for one client call

`useProAuth.signInWithEmail` calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`
unconditionally — there is no branch in client code for new-vs-existing users.
GoTrue itself decides which template to render server-side, based on whether
the email already belongs to a confirmed user:

| User state | GoTrue action | `mail_type` (auth logs) | Template rendered |
|---|---|---|---|
| Email belongs to an existing confirmed user | Standard OTP/magic-link resend | `magic_link` | "Magic link or OTP" |
| Email has never signed up | Auto-creates the user, sends signup confirmation | `confirmation` | "Confirm signup" |

Proven directly in production auth logs (project `fqidldxuwpfvhsejalbd`,
2026-07-23): the same `waarangel@gmail.com` address received `mail_type:
"confirmation"` at 13:32:28 (first-ever sign-in attempt) and `mail_type:
"magic_link"` at 13:41:04 (nine minutes later, now an existing confirmed
user) — from the identical client call, with no code change in between. Full
timeline in `.planning/debug/new-user-otp-email-template.md`.

This is also why the phase's earlier test coverage (headless round-trip
script + UAT test 1) never caught the gap: both used
`marcusjdickinson@gmail.com`, already a confirmed user by the time those
tests ran, so only the "Magic link or OTP" branch was ever exercised until
UAT test 2 used a genuinely fresh email.

---

## Apply via Supabase Management API (optional automation)

The dashboard path (Authentication → Email Templates → "Confirm signup" →
edit → Save) is the primary, human-verified path for Task 2 of this plan. For
a future operator who wants to script this instead of using the dashboard UI,
the relevant Supabase Management API auth-config field for this specific
template is:

```
mailer_templates_confirmation_content
```

(PATCH `https://api.supabase.com/v1/projects/{ref}/config/auth` with that
field set to the corrected HTML body above, authenticated with a Management
API personal access token — see
https://supabase.com/docs/reference/api/introduction for the current PATCH
config auth endpoint shape.) **This is the path the fix was actually applied
through on 2026-07-23** — with explicit founder approval during the 46-08
Task 2 checkpoint, followed by a GET re-read confirming the field, and the
live fresh-email desktop verification required by that checkpoint. The
sibling field for the already-fixed template is
`mailer_templates_magiclink_content`.
