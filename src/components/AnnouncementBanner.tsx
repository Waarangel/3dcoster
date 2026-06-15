import { useCallback } from 'react';
import { Button } from './ui';
import { useAnnouncement } from '../hooks/useAnnouncement';
import type { Announcement } from '../utils/announcement';

// Open the CTA target in the system browser on desktop (shell plugin), or a new
// tab on web. Mirrors UpdateBanner's handleDownload. url is pre-validated by
// parseAnnouncement (isSafeHttpUrl), so it is safe to open here.
function openCtaUrl(url: string): void {
  if (__IS_TAURI__) {
    import('@tauri-apps/plugin-shell')
      .then(({ open }) => open(url))
      .catch(() => window.open(url, '_blank', 'noopener,noreferrer'));
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

interface AnnouncementBannerViewProps {
  announcement: Announcement;
  onDismiss: () => void;
}

/** Presentational bar. Pure — easy to test without the network. */
export function AnnouncementBannerView({ announcement, onDismiss }: AnnouncementBannerViewProps) {
  const handleCta = useCallback(() => openCtaUrl(announcement.url), [announcement.url]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-blue-600 text-white px-4 py-2 flex items-center justify-center gap-4 text-sm"
    >
      <span>{announcement.message}</span>
      <Button
        variant="ghost"
        btnSize="sm"
        onClick={handleCta}
        className="bg-white text-blue-600 hover:bg-blue-50 font-medium whitespace-nowrap"
      >
        {announcement.ctaLabel}
      </Button>
      <Button
        variant="ghost"
        btnSize="sm"
        onClick={onDismiss}
        className="text-white/80 hover:text-white"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Button>
    </div>
  );
}

/** Container — owns the fetch/dismissal via the hook. */
export function AnnouncementBanner() {
  const { announcement, dismiss } = useAnnouncement();
  if (!announcement) return null;
  return <AnnouncementBannerView announcement={announcement} onDismiss={dismiss} />;
}
