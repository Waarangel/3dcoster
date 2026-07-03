# Stack Research — v2.0 Cost-Truth & Insight Additions

**Domain:** 3D printing cost calculator — hosted/Pro backend, in-browser mesh volume, GDPR consent, local-sync, electricity tariffs
**Researched:** 2026-07-03
**Confidence:** MEDIUM-HIGH (Supabase/PocketBase pricing from official pages + multiple verified sources; Three.js volume from Three.js forums + npm; cookie-consent from npm + official docs; Dexie Cloud from official pricing page; electricity APIs from official pages)

---

## Context

This document covers ONLY the new dependencies and services required for v2.0. The existing locked stack is:

- React 18 + TypeScript + Vite + Tailwind + Dexie.js 4 (IndexedDB) + jsPDF (lazy) + react-window 2 + Vitest
- Tauri 2 desktop (Win/macOS/Linux), PWA, Vercel web hosting
- fawazahmed0 FX API, no backend, all data local

The existing 300 KB gz main-chunk build gate stays. All new heavy libraries must lazy-load via dynamic `import()`.

---

## Area 1: Hosted/Pro Backend Tier

### Recommendation: PocketBase 0.27 on a Hetzner CX22 VPS

**What you need:** accounts, hosted quote page rendering, instant-quote share tokens, cloud sync for Pro users. This is the first ever backend for 3DCoster.

**The constraint that drives the choice:** solo founder, sub-1,000 Pro users at launch, EU user base (GDPR), offline free floor must keep working with no account, low ops burden.

---

### Decision Rationale

| Criterion | PocketBase self-hosted | Supabase Cloud (Frankfurt) | Cloudflare Workers + D1 | Vercel + Neon |
|-----------|------------------------|---------------------------|-------------------------|---------------|
| CLOUD Act exposure | None (EU VPS, your jurisdiction) | Yes (US parent company, even on eu-central-1) | Yes (US company) | Yes (US company) |
| Ops burden at launch | Single binary, systemd + hourly S3 backup | Managed — low until custom SQL needs arise | Very low (serverless) | Very low (serverless) |
| Cost at ~200 Pro users | ~€8/mo total | $25/mo Pro + egress overages | ~$0 (free tier likely covers) | ~$0 free tier |
| Auth built-in | Yes (email + OAuth2) | Yes | No (need Clerk/Auth.js) | No |
| File storage built-in | Yes | Yes (1 GB free, then $0.021/GB) | No (need R2 separately) | No |
| Real-time API | Yes (SSE subscriptions) | Yes (WebSockets) | No (Durable Objects extra) | No |
| SQLite vs Postgres | SQLite (adequate to ~50k MAUs, 1 VPS) | Postgres (overkill at launch) | SQLite D1 (10 GB limit) | Postgres serverless |
| TypeScript SDK | `pocketbase` 0.27.0 — full TypeScript | `@supabase/supabase-js` — full TypeScript | `@cloudflare/workers-types` | `@neondatabase/serverless` |
| GDPR DPA available | Self-controlled (you ARE the controller) | Yes, but US parent CLOUD Act residual | No clear DPA | No clear DPA |

**Winner: PocketBase on Hetzner CX22 (Nuremberg, DE)**

- EU-jurisdiction data from day one, zero CLOUD Act exposure, full GDPR data-controller ownership
- €4.35/mo VPS + ~€3/mo Hetzner Object Storage (S3-compatible) = **~€8/mo total** vs Supabase's $25/mo minimum (which pauses free projects after 1 week inactive)
- Single binary deployment: `./pocketbase serve` behind nginx + Let's Encrypt. Zero managed services to reason about
- PocketBase comfortably serves 10,000+ concurrent connections on a CX22 (2 vCPU, 4 GB RAM, 40 GB SSD) per community benchmarks
- The JS SDK (`pocketbase` npm) is full TypeScript, first-class, maintained by the same team. Version 0.27.0 (latest as of July 2026)
- OAuth2 built-in (Google, GitHub) so Pro users can sign up in one click, matching what 3DPrintQuote (the €9.90/mo competitor) offers

**When to revisit:** if Pro user count exceeds ~20,000 monthly active or if you need row-level security policies more sophisticated than PocketBase's rule system → migrate to managed Postgres (Neon or Supabase self-hosted)

