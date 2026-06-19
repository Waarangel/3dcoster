// ---------------------------------------------------------------------------
// Sales report PDF (v1.8, feature #33). The render() half of the
// aggregate()->render() split: consumes a SalesReportData (from
// computeSalesReport) and knows nothing about how it was produced — so a future
// Pro scheduled/emailed/branded report reuses the same input. Mirrors
// generateQuotePdf.ts: lives in src/pdf/ (only ever dynamically imported, kept
// off the web bundle by the assert-no-static-pdf-import CI gate), loads the
// bundled Noto fonts on every instance, and saves via the same web/__IS_TAURI__
// branch.
// ---------------------------------------------------------------------------
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatCurrency } from '../utils/currency';
import { notoSansRegularBase64, notoSansBoldBase64 } from './notoSansBase64';
import type { SalesReportData } from '../utils/salesReportAggregates';

const MARGIN_LEFT = 40;
const MARGIN_RIGHT = 40;
const FONT_ID = 'NotoSans';

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

function _buildDoc(data: SalesReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  ensureFontsLoaded(doc);
  doc.setFont(FONT_ID, 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  const rightX = pageWidth - MARGIN_RIGHT;
  const money = (n: number | null): string => (n == null ? '—' : formatCurrency(n, data.userCurrency));

  // Header
  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(18);
  doc.text('3DCoster', MARGIN_LEFT, 50);
  doc.setFontSize(13);
  doc.text('SALES REPORT', rightX, 42, { align: 'right' });
  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(data.range.label, rightX, 58, { align: 'right' });
  doc.setTextColor(0);
  doc.setDrawColor(220);
  doc.line(MARGIN_LEFT, 70, rightX, 70);

  // Summary
  let y = 96;
  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(12);
  doc.text('Summary', MARGIN_LEFT, y);
  autoTable(doc, {
    startY: y + 8,
    theme: 'plain',
    styles: { font: FONT_ID, fontSize: 10, cellPadding: 4 },
    body: [
      ['Sales', String(data.saleCount)],
      ['Items sold', String(data.itemCount)],
      ['Gross revenue', money(data.grossRevenue)],
      ['Marketplace fees', money(data.fees)],
      ['Net revenue', money(data.netRevenue)],
      ['Cost', money(data.cost)],
      ['Profit', money(data.profit)],
    ],
    columnStyles: { 0: { textColor: 90 }, 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
  });
  y = doc.lastAutoTable.finalY + 26;

  // Revenue by marketplace
  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(12);
  doc.text('Revenue by marketplace', MARGIN_LEFT, y);
  autoTable(doc, {
    startY: y + 8,
    styles: { font: FONT_ID, fontSize: 9, cellPadding: 5 },
    headStyles: { font: FONT_ID, fontStyle: 'bold', fillColor: [30, 41, 59] },
    head: [['Marketplace', 'Sales', 'Items', 'Gross', 'Fees', 'Net']],
    body: data.byMarketplace.length > 0
      ? data.byMarketplace.map(m => [
          marketplaceLabel(m.marketplace),
          String(m.saleCount),
          String(m.itemCount),
          money(m.grossRevenue),
          money(m.fees),
          money(m.netRevenue),
        ])
      : [['No sales in this period', '', '', '', '', '']],
    columnStyles: {
      1: { halign: 'right' }, 2: { halign: 'right' },
      3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' },
    },
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
  });
  y = doc.lastAutoTable.finalY + 18;

  if (data.hasPartialData) {
    doc.setFont(FONT_ID, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      'Some amounts are shown as "—" because an exchange rate was unavailable; those totals are omitted rather than guessed.',
      MARGIN_LEFT, y, { maxWidth: pageWidth - MARGIN_LEFT - MARGIN_RIGHT },
    );
    doc.setTextColor(0);
  }

  // Footer
  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Made with 3DCoster — 3dcoster.com', MARGIN_LEFT, doc.internal.pageSize.getHeight() - 30);
  doc.setTextColor(0);

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
