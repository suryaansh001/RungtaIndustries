const prisma = require('../config/db');
const { success, created, notFound, badRequest } = require('../utils/response');
const { paginate, paginationMeta } = require('../utils/paginate');
const { log } = require('../services/activityLog');

const formatPacket = (p, today = new Date()) => {
  const holdingDays = Math.floor((today - new Date(p.stock_in_date)) / 86400000);
  const weight = Number(p.net_weight_kg);
  const rate = Number(p.rate_per_kg || 0);
  const storageCharge = Math.round(weight * rate * holdingDays);
  return {
    id: p.id,
    packetNumber: p.packet_number,
    partyId: p.party_id,
    partyName: p.party?.name || '',
    size: p.size,
    coilType: p.coil_grade,
    weight,
    kataWeight: Number(p.kata_weight_kg || 0),
    rate,
    storageCharge,
    holdingDays,
    status: p.is_dispatched ? 'dispatched' : 'in_stock',
    thickness: Number(p.thickness_mm || 0),
    width: Number(p.width_mm || 0),
    length: Number(p.length_mm || 0),
    date: p.stock_in_date?.toISOString?.().split('T')[0] || p.stock_in_date,
    truckDo: p.truck_do_number || '',
    kantaName: p.kanta_name || '',
    kataNumber: p.kata_number || '',
    remark: p.remark || '',
  };
};

exports.getAll = async (req, res, next) => {
  try {
    const { search, party_id, status, page, limit } = req.query;
    const { page: p, limit: l, skip } = paginate(req.query, page, limit);
    const where = {};
    if (search) where.OR = [{ packet_number: { contains: search, mode: 'insensitive' } }];
    if (party_id) where.party_id = party_id;
    if (status === 'in_stock') where.is_dispatched = false;
    else if (status === 'dispatched') where.is_dispatched = true;
    const [packets, total] = await Promise.all([
      prisma.packet.findMany({ where, skip, take: l, include: { party: { select: { name: true } } }, orderBy: { created_at: 'desc' } }),
      prisma.packet.count({ where }),
    ]);
    const today = new Date();
    return res.json({ success: true, data: packets.map((p) => formatPacket(p, today)), pagination: paginationMeta(total, p, l) });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const packet = await prisma.packet.findFirst({
      where: { OR: [{ id: req.params.id }, { packet_number: req.params.id }] },
      include: { party: { select: { name: true } }, transactions: { orderBy: { created_at: 'asc' } } },
    });
    if (!packet) return notFound(res, 'Packet not found');
    return success(res, 'Packet found', formatPacket(packet));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { packet_number, party_id, coil_grade, size, thickness_mm, width_mm, length_mm,
      net_weight_kg, kata_weight_kg, truck_do_number, kanta_name, kata_number, stock_in_date, remark } = req.body;
    if (!packet_number || !party_id || !coil_grade || !size || !net_weight_kg)
      return badRequest(res, 'packet_number, party_id, coil_grade, size, net_weight_kg are required');
    const party = await prisma.party.findFirst({ where: { id: party_id, is_active: true } });
    if (!party) return notFound(res, 'Party not found');
    const pricing = await prisma.pricingConfig.findFirst({
      where: { coil_grade, activity_type: 'storage', is_active: true }, orderBy: { effective_from: 'desc' },
    });
    const packet = await prisma.$transaction(async (tx) => {
      const pk = await tx.packet.create({
        data: {
          packet_number, party_id, original_party_id: party_id, coil_grade, size,
          thickness_mm: thickness_mm ? parseFloat(thickness_mm) : null,
          width_mm: width_mm ? parseFloat(width_mm) : null,
          length_mm: length_mm ? parseFloat(length_mm) : null,
          net_weight_kg: parseFloat(net_weight_kg),
          kata_weight_kg: kata_weight_kg ? parseFloat(kata_weight_kg) : null,
          truck_do_number, kanta_name, kata_number,
          rate_per_kg: pricing ? pricing.rate : null,
          stock_in_date: stock_in_date ? new Date(stock_in_date) : new Date(),
          remark, created_by: req.user.id,
        },
      });
      await tx.transaction.create({
        data: {
          txn_date: stock_in_date ? new Date(stock_in_date) : new Date(),
          activity: 'Pkt_In',
          party_id, packet_id: pk.id, coil_grade,
          net_weight_kg: parseFloat(net_weight_kg),
          rate_applied: pricing ? pricing.rate : null,
          truck_do_number, remark, created_by: req.user.id,
        },
      });
      return pk;
    });
    await log({ userId: req.user.id, actionType: 'PACKET_CREATED', entityType: 'packet', entityId: packet.id, description: `Packet ${packet_number} stock-in for ${party.name}`, ip: req.ip });
    return created(res, 'Packet added', { id: packet.id, packetNumber: packet.packet_number });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const existing = await prisma.packet.findFirst({
      where: { OR: [{ id: req.params.id }, { packet_number: req.params.id }] },
    });
    if (!existing) return notFound(res, 'Packet not found');
    const { coil_grade, size, thickness_mm, width_mm, length_mm,
      net_weight_kg, kata_weight_kg, truck_do_number, kanta_name, kata_number, remark } = req.body;
    const updated = await prisma.packet.update({
      where: { id: existing.id },
      data: {
        ...(coil_grade && { coil_grade }),
        ...(size && { size }),
        ...(thickness_mm !== undefined && { thickness_mm: parseFloat(thickness_mm) }),
        ...(width_mm !== undefined && { width_mm: parseFloat(width_mm) }),
        ...(length_mm !== undefined && { length_mm: parseFloat(length_mm) }),
        ...(net_weight_kg !== undefined && { net_weight_kg: parseFloat(net_weight_kg) }),
        ...(kata_weight_kg !== undefined && { kata_weight_kg: parseFloat(kata_weight_kg) }),
        ...(truck_do_number !== undefined && { truck_do_number }),
        ...(kanta_name !== undefined && { kanta_name }),
        ...(kata_number !== undefined && { kata_number }),
        ...(remark !== undefined && { remark }),
      },
    });
    return success(res, 'Packet updated', { id: updated.id });
  } catch (err) { next(err); }
};

exports.dispatch = async (req, res, next) => {
  try {
    const existing = await prisma.packet.findFirst({
      where: { OR: [{ id: req.params.id }, { packet_number: req.params.id }] },
    });
    if (!existing) return notFound(res, 'Packet not found');
    if (existing.status === 'dispatched')
      return badRequest(res, 'Packet already dispatched');
    const updated = await prisma.packet.update({
      where: { id: existing.id },
      data: { status: 'dispatched', dispatch_date: new Date() },
    });
    await prisma.transaction.create({
      data: {
        txn_date: new Date(),
        activity: 'Pkt_Out',
        party_id: updated.party_id,
        packet_id: updated.id,
        coil_grade: updated.coil_grade,
        net_weight_kg: updated.net_weight_kg,
        created_by: req.user.id,
      },
    });
    await log({ userId: req.user.id, actionType: 'PACKET_DISPATCHED', entityType: 'packet',
      entityId: updated.id, description: `Packet ${updated.packet_number} dispatched`, ip: req.ip });
    return success(res, 'Packet dispatched', { id: updated.id });
  } catch (err) { next(err); }
};
