---
phase: 46-white-label-quotes
plan: 01
subsystem: utils
tags: [types, canvas, image-resize, xss-validation, white-label, dexie]

requires: []
provides:
  - "UserProfile.logoDataUrl optional field (additive, no Dexie bump)"
  - "isValidLogoDataUrl — canonical logo data-URL XSS allowlist validator"
  - "resizeImageToDataUrl — native-Canvas image resize/compress helper"
affects: [46-02, 46-03, 46-04, 46-05, 46-06, 46-07]

tech-stack:
  added: []
  patterns:
    - "Additive-optional UserProfile field with no Dexie version bump (mirrors taxJurisdiction/onboardingStep precedent)"
    - "Single canonical validator reused at every write/render site, mirrored server-side in api/ where src/ cannot be imported"
    - "createImageBitmap decode failure IS the format-validation step (no separate magic-byte check)"

key-files:
  created:
    - src/utils/logoDataUrl.ts
    - src/utils/logoDataUrl.test.ts
    - src/utils/imageResize.ts
    - src/utils/imageResize.test.ts
  modified:
    - src/types.ts

key-decisions:
  - "logoDataUrl placed directly below UserProfile.name so brand identity (name + logo) is co-located"
  - "MAX_LOGO_DATA_URL_LENGTH set to 205,000 chars (~150KB decoded x 1.34 base64 overhead)"
  - "MAX_LOGO_UPLOAD_BYTES set to 5MB pre-decode cap, checked before createImageBitmap is ever called"
  - "No npm dependency added — vanilla Canvas per RESEARCH.md recommendation against browser-image-compression"

patterns-established:
  - "logoDataUrl write path: resizeImageToDataUrl output -> isValidLogoDataUrl gate -> UserProfile.logoDataUrl (single validated write path, never bypassed)"

requirements-completed: [D-01]

coverage:
  - id: D1
    description: "UserProfile carries an optional logoDataUrl string field with no Dexie version bump (DB stays v12)"
    requirement: "D-01"
    verification:
      - kind: unit
        ref: "npx tsc -b (type-check, no new errors)"
        status: pass
    human_judgment: false
  - id: D2
    description: "isValidLogoDataUrl accepts only data:image/(png|jpeg|webp);base64,<base64> and rejects javascript:, svg, quote-breakouts, and over-cap payloads"
    requirement: "D-01"
    verification:
      - kind: unit
        ref: "src/utils/logoDataUrl.test.ts#isValidLogoDataUrl (10 tests: png/jpeg/webp accept, svg/javascript:/quote-breakout/undefined/null/empty/oversized reject)"
        status: pass
    human_judgment: false
  - id: D3
    description: "resizeImageToDataUrl downscales any raster image to a bounding box and re-encodes to a validated data URL, throwing on non-image input"
    requirement: "D-01"
    verification:
      - kind: unit
        ref: "src/utils/imageResize.test.ts#resizeImageToDataUrl (5 tests: valid PNG resolve, non-image reject, no-upscale, downscale-to-bbox, oversized-file pre-decode reject)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-22
status: complete
---

# Phase 46 Plan 01: Logo Foundation Summary

**Additive `UserProfile.logoDataUrl` field, a strict XSS-allowlist data-URL validator, and a native-Canvas resize/compress helper — the single validated write path every downstream white-label surface will reuse**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-22T19:36:00Z (approx)
- **Completed:** 2026-07-22T19:40:24Z
- **Tasks:** 3 completed
- **Files modified:** 5 (1 modified, 4 created)

## Accomplishments
- `UserProfile.logoDataUrl?: string` added as an additive-optional field — no Dexie version bump, DB stays v12
- `isValidLogoDataUrl` — the canonical XSS-allowlist validator (`data:image/(png|jpeg|webp);base64,<base64-only>`) that rejects svg, `javascript:`, attribute-breakout payloads, and oversized strings — this is the SINGLE validator every write and render path (including 46-05's server-side mirror) must reuse
- `resizeImageToDataUrl` — native-Canvas helper that decodes via `createImageBitmap` (decode failure = format validation), scales to a bounding box without upscaling, and validates its own output with `isValidLogoDataUrl` before ever returning it
- Zero new npm dependencies added

## Task Commits

Each task was committed atomically:

1. **Task 1: Add UserProfile.logoDataUrl additive-optional field** - `5c8cb2f` (feat)
2. **Task 2: Pure strict logo data-URL validator** - `d8a35ee` (test, RED) → `23044b3` (feat, GREEN)
3. **Task 3: Canvas-based logo resize/compress helper** - `8d1ce1a` (test, RED) → `053f265` (feat, GREEN)

_TDD tasks each have a test commit followed by an implementation commit._

## Files Created/Modified
- `src/types.ts` - Added `logoDataUrl?: string` to `UserProfile` with a comment documenting D-01/D-02, no-Dexie-bump, and the Blob anti-pattern
- `src/utils/logoDataUrl.ts` - `isValidLogoDataUrl(value)` + `MAX_LOGO_DATA_URL_LENGTH` constant (205,000 chars)
- `src/utils/logoDataUrl.test.ts` - 10 unit tests covering every accept/reject case in the plan's `<behavior>` block
- `src/utils/imageResize.ts` - `resizeImageToDataUrl(file, maxDim, outputMime, quality?)` + `MAX_LOGO_UPLOAD_BYTES` constant (5MB)
- `src/utils/imageResize.test.ts` - 5 unit tests (valid resolve, non-image reject, no-upscale, downscale-to-bbox, oversized-file pre-decode reject) using mocked `createImageBitmap`/canvas since jsdom lacks real rasterization

## Decisions Made
- `logoDataUrl` field placed directly below `name?: string` on `UserProfile` (brand identity co-located) per the plan's action instructions
- `MAX_LOGO_DATA_URL_LENGTH = 205_000` chars, matching the plan's exact guidance (~150KB soft cap × 1.34 base64 overhead)
- `MAX_LOGO_UPLOAD_BYTES = 5MB`, checked synchronously on `file.size` before any `createImageBitmap` call — this is the decode-time memory-exhaustion guard (Security Domain DoS row, T-46-02)
- Test doubles for `createImageBitmap`/canvas mock only the minimum surface (`width`, `height`, `close`, `getContext`, `toDataURL`) needed to exercise the size-cap, no-upscale, downscale, and validator-gated-return behaviors — no real image decode is exercised in unit tests (acceptable per plan's own guidance: "Tests may mock createImageBitmap/canvas where jsdom lacks them")

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched their `<action>`/`<behavior>`/`<acceptance_criteria>` blocks with no scope changes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `UserProfile.logoDataUrl`, `isValidLogoDataUrl`, and `resizeImageToDataUrl` are all ready for consumption by later Phase 46 plans (PDF branding, hosted-page branding, Branding Settings UI) — each of those plans should call `resizeImageToDataUrl` then gate the result through `isValidLogoDataUrl` before ever writing to `UserProfile.logoDataUrl` or rendering it.
- Plan 46-05 (server-side hosted-page rendering) must mirror the exact `LOGO_DATA_URL_REGEX` source (`^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$`) verbatim in `api/` with a lockstep comment pointing back to `src/utils/logoDataUrl.ts`, since `api/` cannot import from `src/`.
- No blockers.

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-22*

## Self-Check: PASSED

All created files verified present on disk; all 5 task commits (5c8cb2f, d8a35ee, 23044b3, 8d1ce1a, 053f265) verified present in git log.
