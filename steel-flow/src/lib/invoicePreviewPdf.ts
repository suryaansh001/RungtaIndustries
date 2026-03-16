import jsPDF from 'jspdf';

const fmt2 = (n: number) => Number(n || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;')
  .replace(/'/g, '&#39;')
  .replace(/\n/g, '<br/>');

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function amountToWords(value: number) {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const belowThousand = (n: number): string => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    const left = hundred ? `${units[hundred]} Hundred` : '';
    if (!rest) return left;
    const right = rest < 20 ? units[rest] : `${tens[Math.floor(rest / 10)]}${rest % 10 ? ` ${units[rest % 10]}` : ''}`;
    return `${left}${left ? ' ' : ''}${right}`;
  };

  const n = Math.floor(Math.abs(value));
  if (!n) return 'Indian Rupees Zero Only';

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));

  return `Indian Rupees ${parts.join(' ').trim()} Only`;
}

type InvoiceDetail = {
  invoiceNumber: string;
  invoiceDate: string;
  deliveryNote?: string;
  paymentTerms?: string;
  referenceNoDate?: string;
  destination?: string;
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
    taxableAmount?: number;
  }>;
  totals?: {
    totalQuantity?: number;
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
    const cgst = (taxable * rate) / 200;
    const sgst = (taxable * rate) / 200;
    grouped[key].taxableValue += taxable;
    grouped[key].cgst += cgst;
    grouped[key].sgst += sgst;
  });
  return Object.values(grouped);
};

