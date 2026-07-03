# Phase 7: Styling Primitives Pass - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 14 in-scope components + 2 tooling files (lint script + pre-commit hook)
**Analogs found:** All 14 components are analogs to each other (all are raw-element consumers); primitive source files serve as the contract reference. Tooling analogs exist in `scripts/`.

---

## Overview

This is a **refactor-onto-existing-primitives** phase. There are zero existing in-codebase usages of `src/components/ui/` in the 14 in-scope components — the primitives are unused across all targets. The pattern map therefore uses:

1. **The primitive source files themselves** as the authoritative API contract for "after" patterns.
2. **The raw JSX in each target file** as the "before" patterns.
3. **RESEARCH.md §Per-Element Replacement Recipe** as the transformation rules (already verified against real source).

The `scripts/generate-icons.mjs` is the closest existing analog for the new `scripts/lint-no-raw-html.mjs`.

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/components/SettingsModal.tsx` | component (form-heavy modal) | request-response | Self — raw → primitive swap | refactor target |
| `src/components/CostCalculator.tsx` | component (main form) | request-response | Self — raw → primitive swap | refactor target |
| `src/components/AssetLibrary.tsx` | component (CRUD form + list) | CRUD | Self — raw → primitive swap | refactor target |
| `src/components/PrinterSettings.tsx` | component (settings form) | CRUD | Self — raw → primitive swap | refactor target |
| `src/components/JobsManager.tsx` | component (list + inline edit) | CRUD | Self — raw → primitive swap | refactor target |
| `src/components/CsvImportModal.tsx` | component (wizard modal) | file-I/O | Self — raw → primitive swap | refactor target |
| `src/components/UserProfileModal.tsx` | component (settings modal) | request-response | Self — raw → primitive swap | refactor target |
| `src/components/BambuImport.tsx` | component (import modal) | file-I/O | Self — raw → primitive swap | refactor target |
| `src/components/GcodeImport.tsx` | component (file drop zone) | file-I/O | Self — raw → primitive swap | refactor target |
| `src/components/ImageCarousel.tsx` | component (UI widget) | event-driven | Self — raw → primitive swap | refactor target |
| `src/components/UpdateBanner.tsx` | component (notification banner) | event-driven | Self — raw → primitive swap | refactor target |
| `src/components/FilamentSelector.tsx` | component (selector widget) | request-response | Self — raw → primitive swap | refactor target |
| `src/components/Header.tsx` | component (nav) | event-driven | Self — raw → primitive swap | refactor target |
| `src/components/MaintenanceAlertModal.tsx` | component (alert modal) | request-response | Self — raw → primitive swap | refactor target |
| `scripts/lint-no-raw-html.mjs` | utility script (lint guard) | batch | `scripts/generate-icons.mjs` | role-match (Node.js ESM script) |
| `.git/hooks/pre-commit` | tooling (git hook) | event-driven | none in codebase | no analog |

---

## Shared Patterns (Apply to ALL 14 Components)

### Import Block Pattern

**Every refactored component adds this import.** The import path is always `'./ui'` (components importing from a sibling directory). If the component already imports from `'./NewBadge'` or other siblings, add on the same line or below.

```tsx
// Add to existing import section — adjust named exports to what each file uses
import { Button, Input, Select } from './ui';
// Or the full set if Card/Textarea needed:
import { Button, Input, Select, Textarea, Card } from './ui';
```

**Source contract:** `src/components/ui/index.ts` lines 1-5:
```ts
export { Button, ButtonLink, getButtonClasses } from './Button';
export { Input } from './Input';
export { Select } from './Select';
export { Textarea } from './Textarea';
export { Card } from './Card';
```

### Button Variant Decision Table

**Source:** `src/components/ui/Button.tsx` lines 15-21

```tsx
// variantStyles map — use this to classify every raw <button> className:
primary:   'bg-blue-600 hover:bg-blue-700 text-white'
secondary: 'bg-slate-700 hover:bg-slate-600 text-white'
success:   'bg-green-600 hover:bg-green-700 text-white'
danger:    'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30'
ghost:     'bg-transparent hover:bg-slate-700 text-slate-300'
```

**Size decision table** (`src/components/ui/Button.tsx` lines 23-27):
```tsx
sm: 'px-3 py-1.5 text-sm min-h-[36px]'   // raw px-3 py-1.5 / px-2 py-1
md: 'px-4 py-2 text-sm min-h-[44px]'      // raw px-4 py-2 (default — omit btnSize)
lg: 'px-6 py-3 text-base min-h-[48px]'    // raw px-6 py-3
```

### Disabled State — Never Repeat It

**Source:** `src/components/ui/Button.tsx` line 30:
```tsx
// Already baked into Button via getButtonClasses:
export const disabledButtonStyles = 'disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed disabled:border-slate-600';
```
Drop `disabled:bg-slate-600 disabled:cursor-not-allowed` from every raw className when replacing with `<Button>`. Just pass the `disabled` prop.

### Input/Select Base Styles — Always Drop These from className

**Source:** `src/components/ui/Input.tsx` line 19:
```tsx
const baseStyles = 'w-full bg-slate-700 text-white rounded-lg border-0 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';
```

**Source:** `src/components/ui/Select.tsx` line 19:
```tsx
const baseStyles = 'w-full bg-slate-700 text-white rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500';
```

Strip these token groups from raw `className` — the primitive injects them. Retain only **structural** tokens: `flex-1`, `w-20`, `w-24`, `w-16`, `text-right`, `col-span-2`, `mt-2`, `pl-9` (icon padding).

### prop name: `btnSize` / `inputSize` / `selectSize` — NEVER `size`

Both `Input` and `Select` use `Omit<...HTMLAttributes, 'size'>`. TypeScript will error on `size=`. Always use:
- `<Button btnSize="sm">` not `<Button size="sm">`
- `<Input inputSize="md">` not `<Input size="md">`
- `<Select selectSize="md">` not `<Select size="md">`

### `// allow-raw-html` Opt-Out Comment Pattern

