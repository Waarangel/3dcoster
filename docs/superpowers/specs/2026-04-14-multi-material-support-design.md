# Multi-Material Support

## Problem

A print job can use multiple filaments (e.g., PLA body + PETG supports, multi-color prints from AMS). Currently 3DCoster tracks a single `filamentId` and `filamentGrams` per job. The G-code parser detects multi-material data from Bambu Studio's semicolon-separated format but discards everything after the first material.

## Decisions

| Question | Answer |
|----------|--------|
| Cost tracking model | Per-filament weight (most accurate) |
| Manual entry UX | Single row by default, "+" to add more |
| G-code import matching | Auto-match each filament independently, form is the review step |
| Missing per-filament weight | Total weight on first filament, zeros for rest |
| Data model approach | Replace `filamentId`/`filamentGrams` with `filaments[]` array (clean migration) |
| Max filament rows | 16 (matches Bambu AMS Hub max) |

## Data Model

### New type: `FilamentUsage`

```typescript
// src/types.ts
interface FilamentUsage {
  filamentId: string;       // References Asset (category: 'filament')
  grams: number;
  pricePerGram?: number;    // User-editable override (like current editedFilamentPrice)
  currency?: Currency;      // Currency for the price override
}
```

**Note on `pricePerGram`:** This is a new persistence behavior. Currently `editedFilamentPrice` lives only in form state and is re-derived from the asset library when editing a job. With multi-material, we persist `pricePerGram` on each `FilamentUsage` entry inside the saved `PrintJob`. This ensures the historical cost is preserved even if asset prices change later.

When `pricePerGram` is `undefined` (e.g., migrated jobs), the form falls back to looking up `costPerUnit` from the matched Asset in the library.

### PrintJob changes

```typescript
// Before:
interface PrintJob {
  filamentId: string;
  filamentGrams: number;
  // ...
}

// After:
interface PrintJob {
  filaments: FilamentUsage[];
  // filamentId and filamentGrams REMOVED
  // ...
}
```

### CostBreakdown

No structural change. `filament: number` remains a single total, calculated as `sum(f.grams * f.pricePerGram)` across all filaments.

### Database migration (version 5)

```typescript
db.version(5).stores({
  // Same indexes - filaments[] is not indexed
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
}).upgrade(tx => {
  return tx.table('jobs').toCollection().modify(job => {
    // Handle all cases: filamentId could be undefined, empty string, or valid ID
    const hasFilament = job.filamentId && job.filamentId.trim() !== '';
    if (hasFilament) {
      job.filaments = [{
        filamentId: job.filamentId,
        grams: job.filamentGrams || 0,
        // pricePerGram intentionally omitted — form will fall back to asset library price
      }];
    } else {
      // Job with no filament selected (e.g., partially filled form that got saved)
      job.filaments = [];
    }
    delete job.filamentId;
    delete job.filamentGrams;
  });
});
```

## G-code Parser Changes

### `GcodeParseResult` additions

```typescript
// src/utils/gcodeParser.ts
interface GcodeParseResult {
  // Existing single fields kept for backward compat (= first element of arrays)
  filamentGrams: number | null;
  filamentType: string | null;
  filamentVendor: string | null;
  filamentSettingsId: string | null;

  // NEW: per-extruder arrays
  filamentTypes: string[];           // e.g., ['PETG', 'PLA', 'PLA']
  filamentVendors: string[];         // e.g., ['Bambu Lab', 'Bambu Lab']
  filamentSettingsIds: string[];     // e.g., ['Bambu PETG HF @BBL H2S', 'Bambu PLA Matte @BBL H2S']
  filamentGramsPerExtruder: number[];// e.g., [200, 50, 30] — per-filament weight

  // Existing fields unchanged
  printTimeHours: number | null;
  slicer: string;
  rawFilamentLength?: number | null;
  rawPrintTimeString?: string | null;
}
```

### Parsing logic

#### Array parsing responsibility

`parsePrusaStyle()` is the base parser — it handles the array splitting for all PrusaSlicer-derived formats. Both Bambu Studio and OrcaSlicer use this same comment format for multi-material. The function's regex for `filament_type` changes from `([^\n;]+)` to `([^\n]+)` to capture the full semicolon-separated string, then splits into the arrays.

