// scripts/lint-no-raw-html.mjs
// Grep-based guard: forbids raw <button>/<input>/<select>/<textarea> JSX
// in src/components/ (excluding src/components/ui/). Lines preceded by
// `allow-raw-html` (in a JSX or JS comment) are exempted.
//
// Wired into package.json `build` and `.git/hooks/pre-commit` per Phase 07
// (UI-03). Minimal Node built-ins; no npm install required.
//
// Windows-safe: paths from `join()` use the platform separator (backslash on
// Windows). All path comparisons normalize to forward slashes first — without
// this, `src/components/ui` would never match `src\components\ui` and every
// UI primitive would be falsely flagged. This bug failed the Windows matrix
// of the v1.3 release workflow run; fixed 2026-05-28.
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const SCAN_DIRS = ['src/components'];
const EXCLUDE_DIR = 'src/components/ui';
const PATTERN = /<(button|input|select|textarea)([\s>\/]|$)/;

// Normalize Windows backslashes to forward slashes for cross-platform path
// comparison and consistent violation output.
function toPosix(p) {
  return p.replace(/\\/g, '/');
}

function getFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(e => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return getFiles(full);
    return e.name.endsWith('.tsx') || e.name.endsWith('.ts') ? [full] : [];
  });
}

const violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of getFiles(dir)) {
    if (toPosix(file).startsWith(EXCLUDE_DIR)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (PATTERN.test(lines[i])) {
        const prevLine = i > 0 ? lines[i - 1] : '';
        if (!prevLine.includes('allow-raw-html')) {
          violations.push(`${toPosix(relative('.', file))}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Raw HTML form elements found (use shared primitives or add // allow-raw-html):');
  violations.forEach(v => console.error('  ' + v));
  process.exit(1);
}
console.log('lint:no-raw-html passed');
