---
phase: 46-white-label-quotes
plan: 06
subsystem: ui
tags: [react, branding, entitlement, pro-gating, upload, tauri]

# Dependency graph
requires:
  - phase: 46-01
    provides: logoDataUrl on UserProfile, resizeImageToDataUrl/MAX_LOGO_UPLOAD_BYTES, isValidLogoDataUrl
  - phase: 46-02
    provides: desktop Supabase client (D-08), OTP verifyEmailCode in useProAuth/SignInModal, existing desktop gate flip for Account & Pro / SignInModal mount
provides:
  - BrandingSection component — single management home for the maker's logo (D-03)
  - Free/signed-out Pro-chip path into the one bundle ProPitchModal (D-13)
  - ProPitchModal full Pro bundle copy (hosted quote links AND white-label branding, D-14)
  - white-label-branding NEW-badge registration (absolute-overlay rule)
affects: [47-cloud-sync, 51-launch-prep-redux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pro-chip -> onOpenPitch -> shared ProPitchModal -> onSignIn -> App-level SignInModal (one sign-in dialog, D-09)"
    - "Entitlement-driven render gate (isPro ? upload UI : Pro-chip) never mutates stored data on lapse (D-06)"

key-files:
  created:
    - src/components/BrandingSection.tsx
    - src/components/BrandingSection.test.tsx
  modified:
    - src/features.ts
    - src/components/pro/ProPitchModal.tsx
    - src/components/pro/ProPitchModal.test.tsx
    - src/components/pro/ShareQuoteButton.test.tsx
    - src/components/UserProfileModal.tsx

key-decisions:
  - "BrandingSection mounts inside UserProfileModal's Profile section, alongside the existing Name field, gated on live isPro from useEntitlement"
  - "Free-user Pro-chip opens the ONE ProPitchModal (D-14); onSignIn defers to the existing App-level SignInModal via onOpenSignIn rather than mounting a second sign-in dialog (D-09)"
  - "Desktop gate flips for the Account & Pro block (UserProfileModal) and the SignInModal mount (App.tsx) were already completed in 46-02 as a Rule 2 fix — confirmed still in place, no further changes needed in this plan"
  - "ProPitchModal retitled 'Share a live quote link' -> 'Unlock 3DCoster Pro' since it now opens from two entry points (ShareQuoteButton and BrandingSection), not just Share quote"
  - "Remove only clears logoDataUrl via explicit user action; never entitlement-driven (D-06 — a lapsed subscription must not wipe the stored logo)"

patterns-established:
  - "Pattern: Pro-chip gated sections defer entitlement checks to useEntitlement's live isPro, with all sign-in flows routed through the single App-level SignInModal instance"

requirements-completed: [D-01, D-02, D-03, D-06, D-08, D-13, D-14]

coverage:
  - id: D1
    description: "BrandingSection lets a Pro user upload/preview/remove a logo persisted to UserProfile.logoDataUrl"
    requirement: "D-01, D-02, D-06"
    verification:
      - kind: unit
        ref: "src/components/BrandingSection.test.tsx#Pro path stores a validated logoDataUrl and previews it"
        status: pass
      - kind: manual_procedural
        ref: "Founder-approved browser verification, dev server :4173, 2026-07-23 (signed-out web pass only — see human_judgment below for the signed-in Pro upload/persist/remove round)"
        status: pass
    human_judgment: true
    rationale: "The signed-in Pro upload/preview/remove/persistence round and the oversized/non-image rejection toast were explicitly DEFERRED to phase UAT by founder decision — no Pro-entitled session exists yet (no entitlement row until billing/UAT seeding). Unit tests cover the code path; the live signed-in round still needs human sign-off."
  - id: D2
    description: "Free/signed-out user sees the Branding section with the logo slot behind a Pro chip; interacting opens the one Pro pitch modal (D-13)"
    requirement: "D-13"
    verification:
      - kind: unit
        ref: "src/components/BrandingSection.test.tsx#free path shows the Pro chip and calls onOpenPitch on interaction"
        status: pass
      - kind: manual_procedural
        ref: "Founder-approved browser verification, dev server :4173, signed-out web, 2026-07-23: Settings -> Profile Branding section shows Pro chip; clicking opens 'Unlock 3DCoster Pro' modal"
        status: pass
    human_judgment: false
  - id: D3
    description: "ProPitchModal presents the full Pro bundle (hosted quote links + white-label) reached from both Share-quote and Branding entry points (D-14)"
    requirement: "D-14"
    verification:
      - kind: unit
        ref: "src/components/pro/ProPitchModal.test.tsx (bundle copy assertion)"
        status: pass
      - kind: manual_procedural
        ref: "Founder-approved browser verification, 2026-07-23: pitch modal copy names both hosted quote links (Approve/Decline, live result) and full white-label branding (logo on PDFs + hosted pages, footer removed) — D-14 one-bundle-voice confirmed"
        status: pass
    human_judgment: false
  - id: D4
    description: "'Sign in for Pro' in the pitch modal opens the SignInModal with the 46-02 OTP one-time-code copy"
    requirement: "D-08"
    verification:
      - kind: manual_procedural
        ref: "Founder-approved browser verification, 2026-07-23: SignInModal copy correctly reads 'one-time code' (46-02's 8-digit OTP fix e22987e confirmed live in this flow)"
        status: pass
    human_judgment: false
  - id: D5
    description: "On the Tauri desktop build, the Account & Pro sign-in surface and Branding section render, with ShareQuoteButton still absent (publishing stays web-only)"
    requirement: "D-08"
    verification: []
    human_judgment: true
    rationale: "Explicitly DEFERRED to phase UAT by founder decision (joins the existing 46-02 desktop UAT batch) — requires a `tauri dev` session to visually confirm Account & Pro + Branding render and Share-quote is absent on desktop."

# Metrics
duration: ~5min (tasks 1-3) + checkpoint resolution in continuation session
completed: 2026-07-23
status: complete
---

# Phase 46 Plan 06: Branding Section & Pro Bundle Pitch Summary

**Settings -> Profile Branding section (Pro logo upload/preview/remove, free Pro-chip pitch) mounted alongside the existing Name field, backed by a rewritten one-voice ProPitchModal bundling hosted quote links + white-label branding.**

## Performance

- **Duration:** ~5 min across tasks 1-3 (commits 08:11:47-08:15:30 on 2026-07-23); Task 4 checkpoint resolved in a separate continuation session
- **Started:** 2026-07-23T08:11:47-04:00
- **Completed:** 2026-07-23 (checkpoint approval)
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint)
- **Files modified:** 7

