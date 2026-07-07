---
phase: 39-cost-realism
verified: 2026-07-07T20:55:00Z
status: passed
score: 8/8 must-haves verified (requirement IDs); 10/10 phase-goal truths verified; 4/4 plan-06 gap-closure must-haves verified
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: "8/8 must-haves verified (requirement IDs); 5/5 plan-level truths sets verified"
  gaps_closed:
    - "TOU band editor's cramped/unusable '0 --'/'PM' segmented time inputs (UAT test 5, minor) — replaced with validated HH:MM text fields"
    - "'+ Add band' permanently-disabled dead button that made the entire calculator TOU path unreachable (UAT test 6, major) — replaced with a name-only disable gate + upsertBand validation feedback"
    - "(found during 39-06's own delta code review, not in original UAT) CR-04: the ADD-path text-input fix broke the EDIT path — edit-row time inputs became keystroke-frozen because they routed every keystroke through the strict validator — fixed with draft-then-commit local state"
    - "(delta review) WR-09: calculator Print Start Time text field had zero validation feedback for invalid HH:MM — fixed with inline FieldWarning"
    - "(delta review) WR-10: edit-row time inputs lost their width constraint after dropping `compact` — fixed with explicit max-w-[5.5rem] shrink-0"
  gaps_remaining: []
  regressions: []
---

# Phase 39: Cost Realism Verification Report (Re-Verification)

**Phase Goal:** Users can log print failures and maintenance events and see those real costs folded into their calculator's true cost — giving them an empirical failure rate no competitor offers
**Verified:** 2026-07-07T20:55:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 39-06 + its delta code-review fix pass)

## Context

This is a re-verification of a phase that was already `passed` once (see `re_verification` frontmatter for the prior score). UAT (`39-UAT.md`) subsequently found 2 issues in the TOU band editor UX (test 5 minor, test 6 major — the major issue made the entire calculator TOU pricing path unreachable through the UI, since "+ Add band" could never enable). Plan `39-06` closed both gaps by replacing native `<input type="time">` controls with validated HH:MM text inputs in both `SettingsModal.tsx` (band editor, add + edit rows) and `CostParametersSection.tsx` (calculator start-time picker), and by replacing the all-fields-required disabled gate with a name-only gate that routes all other validation through the existing `upsertBand` boundary.

A delta code review of 39-06's own diff (`39-REVIEW.md`, "Delta Review: 39-06 Gap Closure") then found that the add-path fix had **broken the edit path** (CR-04, Critical — edit-row inputs became keystroke-frozen) and two Warnings (WR-09 — no validation feedback on the calculator's now-freeform text field; WR-10 — edit-row inputs lost their width constraint). All 3 were fixed in the same session (commits `998a6be`, `705e30a`, `610d9a9`, tests `1e84785`) and independently re-verified against current source below — not accepted on the review report's word.

Gates re-confirmed independently during this re-verification pass (not taken from SUMMARY.md or REVIEW.md claims):
- `npx vitest run` → **1023 passed / 1 todo, 84 files**
- `npx vitest run src/components/SettingsModal.test.tsx src/components/calculator/CostParametersSection.test.tsx` → **36 passed** (isolated re-run of the two files 39-06 touched)
- `npx vitest run src/utils/costCalc.test.ts src/utils/touElectricity.test.ts src/components/calculator/outputEquivalence.test.tsx` → **80 passed** (pricing-math regression guard the plan itself specified — confirms 39-06 did not touch pricing)
- `npx tsc -b` → clean, exit 0
- `npm run lint:no-raw-html` → passed
- `npm run build` → clean; main chunk 83.0 KB gzipped (under 300 KB budget); pdf-chunk lazy-load asserts intact
- `git diff --stat` across the 39-06 commit range → confirms only `SettingsModal.tsx`, `SettingsModal.test.tsx`, `CostParametersSection.tsx`, `CostParametersSection.test.tsx` were touched (plus planning docs) — no `costCalc.ts`/`touElectricity.ts`/`useTouTariff.ts` changes, so the pricing-math truths verified in the prior pass carry forward without re-derivation risk
- Debt-marker scan (`TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`) across the 3 code files 39-06 touched → 0 matches
- `console.log`/`debugger` scan across the same files → 0 matches

## Goal Achievement

