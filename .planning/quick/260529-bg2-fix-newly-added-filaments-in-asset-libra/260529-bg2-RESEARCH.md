# Quick Task bg2: Fix newly-added filaments not appearing in Cost Calculator dropdown — Research

**Researched:** 2026-05-29
**Domain:** React form/save layer + Dexie liveQuery read layer + one-time reconcile
**Confidence:** HIGH (every claim cited against current v1.4.0 source)

## Summary

A user-added filament disappears from the Cost Calculator's `FilamentSelector` because of **two independently fatal gates** plus **one latent gate**, all in current v1.4.0 code. The selector filter is a single line:

```ts
// FilamentSelector.tsx:34
const filaments = materials.filter(m => m.category === 'filament' && m.currency === userCurrency);
```

Both conjuncts can fail for a legitimately-added filament:

1. **CURRENCY gate (always fires).** The material add form has **no currency input**. `handleSubmit` writes `currency: formData.currency`, which is `undefined` for every new material (`AssetLibrary.tsx:629`). `undefined === userCurrency` is never true → the row is dropped 100% of the time, regardless of category. **This is the primary cause and it fires on every single user-add path.**
2. **CATEGORY gate (fires on the most common path).** From the default **"All" tab**, `startAdding()` seeds `category: 'consumable'` (`AssetLibrary.tsx:675`). Unless the user manually changes the Category dropdown to "Filament", the row saves as `consumable` and fails `m.category === 'filament'`.
3. **BRAND gate (latent — fires only after the other two are fixed).** `FilamentSelector` builds its menu by grouping on `f.brand` and **silently skips brand-less filaments** (`FilamentSelector.tsx:38-44`): the `brands` Set only adds `if (f.brand)`. A filament that survives the category+currency filters but has no brand renders **zero menu rows** — it exists in `filaments` but no `<brand>` group contains it.

There is also a **pre-existing latent defect worth flagging**: the default user currency is `'CAD'` (`useDatabase.ts:329`) but every seeded Bambu filament is `'USD'` (`bambuFilaments.ts:18`). So a brand-new user who never changes currency away from CAD sees an **empty filament dropdown even for the defaults**. The currency gate is therefore broader than "new filaments" — it's a systemic CAD-vs-USD mismatch.

**Primary recommendation:** Fix at BOTH layers. (1) Thread `userCurrency` into `AssetLibrary` and default a new material's `currency` to it on save; also force `category: 'filament'` semantics correctly. (2) Make `FilamentSelector` resilient: render brand-less filaments under an "Unbranded" group, and (decision needed, see Pitfalls) consider relaxing the hard currency equality so legacy `undefined`/mismatched rows are not invisible. (3) Ship a one-time idempotent reconcile (`reconcileFilamentCurrency`) following the exact `reconcileQuoteCurrency` pattern to heal already-saved `currency: undefined` filaments in production.

## Root-Cause Confirmation (per gate, with file:line)

### The persisted shape of a user-added material
`AssetLibrary.handleSubmit` (material branch) builds the row at `AssetLibrary.tsx:617-631`:

```ts
const material: Asset = {
  id: editingId || `material-${Date.now()}`,
  name: formData.name,
  category: finalCategory as AssetCategory,   // from formData.category / custom input
  unit: formData.unit,
  costPerUnit: formData.packageCost / formData.unitsPerPackage,
  unitsPerPackage: formData.unitsPerPackage,
  packageCost: formData.packageCost,
  lifespanUnits: formData.lifespanUnits,
  notes: formData.notes,
  brand: formData.brand,                      // undefined unless user typed a brand
  filamentType: formData.filamentType,        // ALWAYS undefined — no UI input exists
  currency: formData.currency,                // ALWAYS undefined — no UI input exists
  tags: formData.tags,
};
```

`onAddAsset` → `useAssets.addAsset` → `db.materials.add(asset)` (`useDatabase.ts:98-100`). No normalization happens in between. So the saved row has `currency: undefined`, `brand: undefined` (unless typed), `filamentType: undefined` (always), and a category determined by the add path.

### Gate 1 — CURRENCY (`FilamentSelector.tsx:34`) — **FIRES ALWAYS**
- The material form (`AssetLibrary.tsx:1004-1054`) renders Unit, Package Cost, Units per Package, Lifespan. **There is no currency field anywhere in the material branch.** `formData.currency` is therefore never set.
- Saved `currency: undefined` (line 629). Filter requires `m.currency === userCurrency` → `undefined === 'CAD'` (or any currency) is `false`. **Row dropped on every add path, every time.**
- Corroboration that this is the real gate: the user already confirmed that defaulting a new filament's currency to `userCurrency` made it appear. Confirmed in code.
- **Compounding blocker:** `AssetLibrary` is **not passed `userCurrency`** today. App.tsx threads `userProfile.currency` into `FilamentSelector`/CostCalculator/JobsManager (`App.tsx:234, 294, 310`) but the `<AssetLibrary>` element (`App.tsx:319-330`) receives **no currency prop**. So the form literally has no value to default to until we thread it.

