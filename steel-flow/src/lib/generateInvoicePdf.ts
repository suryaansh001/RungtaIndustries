// ─────────────────────────────────────────────────────────
//  Invoice PDF Generator (jsPDF + autoTable)
//  Matches the dark-blue brand of the app.
// ─────────────────────────────────────────────────────────
import jsPDF, { GState } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, BillingSettings } from './billing-data';

const BRAND  = '#1F4E79';
const LIGHT  = '#E8F0FE';
const GREY   = '#666666';
const BLACK  = '#111111';
const WHITE  = '#FFFFFF';
const GREEN  = '#22c55e';
const AMBER  = '#f59e0b';
const RED    = '#ef4444';

const fmtMoney = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
};

const statusColor = (status: string): string => {
  switch (status) {
    case 'paid':           return GREEN;
    case 'overdue':        return RED;
    case 'partially_paid': return AMBER;
    case 'sent':           return '#6366F1';
    case 'generated':      return '#0EA5E9';
    default:               return GREY;
  }
};

export function generateInvoicePdf(
  invoice: Invoice,
  settings?: Partial<BillingSettings>,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210; // page width mm
  const ML = 14;  // margin left
  const MR = 196; // margin right edge
  const CW = MR - ML; // content width

  // ── Header band ──────────────────────────────────────────
  doc.setFillColor(BRAND);
  doc.rect(0, 0, PW, 28, 'F');

  // Company name
  doc.setTextColor(WHITE);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(settings?.companyName ?? 'Rungta Industrial Corporation', ML, 12);

  // Company address
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cce0f5');
  const addr = settings?.companyAddress ?? '';
  if (addr) doc.text(addr, ML, 18, { maxWidth: 110 });

  // "INVOICE" word right-aligned
  doc.setTextColor('#aacce8');
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', MR, 18, { align: 'right' });

  // ── Invoice meta strip (number / dates) ──────────────────
  let y = 36;
  // Left: Invoice number large
  doc.setTextColor(BRAND);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoiceNumber, ML, y);

  // Right: key-value pairs
  const meta = [
    ['Issue Date',  fmtDate(invoice.invoiceDate)],
    ['Due Date',    fmtDate(invoice.dueDate)],
    ['Terms',       invoice.paymentTerms || '—'],
  ];
  doc.setFontSize(8);
  meta.forEach(([label, value], i) => {
    const row = y - 4 + i * 6;
    doc.setTextColor(GREY);
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', 128, row);
    doc.setTextColor(BLACK);
    doc.setFont('helvetica', 'normal');
    doc.text(value, MR, row, { align: 'right' });
  });

  // Status pill
  const sc = statusColor(invoice.status);
  doc.setFillColor(sc);
  doc.roundedRect(ML, y + 4, 28, 7, 2, 2, 'F');
  doc.setTextColor(WHITE);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status.replace('_', ' ').toUpperCase(), ML + 14, y + 9, { align: 'center' });

  // ── Divider ───────────────────────────────────────────────
  y += 18;
  doc.setDrawColor('#e0e0e0');
  doc.setLineWidth(0.3);
  doc.line(ML, y, MR, y);

  // ── Bill To section ───────────────────────────────────────
  y += 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(GREY);
  doc.text('BILL TO', ML, y);
  y += 5;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(BLACK);
  doc.text(invoice.clientName, ML, y);
  y += 5;

  // ── Divider ───────────────────────────────────────────────
  doc.setDrawColor('#e0e0e0');
  doc.line(ML, y, MR, y);
  y += 4;

  // ── Line Items Table ──────────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Qty / Kg', 'Rate (₹)', 'Amount (₹)']],
    body: invoice.lineItems.map((li, idx) => [
      idx + 1,
      li.description,
      li.quantity.toLocaleString('en-IN'),
      li.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      li.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: BLACK,
      lineColor: [224, 224, 224],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: BRAND as unknown as [number, number, number],
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      1: { cellWidth: 90 },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: ML, right: PW - MR },
  });

  // ── Totals block ──────────────────────────────────────────
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = (doc.lastAutoTable?.finalY ?? y) + 6;

  const totalsX = 128;
  const valX = MR;

  const drawRow = (label: string, value: string, bold = false, highlight = false) => {
    if (highlight) {
      doc.setFillColor(BRAND);
      doc.rect(totalsX - 2, y - 4, MR - totalsX + 4, 9, 'F');
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(highlight ? WHITE : bold ? BLACK : GREY);
    doc.text(label, totalsX, y);
    doc.text(value, valX, y, { align: 'right' });
    y += 7;
  };

  drawRow('Subtotal', fmtMoney(invoice.subtotal));
  drawRow(`GST (${invoice.gstPercent}%)`, fmtMoney(invoice.gstAmount));
  if (invoice.roundOff !== 0) {
    drawRow('Round Off', (invoice.roundOff > 0 ? '+' : '') + fmtMoney(invoice.roundOff));
  }
  // Total line
  doc.setDrawColor('#cccccc');
  doc.setLineWidth(0.3);
  doc.line(totalsX, y - 1, MR, y - 1);
  y += 1;
  drawRow('Grand Total', fmtMoney(invoice.total), true, true);
  y += 2;

  // Paid / Outstanding
  if (invoice.paid > 0) {
    drawRow('Amount Paid', fmtMoney(invoice.paid));
  }
  if (invoice.outstanding !== invoice.total) {
    doc.setTextColor(invoice.outstanding > 0 ? AMBER : GREEN);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Outstanding', totalsX, y);
    doc.text(fmtMoney(invoice.outstanding), valX, y, { align: 'right' });
    y += 7;
    doc.setTextColor(BLACK);
  }

  // ── Bank details block ────────────────────────────────────
  if (settings?.bankDetails) {
    y += 2;
    doc.setDrawColor('#e0e0e0');
    doc.line(ML, y, MR, y);
    y += 5;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(GREY);
    doc.text('BANK DETAILS', ML, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(BLACK);
    doc.text(settings.bankDetails, ML, y, { maxWidth: CW });
    y += 8;
  }

  // ── Notes ─────────────────────────────────────────────────
  if (invoice.notes) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(GREY);
    doc.text(`Note: ${invoice.notes}`, ML, y, { maxWidth: CW });
    y += 8;
  }

  // ── Footer band ───────────────────────────────────────────
  const footerY = 282;
  doc.setFillColor(BRAND);
  doc.rect(0, footerY, PW, 15, 'F');
  doc.setTextColor('#aacce8');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');

  const footerLeft = settings?.footerNotes ?? 'Thank you for your business!';
  doc.text(footerLeft, ML, footerY + 6, { maxWidth: 130 });
  doc.text('Computer generated — no signature required', MR, footerY + 6, { align: 'right' });
  doc.setTextColor('#ffffff');
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, ML, footerY + 11);

  // ── Light watermark for PAID ──────────────────────────────
  if (invoice.status === 'paid') {
    doc.setTextColor(GREEN);
    doc.setFontSize(60);
    doc.setFont('helvetica', 'bold');
    doc.setGState(new GState({ opacity: 0.08 }));
    doc.text('PAID', PW / 2, 160, { align: 'center', angle: 30 });
    doc.setGState(new GState({ opacity: 1 }));
  }

  doc.save(`${invoice.invoiceNumber}.pdf`);
}
