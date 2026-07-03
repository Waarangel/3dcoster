# Project Research Summary

**Project:** 3DCoster v2.0 — Cost-Truth & Insight Engine
**Domain:** Local-first 3D printing cost calculator adding decision-analytics, lifecycle tracking, and a hosted Pro tier
**Researched:** 2026-07-03
**Confidence:** HIGH (architecture from direct codebase read; pitfalls grounded in project history; stack from verified official sources; features from competitor first-hand observation)

---

## Executive Summary

3DCoster v2.0 adds two layers on top of a shipped, stable v1.9 local-first product: a free-floor insight engine (11 new cost/analytics features that work entirely offline, no account required) and a paid Pro backend (hosted quote pages, account sync). The research is unusually high-confidence because ARCHITECTURE.md was grounded in direct reading of the live codebase rather than inference, and PITFALLS.md drew on failures that already happened in this product (PERF-11, marketplace-fee FX bug, seedState re-seed, versionchange crash). The clearest finding from all four files is that the free-floor insight features are large, valuable, and low-risk — they should ship first, independent of the backend. The backend is the crescendo of the milestone, not the foundation.

The recommended build order is a four-wave structure: (1) structural foundation — CostCalculator God-component split and tab-in-URL routing, two code-health items that gate everything else; (2) cost-realism features — failure-cost engine, time-of-use electricity, maintenance amortization, all free-floor, all local; (3) insight layer and quick-win features — Insights tab (true hourly wage, printer ROI, what-if simulator), reprice alerts, spool lifecycle, tax threshold tracker; (4) GDPR + onboarding as a hard gate before the backend, then the hosted Pro tier. All four research files converge on this wave ordering independently, which makes it the consensus recommendation.

The two biggest risks to the milestone are the CostCalculator split (highest regression risk in the codebase — PERF-11 already proved tests alone cannot catch stale-closure pricing desyncs) and the GDPR compliance layer (non-trivial to get right — real fines exist for non-compliant banners). Both must be handled with explicit human UAT and output-equivalence tests, not just passing CI. The backend choice (PocketBase on Hetzner EU vs Supabase Cloud) remains an open architectural decision with a real EU/CLOUD Act trade-off that must be resolved before the Pro tier phase begins.

---

## Key Findings

### Recommended Stack

The existing locked stack (React 18, TypeScript, Vite, Tailwind, Dexie.js 4, Tauri 2, Vitest) is unchanged. v2.0 adds six new dependencies, all additive.

**New dependencies:**

| Package | Version | Purpose | Load strategy |
|---------|---------|---------|--------------|
| pocketbase | 0.27.0 | Backend SDK (auth + REST) | Normal import (15 KB gz) |
| three | 0.169.0 | STL/3MF geometry loading | LAZY — never in main chunk |
| three-volume | 2.0.7 | Mesh volume calculation | LAZY (same chunk as three) |
| vanilla-cookieconsent | 3.1.0 | GDPR consent banner — 7 KB gz, granular categories, revocable | Normal import |
| lz-string | 1.5.0 | URL-safe compression for free-floor quote share | Normal import (3.7 KB gz) |
| dexie-cloud-addon | latest | Paid-tier multi-device sync (conditional) | Conditional import |

**New services:**

| Service | Cost at zero Pro users | Role |
|---------|----------------------|------|
| Hetzner CX22 VPS (Nuremberg, DE) | ~€4.35/mo | PocketBase host — EU jurisdiction, no CLOUD Act |
| Hetzner Object Storage | ~€3/mo | File storage + automated backups |
| Dexie Cloud (optional) | €0.12/user/mo (3-user free tier) | Paid-tier sync transport — pending EU residency confirmation |

The backend choice (PocketBase vs Supabase) is an open decision — see Cross-File Tensions. STACK.md recommends PocketBase on Hetzner for full EU jurisdiction ownership. ARCHITECTURE.md's auth-model sketch mentions Supabase Auth but the pattern (magic-link to httpOnly cookie) is backend-agnostic.

**Mesh volume:** Three.js STLLoader + three-volume 2.0.7 (signed-tetrahedra algorithm, correct for watertight meshes). Must be lazy-loaded; Three.js is ~155 KB gz and would breach the 300 KB main-chunk gate.

**Cookie consent:** vanilla-cookieconsent v3 — granular per-category consent required by GDPR. Mounted via useEffect in App.tsx, web-only.

**Sync:** File-based JSON export/import as the free floor. Dexie Cloud for paid-tier sync. CRDT (Yjs, Automerge) explicitly rejected — wrong model for single-user multi-device sync.

