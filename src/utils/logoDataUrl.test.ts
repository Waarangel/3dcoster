import { describe, it, expect } from 'vitest';
import { isValidLogoDataUrl, MAX_LOGO_DATA_URL_LENGTH } from './logoDataUrl';

// ---------------------------------------------------------------------------
// Phase 46 D-01 — logo data-URL validator (the XSS allowlist)
//
// This is the SINGLE canonical client-side validator for white-label logos.
// It is mirrored server-side in api/ (46-05) with a lockstep comment, since
// api/ cannot import from src/. Any change here must be mirrored there.
// ---------------------------------------------------------------------------

describe('isValidLogoDataUrl', () => {
  it('accepts a valid PNG data URL', () => {
    expect(isValidLogoDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('accepts a valid JPEG data URL', () => {
    expect(isValidLogoDataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
  });

  it('accepts a valid WEBP data URL', () => {
    expect(isValidLogoDataUrl('data:image/webp;base64,UklGRl4=')).toBe(true);
  });

  it('rejects svg (not allowlisted)', () => {
    expect(isValidLogoDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
  });

  it('rejects a javascript: URL', () => {
    expect(isValidLogoDataUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects a quote/space attribute-breakout payload', () => {
    expect(isValidLogoDataUrl('data:image/png;base64,AAA" onerror=alert(1)')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidLogoDataUrl(undefined)).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidLogoDataUrl(null)).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidLogoDataUrl('')).toBe(false);
  });

  it('rejects a string longer than MAX_LOGO_DATA_URL_LENGTH (defense-in-depth against oversized payloads)', () => {
    const oversized = 'data:image/png;base64,' + 'A'.repeat(MAX_LOGO_DATA_URL_LENGTH);
    expect(isValidLogoDataUrl(oversized)).toBe(false);
  });
});
