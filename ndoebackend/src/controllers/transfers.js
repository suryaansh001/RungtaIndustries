const prisma = require('../config/db');
const { success, created, notFound, badRequest } = require('../utils/response');
const { paginate, paginationMeta } = require('../utils/paginate');
const { log } = require('../services/activityLog');

const genTransferNumber = async () => {
  const year = new Date().getFullYear();
  const count = await prisma.transferOrder.count();
  return `TRF-${year}-${String(count + 1).padStart(4, '0')}`;
};

const formatTransfer = (t) => ({
  id: t.id,
  transferNumber: t.transfer_number,
  date: t.transfer_date?.toISOString?.().split('T')[0] || t.transfer_date,
  fromParty: t.from_party?.name || '',
  toParty: t.to_party?.name || '',
  coilCount: t.line_items?.length || 0,
  totalWeight: t.line_items?.reduce((s, li) => s + Number(li.weight_kg_snapshot || 0), 0) || 0,
  status: t.status,
  reversible: t.is_reversible,
  remark: t.remark || '',
  lineItems: t.line_items?.map((li) => ({
    id: li.id,
    coilId: li.coil_id,
    packetId: li.packet_id,
    coilNumber: li.coil_number_snapshot,
    weight: Number(li.weight_kg_snapshot || 0),
    size: li.size_snapshot || '',
    stage: li.snapshot_processing_stage || '',
  })) || [],
});

