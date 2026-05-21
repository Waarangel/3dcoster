---
phase: 12
slug: schema-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
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

> Filled in by the planner — placeholder rows show the expected shape. The planner MUST emit one row per task in PLAN.md, mapping each task ID to a verification command or to a manual UAT row below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | SCHEMA-01 | — | N/A | source assert + types | `tsc -b` and `grep -E "version\\(6\\)" src/db/database.ts` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | SCHEMA-01 | — | N/A | source assert + types | `tsc -b` and `grep -E "tags\\?:\\s*string\\[\\]" src/types.ts` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | SCHEMA-02 | — | N/A | source assert | `grep -E "versionchange" src/db/database.ts` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | SCHEMA-01 | — | tags backfilled idempotently on parsed records | unit (pure fn) | `npx vitest run src/db/__tests__/backfillTags.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/__tests__/backfillTags.test.ts` — unit tests for the extracted `backfillTagsOnJob(job)` pure helper (idempotency, missing-tags, already-array, non-array-tags defensive guard). Required because jsdom doesn't support IndexedDB — the only way to unit-test the v6 row-mutation body is to extract it.
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
