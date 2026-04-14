# Phase 2: G-code Parser - Research

**Researched:** 2026-04-14
**Domain:** TypeScript regex parsing — multi-material G-code header fields
**Confidence:** HIGH

## Summary

Phase 2 is a pure parser change with no UI surface. The existing `gcodeParser.ts` already handles single-material extraction; this phase extends the same file to capture the full semicolon-delimited arrays that Bambu Studio and PrusaSlicer-family slicers emit for multi-material prints. No new libraries are needed. The work is regex surgery on well-understood header formats.

The current parser silently discards extra extruder data by taking only `[0]` from split arrays (e.g., `filament_type = PETG;PLA;PLA` → returns `"PETG"` only). Phase 2 returns all elements as arrays on a new interface while preserving the existing scalar fields as first-element aliases for backward compatibility.

`getMaterialDensity` is already implemented as a private function. The only export change needed is adding `export` before its function keyword — it currently lives in scope and is used internally by `filamentLengthToGrams`.

**Primary recommendation:** Add a `filamentTypes[]`, `filamentVendors[]`, `filamentSettingsIds[]`, and `filamentGramsPerExtruder[]` to `GcodeParseResult`. Keep existing scalar fields as computed aliases (`filamentType = filamentTypes[0] ?? null`). Export `getMaterialDensity` as a named export. Parsers for each slicer family extend in parallel.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GCODE-01 | Parser extracts all filament types from semicolon-separated `filament_type` line | Split on `;`, trim each element, filter empty strings |
| GCODE-02 | Parser extracts per-extruder weight from `filament used [g]` semicolon-separated values | PrusaSlicer-family emits `; filament used [g] = 24.06;5.21;0.00`; parse all elements |
| GCODE-03 | Parser extracts all filament vendors and settings IDs (per-extruder arrays) | Same split pattern on `filament_vendor` and `filament_settings_id` lines |
| GCODE-04 | When only total weight available, first extruder gets total, rest get zero | Bambu header `total filament weight [g]` is a scalar — distribute with `[total, ...zeros]` based on type count |
| GCODE-05 | Backward-compatible single fields remain as first-element aliases | `filamentType = filamentTypes[0] ?? null`, etc. — existing call sites in GcodeImport.tsx unchanged |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.9.3 (installed) | Type-safe interface extension | Already used; all new fields need types |

### Supporting
None — no new dependencies. This is pure regex + TypeScript.

### Alternatives Considered
None applicable — the parser is a hand-written regex approach already established in the codebase. No external G-code parsing library is warranted for header-only metadata extraction.

**No installation required for Phase 2.**

---

## Architecture Patterns

### Existing File Structure (gcodeParser.ts)
```
gcodeParser.ts
├── GcodeParseResult interface          ← extend with array fields
├── detectSlicer()                      ← unchanged
├── parseTimeString()                   ← unchanged
├── filamentLengthToGrams()            ← unchanged
├── getMaterialDensity()               ← add export keyword only
├── parsePrusaStyle()                  ← extend for per-extruder arrays
├── parseBambuStyle()                  ← extend for per-extruder arrays + GCODE-04 logic
├── parseCuraStyle()                   ← extend (filament used single-value, keep as [value])
├── parseIdeaMakerStyle()              ← extend (single-value, keep as [value])
└── parseGcode()                       ← update final assembly + scalar alias logic
```

No new files. All changes are within `src/utils/gcodeParser.ts`.

### Pattern 1: Interface Extension with Array Fields + Scalar Aliases
**What:** Add array-typed fields to `GcodeParseResult`. Retain existing scalar fields as computed from `[0]` of the new arrays in `parseGcode()`.
**When to use:** Every time a slicer can emit multiple values for a single field.
**Example:**
```typescript
export interface GcodeParseResult {
  // --- existing scalar fields (backward-compatible aliases) ---
  filamentGrams: number | null;       // = filamentGramsPerExtruder[0] ?? null
  filamentType: string | null;        // = filamentTypes[0] ?? null
  filamentVendor: string | null;      // = filamentVendors[0] ?? null
  filamentSettingsId: string | null;  // = filamentSettingsIds[0] ?? null
  printTimeHours: number | null;
  slicer: 'bambu' | 'prusa' | 'cura' | 'orca' | 'superslicer' | 'ideamaker' | 'unknown';
  rawFilamentLength?: number | null;
  rawPrintTimeString?: string | null;

  // --- new array fields (GCODE-01 through GCODE-04) ---
  filamentTypes: string[];            // one entry per extruder
  filamentVendors: string[];          // one entry per extruder (may be shorter than filamentTypes)
  filamentSettingsIds: string[];      // one entry per extruder
  filamentGramsPerExtruder: number[]; // one entry per extruder; zeros where not available
}
```

