import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
}

interface ParsedRelease {
  version: string;
  name: string;
  date: string;
  body: string;
  url: string;
  type: 'major' | 'minor' | 'patch';
}

function getVersionType(version: string): 'major' | 'minor' | 'patch' {
  const parts = version.replace('v', '').split('.');
  if (parts[0] !== '0' && parts[1] === '0' && parts[2] === '0') return 'major';
  if (parts[2] === '0') return 'minor';
  return 'patch';
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
function renderInlineMarkdown(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
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
      // [text](url)
      parts.push(<a key={match.index} href={match[7]} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">{match[6]}</a>);
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
  const [releases, setReleases] = useState<ParsedRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReleases() {
      try {
        const response = await fetch(
          'https://api.github.com/repos/Waarangel/3dcoster/releases?per_page=20'
        );

        if (!response.ok) {
          throw new Error('Failed to fetch releases');
        }

        const data: GitHubRelease[] = await response.json();

        const parsed: ParsedRelease[] = data
          .filter(r => !r.draft)
          .map(r => ({
            version: r.tag_name,
            name: r.name || r.tag_name,
            date: r.published_at,
            body: r.body || '',
            url: r.html_url,
            type: getVersionType(r.tag_name),
          }));

        setReleases(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load releases');
      } finally {
        setLoading(false);
      }
    }

    fetchReleases();
  }, []);

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
                      {release.version}
                    </a>
                    <span className={`px-2 py-0.5 text-xs rounded border ${
                      release.type === 'major'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : release.type === 'minor'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
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

                  {/* Release name if different from tag */}
                  {release.name !== release.version && (
                    <h3 className="text-lg font-medium text-white mb-3">{release.name}</h3>
                  )}

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
                            <div key={lineIndex} className="flex items-start gap-2 text-slate-300 ml-2">
                              <span className="text-slate-500 mt-1.5">•</span>
                              <span>{renderInlineMarkdown(text)}</span>
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
