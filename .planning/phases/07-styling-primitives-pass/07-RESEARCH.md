# Phase 7: Styling Primitives Pass — Research

**Researched:** 2026-05-19
**Domain:** React component refactor — raw HTML form elements to shared UI primitives
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Expand scope from 3 to all 14 main app components (SettingsModal, CostCalculator, PrinterSettings, JobsManager, AssetLibrary, GcodeImport, BambuImport, CsvImportModal, MaintenanceAlertModal, UserProfileModal, UpdateBanner, FilamentSelector, Header, ImageCarousel).
- **D-02:** Marketing pages (`src/pages/`) are explicitly OUT of scope.
- **D-03:** Lint guard is grep-based (not ESLint), wired as `npm run lint:no-raw-html`. Greps `src/components/` excluding `src/components/ui/` and `src/pages/`.
- **D-04:** Opt-out comment marker is `// allow-raw-html` on the line immediately above a raw element.
- **D-05:** Lint check runs in both `pre-commit` and `npm run build` (fails locally AND in CI).
- **D-06:** Accept primitive defaults over perfect visual preservation; visible change IS the goal. Behavioral change is not acceptable.
- **D-07:** Only add new primitive variants/sizes if a real use case demands it.
- **D-08:** All replaced elements must preserve: variant, disabled state, type coercion, validation, `onChange`/`onClick` handlers.

### Claude's Discretion

- Order of file refactoring (recommend: heaviest first — SettingsModal → CostCalculator → PrinterSettings → JobsManager → modals → utilities).
- Per-file vs per-primitive refactoring style (recommend: per-file for clean reviewable units).
- Plan splitting (recommend: multiple plans of 3–4 components each).

### Deferred Ideas (OUT OF SCOPE)

- Marketing-page primitives pass.
- Custom ESLint rule for raw-HTML ban.
- Full design-system token pass.
- `Modal` primitive extraction.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | All `<button>` elements in CostCalculator, JobsManager, PrinterSettings replaced with `<Button>`/`<ButtonLink>`, preserving behavior | D-08 locking behavioral fidelity; primitive API verified below in §Standard Stack |
| UI-02 | All `<input>`, `<select>`, `<textarea>` in those three components replaced with primitives | Same; special types (file/checkbox/radio) need `allow-raw-html`; documented in §Landmines |
| UI-03 | Lint rule prevents new raw form elements at build time | Grep-based guard design documented in §Lint Guard Mechanism |

Note: CONTEXT.md D-01 expands UI-01 and UI-02 to all 14 components. The locked decisions supersede the requirement text.
</phase_requirements>

---

## Summary

Phase 7 is a mechanical JSX refactor: replace every `<button>`, `<input>`, `<select>`, and `<textarea>` in 14 app components with their shared-primitive counterparts from `src/components/ui/`. The primitives already exist, are complete, and have `forwardRef` + full HTML attribute passthrough. No new primitive infrastructure is needed.

The total count across all 14 components is **194 raw form elements** (fresh grep, 2026-05-19). The heaviest files are AssetLibrary (40), SettingsModal (44), and CostCalculator (32). AssetLibrary was not listed in CONTEXT.md's explicit counts but is the second-heaviest file — this changes the wave ordering recommendation.

The lint guard is the highest-risk deliverable in this phase from an implementation correctness standpoint. The `// allow-raw-html` opt-out must be implemented with `awk` (not plain `grep`) because plain grep cannot skip the match when the preceding line contains the marker. Nine raw elements across 4 files legitimately need this opt-out: 3 `type="file"` inputs, 3 `type="checkbox"` inputs, and 2 `type="radio"` inputs.

One critical gotcha: the `Button` primitive does NOT set `type="button"` as its default. It passes `{...props}` to the underlying `<button>`. Inside a `<form>`, an unstyled `<button>` without `type=` defaults to `type="submit"`. AssetLibrary is the only component with a `<form>` tag; all buttons inside it already carry explicit `type="submit"` or `type="button"` attributes — these must be preserved as-is when replacing with `<Button>`.

**Primary recommendation:** Execute as three plans. Plan A: SettingsModal + CostCalculator (76 elements). Plan B: AssetLibrary + PrinterSettings + JobsManager (71 elements). Plan C: remaining 8 lightweight components + lint guard install (47 elements + guard). Lint guard ships in Plan C after all replacements are complete to avoid false-negative windows.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| UI primitive rendering | Browser / Client | — | All 14 components are client-side React; no SSR |
| Form state & validation | Browser / Client | — | State lives in component hooks; not extracted; refactor does not touch state |
| Lint guard execution | Build toolchain | Pre-commit hook | Runs at `npm run build` (CI) and pre-commit (local) |
| Pre-commit hook installation | Developer machine | — | No husky/lefthook present; will use shell `.git/hooks/pre-commit` |

