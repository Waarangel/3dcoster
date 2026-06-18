import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Reveal } from '../components/motion/Reveal';
// Source of truth: CHANGELOG.md at repo root, loaded as a string at build time
// via Vite's `?raw` query. Replaces the previous GitHub Releases API fetch so
// the marketing /changelog page stays in lockstep with what we actually ship
// (no more "See the changelog" placeholder bodies from forgotten release.yml
// edits). The release workflow also extracts from the same CHANGELOG.md (see
// scripts/extract-changelog.cjs) so the GitHub release body and the marketing
// page never drift.
import changelogRaw from '../../CHANGELOG.md?raw';

/**
 * How many releases to display on the /changelog page.
 *
 * Industry best practice (Linear, Vercel, Stripe) is 5 — most-recent matters
 * most; older releases are one click away on GitHub. Keeps the page scannable.
 * Tune this constant if the release cadence changes.
 */
const MAX_RELEASES_DISPLAYED = 5;

const GITHUB_REPO = 'Waarangel/3dcoster';

interface ParsedRelease {
  version: string;     // e.g. "1.3.2" (no v prefix)
  date: string;        // ISO date string
  body: string;        // raw markdown body of the section
  url: string;         // constructed GitHub release URL
  type: 'major' | 'minor' | 'patch' | 'milestone';
}

function getVersionType(version: string): 'major' | 'minor' | 'patch' | 'milestone' {
  const parts = version.split('.');
  // 2-part versions (e.g. 1.3) are GSD milestone markers, not desktop releases.
  // Should never reach this function (parseChangelog filters to 3-part), but
  // classify defensively.
  if (parts.length < 3) return 'milestone';
  if (parts[0] !== '0' && parts[1] === '0' && parts[2] === '0') return 'major';
  if (parts[2] === '0') return 'minor';
  return 'patch';
}

/**
 * Parse CHANGELOG.md (Keep a Changelog format) into structured releases.
 *
 * Matches sections shaped like:
 *   ## [1.3.2] - 2026-05-28
 *   <body...>
 *   ## [1.3.1] - 2026-04-15   <-- terminator
 *
 * Skips `## [Unreleased]` and any section that isn't a 3-part semver version.
 * Stops body capture at the next `## ` header OR a horizontal-rule `---`
 * separator (CHANGELOG.md uses both to delimit sections).
 */
function parseChangelog(raw: string): ParsedRelease[] {
  const lines = raw.split('\n');
  // Match `## [1.3.2] - 2026-05-28` (also tolerant of optional time component
  // or `[YANKED]` suffix).
  const sectionHeader = /^## \[(\d+\.\d+\.\d+)\]\s*-\s*(\d{4}-\d{2}-\d{2})/;

  const releases: ParsedRelease[] = [];
  let current: { version: string; date: string; bodyLines: string[] } | null = null;

  const closeCurrent = () => {
    if (!current) return;
    // Trim trailing blank lines and a trailing `---` separator if present.
    while (current.bodyLines.length > 0 && current.bodyLines[current.bodyLines.length - 1].trim() === '') {
      current.bodyLines.pop();
    }
    if (current.bodyLines.length > 0 && current.bodyLines[current.bodyLines.length - 1].trim() === '---') {
      current.bodyLines.pop();
    }
    releases.push({
      version: current.version,
      date: new Date(current.date).toISOString(),
      body: current.bodyLines.join('\n').trim(),
      url: `https://github.com/${GITHUB_REPO}/releases/tag/v${current.version}`,
      type: getVersionType(current.version),
    });
    current = null;
  };

  for (const line of lines) {
    const match = line.match(sectionHeader);
    if (match) {
      closeCurrent();
      current = { version: match[1], date: match[2], bodyLines: [] };
      continue;
    }
    // Any other `## ` header (e.g. `## [Unreleased]`, `## Older releases`,
    // `## How to add a release section`) closes the current section without
    // starting a new one.
    if (line.startsWith('## ') && current) {
      closeCurrent();
      continue;
    }
    if (current) {
      current.bodyLines.push(line);
    }
  }
  closeCurrent();

  return releases;
}

