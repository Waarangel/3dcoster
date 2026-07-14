---
phase: 43-pro-backend
plan: 03
subsystem: auth
tags: [supabase, supabase-js, magic-link, pkce, auth, playwright, free-floor]

# Dependency graph
requires:
  - phase: 43-pro-backend
    plan: 01
    provides: "Live Supabase project fqidldxuwpfvhsejalbd (eu-central-1) with RLS-locked schema the anon key authenticates against"
  - phase: 43-pro-backend
    plan: 02
    provides: "vercel.json CSP connect-src allowlisting https://*.supabase.co so client auth calls are not blocked"
provides:
  - "supabase client singleton (src/lib/supabaseClient.ts) — null under __IS_TAURI__ and when env config is absent; PKCE + persisted localStorage session"
  - "useProAuth() hook returning { session, user, isSignedIn, status, signInWithEmail(email), signOut() } — no-op-safe when client is null"
  - "SignInModal (contextual magic-link dialog, D-09) opened from the profile panel"
  - "Account & Pro section in UserProfileModal with the BillingPanel mount slot for 43-06"
  - "e2e/free-floor-no-network.spec.ts — automated PRO-01 boundary guarantee (zero Supabase requests signed-out)"
  - ".env.example documenting VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY; .gitignore now excludes .env"
affects: [43-04-publish, 43-05-hosted-page, 43-06-billing-email, 43-07-verification]

# Tech tracking
tech-stack:
  added: ["@supabase/supabase-js v2.110.5 (human-approved package-legitimacy gate)"]
  patterns:
    - "Web-only client gate: singleton is null under __IS_TAURI__ (typeof-guarded so the module is import-safe under Vitest where the define does not exist); every call site guards on null"
    - "Missing-env degrade: unconfigured web build gets a console.warn + null client, never a module-load throw — the free floor must not depend on backend config (PRO-01)"
    - "Auth state via onAuthStateChange subscription with effect cleanup; getSession() seeds the persisted session on mount (both localStorage-only, zero network signed-out)"

key-files:
  created:
    - src/lib/supabaseClient.ts
    - src/lib/supabaseClient.test.ts
    - src/hooks/useProAuth.ts
    - src/hooks/useProAuth.test.tsx
    - src/components/pro/SignInModal.tsx
    - e2e/free-floor-no-network.spec.ts
    - .env.example
  modified:
    - src/App.tsx
    - src/components/UserProfileModal.tsx
    - .gitignore
    - package.json
    - package-lock.json

key-decisions:
  - "T-43-09 ACCEPTED (recorded per plan): supabase-js session lives in localStorage — a pure SPA has no httpOnly-cookie path; the strict CSP (script-src 'self', vercel.json) is the compensating XSS control. Revisit only if an SSR/auth-helper layer lands."
  - "supabaseClient degrades to null (console.warn) when VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are absent instead of throwing at module load — Rule 2 missing-critical-functionality: the free floor must survive an unconfigured deploy."
  - "flowType 'pkce' set EXPLICITLY (with detectSessionInUrl + persistSession + autoRefreshToken) rather than relying on library defaults, so the magic-link flow is pinned regardless of supabase-js default drift."
  - "SignInModal REPLACES the profile panel rather than stacking a second dialog (App.tsx closes showProfileModal before opening showSignInModal) — cleaner than nested dialogs, same D-09 contextual entry."
  - "useProAuth test file is .tsx (plan verify command said .ts) — it mounts a JSX Probe component via the project's createRoot+act harness (no @testing-library/react in this repo)."

requirements-completed: [PRO-01]

