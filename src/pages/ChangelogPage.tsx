import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
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
      parts.push(<strong key={match.index} className="text-white font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      // `code`
      parts.push(<code key={match.index} className="bg-slate-700 px-1.5 py-0.5 rounded text-blue-300 text-xs">{match[4]}</code>);
    } else if (match[5]) {
      // [text](url) — only emit an anchor when the url is http/https to prevent
      // javascript:, data:, or other unsafe scheme injection from CHANGELOG.md.
      const url = match[7];
      const isSafe = url.startsWith('http://') || url.startsWith('https://');
      parts.push(isSafe
        ? <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">{match[6]}</a>
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <Header />

      {/* Main Content */}
      <main className="flex-1 pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">What's New</h1>
            <p className="text-slate-400 text-lg">
              See what features and fixes have been added to 3DCoster
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="text-slate-400">Loading releases from GitHub...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <a
                href="https://github.com/Waarangel/3dcoster/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                View releases on GitHub
              </a>
            </div>
          )}

          {/* No Releases */}
          {!loading && !error && releases.length === 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
              <p className="text-slate-400 mb-4">No releases found yet.</p>
              <a
                href="https://github.com/Waarangel/3dcoster/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Check GitHub for releases
              </a>
            </div>
          )}

          {/* Releases List */}
          {!loading && !error && releases.length > 0 && (
            <div className="space-y-8">
              {releases.length >= MAX_RELEASES_DISPLAYED && (
                <p className="text-slate-500 text-sm text-center -mt-4">
                  Showing the {MAX_RELEASES_DISPLAYED} most recent releases. For older versions, see the{' '}
                  <a
                    href="https://github.com/Waarangel/3dcoster/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    full archive on GitHub
                  </a>
                  .
                </p>
              )}
              {releases.map((release, index) => (
                <div
                  key={release.version}
                  className="relative pl-8 pb-8 border-l-2 border-slate-700 last:border-l-0 last:pb-0"
                >
                  {/* Version dot */}
                  <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full ${
                    index === 0 ? 'bg-blue-500' : 'bg-slate-600'
                  }`} />

                  {/* Version header */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <a
                      href={release.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-2xl font-bold hover:underline ${index === 0 ? 'text-white' : 'text-slate-300'}`}
                    >
                      v{release.version}
                    </a>
                    <span className={`px-2 py-0.5 text-xs rounded border ${
                      release.type === 'major'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : release.type === 'minor'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        : release.type === 'milestone'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                    }`}>
                      {release.type}
                    </span>
                    <span className="text-slate-500 text-sm">
                      {new Date(release.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    {index === 0 && (
                      <span className="px-2 py-0.5 text-xs rounded bg-green-500/10 text-green-400 border border-green-500/30">
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
                            <h4 key={lineIndex} className="text-white font-medium mt-4 mb-2">
                              {renderInlineMarkdown(line.replace('## ', ''))}
                            </h4>
                          );
                        }
                        // Handle h3 headers
                        if (line.startsWith('### ')) {
                          return (
                            <h5 key={lineIndex} className="text-slate-200 font-medium mt-3 mb-1.5 text-sm">
                              {renderInlineMarkdown(line.replace('### ', ''))}
                            </h5>
                          );
                        }
                        // Handle list items
                        if (line.startsWith('- ') || line.startsWith('* ')) {
                          const text = line.replace(/^[-*]\s*/, '');
                          return (
                            <div key={lineIndex} className="flex items-baseline gap-3 text-slate-300 ml-4">
                              <span className="text-blue-400 text-sm shrink-0">▸</span>
                              <span className="text-sm">{renderInlineMarkdown(text)}</span>
                            </div>
                          );
                        }
                        // Regular text
                        return (
                          <p key={lineIndex} className="text-slate-400 mb-2">
                            {renderInlineMarkdown(line)}
                          </p>
                        );
                      })}
                    </div>
                  )}

                  {/* No body message */}
                  {!release.body && (
                    <p className="text-slate-500 italic">
                      No release notes available.{' '}
                      <a
                        href={release.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        View on GitHub
                      </a>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Roadmap CTA */}
          <div className="mt-12 text-center">
            <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-xl p-8">
              <h2 className="text-xl font-semibold text-white mb-2">Want to see what's coming next?</h2>
              <p className="text-slate-400 mb-6">
                Check out our public roadmap and suggest features on GitHub
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a
                  href="https://github.com/Waarangel/3dcoster/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  All Releases on GitHub
                </a>
                <a
                  href="https://github.com/Waarangel/3dcoster/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Feature Requests
                </a>
                <Link
                  to="/feedback"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Send Feedback
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