`parseBambuStyle()` calls `parsePrusaStyle()` first (existing behavior), then supplements with Bambu-specific header fields (total weight, total time) that don't exist in PrusaSlicer format.

#### Per-extruder weight sources

Two different G-code lines provide filament weight, and they work differently:

1. **PrusaSlicer config block:** `; filament used [g] = 200.5;50.2;30.1` — semicolon-separated per-extruder values. This is the primary source for per-extruder breakdown.

2. **Bambu header block:** `; total filament weight [g] : 433.16` — single total only. Used as fallback when the config block value is missing.

Parser priority:
- If `filament used [g]` has semicolons → split into `filamentGramsPerExtruder[]`, sum for `filamentGrams`
- If only `total filament weight [g]` → put total in `filamentGramsPerExtruder[0]`, zeros for rest
- If only length data → convert to grams per-extruder using per-material density via `getMaterialDensity()`

#### Changes to `parsePrusaStyle()`

```typescript
// filament_type: capture full line including semicolons
const typeMatch = text.match(/;\s*filament_type\s*=\s*([^\n]+)/);
if (typeMatch) {
  const types = typeMatch[1].trim().split(';').map(t => t.trim()).filter(Boolean);
  result.filamentTypes = types;
  result.filamentType = types[0]; // backward compat
}

// filament used [g]: split on semicolons for per-extruder
const gramsMatch = text.match(/;\s*filament used \[g\]\s*=\s*([^\n]+)/);
if (gramsMatch) {
  const values = gramsMatch[1].trim().split(';').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
  result.filamentGramsPerExtruder = values;
  result.filamentGrams = values.reduce((sum, v) => sum + v, 0);
}

// filament_vendor: split on semicolons, strip quotes
// filament_settings_id: split on ";" delimiter
```

### `findBestFilamentMatch` changes

New function:
```typescript
function findBestFilamentMatches(
  types: string[],
  vendors: string[],
  assets: Asset[],
  settingsIds: string[]
): (string | null)[]
```

Calls existing `findBestFilamentMatch` for each extruder index. Original function unchanged.

## UI Changes

### CostCalculator form

**State changes:**
```typescript
// Before:
const [filamentId, setFilamentId] = useState('');
const [filamentGrams, setFilamentGrams] = useState(0);
const [editedFilamentPrice, setEditedFilamentPrice] = useState(0);
const [editedFilamentCurrency, setEditedFilamentCurrency] = useState<Currency>('USD');

// After:
const [filaments, setFilaments] = useState<FilamentUsage[]>([
  { filamentId: '', grams: 0 }
]);
```

Each `FilamentUsage` entry in state carries `pricePerGram` and `currency` so the user can override per-row. When `pricePerGram` is undefined, the form derives it from the asset library (same as current behavior for the first load).

**Form layout:**
- Each filament row contains: FilamentSelector + grams input + remove button
- First row has no remove button (at least one filament required)
- "+" button below the filament rows to add another (max 16 rows)
- Compact row layout to avoid the form growing too tall

**Cost calculation:**
```typescript
const filamentCost = filaments.reduce((total, f) => {
  const price = f.pricePerGram ?? 0;
  return total + f.grams * price;
}, 0);
```

**Nozzle wear calculation** — per-filament volume using correct density:
```typescript
// Use per-filament density instead of hardcoded PLA density
const totalVolumeCm3 = filaments.reduce((sum, f) => {
  const filament = materials.find(m => m.id === f.filamentId);
  const density = filament?.filamentType
    ? getMaterialDensity(filament.filamentType)
    : FILAMENT_DENSITY; // fallback to PLA
  return sum + f.grams / density;
}, 0);
```

Note: `getMaterialDensity` already exists in `gcodeParser.ts` and will be exported for use here. This also fixes a pre-existing bug where the current single-filament code assumes PLA density for all materials.

