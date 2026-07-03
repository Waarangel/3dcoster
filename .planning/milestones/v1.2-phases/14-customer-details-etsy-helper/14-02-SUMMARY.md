---
phase: 14-customer-details-etsy-helper
plan: 02
subsystem: cost-calculator
tags: [etsy, static-data, cost-calculator, persistence, react, tailwind, vitest, tdd]

requires:
  - phase: 14-01
    provides: CollapsibleSection UI primitive, PrintJob.etsyChecks optional field, etsy-helper featureReleases entry
  - phase: 12-schema-foundation
    provides: PrintJob optional non-indexed field convention (Phase 12 D-02 / D-07)
provides:
  - src/data/etsyToS.ts static checklist data with 5 LOCKED ids, policySummaryAsOf, policyLink
  - Etsy compliance helper card rendered in CostCalculator between Cost Breakdown and Save Job button
  - PrintJob.etsyChecks per-job persistence across all 6 CostCalculator state-touching sites
affects: [14-03-customer-form, 14-04-uat, 16-pdf]

tech-stack:
  added: []
  patterns:
    - "Static-data file shape mirroring src/data/taxRates.ts (readonly const array, no I/O imports)"
    - "6-site state wiring discipline: useState init → sessionStorage formState + dep array → editingJob hydration → clearForm → BOTH handleSaveJob branches"
    - "Object.keys-length-guard on optional PrintJob field (etsyChecks stays undefined when empty, mirrors Phase 12 D-02 rule)"
    - "TDD RED/GREEN for static-data shape contract (test commits separately from data commit)"

key-files:
  created:
    - src/data/etsyToS.ts
    - src/data/etsyToS.test.ts
  modified:
    - src/components/CostCalculator.tsx

key-decisions:
  - "policySummaryAsOf hard-coded to '2026-05-21' — date +%Y-%m-%d returned 2026-05-21 at execute time, which coincides with both the discussion date AND the etsy-helper featureReleases date set in Plan 14-01 (the PLAN's Pitfall 5 rule is satisfied — the date is the SHIP date, which today equals the discussion date)"
  - "etsyChecklist item bodies biased toward 'verify at the link below' / 'see Etsy's policy' wording per Pitfall 7 — particularly for no-third-party-templates (the rule Etsy reversed in June 2025) and ai-disclosure (a moving target)"
  - "Plan 14-03 had NOT shipped at execute time of 14-02 — Textarea import is NOT yet in CostCalculator, no Customer card present. A `{/* Plan 14-03 inserts its Customer card directly above this comment. */}` landmark was added immediately above the Etsy section so Plan 14-03's executor sees the exact insertion site"

requirements-completed: [ETSY-01, ETSY-02]

duration: ~6min
completed: 2026-05-21
---

# Phase 14 Plan 02: Etsy Compliance Helper (Data + Card) Summary

