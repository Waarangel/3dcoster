# Phase 6: 3MF Multi-Plate Project Import - Research

**Researched:** 2026-04-15
**Domain:** Browser ZIP parsing, Bambu/OrcaSlicer 3MF file format, React file drop integration
**Confidence:** HIGH (codebase), MEDIUM (3MF XML schema — verified via source reading, not live docs)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| 3MF-01 | Parse sliced Bambu/Orca 3MF files (ZIP with slice_info.config) to extract per-plate filament and time data | JSZip + DOMParser pattern; slice_info.config XML schema documented below |
| 3MF-02 | Sum filament usage and print time across all plates, populate calculator with project totals | onImport callback already accepts filaments[] + printTimeHours; same interface used by gcode import |
| 3MF-03 | Detect non-sliced 3MF files and show helpful error explaining slicing is required | Presence/absence of Metadata/slice_info.config is the reliable detection signal |
| 3MF-04 | Display plate count so user knows it's a multi-plate project | Plate count comes from counting `<plate>` elements in slice_info.config; surface in success toast |
</phase_requirements>

---

## Summary

A sliced Bambu Studio / OrcaSlicer 3MF file is a ZIP archive. The slice-specific data lives in `Metadata/slice_info.config` — an XML document with one `<plate>` element per build plate. Each plate element records filament usage per extruder slot, print time, and the filament type/color. Non-sliced 3MF files (geometry-only exports, PrusaSlicer projects) do NOT contain this file, which gives a clean detection path for 3MF-03.

The existing `GcodeImport.tsx` already accepts `.gcode` files and calls `onImport({ filaments, printTimeHours, printName })` on `CostCalculator`. The 3MF import reuses this exact same callback shape. The simplest integration is to expand the drop zone in `GcodeImport.tsx` to also accept `.3mf` files (or create a parallel `ThreeMfImport.tsx` and place it alongside the gcode drop zone). Either way, no change to `CostCalculator`'s `onImport` handler is needed.

The only new dependency is JSZip for in-browser ZIP extraction. The browser's native `DOMParser` handles the XML. No WASM, no server round-trip, no large dependencies.

**Primary recommendation:** Create `src/utils/threeMfParser.ts` for pure parsing logic (mirrors `gcodeParser.ts` pattern), then extend `GcodeImport.tsx` to accept `.3mf` and dispatch to the new parser. This keeps all import logic in one visible component and minimises diff.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jszip | ^3.10.1 | Unzip .3mf (ZIP) in the browser | Only production-ready browser ZIP library; no WASM; tree-shakeable; used by Bambu Connect and slicer tooling |
| DOMParser (built-in) | Browser API | Parse XML string from slice_info.config | Zero-dependency; already available in every modern browser; used for gcode comment parsing elsewhere in the codebase |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none beyond jszip) | — | — | — |

**Installation:**
```bash
npm install jszip
npm install --save-dev @types/jszip
```

**Bundle impact:** JSZip minified + gzipped is approximately 25 KB. Acceptable for a file-import utility on a single page.

---

## 3MF File Format — What Matters

### Archive structure (sliced Bambu/Orca 3MF)
```
project.3mf (ZIP)
├── 3D/
│   └── 3dmodel.model          # Geometry — NOT needed for cost
├── Metadata/
│   ├── slice_info.config      # KEY FILE — per-plate cost data
│   ├── plate_1.gcode          # Per-plate gcode (large, skip)
│   ├── plate_2.gcode          # …
│   └── model_settings.config  # Print settings — optional fallback
└── [Content_Types].xml
```

### slice_info.config XML schema (Bambu Studio / OrcaSlicer)

The file is XML. The root element is `<config>`. Each build plate is a `<plate>` child. Each plate has one or more `<filament>` children.

```xml
<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="3600"/>      <!-- print time in seconds -->
    <metadata key="weight" value="45.32"/>          <!-- total plate weight (grams) — may be absent -->
    <filament id="1" type="PLA" color="#FFFFFF" used_m="12.34" used_g="36.12"/>
    <filament id="2" type="PETG" color="#000000" used_m="3.21" used_g="9.20"/>
  </plate>
  <plate>
    <metadata key="index" value="2"/>
    <metadata key="prediction" value="1800"/>
    <filament id="1" type="PLA" color="#FFFFFF" used_m="5.11" used_g="15.01"/>
  </plate>
</config>
```