Place on the line **immediately above** the raw element — no blank lines between marker and element:

```tsx
{/* allow-raw-html */}
<input type="checkbox" checked={...} onChange={...} className="w-4 h-4 ..." />
```

Or for inline JSX expressions where a JSX comment is awkward, the lint script checks for the string `allow-raw-html` on `lines[i-1]` — a JS comment works too if the line is not JSX:

```tsx
// allow-raw-html
<input type="file" ref={fileInputRef} className="hidden" />
```

Use JSX comment form `{/* allow-raw-html */}` inside JSX blocks (most cases). Use `// allow-raw-html` only outside JSX context.

---

## Pattern Assignments — Plan 07-01 (Heavy Forms: SettingsModal + CostCalculator)

### `src/components/SettingsModal.tsx` (44 raw elements)

**Primitives needed:** `Button`, `Input`

**Before pattern — close button** (`SettingsModal.tsx` lines 168-175):
```tsx
<button
  onClick={onClose}
  className="text-slate-400 hover:text-white p-1"
>
  <svg .../>
</button>
```
**After:**
```tsx
<Button variant="ghost" btnSize="sm" onClick={onClose}>
  <svg .../>
</Button>
```

**Before pattern — tab buttons** (`SettingsModal.tsx` lines 181-193) — **LEAVE AS RAW with opt-out:**
```tsx
{/* allow-raw-html */}
<button
  key={tab.id}
  onClick={() => setActiveTab(tab.id)}
  className={`relative flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center ${
    activeTab === tab.id
      ? 'text-blue-400 border-b-2 border-blue-400 -mb-[1px]'
      : 'text-slate-400 hover:text-slate-200'
  }`}
>
  {tab.label}
  {tab.feature && <NewBadge feature={tab.feature} className="absolute -top-1 -right-1 pointer-events-none" />}
</button>
```
Reason: Dynamic active-state class with `border-b-2 border-blue-400 -mb-[1px]` cannot map to any Button variant. Tab primitive is deferred.

**Before pattern — text/number input** (`SettingsModal.tsx` lines 205-217):
```tsx
<input
  type="number"
  step="0.1"
  min="0"
  max="99.9"
  value={userProfile.defaultProfitMargin ?? 30}
  onChange={e => { ... }}
  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
/>
```
**After:**
```tsx
<Input
  type="number"
  step="0.1"
  min="0"
  max="99.9"
  value={userProfile.defaultProfitMargin ?? 30}
  onChange={e => { ... }}
/>
```

**Before pattern — add carrier: flex-1 text input in flex container** (`SettingsModal.tsx` lines 445-451):
```tsx
<input
  type="text"
  placeholder="Carrier name"
  value={newCarrierName}
  onChange={e => setNewCarrierName(e.target.value)}
  className="flex-1 bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
/>
```
**After** (retain `className="flex-1"` — structural token):
```tsx
<Input
  type="text"
  placeholder="Carrier name"
  value={newCarrierName}
  onChange={e => setNewCarrierName(e.target.value)}
  className="flex-1"
/>
```