const buildInvoiceHtml = (detail: InvoiceDetail) => {
  const totals = {
    totalQuantity: toNum(detail.totals?.totalQuantity),
    totalTaxableValue: toNum(detail.totals?.totalTaxableValue),
    cgstAmount: toNum(detail.totals?.cgstAmount),
    sgstAmount: toNum(detail.totals?.sgstAmount),
    igstAmount: toNum(detail.totals?.igstAmount),
    roundOff: toNum(detail.totals?.roundOff),
    totalInvoiceAmount: toNum(detail.totals?.totalInvoiceAmount),
    totalInvoiceAmountWords: detail.totals?.totalInvoiceAmountWords || amountToWords(toNum(detail.totals?.totalInvoiceAmount)),
  };

  const taxGroups = buildTaxGroups(detail.lineItems);
  const taxAmountWords = amountToWords(totals.cgstAmount + totals.sgstAmount + totals.igstAmount);

  const lineRows = (detail.lineItems || []).map((li, idx) => `
    <tr>
      <td class="c-center">${li.slNo ?? idx + 1}</td>
      <td>${esc(li.description)}</td>
      <td class="c-center">${esc(li.hsnSacCode)}</td>
      <td class="c-right">${toNum(li.gstRate)}%</td>
      <td class="c-right">${toNum(li.quantity).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
      <td class="c-right">${fmt2(toNum(li.rate))}</td>
      <td class="c-center">${esc(li.unit || 'TON')}</td>
      <td class="c-right">${fmt2(toNum(li.taxableAmount))}</td>
    </tr>
  `).join('');

  const taxSubRows = taxGroups.map((g) => `
    <tr>
      <td></td><td>CGST@${g.rate / 2}%</td><td></td><td></td><td></td><td></td><td></td><td class="c-right">${fmt2(g.cgst)}</td>
    </tr>
    <tr>
      <td></td><td>SGST@${g.rate / 2}%</td><td></td><td></td><td></td><td></td><td></td><td class="c-right">${fmt2(g.sgst)}</td>
    </tr>
  `).join('');

  const roundOffRow = totals.roundOff !== 0 ? `
    <tr>
      <td></td><td>Rounding Off</td><td></td><td></td><td></td><td></td><td></td>
      <td class="c-right">${totals.roundOff > 0 ? '+' : ''}${fmt2(totals.roundOff)}</td>
    </tr>
  ` : '';

  const taxRows = taxGroups.map((g) => `
    <tr>
      <td>${esc(g.hsnSac)}</td>
      <td class="c-right">${fmt2(g.taxableValue)}</td>
      <td class="c-right">${g.rate / 2}%</td>
      <td class="c-right">${fmt2(g.cgst)}</td>
      <td class="c-right">${g.rate / 2}%</td>
      <td class="c-right">${fmt2(g.sgst)}</td>
      <td class="c-right">${fmt2(g.cgst + g.sgst)}</td>
    </tr>
  `).join('');

  return `
  <div id="invoice-root" style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; border: 1px solid #000; width: 794px; box-sizing: border-box;">
    <div style="text-align:center;font-weight:bold;font-size:15px;padding:6px 8px;border-bottom:1px solid #000;letter-spacing:1px;">Tax Invoice</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;">
      <div style="padding:8px;border-right:1px solid #000;">
        <p style="font-weight:bold;font-size:13px;margin:0 0 3px 0;">${esc(detail.seller?.companyName)}</p>
        <p style="margin:0;line-height:1.5;">${esc(detail.seller?.fullAddress)}</p>
        <p style="margin:4px 0 0 0;">GSTIN/UIN: <strong>${esc(detail.seller?.gstinUin)}</strong></p>
        <p style="margin:0;">State Name: ${esc(detail.seller?.stateName)}, <strong>Code: ${esc(detail.seller?.stateCode)}</strong></p>
        ${detail.seller?.email ? `<p style="margin:0;">E-Mail: ${esc(detail.seller.email)}</p>` : ''}
        ${detail.companyPan ? `<p style="margin:0;">PAN No.: ${esc(detail.companyPan)}</p>` : ''}
      </div>
      <div style="padding:8px;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <tbody>
            <tr><td class="cell-head">Invoice No.</td><td class="cell-value" style="font-weight:600;">${esc(detail.invoiceNumber)}</td></tr>
            <tr><td class="cell-head">Dated</td><td class="cell-value">${esc(detail.invoiceDate)}</td></tr>
            <tr><td class="cell-head">Delivery Note</td><td class="cell-value">${esc(detail.deliveryNote)}</td></tr>
            <tr><td class="cell-head">Mode/Terms of Payment</td><td class="cell-value">${esc(detail.paymentTerms)}</td></tr>
            <tr><td class="cell-head">Reference No. &amp; Date</td><td class="cell-value">${esc(detail.referenceNoDate)}</td></tr>
            <tr><td class="cell-head">Dispatched through</td><td class="cell-value">${esc(detail.destination)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;">
      <div style="padding:8px;border-right:1px solid #000;">
        <p style="font-weight:600;margin:0 0 3px 0;text-decoration:underline;">Consignee (Ship to)</p>
        <p style="font-weight:bold;margin:0;">${esc(detail.consignee?.companyName || '-')}</p>
        <p style="margin:0;line-height:1.5;">${esc(detail.consignee?.address)}</p>
        ${detail.consignee?.gstinUin ? `<p style="margin:0;">GSTIN/UIN: ${esc(detail.consignee.gstinUin)}</p>` : ''}
        ${detail.consignee?.stateName ? `<p style="margin:0;">State Name: ${esc(detail.consignee.stateName)}${detail.consignee.stateCode ? `, Code: ${esc(detail.consignee.stateCode)}` : ''}</p>` : ''}
      </div>
      <div style="padding:8px;">
        <p style="font-weight:600;margin:0 0 3px 0;text-decoration:underline;">Buyer (Bill to)</p>
        <p style="font-weight:bold;margin:0;">${esc(detail.buyer?.companyName || '-')}</p>
        <p style="margin:0;line-height:1.5;">${esc(detail.buyer?.address)}</p>
        ${detail.buyer?.gstinUin ? `<p style="margin:0;">GSTIN/UIN: ${esc(detail.buyer.gstinUin)}</p>` : ''}
        ${detail.buyer?.stateName ? `<p style="margin:0;">State Name: ${esc(detail.buyer.stateName)}${detail.buyer.stateCode ? `, Code: ${esc(detail.buyer.stateCode)}` : ''}</p>` : ''}
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;border-bottom:1px solid #000;">
      <thead>
        <tr style="background:#f0f0f0;">
          <th class="th c-center" style="width:32px;">Sl No.</th>
          <th class="th">Description of Services</th>
          <th class="th c-center" style="width:64px;">HSN/SAC</th>
          <th class="th c-right" style="width:58px;">GST Rate</th>
          <th class="th c-right" style="width:72px;">Quantity</th>
          <th class="th c-right" style="width:80px;">Rate</th>
          <th class="th c-center" style="width:42px;">Per</th>
          <th class="th c-right" style="width:90px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows}
        ${taxSubRows}
        ${roundOffRow}
        <tr>
          <td class="td"></td>
          <td class="td" style="font-weight:700;">Total</td>
          <td class="td"></td>
          <td class="td"></td>
          <td class="td c-right" style="font-weight:700;">${totals.totalQuantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
          <td class="td"></td>
          <td class="td"></td>
          <td class="td c-right" style="font-weight:700;">&#8377;${fmt2(totals.totalInvoiceAmount)}</td>
        </tr>
      </tbody>
    </table>

    <div style="padding:6px 8px;border-bottom:1px solid #000;display:flex;justify-content:space-between;align-items:baseline;">
      <span><strong>Amount Chargeable (in words):</strong> <em>${esc(totals.totalInvoiceAmountWords)}</em></span>
      <span style="font-weight:600;white-space:nowrap;margin-left:8px;">E. &amp; O.E</span>
    </div>

    <div style="padding:6px 8px;border-bottom:1px solid #000;">
      <p style="font-weight:700;margin:0 0 4px 0;">Tax Analysis</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th class="th">HSN/SAC</th>
            <th class="th c-right">Taxable Value</th>
            <th class="th c-right">Central Tax Rate</th>
            <th class="th c-right">Central Tax Amt</th>
            <th class="th c-right">State Tax Rate</th>
            <th class="th c-right">State Tax Amt</th>
            <th class="th c-right">Total Tax Amt</th>
          </tr>
        </thead>
        <tbody>
          ${taxRows}
          <tr style="font-weight:700;">
            <td class="td">Total</td>
            <td class="td c-right">${fmt2(totals.totalTaxableValue)}</td>
            <td class="td"></td>
            <td class="td c-right">${fmt2(totals.cgstAmount)}</td>
            <td class="td"></td>
            <td class="td c-right">${fmt2(totals.sgstAmount)}</td>
            <td class="td c-right">${fmt2(totals.cgstAmount + totals.sgstAmount + totals.igstAmount)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="padding:6px 8px;border-bottom:1px solid #000;">
      <strong>Tax Amount (in words):</strong> <em>${esc(taxAmountWords)}</em>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;">
      <div style="padding:8px;border-right:1px solid #000;">
        <p style="font-weight:700;margin:0 0 5px 0;">Company's Bank Details</p>
        <p style="margin:0;">A/c Holder Name: <strong>${esc(detail.bankDetails?.accountHolderName)}</strong></p>
        <p style="margin:0;">Bank Name: ${esc(detail.bankDetails?.bankName)}</p>
        <p style="margin:0;">A/c No.: <strong>${esc(detail.bankDetails?.accountNumber)}</strong></p>
        <p style="margin:0;">Branch &amp; IFSC Code: ${esc(detail.bankDetails?.branchIfscCode)}</p>
        ${detail.bankDetails?.swiftCode ? `<p style="margin:0;">SWIFT: ${esc(detail.bankDetails.swiftCode)}</p>` : ''}
        ${detail.remarks ? `<p style="margin:6px 0 0 0;"><strong>Remarks:</strong> ${esc(detail.remarks)}</p>` : ''}
        ${detail.declarationText ? `<p style="margin:8px 0 0 0;font-size:10px;color:#444;line-height:1.4;">${esc(detail.declarationText)}</p>` : ''}
      </div>
      <div style="padding:8px;display:flex;flex-direction:column;justify-content:space-between;min-height:110px;">
        <p style="text-align:right;font-weight:700;margin:0;">for ${esc(detail.seller?.companyName)}</p>
        <div style="text-align:right;margin-top:40px;">
          <div style="display:inline-block;border-top:1px solid #000;padding-top:4px;min-width:140px;">
            <p style="font-weight:600;margin:0;">${esc(detail.authorizedSignatory || 'Authorised Signatory')}</p>
            <p style="font-size:10px;margin:0;">Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>

    <div style="text-align:center;padding:5px 8px;border-top:1px solid #000;font-size:10px;color:#333;">This is a Computer Generated Invoice</div>
  </div>
  `;
};