---

## Standard Stack

### Core Primitives (already installed — no npm install needed)

[VERIFIED: direct source read of src/components/ui/]

| Primitive | File | Props API | Export |
|-----------|------|-----------|--------|
| `Button` | `src/components/ui/Button.tsx` | `variant`, `btnSize`, `fullWidth`, `disabled`, all `ButtonHTMLAttributes` except none omitted | `Button`, `ButtonLink`, `getButtonClasses` |
| `Input` | `src/components/ui/Input.tsx` | `inputSize`, `error`, all `InputHTMLAttributes` **minus `size`** (Omit) | `Input` |
| `Select` | `src/components/ui/Select.tsx` | `selectSize`, `error`, all `SelectHTMLAttributes` **minus `size`** (Omit) | `Select` |
| `Textarea` | `src/components/ui/Textarea.tsx` | `textareaSize`, `error`, all `TextareaHTMLAttributes` (no Omit) | `Textarea` |
| `Card` | `src/components/ui/Card.tsx` | `variant`, `padding`, all `HTMLAttributes<HTMLDivElement>` | `Card` |

Import path for all: `import { Button, Input, Select, Textarea } from '../components/ui';` (from a sibling; adjust `..` depth as needed). Public barrel: `src/components/ui/index.ts`.

### Variant Mapping

[VERIFIED: direct source read of Button.tsx variantStyles]

| Tailwind pattern on raw `<button>` | Primitive variant | Notes |
|-----------------------------------|-------------------|-------|
| `bg-blue-600 hover:bg-blue-700 text-white` | `primary` | Default |
| `bg-slate-700 hover:bg-slate-600 text-white` | `secondary` | — |
| `bg-green-600 hover:bg-green-700 text-white` | `success` | — |
| `bg-red-600/20 … text-red-400 border-red-600/30` | `danger` | — |
| `bg-transparent hover:bg-slate-700 text-slate-300` | `ghost` | — |
| Icon-only close button (`text-slate-400 hover:text-white p-1`) | `ghost` + `btnSize="sm"` | Preserve icon children |
| Tab navigation button (active/inactive conditional class) | Keep as raw `<button>` with `// allow-raw-html` | Dynamic class-switch pattern doesn't map to a single variant |

### Size Mapping

[VERIFIED: direct source read]

| Raw padding pattern | Primitive size |
|--------------------|----------------|
| `px-3 py-1.5 text-sm` / compact | `sm` |
| `px-4 py-2 text-sm` / standard | `md` (default) |
| `px-6 py-3 text-base` / large | `lg` |

For `Input`, `Select`, `Textarea`: use `inputSize`/`selectSize`/`textareaSize` (not `size` — HTML attribute collision, TypeScript will error).

---

## Package Legitimacy Audit

No external packages are installed in this phase. All primitives are already in the codebase.

| Package | Status |
|---------|--------|
| (none — refactor only) | N/A |

---

## Architecture Patterns

### System Architecture Diagram

```
User interaction
     |
     v
[App component (App.tsx)]
     |
     +-- renders 14 app components (tabs / modals)
           |
           v
     [Raw <button>/<input>/<select>/<textarea> JSX]   <-- BEFORE
           |
           v  (Phase 7 refactor)
           |
     [Button / Input / Select / Textarea primitives]  <-- AFTER
           |
           v
     [src/components/ui/  (forwardRef wrappers)]
           |
           v
     [Browser DOM]

Build-time guard:
  npm run build
     |
     +-- tsc -b && vite build
     +-- lint:no-raw-html (new awk script)
              |
              v
         grep src/components/ (excl. ui/)
              |
              +-- match found --> exit 1 (CI fails)
              +-- no match   --> exit 0 (CI passes)

Pre-commit:
  .git/hooks/pre-commit
     |
     +-- runs lint:no-raw-html on staged files
```

### Recommended Project Structure (unchanged by this phase)

```
src/
├── components/
│   ├── ui/           # Primitives — DO NOT refactor these (out of scope)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Textarea.tsx
│   │   ├── Card.tsx
│   │   └── index.ts
│   ├── [14 app components] <-- refactor targets
│   └── NewBadge.tsx
└── pages/            # OUT OF SCOPE
```

### Per-Element Replacement Recipe

#### 1. `<button>` → `<Button>`

[VERIFIED: Button.tsx source]

**Step 1** — Identify variant from className:
- `bg-blue-600` → `variant="primary"`
- `bg-slate-700` or `bg-slate-600` → `variant="secondary"`
- `bg-green-600` → `variant="success"`
- `bg-red-600/20` → `variant="danger"`
- `text-slate-400 hover:text-white` (icon close buttons) → `variant="ghost" btnSize="sm"`
- Dynamic conditional classes (tab buttons) → `// allow-raw-html` opt-out (see §Opt-Out Inventory)

