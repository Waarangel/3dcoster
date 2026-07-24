---
phase: 47-cloud-sync
plan: 03
subsystem: crypto
tags: [webcrypto, aes-gcm, argon2id, hash-wasm, zxcvbn-ts, indexeddb, zero-knowledge]

# Dependency graph
requires:
  - phase: 47-02
    provides: Supabase cloud-sync backend (sync_blobs table, CAS RPC, RLS, Realtime auth) that the encrypted blob will be uploaded to
provides:
  - Pure AES-256-GCM encrypt/decrypt of sync-file bytes (encryptSyncFile/decryptSyncFile)
  - Argon2id passphrase-based key derivation (deriveKeyFromPassphrase) via hash-wasm
  - Deterministic per-account KDF salt (deriveSaltFromAccountId) — resolves D-06/D-08 tension with zero new server storage
  - Fixed ARGON2ID_PARAMS constant (cryptographic identity, never tunable config)
  - Passphrase strength check (checkPassphraseStrength) via lazy-loaded @zxcvbn-ts/core
  - Non-extractable CryptoKey cache in IndexedDB, per-accountId (syncKeyCache.ts)
affects: [47-04, 47-05, 47-06, 47-07, 47-08]

# Tech tracking
tech-stack:
  added: [hash-wasm@4.12.0, "@zxcvbn-ts/core@4.1.2", "@zxcvbn-ts/language-common@4.1.3", "@zxcvbn-ts/language-en@4.1.1"]
  patterns:
    - "Deterministic KDF salt from auth.uid() (SHA-256) instead of a stored random salt column"
    - "Non-extractable CryptoKey persisted directly in a dedicated hand-rolled IndexedDB store (mirrors syncFileIO.ts's handle store), never localStorage/setSetting"
    - "hash-wasm and @zxcvbn-ts/* both lazy-imported (dynamic import) so neither loads on the free floor"

key-files:
  created:
    - src/utils/syncCrypto.ts
    - src/utils/syncCrypto.test.ts
    - src/utils/syncKeyCache.ts
    - src/utils/syncKeyCache.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Package-legitimacy gate resolved: @zxcvbn-ts/language-common's [SUS] flag was an automated too-new-version heuristic (v4.1.3 published ~1 week before research), not a legitimacy problem — same GitHub monorepo (zxcvbn-ts/zxcvbn) and sole maintainer (mrwook) as the pre-approved @zxcvbn-ts/core, zero install-time lifecycle scripts (only a monorepo rollup build script), MIT license, 989k weekly downloads. Founder approved all four packages after independent orchestrator verification."
  - "ARGON2ID_PARAMS shipped as m=64MiB/t=3/p=1 (RESEARCH.md Assumption A1) with an explicit code comment that changing any value requires a coordinated re-key migration, never a silent bump (Pitfall 3)."
  - "checkPassphraseStrength floor set at zxcvbn score >= 3 ('safely unguessable') since the passphrase alone stands between an offline attacker and decrypted PII (T-47-08) — documented in code."
  - "hash-wasm's own .d.ts declares argon2id's binary-output return as a bare Uint8Array, which resolves to Uint8Array<ArrayBufferLike> under this project's TS lib and fails WebCrypto's BufferSource type. Re-wrapped with `new Uint8Array(rawKey)` before importKey, matching the Uint8Array<ArrayBuffer> convention already used in syncFileIO.ts — a Rule 1 fix surfaced by tsc -b, not tsc --noEmit (build parity)."

patterns-established:
  - "Zero-knowledge crypto module stays pure (no IndexedDB/React/Supabase imports) — key caching, network I/O, and merge logic live in separate modules that import syncCrypto.ts, never the reverse."

requirements-completed: [D-05, D-06, D-07, SYNC-02]

