import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Reveal } from '../components/motion/Reveal';
// Source of truth: CHANGELOG.md at repo root, loaded as a string at build time
// via Vite's `?raw` query. The release workflow extracts from the same file
// (scripts/extract-changelog.cjs) so the GitHub release body and this page
// never drift.
import changelogRaw from '../../CHANGELOG.md?raw';

/**
 * How many releases to display. Industry best practice (Linear, Vercel, Stripe)
 * is 5 — most-recent matters most; older releases are one click away on GitHub.
 */
const MAX_RELEASES_DISPLAYED = 5;

const GITHUB_REPO = 'Waarangel/3dcoster';
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
const ISSUES_URL = `https://github.com/${GITHUB_REPO}/issues`;

interface ParsedRelease {
  version: string;
  date: string;
  body: string;
  url: string;
  type: 'major' | 'minor' | 'patch' | 'milestone';
}

function getVersionType(version: string): 'major' | 'minor' | 'patch' | 'milestone' {
  const parts = version.split('.');
  if (parts.length < 3) return 'milestone';
  if (parts[0] !== '0' && parts[1] === '0' && parts[2] === '0') return 'major';
  if (parts[2] === '0') return 'minor';
  return 'patch';
}

/** Parse CHANGELOG.md (Keep a Changelog format) into structured releases. */
function parseChangelog(raw: string): ParsedRelease[] {
  const lines = raw.split('\n');
  const sectionHeader = /^## \[(\d+\.\d+\.\d+)\]\s*-\s*(\d{4}-\d{2}-\d{2})/;

  const releases: ParsedRelease[] = [];
  let current: { version: string; date: string; bodyLines: string[] } | null = null;

  const closeCurrent = () => {
    if (!current) return;
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
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Parse inline markdown: **bold**, `code`, [link](url)
function renderInlineMarkdown(text: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={match.index} className="text-[var(--ink)] font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<code key={match.index} className="bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-[var(--brand-soft)] text-xs">{match[4]}</code>);
    } else if (match[5]) {
      const url = match[7];
      const isSafe = url.startsWith('http://') || url.startsWith('https://');
      parts.push(
        isSafe ? (
          <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-soft)] hover:text-[var(--brand)] underline transition-colors duration-200">{match[6]}</a>
        ) : (
          <span key={match.index}>{match[6]}</span>
        )
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

// Small semantic chips for Keep-a-Changelog categories (allowed exception to
// the one-accent system — they're meaning-bearing micro-tags).
const CHANGE_TYPE_CLASS: Record<string, string> = {
  added: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  changed: 'bg-[rgba(23,150,255,0.1)] text-[var(--brand-soft)] border-[rgba(23,150,255,0.3)]',
  fixed: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  security: 'bg-red-500/10 text-red-300 border-red-500/30',
  removed: 'bg-[var(--surface-2)] text-[var(--ink-soft)] border-[var(--hairline-strong)]',
  deprecated: 'bg-[var(--surface-2)] text-[var(--ink-soft)] border-[var(--hairline-strong)]',
};

const TYPE_TAG_CLASS: Record<ParsedRelease['type'], string> = {
  major: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  minor: 'bg-[rgba(23,150,255,0.1)] text-[var(--brand-soft)] border-[rgba(23,150,255,0.3)]',
  milestone: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  patch: 'bg-[var(--surface-2)] text-[var(--ink-soft)] border-[var(--hairline-strong)]',
};

const LONG_DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
const SHORT_DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

function renderBody(body: string): React.ReactNode {
  return parseMarkdownBody(body).map((line, i) => {
    // `## Category` → semantic chip (Added/Fixed/…) or a plain heading otherwise.
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      const label = line.replace('## ', '').trim();
      const cls = CHANGE_TYPE_CLASS[label.toLowerCase()];
      if (cls) {
        return (
          <div key={i} className="mt-4 mb-2 first:mt-0">
            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border ${cls}`}>{label}</span>
          </div>
        );
      }
      return (
        <h4 key={i} className="font-display text-[var(--ink)] font-medium mt-4 mb-2">{renderInlineMarkdown(label)}</h4>
      );
    }
    if (line.startsWith('### ')) {
      return (
        <h5 key={i} className="font-display text-[var(--ink)] font-medium mt-3 mb-1.5 text-sm">{renderInlineMarkdown(line.replace('### ', ''))}</h5>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} className="flex items-baseline gap-2.5 text-[var(--ink-soft)]">
          <span className="text-[var(--brand-soft)] text-sm shrink-0">▸</span>
          <span className="text-sm leading-relaxed">{renderInlineMarkdown(line.replace(/^[-*]\s*/, ''))}</span>
        </div>
      );
    }
    return <p key={i} className="text-sm text-[var(--ink-soft)] leading-relaxed mb-2">{renderInlineMarkdown(line)}</p>;
  });
}

export function ChangelogPage() {
  const releases = useMemo(() => parseChangelog(changelogRaw).slice(0, MAX_RELEASES_DISPLAYED), []);
  const hasReleases = releases.length > 0;
  const latest = releases[0];
  const rest = releases.slice(1);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col">
      <Header />

      <main className="flex-1 px-6">
        <section className="relative overflow-hidden pt-32 pb-10">
          <div className="hero-aura pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
          <Reveal trigger="mount" className="max-w-4xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl font-extrabold text-[var(--ink)]">What&apos;s new</h1>
            <p className="mt-4 text-[var(--ink-soft)] text-lg">The features and fixes we&apos;ve shipped to 3DCoster.</p>
            {hasReleases && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-[var(--ink-faint)]">
                <span>
                  <strong className="text-[var(--ink)]">{releases.length}</strong> recent releases
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  latest <strong className="text-[var(--brand-soft)]">v{latest.version}</strong> on{' '}
                  {new Date(latest.date).toLocaleDateString('en-US', LONG_DATE)}
                </span>
              </div>
            )}
          </Reveal>
        </section>

        <div className="max-w-4xl mx-auto pb-16">
          {!hasReleases ? (
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-8 text-center">
              <p className="text-[var(--ink-soft)] mb-4">No releases found yet.</p>
              <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-soft)] hover:text-[var(--brand)] underline transition-colors">
                Check GitHub for releases
              </a>
            </div>
          ) : (
            <>
              {/* Featured: the latest release */}
              <Reveal trigger="inView">
                <article className="relative overflow-hidden rounded-2xl border border-[rgba(23,150,255,0.3)] bg-[var(--surface)] p-7 sm:p-8">
                  <div
                    className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 rounded-full opacity-70"
                    style={{ background: 'radial-gradient(circle, rgba(23,150,255,0.16), transparent 70%)' }}
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-[var(--brand)] px-2.5 py-0.5 text-xs font-medium text-white">Latest</span>
                    <a href={latest.url} target="_blank" rel="noopener noreferrer" className="font-display text-3xl font-extrabold text-[var(--ink)] hover:underline">
                      v{latest.version}
                    </a>
                    <span className={`rounded border px-2 py-0.5 text-xs ${TYPE_TAG_CLASS[latest.type]}`}>{latest.type}</span>
                    <span className="text-[var(--ink-faint)] text-sm">
                      {new Date(latest.date).toLocaleDateString('en-US', LONG_DATE)}
                    </span>
                  </div>
                  <div className="mt-5">
                    {latest.body ? (
                      renderBody(latest.body)
                    ) : (
                      <p className="text-[var(--ink-faint)] italic text-sm">
                        No release notes.{' '}
                        <a href={latest.url} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-soft)] hover:text-[var(--brand)] transition-colors">View on GitHub</a>
                      </p>
                    )}
                  </div>
                </article>
              </Reveal>

              {/* The rest: a version-anchored timeline */}
              {rest.length > 0 && (
                <Reveal trigger="inView" className="mt-10 space-y-1">
                  {rest.map((release) => (
                    <div key={release.version} className="grid grid-cols-[5rem_1fr] sm:grid-cols-[6.5rem_1fr] gap-x-4">
                      <div className="text-right pt-0.5">
                        <a href={release.url} target="_blank" rel="noopener noreferrer" className="block font-display font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] hover:underline">
                          v{release.version}
                        </a>
                        <div className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
                          {new Date(release.date).toLocaleDateString('en-US', SHORT_DATE)}
                        </div>
                      </div>
                      <div className="relative border-l border-[var(--hairline)] pl-5 pb-8">
                        <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--surface-2)] border border-[var(--hairline-strong)]" />
                        {release.body ? (
                          renderBody(release.body)
                        ) : (
                          <p className="text-[var(--ink-faint)] italic text-sm">
                            No release notes.{' '}
                            <a href={release.url} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-soft)] hover:text-[var(--brand)] transition-colors">View on GitHub</a>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </Reveal>
              )}

              {releases.length >= MAX_RELEASES_DISPLAYED && (
                <p className="mt-6 text-center text-sm text-[var(--ink-faint)]">
                  Showing the {MAX_RELEASES_DISPLAYED} most recent. For everything else, see the{' '}
                  <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-soft)] hover:text-[var(--brand)] underline transition-colors">full archive on GitHub</a>.
                </p>
              )}
            </>
          )}

          {/* CTA */}
          <Reveal trigger="inView" className="mt-14">
            <div className="rounded-2xl border border-[rgba(23,150,255,0.25)] bg-[rgba(23,150,255,0.08)] p-8 text-center">
              <h2 className="font-display text-xl font-bold text-[var(--ink)]">Want to see what&apos;s coming next?</h2>
              <p className="mt-2 text-[var(--ink-soft)] mb-6">Follow the public roadmap, or suggest a feature.</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link to="/roadmap" className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline-strong)] text-[var(--ink)] text-sm font-medium transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(23,150,255,0.4)] active:translate-y-0 active:scale-[0.98]">
                  View the roadmap
                </Link>
                <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline-strong)] text-[var(--ink)] text-sm font-medium transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(23,150,255,0.4)] active:translate-y-0 active:scale-[0.98]">
                  Feature requests
                </a>
                <Link to="/feedback" className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white text-sm font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] active:translate-y-0 active:scale-[0.98]">
                  Send feedback
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
