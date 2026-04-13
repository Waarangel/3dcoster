# Coding Conventions

**Analysis Date:** 2026-04-13

## Naming Patterns

**Files:**
- React components: PascalCase — `CostCalculator.tsx`, `NewBadge.tsx`, `JobsManager.tsx`
- Hooks: camelCase with `use` prefix — `useDatabase.ts`, `useLocalStorage.ts`
- Utilities: camelCase — `csvHelpers.ts`, `gcodeParser.ts`, `currency.ts`
- Data files: camelCase — `defaultMaterials.ts`, `bambuFilaments.ts`
- Type declarations: camelCase — `types.ts`, `globals.d.ts`
- Feature registry: camelCase — `features.ts`
- UI components: PascalCase in `src/components/ui/`

**Functions:**
- Named exports: camelCase — `formatCurrency`, `parseGcode`, `buildAssetsForImport`
- React components: PascalCase — `Button`, `NewBadge`, `CostCalculator`
- Custom hooks: camelCase with `use` prefix — `useAssets`, `useJobs`, `useUserProfile`
- Private/internal helpers: camelCase — `detectSlicer`, `parsePrusaStyle`, `checkDuplicates`
- Async DB helpers: verb + noun — `getSetting`, `setSetting`, `getPrinter`, `setShippingConfig`

**Variables:**
- camelCase throughout — `filamentGrams`, `printTimeHours`, `defaultMarketplaceFees`
- Boolean flags: descriptive — `isLoading`, `isNew`, `isDuplicate`, `cancelled`
- Constants: SCREAMING_SNAKE_CASE — `NEW_FEATURE_MAX_AGE_DAYS`, `NEW_FEATURE_SEEN_HOURS`, `STORAGE_KEY`, `CURRENCY_CONFIG`

**Types/Interfaces:**
- `interface` for objects with methods or extensibility — `Asset`, `PrintJob`, `Sale`
- `type` for unions, aliases, and mapped types — `FilamentType`, `Currency`, `ButtonVariant`
- PascalCase for all type names — `GcodeParseResult`, `ParsedRow`, `CsvParseResult`
- Helper interfaces for props: `[Component]Props` — `NewBadgeProps`, `InputProps`, `CardProps`
- Extend HTML element types rather than redefining — `interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, BaseButtonProps {}`

## Code Style

**Formatting:**
- No Prettier config detected — formatting is manual/editor-driven
- Single quotes for strings in JSX and TS
- 2-space indentation throughout
- Trailing commas in multi-line objects/arrays
- Template literals preferred for string interpolation

**Linting:**
- ESLint with `typescript-eslint` recommended config (`eslint.config.js`)
- `eslint-plugin-react-hooks` enforced
- `eslint-plugin-react-refresh` for Vite HMR safety
- TypeScript strict mode: `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- Build command: `tsc -b && vite build` — use `tsc -b` (not `tsc --noEmit`) for local verification

## Import Organization

**Order:**
1. React core imports — `import { useState, useEffect } from 'react'`
2. Third-party libraries — `import Dexie from 'dexie'`, `import Papa from 'papaparse'`
3. Internal modules — db, hooks, data, utils
4. Local/relative imports — `'../types'`, `'../db/database'`
5. CSS (in entry point only) — `'./index.css'`

**Path style:**
- Relative paths only — no `@/` path aliases configured
- Always use relative paths: `'../types'`, `'../../hooks/useDatabase'`
- `.tsx` extensions included in dynamic imports: `import('./pages/LandingPage.tsx')`

**Import type:**
- Use `import type` for type-only imports throughout:
  ```typescript
  import type { Asset, PrinterConfig } from '../types';
  import type { ReactNode, ErrorInfo } from 'react';
  ```

## Error Handling

**Patterns:**
- `try/catch` with silent fallback for localStorage operations (unavailability expected):
  ```typescript
  try {
    return item ? JSON.parse(item) : initialValue;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return initialValue;
  }
  ```
- `try/catch` with empty catch for non-critical operations (e.g., badge tracking):
  ```typescript
  try {
    // localStorage may be full or unavailable
  } catch {
    // no-op
  }
  ```
- `console.error` used for unexpected errors (init failures, network errors)
- `console.log` used sparingly for debugging (one instance in `CostCalculator.tsx`)
- Error Boundary class component in `src/main.tsx` wraps the entire app
- Async DB operations do not throw — errors are caught in `useEffect` init blocks
- Null-coalescing defaults pattern: `assets ?? []`, `parsed.filamentGrams ?? null`

## Logging

**Framework:** Native `console.*`

**Patterns:**
- `console.error` for recoverable failures with error object: `console.error('message:', error)`
- `console.log` for development debugging (not removed before commit — one instance remains in `src/components/CostCalculator.tsx:171`)
- No structured logging or log levels library

## Comments

**When to Comment:**
- Public utility functions get a one-line description above: `// Format a number as currency`
- Non-obvious logic gets inline explanation: `// Order matters: OrcaSlicer is based on BambuStudio, check specific first`
- Migration logic gets explanation comments in init hooks
- Section dividers in long utility files using `// ============================================`
- Backwards-compatibility notes on type aliases: `// Type alias for backwards compatibility`
- Magic numbers explained inline: `// 1 km = 0.621371 miles`