### Pattern 2: Semicolon-Split Array Parsing
**What:** The G-code comment format uses `;` to delimit per-extruder values within a single comment line.
**When to use:** `filament_type`, `filament_vendor`, `filament_settings_id`, `filament used [g]`.
**Example:**
```typescript
// Input: '; filament_type = PETG;PLA;PLA'
// Input: '; filament used [g] = 24.06;5.21;0.00'

function parseSemicolonArray(value: string): string[] {
  return value
    .split(';')
    .map(s => s.trim().replace(/^"|"$/g, '')) // strip surrounding quotes
    .filter(s => s.length > 0);
}
```

Note: `filament_vendor` and `filament_settings_id` use quoted values in Bambu output:
- `'; filament_vendor = "Bambu Lab";"Bambu Lab"'`
- `'; filament_settings_id = "Bambu PETG HF @BBL H2S";"Bambu PLA Matte @BBL H2S"'`

The regex capture group must include the quoted form. Capture the full value after `=` and split on `";"` boundaries, or use a quoted-aware split.

### Pattern 3: GCODE-04 — Total-Only Weight Distribution
**What:** Bambu header (`HEADER_BLOCK`) emits `; total filament weight [g] : 433.16` as a scalar. When `filament used [g]` per-extruder is not available but `filamentTypes` has N entries, distribute as `[total, 0, 0, ..., 0]`.
**When to use:** Bambu slicer only; PrusaSlicer-family always emits per-extruder grams.
**Example:**
```typescript
// In final assembly within parseGcode():
if (parsed.filamentGramsPerExtruder.length === 0 && parsed.filamentGrams !== null) {
  const extruderCount = Math.max(1, parsed.filamentTypes.length);
  parsed.filamentGramsPerExtruder = [
    parsed.filamentGrams,
    ...Array(extruderCount - 1).fill(0),
  ];
}
```

### Pattern 4: Bambu Per-Extruder Grams — Config Block
Bambu Studio also writes per-extruder weights in the config block (after HEADER_BLOCK), in the same format as PrusaSlicer:
- `; filament used [g] = 24.06;5.21;0.00`

The existing `parsePrusaStyle` regex `;\s*filament used \[g\]\s*=\s*([\d.]+)` only captures the first number. For multi-material this regex must be updated to capture the full value after `=` (which may include semicolons and additional numbers).

### Pattern 5: Export `getMaterialDensity`
**What:** Add `export` keyword to the existing `getMaterialDensity` function. No logic changes.
**When to use:** COST-02 in Phase 3 requires this function for per-material nozzle wear calculation.
**Example:**
```typescript
// Before:
function getMaterialDensity(filamentType: string | null): number {

// After:
export function getMaterialDensity(filamentType: string | null): number {
```

### Anti-Patterns to Avoid
- **Replacing scalar fields:** Do NOT remove `filamentGrams`, `filamentType`, etc. from `GcodeParseResult`. They must remain as first-element aliases. `GcodeImport.tsx` and `CostCalculator.tsx` (once fixed in Phase 3) reference them directly.
- **Splitting on `;` without quote awareness:** `filament_settings_id` values contain spaces and special characters. Splitting `"Bambu PETG HF @BBL H2S";"Bambu PLA Matte @BBL H2S"` on raw `;` gives wrong results. Strip surrounding quotes after splitting.
- **Assuming extruder count from grams array alone:** Always derive extruder count from `filamentTypes.length` when available — it is the most reliably populated field across all slicers.
- **Mutating the `headerLines`/`footerLines` search window:** The existing 500-line header + 100-line footer window already covers Bambu's config block. Do not expand it — it handles multi-MB G-code files without loading the entire file.
- **Breaking PrusaSlicer single-material output:** Single-material files emit `; filament used [g] = 24.06` (one number, no semicolons). The updated regex must still capture this as `filamentGramsPerExtruder = [24.06]`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| G-code file parsing library | npm package for G-code | Existing regex approach | Phase 2 only needs header metadata; a full G-code AST parser would be massive overkill |
| Quoted-string CSV parser | `papaparse` for header lines | Simple quote-strip on split elements | The format is fixed and predictable; PapaParse (already installed) is designed for CSV files, not embedded comment fields |