function parseMarkdownBody(body: string): string[] {
  if (!body) return [];
  // Split by newlines and filter out empty lines, keep markdown formatting
  return body
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

// Parse inline markdown: **bold**, `code`, [link](url)
function renderInlineMarkdown(text: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  // Match **bold**, `code`, and [text](url)
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // **bold**
      parts.push(<strong key={match.index} className="text-[var(--ink)] font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      // `code`
      parts.push(<code key={match.index} className="bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-[var(--brand-soft)] text-xs">{match[4]}</code>);
    } else if (match[5]) {
      // [text](url) — only emit an anchor when the url is http/https to prevent
      // javascript:, data:, or other unsafe scheme injection from CHANGELOG.md.
      const url = match[7];
      const isSafe = url.startsWith('http://') || url.startsWith('https://');
      parts.push(isSafe
        ? <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-soft)] hover:text-[var(--brand)] underline transition-colors duration-200">{match[6]}</a>
        : <span key={match.index}>{match[6]}</span>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

export function ChangelogPage() {
  // CHANGELOG.md is bundled at build time — parse it once and memoize.
  // No loading state needed; no fetch can fail. Falls back to an empty list
  // if CHANGELOG.md ever becomes malformed (the "No Releases" empty state
  // below handles that case).
  const releases: ParsedRelease[] = useMemo(
    () => parseChangelog(changelogRaw).slice(0, MAX_RELEASES_DISPLAYED),
    []
  );
  const loading = false;
  const error: string | null = null;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col">
      <Header />

      {/* Main Content */}
      <main className="flex-1 pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <Reveal trigger="mount" className="text-center mb-12">
            <h1 className="font-display text-4xl font-bold text-[var(--ink)] mb-4">What's New</h1>
            <p className="text-[var(--ink-soft)] text-lg">
              See what features and fixes have been added to 3DCoster
            </p>
          </Reveal>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-2 border-[var(--hairline-strong)] border-t-[var(--brand)] rounded-full animate-spin mb-4" />
              <p className="text-[var(--ink-soft)]">Loading releases from GitHub...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
              <p className="text-red-300 mb-4">{error}</p>
              <a
                href="https://github.com/Waarangel/3dcoster/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--brand-soft)] hover:text-[var(--brand)] underline transition-colors duration-200"
              >
                View releases on GitHub
              </a>
            </div>
          )}

          {/* No Releases */}
          {!loading && !error && releases.length === 0 && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-8 text-center">
              <p className="text-[var(--ink-soft)] mb-4">No releases found yet.</p>
              <a
                href="https://github.com/Waarangel/3dcoster/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--brand-soft)] hover:text-[var(--brand)] underline transition-colors duration-200"
              >
                Check GitHub for releases
              </a>
            </div>
          )}

          {/* Releases List */}
          {!loading && !error && releases.length > 0 && (
            <Reveal trigger="inView" className="space-y-8">
              {releases.length >= MAX_RELEASES_DISPLAYED && (
                <p className="text-[var(--ink-faint)] text-sm text-center -mt-4">
                  Showing the {MAX_RELEASES_DISPLAYED} most recent releases. For older versions, see the{' '}
                  <a
                    href="https://github.com/Waarangel/3dcoster/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--brand-soft)] hover:text-[var(--brand)] underline transition-colors duration-200"
                  >
                    full archive on GitHub
                  </a>
                  .
                </p>
              )}
              {releases.map((release, index) => (
                <div
                  key={release.version}
                  className="relative pl-8 pb-8 border-l-2 border-[var(--hairline)] last:border-l-0 last:pb-0"
                >
                  {/* Version dot */}
                  <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full ${
                    index === 0 ? 'bg-[var(--brand)]' : 'bg-[var(--surface-2)]'
                  }`} />

                  {/* Version header */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <a
                      href={release.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`font-display text-2xl font-bold hover:underline ${index === 0 ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}
                    >
                      v{release.version}
                    </a>
                    <span className={`px-2 py-0.5 text-xs rounded border ${
                      release.type === 'major'
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        : release.type === 'minor'
                        ? 'bg-[rgba(23,150,255,0.1)] text-[var(--brand-soft)] border-[rgba(23,150,255,0.25)]'
                        : release.type === 'milestone'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-[var(--surface-2)] text-[var(--ink-soft)] border-[var(--hairline)]'
                    }`}>
                      {release.type}
                    </span>
                    <span className="text-[var(--ink-faint)] text-sm">
                      {new Date(release.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    {index === 0 && (
                      <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        Latest
                      </span>
                    )}
                  </div>

                  {/* Release body (markdown) */}
                  {release.body && (
                    <div className="prose prose-invert prose-sm max-w-none">
                      {parseMarkdownBody(release.body).map((line, lineIndex) => {
                        // Handle h2 headers
                        if (line.startsWith('## ') && !line.startsWith('### ')) {
                          return (
                            <h4 key={lineIndex} className="font-display text-[var(--ink)] font-medium mt-4 mb-2">
                              {renderInlineMarkdown(line.replace('## ', ''))}
                            </h4>
                          );
                        }
                        // Handle h3 headers
                        if (line.startsWith('### ')) {
                          return (
                            <h5 key={lineIndex} className="font-display text-[var(--ink)] font-medium mt-3 mb-1.5 text-sm">
                              {renderInlineMarkdown(line.replace('### ', ''))}
                            </h5>
                          );
                        }
                        // Handle list items
                        if (line.startsWith('- ') || line.startsWith('* ')) {
                          const text = line.replace(/^[-*]\s*/, '');
                          return (
                            <div key={lineIndex} className="flex items-baseline gap-3 text-[var(--ink-soft)] ml-4">
                              <span className="text-[var(--brand-soft)] text-sm shrink-0">▸</span>
                              <span className="text-sm">{renderInlineMarkdown(text)}</span>
                            </div>
                          );
                        }
                        // Regular text
                        return (
                          <p key={lineIndex} className="text-[var(--ink-soft)] mb-2">
                            {renderInlineMarkdown(line)}
                          </p>
                        );
                      })}
                    </div>
                  )}

                  {/* No body message */}
                  {!release.body && (
                    <p className="text-[var(--ink-faint)] italic">
                      No release notes available.{' '}
                      <a
                        href={release.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--brand-soft)] hover:text-[var(--brand)] transition-colors duration-200"
                      >
                        View on GitHub
                      </a>
                    </p>
                  )}
                </div>
              ))}
            </Reveal>
          )}

          {/* Roadmap CTA */}
          <Reveal trigger="inView" className="mt-12 text-center">
            <div className="rounded-2xl border border-[rgba(23,150,255,0.25)] bg-[rgba(23,150,255,0.1)] p-8">
              <h2 className="font-display text-xl font-semibold text-[var(--ink)] mb-2">Want to see what's coming next?</h2>
              <p className="text-[var(--ink-soft)] mb-6">
                Check out our public roadmap and suggest features on GitHub
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a
                  href="https://github.com/Waarangel/3dcoster/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline)] text-[var(--ink)] text-sm font-medium transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(23,150,255,0.4)] active:translate-y-0 active:scale-[0.98]"
                >
                  All Releases on GitHub
                </a>
                <a
                  href="https://github.com/Waarangel/3dcoster/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline)] text-[var(--ink)] text-sm font-medium transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(23,150,255,0.4)] active:translate-y-0 active:scale-[0.98]"
                >
                  Feature Requests
                </a>
                <Link
                  to="/feedback"
                  className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white text-sm font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:translate-y-0 active:scale-[0.98]"
                >
                  Send Feedback
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </main>

      <Footer />
    </div>
  );
}
