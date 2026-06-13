#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Release cadence guard — BLOCKING PreToolUse hook (added 2026-06-12 after
// v1.5.0 and v1.6.0 shipped the same day and double-nudged desktop users).
//
// Rule: a MINOR or MAJOR release tag may only be created/pushed when the most
// recent release is at least MIN_DAYS_BETWEEN_FEATURE_RELEASES old. PATCH
// releases (vX.Y.Z where only Z increases) are never blocked — fixes ship as
// fast as possible.
//
// Reads the Claude Code hook payload from stdin, inspects the Bash command
// for tag-creating/pushing operations, and exits 2 (block) with an
// explanation when the rule is violated. Exit 0 allows the command.
//
// Emergency override (deliberate, visible): prefix the command with
//   RELEASE_CADENCE_OVERRIDE=1 git tag vX.Y.Z
// ---------------------------------------------------------------------------

import { execSync } from 'node:child_process';

const MIN_DAYS_BETWEEN_FEATURE_RELEASES = 5;
const SEMVER_TAG = /^v(\d+)\.(\d+)\.(\d+)$/; // 3-part only; 2-part tags are GSD milestones

function parseVersion(tag) {
  const m = SEMVER_TAG.exec(tag);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
}

import { readFileSync } from 'node:fs';

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return 0; // unparseable payload — never block on guard malfunction
  }

  const command = payload?.tool_input?.command ?? '';
  if (!command) return 0;

  // The override must appear in the command itself so it is visible in
  // transcripts and shell history — a quiet env var in the session would
  // defeat the point of a hard guard.
  if (/\bRELEASE_CADENCE_OVERRIDE=1\b/.test(command)) {
    console.log('Release cadence guard: override present — allowing.');
    return 0;
  }

  // Strip quoted strings so a commit message mentioning "v1.2.3" can't
  // false-positive (same approach as the release-review reminder hook).
  const stripped = command.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');

  // Candidate tag from: git tag vX.Y.Z | git push ... vX.Y.Z | gh release create vX.Y.Z
  let candidate =
    /\bgit\s+tag\s+(?:-[a-zA-Z]+\s+)*?(v\d+\.\d+\.\d+)\b/.exec(stripped)?.[1] ??
    /\bgit\s+push\b[^|;&]*?\s(v\d+\.\d+\.\d+)\b/.exec(stripped)?.[1] ??
    /\bgh\s+release\s+create\s+(v\d+\.\d+\.\d+)\b/.exec(stripped)?.[1] ??
    null;

  const pushesAllTags = /\bgit\s+push\b[^|;&]*\s--tags\b/.test(stripped);
  if (!candidate && !pushesAllTags) return 0; // not a release operation

  // Existing 3-part semver tags with creation timestamps, newest first.
  let tagLines;
  try {
    tagLines = execSync(
      "git for-each-ref refs/tags --sort=-creatordate --format='%(refname:short) %(creatordate:unix)'",
      { encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean);
  } catch {
    return 0; // git unavailable — don't block on guard malfunction
  }

  const releases = tagLines
    .map(line => {
      const [tag, ts] = line.replace(/'/g, '').split(/\s+/);
      const version = parseVersion(tag);
      return version ? { tag, version, ts: Number(ts) } : null;
    })
    .filter(Boolean);

  if (pushesAllTags && !candidate) {
    // `git push --tags` — treat the semver-newest local tag as the candidate.
    const newest = [...releases].sort((a, b) =>
      b.version.major - a.version.major || b.version.minor - a.version.minor || b.version.patch - a.version.patch,
    )[0];
    if (!newest) return 0;
    candidate = newest.tag;
  }

  const candidateVersion = parseVersion(candidate);
  if (!candidateVersion) return 0;

  // Baseline excludes the candidate itself (it may already exist locally
  // when this fires on the push).
  const baseline = releases.filter(r => r.tag !== candidate);
  if (baseline.length === 0) return 0; // first release ever — allow

  // Bump type vs the semver-highest prior release.
  const highest = [...baseline].sort((a, b) =>
    b.version.major - a.version.major || b.version.minor - a.version.minor || b.version.patch - a.version.patch,
  )[0].version;

  const isFeatureBump =
    candidateVersion.major > highest.major ||
    (candidateVersion.major === highest.major && candidateVersion.minor > highest.minor);

  if (!isFeatureBump) return 0; // patch (or re-tag/lower) — never blocked

  // Spacing vs the most RECENT prior release of any kind.
  const mostRecent = baseline[0]; // already sorted newest-first by creatordate
  const ageDays = (Date.now() / 1000 - mostRecent.ts) / 86400;

  if (ageDays >= MIN_DAYS_BETWEEN_FEATURE_RELEASES) return 0;

  const waitDays = (MIN_DAYS_BETWEEN_FEATURE_RELEASES - ageDays).toFixed(1);
  console.error(
    `BLOCKED by release cadence guard: ${candidate} is a minor/major release, but the last release ` +
    `(${mostRecent.tag}) shipped only ${ageDays.toFixed(1)} days ago. Feature releases must be at least ` +
    `${MIN_DAYS_BETWEEN_FEATURE_RELEASES} days apart so desktop users aren't repeatedly nudged — wait ~${waitDays} more day(s), ` +
    `or ship it as a patch if it truly is one. Emergency override (requires the human's explicit approval): ` +
    `prefix the command with RELEASE_CADENCE_OVERRIDE=1`,
  );
  return 2;
}

process.exit(main());