**Step 2** — Identify size from padding:
- `px-3 py-1.5` or `px-2 py-1` → `btnSize="sm"`
- `px-4 py-2` → `btnSize="md"` (default, can omit)
- `px-6 py-3` → `btnSize="lg"`
- Compact mini buttons (`px-2 py-1 text-xs`) → `btnSize="sm"` and retain `className` override if needed

**Step 3** — Preserve all event handlers and attributes as-is (`onClick`, `disabled`, `aria-label`, `aria-expanded`).

**Step 4** — Preserve `type=` attribute explicitly. The `Button` primitive does NOT default to `type="button"`. If the raw button has no `type=`, it is safe outside a `<form>` (browser treats it as submit but there is no form to submit). Inside a `<form>` (AssetLibrary only), the `type=` attribute is already explicit in the raw source.

**Step 5** — Drop className entirely if the raw className matches a variant exactly. Retain className only for:
- Structural overrides (`w-full`, `flex-1`, `whitespace-nowrap`)
- Layout modifiers not in the primitive (`absolute`, `mt-2`)
- Use `fullWidth` prop instead of `w-full` className.

**Step 6** — `forwardRef` chain: Button already uses `forwardRef`. If a raw `<button ref={someRef}>` exists (Header.tsx hamburger button), replace with `<Button ref={buttonRef} ...>` — works directly.

Before:
```tsx
<button
  onClick={onClose}
  className="text-slate-400 hover:text-white p-1"
>
  <svg .../>
</button>
```
After:
```tsx
<Button
  variant="ghost"
  btnSize="sm"
  onClick={onClose}
>
  <svg .../>
</Button>
```

Before (primary action):
```tsx
<button
  onClick={handleAddCarrier}
  disabled={!newCarrierName.trim() || !newCarrierCost}
  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
>
  Add
</button>
```
After:
```tsx
<Button
  onClick={handleAddCarrier}
  disabled={!newCarrierName.trim() || !newCarrierCost}
>
  Add
</Button>
```

Note: The `Button` primitive already includes `disabledButtonStyles` (`disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed`) — no need to pass these in className.

#### 2. `<input>` → `<Input>`

[VERIFIED: Input.tsx source]

**Step 1** — Remove className entirely. The Input primitive's `baseStyles` cover `w-full bg-slate-700 text-white rounded-lg border-0 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500`. Inline Tailwind overrides are redundant in nearly all cases in these components.

**Step 2** — Map size: most inputs in the codebase use `text-sm px-3 py-2` → `inputSize="md"` (default, can omit).

**Step 3** — Preserve ALL HTML attributes as-is: `type`, `step`, `min`, `max`, `value`, `onChange`, `placeholder`, `required`, `disabled`.

**Step 4** — `type="number"` inputs: `Input` does not restrict or coerce — it passes `type="number"` through `{...props}`. Browser-native coercion (`parseFloat(e.target.value)`) in `onChange` handlers is unaffected.

**Step 5** — SPECIAL TYPES requiring `// allow-raw-html` (no primitive covers these):
- `type="file"` — hidden file inputs with `ref` (GcodeImport, CsvImportModal)
- `type="checkbox"` — CostCalculator, BambuImport, CsvImportModal
- `type="radio"` — CsvImportModal

These must be left as raw `<input>` with the opt-out comment on the line above.

Before:
```tsx
<input
  type="number"
  step="0.01"
  value={shippingConfig.upsBaseCost}
  onChange={e => onShippingChange({ ...shippingConfig, upsBaseCost: parseFloat(e.target.value) || 0 })}
  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
/>
```
After:
```tsx
<Input
  type="number"
  step="0.01"
  value={shippingConfig.upsBaseCost}
  onChange={e => onShippingChange({ ...shippingConfig, upsBaseCost: parseFloat(e.target.value) || 0 })}
/>
```

#### 3. `<select>` → `<Select>`

[VERIFIED: Select.tsx source]

Same pattern as `<Input>`. Drop className; use `selectSize` (default `md`). Preserve `value`, `onChange`, `disabled`. Children (`<option>`) pass through unchanged.

Note: `Select` uses `Omit<SelectHTMLAttributes, 'size'>` — never pass `size` to `<Select>`.

Before:
```tsx
<select
  value={formData.category}
  onChange={e => setFormData({ ...formData, category: e.target.value as AssetCategory })}
  className="flex-1 bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
>
  {allCategories.map(cat => <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>)}
</select>
```
After:
```tsx
<Select
  value={formData.category}
  onChange={e => setFormData({ ...formData, category: e.target.value as AssetCategory })}
  className="flex-1"
>
  {allCategories.map(cat => <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>)}
</Select>
```

