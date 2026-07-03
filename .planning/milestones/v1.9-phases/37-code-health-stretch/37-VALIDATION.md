---
phase: 37
slug: code-health-stretch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 37 is a STRETCH/behavior-preserving phase — validation centers on **behavioral equivalence**
> (the cleanups must not change runtime behavior), proven by source-contract assertions + the
> existing suite staying green.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Type gate** | `tsc -b` (NOT `tsc --noEmit` — per `.claude/CLAUDE.md`; enforces `noUnusedLocals`) |
| **Estimated runtime** | ~30–60 seconds |

**Convention note (from RESEARCH.md):** existing tests use **raw `createRoot` + `act`** and the
codebase's established source-contract pattern (`readFileSync` + `toContain` / `not.toContain`) to
lock refactors. New assertions follow the same pattern. No new test framework/dependency needed.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file(s)>`
- **After every plan wave:** Run `npm test` (full suite) + `tsc -b`
- **Before `/gsd:verify-work`:** Full suite + `tsc -b` must be green (37-02 also runs `npm run lint`)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Requirement | Surface | Test Type | Indicative Assertion |
|-------------|---------|-----------|----------------------|
| HYG-11 (V1/V2/V3) | `CostCalculator.tsx:842/1304/1320` | source-contract + suite | zero `updated[index] =` in the 3 sites; `prev.map(` functional updater present; array shape + values unchanged; existing pricing/material tests green |
| HYG-12.1 | `CostCalculator.tsx` `updatePackagingMaterial` | source-contract | both packaging onChange handlers delegate to the new `updatePackagingMaterial` helper (mirrors `updateFilamentRow:194`); `parseFloat(...) || 0` preserved |
| HYG-12.2 | `useDatabase.ts` `useAssets` init | source-contract + suite | A+B reads batched via one `Promise.all`; single post-batch `cancelled` guard; `bulkPut` writes remain sequential + after the guard; init behavior/counts unchanged |
| HYG-12.3 | `src/db/database.ts:133` (C1), `useDatabase.ts:1211` (C3) | source-contract + suite | `as UserProfile` replaced with validated narrowing (`Partial<UserProfile>` parse) mirroring the v9 pattern; `'USD'`/default fallbacks + try/catch preserved; other 7 casts untouched |

---

## Behavioral-Equivalence Gate (phase-critical)

Because Phase 37 is a pure cleanup phase, the binding success condition is **no behavioral change**:

- The full vitest suite (current baseline: 744 passing) MUST remain green with no removed/weakened assertions.
- `tsc -b` MUST stay clean (watch `noUnusedLocals` on the extracted `updatePackagingMaterial` helper and any `parsedProfile`/`parsedV8` locals introduced for narrowing).
- 37-02's regression gate additionally runs `npm run lint` (0 errors) since the cast-narrowing touches type-sensitive code.

---

## Wave 0 Requirements

- [ ] Source-contract assertions added by each plan that touches a surface (CostCalculator immutability + helper; useDatabase batching + cast narrowing) — no separate framework install needed (vitest + jsdom already configured).
