const prisma = require('../config/db');
const { success, created, notFound, badRequest, conflict } = require('../utils/response');
const { paginate, paginationMeta } = require('../utils/paginate');
const { log } = require('../services/activityLog');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Number((toNum(v)).toFixed(2));
const round3 = (v) => Number((toNum(v)).toFixed(3));
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const numberToWords = (value) => {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const belowThousand = (n) => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    const h = hundred ? `${units[hundred]} Hundred` : '';
    if (!rest) return h;
    const t = rest < 20 ? units[rest] : `${tens[Math.floor(rest / 10)]}${rest % 10 ? ` ${units[rest % 10]}` : ''}`;
    return `${h}${h ? ' ' : ''}${t}`;
  };

  const n = Math.floor(Math.abs(toNum(value)));
  if (!n) return 'Zero';

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ').trim();
};

const formatList = (inv) => ({
  id: inv.id,
  invoiceNumber: inv.invoice_number,
  clientId: inv.party_id,
  clientName: inv.buyer_company_name,
  billingType: 'manual',
  invoiceDate: dateOnly(inv.invoice_date),
  dueDate: dateOnly(inv.invoice_date),
  paymentTerms: inv.terms_of_payment || '',
  subtotal: toNum(inv.total_taxable_value),
  gstAmount: round2(toNum(inv.cgst_amount) + toNum(inv.sgst_utgst_amount) + toNum(inv.igst_amount)),
  total: toNum(inv.total_invoice_amount),
  paid: inv.status === 'PAID' ? toNum(inv.total_invoice_amount) : 0,
  outstanding: inv.status === 'PAID' ? 0 : toNum(inv.total_invoice_amount),
  status: inv.status.toLowerCase(),
});

const formatDetail = (inv) => ({
  ...formatList(inv),
  deliveryNote: inv.delivery_note || '',
  referenceNoDate: inv.reference_no_date || '',
  destination: inv.destination || '',
  seller: {
    companyName: inv.seller_company_name,
    fullAddress: inv.seller_full_address || '',
    gstinUin: inv.seller_gstin_uin || '',
    stateName: inv.seller_state_name || '',
    stateCode: inv.seller_state_code || '',
    email: inv.seller_email || '',
  },
  consignee: {
    companyName: inv.consignee_company_name || '',
    address: inv.consignee_address || '',
    gstinUin: inv.consignee_gstin_uin || '',
    stateName: inv.consignee_state_name || '',
    stateCode: inv.consignee_state_code || '',
  },
  buyer: {
    companyName: inv.buyer_company_name,
    address: inv.buyer_address || '',
    gstinUin: inv.buyer_gstin_uin || '',
    stateName: inv.buyer_state_name || '',
    stateCode: inv.buyer_state_code || '',
  },
  lineItems: inv.line_items.map((li) => ({
    id: li.id,
    slNo: li.sl_no,
    description: li.description,
    hsnSacCode: li.hsn_sac_code || '',
    gstRate: toNum(li.gst_rate),
    quantity: toNum(li.quantity),
    unit: li.unit,
    rate: toNum(li.rate),
    taxableAmount: toNum(li.taxable_amount),
    cgstAmount: toNum(li.cgst_amount),
    sgstAmount: toNum(li.sgst_utgst_amt),
    igstAmount: toNum(li.igst_amount),
    totalAmount: toNum(li.total_amount),
  })),
  taxAnalysisRows: inv.tax_analysis_rows || [],
  totals: {
    totalQuantity: toNum(inv.total_quantity),
    totalTaxableValue: toNum(inv.total_taxable_value),
    cgstAmount: toNum(inv.cgst_amount),
    sgstAmount: toNum(inv.sgst_utgst_amount),
    igstAmount: toNum(inv.igst_amount),
    roundOff: toNum(inv.round_off),
    totalInvoiceAmount: toNum(inv.total_invoice_amount),
    totalInvoiceAmountWords: inv.total_invoice_amount_words || '',
  },
  bankDetails: {
    accountHolderName: inv.bank_account_holder_name || '',
    bankName: inv.bank_name || '',
    accountNumber: inv.bank_account_number || '',
    branchIfscCode: inv.bank_branch_ifsc_code || '',
    swiftCode: inv.bank_swift_code || '',
  },
  companyPan: inv.company_pan || '',
  remarks: inv.remarks || '',
  declarationText: inv.declaration_text || '',
  authorizedSignatory: inv.authorized_signatory || '',
  isComputerGenerated: inv.is_computer_generated,
});