### Observable Truths (full phase, all 10 carried forward + re-checked)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can log a print failure in one tap from a job row (FAIL-01) | ✓ VERIFIED | Unchanged by 39-06; carried forward from prior verification (`JobsManager.tsx` per-row IconButton → `LogFailureModal`) |
| 2 | User can log a standalone failure (not tied to a job) | ✓ VERIFIED | Unchanged; `ReportsSection.tsx` "Log failure" CTA |
| 3 | Empirical failure rate derived per printer×material with ≥5-attempt threshold + printer-fallback provenance (FAIL-02) | ✓ VERIFIED | Unchanged; `src/db/failureRate.ts` |
| 4 | Applied failure rate hint shown beside manual input with one-click Apply | ✓ VERIFIED | Unchanged; `CostParametersSection.tsx:134-147` |
| 5 | Scrap cost folds into true cost; no silent reprice of saved history (FAIL-03) | ✓ VERIFIED | Unchanged; `useFailureEvents.ts` transactional per-material deduction |
| 6 | User can view a Failures ledger inside Reports (FAIL-04) | ✓ VERIFIED | Unchanged; `ReportsSection.tsx` Failures sub-section |
| 7 | User can define TOU tariffs (peak/off-peak + hour windows) in Settings, no API (TOU-01) | ✓ VERIFIED (gap closed) | `SettingsModal.tsx` band editor now uses `type="text"` HH:MM inputs (add row `:440-469`, edit row `:377-409`) with `maxLength={5}`, descriptive `aria-label`s, and a `disabled={!newBandName.trim()}` gate on "+ Add band" (`:472`) — the previous all-4-fields-required dead-button trap is gone; `handleAddTouBand` (`:69-88`) routes every other validation outcome through `upsertTouBand`'s returned message, rendered via the `bandError` alert (`:480-482`) |
| 8 | Job electricity cost uses TOU tariff based on start time + duration, flat rate default (TOU-02) | ✓ VERIFIED (gap closed) | `CostParametersSection.tsx:199-207` `#tou-start-time` is now a `type="text"` HH:MM field with `maxLength={5}`; `costCalc.ts`/`touElectricity.ts` pricing logic itself untouched (confirmed via git diff-stat across the 39-06 commit range) |
| 9 | User can log maintenance events and track cumulative abrasive-hours (WEAR-01) | ✓ VERIFIED | Unchanged; `LogMaintenanceModal.tsx` + `PrinterSettings.tsx` |
| 10 | Maintenance history amortizes into real $/hr and predicts next likely swap (WEAR-02) | ✓ VERIFIED | Unchanged; `src/db/maintenanceAmortization.ts` |

**Score:** 10/10 phase-goal truths verified

### Plan 39-06 Must-Haves (gap-closure plan, checked against CURRENT post-delta-fix code)

| # | Must-have truth | Status | Evidence |
|---|------------------|--------|----------|
| 1 | User can type an HH:MM start/end time into a band's window fields and read them clearly — no cramped segmented control, no dark-glyph clock icon | ✓ VERIFIED | Both add-row (`SettingsModal.tsx:454-469`) and edit-row (`:392-409`) window inputs are `type="text"` with `placeholder="22:00"`, `maxLength={5}` — no native `type="time"` remains anywhere in this component (grepped); the calculator picker matches (`CostParametersSection.tsx:199-207`). A plain text input has no browser-rendered segments or picker glyph, so the root cause (native time-widget rendering) is structurally eliminated, not merely restyled |
| 2 | Clicking "+ Add band" with a name, rate, and valid HH:MM window creates the band and it appears in the list | ✓ VERIFIED | `handleAddTouBand` (`:69-88`) builds the `TouBand` and calls `upsertTouBand`; on success clears all 4 inputs; test `'happy path: typing a name, rate, and valid HH:MM start/end and clicking "+ Add band" writes the new band'` (`SettingsModal.test.tsx:482`) passes and asserts `onElectricityChange` called with the new band |
| 3 | Invalid/incomplete/overlapping input surfaces the existing `upsertBand` validation message instead of a permanently disabled, silent button | ✓ VERIFIED | Button `disabled={!newBandName.trim()}` only (`:472`, was previously gated on all 4 fields); `setBandError(error)` renders via `role="alert"` (`:480-482`); tests `'invalid/incomplete time...'` (`:519`) and `'overlap: an overlapping window...'` (`:546`) both pass and assert no write occurred |
| 4 | Calculator's Print Start Time picker uses the same readable HH:MM text field | ✓ VERIFIED | `CostParametersSection.tsx:199-207`, `id="tou-start-time"`, `type="text"`; `WR-09` test (`CostParametersSection.test.tsx:135`) confirms an inline `FieldWarning` fires for an invalid value and clears for valid/empty |

