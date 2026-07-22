# v2.0.0 Launch Comms Kit

> Drafted in Phase 45-10 (D-18). **Nothing here auto-posts.** The founder reviews and
> publishes each piece manually on launch day, in whatever order/venue makes sense. The
> Discord release announcement is the one exception — it already fires automatically when
> the `v2.0.0` tag is pushed (see `.github/workflows/release.yml`'s `notify-discord` job),
> so it is *not* included below.
>
> One monetization voice throughout: 3DCoster Pro ($7.99/mo · $79/yr, early-supporter
> launch price). No donation ask anywhere in this kit.

---

## 1. Changelog-highlight writeup (blog / announcement post)

**Suggested title:** 3DCoster 2.0: the Cost-Truth Engine

3DCoster started as a straightforward question: what does this print actually cost me?
Version 2.0 is the biggest step yet toward answering it honestly — and it adds a way to
support the project that isn't a tip jar.

**1. Real cost truth, not textbook cost truth.** Failure rates, time-of-use electricity,
and nozzle/maintenance wear used to be numbers you typed in and hoped were close. Now
3DCoster learns your actual failure rate per printer and material from your own job
history, applies your real electricity tariff based on when a print actually runs, and
amortizes maintenance costs into a real cost-per-hour — so the number on screen is closer
to the number in your bank account.

**2. Insights that answer "was that worth it?"** A new Insights tab shows your true hourly
wage, which products actually earn the most per printer-hour, and exactly when each
printer paid for itself. A what-if simulator lets you slide filament price, electricity
rate, and failure rate and watch your margin respond before you commit to a price.

**3. Sync across devices, still with zero account.** Point 3DCoster at a folder you
already have — Dropbox, Drive, whatever — and it keeps your data in step across every
device you use it on. No sign-up, no server, no lock-in.

**4. An instant quote from a 3D file.** Drop in an STL or 3MF and get a reviewed volume
estimate — units auto-detected, infill assumption shown, non-manifold meshes flagged —
to kick off a quote in seconds instead of measuring by hand.

**5. 3DCoster Pro.** For makers who sell to real customers: publish a quote as a hosted,
shareable link your customer can view and approve online, instead of emailing a PDF back
and forth. Pro is $7.99/mo or $79/yr (2 months free) — an early-supporter launch
price, because the earliest users are the ones taking a chance on something new.
Everything else in 3DCoster — the entire cost calculator, every feature above — stays
free, forever, no account required. Pro is optional, additive, and never a paywall on the
core promise.

The full list, with every fix and change, is in the [changelog](https://3dcoster.com/changelog).
The free floor and the Pro ceiling are both laid out plainly on the new
[pricing page](https://3dcoster.com/pricing).

---

## 2. Platform post drafts

### Reddit — r/3Dprinting (or r/functionalprint)

**Title:** I built a free cost calculator for 3D print sellers — just shipped v2.0 with real failure-rate tracking, TOU electricity, and printer ROI

Hey all — long-time lurker, maker of [3DCoster](https://3dcoster.com), a free cost
calculator for people selling prints on Etsy/Marketplace/wherever.

Just shipped the biggest update since launch. The headline change: it now tracks your
*actual* failure rate per printer and material (not a number you guess and forget), uses
your real time-of-use electricity tariff instead of a flat rate, and amortizes nozzle/belt
wear into a real cost-per-hour. There's also a new Insights tab (true hourly wage, which
products actually make money, printer payback/ROI), an STL-upload instant quote, and
sync across devices via a folder you already own — no account needed for any of that.

Still free, still local-first, still no account required for the core calculator. This
release also adds 3DCoster Pro ($7.99/mo) for makers who want to send customers a
hosted, live quote link instead of a PDF — that's the only thing behind it, everything
above stays free forever.

[Changelog](https://3dcoster.com/changelog) · [Try it](https://3dcoster.com/app) ·
[What's free vs Pro](https://3dcoster.com/pricing)

Happy to answer questions — this has been a solo side project for a while and I'd love
feedback from people actually selling prints.

---

### X / Twitter

3DCoster 2.0 is out.

Real failure-rate tracking, time-of-use electricity, printer ROI, an STL → instant quote,
and cross-device sync — all still free, no account, works offline.

New: 3DCoster Pro for hosted, shareable quotes your customers can approve online.

https://3dcoster.com/changelog

---

### X / Twitter (thread follow-up, optional second post)

The idea behind 3DCoster has always been the same: most makers underprice because
filament cost is the only cost they're actually looking at. v2.0 goes further — it now
learns your *real* failure rate and electricity cost from your own data instead of asking
you to guess.

Free floor, forever. Pro is optional: $7.99/mo for hosted quote links, launch pricing
for early supporters. https://3dcoster.com/pricing

---

## Notes for the founder

- Every post above leads with the free floor before mentioning Pro — matches the
  project's "floor-and-ceiling, never a contradiction" pricing rule.
- `announcement.json` has been updated with in-app banner copy (`active: false`). Flip it
  to `true` on `main` on launch day; jsDelivr's CDN cache can lag up to ~12h, so if you
  need it live immediately, hit
  `https://purge.jsdelivr.net/gh/Waarangel/3dcoster@main/announcement.json` right after
  flipping it.
- The Discord release post is automatic on tag push — no manual step needed there.
- None of the drafts above include a donation/support ask — SupportNudge and this kit are
  the two Pro-pitch surfaces at launch (D-03); a donation ask is parked for a possible
  future secondary ask, not part of this launch.
