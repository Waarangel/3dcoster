import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Reveal } from '../components/motion/Reveal';
import { isSafeHttpUrl } from '../utils/urlSecurity';

type Platform = 'windows' | 'mac' | 'linux' | 'unknown';
type OS = 'windows' | 'mac' | 'linux';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface ReleaseInfo {
  version: string;
  windowsUrl: string | null;
  macSiliconUrl: string | null;
  macIntelUrl: string | null;
  linuxAppImageUrl: string | null;
  linuxDebUrl: string | null;
  linuxRpmUrl: string | null;
}

const ICONS: Record<OS, ReactNode> = {
  windows: <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />,
  mac: <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />,
  linux: <path d="M14.62 8.35c-.42.28-1.75.84-1.75 1.68 0 .19.05.4.16.62-.18-.05-.37-.08-.56-.08-.96 0-1.74.78-1.74 1.74 0 .39.13.75.35 1.04-.5.2-.92.56-1.21 1.02-.27-.45-.7-.79-1.21-.96.21-.29.34-.65.34-1.03 0-.96-.78-1.74-1.74-1.74-.19 0-.38.03-.56.08.11-.22.16-.43.16-.62 0-.84-1.33-1.4-1.75-1.68-.5-1.04-.3-2.86-.3-4.13C3.41 1.46 5.5.02 7.99 0c2.45.02 4.36 1.4 4.36 4.22 0 1.27.2 3.09-.3 4.13M12 13.5c-2 0-3 1.5-3 3.5 0 1.5.5 3 1.5 4 .3.3.7.5 1.5.5s1.2-.2 1.5-.5c1-1 1.5-2.5 1.5-4 0-2-1-3.5-3-3.5z" />,
};

interface DownloadCard {
  os: OS;
  name: string;
  req: string;
  primary: { label: string; url: string };
  extras: { label: string; url: string }[];
  meta: string;
}

interface WhyItem {
  title: string;
  description: string;
  icon: ReactNode;
}

const WHY_DESKTOP: WhyItem[] = [
  {
    title: 'Works offline',
    description: 'No internet? No problem. Perfect for workshops and print farms with no signal.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />,
  },
  {
    title: 'Your data stays local',
    description: 'Everything lives on your computer — no browser cache to accidentally clear.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
  },
  {
    title: 'Fast & native',
    description: 'Launches instantly from your desktop. No browser tabs to lose it among.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M13 10V3L4 14h7v7l9-11h-7z" />,
  },
];

function detectPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('win')) return 'windows';
  if (userAgent.includes('mac')) return 'mac';
  // Android UAs also contain "linux"; exclude them so mobile users aren't
  // pointed at a desktop binary.
  if (userAgent.includes('linux') && !userAgent.includes('android')) return 'linux';
  return 'unknown';
}