---

### Instant-Quote Share Links (Free Floor)

The free floor is a URL like `https://3dcoster.com/q/abc123` that renders a static HTML quote page without requiring the recipient to have an account. The implementation is:

1. **Token generation (client-side):** `crypto.randomUUID()` → base62-encode → 8-char slug. Store in local Dexie `quotes` table alongside quote data.
2. **Free floor (no backend):** Encode the full quote JSON as a compressed base64 URL parameter: `?d=<lz-compressed-base64>`. The `/q/[slug]` route at `3dcoster.com` (a Vercel route) decodes and renders the quote entirely client-side. No server write. URL length with LZ-compression is typically 800–1,200 chars for a quote — within browser URL limits. Shareable link works offline (open the link locally from the quote page).
3. **Pro floor (backend):** POST quote JSON to PocketBase `quotes` collection → returns short slug → short URL like `3dcoster.com/q/abc123` (clean, no long query string). Recipient loads the route, Vercel edge function fetches from PocketBase, renders SSR HTML. Enables expiry, revoke, view tracking.

**Free-floor library:** `lz-string` (3.7 KB gz, MIT) for URL-safe compression. No backend call.

---

### Hosted Quote Page Rendering

For the Pro hosted page, use a Vercel Edge Function (already in use for Vercel hosting) that fetches from PocketBase and returns server-rendered HTML. This avoids a dedicated Node server. Pattern:

```
GET /q/[slug] → Vercel Edge Function → PocketBase REST GET /api/collections/quotes/records/{slug} → render HTML
```

No React SSR framework needed. The quote page is static-enough HTML (jinja-equivalent template string in the edge function). Keep it simple.

---

## Area 2: In-Browser Mesh Volume Estimation

### Recommendation: Three.js (lazy-loaded) + `three-volume` 2.0.7 + manual signed-tetrahedra fallback

**What you need:** parse STL/3MF from file input, calculate cm³ volume, feed into cost estimate — all in the browser, no upload.

---

### Library Choices

**Three.js (`three`) — for geometry loading and parsing**
- Version: `^0.169.0` (r169, released Sep 2024; active development)
- gz size: ~155 KB (full import) — MUST lazy-load, never in main chunk
- Why Three.js: `STLLoader` (binary + ASCII) and `ThreeMFLoader` (3MF zip) are in the `three/addons` extras, actively maintained, correct winding-order handling
- Tree-shaking note: Three.js does not tree-shake meaningfully. Lazy-load the entire geometry pipeline as one dynamic chunk