Note: `w-full` is baked into `Select` base styles already. Use `className="flex-1"` only when the element must flex-grow (e.g., inside a `flex` container where `w-full` would break layout). Otherwise omit className entirely.

#### 4. `<textarea>` → `<Textarea>`

[VERIFIED: Textarea.tsx source]

There are **zero `<textarea>` elements** across all 14 in-scope files (confirmed by grep). The `Textarea` primitive exists but is not exercised in this phase.

#### 5. Styled `<a>` and `<Link>` elements

No raw `<a>` elements styled as buttons were found in the 14 components. The Header uses `<Link>` from React Router (not `<a>`). `ButtonLink` is not needed in this phase.

---

## In-Scope File Inventory with Fresh Raw-Element Counts

[VERIFIED: grep counts run 2026-05-19 against working tree]

| File | `<button>` | `<input>` | `<select>` | `<textarea>` | **Total** | CONTEXT.md claim | Delta |
|------|-----------|----------|-----------|-------------|---------|-----------------|-------|
| `SettingsModal.tsx` | 11 | 33 | 0 | 0 | **44** | 44 | 0 |
| `AssetLibrary.tsx` | 22 | 15 | 3 | 0 | **40** | (not listed) | N/A |
| `CostCalculator.tsx` | 11 | 16 | 5 | 0 | **32** | 32 | 0 |
| `PrinterSettings.tsx` | 6 | 9 | 3 | 0 | **18** | 18 | 0 |
| `JobsManager.tsx` | 7 | 4 | 2 | 0 | **13** | 13 | 0 |
| `CsvImportModal.tsx` | 10 | 4 | 0 | 0 | **14** | (not listed) | N/A |
| `UserProfileModal.tsx` | 1 | 7 | 1 | 0 | **9** | (not listed) | N/A |
| `BambuImport.tsx` | 7 | 1 | 0 | 0 | **8** | (not listed) | N/A |
| `GcodeImport.tsx` | 2 | 1 | 0 | 0 | **3** | (not listed) | N/A |
| `ImageCarousel.tsx` | 3 | 0 | 0 | 0 | **3** | (not listed) | N/A |
| `UpdateBanner.tsx` | 2 | 0 | 0 | 0 | **2** | (not listed) | N/A |
| `FilamentSelector.tsx` | 1 | 1 | 0 | 0 | **2** | (not listed) | N/A |
| `Header.tsx` | 1 | 0 | 0 | 0 | **1** | (not listed) | N/A |
| `MaintenanceAlertModal.tsx` | 1 | 0 | 0 | 0 | **1** | (not listed) | N/A |
| **TOTAL** | **85** | **91** | **14** | **0** | **194** | — | — |

**Key finding:** AssetLibrary has 40 raw elements — not listed in CONTEXT.md's explicit counts but second-heaviest overall. This elevates it into the "first wave" tier.

### Allow-Raw-HTML Opt-Out Inventory

These 9 elements cannot be replaced with primitives and must carry `// allow-raw-html`:

| File | Line | Type | Reason |
|------|------|------|--------|
| `GcodeImport.tsx` | ~283 | `<input type="file">` | Hidden file picker with `ref`; no file Input primitive |
| `CsvImportModal.tsx` | ~313 | `<input type="file">` | Hidden file picker with `ref` |
| `CsvImportModal.tsx` | ~417 | `<input type="radio">` | Radio group; no primitive covers radio |
| `CsvImportModal.tsx` | ~427 | `<input type="radio">` | Radio group |
| `CsvImportModal.tsx` | ~490 | `<input type="checkbox">` | Row-selection checkbox |
| `BambuImport.tsx` | ~200 | `<input type="checkbox">` | Selection checkbox |
| `CostCalculator.tsx` | ~829 | `<input type="checkbox">` | Per-unit license toggle |
| `SettingsModal.tsx` | tabs | `<button>` (conditional class) | Active/inactive tab class-switch; no single variant maps |

Note on SettingsModal tabs: The tab buttons use a conditional className that switches between `text-blue-400 border-b-2 border-blue-400` (active) and `text-slate-400 hover:text-slate-200` (inactive). This does not map to a single variant. Use `// allow-raw-html`. The tab pattern may be addressed in a later DX pass if a `Tab` primitive is added (deferred per CONTEXT.md).

---

## Lint Guard Mechanism

### Script Design

[VERIFIED: no husky/lefthook in package.json; no .husky dir; no .git/hooks entries]

**Step 1 — Add `lint:no-raw-html` to package.json scripts:**

```json
"lint:no-raw-html": "node scripts/lint-no-raw-html.mjs"
```

**Step 2 — Create `scripts/lint-no-raw-html.mjs`:**

The awk-based approach handles the `// allow-raw-html` marker correctly (plain grep cannot look at the preceding line):