coverage:
  - id: D1
    description: "encryptSyncFile/decryptSyncFile AES-256-GCM round-trip returns byte-identical plaintext; wrong key fails to decrypt; fresh 12-byte IV never reused"
    requirement: "SYNC-02"
    verification:
      - kind: unit
        ref: "src/utils/syncCrypto.test.ts#syncCrypto — encryptSyncFile/decryptSyncFile"
        status: pass
    human_judgment: false
  - id: D2
    description: "deriveKeyFromPassphrase (Argon2id via hash-wasm) + deriveSaltFromAccountId (deterministic SHA-256 of accountId) yield a key usable across two independent derivations for the same passphrase+account; ARGON2ID_PARAMS is a fixed exported constant"
    requirement: "D-06"
    verification:
      - kind: unit
        ref: "src/utils/syncCrypto.test.ts#syncCrypto — deriveKeyFromPassphrase"
        status: pass
      - kind: unit
        ref: "src/utils/syncCrypto.test.ts#syncCrypto — deriveSaltFromAccountId"
        status: pass
      - kind: unit
        ref: "src/utils/syncCrypto.test.ts#syncCrypto — ARGON2ID_PARAMS"
        status: pass
    human_judgment: false
  - id: D3
    description: "checkPassphraseStrength rejects a weak passphrase, accepts a strong one, via lazy-loaded @zxcvbn-ts/core"
    requirement: "D-07"
    verification:
      - kind: unit
        ref: "src/utils/syncCrypto.test.ts#syncCrypto — checkPassphraseStrength"
        status: pass
    human_judgment: false
  - id: D4
    description: "The derived key is cached as a non-extractable CryptoKey in a dedicated IndexedDB store, keyed per-accountId (never localStorage, never raw key bytes)"
    requirement: "D-05"
    verification:
      - kind: unit
        ref: "src/utils/syncKeyCache.test.ts#syncKeyCache"
        status: pass
    human_judgment: false

# Metrics
duration: 6min (continuation session; package-legitimacy gate resolution + install + 2 tasks)
completed: 2026-07-23
status: complete
---

# Phase 47 Plan 03: Cloud-Sync Zero-Knowledge Crypto Layer Summary

**AES-256-GCM sync-file encryption with Argon2id passphrase-derived, non-extractable CryptoKeys cached per-account in IndexedDB — the "we can't read your data" promise made real via hash-wasm + native WebCrypto, zero server round-trips.**

## Performance