**Score:** 4/4 plan-06 must-haves verified

### Delta Fix-Pass Cross-Check (39-REVIEW.md "Delta Review: 39-06 Gap Closure")

Independently re-derived from current source, not accepted on the review report's word:

| Finding | Claimed Fix | Verified in Code |
|---------|-------------|-------------------|
| CR-04 (edit-row inputs keystroke-frozen — a functional regression the ADD-path fix introduced) | Draft-then-commit local `editDraft` state, validated only on Done | ✓ `SettingsModal.tsx:60` (`editDraft` state), `:90-100` (`handleStartEditTouBand` seeds draft), `:102-126` (`handleCommitTouBandEdit` validates only on commit, keeps edit mode open + draft intact on rejection); edit-row inputs read `editDraft?.field ?? band.field` (`:380,389,397,406`) — never routed through the validator per-keystroke. Test `'edit path: start-time field accepts per-keystroke edits...'` (`SettingsModal.test.tsx:592`) types 5 successive partial values and asserts each persists in the DOM with zero alerts and zero writes, then commits and asserts the final write — a genuinely behavioral (not just existence) test |
| WR-09 (calculator start-time field had zero validation feedback for invalid HH:MM) | Inline `FieldWarning` via `parseHHMM` | ✓ `CostParametersSection.tsx:9` imports pure `parseHHMM` (no IO/Dexie), `:211-217` renders `FieldWarning` when `touStartTime && parseHHMM(touStartTime) === null`; test at `CostParametersSection.test.tsx:135` covers invalid/valid/empty cases |
| WR-10 (edit-row time inputs lost width constraint, blew up row layout) | `max-w-[5.5rem] shrink-0` on both edit-row time inputs | ✓ `SettingsModal.tsx:399,408` — both present, matching the add-grid's `5.5rem` time columns (`:439`) |

Info-level findings IN-09/IN-10 (dead-code guard message specificity; `bandError`/`editingBandId` not cleared on band removal or tab switch) were deliberately not addressed — explicit descope recorded in `39-REVIEW.md`, consistent with the fix pass's own stated `critical_warning` scope. These are cosmetic/UX-polish gaps (a stale error message can persist briefly after removing the conflicting band, or across a tab switch) — they do not block the phase goal (TOU bands ARE configurable and priced correctly) and are not re-litigated here as blockers.