**Static `src/data/etsyToS.ts` checklist with 5 LOCKED D-16 ids shipped behind a TDD RED/GREEN cycle; Etsy CollapsibleSection card wired into CostCalculator between the Cost Breakdown card and the Save Job button with all 6 state-touching sites updated to persist per-job `etsyChecks` on `PrintJob`. Ready for Plan 14-03 (Customer card) to insert above the new Etsy section, and Plan 14-04 UAT.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-21T23:10Z (approx)
- **Completed:** 2026-05-21T23:16Z (approx)
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- Shipped `src/data/etsyToS.ts` (58 lines) with the 5 LOCKED D-16 ids in this exact order: `original-design`, `no-third-party-templates`, `ip-copyright`, `production-partner-disclosure`, `ai-disclosure`. Body wording defers to the link below the checklist so future Etsy policy shifts don't strand the in-app text (Pitfall 7).
- Shipped `src/data/etsyToS.test.ts` (31 lines, 4 vitest tests) that locks the id-array against accidental renames — without this tripwire, a rename would silently orphan persisted `PrintJob.etsyChecks` map keys.
- Inserted the **"Selling on Etsy?"** `CollapsibleSection` card between line :1492 (closing `</div>` of the Cost Breakdown card) and the `{/* Save Job Button */}` comment, unconditional per D-15 (NOT gated by `marketplace === 'etsy'`). Collapsed-by-default per D-03 (no `defaultOpen` prop passed).
- Card body renders, in order: (a) yellow-tinted disclaimer notice with verbatim text "Etsy's policies change — this is a reminder, not legal advice." (D-17, ROADMAP #4), (b) 5-item `.map` over `etsyChecklist` producing 5 raw `<input type="checkbox">` rows each preceded in rendered DOM by an `// allow-raw-html` comment (1 source-line comment → 5 DOM matches at lint time), (c) a date+link line rendering `policySummaryAsOf` + `policyLink` together.
- `<NewBadge feature="etsy-helper" className="absolute -top-1 -right-1" />` passed via the CollapsibleSection's `badge` slot prop (NOT inline) per MEMORY.md / D-04 — the badge floats over the card's top-right corner without disrupting the header's flex flow.
- All **6 CostCalculator state-touching sites** updated: useState init (~:146), sessionStorage formState (:184), sessionStorage dep array (:191), editingJob hydration (:210), clearForm reset (:526), update-branch handleSaveJob (:583), create-branch handleSaveJob (:613). `setEtsyChecks` is invoked from 4 sites (init, editingJob hydration, clearForm, onChange handler).
- `Object.keys(etsyChecks).length > 0 ? etsyChecks : undefined` guard on BOTH handleSaveJob branches ensures the field stays absent from IndexedDB when the user hasn't ticked any boxes (D-18, Phase 12 D-02 alignment).

## Task Commits

1. **Task 1 (RED) — Failing test for etsyToS shape** — `23c67ca` (`test`)
2. **Task 1 (GREEN) — Implement etsyToS.ts** — `42a4e9e` (`feat`)
3. **Task 2 — Wire Etsy card + 6-site etsyChecks state into CostCalculator** — `14a1cb4` (`feat`)

(No REFACTOR commit — implementation passed acceptance criteria cleanly on first GREEN run.)

## `policySummaryAsOf` Date Substituted

```typescript
export const policySummaryAsOf = '2026-05-21';
```

Verified via `date +%Y-%m-%d` at execute time → `2026-05-21`. This date matches the `etsy-helper` entry in `src/features.ts` (set by Plan 14-01 to `new Date('2026-05-21')`), satisfying the PLAN's Pitfall 5 rule that the user-visible date and the NewBadge gate's release date stay aligned. Coincidentally the discussion date is also 2026-05-21 — this coincidence is the same one Plan 14-01 documented.

## Final 5-Item Checklist Wording (for Plan 14-04 UAT)

| id | title | body (verbatim) |
|----|-------|------------------|
| `original-design` | Original design | Your listing is your own design or you have rights to sell it. See Etsy's policy at the link below for the current definition of "handmade" and original-creator standards. |
| `no-third-party-templates` | No off-the-shelf templates | If you used a third-party model or template, confirm the licence permits commercial resale. Etsy's rules on resold templates have changed before — verify against the live policy. |
| `ip-copyright` | IP and copyright | You hold or have permission for any logos, characters, or trademarks in the print. See Etsy's intellectual-property policy at the link below. |
| `production-partner-disclosure` | Production-partner disclosure | If anyone outside your household helps print, finish, or ship the order, you have a production partner declared in your shop. See Etsy's policy at the link below for what counts. |
| `ai-disclosure` | AI disclosure | If AI was used to design the model, your listing discloses that per Etsy's current AI-generated-content policy. |

No `link?` field set on any item — relying on the section-level link rendered below the checklist (planner-discretion per D-16).

## 6-Site `etsyChecks` Wiring Confirmation (line numbers as of post-commit `14a1cb4`)

| Site | Code reference | Line |
|------|---------------|------|
| 1. useState init | `const [etsyChecks, setEtsyChecks] = useState<Record<string, boolean>>(() => editingJob?.etsyChecks ?? getStoredValue('etsyChecks', {} as Record<string, boolean>))` | 146–148 |
| 2. sessionStorage formState | `etsyChecks,` inside the `formState` literal | 184 |
| 3. sessionStorage dep array | `..., marketplace, etsyChecks` | 191 |
| 4. editingJob hydration | `setEtsyChecks(editingJob.etsyChecks ?? {});` | 210 |
| 5. clearForm reset | `setEtsyChecks({});` | 526 |
| 6a. handleSaveJob update branch | `etsyChecks: Object.keys(etsyChecks).length > 0 ? etsyChecks : undefined,` | 583 |
| 6b. handleSaveJob create branch | `etsyChecks: Object.keys(etsyChecks).length > 0 ? etsyChecks : undefined,` | 613 |
| Bonus: JSX onChange handler | `setEtsyChecks(prev => ({ ...prev, [item.id]: e.target.checked }))` | 1527 |
| Bonus: JSX checked binding | `checked={!!etsyChecks?.[item.id]}` | 1526 |

`grep -c "etsyChecks" src/components/CostCalculator.tsx` returns **8** (acceptance threshold ≥ 8 — passes).

## Plan-Ordering Note

**Plan 14-03 had NOT shipped at execute time of 14-02.** Confirmed by:
- `grep -n "Textarea\|customer-details\|Customer" src/components/CostCalculator.tsx` returned no matches at execute start.
- The barrel import on line :6 was updated to add `CollapsibleSection` only (NOT `Textarea`) per the PLAN's "If Plan 14-03 will add `Textarea` separately" branch.

A landmark comment was added immediately above the new Etsy section so Plan 14-03's executor sees the exact insertion site:

```tsx
{/* Plan 14-03 inserts its Customer card directly above this comment. */}

{/* Etsy compliance helper — Phase 14 ETSY-01, ETSY-02 */}
<CollapsibleSection title="Selling on Etsy?" ...>
  ...
</CollapsibleSection>
```

Plan 14-03 must insert its Customer card BEFORE the `{/* Plan 14-03 inserts its Customer card directly above this comment. */}` line (Customer-first, Etsy-second per D-05). Plan 14-03 should also remove the landmark comment after insertion.

## Dexie v6 Schema String — Unchanged

`grep "db.version" src/db/database.ts` output:

```
db.version(1).stores({
db.version(2).stores({
db.version(3).stores({
db.version(4).stores({
db.version(5).stores({
db.version(6).stores({
```

No `db.version(7)` — Dexie stays on v6. `etsyChecks` is a non-indexed optional field, so no schema-string change was required (PLAN out-of-scope guardrail #9 satisfied).

## Test Pass Count

`npx vitest run` → **Test Files 8 passed (8)**, **Tests 110 passed (110)**.

This includes the 4 new `src/data/etsyToS.test.ts` tests AND the 3 existing `src/components/ui/CollapsibleSection.test.ts` tests from Plan 14-01.

`npx vitest run src/data/etsyToS.test.ts` standalone → 4/4 passed.

## Lint and Type Checks

- `node scripts/lint-no-raw-html.mjs` → `lint:no-raw-html passed`
- `npx tsc -b` → 3 pre-existing errors only (`react-window` × 2, `rollup-plugin-visualizer` × 1) — same 3 errors Plan 14-01 documented as worktree-environmental, NOT caused by this plan. `grep -i "costcalculator\|etsy"` against the tsc output returns zero — no new errors from this plan's changes.

## Decisions Made

1. **Hard-coded `policySummaryAsOf = '2026-05-21'`.** Why: `date +%Y-%m-%d` returned `2026-05-21` at execute time. This matches the `etsy-helper` entry in `src/features.ts` (also `2026-05-21`), so the user-visible date and the NewBadge gate's release date are aligned. The PLAN explicitly forbids hard-coding without verification — the verification was performed and recorded above.

2. **No per-item `link?` field on `etsyChecklist`.** Why: D-16 says "omit on most items" and "rely on the section-level link rendered below the checklist". Until a specific sub-policy URL provides material clarification vs. the top-level `policyLink`, the simpler shape ships.

3. **`Object.keys(...).length > 0 ? etsyChecks : undefined` guard on BOTH save branches.** Why: Phase 12 D-02 / D-18 says optional fields stay undefined when empty. Without this guard, IndexedDB would persist `etsyChecks: {}` for every job, polluting record shape and bloating exports.

4. **Comment reword `raw <input>` → `raw checkbox elements` to avoid lint false positive.** Why: `scripts/lint-no-raw-html.mjs` matches `/<(button|input|select|textarea)([\s>\/]|$)/` against every line, and a JSX comment containing the literal text `<input>` triggered the guard despite being a comment. Tracked as Rule 3 deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] JSX comment containing literal `<input>` substring triggered lint guard false positive**
- **Found during:** Task 2 — running `node scripts/lint-no-raw-html.mjs` after the JSX insert.
- **Issue:** The PLAN's suggested comment text `{/* 5-item checklist; raw <input> requires \`// allow-raw-html\` comment per lint guard (PATTERNS Gotcha) */}` contains the literal substring `<input>` which the lint guard's regex `/<(button|input|select|textarea)([\s>\/]|$)/` matches as a raw HTML element. The previous line had no `allow-raw-html` token, so the lint guard failed at `src/components/CostCalculator.tsx:1518`.
- **Fix:** Reworded the comment to "5-item checklist; raw checkbox elements require the `allow-raw-html` comment per lint guard (PATTERNS Gotcha)". The substring `<input>` is no longer present in the comment, so the regex doesn't match — but the inline `// allow-raw-html` comment one line above each rendered `<input>` is still in place (the lint guard still inspects `lines[i - 1]` against the actual `<input>` tag).
- **Files modified:** `src/components/CostCalculator.tsx` (one comment line).
- **Verification:** `node scripts/lint-no-raw-html.mjs` exits 0 with `lint:no-raw-html passed` after the fix.
- **Committed in:** `14a1cb4` (Task 2 commit — single commit covers both the original insert and the fix; no need for an amend since this is a new task's edits, not a prior task's commit).

**Total deviations:** 1 auto-fixed (Rule 3 — lint guard false positive in plan-provided comment text)
**Impact on plan:** Zero scope creep. All PLAN acceptance criteria still met. The reworded comment preserves intent (calling out why raw checkboxes need `allow-raw-html`).

## Issues Encountered

- **Pre-existing TypeScript errors unrelated to this plan:** Same 3 errors Plan 14-01 documented (`react-window` × 2 in AssetLibrary.tsx + JobsManager.tsx, `rollup-plugin-visualizer` × 1 in vite.config.ts). Worktree `node_modules/` is missing both packages. NOT caused by this plan — `grep -i "costcalculator\|etsy"` against `tsc -b` output returns zero. Logged for visibility per Plan 14-01's note; environmental, not a code defect.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced.

- T-14-02-01 (Tampering — checklist titles/bodies): MITIGATED. `{item.title}` / `{item.body}` interpolate as React text nodes; no `dangerouslySetInnerHTML`.
- T-14-02-02 (Information Disclosure — `etsyChecks` in IndexedDB): MITIGATED. Boolean self-review flags only, no PII. Phase 16 PDF generator must exclude this field by design — Phase 14 introduces zero PDF code, so the ETSY-02 PDF-exclusion contract is structurally upheld.
- T-14-02-03 (Tampering — raw `<input type="checkbox">`): MITIGATED. The 5 raw `<input>` rows use the established `// allow-raw-html` escape hatch; `scripts/lint-no-raw-html.mjs` build-time guard passes.
- T-14-SC (npm install legitimacy): N/A. Plan installs zero new packages.

## Known Stubs

None. `src/data/etsyToS.ts` ships with 5 complete checklist items (id + title + body each filled). Both `policySummaryAsOf` and `policyLink` are wired to real values. The CollapsibleSection card renders real data — checkbox `checked` is bound to live state, the date and link interpolate the imported constants, and the disclaimer text is verbatim per D-17.

## Self-Check: PASSED

- [x] `src/data/etsyToS.ts` exists on disk (`ls src/data/etsyToS.ts` returns the file)
- [x] `src/data/etsyToS.test.ts` exists on disk
- [x] Commit `23c67ca` exists (`git log --oneline | grep 23c67ca` returns 1)
- [x] Commit `42a4e9e` exists
- [x] Commit `14a1cb4` exists
- [x] `grep -c "etsyChecks" src/components/CostCalculator.tsx` returns 8 (≥ 8 per acceptance)
- [x] `grep -c "feature=\"etsy-helper\"" src/components/CostCalculator.tsx` returns exactly 1
- [x] `grep "Etsy's policies change — this is a reminder, not legal advice" src/components/CostCalculator.tsx` returns 1 line
- [x] `grep "policySummaryAsOf" src/components/CostCalculator.tsx` returns ≥ 1 hit
- [x] `grep "policyLink" src/components/CostCalculator.tsx` returns ≥ 1 hit
- [x] `grep -c "allow-raw-html" src/components/CostCalculator.tsx` returns 3 (1 existing licensing site + 2 new sites — one inline `// allow-raw-html` above the raw `<input>` AND one source-level comment referencing the convention; both forms together exceed the ≥ 1 threshold)
- [x] `node scripts/lint-no-raw-html.mjs` passes
- [x] `grep "db.version(7)" src/db/database.ts` returns 0
- [x] `npx vitest run` exits 0 with 110/110 tests passing
- [x] `tsc -b` reports only the 3 pre-existing worktree-environment errors; zero new errors from this plan

## TDD Gate Compliance

- **RED gate:** `23c67ca` `test(14-02): add failing test for etsyToS checklist shape` — confirmed failing run (`Failed to resolve import "./etsyToS"`)
- **GREEN gate:** `42a4e9e` `feat(14-02): add etsyToS static checklist data (5 LOCKED ids, policy date + link)` — confirmed passing run (4/4 tests)
- **REFACTOR gate:** Not exercised (data file landed clean; no code-smell warrant)

Both required gates exist in the correct order. Task 2 was non-TDD (per PLAN `type="auto"` with no `tdd="true"`) — it's a JSX/state-wiring task verified by the existing test suite (110/110 still passes) + the static lint guard, not by a new dedicated unit test.

## Next Plan Readiness

- **Plan 14-03 (Customer card)** can:
  - Insert its Customer CollapsibleSection BEFORE the `{/* Plan 14-03 inserts its Customer card directly above this comment. */}` landmark on lines :1493 (approx — line may have shifted post-commit; landmark search is the durable reference).
  - Add `Textarea` to the `./ui` barrel import on line :6 alongside the existing `CollapsibleSection`.
  - Reuse the same 6-site state-wiring pattern this plan established (`customer` field replaces `etsyChecks` in the same 6 places).
  - Remove the landmark comment after insertion to keep the JSX clean.
- **Plan 14-04 (UAT)** can:
  - Grep for the 5 D-16 ids in `src/data/etsyToS.ts` against the locked list (already enforced by `etsyToS.test.ts`).
  - Visually confirm the section renders collapsed-by-default in the dev server on port 4173.
  - Confirm `policySummaryAsOf` value renders alongside the link below the checklist.
  - Confirm the NewBadge appears on the section header (gate 1 release-age check: `2026-05-21 + 14 days = 2026-06-04`, so as long as UAT runs before 2026-06-04, the badge appears).

No blockers. No concerns. Wave 2 of Phase 14 is data + Etsy-card complete; Wave 3 can ship the Customer card and the final UAT.

---
*Phase: 14-customer-details-etsy-helper*
*Plan: 02*
*Completed: 2026-05-21*
