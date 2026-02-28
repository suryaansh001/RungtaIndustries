const prisma = require('../config/db');
const { success, created, notFound, badRequest } = require('../utils/response');
const { paginate, paginationMeta } = require('../utils/paginate');
const { log } = require('../services/activityLog');

// Compute stock summary for one party using aggregation queries
const getPartySummary = async (partyId) => {
  const today = new Date();
  const [coils, packets, txnSum] = await Promise.all([
    prisma.coil.findMany({
      where: { current_party_id: partyId },
      select: { id: true, net_weight_kg: true, stock_in_date: true, transactions: { select: { net_weight_kg: true } } },
    }),
    prisma.packet.findMany({
      where: { party_id: partyId, is_dispatched: false },
      select: { id: true, net_weight_kg: true, stock_in_date: true },
    }),
    prisma.transaction.aggregate({
      where: { party_id: partyId },
      _sum: { amount_charged: true },
    }),
  ]);

  const coilCount = coils.length;
  let coilWeight = 0;
  const holdingDays = [];

  for (const c of coils) {
    const remaining = c.transactions.reduce((s, t) => s + Number(t.net_weight_kg || 0), 0);
    coilWeight += Math.max(0, remaining);
    const days = Math.floor((today - new Date(c.stock_in_date)) / 86400000);
    holdingDays.push(days);
  }
  for (const p of packets) {
    const days = Math.floor((today - new Date(p.stock_in_date)) / 86400000);
    holdingDays.push(days);
  }

  const packetCount = packets.length;
  const packetWeight = packets.reduce((s, p) => s + Number(p.net_weight_kg), 0);
  const avgHolding = holdingDays.length ? Math.round(holdingDays.reduce((a, b) => a + b, 0) / holdingDays.length) : 0;
  const maxHolding = holdingDays.length ? Math.max(...holdingDays) : 0;
  const billed = Number(txnSum._sum.amount_charged || 0);

  // Last activity date
  const lastTxn = await prisma.transaction.findFirst({
    where: { party_id: partyId },
    orderBy: { created_at: 'desc' },
    select: { txn_date: true },
  });

  return { coilCount, coilWeight, packetCount, packetWeight, avgHolding, maxHolding, billed, lastActivity: lastTxn?.txn_date || null };
};

const fmt = async (p, withSummary = false) => {
  const base = {
    id: p.id,
    name: p.name,
    contact: p.contact_person || '',
    mobile: p.mobile_number || '',
    creditLimit: Number(p.credit_limit || 0),
    billingCycle: p.billing_cycle || 'Monthly',
    status: p.is_active ? 'active' : 'inactive',
    gst: p.gst_number || '',
    address: p.address || '',
  };
  if (withSummary) {
    const summary = await getPartySummary(p.id);
    return { ...base, ...summary };
  }
  return base;
};

// GET /api/v1/parties
exports.getAll = async (req, res, next) => {
  try {
    const { search, page, limit, include_inactive } = req.query;
    const { page: p, limit: l, skip } = paginate(req.query, page, limit);
    const where = {};
    if (include_inactive !== 'true') where.is_active = true;
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { contact_person: { contains: search, mode: 'insensitive' } },
    ];
    const [parties, total] = await Promise.all([
      prisma.party.findMany({ where, skip, take: l, orderBy: { name: 'asc' } }),
      prisma.party.count({ where }),
    ]);
    const data = await Promise.all(parties.map((pt) => fmt(pt, true)));
    return res.json({ success: true, data, pagination: paginationMeta(total, p, l) });
  } catch (err) { next(err); }
};

// GET /api/v1/parties/:id
exports.getOne = async (req, res, next) => {
  try {
    const party = await prisma.party.findUnique({ where: { id: req.params.id } });
    if (!party) return notFound(res, 'Party not found');
    const data = await fmt(party, true);
    return success(res, 'Party found', data);
  } catch (err) { next(err); }
};

// POST /api/v1/parties
exports.create = async (req, res, next) => {
  try {
    const { name, gst_number, address, mobile_number, contact_person, credit_limit, billing_cycle } = req.body;
    if (!name) return badRequest(res, 'Party name is required');
    const party = await prisma.party.create({
      data: { name, gst_number: gst_number || null, address, mobile_number, contact_person, credit_limit: credit_limit ? parseFloat(credit_limit) : null, billing_cycle },
    });
    await log({ userId: req.user.id, actionType: 'PARTY_CREATED', entityType: 'party', entityId: party.id, description: `Party "${party.name}" created`, ip: req.ip });
    return created(res, 'Party created', await fmt(party, false));
  } catch (err) { next(err); }
};

// PUT /api/v1/parties/:id
exports.update = async (req, res, next) => {
  try {
    const existing = await prisma.party.findUnique({ where: { id: req.params.id } });
    if (!existing) return notFound(res, 'Party not found');
    const { name, gst_number, address, mobile_number, contact_person, credit_limit, billing_cycle } = req.body;
    const party = await prisma.party.update({
      where: { id: req.params.id },
      data: { name, gst_number: gst_number || null, address, mobile_number, contact_person, credit_limit: credit_limit !== undefined ? parseFloat(credit_limit) : undefined, billing_cycle },
    });
    await log({ userId: req.user.id, actionType: 'PARTY_UPDATED', entityType: 'party', entityId: party.id, description: `Party "${party.name}" updated`, ip: req.ip });
    return success(res, 'Party updated', await fmt(party, false));
  } catch (err) { next(err); }
};

// DELETE /api/v1/parties/:id  (soft delete)
exports.remove = async (req, res, next) => {
  try {
    const existing = await prisma.party.findUnique({ where: { id: req.params.id } });
    if (!existing) return notFound(res, 'Party not found');
    await prisma.party.update({ where: { id: req.params.id }, data: { is_active: false } });
    await log({ userId: req.user.id, actionType: 'PARTY_DELETED', entityType: 'party', entityId: req.params.id, description: `Party "${existing.name}" deactivated`, ip: req.ip });
    return success(res, 'Party deactivated', null);
  } catch (err) { next(err); }
};
