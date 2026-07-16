---
phase: 43-pro-backend
plan: 07
subsystem: security-review
tags: [security-review, pro-03, rls, non-enumerability, csp, pwa, paddle, webhook, sign-off]

# Dependency graph
requires:
  - phase: 43-pro-backend
    plan: 01
    provides: "Live RLS-locked schema + the two SECURITY DEFINER RPCs this review probes live"
  - phase: 43-pro-backend
    plan: 02
    provides: "CSP/rewrite/SW-denylist config + scripts/verify-pro-csp.mjs static gate"
  - phase: 43-pro-backend
    plan: 04
    provides: "Publish flow (D-11/D-08 contracts) completing the reviewable attack surface"
  - phase: 43-pro-backend
    plan: 05
    provides: "Both PRO-03 security regression tests + the /q/* response contract"
  - phase: 43-pro-backend
    plan: 06
    provides: "Signature-verified Paddle webhook + its 15-spec spoofing suite"
provides:
  - "docs/PRO-SECURITY-REVIEW.md — the signed PRO-03 review record (pre-deploy scope) with live evidence per control"
  - "v2.0 Launch-Day Checklist (Part 5 of the review doc) — the authoritative list of deploy-time re-verification items for the Pro backend, joining Phase 42's live GDPR gate check"
  - "Dispositions for the three accumulated items: resend gate ordering violation (closed), webhook auth gap (open/tracked with remediation plan), deployment deferrals (moved to launch-day checklist)"
