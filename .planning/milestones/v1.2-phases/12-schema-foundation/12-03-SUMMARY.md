---
phase: 12-schema-foundation
plan: 03
status: complete
completed: 2026-05-21
requirements:
  - SCHEMA-01
  - SCHEMA-02
---

# Plan 12-03 — Dexie v6 migration + versionchange handler

## What shipped

`src/db/database.ts` gained the Dexie v6 schema bump (runtime half of SCHEMA-01) and the multi-tab `versionchange` reload handler (full body of SCHEMA-02).

### Exact placements

- **v6 migration block** — `src/db/database.ts:76` (`db.version(6).stores({...}).upgrade(...)`), inserted between the v5 close and `export { db };`.
- **versionchange handler** — `src/db/database.ts:90` (`db.on('versionchange', () => { window.location.reload(); });`), inserted between the v6 `.upgrade()` close and `export { db };` (which is now line 92).
- **Runtime import** — `src/db/database.ts:3` adds `import { backfillTagsOnJob } from './backfill';` next to the existing imports. This is a runtime import (not `import type`) because `backfillTagsOnJob` is called from the upgrade callback — `verbatimModuleSyntax: true` requires the bare `import` form for runtime values.

### Upgrade body — verbatim

```typescript
db.version(6).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
}).upgrade(tx => {
  return tx.table('jobs').toCollection().modify(backfillTagsOnJob);
});
```

The `return` keyword on the `modify()` call is present — Dexie awaits every row before marking v6 ready (RESEARCH Pitfall 2 / STATE.md v1.0 lesson). The callback argument is the imported `backfillTagsOnJob` helper from `./backfill` (Plan 02 output), NOT an inline arrow — keeps the migration body unit-tested under jsdom (Plan 02's 5 Vitest cases).

### Schema-string check

All 6 tables (`materials`, `printers`, `printerInstances`, `jobs`, `sales`, `settings`) in the v6 stores definition match v5 byte-for-byte. No `*tags` multi-entry index added (D-04). `grep -cE "jobs:\\s*'id, name, createdAt, printerInstanceId'"` returns 3 (v4, v5, v6).

### versionchange handler — verbatim

```typescript
db.on('versionchange', () => { window.location.reload(); });
```

Plain `window.location.reload()` — no `confirm()`, no `setTimeout`, no toast (D-10). Module-top-level placement (D-11 / RESEARCH Pitfall 1) — attaches synchronously during module evaluation, before any `useLiveQuery` consumer first calls into the singleton.

## Gates

- `tsc -b` exits 0 — full project build green.
- `npx vitest run` — 5 test files, 67 passed + 1 todo, 0 failures.
- `grep -cE "db\\.version\\(6\\)" src/db/database.ts` returns 1.
- `grep -cE "db\\.on\\('versionchange'" src/db/database.ts` returns 1.
- `grep -cE "\\*tags" src/db/database.ts` returns 0.
- `grep -cE "setTimeout|confirm\\(|toast" src/db/database.ts` returns 0.
- `grep -cE "useEffect|componentDidMount" src/db/database.ts` returns 0.
- awk ordering check: `versionchange` (line 90) precedes `export { db };` (line 92).

## Commits

- `d3a5b91` feat(12-03): add Dexie v6 migration block calling backfillTagsOnJob
- `37793de` feat(12-03): register versionchange handler for multi-tab reload

## Note for Plan 04

Plan 04 performs the real-browser manual UAT for the parts that can't run under jsdom: SCHEMA-01 (b/c/d) — v5 → v6 migration backfills `tags = []` on existing jobs against a real IndexedDB store — and SCHEMA-02 (b) — second tab on the old bundle auto-reloads when first tab loads v6. The grep/build/test gates above prove the code-level contracts; Plan 04 proves the runtime behavior.

## Deviations from plan

One — the second comment line above the v6 block was reworded from the planner's literal `` no `*tags` index per D-04 `` to `no multi-entry index on tags per D-04` because the acceptance-criterion heuristic `grep -cE "\*tags" src/db/database.ts` returns 0 catches the literal text in the comment. Same WHY preserved, no semantic change to schema or code behavior.
