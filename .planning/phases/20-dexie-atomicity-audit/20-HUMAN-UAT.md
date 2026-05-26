---
status: partial
phase: 20-dexie-atomicity-audit
source: [20-VERIFICATION.md]
started: 2026-05-26T20:54:00Z
updated: 2026-05-26T20:54:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. DATA-02 concurrent-tab quote-number race UAT
expected: Two browser tabs that open the Print Quote modal from the same React snapshot and click Save within ~1 second of each other end up with two distinct sequential `quoteNumber` values in `db.quotes`. The tx-scoped settings read inside `createQuote` (src/hooks/useDatabase.ts:887) serializes through Dexie's transaction queue — each tab's `tx.table('settings').get('userProfile')` reads the value as of its own transaction snapshot, so the second tab sees the first tab's `setUserProfile` write. No console errors. No duplicate quoteNumbers.
result: [pending]

**How to run:**
1. Kill any running dev server. `npm run dev` (port 4173).
2. Open `http://localhost:4173/` in two browser tabs (Chrome or Firefox), DevTools Console open in both.
3. In each tab, create or open a Print Job (same job is fine), then open the Print Quote modal.
4. Fill in customer info / quote details so each modal is ready to submit.
5. Click Save in tab A, then immediately Save in tab B (within ~1 second).
6. Open DevTools → Application → IndexedDB → 3DCosterDB → quotes table.
7. **Pass:** Two new quote rows with distinct sequential `quoteNumber` values (e.g., 7 and 8); no `PrematureCommitError`, `TransactionInactiveError`, or duplicate-quoteNumber errors in either console.
8. **Fail:** Two rows with identical `quoteNumber`, OR any aborted-transaction error.

If pass, reply "approved" to /gsd:verify-work, or update this UAT file directly (set `result: passed` and `status: passed`).

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
