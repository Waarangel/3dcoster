import { useState, useEffect } from 'react';

// Current app version - update this when releasing new versions
export const APP_VERSION = '1.2.1';

interface UpdateInfo {
  version: string;
  url: string;
}

function compareVersions(current: string, latest: string): boolean {
  const currentParts = current.replace('v', '').split('.').map(Number);
  const latestParts = latest.replace('v', '').split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (latestParts[i] > currentParts[i]) return true;
    if (latestParts[i] < currentParts[i]) return false;
  }
  return false;
}

export function UpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only check for updates in Tauri (desktop) environment
    if (!__IS_TAURI__) return;

    // Check if user has dismissed this version's update
    const dismissedVersion = localStorage.getItem('dismissedUpdateVersion');

    async function checkForUpdates() {
      try {
        const response = await fetch(
          'https://api.github.com/repos/Waarangel/3dcoster/releases/latest'
        );

        if (!response.ok) return;

        const data = await response.json();
        const latestVersion = data.tag_name;

        // Check if update is available and not already dismissed
        if (compareVersions(APP_VERSION, latestVersion) && dismissedVersion !== latestVersion) {
          setUpdateInfo({
            version: latestVersion,
            url: data.html_url,
          });
        }
      } catch (error) {
        // Silently fail - don't bother user if check fails
        console.error('Failed to check for updates:', error);
      }
    }

    checkForUpdates();
  }, []);

  const handleDismiss = () => {
    if (updateInfo) {
      localStorage.setItem('dismissedUpdateVersion', updateInfo.version);
    }
    setDismissed(true);
  };

  if (!updateInfo || dismissed) return null;

  return (
    <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-center gap-4 text-sm">
      <span>
        A new version ({updateInfo.version}) is available!
      </span>
      <a
        href="https://3dcoster.vercel.app/download"
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1 bg-white text-blue-600 rounded font-medium hover:bg-blue-50 transition-colors"
      >
        Download
      </a>
      <button
        onClick={handleDismiss}
        className="text-white/80 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