const buildTaxAnalysisRows = (lineItems) => {
  const grouped = new Map();
  for (const li of lineItems) {
    const key = `${li.hsnSacCode || ''}::${li.gstRate}`;
    const prev = grouped.get(key) || {
      hsnSacCode: li.hsnSacCode || '',
      taxableValue: 0,
      centralTaxRate: round2(li.gstRate / 2),
      centralTaxAmount: 0,
      stateTaxRate: round2(li.gstRate / 2),
      stateTaxAmount: 0,
      totalTaxAmount: 0,
    };
    prev.taxableValue = round2(prev.taxableValue + li.taxableAmount);
    prev.centralTaxAmount = round2(prev.centralTaxAmount + li.cgstAmount);
    prev.stateTaxAmount = round2(prev.stateTaxAmount + li.sgstAmount);
    prev.totalTaxAmount = round2(prev.totalTaxAmount + li.cgstAmount + li.sgstAmount + li.igstAmount);
    grouped.set(key, prev);
  }
  return Array.from(grouped.values());
};

// POST /api/v1/invoices
exports.create = async (req, res, next) => {
  try {
    const body = req.body || {};
    const invoice_number = String(body.invoice_number || '').trim();
    const invoice_date = body.invoice_date ? new Date(body.invoice_date) : new Date();
    const rawItems = Array.isArray(body.line_items) ? body.line_items : [];
    const status = String(body.status || '').toUpperCase() === 'GENERATED' ? 'GENERATED' : 'DRAFT';

    if (!invoice_number) return badRequest(res, 'Invoice number is required');
    if (!rawItems.length) return badRequest(res, 'At least one line item is required');
    if (!body.buyer_company_name) return badRequest(res, 'Buyer company name is required');
    if (!body.seller_company_name) return badRequest(res, 'Seller company name is required');

    const existing = await prisma.invoice.findUnique({ where: { invoice_number } });
    if (existing) return conflict(res, 'Invoice number already exists', 'DUPLICATE_INVOICE_NUMBER');

    const lineItems = rawItems.map((it, idx) => {
      const quantity = round3(toNum(it.quantity));
      const rate = round2(toNum(it.rate));
      const gstRate = round2(toNum(it.gst_rate));
      const taxableAmount = round2(quantity * rate);
      const cgstAmount = round2((taxableAmount * gstRate) / 200);
      const sgstAmount = round2((taxableAmount * gstRate) / 200);
      const igstAmount = round2(toNum(it.igst_amount));
      const totalAmount = round2(taxableAmount + cgstAmount + sgstAmount + igstAmount);
      return {
        slNo: idx + 1,
        description: String(it.description || '').trim(),
        hsnSacCode: String(it.hsn_sac_code || '').trim(),
        gstRate,
        quantity,
        unit: String(it.unit || 'TON').trim() || 'TON',
        rate,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalAmount,
      };
    });

    if (lineItems.some((it) => !it.description)) return badRequest(res, 'Line item description is required');

    const totalQuantity = round3(lineItems.reduce((s, it) => s + it.quantity, 0));
    const totalTaxableValue = round2(lineItems.reduce((s, it) => s + it.taxableAmount, 0));
    const cgstAmount = round2(lineItems.reduce((s, it) => s + it.cgstAmount, 0));
    const sgstAmount = round2(lineItems.reduce((s, it) => s + it.sgstAmount, 0));
    const igstAmount = round2(lineItems.reduce((s, it) => s + it.igstAmount, 0));
    const preRoundTotal = round2(totalTaxableValue + cgstAmount + sgstAmount + igstAmount);
    const roundOff = round2(toNum(body.round_off));
    const totalInvoiceAmount = round2(preRoundTotal + roundOff);
    const totalInvoiceAmountWords = String(body.total_invoice_amount_words || `Indian Rupees ${numberToWords(totalInvoiceAmount)} Only`);

    const taxAnalysisRows = Array.isArray(body.tax_analysis_rows) ? body.tax_analysis_rows : buildTaxAnalysisRows(lineItems);

    const invoice = await prisma.$transaction(async (tx) => {
      return tx.invoice.create({
        data: {
          invoice_number,
          party_id: body.party_id || null,
          invoice_date,
          delivery_note: body.delivery_note || null,
          terms_of_payment: body.terms_of_payment || null,
          reference_no_date: body.reference_no_date || null,
          destination: body.destination || null,

          seller_company_name: body.seller_company_name,
          seller_full_address: body.seller_full_address || null,
          seller_gstin_uin: body.seller_gstin_uin || null,
          seller_state_name: body.seller_state_name || null,
          seller_state_code: body.seller_state_code || null,
          seller_email: body.seller_email || null,

          consignee_company_name: body.consignee_company_name || null,
          consignee_address: body.consignee_address || null,
          consignee_gstin_uin: body.consignee_gstin_uin || null,
          consignee_state_name: body.consignee_state_name || null,
          consignee_state_code: body.consignee_state_code || null,

          buyer_company_name: body.buyer_company_name,
          buyer_address: body.buyer_address || null,
          buyer_gstin_uin: body.buyer_gstin_uin || null,
          buyer_state_name: body.buyer_state_name || null,
          buyer_state_code: body.buyer_state_code || null,

          subtotal: totalTaxableValue,
          cgst_amount: cgstAmount,
          sgst_utgst_amount: sgstAmount,
          igst_amount: igstAmount,
          round_off: roundOff,
          total_quantity: totalQuantity,
          total_taxable_value: totalTaxableValue,
          total_invoice_amount: totalInvoiceAmount,
          total_invoice_amount_words: totalInvoiceAmountWords,
          tax_analysis_rows: taxAnalysisRows,

          bank_account_holder_name: body.bank_account_holder_name || null,
          bank_name: body.bank_name || null,
          bank_account_number: body.bank_account_number || null,
          bank_branch_ifsc_code: body.bank_branch_ifsc_code || null,
          bank_swift_code: body.bank_swift_code || null,

          company_pan: body.company_pan || null,
          remarks: body.remarks || null,
          declaration_text: body.declaration_text || null,
          authorized_signatory: body.authorized_signatory || null,
          is_computer_generated: body.is_computer_generated !== false,

          status,
          created_by: req.user?.id || null,
          line_items: {
            create: lineItems.map((it) => ({
              sl_no: it.slNo,
              description: it.description,
              hsn_sac_code: it.hsnSacCode || null,
              gst_rate: it.gstRate,
              quantity: it.quantity,
              unit: it.unit,
              rate: it.rate,
              taxable_amount: it.taxableAmount,
              cgst_amount: it.cgstAmount,
              sgst_utgst_amt: it.sgstAmount,
              igst_amount: it.igstAmount,
              total_amount: it.totalAmount,
            })),
          },
        },
        include: { line_items: true },
      });
    });

    await log({
      userId: req.user.id,
      actionType: status === 'GENERATED' ? 'INVOICE_GENERATED' : 'INVOICE_DRAFT_SAVED',
      entityType: 'invoice',
      entityId: invoice.id,
      description: `Invoice ${invoice_number} ${status === 'GENERATED' ? 'generated' : 'saved as draft'}`,
      ip: req.ip,
    });

    return created(res, status === 'GENERATED' ? 'Invoice generated' : 'Invoice draft saved', formatDetail(invoice));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/invoices
exports.getAll = async (req, res, next) => {
  try {
    const { status, client_id, from, to, page, limit, search } = req.query;
    const { page: p, limit: l, skip } = paginate(req.query, page, limit);
    const where = {};
    if (status) where.status = String(status).toUpperCase();
    if (client_id) where.party_id = client_id;
    if (search) {
      where.OR = [
        { invoice_number: { contains: String(search), mode: 'insensitive' } },
        { buyer_company_name: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    if (from || to) {
      where.invoice_date = {};
      if (from) where.invoice_date.gte = new Date(from);
      if (to) where.invoice_date.lte = new Date(to);
    }
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { invoice_date: 'desc' },
        skip,
        take: l,
      }),
      prisma.invoice.count({ where }),
    ]);
    return res.json({ success: true, data: invoices.map(formatList), pagination: paginationMeta(total, p, l) });
  } catch (err) { next(err); }
};

// GET /api/v1/invoices/:id
exports.getOne = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { id: req.params.id },
          { invoice_number: req.params.id },
        ],
      },
      include: { line_items: { orderBy: { sl_no: 'asc' } } },
    });
    if (!invoice) return notFound(res, 'Invoice not found');
    return success(res, 'Invoice found', formatDetail(invoice));
  } catch (err) { next(err); }
};

// PATCH /api/v1/invoices/:id/status
exports.updateStatus = async (req, res, next) => {
  try {
    const status = String(req.body?.status || '').toUpperCase();
    const allowed = ['GENERATED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];
    if (!allowed.includes(status)) return badRequest(res, 'Invalid status');

    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { id: req.params.id },
          { invoice_number: req.params.id },
        ],
      },
    });
    if (!invoice) return notFound(res, 'Invoice not found');
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status },
    });
    await log({ userId: req.user.id, actionType: 'INVOICE_STATUS_UPDATED', entityType: 'invoice', entityId: invoice.id, description: `Invoice ${invoice.invoice_number} status set to ${status}`, ip: req.ip });
    return success(res, 'Invoice status updated', formatList(updated));
  } catch (err) { next(err); }
};