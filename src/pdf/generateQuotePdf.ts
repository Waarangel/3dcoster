/**
 * PDF quote generator — dynamic-import target. No static jspdf import in src/ outside this file.
 * No React, no Dexie. Mirrors layout decisions in CONTEXT.md D-01..D-12.
 *
 * Strict by-value snapshot rule (D-17 G4): PDF reads ONLY from Quote.lineItemsSnapshot
 * + Quote.customerSnapshot — NEVER from PrintJob or UserProfile at render time. The
 * `generateQuotePdf(quote: Quote, branding?: QuoteBranding)` signature is type-level
 * enforcement of the snapshot rule. Subsequent edits to the source PrintJob/UserProfile
 * do not mutate already-issued quotes.
 *
 * Phase 46 (D-04/D-05/D-06/D-07/D-10): the OPTIONAL `branding` argument is the sole
 * white-label seam. It is INJECTED by the caller (PrintQuoteModal) from LIVE
 * entitlement + UserProfile at download time — this module still imports NEITHER
 * Dexie NOR useEntitlement, preserving the pure/by-value module contract. Because
 * branding is evaluated live at download time (not frozen into the Quote snapshot),
 * a Pro user always gets a white-label PDF and a lapsed user always gets the
 * 3DCoster-branded one — this is the deliberate PDF-vs-hosted-page asymmetry (D-10).
 */

import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { Quote } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatQuoteNumber, customerNameSlug } from '../utils/format';
import { taxLabelFor } from '../utils/taxResolution';
import { isValidLogoDataUrl } from '../utils/logoDataUrl';
import { notoSansRegularBase64, notoSansBoldBase64 } from './notoSansBase64';

// ---------------------------------------------------------------------------
// Layout constants (all in pt; A4 portrait)
// ---------------------------------------------------------------------------
const MARGIN_LEFT = 40;
const MARGIN_RIGHT = 40;
const FONT_ID = 'NotoSans';

// ---------------------------------------------------------------------------
// White-label branding (Phase 46, D-01/D-04/D-05/D-06/D-10)
// ---------------------------------------------------------------------------

/** Injected by the caller (never read internally from Dexie/UserProfile). */
export interface QuoteBranding {
  /** Live entitlement result at download time (D-05 automatic, D-06 reverts on lapse). */
  isWhiteLabel: boolean;
  /** Must already be a validated data URL (isValidLogoDataUrl) — re-validated defensively here too. */
  logoDataUrl?: string;
  businessName?: string;
}

/** Backward-compatible default: identical to today's single-arg behavior. */
const DEFAULT_BRANDING: QuoteBranding = { isWhiteLabel: false };

/** Max bounding box for the header logo — chosen to fit above the y=65 rule alongside the QUOTE/# block. */
const MAX_LOGO_WIDTH = 90;
const MAX_LOGO_HEIGHT = 36;
const LOGO_TOP_Y = 15;

/**
 * Extract the explicit jsPDF image format from a data URL prefix.
 * Pattern 1 (RESEARCH.md Pitfall 1): NEVER rely on jsPDF's addImage auto-detection —
 * it has a documented "does not support files of type 'UNKNOWN'" failure mode.
 */
function extractLogoFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' | null {
  const match = /^data:image\/(png|jpeg|webp);base64,/.exec(dataUrl);
  return match ? (match[1].toUpperCase() as 'PNG' | 'JPEG' | 'WEBP') : null;
}

// ---------------------------------------------------------------------------
// Font registration (RESEARCH.md Pattern 3)
//
// jsPDF 4.x VFS is per-instance (stored in doc.internal.vFS). This means
// addFileToVFS AND addFont must be called on EVERY new jsPDF() instance.
// The base64 strings are module-level constants (already in memory), so
// calling addFileToVFS per-instance is cheap — it just copies the reference
// into the instance's VFS dictionary.
//
// There is no persistent shared VFS between instances; the module-level
// `fontsLoaded` guard pattern from RESEARCH.md Pattern 3 does NOT apply
// to jsPDF 4.x's per-instance VFS. Each doc gets its own registration.
// ---------------------------------------------------------------------------

function ensureFontsLoaded(doc: jsPDF): void {
  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansRegularBase64);
  doc.addFileToVFS('NotoSans-Bold.ttf', notoSansBoldBase64);
  doc.addFont('NotoSans-Regular.ttf', FONT_ID, 'normal');
  doc.addFont('NotoSans-Bold.ttf', FONT_ID, 'bold');
}

