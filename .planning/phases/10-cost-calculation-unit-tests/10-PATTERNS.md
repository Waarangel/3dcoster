# Phase 10: Cost-Calculation Unit Tests - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 5 (2 create, 3 modify)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/utils/costCalc.ts` (CREATE) | utility (pure module) | transform (input → derived numbers) | `src/utils/gcodeParser.ts` (specifically `getMaterialDensity` + `filamentLengthToGrams`) | exact (pure utility, no React, exported named functions, same `src/utils/` directory) |
| `src/utils/costCalc.test.ts` (CREATE) | test | request-response (call → assert) | `src/utils/threeMfParser.test.ts` | exact (co-located vitest, pure-utility test, no React) |
| `src/components/CostCalculator.tsx` (MODIFY line 374) | component (integration only) | request-response (useMemo wrapping pure call) | self — its own surrounding `useMemo` blocks at lines 360, 460, 471 | exact (same file, same hook pattern) |
| `vitest.config.ts` (MODIFY) | config | n/a | current `vitest.config.ts` shape | exact (extend existing file) |
| `package.json` scripts.build (MODIFY) | config | n/a | current `scripts.build` chain | exact (extend existing chain) |

---

## Pattern Assignments

### `src/utils/costCalc.ts` (utility, transform)

**Analog:** `src/utils/gcodeParser.ts`

**Module header / type imports pattern** (`src/utils/gcodeParser.ts:1`):
```typescript
import type { FilamentType, Asset } from '../types';

export interface GcodeParseResult {
  filamentGrams: number | null;
  printTimeHours: number | null;
  // ...
}
```

Apply to `costCalc.ts`: import shared types from `'../types'` (`CostBreakdown` exists at `src/types.ts:116`; `MaterialUsage` at `src/types.ts:103`). Define local `CalcInput` interface at top of file; export `CostBreakdown` re-export is unnecessary (consumers continue importing from `'../types'`).

**Exported pure function signature pattern** (`src/utils/gcodeParser.ts:64-78`):
```typescript
// Material density lookup (g/cm³) for length-to-weight conversion
export function getMaterialDensity(filamentType: string | null): number {
  if (!filamentType) return 1.24; // PLA default
  const type = filamentType.toUpperCase();
  if (type.includes('PLA')) return 1.24;
  // ...
  return 1.24; // Default to PLA density
}
```