**Key insight:** The header comment format is not true CSV — it uses `"value";"value"` with literal semicolons inside quotes. A simple `split(';').map(stripQuotes)` works reliably for all known slicer outputs because values never contain semicolons themselves.

---

## Common Pitfalls

### Pitfall 1: `filament used [g]` Regex Captures Only First Number
**What goes wrong:** The current regex `([\d.]+)` after `=` stops at whitespace/semicolons, so multi-material `24.06;5.21;0.00` returns only `24.06`.
**Why it happens:** The original regex was written for single-material files.
**How to avoid:** Change the capture group to `([\d.;]+)` or `(.+)` and then split the captured string on `;` to get individual values.
**Warning signs:** `filamentGramsPerExtruder.length === 1` on a known multi-material file.

### Pitfall 2: Bambu `filament_vendor` Regex Stops at First Quote
**What goes wrong:** Current regex `"?([^";,\n]+)"?` stops at the `"` that separates entries in `"Bambu Lab";"Bambu Lab"`.
**Why it happens:** The existing implementation intentionally captures only the first vendor.
**How to avoid:** Capture the full value after `=` on the line, then split. The new approach captures the full remainder and post-processes.

### Pitfall 3: Mismatch Between filamentTypes.length and filamentGramsPerExtruder.length
**What goes wrong:** `filament_type = PETG;PLA` (2 types) but `filament used [g] = 100.00` (1 gram value). Downstream code that zips arrays will misalign.
**Why it happens:** Bambu header provides total weight only; per-extruder grams may be absent.
**How to avoid:** Apply GCODE-04 logic in `parseGcode()` after all parsers run: if `filamentGramsPerExtruder.length < filamentTypes.length`, pad with zeros up to `filamentTypes.length`.

### Pitfall 4: Single-Material Backward Compatibility
**What goes wrong:** A single-material file gives `filamentGramsPerExtruder = []` after the refactor because the new multi-value regex fails to match a single number.
**Why it happens:** Capture regex change from `([\d.]+)` to `([\d.;]+)` still works for single numbers — but the post-split must always produce at least one element.
**How to avoid:** After splitting the captured value: `const values = captured.split(';').map(Number).filter(n => !isNaN(n))`. Verify this for single-number input.

### Pitfall 5: OrcaSlicer vs. Bambu Studio Detection
**What goes wrong:** OrcaSlicer uses PrusaSlicer-style config comments AND emits per-extruder grams. OrcaSlicer is already detected before Bambu (`detectSlicer` checks OrcaSlicer first). Verify that PrusaSlicer-path parser is updated to handle multi-material grams — `parsePrusaStyle` handles both PrusaSlicer, SuperSlicer, and OrcaSlicer.
**Why it happens:** OrcaSlicer is Bambu-derived but uses PrusaSlicer comment format for metadata.
**How to avoid:** Update `parsePrusaStyle` (not just `parseBambuStyle`) for multi-material array extraction — OrcaSlicer benefits automatically.

### Pitfall 6: TypeScript Strict Mode — New Required Fields
**What goes wrong:** Adding required array fields to `GcodeParseResult` makes all partial returns from `parsePrusaStyle`, `parseBambuStyle`, etc. invalid since they return `Partial<GcodeParseResult>`. Fields not yet set in partial parsers would be type errors on the final assembly if the type is strict.
**Why it happens:** New array fields (`filamentTypes: string[]`) are not optional — they should never be undefined, only empty `[]`.
**How to avoid:** The partial parsers already return `Partial<GcodeParseResult>`. In the final `parseGcode()` assembly, initialize all new array fields with `[]` defaults before merging partial results, then populate from parsed data. The arrays default to `[]` not `null`.

---

## Code Examples

Verified patterns from the existing codebase (`src/utils/gcodeParser.ts`):

### Updated `filament used [g]` Parsing (PrusaSlicer-family)
```typescript
// Current (single value):
const gramsMatch = text.match(/;\s*filament used \[g\]\s*=\s*([\d.]+)/);
if (gramsMatch) {
  result.filamentGrams = parseFloat(gramsMatch[1]);
}

// Updated (multi-value, backward-compatible):
const gramsMatch = text.match(/;\s*filament used \[g\]\s*=\s*([\d.;]+)/);
if (gramsMatch) {
  const values = gramsMatch[1]
    .split(';')
    .map(s => parseFloat(s.trim()))
    .filter(n => !isNaN(n) && n >= 0);
  result.filamentGramsPerExtruder = values;
  // Scalar alias preserved in parseGcode() assembly, not here
}
```

