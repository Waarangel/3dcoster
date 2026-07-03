# Phase 3: Calculator UI + Import - Research

**Researched:** 2026-04-15
**Domain:** React multi-row dynamic form, cost calculation refactor, G-code import pipeline, session storage migration
**Confidence:** HIGH — all findings are from direct codebase inspection of files that will be modified

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Form shows one filament row by default with FilamentSelector + grams input | CostCalculator currently has single `filamentId`/`filamentGrams` state — replace with `FilamentUsage[]` array state, render first row always |
| UI-02 | "+" button adds additional filament rows (max 16) | Pattern identical to existing `addMaterialUsage()` in CostCalculator; cap at 16 via disabled prop |
| UI-03 | Remove button on each row except the first | Conditional render: `index > 0` shows remove button — same as existing materials remove pattern |
| UI-04 | Each row has independent price/currency override | `FilamentSelector` already has `editedPrice`/`editedCurrency` props; each row needs its own pair stored in `FilamentUsage` state |
| UI-05 | At least one filament must be selected for validation to pass | Change validation in `handleSaveJob` from `!filamentId` to `filaments.every(f => !f.filamentId)` |
| COST-01 | Filament cost sums `grams * pricePerGram` across all filaments | Replace single `filamentCost` computation in `useMemo` costs with array reduce |
| COST-02 | Nozzle wear uses per-material density via exported `getMaterialDensity` | `getMaterialDensity` already exported from `gcodeParser.ts`; `FILAMENT_DENSITY` constant in CostCalculator is the only thing to replace |
| COST-03 | Price override persisted on saved job for historical accuracy | `FilamentUsage.pricePerGram` is already defined in `types.ts`; must be written into saved `PrintJob.filaments[]` |
| IMPORT-01 | GcodeImport passes filaments array (not single filamentId) to CostCalculator | `GcodeImport.onImport` callback type must be widened; CostCalculator's inline handler must replace single-field state setters |
| IMPORT-02 | Each imported filament is auto-matched independently against user's asset library | `findBestFilamentMatch()` already handles one filament; loop over `filamentTypes`/`filamentGramsPerExtruder` arrays |
| IMPORT-03 | Success toast shows all detected materials with weights | `successInfo` state in GcodeImport must be extended from single string fields to arrays |
| PERSIST-01 | Session storage persists multi-filament form state | `FORM_STORAGE_KEY` currently stores `filamentId`/`filamentGrams` scalars; replace with `filaments: FilamentUsage[]` |
| PERSIST-02 | Old session storage format (single filament) gracefully falls back to default | `getStoredValue('filaments', ...)` returns undefined for old format; `|| [defaultRow]` fallback handles it |
</phase_requirements>

---

## Summary

Phase 3 transforms the single-filament calculator into a multi-row form. All prerequisite infrastructure was completed in Phases 1–2: the `PrintJob.filaments: FilamentUsage[]` data model exists, the DB v5 migration is live, and `getMaterialDensity` / `findBestFilamentMatch` are exported from `gcodeParser.ts`. Phase 3 is purely a UI and wiring change — no new data model work, no new utilities.

The work splits into four parallel tracks: (1) replace the single-filament state in `CostCalculator` with a `FilamentUsage[]` array and render a dynamic row list, (2) update the `useMemo` cost calculation to sum across rows and use per-material density, (3) update `GcodeImport` to emit an array and show per-material success info, (4) migrate the session storage schema and write the backward-compat fallback.

**Primary recommendation:** Work file-by-file in dependency order: `GcodeImport.tsx` first (its output type change unblocks the CostCalculator wiring), then `CostCalculator.tsx` (biggest change — state, render, save), then session storage (falls out of the state change naturally).

---

## Standard Stack

### Core — already in use, no new dependencies needed

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 | ^18 | Dynamic list rendering with `useState`, `useMemo` | Already the app framework |
| TypeScript | current | Type-safe `FilamentUsage[]` state, prop contracts | Already enforced |
| Tailwind CSS | current | Styling filament rows consistent with existing card/row patterns | Already the design system |
| Dexie.js | current | IndexedDB — `PrintJob.filaments[]` already indexed at v5 | Already the persistence layer |

**No new npm packages are required for this phase.**

---

## Architecture Patterns

### Recommended State Shape in CostCalculator

Replace three scalar state variables:
```typescript
// BEFORE (remove these)
const [filamentId, setFilamentId] = useState(...)
const [filamentGrams, setFilamentGrams] = useState(...)
const [editedFilamentPrice, setEditedFilamentPrice] = useState(...)
const [editedFilamentCurrency, setEditedFilamentCurrency] = useState(...)
```

