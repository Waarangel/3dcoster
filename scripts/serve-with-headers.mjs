// Serve dist/ locally with the exact headers from vercel.json, so the
// browser enforces the same CSP a Vercel deployment would. SPA fallback
// mirrors the vercel.json rewrite. Usage: node scripts/serve-with-headers.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const PORT = 4173;
const DIST = new URL('../dist', import.meta.url).pathname;
const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const headerPairs = vercelConfig.headers[0].headers;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

createServer((req, res) => {
  const urlPath = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let filePath = join(DIST, urlPath);
  if (!filePath.startsWith(DIST) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST, 'index.html'); // SPA fallback, same as the vercel.json rewrite
  }
  for (const { key, value } of headerPairs) res.setHeader(key, value);
  res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
  res.end(readFileSync(filePath));
}).listen(PORT, () => console.log(`serving dist/ with vercel.json headers on http://localhost:${PORT}`));