### Parsing `filament_type` Array (Bambu / PrusaSlicer config block)
```typescript
// Input: '; filament_type = PETG;PLA;PLA'
// Input: '; filament_type = PLA'  (single material)
const typeMatch = text.match(/;\s*filament_type\s*=\s*([^\n]+)/);
if (typeMatch) {
  result.filamentTypes = typeMatch[1]
    .trim()
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
```

### Parsing Quoted `filament_vendor` and `filament_settings_id` Arrays
```typescript
// Input: '; filament_vendor = "Bambu Lab";"Bambu Lab"'
// Input: '; filament_settings_id = "Bambu PETG HF @BBL H2S";"Bambu PLA Matte @BBL H2S"'

function parseQuotedArray(line: string): string[] {
  // Capture full value after '='
  const match = line.match(/=\s*(.+)/);
  if (!match) return [];
  const raw = match[1].trim();
  // Split on '","' boundary (quoted CSV style), then strip surrounding quotes
  return raw
    .split('";')
    .map(s => s.replace(/^"|"$/g, '').trim())
    .filter(s => s.length > 0);
}
```

### Final Assembly in `parseGcode()` — Array Defaults + Scalar Aliases
```typescript
// After all slicer-specific parsing:
const filamentTypes = parsed.filamentTypes ?? [];
const filamentVendors = parsed.filamentVendors ?? [];
const filamentSettingsIds = parsed.filamentSettingsIds ?? [];
let filamentGramsPerExtruder = parsed.filamentGramsPerExtruder ?? [];

// GCODE-04: If only total weight known, first extruder gets total
if (filamentGramsPerExtruder.length === 0 && filamentGrams !== null) {
  const count = Math.max(1, filamentTypes.length);
  filamentGramsPerExtruder = [filamentGrams, ...Array(count - 1).fill(0)];
}

// Pad if grams array shorter than type array (partial Bambu data)
if (filamentGramsPerExtruder.length < filamentTypes.length) {
  const deficit = filamentTypes.length - filamentGramsPerExtruder.length;
  filamentGramsPerExtruder = [...filamentGramsPerExtruder, ...Array(deficit).fill(0)];
}

return {
  // Scalar aliases (GCODE-05 backward compat)
  filamentGrams: filamentGramsPerExtruder[0] ?? filamentGrams,
  filamentType: filamentTypes[0] ?? null,
  filamentVendor: filamentVendors[0] ?? null,
  filamentSettingsId: filamentSettingsIds[0] ?? null,
  // Arrays (new)
  filamentTypes,
  filamentVendors,
  filamentSettingsIds,
  filamentGramsPerExtruder,
  // Unchanged
  printTimeHours: ...,
  slicer,
  rawFilamentLength: ...,
  rawPrintTimeString: ...,
};
```

### Exporting `getMaterialDensity`
```typescript
// Before (line 59 in gcodeParser.ts):
function getMaterialDensity(filamentType: string | null): number {

// After — only change is adding `export`:
export function getMaterialDensity(filamentType: string | null): number {
```

---

## Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/utils/gcodeParser.ts` | Add array fields to interface; update parsers; export `getMaterialDensity` | Medium — regex changes affect all slicer paths |
| `src/components/GcodeImport.tsx` | No changes required (scalar aliases preserved by GCODE-05) | None |
| `src/components/CostCalculator.tsx` | No changes required in Phase 2 (Phase 3 work) | None |

---

## Slicer-Specific Field Coverage

| Slicer | filamentTypes | filamentVendors | filamentSettingsIds | filamentGramsPerExtruder |
|--------|---------------|-----------------|---------------------|--------------------------|
| Bambu Studio | Config block: `filament_type = PETG;PLA` | Config block: `filament_vendor = "Bambu Lab";"..."` | Config block: `filament_settings_id = "...";"..."` | Config block: `filament used [g] = 24;5` OR GCODE-04 from header total |
| PrusaSlicer | Config block: `filament_type = PLA;PETG` | Config block: `filament_vendor = Prusament;...` | Config block: `filament_settings_id = ...` | Footer: `filament used [g] = 24.06;5.21` |
| OrcaSlicer | Config block: same as PrusaSlicer style | Same | Same | Same |
| SuperSlicer | Config block: same as PrusaSlicer style | Same | Likely present | Same |
| Cura | Not present in header | Not present | Not present | Single value in `Filament used: Xm` format |
| IdeaMaker | Not present (single only) | Not present | Not present | Single value via weight comment |