### Gate 2 — CATEGORY (`FilamentSelector.tsx:34`) — **FIRES ON THE "ALL" TAB PATH**
Enumerate the add paths:

| Path | Seed category | Result if user doesn't touch Category dropdown |
|------|---------------|------------------------------------------------|
| "All" tab → "+ Add Asset" (`startAdding`, line 673-681) | `'consumable'` (line 675) | Saves as `consumable` → **fails category filter** |
| "Filament" tab → "+ Add Filament" (`startAdding`, line 675) | `filterCategory` = `'filament'` | Saves as `filament` → passes category |
| Empty-state CTA on "All" / non-printer (`startAddingForEmptyState`, line 691-699) | `'filament'` (line 693) | Saves as `filament` → passes category |
| User manually picks "Filament" in the Category `<Select>` (line 912-920) | n/a | Saves as `filament` → passes category |

So a user who adds from the default **"All"** tab (the landing tab) and leaves Category at its default gets `consumable` and the filament never reaches the selector — **even after the currency gate is fixed**. This is a real, separate failure mode for the most common entry point.

### Gate 3 — BRAND (`FilamentSelector.tsx:38-49`) — **LATENT, fires after gates 1+2 are fixed**
```ts
const brands = useMemo(() => {
  const brandSet = new Set<string>();
  filaments.forEach(f => { if (f.brand) brandSet.add(f.brand); });  // brand-less skipped
  return Array.from(brandSet).sort();
}, [filaments]);
const getFilamentsForBrand = (brand: string) => filaments.filter(f => f.brand === brand);
```
The dropdown body maps over `brands` only (`FilamentSelector.tsx:122-162`). A filament with `brand: undefined` is in `filaments` but in **no** brand group → it is **silently dropped from the rendered menu**. The Brand field on the form is explicitly "(optional)" (`AssetLibrary.tsx:937`), so brand-less filaments are a fully supported, expected shape — and they vanish.

### "Why a user filament disappears" — the narrative
1. User opens Asset Library (lands on "All" tab), clicks "+ Add Asset", fills Name/Unit/Package Cost/Units, optionally a Brand, clicks "Add Material".
2. Row persists with `category: 'consumable'` (All-tab default), `currency: undefined`, `filamentType: undefined`, `brand: <typed or undefined>`.
3. In the Cost Calculator, `FilamentSelector` filters `category === 'filament' && currency === userCurrency`. The row fails on **currency for sure**, and **also on category** if added from the All tab.
4. Even if the user correctly switches to the Filament tab (fixing category), the currency gate still drops it.
5. Even if both are fixed (or after our save-layer fix), a brand-less filament still renders no menu row.

## The Robust Complete Fix (recommendation)

Close every gate, at both layers, plus a reconcile. Order matters for robustness.

### A. Save layer (write correct data going forward) — `AssetLibrary.tsx` + `App.tsx`
1. **Thread `userCurrency` into AssetLibrary.** Add `userCurrency: Currency` to `AssetLibraryProps` (`AssetLibrary.tsx:9-20`) and pass `userCurrency={userProfile.currency}` at the call site (`App.tsx:319-330`). This mirrors the existing pattern used for the other three components.
2. **Default `currency` on material save.** In `handleSubmit`'s material branch (`AssetLibrary.tsx:617-631`), set `currency: formData.currency ?? userCurrency`. Use `??` (not `||`) so a future explicit-currency field still wins. This single line closes Gate 1 for all future adds.
3. **Category — recommend NOT silently forcing 'filament'.** The "All" tab default of `'consumable'` is intentional (most added assets are consumables). Forcing filament would be wrong for genuine consumables. Two acceptable options — recommend **(a)**:
   - **(a) Leave the category default as-is**; the real fix for "I added a filament but it's a consumable" is user-driven category selection, which already works. The currency + brand + reconcile fixes guarantee that a *correctly-categorized* filament always appears. (Minimal, correct.)
   - (b) Optionally add a small currency field to the material form so power users on multi-currency setups can override — but default it to `userCurrency`. (Larger UI change; see Pitfalls re: lint guard.)
   - The brief asks for "any filament a user *legitimately adds*." A consumable saved as consumable is not a legitimately-added *filament*; it is correctly excluded. So category does not need a forced override — it needs the existing manual selection to keep working, which it does.

