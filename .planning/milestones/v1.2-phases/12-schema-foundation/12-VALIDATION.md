---
phase: 12
slug: schema-foundation
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-20
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> See `12-RESEARCH.md` § Validation Architecture for the full rationale, including the jsdom/IndexedDB constraint.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom env) + manual UAT for IndexedDB-touching behavior |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && tsc -b` |
| **Estimated runtime** | ~10 seconds (unit + types) |

---

## Sampling Rate

- **After every task commit:** Run `tsc -b` (TypeScript correctness is the fastest signal here)
- **After every plan wave:** Run `npx vitest run && tsc -b`
- **Before `/gsd:verify-work`:** Full suite green AND manual UAT checklist (below) completed
- **Max feedback latency:** ~10 seconds for automated; manual UAT is gated to verify-work

---

## Per-Task Verification Map

> One row per task across all 4 plans. Maps each task ID to its `<automated>` verify or to a manual UAT row below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-T1 | 01 | 1 | SCHEMA-01 | — | N/A | types + source assert | `tsc -b && grep -E "tags\\?:\\s*string\\[\\]" src/types.ts` | ✅ | ⬜ pending |
| 12-01-T2 | 01 | 1 | SCHEMA-01 | — | N/A | types + source assert | `tsc -b && grep -E "defaultTaxRate\\?:\\s*number" src/types.ts` | ✅ | ⬜ pending |
| 12-02-T1 | 02 | 1 | SCHEMA-01 | — | RED phase — defensive guard against corrupt `tags` value | unit (RED) | `npx vitest run src/db/backfill.test.ts 2>&1 \| grep -qE "fail\|error"` | ✅ (Wave 0 stub) | ⬜ pending |
| 12-02-T2 | 02 | 1 | SCHEMA-01 | — | tags backfill idempotent; non-array values normalized | unit (GREEN) | `npx vitest run src/db/backfill.test.ts` | ✅ | ⬜ pending |
| 12-03-T1 | 03 | 2 | SCHEMA-01 | T-12-01 (data loss) | upgrade returns modify-promise; `*tags` index NOT added | types + source assert | `tsc -b && grep -E "db\\.version\\(6\\)" src/db/database.ts && grep -E "return tx\\.table" src/db/database.ts` | ✅ | ⬜ pending |
| 12-03-T2 | 03 | 2 | SCHEMA-02 | T-12-02 (white-screen on concurrent tab) | plain `window.location.reload()`, no `setTimeout`/`confirm`/toast | source assert (regex + awk ordering) | `tsc -b && grep -E "db\\.on\\('versionchange'" src/db/database.ts` | ✅ | ⬜ pending |
| 12-04-T1 | 04 | 3 | SCHEMA-01, SCHEMA-02 | — | Full build green | build gate | `npm run build` | ✅ | ⬜ pending |
| 12-04-T2 | 04 | 3 | SCHEMA-01 | — | v5→v6 real-DB migration backfills `tags=[]`; other fields undefined | manual UAT | — (see Manual-Only Verifications row 1–3) | manual | ⬜ pending |
| 12-04-T3 | 04 | 3 | SCHEMA-02 | T-12-02 | Tab B auto-reloads ≤1s after Tab A loads v6 | manual UAT | — (see Manual-Only Verifications row 4) | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/backfill.test.ts` — unit tests for the extracted `backfillTagsOnJob(job)` pure helper (idempotency, missing-tags, already-array, non-array-tags defensive guard). Required because jsdom doesn't support IndexedDB — the only way to unit-test the v6 row-mutation body is to extract it. **Sibling-of-source convention** — repo has zero `__tests__/` folders (see `src/utils/costCalc.test.ts`).
- [ ] No Vitest install needed — vitest + jsdom already present (see `vitest.config.ts`).

*If the planner chooses NOT to extract `backfillTagsOnJob`, Wave 0 becomes empty and the migration body is covered only by manual UAT below — that path is acceptable but degrades automated coverage; flag it explicitly in PLAN.md.*

---

## Manual-Only Verifications

> These cannot be automated under the current test infrastructure (jsdom has no IndexedDB). Each behavior maps to a SCHEMA-XX success criterion and must be executed and signed off during `/gsd:verify-work`.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| v5 → v6 migration runs once on real IndexedDB and backfills `tags=[]` on existing job records | SCHEMA-01 (b) | jsdom lacks IndexedDB; behavior depends on real browser DB | (1) On `main`, `npm run dev`, create 2–3 jobs, close tab. (2) Switch to phase-12 branch, `npm run dev`, open app. (3) DevTools → Application → IndexedDB → 3dcoster-db → verify version is 6 and each job record has `tags: []`. |
| Existing v5 job loads without throwing after upgrade | SCHEMA-01 (a) | Requires v5 IndexedDB state pre-existing in the browser | Same as above; navigate to a job from step (1). App renders normally; no `TypeError: Cannot read properties of undefined`. |
| New optional fields are `undefined` (not pre-populated) on existing records | SCHEMA-01 (c) | DB inspection only | DevTools → Application → IndexedDB → 3dcoster-db → jobs → confirm existing records show only `tags: []` plus original fields (no `customer`, `taxRate`, etc.). |
| Second-tab opened after migration reloads automatically (no white screen) | SCHEMA-02 (a)(b) | Multi-tab IndexedDB events require a real browser | (1) On `main`, `npm run dev`, open the app in two tabs (A and B). Confirm both load. (2) In tab A, switch to the phase-12 build (HMR or hard reload onto the new bundle). (3) Tab B should auto-reload within ~1s and come up cleanly. Verify in DevTools console that no `versionchange` warning was logged. |
| `quoteNumber` field is present on the `PrintJob` interface and persists when set | SCHEMA-01 extension (D-05/06/07) | DB inspection | After Phase 12 ships, manually edit a job in DevTools console to set `quoteNumber: 1`, reload, confirm the value persists. (Full UX flow lands in Phase 16; this checkpoint only verifies the field is writable in v6.) |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify command OR a manual UAT row above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (specifically: extracted `backfillTagsOnJob` unit tests, OR explicit acknowledgement that migration body is manual-UAT-only)
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 10s for automated layer
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills the per-task table
- [ ] Manual UAT checklist completed during `/gsd:verify-work` before phase closeout

**Approval:** pending