**Cura and IdeaMaker:** Single-material slicers in practice. Arrays will be length-1 (or 0 if absent). The existing single-value parsing logic produces `filamentGramsPerExtruder = [singleValue]` after the updated assembly.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `filament_type = PETG;PLA;PLA` → take `[0]` only ("PETG") | Split all → `["PETG", "PLA", "PLA"]` | All extruder types available for Phase 3 import matching |
| `filament used [g] = 24.06` single capture | Capture full `24.06;5.21;0.00` and split | Per-extruder weight available |
| `getMaterialDensity` private | `getMaterialDensity` exported | Nozzle wear per-material density usable in Phase 3 |

---

## Open Questions

1. **Does Bambu Studio also emit `filament used [g]` in the config block for multi-material?**
   - What we know: The parser already looks for `filament used [g] = ...` (PrusaSlicer style) when processing Bambu files via `parsePrusaStyle` call inside `parseBambuStyle`. Bambu Studio is derived from OrcaSlicer which is derived from PrusaSlicer — the config block format is shared.
   - What's unclear: Whether a real Bambu multi-material file includes per-extruder grams in the config block vs. only the header total.
   - Recommendation: Implement both paths (GCODE-04 as fallback) and document in SUMMARY. During Task verification (browser test), use an actual multi-material Bambu `.gcode` file to confirm which path triggers.

2. **`filament_vendor` parsing — how does PrusaSlicer format it?**
   - What we know: PrusaSlicer `filament_vendor` format is `filament_vendor = Prusament` (unquoted) for single, possibly `filament_vendor = Prusament;eSUN` for multi.
   - What's unclear: Whether PrusaSlicer wraps multi-material vendor in quotes like Bambu does.
   - Recommendation: The `parseQuotedArray` helper strips quotes if present and falls back gracefully if not. Handle both.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed (no vitest/jest in package.json) |
| Config file | None |
| Quick run command | `tsc -b` |
| Full suite command | `tsc -b && npm run lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GCODE-01 | `filamentTypes[]` contains all semicolon-separated types | Manual — drop a multi-material .gcode, inspect console/UI | `tsc -b` (type check only) | N/A |
| GCODE-02 | `filamentGramsPerExtruder[]` contains per-extruder weights | Manual — inspect parseGcode() return in DevTools | `tsc -b` | N/A |
| GCODE-03 | `filamentVendors[]` and `filamentSettingsIds[]` arrays populated | Manual | `tsc -b` | N/A |
| GCODE-04 | Single total → first extruder, rest zeros | Manual — drop Bambu file with only header weight | `tsc -b` | N/A |
| GCODE-05 | `filamentType`, `filamentGrams` scalar aliases unchanged | `tsc -b` catches type regressions on GcodeImport.tsx call site | `tsc -b` | N/A |

### Sampling Rate
- **Per task commit:** `tsc -b` — confirms no interface breaks
- **Per wave merge:** `tsc -b && npm run lint`
- **Phase gate:** `tsc -b` green + manual browser verification with a real multi-material .gcode file before `/gsd:verify-work`

### Wave 0 Gaps
None — no test framework installation needed. Manual verification with a real G-code file is the validation approach (consistent with Phase 1 pattern).

---

## Sources

### Primary (HIGH confidence)
- `src/utils/gcodeParser.ts` (read directly) — full source; current regex patterns, `getMaterialDensity` location, `GcodeParseResult` interface shape
- `src/components/GcodeImport.tsx` (read directly) — confirmed scalar field usage (`result.filamentGrams`, `result.filamentType`, etc.); no array field references today
- `src/types.ts` (read directly) — confirmed `FilamentUsage` now exists from Phase 1; `PrintJob.filaments[]` in place
- `package.json` (read directly) — confirmed no test framework; `tsc -b` is the build gate
- `.planning/config.json` (read directly) — `nyquist_validation: true`

### Secondary (MEDIUM confidence)
- `.planning/phases/01-data-foundation/01-01-SUMMARY.md` — confirmed Phase 1 delivered `FilamentUsage`, `PrintJob.filaments[]`, Dexie v5 migration; consumer errors in CostCalculator/JobsManager are expected Phase 3 work

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; pure TypeScript + regex
- Architecture: HIGH — read full source of gcodeParser.ts; patterns are direct extensions of existing regex lines
- Pitfalls: HIGH — directly observed from reading current parser code (e.g., `[0]` split truncation on line 188)

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack; slicer header formats don't change frequently)
