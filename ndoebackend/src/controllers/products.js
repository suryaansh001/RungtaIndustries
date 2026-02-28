const prisma = require('../config/db');
const { success, created, notFound, badRequest, conflict } = require('../utils/response');
const { paginate, paginationMeta } = require('../utils/paginate');
const { generateProductCode } = require('../services/productCode');
const { log } = require('../services/activityLog');

// Transform DB product → frontend-friendly shape
const formatProduct = (p) => {
  let currentStage = p.current_stage;
  if (p.status === 'COMPLETED') currentStage = 5;
  return {
    id: p.product_code,
    _id: p.id,
    name: p.name,
    clientId: p.client?.id || p.client_id,
    clientName: p.client?.name || '',
    quantity: p.quantity,
    pricePerUnit: p.price_per_unit,
    category: p.category === 'STAGE_BASED' ? 'stage-based' : 'direct',
    currentStage: currentStage ?? 0,
    billingStatus: (p.billing_status || 'NOT_GENERATED').toLowerCase().replace('_', '-').replace('not-generated', 'pending'),
    notes: p.notes || '',
    createdDate: p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : '',
    status: p.status,
  };
};

// GET /api/products
exports.getAll = async (req, res, next) => {
  try {
    const { search, category, status, billing_status, client_id, page, limit } = req.query;
    const { page: p, limit: l, skip } = paginate(req.query, page, limit);
    const where = { is_active: true };
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { product_code: { contains: search, mode: 'insensitive' } },
    ];
    if (category) where.category = category.toUpperCase().replace('-', '_');
    if (status) where.status = status.toUpperCase();
    if (billing_status) where.billing_status = billing_status.toUpperCase().replace('-', '_');
    if (client_id) where.client_id = client_id;
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: l,
        include: { client: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);
    return res.json({ success: true, data: products.map(formatProduct), pagination: paginationMeta(total, p, l) });
  } catch (err) { next(err); }
};

// GET /api/products/:id
exports.getOne = async (req, res, next) => {
  try {
    const clientInclude = { select: { id: true, name: true, gst_number: true, mobile: true, contact_person: true, address: true } };
    let product = await prisma.product.findFirst({
      where: { product_code: req.params.id, is_active: true },
      include: { client: clientInclude },
    });
    if (!product) {
      product = await prisma.product.findFirst({
        where: { id: req.params.id, is_active: true },
        include: { client: clientInclude },
      });
    }
    if (!product) return notFound(res, 'Product not found');
    const stageLogs = await prisma.stageLog.findMany({
      where: { product_id: product.id },
      orderBy: { timestamp: 'asc' },
    });
    return success(res, 'Product found', { ...formatProduct(product), stageLogs });
  } catch (err) { next(err); }
};

// POST /api/products
exports.create = async (req, res, next) => {
  try {
    const { name, client_id, quantity, price_per_unit, category, notes } = req.body;
    const client = await prisma.client.findFirst({ where: { id: client_id, is_active: true } });
    if (!client) return notFound(res, 'Client not found');
    const settings = await prisma.settings.findFirst();
    const prefix = settings?.product_prefix || 'PROD';
    const product_code = await generateProductCode(prefix);
    const isDirect = category === 'DIRECT' || category === 'direct';
    const product = await prisma.product.create({
      data: {
        product_code,
        name,
        client_id,
        category: isDirect ? 'DIRECT' : 'STAGE_BASED',
        quantity: parseInt(quantity),
        price_per_unit: parseFloat(price_per_unit),
        current_stage: isDirect ? null : 1,
        status: isDirect ? 'COMPLETED' : 'IN_PROGRESS',
        billing_status: 'NOT_GENERATED',
        notes: notes || '',
        created_by: req.user.id,
      },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!isDirect) {
      await prisma.stageLog.create({
        data: { product_id: product.id, stage_number: 1, notes: 'Product created - entered Stage 1', updated_by: req.user.id },
      });
    }
    await log({ userId: req.user.id, actionType: 'PRODUCT_CREATED', entityType: 'product', entityId: product.id, description: `Product "${name}" (${product_code}) created`, ip: req.ip });
    return created(res, 'Product created successfully', formatProduct(product));
  } catch (err) { next(err); }
};

// PUT /api/products/:id
exports.update = async (req, res, next) => {
  try {
    const existing = await prisma.product.findFirst({ where: { product_code: req.params.id, is_active: true } });
    if (!existing) return notFound(res, 'Product not found');
    const allowedFields = ['name', 'quantity', 'price_per_unit', 'notes', 'description'];
    const updateData = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });
    const product = await prisma.product.update({
      where: { id: existing.id },
      data: updateData,
      include: { client: { select: { id: true, name: true } } },
    });
    return success(res, 'Product updated', formatProduct(product));
  } catch (err) { next(err); }
};

// DELETE /api/products/:id  (soft delete, only if not billed)
exports.remove = async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({ where: { product_code: req.params.id, is_active: true } });
    if (!product) return notFound(res, 'Product not found');
    if (product.billing_status !== 'NOT_GENERATED') {
      return conflict(res, 'Cannot delete a product that has been billed', 'BILLING_EXISTS');
    }
    await prisma.product.update({ where: { id: product.id }, data: { is_active: false } });
    await log({ userId: req.user.id, actionType: 'PRODUCT_DELETED', entityType: 'product', entityId: product.id, description: `Product "${product.name}" soft deleted`, ip: req.ip });
    return success(res, 'Product deleted', null);
  } catch (err) { next(err); }
};

// PATCH /api/products/:id/stage
exports.updateStage = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const product = await prisma.product.findFirst({ where: { product_code: req.params.id, is_active: true } });
    if (!product) return notFound(res, 'Product not found');
    if (product.category !== 'STAGE_BASED') return badRequest(res, 'Only stage-based products can be stage-updated');
    if (product.status === 'COMPLETED') return conflict(res, 'Product is already completed', 'ALREADY_COMPLETED');
    const nextStage = (product.current_stage || 0) + 1;
    if (nextStage > 4) return conflict(res, 'Stage cannot be updated beyond 4', 'INVALID_STAGE');
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        current_stage: nextStage,
        ...(nextStage === 4 && { status: 'COMPLETED' }),
      },
      include: { client: { select: { id: true, name: true } } },
    });
    await prisma.stageLog.create({
      data: { product_id: product.id, stage_number: nextStage, notes: notes || '', updated_by: req.user.id },
    });
    await log({ userId: req.user.id, actionType: 'STAGE_UPDATED', entityType: 'product', entityId: product.id, description: `"${product.name}" moved to Stage ${nextStage}`, ip: req.ip });
    return success(res, `Stage updated to ${nextStage}`, formatProduct(updated));
  } catch (err) { next(err); }
};
