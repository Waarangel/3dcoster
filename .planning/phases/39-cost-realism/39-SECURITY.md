---
phase: 39-cost-realism
audited: 2026-07-07
asvs_level: 1
block_on: critical
threats_total: 15
threats_closed: 15
threats_open: 0
---

# Phase 39 (Cost Realism): Security Audit

**Scope:** Verify every declared threat mitigation in the 39-01..39-05 PLAN.md `<threat_model>` blocks is actually present in the CURRENT implementation — including strengthening from the post-plan code-review fix pass (`39-REVIEW.md`, commits `6520319..6460fb9`, 11/11 Critical+Warning findings fixed 2026-07-07). Implementation files are read-only; this audit only writes this file.

**Method:** For each `mitigate` threat, grepped the cited implementation file(s) for the declared pattern and read the surrounding code to confirm the guard is real (not just present as a comment/doc claim). Where the review fix pass strengthened a mitigation (transactions, overlap rejection, legacy-backup defaults, per-material stock deduction), the audit recorded the CURRENT stronger state as evidence, not the plan's original weaker description.

**Disposition breakdown:** All 15 registered threats are `mitigate`. No `accept`/`transfer` dispositions in this register (the per-plan `T-39-SC` no-new-dependencies `accept` entries were not included in the audit's supplied register and are consistent with `package.json` showing no new deps across the phase).

## Threat Verification

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-39-01 | Tampering | mitigate | `src/hooks/useFailureEvents.ts:52,56,60` (`Number.isFinite` guards on `percentComplete`, `gramsWasted`, `materialBreakdown[].grams` before `db.transaction`); `src/hooks/useMaintenanceEvents.ts:26,30` (`Number.isFinite` guards on `cost`, `printerHoursAtEvent` before `db.maintenanceEvents.add`). Non-finite input returns `undefined` and logs `console.error`, no write occurs. |
| T-39-02 | Tampering | mitigate | `src/utils/touElectricity.ts:23-31` `parseHHMM` — strict `/^([0-2]\d):([0-5]\d)$/` regex + `hours > 23` rejection, returns `null` for anything malformed; `resolveWeightedCostPerKwh` (`:98-101`) returns `flatRate` unchanged whenever `startMinute === null` or bands are absent — never propagates `NaN` into cost math. |
| T-39-03 | Information Disclosure | mitigate | `src/utils/backupSchema.ts:41-53,64-68,79-91` (`BackupData`, `BACKUP_STORES`, `DATE_FIELDS` all include `failureEvents`/`maintenanceEvents`). **Strengthened by CR-01 fix**: `src/utils/backupRestore.ts:48-51,123` — `STORES_ABSENT_IN_LEGACY_BACKUPS` set + `const rows = raw === undefined && STORES_ABSENT_IN_LEGACY_BACKUPS.has(store) ? [] : raw` defaults genuinely-absent legacy (pre-Phase-39) backup keys to `[]` instead of hard-rejecting the whole file; a PRESENT-but-non-array value still fails validation. This closes the CR-01 "all pre-Phase-39 backups un-restorable" regression the plan's original mitigation did not anticipate. |
| T-39-04 | Tampering | mitigate | `src/components/LogFailureModal.tsx:51-54` `clampPercent` (`Math.min(100, Math.max(0, value))`) applied at both the input `onChange` (`:176`) and again at submit (`:111`); reason field is a closed `<Select>` populated only from `REASON_OPTIONS` (`:42-49,182-191`) — no free-text reason path exists. |
| T-39-05 | XSS-adjacent | mitigate | `src/components/ReportsSection.tsx:331` renders `{f.notes}` as plain JSX text (React auto-escapes); `LogFailureModal.tsx`/`LogMaintenanceModal.tsx` both use controlled `<Textarea>`/`<Input>` for notes entry. `grep -c dangerouslySetInnerHTML` on `ReportsSection.tsx`, `LogFailureModal.tsx`, `LogMaintenanceModal.tsx` = 0. |
| T-39-06 | Data integrity | mitigate | `src/hooks/useFailureEvents.ts:117-124` `deleteFailure` removes the failureEvents row AND does `db.stockEvents.where('refId').equals(failureStockRefId(id)).delete()` by the deterministic `failure-${id}` refId. **Strengthened by WR-01 + WR-08**: the add+deduct (`:76-109`) and delete+reversal (`:117-124`) are each wrapped in `db.transaction('rw', db.failureEvents, db.stockEvents, ...)` — no more orphaned deduction/double-count on partial failure; and WR-08 writes one stockEvent per filament row (`${failureStockRefId(id)}__${entry.materialId}`, shared `refId`) so multi-material jobs no longer over-deduct a single material, with `deleteFailure`'s `where('refId')` reversal still catching the whole per-material set. |
| T-39-07 | Tampering | mitigate | `src/hooks/useTouTariff.ts:31-37` `isValidBand` (`Number.isFinite(ratePerKwh)` + `parseHHMM` on both windows); `:74-76` max-3-bands clamp (`MAX_TOU_BANDS = 3`, `:9`). **Strengthened by WR-07**: `:67-70` rejects (`clash` found via `bandsOverlap`, `src/utils/touElectricity.ts:57-71`) any new/edited band whose minute-range intersects an existing configured band, returning a user-facing message instead of silently accepting an order-dependent overlap. |
| T-39-08 | Data integrity | mitigate | `src/db/backfill.ts:673-685` `reconcileTouSnapshot` — idempotency guard is the first line of the loop (`if (job.touStartTime !== undefined \|\| job.touRateUsedPerKwh !== undefined) continue`), never computes/writes a numeric rate for legacy jobs (patch list always `[]`, per Pitfall 5), pure (no dexie/database import). Wired at boot: `src/hooks/useDatabase.ts:8,833` (imported + called inside the reconcile pass, mirroring `reconcileFixedCostsAtSave`). |
| T-39-09 | Repudiation | mitigate | `src/db/database.ts:434-439` `isElectricityConfig` requires `typeof o.costPerKwh === 'number'` AND `(o.touBands === undefined \|\| Array.isArray(o.touBands))` before `getElectricity` trusts a stored settings row — malformed/tampered `touBands` shapes fall through to the caller's default rather than being trusted. |
| T-39-10 | Tampering | mitigate | `src/components/LogMaintenanceModal.tsx:57` `canSave = Number.isFinite(cost) && cost >= 0 && Number.isFinite(printerHoursAtEvent) && printerHoursAtEvent >= 0`, gates the Save button (`:207`) and re-validated in `handleSave` (`:89-92`); `partType`/`nozzleType` are closed `<Select>` enums (`:132-137,143-151`), no free-text path. Backed by the hook-level guard already verified under T-39-01. |
| T-39-11 | Data integrity | mitigate | `src/db/maintenanceAmortization.ts:53` `deriveMaintenanceAmortization` returns `null` when `!(instance.printHours > 0)` (divide-by-zero guard); `:150` `predictForPartType` returns `null` when `partEvents.length < 2`; `:157` returns `null` when `!(avgInterval > 0)`. No path returns `NaN`/`Infinity` dates — the `paceHoursPerDay <= 0` branch (`:162-167`) explicitly falls back to `new Date()` rather than an invalid projection. |
| T-39-12 | Silent cost shift | mitigate | `src/utils/costCalc.ts:114-128` `calculateNozzleWear` body is unchanged from its pre-Phase-39 formula (volume × nozzleCost/nozzleLifespanCm3); `calculateAbrasiveSurcharge` (`:154-164`) is a wholly separate exported function, gated on `resolveNozzleType(selectedInstance) === 'brass'` AND `isDominantMaterialAbrasive(...)`, returning `0` (no-op) otherwise — confirmed as an additive `CostBreakdown.abrasiveSurcharge` field (`:251-256,262`), never folded into `nozzleWear` itself. |
| T-39-13 | Silent reprice of history | mitigate | `src/components/calculator/CostCalculator.tsx:332` snapshots `touRateUsedPerKwh: touStartTime ? costs.touRateUsedPerKwh : undefined` at save time from the CURRENT session's resolved breakdown (not re-derived from live tariff later); `:333` snapshots `maintenanceCostAtSave` only when `maintenanceCostPerHour > 0`. Abrasive surcharge is additive per T-39-12 (no legacy job ever carried it, so no historical reprice). Apply-gated failure rate: `:441` `onApplyEmpiricalFailureRate` routes through the existing `setFailureRate` setter (manual input stays authoritative) — **strengthened by WR-05**, now `Math.min(99, Math.round(empiricalFailureRate.rate))` so an Applied rate can no longer exceed the field's 0-99 contract or inject unrounded decimals. |
| T-39-14 | Test-coverage bypass | mitigate | `git show --stat bcde91f` confirms a dedicated commit (`test(39-05): append 3 golden scenarios + re-capture output-equivalence baseline`) touching only `goldenScenarios.ts` (+55 lines) and `outputEquivalence.test.tsx.snap` (+24 lines) — a pure append, zero lines removed/changed, confirmed via diff inspection (`src/components/calculator/__fixtures__/goldenScenarios.ts` diff shows 3 new scenario objects appended after the existing array, no reordering). Human-verify checkpoint (Task 3 of 39-05-PLAN.md) was gated `autonomous: false` and required explicit "approved" per 39-05-SUMMARY.md's Checkpoint Status section — confirmed present, not self-approved. |
| T-39-15 | Tampering | mitigate | `src/components/calculator/CostParametersSection.tsx:226` maintenance $/hr input: `Math.max(parseFloat(e.target.value) \|\| 0, 0)` clamp at the boundary; `:199-200` TOU start-time uses a native `type="time"` input (browser-constrained HH:MM) with `e.target.value \|\| undefined`. `costCalc.ts:245` treats `input.maintenanceCostPerHour ?? 0` as no-op at default; `resolveWeightedCostPerKwh` treats malformed/absent `touStartTime` as flat-rate no-op (verified under T-39-02). |

## Post-Review Strengthening Summary (39-REVIEW.md fix pass, 2026-07-07)

The following threats were verified against a STRONGER current mitigation than the plan originally specified, because the code-review fix pass (11/11 Critical+Warning findings fixed, commits `6520319`..`6460fb9`) hardened the relevant code after the plans were written:

- **T-39-03**: CR-01 fix (legacy-backup default-to-`[]`) — plan's original mitigation would have bricked every pre-Phase-39 backup file; now fixed.
- **T-39-06**: WR-01 (transactional add/delete + reversal) and WR-08 (per-material stock deduction) — plan's original mitigation was non-atomic and over-deducted on multi-material jobs; both fixed.
- **T-39-07**: WR-07 (overlap rejection) — plan's original mitigation validated shape/rate/count but allowed silently order-dependent overlapping bands; now rejected at the `upsertBand` boundary.
- **T-39-13**: WR-05 (Apply-value rounding/clamping) — plan's original Apply path could write an unclamped/unrounded rate (up to exactly 100, or a repeating decimal) into the 0-99 field contract; now fixed.

A related code-review finding, **CR-03** (over-broad abrasive auto-detect regex), was addressed via a UI override path (`src/components/AssetLibrary.tsx:1356-1359`, `Asset.isAbrasive` tri-state select) rather than narrowing the regex — this is not itself a T-39-01..15 registered threat (it was a reviewer-found gap in the D-13 override affordance, not a declared PLAN mitigation), but is noted here for completeness since it touches the same abrasive-detection surface as T-39-12.

## Unregistered Flags

None. No `39-0*-SUMMARY.md` contains a `## Threat Flags` section, so there is no executor-flagged new attack surface to reconcile against the register.

One adjacent item is noted for awareness rather than as a blocker: `39-REVIEW.md` CR-03 documents that `AssetLibrary.tsx`'s new `isAbrasive` override select is new user-writable surface introduced by the Phase 39 abrasive-detection feature. It is a closed tri-state `<Select>` (auto/yes/no) feeding a boolean-typed field consumed only by `resolveIsAbrasive` — no numeric/string injection surface — and is already covered by the CR-03 fix-pass regression tests. It was not in the original `<threat_model>` registers because the override UI itself didn't exist until the fix pass added it; it does not warrant a new BLOCKER-level entry.

## Verification Commands Run

```
npx vitest run src/utils/costCalc.test.ts src/hooks/useFailureEvents.test.tsx \
  src/hooks/useTouTariff.test.tsx src/db/backfill.test.ts src/utils/backupRestore.test.ts
# → 5 files, 185 tests, all passing
```

## Conclusion

15/15 declared threats verified CLOSED against the current implementation (post-review-fix-pass state). `block_on: critical` — no open Critical-severity gaps. Phase 39 clears this security audit.
