---
phase: 46-white-label-quotes
plan: 02
subsystem: auth
tags: [supabase, auth, tauri, otp, vite, github-actions]

requires:
  - phase: 43-pro-backend
    provides: Supabase auth client (web-only), signInWithEmail magic-link flow, T-43-09 localStorage session disposition
provides:
  - Desktop-capable Supabase client (real client when env vars present, graceful null when absent)
  - verifyEmailCode(email, code) action on useProAuth, calling supabase.auth.verifyOtp({ email, token, type: 'email' })
  - SignInModal 6-digit OTP code-entry step (works on both web and desktop, not __IS_TAURI__-branched)
  - Tauri CSP connect-src scoped to https://*.supabase.co
  - release.yml CI env wiring for VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY on both build steps
  - Live-verified production Supabase Magic Link template now includes {{ .Token }} (desktop code delivery proven working end-to-end for send)
  - scripts/verify-otp-roundtrip.mjs diagnostic (send/verify against production project)
affects: [46-04-white-label-pdf, 46-06-branding-ui, v2.0-launch-checklist]

tech-stack:
  added: []
  patterns:
    - "Desktop Pro auth reuses the exact same env-var-gated null-degradation pattern as web (PRO-01 free floor) — no platform branch in the auth client construction"
    - "OTP code-entry is additive to the existing magic-link flow, not a parallel system — same signInWithEmail dispatch, same 'link-sent' status now doubles as 'code-sent'"

key-files:
  created:
    - scripts/verify-otp-roundtrip.mjs
  modified:
    - src/lib/supabaseClient.ts
    - src/lib/supabaseClient.test.ts
    - src/hooks/useProAuth.ts
    - src/hooks/useProAuth.test.tsx
    - src/components/pro/SignInModal.tsx
    - src/App.tsx
    - src/components/UserProfileModal.tsx
    - src-tauri/tauri.conf.json
    - .github/workflows/release.yml
    - docs/PRO-SECURITY-REVIEW.md

key-decisions:
  - "Desktop Supabase client un-gating reverses Phase 43's D-12 web-first scoping per this phase's D-08 decision — same env-var-only construction as web, no platform branch"
  - "OTP verifyEmailCode is additive to signInWithEmail's existing 'link-sent' status (doubles as 'code-sent') rather than introducing a new ProAuthStatus value"
  - "Rule 2 fix: removed stale !__IS_TAURI__ gates in App.tsx (SignInModal mount) and UserProfileModal.tsx (Account & Pro section) left over from Phase 43 D-12 — without this the new desktop OTP code was unreachable via any UI. BillingPanel and ShareQuoteButton deliberately KEEP their own __IS_TAURI__ self-gates (billing management + hosted-quote publishing stay web-only per this plan's documented narrower D-08 scope)"
  - "Checkpoint (Task 3) resolved 'approved with deferrals' by the founder — see Checkpoint Resolution below for the full live-verification record"
  - "Production Supabase Magic Link email template was missing {{ .Token }} entirely (only {{ .ConfirmationURL }}) — fixed live in the dashboard during this checkpoint; this was the single highest-uncertainty item flagged in 46-RESEARCH.md Pitfall 2, now resolved"
  - "GitHub Actions repo secrets VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY were missing entirely (only DISCORD_RELEASE_WEBHOOK existed) — added live via gh secret set during this checkpoint, confirmed via gh secret list"
  - "v2.0 Launch-Day Checklist (docs/PRO-SECURITY-REVIEW.md Part 5) gained item 10: custom SMTP setup for Supabase Auth email, discovered live when production hit the built-in SMTP service's hourly rate cap mid-verification"

patterns-established:
  - "Any future desktop-reachable Supabase auth surface should mirror this plan's pattern: construct via the same env-var gate as web, never branch platform logic inside the auth client itself"

requirements-completed: [D-08]