With one array:
```typescript
// AFTER — internal form state per row
interface FilamentRow {
  filamentId: string;
  grams: number;
  editedPrice: number;        // UI-only; written to pricePerGram on save
  editedCurrency: Currency;   // UI-only
}

const DEFAULT_ROW: FilamentRow = { filamentId: '', grams: 0, editedPrice: 0, editedCurrency: userCurrency };
const [filamentRows, setFilamentRows] = useState<FilamentRow[]>(() =>
  getStoredValue('filamentRows', [DEFAULT_ROW])
);
```

Note: `FilamentRow` is a local form-state type (not the `FilamentUsage` DB type). On save, map it to `FilamentUsage[]` by writing `editedPrice` into `pricePerGram`.

### Pattern 1: Add / Remove Row

```typescript
// Add row (max 16)
const addFilamentRow = () => {
  if (filamentRows.length >= 16) return;
  setFilamentRows(prev => [...prev, { ...DEFAULT_ROW }]);
};

// Remove row (never remove index 0)
const removeFilamentRow = (index: number) => {
  setFilamentRows(prev => prev.filter((_, i) => i !== index));
};

// Update a field on one row
const updateFilamentRow = (index: number, patch: Partial<FilamentRow>) => {
  setFilamentRows(prev => prev.map((row, i) => i === index ? { ...row, ...patch } : row));
};
```

### Pattern 2: Multi-Filament Cost Calculation

The existing `useMemo` cost block has a hardcoded `FILAMENT_DENSITY = 1.24` at line 27 and a single `filamentCost`. Replace:

```typescript
// BEFORE (single filament)
const volumeCm3 = filamentGrams / FILAMENT_DENSITY;
const filamentCost = filamentId && editedFilamentPrice > 0
  ? filamentGrams * editedFilamentPrice : 0;
const nozzleWear = selectedPrinter
  ? (volumeCm3 / selectedPrinter.nozzleLifespanCm3) * selectedPrinter.nozzleCost : 0;

// AFTER (multi-filament)
import { getMaterialDensity } from '../utils/gcodeParser';

const filamentCost = filamentRows.reduce((sum, row) => {
  if (!row.filamentId || row.editedPrice <= 0) return sum;
  return sum + row.grams * row.editedPrice;
}, 0);

const totalVolumeCm3 = filamentRows.reduce((sum, row) => {
  const asset = materials.find(m => m.id === row.filamentId);
  const density = getMaterialDensity(asset?.filamentType ?? null);
  return sum + row.grams / density;
}, 0);

const nozzleWear = selectedPrinter
  ? (totalVolumeCm3 / selectedPrinter.nozzleLifespanCm3) * selectedPrinter.nozzleCost : 0;
```

### Pattern 3: Save Job — map FilamentRow[] to FilamentUsage[]

```typescript
const filaments: FilamentUsage[] = filamentRows
  .filter(r => r.filamentId && r.grams > 0)
  .map(r => ({
    filamentId: r.filamentId,
    grams: r.grams,
    pricePerGram: r.editedPrice > 0 ? r.editedPrice : undefined,
    currency: r.editedPrice > 0 ? r.editedCurrency : undefined,
  }));
```

### Pattern 4: Restore Job for Editing

The existing `useEffect` for `editingJob` (line 135–159) references `editingJob.filamentId` and `editingJob.filamentGrams` — the old schema fields. After the DB v5 migration these are gone. Replace with:

```typescript
// Map FilamentUsage[] from DB back to FilamentRow[] for the form
const restoredRows: FilamentRow[] = (editingJob.filaments ?? []).map(fu => {
  const asset = materials.find(m => m.id === fu.filamentId);
  return {
    filamentId: fu.filamentId,
    grams: fu.grams,
    editedPrice: fu.pricePerGram ?? asset?.costPerUnit ?? 0,
    editedCurrency: fu.currency ?? asset?.currency ?? userCurrency,
  };
});
setFilamentRows(restoredRows.length > 0 ? restoredRows : [DEFAULT_ROW]);
```

### Pattern 5: GcodeImport onImport callback — widened type

```typescript
// BEFORE
onImport: (result: {
  filamentGrams: number;
  printTimeHours: number;
  filamentId?: string;
  printName?: string;
}) => void;

// AFTER
onImport: (result: {
  filaments: Array<{ filamentId?: string; grams: number }>;  // per-extruder matches
  printTimeHours: number;
  printName?: string;
}) => void;
```