coverage:
  - id: D1
    description: "supabase singleton is null under __IS_TAURI__ and constructs a PKCE web client when configured; missing env degrades to null+warn"
    requirement: "PRO-01"
    verification:
      - kind: unit
        ref: "src/lib/supabaseClient.test.ts (3 tests — both define branches + missing-env degrade)"
        status: pass
    human_judgment: false
  - id: D2
    description: "useProAuth wraps signInWithOtp (emailRedirectTo origin+/app) / onAuthStateChange (unsubscribed in cleanup) / signOut; all no-op when client is null"
    requirement: "PRO-01"
    verification:
      - kind: unit
        ref: "src/hooks/useProAuth.test.tsx (7 tests — unavailable no-ops, persisted-session seed, auth-change transitions, link-sent/error paths, signOut, unmount unsubscribe)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Free floor makes ZERO requests to any *.supabase.co origin during a full signed-out load + wizard printer add + enter values + save-job flow (PRO-01 hard boundary)"
    requirement: "PRO-01"
    verification:
      - kind: e2e
        ref: "e2e/free-floor-no-network.spec.ts (route-abort + request capture, built app on :4173 with real env baked in — client IS constructed, still silent)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Desktop (Tauri) renders no Pro/auth UI: SignInModal mount and the UserProfileModal Account section are both gated !__IS_TAURI__; client null-gate unit-tested"
    requirement: "PRO-01"
    verification:
      - kind: unit
        ref: "src/lib/supabaseClient.test.ts Tauri branch; compile-time JSX gates in App.tsx + UserProfileModal.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live magic-link round trip: request link on a preview deploy, click it, confirm SIGNED_IN and a persisted session on reload (operator step — needs a real inbox + deployed redirect URL allow-list)"
    requirement: "PRO-01"
    verification: []
    human_judgment: true
    rationale: "Requires a real email inbox and the Supabase Auth URL allow-list configured for the deploy origin; named as the Manual operator step in the plan's own <verification> section. Carried to the 43-07 verification gate / v2.0 launch checklist."

patterns-established:
  - "Pro feature surfaces attach to existing chrome (profile panel), never new signed-out chrome (D-09); all Pro UI gated !__IS_TAURI__ (D-12)"
  - "Any new backend-touching code path must keep e2e/free-floor-no-network.spec.ts green — it is the enforcement for PRO-01's boundary"

duration: ~35min (including the blocking package-legitimacy checkpoint round-trip)
completed: 2026-07-14
status: complete
---

# Phase 43 Plan 03: Web-Only Supabase Client + Magic-Link Auth Summary

**Magic-link Pro auth (supabase-js v2.110.5, PKCE) behind a Tauri-compiled-out null-gate singleton, a contextual SignInModal in the profile area (D-09), and a Playwright proof that the signed-out free floor makes zero Supabase-origin requests (PRO-01).**

## Performance

- **Duration:** ~35 min total (checkpoint pause included; execution ~25 min)
- **Tasks:** 1 blocking-human checkpoint (package legitimacy — approved) + 2 auto
- **Files modified:** 7 created, 5 modified

## Accomplishments

- Installed `@supabase/supabase-js` v2.110.5 after the mandatory human package-legitimacy gate (official `supabase` org, repo github.com/supabase/supabase-js, exact scoped name — user replied "approved").
- `src/lib/supabaseClient.ts`: singleton that is `null` under `__IS_TAURI__` (D-12 — the createClient branch is statically dead code in desktop builds) AND when env config is missing (unconfigured web deploy degrades to "Pro disabled", never a crash). Web client pins `flowType: 'pkce'`, `detectSessionInUrl`, `persistSession`, `autoRefreshToken`.
- `src/hooks/useProAuth.ts`: `{ session, user, isSignedIn, status, signInWithEmail, signOut }` — `signInWithOtp` with `emailRedirectTo: origin + '/app'`, `onAuthStateChange` subscription cleaned up on unmount, persisted-session seed via `getSession()`. Every method early-returns when the client is null, so the hook is safe to call unconditionally (UserProfileModal calls it on desktop too).
- `SignInModal` (shared Modal/Input/Button kit + useToast, every control labelled): collects email, disables the CTA until it plausibly is one, shows "Magic link sent — check your email" on success and the Supabase error message on failure.
- `UserProfileModal` Account & Pro section (D-09): signed-out → explainer + "Sign in for Pro"; signed-in → account email + Sign out + an intentionally-empty comment-marked slot where plan 43-06 mounts `BillingPanel`. Whole section (and the App-level SignInModal mount) gated `!__IS_TAURI__`.
- `e2e/free-floor-no-network.spec.ts`: full signed-out flow against the built app (real env baked in, so the supabase client IS constructed) — onboarding-wizard printer add, print name + filament + grams, save job, toast confirm — with both a route-abort block and a request capture on `*.supabase.co`. Zero requests observed. This is the automated PRO-01 boundary.
- Full gate green: 1179 vitest tests across 101 files, `tsc -b`, `lint:no-raw-html`, main chunk 95.8 KB gz (supabase-js routed to the ungated `vendor` chunk by the existing manualChunks node_modules rule), both Playwright specs pass.

## Task Commits

1. **Checkpoint: @supabase/supabase-js legitimacy** — no commit (human gate; approved with v2.110.5 verified against the npm registry)
2. **Task 1: Client singleton + useProAuth hook** - `5ea4294` (feat)
3. **Task 2: SignInModal + account surface + no-network E2E** - `995cabd` (feat)

