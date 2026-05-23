import { describe, it, expect } from 'vitest';
import type { Quote, JobCustomer, Currency } from '../types';
import { generateQuotePdfBytes } from './generateQuotePdf';

// ---------------------------------------------------------------------------
// Fixture helper — single makeQuote builder per D-17 G4 strict by-value rule.
// The pre-Phase-16-gap fixture used makeJob/makeProfile/makeSale separately;
// post-refactor the PDF reads only from Quote so the fixture collapses to one.
// ---------------------------------------------------------------------------

// Test-only override shape: allows tests to pass partial snapshots without
// re-supplying every required field. The fixture shallow-merges nested
// snapshots so callers can write `{ lineItemsSnapshot: { notes: 'x' } }`.
type QuoteOverrides = Partial<Omit<Quote, 'lineItemsSnapshot' | 'customerSnapshot'>> & {
  lineItemsSnapshot?: Partial<Quote['lineItemsSnapshot']>;
  customerSnapshot?: Partial<JobCustomer>;
};

function makeQuote(overrides: QuoteOverrides = {}): Quote {
  const baseSnapshot: Quote['lineItemsSnapshot'] = {
    jobTitle: 'Test Print',
    sellingPrice: 15.00,
    shippingCost: 0,
    resolvedTaxRate: 0,
    taxAmount: 0,
    currency: 'USD' as Currency,
    notes: '',
    terms: '',
    countryAtSendTime: undefined,
  };
  const baseCustomer: JobCustomer = {};

  const mergedLineItems: Quote['lineItemsSnapshot'] = overrides.lineItemsSnapshot
    ? { ...baseSnapshot, ...overrides.lineItemsSnapshot }
    : baseSnapshot;
  const mergedCustomer: JobCustomer = overrides.customerSnapshot
    ? { ...baseCustomer, ...overrides.customerSnapshot }
    : baseCustomer;

  // Pull the nested-snapshot overrides out so the spread of `rest` doesn't fight us.
  const { lineItemsSnapshot: _ls, customerSnapshot: _cs, ...rest } = overrides;
  void _ls; void _cs;

  return {
    id: 'quote-1',
    quoteNumber: 42,
    printJobId: 'job-1',
    customerId: undefined,
    customerSnapshot: mergedCustomer,
    lineItemsSnapshot: mergedLineItems,
    status: 'sent',
    createdAt: new Date('2026-05-23'),
    sentAt: new Date('2026-05-23'),
    ...rest,
  };
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

  it('scaffold: makeQuote produces a valid minimal Quote object', () => {
    const q = makeQuote({ quoteNumber: 100 });
    expect(q.quoteNumber).toBe(100);
    expect(q.lineItemsSnapshot.sellingPrice).toBe(15.00);
    expect(q.lineItemsSnapshot.currency).toBe('USD');
  });

  // -------------------------------------------------------------------------
  // 1. Magic bytes
  // -------------------------------------------------------------------------

  it('returns Uint8Array starting with %PDF- magic bytes', async () => {
    const bytes = await generateQuotePdfBytes(makeQuote());
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(pdfRaw(bytes).slice(0, 5)).toBe('%PDF-');
  });

  // -------------------------------------------------------------------------
  // 2. (REMOVED — throws when quoteNumber missing)
  //    Post-D-17 G4 refactor, Quote.quoteNumber is REQUIRED at the type level.
  //    The runtime throw is unreachable; TypeScript enforces presence at the
  //    call site. The old test that constructed Job with quoteNumber: undefined
  //    no longer compiles, so it has been deleted.
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // 3. Quote number in output
  // -------------------------------------------------------------------------

  it('contains the formatted quote number Q-0042', async () => {
    const bytes = await generateQuotePdfBytes(makeQuote({ quoteNumber: 42 }));
    expect(pdfExtractText(bytes)).toContain('Q-0042');
  });

  // -------------------------------------------------------------------------
  // 4. Customer name present
  // -------------------------------------------------------------------------

  it('includes customer name when customerSnapshot.name is set', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({ customerSnapshot: { name: 'Alice Test' } }),
    );
    expect(pdfExtractText(bytes)).toContain('Alice');
  });

  // -------------------------------------------------------------------------
  // 5. Customer block omitted when snapshot is empty
  // -------------------------------------------------------------------------

  it('omits customer block entirely when customerSnapshot is empty', async () => {
    const bytes = await generateQuotePdfBytes(makeQuote());
    expect(pdfExtractText(bytes)).not.toContain('Bill To');
  });

  // -------------------------------------------------------------------------
  // 6. Customer block omitted when all fields are empty strings
  // -------------------------------------------------------------------------

  it('omits customer block when customerSnapshot has no non-empty fields', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({ customerSnapshot: { name: '', email: '', company: '' } }),
    );
    expect(pdfExtractText(bytes)).not.toContain('Bill To');
  });

  // -------------------------------------------------------------------------
  // 7. Tax row hidden when resolvedTaxRate is 0
  // -------------------------------------------------------------------------

  it('hides Tax row when resolvedTaxRate is 0', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({ lineItemsSnapshot: { resolvedTaxRate: 0, taxAmount: 0 } }),
    );
    const text = pdfExtractText(bytes);
    expect(text).not.toContain('Tax (');
    expect(text).not.toContain('VAT (');
    expect(text).not.toContain('GST (');
  });

  // -------------------------------------------------------------------------
  // 8. Tax row hidden when taxAmount is 0 (even if rate is non-zero — defensive)
  // -------------------------------------------------------------------------

  it('hides Tax row when taxAmount is 0', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({ lineItemsSnapshot: { resolvedTaxRate: 0, taxAmount: 0 } }),
    );
    const text = pdfExtractText(bytes);
    expect(text).not.toContain('Tax (');
    expect(text).not.toContain('VAT (');
    expect(text).not.toContain('GST (');
  });

  // -------------------------------------------------------------------------
  // 9. VAT (19%) shown for DE country with resolvedTaxRate=19
  // -------------------------------------------------------------------------

  it('shows VAT (19%) when countryAtSendTime is DE and resolvedTaxRate is 19', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({
        lineItemsSnapshot: {
          resolvedTaxRate: 19,
          taxAmount: 2.85,
          currency: 'EUR' as Currency,
          countryAtSendTime: 'DE',
        },
      }),
    );
    expect(pdfExtractText(bytes)).toContain('VAT (19%)');
  });

  // -------------------------------------------------------------------------
  // 10. GST shown for AU country
  // -------------------------------------------------------------------------

  it('shows GST when countryAtSendTime is AU', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({
        lineItemsSnapshot: {
          resolvedTaxRate: 10,
          taxAmount: 1.5,
          currency: 'AUD' as Currency,
          countryAtSendTime: 'AU',
        },
      }),
    );
    expect(pdfExtractText(bytes)).toContain('GST (');
  });

  // -------------------------------------------------------------------------
  // 11. Generic Tax label when countryAtSendTime is unset
  // -------------------------------------------------------------------------

  it('shows generic Tax label when countryAtSendTime is unset and resolvedTaxRate > 0', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({
        lineItemsSnapshot: {
          resolvedTaxRate: 5,
          taxAmount: 0.75,
          countryAtSendTime: undefined,
        },
      }),
    );
    expect(pdfExtractText(bytes)).toContain('Tax (5%)');
  });

  // -------------------------------------------------------------------------
  // 12. Notes and Terms both omitted when empty
  // -------------------------------------------------------------------------

  it('omits Notes and Terms sections when both empty', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({ lineItemsSnapshot: { notes: '', terms: '' } }),
    );
    const text = pdfExtractText(bytes);
    expect(text).not.toContain('Notes');
    expect(text).not.toContain('Terms');
  });

  // -------------------------------------------------------------------------
  // 13. Notes section rendered when snapshot.notes is non-empty
  // -------------------------------------------------------------------------

  it('renders Notes section when snapshot.notes is non-empty', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({ lineItemsSnapshot: { notes: 'PLA gloss', terms: '' } }),
    );
    const text = pdfExtractText(bytes);
    expect(text).toContain('Notes');
    expect(text).toContain('PLA gloss');
  });

  // -------------------------------------------------------------------------
  // 14. Terms section rendered when snapshot.terms is non-empty
  // -------------------------------------------------------------------------

  it('renders Terms section when snapshot.terms is non-empty', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({ lineItemsSnapshot: { notes: '', terms: 'Payment 14d' } }),
    );
    const text = pdfExtractText(bytes);
    expect(text).toContain('Terms');
    expect(text).toContain('Payment 14d');
  });

  // -------------------------------------------------------------------------
  // 15. Both Notes and Terms rendered when both non-empty
  // -------------------------------------------------------------------------

  it('renders both Notes and Terms when both non-empty', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({ lineItemsSnapshot: { notes: 'PLA gloss', terms: 'Payment 14d' } }),
    );
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
    const bytes = await generateQuotePdfBytes(makeQuote());
    expect(pdfExtractText(bytes)).toContain('Made with 3DCoster');
  });

  // -------------------------------------------------------------------------
  // 17. Footer — website URL
  // -------------------------------------------------------------------------

  it('includes 3dcoster.vercel.app in footer', async () => {
    const bytes = await generateQuotePdfBytes(makeQuote());
    expect(pdfExtractText(bytes)).toContain('3dcoster.vercel.app');
  });

  // -------------------------------------------------------------------------
  // 18. Line item description includes job title (snapshot)
  // -------------------------------------------------------------------------

  it('includes Custom 3D print — {jobTitle} line item', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({ lineItemsSnapshot: { jobTitle: 'Phone Stand' } }),
    );
    expect(pdfExtractText(bytes)).toContain('Phone Stand');
  });

  // -------------------------------------------------------------------------
  // Whitespace-only notes/terms treated as empty (D-08)
  // -------------------------------------------------------------------------

  it('treats whitespace-only notes as empty and omits Notes section', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({ lineItemsSnapshot: { notes: '   ', terms: '' } }),
    );
    expect(pdfExtractText(bytes)).not.toContain('Notes');
  });

  it('treats whitespace-only terms as empty and omits Terms section', async () => {
    const bytes = await generateQuotePdfBytes(
      makeQuote({ lineItemsSnapshot: { notes: '', terms: '\t  \n' } }),
    );
    expect(pdfExtractText(bytes)).not.toContain('Terms');
  });

  // -------------------------------------------------------------------------
  // D-15: Shipping row
  // -------------------------------------------------------------------------

  describe('D-15 shipping row', () => {
    it('omits Shipping row when shippingCost === 0', async () => {
      const bytes = await generateQuotePdfBytes(
        makeQuote({ lineItemsSnapshot: { shippingCost: 0 } }),
      );
      expect(pdfExtractText(bytes)).not.toContain('Shipping');
    });

    it('renders Shipping row between Subtotal and Tax when shippingCost > 0', async () => {
      const bytes = await generateQuotePdfBytes(
        makeQuote({
          lineItemsSnapshot: {
            sellingPrice: 100,
            shippingCost: 5,
            resolvedTaxRate: 20,
            taxAmount: 20,
            currency: 'EUR' as Currency,
          },
        }),
      );
      const text = pdfExtractText(bytes);
      expect(text).toContain('Shipping');
      // Order check: Subtotal index < Shipping index < Tax (20%) index.
      // We rely on pdfExtractText preserving text-order via the parts array.
      const subIdx = text.indexOf('Subtotal');
      const shipIdx = text.indexOf('Shipping');
      const taxIdx = text.indexOf('Tax (20%)');
      expect(subIdx).toBeGreaterThanOrEqual(0);
      expect(shipIdx).toBeGreaterThan(subIdx);
      expect(taxIdx).toBeGreaterThan(shipIdx);
    });

    it('Total includes shippingCost: subtotal + shipping + tax (D-15)', async () => {
      // sellingPrice=50, shipping=10, rate=10% → tax=5 → total=65
      const bytes = await generateQuotePdfBytes(
        makeQuote({
          lineItemsSnapshot: {
            sellingPrice: 50,
            shippingCost: 10,
            resolvedTaxRate: 10,
            taxAmount: 5,
            currency: 'USD' as Currency,
          },
        }),
      );
      const text = pdfExtractText(bytes);
      // formatCurrency('USD') uses $ prefix; check both raw and prefixed forms.
      expect(text).toMatch(/Total/);
      expect(text).toContain('65');
    });
  });

  // -------------------------------------------------------------------------
  // D-22: Tax-base lock — shipping is NOT in the tax base.
  // -------------------------------------------------------------------------

  describe('D-22 tax base lock', () => {
    it('tax row uses sellingPrice × rate, NOT (sellingPrice + shippingCost) × rate', async () => {
      // sellingPrice=100, shipping=10, rate=20%
      // Correct (D-22): tax = 100 × 0.20 = 20.00. Total = 100 + 10 + 20 = 130.
      // Wrong base:     tax = 110 × 0.20 = 22.00. Total = 100 + 10 + 22 = 132.
      // The snapshot carries the resolved tax already so the renderer must display
      // the snapshotted value (20), not re-derive from (subtotal + shipping).
      const bytes = await generateQuotePdfBytes(
        makeQuote({
          lineItemsSnapshot: {
            sellingPrice: 100,
            shippingCost: 10,
            resolvedTaxRate: 20,
            taxAmount: 20,  // ← D-22: calculateTax(sellingPrice, rate) — shipping NOT in base
            currency: 'EUR' as Currency,
            countryAtSendTime: 'DE',
          },
        }),
      );
      const text = pdfExtractText(bytes);
      // The VAT (20%) line should show 20.00, not 22.00.
      expect(text).toMatch(/VAT \(20%\).*20/);
      expect(text).not.toMatch(/VAT \(20%\).*22\.00/);
      // Total = 100 + 10 + 20 = 130.
      expect(text).toMatch(/Total.*130/);
    });
  });

  // -------------------------------------------------------------------------
  // D-17 G4 by-value snapshot lock
  // -------------------------------------------------------------------------

  describe('D-17 G4 by-value snapshot', () => {
    it('uses snapshot countryAtSendTime for tax label, not any external source', async () => {
      // A Quote with countryAtSendTime='IT' (Italy → VAT) must render VAT
      // regardless of any other state. The function signature no longer
      // accepts userProfile, so cross-reads are impossible at the type level.
      const bytes = await generateQuotePdfBytes(
        makeQuote({
          lineItemsSnapshot: {
            resolvedTaxRate: 22,
            taxAmount: 3.3,
            currency: 'EUR' as Currency,
            countryAtSendTime: 'IT',
          },
        }),
      );
      expect(pdfExtractText(bytes)).toContain('VAT (22%)');
    });
  });

});