```javascript
// scripts/lint-no-raw-html.mjs
import { execSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const SCAN_DIRS = ['src/components'];
const EXCLUDE_DIR = 'src/components/ui';
const PATTERN = /<(button|input|select|textarea)[\s>\/]/;

function getFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(e => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return getFiles(full);
    return e.name.endsWith('.tsx') || e.name.endsWith('.ts') ? [full] : [];
  });
}

let violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of getFiles(dir)) {
    if (file.startsWith(EXCLUDE_DIR)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (PATTERN.test(lines[i])) {
        const prevLine = i > 0 ? lines[i - 1] : '';
        if (!prevLine.includes('allow-raw-html')) {
          violations.push(`${relative('.', file)}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Raw HTML form elements found (use shared primitives or add // allow-raw-html):');
  violations.forEach(v => console.error('  ' + v));
  process.exit(1);
}
console.log('lint:no-raw-html passed');
```

Why a `.mjs` script rather than inline shell: the `// allow-raw-html` line-above exclusion in shell requires awk with multi-file FILENAME support; the Node.js version is more portable across macOS/Linux/Windows (Tauri desktop dev targets all three).

**Step 3 — Wire into `npm run build`:**

Update `package.json` scripts:
```json
"build": "node scripts/lint-no-raw-html.mjs && tsc -b && vite build"
```

The lint runs before tsc so fast failures don't waste compile time.

**Step 4 — Install pre-commit hook (no husky/lefthook present):**

Create `.git/hooks/pre-commit` (shell script, executable):
```sh
#!/usr/bin/env sh
node scripts/lint-no-raw-html.mjs
```

Make executable: `chmod +x .git/hooks/pre-commit`

**Important:** `.git/hooks/` is not tracked by git. Document in CLAUDE.md (project instructions) that this hook must be reinstalled after a fresh clone: `chmod +x .git/hooks/pre-commit` or `node scripts/lint-no-raw-html.mjs` manually. Alternatively, add a `prepare` npm script:
```json
"prepare": "chmod +x .git/hooks/pre-commit 2>/dev/null || true"
```
This runs on `npm install` and makes the hook executable automatically. Recommended.

### Validation of the Lint Guard

Three assertions the executor must verify after installing the guard:

1. **Exit 0 on clean tree** — after all 14 components are refactored: `node scripts/lint-no-raw-html.mjs` exits 0.
2. **Exit 1 on violation** — add a raw `<button>` to any non-excluded file, run script, confirm exit 1 with the offending file/line in output. Then revert.
3. **Allow-raw-html honored** — add `// allow-raw-html` on the line before a raw `<input>`, run script, confirm exit 0 for that element.

---

## Plan Splitting Recommendation

**Recommendation: Three plans, heaviest-first, independent components per wave.**

All 14 components are independent of each other (no cross-imports among them beyond shared types). The plans can be executed sequentially. Parallelization is possible within each plan but since files don't share state, there are no merge conflicts.

### Wave Structure

**Plan 07-01 — Heavy Forms (76 raw elements)**
- `SettingsModal.tsx` — 44 elements
- `CostCalculator.tsx` — 32 elements

Rationale: These two together represent 39% of total debt. SettingsModal is the most visible settings surface; CostCalculator is the core product screen. Delivering these first maximizes visible consistency improvement.

**Plan 07-02 — Medium Forms (71 raw elements)**
- `AssetLibrary.tsx` — 40 elements (contains the only `<form>` tag; highest care required)
- `PrinterSettings.tsx` — 18 elements
- `JobsManager.tsx` — 13 elements

Rationale: AssetLibrary's form/submit pattern requires special handling (see §Landmines). Grouping it with the other "medium" components keeps Plan 07-01 clean.

**Plan 07-03 — Modals, Utilities + Lint Guard (47 raw elements + guard)**
- `CsvImportModal.tsx` — 14 elements (has file/radio/checkbox opt-outs)
- `UserProfileModal.tsx` — 9 elements
- `BambuImport.tsx` — 8 elements
- `GcodeImport.tsx` — 3 elements
- `ImageCarousel.tsx` — 3 elements
- `UpdateBanner.tsx` — 2 elements
- `FilamentSelector.tsx` — 2 elements
- `Header.tsx` — 1 element
- `MaintenanceAlertModal.tsx` — 1 element
- Install `scripts/lint-no-raw-html.mjs` + `package.json` wiring + pre-commit hook