**Before pattern — fixed-width number input** (`SettingsModal.tsx` lines 452-459):
```tsx
<input
  type="number"
  step="0.01"
  min="0"
  placeholder={`Cost (${currencySymbol})`}
  value={newCarrierCost}
  onChange={e => setNewCarrierCost(e.target.value)}
  className="w-24 bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
/>
```
**After** (retain `className="w-24"` — structural width override):
```tsx
<Input
  type="number"
  step="0.01"
  min="0"
  placeholder={`Cost (${currencySymbol})`}
  value={newCarrierCost}
  onChange={e => setNewCarrierCost(e.target.value)}
  className="w-24"
/>
```

**Before pattern — primary action button with disabled state** (`SettingsModal.tsx` lines 461-467):
```tsx
<button
  onClick={handleAddCarrier}
  disabled={!newCarrierName.trim() || !newCarrierCost}
  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
>
  Add
</button>
```
**After** (disabled styles already in primitive; drop entire className):
```tsx
<Button
  onClick={handleAddCarrier}
  disabled={!newCarrierName.trim() || !newCarrierCost}
>
  Add
</Button>
```

**Before pattern — inline edit inputs with structural overrides** (`SettingsModal.tsx` lines 393-406):
```tsx
<input
  type="text"
  value={carrier.name}
  onChange={e => handleUpdateCarrier(carrier.id, 'name', e.target.value)}
  className="flex-1 bg-slate-600 text-white text-sm px-2 py-1 rounded border-0"
/>
<input
  type="number"
  step="0.01"
  min="0"
  value={carrier.defaultCost}
  onChange={e => handleUpdateCarrier(carrier.id, 'defaultCost', Math.max(0, parseFloat(e.target.value) || 0))}
  className="w-20 bg-slate-600 text-white text-sm px-2 py-1 rounded border-0 text-right"
/>
```
**After:**
```tsx
<Input
  type="text"
  value={carrier.name}
  onChange={e => handleUpdateCarrier(carrier.id, 'name', e.target.value)}
  className="flex-1"
/>
<Input
  type="number"
  step="0.01"
  min="0"
  value={carrier.defaultCost}
  onChange={e => handleUpdateCarrier(carrier.id, 'defaultCost', Math.max(0, parseFloat(e.target.value) || 0))}
  className="w-20 text-right"
/>
```

**Before pattern — icon-only ghost buttons (edit/delete)** (`SettingsModal.tsx` lines 420-435):
```tsx
<button
  onClick={() => setEditingCarrierId(carrier.id)}
  className="text-slate-400 hover:text-slate-200 p-1"
>
  <svg .../>
</button>
<button
  onClick={() => handleDeleteCarrier(carrier.id)}
  className="text-red-400 hover:text-red-300 p-1"
>
  <svg .../>
</button>
```
**After:**
```tsx
<Button variant="ghost" btnSize="sm" onClick={() => setEditingCarrierId(carrier.id)}>
  <svg .../>
</Button>
<Button variant="danger" btnSize="sm" onClick={() => handleDeleteCarrier(carrier.id)}>
  <svg .../>
</Button>
```
Note: delete button has `text-red-400` — maps to `variant="danger"`. The SVG icon children pass through unchanged.

---

### `src/components/CostCalculator.tsx` (32 raw elements)

**Primitives needed:** `Button`, `Input`, `Select`

**Before pattern — dismiss/close ghost button** (`CostCalculator.tsx` lines 651-658):
```tsx
<button
  onClick={() => setValidationError(null)}
  className="text-slate-500 hover:text-slate-300 ml-2"
>
  <svg .../>
</button>
```
**After:**
```tsx
<Button variant="ghost" btnSize="sm" onClick={() => setValidationError(null)} className="ml-2">
  <svg .../>
</Button>
```

**Before pattern — cancel ghost button (no className class match)** (`CostCalculator.tsx` lines 671-679):
```tsx
<button
  onClick={() => { clearForm(); onCancelEdit(); }}
  className="text-slate-400 hover:text-white transition-colors"
>
  Cancel
</button>
```
**After:**
```tsx
<Button variant="ghost" btnSize="sm" onClick={() => { clearForm(); onCancelEdit(); }}>
  Cancel
</Button>
```

**Before pattern — standard text input** (`CostCalculator.tsx` lines 711-717):
```tsx
<input
  type="text"
  value={printName}
  onChange={e => setPrintName(e.target.value)}
  placeholder="e.g., Dragon Figurine"
  className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
/>
```
**After** (the `min-h-[44px]` is already baked into Input `md` size — drop it along with style tokens):
```tsx
<Input
  type="text"
  value={printName}
  onChange={e => setPrintName(e.target.value)}
  placeholder="e.g., Dragon Figurine"
/>
```

