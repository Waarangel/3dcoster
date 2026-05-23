import { describe, it, expect } from 'vitest';
import type { PrintJob, UserProfile, Sale, JobCustomer } from '../types';
import { generateQuotePdfBytes } from './generateQuotePdf';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<PrintJob> = {}): PrintJob {
  return {
    id: 'job-1',
    name: 'Test Print',
    createdAt: new Date('2026-05-23'),
    updatedAt: new Date('2026-05-23'),
    filaments: [],
    printTimeHours: 2,
    printerInstanceId: 'instance-1',
    modelCost: 0,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    costPerUnit: 5.00,
    sellingPrice: 15.00,
    copiesSold: 0,
    quoteNumber: 42,
    ...overrides,
  } as PrintJob;
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    currency: 'USD',
    laborHourlyRate: 20,
    ...overrides,
  } as UserProfile;
}

function makeSale(customer?: JobCustomer): Sale {
  return {
    id: 'sale-1',
    jobId: 'job-1',
    quantity: 1,
    unitPrice: 15.00,
    totalRevenue: 15.00,
    soldAt: new Date('2026-05-23'),
    customer,
  } as Sale;
}

// ---------------------------------------------------------------------------
// PDF text extraction helpers
//
// jsPDF with custom (CID) fonts encodes text as glyph index sequences in the
// content stream rather than plain ASCII. To assert on specific user-visible
// strings, we must:
//   1. Parse the ToUnicode CMap streams embedded in the PDF (map glyph→char).
//   2. Find all hex-encoded text operands (< hex > Tj) and decode them.
//
// This gives us the actual rendered text regardless of font encoding.
// ---------------------------------------------------------------------------

/**
 * Convert PDF bytes to a plain string for magic-byte checks.
 * Only reliable for ASCII literal bytes (header, dictionary keys, etc.)
 */
