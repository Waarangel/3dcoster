---
status: complete
phase: 15-tags-search-quick-duplicate
source: 15-12-SUMMARY.md (Round 2)
round: 2
gap_focus: E
verdict: gap-free
started: 2026-05-25T00:30:00Z
updated: 2026-05-25T00:45:00Z
completed: 2026-05-25T00:45:00Z
---

## Current Test

[testing complete — all 8 tests passed; verdict gap-free]

## Tests

### 1. Inline chip strip renders in the title row
expected: On the My Jobs tab, each saved job that has tags shows its tag chips INLINE in the title row — to the right of the job title — not in a separate strip below the filament/print-time meta line. DOM order inside the title row reads: chevron → title → tag chip(s) → `+` → Tag icon (on hover) → break-even pill.
result: pass

### 2. Hover ✕ removes a tag
expected: Hover any tag chip in the title row; a small ✕ button fades in at the top-right of the chip. Single-click removes that tag from the job. The chip disappears from the row immediately (Dexie liveQuery refresh). No confirmation modal.
result: pass

### 3. `+` add-tag opens narrow inline input with usage-suggesting placeholder
expected: A small `+` affordance sits at the end of the chip strip (visible on title-row hover, or always visible if the row has no tags yet). Clicking the `+` reveals a NARROW inline `<input>` (max ~12 characters wide) at the same spot. Its `placeholder` attribute reads `"trending, popular, out of date"`. Type a tag name and press Enter; the new chip appears in the row immediately.
result: pass

### 4. Title click → edit in place (no dropped-down panel)
expected: Click the job title text. The title text is REPLACED by an `<input>` AT THE SAME LOCATION — the input sits where the title was, and the layout above/below the title row does NOT shift. No new row appears below the title. Pressing Enter saves the renamed title; Escape cancels and restores the original title text. Blurring (clicking elsewhere) saves if non-empty, cancels if empty.
result: pass

### 5. 10-tag cap: `+` hides at cap, reappears when a tag is removed
expected: Add tags to a job until it has 10 tags total (use ✕ to remove and `+` to add until you confirm the cap). At 10 tags, the `+` button disappears from the chip strip — no add affordance is visible. Remove one tag via ✕; the `+` reappears immediately.
result: pass

### 6. Tag icon hover affordance + NEW badge (D-18)
expected: Hover the title row. A small Tag icon fades in just before the break-even pill, with a green "NEW" badge overlaid at its top-right corner (project NewBadge — `feature="tags"`). Clicking the Tag icon opens the same narrow `+` add-tag inline `<input>` from test 3 (with the same placeholder). The icon's role is "add tag via shortcut" — it does NOT open a dropped-down panel.
result: pass

### 7. Narrow-viewport overflow: chips wrap below title (D-16)
expected: Open Chrome DevTools device emulator (or resize the window) to a width ≤ 400px (e.g. iPhone SE preset, 375px). On a JobCard with 3+ tags, the chips that don't fit on the title row wrap to a second line BELOW the title (still attached to the same JobCard). No horizontal scrollbar appears on the row. No chips are truncated or hidden behind a "+N more" affordance. The chevron + title stay on the first line.
result: pass

### 8. Regressions stay closed (Gap A / Gap C / Gap D)
expected: Three quick checks that the prior gap closures still hold:
  - **Gap A:** Switch to the Cost Calculator tab. The save section has NO "Tags" input field anywhere (tags are not entered during costing).
  - **Gap C:** Back on My Jobs. There is NO chip-filter row above the virtualized job list (no per-tag selectable chips with counts like `pla · 3`). Only the search bar is at the top of the list. Searching for a non-existent term shows a "No jobs match your search" empty state with a "Clear search" link.
  - **Gap D:** On any JobCard, the action row has only Record Sale / Create Quote / Edit / Delete — no `[⋯]` overflow button, no Duplicate menu.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0
verbatim: "all approved. Well done. I could ask about colour options for tags, but I don't think it is important"

## Gaps

<!-- Empty — all 8 tests passed. -->

## Deferred Ideas Captured During UAT

- **Tag color options** — user raised the question of letting users pick a color per tag during Round 2 UAT, then explicitly self-deferred ("I don't think it is important"). NOT a gap; logged here so the idea isn't lost. If demand surfaces later, this would be a small enhancement: extend `PrintJob.tags` from `string[]` to `Array<{ name: string; color?: string }>` OR keep tags as strings and maintain a separate `tagColors: Record<string, string>` map; either approach is a v1.3+ candidate. The current uniform chip styling (`bg-slate-600/50 text-slate-400`) — D-11 byte-identical lock — would relax to allow per-tag color overrides.

## Post-Close Polish — Empty-State Tag Icon (commit `b8bbd2f`)

After the gap-free verdict landed, the user raised one UX refinement: when a job has zero tags, show the Tag icon as the always-visible add-tag affordance instead of the small `+` button. The `+` only appears when the job has 1+ tags.

**Decision:** Tag icon is hidden entirely when chips exist (1+ tags); `+` takes over at end of strip. At the D-02 cap of 10, both are hidden — the user removes a tag via ✕ first.

**Title-row add-tag affordance state machine:**

| `job.tags.length` | Visible affordance | NewBadge `feature="tags"` |
|---|---|---|
| 0 | Tag icon (always-visible) | on Tag icon |
| 1–9 | `+` button (end of chip strip) | hidden (Tag icon is gone) |
| 10 (cap) | none | hidden |

**Files changed:** `src/components/JobsManager.tsx`, `src/components/JobsManager.test.tsx` (+2 new tests: `(e)` 0 tags → Tag icon visible / `+` hidden; `(f)` `tags: undefined` vs `tags: []` both hit empty-state branch).

**Gates:** `tsc -b` exit 0; vitest 269 / 1 / 0 (was 267); build 2.23s, main chunk 61.5 KB gz; 7 LOCKED files byte-identical from pre-15-12 baseline. Verdict still `gap-free`.

**User verdict verbatim:** *"approved. Commit"* (2026-05-25)
