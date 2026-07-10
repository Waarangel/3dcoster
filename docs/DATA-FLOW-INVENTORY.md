# Data Flow Inventory

Source of truth for every external destination 3DCoster's web app can reach.
This table is generated from the `connect-src` allowlist in `vercel.json`
(the Content-Security-Policy that governs which origins the browser is
permitted to talk to), cross-checked against every `fetch(` call site in
`src/`.

**Process discipline (Pitfall C-05):** Any change that adds, removes, or
repurposes a network destination — a new API, a new SDK, a new CDN — updates
**this inventory first**, then the Privacy Policy (`src/pages/PrivacyPage.tsx`)
second. The policy's processor list must never drift ahead of, or fall behind,
what the code actually does. Phase 43 (Pro Backend / Supabase) is the next
change that will touch this file — update the Supabase row from FORTHCOMING to
live, with its real retention and legal-basis answers, before that policy
section ships.

## External Destinations

| What data | Who collects it | Where it goes | Retention | Legal basis |
|---|---|---|---|---|
| Static app bundle + page requests | Vercel (hosting) | `3dcoster.com` served via Vercel's CDN/edge network | Standard web server/CDN access logs per Vercel's own retention policy | Legitimate interest (operating the service) |
| Aggregate page-view counts (no cookies, no cross-site tracking) | Vercel Web Analytics (`@vercel/analytics`, same-origin `/_vercel/insights/*`) | Vercel, aggregated | Aggregate counts only; no per-user profile retained by 3DCoster | Consent (only loads after the user accepts the "Analytics" category in the cookie banner — see `src/components/consent/`) |
| None (no request body) — checks the latest published version tag | Desktop app, via `api.github.com` | GitHub REST API (`/repos/Waarangel/3dcoster/releases/latest`) | Not stored by 3DCoster; GitHub's own API logs apply | Legitimate interest (notifying users of app updates) |
| None (no request body) — fetches a static JSON announcement | Marketing site, via `cdn.jsdelivr.net` | jsDelivr CDN (serves `announcement.json` from this repo) | Not stored by 3DCoster; jsDelivr's own CDN logs apply | Legitimate interest (in-app product announcements) |
| None (no request body) — fetches published exchange-rate tables | Currency conversion, via `latest.currency-api.pages.dev` and `api.frankfurter.dev` (two independent FX providers, primary + fallback) | Cloudflare Pages-hosted currency-api mirror; Frankfurter (European Central Bank rate republisher) | Not stored by 3DCoster beyond an in-memory/local cache of the rate table; provider logs apply | Legitimate interest (displaying prices in the user's chosen currency) |
| User-entered feedback message + optional reply-to email address (PII when provided) | Formspree, via `formspree.io` | Formspree's form-processing backend, which forwards to the project owner's inbox | Retained per Formspree's own data retention policy; submission is voluntary and initiated by the user | Consent (user actively fills out and submits the feedback form) |
| **On-device only — never transmitted** | The browser's IndexedDB (via Dexie.js) | Nowhere — projects, jobs, printers, filaments, customers, sales, and settings stay on the user's device | Until the user clears browser data or exports/deletes it themselves | N/A — no processing occurs off-device |
| **FORTHCOMING (Phase 43 — Pro Backend, not yet live):** Pro-tier account data (email, hashed auth token, saved quotes) | Supabase (planned region: `eu-central-1`, Frankfurt) | Supabase-hosted Postgres, EU region | To be defined in the Phase 43 Privacy Policy update, alongside a new effective date | To be defined — will require explicit account creation (contract necessity) |

## Notes

- This list reflects every origin in the `connect-src` directive of `vercel.json`'s Content-Security-Policy as of this writing: `'self'`, `api.github.com`, `cdn.jsdelivr.net`, `latest.currency-api.pages.dev`, `api.frankfurter.dev`, `formspree.io`. Any origin not on this list cannot be reached by the browser — the CSP itself is a technical control that keeps this inventory enforceable, not just descriptive.
- The desktop (Tauri) build ships with zero analytics and no consent banner — there is nothing to consent to on desktop. The `api.github.com` update check happens on both platforms; it carries no user data in the request.
- Cross-checked against `grep -rn "fetch(" src/` to confirm no undisclosed egress exists outside the CSP allowlist.