**Before pattern — select element** (`CostCalculator.tsx` lines 725-735):
```tsx
<select
  value={selectedInstanceId}
  onChange={e => setSelectedInstanceId(e.target.value)}
  className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
>
  {printerInstances.map(instance => (
    <option key={instance.id} value={instance.id}>...</option>
  ))}
</select>
```
**After:**
```tsx
<Select
  value={selectedInstanceId}
  onChange={e => setSelectedInstanceId(e.target.value)}
>
  {printerInstances.map(instance => (
    <option key={instance.id} value={instance.id}>...</option>
  ))}
</Select>
```

**Before pattern — checkbox (LEAVE AS RAW with opt-out)** (`CostCalculator.tsx` lines 828-833):
```tsx
{/* allow-raw-html */}
<input
  type="checkbox"
  checked={modelCostPerUnit}
  onChange={e => setModelCostPerUnit(e.target.checked)}
  className="w-4 h-4 bg-slate-700 border-slate-600 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
/>
```
Reason: Checkbox styling (`accent-*`, custom border) not covered by `Input` primitive base styles.

---

## Pattern Assignments — Plan 07-02 (Medium Forms: AssetLibrary + PrinterSettings + JobsManager)

### `src/components/AssetLibrary.tsx` (40 raw elements) — SPECIAL: contains `<form>`

**Primitives needed:** `Button`, `Input`, `Select`

**CRITICAL RULE for this file:** All `<button>` elements inside `<form onSubmit={handleSubmit}>` (lines 435-680) MUST preserve their explicit `type=` attribute. The `Button` primitive does NOT set `type="button"` by default.

**Before pattern — submit button inside form** (`AssetLibrary.tsx` lines 666-670):
```tsx
<button
  type="submit"
  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
>
  {editingId ? 'Update' : 'Add'} {isPrinterForm ? 'Printer' : 'Material'}
</button>
```
**After** (MUST preserve `type="submit"`):
```tsx
<Button type="submit">
  {editingId ? 'Update' : 'Add'} {isPrinterForm ? 'Printer' : 'Material'}
</Button>
```

**Before pattern — cancel button inside form** (`AssetLibrary.tsx` lines 672-677):
```tsx
<button
  type="button"
  onClick={cancelEdit}
  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg transition-colors"
>
  Cancel
</button>
```
**After** (MUST preserve `type="button"`):
```tsx
<Button type="button" variant="secondary" onClick={cancelEdit}>
  Cancel
</Button>
```

**Before pattern — small inline "Cancel" button inside form** (`AssetLibrary.tsx` lines 464-470):
```tsx
<button
  type="button"
  onClick={() => { setShowCustomCategory(false); setCustomCategoryInput(''); }}
  className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded"
>
  Cancel
</button>
```
**After:**
```tsx
<Button type="button" variant="secondary" btnSize="sm" onClick={() => { setShowCustomCategory(false); setCustomCategoryInput(''); }}>
  Cancel
</Button>
```

**Before pattern — filter tab buttons (conditional className, outside form)** (`AssetLibrary.tsx` lines 387-410):
```tsx
{/* allow-raw-html */}
<button
  onClick={() => handleFilterChange('all')}
  className={`px-4 py-1 min-h-[40px] text-sm rounded-lg transition-colors ${
    filterCategory === 'all'
      ? 'bg-slate-600 text-white'
      : 'bg-slate-700 text-slate-400 hover:text-white'
  }`}
>
  All
</button>
```
Reason: Dynamic active/inactive class switch (same pattern as SettingsModal tabs). No single Button variant covers both states. Mark with `// allow-raw-html`.

**Before pattern — flex-1 select inside flex container** (`AssetLibrary.tsx` lines 474-482):
```tsx
<select
  value={formData.category}
  onChange={e => setFormData({ ...formData, category: e.target.value as AssetCategory })}
  className="flex-1 bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
>
  {allCategories.map(cat => <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>)}
</select>
```
**After** (retain `className="flex-1"` for flex-grow behavior; `w-full` from base styles is overridden):
```tsx
<Select
  value={formData.category}
  onChange={e => setFormData({ ...formData, category: e.target.value as AssetCategory })}
  className="flex-1"
>
  {allCategories.map(cat => <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>)}
</Select>
```

