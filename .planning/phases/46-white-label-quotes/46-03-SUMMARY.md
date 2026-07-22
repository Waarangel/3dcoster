---
phase: 46-white-label-quotes
plan: 03
subsystem: compliance
tags: [gdpr, privacy-policy, data-flow-inventory, supabase, white-label]

# Dependency graph
requires:
  - phase: 42-gdpr-onboarding
    provides: DATA-FLOW-INVENTORY.md + PrivacyPage.tsx as the inventory-first GDPR discipline (Pitfall C-05)
  - phase: 43-pro-backend
    provides: Supabase hosted-quote snapshot row in the inventory and Privacy Policy that this plan extends
provides:
  - Updated DATA-FLOW-INVENTORY.md Supabase row + Notes entry disclosing the maker logo joins the hosted-quote snapshot
  - Updated PrivacyPage.tsx published-hosted-quote passage + Supabase processor entry disclosing the logo
  - Content-lock guard test (PrivacyPage.test.tsx) preventing the disclosure from silently regressing
affects: [46-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Inventory-first ordering (Pitfall C-05): docs updated before the code that transmits new data ships"]

key-files:
  created: []
  modified:
    - docs/DATA-FLOW-INVENTORY.md
    - src/pages/PrivacyPage.tsx
    - src/pages/PrivacyPage.test.tsx

key-decisions:
  - "Logo disclosure rides the EXISTING Supabase hosted-quote row/flow — no new destination row added, since the logo joins the existing hosted_quotes.snapshot jsonb column (RESEARCH A3, no new migration)"
  - "Framed consistently as the maker's OWN brand asset, never customer PII, present only when the maker opts into white-label by uploading a logo (D-09)"
  - "Preserved the PRO-03 no-store cache posture note in the inventory (T-46-08 disposition: accept, low severity) rather than re-litigating it"

requirements-completed: [D-11]

coverage:
  - id: D1
    description: "DATA-FLOW-INVENTORY.md discloses the maker logo as part of the Supabase hosted-quote snapshot, updated before 46-05 transmits it"
    requirement: "D-11"
    verification:
      - kind: other
        ref: "grep -in \"logo\" docs/DATA-FLOW-INVENTORY.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "Published Privacy Policy discloses the maker's logo/branding in a published hosted-quote snapshot, locked by a guard test"
    requirement: "D-11"
    verification:
      - kind: unit
        ref: "src/pages/PrivacyPage.test.tsx#discloses the maker logo as part of a published hosted quote"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-07-22
status: complete
---

# Phase 46 Plan 3: GDPR Inventory-First Logo Disclosure Summary

**Extended the existing Supabase hosted-quote inventory row and Privacy Policy to disclose that a maker's own logo image (base64 data URL) rides the published snapshot, ahead of 46-05's code that will actually transmit it.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-22T15:41:00-04:00 (approx)
- **Completed:** 2026-07-22T15:43:25-04:00
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `docs/DATA-FLOW-INVENTORY.md`'s existing Supabase row now names the maker's own business logo image (base64 data URL, present only when set) as part of the hosted-quote snapshot, plus a Notes entry cross-referencing D-09/D-11/RESEARCH A3 and confirming the `Cache-Control: no-store` posture is unchanged
- `src/pages/PrivacyPage.tsx`'s "What we collect" Pro-account-data bullet and the Processors → Supabase entry both now disclose the logo, framed as the maker's own brand asset (never customer PII)
- Added a content-lock guard test in `PrivacyPage.test.tsx` asserting the rendered policy mentions "business logo" and "white-label branding"

## Task Commits

Each task was committed atomically:

1. **Task 1: Update DATA-FLOW-INVENTORY.md** - `b19b2ac` (docs)
2. **Task 2: Update PrivacyPage + guard test** - `367bfd8` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `docs/DATA-FLOW-INVENTORY.md` - Supabase row extended + Notes entry added disclosing the maker logo in the hosted-quote snapshot
- `src/pages/PrivacyPage.tsx` - Published-hosted-quote passage and Supabase processor entry updated to disclose the logo/branding
- `src/pages/PrivacyPage.test.tsx` - New content-lock test asserting the logo/branding disclosure is present

## Decisions Made
- Logo disclosure rides the SAME existing Supabase destination row rather than adding a new inventory row — the logo is a data-element addition to an existing flow, not a new destination (RESEARCH A3: no new Supabase migration, logo joins the existing `hosted_quotes.snapshot` jsonb column)
- Kept the framing consistent with the existing "first name only, never full customer PII" pattern: the logo is explicitly the MAKER's own brand asset, not the customer's data
- Left the T-46-08 (logo in a CDN cache) threat as `accept` disposition per the plan's threat model — no code change needed since hosted responses are already `Cache-Control: no-store` from Phase 43

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan is documentation + a guard test only; no code that transmits the logo ships in this plan (that's plan 46-05, which now depends on this plan being committed first).

## Next Phase Readiness

- Inventory and Privacy Policy now both truthfully anticipate the logo-in-snapshot flow, satisfying the Wave-1 gate that plan 46-05 depends on
- 46-05 (which sends the logo server-side to Supabase) can now proceed — the "docs before code" ordering (Pitfall C-05) is preserved
- No blockers or concerns

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-22*

## Self-Check: PASSED

All created/modified files found on disk; both task commits (b19b2ac, 367bfd8) verified present in git log.