**JSDoc/TSDoc:**
- Not used. Comments are plain `//` style, no `/** */` blocks.

## Function Design

**Size:** Functions are kept focused. Utility files use private helper functions (`detectSlicer`, `parsePrusaStyle`) to break up complex parsing logic.

**Parameters:** Prefer typed objects for config parameters. Optional fields use `?` in interface, not overloaded signatures.

**Return Values:**
- Result objects with `errors: string[]` + `warnings: string[]` for validation functions — never throw
- `null` for "not found" returns: `findBestFilamentMatch` returns `string | null`
- Positive number parser returns `number | null` (not `NaN` or exception)

## Module Design

**Exports:**
- Named exports throughout — no default exports except React pages/components
- Pages use named exports: `export function LandingPage()`
- `App.tsx` uses default export (React convention for root component)
- Barrel file at `src/components/ui/index.ts` re-exports all UI primitives

**Barrel Files:**
- Used only for `src/components/ui/index.ts`
- All other modules are imported directly by path

## UI Component Patterns

**Primitive components:**
- All in `src/components/ui/` — `Button`, `Input`, `Select`, `Textarea`, `Card`
- Use `forwardRef` on all primitives with `.displayName` set
- Size prop is named `btnSize`/`inputSize`/`selectSize` (NOT `size` — conflicts with HTML attribute)
- Extend native HTML element attributes via TypeScript interface inheritance
- Omit conflicting native attributes: `Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>`

**Style constants:**
- Style variants extracted to `Record<Variant, string>` constants at module level:
  ```typescript
  export const variantStyles: Record<ButtonVariant, string> = { ... }
  ```
- Export style constants and class-generator functions for reuse across components

**Tailwind:**
- Slate-based dark theme (`bg-slate-800`, `bg-slate-900`, `text-slate-300`)
- Blue accent (`bg-blue-600`, `focus:ring-blue-500`)
- Rounded corners: `rounded-xl` (cards), `rounded-lg` (inputs/buttons), `rounded-2xl` (hero sections)
- Minimum touch targets: `min-h-[44px]` on interactive elements

## Platform Detection

Use `__IS_TAURI__` build-time constant (declared in `src/globals.d.ts`, injected by Vite):
```typescript
if (__IS_TAURI__) {
  // Desktop-only code
}
```
Never use `window.navigator` or other runtime detection for desktop vs. web.

## Feature Flags (New Badge System)

New features must be registered in `src/features.ts`:
```typescript
export const featureReleases: Record<string, Date> = {
  'feature-key': new Date('2026-01-24'),
};
```
Then use `<NewBadge feature="feature-key" />` from `src/components/NewBadge.tsx`.

---

*Convention analysis: 2026-04-13*