**Before pattern — required text input inside form** (`AssetLibrary.tsx` lines 444-451):
```tsx
<input
  type="text"
  value={formData.name || ''}
  onChange={e => setFormData({ ...formData, name: e.target.value })}
  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
  placeholder={isPrinterForm ? "e.g., Creality Ender 3 V3" : "Asset name"}
  required
/>
```
**After** (`required` passes through via `{...props}`):
```tsx
<Input
  type="text"
  value={formData.name || ''}
  onChange={e => setFormData({ ...formData, name: e.target.value })}
  placeholder={isPrinterForm ? "e.g., Creality Ender 3 V3" : "Asset name"}
  required
/>
```

**Before pattern — mobile sort select (compact size)** (`AssetLibrary.tsx` line 686-690):
```tsx
<select
  value={sortField}
  onChange={e => { setSortField(e.target.value); setCurrentPage(1); }}
  className="bg-slate-700 text-white text-sm px-2 py-1.5 min-h-[40px] rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
>
```
**After** (`px-2 py-1.5` maps to `selectSize="sm"`; but `min-h-[40px]` is below the primitive's `min-h-[44px]` — accept the accessible height upgrade per D-06):
```tsx
<Select
  value={sortField}
  onChange={e => { setSortField(e.target.value); setCurrentPage(1); }}
  selectSize="sm"
>
```

---

### `src/components/PrinterSettings.tsx` (18 raw elements)

**Primitives needed:** `Button`, `Input`, `Select`

**Before pattern — primary add button** (`PrinterSettings.tsx` lines 78-83):
```tsx
<button
  onClick={() => setShowAddForm(true)}
  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
>
  + Add Printer
</button>
```
**After** (`px-3 py-1.5` → `btnSize="sm"`):
```tsx
<Button btnSize="sm" onClick={() => setShowAddForm(true)}>
  + Add Printer
</Button>
```

**Before pattern — standard input in form** (`PrinterSettings.tsx` lines 93-99):
```tsx
<input
  type="text"
  value={newInstanceNickname}
  onChange={e => setNewInstanceNickname(e.target.value)}
  placeholder="e.g., Office P1S, Garage A1"
  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
/>
```
**After:**
```tsx
<Input
  type="text"
  value={newInstanceNickname}
  onChange={e => setNewInstanceNickname(e.target.value)}
  placeholder="e.g., Office P1S, Garage A1"
/>
```

**Before pattern — select with options** (`PrinterSettings.tsx` lines 103-111):
```tsx
<select
  value={newInstancePrinterId}
  onChange={e => setNewInstancePrinterId(e.target.value)}
  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
>
  {printers.map(p => (
    <option key={p.id} value={p.id}>{p.name}</option>
  ))}
</select>
```
**After:**
```tsx
<Select
  value={newInstancePrinterId}
  onChange={e => setNewInstancePrinterId(e.target.value)}
>
  {printers.map(p => (
    <option key={p.id} value={p.id}>{p.name}</option>
  ))}
</Select>
```

---

### `src/components/JobsManager.tsx` (13 raw elements)

**Primitives needed:** `Button`, `Input`, `Select`

All patterns in JobsManager follow the same templates as PrinterSettings and SettingsModal. The inline-edit rows use the compact input pattern (`className="w-20 text-right"` retained). Apply the same recipe:
- `bg-blue-600` buttons → `<Button>` (primary, default)
- `bg-slate-600`/`bg-slate-700` buttons → `<Button variant="secondary">`
- `text-slate-400 hover:...` icon buttons → `<Button variant="ghost" btnSize="sm">`
- All inputs → `<Input>` with structural className retained, style tokens dropped
- All selects → `<Select>` with structural className retained, style tokens dropped

---

## Pattern Assignments — Plan 07-03 (Modals + Utilities + Lint Guard)

### `src/components/CsvImportModal.tsx` (14 raw elements; 4 opt-outs)

**Primitives needed:** `Button`, `Input`

**Before pattern — modal close/back ghost button** (`CsvImportModal.tsx` lines 161-169):
```tsx
<button
  onClick={() => { setStep('upload'); setParseResult(null); setError(null); }}
  className="text-slate-400 hover:text-white transition-colors"
  title="Back to upload"
>
  <svg .../>
</button>
```
**After:**
```tsx
<Button variant="ghost" btnSize="sm" onClick={() => { setStep('upload'); setParseResult(null); setError(null); }} title="Back to upload">
  <svg .../>
</Button>
```

**Before pattern — hidden file input (opt-out)** (`CsvImportModal.tsx` lines 311-317):
```tsx
{/* allow-raw-html */}
<input
  ref={fileInputRef}
  type="file"
  accept=".csv"
  onChange={onFileSelect}
  className="hidden"
/>
```
Reason: Hidden file picker. Input primitive base styles would apply even with `className="hidden"`. Safer to leave raw.

**Before pattern — radio inputs (opt-out)** (`CsvImportModal.tsx` lines 416-434):
```tsx
{/* allow-raw-html */}
<input
  type="radio"
  name="duplicateMode"
  checked={duplicateMode === 'skip'}
  onChange={() => onDuplicateModeChange('skip')}
  className="accent-blue-500"
/>
{/* allow-raw-html */}
<input
  type="radio"
  name="duplicateMode"
  checked={duplicateMode === 'overwrite'}
  onChange={() => onDuplicateModeChange('overwrite')}
  className="accent-blue-500"
/>
```
Reason: `accent-blue-500` radio styling; `Input` base styles (`bg-slate-700 text-white`) visually break radio buttons.

**Before pattern — row checkbox (opt-out)** (`CsvImportModal.tsx` lines 489-495):
```tsx
{/* allow-raw-html */}
<input
  type="checkbox"
  checked={isSelected}
  onChange={onToggle}
  disabled={hasErrors}
  className="mt-0.5 accent-blue-500 disabled:opacity-30"
/>
```
Reason: Checkbox with `accent-blue-500` styling.

**Before pattern — text-only link-style buttons** (`CsvImportModal.tsx` lines 439-451):
```tsx
<button
  onClick={onSelectAll}
  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
>
  Select all valid
</button>
<button
  onClick={onDeselectAll}
  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
>
  Deselect all
</button>
```
**After** (these are text-only link-style actions; ghost captures the transparent bg; retain `className` for text-color override since ghost uses `text-slate-300` but these use `text-blue-400` / `text-xs`):
```tsx
<Button variant="ghost" btnSize="sm" onClick={onSelectAll} className="text-blue-400 hover:text-blue-300 text-xs">
  Select all valid
</Button>
<Button variant="ghost" btnSize="sm" onClick={onDeselectAll} className="text-xs">
  Deselect all
</Button>
```

---

### `src/components/UserProfileModal.tsx` (9 raw elements)

**Primitives needed:** `Button`, `Input`, `Select`

**Before pattern — modal close button** (`UserProfileModal.tsx` lines 54-61):
```tsx
<button
  onClick={onClose}
  className="text-slate-400 hover:text-white p-1"
>
  <svg .../>
</button>
```
**After:**
```tsx
<Button variant="ghost" btnSize="sm" onClick={onClose}>
  <svg .../>
</Button>
```

**Before pattern — standard inputs and select** (`UserProfileModal.tsx` lines 72-99):
Same recipe as SettingsModal — drop style tokens, preserve structural tokens, use `<Input>` / `<Select>`.

---

### `src/components/BambuImport.tsx` (8 raw elements; 1 opt-out)

**Primitives needed:** `Button`, `Input`

**Before pattern — trigger button (outside modal)** (`BambuImport.tsx` lines 98-109):
```tsx
<button
  onClick={handleOpen}
  className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors"
  title="Import Bambu Lab filament catalog with prices"
>
  <svg .../>
  <span className="hidden sm:inline">Bambu Prices</span>
  <span className="sm:hidden">Bambu</span>
</button>
```
**After** (Emerald/green maps to `success` variant; `px-3 py-1.5` → `btnSize="sm"`; structural icon/label spans pass through as children):
```tsx
<Button
  variant="success"
  btnSize="sm"
  onClick={handleOpen}
  title="Import Bambu Lab filament catalog with prices"
>
  <svg .../>
  <span className="hidden sm:inline">Bambu Prices</span>
  <span className="sm:hidden">Bambu</span>
</Button>
```

**Before pattern — checkbox opt-out** (`BambuImport.tsx` line ~199-204):
```tsx
{/* allow-raw-html */}
<input
  type="checkbox"
  checked={isSelected}
  onChange={() => toggleSelect(index)}
  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 shrink-0"
/>
```

---

### `src/components/GcodeImport.tsx` (3 raw elements; 1 opt-out)

**Primitives needed:** `Button`

**Before pattern — hidden file input opt-out** (`GcodeImport.tsx` lines 281-287):
```tsx
{/* allow-raw-html */}
<input
  ref={fileInputRef}
  type="file"
  accept=".gcode,.gc,.3mf"
  onChange={handleFileSelect}
  className="hidden"
/>
```

Remaining 2 raw `<button>` elements: apply ghost/primary recipe per className.

---

### `src/components/ImageCarousel.tsx` (3 raw elements)

**Primitives needed:** `Button`

**Before pattern — arrow navigation buttons** (`ImageCarousel.tsx` lines 95-120):
```tsx
<button
  onClick={goPrev}
  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center
             bg-slate-900/70 hover:bg-slate-900/90 text-white rounded-full
             transition-all backdrop-blur-sm border border-slate-700/50
             opacity-0 group-hover:opacity-100 cursor-pointer"
  aria-label="Previous screenshot"
>
  <svg .../>
</button>
```
**After** (ghost is closest; use `className` for the positional/visual overrides not in any variant — `absolute`, `rounded-full`, `w-10 h-10`, `opacity-0 group-hover:opacity-100`, `backdrop-blur-sm`, `border`):
```tsx
<Button
  variant="ghost"
  btnSize="sm"
  onClick={goPrev}
  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full backdrop-blur-sm border border-slate-700/50 opacity-0 group-hover:opacity-100 bg-slate-900/70 hover:bg-slate-900/90"
  aria-label="Previous screenshot"
>
  <svg .../>
</Button>
```

**Before pattern — dot indicator buttons (conditional className)** (`ImageCarousel.tsx` lines 125-135):
```tsx
{/* allow-raw-html */}
<button
  key={index}
  onClick={() => setCurrentIndex(index)}
  className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
    index === currentIndex
      ? 'bg-blue-400 w-6'
      : 'bg-slate-600 hover:bg-slate-500 w-2.5'
  }`}
  aria-label={`Go to screenshot ${index + 1}`}
  aria-current={index === currentIndex ? 'true' : undefined}