**Validation:**
- At least one filament must be selected (first row's `filamentId` required)
- Additional rows with empty filamentId are ignored/stripped on save

### FilamentSelector

No code changes needed. The component is already designed with per-instance props (`editedPrice`, `editedCurrency`, `onPriceChange`, `onCurrencyChange`). Each filament row instantiates its own `FilamentSelector` with independent props — the existing interface is sufficient.

### GcodeImport

`onImport` callback signature changes:
```typescript
// Before:
onImport: (result: {
  filamentGrams: number;
  printTimeHours: number;
  filamentId?: string;
  printName?: string;
}) => void;

// After:
onImport: (result: {
  filaments: { filamentId?: string; grams: number; pricePerGram?: number; currency?: Currency }[];
  printTimeHours: number;
  printName?: string;
}) => void;
```

Import handler in CostCalculator populates the `filaments` state array from the parsed result. Each matched filament gets its `pricePerGram`/`currency` from the asset library lookup.

**Success toast** updates to show all detected materials (e.g., "PETG 200g + PLA 50g + PLA 30g").

### JobsManager

Display changes from single filament to listing all:
```
// Before:
"Bambu PETG HF | 250g | 8h"

// After (multi):
"Bambu PETG HF 200g + Bambu PLA Matte 50g | 8h"

// After (single, unchanged feel):
"Bambu PETG HF 250g | 8h"
```

Deleted filament assets referenced by a `FilamentUsage` show as "Unknown" (same as current behavior, just potentially multiple unknowns).

### Session storage

Form persistence shape changes. The `filaments` array replaces `filamentId`, `filamentGrams`, `editedFilamentPrice`, `editedFilamentCurrency`.

**Backward compatibility:** If old-format session storage exists (has `filamentId` but no `filaments`), the `getStoredValue('filaments', ...)` call returns the default `[{ filamentId: '', grams: 0 }]`. The old keys are harmlessly ignored. Session storage is ephemeral so no migration needed.

### Editing existing jobs

When loading a job for editing, `job.filaments` array populates the filament rows. If `pricePerGram` is set on a `FilamentUsage`, use it. If undefined (migrated jobs), fall back to `costPerUnit` from the asset library.

## Files to modify

| File | Change |
|------|--------|
| `src/types.ts` | Add `FilamentUsage`, update `PrintJob` |
| `src/db/database.ts` | Add version 5 migration |
| `src/utils/gcodeParser.ts` | Parse multi-material arrays, export `getMaterialDensity`, new `findBestFilamentMatches` |
| `src/components/CostCalculator.tsx` | Multi-filament state, form rows, cost calc, save/edit, nozzle wear fix |
| `src/components/GcodeImport.tsx` | Update `onImport` signature, success toast |
| `src/components/FilamentSelector.tsx` | No changes (reused per row, existing props sufficient) |
| `src/components/JobsManager.tsx` | Display multi-filament info |
| `src/App.tsx` | Type updates for `PrintJob` shape change (passed through props/callbacks) |

## What stays the same

- `FilamentSelector` component (unchanged, instantiated once per row)
- Post-processing `materialsUsed[]` (separate concern)
- All pricing, shipping, marketplace logic
- Asset library / default materials
- Export/import JSON (will naturally include new shape)
- `onSaveJob` callback signature (takes `PrintJob` which changes shape, but the callback itself doesn't need structural changes — it just passes through)

## Known limitations

- Nozzle wear density fix only applies when a filament asset is selected. If no asset is matched, falls back to PLA density.
- No per-filament cost detail in `CostBreakdown` — the `filament` field remains a single total. Per-filament breakdown could be added later if users want it in the cost summary display.

## Testing

- Manual: create single-filament job, verify identical behavior to current
- Manual: create multi-filament job, verify per-filament costs sum correctly
- Manual: import multi-material Bambu G-code, verify all filaments detected and matched
- Manual: import single-material G-code, verify no regression
- Manual: edit existing job (migrated from old schema), verify filaments array populated correctly with price fallback to asset library
- Manual: verify session storage persistence with multi-filament state
- Manual: verify nozzle wear calculates correctly with mixed-density materials
- Manual: verify "+" button caps at 16 filament rows
