// ---------------------------------------------------------------------------
// Sales report PDF (v1.8, feature #33). The render() half of the
// aggregate()->render() split: consumes a SalesReportData (from
// computeSalesReport) and nothing else, so a future Pro scheduled/emailed/branded
// report reuses the same input. Lives in src/pdf/ (only dynamically imported —
// the no-static-pdf-import gate keeps it off the web bundle), loads the bundled
// Noto fonts on every instance, and saves via the web/__IS_TAURI__ branch.
//
// The drawMasthead / drawWatermark / drawFooter helpers are deliberately generic
// (they take a title + period, not sales specifics) so the next report type can
// share them — extract to a src/pdf/reportChrome.ts when the 2nd report lands.
// ---------------------------------------------------------------------------
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatCurrency } from '../utils/currency';
import { notoSansRegularBase64, notoSansBoldBase64 } from './notoSansBase64';
import type { SalesReportData } from '../utils/salesReportAggregates';

const FONT_ID = 'NotoSans';
const M = 40; // page margin (pt)

function ensureFontsLoaded(doc: jsPDF): void {
  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansRegularBase64);
  doc.addFileToVFS('NotoSans-Bold.ttf', notoSansBoldBase64);
  doc.addFont('NotoSans-Regular.ttf', FONT_ID, 'normal');
  doc.addFont('NotoSans-Bold.ttf', FONT_ID, 'bold');
}

const MARKETPLACE_LABELS: Record<string, string> = {
  none: 'Direct sale',
  etsy: 'Etsy',
  etsy_offsite_ad: 'Etsy (offsite ad)',
  facebook_local: 'FB Marketplace (local)',
  facebook_shipped: 'FB Marketplace (shipped)',
  kijiji: 'Kijiji',
};
const marketplaceLabel = (mk: string): string => MARKETPLACE_LABELS[mk] ?? mk;

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// --- Reusable report chrome -------------------------------------------------

/** Faint, rotated brand mark behind the content — present but never in the way. */
function drawWatermark(doc: jsPDF, pageW: number, pageH: number): void {
  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(80);
  doc.setTextColor(237, 241, 247); // ~slate-100, very light
  doc.text('3DCoster', pageW / 2, pageH / 2 + 60, { align: 'center', angle: 28 });
  doc.setTextColor(15, 23, 42);
}

/** Dark branded masthead band: wordmark + tagline left, report title + period right. */
function drawMasthead(doc: jsPDF, pageW: number, title: string, period: string): void {
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageW, 78, 'F');

  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  doc.text('3DCoster', M, 36);
  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Know your true costs', M, 51);

  const rx = pageW - M;
  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(title.toUpperCase(), rx, 32, { align: 'right' });
  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(period, rx, 50, { align: 'right' });

  // brand accent line beneath the band
  doc.setFillColor(23, 150, 255);
  doc.rect(0, 78, pageW, 2.5, 'F');
  doc.setTextColor(15, 23, 42);
}

function drawFooter(doc: jsPDF, pageW: number, pageH: number): void {
  const y = pageH - 36;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.line(M, y, pageW - M, y);
  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('3DCoster · 3dcoster.com', M, y + 14);
  doc.text(`Generated ${todayLabel()}`, pageW - M, y + 14, { align: 'right' });
  doc.setTextColor(15, 23, 42);
}

// --- Document ---------------------------------------------------------------

function _buildDoc(data: SalesReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  ensureFontsLoaded(doc);
  doc.setFont(FONT_ID, 'normal');

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const money = (n: number | null): string => (n == null ? '—' : formatCurrency(n, data.userCurrency));

  drawWatermark(doc, pageW, pageH);
  drawMasthead(doc, pageW, 'Sales report', data.range.label);

  let y = 116;

  // Hero figures — the two numbers a tax/loan reader looks for first.
  const half = (pageW - M * 2) / 2;
  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('NET REVENUE', M, y);
  doc.text('PROFIT', M + half, y);

  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(25);
  doc.setTextColor(15, 23, 42);
  doc.text(money(data.netRevenue), M, y + 26);
  if (data.profit == null) doc.setTextColor(15, 23, 42);
  else if (data.profit >= 0) doc.setTextColor(21, 128, 61); // green
  else doc.setTextColor(190, 40, 40); // red
  doc.text(money(data.profit), M + half, y + 26);
  doc.setTextColor(15, 23, 42);
  y += 48;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.line(M, y, pageW - M, y);
  y += 20;

  // Secondary stats strip.
  const stats: [string, string][] = [
    ['Sales', String(data.saleCount)],
    ['Items', String(data.itemCount)],
    ['Gross', money(data.grossRevenue)],
    ['Fees', money(data.fees)],
    ['Cost', money(data.cost)],
  ];
  const sw = (pageW - M * 2) / stats.length;
  stats.forEach(([label, val], i) => {
    const x = M + i * sw;
    doc.setFont(FONT_ID, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(val, x, y + 15);
  });
  y += 40;

  // Revenue by marketplace.
  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Revenue by marketplace', M, y);
  autoTable(doc, {
    startY: y + 8,
    styles: { font: FONT_ID, fontSize: 9.5, cellPadding: 6, textColor: [15, 23, 42] },
    headStyles: { font: FONT_ID, fontStyle: 'bold', fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8.5 },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    head: [['Marketplace', 'Sales', 'Items', 'Gross', 'Fees', 'Net']],
    body: data.byMarketplace.length > 0
      ? data.byMarketplace.map(mk => [
          marketplaceLabel(mk.marketplace),
          String(mk.saleCount),
          String(mk.itemCount),
          money(mk.grossRevenue),
          money(mk.fees),
          money(mk.netRevenue),
        ])
      : [['No sales in this period', '', '', '', '', '']],
    columnStyles: {
      1: { halign: 'right' }, 2: { halign: 'right' },
      3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + 16;

  if (data.hasPartialData) {
    doc.setFont(FONT_ID, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Amounts shown as "—" could not be converted (no exchange rate available) and are omitted rather than estimated.',
      M, y, { maxWidth: pageW - M * 2 },
    );
    doc.setTextColor(15, 23, 42);
  }

  drawFooter(doc, pageW, pageH);
  return doc;
}

function buildFilename(data: SalesReportData): string {
  const slug = data.range.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `3dcoster-sales-report-${slug || 'export'}.pdf`;
}

/** Build the PDF and return its bytes. Used by tests (no disk I/O) + the Tauri branch. */
export async function generateSalesReportPdfBytes(data: SalesReportData): Promise<Uint8Array> {
  const doc = _buildDoc(data);
  return new Uint8Array(doc.output('arraybuffer'));
}

/**
 * Build the report PDF and save it. Web: browser download. Tauri: native save
 * dialog + writeFile (dynamic imports keep the Tauri SDK off the web bundle).
 */
export async function generateSalesReportPdf(data: SalesReportData): Promise<void> {
  const doc = _buildDoc(data);
  const filename = buildFilename(data);

  if (!__IS_TAURI__) {
    doc.save(filename);
    return;
  }

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
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().startsWith('forbidden path:')) {
      throw new Error(
        `Cannot save to "${savePath}" — this location is restricted. ` +
        `Try saving to Downloads, Documents, or Desktop instead.`,
      );
    }
    throw err;
  }
}