/>
```
Reason: Dot indicator has fully custom sizing (`w-6`/`w-2.5` dynamic), no `children`, and a conditional class-switch that doesn't match any Button variant. Mark with `// allow-raw-html`.

---

### `src/components/UpdateBanner.tsx` (2 raw elements)

**Primitives needed:** `Button`

**Before pattern — Download button (light background)** (`UpdateBanner.tsx` lines 91-96):
```tsx
<button
  onClick={handleDownload}
  className="px-3 py-1 bg-white text-blue-600 rounded font-medium hover:bg-blue-50 transition-colors"
>
  Download
</button>
```
**After** (no Button variant covers white/light background; closest is `ghost` but the intent is a visually prominent CTA on the blue banner — pass the background override via className):
```tsx
<Button
  variant="ghost"
  btnSize="sm"
  onClick={handleDownload}
  className="bg-white text-blue-600 hover:bg-blue-50 font-medium"
>
  Download
</Button>
```

**Before pattern — Dismiss icon button** (`UpdateBanner.tsx` lines 97-105):
```tsx
<button
  onClick={handleDismiss}
  className="text-white/80 hover:text-white transition-colors"
  aria-label="Dismiss"
>
  <svg .../>
</button>
```
**After:**
```tsx
<Button variant="ghost" btnSize="sm" onClick={handleDismiss} className="text-white/80 hover:text-white" aria-label="Dismiss">
  <svg .../>
</Button>
```

