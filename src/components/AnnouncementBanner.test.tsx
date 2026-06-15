import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { AnnouncementBanner, AnnouncementBannerView } from './AnnouncementBanner';
import type { Announcement } from '../utils/announcement';

// ---------------------------------------------------------------------------
// AnnouncementBanner — survey notice driven by a remote announcement.json.
// View tests are pure (no network). Container tests mock fetch to pin the
// active / dismissed / invalid gating that decides whether the bar shows.
// Raw createRoot + act per project precedent (RecordSaleModal.test.tsx).
// ---------------------------------------------------------------------------

const active: Announcement = {
  id: 'survey-1',
  active: true,
  message: 'Got 2 minutes for a survey?',
  ctaLabel: 'Share your thoughts',
  url: 'https://forms.example.com/abc',
};

let container: HTMLDivElement;
let root: Root;

function mockFetchOnce(payload: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: async () => payload,
  }));
}

// Flush the fetch → json → setState promise chain inside act().
async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('AnnouncementBannerView (presentational)', () => {
  it('renders the message and CTA label', () => {
    act(() => root.render(<AnnouncementBannerView announcement={active} onDismiss={() => {}} />));
    expect(container.textContent).toContain('Got 2 minutes for a survey?');
    expect(container.textContent).toContain('Share your thoughts');
  });

  it('calls onDismiss when the dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    act(() => root.render(<AnnouncementBannerView announcement={active} onDismiss={onDismiss} />));
    const dismissBtn = container.querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement;
    act(() => dismissBtn.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('AnnouncementBanner (container + gating)', () => {
  it('shows the banner when the remote announcement is active and valid', async () => {
    mockFetchOnce(active);
    await act(async () => { root.render(<AnnouncementBanner />); });
    await flush();
    expect(container.textContent).toContain('Got 2 minutes for a survey?');
  });

  it('shows nothing when the announcement is inactive', async () => {
    mockFetchOnce({ ...active, active: false });
    await act(async () => { root.render(<AnnouncementBanner />); });
    await flush();
    expect(container.textContent).toBe('');
  });

  it('shows nothing when the campaign id was already dismissed', async () => {
    localStorage.setItem('dismissedAnnouncement:survey-1', '1');
    mockFetchOnce(active);
    await act(async () => { root.render(<AnnouncementBanner />); });
    await flush();
    expect(container.textContent).toBe('');
  });

  it('shows nothing when the payload is invalid (unsafe url)', async () => {
    // eslint-disable-next-line no-script-url
    mockFetchOnce({ ...active, url: 'javascript:alert(1)' });
    await act(async () => { root.render(<AnnouncementBanner />); });
    await flush();
    expect(container.textContent).toBe('');
  });

  it('shows nothing when the fetch fails', async () => {
    mockFetchOnce(active, false);
    await act(async () => { root.render(<AnnouncementBanner />); });
    await flush();
    expect(container.textContent).toBe('');
  });

  it('disappears and records dismissal when the dismiss button is clicked', async () => {
    mockFetchOnce(active);
    await act(async () => { root.render(<AnnouncementBanner />); });
    await flush();
    expect(container.textContent).toContain('Got 2 minutes for a survey?');

    const dismissBtn = container.querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement;
    act(() => dismissBtn.click());

    expect(container.textContent).toBe('');
    expect(localStorage.getItem('dismissedAnnouncement:survey-1')).toBe('1');
  });
});
