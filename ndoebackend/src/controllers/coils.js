const prisma = require('../config/db');
const { success, created, notFound, badRequest } = require('../utils/response');
const { paginate, paginationMeta } = require('../utils/paginate');
const { log } = require('../services/activityLog');

const STAGE_MAP = {
  received: { stage: 'Stock', status: 'in_stock' },
  stage1: { stage: 'Processing', status: 'processing' },
  stage2: { stage: 'Processing', status: 'processing' },
  stage3: { stage: 'Processing', status: 'processing' },
  completed: { stage: 'Completed', status: 'dispatched' },
};

const FORM_MAP = {
  coil: 'Full', slit_coil: 'Slit', rewound_coil: 'Rewound', sheet: 'Sheet', packet: 'Packet',
};

const computeRemainingWeight = (coil) => {
  const txnSum = coil.transactions.reduce((s, t) => s + Number(t.net_weight_kg || 0), 0);
  return Math.max(0, txnSum);
};

const formatCoil = (c, today = new Date()) => {
  const { stage, status } = STAGE_MAP[c.processing_stage] || STAGE_MAP.received;
  const remainingWeight = computeRemainingWeight(c);
  const holdingDays = Math.floor((today - new Date(c.stock_in_date)) / 86400000);
  return {
    id: c.id,
    coilNumber: c.coil_number,
    partyId: c.current_party_id,
    partyName: c.current_party?.name || '',
    size: c.size,
    productType: c.coil_grade,             // HR/CR/GP — the grade
    coilType: FORM_MAP[c.product_form] || 'Full',  // Full/Slit — the form
    stage,
    jwLine: c.jw_line || '',
    weight: Number(c.net_weight_kg),
    remainingWeight,
    holdingDays,
    status,
    thickness: Number(c.thickness_mm || 0),
    width: Number(c.width_mm || 0),
    length: Number(c.length_mm || 0),
    kataWeight: Number(c.kata_weight_kg || 0),
    stockInDate: c.stock_in_date?.toISOString?.().split('T')[0] || c.stock_in_date,
    truckDo: c.truck_do_number || '',
    kantaName: c.kanta_name || '',
    kataNumber: c.kata_number || '',
    chalanNumber: c.chalan_number || '',
    rate: Number(c.rate_per_kg || 0),
    remark: c.remark || '',
    processingStage: c.processing_stage,
    originalPartyId: c.original_party_id,
  };
};