### B. Read layer (tolerate legacy/missing values) — `FilamentSelector.tsx`
4. **Render brand-less filaments under an "Unbranded" group.** Change the `brands` builder and `getFilamentsForBrand` so filaments with no `brand` are bucketed under a synthetic group label (e.g. `'Unbranded'`). Recommended: compute groups from `f.brand || 'Unbranded'` and sort with `'Unbranded'` last. Closes Gate 3. Keep the submenu rendering identical.
5. **Currency tolerance (decision needed — see Pitfalls).** Recommended conservative form: keep the currency filter for correctly-tagged rows but **stop dropping rows whose `currency` is `undefined`** — treat a missing currency as "matches the user's currency" (legacy/unset rows belong to the user's locale by definition since there's no other currency context). i.e. `m.category === 'filament' && (m.currency === userCurrency || m.currency == null)`. This makes the selector resilient to any row the reconcile hasn't yet healed, and to any future code path that forgets to set currency. Do **not** show rows tagged with a *different explicit* currency (that's a real multi-currency mismatch the user should resolve), only `null`/`undefined` ones.

### Why both layers
- Save-layer fix prevents the bug for all new adds.
- Read-layer fixes (brand bucket + null-currency tolerance) make the selector robust to (i) the brand-less shape the form explicitly allows, (ii) any already-persisted `undefined` rows before the reconcile runs, and (iii) future regressions. Belt-and-suspenders per the user's "most robust and complete" requirement.

## Existing-Data Reconcile (mandatory per project convention)

Every already-saved filament in production has `currency: undefined` and is invisible right now. Per `feedback_reconcile_legacy_data` and the `backfill.ts` convention, ship a one-time idempotent reconcile. The closest analog is `reconcileQuoteCurrency` (`backfill.ts:268-279`).

