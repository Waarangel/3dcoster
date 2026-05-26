---
phase: 25-doc-hygiene-polish-bundle-health
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pdf/jspdf-augment.d.ts
  - src/pdf/generateQuotePdf.ts
autonomous: true
requirements: [POL-03]
must_haves:
  truths:
    - "src/pdf/jspdf-augment.d.ts exists and declares the jspdf module augmentation for lastAutoTable.finalY (POL-03)"
    - "src/pdf/generateQuotePdf.ts line ~161 uses doc.lastAutoTable.finalY directly (no `(doc as any)` cast) (POL-03)"
    - "tsc -b compiles cleanly with the augmentation; no new TypeScript errors introduced"
    - "npm run build (Vite/Rollup) succeeds with the new .d.ts file — no chunk-graph regressions, no Rollup errors on the type-only file"
    - "Plan scope follows D-01 (5 plans, surface-grouped, single wave, parallel-safe — this plan owns PDF files only) and D-01b (atomic commit; no --no-verify; gsd-sdk query commit helper)"
  artifacts:
    - path: "src/pdf/jspdf-augment.d.ts"
      provides: "jspdf module augmentation for lastAutoTable.finalY"
      contains: "declare module 'jspdf'"
      min_lines: 3
    - path: "src/pdf/generateQuotePdf.ts"
      provides: "Cast-free access to doc.lastAutoTable.finalY"
      contains: "doc.lastAutoTable.finalY"
  key_links:
    - from: "src/pdf/generateQuotePdf.ts"
      to: "src/pdf/jspdf-augment.d.ts"
      via: "TypeScript auto-discovery of .d.ts files in compile root"
      pattern: "lastAutoTable\\.finalY"
---

<objective>
Replace the `(doc as any).lastAutoTable.finalY` cast in `src/pdf/generateQuotePdf.ts` (line ~161) with a TypeScript module augmentation. Per POL-03 (REQUIREMENTS.md line 92) the augmentation is exactly:

```typescript
declare module 'jspdf' {
  interface jsPDF { lastAutoTable: { finalY: number } }
}
```

Per D-Claude's-Discretion (25-CONTEXT.md `<decisions>` "POL-03 file location"): create as a separate `src/pdf/jspdf-augment.d.ts` rather than co-located inside `generateQuotePdf.ts`. Rationale: TypeScript auto-discovers `.d.ts` files in `src/` (the compile root); keeps `generateQuotePdf.ts` clean of top-of-file augmentation noise; the augmentation is under 10 lines so the cost of a separate file is minimal.

