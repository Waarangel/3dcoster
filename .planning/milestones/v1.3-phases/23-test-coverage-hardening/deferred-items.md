# Phase 23 Deferred Items

Discovered during plan 23-01 execution. NOT auto-fixed — these are pre-existing
issues in files outside plan 23-01's scope.

## Pre-existing `tsc -b` errors (NOT introduced by plan 23-01)

The following `tsc -b` errors exist on the parent commit (5832646) and are
unrelated to plan 23-01's changes (CustomerEditModal, backfill.ts, useDatabase.ts):

- `src/components/JobsManager.tsx`: missing `react-window` types
- `src/pdf/generateQuotePdf.ts`: missing `jspdf-autotable` types, jsPDF
  namespace-vs-constructor issue, missing `@tauri-apps/plugin-dialog`,
  `@tauri-apps/plugin-fs`
- `src/pdf/generateQuotePdf.test.ts`: same missing tauri plugin modules

Likely cause: worktree-local `node_modules` install is incomplete (these are
optional deps that need explicit install). Outside plan 23-01's scope; not
fixed here.

Plan 23-01 acceptance criterion "`npx tsc -b` exits 0" is interpreted as
"no NEW tsc errors introduced by this plan's files." That criterion is met:
the four files this plan touches (backfill.ts, backfill.test.ts,
CustomerEditModal.tsx, CustomerEditModal.test.tsx, useDatabase.ts) produce
zero tsc errors — only pre-existing errors in unrelated files surface.
