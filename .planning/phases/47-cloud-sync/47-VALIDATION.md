---
phase: 47
slug: cloud-sync
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from 47-RESEARCH.md `## Validation Architecture` at plan time; exact task IDs are filled by validate-phase once execution starts.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 + jsdom (component/unit), Playwright 1.61.1 (E2E) |
| **Config file** | `vitest.config.ts` (root), `playwright.config.ts` |
| **Quick run command** | `npx vitest run <specific new test file>` (e.g. `npx vitest run src/utils/syncCrypto.test.ts`) |
| **Full suite command** | `npm test` (vitest run: `src/**/*.test.ts(x)` + `tests/**/*.test.ts` + `api/**/*.test.ts`) |
| **Estimated runtime** | measure at Wave 0 (suite is 1500+ tests; record actual seconds here) |

---

## Sampling Rate

- **After every task commit:** Run targeted `npx vitest run <changed-file>.test.ts`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite green + `npx playwright test`
- **Max feedback latency:** full-suite runtime — measure and record at Wave 0

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (validate-phase) | 47-03 | 1 | SYNC-02 / D-05 | — | Encrypt/decrypt round-trip identical; wrong passphrase fails to decrypt | unit | `npx vitest run src/utils/syncCrypto.test.ts` | ❌ W0 | ⬜ pending |
| TBD (validate-phase) | 47-03 | 1 | SYNC-02 / D-06 | — | KDF determinism: same passphrase + same `auth.uid()`-derived salt → same key across independent derivations | unit | `npx vitest run src/utils/syncCrypto.test.ts` | ❌ W0 | ⬜ pending |
| TBD (validate-phase) | 47-04 | 2 | SYNC-02 / D-02 | — | Version-mismatch upload triggers re-fetch/re-merge/retry (CAS), never data loss | unit (mocked Supabase RPC) | `npx vitest run src/utils/cloudBlobIO.test.ts` | ❌ W0 | ⬜ pending |
| TBD (validate-phase) | 47-02 | 1 | SYNC-02 / D-05 | RLS | Anon cannot read/write `sync_blobs`; owner reads/writes only their own row | security regression (mirrors `tests/security/hosted-quote-enumerability.test.ts`) | `npx vitest run tests/security/sync-blobs-enumerability.test.ts` | ❌ W0 | ⬜ pending |
| TBD (validate-phase) | 47-05 | 3 | SYNC-02 / D-13 | — | `useEntitlement.isPro === false` blocks upload/download; retention SQL deletes rows past window | unit + SQL-level | `npx vitest run src/hooks/useCloudSync.test.tsx` | ❌ W0 | ⬜ pending |
| TBD (validate-phase) | 47-07 | 5 | SYNC-02 / D-04 | free floor | Signed-out / non-Pro path never calls Supabase | E2E (extends existing spec) | `npx playwright test e2e/free-floor-no-network.spec.ts` | ✓ exists (needs extension) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/syncCrypto.test.ts` — encrypt/decrypt round-trip, KDF determinism, wrong-passphrase failure
- [ ] `src/utils/cloudBlobIO.test.ts` — CAS retry loop, mocked Supabase RPC responses
- [ ] `tests/security/sync-blobs-enumerability.test.ts` — mirrors existing `hosted-quote-enumerability.test.ts` pattern for the new table
- [ ] `src/hooks/useCloudSync.test.tsx` — mirrors `useSyncFolder.test.tsx` shape for the new hook
- [ ] Framework install: none — Vitest/Playwright already configured project-wide

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration `0002_cloud_sync.sql` + `delete-account` function applied to live Supabase | D-01/D-07/D-13/D-14 | Live-project mutation via Supabase MCP `apply_migration`; build/types pass without it (false-positive risk) | 47-02 `[BLOCKING]` checkpoint — apply via MCP, then re-run security regression tests |
| `@zxcvbn-ts/language-common` package legitimacy | D-06 | Flagged [SUS] by RESEARCH package audit; human must verify before install | 47-03 `blocking-human` checkpoint before any `npm install` |
| Two-device real-time sync convergence | D-02/D-09/D-10 | Requires two physical signed-in Pro devices; not automatable in CI | 47-07 `[BLOCKING]` human-verify checkpoint (signed-in Pro account; remove UAT-seeded entitlements before billing tests) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < full-suite runtime measured at Wave 0
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