Rationale: These lightweight files can be batched. The lint guard ships last so it verifies the entire clean state rather than trapping in-progress work.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus ring styles | Custom focus CSS | Primitive base styles | `focus:ring-2 focus:ring-blue-500` already baked in |
| Disabled state styles | `disabled ? 'bg-slate-600 text-slate-400 ...' : ''` | `disabled` prop on primitive | `disabledButtonStyles` already in Button |
| Button-styled anchor | Custom `<a>` with button className | `ButtonLink` | forwardRef, same variant/size API |
| Size normalization | Per-element padding classes | `btnSize` / `inputSize` / `selectSize` | Consistent min-touch-target (44px) baked in |
| Raw HTML lint | Custom ESLint plugin | `scripts/lint-no-raw-html.mjs` | D-03 locked grep-based; simpler, no ESLint infra needed |

---

## Common Pitfalls

### Pitfall 1: Missing `type="button"` on non-submit buttons inside AssetLibrary's `<form>`

**What goes wrong:** AssetLibrary has one `<form onSubmit={handleSubmit}>`. Raw `<button>` elements without `type=` inside a form default to `type="submit"`. Clicking any unlabeled button would submit the form.

**Why it happens:** The raw source already has explicit `type="button"` on Cancel and custom-category buttons, and `type="submit"` on the submit button. If a refactor drops the `type` attribute assuming the primitive handles it, the form behavior changes.

**How to avoid:** When replacing `<button type="submit">` → `<Button type="submit">` and `<button type="button">` → `<Button type="button">`, preserve the `type` attribute on ALL buttons inside AssetLibrary's `<form>`. The `Button` primitive passes `type` through `{...props}` — it does NOT set a default.

**Warning signs:** Clicking "Cancel" inside the add/edit asset form causes the form to submit instead of cancelling. Catch with smoke testing.

### Pitfall 2: Dropping `className` overrides that serve structural/layout purposes

**What goes wrong:** Executor removes the entire `className` from a raw `<input>` when replacing with `<Input>`. But `className="flex-1"` (inside a flex container) or `className="w-20"` (fixed-width number input) are structural, not stylistic, and are not covered by the primitive's base styles.

**Why it happens:** `Input` base styles include `w-full`. If the intent was a narrow fixed-width or flex-grow input, `w-full` will stretch it to fill the container.

**How to avoid:** Review every `className` for structural tokens (`flex-1`, `w-20`, `w-24`, `w-16`, `col-span-2`, `mt-2`) before discarding. Pass these through as `className="flex-1"` etc. Style tokens (`bg-slate-700 text-white px-3 py-2 rounded-lg border-0`) are replaced by the primitive and can be dropped.

### Pitfall 3: `size` vs `inputSize`/`selectSize`/`btnSize`

**What goes wrong:** TypeScript error: `Property 'size' does not exist on type 'InputProps'` (or similar). Executor writes `<Input size="md">` instead of `<Input inputSize="md">`.

**Why it happens:** `Input` and `Select` use `Omit<InputHTMLAttributes, 'size'>` to remove the native `size` attribute (which is `number`, not a string size token). The custom prop is `inputSize`/`selectSize`.

**How to avoid:** Always use the primitive-specific size prop names. TypeScript will catch this at build time if `size` is passed.

### Pitfall 4: SettingsModal tab buttons — dynamic className cannot map to a single variant

**What goes wrong:** Executor replaces tab buttons with `<Button>`, picks `primary` for active and `ghost` for inactive, but the conditional class logic (`activeTab === tab.id ? 'text-blue-400 border-b-2...' : 'text-slate-400...'`) is lost. The active tab indicator border disappears.

**Why it happens:** The tab button's active-state styling includes a bottom border (`border-b-2 border-blue-400 -mb-[1px]`) which doesn't exist in any Button variant. The Button primitive doesn't support "active" state.

**How to avoid:** Leave SettingsModal tab buttons as raw `<button>` elements with `// allow-raw-html` on the preceding line. Document this as a known opt-out in the plan.

### Pitfall 5: Lint guard false-positive on `src/components/ui/` files

**What goes wrong:** `scripts/lint-no-raw-html.mjs` reports violations in `Button.tsx`, `Input.tsx`, etc. because those files contain raw `<button>`, `<input>` elements by definition.

**Why it happens:** The script scans `src/components/` but fails to exclude `src/components/ui/`.

**How to avoid:** The exclusion `if (file.startsWith(EXCLUDE_DIR)) continue;` is already in the script design above. Verify exclusion works by running the script after install, confirming it does not flag `src/components/ui/` files.

### Pitfall 6: `UpdateBanner.tsx` Tauri conditional — do not touch the logic

**What goes wrong:** Refactoring `UpdateBanner` disrupts the `__IS_TAURI__` conditional inside `useEffect` or `handleDownload`.

**Why it happens:** UpdateBanner has exactly 2 raw `<button>` elements (Download button, Dismiss button). These are safe to replace with `<Button>`. The Tauri-specific logic is entirely inside `useEffect`/`useCallback` handlers — no JSX-level conditionals.

**How to avoid:** Only replace the `<button>` JSX; do not touch the event handler implementations. `handleDownload` (which conditionally imports `@tauri-apps/plugin-shell`) is unaffected by the JSX change.

