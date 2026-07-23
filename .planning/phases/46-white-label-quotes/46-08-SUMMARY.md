---
phase: 46-white-label-quotes
plan: 08
subsystem: auth
tags: [supabase, gotrue, otp, email-templates, tauri, pkce, config-as-code]

# Dependency graph
requires:
  - phase: 46-white-label-quotes
    provides: "46-02: desktop Supabase auth un-gated (D-08), OTP verifyEmailCode added to useProAuth/SignInModal, Magic Link template fixed live"
provides:
  - "Both production Supabase auth email templates ('Magic link or OTP' and 'Confirm signup') captured as config-as-code in docs/SUPABASE-EMAIL-TEMPLATES.md, with byte-for-byte API-read bodies"
  - "Production 'Confirm signup' template live-fixed to include {{ .Token }}, closing the new-user desktop sign-in dead end (G-46-2)"
  - "supabase/config.toml [auth.email] annotated with production-reality notes (otp_length, enable_confirmations) so config-as-code drift is visible in review"
  - "Launch-Day Checklist item 11 ('Confirm signup email template') added to docs/PRO-SECURITY-REVIEW.md Part 5"
affects: [46-09, 51-launch-prep-redux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase auth email template config-as-code capture (docs/SUPABASE-EMAIL-TEMPLATES.md), read byte-for-byte via the Management API GET before any doc claims a production body"
    - "Founder-approved Management API PATCH as an accepted alternate application path to the Supabase dashboard for auth-config changes, when explicitly authorized during a blocking checkpoint"

key-files:
  created:
    - docs/SUPABASE-EMAIL-TEMPLATES.md
  modified:
    - docs/PRO-SECURITY-REVIEW.md
    - supabase/config.toml
    - .planning/STATE.md

key-decisions:
  - "Confirm-signup template fix applied via the Supabase Management API (PATCH /v1/projects/fqidldxuwpfvhsejalbd/config/auth, field mailer_templates_confirmation_content) rather than the dashboard UI — orchestrator applied it with explicit founder approval ('Apply it for me') during the Task 2 checkpoint; a GET re-read confirmed the applied body byte-for-byte before live verification proceeded."
  - "docs/SUPABASE-EMAIL-TEMPLATES.md corrected from secondhand-reconstructed template bodies to authoritative byte-for-byte API reads — the live production 'Confirm signup' stock body differed from the doc's reconstruction (actual: '<h2>Confirm your email address</h2>...Follow the link below...' vs the reconstructed '<h2>Confirm your signup</h2>...'); both templates' bodies replaced with the API-read text (commit 2689f02)."

requirements-completed: [D-08]

coverage:
  - id: D1
    description: "docs/SUPABASE-EMAIL-TEMPLATES.md captures both production auth email templates (Magic Link + Confirm Signup) as config-as-code, with the corrected Confirm-signup body prepared"
    requirement: "D-08"
    verification:
      - kind: unit
        ref: "automated verify gate: test -f docs/SUPABASE-EMAIL-TEMPLATES.md && grep -q 'Token' ... && grep -qi 'confirm signup' ... && grep -qi 'magic link' ... && grep -qi 'confirm signup email template' docs/PRO-SECURITY-REVIEW.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "supabase/config.toml [auth.email] annotated with production-reality notes (no local-dev value changes)"
    requirement: "D-08"
    verification:
      - kind: other
        ref: "manual diff review of supabase/config.toml in commit b4973db"
        status: pass
    human_judgment: false
  - id: D3
    description: "Production 'Confirm signup' Supabase email template patched live to include {{ .Token }}, applied via Management API with founder approval, and byte-for-byte GET-confirmed"
    requirement: "D-08"
    verification:
      - kind: manual_procedural
        ref: "founder approval ('Apply it for me') + orchestrator Management API PATCH + GET re-read confirmation, 2026-07-23"
        status: pass
    human_judgment: true
    rationale: "Live production auth-config mutation and content verification — cannot be exercised by any local test; requires the actual Supabase project and a human authorization decision to apply."
  - id: D4
    description: "Fresh, never-before-seen email completes desktop sign-in from an emailed one-time code (no link-only dead end) and the session survives a full app relaunch (UAT test 2 re-verified as written)"
    requirement: "D-08"
    verification:
      - kind: manual_procedural
        ref: "founder live round-trip on desktop (npm run tauri dev): fresh email -> code received -> code entered -> signed in -> quit+relaunch -> still signed in. Founder typed 'approved'."
        status: pass
    human_judgment: true
    rationale: "Depends on live email delivery, a real production auth config, and human judgment of the end-to-end desktop experience — this is precisely what the blocking checkpoint exists to gate, and cannot be automated or unit-tested."

# Metrics
duration: ~65min (Task 1 ~10min same-session + checkpoint pause + orchestrator-applied fix/verification + this continuation's tracking wrap-up)
completed: 2026-07-23
status: complete
---

# Phase 46 Plan 08: Confirm-signup email template fix (G-46-2) Summary

**Production "Confirm signup" Supabase email template patched live via the Management API (founder-approved) to add `{{ .Token }}`, closing the new-desktop-user sign-in dead end; both auth email templates now captured byte-for-byte as config-as-code in docs/SUPABASE-EMAIL-TEMPLATES.md.**

## Performance

- **Duration:** ~65 min total across the original session + this continuation
- **Tasks:** 2 (Task 1 auto, Task 2 checkpoint:human-verify — both complete)
- **Files modified:** 4 (docs/SUPABASE-EMAIL-TEMPLATES.md created; docs/PRO-SECURITY-REVIEW.md, supabase/config.toml, .planning/STATE.md modified)

## Accomplishments

- Created `docs/SUPABASE-EMAIL-TEMPLATES.md`, the authoritative config-as-code capture of BOTH production Supabase auth email templates (`fqidldxuwpfvhsejalbd`), preventing the exact silent-drift failure mode that let the 46-02 Magic Link fix ship without its sibling "Confirm signup" template being fixed at the same time.
- Annotated `supabase/config.toml [auth.email]` with production-reality notes on `enable_confirmations`/`otp_length` (local dev values left untouched — annotations only).
- Added Launch-Day Checklist item 11 ("Confirm signup email template") to `docs/PRO-SECURITY-REVIEW.md` Part 5.
- **Applied the live production fix**: patched the "Confirm signup" template via the Supabase Management API (`PATCH /v1/projects/fqidldxuwpfvhsejalbd/config/auth`, field `mailer_templates_confirmation_content`) with explicit founder approval during the Task 2 checkpoint, then confirmed the applied body byte-for-byte via a GET re-read.
- **Corrected the doc itself**: the live GET revealed the production stock "Confirm signup" body differed from the doc's earlier secondhand reconstruction (different heading/copy: actual `<h2>Confirm your email address</h2>...` vs. reconstructed `<h2>Confirm your signup</h2>...`). Both templates' bodies in `docs/SUPABASE-EMAIL-TEMPLATES.md` were replaced with the authoritative byte-for-byte API-read text (commit `2689f02`) — closing the exact drift risk the document exists to prevent.
- **Live-verified by the founder**: a fresh, never-before-used email address completed a full desktop sign-in (`npm run tauri dev`) — the email arrived with a one-time code (not link-only), the code was entered in `SignInModal` and exchanged successfully, and the session survived a full quit + relaunch (UAT test 2 re-verified as written). Founder responded "approved".

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture corrected Confirm-signup template as config-as-code + align config.toml + add launch-checklist item** - `b4973db` (docs)
2. **STATE.md checkpoint bookkeeping** - `f5898ca` (docs)
3. **(post-checkpoint) Doc corrected to byte-for-byte API-read template bodies** - `2689f02` (docs)

**Plan metadata:** (this commit) `docs(46-08): complete Confirm-signup email template fix plan`

_Task 2 (checkpoint:human-verify) required no code commit — it is a live production-config application + human-verified round trip, recorded here and in docs/SUPABASE-EMAIL-TEMPLATES.md._

## Files Created/Modified

- `docs/SUPABASE-EMAIL-TEMPLATES.md` - Config-as-code capture of both production auth email templates, now with byte-for-byte API-read bodies and the live-fix/checkpoint-resolution record
- `docs/PRO-SECURITY-REVIEW.md` - Launch-Day Checklist item 11 added (Confirm signup email template)
- `supabase/config.toml` - `[auth.email]` production-reality annotations (no local dev value changes)
- `.planning/STATE.md` - Checkpoint bookkeeping, now cleared as part of this continuation

## Decisions Made

- **Management API applied, not the dashboard.** The plan's Task 2 named the Supabase dashboard as the primary application path (with the Management API noted as an "optional automation" for a future operator). In practice, the orchestrator applied the fix via the Management API (`PATCH .../config/auth`, field `mailer_templates_confirmation_content`) with the founder's explicit approval ("Apply it for me") rather than the founder editing the dashboard by hand. A GET re-read confirmed the applied body byte-for-byte before live verification proceeded. This fulfills the plan's intent (a human-authorized, verified production template fix) via the alternate path the plan's own doc already named as legitimate — not a scope deviation requiring Rule 4, since the doc explicitly anticipated this path.
- **Doc corrected from reconstruction to byte-for-byte API read.** The live GET showed the actual production "Confirm signup" stock template differed from what `docs/SUPABASE-EMAIL-TEMPLATES.md` had reconstructed from secondhand evidence (heading and body copy both differed). Both templates in the doc were replaced with authoritative byte-for-byte bodies (commit `2689f02`), including the Magic Link template which had drifted from its own earlier reconstruction too. This is itself an instance of the exact problem the document was created to prevent, caught and fixed within the same plan.

## Checkpoint Resolution

**Type:** human-verify (gate: blocking)
**Resolution:** Approved

1. The production "Confirm signup" template fix was applied 2026-07-23 via the Supabase Management API (`PATCH /v1/projects/fqidldxuwpfvhsejalbd/config/auth`, field `mailer_templates_confirmation_content`) by the orchestrator with explicit founder approval (AskUserQuestion: "Apply it for me"), not manually via the dashboard. A GET re-read confirmed the applied body byte-for-byte.
2. The live production body BEFORE the fix differed from the doc's earlier reconstruction (actual stock template: `<h2>Confirm your email address</h2>...Follow the link below...` vs. the reconstructed `<h2>Confirm your signup</h2>...`). `docs/SUPABASE-EMAIL-TEMPLATES.md` was corrected to the authoritative byte-for-byte API-read bodies in commit `2689f02` (both templates — the Magic Link body had also drifted from its reconstruction).
3. Founder live-verified per the checkpoint's how-to-verify: fresh-email desktop sign-in received a one-time 8-digit code, code entry signed in successfully, and the session survived a full quit + relaunch (UAT test 2 re-verified as written). Founder typed "approved".
4. **Post-verification finding (context, not a gap):** the founder's test email (`waarangel@gmail.com`) showed Pro chrome because `scripts/seed-pro-entitlement-uat.sql` had seeded a temporary `pro`/`active` entitlement for that address (expires 2026-08-22) — NOT because sign-in grants Pro. Entitlement gating confirmed correct: production DB shows only the two seeded users have entitlements rows; `isPro` derives solely from the `entitlements` table written by the Paddle webhook.

**Reminder:** `scripts/seed-pro-entitlement-uat.sql`-seeded rows must be deleted before real billing tests or launch, to avoid a stray non-paying account showing Pro chrome.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected drifted reconstructed template bodies to byte-for-byte API reads**
- **Found during:** Post-checkpoint verification of the applied fix (between Task 1 and the checkpoint resolution)
- **Issue:** `docs/SUPABASE-EMAIL-TEMPLATES.md`'s original bodies for both templates were reconstructed from secondhand evidence (no API read path had been wired up when Task 1 was first written); a live Management API GET showed the actual production "Confirm signup" stock body used different heading/copy than the doc claimed, and the Magic Link body had similarly drifted.
- **Fix:** Replaced both templates' bodies in the doc with the authoritative byte-for-byte API-read text (`GET https://api.supabase.com/v1/projects/{ref}/config/auth`, fields `mailer_templates_magiclink_content` / `mailer_templates_confirmation_content`).
- **Files modified:** `docs/SUPABASE-EMAIL-TEMPLATES.md`
- **Verification:** GET re-read after the PATCH confirmed the corrected body matches what was applied to production, byte-for-byte.
- **Committed in:** `2689f02`

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug/drift correction)
**Impact on plan:** Necessary correctness fix to the doc's core claim (this is a config-as-code drift-prevention document; it cannot itself carry incorrect bodies). No scope creep — same two templates, same files.

## Issues Encountered

None beyond the doc-drift correction documented above.

## User Setup Required

None - no external service configuration required beyond the Management API application already completed and founder-approved during this plan's checkpoint.

## Next Phase Readiness

- G-46-2 is closed: new desktop users can complete sign-in from a single emailed code, matching existing-user behavior.
- Plan 46-09 (client-side `shouldCreateUser`/copy hardening for G-46-2, per the plan's own scope note) is unblocked and can proceed independently — it touches `src/`, this plan deliberately did not.
- Reminder carried forward: delete `scripts/seed-pro-entitlement-uat.sql`-seeded entitlement rows before real billing/launch testing.

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-23*