## Accomplishments
- `BrandingSection.tsx`: the single management home for a maker's logo (D-03) — Pro users upload/preview/remove via `resizeImageToDataUrl`, persisted to `UserProfile.logoDataUrl`; free/signed-out users see the same section framed behind a Pro chip that opens the bundle pitch modal (D-13)
- `ProPitchModal` rewritten to present the full Pro bundle in one voice (D-14): live hosted quote links (Approve/Decline) AND white-label branding (logo, no "Made with 3DCoster" footer) — retitled "Unlock 3DCoster Pro" since it now opens from two entry points
- `BrandingSection` mounted inside `UserProfileModal`'s Profile section alongside the Name field, gated on live `isPro` from `useEntitlement`, with `onOpenPitch` routed to the shared modal and `onSignIn` deferred to the existing App-level `SignInModal` (one sign-in dialog, D-09)
- Confirmed the desktop gate flips for Account & Pro / SignInModal mount (D-08) were already completed in 46-02 — no further code changes needed in this plan
- `white-label-branding` NEW-badge registered in `features.ts`, rendered as an absolute overlay per the CLAUDE.md badge rule
- Human-verify checkpoint (Task 4) resolved: approved with two items explicitly deferred to phase UAT by founder decision

## Task Commits

Each task was committed atomically:

1. **Task 1: BrandingSection component (upload/preview/remove + Pro-chip gate) + NEW badge** - `c67fede` (feat)
2. **Task 2: Extend ProPitchModal to the full Pro bundle (D-14)** - `0b3957e` (feat)
3. **Task 3: Mount BrandingSection + flip desktop sign-in gates** - `25fadff` (feat)
4. **Task 4: Visual verification checkpoint** - resolved via founder approval (see Checkpoint Resolution below); no code commit (verification-only task)

**Plan metadata:** (this commit) - docs: complete plan

_Note: Task 3's commit also folded in a Rule 3 fix (typed test mocks) discovered via `tsc -b`._

## Files Created/Modified
- `src/components/BrandingSection.tsx` - Pro upload/preview/remove UI + free Pro-chip gate, mirrors ShareQuoteButton's chip pattern
- `src/components/BrandingSection.test.tsx` - 6 tests: Pro upload/preview, free Pro-chip path, oversized/non-image rejection
- `src/features.ts` - registers `white-label-branding` NEW-badge key
- `src/components/pro/ProPitchModal.tsx` - rewritten bundle copy (hosted links + white-label), retitled "Unlock 3DCoster Pro"
- `src/components/pro/ProPitchModal.test.tsx` - asserts bundle copy mentions both hosted links and white-label/branding
- `src/components/pro/ShareQuoteButton.test.tsx` - updated stale title assertion after the ProPitchModal copy rewrite
- `src/components/UserProfileModal.tsx` - mounts BrandingSection in the Profile section, threads onOpenPitch/onOpenSignIn

