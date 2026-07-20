# Roadmap: 3DCoster

**Project:** 3D printing cost calculator (Web + Tauri desktop) — local-first, free tier.
**Status:** v2.0 Cost-Truth & Insight — **IN PROGRESS** (roadmap created 2026-07-03, Phases 38–45). Run `/gsd:plan-phase 38` to begin.

---

## Milestones

- ✅ **v1.0 Multi-Material Support** — Phases 1–6 (shipped 2026-04-15) — pre-GSD-archive
- ✅ **v1.1 Polish & Foundation** — Phases 7–11 (shipped 2026-05-20) — pre-GSD-archive
- ✅ **v1.2 Quote-to-Customer** — Phases 12–17 (shipped 2026-05-25) — [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Hardening** — Phases 18–26 (shipped 2026-05-28) — [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- ⚠️ **v1.4 – v1.7 — shipped OUTSIDE GSD** (ad-hoc, 2026-05-29 → 2026-06-19). GSD management lapsed after v1.3; these were tracked via CHANGELOG + ad-hoc planning, not GSD phases. Highlights: v1.5 CSV export + roadmap page; v1.6 backup/restore + 3dcoster.com + CSP; v1.7 **Linux desktop builds** + 12 printers + calculator correctness fixes.
- ✅ **v1.8 Inventory & Sales Reporting** — Phases 27–32 (shipped 2026-06-25, desktop tag `v1.8.0`). **GSD revived here.** Material inventory tracking (#20) + PDF sales report (#33) + filament-picker search + off-by-100× rate warnings.
- ✅ **v1.9 Hardening** — Phases 34–37 (shipped 2026-07-03, desktop tag `v1.9.0`) — [milestones/v1.9-ROADMAP.md](milestones/v1.9-ROADMAP.md). 14/15 requirements (PERF-11 deferred to v2.0). Data-loss + marketplace-fee/FX + net-margin fixes, A11Y Tier 4, perf, 0 CVEs.
- 🔨 **v2.0 Cost-Truth & Insight** — Phases 38–45 (in progress, started 2026-07-03). Cost-Truth engine + hosted/Pro backend + GDPR + marketing redesign.

> **Phase-numbering note:** v1.9 used Phases 34–37. Phase 33 was originally scoped on the standalone `feat/insight-pricing-coach` branch and has since been **absorbed into Phase 40** (Insight Layer, 2026-07-08) — its pure math utils were ported into Phase 40 Plan 01 and its records archived at [phases/33-insight-pricing-coach/](phases/33-insight-pricing-coach/); the branch is retired. v2.0 starts at **Phase 38** to avoid collision with the old Phase 33 number.

---

## Phases

<details>
<summary>✅ v1.9 Hardening (Phases 34–37) — SHIPPED 2026-07-03</summary>

- [x] Phase 34: Live papercut fixes (2/2 plans) — completed 2026-06-25
- [x] Phase 35: Accessibility Tier 4 (5/5 plans) — completed 2026-06-26
- [x] Phase 36: Performance Tier 5 (2/2 plans) — completed 2026-06-26
- [x] Phase 37: Code health (STRETCH) (2/2 plans) — completed 2026-06-26

**Outcome:** 11 plans, 14/15 requirements (PERF-11 reverted as a pricing regression → v2.0). Plus release-review/audit/UAT-driven fixes: Asset-Library scoped reset (data-loss), deleted-defaults persistence, marketplace-fee FX + net margin, 19→0 CVEs. See [milestones/v1.9-ROADMAP.md](milestones/v1.9-ROADMAP.md).

</details>

<details>
<summary>✅ v1.3 Hardening (Phases 18–26) — SHIPPED 2026-05-28</summary>

- [x] Phase 18: Tauri fs:scope fix (1/1 plans) — completed 2026-05-25
- [x] Phase 19: Modal primitive + a11y migration (6/6 plans) — completed 2026-05-26
- [x] Phase 20: Dexie atomicity audit (4/4 plans) — completed 2026-05-26
- [x] Phase 21: CSV + URL security (3/3 plans) — completed 2026-05-27
- [x] Phase 22: JobsManager decomposition + perf (6/6 plans) — completed 2026-05-27
- [x] Phase 22.1: Break-even formula reconciliation (INSERTED) (4/4 plans) — completed 2026-05-27
- [x] Phase 23: Test coverage hardening (4/4 plans) — completed 2026-05-28
- [x] Phase 24: Nyquist contracts + Phase 13 visual UAT + Phase 18 review carryover (6/6 plans) — completed 2026-05-25
- [x] Phase 25: Doc + hygiene + polish + bundle health (5/5 plans) — completed 2026-05-26
- [x] Phase 26: v1.3 cleanup (INSERTED — closes audit tech_debt before tag) (4/4 plans) — completed 2026-05-28

**Outcome:** 43 plans, 56 tasks, 53 requirements satisfied. Audit verdict: passed. See [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) for phase-by-phase delivery + [milestones/v1.3-MILESTONE-AUDIT.md](milestones/v1.3-MILESTONE-AUDIT.md) for the closure audit.

</details>

<details>
<summary>✅ v1.8 Inventory & Sales Reporting (Phases 27–32) — SHIPPED 2026-06-25</summary>

Material inventory tracking (#20: stockEvents ledger, deduct-on-job, low-stock badges) + PDF sales report (#33: dedicated Reports tab, month/quarter/year/YTD/custom, branded PDF + CSV) + filament-picker search + Bambu PLA Pure + off-by-100× rate warnings + fuel-price per-gallon fix. Desktop tag `v1.8.0`; full 3-reviewer release-diff review (0 CRITICAL). Phase 33 lives on an in-flight branch (not on this branch).

</details>

<details>
<summary>✅ v1.2 Quote-to-Customer (Phases 12–17) — SHIPPED 2026-05-25</summary>

See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) — 7 phases (includes inserted Phase 15.1 Customer Library + closure Phase 17 PDF-04 fix), 45 plans, 30 requirements (28 satisfied, 2 withdrawn).

</details>

<details>
<summary>✅ v1.1 Polish & Foundation (Phases 7–11) — SHIPPED 2026-05-20</summary>

Pre-GSD-archive. Phase artifacts under `.planning/phases/07-styling-primitives-pass` through `.planning/phases/11-performance-optimization`.

</details>

<details>
<summary>✅ v1.0 Multi-Material Support (Phases 1–6) — SHIPPED 2026-04-15</summary>

Pre-GSD-archive. Phase artifacts under `.planning/phases/01-data-foundation` through `.planning/phases/06-3mf-multi-plate-project-import`.

</details>

### v2.0 Cost-Truth & Insight (Phases 38–45) — IN PROGRESS

- [ ] **Phase 38: Foundation** - CostCalculator split + PERF-11 fix + tab-in-URL routing
- [x] **Phase 39: Cost Realism** - Failure-cost engine, TOU electricity, maintenance amortization
- [x] **Phase 40: Insight Layer** - Insights tab with hourly wage, printer ROI, what-if simulator (completed 2026-07-09)
- [x] **Phase 41: Quick-Win Features** - Reprice alerts, spool lifecycle, tax threshold tracker, Quote Variants PDF (completed 2026-07-09)
- [ ] **Phase 42: GDPR & Onboarding** - Consent banner, privacy policy, terms, guided first-run wizard
- [x] **Phase 43: Pro Backend** - Supabase auth, hosted quote pages, Pro subscription billing (completed 2026-07-16)
- [x] **Phase 44: Sync & STL Instant Quote** - File-based device sync, STL volume estimate to calculator (completed 2026-07-19)
- [ ] **Phase 45: Brand & Launch** - Cost-Truth Dark redesign merge, Pro pricing copy

---

## Phase Details

### Phase 38: Foundation

**Goal**: The calculator codebase is restructured so every new feature has a clean surface to attach to — no more God-component debt, no pricing desync, and browser navigation works within the app
**Depends on**: Nothing (first v2.0 phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03
**Success Criteria** (what must be TRUE):

  1. Calculator behavior is byte-identical before and after the split — output-equivalence tests with N known inputs all pass, and consecutive same-field keystrokes never desync the displayed profit/margin
  2. The calculator codebase is split into useCostForm, useCostDerivedValues, and ~4 section components; CostCalculator.tsx orchestrator is ~150 LOC and holds no business logic
  3. User can navigate between calculator, jobs, customers, reports, and settings tabs without the URL changing to the marketing landing page — pressing browser Back while inside the app moves between tabs, not to the marketing site
  4. The URL reflects the active tab (`/app?tab=calculator`, `/app?tab=jobs`, etc.) so tab links are bookmarkable and shareable

**Plans**: 4 plans in 3 waves

- [x] 38-01-PLAN.md — Golden fixtures + sequence/render-count tests captured from the CURRENT component (FOUND-01/02)
- [x] 38-02-PLAN.md — Tab-in-URL via useSearchParams; Back navigates tabs, invalid ?tab= falls back (FOUND-03)
- [x] 38-03-PLAN.md — Extract useCostForm + useCostDerivedValues with the useReducer PERF-11 fix (FOUND-01/02)
- [x] 38-04-PLAN.md — Section components + orchestrator shrink to zero-business-logic ~150 LOC (FOUND-01)

**Research flag**: REQUIRED before planning — useCostDerivedValues dep-array design and useReducer vs refined useEffect patterns for the pricing interlink are the highest-risk technical decisions in the milestone. Output-equivalence test strategy must be settled before code is touched.

### Phase 39: Cost Realism

**Goal**: Users can log print failures and maintenance events and see those real costs folded into their calculator's true cost — giving them an empirical failure rate no competitor offers
**Depends on**: Phase 38
**Requirements**: FAIL-01, FAIL-02, FAIL-03, FAIL-04, TOU-01, TOU-02, WEAR-01, WEAR-02
**Success Criteria** (what must be TRUE):

  1. User can log a print failure in one tap from a job — specifying % completion, printer, and material — and the entry appears in a failure history ledger they can review per printer and per material
  2. The calculator shows the user's empirical failure rate (derived from their ledger) alongside their manual failure-rate input as a suggestion; clicking "Apply" sets the manual input; history re-saved jobs are not silently repriced
  3. User can define peak/off-peak electricity tariff windows in Settings; jobs that specify a print start time use the weighted tariff for their electricity cost, with the flat rate as the default
  4. User can log a maintenance event (nozzle/belt/bed swap with cost, date, and printer-hours) and see cumulative abrasive-material hours tracked for CF/GF filaments on brass nozzles
  5. The maintenance log amortizes into a real cost-per-hour per printer that appears in the calculator, and the app predicts the next likely swap date

**Plans**: 5 plans in 3 waves

- [x] 39-01-PLAN.md — Foundation: db.version(12) stores, types/snapshot fields, backup inclusion, event hooks, TOU math, NEW-badge keys (FAIL-01/TOU-01/TOU-02/WEAR-01)
- [x] 39-02-PLAN.md — Failure engine: empirical rate derivation, LogFailureModal, JobsManager log action, Reports Failures ledger (FAIL-01/FAIL-02/FAIL-04)
- [x] 39-03-PLAN.md — TOU config: Settings tariff-band editor + reconcile helper (TOU-01)
- [x] 39-04-PLAN.md — Maintenance/wear: abrasive detection, amortization/prediction, LogMaintenanceModal, Printer Settings drill-in (WEAR-01/WEAR-02)
- [x] 39-05-PLAN.md — Calculator convergence: TOU-weighted electricity, maintenance $/hr + abrasive surcharge, 3 Apply-gated hints, extended golden fixtures (FAIL-02/FAIL-03/TOU-02/WEAR-02)
- [x] 39-06-PLAN.md — Gap closure: HH:MM text-input TOU band editor + calculator start-time picker, feedback-driven Add-band gate, real add-band interaction tests (TOU-01/TOU-02)

### Phase 40: Insight Layer

**Goal**: Users can see decision-grade analytics derived from their existing jobs and sales data — without entering anything new
**Depends on**: Phase 38
**Requirements**: INS-01, INS-02, INS-03
**Success Criteria** (what must be TRUE):

  1. User can open an Insights tab (visible in the app's tab bar, behind the URL-based routing from Phase 38) and see a ranked list of their products by profit per printer-hour, with the top and bottom earners clearly distinguished
  2. User can see a per-printer payback tracker showing cumulative NET PROFIT against its purchase cost, expressed as "paid off" or "net +/- $X"
  3. User can open a what-if simulator for a saved job and move sliders for filament price, electricity rate, and failure rate to see live margin response — without overwriting the saved job

**Plans**: 5 plans in 4 waves
**Wave 1**

- [x] 40-01-PLAN.md — Foundation math: port Phase 33 utils, insights.ts ranking/wage/payback/what-if derivations (INS-01/02/03)
- [x] 40-02-PLAN.md — Extract shared PeriodPicker + resolveDateRange from ReportsSection (INS-01, D-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 40-03-PLAN.md — Insights tab + true-hourly-wage headline + product ranking + target-wage setting (INS-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 40-04-PLAN.md — Per-printer payback/ROI cards + PrinterSettings recovery-bar reconciliation (INS-02, D-16)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 40-05-PLAN.md — What-if simulator (3 sliders, 2 entry points) + Phase 33 branch retirement + ROADMAP D-05 fix (INS-03)

**UI hint**: yes
**Note**: Success criterion 2 wording corrected to cumulative NET PROFIT (per D-05) as a task inside 40-05.

### Phase 41: Quick-Win Features

**Goal**: Users get four high-value free-floor features that each deliver value in under a minute of interaction, all local, all without a backend
**Depends on**: Phase 38
**Requirements**: CONN-01, CONN-03, LIFE-01, LIFE-02
**Success Criteria** (what must be TRUE):

  1. When a material price changes in the Asset Library, the app flags any saved job whose margin now falls below the user's target — the alert names the affected jobs and shows old vs new margin
  2. User can generate a Quote Variants PDF from an existing quote — 1pc, 10pc, and 50pc tiered pricing in one branded document, using the existing jsPDF quote engine
  3. User can record an opened date, drying sessions, and storage location for a spool and see a moisture-risk indicator (HIGH/MEDIUM/LOW) derived from the material's hygroscopicity class and time since opening
  4. User can set their jurisdiction and see a progress bar toward their local hobby-to-business tax threshold (UK £1k, DE Kleinunternehmer, AU GST, US badge note), with an alert when cumulative revenue crosses it — marked "not tax advice" throughout

**Plans**: 5 plans in 3 waves

**Wave 1**

- [x] 41-01-PLAN.md — Shared spine: Asset/Quote/UserProfile optional fields + HygroscopicityClass/TaxJurisdiction unions, 4 NEW-badge keys, backup DATE_FIELDS gap (no Dexie bump) (CONN-01/CONN-03/LIFE-01/LIFE-02)

**Wave 2** *(blocked on Wave 1)*

- [x] 41-02-PLAN.md — Reprice alerts: pure scan (reuses buildCalcInputFromJob + priceFromMargin), RepriceReviewModal, Asset-Library save-handler toast→modal→Apply (CONN-01)
- [x] 41-04-PLAN.md — Quote Variants: PDF tier-table branch, PrintQuoteModal variants section, Convert-to-Sale tier picker (CONN-03)
- [x] 41-05-PLAN.md — Tax-threshold tracker: jurisdiction-aware year window + gross-revenue sum, Insights card, Settings jurisdiction picker (LIFE-02)

**Wave 3** *(serialized after 41-02 — both edit AssetLibrary.tsx)*

- [x] 41-03-PLAN.md — Spool lifecycle: hygroscopicity resolver + moisture-risk table, filament-card badge + one-tap drying, edit-modal Spool section (LIFE-01)

**UI hint**: yes

### Phase 42: GDPR & Onboarding

**Goal**: The app is legally ready for Pro-tier launch — consent is granular and revocable, legal pages exist, and first-time users have a guided path that never blocks returning users
**Depends on**: Phases 38, 41 (onboarding reads existing data; GDPR must precede any backend call)
**Requirements**: GDPR-01, GDPR-02, GDPR-03, ONBD-01
**Success Criteria** (what must be TRUE):

  1. A first-time visitor to the web app sees a consent banner where "Accept All" and "Reject All" are at identical visual weight on the first layer — clicking Reject All takes exactly one click and fires no analytics scripts before that consent is given
  2. A returning user who previously rejected can find a "Cookie settings" link, change their consent, and have that choice take effect on the current page without a reload
  3. The Tauri desktop app shows no consent banner — cookie consent is web-only and skipped entirely in the desktop build
  4. The site has a published Privacy Policy page naming every data processor (Vercel, Supabase, FX API) and a Terms of Service page covering the Pro tier
  5. A first-run web or desktop user sees a skippable, 3-step onboarding wizard (add printer → add filament → price first job) that auto-skips if a printer already exists in Dexie, and can be resumed if partially completed

**Plans**: 5 plans in 2 waves (1 gap-closure)

**Wave 1**

- [x] 42-01-PLAN.md — Consent banner: vanilla-cookieconsent v3 (opt-in, equal-weight Accept/Reject), useConsent store, AnalyticsGate (mount-gate + revoke cleanup), web-only mount (desktop strips Analytics), Footer + SettingsModal cookie-settings entries (GDPR-01)
- [x] 42-02-PLAN.md — Onboarding wizard: UserProfile onboarding fields + useOnboarding (auto-skip on owned printer instance, Dexie-not-localStorage), OnboardingOverlay/Step 3-step guided real-UI flow, App.tsx mount + NEW-badge (ONBD-01)
- [x] 42-05-PLAN.md — Gap closure (UAT test 1, major): step-0 tile onClick awaits addInstance then advanceStep(1) directly (mirrors filament tile), fixing the shouldShow/auto-advance same-render race that unmounted the wizard + never persisted onboardingStep; adds a non-mocked real-Dexie (fake-indexeddb) regression test for tile-click → advance → reload-resume (ONBD-01)

**Wave 2** *(blocked on 42-01 — shared main.tsx / Footer.tsx / package.json)*

- [x] 42-03-PLAN.md — Legal pages: docs/DATA-FLOW-INVENTORY.md (full connect-src processor list), PrivacyPage + TermsPage (lazy marketing-page pattern), Footer links, FAQ "no data collection" fix; privacy@3dcoster.com human prerequisite (GDPR-02/GDPR-03)
- [x] 42-04-PLAN.md — E2E consent gate: @playwright/test (SUS human-verify checkpoint) + chromium, playwright.config.ts (:4173 preview), consent-gate.spec (zero pre-consent beacons, one-click reject, equal-weight buttons), docs/GATE-VERIFICATION.md manual prod check (GDPR-01 / D-14)

**UI hint**: yes
**Hard gate**: This phase must ship and be live in production before Phase 43 begins. Do not proceed to Pro backend until the consent banner is confirmed live and network-verified (zero analytics requests before first consent click).

### Phase 43: Pro Backend

**Goal**: Users with a Pro account can publish a quote as a live hosted link their customer can view and approve — and can subscribe to Pro billing — without any of this touching the free-floor calculator
**Depends on**: Phase 42 (GDPR hard gate)
**Requirements**: PRO-01, PRO-02, PRO-03, PRO-04
**Success Criteria** (what must be TRUE):

  1. A user can create a Pro account via magic-link email — no password; the free calculator loads and saves normally when signed out, with no auth-gated features in the free-floor path
  2. A Pro user can click "Share quote" on a saved quote and get a hosted URL (3dcoster.com/q/[uuid-v4-token]) that a customer can open without an account to view the quote line items and approve or decline
  3. The maker can unpublish a hosted quote at any time, after which the URL returns a 404 — and hosted quote URLs are non-enumerable (UUID v4, no sequential IDs, noindex headers on all /q/* routes)
  4. A Pro user can subscribe to the Pro tier, view their billing status, and cancel — with the price anchored against 3DPrintQuote's €9.90/mo

**Plans**: 7 plans (4 waves)
Plans:
**Wave 1**

- [x] 43-01-PLAN.md — Supabase schema, RLS/RPC & schema push (hosted_quotes + entitlements, SECURITY DEFINER RPCs, [BLOCKING] db push) [wave 1]
- [x] 43-02-PLAN.md — Compliance docs & network CSP/routing (inventory-first, CSP for Supabase+Paddle, /q/ + /api/ rewrite exclusion, Privacy + ToS pricing) [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 43-03-PLAN.md — Pro auth, account UX & client bootstrap (magic-link, web-only gate, free-floor no-network E2E) [wave 2]
- [x] 43-05-PLAN.md — Hosted quote page, approve/decline & approval email (branded 404/noindex, non-enumerability tests) [wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 43-04-PLAN.md — Publish/unpublish + Quote publish metadata + in-app status refresh (PRO-02) [wave 3]
- [x] 43-06-PLAN.md — Pro subscription billing via Paddle MoR (checkout, signature-verified webhook → entitlements) [wave 3]

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 43-07-PLAN.md — PRO-03 formal security review gate + phase verification [wave 4]

**Research flag**: SATISFIED — see 43-RESEARCH.md. Supabase magic-link (PKCE, localStorage session on pure SPA; httpOnly-cookie session deferred with Tauri keyring per D-12 web-first), RLS non-enumerability via SECURITY DEFINER RPC (anon table SELECT revoked), and Paddle Billing (MoR) selected. Backend Supabase eu-central-1 locked per REQUIREMENTS.md.
**Security gate**: PRO-03 requires a formal security review before the hosted quote endpoint ships to production (non-enumerable URLs, RLS verified, no PII in CDN caches).

### Phase 44: Sync & STL Instant Quote

**Goal**: Users can sync their data between devices using their own cloud folder, and can get an instant estimated cost from an STL upload — both free, both local, no backend required
**Depends on**: Phase 43 (sync export format must include all v2.0 Dexie stores in their final shape, which Phase 43 finalizes)
**Requirements**: SYNC-01, CONN-02
**Success Criteria** (what must be TRUE):

  1. User can export their full database as a structured JSON file (including all v2.0 stores: failureEvents, maintenanceEvents) and import it on another device, with the app checking schema version before writing and rejecting incompatible exports with a clear message
  2. An import on a device with existing data applies last-write-wins semantics — newer records win; user is shown a summary of what changed before committing
  3. User can upload an STL or 3MF file and see an estimated filament weight and material cost pre-filled into the calculator — with an explicit infill-percentage input, a units-detection warning (mm vs inches), a non-manifold mesh warning if applicable, and a visible "this is an estimate — review before quoting" disclaimer
  4. The STL/3MF parsing never blocks the main thread or adds to the main bundle — Three.js loads only when the user initiates an upload (dynamic import, same CI gate as jsPDF)

**Plans**: 6 plans in 3 waves

**Wave 1** *(independent foundations, parallel)*

- [x] 44-01-PLAN.md — Sync contract + LWW/tombstone merge core (pure) + both NEW-badge keys (SYNC-01, D-05/06/07)
- [x] 44-02-PLAN.md — STL mesh math (volume/area/non-manifold/shells+infill/units) + three lazy chunk + CI gate (CONN-02, D-10/13/14/15/16)

**Wave 2** *(blocked on Wave 1)*

- [x] 44-03-PLAN.md — Sync write-layer: db v13 syncTombstones, centralized updatedAt stamping, applyMerge transaction (SYNC-01, D-05/06)
- [x] 44-04-PLAN.md — Sync IO: Web Locks critical section, atomic read/write, Tauri persisted-scope + folder picker (SYNC-01, D-01/02)
- [x] 44-05-PLAN.md — STL worker + MeshEstimateCard (preview/infill/warnings/Apply) + drop-zone routing (CONN-02, D-09/11/12)

**Wave 3** *(blocked on 44-03 + 44-04)*

- [x] 44-06-PLAN.md — Sync UI + orchestration: Backup/Restore/Sync tab, merge summary, debounced auto-write, launch merge check, pre-merge undo (SYNC-01, D-01/02/03/04/07/08)

**Research flag**: SATISFIED — see 44-RESEARCH.md. Web Locks API (not BroadcastChannel) provides the multi-tab mutex; web writes are atomic via createWritable(); desktop needs write-temp-then-rename + tauri-plugin-persisted-scope (without it D-01's "pick once" breaks on restart); tombstone-based LWW extends the existing backup/restore contract. STL/3MF mesh math runs in a Web Worker with three lazy-loaded behind the same CI gate as jsPDF.
**UI hint**: yes

### Phase 45: Brand & Launch

**Goal**: The marketing site wears the Cost-Truth Dark visual system and the Pro pricing is real — 3DCoster launches as a product, not a side project
**Depends on**: Phase 43 (Pro pricing numbers must exist before the redesign can fill the pricing spots)
**Requirements**: BRAND-01
**Success Criteria** (what must be TRUE):

  1. The Cost-Truth Dark marketing site design (from branch `test/design-skills-experiment`) is live on main — including the updated DownloadPage and FAQPage with v2.0 Linux correctness ported from v1.7+
  2. The three Pro pricing spots on the marketing site show real numbers (not placeholders), anchored against the €9.90/mo 3DPrintQuote benchmark — and those numbers match the Supabase billing configuration from Phase 43

**Plans**: 11 plans in 6 waves

**Wave 1**

- [x] 45-01-PLAN.md — Brand foundation: slate-safe token cascade + .theme-brand-dark scope, self-hosted font, motion primitives, MarketingThemeScope mount (BRAND-01, D-01/02)

**Wave 2**

- [x] 45-02-PLAN.md — Shared chrome: token-scoped ui primitives + support toast variant + Header (/pricing nav) + Footer (BRAND-01, D-02)

**Wave 3** *(parallel)*

- [x] 45-03-PLAN.md — Pricing spine: src/pricing.ts constant + /pricing page + byte-match guard (BRAND-01, D-06/09/10)
- [x] 45-06-PLAN.md — DownloadPage + FAQPage: Linux correctness + content reconciliation (BRAND-01)
- [x] 45-07-PLAN.md — ChangelogPage (isSafeHttpUrl) + RoadmapPage (D-13 refresh) + FeedbackPage (BRAND-01, D-13)
- [x] 45-08-PLAN.md — Legal restyle: Privacy + Terms + cookie banner, content byte-identical (BRAND-01, D-12)
- [x] 45-09-PLAN.md — SupportNudge retargeted to Pro + wire into save-success paths (BRAND-01, D-03)

**Wave 4** *(needs pricing constant)*

- [x] 45-04-PLAN.md — LandingPage port + Pro teaser + four-pillar headline (BRAND-01, D-07/11)
- [x] 45-05-PLAN.md — FeaturesPage port + Pro column + fix stale "no Pro tier" copy (BRAND-01, D-08/11)

**Wave 5**

- [x] 45-10-PLAN.md — Docs (PRODUCT/DESIGN) + v2.0.0 release prep (no tag) + launch-comms kit (BRAND-01, D-05/16/18)

**Wave 6**

- [x] 45-11-PLAN.md — Targeted release review (D-17) + branch archive/retirement (BRAND-01, D-01/17)

**UI hint**: yes

---

## Progress

### v2.0 Cost-Truth & Insight (Phases 38–45) — Active

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 38. Foundation | 4/4 | Complete    | 2026-07-05 |
| 39. Cost Realism | 6/6 | Complete    | 2026-07-07 |
| 40. Insight Layer | 5/5 | Complete    | 2026-07-09 |
| 41. Quick-Win Features | 5/5 | Complete    | 2026-07-09 |
| 42. GDPR & Onboarding | 5/5 | Complete   | 2026-07-11 |
| 43. Pro Backend | 7/7 | Complete    | 2026-07-16 |
| 44. Sync & STL Instant Quote | 2/6 | In Progress|  |
| 45. Brand & Launch | 0/11 | Planned | - |

<details>
<summary>✅ v1.9 Hardening progress (Phases 34–37) — all complete</summary>

| Phase                                   | Milestone | Plans | Status      | Completed |
| --------------------------------------- | --------- | ----- | ----------- | --------- |
| 34. Live papercut fixes                 | v1.9      | 2/2 | Complete   | 2026-06-25 |
| 35. Accessibility Tier 4                | v1.9      | 5/5 | Complete   | 2026-06-26 |
| 36. Performance Tier 5                  | v1.9      | 2/2 | Complete   | 2026-06-26 |
| 37. Code health (STRETCH)               | v1.9      | 2/2   | Complete    | 2026-06-26 |

</details>

<details>
<summary>✅ v1.3 Hardening progress (Phases 18–26) — all complete</summary>

| Phase                                                | Milestone | Plans  | Status   | Completed   |
| ---------------------------------------------------- | --------- | ------ | -------- | ----------- |
| 18. Tauri fs:scope fix                               | v1.3      | 1/1    | Complete | 2026-05-25  |
| 19. Modal primitive + a11y migration                 | v1.3      | 6/6    | Complete | 2026-05-26  |
| 20. Dexie atomicity audit                            | v1.3      | 4/4    | Complete | 2026-05-26  |
| 21. CSV + URL security                               | v1.3      | 3/3    | Complete | 2026-05-27  |
| 22. JobsManager decomposition + perf                 | v1.3      | 6/6    | Complete | 2026-05-27  |
| 22.1 Break-even formula reconciliation (INSERTED)    | v1.3      | 4/4    | Complete | 2026-05-27  |
| 23. Test coverage hardening                          | v1.3      | 4/4    | Complete | 2026-05-28  |
| 24. Nyquist contracts + Phase 13 UAT + 18 carryover  | v1.3      | 6/6    | Complete | 2026-05-25  |
| 25. Doc + hygiene + polish + bundle health           | v1.3      | 5/5    | Complete | 2026-05-26  |
| 26. v1.3 cleanup (INSERTED)                          | v1.3      | 4/4    | Complete | 2026-05-28  |

</details>

---

## Backlog (carried forward)

Deferred to v2.0 (per v1.9 REQUIREMENTS.md + v1.9 close):

- **PERF-11** — pricing `useEffect` double-render fix. Reverted in v1.9 (dep-trim desynced profit/margin on consecutive same-field edits); correct fix pairs with the CostCalculator God-component split (audit 6.1). → Addressed in Phase 38 (FOUND-02).
- **Tab-in-URL** — browser Back from `/app` exits to the marketing site (in-app tabs are React state). Fix = active tab in the URL (`?tab=`); pairs with the redesign / `/app` seam work. *(UAT finding, 2026-06-26)* → Addressed in Phase 38 (FOUND-03).
- **etsy_offsite_ad in RecordSaleModal picker** — fee engine supports it; the Record Sale marketplace picker doesn't surface it. *(v1.9 release review, 2026-07-03; also in docs/ROADMAP.md backlog)* → Deferred to v3.0+ (not in v2.0 scope per REQUIREMENTS.md MISC-01).
- **UX-onboarding** — Guided first-run setup funnel (add printer → add filament → price). Audit 3.1 — headline UX feature, v2.0. → Addressed in Phase 42 (ONBD-01).
- **UX-empty-states** — Real empty states for FilamentSelector + Printers. Audit 3.3 — low-risk; could be pulled into v1.9 if scope allows.
- **UX-calc-flow** — Per-asset source currency, inline filament price override, CSV post-import summary, collapse optional calculator sections. Audit 3.4 / 3.5 — feature work, v2.0.
- **HYG-godcomponents** — Split the four 800+ LOC God-components (`CostCalculator`, `JobsManager`, `AssetLibrary`, `useDatabase`) + `SettingsModal`; move `db.*.put` into the hook layer. Audit 6.1–6.4 — large refactors, too risky for a hardening release. → CostCalculator split addressed in Phase 38 (FOUND-01).
- **Tier 2 brand cohesion** — Belongs on redesign branch `test/design-skills-experiment`; ships with v2.0 + paid-tier launch. → Addressed in Phase 45 (BRAND-01).

From v1.3 / v1.2 accepted deferrals (still pending):

- **Customer CSV export** — `sanitizeCsvCell` ready when the feature lands.
- **VoiceOver UAT (Phase 19)** — structural a11y complete; screen-reader phrasing confirmation deferred.
- **TAGS-F4** — tag colors. **DUP-F1** — quick-duplicate UI in a richer surface.