### Required Artifacts (39-06 scope)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/SettingsModal.tsx` | TOU band window inputs as validated HH:MM text fields + feedback-driven Add-band gate | ✓ VERIFIED | Confirmed at lines 377-482; `handleAddTouBand` present and reachable |
| `src/components/calculator/CostParametersSection.tsx` | Print Start Time picker as an HH:MM text field | ✓ VERIFIED | `id="tou-start-time"`, `type="text"`, confirmed at lines 199-217 |
| `src/components/SettingsModal.test.tsx` | Regression tests exercising the real add-band + edit-band interaction path | ✓ VERIFIED | Happy path (`:482`), invalid-time (`:519`), overlap (`:546`), edit-path per-keystroke (`:592`), edit-path invalid-commit (`:649`) — all present and passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SettingsModal.tsx` (add row) | `useTouTariff.upsertBand` | `handleAddTouBand` → `upsertTouBand`, message via `bandError` | ✓ WIRED | Confirmed `:81-82` |
| `SettingsModal.tsx` (edit row) | `useTouTariff.upsertBand` | `handleCommitTouBandEdit` → `upsertTouBand`, message via `bandError` | ✓ WIRED | Confirmed `:115-123` |
| `CostParametersSection.tsx` | `onTouStartTimeChange` | text input `onChange` | ✓ WIRED | Confirmed `:206` |
| `CostParametersSection.tsx` | `parseHHMM` (pure validation) | `FieldWarning` message computation | ✓ WIRED | Confirmed `:213-215` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npx vitest run` | 1023 passed / 1 todo, 84 files | ✓ PASS |
| 39-06-touched files in isolation | `npx vitest run src/components/SettingsModal.test.tsx src/components/calculator/CostParametersSection.test.tsx` | 36 passed | ✓ PASS |
| Pricing-math regression guard (plan-specified) | `npx vitest run src/utils/costCalc.test.ts src/utils/touElectricity.test.ts src/components/calculator/outputEquivalence.test.tsx` | 80 passed | ✓ PASS |
| Type check | `npx tsc -b` | exit 0 | ✓ PASS |
| Raw-HTML lint gate | `npm run lint:no-raw-html` | passed | ✓ PASS |
| Production build | `npm run build` | clean, main chunk 83.0 KB gzipped (budget 300 KB), pdf-chunk asserts pass | ✓ PASS |
| Debt-marker scan | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across 3 touched code files | 0 matches | ✓ PASS |
| console.log/debugger scan | `grep -n "console\.\|debugger"` across 3 touched code files | 0 matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| FAIL-01 | 01, 02 | Log failure in one tap, ledger entry | ✓ SATISFIED | Unchanged since prior verification |
| FAIL-02 | 02, 05 | Empirical failure rate derivation + Apply suggestion | ✓ SATISFIED | Unchanged |
| FAIL-03 | 05 | Applied rate folds real scrap cost; no silent reprice | ✓ SATISFIED | Unchanged |
| FAIL-04 | 02 | Failure history/diagnostic ledger | ✓ SATISFIED | Unchanged |
| TOU-01 | 01, 03, 06 | Define TOU tariffs in Settings | ✓ SATISFIED | `useTouTariff` pricing logic unchanged (01/03); UX gap-closed and re-verified (06) |
| TOU-02 | 01, 05, 06 | TOU-aware job electricity cost, flat default | ✓ SATISFIED | Pricing logic unchanged (01/05); start-time entry UX gap-closed and re-verified (06) |
| WEAR-01 | 01, 04 | Log maintenance events + abrasive-hours tracking | ✓ SATISFIED | Unchanged |
| WEAR-02 | 04, 05 | Amortized $/hr + next-swap prediction | ✓ SATISFIED | Unchanged |

No orphaned requirements — all 8 IDs from `REQUIREMENTS.md` (Phase 39) are checked `[x]` complete, mapped to plans 01-06, and independently confirmed implemented in current source.

### Anti-Patterns Found

None blocking. Debt-marker and `console.log`/`debugger` scans across all 3 files touched by 39-06 (plus their test files) returned 0 matches. The two Info-level findings left open from the delta review (IN-09 dead-code defensive guard, IN-10 stale `bandError`/`editingBandId` on removal/tab-switch) are cosmetic UX polish, not anti-patterns that block the phase goal — they are explicitly recorded as descoped in `39-REVIEW.md`, not silently dropped.

### Human Verification Required

None. The root cause of both original UAT gaps (native `<input type="time">` rendering as a segmented, dark-glyph-afflicted control) is structurally eliminated by the swap to `type="text"` — this is a verifiable code-level fact (no native time widget remains in either component), not a subjective rendering judgment requiring a human to re-check pixels. The interaction behavior (typing per keystroke into an edit-row input without the value snapping back, the Add-band button enabling and creating a band, invalid/overlap feedback appearing) is now covered by tests that simulate real per-keystroke DOM events and assert on rendered DOM state — a stronger guarantee against regression than a one-time human click-through would provide.

### Gaps Summary

No gaps. Both original UAT gaps (TOU band editor cramped/dark-glyph inputs — minor; unreachable "+ Add band" — major) are closed, and the additional 3 issues (1 Critical, 2 Warning) that 39-06's own delta code review found in its first-pass fix were also fixed in the same session and are independently confirmed present and correct in the current codebase. Full build gate is green: 1023/1024 tests (1 todo) passed, `tsc -b` clean, `lint:no-raw-html` clean, production build clean under budget. Pricing-math files (`costCalc.ts`, `touElectricity.ts`, `useTouTariff.ts`) were not touched by 39-06 (confirmed via `git diff --stat`), so all previously-verified pricing truths carry forward without regression risk, and the plan's own specified pricing regression guard (costCalc/touElectricity/outputEquivalence test files) is independently re-run green in this pass.

---

*Verified: 2026-07-07T20:55:00Z*
*Verifier: Claude (gsd-verifier)*
