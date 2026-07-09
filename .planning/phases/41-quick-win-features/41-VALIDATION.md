---
phase: 41
slug: quick-win-features
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-09
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run <path>` (single touched test file) |
| **Full suite command** | `npm run test` (= `vitest run`) |
| **Estimated runtime** | Single file ~seconds; full suite ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command (single-file `npx vitest run <path>` or `npx tsc -b`)
- **After every plan wave:** Run `npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 41-01-T1 | 01 | 1 | CONN-01, CONN-03, LIFE-01, LIFE-02 | T-41-01b | All new fields optional/non-indexed, read with `undefined = existing default`; no new runtime input surface | type-check | `npx tsc -b 2>&1 \| tail -5` | ✅ types.ts / features.ts (extended) | ⬜ pending |
| 41-01-T2 | 01 | 1 | CONN-01, CONN-03, LIFE-01, LIFE-02 | T-41-01a | `openedAt` added to explicit `DATE_FIELDS` allowlist; no blanket ISO reviver; invalid Date fails whole-file validation | unit | `npx vitest run src/utils/backupExport.test.ts` | ✅ backupExport.test.ts (extended) | ⬜ pending |
| 41-02-T1 | 02 | 2 | CONN-01 | T-41-02a | Reuses `calculateCost` + `priceFromMargin` only (no forked formula); `pricePerGram`-override rows excluded (Pitfall 2) | unit (tdd) | `npx vitest run src/utils/repriceAlert.test.ts` | ✅ created in this task (Wave 0) | ⬜ pending |
| 41-02-T2 | 02 | 2 | CONN-01 | T-41-02b | Apply writes only through existing `updateJob` hook, one job at a time; scan module stays read-only | type-check | `npx tsc -b 2>&1 \| tail -5` | 🆕 RepriceReviewModal.tsx (new component) | ⬜ pending |
| 41-02-T3 | 02 | 2 | CONN-01 | T-41-02a, T-41-02b | Scan guarded behind a `costPerUnit`-changed check (D-01); Apply persists via `updateJob`, never bulk-mutate | full suite | `npm run test 2>&1 \| tail -15` | ✅ AssetLibrary.tsx (extended) | ⬜ pending |
| 41-03-T1 | 03 | 3 | LIFE-01 | T-41-03b | Day thresholds sourced + cited in code, user-confirmed (2026-07-09), framed MEDIUM-confidence guidance; display-only, no money math | unit (tdd) | `npx vitest run src/utils/hygroscopicity.test.ts` | ✅ created in this task (Wave 0) | ⬜ pending |
| 41-03-T2 | 03 | 3 | LIFE-01 | T-41-03a | Free-text/badge rendered via React default JSX escaping; no `dangerouslySetInnerHTML`; shared IconButton (no raw button) | lint + type-check | `npm run lint:no-raw-html && npx tsc -b 2>&1 \| tail -5` | ✅ AssetLibrary.tsx (extended) | ⬜ pending |
| 41-03-T3 | 03 | 3 | LIFE-01 | T-41-03a, T-41-03c | `storageLocation`/drying entries escaped by React; `daysSinceOpened` returns null for unset `openedAt` (no false LOW) | full suite | `npm run test 2>&1 \| tail -15` | ✅ AssetLibrary.tsx (extended) | ⬜ pending |
| 41-04-T1 | 04 | 2 | CONN-03 | T-41-04b | Variant branch reads only `variantsSnapshot` + `lineItemsSnapshot` (D-17 G4); single-arg signature; no static jspdf import (guard enforced) | unit (tdd) | `npx vitest run src/pdf/generateQuotePdf.test.ts && node scripts/assert-no-static-pdf-import.mjs` | ✅ generateQuotePdf.test.ts (extended) | ⬜ pending |
| 41-04-T2 | 04 | 2 | CONN-03 | T-41-04a | `Number.isFinite && >= 0` guards + discount clamp 0..100 so NaN/negatives never reach unitPrice or the PDF | unit/component | `npx vitest run src/components/PrintQuoteModal.test.tsx` | ✅ PrintQuoteModal.test.tsx (extended) | ⬜ pending |
| 41-04-T3 | 04 | 2 | CONN-03 | T-41-04c | Tier picker is display/selection only — never touches `calculateCost`/`priceFromMargin`; no cost-model desync surface (D-06) | full suite | `npm run test 2>&1 \| tail -15` | ✅ JobsManager.tsx (extended) | ⬜ pending |
| 41-05-T1 | 05 | 2 | LIFE-02 | T-41-05c | Reuses `convert()` (single FX primitive), skips null-rate sales like `salesReportAggregates`; gross (not profit) matches legal definition (D-15) | unit (tdd) | `npx vitest run src/utils/taxThreshold.test.ts` | ✅ created in this task (Wave 0) | ⬜ pending |
| 41-05-T2 | 05 | 2 | LIFE-02 | T-41-05a | `Number.isFinite && > 0` guard on custom threshold amount so a NaN/negative cannot break the fraction/bar math | type-check | `npx tsc -b 2>&1 \| tail -5` | ✅ SettingsModal.tsx (extended) | ⬜ pending |
| 41-05-T3 | 05 | 2 | LIFE-02 | T-41-05b, T-41-05a | Mandatory "not tax advice" + "data current as of" text on every card; US gets an informational note, not a false-precision bar (D-16) | full suite | `npm run test 2>&1 \| tail -15` | 🆕 TaxThresholdCard.tsx (new) + InsightsPanel.tsx (extended) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0 scaffolding tasks are needed — every new pure-logic module ships its test file **in the same task** that creates the module (TDD `type="auto" tdd="true"`), so no task has a `MISSING` verify:

- **`src/utils/repriceAlert.test.ts`** (covers CONN-01) — created alongside `src/utils/repriceAlert.ts` in **41-02 Task 1**.
- **`src/utils/hygroscopicity.test.ts`** (covers LIFE-01) — created alongside `src/utils/hygroscopicity.ts` in **41-03 Task 1**.
- **`src/utils/taxThreshold.test.ts`** (covers LIFE-02) — created alongside `src/utils/taxThreshold.ts` in **41-05 Task 1**.
- **Extended existing test files** (no new file, already present): `src/utils/backupExport.test.ts` (41-01 T2), `src/pdf/generateQuotePdf.test.ts` (41-04 T1), `src/components/PrintQuoteModal.test.tsx` (41-04 T2).
- **No framework install needed** — Vitest is already configured (`vitest.config.ts`) and used project-wide (`abrasive.test.ts`, `generateQuotePdf.test.ts`, `PrintQuoteModal.test.tsx`, `useDatabase.test.ts`).

`wave_0_complete` stays `false` until execution creates these three new test files and the full suite runs green.

---

## Manual-Only Verifications

Visual/UI/interaction behaviors with no automated assertion — verified at `/gsd-verify-work` (UAT). Each is deferred by an explicit `<verification>` "Manual/UAT" note in its plan.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reprice toast wording + Review CTA appearance | CONN-01 | Toast rendering, copy, and CTA are visual/interaction | Edit a filament's package cost upward on a saved job priced near target → a toast names the affected count and target margin with a "Review" action |
| Reprice review modal old→new margin + suggested price + Apply | CONN-01 | Modal layout, colour treatment, and per-job Apply are visual/interaction | Open the review modal → each row shows old→new margin + suggested price; tap Apply → that job's selling price updates and the row marks applied without closing |
| Moisture-risk badge appearance + "Not opened" state | LIFE-01 | Badge colour/tone and days-open copy are visual | Set a nylon spool's opened date to 12 days ago → card shows a HIGH badge ("HIGH — Nylon, open 12d"); an unopened spool shows "Not opened", not LOW |
| Day-threshold reasonableness (MEDIUM-confidence numbers) | LIFE-01 | Judgement call on whether thresholds read right in-app | Confirm HIGH/MEDIUM/LOW badges flip at sensible day counts (values user-confirmed 2026-07-09; InfoTooltip disclaimer present) |
| One-tap log-drying resets the risk clock | LIFE-01 | Interaction + resulting badge change is visual | Tap "log drying" on a HIGH spool → risk drops and days-open resets from today |
| Spool section captures all fields on save | LIFE-01 | Form layout + persistence round-trip is visual | Edit modal → set opened date, storage location, log drying, hygroscopicity override → save and reopen → fields persist; "New spool" reset sets opened=today, clears drying log |
| Quote Variants PDF tier-table layout | CONN-03 | PDF visual layout/branding cannot be asserted by row count alone | Enable variants on a quote, generate PDF → one branded document with three tier rows (Qty / Unit Price / Amount) reading correctly |
| Convert-to-Sale tier picker | CONN-03 | Multi-step interaction is visual | Convert a variant quote → tier picker lists "{qty} @ {unitPrice}"; select one → the recorded sale carries that tier's quantity + unit price |
| Tax-threshold card: bar, US note, disclaimers, crossing alert | LIFE-02 | Progress-bar visual, disclaimer placement, and one-time toast are visual/interaction | Set jurisdiction UK in Settings → Insights shows a £-denominated bar toward £1,000 for the Apr 6–Apr 5 window with "not tax advice" + "data current as of" text; set US → badges-of-trade note, no bar; cross the threshold → a one-time alert fires |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner, 2026-07-09)
