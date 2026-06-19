#!/usr/bin/env node
/**
 * Extract a CHANGELOG.md section for a given tag and emit it as the GitHub
 * release body (plus the Download artifacts section).
 *
 * Usage:
 *   node scripts/extract-changelog.cjs v1.3.2
 *
 * Behavior:
 *   - Reads CHANGELOG.md at repo root.
 *   - Finds the section header `## [1.3.2]` (tag with leading `v` stripped).
 *   - Captures the section body (everything between the header and the next
 *     `## [` header, `## Older releases`, or EOF).
 *   - Emits `## What's New\n\n<section body>\n\n## Download\n...` on stdout.
 *
 * Fallback (when no section is found):
 *   - Logs a WARNING to stderr (the GitHub Actions build log surfaces this).
 *   - Emits a generic "See commits for changes" template instead of failing.
 *   - Exit code is still 0 — soft warning, not a hard block.
 *
 * This script never fails the release. It is intentionally a "soft gate" that
 * makes missing CHANGELOG entries visible without blocking shipping. The rule
 * lives in .claude/CLAUDE.md: every `v*` tag MUST have a `## [X.Y.Z]` section
 * in CHANGELOG.md before tagging.
 */

const fs = require('fs');
const path = require('path');

const tag = process.argv[2];
if (!tag) {
  process.stderr.write('Usage: extract-changelog.cjs <tag>\n');
  process.exit(2);
}

const version = tag.replace(/^v/, '');
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

const DOWNLOAD_SECTION = [
  '## Download',
  '',
  '- **Windows**: Download the `_x64-setup.exe` file',
  '- **macOS (Apple Silicon)**: Download the `_aarch64.dmg` file',
  '- **macOS (Intel)**: Download the `_x64.dmg` file',
  '- **Linux (AppImage)**: Download the `_amd64.AppImage` file, then make it executable (`chmod +x`)',
  '- **Linux (Debian/Ubuntu)**: Download the `_amd64.deb` file',
  '- **Linux (Fedora/RHEL)**: Download the `.x86_64.rpm` file',
  ''
].join('\n');

function extractSection(content, ver) {
  // Match `## [1.3.2]` (escape dots in the version) and capture everything
  // up to the next top-level header (`## `) or the end of file.
  const escapedVersion = ver.replace(/\./g, '\\.');
  const headerRegex = new RegExp(
    `^## \\[${escapedVersion}\\][^\\n]*$`,
    'm'
  );
  const headerMatch = headerRegex.exec(content);
  if (!headerMatch) return null;

  const afterHeader = content.slice(headerMatch.index + headerMatch[0].length);
  // Stop at next `## ` header (versioned section, "Older releases", etc.)
  const nextHeaderMatch = /^## /m.exec(afterHeader);
  const body = nextHeaderMatch
    ? afterHeader.slice(0, nextHeaderMatch.index)
    : afterHeader;

  return body.trim();
}

let body = null;
if (fs.existsSync(changelogPath)) {
  const content = fs.readFileSync(changelogPath, 'utf-8');
  body = extractSection(content, version);
}

if (body && body.length > 0) {
  process.stdout.write(`## What's New\n\n${body}\n\n${DOWNLOAD_SECTION}`);
} else {
  process.stderr.write('\n');
  process.stderr.write('⚠'.repeat(60) + '\n');
  process.stderr.write(`⚠ WARNING: No CHANGELOG.md section found for ${tag}.\n`);
  process.stderr.write(`⚠ Falling back to generic release template.\n`);
  process.stderr.write(`⚠ Add a "## [${version}] - YYYY-MM-DD" section to CHANGELOG.md\n`);
  process.stderr.write(`⚠ BEFORE the next release tag is pushed.\n`);
  process.stderr.write(`⚠ See .claude/CLAUDE.md "Desktop App Release Process" for the rule.\n`);
  process.stderr.write('⚠'.repeat(60) + '\n\n');

  const fallback = [
    DOWNLOAD_SECTION,
    "## What's New",
    '',
    `See the [commits since previous tag](https://github.com/Waarangel/3dcoster/commits/${tag}) for changes in this release.`,
    '',
    `_Note: detailed release notes are missing for this version. Future releases should include a CHANGELOG.md section per [Keep a Changelog](https://keepachangelog.com)._`
  ].join('\n');
  process.stdout.write(fallback);
}
