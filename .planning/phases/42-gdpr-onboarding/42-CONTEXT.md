# Phase 42: GDPR & Onboarding - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the app legally ready for the Pro-tier launch and give first-time users a guided path (GDPR-01, GDPR-02, GDPR-03, ONBD-01):

1. **Consent banner** — `vanilla-cookieconsent` v3 (locked in requirements + STACK.md research), equal-weight Accept All / Reject All on the first layer, one-click reject, granular categories, revocable without reload, consent stored; zero analytics scripts fire before opt-in; skipped entirely in the Tauri desktop build
2. **Legal pages** — published Privacy Policy naming every processor (Vercel, Supabase, FX API) + Terms of Service covering the Pro tier
3. **Onboarding wizard** — skippable, resumable, 3-step first-run flow (add printer → add filament → price first job) that auto-skips when a printer already exists in Dexie and never blocks returning users

**HARD GATE:** This phase must be live in production and network-verified (zero analytics requests before first consent click) before Phase 43 begins. Deploying it ships all staged v2.0 work (Phases 38–41) to production web — sequencing is decided below (D-13).

</domain>

<decisions>
## Implementation Decisions

### Consent banner (GDPR-01)
- **D-01: Full custom theme.** Override vanilla-cookieconsent v3's CSS variables to match the slate-900/blue-600 design system. The banner is the first thing an EU visitor sees — a stock white banner on the dark site reads as broken.
- **D-02: Revocation = Footer link + in-app Settings entry.** Marketing pages get a "Cookie settings" link in the shared `Footer`; the calculator (`/app` renders no Footer) gets a Cookie settings entry in its Settings tab. Both open the library's preferences modal; changes take effect without reload (success criterion 2).
- **D-03: Desktop ships ZERO analytics.** `<Analytics />` currently mounts unconditionally in `src/main.tsx` — including the Tauri build. Strip it from desktop entirely (`!__IS_TAURI__` gate): nothing to consent to → no banner needed, and it matches the local-first brand promise. This code lands now but reaches desktop users on a future tag (D-15).
- **D-04: Banner fires on every web route (marketing + /app); categories = Necessary (locked on) + Analytics.** Analytics runs site-wide, so consent must too. No Marketing category until a marketing script actually exists — no empty toggles (research anti-feature).

### Legal pages (GDPR-02, GDPR-03)
- **D-05: Claude drafts, user reviews.** Both pages drafted from the actual data-flow inventory (Vercel Analytics, Supabase eu-central-1, FX API, Formspree feedback) — not a generic template — with plain-English GDPR sections (data collected, lawful basis, retention, data-subject rights, processors, contact). User reviews line-by-line before ship. Lawyer review deferrable to before Pro billing goes live.
- **D-06: Full ToS now, Pro section generic.** Free-tier terms fully concrete; Pro section covers the framework (accounts, acceptable use, payment obligations, cancellation, data on termination) without hard-coded prices. Phase 43 fills in billing specifics as a ToS update with a new effective date.
- **D-07: Contact = privacy@3dcoster.com.** Dedicated alias forwarding to the user's inbox (user sets up the forward — flag as a human prerequisite in planning). Keeps legal mail out of feedback channels and personal addresses off public pages.
- **D-08: React pages + data-flow inventory.** `PrivacyPage.tsx` / `TermsPage.tsx` at `/privacy` and `/terms`, following the existing lazy-loaded marketing-page pattern (Header/Footer, `lazyWithRetry`). PLUS `docs/DATA-FLOW-INVENTORY.md` — a table of what data / who collects / where it goes / retention / legal basis that the policy text is generated from. This is the Pitfall C-05 defense: Phase 43 updates the inventory first, policy second.

### Onboarding wizard (ONBD-01)
- **D-09: Guided overlay on the real UI.** A floating step card navigates the user to the real tab for each step (Settings → add printer, Materials → add filament, Calculator → price a job) via the Phase 38 tab-in-URL routing, and advances when the real action completes. No duplicate mini-forms; the user learns the actual app. Resumable via `UserProfile.onboardingStep` (Dexie, NOT localStorage — Pitfall M-01); `onboardingCompletedAt` means never show again. Auto-skip when a printer already exists.
- **D-10: Core 3 steps only.** Add printer → add filament → price first job, exactly per the roadmap success criterion. No role/persona step (deferred).
- **D-11: Catalog quick-add tiles.** Printer and filament steps each show the top ~3 catalog entries as one-tap tiles plus a "mine isn't listed" path into the normal add form. Catalogs already exist (v1.7 printers, v1.8 materials).
- **D-12: Quiet finish + toast.** Step 3 completes when the first cost calculation shows; the overlay congratulates briefly via the existing `useToast` system ("You're ready — save this job or create a quote") and dismisses. No confetti dependency.

