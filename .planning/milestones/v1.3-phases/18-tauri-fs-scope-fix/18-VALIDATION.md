---
phase: 18
slug: tauri-fs-scope-fix
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-25
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Lifted from `18-RESEARCH.md` §Validation Architecture (lines 445–479); kept as standalone document per `nyquist_validation` config.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 [VERIFIED: package.json devDeps] |
| **Config file** | `vite.config.ts` (Vitest reads it directly via `defineConfig`'s `test:` block convention) |
| **Quick run command** | `npm run test -- generateQuotePdf` |
| **Full suite command** | `npm run build` (includes `vitest run --coverage` per package.json line 8) |
| **Manual UAT** | `npm run tauri:dev` — no automated Tauri test framework in this repo |
| **Build-time validation** | `npm run tauri build` — schema-validates the capability JSON via `tauri-build` |
| **Estimated runtime** | ~2-5s (quick); ~60s (full suite); ~3 min (manual UAT script) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- generateQuotePdf` (PDF tests only — ~2-5s)
- **After every plan wave:** Run `npm run build` (full vitest + tsc + vite build + asset-size gates)
- **Phase gate (before `/gsd:verify-work`):** Run `npm run build && npm run tauri build` (forces Cargo/Rust path) + manual UAT script
- **Max feedback latency:** 5 seconds (quick); 60 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | DESK-01 | T-18-01, T-18-02, T-18-05 | Capability JSON parses + `fs:allow-write-file` scope = `$HOME/**/*` (constrains broadened scope to writeFile only); dotfiles protected by `require_literal_leading_dot: true` default | build-time + structural | `cd src-tauri && cargo check` AND `jq -e '.permissions[] \| select(.identifier == "fs:allow-write-file") \| .allow[0].path == "$HOME/**/*"' src-tauri/capabilities/default.json` | ✅ (cargo + jq available) | ⬜ pending |
| 18-01-02 | 01 | 1 | DESK-01 | T-18-03, T-18-04 | `generateQuotePdf` catches `"forbidden path: …"` and surfaces actionable message ("this location is restricted") without leaking internal paths | unit (vitest, mocked) | `npm run test -- generateQuotePdf` (existing test file + new `describe('writeFile error mapping')` block) | ❌ W0 — new test cases must be written in this task | ⬜ pending |
| 18-01-03 | 01 | 1 | DESK-01 | — | Manual UAT: dialog opens on Generate PDF; pick Desktop/Documents/Downloads, file is written without scope-denied error; UAT-D negative control verifies whether the audit's described failure is load-bearing or theoretical (Result A vs Result B recorded in SUMMARY) | manual | `npm run tauri:dev` + 4-step UAT script (UAT-A/B/C/D) | manual-only — no Tauri WebDriver infrastructure in this repo; standing one up for a one-line config fix is disproportionate | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `src/pdf/generateQuotePdf.test.ts` with a new `describe('writeFile error mapping')` block that mocks `@tauri-apps/plugin-fs.writeFile` to throw `new Error('forbidden path: /Users/x/Desktop/foo.pdf')` and asserts the caught-and-rethrown message includes `"this location is restricted"`. Estimated +15 lines, vi.mock pattern. **Completed by Task 18-01-02.**
- [ ] No new test files needed — existing infrastructure covers everything else.
- [ ] No framework install needed — Vitest is already wired up.

`wave_0_complete: true` should flip after Task 18-01-02 lands the new test cases.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pick Desktop in save dialog → file is written without error | DESK-01 success criterion #2 | Native OS file dialog cannot be automated without Tauri WebDriver setup (disproportionate for this phase) | UAT-A: `npm run tauri:dev`, click "Print Quote" on any saved job, dialog opens, navigate to `~/Desktop`, save as `test-quote-1.pdf`, file appears on Desktop, no error banner |
| Pick Documents in save dialog → file is written | DESK-01 success criterion #2 | Same as above | UAT-B: as UAT-A but `~/Documents/test-quote-2.pdf` |
| Pick Downloads in save dialog → file is written | DESK-01 success criterion #2 | Same as above | UAT-C: as UAT-A but `~/Downloads/test-quote-3.pdf` |
| Negative control — verify the audit's described failure is/isn't reproducible | DESK-01 + institutional knowledge | Distinguishes "fix closed a real bug" (Result A) from "fix preventively hardened a theoretical exposure" (Result B). Both close DESK-01; the finding is institutionally valuable for future capability decisions | UAT-D: `git stash push src-tauri/capabilities/default.json`, re-run UAT-A; observe whether writeFile fails with `"forbidden path: …"` (Result A — audit bug was real) OR succeeds via dialog plugin's auto-allow side-effect (Result B — audit was theoretical); `git stash pop` to restore; record outcome in `18-SUMMARY.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (Tasks 01 + 02 automated; Task 03 manual with explicit UAT script)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (Task 01 + 02 automated; Task 03 manual — 2 of 3 automated, well within the rule)
- [ ] Wave 0 covers all MISSING references (the new `describe('writeFile error mapping')` block is the sole W0 gap, owned by Task 02)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (quick); < 60s (full)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (flips to `approved 2026-05-25` once Task 02 lands + UAT-A passes)

---

## Phase-Specific Notes

**Tauri integration testing deferred.** Tauri 2 supports WebDriver-based e2e testing via `tauri-driver` + `webdriverio`. Standing this up for Phase 18 alone is disproportionate (~1-2 days setup vs. ~30 min for the fix itself). The manual UAT script with negative control (UAT-D) is the appropriate validation. If/when a future phase adds WebDriver tests, the Phase 18 UAT script becomes the first automated case.

**Negative-control honesty.** UAT-D's outcome (Result A or Result B) determines whether REQ DESK-01 was a real-bug closure or a preventive-hardening closure. Both satisfy the success criteria; the distinction matters for future capability-edit decisions and should be recorded in the `18-SUMMARY.md`.
