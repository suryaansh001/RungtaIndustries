const prisma = require('../config/db');
const { success, created, notFound } = require('../utils/response');
const { paginate, paginationMeta } = require('../utils/paginate');
const { log } = require('../services/activityLog');

// GET /api/clients
exports.getAll = async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;
    const { page: p, limit: l, skip } = paginate(req.query, page, limit);
    const where = { is_active: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { gst_number: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [clients, total] = await Promise.all([
      prisma.client.findMany({ where, skip, take: l, orderBy: { created_at: 'desc' } }),
      prisma.client.count({ where }),
    ]);
    return res.json({ success: true, data: clients, pagination: paginationMeta(total, p, l) });
  } catch (err) { next(err); }
};

// POST /api/clients
exports.create = async (req, res, next) => {
  try {
    const { name, gst_number, address, mobile, contact_person } = req.body;
    const client = await prisma.client.create({
      data: { name, gst_number: gst_number || null, address, mobile, contact_person },
    });
    await log({ userId: req.user.id, actionType: 'CLIENT_CREATED', entityType: 'client', entityId: client.id, description: `Client "${client.name}" created`, ip: req.ip });
    return created(res, 'Client created', client);
  } catch (err) { next(err); }
};

// PUT /api/clients/:id
exports.update = async (req, res, next) => {
  try {
    const existing = await prisma.client.findFirst({ where: { id: req.params.id, is_active: true } });
    if (!existing) return notFound(res, 'Client not found');
    const { name, gst_number, address, mobile, contact_person } = req.body;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { name, gst_number, address, mobile, contact_person },
    });
    await log({ userId: req.user.id, actionType: 'CLIENT_UPDATED', entityType: 'client', entityId: client.id, description: `Client "${client.name}" updated`, ip: req.ip });
    return success(res, 'Client updated', client);
  } catch (err) { next(err); }
};

// DELETE /api/clients/:id  (soft delete)
exports.remove = async (req, res, next) => {
  try {
    const existing = await prisma.client.findFirst({ where: { id: req.params.id, is_active: true } });
    if (!existing) return notFound(res, 'Client not found');
    const client = await prisma.client.update({ where: { id: req.params.id }, data: { is_active: false } });
    await log({ userId: req.user.id, actionType: 'CLIENT_DELETED', entityType: 'client', entityId: client.id, description: `Client "${client.name}" deactivated`, ip: req.ip });
    return success(res, 'Client deactivated', null);
  } catch (err) { next(err); }
};

// GET /api/clients/:id/outstanding
exports.getOutstanding = async (req, res, next) => {
  try {
    const result = await prisma.invoice.aggregate({
      where: { client_id: req.params.id, status: { in: ['PENDING', 'OVERDUE'] } },
      _sum: { total_amount: true },
    });
    return success(res, 'Outstanding amount', { outstanding: result._sum.total_amount || 0 });
  } catch (err) { next(err); }
};
