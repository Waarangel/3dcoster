---
phase: 42-gdpr-onboarding
plan: 03
subsystem: legal
tags: [privacy-policy, terms-of-service, gdpr, react-router, lazy-loading, vitest]

# Dependency graph
requires:
  - phase: 42-01
    provides: Consent-gated analytics stack (src/components/consent/, src/utils/consent.ts, src/hooks/useConsent.ts) that this plan's Privacy Policy content must accurately describe
provides:
  - Privacy Policy page at /privacy naming every real data processor
  - Terms of Service page at /terms with concrete free-tier terms + generic Pro-tier framework
  - docs/DATA-FLOW-INVENTORY.md as the traceable source of truth for both pages and for Phase 43
  - Corrected FAQ copy (no more stale "no data collection" claim)
affects: [43-pro-backend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Legal pages generated from a maintained data-flow inventory (docs/DATA-FLOW-INVENTORY.md), not a generic template — inventory updated first, policy second (Pitfall C-05 defense)"
    - "Lazy marketing-page pattern extended to /privacy and /terms via lazyWithRetry, matching FAQPage/ChangelogPage"

key-files:
  created:
    - docs/DATA-FLOW-INVENTORY.md
    - src/pages/PrivacyPage.tsx
    - src/pages/PrivacyPage.test.tsx
    - src/pages/TermsPage.tsx
    - src/pages/TermsPage.test.tsx
  modified:
    - src/main.tsx
    - src/components/Footer.tsx
    - src/pages/FAQPage.tsx

key-decisions:
  - "Privacy Policy processor list traces line-by-line to docs/DATA-FLOW-INVENTORY.md, which was built from vercel.json's connect-src allowlist and cross-checked against every fetch( call site in src/ — covers Vercel (hosting + consent-gated Web Analytics), api.github.com, cdn.jsdelivr.net, latest.currency-api.pages.dev, api.frankfurter.dev, and formspree.io, plus on-device IndexedDB and a Supabase FORTHCOMING marker for Phase 43"
  - "Terms of Service Pro-tier section is deliberately generic (accounts, acceptable use, payment obligations, cancellation, data on termination) with zero hard-coded prices/cycles/refunds per D-06 — a currency-figure regex guard in TermsPage.test.tsx prevents an accidental price leak before Phase 43"
  - "FAQ 'Is 3DCoster really free?' answer reworded from an absolute 'no data collection' claim to an accurate statement pointing to the Privacy Policy for the limited, consent-gated analytics collected — the 'no account needed / data never leaves your device' answer about project data was left untouched since it remains accurate"

requirements-completed: [GDPR-02, GDPR-03]

coverage:
  - id: D1
    description: "/privacy renders a Privacy Policy naming every real data processor (Vercel, GitHub API, jsDelivr, both FX providers, Formspree, Supabase-forthcoming), the local-first story, and privacy@3dcoster.com contact"
    requirement: "GDPR-02"
    verification:
      - kind: unit
        ref: "src/pages/PrivacyPage.test.tsx#names every real processor from the data-flow inventory"
        status: pass
      - kind: unit
        ref: "src/pages/PrivacyPage.test.tsx#names the privacy contact address"
        status: pass
    human_judgment: false
  - id: D2
    description: "/terms renders free-tier terms plus a price-free Pro-tier framework, footer-linked from both /privacy and /terms"
    requirement: "GDPR-03"
    verification:
      - kind: unit
        ref: "src/pages/TermsPage.test.tsx#mentions both the free tier and the Pro tier"
        status: pass
      - kind: unit
        ref: "src/pages/TermsPage.test.tsx#does not contain a hard-coded Pro-tier price figure"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/DATA-FLOW-INVENTORY.md lists every external connect-src destination with data/collector/retention/legal-basis columns, cross-checked against grep fetch( src/"
    requirement: "GDPR-02"
    verification:
      - kind: other
        ref: "docs/DATA-FLOW-INVENTORY.md content review (manual grep cross-check performed at authoring time: grep -rn 'fetch(' src/)"
        status: pass
    human_judgment: false
  - id: D4
    description: "FAQ no longer contradicts the new Privacy Policy — 'no data collection' claim removed and replaced with an accurate statement pointing to the policy"
    verification:
      - kind: unit
        ref: "src/pages/FAQPage.tsx manual diff review — 'no data collection' phrase removed from the 'Is 3DCoster really free?' answer"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pre-deploy human prerequisite: privacy@3dcoster.com forwarding alias must exist before the production push that makes /privacy publicly reachable"
    verification: []
    human_judgment: true
    rationale: "Requires the founder to configure DNS/email forwarding outside this codebase — cannot be verified by an automated test."

duration: 12min
completed: 2026-07-10
status: complete
---

# Phase 42 Plan 03: Legal Pages (Privacy Policy + Terms of Service) Summary

**Privacy Policy and Terms of Service pages generated from a maintained data-flow inventory naming every real processor (Vercel, GitHub API, jsDelivr, two FX providers, Formspree, Supabase-forthcoming) — no generic template, no hard-coded Pro pricing.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-10T11:14:00Z
- **Completed:** 2026-07-10T11:26:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- `docs/DATA-FLOW-INVENTORY.md` created as the single source of truth for every external destination the app can reach — derived from `vercel.json`'s `connect-src` CSP and cross-checked against `grep -rn "fetch(" src/`
- `/privacy` renders a plain-English GDPR policy (what we collect, lawful basis, retention, data-subject rights, processors, contact) that leads with the local-first story and traces every processor back to the inventory
- `/terms` renders concrete free-tier terms plus a generic, price-free Pro-tier framework (accounts, acceptable use, payment, cancellation, data on termination) — Phase 43 will update this section with real billing specifics and a new effective date
- Both pages wired into `main.tsx` via `lazyWithRetry` and linked from the Footer's Legal column
- FAQ's stale "no data collection" claim replaced with accurate wording pointing to the Privacy Policy

## Task Commits

Each task was committed atomically:

1. **Task 1: docs/DATA-FLOW-INVENTORY.md + PrivacyPage.tsx (+ route, Footer link, smoke test)** - `89a75f9` (feat)
2. **Task 2: TermsPage.tsx (+ route, Footer link, smoke test) + FAQ copy fix** - `e0cae82` (feat)

_Note: no TDD-style multi-commit sequences were needed — both tasks are static content pages with smoke tests written and passed as part of the single commit each._

## Files Created/Modified
- `docs/DATA-FLOW-INVENTORY.md` - Table of every connect-src destination (what data / who collects / where it goes / retention / legal basis) plus on-device IndexedDB and a Supabase FORTHCOMING row
- `src/pages/PrivacyPage.tsx` - GDPR Privacy Policy page, lazy-loaded marketing-page pattern
- `src/pages/PrivacyPage.test.tsx` - Smoke test asserting the page renders and names every real processor + contact address
- `src/pages/TermsPage.tsx` - Terms of Service: concrete free tier + generic price-free Pro-tier framework
- `src/pages/TermsPage.test.tsx` - Smoke test asserting free/Pro tier mentions and guarding against a hard-coded price figure
- `src/main.tsx` - Registered `/privacy` and `/terms` lazy routes in the web-only Routes block
- `src/components/Footer.tsx` - Added "Privacy Policy" and "Terms of Service" links to the Legal column
- `src/pages/FAQPage.tsx` - Fixed the "Is 3DCoster really free?" answer to remove the absolute "no data collection" claim

## Decisions Made
- Privacy Policy processor list traces line-by-line to `docs/DATA-FLOW-INVENTORY.md` — built from the `connect-src` CSP allowlist, not a generic template
- ToS Pro-tier section stays fully generic (no prices/cycles/refunds); a regex guard in the test file catches an accidental price leak before Phase 43 fills in real numbers
- Left the FAQ's "Do I need to create an account?" and "Where is my data stored?" answers untouched — both describe project data specifically and remain accurate; only the absolute "no data collection" claim (which conflated project data with all data) needed correction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

**External services require manual configuration.** Per the plan's `user_setup` block: create a `privacy@3dcoster.com` forwarding alias to the owner inbox before the production deploy that makes `/privacy` publicly reachable. Code can ship first; this is a pre-deploy prerequisite, not a blocker for this plan's completion.

## Next Phase Readiness
- GDPR-02 and GDPR-03 requirements are code-complete; `docs/DATA-FLOW-INVENTORY.md` is ready to be updated first when Phase 43 (Pro Backend / Supabase) adds a new data destination, with the Privacy Policy updated second per the established discipline
- Phase 43's ToS update will replace the generic Pro-tier framework section with concrete billing specifics under a new effective date — no other changes to this plan's pages are anticipated
- Blocker for production: `privacy@3dcoster.com` alias must exist before the live deploy (human prerequisite, tracked above)

---
*Phase: 42-gdpr-onboarding*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created files verified present on disk; both task commits (`89a75f9`, `e0cae82`) verified present in git log.