---

### `src/components/FilamentSelector.tsx` (2 raw elements)

**Primitives needed:** `Button`, `Input`

**Before pattern — number input** (`FilamentSelector.tsx` lines 168-174):
```tsx
<input
  type="number"
  step="0.001"
  value={editedPrice || ''}
  onChange={e => onPriceChange(parseFloat(e.target.value) || 0)}
  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
/>
```
**After:**
```tsx
<Input
  type="number"
  step="0.001"
  value={editedPrice || ''}
  onChange={e => onPriceChange(parseFloat(e.target.value) || 0)}
/>
```

The second raw element (a `<button>`) follows standard ghost/primary recipe per its className.

---

### `src/components/Header.tsx` (1 raw element) — uses `ref`

**Primitives needed:** `Button`

**Before pattern — hamburger button with ref** (`Header.tsx` lines 64-69):
```tsx
<button
  ref={buttonRef}
  onClick={() => setMobileMenuOpen((prev) => !prev)}
  className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
  aria-expanded={mobileMenuOpen}
>
```
**After** (`Button` uses `forwardRef<HTMLButtonElement>` — ref forwards correctly. Positional classes pass through):
```tsx
<Button
  ref={buttonRef}
  variant="ghost"
  btnSize="sm"
  onClick={() => setMobileMenuOpen((prev) => !prev)}
  className="md:hidden w-11 h-11 rounded-lg"
  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
  aria-expanded={mobileMenuOpen}
>
```
Verify: `buttonRef.current` remains `HTMLButtonElement` after replacement (Button's `forwardRef` types it correctly).

---

### `src/components/MaintenanceAlertModal.tsx` (1 raw element)

**Primitives needed:** `Button`

**Before pattern** (`MaintenanceAlertModal.tsx` lines 70-75):
```tsx
<button
  onClick={onDismiss}
  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
>
  Got it
</button>
```
**After** (`px-5 py-2` is closest to `md`; `bg-blue-600` → primary):
```tsx
<Button onClick={onDismiss}>
  Got it
</Button>
```

---

## Pattern Assignments — Tooling Files

### `scripts/lint-no-raw-html.mjs` (new file)

**Closest analog:** `scripts/generate-icons.mjs`

**Analog pattern** (`scripts/generate-icons.mjs` lines 1-3):
```js
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
```

**Pattern to copy:** ESM `.mjs` with named imports from Node built-ins only (no `__dirname` hack needed in ESM). The analog script uses `async function main()` + `main().catch(console.error)` — use the same entry-point pattern for the lint script, but synchronous since `readFileSync` is used.

**Target file content** (from RESEARCH.md §Lint Guard Mechanism, verbatim):
```js
// scripts/lint-no-raw-html.mjs
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

**`package.json` wiring** — the current `build` script (line 8 of package.json) is `"tsc -b && vite build"`. Update to:
```json
{
  "scripts": {
    "lint:no-raw-html": "node scripts/lint-no-raw-html.mjs",
    "build": "node scripts/lint-no-raw-html.mjs && tsc -b && vite build",
    "prepare": "chmod +x .git/hooks/pre-commit 2>/dev/null || true"
  }
}
```

---

### `.git/hooks/pre-commit` (new file — not git-tracked)

**No analog** in codebase. Shell hook file.

```sh
#!/usr/bin/env sh
node scripts/lint-no-raw-html.mjs
```

**Installation command** (executor runs this after creating file):
```bash
chmod +x .git/hooks/pre-commit
```

**Note:** `.git/hooks/` is not tracked by git. The `prepare` npm script above (`chmod +x .git/hooks/pre-commit 2>/dev/null || true`) re-enables it automatically after `npm install` on a fresh clone.

---

## No Analog Found (No Primitive Covers These — All Require `// allow-raw-html`)

| File | Line (approx) | Element | Reason |
|------|---------------|---------|--------|
| `GcodeImport.tsx` | ~281 | `<input type="file">` | Hidden file picker with `ref`; primitive styles would apply beneath `hidden` |
| `CsvImportModal.tsx` | ~311 | `<input type="file">` | Same as above |
| `CsvImportModal.tsx` | ~416 | `<input type="radio" name="duplicateMode">` | Radio groups; `accent-blue-500` breaks under Input base styles |
| `CsvImportModal.tsx` | ~426 | `<input type="radio" name="duplicateMode">` | Same radio group |
| `CsvImportModal.tsx` | ~489 | `<input type="checkbox">` | Checkbox with `accent-blue-500` |
| `BambuImport.tsx` | ~199 | `<input type="checkbox">` | Checkbox |
| `CostCalculator.tsx` | ~828 | `<input type="checkbox">` | Checkbox |
| `SettingsModal.tsx` | tab buttons | `<button>` with conditional class | Active-state `border-b-2 border-blue-400` not in any variant |
| `AssetLibrary.tsx` | filter tab buttons | `<button>` with conditional class | Active/inactive class-switch pattern |
| `ImageCarousel.tsx` | dot indicators | `<button>` with conditional width | `w-6`/`w-2.5` dynamic sizing, no children |

Total opt-outs: **10 elements across 5 files**

---

## Complete Allow-Raw-HTML Inventory

```
GcodeImport.tsx         : 1 (file input)
CsvImportModal.tsx      : 4 (1 file input, 2 radio, 1 checkbox)
BambuImport.tsx         : 1 (checkbox)
CostCalculator.tsx      : 1 (checkbox)
SettingsModal.tsx       : N tab buttons (conditional class — count from source)
AssetLibrary.tsx        : N+1 filter tab buttons (conditional class)
ImageCarousel.tsx       : N dot indicator buttons (conditional width)
```

---

## Metadata

**Analog search scope:** `src/components/`, `src/components/ui/`, `scripts/`
**Files scanned:** 14 component files + 5 primitive files + 2 existing scripts
**Primitive API verified:** Direct source read of all 5 ui/ files (Button, Input, Select, Textarea, Card, index.ts)
**Raw element counts verified:** From RESEARCH.md §In-Scope File Inventory (fresh grep 2026-05-19)
**Pattern extraction date:** 2026-05-19
