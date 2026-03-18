import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const fmt2 = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br/>');

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function amountToWords(value: number): string {
  const units = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
    'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const belowThousand = (n: number): string => {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const left = h ? `${units[h]} Hundred` : '';
    if (!rest) return left;
    const right =
      rest < 20
        ? units[rest]
        : `${tens[Math.floor(rest / 10)]}${rest % 10 ? ` ${units[rest % 10]}` : ''}`;
    return `${left}${left ? ' ' : ''}${right}`;
  };

  const rupees = Math.floor(Math.abs(value));
  const paise = Math.round((Math.abs(value) - rupees) * 100);

  if (!rupees && !paise) return 'Indian Rupees Zero Only';

  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1_000);
  const rest = rupees % 1_000;

  const parts: string[] = [];
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));

  let result = `Indian Rupees ${parts.join(' ').trim()}`;
  if (paise) result += ` and ${belowThousand(paise)} paise`;
  return result + ' Only';
}

export type InvoiceDetail = {
  invoiceNumber: string;
  invoiceDate: string;
  deliveryNote?: string;
  paymentTerms?: string;
  otherReferences?: string;
  deliveryNoteDate?: string;
  buyersOrderNo?: string;
  dispatchDocNo?: string;
  dispatchedThrough?: string;
  destination?: string;
  termsOfDelivery?: string;
  seller?: {
    companyName?: string;
    fullAddress?: string;
    gstinUin?: string;
    stateName?: string;
    stateCode?: string;
    email?: string;
  };
  consignee?: {
    companyName?: string;
    address?: string;
    gstinUin?: string;
    stateName?: string;
    stateCode?: string;
  };
  buyer?: {
    companyName?: string;
    address?: string;
    gstinUin?: string;
    stateName?: string;
    stateCode?: string;
  };
  lineItems?: Array<{
    slNo?: number;
    description?: string;
    hsnSacCode?: string;
    gstRate?: number;
    quantity?: number;
    unit?: string;
    rate?: number;
    per?: string;
    taxableAmount?: number;
  }>;
  totals?: {
    totalQuantity?: number;
    totalUnit?: string;
    totalTaxableValue?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    roundOff?: number;
    totalInvoiceAmount?: number;
    totalInvoiceAmountWords?: string;
  };
  bankDetails?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    branchIfscCode?: string;
    swiftCode?: string;
  };
  companyPan?: string;
  remarks?: string;
  declarationText?: string;
  authorizedSignatory?: string;
};

const buildTaxGroups = (lineItems: InvoiceDetail['lineItems']) => {
  const grouped: Record<string, { hsnSac: string; rate: number; taxableValue: number; cgst: number; sgst: number }> = {};
  (lineItems || []).forEach((li) => {
    const rate = toNum(li.gstRate);
    const key = `${li.hsnSacCode || ''}-${rate}`;
    if (!grouped[key]) {
      grouped[key] = { hsnSac: li.hsnSacCode || '', rate, taxableValue: 0, cgst: 0, sgst: 0 };
    }
    const taxable = toNum(li.taxableAmount);
    grouped[key].taxableValue += taxable;
    grouped[key].cgst += (taxable * rate) / 200;
    grouped[key].sgst += (taxable * rate) / 200;
  });
  return Object.values(grouped);
};