**Electricity tariffs:** User-entered TOU schedule only. No live API. All surveyed APIs give grid/wholesale prices, not the user's billed tariff from their supplier contract. No new npm dependencies.

---

### Expected Features

**Must-have (table stakes — v2.0 launch):**

- Guided first-run onboarding wizard — fixes the empty-dropdown cold-start dead end every new user hits; no new schema needed
- CostCalculator God-component split + PERF-11 fix + tab-in-URL routing — structural prerequisites that gate everything else in the milestone
- Failure-cost engine (empirical log to derived failure rate to hint on calculator) — flagship cost-realism differentiator; no competitor does per-printer x per-material empirical rates
- Filament-price reprice alerts — high moment-of-value when material prices rise; low build cost; builds on existing data
- Printer payback / ROI tracker (basic) — retrospective P&L from existing job history; motivating milestone moment
- GDPR consent banner + privacy policy + terms of service — legal requirement; hard gate before any backend that processes EU user data

**Should-have (competitive differentiators, v2.0 scope):**

- True hourly wage + product profitability ranking
- What-if margin simulator (sandbox on a saved job)
- Time-of-use electricity modeling (user-defined peak/off-peak bands)
- Maintenance amortization (event log to amortized per-hour cost; nozzle surcharge for abrasive filaments)
- Spool lifecycle / moisture tracking (opened date + hygroscopicity class + drying log)
- Hobby-to-business tax threshold tracker (YTD revenue vs jurisdiction threshold)
- STL upload to client-side volume/weight estimate to calculator pre-fill (free floor)
- Quote variants (multiple qty/material options in one PDF — borrowed from 3DPrintQuote)
- Instant-quote share link (free floor: lz-string URL encoding; Pro: hosted page at 3dcoster.com/q/[token])
- Marketing site redesign (Cost-Truth Dark branch)
- Currency expansion 18 to 50+ currencies

**Defer to v3+:**