**Key attribute names (confidence: MEDIUM — sourced from reading OrcaSlicer community posts and Bambu Studio GitHub issues; cannot be verified live):**

| Attribute | Element | Notes |
|-----------|---------|-------|
| `key="index"` | `<metadata>` inside `<plate>` | 1-based plate number |
| `key="prediction"` | `<metadata>` inside `<plate>` | print time in **seconds** |
| `key="weight"` | `<metadata>` inside `<plate>` | total weight in grams (may be absent in older exports) |
| `id` | `<filament>` | extruder/AMS slot number (1-based) |
| `type` | `<filament>` | filament type string e.g. "PLA", "PETG HF" |
| `color` | `<filament>` | hex color — not needed for cost |
| `used_m` | `<filament>` | length in metres |
| `used_g` | `<filament>` | weight in **grams** — use this directly |

**Parsing strategy:**
- Sum `used_g` across all `<filament>` elements across all `<plate>` elements, grouped by `type` (or by `id` slot for per-filament rows matching the existing multi-filament model).
- Sum `prediction` (seconds) across all plates; divide by 3600 for hours.
- `used_g` is the authoritative weight value. Fall back to `used_m` → grams conversion (using `getMaterialDensity` from `gcodeParser.ts`) only if `used_g` is absent or zero.

### Non-sliced 3MF detection

A non-sliced 3MF will NOT have `Metadata/slice_info.config` in the ZIP. If JSZip's `file('Metadata/slice_info.config')` returns `null`, show the error:

> "This 3MF file hasn't been sliced yet. Open it in Bambu Studio or OrcaSlicer, slice it, then export the sliced 3MF."

---

## Architecture Patterns

### Recommended new files
```
src/
├── utils/
│   ├── gcodeParser.ts          # (existing) unchanged
│   └── threeMfParser.ts        # NEW — pure parse logic, returns ThreeMfParseResult
├── components/
│   └── GcodeImport.tsx         # MODIFIED — also accepts .3mf, dispatches to threeMfParser
```

### Pattern 1: Parallel parser utility (mirrors gcodeParser.ts)
**What:** `threeMfParser.ts` exports a single async function `parseThreeMf(file: File)` that returns a typed result including per-plate data and project totals.
**When to use:** Keeps parsing logic unit-testable and separated from UI concerns.

```typescript
// src/utils/threeMfParser.ts
import JSZip from 'jszip';

export interface ThreeMfPlate {
  index: number;
  printTimeSeconds: number;
  filaments: Array<{ slot: number; type: string; grams: number }>;
}

export interface ThreeMfParseResult {
  plates: ThreeMfPlate[];
  // Aggregated project totals (what onImport needs)
  totalPrintTimeHours: number;
  filamentsByType: Array<{ type: string; grams: number }>;
  plateCount: number;
  isSliced: boolean; // false if slice_info.config absent
}

export async function parseThreeMf(file: File): Promise<ThreeMfParseResult> {
  const zip = await JSZip.loadAsync(file);
  const sliceInfoFile = zip.file('Metadata/slice_info.config');

  if (!sliceInfoFile) {
    return { plates: [], totalPrintTimeHours: 0, filamentsByType: [], plateCount: 0, isSliced: false };
  }

  const xmlText = await sliceInfoFile.async('text');
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');

  const plates: ThreeMfPlate[] = [];
  const platEls = doc.querySelectorAll('plate');

  for (const plateEl of platEls) {
    const indexMeta = plateEl.querySelector('metadata[key="index"]');
    const timeMeta  = plateEl.querySelector('metadata[key="prediction"]');
    const index = indexMeta ? parseInt(indexMeta.getAttribute('value') ?? '0') : 0;
    const timeSeconds = timeMeta ? parseFloat(timeMeta.getAttribute('value') ?? '0') : 0;

    const filaments: ThreeMfPlate['filaments'] = [];
    for (const filEl of plateEl.querySelectorAll('filament')) {
      const slot  = parseInt(filEl.getAttribute('id') ?? '0');
      const type  = filEl.getAttribute('type') ?? 'Unknown';
      const gramsAttr = filEl.getAttribute('used_g');
      const mAttr     = filEl.getAttribute('used_m');
      let grams = gramsAttr ? parseFloat(gramsAttr) : 0;
      if (grams === 0 && mAttr) {
        // Fallback: metres → grams
        const { getMaterialDensity } = await import('./gcodeParser');
        const density = getMaterialDensity(type);
        grams = parseFloat(mAttr) * 1000 * Math.PI * (1.75 / 2 / 10) ** 2 * density;
      }
      if (grams > 0) filaments.push({ slot, type, grams });
    }

    plates.push({ index, printTimeSeconds: timeSeconds, filaments });
  }

  // Aggregate by type across all plates
  const typeMap = new Map<string, number>();
  for (const plate of plates) {
    for (const f of plate.filaments) {
      typeMap.set(f.type, (typeMap.get(f.type) ?? 0) + f.grams);
    }
  }
  const filamentsByType = Array.from(typeMap.entries()).map(([type, grams]) => ({ type, grams }));
  const totalPrintTimeHours = plates.reduce((s, p) => s + p.printTimeSeconds, 0) / 3600;

  return {
    plates,
    totalPrintTimeHours: Math.round(totalPrintTimeHours * 100) / 100,
    filamentsByType,
    plateCount: plates.length,
    isSliced: true,
  };
}
```

