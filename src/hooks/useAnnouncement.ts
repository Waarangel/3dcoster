import { useCallback, useEffect, useState } from 'react';
import {
  ANNOUNCEMENT_URL,
  parseAnnouncement,
  isAnnouncementDismissed,
  markAnnouncementDismissed,
  type Announcement,
} from '../utils/announcement';

interface UseAnnouncementResult {
  announcement: Announcement | null;
  dismiss: () => void;
}

/**
 * Fetches the remote survey announcement once on mount, validates it, and
 * surfaces it only when it is active and not already dismissed for its id.
 * Any failure (network, bad payload, rate limit) resolves to no banner.
 */
export function useAnnouncement(): UseAnnouncementResult {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(ANNOUNCEMENT_URL);
        // Any non-200 (404, CDN hiccup, etc.) → no banner, silently.
        if (!res.ok) return;

        const parsed = parseAnnouncement(await res.json());
        if (cancelled || !parsed) return;
        if (!parsed.active || isAnnouncementDismissed(parsed.id)) return;

        setAnnouncement(parsed);
      } catch {
        // Silent — no banner if the announcement can't be fetched/parsed.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setAnnouncement((prev) => {
      if (prev) markAnnouncementDismissed(prev.id);
      return null;
    });
  }, []);

  return { announcement, dismiss };
}