export async function downloadInvoicePreviewPdf(detail: InvoiceDetail) {
  // A4 width at ~96 DPI, used as html rendering baseline for predictable scaling.
  const A4_HTML_WIDTH_PX = 794;

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = `${A4_HTML_WIDTH_PX}px`;

  host.innerHTML = `
    <style>
      #invoice-root table, #invoice-root th, #invoice-root td { border-collapse: collapse; }
      #invoice-root .th, #invoice-root .td { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; }
      #invoice-root .cell-head { border: 1px solid #000; padding: 3px 6px; font-weight: 600; width: 45%; }
      #invoice-root .cell-value { border: 1px solid #000; padding: 3px 6px; }
      #invoice-root .c-right { text-align: right; }
      #invoice-root .c-center { text-align: center; }
      #invoice-root p { margin: 0; }
    </style>
    ${buildInvoiceHtml(detail)}
  `;

  document.body.appendChild(host);

  const root = host.querySelector('#invoice-root') as HTMLElement | null;
  if (!root) {
    document.body.removeChild(host);
    throw new Error('Unable to render invoice preview for PDF');
  }

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const marginMm = 8;
  const printableWidthMm = doc.internal.pageSize.getWidth() - (marginMm * 2);

  await new Promise<void>((resolve) => {
    (doc as jsPDF & { html: (element: HTMLElement, opts: Record<string, unknown>) => void }).html(root, {
      x: marginMm,
      y: marginMm,
      width: printableWidthMm,
      windowWidth: A4_HTML_WIDTH_PX,
      autoPaging: 'slice',
      html2canvas: {
        scale: 1.5,
        backgroundColor: '#ffffff',
      },
      callback: (pdf: jsPDF) => {
        pdf.save(`${detail.invoiceNumber}.pdf`);
        resolve();
      },
    });
  });

  document.body.removeChild(host);
}