### Pattern 2: Extend GcodeImport to handle .3mf
**What:** Add `.3mf` to the file input `accept`, add a branch in `processFile` that routes `.3mf` files to `parseThreeMf`. The `onImport` callback shape is unchanged — 3MF data is mapped to the same `{ filaments, printTimeHours, printName }` structure.
**When to use:** Keeps the single drop zone UX, avoids a second drag target on the calculator form.

```typescript
// In GcodeImport.tsx processFile, add at top:
if (file.name.toLowerCase().endsWith('.3mf')) {
  await processThreeMfFile(file); // new branch
  return;
}

// New processThreeMfFile:
const processThreeMfFile = useCallback(async (file: File) => {
  setIsParsing(true);
  setError(null);
  setSuccessInfo(null);
  try {
    const result = await parseThreeMf(file);
    if (!result.isSliced) {
      setError("This 3MF hasn't been sliced yet. Open it in Bambu Studio or OrcaSlicer, slice it, then export the sliced 3MF.");
      return;
    }
    if (result.plateCount === 0 || result.filamentsByType.length === 0) {
      setError('Could not extract print data from this 3MF. The file may be empty or in an unsupported format.');
      return;
    }

    const filaments = result.filamentsByType.map(f => ({
      filamentId: findBestFilamentMatch(f.type, null, assets, null) ?? undefined,
      grams: f.grams,
    }));

    onImport({ filaments, printTimeHours: result.totalPrintTimeHours });

    setSuccessInfo({
      slicer: `3MF — ${result.plateCount} plate${result.plateCount !== 1 ? 's' : ''}`,
      time: `${result.totalPrintTimeHours.toFixed(2)}h`,
      filaments: filaments.map((f, i) => ({
        type: result.filamentsByType[i]?.type ?? null,
        matched: f.filamentId ? (assets.find(a => a.id === f.filamentId)?.name ?? null) : null,
        grams: f.grams,
      })),
    });
  } catch (err) {
    setError(err instanceof Error ? `Failed to parse 3MF: ${err.message}` : 'Failed to parse 3MF file');
  } finally {
    setIsParsing(false);
  }
}, [assets, onImport]);
```

### Anti-Patterns to Avoid

- **Reading plate gcode files for data:** `Metadata/plate_1.gcode` is large (multi-MB). `slice_info.config` has everything needed at the project level. Never open gcode files from the 3MF archive.
- **Using a backend or WASM decompressor:** JSZip runs entirely in the browser, matching the app's no-backend architecture.
- **Aggregating by slot ID instead of type:** Slot 1 may be used across multiple plates but always be the same filament. Aggregating by `type` is safe. Aggregating by slot is also valid and preserves the multi-filament row structure — prefer slot-based aggregation to match the FilamentRow model (one row per material type).
- **Blocking the main thread:** JSZip.loadAsync is async. Always `await` and never use the synchronous `JSZip()` constructor path for file loading.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unzip .3mf in browser | Custom ZIP reader | JSZip | ZIP spec has edge cases (data descriptors, encoding, compression variants); JSZip handles all of them |
| XML parse of slice_info.config | Manual string regex | `DOMParser` (native) | Already used in browser context; handles encoding, CDATA, namespace edge cases |
| Length-to-grams fallback | New density table | `getMaterialDensity` from `gcodeParser.ts` | Already exported, already tested by existing gcode import; reuse it |

