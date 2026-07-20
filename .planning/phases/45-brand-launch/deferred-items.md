# Deferred Items — Phase 45 Brand & Launch

## 45-09: Footer.tsx + LandingPage.tsx still carry live "Buy me a coffee" donation links (out of scope)

**Found during:** 45-09 Task 2 final verification sweep (grepping the whole
repo for `buymeacoffee`/`ko-fi` after retargeting SupportNudge away from the
donation ask).

**Issue:** `src/components/Footer.tsx` (line 51) and `src/pages/LandingPage.tsx`
(line 188) both still render a live `href="https://buymeacoffee.com/3dcoster"`
link with donation-framed copy ("consider supporting its development"). These
predate Phase 45 entirely (Footer's link shipped pre-GSD, in the original
footer/FAQ/changelog commit; LandingPage's is presumably from the same era or
the branch's own landing copy) — neither file is in 45-09's `files_modified`
list (SupportNudge.tsx, supportNudge.ts, CostCalculator.tsx,
PrintQuoteModal.tsx, RecordSaleModal.tsx, ProPitchModal.tsx only).

**Why this matters for the phase:** CONTEXT.md's `<specifics>` states "One
monetization voice at launch: SupportNudge (Pro), ShareQuoteButton pitch
(Pro) — no donation asks anywhere at launch," and `<deferred>` explicitly
parks "Donation/support ask" for post-launch. 45-09 closes that gap for the
in-app SupportNudge toast, but Footer and LandingPage still carry a live,
user-facing donation CTA — the phase-wide "no donation asks anywhere at
launch" truth is not yet fully satisfied.

**Scope decision:** out of scope for 45-09 (scope-boundary rule — only fix
issues directly caused by the current task's changes; Footer.tsx was already
ported in 45-02, LandingPage.tsx is owned by a landing-page port plan later
in this phase). Not fixed here. Logged per that rule rather than silently
ignored.

**Suggested resolution:** whichever plan ports/finalizes LandingPage.tsx
(and, if not already re-touched, Footer.tsx) should drop the
`buymeacoffee.com` CTA and its surrounding copy, consistent with D-03's "one
monetization voice" decision. Verify with
`grep -rni "buymeacoffee\|ko-fi" src` returning zero hits before the phase's
final `/gsd-verify-work` pass.

**Update (45-04):** `src/pages/LandingPage.tsx`'s "Buy Me a Coffee" section
has been dropped in this plan's port. `src/components/Footer.tsx` (line 51)
still carries the live `buymeacoffee.com` link — Footer.tsx is not in this
plan's `files_modified` and was already ported/styled in 45-02, so it is out
of scope here per the scope-boundary rule. `grep -rni "buymeacoffee\|ko-fi"
src` now returns only the Footer.tsx hit. A future plan (or the phase's
final `/gsd-verify-work` pass) should remove it from Footer.tsx to fully
close this item.

## 45-04: Pre-existing flaky test — `outputEquivalence.test.tsx` (unrelated file, out of scope)

**Found during:** 45-04 Task 1 build verification (`npm run build`).

**Issue:** `src/components/calculator/outputEquivalence.test.tsx`'s single
test ("mounts every curated + random scenario and captures well-formed
rendered readouts") intermittently times out at the default 5000ms when run
as part of the full coverage suite (`vitest run --coverage`, which `npm run
build` invokes), but passes reliably when run in isolation
(`npx vitest run src/components/calculator/outputEquivalence.test.tsx`,
with or without `--coverage`). Confirmed pre-existing and unrelated to this
plan: reproduced identically on a clean `git stash` of this plan's
`LandingPage.tsx` change against unmodified `main`.

**Why this matters:** `npm run build`'s script chain
(`vitest run --coverage && tsc -b && vite build && ...`) short-circuits on
the first failing step, so a flaky timeout here blocks the full gate even
though `tsc -b`, `vite build`, `assert-bundle-size.mjs`, and
`lint-no-raw-html.mjs` all pass cleanly when run independently (verified for
this plan).

**Scope decision:** out of scope for 45-04 (scope-boundary rule — the file
is unrelated to `src/pages/LandingPage.tsx`, and the flakiness is a
resource-contention/timing issue in a large scenario-iteration test, not a
logic bug this plan introduced or can safely modify). Not fixed here.

**Suggested resolution:** raise this test's timeout (e.g.
`it('...', async () => { ... }, 15000)`) or investigate why the full-suite
coverage run adds enough overhead to occasionally exceed 5s. Should be
picked up before the phase's final `/gsd-verify-work` pass, since a flaky
`npm run build` step is a launch-readiness risk (D-15).
