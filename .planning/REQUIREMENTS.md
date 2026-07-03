# Requirements: 3DCoster v2.0 Cost-Truth & Insight

**Defined:** 2026-07-03
**Core Value:** Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.

**Milestone goal:** Turn 3DCoster from a calculator into a cost-truth engine and launch the business — deeper cost realism, decision-grade insights, the hosted/Pro tier with a GDPR-compliant legal foundation, the new brand, and a guided first-run.

**Locked decisions (2026-07-03):**
- Backend = **Supabase, eu-central-1 (Frankfurt)**, new project on the existing "How to Project" Pro org (~$10/mo marginal). GDPR posture via EU region + DPA/SCCs.
- Free floor is a first-class "no account" state — no free feature may ever require a backend call or account.
- GDPR legal layer is a **hard gate** before any backend call ships to production.
- Every derived-field change to money math ships with output-equivalence tests + a one-time reconcile helper (v1.9 lesson).

## v1 Requirements

### Foundation (engineering prerequisite)

- [ ] **FOUND-01**: CostCalculator (1,814 LOC) is split along the researched seams (useCostForm, useCostDerivedValues, ~4 presentational sections) with **zero behavioral change**, gated by output-equivalence tests (old vs new: same inputs → same numbers), not just contract tests
- [ ] **FOUND-02**: The pricing double-render per keystroke is eliminated inside the split architecture (the deferred PERF-11, done right — `useReducer`/event-handler pattern, `exhaustive-deps` at error level)
- [ ] **FOUND-03**: The active app tab lives in the URL (`useSearchParams`), so browser Back/Forward navigates tabs instead of exiting `/app`, and tab links are shareable/bookmarkable (existing PWA start_url and bookmarks keep working)

### Cost Realism — failure engine

- [ ] **FAIL-01**: User can log a print failure in one tap from a job (or standalone) with % completion, printer, and material — creating a `failureEvents` ledger entry (new Dexie store, migration + backup/restore inclusion)
- [ ] **FAIL-02**: App derives an empirical failure rate per printer × material from the ledger and shows it alongside the user's manual failure-rate input as a suggestion with one-click "Apply" (manual input stays authoritative; `costCalc.ts` pure function untouched)
- [ ] **FAIL-03**: Applied failure rates fold real scrap cost (partial filament + time + electricity by % completion) into true cost; saved jobs/quotes are untouched until re-edited (no silent reprice of history)
- [ ] **FAIL-04**: User can view a failure history/diagnostic ledger (per printer, per material, over time)

### Cost Realism — energy & wear

- [ ] **TOU-01**: User can define time-of-use electricity tariffs (peak/off-peak rates + hour windows) in Settings — user-entered, no API
- [ ] **TOU-02**: Job electricity cost can use the TOU tariff based on when the print runs (start time + duration), with the flat rate as default
- [ ] **WEAR-01**: User can log maintenance events (nozzle/belt/bed swaps, cost, date, printer-hours) and track cumulative abrasive-hours for CF/GF filaments on brass nozzles
- [ ] **WEAR-02**: Maintenance history amortizes into a real cost-per-hour per printer and predicts the next likely swap

### Insight & Decisions

- [ ] **INS-01**: User can see true hourly wage + product profitability ranking ("phone stands earn $8.10/printer-hour; dragons $1.50/hr") derived from existing job/sale data — pure derivations in `src/utils/insights.ts`, own panel/tab (NOT more props through App.tsx)
- [ ] **INS-02**: User can see per-printer payback/ROI ("this X1C earned back its purchase price; net +$340") from existing depreciation + sales data
- [ ] **INS-03**: User can play what-if margin sensitivity — sliders for filament price / electricity / failure rate with live margin response

### Connected Cost

- [ ] **CONN-01**: When a material price or FX rate changes, the app flags saved products whose margin falls below target ("7 products now under target margin — reprice?")
- [ ] **CONN-02**: User can get an instant local quote from an STL/3MF upload — in-browser mesh-volume estimate (Three.js lazy-loaded behind the same dynamic-import discipline as jsPDF + CI guard) with all three accuracy guards: units detection (mm/inch), infill-factor assumption surfaced, non-manifold mesh warning — framed as a maker-reviewed **estimate**, never an auto-price
- [ ] **CONN-03**: User can generate a Quote Variants PDF — 1pc / 10pc / 50pc tiered pricing in one branded document (rides the existing jsPDF quote engine)

### Maker-Life

- [ ] **LIFE-01**: User can track spool lifecycle — opened date, drying sessions, storage location — and see a moisture-risk indicator derived from material hygroscopicity class (Nylon HIGH, PETG MEDIUM, PLA LOW) + exposure time
- [ ] **LIFE-02**: User can set their jurisdiction and see cumulative-revenue progress toward its hobby→business tax threshold (UK £1k trading allowance, DE Kleinunternehmer, AU GST, US badges-of-trade note) with an alert on crossing — all local, with a clear "not tax advice" disclaimer

### Sync & Onboarding

- [ ] **SYNC-01**: User can sync between devices via file-based export/merge (user-owned folder e.g. Dropbox/Drive) with last-write-wins semantics, schema-version checks on import, and corruption guards (atomic writes, multi-tab safety) — free floor, no backend
- [ ] **ONBD-01**: First-run users get a guided, skippable, resumable onboarding wizard (add printer → add filament → price first job) that never blocks returning users or touches existing data

