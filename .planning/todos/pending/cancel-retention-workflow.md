---
created: 2026-07-24
source: founder note during Phase 47 UAT (2026-07-24)
area: billing / Pro retention
---

# Build a real cancellation workflow (not "cancel from your Paddle receipt email")

**Founder decision (verbatim intent):** We cannot simply tell people to cancel
from their Paddle link. We need an entire cancel workflow, with points that try
to stop them — discounts, priority support, etc. — dependent on their stated
issue.

**Current state (what triggered this):** BillingPanel's Pro card copy reads
"Cancel anytime from the subscription link in your Paddle receipt email."
(`src/components/pro/BillingPanel.tsx` — also carries the still-open web-only
gate founder question from 46-10.) That was the 43-06 minimal path: env-driven
`VITE_PADDLE_CANCEL_URL`, falling back to receipt-email manage links.

**Target shape (to be designed, not locked):**
- In-app "Cancel subscription" entry point (web + desktop parity rule applies).
- Ask-why step: capture the cancellation reason first.
- Reason-dependent save attempts, e.g.:
  - price → time-limited discount offer (Paddle supports subscription discounts),
  - product gap / bug → priority support contact + optionally pause instead,
  - not using it → pause/downgrade reminder of free floor keeping all local data.
- Only then hand off to the actual Paddle cancellation (API-driven or hosted).
- Instrument outcomes so save-rate is measurable.

**Dependencies / sequencing:**
- Needs live Paddle SKUs + API access (Phase 51 sets up Paddle SKUs; real
  cancellation API work can't be tested before a sandbox subscription exists —
  pairs naturally with launch-checklist item 6's sandbox checkout/cancel round
  trip).
- Resolve together with the 46-10 open question (BillingPanel web-only gate vs
  web+desktop parity).
- ToS wording ("cancel anytime") must stay truthful — retention offers must
  never obstruct the actual cancel path (dark-pattern/compliance risk,
  especially EU).

**Disposition:** post-47 scope. Candidate: fold into Phase 51 launch-prep
planning or a dedicated retention phase; founder decides at Phase 51 planning.