const buildInvoiceHtml = (detail: InvoiceDetail): string => {
  const totals = {
    totalQuantity: toNum(detail.totals?.totalQuantity),
    totalUnit: detail.totals?.totalUnit || 'TON',
    totalTaxableValue: toNum(detail.totals?.totalTaxableValue),
    cgstAmount: toNum(detail.totals?.cgstAmount),
    sgstAmount: toNum(detail.totals?.sgstAmount),
    igstAmount: toNum(detail.totals?.igstAmount),
    roundOff: toNum(detail.totals?.roundOff),
    totalInvoiceAmount: toNum(detail.totals?.totalInvoiceAmount),
    totalInvoiceAmountWords:
      detail.totals?.totalInvoiceAmountWords ||
      amountToWords(toNum(detail.totals?.totalInvoiceAmount)),
  };

  const taxGroups = buildTaxGroups(detail.lineItems);
  const totalTaxAmt = totals.cgstAmount + totals.sgstAmount + totals.igstAmount;
  const taxAmountWords = amountToWords(totalTaxAmt);

  /* ── Line item rows ── */
  const lineRows = (detail.lineItems || [])
    .map(
      (li, idx) => `
      <tr>
        <td class="td c-center">${li.slNo ?? idx + 1}</td>
        <td class="td">${esc(li.description)}</td>
        <td class="td c-center">${esc(li.hsnSacCode)}</td>
        <td class="td c-center">${toNum(li.gstRate)}%</td>
        <td class="td c-right">${toNum(li.quantity).toLocaleString('en-IN', { maximumFractionDigits: 4 })}</td>
        <td class="td c-right">${fmt2(toNum(li.rate))}</td>
        <td class="td c-center">${esc(li.per || li.unit || 'TON')}</td>
        <td class="td c-right">${fmt2(toNum(li.taxableAmount))}</td>
      </tr>`
    )
    .join('');

  /* ── CGST / SGST sub-rows ── */
  const taxSubRows = taxGroups
    .map(
      (g) => `
      <tr>
        <td class="td"></td>
        <td class="td">CGST@${g.rate / 2}%</td>
        <td class="td"></td><td class="td"></td><td class="td"></td><td class="td"></td><td class="td"></td>
        <td class="td c-right">${fmt2(g.cgst)}</td>
      </tr>
      <tr>
        <td class="td"></td>
        <td class="td">SGST@${g.rate / 2}%</td>
        <td class="td"></td><td class="td"></td><td class="td"></td><td class="td"></td><td class="td"></td>
        <td class="td c-right">${fmt2(g.sgst)}</td>
      </tr>`
    )
    .join('');

  /* ── Round-off row ── */
  const roundOffRow =
    totals.roundOff !== 0
      ? `<tr>
          <td class="td"></td>
          <td class="td">Less : Rounding Off</td>
          <td class="td"></td><td class="td"></td><td class="td"></td><td class="td"></td><td class="td"></td>
          <td class="td c-right">${totals.roundOff > 0 ? '(+)' : '(-)'}${fmt2(Math.abs(totals.roundOff))}</td>
        </tr>`
      : '';

  /* ── Tax analysis rows ── */
  const taxRows = taxGroups
    .map(
      (g) => `
      <tr>
        <td class="td">${esc(g.hsnSac)}</td>
        <td class="td c-right">${fmt2(g.taxableValue)}</td>
        <td class="td c-right">${g.rate / 2}%</td>
        <td class="td c-right">${fmt2(g.cgst)}</td>
        <td class="td c-right">${g.rate / 2}%</td>
        <td class="td c-right">${fmt2(g.sgst)}</td>
        <td class="td c-right">${fmt2(g.cgst + g.sgst)}</td>
      </tr>`
    )
    .join('');

  return `
<div id="invoice-root" style="font-family:'Times New Roman',Times,serif;font-size:8px;color:#000;background:#fff;border:1.5px solid #000;width:100%;box-sizing:border-box;margin:0;padding:0;line-height:1.45;">

  <!-- Header -->
  <div style="text-align:center;font-weight:bold;font-size:10.5px;padding:5px 6px 4px;border-bottom:1px solid #000;letter-spacing:0.3px;">Tax Invoice</div>

  <!-- Seller | Invoice meta -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;">

    <!-- Seller -->
    <div style="padding:5px 6px;border-right:1px solid #000;">
      <p style="font-weight:bold;font-size:9px;margin:0 0 2px;">${esc(detail.seller?.companyName)}</p>
      <p style="margin:0;white-space:pre-wrap;font-size:8px;">${esc(detail.seller?.fullAddress)}</p>
      <p style="margin:2px 0 0;">GSTIN/UIN: <b>${esc(detail.seller?.gstinUin)}</b></p>
      <p style="margin:0;">State Name : ${esc(detail.seller?.stateName)}, Code : ${esc(detail.seller?.stateCode)}</p>
      ${detail.seller?.email ? `<p style="margin:0;">E-Mail : ${esc(detail.seller.email)}</p>` : ''}
    </div>

    <!-- Invoice meta table — mirrors PDF exactly -->
    <div style="padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          <tr>
            <td class="meta-head">Invoice No.</td>
            <td class="meta-val" style="font-weight:bold;">${esc(detail.invoiceNumber)}</td>
            <td class="meta-head">Delivery Note</td>
            <td class="meta-val">${esc(detail.deliveryNote ?? '')}</td>
          </tr>
          <tr>
            <td class="meta-head">Dated</td>
            <td class="meta-val">${esc(detail.invoiceDate)}</td>
            <td class="meta-head">Mode/Terms of Payment</td>
            <td class="meta-val">${esc(detail.paymentTerms ?? '')}</td>
          </tr>
          <tr>
            <td class="meta-head">Reference No. &amp; Date.</td>
            <td class="meta-val">${esc(detail.otherReferences ?? '')}</td>
            <td class="meta-head">Other References</td>
            <td class="meta-val"></td>
          </tr>
          <tr>
            <td class="meta-head">Buyer's Order No.</td>
            <td class="meta-val">${esc(detail.buyersOrderNo ?? '')}</td>
            <td class="meta-head">Dated</td>
            <td class="meta-val"></td>
          </tr>
          <tr>
            <td class="meta-head">Dispatch Doc No.</td>
            <td class="meta-val">${esc(detail.dispatchDocNo ?? '')}</td>
            <td class="meta-head">Delivery Note Date</td>
            <td class="meta-val">${esc(detail.deliveryNoteDate ?? '')}</td>
          </tr>
          <tr>
            <td class="meta-head">Dispatched through</td>
            <td class="meta-val">${esc(detail.dispatchedThrough ?? '')}</td>
            <td class="meta-head">Destination</td>
            <td class="meta-val">${esc(detail.destination ?? '')}</td>
          </tr>
          <tr>
            <td class="meta-head" colspan="2">Terms of Delivery</td>
            <td class="meta-val" colspan="2">${esc(detail.termsOfDelivery ?? '')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Consignee | Buyer -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;">
    <div style="padding:5px 6px;border-right:1px solid #000;">
      <p style="text-decoration:underline;font-weight:bold;margin:0 0 2px;font-size:8px;">Consignee (Ship to)</p>
      <p style="font-weight:bold;margin:0 0 1px;font-size:8.5px;">${esc(detail.consignee?.companyName || '')}</p>
      <p style="margin:0;white-space:pre-wrap;font-size:8px;">${esc(detail.consignee?.address ?? '')}</p>
      ${detail.consignee?.gstinUin ? `<p style="margin:2px 0 0;">GSTIN/UIN : <b>${esc(detail.consignee.gstinUin)}</b></p>` : ''}
      ${detail.consignee?.stateName ? `<p style="margin:0;">State Name : ${esc(detail.consignee.stateName)}, Code : ${esc(detail.consignee.stateCode ?? '')}</p>` : ''}
    </div>
    <div style="padding:5px 6px;">
      <p style="text-decoration:underline;font-weight:bold;margin:0 0 2px;font-size:8px;">Buyer (Bill to)</p>
      <p style="font-weight:bold;margin:0 0 1px;font-size:8.5px;">${esc(detail.buyer?.companyName || '')}</p>
      <p style="margin:0;white-space:pre-wrap;font-size:8px;">${esc(detail.buyer?.address ?? '')}</p>
      ${detail.buyer?.gstinUin ? `<p style="margin:2px 0 0;">GSTIN/UIN : <b>${esc(detail.buyer.gstinUin)}</b></p>` : ''}
      ${detail.buyer?.stateName ? `<p style="margin:0;">State Name : ${esc(detail.buyer.stateName)}, Code : ${esc(detail.buyer.stateCode ?? '')}</p>` : ''}
    </div>
  </div>

  <!-- Line items table -->
  <table style="width:100%;border-collapse:collapse;border-bottom:1px solid #000;">
    <thead>
      <tr>
        <th class="th c-center" style="width:22px;">Sl<br/>No.</th>
        <th class="th" style="width:160px;">Description of<br/>Services</th>
        <th class="th c-center" style="width:45px;">HSN/SAC</th>
        <th class="th c-center" style="width:32px;">GST<br/>Rate</th>
        <th class="th c-right" style="width:55px;">Quantity</th>
        <th class="th c-right" style="width:55px;">Rate</th>
        <th class="th c-center" style="width:32px;">per</th>
        <th class="th c-right" style="width:70px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
      ${taxSubRows}
      ${roundOffRow}
      <tr>
        <td class="td"></td>
        <td class="td" style="font-weight:bold;">Total</td>
        <td class="td"></td>
        <td class="td"></td>
        <td class="td c-right" style="font-weight:bold;">${totals.totalQuantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })} ${esc(totals.totalUnit)}</td>
        <td class="td"></td>
        <td class="td"></td>
        <td class="td c-right" style="font-weight:bold;">Rs. ${fmt2(totals.totalInvoiceAmount)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Amount in words -->
  <div style="padding:3px 6px;border-bottom:1px solid #000;display:flex;justify-content:space-between;align-items:baseline;font-size:8px;">
    <span>Amount Chargeable (in words)<br/><b>${esc(totals.totalInvoiceAmountWords)}</b></span>
    <span style="font-weight:bold;font-size:8px;white-space:nowrap;">E. &amp; O.E</span>
  </div>

  <!-- Tax analysis -->
  <div style="padding:4px 6px;border-bottom:1px solid #000;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th class="th" style="font-size:8px;">HSN/SAC</th>
          <th class="th c-right" style="font-size:8px;">Total Taxable<br/>Value</th>
          <th class="th c-right" style="font-size:8px;">CGST<br/>Rate</th>
          <th class="th c-right" style="font-size:8px;">CGST<br/>Amount</th>
          <th class="th c-right" style="font-size:8px;">SGST/UTGST<br/>Rate</th>
          <th class="th c-right" style="font-size:8px;">SGST/UTGST<br/>Amount</th>
          <th class="th c-right" style="font-size:8px;">Tax<br/>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${taxRows}
        <tr style="font-weight:bold;">
          <td class="td" style="font-size:8px;">Total</td>
          <td class="td c-right" style="font-size:8px;">${fmt2(totals.totalTaxableValue)}</td>
          <td class="td"></td>
          <td class="td c-right" style="font-size:8px;">${fmt2(totals.cgstAmount)}</td>
          <td class="td"></td>
          <td class="td c-right" style="font-size:8px;">${fmt2(totals.sgstAmount)}</td>
          <td class="td c-right" style="font-size:8px;">${fmt2(totalTaxAmt)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Tax amount in words -->
  <div style="padding:3px 6px;border-bottom:1px solid #000;font-size:8px;">
    Tax Amount (in words) : <b>${esc(taxAmountWords)}</b>
  </div>

  <!-- Remarks | Declaration | Bank | Signatory -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;">

    <!-- Left: Remarks + Declaration + Bank -->
    <div style="padding:5px 6px;border-right:1px solid #000;font-size:8px;">
      ${detail.remarks ? `<p style="margin:0 0 4px;"><b>Remarks:</b><br/>${esc(detail.remarks)}</p>` : ''}

      ${detail.companyPan ? `<p style="margin:4px 0 0;"><b>Company's PAN :</b> ${esc(detail.companyPan)}</p>` : ''}

      <div style="margin-top:6px;border-top:1px solid #ccc;padding-top:4px;">
        <p style="font-weight:bold;margin:0 0 2px;font-size:8px;">Declaration</p>
        <p style="margin:0;font-size:7.5px;">${esc(detail.declarationText || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.')}</p>
      </div>

      <div style="margin-top:6px;border-top:1px solid #ccc;padding-top:4px;">
        <p style="font-weight:bold;margin:0 0 3px;font-size:8px;">Company's Bank Details</p>
        <p style="margin:0;">A/c Holder's Name : <b>${esc(detail.bankDetails?.accountHolderName ?? '')}</b></p>
        <p style="margin:0;">Bank Name : ${esc(detail.bankDetails?.bankName ?? '')}</p>
        <p style="margin:0;">A/c No. : <b>${esc(detail.bankDetails?.accountNumber ?? '')}</b></p>
        <p style="margin:0;">Branch &amp; IFS Code: ${esc(detail.bankDetails?.branchIfscCode ?? '')}</p>
        ${detail.bankDetails?.swiftCode ? `<p style="margin:0;">SWIFT Code : ${esc(detail.bankDetails.swiftCode)}</p>` : ''}
      </div>
    </div>

    <!-- Right: Authorised signatory -->
    <div style="padding:5px 6px;display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;font-size:8px;min-height:90px;">
      <p style="margin:0;font-weight:bold;">for ${esc(detail.seller?.companyName)}</p>
      <div style="text-align:center;margin-top:32px;">
        <p style="margin:0;border-top:1px solid #000;padding-top:3px;min-width:140px;font-size:8px;">
          ${esc(detail.authorizedSignatory || 'Authorised Signatory')}
        </p>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:3px 6px;font-size:7.5px;">This is a Computer Generated Invoice</div>

</div>`;
};

/* ─────────────────────────────────────────────────────── */
/*  CSS shared between host injection and external use     */
/* ─────────────────────────────────────────────────────── */
const INVOICE_STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  body, html { margin: 0; padding: 0; }
  #invoice-root table { border-collapse: collapse; width: 100%; }
  #invoice-root .th {
    border: 1px solid #000;
    padding: 3px 4px;
    font-weight: bold;
    text-align: left;
    vertical-align: bottom;
    font-size: 8px;
    line-height: 1.4;
    background: #fff;
  }
  #invoice-root .td {
    border: 1px solid #000;
    padding: 2px 4px;
    text-align: left;
    vertical-align: top;
    font-size: 8px;
    line-height: 1.45;
  }
  #invoice-root .meta-head {
    border: 1px solid #000;
    padding: 2px 4px;
    font-weight: bold;
    font-size: 8px;
    line-height: 1.4;
    vertical-align: top;
    width: 25%;
  }
  #invoice-root .meta-val {
    border: 1px solid #000;
    padding: 2px 4px;
    font-size: 8px;
    line-height: 1.4;
    vertical-align: top;
    width: 25%;
  }
  #invoice-root .c-right  { text-align: right; }
  #invoice-root .c-center { text-align: center; }
  #invoice-root p { margin: 0; line-height: 1.45; }
`;

/* ─────────────────────────────────────────────────────── */
/*  PDF export                                             */
/* ─────────────────────────────────────────────────────── */
export async function downloadInvoicePreviewPdf(detail: InvoiceDetail): Promise<void> {
  const MARGIN_MM = 10;
  const A4_W_MM = 210;
  const A4_H_MM = 297;
  const PRINTABLE_W_MM = A4_W_MM - MARGIN_MM * 2;   // 190 mm
  const MM_TO_PX = 3.7795275591;
  const RENDER_W_PX = Math.round(PRINTABLE_W_MM * MM_TO_PX); // ~718 px

  const host = document.createElement('div');
  host.style.cssText = `
    position: fixed;
    left: -99999px;
    top: 0;
    width: ${RENDER_W_PX}px;
    background: #fff;
    overflow: visible;
  `;
  host.innerHTML = `<style>${INVOICE_STYLES}</style>${buildInvoiceHtml(detail)}`;
  document.body.appendChild(host);

  const root = host.querySelector<HTMLElement>('#invoice-root');
  if (!root) {
    document.body.removeChild(host);
    throw new Error('Unable to render invoice root element');
  }

  root.style.width = `${RENDER_W_PX}px`;
  root.style.maxWidth = `${RENDER_W_PX}px`;

  try {
    const canvas = await html2canvas(root, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: true,
      windowWidth: RENDER_W_PX,
    });

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    const pxToMm = PRINTABLE_W_MM / canvasW;
    const totalHeightMm = canvasH * pxToMm;
    const printableHMm = A4_H_MM - MARGIN_MM * 2;

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

    let remainingMm = totalHeightMm;
    let srcYPx = 0;
    let isFirstPage = true;

    while (remainingMm > 0) {
      if (!isFirstPage) doc.addPage();

      const sliceHeightMm = Math.min(remainingMm, printableHMm);
      const sliceHeightPx = Math.round(sliceHeightMm / pxToMm);

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvasW;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, srcYPx, canvasW, sliceHeightPx, 0, 0, canvasW, sliceHeightPx);

      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(sliceData, 'JPEG', MARGIN_MM, MARGIN_MM, PRINTABLE_W_MM, sliceHeightMm);

      srcYPx += sliceHeightPx;
      remainingMm -= sliceHeightMm;
      isFirstPage = false;
    }

    doc.save(`${detail.invoiceNumber}.pdf`);
  } finally {
    document.body.removeChild(host);
  }
}

/* ─────────────────────────────────────────────────────── */
/*  Helper: get raw HTML string (for preview iframes etc.) */
/* ─────────────────────────────────────────────────────── */
export function getInvoiceHtml(detail: InvoiceDetail): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${detail.invoiceNumber}</title>
  <style>
    body { margin: 16px; background: #e8e8e8; font-family: 'Times New Roman', serif; }
    .page { max-width: 740px; margin: 0 auto; background: #fff; }
    ${INVOICE_STYLES}
  </style>
</head>
<body>
  <div class="page">${buildInvoiceHtml(detail)}</div>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────── */
/*  Example usage / default export                        */
/* ─────────────────────────────────────────────────────── */
export const sampleInvoice: InvoiceDetail = {
  invoiceNumber: 'RIC/S/25-26/0284',
  invoiceDate: '2-Feb-26',
  seller: {
    companyName: 'RUNGTA INDUSTRIAL CORPORATION',
    fullAddress: 'F-542, ROAD No.6-D,\nV.K.I. AREA\nJAIPUR (Raj.)\nRajasthan - 302013, India',
    gstinUin: '08AABFR8172R1ZE',
    stateName: 'Rajasthan',
    stateCode: '08',
    email: 'rungtapk@gmail.com',
  },
  consignee: {
    companyName: 'Haryana Iron',
    address: '18-20, Arihant Towers,\nMalhotra Nagar, Road No.1,\nV.K.I. Area,\nJaipur\nRajasthan - 302013, India',
    gstinUin: '08ATRPA1261D1Z0',
    stateName: 'Rajasthan',
    stateCode: '08',
  },
  buyer: {
    companyName: 'Haryana Iron',
    address: '18-20, Arihant Towers,\nMalhotra Nagar, Road No.1,\nV.K.I. Area,\nJaipur\nRajasthan - 302013, India',
    gstinUin: '08ATRPA1261D1Z0',
    stateName: 'Rajasthan',
    stateCode: '08',
  },
  lineItems: [
    {
      slNo: 1,
      description: 'Storage & Handling',
      hsnSacCode: '9988',
      gstRate: 18,
      quantity: 340.73,
      unit: 'TON',
      per: 'TON',
      rate: 150.0,
      taxableAmount: 51109.50,
    },
  ],
  totals: {
    totalQuantity: 340.73,
    totalUnit: 'TON',
    totalTaxableValue: 51109.50,
    cgstAmount: 4599.86,
    sgstAmount: 4599.86,
    igstAmount: 0,
    roundOff: -0.22,
    totalInvoiceAmount: 60309.00,
    totalInvoiceAmountWords: 'Indian Rupees Sixty Thousand Three Hundred Nine Only',
  },
  bankDetails: {
    accountHolderName: 'RUNGTA INDUSTRIAL CORPORATION',
    bankName: 'HDFC Bank',
    accountNumber: '00542000011197',
    branchIfscCode: 'Vishwakarma Ind Area, Jaipur & HDFC0003774',
    swiftCode: '',
  },
  companyPan: 'AABFR8172R',
  remarks: 'Job Work for the period 1-1-26 to 31-1-26',
  declarationText:
    'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
  authorizedSignatory: 'Authorised Signatory',
};

export default { downloadInvoicePreviewPdf, getInvoiceHtml, sampleInvoice };