export function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPlatform(detectPlatform());

    async function fetchLatestRelease() {
      try {
        const response = await fetch('https://api.github.com/repos/Waarangel/3dcoster/releases/latest');
        if (!response.ok) {
          setLoading(false);
          return;
        }

        const data = await response.json();
        const assets: ReleaseAsset[] = data.assets || [];
        const version = data.tag_name?.replace('v', '') || '1.0.0';

        // Match by extension. Linux assets vary in arch suffix (AppImage/.deb use
        // `_amd64`, .rpm uses `x86_64`), so extension matching sidesteps that.
        const windowsAsset = assets.find((a) => a.name.endsWith('.exe') || a.name.endsWith('-setup.exe'));
        const macSiliconAsset = assets.find((a) => a.name.includes('aarch64') && a.name.endsWith('.dmg'));
        const macIntelAsset = assets.find((a) => a.name.includes('x64') && a.name.endsWith('.dmg'));
        const linuxAppImageAsset = assets.find((a) => a.name.endsWith('.AppImage'));
        const linuxDebAsset = assets.find((a) => a.name.endsWith('.deb'));
        const linuxRpmAsset = assets.find((a) => a.name.endsWith('.rpm'));

        const windowsUrl = windowsAsset?.browser_download_url;
        const macSiliconUrl = macSiliconAsset?.browser_download_url;
        const macIntelUrl = macIntelAsset?.browser_download_url;
        const linuxAppImageUrl = linuxAppImageAsset?.browser_download_url;
        const linuxDebUrl = linuxDebAsset?.browser_download_url;
        const linuxRpmUrl = linuxRpmAsset?.browser_download_url;
        setRelease({
          version,
          windowsUrl: isSafeHttpUrl(windowsUrl) ? windowsUrl! : null,
          macSiliconUrl: isSafeHttpUrl(macSiliconUrl) ? macSiliconUrl! : null,
          macIntelUrl: isSafeHttpUrl(macIntelUrl) ? macIntelUrl! : null,
          linuxAppImageUrl: isSafeHttpUrl(linuxAppImageUrl) ? linuxAppImageUrl! : null,
          linuxDebUrl: isSafeHttpUrl(linuxDebUrl) ? linuxDebUrl! : null,
          linuxRpmUrl: isSafeHttpUrl(linuxRpmUrl) ? linuxRpmUrl! : null,
        });
      } catch {
        // Silently fail - fallback links will be used
      } finally {
        setLoading(false);
      }
    }

    fetchLatestRelease();
  }, []);

  // Fallback URLs if API fails (update these when releasing). Linux arch
  // suffixes differ: AppImage/.deb use `_amd64`, .rpm uses `-1.x86_64`.
  const fallbackVersion = '1.0.0';
  const fb = `https://github.com/Waarangel/3dcoster/releases/download/v${fallbackVersion}`;
  const fallbackUrls = {
    windows: `${fb}/3DCoster_${fallbackVersion}_x64-setup.exe`,
    macSilicon: `${fb}/3DCoster_${fallbackVersion}_aarch64.dmg`,
    macIntel: `${fb}/3DCoster_${fallbackVersion}_x64.dmg`,
    linuxAppImage: `${fb}/3DCoster_${fallbackVersion}_amd64.AppImage`,
    linuxDeb: `${fb}/3DCoster_${fallbackVersion}_amd64.deb`,
    linuxRpm: `${fb}/3DCoster-${fallbackVersion}-1.x86_64.rpm`,
  };

  const downloadUrls = {
    windows: release?.windowsUrl || fallbackUrls.windows,
    macSilicon: release?.macSiliconUrl || fallbackUrls.macSilicon,
    macIntel: release?.macIntelUrl || fallbackUrls.macIntel,
    linuxAppImage: release?.linuxAppImageUrl || fallbackUrls.linuxAppImage,
    linuxDeb: release?.linuxDebUrl || fallbackUrls.linuxDeb,
    linuxRpm: release?.linuxRpmUrl || fallbackUrls.linuxRpm,
  };

  const displayVersion = release?.version || fallbackVersion;
  const versionSuffix = !loading && release ? ` · v${displayVersion}` : '';

  const CARDS: DownloadCard[] = [
    { os: 'windows', name: 'Windows', req: 'Windows 10 or later', primary: { label: 'Download (.exe)', url: downloadUrls.windows }, extras: [], meta: '.exe installer' },
    { os: 'mac', name: 'macOS', req: 'macOS 10.15 or later', primary: { label: 'Apple Silicon', url: downloadUrls.macSilicon }, extras: [{ label: 'Intel Mac', url: downloadUrls.macIntel }], meta: 'Apple Silicon · Intel' },
    { os: 'linux', name: 'Linux', req: 'x86_64', primary: { label: 'AppImage', url: downloadUrls.linuxAppImage }, extras: [{ label: '.deb', url: downloadUrls.linuxDeb }, { label: '.rpm', url: downloadUrls.linuxRpm }], meta: 'AppImage · deb · rpm' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-12 px-6">
        <div className="hero-aura pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <Reveal trigger="mount">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl font-extrabold text-[var(--ink)]">Download 3DCoster</h1>
            <p className="mt-4 text-lg text-[var(--ink-soft)]">
              The desktop app runs in your workshop — offline, fast, and your data never leaves your machine.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {['Works offline', 'Data stays on your device', 'Free · no account'].map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-full border border-[rgba(23,150,255,0.2)] bg-[rgba(23,150,255,0.08)] px-3 py-1 text-xs text-[var(--brand-soft)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Download — three platforms, compact and horizontal */}
      <section className="px-6">
        <Reveal trigger="inView" className="max-w-4xl mx-auto">
          <div className="grid gap-4 sm:grid-cols-3 pt-3">
            {CARDS.map((c) => {
              const recommended = c.os === platform;
              return (
                <div
                  key={c.os}
                  className={`relative flex flex-col rounded-2xl bg-[var(--surface)] border p-6 transition duration-200 ease-out ${
                    recommended ? 'border-[rgba(23,150,255,0.45)]' : 'border-[var(--hairline)] hover:border-[rgba(23,150,255,0.4)]'
                  }`}
                  style={recommended ? { boxShadow: '0 0 70px -38px var(--brand-glow)' } : undefined}
                >
                  {recommended && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand)] px-2.5 py-0.5 text-[11px] font-medium text-white">
                      Recommended
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--brand-soft)]">
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">{ICONS[c.os]}</svg>
                    </span>
                    <div>
                      <h2 className="font-display text-base font-bold text-[var(--ink)]">{c.name}</h2>
                      <p className="text-[var(--ink-faint)] text-xs">{c.req}</p>
                    </div>
                  </div>

                  <a
                    href={c.primary.url}
                    className="mt-4 flex w-full items-center justify-center rounded-lg bg-[var(--brand)] py-2.5 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-[var(--brand-soft)] active:scale-[0.98]"
                  >
                    {c.primary.label}
                  </a>

                  {c.extras.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
                      {c.extras.map((e) => (
                        <a
                          key={e.label}
                          href={e.url}
                          className="text-[var(--ink-faint)] underline underline-offset-2 transition-colors hover:text-[var(--brand-soft)]"
                        >
                          {e.label}
                        </a>
                      ))}
                    </div>
                  )}

                  <p className="mt-auto pt-3 text-center text-[11px] text-[var(--ink-faint)]">{c.meta}{versionSuffix}</p>
                </div>
              );
            })}
          </div>

          {/* Platform notes + browser alternative */}
          <p className="mt-5 text-center text-xs text-[var(--amber)]">
            <strong>macOS:</strong> if it shows a &quot;damaged&quot; warning, right-click the app and choose &quot;Open&quot;.{' '}
            <Link to="/faq" className="underline hover:brightness-110">Learn more</Link>
          </p>
          <p className="mt-2 text-center text-xs text-[var(--ink-faint)]">
            Linux: the AppImage runs on any distro; .deb for Debian/Ubuntu, .rpm for Fedora/RHEL.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
            <span className="text-[var(--ink-faint)]">Prefer not to install?</span>
            <Link to="/app" className="inline-flex items-center gap-1 font-medium text-[var(--brand-soft)] hover:text-[var(--ink)] transition-colors">
              Use it in your browser
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Why desktop — editorial ruled list */}
      <section className="py-20 px-6">
        <Reveal trigger="inView" className="max-w-5xl mx-auto">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] text-center mb-8">
            Why use the desktop app?
          </h2>
          <div className="grid sm:grid-cols-3 sm:gap-x-10">
            {WHY_DESKTOP.map((item) => (
              <div key={item.title} className="group flex items-start gap-4 py-5 border-t border-[var(--hairline)]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(23,150,255,0.1)] text-[var(--brand-soft)] transition-transform duration-200 ease-out group-hover:scale-105">
                  <span className="block w-5 h-5">
                    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                  </span>
                </span>
                <div>
                  <h3 className="font-display font-semibold text-[var(--ink)]">{item.title}</h3>
                  <p className="mt-1 text-sm text-[var(--ink-soft)] leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
