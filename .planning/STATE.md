---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Cost-Truth & Insight
current_phase: 47
current_phase_name: cloud-sync
status: executing
stopped_at: Completed 47-08-PLAN.md (47-07 SUMMARY pending from parallel UAT session)
last_updated: "2026-07-24T18:25:24.901Z"
last_activity: 2026-07-24
last_activity_desc: Phase 46 complete (UAT 18/18); 47-08 marketing flips executed
progress:
  total_phases: 14
  completed_phases: 9
  total_plans: 74
  completed_plans: 73
  percent: 64
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-23). Milestone roadmap: [ROADMAP.md](ROADMAP.md) (Phases 38–51). Source of requirements: .planning/REQUIREMENTS.md (27 v1 requirements, 100% mapped).

**Core value:** Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.
**Current focus:** Phase 47 — cloud-sync

## Current Position

Phase: 47 (cloud-sync) — EXECUTING
Plan: 8 of 8 executed (47-07 SUMMARY pending from parallel UAT session)
Status: Awaiting 47-07 wrap-up, then phase verification (/gsd-verify-work 47)
Last activity: 2026-07-24 — Phase 46 complete (UAT 18/18); 47-08 marketing flips executed

## v2.0 Phase Order Reference

| Phase | Theme | Requirements | Key constraint |
|-------|-------|--------------|----------------|
| 38 | Foundation — CostCalculator split + tab-in-URL | FOUND-01, FOUND-02, FOUND-03 | Highest-risk code change in milestone; gates all new cost inputs and new tabs. Research spike REQUIRED before planning. |
| 39 | Cost Realism — failure engine, TOU electricity, maintenance amortization | FAIL-01..04, TOU-01..02, WEAR-01..02 | Depends on Phase 38 section components. New Dexie stores (failureEvents, maintenanceEvents). Must not silently reprice history. |
| 40 | Insight Layer — hourly wage, printer ROI, what-if simulator | INS-01, INS-02, INS-03 | Depends on Phase 38 tab-in-URL (Insights tab slot). Pure derivation only — no Dexie writes for insight values. |
| 41 | Quick-Win Features — reprice alerts, spool lifecycle, tax threshold, Quote Variants | CONN-01, CONN-03, LIFE-01, LIFE-02 | Independent of backend. Can partially overlap with Phase 39 or 40. Tax threshold data MEDIUM confidence — show "data current as of" note. |
| 42 | GDPR & Onboarding — consent banner, privacy policy, ToS, wizard | GDPR-01, GDPR-02, GDPR-03, ONBD-01 | HARD GATE before Phase 43. Must be live in production and network-verified (zero analytics before consent) before backend ships. |
| 43 | Pro Backend — Supabase auth, hosted quote pages, billing | PRO-01, PRO-02, PRO-03, PRO-04 | Depends on Phase 42. Research spike REQUIRED. Backend = Supabase eu-central-1 (locked). PRO-03 requires security review gate. |
| 44 | Sync & STL Instant Quote — file-based sync, STL volume estimate | SYNC-01, CONN-02 | Depends on Phase 43 (sync format must include final v2.0 Dexie schema). Research spike REQUIRED for sync conflict handling. Three.js must be lazy-loaded (300 KB gz gate). |
| 45 | Brand & Launch — Cost-Truth Dark redesign merge | BRAND-01 | Depends on Phase 43 (Pro pricing must exist before redesign fills pricing spots). Frontend work from existing branch `test/design-skills-experiment`. |

> **Phase-numbering:** v1.9 used Phases 34–37. Phase 33 reserved on `feat/insight-pricing-coach` branch. v2.0 starts at Phase 38.

## Performance Metrics

**Velocity:**

- Total plans completed (lifetime): 70
- Average duration: —
- Total execution time: —

*Updated after each plan completion.*

**v1.9 Hardening (reference):** 4 phases (34–37), 11 plans, 14/15 requirements, ~7 days incl. 1-week review/UAT hold.
**v1.3 Hardening (reference — the model for structured milestones):** 10 phases (18–26), 43 plans, 56 tasks, 53 requirements, 4 days, audit verdict `passed`.
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 44 P03 | 15min | - tasks | - files |
| Phase 44 P03 | 15min | 3 tasks | 6 files |
| Phase 44 P04 | 20min | 3 tasks | 9 files |
| Phase 44 P05 | 41min | 4 tasks | 9 files |
| Phase 44 P06 | 8min | 3 tasks | 7 files |
| Phase 45 P01 | 40min | 3 tasks | 9 files |
| Phase 45 P02 | 12min | 2 tasks | 9 files |
| Phase 45 P03 | 9min | 2 tasks | 4 files |
| Phase 45 P06 | 25min | 2 tasks | 2 files |
| Phase 45 P07 | 20min | 3 tasks | 4 files |
| Phase 45 P08 | 12min | 2 tasks | 4 files |
| Phase 45 P09 | 20min | 2 tasks | 8 files |
| Phase 45 P04 | 11min | 2 tasks | 1 files |
| Phase 45 P05 | 55min | 2 tasks | 1 files |
| Phase 45 P10 | 25min | 3 tasks | 8 files |
| Phase 45 P11 | 35min | 3 tasks | 2 files |
| Phase 45 P12 | 20min | 3 tasks | 9 files |
| Phase 45 P13 | 5min | 3 tasks | 3 files |
| Phase 45 P14 | 31min | 3 tasks | 13 files |
| Phase 45 P15 | 6min | 2 tasks | 4 files |
| Phase 45 P16 | 12min | 2 tasks | 1 files |
| Phase 46 P01 | 10min | 3 tasks | 5 files |
| Phase 46 P03 | 8min | 2 tasks | 3 files |
| Phase 46 P02 | 35min | 3 tasks | 10 files |
| Phase 46 P04 | 25min | 3 tasks | 6 files |
| Phase 46 P06 | 5min | 4 tasks | 7 files |
| Phase 46 P05 | continuation | 2 tasks | 7 files |
| Phase 46 P07 | 8min | 2 tasks | 3 files |
| Phase 46 P09 | 7min | 2 tasks | 4 files |
| Phase 46 P10 | 2min | 2 tasks | 3 files |
| Phase 46 P08 | 65min | 2 tasks | 4 files |
| Phase 46 P11 | 30min | 3 tasks | 13 files |
| Phase 46 P12 | 12min | 3 tasks | 6 files |
| Phase 47 P01 | 20min | 2 tasks | 3 files |
| Phase 47 P02 | continuation | 3 tasks | 4 files |
| Phase 47 P03 | 6min | 2 tasks | 6 files |
| Phase 47 P04 | 12min | 2 tasks | 2 files |
| Phase 47 P05 | 22min | 2 tasks | 4 files |
| Phase 47 P06 | 12min | 2 tasks | 4 files |