In `GcodeImport.processFile`, build the filaments array by zipping `result.filamentTypes`, `result.filamentGramsPerExtruder`, and running `findBestFilamentMatch` per index:

```typescript
const filaments = result.filamentTypes.map((type, i) => ({
  filamentId: findBestFilamentMatch(
    type,
    result.filamentVendors[i] ?? null,
    assets,
    result.filamentSettingsIds[i] ?? null
  ) ?? undefined,
  grams: result.filamentGramsPerExtruder[i] ?? 0,
}));
```

### Pattern 6: Success Toast — multi-material list

Replace the single `type`/`matched`/`grams` fields in `successInfo` with an array:

```typescript
interface SuccessInfo {
  slicer: string;
  time: string;
  filaments: Array<{ type: string | null; matched: string | null; grams: number }>;
}
```

Render as a compact list:
```tsx
{successInfo.filaments.map((f, i) => (
  <span key={i} className="text-green-300">
    {f.grams.toFixed(1)}g {f.type ?? '?'}{f.matched ? ` → ${f.matched}` : ''}
  </span>
))}
```

### Pattern 7: Session Storage Migration

```typescript
// In getStoredValue, filamentRows replaces the old scalar keys
const [filamentRows, setFilamentRows] = useState<FilamentRow[]>(() => {
  try {
    const stored = sessionStorage.getItem(FORM_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // New format: has filamentRows array
      if (Array.isArray(parsed.filamentRows) && parsed.filamentRows.length > 0) {
        return parsed.filamentRows as FilamentRow[];
      }
      // Old format: has filamentId scalar — graceful fallback per PERSIST-02
    }
  } catch { /* ignore */ }
  return [DEFAULT_ROW];
});
```

The persistence `useEffect` must save `filamentRows` and omit the old `filamentId`/`filamentGrams`/`editedFilamentPrice`/`editedFilamentCurrency` keys.

### Anti-Patterns to Avoid

- **Do not keep `filamentId`, `filamentGrams`, `editedFilamentPrice`, `editedFilamentCurrency` as separate state variables alongside the new array.** This creates a dual-state sync bug — any save/restore path will miss one or the other.
- **Do not call `findBestFilamentMatch` inside the render loop** (UI component). The matching belongs in `GcodeImport.processFile` before calling `onImport`.
- **Do not remove the `clearForm` function's filament state reset.** It must also reset `filamentRows` to `[DEFAULT_ROW]`.
- **Do not use `filamentRows.length === 0` as a "no filament" check.** The array always has at least one row; validation checks whether `filamentRows[0].filamentId` is non-empty.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Material density per filament type | Custom density table | `getMaterialDensity()` from `gcodeParser.ts` | Already exported, covers all types including edge cases like PPA-CF, PPS |
| Filament type matching for import | String comparison | `findBestFilamentMatch()` from `gcodeParser.ts` | Handles vendor disambiguation, settings ID priority, fuzzy brand matching |
| FilamentSelector UI component | New custom dropdown | Existing `FilamentSelector` component | Already has brand/type two-level dropdown with editable price/currency |

---

## Common Pitfalls

### Pitfall 1: CostCalculator still references old `filamentId`/`filamentGrams` after data model change

**What goes wrong:** `handleSaveJob` at line ~498–545 writes `filamentId` and `filamentGrams` into the job object. After Phase 1 the `PrintJob` type no longer has these fields — TypeScript will error.

**Why it happens:** CostCalculator was never updated in Phases 1–2 (intentionally deferred to Phase 3).

**How to avoid:** When refactoring, search for all uses of `filamentId`, `filamentGrams`, `editedFilamentPrice`, `editedFilamentCurrency` as standalone state variables and replace in a single pass.

**Warning signs:** `tsc -b` errors referencing "Property 'filamentId' does not exist on type 'PrintJob'".

### Pitfall 2: editingJob restore reads old field names from DB

**What goes wrong:** The `useEffect` for `editingJob` (line 139–159) reads `editingJob.filamentId` and `editingJob.filamentGrams`. After DB v5 these are gone and will be `undefined`. The form will appear blank when editing.

**Why it happens:** The edit-restore path was not updated alongside the type change in Phase 1.

**How to avoid:** Replace the entire restore block with the Pattern 4 shown above before wiring the multi-row UI.

### Pitfall 3: Session storage migration leaves stale keys

