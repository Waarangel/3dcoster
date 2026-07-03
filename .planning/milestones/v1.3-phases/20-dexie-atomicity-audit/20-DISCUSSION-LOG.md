---
phase: 20-dexie-atomicity-audit
recorded: 2026-05-26
purpose: Human-reference audit of the discuss-phase conversation. NOT consumed by downstream agents (researcher, planner, executor).
---

# Phase 20 — Discussion Log

## Areas Selected for Discussion

User multi-selected all 4 presented gray areas:
1. Scope of atomicity wrap
2. parsePositiveNumber API shape
3. getSetting validator approach
4. DATA-03 reconcile mechanism

## Area 1 — Scope of atomicity wrap

**Framing:** DATA-01 names addSale specifically, but useDatabase.ts has three mutations sharing the same `sales.X + jobs.put` pattern (addSale, deleteSale, updateSale). Phase goal says "every multi-store mutation atomic" — broader than DATA-01.

**Options presented:**
- All 3 sale mutations (recommended)
- addSale only (per DATA-01 letter)
- All 3 plus expand to Convert-to-Sale audit

**User selection:** All 3 sale mutations (recommended).

**Notes:** Same bug class across all three. Convert-to-Sale path already transactional and serves as the reference pattern.

## Area 2 — parsePositiveNumber API shape

**Framing:** Current signature rejects negatives but accepts 0. Two semantic camps in the 9 call sites — most should reject 0, a few are debatable.

**Options presented:**
- `allowZero?: boolean` parameter (recommended)
- Rename to `parseStrictlyPositiveNumber`
- Both — strict default + nonNegative variant

**User selection:** `allowZero?: boolean` parameter.

**Notes:** Single function, no rename churn, opt-in self-documents zero-acceptance at the call site.

## Area 3 — getSetting validator approach

**Framing:** `getSetting<T>` catches JSON parse errors but doesn't validate shape. Corrupted localStorage data passes through.

**Options presented:**
- Hand-rolled per-key validators (recommended)
- Zod (~12KB gzipped)
- Typed-key registry pattern

**User selection:** Hand-rolled per-key validators.

**Notes:** No new dependency; matches existing TypeScript-only style; Zod deferred until a broader validation surface emerges.

## Area 4 — DATA-03 reconcile mechanism

**Framing:** `backfillQuotesFromJobs` hardcoded currency='USD'. Non-USD users on v8 already have wrong-currency quotes. Per the user's standing rule (auto-memory: reconcile legacy data, not forward-only fixes), the fix must include a re-stamp helper for existing data.

**Options presented:**
- Schema bump v8→v9 with upgrade callback (recommended)
- In-app one-shot helper on next currency read
- Schema bump + idempotent guard

**User selection:** Schema bump v8→v9 with upgrade callback.

**Notes:** Atomic, integrates with existing migration test infrastructure (Phase 23's TEST-04). Triggers versionchange-reload in other tabs — coordinates with DATA-05's `async versionchange` fix shipping in the same phase.

## Deferred Ideas

- Zod integration — revisit if a broader validation surface appears.
- Typed-key registry pattern — revisit if validator count grows past ~6.
- Settings shape versioning — overkill at current scale; revisit if a non-additive shape change ships.

## Claude's Discretion

- Plan ordering: 20-04 (defensive trio incl. versionchange) ships before or with 20-03 (currency reconcile) so the new async-versionchange handler is in place when v9's bump triggers reloads in other tabs. Planner should confirm this ordering.
- Manual two-tab UAT for `createQuote` no-collision documented in plan 20-02. Automated version deferred to Phase 23.