**Key insight:** The entire parser is ~80 lines using platform APIs. Any custom ZIP or XML implementation would be hundreds of lines with known edge cases.

---

## Common Pitfalls

### Pitfall 1: `used_g` absent in older Bambu/Orca exports
**What goes wrong:** Some Bambu Studio versions (pre-1.8) may not write `used_g` but do write `used_m` (metres). Parser returns 0 grams.
**Why it happens:** The attribute was added in a later slicer version.
**How to avoid:** Check `used_g` first; fall back to `used_m` → grams conversion using `getMaterialDensity`.
**Warning signs:** All filament weights come out as zero with valid plate time data.

### Pitfall 2: `prediction` is seconds, not minutes or hours
**What goes wrong:** Print time is massively overstated (displayed as "360h" instead of "6h").
**Why it happens:** `prediction` stores seconds. A 6-hour print is `21600`.
**How to avoid:** Always divide by 3600, never 60.

### Pitfall 3: Filament rows have zero grams for unused AMS slots
**What goes wrong:** Bambu AMS has 4 slots; only 2 may be used. `slice_info.config` may list 4 filament entries with `used_g="0"` for the unused slots.
**Why it happens:** Slicer records all configured slots, not just used ones.
**How to avoid:** Filter out filament entries where `grams === 0` before passing to `onImport`.

### Pitfall 4: Multiple plates × same filament type creates duplicate rows
**What goes wrong:** Plate 1 uses PLA 40g, plate 2 uses PLA 30g. Without aggregation, two PLA rows appear (each partial).
**Why it happens:** Not merging across plates before calling onImport.
**How to avoid:** Aggregate by filament type (or by slot ID) across all plates before building the filaments array.

### Pitfall 5: TypeScript import of JSZip with Vite ESM
**What goes wrong:** `import JSZip from 'jszip'` fails to resolve types or bundles incorrectly.
**Why it happens:** JSZip ships CJS; Vite handles this via pre-bundling but `@types/jszip` must be installed.
**How to avoid:** `npm install jszip @types/jszip`. Use default import. Vite will pre-bundle correctly.