### Pitfall 7: `Header.tsx` hamburger button uses `ref={buttonRef}`

**What goes wrong:** `<button ref={buttonRef}>` is replaced with `<Button ref={buttonRef}>` but the ref doesn't forward correctly, causing the click-outside handler to fail.

**Why it happens:** Non-forwardRef components ignore refs silently in React 18 (dev warning only).

**How to avoid:** `Button` already uses `forwardRef<HTMLButtonElement, ButtonProps>` — the ref forwards correctly. No special handling needed. Verify that `buttonRef.current` is still a valid `HTMLButtonElement` after replacement.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (or inlined in `vite.config.ts`) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |
| Build gate | `npm run build` (tsc -b + vite build + lint:no-raw-html) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| UI-01 | `<Button>` renders, fires onClick, respects disabled | Smoke | `npm run build` exits 0 | TypeScript will catch prop-type errors |
| UI-02 | `<Input type="number">` passes through type/step/onChange | Smoke | `npm run build` exits 0 | Browser coercion unaffected by wrapper |
| UI-02 | Disabled input has cursor-not-allowed styling | Visual smoke | Manual at port 4173 | No automated assertion needed (D-06) |
| UI-03 | `lint:no-raw-html` exits 0 on clean tree | Automated | `node scripts/lint-no-raw-html.mjs` | Run as part of each plan's final step |
| UI-03 | `lint:no-raw-html` exits 1 on introduced violation | Automated | Add raw `<button>`, run script, revert | Executor must verify |
| UI-03 | `// allow-raw-html` suppresses violation | Automated | Same script | Executor must verify |

### Sampling Rate

- **Per component completed:** `npm run build` must pass (TypeScript errors surface immediately)
- **Per plan merged:** Full `npm run build` green + visual smoke test at port 4173
- **Phase gate:** All 3 plans merged, `node scripts/lint-no-raw-html.mjs` exits 0, `npm run build` green, visual spot-check of calculator/settings/asset library UI

### Wave 0 Gaps

- [ ] `scripts/lint-no-raw-html.mjs` — does not exist yet; must be created in Plan 07-03 (or earlier as a Wave 0 task)
- [ ] `.git/hooks/pre-commit` — must be created and made executable
- [ ] `package.json` `build` and `lint:no-raw-html` scripts — must be updated

No new test files are needed. Vitest unit tests exist for cost calculation logic (Phase 11 scope) but are not relevant to this refactor. Behavioral preservation is validated by TypeScript compilation + smoke testing.

---

## Landmines

### L-1: Button primitive has no default `type="button"` — form-submit risk

The `Button` component does `{...props}` on the underlying `<button>`. It sets no `type` default. **Inside a `<form>`**, browsers treat `<button>` without `type=` as `type="submit"`. This only affects **AssetLibrary.tsx**, which is the sole component with a `<form>` element. All button children of that form already carry explicit `type="button"` or `type="submit"` in the raw source. Preserve these attributes when replacing.

### L-2: `Omit<HTMLAttributes, 'size'>` on Input and Select

Both `Input` and `Select` omit the HTML `size` attribute from their props type. Passing `size={5}` (native select width) is a TypeScript error. None of the 14 components currently pass `size=` on their raw inputs or selects — but executors should verify this is not introduced accidentally.

### L-3: Structural `className` tokens will be silently dropped if executor removes className wholesale

Affected patterns found in source:
- `className="flex-1 ..."` on inputs inside flex containers (SettingsModal carriers, AssetLibrary category)
- `className="w-20"`, `"w-24"`, `"w-16"` on compact number inputs
- `className="text-right"` on right-aligned numeric inputs

These survive as pass-through `className` on the primitive. Do NOT discard className blindly — strip only the style tokens that the primitive replaces.

### L-4: CsvImportModal radio inputs use `name="duplicateMode"` for browser-native radio grouping

`<input type="radio" name="duplicateMode">` — the `name` attribute groups radios natively. This is correct raw HTML behavior. These must remain as raw `<input>` with `// allow-raw-html`. If replaced with `<Input>`, TypeScript will not error (Input passes all input attributes through) but the semantic grouping behavior would be preserved — the real issue is the checkbox/radio styling: `accent-blue-500` works on raw inputs; the `Input` primitive's base styles (`bg-slate-700 text-white`) would visually break radio buttons. Use the opt-out.

### L-5: Hidden file inputs with `ref` — replacement with `<Input>` is possible but risky

`GcodeImport.tsx` and `CsvImportModal.tsx` have `<input type="file" ref={fileInputRef} className="hidden">`. The `Input` primitive uses `forwardRef` so `ref` would forward correctly. However, `Input`'s base styles (`w-full bg-slate-700 text-white ...`) apply to the element even though `className="hidden"` is passed — the `hidden` class must override. The safer choice is `// allow-raw-html` since these inputs are intentionally invisible and don't need consistent styling.

