---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Cost-Truth & Insight
current_phase: 45
current_phase_name: brand-launch
status: executing
stopped_at: Completed 45-01-PLAN.md
last_updated: "2026-07-20T13:11:51.629Z"
last_activity: 2026-07-20
last_activity_desc: Phase 45 execution started
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 49
  completed_plans: 39
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md. Milestone roadmap: [ROADMAP.md](ROADMAP.md) (Phases 38–45). Source of requirements: .planning/REQUIREMENTS.md (27 v1 requirements, 100% mapped).

**Core value:** Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.
**Current focus:** Phase 45 — brand-launch

## Current Position

Phase: 45 (brand-launch) — EXECUTING
Plan: 2 of 11
Status: Ready to execute
Last activity: 2026-07-20 — Phase 45 execution started

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

### Pending Todos

- Phase 38 requires a research spike BEFORE plan creation — useCostDerivedValues dep-array design is the highest-risk decision in the milestone. Run `/gsd:plan-phase 38` with research enabled.
- PERF-11 is now addressed in Phase 38 (FOUND-02) as part of the CostCalculator split — the correct fix belongs with useCostDerivedValues, not a dep-trim patch.
- Backend choice is locked (Supabase eu-central-1) but Supabase auth implementation details need a concrete plan at Phase 43 planning time.
- Pro tier pricing: three placeholder spots exist. Founder must set actual price before Phase 45 ships. Anchor: 3DPrintQuote €9.90/mo.
- Tax threshold data for LIFE-02 is MEDIUM confidence — the UI must show "data current as of [date]" and "consult a qualified accountant" disclaimer.

### Blockers/Concerns

None currently — roadmap created, all requirements mapped, all gates documented.

## Session Continuity

Last session: 2026-07-20T13:11:51.620Z
Stopped at: Completed 45-01-PLAN.md
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