### New pure helper — `src/db/backfill.ts`
Signature (illustrative only — do not implement here):
```ts
// reconcileFilamentCurrency — pure, idempotent, no Dexie/React/IO.
// Returns ONLY the rows needing a patch (empty array when nothing to do).
export function reconcileFilamentCurrency(materials: Material[], currency: string): Material[];
```
Rules (mirroring `reconcileQuoteCurrency`):
- Only touch `category === 'filament'` rows.
- Only patch rows where `currency == null` (undefined or null). **Never** clobber a row that already has an explicit currency — that would corrupt a deliberately-tagged USD seed or a multi-currency user's data.
- Set `currency: currency` (the user's current `userProfile.currency`) on the patched copy via spread (`{ ...m, currency }`) — never mutate the liveQuery cache entry.
- Idempotent: a second run finds no `null`-currency filaments → returns `[]`.

**What currency to assign legacy rows — recommendation:** assign `userProfile.currency`. This is the only currency context the app has for an untagged row, and it matches the user-confirmed fix behavior. **Cross-user-currency edge case:** the seeded Bambu filaments are explicitly `'USD'`, so they are *not* `null` and the reconcile **leaves them alone** — correct, because a CAD user who relies on the read-layer USD seeds is a separate concern (the latent CAD-vs-USD defect; flag it, don't auto-rewrite seed currencies, since their prices are genuinely USD-denominated). The reconcile only heals truly untagged user-added rows.

### Wiring — `src/hooks/useDatabase.ts` (inside `useAssets`)
Follow the exact `customerEmailLowercaseRan` / `copiesSoldReconcileRan` pattern (`useDatabase.ts:38, 821-844`):
- Add a module-scope flag: `let filamentCurrencyReconcileRan = false;` near the others (lines 12-38).
- In `useAssets`, add a `useEffect` keyed on `[assets === undefined]` that: bails if flag set or `assets === undefined`; computes `patches = reconcileFilamentCurrency(assets, profile.currency)`; if non-empty, `await db.materials.bulkPut(patches)` inside (or without) a transaction; **sets the flag AFTER the await completes** (WR-01 hardening — failures leave flag false so next mount retries); wraps in try/catch that logs and does NOT throw.
- **Currency source:** `useAssets` does not currently read `useUserProfile`. Either (a) read the profile via `getUserProfile(...)` inside the effect (one-shot async read, like `usePrinterSettings` at line 269-274), or (b) read it from the settings table directly inside the effect to avoid coupling the hook to React profile state. Recommend (a) — call `getUserProfile(defaultProfile)` inside the effect to get the persisted currency, consistent with the existing settings-read helpers. Note the default profile currency is `'CAD'` (line 329).

## Pitfalls / Edge Cases

1. **CAD-vs-USD systemic defect (flag, don't silently auto-fix).** Default profile currency is `'CAD'` (`useDatabase.ts:329`) but all seeded Bambu filaments are `'USD'` (`bambuFilaments.ts:18`). A fresh default user sees an **empty dropdown for the seeds too**. The read-layer null-tolerance fix does NOT help here (seeds are explicitly USD, not null). The brand bucket fix doesn't help either. This means the recommended read-layer currency rule (`=== userCurrency || == null`) still hides USD seeds from a CAD user. **Decision for planner/user:** do we (i) also show seeds when the user has no filaments in their currency, (ii) convert seed prices, or (iii) accept this as out-of-scope for this bug? Recommend surfacing this explicitly to the user — it's adjacent but distinct from "newly-added filaments." Do NOT invent an FX conversion (no data point; violates the "no arbitrary numbers" rule).
2. **Do not clobber explicit currencies in the reconcile.** Only `null`/`undefined` rows. A multi-currency user may have deliberately tagged some filaments USD and others EUR. Patching anything non-null would silently corrupt their data.
3. **Never mutate the Dexie `useLiveQuery` cache.** All reconcile patches must be spread copies (`{ ...m, currency }`), exactly as `reconcileQuoteCurrency` and the tag-normalize reconcile do (`useDatabase.ts:601-602` comment is explicit about this). Mutating cache entries causes phantom re-renders / cache corruption.
4. **Idempotency on repeat launches.** Module-scope `let ...Ran = false` flag + row-level idempotency in the pure helper (returns `[]` when nothing needs patching) → subsequent loads pay zero write cost. Set the flag only after the `await bulkPut` resolves (WR-01).
5. **`useAssets` has no `jobs`-style first-emission guard today.** The existing reconciles live in `useJobs`/`useCustomers` and guard on `=== undefined` (first liveQuery emission). Replicate that guard in `useAssets`: `if (assets === undefined) return;` before computing patches. `useAssets` already has the `assets` liveQuery (line 42) and an init `useEffect` (line 46) — add the reconcile as a sibling effect, ordered AFTER init so seeds exist first.
6. **Pre-commit raw-HTML lint guard.** `scripts/lint-no-raw-html.mjs` forbids raw `<button|input|select|textarea>` in `src/components/` (except `ui/`). If option B (adding a currency field to the material form) is chosen, it MUST use the shared `Select` from `./ui` (already imported, `AssetLibrary.tsx:5`) — never a raw `<select>`. The read-layer and save-layer recommended fixes add no new form controls, so they're safe.
7. **`materials` table is indexed on `currency`** (`database.ts:25` and all versions). Writing `currency` on existing rows via `bulkPut` updates the index automatically — no schema migration needed (the field already exists in the schema string across all 9 versions). No `db.version().upgrade()` callback required; the module-flag reconcile pattern is the established mechanism (no meta table exists, per `useDatabase.ts:26` comment).
8. **`filamentType` is never set by the form either** (`AssetLibrary.tsx:628` reads `formData.filamentType`, which has no input). This is not a *gate* (FilamentSelector falls back to `f.name` at line 156), but it means user-added filaments show their full name instead of a type label. Out of scope for the disappearance bug, but worth noting if the user wants parity with seeded entries.

## Files & Exact Lines (reference map)

| Concern | File:Line |
|---------|-----------|
| Selector currency+category filter | `src/components/FilamentSelector.tsx:34` |
| Selector brand grouping (drops brand-less) | `src/components/FilamentSelector.tsx:38-49`, render `:122-162` |
| Material save (currency/filamentType undefined) | `src/components/AssetLibrary.tsx:617-631` |
| "All" tab add seeds `consumable` | `src/components/AssetLibrary.tsx:673-681` |
| Empty-state CTA seeds `filament` | `src/components/AssetLibrary.tsx:691-699` |
| AssetLibrary props (no userCurrency) | `src/components/AssetLibrary.tsx:9-20` |
| AssetLibrary call site (no userCurrency passed) | `src/App.tsx:319-330` |
| addAsset → db.materials.add | `src/hooks/useDatabase.ts:98-100` |
| Default profile currency = CAD | `src/hooks/useDatabase.ts:329` |
| Reconcile pattern analog | `src/db/backfill.ts:268-279` (`reconcileQuoteCurrency`) |
| Reconcile wiring pattern | `src/hooks/useDatabase.ts:38, 821-844` (`customerEmailLowercaseRan`) |
| Seeded Bambu filaments are USD | `src/data/bambuFilaments.ts:18` |
| materials Dexie index includes currency | `src/db/database.ts:25` |
| Asset type (currency/brand/filamentType optional) | `src/types.ts:39-62` |
| Lint guard | `scripts/lint-no-raw-html.mjs:19` |

## Confidence

- Gate identification & firing conditions: **HIGH** — read full source of all paths.
- Recommended fix completeness: **HIGH** — both layers + reconcile close every confirmed gate.
- CAD-vs-USD systemic note: **HIGH** — confirmed default profile = CAD, seeds = USD.