**`three-volume` 2.0.7 — volume computation**
- Version: 2.0.7, last published June 26, 2024
- Purpose: takes a Three.js `BufferGeometry` and returns volume in original units (cm³ if your STL is in mm, divide by 1000)
- Algorithm: signed-tetrahedra summation over all triangles — the mathematically correct method for watertight meshes
- Important: Three.js itself has no native `mesh.volume()` (issue #27905 closed as "not planned"). `three-volume` is the recommended external solution

**Known limitation:** Volume calculation is only accurate for watertight (manifold) meshes. Non-manifold STLs return incorrect values. Show a warning if the calculated volume is 0 or negative (sign of an open mesh). This is expected — most printer-ready models are watertight.

**Lazy-load shape:**
```ts
// src/utils/estimateMeshVolume.ts — no top-level imports from three
export async function estimateMeshVolume(file: File): Promise<{ volumeCm3: number; warning?: string }> {
  const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
  const { getVolume } = await import('three-volume');
  // ... parse + compute
}
```

**3MF support:** `ThreeMFLoader` is in `three/addons/loaders/ThreeMFLoader.js`. 3MF files are ZIP archives — the browser's native `DecompressionStream` (Chromium 80+, Firefox 113+) can unzip them without a library. PocketBase already added zip-bomb guards (Tauri v1.9); apply the same 50 MB size gate before parsing.

**Alternative considered — `node-stl`:** Parses STL and returns volume without Three.js. But it's Node-first, last updated 2021, and doesn't support 3MF. Reject.

**Alternative considered — rolling the signed-tetrahedra algorithm manually:** ~40 lines of math. Tempting but `three-volume` already exists, is tested, and saves the maintenance burden. Use it.

---

## Area 3: GDPR Cookie Consent

### Recommendation: `vanilla-cookieconsent` v3 (orestbida) with a thin React `useEffect` wrapper

**What you need:** granular consent banner (analytics vs necessary), revocable, stored consent, works for EU visitors, no paid CMP. 3DCoster currently has Vercel Analytics (aggregate only, no tracking cookies per Vercel's docs). If analytics expand to include session recording or ad pixels, consent categories must gate them.

---

### Library Choice

**`vanilla-cookieconsent` (orestbida) v3**
- Latest version: 3.1.0 (active, 2024–2025)
- Bundle size: ~7 KB gz (framework-agnostic vanilla JS + CSS)
- Weekly downloads: HIGH volume (used on millions of sites per Osano CookieConsent fork; orestbida is the more maintained modern fork)
- Features: granular consent categories (necessary / analytics / marketing), revocable per-category, consent stored in `localStorage`, multilingual, GDPR + CCPA + LGPD coverage
- React integration: call `CookieConsent.run(config)` inside a `useEffect` on mount in `App.tsx`. The library manages its own DOM insertion. No React-specific wrapper needed

**Why not a React-specific library (`react-cookie-consent`, `react-gdpr`):**
These are simpler banners (accept/reject only). They don't support per-category granular consent out of the box. GDPR requires users to be able to reject specific categories while keeping others. For a small product this matters — the ICO and DPA enforcement actions increasingly focus on "all-or-nothing" banners that fail the granularity test.

**Why not a paid CMP (CookieHub, Cookiebot, OneTrust):**
Monthly subscription ($12–$99/mo) for a capability you can self-implement in ~2 hours. Overkill for a solo founder with modest analytics needs. The GDPR requirement is consent management correctness, not brand-name CMP vendor.

**Why not building from scratch:**
`vanilla-cookieconsent` is 6+ years old, battle-tested, and the v3 rewrite specifically addressed the ESM/framework-integration issues of v2. Do not reinvent this.

**Implementation sketch:**
```ts
// src/components/CookieConsentManager.tsx
import { useEffect } from 'react';
import CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';

export function CookieConsentManager() {
  useEffect(() => {
    CookieConsent.run({
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: { enabled: false },
      },
      language: {
        default: 'en',
        translations: {
          en: {
            consentModal: { title: 'We use cookies', description: '...' },
            preferencesModal: { title: 'Cookie preferences', ... },
          },
        },
      },
    });
  }, []);
  return null;
}
```

Mount `<CookieConsentManager />` in `App.tsx` web-only (skip in Tauri — no tracking cookies in the desktop app).

**Consent scope for 3DCoster today:** Vercel Analytics is classified as "aggregate analytics" and per Vercel's documentation does not set cookies or collect PII. Technically no consent banner is legally required today. But adding one now is correct for the Pro backend launch (Pro will involve session cookies for authentication) and avoids a retrofit sprint when those features land.

---

## Area 4: Local-Network / File-Based Multi-Device Sync

### Recommendation: Export/import JSON file-based sync as the free floor; Dexie Cloud as the paid-tier sync backend

**What you need:** a maker who owns two computers (desktop + laptop) can keep their data in sync WITHOUT requiring a Pro account.

---

### Analysis

**Option A — File-based (Dropbox/iCloud/OneDrive shared folder):** The user exports a single `3dcoster-backup.json` file to a shared cloud folder. Any other device with 3DCoster imports it. Manual, but already supported by the existing backup/restore feature. Zero new code needed — just UI guidance. This is the free floor.

**Option B — Dexie Cloud (€0.12/user/month):** Purpose-built sync for Dexie.js, same library already in use. HTTP long-polling + optional WebSocket. Conflict-free sync. Free tier: 3 users, 100 MB. The on-premises option (€3,495 one-time) gives you self-hosted sync.

**Option C — CRDT (Yjs or Automerge + custom sync server):** Yjs and Automerge are designed for collaborative text editing and simultaneous multi-user editing. 3DCoster's data model is user-owned records (jobs, materials, printers) — not collaborative documents. CRDT merge semantics are overkill for "two devices owned by the same person." The engineering cost (custom server, CRDT integration with Dexie, conflict resolution logic) far exceeds the benefit.

**Option D — Dexie-syncable (legacy):** Deprecated. Dexie.js 4 removed the syncable API. Do not use.

**Decision:**
- **Free floor:** Guided "cloud folder sync" — export backup.json to Dropbox/iCloud folder; import on other device. Already works. Add UI copy explaining the pattern.
- **Paid tier sync:** Dexie Cloud at €0.12/user/month. Sits on top of the existing Dexie.js calls with minimal API changes (add `dexie-cloud-addon` to the db definition, add an auth call). Conflict resolution is built-in (last-write-wins per object, adequate for solo-user multi-device sync).

**Dexie Cloud integration notes:**
- Package: `dexie-cloud-addon` (install alongside existing `dexie`)
- GDPR/data residency: Dexie Cloud does not publish explicit EU-region data residency. For the Pro tier this is an open concern — mitigate by framing Dexie Cloud as a sync transport and keeping the authoritative copy in PocketBase. Alternatively, use the Dexie Cloud on-premises €3,495 one-time license once user base justifies it.
- The PocketBase backend (Area 1) can serve as the sync authority if Dexie Cloud's data residency story remains unclear — implement a custom sync layer on top of PocketBase collections

**Why not build CRDT from scratch:** Super-productivity (a large open-source productivity app) opened a GitHub issue (#4857) specifically about CRDT for multi-device sync and concluded that CRDT is the wrong model for this use case — last-write-wins with full history is sufficient and far simpler. Agreed.

---

## Area 5: Time-of-Use Electricity Tariff Data

### Recommendation: Data-entry-driven with static peak/off-peak table; no live API

**What you need:** a maker in Germany can say "peak rate is €0.38/kWh from 17:00–21:00, off-peak is €0.24/kWh otherwise" and 3DCoster uses the correct rate based on print start time.

---

### Analysis

**Live tariff APIs surveyed:**

| Service | Coverage | Free Tier | Cost | Verdict |
|---------|----------|-----------|------|---------|
| Electricity Maps | 50+ countries, carbon intensity + price | 1 zone, non-commercial only | $0 → paid plans | Reject (non-commercial restriction) |
| carbonintensity.org.uk | UK only | Full API, free | $0 | UK-only; irrelevant for global tool |
| OpenEI USURDB | US utility rates database | Full API, free | $0 | US-only; TOU rate structures very complex |
| Prezio EU | 10+ EU markets, real-time grid costs, TOU | Unknown free tier | Paid | Overkill at this stage; real-time grid pricing ≠ user's billed rate |

**The fundamental mismatch:** Live APIs give you *grid carbon intensity* or *wholesale grid price* — not the user's *billed tariff rate*. A residential Octopus Agile customer in the UK gets a rate that changes every 30 minutes. A German household on an E.ON flat rate plus a time-of-use rider has a fixed peak/off-peak split. The user's actual billed rate comes from their supplier contract, not from any free public API.

**Right approach:** User-entered TOU schedule (peak rate, off-peak rate, peak start hour, peak end hour). Store in `UserProfile` in existing Dexie schema. The calculator uses `getHours()` on the job's print start time to pick the rate. This is what the most direct competitor (3dprintpricecalculator.com) does — they don't try to integrate a live tariff API.

**Optional enhancement (not in MVP wave):** Add a "carbon intensity hint" using Electricity Maps' free Carbon Intensity Level API (high/moderate/low signal, free for all zones, updated hourly). Could surface a green-print badge or suggest scheduling off-peak for carbon reasons. This is a differentiator, not table stakes. Defer to a later wave.

**No new npm dependencies.** TOU modeling is pure arithmetic on the existing `UserProfile.electricityRate` field + two new fields `peakRate`/`peakHours`.

---

## New Dependencies Summary

| Package | Version | Type | gz (lazy?) | Purpose |
|---------|---------|------|-----------|---------|
| `pocketbase` | `^0.27.0` | dependency | ~15 KB | PocketBase JS/TS SDK for backend auth + REST |
| `three` | `^0.169.0` | dependency | ~155 KB (LAZY) | STL/3MF geometry loading |
| `three-volume` | `^2.0.7` | dependency | ~3 KB (LAZY, same chunk as three) | Mesh volume calculation |
| `vanilla-cookieconsent` | `^3.1.0` | dependency | ~7 KB | GDPR cookie consent banner |
| `lz-string` | `^1.5.0` | dependency | ~3.7 KB | URL-safe compression for free-floor quote share |
| `dexie-cloud-addon` | latest | dependency | ~25 KB | Paid-tier multi-device sync (Dexie Cloud) |

**New services:**
| Service | Cost at Launch | Notes |
|---------|---------------|-------|
| Hetzner CX22 VPS (Nuremberg, DE) | ~€4.35/mo | PocketBase server |
| Hetzner Object Storage (S3-compatible) | ~€3/mo | PocketBase file storage + backups |
| Dexie Cloud (optional, paid tier) | €0.12/user/month | Sync; 3-user free tier for testing |

**Total new infrastructure cost at zero Pro users:** ~€7–8/mo
**At 100 Pro users:** ~€7–8/mo VPS + €12/mo Dexie Cloud = ~€20/mo → covered by ~2 Pro subscriptions at €9.90/mo

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Supabase Cloud | US-parent CLOUD Act exposure even on Frankfurt region; $25/mo minimum; free tier pauses after 1 week inactivity | PocketBase self-hosted on EU VPS |
| Cloudflare D1 as primary DB | No auth, no storage, no real-time; adds Cloudflare Workers coupling; EU jurisdiction unconfirmed until November 2025 "eu" flag | PocketBase |
| Yjs / Automerge | Designed for collaborative text editing, not single-user multi-device sync; engineering cost disproportionate to the problem | File-based export (free) or Dexie Cloud (paid) |
| Dexie-syncable | Removed from Dexie 4; deprecated API | Dexie Cloud |
| Live electricity tariff API (Prezio, OpenEI, Electricity Maps) | Reports grid price, not user's billed rate; requires ongoing API key management; adds network dependency for a feature that works offline | User-entered TOU schedule in UserProfile |
| react-cookie-consent (simple banner) | Accept/reject only — does not support per-category granular consent required by GDPR | vanilla-cookieconsent v3 |
| Paid CMP (CookieHub, Cookiebot) | $12–$99/mo subscription for consent management already available in vanilla-cookieconsent free | vanilla-cookieconsent v3 |
| React Three Fiber (`@react-three/fiber`) | Full 3D scene graph for rendering; not needed just to parse geometry and extract a number; adds ~30 KB and requires React context | Import Three.js loaders directly, no R3F |
| Full Three.js in main chunk | 155 KB gz — kills the 300 KB gate | Lazy dynamic import only |
| Auth0, Clerk, Firebase Auth | External auth SaaS; adds vendor lock-in, data residency uncertainty, and monthly cost for a capability PocketBase includes free | PocketBase built-in auth |

---

## Stack Patterns

**If the user has a Pro account and is on desktop:**
- Dexie Cloud addon syncs local IndexedDB to the cloud
- PocketBase serves the hosted quote page and stores Pro-specific data
- Auth token stored in Tauri's secure keyring (`@tauri-apps/plugin-store` with OS keychain)

**If the user has no account (free floor, web or desktop):**
- All data stays local in IndexedDB (Dexie.js, unchanged)
- Instant-quote share link uses lz-string URL encoding — no server write
- Cookie consent banner fires on web (skip in Tauri)
- Mesh volume runs entirely in browser via Three.js lazy chunk

**If PocketBase VPS goes down:**
- Free-floor users: unaffected (no dependency)
- Pro users: local Dexie still works; sync queue when back online (Dexie Cloud handles this)
- Hosted quote links: return 503 — add a static fallback page

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `three@^0.169.0` | `three-volume@^2.0.7` | three-volume published against r169-era API; verify Three.js version in peer deps |
| `dexie@^4.x` | `dexie-cloud-addon` latest | Must use Dexie 4; addon is co-published by Dexie team |
| `pocketbase@^0.27.0` | React 18 + Vite | Framework-agnostic; no React peer dep |
| `vanilla-cookieconsent@^3.1.0` | React 18 | Framework-agnostic; mounted via `useEffect` |

---

## Installation

```bash
# Backend SDK
npm install pocketbase

# Mesh volume (lazy-loaded — three and three-volume in same dynamic chunk)
npm install three three-volume
npm install -D @types/three

# Cookie consent
npm install vanilla-cookieconsent

# Free-floor quote share URL compression
npm install lz-string
npm install -D @types/lz-string

# Paid-tier sync (install when Dexie Cloud integration phase begins)
npm install dexie-cloud-addon
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| PocketBase self-hosted (EU VPS) | Supabase Cloud (Frankfurt) | If you need Postgres-specific features (complex row-level security, pg extensions) and accept the CLOUD Act trade-off |
| PocketBase self-hosted | Managed Supabase self-host (Supabase on your VPS) | At >10k MAUs when SQLite limits appear; same VPS can host both |
| vanilla-cookieconsent v3 | Build from scratch | Never — the library is battle-tested and free |
| Three.js + three-volume | node-stl | node-stl is Node-first, STL-only (no 3MF), abandoned 2021 |
| File-based sync (free) + Dexie Cloud (paid) | WebRTC P2P sync via Yjs y-webrtc | WebRTC P2P is complex (NAT traversal, signaling server) for a use case that file-export already solves adequately |
| User-entered TOU schedule | Electricity Maps API | If you ever add a "carbon footprint" feature and need real-time grid carbon intensity |

---

## Sources

- [DanubeData: Supabase GDPR alternatives Europe 2026](https://danubedata.ro/blog/supabase-alternatives-europe-gdpr-2026) — PocketBase pricing, CLOUD Act analysis (HIGH confidence — original research)
- [Supabase official pricing](https://supabase.com/pricing) — Free 500 MB / 50k MAU / pauses after 1 week; Pro $25/mo (verified from official page)
- [Innopulse: Supabase EU Frankfurt playbook](https://innopulse.io/en/insights/supabase-eu-data-residency) — Frankfurt region confirmed, CLOUD Act residual risk confirmed
- [Hetzner CX22 specs](https://www.hetzner.com/cloud/cost-optimized) — 2 vCPU, 4 GB RAM, 40 GB SSD, ~€4.35/mo (verified)
- [Hetzner: Deploy PocketBase](https://community.hetzner.com/tutorials/deploy-a-pocketbase/) — production deployment guide
- [PocketBase JS SDK GitHub](https://github.com/pocketbase/js-sdk) — v0.27.0 confirmed current
- [Three.js issue #27905](https://github.com/mrdoob/three.js/issues/27905) — "Three has no native method to calculate mesh volumes" — closed as not planned
- [Three.js forum: Volume of BufferGeometry](https://discourse.threejs.org/t/volume-of-three-buffergeometry/5109) — signed-tetrahedra algorithm confirmed correct for watertight meshes
- [three-volume on libraries.io](https://libraries.io/npm/three-volume) — v2.0.7, published June 26 2024, mesh volume calculator for Three.js
- [Dexie Cloud pricing](https://dexie.org/cloud/pricing) — Free 3 users / 100 MB; Production €0.12/user/month (verified from official page)
- [vanilla-cookieconsent GitHub (orestbida)](https://github.com/orestbida/cookieconsent) — v3.1.0, active, ~7 KB gz, granular consent categories
- [Three.js r169 release](https://github.com/mrdoob/three.js/releases/tag/r169) — Sep 2024, current stable
- [Three.js bundle size discussion](https://github.com/pmndrs/react-three-fiber/discussions/812) — ~155 KB gz full import, lazy-load required
- [Super-productivity CRDT discussion #4857](https://github.com/super-productivity/super-productivity/issues/4857) — CRDT is wrong model for single-user multi-device sync
- [Electricity Maps Free Tier API](https://www.electricitymaps.com/free-tier-api) — 1 zone, non-commercial only; Carbon Intensity Level API free for all zones
- [carbonintensity.org.uk](https://carbonintensity.org.uk/) — GB grid only, free API
- [Cloudflare D1 EU jurisdiction](https://developers.cloudflare.com/d1/) — "eu" flag available Nov 2025; daily free tier 5 GB
- [Vercel + Neon serverless Postgres](https://vercel.com/marketplace/neon) — integrated, free tier 0.5 GB/project; storage $0.35/GB-month post-Databricks acquisition
- [Buildmvpfast: Supabase vs Cloudflare](https://www.buildmvpfast.com/compare/supabase-vs-cloudflare) — feature/pricing comparison (MEDIUM confidence)

---

*Stack research for: 3DCoster v2.0 Cost-Truth & Insight new dependencies and services*
*Researched: 2026-07-03*