function pdfRaw(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/**
 * Extract all user-visible text from a jsPDF-generated PDF.
 * Parses the embedded ToUnicode CMap(s) to decode CID glyph sequences.
 * Works for PDFs generated with custom (non-standard) fonts.
 */
function pdfExtractText(bytes: Uint8Array): string {
  const raw = pdfRaw(bytes);

  // 1. Build a glyph-id→unicode-char map from all ToUnicode CMap sections.
  //    jsPDF may embed multiple CMaps (one per font variant: regular, bold).
  //    We merge them — glyph IDs within a given font are unique.
  const glyphToChar: Record<number, string> = {};

  const cmapRegex = /beginbfchar([\s\S]*?)endbfchar/g;
  let cmapMatch: RegExpExecArray | null;
  while ((cmapMatch = cmapRegex.exec(raw)) !== null) {
    const entries = cmapMatch[1].match(/<([0-9a-fA-F]+)><([0-9a-fA-F]+)>/g) ?? [];
    for (const entry of entries) {
      const parts = entry.match(/<([0-9a-fA-F]+)><([0-9a-fA-F]+)>/);
      if (parts) {
        const glyphId = parseInt(parts[1], 16);
        const codePoint = parseInt(parts[2], 16);
        glyphToChar[glyphId] = String.fromCodePoint(codePoint);
      }
    }
  }

  // 2. Find all hex-encoded text in Tj operators and decode glyph sequences.
  //    Format: <hexstring> Tj  (hex nibbles grouped in 4 = 2 bytes per glyph)
  const parts: string[] = [];
  const tjRegex = /<([0-9a-fA-F]+)>\s*Tj/g;
  let tjMatch: RegExpExecArray | null;
  while ((tjMatch = tjRegex.exec(raw)) !== null) {
    const hex = tjMatch[1];
    let decoded = '';
    for (let i = 0; i < hex.length; i += 4) {
      const glyphId = parseInt(hex.slice(i, i + 4), 16);
      decoded += glyphToChar[glyphId] ?? '�';
    }
    parts.push(decoded);
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateQuotePdf', () => {

  it('scaffold: fixture helpers produce valid minimal objects', () => {
    const job = makeJob({ sellingPrice: 20.00, quoteNumber: 42 });
    const profile = makeProfile({ nextQuoteNumber: 43 });
    expect(job.sellingPrice).toBe(20.00);
    expect(job.quoteNumber).toBe(42);
    expect(profile.nextQuoteNumber).toBe(43);
  });

  // -------------------------------------------------------------------------
  // 1. Magic bytes
  // -------------------------------------------------------------------------

  it('returns Uint8Array starting with %PDF- magic bytes', async () => {
    const bytes = await generateQuotePdfBytes({ job: makeJob(), userProfile: makeProfile() });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(pdfRaw(bytes).slice(0, 5)).toBe('%PDF-');
  });

  // -------------------------------------------------------------------------
  // 2. Throws when quoteNumber missing
  // -------------------------------------------------------------------------

  it('throws when job.quoteNumber is undefined', async () => {
    await expect(
      generateQuotePdfBytes({ job: makeJob({ quoteNumber: undefined as any }), userProfile: makeProfile() })
    ).rejects.toThrow(/quoteNumber/);
  });

  // -------------------------------------------------------------------------
  // 3. Quote number in output
  // -------------------------------------------------------------------------

  it('contains the formatted quote number Q-0042', async () => {
    const bytes = await generateQuotePdfBytes({ job: makeJob({ quoteNumber: 42 }), userProfile: makeProfile() });
    expect(pdfExtractText(bytes)).toContain('Q-0042');
  });

  // -------------------------------------------------------------------------
  // 4. Customer name present
  // -------------------------------------------------------------------------

  it('includes customer name when sale.customer.name is set', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob(),
      userProfile: makeProfile(),
      sale: makeSale({ name: 'Alice Test' }),
    });
    expect(pdfExtractText(bytes)).toContain('Alice');
  });

  // -------------------------------------------------------------------------
  // 5. Customer block omitted when no sale
  // -------------------------------------------------------------------------

  it('omits customer block entirely when sale is undefined', async () => {
    const bytes = await generateQuotePdfBytes({ job: makeJob(), userProfile: makeProfile() });
    expect(pdfExtractText(bytes)).not.toContain('Bill To');
  });

  // -------------------------------------------------------------------------
  // 6. Customer block omitted when sale.customer has no non-empty fields
  // -------------------------------------------------------------------------

  it('omits customer block when sale.customer has no non-empty fields', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob(),
      userProfile: makeProfile(),
      sale: makeSale({}), // empty customer object
    });
    expect(pdfExtractText(bytes)).not.toContain('Bill To');
  });

  // -------------------------------------------------------------------------
  // 7. Tax row hidden when taxRate is 0
  // -------------------------------------------------------------------------

  it('hides Tax row when taxRate is 0', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ taxRate: 0, taxAmount: 0 }),
      userProfile: makeProfile(),
    });
    const text = pdfExtractText(bytes);
    expect(text).not.toContain('Tax (');
    expect(text).not.toContain('VAT (');
    expect(text).not.toContain('GST (');
  });

  // -------------------------------------------------------------------------
  // 8. Tax row hidden when taxRate and taxAmount are undefined
  // -------------------------------------------------------------------------

  it('hides Tax row when taxRate and taxAmount are undefined', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ taxRate: undefined, taxAmount: undefined }),
      userProfile: makeProfile(),
    });
    const text = pdfExtractText(bytes);
    expect(text).not.toContain('Tax (');
    expect(text).not.toContain('VAT (');
    expect(text).not.toContain('GST (');
  });

  // -------------------------------------------------------------------------
  // 9. VAT (19%) shown for DE country with taxRate=19
  // -------------------------------------------------------------------------

  it('shows VAT (19%) when country is DE and taxRate is 19', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ taxRate: 19, taxAmount: 22.8 }),
      userProfile: makeProfile({ currency: 'EUR', address: { country: 'DE' } }),
    });
    expect(pdfExtractText(bytes)).toContain('VAT (19%)');
  });

  // -------------------------------------------------------------------------
  // 10. GST shown for AU country
  // -------------------------------------------------------------------------

  it('shows GST when country is AU', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ taxRate: 10, taxAmount: 1.5 }),
      userProfile: makeProfile({ currency: 'AUD', address: { country: 'AU' } }),
    });
    expect(pdfExtractText(bytes)).toContain('GST (');
  });

  // -------------------------------------------------------------------------
  // 11. Generic Tax label when country is unset
  // -------------------------------------------------------------------------

  it('shows generic Tax label when country is unset and taxRate > 0', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ taxRate: 5, taxAmount: 0.75 }),
      userProfile: makeProfile({ address: undefined }),
    });
    expect(pdfExtractText(bytes)).toContain('Tax (5%)');
  });

  // -------------------------------------------------------------------------
  // 12. Notes and Terms both omitted when empty
  // -------------------------------------------------------------------------

  it('omits Notes and Terms sections when both empty', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ notes: undefined }),
      userProfile: makeProfile({ defaultTerms: undefined }),
    });
    const text = pdfExtractText(bytes);
    expect(text).not.toContain('Notes');
    expect(text).not.toContain('Terms');
  });

  // -------------------------------------------------------------------------
  // 13. Notes section rendered when PrintJob.notes is non-empty
  // -------------------------------------------------------------------------

  it('renders Notes section when PrintJob.notes is non-empty', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ notes: 'PLA gloss' }),
      userProfile: makeProfile({ defaultTerms: undefined }),
    });
    const text = pdfExtractText(bytes);
    expect(text).toContain('Notes');
    expect(text).toContain('PLA gloss');
  });

  // -------------------------------------------------------------------------
  // 14. Terms section rendered when UserProfile.defaultTerms is non-empty
  // -------------------------------------------------------------------------

  it('renders Terms section when UserProfile.defaultTerms is non-empty', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ notes: undefined }),
      userProfile: makeProfile({ defaultTerms: 'Payment 14d' }),
    });
    const text = pdfExtractText(bytes);
    expect(text).toContain('Terms');
    expect(text).toContain('Payment 14d');
  });

  // -------------------------------------------------------------------------
  // 15. Both Notes and Terms rendered when both non-empty
  // -------------------------------------------------------------------------

  it('renders both Notes and Terms when both non-empty', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ notes: 'PLA gloss' }),
      userProfile: makeProfile({ defaultTerms: 'Payment 14d' }),
    });
    const text = pdfExtractText(bytes);
    expect(text).toContain('Notes');
    expect(text).toContain('PLA gloss');
    expect(text).toContain('Terms');
    expect(text).toContain('Payment 14d');
  });

  // -------------------------------------------------------------------------
  // 16. Footer — "Made with 3DCoster"
  // -------------------------------------------------------------------------

  it('includes Made with 3DCoster footer', async () => {
    const bytes = await generateQuotePdfBytes({ job: makeJob(), userProfile: makeProfile() });
    expect(pdfExtractText(bytes)).toContain('Made with 3DCoster');
  });

  // -------------------------------------------------------------------------
  // 17. Footer — website URL
  // -------------------------------------------------------------------------

  it('includes 3dcoster.vercel.app in footer', async () => {
    const bytes = await generateQuotePdfBytes({ job: makeJob(), userProfile: makeProfile() });
    expect(pdfExtractText(bytes)).toContain('3dcoster.vercel.app');
  });

  // -------------------------------------------------------------------------
  // 18. Line item description includes job name
  // -------------------------------------------------------------------------

  it('includes Custom 3D print — {jobName} line item', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ name: 'Phone Stand' }),
      userProfile: makeProfile(),
    });
    expect(pdfExtractText(bytes)).toContain('Phone Stand');
  });

  // -------------------------------------------------------------------------
  // Whitespace-only notes treated as empty (D-08)
  // -------------------------------------------------------------------------

  it('treats whitespace-only notes as empty and omits Notes section', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ notes: '   ' }),
      userProfile: makeProfile({ defaultTerms: undefined }),
    });
    expect(pdfExtractText(bytes)).not.toContain('Notes');
  });

  it('treats whitespace-only defaultTerms as empty and omits Terms section', async () => {
    const bytes = await generateQuotePdfBytes({
      job: makeJob({ notes: undefined }),
      userProfile: makeProfile({ defaultTerms: '\t  \n' }),
    });
    expect(pdfExtractText(bytes)).not.toContain('Terms');
  });

});
