---
phase: 33-insight-pricing-coach
plan: 02
status: removed
requirements: [SC2, SC4, SC5, SC6]
date: 2026-06-25
---

# 33-02 — Target Hourly Rate + profit/hr gauge — SUMMARY

> **♻️ REVISED 2026-06-25 (post-UAT).** The original **wage-framed** gauge (Target/Min
> hourly goals + red/green grading vs a $25/hr wage) was **pulled** — it made healthy jobs
> read as failures ("$1/hr — depressing"). It was then **re-added, reframed**: a
> **"Profit / hr" stat in the Pricing summary**, color-graded against the **industry
> $1–5/print-hour machine benchmark** (NOT a wage), with an i-icon explaining that $1–2/hr
> is fine because the printer earns it unattended. No UserProfile/settings fields, no backup
> concerns — the benchmark is built in (`printHourProfit.ts`, `PRINT_HOUR_SWEET_SPOT`).
> The "Build" section below describes the original wage version (historical). Cross-job
> *comparison* of this metric remains a Saved-Jobs candidate; "worth your time" wage goals
> remain a Vendor-Events candidate. See [v2.0-CANDIDATES.md](../../milestones/v2.0-CANDIDATES.md).

---


## What shipped
The calculator now answers "is this print worth my time?" — a profit-per-hour gauge graded against the user's hourly-rate goals.

- **`src/utils/profitPerHour.ts`** (+ `.test.ts`) — pure `computeProfitPerHour({sellingPrice, trueCost, printTimeHours, target, minimum})` → `{value, state}`. States: `good`/`warn`/`bad`/`neutral`/`na`. Ladder (confirmed): `printTime<=0 → na`; both goals unset → `neutral`; **minimum unset = 0 floor** → `value < effectiveMin → bad`, `value >= target → good`, else `warn`. Finite-guarded. **10 unit tests** cover every state incl. the 0-floor loss case.
- **`src/types.ts`** — `targetHourlyRate?` / `minimumHourlyRate?` optional fields on `UserProfile` (unset = no goal).
- **`src/components/SettingsModal.tsx`** — Target/hr + Minimum/hr `compact` inputs in the "Your Hourly Rate" group (clear-to-inherit: empty → `undefined`), `<InfoTooltip>` copy, NEW badge on the group heading.
- **`src/components/CostCalculator.tsx`** — `profitPerHour` memo (NET of platform fee, so it agrees with the Net Profit cell) + a gauge row below the Pricing stat grid: colored value + "Profit per print-hour" + a decision-style caption.
- **`src/features.ts`** — `'hourly-rate-goals'` registered (2026-06-25).
- **`src/utils/backupRestore.test.ts`** — 2 new cases prove **SC4**: goals survive the backup round-trip; a legacy profile with no goal keys restores to `undefined` (no crash, no fabricated value).

## Verification
- `vitest`: profitPerHour (10) + backupRestore (incl. 2 new) + costAllocation — **37 targeted tests pass**.
- `tsc -b` clean; `lint:no-raw-html` pass; **full `npm run build` green**.
- **Live smoke** (insight worktree :4173): set Target 25 / Min 15 → all four states confirmed:
  - **green** $49.50/hr "at or above your $25/hr target"
  - **amber** $20.50/hr "below your $25/hr target"
  - **red** $0.22/hr "below your $15/hr minimum"
  - **— / na** "Add print time…"
  Settings **persisted across reload**; NEW badge overlaid the heading; no console errors.

## SC mapping
- **SC2** ✅ value + green/amber/red states; "—" at printTime 0 (unit + live).
- **SC4** ✅ persists via the existing `settings`/`userProfile` store (already in `BACKUP_STORES`) — **zero schema/store change**; legacy backups degrade losslessly (test-proven). Reconcile is intrinsic, no migration/fabricated default.
- **SC5** ✅ free/local/offline.
- **SC6** ✅ gates green; NEW badge + features.ts entry.

## Decisions / notes
- **Net (not gross) profit/hr** — passes `trueCost + marketplaceFee` as the cost so the gauge matches the adjacent Net Profit/Net Margin cells (resolves the plan-checker's net-vs-gross flag).
- **Threshold edge locked** (was the one open ambiguity): target set + minimum unset → 0 floor, so a loss is `bad` and 0..target is `warn`.
- Target Hourly Rate home = `UserProfile` "Your Hourly Rate" settings group (the confirmed recommendation).

## Remaining in phase
33-03 — dynamic "Why this price?" coach (margin-health ladder; copy/cutoffs to confirm).
