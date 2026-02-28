const PDFDocument = require('pdfkit');
const prisma = require('../config/db');
const { success, created, notFound, badRequest, conflict } = require('../utils/response');
const { paginate, paginationMeta } = require('../utils/paginate');
const { generateInvoiceNumber } = require('../services/productCode');
const { calculateInvoice } = require('../services/invoiceCalc');
const { log } = require('../services/activityLog');

const formatInvoice = (inv) => ({
  id: inv.invoice_number,
  _id: inv.id,
  invoiceNumber: inv.invoice_number,
  productId: inv.product?.product_code || inv.product_id,
  productName: inv.product?.name || '',
  clientId: inv.client?.id || inv.client_id,
  clientName: inv.client?.name || '',
  subtotal: inv.subtotal,
  gstPercentage: inv.gst_percentage,
  gstAmount: inv.gst_amount,
  totalAmount: inv.total_amount,
  status: inv.status?.toLowerCase(),
  issuedDate: inv.issued_date,
  dueDate: inv.due_date,
  paidDate: inv.paid_date,
});

// POST /api/invoices/generate/:product_id
exports.generate = async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { product_code: req.params.product_id, is_active: true },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!product) return notFound(res, 'Product not found');
    if (product.billing_status !== 'NOT_GENERATED') return conflict(res, 'Invoice already generated for this product', 'DUPLICATE_INVOICE');
    if (product.category === 'STAGE_BASED' && product.status !== 'COMPLETED') {
      return badRequest(res, 'Stage-based product must be completed (all 4 stages) before invoicing', 'NOT_COMPLETED');
    }
    const settings = await prisma.settings.findFirst();
    const gstPct = settings?.gst_percentage ?? 18;
    const dueDays = settings?.invoice_due_days ?? 30;
    const prefix = settings?.invoice_prefix || 'INV';
    const { subtotal, gst_percentage, gst_amount, total_amount } = calculateInvoice(product, gstPct);
    const invoice_number = await generateInvoiceNumber(prefix);
    const issued_date = new Date();
    const due_date = new Date(issued_date.getTime() + dueDays * 86400000);
    const invoice = await prisma.invoice.create({
      data: {
        invoice_number,
        product_id: product.id,
        client_id: product.client_id,
        subtotal,
        gst_percentage,
        gst_amount,
        total_amount,
        status: 'PENDING',
        issued_date,
        due_date,
        created_by: req.user.id,
      },
      include: {
        product: { select: { name: true, product_code: true } },
        client: { select: { id: true, name: true } },
      },
    });
    await prisma.product.update({ where: { id: product.id }, data: { billing_status: 'PENDING' } });
    await log({ userId: req.user.id, actionType: 'INVOICE_GENERATED', entityType: 'invoice', entityId: invoice.id, description: `Invoice ${invoice_number} generated for "${product.name}"`, ip: req.ip });
    return created(res, 'Invoice generated', formatInvoice(invoice));
  } catch (err) { next(err); }
};

// GET /api/invoices
exports.getAll = async (req, res, next) => {
  try {
    const { status, client_id, from, to, page, limit } = req.query;
    const { page: p, limit: l, skip } = paginate(req.query, page, limit);
    const where = {};
    if (status) where.status = status.toUpperCase();
    if (client_id) where.client_id = client_id;
    if (from || to) {
      where.issued_date = {};
      if (from) where.issued_date.gte = new Date(from);
      if (to) where.issued_date.lte = new Date(to);
    }
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          product: { select: { name: true, product_code: true } },
          client: { select: { id: true, name: true } },
        },
        orderBy: { issued_date: 'desc' },
        skip,
        take: l,
      }),
      prisma.invoice.count({ where }),
    ]);
    return res.json({ success: true, data: invoices.map(formatInvoice), pagination: paginationMeta(total, p, l) });
  } catch (err) { next(err); }
};

// GET /api/invoices/:id
exports.getOne = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { invoice_number: req.params.id },
      include: {
        product: { select: { name: true, product_code: true, quantity: true, price_per_unit: true, category: true } },
        client: { select: { id: true, name: true, gst_number: true, address: true, mobile: true } },
      },
    });
    if (!invoice) return notFound(res, 'Invoice not found');
    return success(res, 'Invoice found', formatInvoice(invoice));
  } catch (err) { next(err); }
};

// PATCH /api/invoices/:id/mark-paid
exports.markPaid = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { invoice_number: req.params.id } });
    if (!invoice) return notFound(res, 'Invoice not found');
    if (invoice.status === 'PAID') return conflict(res, 'Invoice already marked as paid', 'ALREADY_PAID');
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', paid_date: new Date() },
    });
    await prisma.product.update({ where: { id: invoice.product_id }, data: { billing_status: 'PAID' } });
    await log({ userId: req.user.id, actionType: 'PAYMENT_MARKED', entityType: 'invoice', entityId: invoice.id, description: `Invoice ${invoice.invoice_number} marked as PAID`, ip: req.ip });
    return success(res, 'Invoice marked as paid', formatInvoice(updated));
  } catch (err) { next(err); }
};

