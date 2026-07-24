---
created: 2026-07-24
source: Phase 47 UAT sign-in debugging (2026-07-24)
area: pro auth UX
---

# Surface auth `#error` fragments + document magic-link same-browser limitation

Two findings from live debugging (verified empirically against the production
Supabase project):

1. **Silent error swallow:** when a magic-link verify fails (e.g.
   `#error=access_denied&error_code=otp_expired` after Chrome omnibox prefetch
   consumed the single-use token), the app ignores the URL fragment entirely —
   the user lands on the page not signed in, with zero feedback. The client
   (`src/lib/supabaseClient.ts`, `flowType: 'pkce'`) also ignores VALID
   implicit-grant `#access_token=` fragments (PKCE clients only exchange
   `?code=`), again silently. Add a small fragment check on app load that
   surfaces `error_description` to the user (and strips the fragment).

2. **Document/design around:** emailed magic LINKS only complete sign-in in the
   browser that requested them (the PKCE `code_verifier` lives there). A link
   clicked in any other browser/profile arrives as an implicit fragment and is
   ignored (see 1). The OTP code path (46-02) is the universal one — SignInModal
   copy already leans on it, but the "check your email — click the link" toast
   still suggests the link as an equal option. Consider ordering the copy
   code-first, or handling `token_hash` verification so cross-browser links work.

Related: Chrome address-bar paste PREFETCHES URLs and consumes single-use
verify tokens before Enter is pressed — a known magic-link footgun; another
reason the code path should be primary.

**Disposition:** small UX hardening, post-47. Candidate for Phase 51 launch-prep
polish (pairs with launch-checklist items 10/11).