**What goes wrong:** The old `filamentId`/`filamentGrams` keys persist in session storage from before Phase 3. The new `getStoredValue('filamentRows', ...)` call returns `undefined` (key not present), the fallback `[DEFAULT_ROW]` fires correctly — but the old keys linger and could confuse future reads.

**Why it happens:** `sessionStorage.setItem` merges into the same JSON object; old keys are not removed unless explicitly cleared or the key set changes.

**How to avoid:** The persistence `useEffect` must write a fresh object that only includes the new keys. Since `sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formState))` overwrites the entire blob, removing old keys from `formState` is sufficient — no extra cleanup needed.

### Pitfall 4: Success toast overflow for 4+ filament prints

**What goes wrong:** Bambu multi-color prints can have 4–5 filament entries. The current fixed-position toast renders everything inline. With 4 entries at "25.3g PETG HF → Bambu PETG" each, the toast overflows the viewport or wraps awkwardly.

**Why it happens:** Original toast was designed for one material.

**How to avoid:** Render filaments as a compact stacked list inside the toast with `max-h-32 overflow-y-auto` on the list container. Keep the toast `max-w-sm`.

### Pitfall 5: "+" button missing `type="button"` causes form submit

**What goes wrong:** If the "+" button lacks `type="button"`, clicking it may submit the form (if CostCalculator ever gains a `<form>` wrapper, or on some mobile browsers).

**Why it happens:** Default button type in a form context is `submit`.

**How to avoid:** All dynamic row add/remove buttons must have `type="button"`. The existing `addMaterialUsage` button pattern already does this correctly — follow that model.

### Pitfall 6: `DEFAULT_ROW` uses stale `userCurrency`

**What goes wrong:** `DEFAULT_ROW` is defined outside the component with `editedCurrency: 'USD'` hardcoded. When a user with CAD currency adds a new row, the currency defaults to USD.

**Why it happens:** Captured value at module load time.

**How to avoid:** Make `DEFAULT_ROW` a function: `const makeDefaultRow = (currency: Currency): FilamentRow => ({ ..., editedCurrency: currency })`. Call it in `addFilamentRow` and in the initial state factory.

---

## Code Examples

### Complete FilamentRow type (CostCalculator internal)

```typescript
// Internal to CostCalculator — not exported, not the DB FilamentUsage type
interface FilamentRow {
  filamentId: string;         // '' if not yet selected
  grams: number;              // 0 if not yet entered
  editedPrice: number;        // Price per gram for cost calc; 0 = use asset default
  editedCurrency: Currency;   // Currency for editedPrice
}
```

### Rendering a dynamic filament row list