// GET /api/invoices/:id/pdf
exports.downloadPdf = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { invoice_number: req.params.id },
      include: {
        product: { select: { name: true, product_code: true, quantity: true, price_per_unit: true } },
        client: { select: { name: true, address: true, mobile: true, gst_number: true, contact_person: true } },
      },
    });
    if (!invoice) return notFound(res, 'Invoice not found');

    const settings = await prisma.settings.findFirst();
    const companyName = settings?.company_name || 'ProManufact Industries';
    const companyAddr = settings?.company_address || '';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);

    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    doc.pipe(res);

    const W = 595.28;
    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

    // ── Header band ──
    doc.rect(0, 0, W, 88).fill('#1F4E79');
    doc.fillColor('#aacce8').fontSize(22).font('Helvetica-Bold')
      .text('INVOICE', W - 200, 28, { width: 160, align: 'right' });
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text(companyName, 40, 25);
    if (companyAddr) doc.fillColor('#cce0f5').fontSize(9).font('Helvetica').text(companyAddr, 40, 52);

    // ── Invoice meta (right) ──
    doc.fillColor('#888888').fontSize(9).font('Helvetica-Bold');
    doc.text('Invoice No.', 360, 108);
    doc.text('Issue Date', 360, 126);
    doc.text('Due Date', 360, 144);
    doc.fillColor('#111111').fontSize(9).font('Helvetica');
    doc.text(invoice.invoice_number, 455, 108, { width: 100, align: 'right' });
    doc.text(fmt(invoice.issued_date), 455, 126, { width: 100, align: 'right' });
    doc.text(fmt(invoice.due_date), 455, 144, { width: 100, align: 'right' });

    // ── Bill To (left) ──
    doc.fillColor('#888888').fontSize(8).font('Helvetica-Bold').text('BILL TO', 40, 108);
    doc.fillColor('#111111').fontSize(13).font('Helvetica-Bold').text(invoice.client?.name || '', 40, 122);
    let cy = 140;
    doc.fontSize(9).font('Helvetica').fillColor('#555555');
    if (invoice.client?.contact_person) { doc.text(invoice.client.contact_person, 40, cy); cy += 13; }
    if (invoice.client?.address) { doc.text(invoice.client.address, 40, cy, { width: 280 }); cy += 13; }
    if (invoice.client?.mobile) { doc.text('Mobile: ' + invoice.client.mobile, 40, cy); cy += 13; }
    if (invoice.client?.gst_number) { doc.text('GSTIN: ' + invoice.client.gst_number, 40, cy); }

    // ── Items Table header ──
    const tY = 200;
    doc.rect(40, tY, W - 80, 22).fill('#1F4E79');
    doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
    doc.text('PRODUCT', 52, tY + 7);
    doc.text('CODE', 245, tY + 7);
    doc.text('QTY', 345, tY + 7, { width: 45, align: 'right' });
    doc.text('RATE (Rs.)', 393, tY + 7, { width: 68, align: 'right' });
    doc.text('AMOUNT (Rs.)', 463, tY + 7, { width: 72, align: 'right' });

    // ── Table row ──
    const rY = tY + 26;
    doc.rect(40, rY - 2, W - 80, 28).fill('#f5f7fa');
    doc.fillColor('#111111').fontSize(10).font('Helvetica');
    const qty = invoice.product?.quantity || 0;
    const unitPrice = qty > 0 ? (invoice.subtotal / qty) : (invoice.subtotal || 0);
    doc.text(invoice.product?.name || '', 52, rY + 4, { width: 190 });
    doc.text(invoice.product?.product_code || '', 245, rY + 4);
    doc.text(String(qty), 345, rY + 4, { width: 45, align: 'right' });
    doc.text(unitPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 }), 393, rY + 4, { width: 68, align: 'right' });
    doc.text((invoice.subtotal || 0).toLocaleString('en-IN'), 463, rY + 4, { width: 72, align: 'right' });

    // ── Divider ──
    const dY = rY + 38;
    doc.moveTo(40, dY).lineTo(W - 40, dY).strokeColor('#e0e0e0').lineWidth(1).stroke();

    // ── Totals ──
    let ty = dY + 16;
    doc.fillColor('#666666').fontSize(10).font('Helvetica').text('Subtotal:', 370, ty);
    doc.fillColor('#111111').text('Rs. ' + (invoice.subtotal || 0).toLocaleString('en-IN'), 440, ty, { width: 95, align: 'right' });
    ty += 20;
    doc.fillColor('#666666').text('GST (' + invoice.gst_percentage + '%):', 370, ty);
    doc.fillColor('#111111').text('Rs. ' + (invoice.gst_amount || 0).toLocaleString('en-IN'), 440, ty, { width: 95, align: 'right' });
    ty += 14;
    doc.moveTo(370, ty).lineTo(W - 40, ty).strokeColor('#cccccc').lineWidth(0.5).stroke();
    ty += 8;
    doc.rect(370, ty, W - 40 - 370, 28).fill('#1F4E79');
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
    doc.text('TOTAL:', 382, ty + 8);
    doc.text('Rs. ' + (invoice.total_amount || 0).toLocaleString('en-IN'), 402, ty + 8, { width: 121, align: 'right' });

    // ── Status pill ──
    ty += 46;
    const sc = invoice.status === 'PAID' ? '#22c55e' : invoice.status === 'OVERDUE' ? '#ef4444' : '#f59e0b';
    doc.rect(40, ty, 72, 22).fill(sc);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(invoice.status, 40, ty + 7, { width: 72, align: 'center' });

    // ── Note ──
    ty += 38;
    doc.fillColor('#aaaaaa').fontSize(8).font('Helvetica')
      .text('This is a computer generated invoice and does not require a physical signature.', 40, ty, { width: W - 80 });

    // ── Footer ──
    doc.rect(0, 810, W, 32).fill('#1F4E79');
    doc.fillColor('#aacce8').fontSize(8).font('Helvetica')
      .text('Thank you for your business!   |   Generated by GlassFlow', 0, 820, { align: 'center', width: W });

    doc.end();
  } catch (err) { next(err); }
};