## Decisions Made
- BrandingSection mounts inside UserProfileModal's Profile section, alongside the existing Name field, gated on live `isPro` from `useEntitlement`
- Free-user Pro-chip opens the ONE ProPitchModal (D-14); its `onSignIn` defers to the existing App-level SignInModal via `onOpenSignIn` rather than mounting a second sign-in dialog (D-09)
- Desktop gate flips for the Account & Pro block (UserProfileModal) and the SignInModal mount (App.tsx) were already done in 46-02 as a Rule 2 fix — confirmed still in place, no further changes needed here
- ProPitchModal retitled "Share a live quote link" -> "Unlock 3DCoster Pro" since it now opens from two distinct entry points
- Remove only clears `logoDataUrl` via explicit user action; never entitlement-driven (D-06 — lapse must not wipe the stored logo)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale ProPitchModal title assertion in ShareQuoteButton.test.tsx**
- **Found during:** Task 2 (ProPitchModal bundle copy rewrite)
- **Issue:** ShareQuoteButton.test.tsx asserted the old modal title ("Share a live quote link"), which broke as a direct consequence of the Task 2 copy rewrite
- **Fix:** Updated the assertion to match the new "Unlock 3DCoster Pro" title
- **Files modified:** src/components/pro/ShareQuoteButton.test.tsx
- **Committed in:** 0b3957e (Task 2 commit)

**2. [Rule 3 - Blocking] Typed BrandingSection.test.tsx's mock callbacks against real signatures**
- **Found during:** Task 3 (mounting BrandingSection in UserProfileModal)
- **Issue:** `vi.fn()` mocks in BrandingSection.test.tsx were untyped against their real callback signatures; `tsc -b` caught the mismatch (vitest run alone did not) — per this project's tsc -b vs --noEmit convention (CLAUDE.md)
- **Fix:** Typed the mocks to match onProfileChange/onOpenPitch signatures
- **Files modified:** src/components/BrandingSection.test.tsx
- **Committed in:** 25fadff (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug fix, 1 Rule 3 blocking fix)
**Impact on plan:** Both fixes were direct, in-scope consequences of this plan's own changes (test breakage caused by the plan's copy rewrite; a type mismatch in a test file the plan itself created). No scope creep.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## Checkpoint Resolution (Task 4)

**Type:** human-verify (gate: blocking)
**Outcome:** Approved, with two items explicitly deferred to phase UAT (founder decision, 2026-07-23).

### Verified LIVE in a real browser (dev server :4173, signed-out web, orchestrator-driven with founder approval)
- Settings -> Profile shows the Branding section below Name with the green "New" badge as an absolute overlay (no layout push)
- "Add your logo" button renders with a Pro chip and `aria-label="Add your logo (Pro feature)"`
- Clicking it opens the "Unlock 3DCoster Pro" pitch modal, whose copy names BOTH hosted quote links (Approve/Decline, live result) AND full white-label branding (logo on PDFs + hosted pages, footer removed) — D-14 one-bundle-voice confirmed
- "Sign in for Pro" in the pitch modal opens the SignInModal; its copy correctly reads "one-time code" (46-02's 8-digit OTP fix `e22987e` confirmed live in this flow)

### Deferred to phase UAT (founder decision)
These are tracked as `human_judgment: true` coverage items above so `verify-work` surfaces them as pending human-verification items, not silently marked complete:
1. **Pro-signed-in upload/preview/remove/persistence flow** — needs a Pro-entitled session; no entitlement row exists until billing/UAT seeding
2. **Oversized/non-image file rejection toast** under a real Pro session
3. **Desktop (`tauri dev`) rendering** of the Account & Pro + Branding sections, and confirmation that ShareQuoteButton stays absent on desktop (joins the existing 46-02 desktop UAT batch)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 06's user-facing surface (BrandingSection, one-voice ProPitchModal, desktop sign-in visibility) is complete and approved
- Three items formally deferred to phase UAT (see Checkpoint Resolution above) — these must be included in the Phase 46 UAT pass before the phase is signed off
- No blockers for remaining Phase 46 plan(s)

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-23*
