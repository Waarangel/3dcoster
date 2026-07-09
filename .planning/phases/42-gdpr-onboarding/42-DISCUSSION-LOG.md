# Phase 42: GDPR & Onboarding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 42-gdpr-onboarding
**Areas discussed:** Consent banner look & reach, Legal pages content & review, Onboarding wizard experience, Production deploy & gate verification

---

## Consent banner look & reach

| Option | Description | Selected |
|--------|-------------|----------|
| Full custom theme | Override library CSS variables to match slate-900/blue-600 design system | ✓ |
| Light touch — dark preset only | Use the built-in `cc--darkmode` class, near-zero CSS work | |
| You decide | Claude picks during planning | |

**User's choice:** Full custom theme

| Option | Description | Selected |
|--------|-------------|----------|
| Footer + in-app Settings | Marketing Footer link + Settings-tab entry (/app renders no Footer) | ✓ |
| Footer only | Standard placement, but app users must leave /app to revoke | |
| Floating badge | Persistent fingerprint icon on every page | |

**User's choice:** Footer + in-app Settings

| Option | Description | Selected |
|--------|-------------|----------|
| Strip Analytics from desktop | Desktop ships zero analytics; nothing to consent to → no banner needed | ✓ |
| Keep Analytics on desktop | Retain aggregate signal, but legally shaky without a consent path | |
| You decide | Claude picks during planning | |

**User's choice:** Strip Analytics from desktop
**Notes:** Scout finding that prompted the question — `<Analytics />` mounts unconditionally in `src/main.tsx`, including the Tauri build.

| Option | Description | Selected |
|--------|-------------|----------|
| Everywhere, 2 categories | Banner on every web route; Necessary (locked) + Analytics | ✓ |
| Everywhere, 3 categories | Add Marketing category now for future-proofing | |
| Marketing pages only | Banner only outside /app (would require stripping analytics from /app) | |

**User's choice:** Everywhere, 2 categories

---

## Legal pages content & review

| Option | Description | Selected |
|--------|-------------|----------|
| Claude drafts, you review | Draft from actual data-flow inventory; user reviews line-by-line; lawyer deferrable to pre-Pro-billing | ✓ |
| Claude drafts, lawyer reviews | Professional review before publish — cost + delay | |
| Generator service | iubenda/Termly output — generic, misses the local-first story | |

**User's choice:** Claude drafts, you review

| Option | Description | Selected |
|--------|-------------|----------|
| Full ToS, Pro section generic | Free tier concrete; Pro framework terms without hard-coded prices; Phase 43 updates billing specifics | ✓ |
| Free-tier ToS only | Leaves GDPR-03 technically unmet | |
| Full ToS incl. draft pricing | Locks pricing language before Phase 43 validates it | |

**User's choice:** Full ToS, Pro section generic

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated privacy@ email | privacy@3dcoster.com alias forwarding to user's inbox | ✓ |
| Existing feedback channel | Formspree + public email — messy for GDPR response deadlines | |
| Personal email | Personal address on a public legal page permanently | |

**User's choice:** Dedicated privacy@ email
**Notes:** User must set up the alias — flagged as a human prerequisite in CONTEXT.md.

| Option | Description | Selected |
|--------|-------------|----------|
| React pages + data-flow inventory | PrivacyPage/TermsPage per existing pattern + docs/DATA-FLOW-INVENTORY.md as the C-05 defense | ✓ |
| React pages only | No inventory doc; relies on memory when Phase 43 adds data flows | |
| Markdown-driven | Markdown-rendered legal text; adds a dependency for two pages | |

**User's choice:** React pages + data-flow inventory

---

## Onboarding wizard experience

| Option | Description | Selected |
|--------|-------------|----------|
| Guided overlay on real UI | Floating step card navigates real tabs via Phase 38 routing; advances on real action completion | ✓ |
| Self-contained full-screen wizard | Dedicated steps with duplicate mini-forms | |
| Hybrid: welcome modal + overlay | Full-screen welcome, then guided overlay | |

**User's choice:** Guided overlay on real UI

| Option | Description | Selected |
|--------|-------------|----------|
| Core 3 steps only | Add printer → add filament → price first job, per roadmap criterion | ✓ |
| 3 steps + role selector | Persona step setting margin/marketplace defaults (needs userRole field) | |
| You decide | Claude weighs during planning | |

**User's choice:** Core 3 steps only

| Option | Description | Selected |
|--------|-------------|----------|
| Quick-add tiles | Top ~3 catalog printers/materials as one-tap tiles + "mine isn't listed" path | ✓ |
| Normal add flows only | Overlay points at existing add buttons; full forms twice before value | |
| You decide | Claude decides during planning | |

**User's choice:** Quick-add tiles

| Option | Description | Selected |
|--------|-------------|----------|
| Quiet finish + toast | Completes on first cost calc; brief toast congratulation; no confetti dependency | ✓ |
| Confetti celebration | One-time confetti + milestone card on first saved job | |
| You decide | Claude picks during planning | |

**User's choice:** Quiet finish + toast

---

## Production deploy & gate verification

| Option | Description | Selected |
|--------|-------------|----------|
| UAT + review, then one deploy | Build → UAT → release-diff review of staged 38–42 → explicit DEPLOY_OK → single push → verify gate live | ✓ |
| Deploy 42 work sooner | Push once banner + legal pages built, before full UAT | |
| Decide at the time | Defer the sequencing decision | |

**User's choice:** UAT + review, then one deploy

| Option | Description | Selected |
|--------|-------------|----------|
| Automated test + manual prod check | Playwright spec (no pre-consent analytics requests + one-click reject) + documented manual DevTools check on live | ✓ |
| Manual production check only | Written checklist, no new test tooling | |
| You decide | Claude weighs E2E tooling vs. checklist | |

**User's choice:** Automated test + manual prod check
**Notes:** Introduces the project's first E2E tooling — scoped minimal to the consent gate; full E2E milestone stays deferred.

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to a later release | Desktop Analytics strip + wizard ship on the user's next v* tag (likely Phase 45) | ✓ |
| Desktop release in this phase | Cut a v2.0-line tag after Phase 42 verifies | |
| Decide at the time | Revisit after UAT | |

**User's choice:** Defer to a later release

---

## Claude's Discretion

- Banner copy/tone, consent expiry duration, CSS-variable theming values
- Consent state storage details (library-managed, first-party)
- Overlay component structure (adapt ARCHITECTURE §7 sketch to the code)
- Quick-add tile selection and layout
- Skip affordance wording/placement (must exist on every step, persists permanently)
- Playwright setup scope (minimal harness vs. single spec)
- NEW-badge treatment (wizard badged; banner/legal pages not features)

## Deferred Ideas

- Role/persona onboarding step (hobbyist / Etsy / business defaults; needs `userRole`)
- First-job confetti celebration / milestone card
- Marketing consent category (when a marketing script exists)
- Lawyer review of legal pages (before Pro billing)
- ToS billing specifics (Phase 43)
- Full E2E test milestone (beyond the consent-gate spec)
- Desktop release carrying Analytics strip + wizard (user's next tag)