- OctoPrint / Klipper auto-failure detection (breaks offline-first)
- CRDT real-time sync (wrong model; v3.0 consideration)
- Live tariff API integration (grid price does not equal user's billed rate)
- Auto-pricing from STL without maker review
- Push notifications / automatic drying reminders
- Customer-facing account creation on quote approval
- Income tax bracket modeling

---

### Architecture Approach

The existing architecture is a single-subscription App.tsx running all 12 Dexie hooks with prop-drilling into three God-components (CostCalculator.tsx 1,814 LOC, useDatabase.ts 1,384 LOC, JobsManager.tsx ~1,474 LOC). v2.0 must not repeat this pattern.

**Major new components:**

1. calculator/ folder — CostCalculator orchestrator shrinks to ~150 LOC; useCostForm.ts owns form state; useCostDerivedValues.ts owns all useMemos + pricing interlink effects + PERF-11 fix; six section components
2. insights/ folder — InsightsPanel.tsx orchestrator with WageInsight, ProductRanking, PrinterROI, WhatIfSimulator; all insight hooks live inside InsightsPanel, NOT in App.tsx; pure derivation in src/utils/insights.ts
3. onboarding/ folder — OnboardingOverlay.tsx overlay (not a route); reads from existing Dexie subscription; onboardingCompleted stored in Dexie UserProfile, NOT localStorage
4. CookieConsentBanner.tsx + useConsent.ts + consent.ts — web-only; gates Vercel Analytics via AnalyticsGate in main.tsx

**Key patterns:**

- Tab-in-URL: replace useState<Tab> with useSearchParams in App.tsx only (minimal change). URL shape: /app?tab=calculator. Not nested routes — keeps all Dexie hooks at one level.
- Backend is publish-only: Quote.lineItemsSnapshot (self-contained, no FK) is the only payload sent to the backend. Local Dexie is authoritative. No pull, no merge in v2.0.
- New Dexie stores: failureEvents (db.version 12); maintenanceEvents (db.version 13 or combined). Optional fields on existing JSON entities require no version bump.
- Reconcile-legacy-data rule applies to all new derived fields: default to undefined with "no data yet" display, not a calculated zero.
- Derived insight values must NOT be stored in Dexie — derive in useMemo via useLiveQuery on source stores.

---

### Critical Pitfalls

**Top eight pitfalls with prevention strategies:**

1. **Free floor accidentally requires an account (C-01)** — every feature needs an explicit no-auth code path before the Pro path. Test by signing out of the backend and confirming the calculator loads and saves locally. A single auth-middleware check at the router level that gates free features is a P0 regression.

2. **CostCalculator split introduces pricing state desync (C-03)** — PERF-11 already proved this: 819 passing tests cannot detect stale-closure desyncs in pricing effects. Prevention: output-equivalence tests before splitting (old vs new component, same numbers for N inputs); react-hooks/exhaustive-deps at error level; human UAT on rapid consecutive keystrokes. Highest-risk code change in the entire milestone.

3. **Consent banner non-compliant (C-04)** — CNIL fined Google €150M and €200M for reject-button friction; Honda fined $632,500 for two-click reject vs one-click accept. Prevention: Accept All and Reject All at identical visual weight on the first layer; rejecting takes exactly one click; Vercel Analytics must not fire before consent.

4. **Hosted quote PII via predictable URL (C-06)** — sequential integer or short-hash quote URLs are trivially enumerable. Prevention: UUID v4 as the only key; X-Robots-Tag: noindex on all /q/* routes; quote expiry; CDN must not cache PII.

5. **STL volume estimation producing wrong instant quotes (C-07)** — three systematic failures: non-manifold meshes (common on Thingiverse), units ambiguity (inches vs mm = 16.4x difference), infill assumption (solid volume is 5-7x the actual filament at 15% infill). Prevention: bounding-box sanity check; mesh integrity warning; explicit infill % input; accuracy disclaimer; never present as a final price.

6. **File-based sync data corruption (C-08)** — partial cloud write, multi-tab race, schema version mismatch on import. Prevention: atomic JSON write (generate in memory, write as single operation); include schemaVersion in export; check before import; BroadcastChannel lock for multi-tab dedup.

7. **Onboarding wizard overwriting existing data or firing for returning users (M-01)** — isFirstRun in localStorage is cleared independently of IndexedDB. Prevention: store onboardingCompleted in Dexie UserProfile, not localStorage; wizard steps check existing data before writing; skip button on every step.

8. **Scope collapse — backend blocks everything (M-05)** — starting with the backend and finding it takes 3x longer stalls all other features. Prevention: every free-floor feature designed to work without the backend first; shippable milestone MVP defined before development starts.

---

## Cross-File Tensions — Explicit Resolutions

### Tension 1: Backend Choice — PocketBase (STACK.md) vs Supabase Auth (ARCHITECTURE.md)

STACK.md recommends PocketBase 0.27 on Hetzner CX22 (Nuremberg, DE): EU-jurisdiction data from day one, zero CLOUD Act exposure, full GDPR data-controller ownership, ~€8/mo total vs Supabase Pro $25/mo minimum. It explicitly rejects Supabase Cloud because Supabase Inc. is a US company and even its Frankfurt region carries CLOUD Act residual risk.

ARCHITECTURE.md's backend seam section mentions "Vercel Edge Functions + Supabase Auth (built-in magic link)" in the Phase 1 auth sketch — creating apparent tension.

**Resolution: this is a genuine open decision, not an error.** The auth pattern (magic-link email to httpOnly session cookie) is backend-agnostic; it is equally achievable with PocketBase's built-in auth. ARCHITECTURE.md's mention of Supabase was an implementation sketch, not an architectural commitment.

**Recommendation: PocketBase on Hetzner.** EU-jurisdiction argument is clean for a product with significant EU users (DE, NL, FR). Cost difference is material at launch scale. If PocketBase SQLite limits appear at >20,000 MAU, migrate to managed Postgres at that point.

**Gate: resolve before Phase F (Pro backend) begins. Do not build the auth layer until backend is locked.**

---

### Tension 2: Sync Strategy — Dexie Cloud (STACK.md) vs No-CRDT File-Based (ARCHITECTURE.md) vs LOW-confidence CRDT (FEATURES.md)

STACK.md recommends file-based export as the free floor and Dexie Cloud as the paid-tier sync, with a caveat about EU data residency. FEATURES.md rates CRDT as LOW confidence. ARCHITECTURE.md is most explicit: recommends NOT doing CRDT in v2.0, provides a detailed last-write-wins merge strategy per store, notes PocketBase can serve as the sync authority if Dexie Cloud residency is unclear.

**Resolution: all three files converge when read together.**

- Free floor = file-based JSON export/import with deviceId, exportedAt, schemaVersion. Already partially built. Zero new backend dependency.
- Paid-tier sync = defer until backend is chosen. If PocketBase is the backend, implement sync as PocketBase collection writes (one-way push). If Dexie Cloud confirms EU residency, use it as the sync transport.
- CRDT = deferred to v3.0. Wrong model for single-user multi-device sync.

**Gate: do not commit to Dexie Cloud until EU data residency is confirmed in writing or PocketBase custom-sync is evaluated.**

---

### Tension 3: Wave Ordering — All Four Files Converge

All four research files independently arrive at the same build order: foundation, then free-floor cost realism, then insight layer and quick wins, then GDPR (hard gate), then backend crescendo. This is the consensus recommendation, not one file's opinion.

GDPR before backend is non-negotiable: the moment any user data leaves the device, the Pro tier enters GDPR scope. The consent banner must be live in production before any API call sends user data off-device.

---

## Implications for Roadmap

All four research files converge on this eight-phase structure.

### Phase A: Foundation — CostCalculator Split + Tab-in-URL Routing
**Rationale:** Physical prerequisite for all new cost lines, new tabs, and PERF-11 fix. Highest-risk code change in the milestone — must be isolated so regressions are caught before features build on top.
**Delivers:** CostCalculator shrinks to ~150 LOC orchestrator; useCostForm + useCostDerivedValues extracted; six section components; PERF-11 fixed in useCostDerivedValues; /app?tab=X URL shape; browser Back works within app; Insights tab slot ready.
**Key pitfall (C-03):** Output-equivalence tests before touching code. react-hooks/exhaustive-deps at error level. Human UAT rapid-typing test.
**Research flag: needs plan-phase research spike on useCostDerivedValues dep-array design and useReducer vs refined useEffect patterns.**

### Phase B: Free-Floor Cost Realism — Failure Engine, TOU Electricity, Maintenance Amortization
**Rationale:** The moat. Three features no competitor offers; all local; all depend on Phase A section components existing.
**Delivers:** failureEvents Dexie store (db.version 12); empirical failure rate hint in CostParametersSection; TOU peak/off-peak bands + weighted cost in costCalc.ts; maintenanceEvents store; maintenance amortization per print hour; nozzle surcharge for abrasive filaments.
**Key pitfall (M-04):** Failure-cost model changes displayed prices — ship one-time reconcile banner + changelog entry + failureCostModelVersion in UserProfile.
**Research flag: standard patterns; no research-phase needed.**

### Phase C: Insight Layer — Insights Tab + Decision Analytics
**Rationale:** Reads from existing data; delivers analytical value without new data-entry habits; no backend dependency. Starts immediately after Phase A.
**Delivers:** InsightsPanel with WageInsight, ProductRanking, PrinterROI, WhatIfSimulator; pure derivation in src/utils/insights.ts; all hooks inside InsightsPanel, not App.tsx.
**Anti-patterns to avoid:** Storing derived values in Dexie. Adding insight hooks to App.tsx.
**Research flag: standard React + Dexie patterns; no research-phase needed.**

### Phase D: Quick-Win Features — Reprice Alerts, Spool Lifecycle, Tax Threshold, Quote Variants, Currency Expansion
**Rationale:** Independent of each other and of the backend; all free-floor; can partially overlap with Phase B or C.
**Delivers:** Material price update to affected-jobs alert with old vs new margin; spool opened date + moisture risk + drying log; YTD revenue vs jurisdiction threshold; multi-option PDF quote; CURRENCY_CONFIG expanded to 50+ currencies.
**Key pitfall (C-07 partial):** Reprice alerts must re-compute cost using new material price, not use the stored snapshot cost.
**Research flag: standard patterns. Tax threshold data is MEDIUM confidence — add "data current as of" note in UI.**

### Phase E: GDPR + Onboarding — Hard Gate Before Backend
**Rationale:** Legal prerequisite for Phase F. Consent banner must be live in production before any API call sends user data off-device.
**Delivers:** CookieConsentBanner.tsx (Accept All / Reject All at equal visual weight on first layer); useConsent.ts; AnalyticsGate in main.tsx; Privacy Policy page; Terms of Service page; Data Flow Inventory table (internal, updated as PR checklist item); OnboardingOverlay.tsx 5-step wizard; onboardingCompleted in Dexie UserProfile.
**Key pitfall (C-04):** Reject All takes exactly one click. Equal button weight on first layer. Zero analytics requests on first page load before any click. Network tab verification required.
**Key pitfall (C-05):** Privacy policy names every data processor. Data Flow Inventory updated on every PR adding a data flow.
**Key pitfall (M-01):** onboardingCompleted in Dexie, not localStorage. Skip button on every wizard step.
**HARD GATE: do not proceed to Phase F until consent banner is live in production and privacy policy is published.**
**Research flag: vanilla-cookieconsent v3 is well-documented. Privacy policy DPA clause (data processor relationship on hosted quote pages) may warrant one round of legal counsel review.**

### Phase F: Backend + Pro Tier + Hosted Quote Pages
**Rationale:** The crescendo. Highest complexity, highest revenue potential. No free-floor feature depends on it.
**Delivers:** PocketBase on Hetzner (or Supabase if CLOUD Act risk accepted after deliberate decision); magic-link auth; hosted_quotes collection; hosted quote page at 3dcoster.com/q/[uuid-v4-token] via Vercel Edge Function; instant-quote share link UI; auth token in Tauri secure keyring.
**Key pitfall (C-01):** Sign out of backend — confirm calculator loads and saves locally.
**Key pitfall (C-02):** Schema versioning triple (Dexie + PocketBase + sync protocol) updated in the same PR.
**Key pitfall (C-06):** UUID v4 tokens. noindex on /q/* routes. Spend cap enabled day 1. Billing alerts at 50% of budget.
**Key pitfall (M-03):** No binary files (STL, PDF) in backend storage for MVP — metadata JSON only.
**Research flag: needs research-phase. PocketBase auth implementation (magic-link, httpOnly cookie, Tauri secure keyring) deviates from ARCHITECTURE.md's Supabase sketch and needs a concrete implementation plan.**

### Phase G: File-Based Sync + STL Volume Instant Quote
**Rationale:** Two independent high-complexity free-floor features not on the critical path. Sequenced after backend schema is stable so the sync format includes all v2.0 stores in their final shape.
**Delivers:** Structured JSON sync export with deviceId / exportedAt / schemaVersion; last-write-wins merge in syncMerge.ts; UI guidance for Dropbox/iCloud folder sync pattern; STL file upload to Three.js volume parse to weight estimate to calculator pre-fill; unit-detection warning (mm vs inches); infill % input; accuracy disclaimer.
**Key pitfall (C-08):** Atomic JSON write. Import checks schemaVersion before writing. Multi-tab export test.
**Key pitfall (C-07):** Test with known-weight STL. Bounding-box sanity check. Infill input always present. Accuracy disclaimer in UI.
**Research flag: file-based sync conflict detection likely underestimated — recommend research spike on BroadcastChannel lock patterns + atomic file write in Tauri before planning.**

### Phase H: Marketing Site Redesign (Cost-Truth Dark)
**Rationale:** The test/design-skills-experiment branch holds the full visual system. Should debut with the Pro tier announcement, alongside or after Phase F.
**Delivers:** Marketing site redesign merged; Pro pricing tier copy with real numbers; DownloadPage + FAQPage ported with v2.0 Linux correctness.
**Research flag: standard front-end work; no research-phase needed. Pro pricing numbers must be set by founder before this phase ships.**

---

### Phase Ordering Rationale

- A before B: CostCalculator split is a physical prerequisite for new cost line inputs in section components
- A before C: tab-in-URL must exist before any new tab is added
- B and D can partially overlap: quick-win features that do not touch the calculator can start alongside Phase B
- E must precede F: GDPR is a legal hard gate; backend cannot go live without consent layer in production
- F before G (sync format): backend schema must be stable before sync export format is finalized to include all v2.0 stores
- H is independent but should debut with F for maximum marketing impact

---

### Research Flags

**Phases needing /gsd:plan-phase --research-phase:**

- Phase A (CostCalculator split): useCostDerivedValues dep-array design; useReducer vs refined useEffect patterns for pricing interlink; this is the highest-risk change in the milestone
- Phase F (Backend): PocketBase auth implementation — magic-link flow, httpOnly cookie, Tauri secure keyring integration; the ARCHITECTURE.md sketch used Supabase
- Phase G (File-based sync): BroadcastChannel lock patterns + atomic file write in Tauri; conflict detection design for multi-tab races

**Phases with standard, well-documented patterns — can skip research-phase:**

- Phase B (cost features): pure arithmetic on existing data; implementation paths clear from ARCHITECTURE.md
- Phase C (Insights tab): standard React + Dexie useLiveQuery patterns; pure derivation
- Phase D (quick-win features): CRUD + computed display; well-understood
- Phase E (GDPR + onboarding): vanilla-cookieconsent v3 documented; onboarding is standard React
- Phase H (redesign): front-end work from existing branch

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | PocketBase/Hetzner from official pricing pages + community benchmarks; Three.js from official docs + issue tracker; vanilla-cookieconsent from official repo; Dexie Cloud from official pricing. One open: Dexie Cloud EU residency unconfirmed |
| Features | HIGH (patterns) / MEDIUM (tax thresholds) | Competitor features from first-hand observation; tax thresholds from official jurisdiction guidance but regulations change |
| Architecture | HIGH | Direct codebase read — not inferred. CostCalculator.tsx 1,814 LOC, useDatabase.ts 1,384 LOC, database.ts v1-v11, App.tsx, types.ts, costCalc.ts all confirmed |
| Pitfalls | HIGH (project-history) / MEDIUM (GDPR enforcement) | C-03/PERF-11, marketplace-fee FX, seedState re-seed, versionchange crash all directly observed. GDPR enforcement fines from official enforcement records |

**Overall confidence: HIGH**

### Gaps to Address

1. **Backend choice: PocketBase vs Supabase** — policy/jurisdiction decision, not a research gap. Founder must decide before Phase F begins. Recommendation is PocketBase (EU jurisdiction argument in Tension 1). Gate: resolve before Phase F roadmap planning.

2. **Dexie Cloud EU data residency** — not published by Dexie Cloud. Before committing to Dexie Cloud as the paid-tier sync transport, verify with Dexie Cloud support or evaluate PocketBase custom-sync as the alternative. Gate: resolve before Phase F sync planning.

3. **Tax threshold data accuracy** — MEDIUM confidence; regulations change. Feature must display "data current as of [date]" note and "consult a qualified accountant" disclaimer. Create an internal process for reviewing thresholds annually.

4. **Privacy policy legal review** — hosted quote page creates a data processor relationship (Pro users' customers' PII in 3DCoster's backend requires a DPA clause in ToS). Recommend one round of legal counsel review before Pro tier launches, focused on this clause.

5. **Pro tier pricing** — three pricing spots are placeholders. The 3DPrintQuote anchor of €9.90/mo is documented in project memory. Founder must set the actual price before Phase H ships.

---

## Sources

### Primary (HIGH confidence)

- src/components/CostCalculator.tsx (1,814 LOC) — read directly; God-component structure, extraction boundaries, PERF-11 root cause
- src/hooks/useDatabase.ts (1,384 LOC) — read directly; all Dexie hook patterns, reconcile flag system
- src/db/database.ts (v1–v11) — read directly; schema version confirmed at 11
- src/types.ts, src/utils/costCalc.ts, src/App.tsx — all read directly
- PocketBase JS SDK GitHub (github.com/pocketbase/js-sdk) — v0.27.0 confirmed
- Hetzner CX22 specs (hetzner.com/cloud) — pricing and specs verified
- Dexie Cloud pricing (dexie.org/cloud/pricing) — Free 3 users / 100 MB; Production €0.12/user/month
- vanilla-cookieconsent GitHub (orestbida) — v3.1.0, active
- Three.js issue #27905 — no native volume() method
- CNIL fines Google €150M (2022) — consent enforcement record
- Supabase official pricing — Free tier pauses after 1 week; Pro $25/mo
- PERF-11 regression, marketplace-fee FX bug, seedState re-seed, versionchange crash — directly observed in this project's history

### Secondary (MEDIUM confidence)

- DanubeData: Supabase GDPR alternatives Europe 2026 — CLOUD Act analysis
- Innopulse: Supabase EU Frankfurt playbook — CLOUD Act residual risk
- three-volume on libraries.io — v2.0.7, June 2024
- Super-productivity CRDT discussion #4857 — CRDT wrong model for single-user sync
- GrandpaCAD 3D Printing Business Calculator — printer ROI patterns
- Spoolman GitHub (Donkie/Spoolman) — spool data model fields
- FilamentCalcs Failure Rate Calculator — failure rate benchmarks
- Honda fined $632,500 — two-click reject (California CPPA) — consent enforcement
- TkDodo: Hooks, Dependencies and Stale Closures — stale closure pitfalls
- Project memory: project_competitor_sliceprice3d.md, project_competitor_3dprintquote.md, project_v2_vision.md

### Tertiary (LOW confidence — validate during implementation)

- Failure rate benchmarks (<5% excellent, 5-10% typical hobbyist) — no single primary source; use for UI guidance only
- RxDB downsides of offline-first — storage limits and conflict resolution patterns

---

*Research completed: 2026-07-03*
*Ready for roadmap: yes*