## Accumulated Context

### Roadmap Evolution

- v1.0 Phases 1–6 shipped (Multi-Material Support, 2026-04-15)
- v1.1 Phases 7–11 shipped (Polish & Foundation, 2026-05-20)
- v1.2 Phases 12–17 shipped (Quote-to-Customer, 2026-05-25) — inserted 15.1, closure 17
- v1.3 Phases 18–26 shipped (Hardening, 2026-05-28) — inserted 22.1, closure 26
- v1.4–v1.7 shipped ad-hoc OUTSIDE GSD (2026-05-29 → 2026-06-19)
- v1.8 Phases 27–32 shipped (Inventory & Sales Reporting, 2026-06-25) — GSD revived; desktop tag `v1.8.0`. Phase 33 on in-flight branch.
- v1.9 Phases 34–37 shipped (Hardening, 2026-07-03) — desktop tag `v1.9.0`. 14/15 requirements (PERF-11 deferred to v2.0).
- **v2.0 Phases 38–45 roadmapped 2026-07-03** — 8 phases, 27 requirements, 100% coverage. Wave structure: Foundation → Cost Realism + Insight + Quick Wins → GDPR (hard gate) → Pro Backend → Sync + STL → Brand.
- **Phases 46–51 added 2026-07-22** (founder launch-scope expansion 2026-07-20 — full Pro build before launch): 46 White-label quotes → 47 Cloud sync (+ GDPR inventory/policy updates) → 48 Live Etsy order sync (EXTERNAL: Etsy app review) → 49 Live carrier rates (EXTERNAL: aggregator account) → 50 QuickBooks/Wave sync (EXTERNAL: Intuit app review) → 51 Launch-prep redux (Coming-pill flips, Paddle SKUs + PricePreview, launch checklist, v2.0.0 tag + deploy). Founder operator actions in parallel NOW: Etsy dev app, Intuit dev app, aggregator account.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- [v2.0 Roadmap 2026-07-03]: Continue-numbering at Phase 38. v1.9 used 34–37; Phase 33 reserved on `feat/insight-pricing-coach`; start at 38 to avoid collision.
- [v2.0 Roadmap 2026-07-03]: 8-phase structure derived from research consensus (all 4 research files converge on the same wave ordering independently). Coarse granularity applied: 8 phases for 27 requirements reflects natural delivery boundaries, not padding.
- [v2.0 Roadmap 2026-07-03]: Phase 38 (Foundation) is the highest-risk code change in the milestone. Research spike flagged as REQUIRED — must resolve useCostDerivedValues dep-array design and useReducer vs refined useEffect patterns before any code is touched. Output-equivalence tests (old vs new component, same numbers for N inputs) are the primary correctness gate.
- [v2.0 Roadmap 2026-07-03]: Phase 42 (GDPR) is a hard gate before Phase 43 (Pro Backend). The consent banner must be live in production and network-verified before any backend call ships user data off-device.
- [v2.0 Roadmap 2026-07-03]: Phase 43 (Pro Backend) research spike flagged REQUIRED — Supabase auth implementation (magic-link, httpOnly cookie, Tauri secure keyring) needs a concrete plan. Backend = Supabase eu-central-1 (locked per REQUIREMENTS.md). PRO-03 requires a formal security review gate (non-enumerable URLs, RLS, no PII in CDN caches).
- [v2.0 Roadmap 2026-07-03]: Phase 44 (Sync + STL) research spike flagged REQUIRED — file-based sync conflict detection (BroadcastChannel lock, atomic JSON write in Tauri) is likely underestimated per research SUMMARY.md. Sequenced after Phase 43 so the sync export format includes all v2.0 Dexie stores in their final shape.
- [v2.0 Roadmap 2026-07-03]: CONN-02 (STL instant quote) paired with SYNC-01 in Phase 44 — both are high-complexity free-floor features not on the critical path, both benefit from a later sequencing once the schema is stable.
- [v2.0 Roadmap 2026-07-03]: CONN-03 (Quote Variants PDF) placed in Phase 41 (Quick Wins), not Phase 39 or 43 — it rides the existing jsPDF engine, requires no new Dexie stores, and is independent of both the backend and the cost realism features.
- [v2.0 Roadmap 2026-07-03]: Phases 39, 40, and 41 all depend on Phase 38 but are otherwise independent of each other and can begin planning in parallel once Phase 38 is complete.
- [v2.0 Roadmap 2026-07-03]: Free-floor guarantee: every cost-model improvement (failure rate, TOU, maintenance amortization) ships to the free tier. No insight or cost feature requires an account.
- [Phase ?]: 40-01: Insight Layer money math has exactly two homes — computePerSaleProfit (historical sale profit) and calculateCost (scenario/live cost). 40-02..40-05 must never add a third.
- [Phase ?]: 40-01: computePrinterPayback's Unassigned bucket has no payoff concept (paidOff always false, missingPurchasePrice always false) — it exists only so unlinked sale totals stay honest, never to imply a phantom payable printer.
- [Phase ?]: 40-02: PeriodPicker exposes an onCustomRangeInvalidChange callback (beyond the plan's onRangeChange) so ReportsSection preserves the T-40-03 backwards-custom-range guard without re-deriving picker state — Lifting mode/year/month/quarter/custom state into PeriodPicker without a validity callback would have broken the Download-button disable + warning message, or forced ReportsSection to redeclare the same state machine the plan exists to eliminate
- [Phase ?]: 40-03: PeriodPicker gained an additive 'all-time' RangeMode + defaultMode prop (default 'month' unchanged) so Insights can satisfy the locked D-04 all-time default without forking a second range picker
- [Phase ?]: 40-03: InsightsPanel filters sales into the selected PeriodPicker range itself before calling computeWageHeadline/computeProductRanking, since insights.ts derivations have no built-in range parameter
- [Phase 40-04]: PrinterROI computes payback from the full sales history, not the PeriodPicker-scoped range used for wage/ranking — payback is a lifetime cumulative metric
- [Phase 40-04]: PrinterSettings reads sales/failureEvents/maintenanceEvents/materials/fxTable via its own hooks instead of threading five new props through App.tsx; old gross asking-price recovery math removed so both payback surfaces agree (D-16/P-01 closed)
- [Phase 40]: 40-05: WhatIfSimulator holds only ephemeral local state seeded from the saved job (filament price, TOU/electricity rate, failure rate) and reconciles computeScenario's cost/fixed-cost basis to the saved job so an untouched slider reports a true zero delta
- [Phase 40]: 40-05: Phase 33 branch (feat/insight-pricing-coach) retired — archive tag archive/phase-33-ui created at bcea107 before deletion so all 9 unmerged UI commits stay reachable; branch deliberately not merged since its UI is superseded by the Phase 40 Insights tab (D-15), only pure utils were ported in 40-01
- [Phase 41]: 41-01: Asset.hygroscopicityOverride uses the 3-value HygroscopicityClass union (not boolean) since hygroscopicity is inherently a 3-class enum per D-11, mirroring isAbrasive's undefined=auto-detect semantic but not its boolean shape
- [Phase 41]: 41-01: Asset.dryingLog is excluded from backupSchema DATE_FIELDS by design — it is an array of ISO date-only strings (D-10), not Date[], so the moisture-risk reader can parse the last entry without the field being coerced to a Date object
- [Phase 41]: 41-02: scanAffectedJobs mirrors computeScenario's RECONCILIATION RESIDUAL pattern exactly (old-price reconstruction minus job.costPerUnit = residual, carried into the new-price reconstruction) so it never drifts from the what-if simulator's cost math.
- [Phase 41]: 41-02: AssetLibrary gained its own useJobs/useUserProfile/usePrinterInstances/useElectricitySettings subscriptions scoped to the reprice scan, instead of threading five new props through App.tsx.
- [Phase 41]: 41-02: The reprice alert (banner + modal) lives in AssetLibrary's own component state, re-openable after toast dismissal (D-03); Apply writes exclusively through the existing updateJob hook, one job at a time (T-41-02b).
- [Phase ?]: 41-04: renderTotals gains an informational 'Variant options total' line (Sum qty x unitPrice) instead of replacing Subtotal — keeps D-22 tax-base lock and Subtotal/Tax/Total math untouched while the tier table above still reads as complete.
- [Phase ?]: 41-04: Quantity-variants discount defaults persist via localStorage (useLocalStorage hook), not a new UserProfile/Dexie field — quantities and the toggle reset per quote, only discount % carries over.
- [Phase ?]: 41-04: Convert-to-Sale tier picker implemented in RecordSaleModal.tsx (not JobsManager.tsx as the plan named) — RecordSaleModal owns the quantity/price form state and the Convert-from-Quote atomic transaction; JobsManager only controls open/close.
- [Phase 41]: 41-05: computeTaxThresholdProgress converts both the gross-revenue sum AND the fixed GBP/EUR/AUD threshold into userCurrency before comparing — a raw fixed-currency threshold cannot be validly divided against revenue summed in a different currency
- [Phase 41]: 41-05: crossing-alert once-only guard uses a single localStorage key (jurisdiction:taxYearLabel), not a UserProfile field, so it self-resets at the next tax-year boundary
- [Phase 41]: 41-03: detectHygroscopicityClass matches nylon by name (nylon|pa6|pa11|pa12|polyamide) in addition to the two CF-nylon FilamentTypes, mirroring abrasive.ts's dual match — closes the FilamentType nylon gap (Pitfall 1).
- [Phase 41]: 41-03: RISK_THRESHOLDS (HIGH 1/3, MEDIUM 3/7, LOW 14/30 days) shipped verbatim as the user-confirmed values locked at plan-phase — not re-derived.
- [Phase 41]: 41-03: MoistureRiskBadge and log-drying were added to both the desktop MaterialRow and the mobile MobileCardItem (plan named MaterialRow only) for feature parity with StockBadge/EditButton/DeleteButton, which already exist in both rows.
- [Phase ?]: Cookie settings entry placed in gear-icon SettingsModal Data tab (not the ?tab=settings PrinterSettings route) per Pitfall 3 disambiguation
- [Phase ?]: CookieSettingsLink renders a raw button with allow-raw-html justification instead of the shared Button primitive, matching the JobsManager.tsx overflow-toggle precedent
- [Phase 42]: 42-02: shouldShow's auto-skip (instances.length===0) only applies while onboardingStep is still 0 - once step > 0 the overlay stays visible/resumable regardless of owned-printer count, otherwise the wizard's own step-0 tile write immediately re-triggers its own auto-skip and breaks resume-after-reload
- [Phase 42]: 42-02: filament/price-a-job wizard steps advance via a baseline-count-on-entry pattern (materials.length/jobs.length captured on step entry, advance when it increases) instead of a raw count===0 check, since the printer+filament catalogs are auto-seeded into db.materials on a brand-new DB
- [Phase 42]: 42-03: Privacy Policy processor list traces line-by-line to docs/DATA-FLOW-INVENTORY.md (built from vercel.json connect-src, cross-checked against grep fetch( src/) — inventory updated first, policy second (Pitfall C-05 defense)
- [Phase 42]: 42-03: Terms of Service Pro-tier section stays fully generic (no prices/cycles/refunds) per D-06 — a regex guard in TermsPage.test.tsx prevents an accidental price leak before Phase 43 sets real pricing
- [Phase ?]: 42-04: vanilla-cookieconsent hideFromBots default checks navigator.webdriver and silently hides the banner from Playwright's Chromium (webdriver=true by default) - fixed test-side via page.addInitScript, not by disabling hideFromBots in production config
- [Phase ?]: 42-04: E2E equal-weight button assertion compares computed padding/font-weight/font-size/border for exact equality plus exact height, with a 12px width tolerance - raw width alone is not a reliable equal-weight signal since different button labels render at slightly different natural glyph widths
- [Phase 42-gdpr-onboarding]: 42-05: Fix confined entirely to the step-0 tile onClick (await addInstance then advanceStep(1)); useOnboarding.ts shouldShow/auto-skip (D-09) left byte-for-byte unchanged
- [Phase 42-gdpr-onboarding]: 42-05: Existing step-0 auto-advance effect kept as a best-effort fallback for a manual 'Mine isn't listed' add; advanceStep(1) is idempotent so it cannot double-advance against the tile's deterministic call
- [Phase 43-02]: vercel.json connect-src uses wildcard https://*.supabase.co (not the literal project ref) because plan 43-01's Supabase project had not yet been created; RLS/RPC (not CSP) is the actual anti-enumeration boundary
- [Phase 43-02]: Pro pricing surfaced verbatim in ToS: EUR 6.90/month and EUR 69/year, Paddle as Merchant of Record, no free trial, lapse-safe existing hosted-quote links after cancellation
- [Phase 43]: 43-01: Live Supabase project created and migration applied via mcp__supabase__apply_migration (Supabase MCP), not supabase db push -- user-approved substitution, no CLI credentials configured — The plan's user_setup step required a manual dashboard project creation; user approved MCP-based creation (How to Project org, $10/mo, confirmed via MCP cost-confirmation flow) instead, applying the migration directly through the MCP tool
- [Phase 43]: 43-03: T-43-09 accepted — supabase-js session in localStorage (pure SPA, no httpOnly path); strict CSP script-src 'self' is the compensating XSS control
- [Phase 43]: 43-03: supabaseClient degrades to null+warn when VITE_SUPABASE_URL/ANON_KEY absent (never a module-load throw) — free floor must survive an unconfigured deploy (PRO-01)
- [Phase 43]: 43-03: flowType 'pkce' pinned explicitly in createClient options; e2e/free-floor-no-network.spec.ts is the permanent PRO-01 boundary regression guard
- [Phase ?]: 43-05: Expired-but-published hosted quotes render the SAME branded 404 as unpublished/unknown (D-16 supersedes a distinct D-14 expired message); the expiry check lives in api/q/[token].ts since the RPC only filters status='published'
- [Phase ?]: 43-05: /q/* function reads server-env SUPABASE_URL/SUPABASE_ANON_KEY (never VITE_-prefixed, never service-role) via a raw-fetch RPC helper — no @supabase/supabase-js in the function bundle
- [Phase ?]: 43-05: on-quote-decision edge function no-ops gracefully (200 + warn) when RESEND_API_KEY is unset — decision stays recorded in DB, in-app refreshStatuses still surfaces it; Resend setup is an open operator step
- [Phase ?]: 43-05: resend package-legitimacy blocking checkpoint executed OUT OF ORDER (import committed before the gate) — self-caught, verified live against npm (v6.17.2, official resend/resend-node), retroactively approved by user; flagged for the 43-07 security review
- [Phase 43-pro-backend]: 43-04: publish snapshot includes businessName (from UserProfile.name) + embedded variantsSnapshot, closing 43-05's cross-plan Known Stub so the hosted page renders the maker-brand line and quote-variant tiers — api/q/[token].ts's HostedSnapshot contract already expected these optional fields inside the single snapshot jsonb column; Quote.lineItemsSnapshot alone never carried them
- [Phase 43-pro-backend]: 43-04: ShareQuoteButton discriminates signed-in vs signed-out only (not a live per-row entitlement read) for the Pro-chip/pitch-modal branch — avoids reintroducing the PERF-09 N-subscription/N-request problem across quote rows; 43-06 billing has not shipped so there is no live entitled state to distinguish yet; the D-11 gate is still enforced inside publish() regardless
- [Phase 43-pro-backend]: 43-04: publish/unpublish threaded from ONE usePublishedQuote() call per container (JobsManager, PrintQuoteModal) down through JobCard/OrdersSection/OrdersQuoteRows/QuoteRow as optional props — mirrors the existing PERF-09 updateQuote threading pattern; keeps publishQuote/unpublishQuote optional so ~20 pre-existing JobsManager.test.tsx call sites did not need touching
- [Phase 43]: 43-06: entitlement user_id mapping = Paddle checkout customData only (PADDLE_API_KEY lookup fallback reserved, unimplemented); webhook verifies the Paddle signature over the RAW body BEFORE parse/write per Paddle's documented HMAC recipe (no @paddle/paddle-node-sdk install)
- [Phase 43]: 43-06: Pro-status vocabulary centralised in useEntitlement.isProStatus (active + past_due = Pro, trialing rejected per D-04); usePublishedQuote's D-11 publish gate now shares it — the 43-04-flagged reconciliation
- [Phase 43]: 43-06: Cancel action is env-driven via optional VITE_PADDLE_CANCEL_URL (entitlements schema has no management_urls column); absent, BillingPanel points at Paddle receipt-email manage links
- [Phase ?]: 43-07: PRO-03 security review signed at PRE-DEPLOY scope (Marcus Dickinson 2026-07-16) — verified-now evidence accepted; production shipping deferred until all of v2.0 is built; 9 deploy-time items + webhook-auth migration moved to the v2.0 Launch-Day Checklist in docs/PRO-SECURITY-REVIEW.md Part 5 (joins Phase 42 test 4 as item 0)
- [Phase ?]: 43-07: notify_quote_decision() webhook auth gap dispositioned OPEN/tracked non-blocking — pg_net POST has no Authorization header vs verify_jwt=true edge function; inert while app.settings.functions_url is NULL; remediation = follow-up migration adding anon-key bearer + functions_url at deploy (launch-day item 9)
- [Phase ?]: 43-07: 43-05 resend package-gate ordering violation CLOSED — zero execution exposure, registry-verified official package, retroactive user approval; process note: blocking-human gates mean no commits until resume signal
- [Phase ?]: 44-01: computeMerge resolves tombstone edit-wins symmetrically (remote tombstone vs local edit, AND local tombstone vs resurrecting remote edit) — the plan's explicit truth only names one direction, but MergeInput carries both localTombstones and remoteTombstones
- [Phase ?]: 44-01: exported isPlainRecord/hasForbiddenKey from backupRestore.ts (previously private) so syncMerge.ts's tombstone-array validation reuses the same forbidden-key guard rather than a second validator
- [Phase ?]: 44-02: stlParser.ts deliberately has no three import - operates on raw Float32Array position buffer, keeping it worker-callable and testable without the three chunk
- [Phase ?]: 44-02: detectNonManifold welds vertices to a 1e-5 default tolerance before building the edge-adjacency map (Pitfall 4) so real slicer float-rounding noise does not false-positive a closed mesh
- [Phase ?]: 44-02: meshWeightModel approximates top/bottom footprint as a fixed 1/3 fraction of total surface area (box-equivalent heuristic) since WeightModelInput carries no separate footprint area - anti-underestimate guarantee holds regardless of the exact fraction
- [Phase ?]: 44-02: three package-legitimacy checkpoint approved by user in a prior session (RESEARCH.md documented SUS-false-positive audit); this session reconciled the already-installed-but-uncommitted state into a proper chore commit
- [Phase ?]: 44-03: reset*ToDefaults helpers swap post-clear() bulkAdd for stampAndBulkPut (behaviorally identical, stamping now in scope)
- [Phase ?]: 44-03: category-scoped bulk .where(...).delete() resets are intentionally NOT tombstoned (catalog-level, not single-record user deletions)
- [Phase ?]: 44-03: stock/failure/maintenance ledger events deferred from sync stamping/tombstoning — derived, regenerated-on-save records, not independently user-edited
- [Phase ?]: 44-03: deleteJob now tombstones each cascade-deleted sale individually (Rule 2 fix)
- [Phase ?]: 44-03: applyMerge always scopes its transaction to every BACKUP_STORES table, mirroring restoreBackup.ts
- [Phase 44]: 44-04: Web Locks is the mutex, BroadcastChannel is notification-only for sync's read-merge-write critical section — RESEARCH.md anti-pattern guard — never conflate the two
- [Phase 44]: 44-04: web FileSystemDirectoryHandle persisted in a dedicated IndexedDB store, desktop sync-folder path persisted via the existing settings store — handles are structured-clonable but not JSON-serializable, so they cannot go through setSetting's JSON.stringify
- [Phase 44]: 44-05: Camera framing uses bounding-sphere-in-frustum distance (radius * margin / sin(fov/2)), not axis-aligned maxDim — fixes preview clipping found in Task 4 human-verify round 1
- [Phase 44]: 44-05: Preview pane needs self-start plus a derived aspect ratio from the model's bbox (isometric corner-projection) — flex align-items:stretch was stretching the wrapper independent of the canvas's own size, found in round 2
- [Phase 44]: 44-06: useSyncFolder composes withSyncLock -> readSyncFile -> validateSyncFile+computeMerge -> confirm-gated applyMerge -> writeSyncFileAtomic -> notifyPeers in the exact key_links order; a module-scoped useSyncExternalStore shares one live sync state between App.tsx's launch check and SyncSetup
- [Phase 44]: 44-06: SyncMergeSummary takes the full MergePlan (not the bare MergeSummary the plan's action text named) since only MergePlan carries the per-record names/ids needed for the expand-detail
- [Phase 44]: 44-06: Rule 1/2 fix — useSyncFolder's ensureInitialized/checkOnLaunch now catch platform-capability probe failures instead of leaving an unhandled promise rejection, since sync is opt-in (D-01) and must never crash a host component's mount
- [Phase ?]: 45-01: Slate-equivalent :root token defaults verified empirically via headless Playwright (not just code inspection) — /app has zero .theme-brand-dark ancestor, --brand resolves to #2563eb; marketing routes resolve #1796ff (D-02 confirmed)
- [Phase ?]: 45-01: BRAND-01 requirement left unmarked-complete after plan 1/11 — it spans the whole 11-plan phase; will be marked complete when the full redesign port lands
- [Phase ?]: [Phase 45]: 45-02: Branch's Button/Card/Input/Select/Textarea var() diffs adopted verbatim (no rewriting) since 45-01 already made this app-safe via slate-equivalent :root defaults
- [Phase ?]: [Phase 45]: 45-02: Header.tsx fully removed the HeaderVariant/variant="light" mechanism and its --paper/--pine/--surface-sunk references (dead code) rather than keeping an unused prop
- [Phase ?]: [Phase 45]: 45-02: Footer Product column gained a Pricing link alongside the required Legal-column Privacy/Terms/CookieSettingsLink preservation, keeping footer nav consistent with the new Header /pricing entry
- [Phase ?]: 45-03: TDD RED/GREEN followed literally - PricingPage.test.tsx written first and confirmed failing (src/pricing.ts import unresolved) before src/pricing.ts was created to make it pass
- [Phase ?]: 45-03: Pro feature list on /pricing derived from the actual shipped Pro surface (hosted quote links via usePublishedQuote/ProPitchModal) rather than invented copy
- [Phase ?]: 45-03: PricingPage built natively against the Cost-Truth Dark token system (var(--brand) etc, matching Header/Card conventions from 45-01/45-02) since it is a NEW page, not a port
- [Phase ?]: 45-06: DownloadPage/FAQPage ported as content-merges (branch's visual layout + main's exact Linux logic / current Q&A content), not naive restyles — resolves two independently-diverged implementations
- [Phase ?]: 45-07: RoadmapPage D-13 content refresh needed only additions (CURR-01/SYNC-02/TOU-03); no shipped v2.0 feature was ever present in roadmap.ts to remove
- [Phase ?]: [Phase 45]: 45-08: Consent-banner brand override implemented as an additive body.route-marketing #cc-main CSS block appended after the untouched base #cc-main block, not a rewrite — /app and desktop provably unaffected by diff inspection alone
- [Phase ?]: [Phase 45]: 45-08: Every --cc-* color variable overridden (not just the plan's minimum list) so no half-themed banner state exists; border-radius/padding/font-weight left undeclared to preserve the Pitfall 5 equal-weight contract
- [Phase ?]: [Phase 45]: 45-08: PrivacyPage/TermsPage gained font-display + aria-labelledby main landmark wiring matching the a11y pattern already established on other ported marketing pages
- [Phase ?]: 45-09: Nudge fires only on NEW value moments (new job save, new quote create, new sale record), not edits — gated by !isEdit/!editingSale
- [Phase ?]: 45-09: Pro upgrade target is the external /pricing page (Tauri-safe open), not a new in-app modal callback threaded through 3 save-success components — keeps app-side touches minimal per D-03
- [Phase ?]: 45-09: SUPPORT_URL/openSupportLink renamed to PRO_UPGRADE_URL/openProUpgradeLink; mechanic names (shouldShowSupportNudge, cooldown, storage key) left unchanged
- [Phase ?]: 45-04: Added a standalone four-pillar 'What's new' section on LandingPage to literally satisfy D-11 (all four v2.0 pillars headline-billed), rather than relying only on the hero + bento
- [Phase ?]: [Phase 45]: 45-05: FeaturesPage ported using the branch's competitor-matrix structure (verified-via-live-walkthrough SlicePrice3D data) rather than main's older 3DPrintForce table; 9 new comparison-table rows added for shipped v2.0 capabilities using "-" for unverified competitor cells; 3DCoster Pro column mirrors Free everywhere except the hosted-quote-links row (the only real Pro-gated capability)
- [Phase ?]: docs/PRODUCT.md + docs/DESIGN.md ported from the design branch, reconciled for the shipped /pricing page and self-hosted font (no Google Fonts); Header's stale variant=light note dropped since 45-02 removed it entirely
- [Phase ?]: CHANGELOG [2.0.0] section written as user-facing Added/Changed/Security bullets covering all 8 v2.0 phases; version bumped to 2.0.0 across src/version.ts, tauri.conf.json, Cargo.toml, and Cargo.lock (lockfile bump mirrors the v1.9.0 release precedent); no git tag created, nothing pushed (D-15/D-16)
- [Phase ?]: Launch-comms kit (announcement.json + docs/launch/LAUNCH-COMMS.md) drafted with Pro as the single monetization voice, no donation ask; founder publishes manually on launch day
- [Phase ?]: 45-11: Archive tags must be lightweight (git tag <name> <sha>), not annotated -- annotated tags resolve to a distinct tag-object SHA under git rev-parse, breaking the archive-tag-equals-branch-tip verification; matches the archive/phase-33-ui precedent
- [Phase ?]: 45-11: A ported-not-merged branch is never an ancestor of HEAD, so git branch -d always refuses 'not fully merged' -- this is expected once the archive tag is confirmed identical to the branch tip, not a red flag; -D is the correct next step (mirrors feat/insight-pricing-coach/archive/phase-33-ui)
- [Phase ?]: 45-11: Phase 45 (Brand & Launch) complete -- targeted D-17 review found 0 CRITICAL/1 HIGH (fixed: Footer.tsx donation link removed, closing D-03's one-monetization-voice truth), design branch archived+retired, BRAND-01 marked complete; main is launch-ready with no v2.0.0 tag and nothing pushed (D-15)
- [Phase ?]: 45-12: useDisplayPrice reads stored userProfile currency via getSetting(null default), never getUserProfile's CAD DEFAULT_PROFILE — a never-set visitor falls through to locale inference instead of being silently treated as Canadian
- [Phase ?]: [Phase 45]: 45-13: Hero inner block wrapped in an additional outer max-w-6xl mx-auto Reveal for structural consistency with sibling sections, even though it was not visually full-bleed beforehand
- [Phase ?]: [Phase 45]: 45-13: Coming to Pro strip on /features is a plain string array kept in lockstep by comment cross-reference with roadmap.ts's pro:true items, not imported directly (roadmap descriptions are longer-form than the compact strip UI)
- [Phase ?]: [Phase 45]: 45-14: Pro price re-based EUR 6.90/EUR 69 -> USD 7.99/USD 79 (founder decision, company is Canadian, bill in USD); USD deliberately excluded from the dollar-disambiguation table since it is the billing base, shown only via its ISO-code label
- [Phase ?]: [Phase 45]: 45-14: Free-card zero on /pricing derives its currency from whichever branch the Pro card actually renders (approx vs USD billing fallback), never from displayCurrency alone -- closes G-45-PRICING-CONSISTENCY
- [Phase ?]: [Phase 45]: 45-15: Free-vs-Pro intro paragraph on /features rewritten to drop its inline feature list entirely (kept free-forever + one-thing-added framing) rather than trimming it, since the full list already lives in the Free card ten lines below
- [Phase ?]: [Phase 45]: 45-15: STAGES table header title kept at full 'Cost-Truth Engine' length without shortening the blurb -- the workflow-coverage table already sits inside an overflow-x-auto/min-w-[640px] wrapper, so the longer title cannot visually crowd the header
- [Phase ?]: [Phase 45]: 45-16: comingPro cell class deliberately matches yesPro's tint (tdPro base + brand-soft text) so the Pro column reads as one visual group — the 'not shipped yet' signal lives entirely in the ComingCell outlined pill, not the cell background
- [Phase ?]: [Phase 45]: 45-16: Competitor cells on all five new /features Pro rows default to em dash — no concrete data point exists in 45-RESEARCH.md for white-label quotes, live carrier APIs, QuickBooks/Wave sync, or cloud device sync on any competitor
- [Phase ?]: 46-01: logoDataUrl placed directly below UserProfile.name (brand identity co-located); MAX_LOGO_DATA_URL_LENGTH=205,000 chars and MAX_LOGO_UPLOAD_BYTES=5MB pre-decode cap; zero new npm dependency (vanilla Canvas)
- [Phase ?]: 46-03: Logo disclosure rides the EXISTING Supabase hosted-quote row/flow, not a new destination — joins the existing hosted_quotes.snapshot jsonb column (RESEARCH A3, no new migration)
- [Phase ?]: 46-02: Desktop Supabase client un-gated (D-08 reverses Phase 43 D-12); OTP verifyEmailCode added to useProAuth/SignInModal; checkpoint approved with deferrals — production Magic Link template + GitHub Actions secrets fixed live, full desktop-UI round trip/session persistence/signed-out network silence deferred to Phase UAT; launch checklist gained custom-SMTP item
- [Phase ?]: 46-04: generateQuotePdf(quote, branding?) — QuoteBranding injected by PrintQuoteModal from live isPro + userProfile at download time (D-10 asymmetry vs frozen hosted-page snapshot); module stays pure, no Dexie/UserProfile import
- [Phase ?]: 46-04: useEntitlement caches last-known-good status per-user-id in localStorage, written on every successful read (any status) and read only as a fallback on a failed read when userId is present — signed-out never reads the cache (D-07/D-06)
- [Phase ?]: 46-06: BrandingSection mounted in UserProfileModal alongside Name field, gated on live isPro; free Pro-chip opens the one ProPitchModal (D-14) deferring sign-in to the existing App-level SignInModal (D-09); desktop gate flips for Account & Pro / SignInModal were already done in 46-02 — confirmed, no further change; checkpoint approved with Pro-signed-in upload flow, oversized-file rejection, and desktop tauri-dev rendering deferred to phase UAT
- [Phase ?]: [Phase 46]: 46-05: D-09 footer rule stays deliberately different from the PDF's D-05/D-10 rule — the hosted page keeps 'Powered by 3DCoster' until a logo is actually set, not for every Pro user
- [Phase ?]: [Phase 46]: 46-05: Server-side logo validator (api/lib/logoDataUrl.ts) is a byte-identical lockstep copy of src/utils/logoDataUrl.ts, not an import, since api/ is a separate Vercel Function bundle — re-validated at render time so a tampered Supabase row can never reach the HTML (Pitfall 4)
- [Phase ?]: [Phase 46]: 46-07: Only the two white-label /features rows flipped (Etsy/carrier/QuickBooks/cloud-sync ComingCell rows untouched, ship in Phases 47-50); ComingCell doc comment corrected from 46-50 to 47-50 phase range
- [Phase ?]: [Phase ?]: 46-07: PricingPage PRO_FEATURES gained a white-label bullet; roadmap.ts white-label item removed per its own ship-and-remove contract, keeping /roadmap in lockstep with the /features Coming-to-Pro strip; src/pricing.ts and price strings untouched
- [Phase ?]: 46-09: resetSignIn() gates on session (not status) to guarantee a signed-in user can never be reset to signed-out; SignInModal test mock replaced with a transitionable module-level mock (frozen-status mock could never express a lifecycle transition)
- [Phase ?]: [Phase 46]: 46-10: G-46-6/D-08 supersedes 46-02-PLAN.md:49's web-only ShareQuoteButton scope decision — removed the __IS_TAURI__ gate so hosted-quote publishing works on both platforms; BillingPanel.tsx:50's separate web-only billing gate flagged as an open founder question, not touched
- [Phase ?]: 46-08: Confirm-signup template fix applied via Supabase Management API (PATCH .../config/auth, mailer_templates_confirmation_content) with explicit founder approval during the Task 2 checkpoint, not the dashboard UI; GET re-read confirmed byte-for-byte before live verification (G-46-2 closed).
- [Phase ?]: 46-08: docs/SUPABASE-EMAIL-TEMPLATES.md corrected from secondhand-reconstructed template bodies to authoritative byte-for-byte Management API reads after the live GET showed the production 'Confirm signup' stock body differed from the doc's reconstruction (both templates corrected, commit 2689f02).
- [Phase 46]: 46-11: HostedLinkActions mounted at both persistent published-quote surfaces (JobsManager row + PrintQuoteModal footer), keyed directly on publishStatus/publishedUrl rather than nested inside ShareQuoteButton, so the declined+published case (no ShareQuoteButton row) still surfaces its link — Closes G-46-6R; copyToClipboard() util shared between HostedLinkActions and ShareQuoteButton's publish toast eliminates the navigator.clipboard optional-chain false-positive on desktop WebViews
- [Phase ?]: 46-12: vercel.json /q/:token rewrite placed first, ahead of the SPA catch-all (non-conflicting, SPA source already excludes q/ and api/)
- [Phase ?]: 46-12: NotFoundPage noindex-meta effect creates/removes its own element instance per run, inherently StrictMode-safe without querySelector dedup
- [Phase ?]: [Phase 47]: 47-01: Inventory row lists exactly the 4 D-08 fields; cloud sync disclosed as an extension of the existing Supabase processor entry (no new processor row, no new connect-src origin — Realtime reuses *.supabase.co)
- [Phase ?]: [Phase 47]: 47-02: Task 3 checkpoint resolved live via Supabase MCP apply_migration — a Realtime tenant bootstrap probe (anon channel-subscribe) was needed before first apply since the project's Realtime service had never been used; two anon-revoke residues (RPC EXECUTE + table ACL) found live and closed via follow-up migrations, reconciled into the repo as 0003_cloud_sync_anon_revoke.sql so the repo migration chain matches production exactly
- [Phase ?]: [Phase 47]: 47-03: Package-legitimacy gate for @zxcvbn-ts/language-common resolved — [SUS] flag was an automated too-new-version heuristic, not a legitimacy problem (same GitHub monorepo/maintainer as pre-approved @zxcvbn-ts/core, zero lifecycle scripts, MIT, 989k weekly downloads); founder approved all 4 packages after independent orchestrator re-verification
- [Phase ?]: [Phase 47]: 47-03: ARGON2ID_PARAMS shipped as a fixed exported constant (m=64MiB, t=3, p=1) with a never-silently-bump code comment; checkPassphraseStrength floor set at zxcvbn score >= 3
- [Phase ?]: [Phase 47]: 47-03: hash-wasm's bare-Uint8Array argon2id return needed re-wrapping (new Uint8Array(rawKey)) before crypto.subtle.importKey to satisfy tsc -b's stricter BufferSource<ArrayBuffer> check — vitest's esbuild transform doesn't catch this, only tsc -b does
- [Phase ?]: [Phase 47]: 47-04: cloudBlobIO's getLastKnownVersion/setLastKnownVersion deliberately skip the supabase-null/signed-out guard — they are pure local settings-store reads/writes with no network component regardless of session state
- [Phase ?]: [Phase 47]: 47-04: broadcastBlobUpdated opens a fresh Realtime channel per call (subscribe -> send -> removeChannel) rather than holding a persistent channel, keeping the module a pure non-hook transport layer
- [Phase ?]: 47-05: cloudSyncGates.needsRiskyConfirmation deliberately does NOT reuse useSyncFolder's needsConfirmation — a separate, looser, graduated predicate so routine cloud merges apply silently instead of confirm-gating on any change
- [Phase ?]: 47-05: syncMeta.deviceId for the cloud channel is generated in-memory only (not a 5th settings key) since computeMerge never reads it and the plan's Artifacts section names exactly 4 settings keys
- [Phase ?]: 47-05: cloud ciphertext base64<->bytes conversion implemented locally in useCloudSync.ts since sync_blobs.ciphertext is base64 TEXT (not bytea, which PostgREST hex-encodes and would break decrypt)
- [Phase ?]: 47-05: uploadWithRetry's CAS-conflict callback re-merges best-effort and re-encrypts rather than re-running the confirm gate a second time — the outer bounded 3-attempt retry remains the guarantee against a silent lost write
- [Phase ?]: [Phase 47]: 47-06: CloudSyncSetup owns its own ProPitchModal state + onOpenSignIn prop (mirrors BrandingSection/UserProfileModal D-13/D-14); wrong-passphrase/decrypt-failure messaging renders useCloudSync's existing cloud.error verbatim rather than re-deriving it; D-14 level-2 delete confirmation counts live hosted quotes via local Dexie .filter() (publishStatus is unindexed) instead of a network round trip

### Pending Todos

- Phase 38 requires a research spike BEFORE plan creation — useCostDerivedValues dep-array design is the highest-risk decision in the milestone. Run `/gsd:plan-phase 38` with research enabled.
- PERF-11 is now addressed in Phase 38 (FOUND-02) as part of the CostCalculator split — the correct fix belongs with useCostDerivedValues, not a dep-trim patch.
- Backend choice is locked (Supabase eu-central-1) but Supabase auth implementation details need a concrete plan at Phase 43 planning time.
- Pro tier pricing: three placeholder spots exist. Founder must set actual price before Phase 45 ships. Anchor: 3DPrintQuote €9.90/mo.
- Tax threshold data for LIFE-02 is MEDIUM confidence — the UI must show "data current as of [date]" and "consult a qualified accountant" disclaimer.
- PRE-LAUNCH (phase 51, after Paddle SKUs exist): swap marketing FX approximation for Paddle PricePreview (real localized price in visitor's currency) and remove/demote the "Billed as USD 7.99" line — founder decision 2026-07-22. Details: .planning/todos/pending/paddle-price-preview-localized-pricing.md

### Blockers/Concerns

- None blocking — Phase 46 closed 2026-07-23 with UAT 18/18 passed (all 4 gap-closure plans executed and re-verified).
- ⚠️ [Phase 46] Reminder: delete scripts/seed-pro-entitlement-uat.sql-seeded entitlement rows before real billing/launch testing.
- ⚠️ [Phase 46] BillingPanel.tsx web-only Pro gate (Paddle billing) is an OPEN founder question (tracked in 46-10-SUMMARY) — conflicts with the web+desktop parity rule; decide before Phase 51 launch-prep.
- ⚠️ [Phase 46] Launch-day checklist item 12 (docs/PRO-SECURITY-REVIEW.md Part 5): real-HTTP preview-deploy verification of the /q/:token rewrite — production stays pre-v2.0 until founder deploys.
- ⚠️ [Phases 48–50 external gates] Founder operator actions in parallel NOW: Etsy dev app registration, Intuit dev app registration, shipping-aggregator account.

## Session Continuity

Last session: 2026-07-24T03:18:03.694Z
Stopped at: Completed 47-06-PLAN.md
Resume file: None

## Operator Next Steps

- Run `/gsd:plan-phase 38` with research enabled (research spike required before coding)
- Phases 39, 40, 41 can be planned in parallel after Phase 38 completes
- Phase 42 (GDPR) must complete and be verified live in production before Phase 43 begins
- Phase 43 needs research spike at plan time (Supabase auth implementation, billing provider)
- Phase 44 needs research spike at plan time (sync conflict detection, atomic write)

## Deferred Items

Carried forward from v1.9 (acknowledged at v1.9 close 2026-07-03):

| Category | Item | v2.0 disposition |
|----------|------|-----------------|
| backlog | PERF-11 pricing dep-trim | Addressed in Phase 38 (FOUND-02) |
| backlog | Tab-in-URL browser navigation | Addressed in Phase 38 (FOUND-03) |
| backlog | etsy_offsite_ad in RecordSaleModal | Deferred to v3.0+ (MISC-01, not in v2.0 scope) |
| backlog | Guided first-run onboarding | Addressed in Phase 42 (ONBD-01) |
| backlog | CostCalculator God-component split | Addressed in Phase 38 (FOUND-01) |
| backlog | Cost-Truth Dark redesign merge | Addressed in Phase 45 (BRAND-01) |
| v1.3-carryover | Customer CSV export | Still pending — no v2.0 requirement |
| v1.3-carryover | VoiceOver UAT (Phase 19) | Still pending — no v2.0 requirement |
| v1.3-carryover | TAGS-F4 tag colors, DUP-F1 duplicate UI | Still pending — no v2.0 requirement |
| Phase 40 P01 | 20min | 3 tasks | 9 files |
| Phase 40-insight-layer P02 | 3min | 2 tasks | 5 files |
| Phase 40 P03 | 5min | 3 tasks | 12 files |
| Phase 40 P04 | ~5min | 3 tasks | 3 files |
| Phase 40 P05 | ~25min | 5 tasks | 8 files |
| Phase 41 P01 | 15min | 2 tasks | 4 files |
| Phase 41 P02 | 25min | 3 tasks | 5 files |
| Phase 41 P04 | 35min | 3 tasks | 7 files |
| Phase 41 P05 | ~20min | 3 tasks | 5 files |
| Phase 41 P03 | 6min | 3 tasks | 3 files |
| Phase 42 P01 | 20min | 3 tasks | 13 files |
| Phase 42 P02 | 35min | 3 tasks | 8 files |
| Phase 42 P03 | 12min | 2 tasks | 8 files |
| Phase 42 P04 | 25min | 2 tasks | 6 files |
| Phase 42-gdpr-onboarding P05 | 20min | 2 tasks | 3 files |
| Phase 43-pro-backend P02 | 25min | 3 tasks | 7 files |
| Phase 43 P01 | 20min | 2 tasks | 2 files |
| Phase 43 P03 | ~35min | 3 tasks | 12 files |
| Phase 43-pro-backend P05 | 30min | 3 tasks | 6 files |
| Phase 43-pro-backend P04 | 50min | 2 tasks | 14 files |
| Phase 43-pro-backend P06 | 30min | 3 tasks | 13 files |
| Phase 43 P07 | 20min | 2 tasks | 1 files |
| Phase 44 P01 | 6min | 3 tasks | 6 files |
| Phase 44 P02 | 35min | 3 tasks | 10 files |