coverage:
  - id: D1
    description: "Desktop constructs a real Supabase client when VITE_SUPABASE_URL/ANON_KEY are present; still degrades to null gracefully when absent (free floor)"
    requirement: "D-08"
    verification:
      - kind: unit
        ref: "src/lib/supabaseClient.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "verifyEmailCode exchanges a 6-digit email OTP code for a session via supabase.auth.verifyOtp({ email, token, type: 'email' }); no-op when supabase client is null"
    requirement: "D-08"
    verification:
      - kind: unit
        ref: "src/hooks/useProAuth.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tauri CSP connect-src is scoped exactly to https://*.supabase.co (no broader wildcard)"
    verification:
      - kind: automated_ui
        ref: "node -e assertion against src-tauri/tauri.conf.json (Task 1 verify step)"
        status: pass
    human_judgment: false
  - id: D4
    description: "release.yml CI injects VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY into both the frontend-build step and the tauri-action step so the desktop bundle can construct a real client"
    verification:
      - kind: manual_procedural
        ref: "gh secret list confirmed both secrets exist in the repo (2026-07-22T22:23Z); release.yml env wiring reviewed"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live production round trip: signInWithOtp against the production Supabase project succeeds and the email actually delivers a 6-digit code (Magic Link template now includes {{ .Token }})"
    verification:
      - kind: manual_procedural
        ref: "Live checkpoint verification 2026-07-22 — auth logs show mail.send via built-in SMTP; user received the email at marcusjdickinson@gmail.com"
        status: pass
    human_judgment: true
    rationale: "Requires reading a live delivered email and confirming template content in the Supabase dashboard — cannot be automated"
  - id: D6
    description: "Full 6-digit-code round-trip through verifyOtp (send code -> type code -> session established), through the actual desktop SignInModal UI, session persistence across desktop app relaunch, and signed-out desktop network silence"
    verification: []
    human_judgment: true
    rationale: "Deferred to Phase UAT per founder decision — the send half of the round trip is proven live (D5), but the final verifyOtp exchange is pending a built-in-SMTP hourly rate-limit reset; the desktop-UI-specific checks (relaunch persistence, WebView localStorage, signed-out network silence) require a real desktop build session and were explicitly deferred by the founder rather than blocking this plan's closure"

duration: ~35min (across two sessions: initial execution + checkpoint resolution)
completed: 2026-07-22
status: complete
---

# Phase 46 Plan 2: Desktop Supabase OTP Auth Summary

**Desktop Tauri app can now construct a real Supabase client and exchange an emailed 6-digit code for a persisted Pro session via `verifyOtp` — reversing Phase 43's web-only D-12 scoping per this phase's D-08 decision, with the production Magic Link template gap (missing `{{ .Token }}`) found and fixed live during checkpoint verification.**

## Performance

- **Duration:** ~35 min (Tasks 1-2 execution + checkpoint live verification)
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify, resolved "approved with deferrals")
- **Files modified:** 9 code/config files + 1 diagnostic script + 1 doc update

## Accomplishments
- Removed the `if (IS_TAURI) return null` gate in `supabaseClient.ts` — desktop now constructs a real Supabase client under the exact same env-var-presence gate as web (graceful null degradation preserved when unconfigured — PRO-01 free floor)
- Added `https://*.supabase.co` to Tauri's CSP `connect-src`, scoped exactly (T-46-03)
- Wired `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` into both the frontend-build step and the tauri-action step of `release.yml`
- Added `verifyEmailCode(email, code)` to `useProAuth`, calling `supabase.auth.verifyOtp({ email, token: code, type: 'email' })`, TDD RED→GREEN
- Added a 6-digit OTP code-entry step to `SignInModal`, reusing the existing 'link-sent' status (now doubles as 'code-sent'); not branched on `__IS_TAURI__` — same flow serves both platforms
- **Live checkpoint verification found and fixed the phase's single highest-uncertainty item (RESEARCH Pitfall 2):** the production Magic Link email template only rendered `{{ .ConfirmationURL }}`, never `{{ .Token }}` — meaning the desktop OTP code path could never have worked until this was fixed
- **Live checkpoint verification also found and fixed the CI infra gap (RESEARCH Pitfall 3):** GitHub Actions repo secrets for `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` did not exist — added live

## Task Commits

Each task was committed atomically:

1. **Task 1: Un-gate the Supabase client on desktop + wire desktop build infra** - `816a307` (feat)
2. **Task 2: Add verifyOtp code-entry path to useProAuth + SignInModal OTP step** - `7818b00` (feat, TDD RED→GREEN in one commit)
3. **Task 3: Live desktop OTP round-trip + infra verification (checkpoint)** - resolved "approved with deferrals" (no code commit; see Checkpoint Resolution below); diagnostic script + launch-checklist doc update committed as `43cf989` (chore)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/lib/supabaseClient.ts` - Removed desktop null-gate; module doc comment updated to reflect D-08 reversing Phase 43 D-12
- `src/lib/supabaseClient.test.ts` - Updated for desktop-constructs-a-real-client behavior + desktop-unconfigured-degrades-to-null case
- `src-tauri/tauri.conf.json` - CSP `connect-src` gained `https://*.supabase.co`
- `.github/workflows/release.yml` - `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` env added to frontend-build and tauri-action steps
- `src/hooks/useProAuth.ts` - Added `verifyEmailCode(email, code)` action
- `src/hooks/useProAuth.test.tsx` - TDD tests for `verifyEmailCode` call shape + no-op-when-null
- `src/components/pro/SignInModal.tsx` - 6-digit code input + "Verify code" step after email dispatch
- `src/App.tsx` - Rule 2 fix: removed stale `!__IS_TAURI__` gate on SignInModal mount
- `src/components/UserProfileModal.tsx` - Rule 2 fix: removed stale `!__IS_TAURI__` gate on Account & Pro section
- `scripts/verify-otp-roundtrip.mjs` - Diagnostic CLI (send/verify modes) for proving the live production OTP round trip; used during checkpoint verification and left in the repo for the deferred final round-trip retry and future regressions
- `docs/PRO-SECURITY-REVIEW.md` - Part 5 launch-day checklist gained item 10 (custom SMTP setup)

## Decisions Made
- Desktop Supabase client un-gating reverses Phase 43 D-12 (web-first scoping) per this phase's D-08 — no platform branch in client construction, same env-var-only gate as web
- OTP `verifyEmailCode` reuses the existing `'link-sent'` status rather than adding a new `ProAuthStatus` value — the same email dispatch now doubles as "code sent"
- ShareQuoteButton's `__IS_TAURI__` gate deliberately LEFT IN PLACE — hosted-quote publishing stays web-only this phase, per the plan's documented scope decision (desktop gains sign-in + entitlement + white-label PDF only)
- BillingPanel's `__IS_TAURI__` self-gate also deliberately LEFT IN PLACE — billing management stays web-only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed stale `!__IS_TAURI__` UI gates blocking the new desktop auth code entirely**
- **Found during:** Task 2 (SignInModal OTP step)
- **Issue:** `App.tsx`'s SignInModal mount and `UserProfileModal.tsx`'s Account & Pro section (sign-in button, signed-in email, sign-out) were still gated on `!__IS_TAURI__` left over from Phase 43's D-12 web-first scoping. Without removing these, the new desktop OTP code path built in this task would have been completely unreachable from any UI — a functional dead-end, not just an incomplete feature.
- **Fix:** Removed the `!__IS_TAURI__` gates on both surfaces. `BillingPanel` and `ShareQuoteButton` keep their own independent `__IS_TAURI__` self-gates — billing management and hosted-quote publishing intentionally remain web-only per this plan's documented D-08 scope decision.
- **Files modified:** `src/App.tsx`, `src/components/UserProfileModal.tsx`
- **Verification:** Manual code review confirmed the desktop auth UI now mounts; `npm run build` passes
- **Committed in:** `7818b00` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical functionality)
**Impact on plan:** Necessary for the plan's stated purpose (desktop Pro auth reachable via UI). No scope creep — publishing/billing gates correctly preserved as web-only.

## Checkpoint Resolution (Task 3 — approved with deferrals)

The founder (with the orchestrator performing the live verification) resolved this checkpoint as **"approved with deferrals"**. Full record below, per the checkpoint resume instructions:

1. **PITFALL 2 CONFIRMED AND FIXED.** The production Supabase project's Magic Link email template (project `fqidldxuwpfvhsejalbd`, "Magic link or OTP" template) contained ONLY `{{ .ConfirmationURL }}` — no `{{ .Token }}` — so the desktop OTP code path could not have worked as originally shipped. Fixed live in the Supabase dashboard: appended `<p>Or enter this one-time sign-in code in the 3DCoster app: {{ .Token }}</p>` alongside the existing link line. Save confirmed in the dashboard UI (2026-07-22).
2. **GitHub Actions repo secrets were missing.** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` did not exist (only `DISCORD_RELEASE_WEBHOOK` existed). Both added via `gh secret set` and confirmed via `gh secret list` (2026-07-22T22:23Z). `release.yml`'s env wiring from Task 1 now has real values to inject on the next tagged desktop build.
3. **Live send + delivery proven.** `signInWithOtp` against the production project succeeded (auth logs show `mail.send` via built-in SMTP; the user received the emails at marcusjdickinson@gmail.com). The final 6-digit-code → `verifyOtp` round trip is **PENDING** a built-in-SMTP hourly rate-limit reset (~23:16Z); a background retry was scheduled by the orchestrator, result to be reported separately. Diagnostic script `scripts/verify-otp-roundtrip.mjs` was written for this and is committed to the repo (usage: `send <email>` / `verify <email> <code>` modes).
4. **Deferred to Phase UAT (founder decision)** — NOT blocking this plan's closure:
   (a) Full 6-digit-code round trip through the actual desktop `SignInModal` UI (as opposed to the CLI diagnostic)
   (b) Desktop session persistence across app relaunch (WebView localStorage)
   (c) Signed-out desktop network silence (free-floor guarantee)
5. **Side effects recorded.** A Supabase auth user was created for marcusjdickinson@gmail.com (`id 436d1d60-2169-4dc5-a92e-79b6cb6f8f0c`) during verification; the first (signup-confirmation) email's link was consumed at 20:50:44Z.
6. **Launch-checklist note added.** The project currently uses Supabase's built-in email service, which has a hard hourly send cap and a dashboard banner stating it is not meant for production. Custom SMTP setup has been added as item 10 to the v2.0 Launch-Day Checklist in `docs/PRO-SECURITY-REVIEW.md` Part 5, discovered live when this exact rate cap was hit mid-verification.

## Issues Encountered
- Production Magic Link email template gap (Pitfall 2) — resolved live, see Checkpoint Resolution item 1
- Missing GitHub Actions secrets (Pitfall 3) — resolved live, see Checkpoint Resolution item 2
- Built-in SMTP hourly rate-limit hit mid-verification, preventing the final code-verify half of the live round trip within this session — deferred, see Checkpoint Resolution items 3-4

## Known Stubs / Deferred Verification

The following are explicitly **deferred to Phase UAT**, not stubs in the shipped code — the code paths exist and are unit-tested, but their live desktop behavior has not yet been end-to-end confirmed on a real desktop build:

- Full 6-digit-code round trip through the actual desktop `SignInModal` UI
- Desktop session persistence across app relaunch (WebView localStorage)
- Signed-out desktop network silence (free-floor guarantee)

These should be surfaced as `human_verification` items by `gsd-verify-work` for Phase 46 (see coverage `D6` above).

## User Setup Required

None remaining for this plan — the two `user_setup` items in the plan frontmatter (GitHub Actions secrets, Supabase email template dual-variable fix) were BOTH completed live during the Task 3 checkpoint (see Checkpoint Resolution items 1-2 above).

One new operator action was added to the v2.0 Launch-Day Checklist as a result of this checkpoint: custom SMTP setup for Supabase Auth email (`docs/PRO-SECURITY-REVIEW.md` Part 5, item 10).

## Next Phase Readiness
- `isProStatus`/entitlement resolution and the desktop OTP auth path are now reachable on desktop, unblocking 46-04 (white-label PDF) and 46-06 (branding UI), both of which need `isProStatus` to resolve on desktop.
- The deferred UAT items (D6 above) do not block downstream plans — they are Pro-auth-surface polish/confirmation items, not missing functionality — but should be closed out before the v2.0 launch checklist is signed off.
- ShareQuoteButton and BillingPanel remain correctly web-only; no accidental desktop publishing/billing surface was introduced.

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-22*

## Self-Check: PASSED

All key files verified present on disk; all referenced commits (`816a307`, `7818b00`, `43cf989`, `72b3461`) verified present in git log.