// GET /api/v1/coils
exports.getAll = async (req, res, next) => {
  try {
    const { search, party_id, status, grade, page, limit } = req.query;
    const { page: p, limit: l, skip } = paginate(req.query, page, limit);
    const where = {};
    if (search) where.OR = [{ coil_number: { contains: search, mode: 'insensitive' } }];
    if (party_id) where.current_party_id = party_id;
    if (grade) where.coil_grade = grade;
    if (status === 'in_stock') where.processing_stage = 'received';
    else if (status === 'processing') where.processing_stage = { in: ['stage1', 'stage2', 'stage3'] };
    else if (status === 'dispatched') where.processing_stage = 'completed';

    const [coils, total] = await Promise.all([
      prisma.coil.findMany({
        where,
        skip, take: l,
        include: { current_party: { select: { name: true } }, transactions: { select: { net_weight_kg: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.coil.count({ where }),
    ]);
    const today = new Date();
    return res.json({ success: true, data: coils.map((c) => formatCoil(c, today)), pagination: paginationMeta(total, p, l) });
  } catch (err) { next(err); }
};

// GET /api/v1/coils/:id
exports.getOne = async (req, res, next) => {
  try {
    const coil = await prisma.coil.findFirst({
      where: { OR: [{ id: req.params.id }, { coil_number: req.params.id }] },
      include: {
        current_party: { select: { name: true } },
        original_party: { select: { name: true } },
        transactions: {
          orderBy: { created_at: 'asc' },
          select: { id: true, txn_date: true, activity: true, net_weight_kg: true, amount_charged: true, remark: true, coil_grade: true },
        },
        transfer_items: {
          include: { transfer_order: { select: { transfer_number: true, transfer_date: true, status: true } } },
        },
      },
    });
    if (!coil) return notFound(res, 'Coil not found');
    const formatted = formatCoil(coil);
    formatted.ledger = coil.transactions.map((t) => ({
      id: t.id,
      date: t.txn_date,
      activity: t.activity.replace(/_/g, ' '),
      weight: Number(t.net_weight_kg || 0),
      amount: Number(t.amount_charged || 0),
      remark: t.remark || '',
    }));
    formatted.transfers = coil.transfer_items.map((ti) => ({
      transferNumber: ti.transfer_order?.transfer_number,
      date: ti.transfer_order?.transfer_date,
      status: ti.transfer_order?.status,
      weightSnapshot: Number(ti.weight_kg_snapshot || 0),
    }));
    return success(res, 'Coil found', formatted);
  } catch (err) { next(err); }
};

// POST /api/v1/coils
exports.create = async (req, res, next) => {
  try {
    const { coil_number, party_id, coil_grade, product_form, size, thickness_mm, width_mm, length_mm,
      net_weight_kg, kata_weight_kg, truck_do_number, kanta_name, kata_number, chalan_number,
      jw_line, stock_in_date, remark } = req.body;

    if (!coil_number || !party_id || !coil_grade || !size || !net_weight_kg)
      return badRequest(res, 'coil_number, party_id, coil_grade, size, net_weight_kg are required');

    const party = await prisma.party.findFirst({ where: { id: party_id, is_active: true } });
    if (!party) return notFound(res, 'Party not found');

    // Fetch current rate from pricing config
    const pricing = await prisma.pricingConfig.findFirst({
      where: { coil_grade, activity_type: 'storage', is_active: true },
      orderBy: { effective_from: 'desc' },
    });

    const coil = await prisma.$transaction(async (tx) => {
      const c = await tx.coil.create({
        data: {
          coil_number,
          current_party_id: party_id,
          original_party_id: party_id,
          coil_grade,
          product_form: product_form || 'coil',
          size,
          thickness_mm: thickness_mm ? parseFloat(thickness_mm) : null,
          width_mm: width_mm ? parseFloat(width_mm) : null,
          length_mm: length_mm ? parseFloat(length_mm) : null,
          net_weight_kg: parseFloat(net_weight_kg),
          kata_weight_kg: kata_weight_kg ? parseFloat(kata_weight_kg) : null,
          truck_do_number, kanta_name, kata_number, chalan_number, jw_line,
          rate_per_kg: pricing ? pricing.rate : null,
          stock_in_date: stock_in_date ? new Date(stock_in_date) : new Date(),
          remark,
          created_by: req.user.id,
        },
      });
      // Write stock-in transaction (immutable ledger)
      await tx.transaction.create({
        data: {
          txn_date: stock_in_date ? new Date(stock_in_date) : new Date(),
          activity: 'Coil_In',
          party_id,
          coil_id: c.id,
          coil_grade,
          net_weight_kg: parseFloat(net_weight_kg), // +ve inflow
          rate_applied: pricing ? pricing.rate : null,
          truck_do_number, chalan_number, jw_line, remark,
          created_by: req.user.id,
        },
      });
      return c;
    });

    await log({ userId: req.user.id, actionType: 'COIL_CREATED', entityType: 'coil', entityId: coil.id, description: `Coil ${coil_number} stock-in for ${party.name}`, ip: req.ip });
    return created(res, 'Coil added', { id: coil.id, coilNumber: coil.coil_number });
  } catch (err) { next(err); }
};

// PATCH /api/v1/coils/:id/stage
exports.updateStage = async (req, res, next) => {
  try {
    const { stage, jw_line, remark, output_weight_kg } = req.body;
    const validStages = ['stage1', 'stage2', 'stage3', 'completed'];
    if (!validStages.includes(stage)) return badRequest(res, `Invalid stage. Must be one of: ${validStages.join(', ')}`);

    const coil = await prisma.coil.findUnique({ where: { id: req.params.id } });
    if (!coil) return notFound(res, 'Coil not found');

    const stageOrder = { received: 0, stage1: 1, stage2: 2, stage3: 3, completed: 4 };
    if (stageOrder[stage] <= stageOrder[coil.processing_stage])
      return badRequest(res, `Cannot move backward. Current stage: ${coil.processing_stage}`);

    await prisma.$transaction(async (tx) => {
      await tx.coil.update({ where: { id: req.params.id }, data: { processing_stage: stage, jw_line: jw_line || coil.jw_line } });
      // Write processing transaction
      if (output_weight_kg) {
        await tx.transaction.create({
          data: {
            txn_date: new Date(),
            activity: stage === 'completed' ? 'JW_C' : 'JW_R',
            party_id: coil.current_party_id,
            coil_id: coil.id,
            coil_grade: coil.coil_grade,
            net_weight_kg: -Math.abs(parseFloat(output_weight_kg)), // -ve outflow from processing
            jw_line: jw_line || coil.jw_line,
            remark: remark || `Stage updated to ${stage}`,
            created_by: req.user.id,
          },
        });
      }
    });

    await log({ userId: req.user.id, actionType: 'COIL_STAGE_UPDATED', entityType: 'coil', entityId: req.params.id, description: `Coil ${coil.coil_number} moved to ${stage}`, ip: req.ip });
    return success(res, 'Stage updated');
  } catch (err) { next(err); }
};

// PATCH /api/v1/coils/:id
exports.update = async (req, res, next) => {
  try {
    const coil = await prisma.coil.findUnique({ where: { id: req.params.id } });
    if (!coil) return notFound(res, 'Coil not found');
    const { jw_line, remark } = req.body;
    await prisma.coil.update({ where: { id: req.params.id }, data: { jw_line, remark } });
    return success(res, 'Coil updated');
  } catch (err) { next(err); }
};
