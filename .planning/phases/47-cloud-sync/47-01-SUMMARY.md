---
phase: 47-cloud-sync
plan: 01
subsystem: docs
tags: [gdpr, privacy-policy, data-flow-inventory, encryption, zero-knowledge]

# Dependency graph
requires:
  - phase: 46-white-label-quotes
    provides: Inventory-first GDPR discipline precedent (Pitfall C-05); Supabase eu-central-1 backend already listed as a processor
provides:
  - "docs/DATA-FLOW-INVENTORY.md sync-blob row: ciphertext-only description, D-08 minimal envelope, D-13 ~90-day retention"
  - "PrivacyPage.tsx disclosure of the cloud sync blob (zero-knowledge, retention, self-serve deletion), traced to the inventory"
  - "PrivacyPage.test.tsx regression guard preventing the cloud-sync disclosure from silently drifting/disappearing"
affects: [47-02, 47-03, 47-04, 47-05, 47-06, 47-07, 47-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inventory-first GDPR sequencing (42/43/46/47 precedent): docs/DATA-FLOW-INVENTORY.md updates before PrivacyPage.tsx, before any transmitting code ships"
    - "Extend existing processor entries instead of adding new ones when no new network origin is introduced"

key-files:
  created: []
  modified:
    - docs/DATA-FLOW-INVENTORY.md
    - src/pages/PrivacyPage.tsx
    - src/pages/PrivacyPage.test.tsx

key-decisions:
  - "Sync-blob inventory row lists exactly the four D-08 plaintext-envelope fields (account id, version counter, updated-at, blob size) and nothing else"
  - "No new connect-src origin added — Supabase Realtime (live push) reuses the existing *.supabase.co CSP allowlist entry from Phase 43"
  - "Cloud sync disclosed as an extension of the existing Supabase processor entry (not a new processor row) since it is the same backend/account"

patterns-established:
  - "Cloud-sync privacy disclosure lives in three PrivacyPage.tsx sections in lockstep: What we collect, Retention, Processors — all three must be touched together on future edits"

requirements-completed: [D-08, D-13, SYNC-02]

coverage:
  - id: D1
    description: "docs/DATA-FLOW-INVENTORY.md has a sync-blob row: ciphertext-only, D-08 minimal envelope, D-13 ~90-day retention, no new connect-src origin"
    requirement: "D-08"
    verification:
      - kind: other
        ref: "grep -qi ciphertext docs/DATA-FLOW-INVENTORY.md && grep -qi sync docs/DATA-FLOW-INVENTORY.md && grep -Eqi '90[ -]?day|~90' docs/DATA-FLOW-INVENTORY.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "PrivacyPage.tsx discloses the end-to-end encrypted cloud sync blob, ~90-day lapse retention, and self-serve deletion; PrivacyPage.test.tsx guards against drift"
    requirement: "D-13"
    verification:
      - kind: unit
        ref: "src/pages/PrivacyPage.test.tsx#discloses the end-to-end encrypted cloud sync blob, retention window, and self-serve deletion"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-24
status: complete
---

# Phase 47 Plan 01: GDPR Inventory-First Groundwork Summary

**Encrypted cloud-sync-blob data flow documented in DATA-FLOW-INVENTORY.md first, then disclosed in the /privacy policy with a regression-guard test — before any transmitting code exists.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-24T01:52:00Z
- **Completed:** 2026-07-24T01:57:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added a new External Destinations row to `docs/DATA-FLOW-INVENTORY.md` for the encrypted full-database sync blob: ciphertext-only (AES-256-GCM), the exact D-08 minimal plaintext envelope (account id, version counter, updated-at timestamp, blob size), stored at `public.sync_blobs` in Supabase eu-central-1, retained ~90 days post-lapse then auto-deleted (D-13), with a Notes bullet confirming no new `connect-src` origin (Realtime reuses `*.supabase.co`)
- Extended `src/pages/PrivacyPage.tsx` in three places (What we collect / Retention / Processors) to disclose the Pro cloud-sync flow in plain language: end-to-end encrypted / zero-knowledge, minimal server-visible metadata, ~90-day lapse retention grace window, self-serve deletion from Settings → Data
- Added a drift-guard test to `PrivacyPage.test.tsx` asserting the rendered policy mentions cloud sync, end-to-end encryption, zero-knowledge, the 90-day window, and self-serve deletion — so a future edit that silently drops the disclosure fails CI

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the encrypted sync-blob row to DATA-FLOW-INVENTORY.md (inventory FIRST)** - `704f27f` (docs)
2. **Task 2: Update PrivacyPage processor + retention copy (policy SECOND) with a drift guard test** - `670c35d` (feat)

**Plan metadata:** _pending final commit_

## Files Created/Modified
- `docs/DATA-FLOW-INVENTORY.md` - New sync-blob row + Notes bullet for the encrypted cloud sync flow
- `src/pages/PrivacyPage.tsx` - Cloud sync disclosure added to What we collect, Retention, and Processors sections
- `src/pages/PrivacyPage.test.tsx` - New regression-guard test for the cloud-sync disclosure

## Decisions Made
- The inventory row's plaintext-envelope description lists exactly the four D-08 fields and explicitly calls out that device names, schema version, and record counts (beyond customer PII) also stay inside the ciphertext — closing off any ambiguity about what "minimal" means.
- Cloud sync is described as an extension of the existing Supabase processor entry in the Processors section, not a new list item, since Supabase is already disclosed as a processor and no new network origin is introduced.
- The 90-day retention sentence in PrivacyPage.tsx is written as an unconditional promise ("kept for about 90 days... then automatically deleted") to match T-47-02's threat-register requirement that the policy stay truthful once the Phase 47-02 pg_cron job exists to enforce it server-side.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their acceptance criteria on the first pass; no auto-fixes were needed.

## Issues Encountered

One `Edit` tool call on Task 2 failed on the first attempt with a "string not found" error despite the anchor text appearing correct — re-reading the exact file content via `Read` (rather than relying on the earlier full-file read) resolved it on retry. No functional issue; not a plan deviation.

## User Setup Required

None - no external service configuration required. This plan is documentation-only (inventory + privacy policy text); it does not touch Supabase, migrations, or any transmitting code.

## Next Phase Readiness

- The inventory-first documentation is now in place for Wave 1, satisfying the hard dependency that plan 47-04 (first code that transmits the sync blob) has on this plan completing first.
- `npx vitest run src/pages/PrivacyPage.test.tsx` passes (5/5 tests) and `npx tsc -b` is clean.
- No blockers for subsequent Phase 47 plans (schema/migration work in 47-02 onward can now safely reference the documented D-08 envelope and D-13 retention window).

---
*Phase: 47-cloud-sync*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: docs/DATA-FLOW-INVENTORY.md
- FOUND: src/pages/PrivacyPage.tsx
- FOUND: src/pages/PrivacyPage.test.tsx
- FOUND commit: 704f27f
- FOUND commit: 670c35d
