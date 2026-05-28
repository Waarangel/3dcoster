# Phase 26: v1.3 cleanup — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 26-v1-3-cleanup-flip-validation-md-statuses-sync-requirements-m
**Areas discussed:** Customer template emoji prefix, wave_0_complete semantics, scope expansion

---

## Customer template emoji prefix

| Option | Description | Selected |
|--------|-------------|----------|
| 👤 (single person) | Simplest, common in iconography. "👤 Customer template". Matches the idea of a single customer record. | |
| 📇 (rolodex card) | Stronger 'customer records / contacts' semantic. "📇 Customer template". Better visual link to a CSV row = contact card metaphor. | |
| 👥 (multiple people) | Implies multiple customers (the CSV import is bulk). "👥 Customer template". Aligns with bulk-import context. | ✓ |

**User's choice:** 👥 (multiple people)
**Notes:** Reinforces the bulk-import semantic of CSV upload. Matches the visual weight of `📦 Materials template` / `🖨️ Printers template` in the asset import modal at `CsvImportModal.tsx:243-251`.

---

## VALIDATION.md `wave_0_complete` semantics (Phases 18, 20, 22, 22.1)

| Option | Description | Selected |
|--------|-------------|----------|
| Leave false (factual) | These phases did not run a Wave 0 fail-first test suite — flipping to true would be inaccurate. Status semantics: "verified after the fact, not designed with Nyquist Wave 0 contract upfront". Cleanest historical record. | |
| Flip to true (semantic match) | Treat "all must-haves verified" as semantically equivalent to wave_0_complete=true. Avoids future audits flagging these as Nyquist-incomplete. Slight historical drift but practical. | ✓ |

**User's choice:** Flip to true (semantic match)
**Notes:** Acknowledged historical drift. "Verified retroactively" is treated as semantically equivalent to "passed Wave 0" for milestone-audit purposes. Captured as D-03 in CONTEXT.md.

---

## Scope check — anything to add or remove?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is: 3 items | VALIDATION.md flips (Phases 18, 20, 22, 22.1) + REQUIREMENTS.md sync (DATA-07, PERF-08) + Customer Import modal layout parity. Ship and tag v1.3. | |
| Also wire customer CSV export | Add customer CSV export feature (the Phase 21 SC#5 gap) to close that scope cleanly before v1.3 ships. ~1 extra plan, ~30min of work. You said "I don't care right now" earlier — this would change that. | |
| Also flip Phase 19, 23, 24, 25 missing VALIDATION.md | Backfill Nyquist VALIDATION.md for the 4 missing phases. They are a11y/test/doc/hygiene phases that arguably don't need Nyquist, but the audit flagged them — backfilling would make Nyquist coverage 100%. Probably overkill. | ✓ |

**User's choice:** Also flip Phase 19, 23, 24, 25 missing VALIDATION.md
**Notes:** Scope expands from 3 tracks to 4 tracks. Customer CSV export remains deferred (user already confirmed deprioritization in Phase 21 UAT). Backfill content is mined from existing VERIFICATION.md "Observable Truths" / "Score" tables — no re-verification work, just documentation. Captured as D-05 + D-06 in CONTEXT.md.

---

## Claude's Discretion

- Plan structure (1 plan covering all 4 tracks vs 2-4 plans grouped by file type) — researcher/planner picks based on overlap. Files modified are non-overlapping across tracks, so parallel waves are possible.
- VALIDATION.md template body for backfilled phases (19, 23, 24, 25) — researcher picks the closest analog from existing VALIDATION.md files in the project.
- Exact commit message conventions per track — follow existing 3DCoster patterns (`docs(26-NN): ...`, `chore(26-NN): ...`).

## Deferred Ideas

- **Customer CSV export feature** — Phase 21 SC#5 gap; user deprioritized 2026-05-28 ("I don't care right now"). When needed, route through `sanitizeCsvCell` per Phase 21 D-02.
- **VoiceOver UAT for Phase 19** — A11Y screen-reader confirmation; deferred to v1.4+ per Phase 19 VERIFICATION.
- **Phase 04 / Phase 09 `human_needed` VERIFICATION** — pre-v1.3 (v1.0/v1.1 era); address in v1.4 retro pass if at all.
- **Phase 15 / 17 / 20 CONTEXT.md `open_questions`** — phases shipped; stale planning-time artifacts, not blockers.
