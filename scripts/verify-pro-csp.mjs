// scripts/verify-pro-csp.mjs
// Phase 43-02 (PRO-01/PRO-03/PRO-04) enforcement gate: asserts the network
// boundary for the Pro backend is correctly configured BEFORE any Pro code
// calls out — the CSP allowlist, the server-side SPA-fallback rewrite
// exclusion, and the PWA service-worker navigation-fallback denylist.
//
// Reads vercel.json + vite.config.ts as source (no build artifact needed —
// this is a static-config gate, unlike the PDF-04 dist/ gates). Run directly
// via `node scripts/verify-pro-csp.mjs`.
//
// Checks (Task 1 acceptance criteria):
//   1. vercel.json connect-src contains a supabase.co origin
//   2. vercel.json connect-src contains a paddle origin
//   3. vercel.json frame-src is not 'none' and contains a paddle origin
//   4. vercel.json script-src contains a paddle origin
//   5. vercel.json rewrite source excludes q/ and api/ (negative-lookahead)
//   6. vite.config.ts workbox block has navigateFallbackDenylist covering
//      ^/q/ and ^/api/
//   7. vite.config.ts workbox block has NO runtimeCaching rule targeting
//      /q/ or /api/ (those responses must never be cached by the SW)

import { readFileSync } from 'fs';

let failed = false;
function check(label, condition) {
  if (condition) {
    console.log(`✓ ${label}`);
  } else {
    console.error(`✗ ${label}`);
    failed = true;
  }
}

// --- vercel.json ---
let vercelJson;
try {
  vercelJson = JSON.parse(readFileSync('vercel.json', 'utf8'));
} catch (err) {
  console.error(`verify-pro-csp: could not read/parse vercel.json — ${err.message}`);
  process.exit(1);
}

const cspHeader = vercelJson.headers?.[0]?.headers?.find(
  (h) => h.key === 'Content-Security-Policy',
)?.value;

if (!cspHeader) {
  console.error('verify-pro-csp: could not find Content-Security-Policy header in vercel.json');
  process.exit(1);
}

function directive(csp, name) {
  const match = csp.match(new RegExp(`${name}\\s+([^;]*)`));
  return match ? match[1].trim() : '';
}

const connectSrc = directive(cspHeader, 'connect-src');
const scriptSrc = directive(cspHeader, 'script-src');
const frameSrc = directive(cspHeader, 'frame-src');

check('vercel.json connect-src contains a supabase.co origin', /supabase\.co/i.test(connectSrc));
check('vercel.json connect-src contains a paddle origin', /paddle/i.test(connectSrc));
check(
  "vercel.json frame-src is not 'none' and contains a paddle origin",
  !/^'none'$/i.test(frameSrc) && /paddle/i.test(frameSrc),
);
check('vercel.json script-src contains a paddle origin', /paddle/i.test(scriptSrc));

const rewriteSource = vercelJson.rewrites?.[0]?.source ?? '';
check(
  'vercel.json rewrite source excludes q/ and api/ (negative-lookahead)',
  /\(\?!.*q\/.*\|.*api\/.*\)/.test(rewriteSource) || (rewriteSource.includes('?!') && rewriteSource.includes('q/') && rewriteSource.includes('api/')),
);

// --- vite.config.ts ---
let viteConfig;
try {
  viteConfig = readFileSync('vite.config.ts', 'utf8');
} catch (err) {
  console.error(`verify-pro-csp: could not read vite.config.ts — ${err.message}`);
  process.exit(1);
}

const workboxMatch = viteConfig.match(/workbox:\s*\{([\s\S]*?)\n\s{6}\}/);
const workboxBlock = workboxMatch ? workboxMatch[1] : '';

check(
  'vite.config.ts workbox block is present',
  workboxBlock.length > 0,
);
check(
  'vite.config.ts workbox.navigateFallbackDenylist matches ^/q/',
  /navigateFallbackDenylist/.test(workboxBlock) && /\^\\\/q\\\//.test(workboxBlock),
);
check(
  'vite.config.ts workbox.navigateFallbackDenylist matches ^/api/',
  /navigateFallbackDenylist/.test(workboxBlock) && /\^\\\/api\\\//.test(workboxBlock),
);

const runtimeCachingMatch = workboxBlock.match(/runtimeCaching:\s*\[([\s\S]*)\]/);
const runtimeCachingBlock = runtimeCachingMatch ? runtimeCachingMatch[1] : '';
check(
  'vite.config.ts workbox.runtimeCaching has NO rule targeting /q/ or /api/',
  !/\\\/q\\\//.test(runtimeCachingBlock) && !/\\\/api\\\//.test(runtimeCachingBlock),
);

if (failed) {
  console.error('\nverify-pro-csp FAILED — see ✗ items above.');
  process.exit(1);
}
console.log('\n✓ verify-pro-csp: CSP + rewrite + SW-denylist all correct.');