### Pitfall 6: `DOMParser` querySelector on XML with namespace
**What goes wrong:** `doc.querySelectorAll('plate')` returns empty on some exports that include XML namespace declarations.
**Why it happens:** Namespaced XML elements require namespace-aware selectors.
**How to avoid:** If `slice_info.config` uses namespaces (unlikely for Bambu — it doesn't), use `getElementsByTagName('plate')` as a fallback. For Bambu/Orca exports, querySelector works correctly.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parse per-plate gcode files | Parse slice_info.config XML | Bambu Studio ~1.5 | 100x smaller reads; all metadata in one file |
| WASM zip library | JSZip (pure JS) | JSZip 3.x stable | No WASM setup; works in all browsers including Safari |

---

## Integration Checklist for the Planner

The following concrete changes are needed. No changes to `CostCalculator.tsx` or the `onImport` callback type are required.

1. **Install JSZip** — `npm install jszip && npm install --save-dev @types/jszip`
2. **Create `src/utils/threeMfParser.ts`** — exports `parseThreeMf(file: File): Promise<ThreeMfParseResult>`
3. **Modify `GcodeImport.tsx`** — add `.3mf` to accept attribute, add branch in `processFile`, update drop zone label text and supported formats note
4. **Add feature to `features.ts`** — `'3mf-import': new Date('...')` with today's date
5. **Add NewBadge** — inline on the drop zone label alongside the existing gcode badge
6. **Success toast** — reuse `SuccessInfo` shape; set `slicer` to `"3MF — N plates"` for plate count display (satisfies 3MF-04)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed — no vitest/jest config in project |
| Config file | None — Wave 0 gap |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 3MF-01 | parseThreeMf extracts per-plate filaments + time from valid ZIP | unit | `vitest run src/utils/threeMfParser.test.ts` | Wave 0 gap |
| 3MF-02 | filamentsByType sums correctly across 2 plates; printTimeHours = sum/3600 | unit | `vitest run src/utils/threeMfParser.test.ts` | Wave 0 gap |
| 3MF-03 | parseThreeMf returns isSliced=false when slice_info.config absent | unit | `vitest run src/utils/threeMfParser.test.ts` | Wave 0 gap |
| 3MF-04 | plateCount equals number of `<plate>` elements | unit | `vitest run src/utils/threeMfParser.test.ts` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `vitest run src/utils/threeMfParser.test.ts` (once framework installed)
- **Per wave merge:** `vitest run`
- **Phase gate:** Full suite green + `tsc -b` clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/threeMfParser.test.ts` — covers 3MF-01, 3MF-02, 3MF-03, 3MF-04 using synthetic in-memory ZIP fixtures (JSZip can generate test ZIPs in test code)
- [ ] Framework install: `npm install --save-dev vitest` + `vitest.config.ts` with `{ environment: 'jsdom' }` (required for DOMParser in tests)
- [ ] `@types/jszip` install alongside `jszip`

**Note:** The project has NO existing test infrastructure in source. The planner MUST include a Wave 0 task to install vitest + jsdom and create the test file before implementing the parser.

---

## Open Questions

1. **Slot-based vs type-based aggregation**
   - What we know: Aggregating by type is simpler; aggregating by slot ID preserves the "one FilamentRow per AMS slot" model that matches how Bambu users think.
   - What's unclear: If a user has the same filament type in two AMS slots (rare but valid), type-based aggregation merges them silently.
   - Recommendation: Aggregate by slot ID by default. If a slot appears on multiple plates, sum its `used_g`. This matches the existing `filamentGramsPerExtruder[]` pattern in `gcodeParser.ts`.

2. **PrusaSlicer .3mf files**
   - What we know: PrusaSlicer project files are also .3mf ZIPs but use a different metadata path (`Metadata/Slic3r_PE.config` or `config.ini`). They do not contain per-plate sliced data in the Bambu format.
   - What's unclear: Whether PrusaSlicer ever writes a `slice_info.config`-equivalent. It does not appear to.
   - Recommendation: 3MF-03 error path catches these: no `slice_info.config` → show "please slice in Bambu Studio or OrcaSlicer" message. Explicitly mention that PrusaSlicer 3MF project files are not supported.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read: `src/components/GcodeImport.tsx`, `src/utils/gcodeParser.ts`, `src/components/CostCalculator.tsx`, `src/types.ts`, `package.json` — current architecture understood from source
- npm registry (package.json): JSZip not yet installed; `jszip ^3.10.1` is current stable

### Secondary (MEDIUM confidence)
- OrcaSlicer GitHub issues and Bambu community forum posts documenting `slice_info.config` XML schema with `<plate>`, `<filament>`, `used_g`, `used_m`, `prediction` attributes — cannot be live-verified (web tools blocked during this session)
- JSZip npm page (web tools blocked) — version 3.10.1 is the known stable; browser support is well-established

### Tertiary (LOW confidence)
- Specific attribute names (`used_g`, `used_m`, `prediction`) — sourced from prior research note in the prompt. Treat as MEDIUM: widely referenced in community, consistent with what Bambu gcode headers show. Validate by opening a real sliced 3MF ZIP in development.

---

## Metadata

**Confidence breakdown:**
- Standard stack (JSZip + DOMParser): HIGH — both are standard, no alternatives needed
- Architecture (parser utility + GcodeImport extension): HIGH — directly mirrors existing gcodeParser.ts + GcodeImport.tsx pattern
- 3MF XML schema attribute names: MEDIUM — sourced from community documentation; must be validated with a real Bambu 3MF file during Wave 0 development
- Pitfalls: HIGH — derived from known gcode parser issues + ZIP format characteristics

**Research date:** 2026-04-15
**Valid until:** 2026-10-15 (stable domain — JSZip and the Bambu 3MF format are both stable)
