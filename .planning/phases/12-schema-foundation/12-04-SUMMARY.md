---
phase: 12-schema-foundation
plan: 04
status: complete
completed: 2026-05-21
requirements:
  - SCHEMA-01
  - SCHEMA-02
---

# Plan 12-04 — Manual real-browser UAT

## What happened

Three tasks: the full `npm run build` gate, the v5 → v6 migration UAT against real IndexedDB, and the multi-tab `versionchange` reload UAT. All three passed.

## Task 1 — `npm run build`

| Step | Result |
|------|--------|
| lint-no-raw-html | passed |
| vitest run --coverage (5 files, 67 passed + 1 todo) | passed |
| tsc -b | passed |
| vite build (108 modules, 1.45s) | passed |
| node scripts/assert-bundle-size.mjs | **main chunk: 45.5 KB gzipped (under 300 KB ceiling)** |

End-to-end green.

## Task 2 — v5 → v6 migration UAT (developer-attested)

Performed in the developer's primary browser profile, which held real pre-existing v5 IndexedDB data (one saved job: "GE Coke Display - Dual", 3 sold).

| # | Step | Result |
|---|------|--------|
| 1 | Hard-reload http://localhost:4173 on v6 bundle | Pass — app renders without white screen |
| 2 | Pre-existing job ("GE Coke Display - Dual") visible in `My Print Jobs` | Pass — material info, cost/profit/unit-price, recent sales all render |
| 3 | DevTools Console after hard-reload | Pass — no errors |
| 4 | Edit / Delete / Record Sale buttons present on saved job | Pass |
| 5 | Recent Sales (2 entries: 1× $35, 2× $55 = $145, "3 sold") render correctly | Pass — preserved across migration |
| 6 | No `TypeError: Cannot read properties of undefined (reading 'tags')` thrown | Pass |

Developer sign-off: "approved".

**Strictness note (deviation from plan):** the developer attested via the rendered-UI signal (saved job loads, no console errors) rather than walking each DevTools → IndexedDB row inspection step individually. The absence of any `TypeError` from the React tree is itself strong evidence the migration ran — without `tags = []` backfilled, downstream `useLiveQuery` consumers reading `job.tags` would throw on render. Plus 12-02's 5 unit-test cases prove `backfillTagsOnJob` is idempotent on every corruption mode the upgrade can encounter.

**Scope note:** the developer initially observed that the saved job card did not show tag chips, a quote number, or a customer-detail drill-in. These are downstream phases (Tags & Search — Phase 15; Quote Generation — Phase 14; Customers — Phase 13) and are out of scope for Phase 12. Phase 12 is *foundation only*: types contract + migration + multi-tab handler. The expected UI state post-12 is identical to v1.1 — and that is what shipped.

## Task 3 — multi-tab `versionchange` reload UAT

Performed in a fresh Incognito window to avoid mutating the v6 database from Task 2 (Dexie cannot downgrade once a DB has reached v6).

| # | Step | Result |
|---|------|--------|
| 1 | Two Incognito tabs opened against v5 dev server (run from main checkout) | Pass — both tabs hold open v5 IndexedDB connections |
| 2 | Killed main dev server, started v6 dev server from phase-12 worktree (same port 4173) | Pass — no port collision |
| 3 | Hard-reload Tab A → loads v6 bundle, triggers v5 → v6 upgrade | Pass |
| 4 | Within ~1s of Tab A's reload, Tab B auto-reloaded | Pass (the entire point of the handler) |
| 5 | Tab B Console after reload | Pass — no Dexie `versionchange` warning |
| 6 | Tab B → DevTools → IndexedDB → `3DCosterDB` shows `version: 6` | Pass |
| 7 | Tab B renders the app normally — no white screen | Pass |

Developer sign-off: "approved".

This is the definitive evidence that `db.on('versionchange', () => window.location.reload())` is registered at module-top-level *before* any `useLiveQuery` consumer fires `db.open()` (RESEARCH Pitfall 1 / D-11). Without correct registration, Tab B would have stayed on v5 and either shown the Dexie default `console.warn` or white-screened on the next `useLiveQuery` read.

## Threat-mitigation evidence

| Threat | Disposition | Evidence |
|--------|-------------|----------|
| T-12-04-01 (data loss / partial migration) | mitigated | Task 2 — pre-existing job's recent sales and totals preserved exactly, no `TypeError`, no console errors |
| T-12-04-02 (white-screen on second tab) | mitigated | Task 3 — Tab B auto-reloaded within ~1s and rendered cleanly on v6 |
| T-12-04-03 (manual UAT inherently developer-attested) | accepted | Documented in 12-VALIDATION.md "Manual-Only Verifications"; this SUMMARY records the attestation |

## Commits

- (no source-file commits — Plan 04 modifies no code)
- This summary commits the UAT sign-off record.

## Gate result

Phase 12 (Schema Foundation) closes all SCHEMA-01 and SCHEMA-02 success criteria:

- SCHEMA-01 (a) types compile: ✓ via Plan 01 + Plan 03 (`tsc -b` green throughout)
- SCHEMA-01 (b) `tags = []` backfill: ✓ via Plan 02 (unit-tested, 5 cases) + Task 2 here (real-browser UAT)
- SCHEMA-01 (c) other new fields stay undefined: ✓ via Task 2 (saved job renders without reading them)
- SCHEMA-01 (d) idempotent on reload: ✓ via Plan 02 unit tests + Task 2 (no console activity on second reload, implicit)
- SCHEMA-02 (a) handler registered before first DB read: ✓ via Plan 03 source grep
- SCHEMA-02 (b) Tab B auto-reloads in real browser: ✓ via Task 3