// ---------------------------------------------------------------------------
// Internal section renderers — all read from `quote.lineItemsSnapshot` +
// `quote.customerSnapshot` only. Per D-17 G4, no PrintJob/UserProfile here.
// ---------------------------------------------------------------------------

/**
 * White-label header (D-04): maker logo + business name render TOGETHER,
 * the 3DCoster wordmark does NOT render. Degrades gracefully — an invalid or
 * absent logo still renders the business name; the logo is only ever passed
 * to addImage after isValidLogoDataUrl approval (T-46-09 mitigation).
 */
function renderWhiteLabelHeader(doc: jsPDF, branding: QuoteBranding): void {
  let textX = MARGIN_LEFT;
  let textY = 30;

  if (isValidLogoDataUrl(branding.logoDataUrl)) {
    const format = extractLogoFormat(branding.logoDataUrl!);
    if (format) {
      try {
        const props = doc.getImageProperties(branding.logoDataUrl!);
        const scale = Math.min(MAX_LOGO_WIDTH / props.width, MAX_LOGO_HEIGHT / props.height, 1);
        const w = props.width * scale;
        const h = props.height * scale;
        doc.addImage(branding.logoDataUrl!, format, MARGIN_LEFT, LOGO_TOP_Y, w, h);
        textX = MARGIN_LEFT + w + 10;
        textY = LOGO_TOP_Y + h / 2 + 4;
      } catch {
        // Corrupt image bytes despite passing the regex validator — never let a
        // bad logo crash PDF generation; fall back to business-name-only.
      }
    }
  }

  if (branding.businessName) {
    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(14);
    doc.text(branding.businessName, textX, Math.max(textY, 30));
  }
}

function renderHeader(doc: jsPDF, quote: Quote, branding: QuoteBranding): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const quoteNum = formatQuoteNumber(quote.quoteNumber);

  if (branding.isWhiteLabel) {
    renderWhiteLabelHeader(doc, branding);
  } else {
    // Wordmark — bold 18pt, top-left
    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(18);
    doc.text('3DCoster', MARGIN_LEFT, 50);
  }

  // QUOTE label + Q-NNNN — stacked top-right, right-aligned
  doc.setFontSize(10);
  doc.text('QUOTE', pageWidth - MARGIN_RIGHT, 44, { align: 'right' });
  doc.setFontSize(12);
  doc.text(quoteNum, pageWidth - MARGIN_RIGHT, 57, { align: 'right' });

  // Thin horizontal rule at y=65
  doc.setFont(FONT_ID, 'normal');
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, 65, pageWidth - MARGIN_RIGHT, 65);

  return 85;
}

function renderMetaAndCustomer(doc: jsPDF, quote: Quote, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const today = new Date();
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  function fmtDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  const quoteNum = formatQuoteNumber(quote.quoteNumber);
  const issueStr = fmtDate(today);
  const validStr = fmtDate(validUntil);

  doc.setFontSize(10);
  doc.setFont(FONT_ID, 'normal');

  // LEFT column: meta block
  let leftY = startY;
  doc.text(`Quote #: ${quoteNum}`, MARGIN_LEFT, leftY);
  leftY += 14;
  doc.text(`Issue date: ${issueStr}`, MARGIN_LEFT, leftY);
  leftY += 14;
  doc.text(`Valid until: ${validStr}`, MARGIN_LEFT, leftY);
  leftY += 14;

  // RIGHT column: customer block — only when at least one field is non-empty.
  // Per D-17 G4 the customerSnapshot is always present on a Quote; the
  // empty-snapshot guard catches v7→v8 backfill 'draft' rows that never get
  // rendered anyway but is defensive against future call sites.
  const cust = quote.customerSnapshot;
  const hasCustomer = !!(cust.name || cust.email || cust.company || cust.address);

  let rightY = startY;
  if (hasCustomer) {
    const rightX = pageWidth / 2;
    doc.setFont(FONT_ID, 'bold');
    doc.text('Bill To:', rightX, rightY);
    rightY += 14;
    doc.setFont(FONT_ID, 'normal');

    if (cust.name) { doc.text(cust.name, rightX, rightY); rightY += 12; }
    if (cust.company) { doc.text(cust.company, rightX, rightY); rightY += 12; }
    if (cust.email) { doc.text(cust.email, rightX, rightY); rightY += 12; }
    if (cust.address) {
      const lines = doc.splitTextToSize(cust.address, pageWidth / 2 - MARGIN_RIGHT);
      doc.text(lines, rightX, rightY);
      rightY += lines.length * 12;
    }
  }

  return Math.max(leftY, rightY) + 10;
}