// GET /api/v1/transfers
exports.getAll = async (req, res, next) => {
  try {
    const { status, from_party_id, page, limit } = req.query;
    const { page: p, limit: l, skip } = paginate(req.query, page, limit);
    const where = {};
    if (status) where.status = status;
    if (from_party_id) where.from_party_id = from_party_id;
    const [transfers, total] = await Promise.all([
      prisma.transferOrder.findMany({
        where, skip, take: l,
        include: {
          from_party: { select: { name: true } },
          to_party: { select: { name: true } },
          line_items: { select: { id: true, coil_id: true, packet_id: true, coil_number_snapshot: true, weight_kg_snapshot: true, size_snapshot: true, snapshot_processing_stage: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.transferOrder.count({ where }),
    ]);
    return res.json({ success: true, data: transfers.map(formatTransfer), pagination: paginationMeta(total, p, l) });
  } catch (err) { next(err); }
};

// GET /api/v1/transfers/:id
exports.getOne = async (req, res, next) => {
  try {
    const transfer = await prisma.transferOrder.findFirst({
      where: { OR: [{ id: req.params.id }, { transfer_number: req.params.id }] },
      include: {
        from_party: { select: { name: true, id: true } },
        to_party: { select: { name: true, id: true } },
        line_items: true,
      },
    });
    if (!transfer) return notFound(res, 'Transfer not found');
    return success(res, 'Transfer found', formatTransfer(transfer));
  } catch (err) { next(err); }
};

// POST /api/v1/transfers  — creates transfer order + executes atomically
exports.create = async (req, res, next) => {
  try {
    const { from_party_id, to_party_id, coil_ids, packet_ids, transfer_date, is_reversible, remark } = req.body;
    if (!from_party_id || !to_party_id) return badRequest(res, 'from_party_id and to_party_id required');
    if (from_party_id === to_party_id) return badRequest(res, 'From and To parties must differ');
    if ((!coil_ids || !coil_ids.length) && (!packet_ids || !packet_ids.length))
      return badRequest(res, 'At least one coil or packet is required');

    const [fromParty, toParty] = await Promise.all([
      prisma.party.findUnique({ where: { id: from_party_id } }),
      prisma.party.findUnique({ where: { id: to_party_id } }),
    ]);
    if (!fromParty || !toParty) return notFound(res, 'Party not found');

    const transfer = await prisma.$transaction(async (tx) => {
      const transfer_number = await genTransferNumber();
      const txDate = transfer_date ? new Date(transfer_date) : new Date();

      // ── Lock + validate coils (SELECT FOR UPDATE via raw SQL) ──
      const lineItemsData = [];
      if (coil_ids && coil_ids.length) {
        // Lock rows for the duration of this transaction
        const coils = await tx.$queryRawUnsafe(
          `SELECT id, coil_number, net_weight_kg, size, processing_stage, current_party_id, coil_grade
           FROM "Coil"
           WHERE id = ANY($1::uuid[])
           FOR UPDATE NOWAIT`,
          coil_ids
        );
        if (coils.length !== coil_ids.length) throw new Error('One or more coils not found');
        for (const coil of coils) {
          if (coil.current_party_id !== from_party_id)
            throw new Error(`Coil ${coil.coil_number} does not belong to ${fromParty.name}`);
          lineItemsData.push({
            coil_id: coil.id,
            coil_number_snapshot: coil.coil_number,
            weight_kg_snapshot: coil.net_weight_kg,
            size_snapshot: coil.size,
            snapshot_processing_stage: coil.processing_stage,
            prev_party_id: from_party_id,
            new_party_id: to_party_id,
          });
        }
        // Update coil ownership
        await tx.coil.updateMany({ where: { id: { in: coil_ids } }, data: { current_party_id: to_party_id } });
        // Write ledger entries
        for (const coil of coils) {
          await tx.transaction.create({
            data: {
              txn_date: txDate, activity: 'Coil_Transfer_Out',
              party_id: from_party_id, coil_id: coil.id, coil_grade: coil.coil_grade,
              net_weight_kg: -Math.abs(Number(coil.net_weight_kg)), remark, created_by: req.user.id,
            },
          });
          await tx.transaction.create({
            data: {
              txn_date: txDate, activity: 'Coil_Transfer_In',
              party_id: to_party_id, coil_id: coil.id, coil_grade: coil.coil_grade,
              net_weight_kg: Math.abs(Number(coil.net_weight_kg)), remark, created_by: req.user.id,
            },
          });
        }
      }

      // ── Lock + validate packets ──
      if (packet_ids && packet_ids.length) {
        const packets = await tx.$queryRawUnsafe(
          `SELECT id, packet_number, net_weight_kg, size, coil_grade, party_id
           FROM "Packet"
           WHERE id = ANY($1::uuid[])
           FOR UPDATE NOWAIT`,
          packet_ids
        );
        for (const pkt of packets) {
          if (pkt.party_id !== from_party_id)
            throw new Error(`Packet ${pkt.packet_number} does not belong to ${fromParty.name}`);
          lineItemsData.push({
            packet_id: pkt.id,
            coil_number_snapshot: pkt.packet_number,
            weight_kg_snapshot: pkt.net_weight_kg,
            size_snapshot: pkt.size,
            prev_party_id: from_party_id,
            new_party_id: to_party_id,
          });
        }
        await tx.packet.updateMany({ where: { id: { in: packet_ids } }, data: { party_id: to_party_id } });
        for (const pkt of packets) {
          await tx.transaction.create({
            data: {
              txn_date: txDate, activity: 'Pkt_Transfer_Out',
              party_id: from_party_id, packet_id: pkt.id, coil_grade: pkt.coil_grade,
              net_weight_kg: -Math.abs(Number(pkt.net_weight_kg)), remark, created_by: req.user.id,
            },
          });
          await tx.transaction.create({
            data: {
              txn_date: txDate, activity: 'Pkt_Transfer_In',
              party_id: to_party_id, packet_id: pkt.id, coil_grade: pkt.coil_grade,
              net_weight_kg: Math.abs(Number(pkt.net_weight_kg)), remark, created_by: req.user.id,
            },
          });
        }
      }

      // Create transfer order
      const order = await tx.transferOrder.create({
        data: {
          transfer_number,
          from_party_id, to_party_id,
          transfer_type: coil_ids?.length ? 'coil_transfer' : 'packet_transfer',
          status: 'completed',
          transfer_date: txDate,
          is_reversible: is_reversible || false,
          remark,
          created_by: req.user.id,
          line_items: { create: lineItemsData },
        },
        include: { from_party: { select: { name: true } }, to_party: { select: { name: true } }, line_items: true },
      });
      // Link transactions to transfer order
      await tx.transaction.updateMany({
        where: { party_id: { in: [from_party_id, to_party_id] }, transfer_order_id: null, created_at: { gte: new Date(Date.now() - 5000) } },
        data: { transfer_order_id: order.id },
      });
      return order;
    }, { timeout: 15000 });

    await log({ userId: req.user.id, actionType: 'TRANSFER_CREATED', entityType: 'transfer', entityId: transfer.id, description: `Transfer ${transfer.transfer_number} from ${fromParty.name} to ${toParty.name}`, ip: req.ip });
    return created(res, 'Transfer completed', formatTransfer(transfer));
  } catch (err) {
    if (err.code === 'P2034' || err.message?.includes('NOWAIT')) return res.status(409).json({ success: false, message: 'Concurrent transfer in progress. Try again.' });
    if (err.message?.includes('does not belong')) return res.status(422).json({ success: false, message: err.message });
    next(err);
  }
};