affects: [44-sync-stl, 45-brand-launch, v2.0-launch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Evidence-based security review: every control is either VERIFIED NOW (real command output pasted) or DEFERRED TO DEPLOY (named, tracked) — no unverifiable claims signed"
    - "Scoped sign-off: a pre-deploy signature is distinct from a ship-to-production signature; the launch-day checklist is the bridge between them"

key-files:
  created:
    - docs/PRO-SECURITY-REVIEW.md
  modified: []

key-decisions:
  - "Sign-off recorded at PRE-DEPLOY scope (Marcus Dickinson, 2026-07-16): verified-now evidence accepted as-is; production shipping explicitly deferred until the entire v2.0 milestone is built (deploy guard DEPLOY_OK=1 policy). This is deliberately NOT the plan's literal 'approved — ship to production' — no production deploy exists or is imminent, so signing at that scope would have been dishonest."
  - "The authoritative v2.0 Launch-Day Checklist lives in docs/PRO-SECURITY-REVIEW.md Part 5 (no dedicated checklist file existed; Phase 42's item 0 was only a reference inside 42-UAT.md, precedent commit 6eb0ea8). Any future plan adding launch-day items should append to Part 5, not create a parallel list."
  - "The 43-05 resend package-legitimacy ordering violation is CLOSED as a process finding: zero code executed before approval, package verified against the npm registry (official resend org), user retroactively approved. Recommendation recorded: blocking-human gates mean no commits until the resume signal."
  - "The notify_quote_decision() webhook auth gap is OPEN/TRACKED, non-blocking: pg_net POST carries no Authorization header while the deployed edge function has verify_jwt=true; currently inert because app.settings.functions_url is NULL. Remediation = follow-up migration adding the anon-key bearer header + setting functions_url at deploy time (launch-day checklist item 9). Functional gap (email delivery), not a security-boundary failure."

requirements-completed: [PRO-03]

coverage:
  - id: D1
    description: "Non-enumerability test green LIVE (not skipped) against the real project; fresh curl re-probes of all four anon endpoints match 43-01's original evidence"
    requirement: "PRO-03"
    verification:
      - kind: integration
        ref: "tests/security/hosted-quote-enumerability.test.ts — 3/3 pass live against fqidldxuwpfvhsejalbd this session; curl probes: 401/42501 on both tables, 200 [] and 200 false on the RPCs"
        status: pass
    human_judgment: false
  - id: D2
    description: "404 indistinguishability + header pair + XSS escaping + D-15 one-shot: 7/7 unit suite green; byte-identity guaranteed by zero-interpolation constant body in api/q/[token].ts"
    requirement: "PRO-03"
    verification:
      - kind: unit
        ref: "tests/security/hosted-quote-404-indistinguishable.test.ts (7/7)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Secret hygiene: no VITE_-prefixed secret in src/api/supabase/.env.example; fresh dist/ build contains zero server-secret name patterns"
    requirement: "PRO-03"
    verification:
      - kind: manual_procedural
        ref: "grep -rn VITE_ src/ api/ supabase/ | grep -iE 'secret|service_role|api_key' → empty; grep -rlE '...' dist/ → empty (exit 1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Webhook spoofing: 15/15 signature suite green — five spoofing/tampering vectors all rejected 400 with zero writes"
    requirement: "PRO-03"
    verification:
      - kind: unit
        ref: "api/webhooks/paddle.test.ts (15/15)"
        status: pass
    human_judgment: false
  - id: D5
    description: "RLS/RPC source review: get_hosted_quote never references entitlements (D-11); approve_quote_decision enforces decision is null (D-15); zero permissive anon policies"
    requirement: "PRO-03"
    verification:
      - kind: manual_procedural
        ref: "Direct read of supabase/migrations/0001_pro_backend.sql, cited line-level in the review doc Control 6"
        status: pass
    human_judgment: false
  - id: D6
    description: "PWA SW pass-through: verify-pro-csp.mjs 9/9 green; ^/q/ and ^/api/ denylist regexes confirmed in the compiled dist/sw.js"
    requirement: "PRO-03"
    verification:
      - kind: other
        ref: "node scripts/verify-pro-csp.mjs; grep -oE denylist patterns in freshly built dist/sw.js"
        status: pass
    human_judgment: false
  - id: D7
    description: "Human sign-off recorded — PRE-DEPLOY scope, with the launch-day checklist as the attached condition"
    requirement: "PRO-03"
    verification:
      - kind: manual_procedural
        ref: "docs/PRO-SECURITY-REVIEW.md Sign-off table (Marcus Dickinson, 2026-07-16); scope modification relayed via orchestrated session"
        status: pass
    human_judgment: true

patterns-established:
  - "Launch-day checklist location: docs/PRO-SECURITY-REVIEW.md Part 5 is the single authoritative list for v2.0 deploy-time re-verification (Phase 42 item 0 + Phase 43 items 1–9)"

duration: ~20min (including the blocking sign-off checkpoint round-trip)
completed: 2026-07-16
status: complete
---

# Phase 43 Plan 07: PRO-03 Formal Security Review Summary

**The ROADMAP-mandated PRO-03 security review executed with live evidence — non-enumerability green against the real eu-central-1 project, all seven controls PASS or honestly deferred — and signed by the human at PRE-DEPLOY scope, with the nine deploy-time items + webhook-auth fix moved to the v2.0 Launch-Day Checklist.**

## Performance

- **Duration:** ~20 min (evidence battery ~10 min + checkpoint round-trip)
- **Tasks:** 1 auto + 1 blocking human-verify checkpoint (resolved with scope modification)
- **Files modified:** 1 created (docs/PRO-SECURITY-REVIEW.md)

## Accomplishments

- **Ran the full PRO-03 verification battery with real output captured** (no unverifiable claims):
  - Enumerability suite **live** (not skipped) against `fqidldxuwpfvhsejalbd`: 3/3 pass. Fresh independent `curl` re-probes of all four anon endpoints byte-consistent with 43-01's original acceptance evidence (401/42501 on both tables; `[]`/`false` from the two RPCs on random tokens).
  - 404-indistinguishability suite 7/7; Paddle webhook signature suite 15/15; `verify-pro-csp.mjs` 9/9.
  - Secret hygiene: repo-wide `VITE_` secret grep clean (src/, api/, supabase/, .env.example via `git show`); fresh `npx vite build` then `dist/` grep for all four server-secret name patterns — zero matches.
  - Compiled-output check: `^\/q\/` and `^\/api\/` denylist regexes present in the actual generated `dist/sw.js`, not just the source config.
  - RLS/RPC review cited directly from the migration source: D-11 (no entitlements reference in `get_hosted_quote`) and D-15 (`decision is null` UPDATE guard) both hold at the DB level.
- **Authored `docs/PRO-SECURITY-REVIEW.md`** with a hard VERIFIED-NOW vs DEFERRED-TO-DEPLOY split so the signature scope is honest, covering all seven plan controls plus the full threat-register disposition (T-43-01, T-43-13, T-43-02, T-43-03, T-43-SC — all mitigated).
- **Dispositioned the three orchestrator-flagged accumulated items:**
  1. 43-05 `resend` gate ordering violation → **closed** (zero execution exposure, registry-verified, retroactively approved; process recommendation recorded).
  2. `notify_quote_decision()` webhook auth gap → **open/tracked, non-blocking** (inert today because `app.settings.functions_url` is NULL; concrete remediation: follow-up migration adding the anon-key bearer header + setting `functions_url` at deploy; functional email gap, not a security-boundary failure — decisions are never lost).
  3. Deployment deferrals → **moved to the v2.0 Launch-Day Checklist** (see below).
- **Human sign-off obtained and recorded at PRE-DEPLOY scope** (Marcus Dickinson, 2026-07-16): verified-now evidence accepted as-is; production shipping explicitly deferred until the entire v2.0 milestone is built. Deliberately NOT recorded as "approved — ship to production."
- **v2.0 Launch-Day Checklist established** in the review doc's Part 5 — Phase 42's live GDPR gate check stays item 0 (precedent `6eb0ea8`), followed by Phase 43's nine deploy-time items (Vercel env, Resend, Paddle, Auth allow-list, magic-link round trip, sandbox checkout cycle, `/q/*` curl -I, installed-PWA freshness, webhook-auth remediation).

## Launch-Day Checklist — authoritative location

**`docs/PRO-SECURITY-REVIEW.md` Part 5.** No dedicated checklist file existed before this plan (Phase 42's item was only a textual reference inside `.planning/phases/42-gdpr-onboarding/42-UAT.md`). Part 5 is now the single list; future plans adding launch-day items should append there.

## Task Commits

1. **Task 1: Run the aggregated PRO-03 security checks and record the results** — `c8d7c33` (docs)
2. **Task 2 (checkpoint resolution): scoped sign-off + launch-day checklist recorded** — `acb6413` (docs)

**Plan metadata:** committed alongside this SUMMARY (final commit)

## Deviations from Plan

### Checkpoint resolved with an explicit scope modification (user decision, not a deviation by the executor)

**1. Sign-off granted at PRE-DEPLOY scope instead of the plan's literal "approved — ship to production"**
- **Found during:** Task 2 (blocking human-verify checkpoint)
- **What happened:** The plan's resume-signal wording assumed a production deploy was the immediate next step. The user signed the review but scoped the approval to the pre-deploy evidence only — production shipping is deferred until all of v2.0 is built (consistent with the standing project policy that phases 38–43 stay on local `main` and deploy requires `DEPLOY_OK=1`).
- **Resolution:** Signature recorded verbatim at its actual scope; the deferred items became a formal launch-day checklist (Part 5) rather than being waved through. The PRO-03 gate closes for phase-completion purposes; the launch-day checklist is the binding condition before real traffic.
- **Commit:** `acb6413`

No other deviations — the evidence battery executed exactly as the plan specified, and no control was left in a FAIL state.

## Known Stubs

None. This plan produced a documentation artifact; no code paths were added or modified.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes were introduced by this plan (review-only).

## Issues Encountered

- The enumerability test reads `SUPABASE_URL`/`SUPABASE_ANON_KEY` (non-VITE names) while the local `.env` carries the `VITE_` pair — resolved by exporting the mapped names into the test environment for the live run (documented in the review doc's Control 1 command line). No file changes needed.
- `npm run build`'s full-suite coverage run hit the pre-existing `outputEquivalence.test.tsx` timeout flake (already logged in `.planning/phases/43-pro-backend/deferred-items.md` by 43-04, out of scope). The `dist/` needed for the secret grep was produced with a direct `npx vite build` instead; the plan's own verify command (`npx vitest run tests/security/ api/webhooks/paddle.test.ts && node scripts/verify-pro-csp.mjs && ...`) passed in full.

## Next Phase Readiness

- **Phase 43 is complete pending phase-level verification** — all 7 plans executed, PRO-03 gate signed (pre-deploy scope).
- Phase 44 (Sync & STL) can proceed: the v2.0 Dexie schema additions from Phase 43 (Quote publish metadata) are final and additive.
- Phase 45 / v2.0 launch inherits the binding launch-day checklist (`docs/PRO-SECURITY-REVIEW.md` Part 5) — item 0 is Phase 42's live GDPR gate, items 1–9 are the Pro-backend deploy steps, and none of the hosted endpoint's real traffic may begin before the list is re-verified.

---
*Phase: 43-pro-backend*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: `docs/PRO-SECURITY-REVIEW.md` (with recorded signature + Part 5 launch-day checklist)
- FOUND: `.planning/phases/43-pro-backend/43-07-SUMMARY.md`
- FOUND: commit `c8d7c33` (Task 1 — review authored with live evidence)
- FOUND: commit `acb6413` (Task 2 — scoped sign-off + launch-day checklist)
- VERIFIED: plan verify command green (25/25 tests incl. live enumerability, verify-pro-csp 9/9, review doc exists with 'non-enumerab' content)
