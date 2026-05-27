# Phase 22 Deferred Items

## Discovered during plan 22-04 execution

### Pre-existing environment issue: react-window missing in worktree node_modules

**Found during:** Tasks 3 & 4 verification
**Plan:** 22-04
**Symptom:**
- `npx tsc -b` reports `TS2307: Cannot find module 'react-window'` in `JobsManager.tsx:3`, `AssetLibrary.tsx:2`, `CustomerLibrary.tsx:3`
- `npm test -- JobsManager --run` fails with vite import-analysis error: `Failed to resolve import "react-window" from "src/components/JobsManager.tsx"`

**Out of scope:**
- Per executor deviation rules, package installs (`npm install`) are EXCLUDED from Rule 3 auto-fix to avoid slopsquatting risk.
- The error is environmental — `react-window` is correctly declared in `package.json` (`"react-window": "^2.2.7"`), but this worktree's `node_modules/` is sparse (does not contain the package).
- Confirmed pre-existing: same error appears at `HEAD~1` (before any 22-04 changes) and at `HEAD~3` (before Task 1).
- Sibling worktrees (e.g., `.claude/worktrees/pedantic-ride-ab48c5/node_modules/react-window/`) DO have it installed.

**Resolution path:**
- The orchestrator should run `npm install` in the worktree before spawning execution agents, OR the parent agent should run `npm install` after merging this wave.
- Once installed, `npm test -- JobsManager --run` and `npx tsc -b` should pass; SaleRow.test.tsx already passes (it doesn't transitively import react-window).

**Verified by plan 22-04:**
- Static (grep) acceptance criteria all pass — see SUMMARY.md
- SaleRow.test.tsx (3 tests) passes
- Visual-contract preservation is asserted by code review (the extracted SaleRow.tsx renders byte-identical JSX to the original inline block)