### Deploy & gate verification
- **D-13: UAT + review, then ONE production deploy.** Finish the Phase 42 build → `/gsd-verify-work` UAT → release-diff code review across the staged 38–42 work → user gives the explicit `DEPLOY_OK=1` go → single production push → verify the gate on live. Deploy timing remains the user's call; the phase is not complete until the gate is verified in production.
- **D-14: Gate verification = automated test + manual prod check.** A Playwright (or equivalent) test asserts (a) no analytics network requests fire pre-consent and (b) Reject All is one click — runnable against the local build. PLUS a documented manual DevTools network check on live production after deploy (fresh incognito visit, network tab, zero analytics requests before any consent click). Note: this introduces the project's first E2E tooling — keep it minimal and scoped to the consent gate; the full E2E milestone remains deferred.
- **D-15: No desktop release this phase.** The desktop Analytics strip + wizard land in the codebase now but ship to desktop users whenever the user next cuts a `v*` tag (their call, per release-cadence rule — likely with the Phase 45 launch). The web deploy is what the hard gate needs.

### Claude's Discretion
- Banner copy/tone, consent expiry duration, exact CSS-variable theming values
- Consent state shape/versioning in localStorage (first-party, no PII — per research; note vanilla-cookieconsent manages its own storage)
- Overlay component structure (research sketch: `OnboardingOverlay` / `OnboardingStep` / `useOnboarding`, mounted in App.tsx after ToastProvider, reading the already-subscribed `useUserProfile`) — adapt as the code dictates
- Quick-add tile selection (which top-3 printers/materials) and layout
- Skip affordance wording/placement (must exist on every step; skip persists permanently)
- Exact Playwright setup scope (minimal harness vs. single spec file)
- NEW-badge treatment (wizard is user-facing → register in `src/features.ts`; consent banner and legal pages are NOT features — no badges)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research
- `.planning/research/STACK.md` — Area 3: vanilla-cookieconsent v3 recommendation, why-not alternatives, React `useEffect` integration sketch, Tauri skip pattern, Vercel Analytics consent-scope note
- `.planning/research/PITFALLS.md` — C-04 (banner that is itself non-compliant: reject-parity, pre-ticked boxes, consent wall, dark-pattern contrast — includes the warning-sign checklist the gate test encodes), C-05 (privacy policy that doesn't match actual processing — the data-flow-inventory defense), M-01 (wizard blocking returning users — Dexie flag, not localStorage; check-before-write on seeding steps)
- `.planning/research/FEATURES.md` §7 — onboarding wizard: table stakes, quick-add differentiator, anti-features (never mandatory, ≤5 steps, no unanswerable questions, never re-show on reset)
- `.planning/research/FEATURES.md` §10 — GDPR launch bundle: sub-feature table, anti-features (no cookie wall, consent stored first-party, no premature marketing category)
- `.planning/research/ARCHITECTURE.md` §6 — consent layer pattern (component/hook/util split, AnalyticsGate in main.tsx, web-only mount) — note: discussion locked vanilla-cookieconsent as the engine, so adapt this sketch around the library rather than hand-rolling ConsentState
- `.planning/research/ARCHITECTURE.md` §7 — onboarding wizard architecture: UserProfile JSON fields need NO Dexie version bump, overlay-vs-route reasoning, `?onboarding=1` resumability, component structure

### Requirements & prior context
- `.planning/REQUIREMENTS.md` — GDPR-01, GDPR-02, GDPR-03, ONBD-01 exact wording
- `.planning/ROADMAP.md` — Phase 42 goal, 5 success criteria, hard-gate wording
- `.planning/phases/38-foundation/38-CONTEXT.md` — tab-in-URL registry the wizard's step navigation uses

### Source of truth in code
- `src/main.tsx` — `<Analytics />` unconditional mount (D-03/D-04 change site), route table, `lazyWithRetry` marketing-page pattern for `/privacy` + `/terms`, `__IS_TAURI__` branching precedent (`PwaUpdatePrompt`)
- `src/components/Footer.tsx` — Cookie settings + Privacy + Terms link placement (D-02)
- `src/types.ts` + `src/hooks/useDatabase.ts` — `UserProfile` shape (add `onboardingStep` / `onboardingCompletedAt`; JSON-in-settings, no version bump) and `updateUserProfile` / `useUserProfile`
- `src/components/ui/toast/` — `useToast` for the wizard completion toast (never hand-roll)
- `src/features.ts` — NEW-badge registry (wizard registration)
- `src/pages/` — existing marketing pages the legal pages pattern-match

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lazyWithRetry` marketing-page pattern** (`main.tsx`) — PrivacyPage/TermsPage slot straight in
- **`__IS_TAURI__` conditional-mount precedent** — `PwaUpdatePrompt` is already web-only; banner + Analytics follow the same gate
- **Phase 38 tab-in-URL routing** — the wizard overlay navigates real tabs per step
- **`UserProfile` JSON-in-settings** — onboarding fields are optional JSON keys; zero Dexie version bump (ARCHITECTURE §7)
- **Printer catalog (v1.7) + material catalog (v1.8)** — quick-add tiles read these directly
- **Empty-state components (v1.1)** — the wizard complements them; empty states remain for users who skip
- **`useToast`** — wizard completion message

### Established Patterns
- **No arbitrary numbers / no invented claims** — privacy policy content must trace to the data-flow inventory, which must trace to actual code behavior (C-05)
- **Suggestion-not-mutation** — wizard steps that write data check for existing data first; skip writes nothing (M-01)
- **Feature-level Dexie subscriptions** — the overlay reads the already-subscribed `useUserProfile`; no new props through App.tsx
- **Lazy-load discipline** — legal pages lazy-loaded; vanilla-cookieconsent is ~7 KB gz but verify the 300 KB gz main-chunk gate stays green
- **NEW-badge registry** — wizard registers in `src/features.ts`; absolute-overlay placement rules apply

### Integration Points
- `src/main.tsx` — consent manager mount (web-only), AnalyticsGate replacing bare `<Analytics />`, two new lazy routes
- `Footer.tsx` — Cookie settings / Privacy / Terms links
- App Settings tab — in-app Cookie settings entry (web-only)
- `App.tsx` — onboarding overlay mount (after ToastProvider), first-run detection via `useUserProfile`
- Phase 43 — updates `docs/DATA-FLOW-INVENTORY.md` + privacy policy + ToS billing section when Supabase goes live; Phase 44 sync format must include new UserProfile onboarding fields

</code_context>

<specifics>
## Specific Ideas

- The banner must pass the C-04 checklist verbatim: Accept All and Reject All identical visual weight on layer one, reject = exactly one click, zero analytics network requests before consent — this is also literally the shape of the gate test (D-14)
- Privacy policy should tell the local-first story proudly: "your jobs, materials, and customers live in your browser's IndexedDB on your device — we never see them" is both true and a brand differentiator generic templates would bury
- Wizard tone: guide, not gate — "Skip — I know what I'm doing" always visible, "You can change all of this in Settings" reassurance on each step
- privacy@3dcoster.com must exist before the policy page goes live (user action — planning should flag it as a human prerequisite)

</specifics>

<deferred>
## Deferred Ideas

- **Role/persona onboarding step** (hobbyist / Etsy seller / small business setting margin + marketplace defaults) — needs `userRole` field; revisit post-launch
- **First-job confetti celebration / milestone card** — retention hook if onboarding completion data warrants it
- **Marketing consent category** — add when an actual marketing/ad script exists (likely Pro launch)
- **Lawyer review of legal pages** — before Pro billing goes live (Phase 43/45 window)
- **ToS billing specifics** (price, cycle, refunds) — Phase 43 when pricing is final
- **Full E2E test milestone** — D-14 introduces only a minimal consent-gate spec; broader Playwright coverage stays a separate milestone
- **Desktop release carrying the Analytics strip + wizard** — user's call on the next `v*` tag (likely Phase 45 launch)

</deferred>

---

*Phase: 42-gdpr-onboarding*
*Context gathered: 2026-07-09*