### L-6: AssetLibrary's `<form>` — the only native form submit in the entire codebase

All other components handle "submit" via `onClick` handlers on buttons, not native form submission. AssetLibrary is unique: `<form onSubmit={handleSubmit}>`. This form validation via `required` attributes on inputs inside it also must be preserved (the `name` input has `required`). `<Input required>` passes `required` through `{...props}` — this works. The key risk is the submit button (see L-1).

### L-7: `__IS_TAURI__` define is only in web/Tauri builds via `vite.config.ts`

UpdateBanner references `__IS_TAURI__` in its JS logic (not in JSX). This is a Vite `define` constant. The refactor only touches `<button>` JSX in this file — the logic is untouched. No regression risk from primitive replacement.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Per-component inline Tailwind on raw `<button>/<input>` | Shared primitives via `forwardRef` wrappers | Consistent focus rings, disabled states, min touch targets |
| No lint enforcement | grep-based `lint:no-raw-html` + pre-commit | Future contributions cannot introduce new raw elements |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SettingsModal tab buttons cannot be replaced by a single variant without losing active-state indicator | §Allow-Raw-HTML Opt-Out Inventory | Low — if a Tab variant is added to Button, tabs could be replaced; no behavioral regression, only a missed optimization |
| A2 | `.git/hooks/pre-commit` is the correct hook mechanism (no husky/lefthook needed) | §Lint Guard Mechanism | Low — if team later adopts husky, the hook approach is compatible; `prepare` script bridges the gap |

---

## Open Questions (RESOLVED)

1. **Should SettingsModal tabs be refactored to a `Tab` primitive?** — **RESOLVED:** Leave as `// allow-raw-html` for Phase 7. CONTEXT.md defers a `Tab` primitive to a future DX pass.
   - What we know: The tab button pattern is duplicated in SettingsModal and potentially elsewhere in future components.
   - What's unclear: Whether a `Tab` primitive belongs in `ui/` or stays as a local pattern.

2. **Should the lint guard also cover `src/pages/`?** — **RESOLVED:** Exclude `src/pages/` per CONTEXT.md D-02. The marketing redesign milestone can add its own lint scope when it lands.
   - What we know: CONTEXT.md D-02 says marketing pages are out of scope.
   - What's unclear: Whether unscoped `src/pages/` growth will drift over time.

---

## Environment Availability

No external tools or services required. The refactor uses existing primitives in the codebase and Node.js built-in modules for the lint script.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `scripts/lint-no-raw-html.mjs` | ✓ | (npm is present; node bundled) | — |
| TypeScript | Build gate (`tsc -b`) | ✓ | ~5.9.3 (in devDependencies) | — |
| Vite | Build gate | ✓ | ^7.2.4 (in devDependencies) | — |

---

## Security Domain

This phase performs no authentication, authorization, or data handling changes. It is a pure JSX/className refactor.

| ASVS Category | Applies | Rationale |
|---------------|---------|-----------|
| V2 Authentication | No | No auth logic touched |
| V3 Session Management | No | No session handling |
| V4 Access Control | No | No access control |
| V5 Input Validation | No | `onChange` handlers are preserved verbatim; validation logic not modified |
| V6 Cryptography | No | No crypto |

---

## Sources

### Primary (HIGH confidence)

- Direct source read: `src/components/ui/Button.tsx`, `Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Card.tsx`, `index.ts` — primitive APIs, variant maps, size maps, forwardRef usage
- Direct source read: All 14 in-scope `.tsx` files — raw element counts, type attributes, ref usage, form structure
- Direct source read: `package.json` — confirmed no husky/lefthook; confirmed `build` script is `tsc -b && vite build`; confirmed no `lint:no-raw-html` exists yet
- Direct source read: `eslint.config.js` — confirmed ESLint is not currently used for raw-HTML detection
- Direct source read: `.planning/config.json` — `nyquist_validation: true` confirmed

### Secondary (MEDIUM confidence)

- [ASSUMED] HTML spec: `<button>` without `type=` defaults to `type="submit"` inside a `<form>`. Well-established browser behavior; not re-verified from spec in this session.

---

## Metadata

**Confidence breakdown:**
- Primitive API mapping: HIGH — verified by direct source reads
- Raw element counts: HIGH — fresh grep against working tree
- Lint guard implementation: HIGH — no external dependencies; pure Node.js fs/string operations
- Pre-commit hook approach: HIGH — confirmed no husky/lefthook; shell hook is correct
- Plan splitting: HIGH — counts verified; wave boundaries based on empirical element counts

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (primitives are stable; counts change only if new components are added)
