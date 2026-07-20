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
