---
phase: 43-pro-backend
plan: 04
subsystem: hosted-quotes-publish
tags: [supabase, hosted-quotes, share-quote, react, vitest, pro-tier]

# Dependency graph
requires:
  - phase: 43-pro-backend
    plan: 01
    provides: "hosted_quotes + entitlements schema, RLS, get_hosted_quote/approve_quote_decision SECURITY DEFINER RPCs"
  - phase: 43-pro-backend
    plan: 03
    provides: "supabase client singleton (src/lib/supabaseClient.ts) + useProAuth() session/isSignedIn"
provides:
  - "Quote publish metadata fields (publishedUrl/publishedAt/publishStatus/hostedToken/hostedDecision*/hostedExpiresAt) — additive, non-indexed, no Dexie version bump"
  - "usePublishedQuote() hook: publish()/unpublish()/refreshStatuses() with the D-11 lapse-safe entitlement gate scoped ONLY to publish"
  - "ShareQuoteButton + ProPitchModal (src/components/pro/) — the maker-facing Share/Unpublish UI + the single D-10 Pro pitch surface"
  - "share-quote key in src/features.ts (NewBadge)"
  - "Publish snapshot now carries businessName + embedded variantsSnapshot, closing the 43-05 cross-plan gap for the hosted page's D-05 maker-brand line"