### GDPR & Legal (hard gate before backend)

- [ ] **GDPR-01**: Cookie/consent banner (vanilla-cookieconsent v3) with **equal-weight Accept/Reject on the first layer**, granular categories, revocable at any time, consent stored — Vercel Analytics and any future script loads only after opt-in; skipped entirely in the Tauri desktop app
- [ ] **GDPR-02**: EU/GDPR-compliant privacy policy page — what's collected, lawful basis, retention, data-subject rights (access/export/delete), processors (Vercel, Supabase, FX API), contact
- [ ] **GDPR-03**: Terms of Service page for the Pro tier

### Pro Backend & Hosted Quotes

- [ ] **PRO-01**: Supabase project (eu-central-1) with magic-link auth — accounts exist ONLY for Pro features; the free floor never requires one (no-account is a first-class state in every policy/flag)
- [ ] **PRO-02**: Maker can publish a quote as a hosted share link — POST of the self-contained `Quote.lineItemsSnapshot` (no two-way sync); local Quote stores the `publishedUrl`; maker can unpublish
- [ ] **PRO-03**: Hosted quote pages pass a security review gate — non-enumerable URLs, RLS verified, no PII in CDN caches, customer can view/approve without an account
- [ ] **PRO-04**: Pro subscription billing — user can subscribe/cancel; price anchored against 3DPrintQuote's €9.90/mo (payment provider research at phase-plan time — not covered by milestone research)

### Brand & Launch

- [ ] **BRAND-01**: The "Cost-Truth Dark" marketing-site redesign (branch `test/design-skills-experiment`) is merged for launch, with v1.7+ DownloadPage/FAQPage Linux correctness ported and the 3 Pro-pricing spots filled with real numbers

## v2 Requirements (deferred)

### Energy & environment
- **TOU-03**: Grid-carbon "green print" nudge via Electricity Maps free API ("run at 2am, save $X and cut carbon")

### Sync
- **SYNC-02**: Real-time/hosted sync ceiling (Dexie Cloud or Supabase custom sync) — blocked on EU-residency confirmation for Dexie Cloud; CRDTs explicitly deferred (wrong model for single-user multi-device)

### Quick wins not selected for v2.0 (founder call 2026-07-03)
- **CURR-01**: Currency expansion 18 → 50+ labels (FX API already covers 200+)
- **MISC-01**: `etsy_offsite_ad` in RecordSaleModal marketplace picker
- **MISC-02**: TAGS-F4 tag colors; DUP-F1 duplicate-job row UI; customer CSV export

## Out of Scope

| Feature | Reason |
|---------|--------|
| Print-farm queue/scheduling optimizer | Founder DECLINED 2026-06-15 — not our demographic; drifts into 3DPrintForce's ops lane. Do not re-add. |
| Live competitor-price scraping | Founder DECLINED 2026-06-15 — marketplace-ToS risk + race to the bottom. Manual "paste a price" is the acceptable substitute if ever wanted. |
| Live TOU tariff / wholesale price APIs | Structural mismatch: APIs report grid/wholesale price, not the user's billed tariff. User-entered rates only ("no arbitrary numbers" rule). |
| CRDT-based real-time sync (Yjs/Automerge) | Wrong abstraction for single-user multi-device; months of schema work. File-based LWW covers the need. |
| Auto-pricing customers from STL without maker review | Volume-estimate accuracy gaps (units/infill/manifold) make auto-prices dangerously wrong; estimate-with-review only. |
| PocketBase/self-hosted backend | Decided 2026-07-03: existing Supabase Pro org + zero-ops + platform familiarity outweigh the jurisdictional-purity marketing claim. |
| Paid CMP (Cookiebot etc.) | vanilla-cookieconsent (OSS, ~7 KB) is sufficient and compliant at this scale. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation 2026-07-03.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 38 | Pending |
| FOUND-02 | Phase 38 | Pending |
| FOUND-03 | Phase 38 | Pending |
| FAIL-01 | Phase 39 | Pending |
| FAIL-02 | Phase 39 | Pending |
| FAIL-03 | Phase 39 | Pending |
| FAIL-04 | Phase 39 | Pending |
| TOU-01 | Phase 39 | Pending |
| TOU-02 | Phase 39 | Pending |
| WEAR-01 | Phase 39 | Pending |
| WEAR-02 | Phase 39 | Pending |
| INS-01 | Phase 40 | Pending |
| INS-02 | Phase 40 | Pending |
| INS-03 | Phase 40 | Pending |
| CONN-01 | Phase 41 | Pending |
| CONN-03 | Phase 41 | Pending |
| LIFE-01 | Phase 41 | Pending |
| LIFE-02 | Phase 41 | Pending |
| GDPR-01 | Phase 42 | Pending |
| GDPR-02 | Phase 42 | Pending |
| GDPR-03 | Phase 42 | Pending |
| ONBD-01 | Phase 42 | Pending |
| PRO-01 | Phase 43 | Pending |
| PRO-02 | Phase 43 | Pending |
| PRO-03 | Phase 43 | Pending |
| PRO-04 | Phase 43 | Pending |
| SYNC-01 | Phase 44 | Pending |
| CONN-02 | Phase 44 | Pending |
| BRAND-01 | Phase 45 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-03*
*Last updated: 2026-07-03 — traceability table populated after roadmap creation*