- **Duration:** ~6 min (continuation agent — resumed after a prior session stopped at the plan's opening package-legitimacy checkpoint with 0/2 tasks committed)
- **Started:** 2026-07-23T22:37:00-04:00 (package install)
- **Completed:** 2026-07-23T22:42:22-04:00
- **Tasks:** 2/2 (plus the resolved package-legitimacy gate)
- **Files modified:** 6 (package.json, package-lock.json, syncCrypto.ts + test, syncKeyCache.ts + test)

## Accomplishments
- `src/utils/syncCrypto.ts` — pure crypto module: `encryptSyncFile`/`decryptSyncFile` (AES-256-GCM, fresh 12-byte IV per call), `deriveKeyFromPassphrase`/`deriveSaltFromAccountId` (Argon2id + deterministic per-account salt), `ARGON2ID_PARAMS` fixed constant, `checkPassphraseStrength` (lazy `@zxcvbn-ts/core`, floor score >= 3)
- `src/utils/syncKeyCache.ts` — dedicated IndexedDB key-value store caching the non-extractable derived `CryptoKey` per accountId, mirroring `syncFileIO.ts`'s hand-rolled handle-store pattern
- Package-legitimacy checkpoint for `@zxcvbn-ts/language-common` resolved and all four packages installed as one chore commit

## Task Commits

Each task was committed atomically:

1. **Package install (gate resolution)** - `d570eca` (chore) — hash-wasm + @zxcvbn-ts/core/language-en/language-common
2. **Task 1: syncCrypto.ts** - `6261dee` (feat) — AES-256-GCM + Argon2id KDF + deterministic salt + strength check, 12 tests
3. **Task 2: syncKeyCache.ts** - `014e410` (feat) — non-extractable CryptoKey store in IndexedDB, 5 tests (also carries the tsc -b type-safety fix to syncCrypto.ts, discovered during this task's full-project typecheck)

_Note: TDD tasks each ran RED (import failure confirmed) before the implementation (GREEN) commit._

## Files Created/Modified
- `src/utils/syncCrypto.ts` - Pure AES-256-GCM encrypt/decrypt, Argon2id KDF, deterministic salt, passphrase strength check
- `src/utils/syncCrypto.test.ts` - 12 tests: round-trip, wrong-key failure, IV uniqueness, salt/KDF determinism, non-extractable key assertion, strength accept/reject
- `src/utils/syncKeyCache.ts` - Non-extractable CryptoKey IndexedDB cache, per-accountId
- `src/utils/syncKeyCache.test.ts` - 5 tests: cache/retrieve round-trip, null-when-empty, clear, per-account isolation
- `package.json` / `package-lock.json` - hash-wasm, @zxcvbn-ts/core, @zxcvbn-ts/language-common, @zxcvbn-ts/language-en added

## Decisions Made

- **Package-legitimacy gate resolved (RECORDED PER USER INSTRUCTION):** `@zxcvbn-ts/language-common`'s `[SUS]` flag (RESEARCH.md's automated "too-new" heuristic, published ~18 days before research / ~1 week before this session) was independently re-verified by the orchestrator before founder approval: same GitHub repo (github.com/zxcvbn-ts/zxcvbn), same sole maintainer (mrwook) as the already-`OK` `@zxcvbn-ts/core`, zero install-time lifecycle scripts (`npm view @zxcvbn-ts/language-common scripts.postinstall` returns empty — confirmed live this session), MIT license, 989k weekly downloads. This was a routine monorepo version-lockstep release, not a supply-chain risk. Founder approved installing all four packages together.
- ARGON2ID_PARAMS shipped verbatim from RESEARCH.md (m=64MiB, t=3, p=1) as a fixed exported constant with an explicit "never a silent bump" code comment (Pitfall 3).
- `checkPassphraseStrength`'s minimum score floor set at 3 ("safely unguessable" on zxcvbn's 0-4 scale) — documented in code as the reasoned floor since this passphrase is the sole barrier between an offline attacker and decrypted PII (T-47-08).
- hash-wasm/@zxcvbn-ts both stay behind dynamic `import()` inside their respective functions so neither loads on the free floor (only the Pro cloud-sync setup/unlock flow triggers them).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `tsc -b` BufferSource type errors in syncCrypto.ts**
- **Found during:** Task 2 (running the full-project `tsc -b` as part of this task's verification, per project convention of `tsc -b` over `tsc --noEmit` for build parity)
- **Issue:** `encryptSyncFile`/`decryptSyncFile`/`deriveSaltFromAccountId`/`deriveKeyFromPassphrase` used bare `Uint8Array` type annotations, which resolve to `Uint8Array<ArrayBufferLike>` under this project's TS lib and do not satisfy WebCrypto's `BufferSource` (`ArrayBufferView<ArrayBuffer>`). Separately, `hash-wasm`'s own `.d.ts` declares `argon2id`'s binary output as a bare `Uint8Array`, hitting the same mismatch at the `importKey` call. `checkPassphraseStrength`'s return also failed to satisfy the module's `PassphraseStrengthResult` type because zxcvbn's `feedback.warning` is `string | null`.
- **Fix:** Annotated all `Uint8Array` params/returns as `Uint8Array<ArrayBuffer>` (matching the existing convention in `syncFileIO.ts`); wrapped hash-wasm's return in `new Uint8Array(rawKey)` before `importKey`; coerced `feedback.warning ?? ''`.
- **Files modified:** src/utils/syncCrypto.ts
- **Verification:** `npx tsc -b --pretty false` clean; `npx vitest run src/utils/syncCrypto.test.ts src/utils/syncKeyCache.test.ts` 17/17 pass; full suite `npx vitest run` 1532/1532 pass.
- **Committed in:** `014e410` (part of Task 2 commit — same file Task 1 touched)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** No scope creep — the fix corrects a type-checker gap `vitest`'s transform pipeline doesn't catch (it uses esbuild, not full `tsc`), so the strict-build gate surfaced it before it could reach CI.

## Issues Encountered
None beyond the tsc -b fix above.

## User Setup Required
None - no external service configuration required. (Packages installed via `npm install`, no accounts/keys needed.)

## Next Phase Readiness
- `syncCrypto.ts` + `syncKeyCache.ts` are ready for 47-04/47-05 (cloud upload/download and merge orchestration) to import: `deriveSaltFromAccountId(auth.uid()) → deriveKeyFromPassphrase → importKey(non-extractable) → syncKeyCache` is the full key_links chain named in the plan's frontmatter.
- No blockers. Both modules are pure/dependency-isolated per plan design (syncCrypto.ts has zero IndexedDB/React/Supabase imports; syncKeyCache.ts has zero syncCrypto.ts imports beyond the CryptoKey type it stores).

---
*Phase: 47-cloud-sync*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created files verified present on disk (src/utils/syncCrypto.ts, syncCrypto.test.ts, syncKeyCache.ts, syncKeyCache.test.ts, 47-03-SUMMARY.md). All 3 task commits verified present in git log (d570eca, 6261dee, 014e410).