affects: [43-06-billing-email, 43-07-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lift usePublishedQuote() ONCE per container (JobsManager, PrintQuoteModal) and thread publish/unpublish down as props (PERF-09-style) instead of calling the hook per rendered quote row — avoids a Supabase round-trip per row"
    - "Entitlement check lives in exactly one function (hasActiveEntitlement, called only from publish) — grep-verifiable D-11 lapse-safe boundary"
    - "usePublishedQuote takes businessName + updateQuote as explicit parameters (dependency injection) rather than calling useQuotes()/useUserProfile() itself, so callers control subscription lifetime"

key-files:
  created:
    - src/hooks/usePublishedQuote.ts
    - src/hooks/usePublishedQuote.test.ts
    - src/components/pro/ShareQuoteButton.tsx
    - src/components/pro/ShareQuoteButton.test.tsx
    - src/components/pro/ProPitchModal.tsx
    - src/components/pro/ProPitchModal.test.tsx
    - .planning/phases/43-pro-backend/deferred-items.md
  modified:
    - src/types.ts
    - src/utils/backupSchema.ts
    - src/utils/backupSchema.test.ts
    - src/components/PrintQuoteModal.tsx
    - src/components/PrintQuoteModal.test.tsx
    - src/components/JobsManager.tsx
    - src/features.ts

key-decisions:
  - "Cross-plan fix (orchestrator-flagged from 43-05 Known Stubs): the publish snapshot is no longer quote.lineItemsSnapshot verbatim — it's `{ ...lineItemsSnapshot, businessName?, variantsSnapshot? }`, sourced from UserProfile.name (the project's only business-identity field) and the Quote's own variantsSnapshot. This matches api/q/[token].ts's HostedSnapshot contract exactly (field name `businessName`) so the hosted page's D-05 maker-brand line and quote-variant tiers actually render once published."
  - "ShareQuoteButton's signed-out/non-Pro branch discriminates on isSignedIn only, not a live entitlement read. 43-06 (billing) hasn't shipped yet, so there is no live way to be 'signed-in but entitled' at all this session; adding a per-row entitlement SELECT would reintroduce the exact N-subscription/N-request problem PERF-09 fixed, for zero observable benefit today. The real D-11 gate (publish() throwing without an active entitlement) is unconditionally enforced server-round-trip-side regardless of this UI simplification; a signed-in non-Pro user who clicks Share gets a clear toast error, not a second modal — preserves D-10's 'no nags anywhere else' beyond the one pitch modal."
  - "publish/unpublish are threaded from ONE usePublishedQuote() call per container (JobsManager top level, PrintQuoteModal top level) down through JobCard -> OrdersSection -> OrdersQuoteRows -> QuoteRow as optional props, mirroring the existing PERF-09 updateQuote threading pattern already in JobsManager.tsx — avoids adding a hook instance (and its useProAuth() auth-state subscription) per rendered row."
  - "publishQuote/unpublishQuote were added as OPTIONAL props at every layer of the JobCard prop chain (not required) specifically so the ~20 pre-existing JobsManager.test.tsx call sites that predate this plan did not need touching — QuoteRow only renders ShareQuoteButton when both are supplied."
  - "ShareQuoteButton self-gates on __IS_TAURI__ (returns null) rather than relying on every call site to gate it — D-12 is enforced once, at the component boundary, so a future caller can't forget it."
  - "usePublishedQuote's D-08 first-name extraction uses a whitespace-collapsing regex split (`trim().split(/\\s+/)[0]`) rather than the plan's literal `.split(' ')[0]` — functionally equivalent, additionally handles multi-space names correctly; behavior (first token only, never full customerSnapshot) is unchanged and test-asserted."
  - "backupSchema DATE_FIELDS.quotes also gained hostedExpiresAt, which the plan's action text didn't name explicitly (only publishedAt/hostedDecisionAt) — Rule 1 fix: it is a Date-typed field with the identical round-trip requirement, and omitting it would have silently downgraded it to a string on backup restore."

requirements-completed: [PRO-02]

coverage:
  - id: D1
    description: "Quote carries publish metadata (publishedUrl/publishedAt/publishStatus/hostedToken/hostedDecision*/hostedExpiresAt), all optional/additive, no Dexie version(13) added"
    requirement: "PRO-02"
    verification:
      - kind: unit
        ref: "src/utils/backupSchema.test.ts (DATE_FIELDS.quotes round-trip assertions); grep confirms database.ts still ends at version(12)"
        status: pass
    human_judgment: false
  - id: D2
    description: "usePublishedQuote.publish() sets owner_id to the session user, is entitlement-gated (D-11), POSTs first-name-only PII (D-08), and never sends the full customerSnapshot"
    requirement: "PRO-02"
    verification:
      - kind: unit
        ref: "src/hooks/usePublishedQuote.test.ts (9 tests: signed-out throw, no-entitlement throw + zero insert call, successful insert payload shape + no-email assertion, businessName omission when absent)"
        status: pass
    human_judgment: false
  - id: D3
    description: "unpublish() and refreshStatuses() never read entitlements (D-11 lapse-safe) — grep-verifiable: hasActiveEntitlement is called only inside publish"
    requirement: "PRO-02"
    verification:
      - kind: unit
        ref: "src/hooks/usePublishedQuote.test.ts (unpublish/refreshStatuses describe blocks assert fromSpy never called with 'entitlements')"
        status: pass
    human_judgment: false
  - id: D4
    description: "ShareQuoteButton: Pro chip + ProPitchModal for signed-out users (no publish call); publish/unpublish toggle for signed-in users; renders nothing under __IS_TAURI__"
    requirement: "PRO-02"
    verification:
      - kind: unit
        ref: "src/components/pro/ShareQuoteButton.test.tsx (6 tests) + ProPitchModal.test.tsx (4 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live end-to-end publish/unpublish on a deployed preview (real Supabase write, hosted page renders the maker brand line and variant tiers)"
    requirement: "PRO-02"
    verification: []
    human_judgment: true
    rationale: "Requires a deployed preview + a signed-in Pro session with an active entitlements row (43-06 billing not yet shipped, so no live entitled account exists this session). Carried to the 43-07 verification gate per the plan's own <verification> Manual step."

patterns-established:
  - "usePublishedQuote is the second Supabase-data-query hook in the codebase (after useProAuth's auth-only calls) — the fluent query-builder mock pattern in usePublishedQuote.test.ts (thenable builder object, chain methods return `this`) is reusable for 43-06's billing-panel tests."
  - "Any future quote-row action that needs a per-quote async operation should follow the same lift-once-thread-down pattern already established for updateQuote/publishQuote/unpublishQuote through JobCard/OrdersSection/OrdersQuoteRows/QuoteRow, not a per-row hook call."

duration: ~50min
completed: 2026-07-16
status: complete
---

# Phase 43 Plan 04: Publish/Share Quote Summary

**Pro makers publish a saved quote as a live `3dcoster.com/q/<uuid>` hosted link and unpublish it via a new `usePublishedQuote` hook (D-11 lapse-safe entitlement gate scoped only to publish, D-08 first-name-only PII), surfaced through a `ShareQuoteButton`/`ProPitchModal` pair wired into both quote surfaces — with the publish payload now carrying the maker's business name and quote-variant tiers so 43-05's hosted page renders them.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2 auto (both `tdd`-flavored — usePublishedQuote.test.ts written and run RED before usePublishedQuote.ts existed; component tests written alongside their components)
- **Files modified:** 7 created, 7 modified (incl. this plan's `deferred-items.md`)

## Accomplishments

- **Quote publish metadata** (`src/types.ts`): `publishedUrl`, `publishedAt`, `publishStatus`, `hostedToken`, `hostedDecision`, `hostedDecisionAt`, `hostedDecisionNote`, `hostedExpiresAt` — all optional, additive, non-indexed. No Dexie `version(13)` — DB stays at v12, matching the `variantsSnapshot`/`taxJurisdiction` precedent.
- **`backupSchema.ts`**: `DATE_FIELDS.quotes` gains `publishedAt`, `hostedDecisionAt`, and `hostedExpiresAt` (the last one a Rule 1 fix beyond the plan's literal text — same round-trip requirement as the other two).
- **`src/hooks/usePublishedQuote.ts`**: `publish(quote, options?)` inserts a `hosted_quotes` row (token via `crypto.randomUUID()`, owner-scoped, D-11-gated on an active `entitlements` row, D-08 first-name-only `customer_first_name`, D-14 optional `expires_at`) and writes the publish metadata back onto the local Quote via the caller's `updateQuote`. `unpublish(quote)` flips the hosted row + local Quote to `'unpublished'` — never reads entitlements. `refreshStatuses(quotes)` owner-scoped-pulls `decision`/`decided_at`/`decision_note` back onto every locally-published Quote (D-07) — also never reads entitlements. The entitlement check (`hasActiveEntitlement`) is a single function called from exactly one place (`publish`), making the D-11 lapse-safe boundary grep-verifiable.
- **Cross-plan fix (mandatory per orchestrator flag):** the publish snapshot is `{ ...quote.lineItemsSnapshot, businessName?, variantsSnapshot? }` — `businessName` sourced from `UserProfile.name` (trimmed, omitted when blank), `variantsSnapshot` embedded verbatim from the Quote when present. This matches `api/q/[token].ts`'s `HostedSnapshot` interface field-for-field, so the hosted page's D-05 maker-brand eyebrow line and quote-variant tier table both render once a quote with either is published.
- **`ShareQuoteButton`** (`src/components/pro/`): signed-in branch publishes/unpublishes (toast feedback, clipboard copy on publish); signed-out branch shows a "Pro" chip and opens `ProPitchModal` on click — no publish attempt, no other nag surface anywhere. Self-gates to `null` under `__IS_TAURI__` (D-12) regardless of caller. Carries the `share-quote` `NewBadge`.
- **`ProPitchModal`**: the one short D-10 pitch (what a hosted link does) + a "Sign in for Pro" CTA that hands off to `SignInModal` — reuses the existing D-09 contextual sign-in flow rather than inventing a second one.
- **Wired into both quote surfaces**: `PrintQuoteModal`'s edit-mode footer (only surface with an already-created Quote to share — D-13) and `JobsManager`'s per-quote row (Pending + Declined kinds), with a "Live link" badge next to the existing status pill. `JobsManager` also runs a one-time `refreshStatuses(quotes)` on mount (D-07).
- **`features.ts`**: `share-quote` key dated 2026-07-15.
- Full targeted gate green: `tsc -b`, `lint:no-raw-html`, `vite build` (main chunk 97.6 KB gz, well under the 300 KB gate), and every touched/created test file passing (see Self-Check).

## Task Commits

1. **Task 1: Quote publish metadata + backup schema + usePublishedQuote hook** — `f5ae58c` (feat)
2. **Task 2: ShareQuoteButton + ProPitchModal wired into quote surfaces** — `07c5f34` (feat)

**Plan metadata:** committed alongside this SUMMARY (final commit)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `backupSchema.ts` DATE_FIELDS.quotes also gained `hostedExpiresAt`**
- **Found during:** Task 1
- **Issue:** The plan's action text named only `publishedAt` and `hostedDecisionAt` for the DATE_FIELDS addition, but `hostedExpiresAt` is also a `Date`-typed field on `Quote` (D-14) with the identical backup/restore round-trip requirement — omitting it would silently downgrade it to a string on restore, exactly the failure mode `backupSchema.ts`'s own header comment warns against.
- **Fix:** Added `hostedExpiresAt` to `DATE_FIELDS.quotes` alongside the other two; locked with a dedicated test.
- **Files modified:** `src/utils/backupSchema.ts`, `src/utils/backupSchema.test.ts`
- **Commit:** `f5ae58c`

**2. [Cross-plan flag, mandatory per orchestrator instructions] Publish snapshot carries `businessName` + `variantsSnapshot`**
- **Found during:** Task 1 (flagged by 43-05's SUMMARY Known Stubs before this plan started)
- **Issue:** The plan's literal `<behavior>` text said `snapshot = quote.lineItemsSnapshot` verbatim, but 43-05's hosted-page renderer (`api/q/[token].ts`) already expects an optional `businessName` field (D-05 maker-brand line) and an optional `variantsSnapshot` (quote-variant tiers) INSIDE that same `snapshot` jsonb blob — neither of which exists on `Quote.lineItemsSnapshot` itself.
- **Fix:** The publish payload's `snapshot` is now `{ ...quote.lineItemsSnapshot, ...(businessName && { businessName }), ...(quote.variantsSnapshot && { variantsSnapshot: quote.variantsSnapshot }) }`, sourced from the current `UserProfile.name` and the Quote's own `variantsSnapshot`. Field name matches `api/q/[token].ts`'s `HostedSnapshot` interface exactly.
- **Files modified:** `src/hooks/usePublishedQuote.ts`
- **Commit:** `f5ae58c`

### Scoped design decisions (not deviations, but worth flagging)

- **ShareQuoteButton discriminates signed-in vs. signed-out only**, not a live per-row entitlement check, for the Pro-chip/pitch-modal branch. See `key-decisions` above for the full rationale (avoids reintroducing the PERF-09 N-subscription problem; 43-06 billing hasn't shipped so there's no live "entitled" state to distinguish yet; the real D-11 gate is still enforced server-round-trip-side inside `publish()` regardless).
- **`publishQuote`/`unpublishQuote` are OPTIONAL props** through the `JobCard`/`OrdersSection`/`OrdersQuoteRows`/`QuoteRow` chain (not required) specifically so the ~20 pre-existing `JobsManager.test.tsx` call sites did not need touching. `QuoteRow` only renders `ShareQuoteButton` when both are supplied.
- **PrintQuoteModal's footer `ShareQuoteButton`** reads its `quote` prop from `editingQuote`, which is a snapshot captured when the modal opened — after a publish/unpublish, this specific instance's toggle label won't flip until the modal is reopened (JobsManager's own row-level instance DOES update live, since it reads from the live `quotesByJobId` Map). A cosmetic staleness limited to the PrintQuoteModal footer only, not a functional gap — the underlying Quote is correctly updated in Dexie either way.

## Known Stubs

None — the 43-05 cross-plan flag (businessName) is resolved by this plan (see Deviations #2 above).

## Deferred Items

- Logged an unrelated pre-existing full-suite `--coverage` run timeout flake (`src/components/calculator/outputEquivalence.test.tsx`, Phase 38 CostCalculator oracle) to `.planning/phases/43-pro-backend/deferred-items.md`. Passes reliably in isolation (with and without coverage); fails only under full-suite parallel resource contention. Confirmed unrelated to this plan's changes (this plan never touches `CostCalculator`/`useCostDerivedValues`/`costCalc.ts`) and out of scope per the executor's scope-boundary rule.

## Issues Encountered

- During verification, an over-broad `git checkout <old-commit> -- .` (used to diff-test whether the coverage-timeout flake predated this plan) briefly overwrote the working tree with a stale commit's files. Caught immediately, recovered via `git checkout HEAD -- .` + `git stash pop` with zero data loss — both task commits and the stashed Task 2 work were fully intact afterward, and this was re-verified with `tsc -b` + the full targeted test run before proceeding. No destructive git operation (reset --hard, clean, force-push) was used at any point.

## For Plan 43-06 (Billing)

- `usePublishedQuote`'s `hasActiveEntitlement` reads `entitlements.status === 'active'` — confirm this matches whatever status vocabulary the Paddle webhook actually writes (43-06 owns that write path); adjust the single check in `usePublishedQuote.ts` if the webhook uses different status strings.
- Once 43-06 ships a real "Pro" signal, `ShareQuoteButton` could optionally upgrade from the current `isSignedIn`-only UI discriminator to a live entitlement read — but only if it's threaded through the same lift-once-per-container pattern already established here (do not add a per-row Supabase read).

## Next Phase Readiness

- 43-05's hosted page will now render the maker's business name (when set) and quote-variant tiers for any quote published after this plan, closing that plan's Known Stub.
- 43-07 (verification) inherits: the D-11/D-08 unit-test contracts here, plus a human-judgment item (D5 above) for a live end-to-end publish/unpublish round trip once 43-06 provides a real entitled test account.

---
*Phase: 43-pro-backend*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: all 6 created source/test files (usePublishedQuote.ts/.test.ts, ShareQuoteButton.tsx/.test.tsx, ProPitchModal.tsx/.test.tsx) + deferred-items.md
- FOUND: commit `f5ae58c` (Task 1) and `07c5f34` (Task 2) in git history
- VERIFIED: `tsc -b`, `lint:no-raw-html`, and `vite build` all pass; targeted test files (117 tests across 6 files) all green