```tsx
{filamentRows.map((row, index) => (
  <div key={index} className="flex items-start gap-3 bg-slate-700/30 p-3 rounded-lg">
    <div className="flex-1">
      <FilamentSelector
        materials={materials}
        selectedFilamentId={row.filamentId}
        onSelect={(filament) => updateFilamentRow(index, {
          filamentId: filament.id,
          editedPrice: filament.costPerUnit ?? 0,
          editedCurrency: filament.currency ?? userCurrency,
        })}
        editedPrice={row.editedPrice}
        editedCurrency={row.editedCurrency}
        onPriceChange={(price) => updateFilamentRow(index, { editedPrice: price })}
        onCurrencyChange={(currency) => updateFilamentRow(index, { editedCurrency: currency })}
        userCurrency={userCurrency}
      />
    </div>
    <div>
      <label className="block text-xs text-slate-400 mb-1">Grams</label>
      <input
        type="number"
        value={row.grams || ''}
        onChange={e => updateFilamentRow(index, { grams: parseFloat(e.target.value) || 0 })}
        className="w-24 bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
      />
    </div>
    {index > 0 && (
      <button
        type="button"
        onClick={() => removeFilamentRow(index)}
        className="mt-5 text-red-400 hover:text-red-300 p-1"
        aria-label="Remove filament row"
      >
        ✕
      </button>
    )}
  </div>
))}

<button
  type="button"
  onClick={addFilamentRow}
  disabled={filamentRows.length >= 16}
  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
>
  + Add Filament
</button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `filamentId` + `filamentGrams` scalars on `PrintJob` | `filaments: FilamentUsage[]` array | Phase 1 (complete) | DB v5 migration ran; old jobs now have `filaments[0]` |
| `filamentGrams / 1.24` hardcoded PLA density | `getMaterialDensity(type)` per filament | Phase 2 (exported); Phase 3 (wired into CostCalculator) | Nozzle wear now accurate for PETG/ABS/TPU etc. |
| Single-filament G-code import | Multi-filament array from `parseGcode()` | Phase 2 (complete) | `GcodeParseResult.filamentTypes[]` and `filamentGramsPerExtruder[]` are populated |

**CostCalculator.tsx has NOT been updated yet.** It still reads `filamentId`/`filamentGrams` state and writes them to the job on save. The TypeScript compiler catches this (lines 139, 500–530 reference old fields). Phase 3 resolves this entirely.

---

## Open Questions

1. **What happens to imported filament rows where `grams === 0` (GCODE-04 zero-fill)?**
   - What we know: When only total weight is available, `filamentGramsPerExtruder = [total, 0, 0, ...]`
   - What's unclear: Should GcodeImport skip zero-gram rows, or import them with 0g to signal "manual entry needed"?
   - Recommendation: Import all rows including zeros. The form user can see them and manually enter values. Filtering zeros silently loses filament count information.

2. **FilamentSelector behavior when `editedPrice === 0` after row restore**
   - What we know: `FilamentSelector` shows the price input only when `selectedFilament` is truthy. The price field is shown after selection.
   - What's unclear: On job restore, if `pricePerGram` was undefined in the saved `FilamentUsage`, editedPrice defaults to `asset.costPerUnit`. If the asset was deleted, `costPerUnit` will be undefined.
   - Recommendation: Default to `0` (not undefined/NaN) in the restore fallback. The existing single-filament code already does `filament.costPerUnit ?? 0`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found in project |
| Config file | None — Wave 0 gap |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | One row shows by default | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| UI-02 | "+" adds rows; stops at 16 | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| UI-03 | First row has no remove button; others do | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| UI-04 | Price/currency per row save independently | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| UI-05 | Save blocked if no filament selected | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| COST-01 | Filament cost = sum of (grams × price) | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| COST-02 | Nozzle wear uses PETG density 1.27 not 1.24 | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| COST-03 | pricePerGram stored on saved FilamentUsage | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| IMPORT-01 | GcodeImport emits filaments array | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| IMPORT-02 | Each imported filament matched independently | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| IMPORT-03 | Toast lists all materials with weights | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| PERSIST-01 | sessionStorage round-trips FilamentRow[] | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| PERSIST-02 | Old sessionStorage format falls back cleanly | unit | N/A — Wave 0 gap | ❌ Wave 0 |

### Wave 0 Gaps

The project has no test framework. Given the React + Vite + TypeScript stack, the standard is Vitest + React Testing Library.

- [ ] Install: `npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event`
- [ ] `vitest.config.ts` — configure jsdom environment
- [ ] `src/test/setup.ts` — RTL cleanup afterEach
- [ ] `src/utils/gcodeParser.test.ts` — exists implicitly from Phase 2; covers `getMaterialDensity`, `findBestFilamentMatch`
- [ ] `src/components/CostCalculator.test.tsx` — covers UI-01 through UI-05, COST-01 through COST-03, PERSIST-01 through PERSIST-02
- [ ] `src/components/GcodeImport.test.tsx` — covers IMPORT-01 through IMPORT-03

Given `mode: "yolo"` in config.json, the planner should treat test scaffolding as optional Wave 0 tasks rather than blockers. The TypeScript compiler (`tsc -b`) is the primary quality gate per project CLAUDE.md instructions.

---

## Sources

### Primary (HIGH confidence)

- Direct inspection of `/src/components/CostCalculator.tsx` — current state, line-by-line
- Direct inspection of `/src/components/GcodeImport.tsx` — current onImport shape and successInfo structure
- Direct inspection of `/src/components/FilamentSelector.tsx` — props interface; reusable as-is per row
- Direct inspection of `/src/utils/gcodeParser.ts` — `getMaterialDensity`, `findBestFilamentMatch`, `GcodeParseResult` array fields
- Direct inspection of `/src/types.ts` — `FilamentUsage`, `PrintJob.filaments[]`, `Currency`
- Direct inspection of `/src/db/database.ts` — v5 schema and migration; confirms `filamentId`/`filamentGrams` deleted from jobs

### Secondary (MEDIUM confidence)

- Project CLAUDE.md: confirms `tsc -b` (not `--noEmit`) for TypeScript verification; Vercel runs `tsc -b && vite build`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already in use
- Architecture: HIGH — derived directly from existing code patterns in the repo
- Pitfalls: HIGH — all pitfalls identified by reading the exact lines that will be modified
- Validation: MEDIUM — test framework gap is a known project-wide state, not phase-specific

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable codebase, no external APIs or rapidly-changing ecosystem)
