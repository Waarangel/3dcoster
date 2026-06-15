import { describe, it, expect, beforeEach } from 'vitest';
import { parseAnnouncement, isAnnouncementDismissed, markAnnouncementDismissed } from './announcement';

// ---------------------------------------------------------------------------
// announcement — validation of the remote-controlled survey payload.
// The validation is a security boundary (remote JSON drives an <a> CTA), so
// these tests pin: shape enforcement, type enforcement, and url-scheme safety.
// ---------------------------------------------------------------------------

const valid = {
  id: 'q3-survey',
  active: true,
  message: 'Got 2 minutes for a survey?',
  ctaLabel: 'Share your thoughts',
  url: 'https://forms.example.com/abc',
};

describe('parseAnnouncement', () => {
  it('returns a normalized Announcement for a valid payload', () => {
    expect(parseAnnouncement(valid)).toEqual(valid);
  });

  it('preserves active:false (gating is the caller’s job, not the parser’s)', () => {
    const result = parseAnnouncement({ ...valid, active: false });
    expect(result).not.toBeNull();
    expect(result?.active).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(parseAnnouncement(null)).toBeNull();
    expect(parseAnnouncement('string')).toBeNull();
    expect(parseAnnouncement(42)).toBeNull();
  });

  it('rejects arrays (typeof [] is "object")', () => {
    expect(parseAnnouncement([])).toBeNull();
    expect(parseAnnouncement([valid])).toBeNull();
  });

  it('rejects a missing or empty id', () => {
    expect(parseAnnouncement({ ...valid, id: undefined })).toBeNull();
    expect(parseAnnouncement({ ...valid, id: '   ' })).toBeNull();
  });

  it('rejects a non-boolean active', () => {
    expect(parseAnnouncement({ ...valid, active: 'true' })).toBeNull();
  });

  it('rejects an empty message or ctaLabel', () => {
    expect(parseAnnouncement({ ...valid, message: '' })).toBeNull();
    expect(parseAnnouncement({ ...valid, ctaLabel: '   ' })).toBeNull();
  });

  it('rejects an unsafe url scheme (XSS guard)', () => {
    expect(parseAnnouncement({ ...valid, url: 'javascript:alert(1)' })).toBeNull();
    expect(parseAnnouncement({ ...valid, url: 'data:text/html,<script>1</script>' })).toBeNull();
    expect(parseAnnouncement({ ...valid, url: 'ftp://x' })).toBeNull();
  });

  it('rejects a missing url', () => {
    expect(parseAnnouncement({ ...valid, url: undefined })).toBeNull();
  });

  it('ignores unexpected extra fields', () => {
    const result = parseAnnouncement({ ...valid, evil: '<script>', extra: 1 });
    expect(result).toEqual(valid);
  });
});

describe('announcement dismissal (per-campaign id)', () => {
  beforeEach(() => localStorage.clear());

  it('is not dismissed by default', () => {
    expect(isAnnouncementDismissed('q3-survey')).toBe(false);
  });

  it('reports dismissed only for the dismissed id', () => {
    markAnnouncementDismissed('q3-survey');
    expect(isAnnouncementDismissed('q3-survey')).toBe(true);
    // A different campaign id is unaffected — new surveys re-show.
    expect(isAnnouncementDismissed('q4-survey')).toBe(false);
  });
});