**Plan metadata:** committed alongside this SUMMARY (final commit)

## For Plan 43-06 (BillingPanel)

- **Mount point:** `UserProfileModal.tsx`, signed-in branch of the Account & Pro section — comment-marked slot directly under the email + Sign out row.
- **Auth shape to consume:** `useProAuth()` → `{ session, user, isSignedIn, status, signInWithEmail(email), signOut() }`; `status` is `'unavailable' | 'signed-out' | 'sending-link' | 'link-sent' | 'signed-in'`. `session.access_token` is the JWT for entitlement RPCs.
- **Session storage disposition (T-43-09, accepted):** localStorage via supabase-js default; strict CSP is the compensating control — do not re-litigate per-plan.
- **Email note:** magic links currently go through Supabase's built-in email service (rate limit ~a few emails/hour) until 43-06 wires Resend SMTP.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added `.env` ignore rules to `.gitignore`**
- **Found during:** Task 1 (creating `.env.example` / local `.env`)
- **Issue:** The repo had NO env-file ignore rule — the plan's own user_setup flow produces a local `.env`, which would have been silently commitable.
- **Fix:** `.env` / `.env.*` / `!.env.example` block added to `.gitignore`; verified via `git check-ignore`.
- **Files modified:** `.gitignore`
- **Commit:** `5ea4294`

**2. [Rule 2 - Missing critical functionality] Missing-env degrade in supabaseClient**
- **Found during:** Task 1
- **Issue:** The plan's literal `createClient(import.meta.env.VITE_SUPABASE_URL, ...)` throws at module-load time when env vars are absent (CI, fresh clones, misconfigured deploys) — taking the entire free-floor app down with it, which directly violates PRO-01's "free floor never depends on the backend".
- **Fix:** Guard both vars; return `null` + one `console.warn`. Unit-tested.
- **Files modified:** `src/lib/supabaseClient.ts`
- **Commit:** `5ea4294`

### Minor implementation notes (not deviations)

- `useProAuth` test file is `.tsx` (plan's verify command said `.ts`) — it mounts a JSX Probe component using the project's createRoot+act harness.
- `__IS_TAURI__` is read via a `typeof` guard in supabaseClient (module-level evaluation must not throw under Vitest, where the Vite define doesn't exist); esbuild's define replacement still constant-folds it in real builds. Component JSX gates use the bare `__IS_TAURI__` reference, matching the existing App.tsx pattern.
- E2E flow adds a printer via the onboarding wizard's step-0 tile before saving (saving a job requires an owned printer instance — the plan's "open calculator, enter values, save a job" implicitly needs one; the wizard tile is the natural new-user path).

## Issues Encountered

- First E2E run failed on the filament dropdown locator: the trigger's accessible name is "Filament" (aria-labelledby overrides the visible "Select filament..." text). Fixed the locator, not the component.
- Second run surfaced the owned-printer requirement for saving (above). Both were test-script fixes; no app code changed in response.

## User Setup Required

Operator steps still open (carried from the plan frontmatter / verification):
1. **Supabase Auth URL configuration:** Dashboard → Authentication → URL Configuration — add `https://3dcoster.com/app` (and Vercel preview URLs) to the redirect allow-list, or magic-link clicks will bounce.
2. **Vercel env vars:** set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in the Vercel project so deployed builds construct the client (local `.env` is git-ignored and already configured).
3. **Live magic-link round trip** (coverage D5): request a link on a preview deploy, click it, confirm SIGNED_IN + persisted session on reload. Built-in Supabase email is fine for this test but rate-limits at a few emails/hour.

## Next Phase Readiness

- 43-04 (publish flow) can read `session.access_token` from `useProAuth().session` for authenticated RPC calls.
- 43-06 has its BillingPanel mount slot and the auth surface documented above.
- The free-floor boundary is now regression-guarded: any future plan that lets signed-out code touch Supabase breaks `e2e/free-floor-no-network.spec.ts`.

---
*Phase: 43-pro-backend*
*Completed: 2026-07-14*

## Self-Check: PASSED

- FOUND: all 7 created files (supabaseClient.ts/.test.ts, useProAuth.ts/.test.tsx, SignInModal.tsx, free-floor-no-network.spec.ts, .env.example)
- FOUND: commit `5ea4294` (Task 1) and `995cabd` (Task 2) in git history
- VERIFIED: `.env` git-ignored (`git check-ignore` hits .gitignore:17); local `.env` never staged