Purpose:
- POL-03: eliminate the `(doc as any)` cast at `src/pdf/generateQuotePdf.ts` line 161 by giving TypeScript first-class knowledge of the `lastAutoTable.finalY` field that `jspdf-autotable` mutates on the `jsPDF` instance at runtime. Closes [v1.2-CODE-AUDIT #14] (MEDIUM).
- Verification: `tsc -b` must exit 0 (Vercel uses `tsc -b && vite build`); `npm run build` must exit 0 (Vite/Rollup must not choke on the new `.d.ts` file).

Output: 2 files (1 new, 1 modified) in a single atomic commit (POL-03 is one logical change — the new `.d.ts` enables the cast removal; splitting into 2 commits would leave the codebase momentarily uncompilable between them).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md
@.planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md
@src/pdf/generateQuotePdf.ts
@src/globals.d.ts
@tsconfig.json

<interfaces>
<!-- Extracted from 25-PATTERNS.md + REQUIREMENTS.md POL-03 lock -->

Exact augmentation block (REQUIREMENTS.md POL-03, line 93–97):
```typescript
declare module 'jspdf' {
  interface jsPDF { lastAutoTable: { finalY: number } }
}
```

Current cast site — src/pdf/generateQuotePdf.ts line 161 (per 25-PATTERNS.md):
```typescript
// BEFORE:
return (doc as any).lastAutoTable.finalY as number;

// AFTER (once augmentation is in place):
return doc.lastAutoTable.finalY;
```

Function context: `renderLineItems` function, lines 129–162. Only line 161 is touched.

Ambient declaration analog — src/globals.d.ts (lines 1–3) shows the project's existing ambient-decl idiom (`declare const __IS_TAURI__: boolean`). Different mechanism (`declare const` vs `declare module`) but same auto-discovered-by-TypeScript pattern.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: POL-03 — create jspdf-augment.d.ts + remove cast in generateQuotePdf.ts</name>
  <files>
    src/pdf/jspdf-augment.d.ts,
    src/pdf/generateQuotePdf.ts
  </files>
  <read_first>
    - src/pdf/generateQuotePdf.ts (FULL FILE — verify line 161 still contains `(doc as any).lastAutoTable.finalY as number`; line may have drifted; locate via `grep -n "lastAutoTable.finalY" src/pdf/generateQuotePdf.ts`)
    - src/globals.d.ts (lines 1–3 — confirm the project's ambient-decl pattern; serves as a reference for `.d.ts` file convention)
    - tsconfig.json (confirm `src/` is in `include` so `.d.ts` files in `src/pdf/` are auto-picked up; if `include` is narrower than expected, the .d.ts may need to be relocated)
    - .planning/REQUIREMENTS.md (POL-03 line 92–98 — EXACT augmentation block locked)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`src/pdf/jspdf-augment.d.ts — NEW file (POL-03)` section + `src/pdf/generateQuotePdf.ts — POL-03` section)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md (`Claude's Discretion` → POL-03 file location: separate `.d.ts` recommended)
    - package.json (read jspdf + jspdf-autotable versions — informational, no edits)
  </read_first>
  <action>
    Per POL-03 (REQUIREMENTS.md line 92–98) + 25-CONTEXT.md Claude's Discretion (separate `.d.ts` file) + 25-PATTERNS.md:

    STEP 1 — Pre-flight grep to confirm cast location:
    `grep -n "lastAutoTable" src/pdf/generateQuotePdf.ts`
    Confirm there is exactly one `(doc as any).lastAutoTable.finalY` cast (per 25-PATTERNS.md, line 161 in `renderLineItems`). If the grep returns multiple `(doc as any)` casts on `lastAutoTable`, the action below applies to ALL of them; if there are other unrelated `(doc as any)` casts, leave those — POL-03 scope is `lastAutoTable.finalY` only.

    STEP 2 — Create new file `src/pdf/jspdf-augment.d.ts` with EXACT content (matching REQUIREMENTS.md line 93–97 verbatim):

    ```typescript
    // Module augmentation for jspdf-autotable's runtime side-effect on jsPDF.
    // The autotable plugin mutates the jsPDF instance to expose `lastAutoTable.finalY`
    // (the Y coordinate immediately below the last rendered table), but the upstream
    // @types/jspdf does not declare this field. This augmentation gives TypeScript
    // first-class knowledge of the field so consumers (src/pdf/generateQuotePdf.ts)
    // can read `doc.lastAutoTable.finalY` without an `(doc as any)` escape hatch.
    //
    // Closes v1.3 POL-03 (REQUIREMENTS.md). Auto-discovered by tsc because src/ is
    // in tsconfig.json's `include`. No runtime impact — pure type-only declaration.

    declare module 'jspdf' {
      interface jsPDF { lastAutoTable: { finalY: number } }
    }
    ```

    The leading comment block is the executor's documentation choice (within the "under 10 lines" Claude's Discretion guidance — the JSDoc-style comment is informational, not load-bearing). The `declare module 'jspdf'` block at the end is the locked content per REQUIREMENTS.md.

    STEP 3 — Edit `src/pdf/generateQuotePdf.ts` line ~161 (in `renderLineItems`):

    BEFORE: `return (doc as any).lastAutoTable.finalY as number;`
    AFTER:  `return doc.lastAutoTable.finalY;`

    Drop both the `(doc as any)` cast AND the trailing `as number` assertion — the augmentation declares `finalY: number`, so the type is inferred.

    STEP 4 — Verify TypeScript picks up the augmentation:
    `tsc -b 2>&1 | tee /tmp/25-04-tsc.log`
    MUST exit 0. If `tsc -b` reports `Property 'lastAutoTable' does not exist on type 'jsPDF'`, the augmentation file is not being picked up. Common causes:
    - `tsconfig.json` `include` does not cover `src/pdf/*.d.ts` — uncommon, since `src/**/*` is the typical include
    - The file extension is wrong (`.ts` vs `.d.ts`) — must be `.d.ts`
    - The file location is outside the include root — relocate to `src/pdf/jspdf-augment.d.ts` (the spec-recommended location)

    Fallback: If `tsc -b` cannot pick up the separate `.d.ts` file after debugging, fall back to the co-located approach (per CONTEXT.md Claude's Discretion alternative): put the same `declare module 'jspdf'` block at the top of `src/pdf/generateQuotePdf.ts` (under existing imports, above the function declarations). Note the fallback choice in the plan summary.

    STEP 5 — Verify Vite/Rollup is happy:
    `npm run build 2>&1 | tee /tmp/25-04-build.log`
    MUST exit 0. The new `.d.ts` file is a type-only declaration — Vite should not emit it as a chunk (TypeScript strips it at compile time). Confirm the build output doesn't include a `jspdf-augment` chunk.

    STEP 6 — Confirm the cast is fully gone:
    `grep "doc as any" src/pdf/generateQuotePdf.ts`
    MUST return 0 matches related to `lastAutoTable` (other `(doc as any)` casts unrelated to `lastAutoTable` are out of scope — leave them).

    Commit AS A SINGLE ATOMIC COMMIT (per D-01b) since the two-file change is one logical step. Commit message focus: `refactor(25-04): replace (doc as any) cast with jspdf module augmentation (POL-03)`.
  </action>
  <verify>
    <automated>test -f src/pdf/jspdf-augment.d.ts && grep -q "declare module 'jspdf'" src/pdf/jspdf-augment.d.ts && grep -q "lastAutoTable: { finalY: number }" src/pdf/jspdf-augment.d.ts && ! grep -E "\(doc as any\)\.lastAutoTable" src/pdf/generateQuotePdf.ts && grep -q "doc\.lastAutoTable\.finalY" src/pdf/generateQuotePdf.ts && tsc -b > /tmp/25-04-tsc-verify.log 2>&1 && npm run build > /tmp/25-04-build-verify.log 2>&1 && echo "POL-03 pass: augmentation + cast removed + tsc -b + npm run build all clean"</automated>
  </verify>
  <done>
    `src/pdf/jspdf-augment.d.ts` exists with the locked augmentation block; `src/pdf/generateQuotePdf.ts` no longer has `(doc as any).lastAutoTable` (grep returns 0); reads `doc.lastAutoTable.finalY` directly; `tsc -b` exits 0; `npm run build` exits 0; commit landed via `gsd-sdk query commit` (no `--no-verify`).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| build-time only | The new `.d.ts` is a TypeScript declaration file — zero runtime impact. Stripped at compile time. No new code paths, no new dependencies, no user-input surface. |
| jsPDF + jspdf-autotable trust | The augmentation merely declares a field that `jspdf-autotable` mutates at runtime. The trust assumption (autotable always populates `lastAutoTable.finalY` after `autoTable()` is called) is unchanged from the prior `(doc as any)` cast — the augmentation just makes the assumption type-checked. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25-04-01 | Tampering | `.d.ts` build-time declaration | accept | TypeScript declaration files are stripped at compile time — they cannot execute, mutate runtime, or be served to clients. The augmentation only loosens TypeScript's type model; it does not change runtime behavior. |
| T-25-04-02 | Spoofing | jspdf module augmentation | accept | Augmentation targets the published `jspdf` module name only. Cannot spoof a different module. The interface merge is additive — `jspdf`'s declared types are unchanged elsewhere. |
| T-25-04-03 | Information disclosure | Augmentation file in repo | accept | File contains only type declarations and a comment explaining the augmentation's purpose. No secrets, no PII. |
| T-25-04-SC | Tampering | npm/pip/cargo installs | mitigate | N/A — no package installs in this plan. RESEARCH.md Package Legitimacy Audit table not required. |

**ASVS Level 1** — pure type-only declaration file with zero runtime surface. Block threshold: HIGH severity (none present).
</threat_model>

<verification>
- `test -f src/pdf/jspdf-augment.d.ts` exits 0 (file created)
- `grep "declare module 'jspdf'" src/pdf/jspdf-augment.d.ts` returns ≥ 1 line
- `grep "lastAutoTable: { finalY: number }" src/pdf/jspdf-augment.d.ts` returns ≥ 1 line (locked content per REQUIREMENTS.md)
- `grep -E "\(doc as any\)\.lastAutoTable" src/pdf/generateQuotePdf.ts` returns 0 matches (cast removed)
- `grep "doc\.lastAutoTable\.finalY" src/pdf/generateQuotePdf.ts` returns ≥ 1 line (replacement in place)
- `tsc -b` exits 0 (Vercel build chain compatibility — per project CLAUDE.md `.claude/CLAUDE.md`)
- `npm run build` exits 0 with no NEW Rollup warnings (any existing chunk-graph warnings unchanged — Plan 25-05's territory; the .d.ts is type-only and should not affect chunk output)
- Build output does NOT contain a `jspdf-augment*.js` chunk (`.d.ts` stripped at compile time): `! ls dist/assets/jspdf-augment*.js 2>/dev/null`
- 1 atomic commit via `gsd-sdk query commit`; no `--no-verify`.
</verification>

<success_criteria>
- POL-03 closed: `(doc as any).lastAutoTable.finalY` cast eliminated from `src/pdf/generateQuotePdf.ts`; replaced by direct `doc.lastAutoTable.finalY` access against the augmented `jsPDF` interface
- New file `src/pdf/jspdf-augment.d.ts` exists with the REQUIREMENTS.md-locked augmentation block
- `tsc -b` exits 0
- `npm run build` exits 0; no new Rollup warnings introduced; no new chunk emitted for the .d.ts file
- 1 atomic commit landed
- No `features.ts` entries added; no `<NewBadge>` JSX added (Phase 25 rule — type-augmentation is internal hardening, not user-facing)
</success_criteria>

<output>
Create `.planning/phases/25-doc-hygiene-polish-bundle-health/25-04-SUMMARY.md` on completion. Capture: (1) the exact content of the new `src/pdf/jspdf-augment.d.ts` file (paste it), (2) the before/after of line ~161 in `generateQuotePdf.ts` (paste both), (3) confirmation `tsc -b` exits 0 (paste tail of `/tmp/25-04-tsc-verify.log`), (4) confirmation `npm run build` exits 0 (paste tail of `/tmp/25-04-build-verify.log` showing chunk list — confirm no `jspdf-augment` chunk), (5) which file-location decision was used (separate `.d.ts` per spec recommendation, or co-located fallback if needed), (6) jspdf + jspdf-autotable versions from `package.json` (informational, traceability for future maintainers).
</output>
</content>
</invoke>