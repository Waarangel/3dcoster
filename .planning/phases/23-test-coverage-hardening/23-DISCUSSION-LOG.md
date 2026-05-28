# Phase 23: Test coverage hardening — Discussion Log

**Date:** 2026-05-28
**Mode:** default (discuss)

Human-reference audit trail of the discuss-phase session. Not consumed by downstream agents — see `23-CONTEXT.md` for the locked decisions.

---

## Gray Areas Selected

User selected ALL 4 of the presented gray areas:
1. Email-lowercase resolution direction
2. DUP-02 'Do NOT modify' intent
3. fake-indexeddb scope and integration shape
4. Customer modal test depth

---

## Area 1 — Email-lowercase resolution direction

### Q1: Which direction should the email-lowercase divergence be locked?

**Options presented:**
- Align modal with parser (recommended) — modal lowercases on save
- Align parser with modal — drop lowercase from customerCsv.ts
- Keep divergence, just lock the test — both behaviors stay different, two tests

**User chose:** Align modal with parser

**Reasoning surfaced:** customerCsv.ts:139-140 already cites "UI-SPEC discretion #8: emails normalized to LOWERCASE on write" — the modal is the divergence; the parser is the canonical contract. `useDatabase.customersByEmail` lookup map also already uses `.toLowerCase()` keys, so the broader codebase treats email as case-insensitive.

### Q2: Reconcile existing customers in user IndexedDB whose emails are already mixed-case?

**Options presented:**
- Yes — ship a one-time reconcile (recommended)
- No — forward-only change
- Yes — but reconcile sales too (NOT recommended; violates by-value isolation)

**User chose:** Yes — ship a one-time reconcile

**Reasoning surfaced:** mirrors the standing `feedback_reconcile_legacy_data` rule applied to every other schema/behavior change this milestone (tags normalize, copiesSold, fixedCostsAtSave). Same module-flag pattern, same pure-helper-then-bulkPut shape.

---

## Area 2 — fake-indexeddb scope and integration shape

### Q3: How should fake-indexeddb be wired into the vitest setup?

**Options presented:**
- Per-test import (recommended) — `import 'fake-indexeddb/auto'` at top of migration test file only
- Global setup file — installed for every test file
- Conditional via env flag — opt-in via VITEST_FAKE_IDB=true

**User chose:** Per-test import

**Reasoning surfaced:** scoping blast radius. The other 438 passing tests stay in pure jsdom with zero behavior change. Only TEST-04 touches IndexedDB.

### Q4: What happens to the existing pure-helper fallback migrations test?

**Options presented:**
- Replace it (recommended) — the file's own docstring (lines 6-31) literally says to replace it when fake-indexeddb lands
- Keep both — sibling file `database.migrations.real-dexie.test.ts`
- Replace + add v6→v7 migration — wider scope than TEST-04

**User chose:** Replace it

**Reasoning surfaced:** the pure-helper layer is still exhaustively covered by `backfill.test.ts` (47 cases) — nothing is lost by replacing the fallback file. The replacement was the file's own documented future state.

### Q5: Should the 3 new Customer-UI modal tests use fake-indexeddb under the hood, or mock the useDatabase hooks like Phase 22 did?

**Options presented:**
- Mock useDatabase hooks (Phase 22 precedent) — recommended
- Use fake-indexeddb for real Dexie under the modal
- Hybrid — picker tests mock, library test uses fake-IDB

**User chose:** Mock useDatabase hooks (Phase 22 precedent)

**Reasoning surfaced:** Phase 22's RecordSaleModal pattern has already proven catches the bugs that matter (WR-02 hydration regression). Going deeper would diverge from the established test convention.

---

## Area 3 — Customer modal test depth

### Q6: Inside the mocked-hook pattern, should the tests render the real `<Modal>` primitive (Phase 19) or stub it out?

**Options presented:**
- Render the real `<Modal>` primitive (recommended)
- Stub `<Modal>` to render children inline
- Real `<Modal>` for hydration tests, stub for the rest

**User chose:** Render the real `<Modal>` primitive

**Reasoning surfaced:** Phase 22's WR-02 hydration regression would have been invisible to a stubbed-Modal test path. The cost (per-test Modal portal mount) is paid every other test in this codebase already.

---

## Area 4 — DUP-02 lock-comment intent

### Q7: Does 'Do NOT modify these assertions' allow splitting the 6-assertion it block into 6 named it blocks while keeping every expect() line byte-identical?

**Options presented:**
- Yes — 'assertions' means the expect() lines, not the it-block shape (recommended)
- No — the comment locks the test structure
- Yes, but also add a 7th case that asserts the lock comment exists

**User chose:** Yes — 'assertions' means the expect() lines

**Reasoning surfaced:** the lock's purpose is the threat-model fixed coverage (PII reset / tax reset / copiesSold reset / id rotation / createdAt advance / tags preserve). Splitting into 6 it blocks preserves every assertion expression byte-identically. The lock comment will be updated to clarify the distinction (shape refactor allowed; expect() lines locked) — see D-10.

---

## Scope creep redirected

[none — every question stayed inside the Phase 23 boundary set by ROADMAP success criteria]

## Carry-forwards confirmed (not re-asked)

- Test convention: raw `createRoot` + `act` (Phase 19 D-21, Phase 22 D-21)
- CL-01 sort order: `lastUsedAt desc, undefined-first` (Phase 15.1)
- `<Modal>` primitive contract: Phase 19
- Reconcile-legacy-data rule (project memory)
- Sales by-value isolation: Phase 15.1 CL-05 (cited in D-03 to justify NOT reconciling historical sales)