function renderLineItems(doc: jsPDF, quote: Quote, startY: number): number {
  const { jobTitle, sellingPrice, currency } = quote.lineItemsSnapshot;
  const variants = quote.variantsSnapshot;
  const description = `Custom 3D print — ${jobTitle}`;

  // CONN-03 (D-08): when a by-value variants snapshot is present, emit one
  // autoTable row per tier — Qty/Unit Price/Amount derived ONLY from
  // variantsSnapshot (D-17 G4 by-value rule; no PrintJob/UserProfile reads).
  // When absent, fall back to the original single-row collapsed layout
  // (D-04) unchanged: qty=1, amount = unit price.
  const body: string[][] =
    variants && variants.quantities.length > 0
      ? variants.quantities.map((qty, i) => {
          const unitPrice = variants.unitPrices[i];
          const amount = qty * unitPrice;
          return [
            description,
            String(qty),
            formatCurrency(unitPrice, variants.currency),
            formatCurrency(amount, variants.currency),
          ];
        })
      : [[
          description,
          String(1),
          formatCurrency(sellingPrice, currency),
          formatCurrency(sellingPrice, currency),
        ]];

  autoTable(doc, {
    startY,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body,
    theme: 'plain',
    styles: {
      font: FONT_ID,
      fontSize: 10,
    },
    headStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
      textColor: [0, 0, 0] as [number, number, number],
      fontStyle: 'bold',
    },
  });

  return doc.lastAutoTable.finalY;
}

function renderTotals(doc: jsPDF, quote: Quote, startY: number): number {
  const { sellingPrice, shippingCost, resolvedTaxRate, taxAmount, currency, countryAtSendTime } =
    quote.lineItemsSnapshot;
  const variants = quote.variantsSnapshot;
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightX = pageWidth - MARGIN_RIGHT;

  // D-04: subtotal collapses to a single row × unitPrice. D-22 tax base lock:
  // tax is computed against sellingPrice ONLY (shipping is NOT taxed). The
  // snapshot's taxAmount already reflects this — calculateTax(sellingPrice, rate)
  // — so we just render the stored value rather than re-multiplying here.
  const subtotal = sellingPrice;
  const showShipping = shippingCost > 0;
  const showTax = resolvedTaxRate > 0 && taxAmount > 0;
  const showVariantsTotal = !!variants && variants.quantities.length > 0;

  doc.setFontSize(10);
  doc.setFont(FONT_ID, 'normal');

  let y = startY + 16;

  // CONN-03 (D-08): a tier table above with no matching total reads as
  // broken, so surface an informational "Variant options total" line —
  // Σ(qty × unitPrice) sourced ONLY from variantsSnapshot. This does NOT
  // replace Subtotal/Tax/Total below, which continue to read exclusively
  // from lineItemsSnapshot (D-22 tax-base lock is untouched).
  if (showVariantsTotal) {
    const variantsTotal = variants!.quantities.reduce(
      (sum, qty, i) => sum + qty * variants!.unitPrices[i],
      0,
    );
    doc.setFont(FONT_ID, 'bold');
    doc.text(
      `Variant options total: ${formatCurrency(variantsTotal, variants!.currency)}`,
      rightX,
      y,
      { align: 'right' },
    );
    doc.setFont(FONT_ID, 'normal');
    y += 14;
  }

  // Subtotal
  doc.text(`Subtotal: ${formatCurrency(subtotal, currency)}`, rightX, y, { align: 'right' });
  y += 14;

  // Shipping row — D-15. Between Subtotal and Tax. Hidden when shippingCost === 0.
  if (showShipping) {
    doc.text(`Shipping: ${formatCurrency(shippingCost, currency)}`, rightX, y, { align: 'right' });
    y += 14;
  }

  // Tax row — only when both resolvedTaxRate and taxAmount are > 0.
  if (showTax) {
    const label = taxLabelFor(countryAtSendTime);
    doc.text(`${label} (${resolvedTaxRate}%): ${formatCurrency(taxAmount, currency)}`, rightX, y, { align: 'right' });
    y += 14;
  }

  // Total = subtotal + shippingCost + taxAmount (D-15 + D-22).
  // Hidden tax / hidden shipping cleanly drop their contributions to 0.
  const total = subtotal + (showShipping ? shippingCost : 0) + (showTax ? taxAmount : 0);
  doc.setFont(FONT_ID, 'bold');
  doc.text(`Total: ${formatCurrency(total, currency)}`, rightX, y, { align: 'right' });
  doc.setFont(FONT_ID, 'normal');
  y += 14;

  return y;
}

