# Testing Patterns

**Analysis Date:** 2026-04-13

## Test Framework

**Runner:** None installed.

No test runner (Jest, Vitest, Playwright, Cypress, etc.) is present in `package.json`. There are zero `*.test.*` or `*.spec.*` files in the repository.

**Assertion Library:** Not applicable.

**Run Commands:**
```bash
# No test commands defined
npm run lint    # ESLint is the only automated code quality check
npm run build   # tsc -b && vite build — TypeScript type checking as a quality gate
```

## Test File Organization

**Location:** No test files exist.

**Naming:** No established pattern.

**Structure:** None.

## Test Structure

No tests exist to demonstrate patterns.

## Mocking

No mocking infrastructure or patterns established.

## Fixtures and Factories

**Test Data:** None. The project does have realistic sample data used at runtime in `src/data/defaultMaterials.ts` and `src/data/bambuFilaments.ts` — these could serve as test fixture seeds if tests are added.

**Location:** `src/data/` (runtime defaults, not test fixtures).

## Coverage

**Requirements:** None enforced.

No coverage tooling configured.

## Test Types

**Unit Tests:** Not present.

**Integration Tests:** Not present.

**E2E Tests:** Not present.

## Quality Gates in Place (Non-Test)

The codebase compensates for absent tests with strict TypeScript:

**TypeScript strict mode** (`tsconfig.app.json`):
- `"strict": true`
- `"noUnusedLocals": true`
- `"noUnusedParameters": true`
- `"noFallthroughCasesInSwitch": true`
- `"erasableSyntaxOnly": true`
- Build command: `tsc -b && vite build`

**ESLint** (`eslint.config.js`):
- `typescript-eslint` recommended ruleset
- `eslint-plugin-react-hooks` — enforces Rules of Hooks
- `eslint-plugin-react-refresh` — HMR safety

**Runtime validation patterns** (in `src/utils/csvHelpers.ts`):
- Validation functions return `{ errors: string[], warnings: string[] }` result objects
- Functions are designed to be pure and deterministic — amenable to unit testing if added

## High-Priority Areas for Future Tests

If tests are added, these pure utility functions are the highest-value targets:

- `src/utils/gcodeParser.ts` — `parseGcode()`, `matchFilamentType()`, `findBestFilamentMatch()`
  - Complex regex parsing across 4 different slicer formats
  - Pure functions with no side effects

- `src/utils/csvHelpers.ts` — `parseCsvFile()`, `validateCsvRow()`, `buildAssetsForImport()`
  - Validation logic with multiple error/warning branches
  - Pure functions

- `src/utils/currency.ts` — `formatCurrency()`, `kmToMiles()`, `litersPer100KmToMpg()`
  - Pure math functions

- `src/db/database.ts` — `getSetting()`, `setSetting()`
  - IndexedDB interactions (would require mocking Dexie)

**Recommended framework if tests are added:** Vitest (already uses Vite; zero config overlap, ESM-native, compatible with `tsc -b` build)

```bash
npm install -D vitest @vitest/ui
# Add to package.json:
# "test": "vitest"
# "test:coverage": "vitest --coverage"
```

---

*Testing analysis: 2026-04-13*
