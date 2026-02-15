import { useEffect, useState } from 'react';
import { featureReleases, NEW_FEATURE_DAYS } from '../features';

const STORAGE_KEY = '3dcoster-feature-first-seen';

// Get the map of when features were first seen
function getFirstSeenMap(): Record<string, number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save when a feature was first seen
function markFeatureSeen(feature: string): void {
  try {
    const map = getFirstSeenMap();
    if (!map[feature]) {
      map[feature] = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // localStorage may be full or unavailable
  }
}

interface NewBadgeProps {
  feature: string;
  className?: string;
}

export function NewBadge({ feature, className = '' }: NewBadgeProps) {
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    const releaseDate = featureReleases[feature];
    if (!releaseDate) return;

    // Don't show badge for features released in the future
    if (releaseDate.getTime() > Date.now()) return;

    const firstSeenMap = getFirstSeenMap();
    const firstSeen = firstSeenMap[feature];

    if (!firstSeen) {
      // First time seeing this feature - mark it and show badge
      markFeatureSeen(feature);
      setIsNew(true);
    } else {
      // Check if within NEW_FEATURE_DAYS of first seeing it
      const daysSinceFirstSeen = (Date.now() - firstSeen) / (1000 * 60 * 60 * 24);
      setIsNew(daysSinceFirstSeen < NEW_FEATURE_DAYS);
    }
  }, [feature]);

  if (!isNew) return null;

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium bg-green-500 text-white rounded uppercase tracking-wide ${className}`}>
      New
    </span>
  );
}