function renderNotesAndTerms(doc: jsPDF, quote: Quote, startY: number): number {
  const { notes, terms } = quote.lineItemsSnapshot;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;

  const notesStr = notes.trim();
  const termsStr = terms.trim();

  if (!notesStr && !termsStr) {
    return startY;
  }

  let y = startY + 16;
  doc.setFontSize(10);

  if (notesStr) {
    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(11);
    doc.text('Notes', MARGIN_LEFT, y);
    y += 14;
    doc.setFont(FONT_ID, 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(notesStr, contentWidth);
    doc.text(lines, MARGIN_LEFT, y);
    y += lines.length * 12 + 8;
  }

  if (termsStr) {
    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(11);
    doc.text('Terms', MARGIN_LEFT, y);
    y += 14;
    doc.setFont(FONT_ID, 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(termsStr, contentWidth);
    doc.text(lines, MARGIN_LEFT, y);
    y += lines.length * 12 + 8;
  }

  return y;
}

function renderFooter(doc: jsPDF, branding: QuoteBranding): void {
  // D-06/D-10: the footer is dropped for ANY white-label PDF — no exceptions,
  // no toggle. Free/lapsed users keep the unchanged 3DCoster footer.
  if (branding.isWhiteLabel) return;

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setFont(FONT_ID, 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Made with 3DCoster — 3dcoster.com', MARGIN_LEFT, pageHeight - 30);
  doc.setTextColor(0, 0, 0);
}

function buildFilename(quote: Quote): string {
  const qNum = formatQuoteNumber(quote.quoteNumber);
  const slug = customerNameSlug(quote.customerSnapshot.name ?? quote.customerSnapshot.company);
  return slug ? `Quote-${qNum}-${slug}.pdf` : `Quote-${qNum}.pdf`;
}

// ---------------------------------------------------------------------------
// Private builder — assembles the full jsPDF document
//
// Invariant: Quote.quoteNumber is required by the Quote interface, so the
// previous "throw when undefined" guard is unreachable at the type level
// and has been removed.
// ---------------------------------------------------------------------------

function _buildDoc(quote: Quote, branding: QuoteBranding): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  ensureFontsLoaded(doc);
  doc.setFont(FONT_ID, 'normal');

  let y = renderHeader(doc, quote, branding);
  y = renderMetaAndCustomer(doc, quote, y);
  y = renderLineItems(doc, quote, y);
  y = renderTotals(doc, quote, y);
  renderNotesAndTerms(doc, quote, y);
  renderFooter(doc, branding);

  return doc;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Build the PDF and return its bytes.
 * Used by tests (no disk I/O) and by the Tauri save branch.
 */
export async function generateQuotePdfBytes(
  quote: Quote,
  branding: QuoteBranding = DEFAULT_BRANDING,
): Promise<Uint8Array> {
  const doc = _buildDoc(quote, branding);
  return new Uint8Array(doc.output('arraybuffer'));
}

/**
 * Full flow: build PDF, then save to disk.
 * Web path: doc.save() triggers the browser download dialog.
 * Tauri path: native save dialog via @tauri-apps/plugin-dialog + writeFile via @tauri-apps/plugin-fs.
 * Tauri imports are DYNAMIC so the Tauri SDK is never bundled into the web chunk.
 */
export async function generateQuotePdf(
  quote: Quote,
  branding: QuoteBranding = DEFAULT_BRANDING,
): Promise<void> {
  const doc = _buildDoc(quote, branding);
  const filename = buildFilename(quote);

  if (!__IS_TAURI__) {
    doc.save(filename);
    return;
  }

  // Tauri desktop path — dynamic imports keep these off the web bundle
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');

  const savePath = await save({
    defaultPath: filename,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (!savePath) return;

  const buffer = doc.output('arraybuffer');
  try {
    await writeFile(savePath, new Uint8Array(buffer));
  } catch (err) {
    // Tauri fs plugin scope-denial error format: "forbidden path: {pathbuf}"
    // Source: plugins-workspace/v2/plugins/fs/src/error.rs — PathForbidden variant.
    // Anchored to the trailing colon to exclude false-positive matches on errors
    // that contain the substring elsewhere (e.g., "operation not permitted on forbidden path component").
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().startsWith('forbidden path:')) {
      throw new Error(
        `Cannot save to "${savePath}" — this location is restricted. ` +
        `Try saving to Downloads, Documents, or Desktop instead.`,
      );
    }
    throw err; // Anything else surfaces to PrintQuoteModal's catch verbatim.
  }
}