Apply to each sub-helper (`calculateFilamentCost`, `calculateElectricityCost`, `calculateDepreciation`, `calculateNozzleWear`, `calculateLabor`, `calculateAmortization`): named `export function`, single-purpose, typed input, returns `number`. Top-of-function comment naming the formula (matches gcodeParser's commenting style).

**Math source — the `useMemo` to extract** (`src/components/CostCalculator.tsx:374-452`):

The full body is the contract `calculateCost(input: CalcInput): CostBreakdown` must preserve. Key sub-blocks:

Filament cost (`CostCalculator.tsx:376-379`):
```typescript
const filamentCost = filamentRows.reduce((sum, row) => {
  if (!row.filamentId || row.editedPrice <= 0) return sum;
  return sum + row.grams * row.editedPrice;
}, 0);
```

Electricity cost (`CostCalculator.tsx:382-384`):
```typescript
const electricityCost = selectedPrinter
  ? (selectedPrinter.wattage / 1000) * printTimeHours * electricity.costPerKwh
  : 0;
```

Depreciation (`CostCalculator.tsx:388-393`):
```typescript
const purchasePrice = selectedInstance?.actualPurchasePrice ?? selectedPrinter?.purchasePrice ?? 0;
const recoveryMonths = selectedInstance?.recoveryMonths ?? 12;
const monthlyHours = selectedInstance?.estimatedMonthlyPrintHours ?? 40;
const totalRecoveryHours = recoveryMonths * monthlyHours;
const depreciationPerHour = totalRecoveryHours > 0 ? purchasePrice / totalRecoveryHours : 0;
const depreciation = depreciationPerHour * printTimeHours;
```

Nozzle wear (uses `getMaterialDensity` already imported) (`CostCalculator.tsx:397-405`):
```typescript
const totalVolumeCm3 = filamentRows.reduce((sum, row) => {
  if (row.grams <= 0) return sum;
  const asset = materials.find(m => m.id === row.filamentId);
  const density = getMaterialDensity(asset?.filamentType ?? null);
  return sum + row.grams / density;
}, 0);
const nozzleWear = selectedPrinter
  ? (totalVolumeCm3 / selectedPrinter.nozzleLifespanCm3) * selectedPrinter.nozzleCost
  : 0;
```

Labor cost (`CostCalculator.tsx:418-419`):
```typescript
const totalLaborMinutes = prepTimeMinutes + postProcessingMinutes;
const laborCost = (totalLaborMinutes / 60) * laborHourlyRate;
```

Failure-rate clamp — lives INSIDE `calculateCost` per CONTEXT D-02 (`CostCalculator.tsx:428-431`):
```typescript
const clampedFailureRate = Math.min(Math.max(failureRate, 0), 99);
const failureMultiplier = 1 / (1 - clampedFailureRate / 100);
const failureAdjusted = perUnitSubtotal * failureMultiplier;
```

CostBreakdown contract — every consumer field must be preserved (`CostCalculator.tsx:433-446`):
```typescript
return {
  filament: filamentCost,
  electricity: electricityCost,
  printerDepreciation: depreciation,
  nozzleWear: nozzleWear,
  modelAmortization: modelAmortization,
  materials: materialsCost,
  labor: laborCost,
  subtotal: perUnitSubtotal,
  failureAdjusted: failureAdjusted,
  profitMargin: profitMarginPercent,
  targetProfit: targetProfit,
  sellingPrice: sellingPrice,
};
```

The `CostBreakdown` interface itself is locked at `src/types.ts:116-129`:
```typescript
export interface CostBreakdown {
  filament: number;
  electricity: number;
  printerDepreciation: number;
  nozzleWear: number;
  modelAmortization: number;
  materials: number;
  labor: number;
  subtotal: number;
  failureAdjusted: number;
  profitMargin: number;
  targetProfit: number;
  sellingPrice: number;
}
```

**Error / defense pattern:** Per CONTEXT D-13 + Claude's discretion: extract only the defenses that exist (the `?? 0` / `?? null` / `totalRecoveryHours > 0` guards above). Do not invent new ones. The `useMemo` has no try/catch and no thrown errors — `calculateCost` follows suit (no throws, return zeros on missing dependencies).

---

### `src/utils/costCalc.test.ts` (test, request-response)

**Analog:** `src/utils/threeMfParser.test.ts`

**Test header / imports pattern** (`src/utils/threeMfParser.test.ts:1-3`):
```typescript
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';
import { parseThreeMf } from './threeMfParser';
```

Apply to `costCalc.test.ts` (NO `jszip`, NO React, NO `renderToStaticMarkup` — pure math only):
```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  calculateFilamentCost,
  calculateElectricityCost,
  calculateDepreciation,
  calculateNozzleWear,
  calculateLabor,
  calculateAmortization,
} from './costCalc';
import { getMaterialDensity } from './gcodeParser';
```

**Synthetic fixture pattern** — hand-built inputs where the math is verifiable by eye (`src/utils/threeMfParser.test.ts:22-46` shows the inline-XML-fixture style; the cost-calc analog is hand-built numeric input objects). Per CONTEXT D-11:

```typescript
// e.g.
const minimalInput: CalcInput = {
  filamentRows: [{ filamentId: 'pla-1', grams: 500, editedPrice: 0.02, editedCurrency: 'USD' }],
  // ...
};
// expect filamentCost === 500 * 0.02 === 10.00
```

**describe / it scaffolding pattern** (`src/utils/threeMfParser.test.ts:57-78`):
```typescript
describe('parseThreeMf', () => {
  // --- 3MF-01: per-plate extraction ---
  it('Test 1 (3MF-01): extracts per-plate filaments and print time from a valid sliced ZIP', async () => {
    const file = await makeSlicedZip(MULTI_PLATE_XML);
    const result = await parseThreeMf(file);

    expect(result.isSliced).toBe(true);
    expect(result.plates).toHaveLength(2);
    // ...
  });
```

Apply to `costCalc.test.ts`:
- Outer `describe('calculateCost', ...)` for the coarse entrypoint, plus one `describe` per sub-helper (`describe('calculateFilamentCost')`, `describe('calculateNozzleWear')`, etc.). Pattern proven in `threeMfParser.test.ts` of one describe + many `it`s — extend by nesting `describe`s when helper count grows.
- Test naming format: `it('Test N (TEST-ID): describes the behavior', ...)` — matches `threeMfParser.test.ts:59` `'Test 1 (3MF-01): ...'`. Use TEST-01 / TEST-02 prefixes from REQUIREMENTS.md where applicable.

**Floating-point assertion pattern** — `toBeCloseTo` for monetary math, `toBe` for integers (`src/utils/threeMfParser.test.ts:88-96`):
```typescript
// PLA: 36.12 (plate1) + 15.01 (plate2) = 51.13
const pla = result.filamentsByType.find(f => f.type === 'PLA');
expect(pla!.grams).toBeCloseTo(51.13, 1);

// totalPrintTimeHours: (3600 + 1800) / 3600 = 1.5
expect(result.totalPrintTimeHours).toBe(1.5);
```

Apply to currency assertions: `expect(costs.filament).toBeCloseTo(10.00, 2)` for derived dollars; `expect(costs.subtotal).toBe(0)` for exact-zero degenerate cases.

**Edge-case mapping (CONTEXT D-13):**
| Edge case | Fixture | Expected |
|-----------|---------|----------|
| 1 filament row (v0 migration) | `filamentRows.length === 1` | filament cost = grams × price |
| 2 filament rows (multi-color) | `filamentRows.length === 2` | sum across rows |
| 16 filament rows (Bambu AMS Hub max, PROJECT.md) | `filamentRows.length === 16` | sum across all 16, no clamp |
| Failure rate 0 | `failureRate: 0` | failureMultiplier === 1 |
| Failure rate 99 | `failureRate: 99` | failureMultiplier === 100 |
| Failure rate 150 (over-100 clamps) | `failureRate: 150` | clamped to 99, multiplier === 100 |
| Failure rate -10 (negative clamps) | `failureRate: -10` | clamped to 0, multiplier === 1 |
| `getMaterialDensity('PLA')` smoke | call directly | 1.24 (`gcodeParser.ts:67`) |
| `getMaterialDensity('PETG')` smoke | call directly | 1.27 (`gcodeParser.ts:68`) |
| `getMaterialDensity('ABS')` smoke | call directly | 1.04 (`gcodeParser.ts:69`) |
| `getMaterialDensity('UnknownXYZ')` smoke | call directly | 1.24 fallback (`gcodeParser.ts:77`) |
| No printer selected | `selectedPrinter: undefined` | electricityCost === 0, nozzleWear === 0 |
| Total recovery hours 0 | `recoveryMonths * monthlyHours === 0` | depreciation === 0 (guard on line 392) |

**`it.todo` placeholder pattern** (CONTEXT D-12, exact phrasing):
```typescript
it.todo('tax/VAT applies after subtotal — activates in v1.2');
```
Place at end of outer `describe('calculateCost', ...)` block. No second argument needed (vitest's `it.todo` accepts a single description string). Activates by changing `it.todo` → `it` and supplying a function body once v1.2 tax logic ships.

**Defensive untested-branch pattern** (CONTEXT Claude's discretion): use `/* c8 ignore next */` directly above any extracted-but-unreachable defensive line rather than write a low-value test. Example shape:
```typescript
/* c8 ignore next */
if (totalRecoveryHours <= 0) return 0;
```
Apply only if needed to satisfy the 95-line / 100-function / 90-branch thresholds without writing nonsense tests.

---

### `src/components/CostCalculator.tsx` (component, integration only — line 374)

**Analog:** the surrounding `useMemo` blocks in the same file — particularly the `fixedCosts` `useMemo` at line 460 which already shows the "thin `useMemo` calling derived logic" shape.

**Replacement pattern** for line 374 — the current body becomes a single `calculateCost({…})` call. The dependency array (`CostCalculator.tsx:447-452`) stays unchanged:
```typescript
const costs = useMemo((): CostBreakdown => calculateCost({
  filamentRows,
  printTimeHours,
  selectedPrinter,
  selectedInstance,
  electricity,
  materials,
  materialsUsed,
  prepTimeMinutes,
  postProcessingMinutes,
  laborHourlyRate,
  failureRate,
  profitMarginPercent,
  targetProfit,
  sellingPrice,
  modelCost,
  modelCostPerUnit,
}), [
  materials, filamentRows, printTimeHours, selectedPrinter, electricity,
  selectedInstance, materialsUsed, laborHourlyRate, prepTimeMinutes,
  postProcessingMinutes, failureRate, profitMarginPercent, targetProfit, sellingPrice,
  modelCost, modelCostPerUnit
]);
```

**Import additions** (insert after line 8):
```typescript
import { calculateCost } from '../utils/costCalc';
```

**Critical preservation rules** (CONTEXT D-01, D-04):
- The `CostBreakdown` shape returned must be **byte-for-byte identical** to the current `useMemo` return — every field name and value semantics preserved.
- `getMaterialDensity` import at `CostCalculator.tsx:8` STAYS (it's used by other code paths if any; but at minimum we can drop it once `calculateNozzleWear` owns the call — planner decides). Conservative default: keep the import; ESLint will flag if truly unused.
- NO UI changes. NO behavior changes. Diff should be: 1 import added, ~75 lines deleted, ~17 lines added (the `calculateCost({…})` call site).

---

### `vitest.config.ts` (config)

**Analog:** the file itself.

**Current shape** (entire file):
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
```

**Extension pattern** (CONTEXT D-08, D-09, D-10) — add a `coverage` block inside `test` scoped to `src/utils/costCalc.ts` only:
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/costCalc.ts'],
      thresholds: {
        lines: 95,
        functions: 100,
        branches: 90,
      },
    },
  },
})
```

Notes:
- `@vitest/coverage-v8 ^4.1.4` is already in devDependencies (`package.json:40`) — no install needed.
- `coverage.include` is the scoping mechanism — by listing only `src/utils/costCalc.ts` the report ignores every other file, so the rest of the codebase generates no false threshold alarms.
- `provider: 'v8'` is required to match the installed package; the default is `'v8'` in vitest 4 but be explicit.

---

### `package.json` scripts (config)

**Analog:** the file itself.

**Current `scripts` block** (`package.json:6-17`):
```json
"scripts": {
  "dev": "vite",
  "build": "node scripts/lint-no-raw-html.mjs && tsc -b && vite build",
  "lint": "eslint .",
  "lint:no-raw-html": "node scripts/lint-no-raw-html.mjs",
  "preview": "vite preview",
  "prepare": "chmod +x .git/hooks/pre-commit 2>/dev/null || true",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build",
  "test": "vitest run"
},
```

**Modifications** (CONTEXT D-05, D-06, D-07):

| Script | Before | After |
|--------|--------|-------|
| `build` | `node scripts/lint-no-raw-html.mjs && tsc -b && vite build` | `node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build` |
| `test` | `vitest run` | **UNCHANGED** — stays `vitest run` (one-shot, what build invokes) |
| `test:watch` | *(missing)* | `vitest` (NEW — interactive local dev) |

Insertion order: `test:watch` goes immediately after `test` to keep the test-related scripts grouped.

Resulting `scripts` block shape:
```json
"scripts": {
  "dev": "vite",
  "build": "node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build",
  "lint": "eslint .",
  "lint:no-raw-html": "node scripts/lint-no-raw-html.mjs",
  "preview": "vite preview",
  "prepare": "chmod +x .git/hooks/pre-commit 2>/dev/null || true",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build",
  "test": "vitest run",
  "test:watch": "vitest"
},
```

**Order is deterministic** per CONTEXT D-06: `lint-html → vitest run --coverage → tsc -b → vite build`. Do not reorder. Tests run before `tsc -b` for fastest-feedback ordering (a failing test surfaces in 1–2 seconds rather than after the 5–10 second TS build).

---

## Shared Patterns

### Test header (vitest, no React)
**Source:** `src/utils/threeMfParser.test.ts:1-3`
**Apply to:** `src/utils/costCalc.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { /* exported names */ } from './costCalc';
```
Do NOT import `* as React`, `renderToStaticMarkup`, or any DOM helpers — those are the React-test pattern (`Skeleton.test.ts`, `EmptyState.test.ts`), not relevant here per CONTEXT scope.

### Test naming convention
**Source:** `src/utils/threeMfParser.test.ts:59`, also `src/components/ui/Skeleton.test.ts:8`, `src/components/ui/EmptyState.test.ts:8`
**Apply to:** every `it(...)` in `costCalc.test.ts`
```typescript
it('Test N (TEST-ID): describes the behavior', () => { /* ... */ });
```
- `Test N` — sequential per `describe` block
- `(TEST-ID)` — REQUIREMENTS.md ID where applicable (`TEST-01`, `TEST-02`); omit for ad-hoc edge cases
- Behavior description in lowercase, present tense

### Floating-point monetary assertions
**Source:** `src/utils/threeMfParser.test.ts:88`
**Apply to:** every `expect` against a dollar amount, density, or computed weight
```typescript
expect(costs.filament).toBeCloseTo(10.00, 2);  // 2 decimal places for cents
expect(costs.subtotal).toBe(0);                 // exact zero for degenerate cases
expect(getMaterialDensity('PLA')).toBe(1.24);   // table lookup is exact
```
Rule of thumb: `toBeCloseTo(value, 2)` for derived currency math, `toBe` for table lookups and integer counts.

### Pure utility module structure
**Source:** `src/utils/gcodeParser.ts`
**Apply to:** `src/utils/costCalc.ts`
- `import type { ... } from '../types';` at top
- Local interfaces (e.g. `CalcInput`) declared at top, exported if consumed by tests
- Each helper is a named `export function`, not arrow consts (matches `getMaterialDensity` at line 64)
- File-level JSDoc-style comments explaining the formula above each function

### Co-located test file convention
**Source:** `src/utils/threeMfParser.test.ts` sits next to `src/utils/threeMfParser.ts`; `Skeleton.test.ts` next to `Skeleton.tsx`
**Apply to:** `src/utils/costCalc.test.ts` sits next to `src/utils/costCalc.ts`
This is matched by `vitest.config.ts` `include: ['src/**/*.test.ts']` — no config change needed for discovery.

---

## No Analog Found

None — every file has a strong analog in the existing codebase.

| File | Note |
|------|------|
| (none) | All five files have exact or role-match analogs already in `src/utils/` or the same `package.json` / `vitest.config.ts` |

---

## Metadata

**Analog search scope:** `src/utils/`, `src/components/ui/`, `src/components/CostCalculator.tsx`, root config (`vitest.config.ts`, `package.json`), `src/types.ts`
**Files read (in full or targeted):** 6
- `src/utils/threeMfParser.test.ts` (full — 155 lines, primary test analog)
- `src/components/ui/Skeleton.test.ts` (full — 94 lines, secondary; confirms React-test pattern is NOT what we want)
- `src/components/ui/EmptyState.test.ts` (full — 73 lines, tertiary; confirms same)
- `src/utils/gcodeParser.ts` (lines 1–110 — header + `getMaterialDensity`, the smoke-test target and module-shape analog)
- `src/components/CostCalculator.tsx` (lines 1–60 + 365–484 — imports + the `useMemo` to extract)
- `src/types.ts` (lines 100–149 — `CostBreakdown` contract)
- `vitest.config.ts` (full — 8 lines)
- `package.json` (full — 54 lines)

**Pattern extraction date:** 2026-05-20
