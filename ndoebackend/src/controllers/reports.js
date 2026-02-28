const prisma = require('../config/db');

// GET /api/v1/dashboard  — KPI summary + aging + recent activity
exports.getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Parallel queries
    const [
      coilAgg,
      packetAgg,
      activeParties,
      transfersToday,
      recentActivity,
      allCoilsForAging,
    ] = await Promise.all([
      // Total coils (not dispatched = processing_stage != completed)
      prisma.coil.aggregate({
        where: { processing_stage: { not: 'completed' } },
        _count: { id: true },
        _sum: { net_weight_kg: true },
      }),
      // Total packets (not dispatched)
      prisma.packet.aggregate({
        where: { is_dispatched: false },
        _count: { id: true },
        _sum: { net_weight_kg: true },
      }),
      // Active parties (have at least one coil or packet)
      prisma.party.count({
        where: {
          is_active: true,
          OR: [
            { coils_owned: { some: { processing_stage: { not: 'completed' } } } },
            { packets_owned: { some: { is_dispatched: false } } },
          ],
        },
      }),
      // Transfers today
      prisma.transferOrder.count({
        where: { transfer_date: { gte: new Date(todayStr), lt: new Date(new Date(todayStr).setDate(new Date(todayStr).getDate() + 1)) } },
      }),
      // Recent activity (last 20 transactions)
      prisma.transaction.findMany({
        take: 20,
        orderBy: { created_at: 'desc' },
        include: {
          party: { select: { name: true } },
          coil: { select: { coil_number: true } },
          packet: { select: { packet_number: true } },
        },
      }),
      // All active coils with stock_in_date for aging
      prisma.coil.findMany({
        where: { processing_stage: { not: 'completed' } },
        select: { id: true, stock_in_date: true },
      }),
    ]);

    // Compute avg holding days
    const now = Date.now();
    const holdingDaysList = allCoilsForAging.map((c) => Math.floor((now - new Date(c.stock_in_date).getTime()) / 86400000));
    const avgHoldingDays = holdingDaysList.length
      ? Math.round(holdingDaysList.reduce((a, b) => a + b, 0) / holdingDaysList.length)
      : 0;

    // Aging buckets
    const aging = [
      { name: '0-30 days',  value: holdingDaysList.filter((d) => d <= 30).length,              fill: '#22c55e' },
      { name: '31-60 days', value: holdingDaysList.filter((d) => d > 30 && d <= 60).length,    fill: '#f59e0b' },
      { name: '61-90 days', value: holdingDaysList.filter((d) => d > 60 && d <= 90).length,    fill: '#f97316' },
      { name: '90+ days',   value: holdingDaysList.filter((d) => d > 90).length,               fill: '#ef4444' },
    ];

    // Format activity feed
    const activity = recentActivity.map((t) => ({
      id: t.id,
      date: t.txn_date?.toISOString?.().split('T')[0] || t.txn_date,
      activity: t.activity.replace(/_/g, '-').replace(/-(?=[A-Z])/g, ' '),
      partyName: t.party?.name || '',
      coilNumber: t.coil?.coil_number || null,
      packetNumber: t.packet?.packet_number || null,
      weight: t.net_weight_kg ? Number(t.net_weight_kg) : null,
      amount: t.amount_charged ? Number(t.amount_charged) : null,
      remark: t.remark || '',
    }));

    return res.json({
      success: true,
      data: {
        summary: {
          totalCoils: coilAgg._count.id,
          totalCoilWeight: Number(coilAgg._sum.net_weight_kg || 0),
          totalPackets: packetAgg._count.id,
          totalPacketWeight: Number(packetAgg._sum.net_weight_kg || 0),
          activeParties,
          transfersToday,
          billedThisMonth: 0,  // no billing module yet
          avgHoldingDays,
        },
        aging,
        activity,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/v1/reports/transactions  — ledger with filters
exports.getTransactions = async (req, res, next) => {
  try {
    const { party_id, coil_id, packet_id, activity, date_from, date_to, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {};
    if (party_id) where.party_id = party_id;
    if (coil_id) where.coil_id = coil_id;
    if (packet_id) where.packet_id = packet_id;
    if (activity) where.activity = activity;
    if (date_from || date_to) {
      where.txn_date = {};
      if (date_from) where.txn_date.gte = new Date(date_from);
      if (date_to) where.txn_date.lte = new Date(date_to);
    }
    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where, skip, take: Number(limit),
        orderBy: { txn_date: 'desc' },
        include: {
          party: { select: { name: true } },
          coil: { select: { coil_number: true } },
          packet: { select: { packet_number: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);
    const data = rows.map((t) => ({
      id: t.id,
      date: t.txn_date?.toISOString?.().split('T')[0] || t.txn_date,
      activity: t.activity,
      partyName: t.party?.name || '',
      coilNumber: t.coil?.coil_number || null,
      packetNumber: t.packet?.packet_number || null,
      productType: t.coil_grade || '',
      weight: t.net_weight_kg ? Number(t.net_weight_kg) : null,
      rate: t.rate_applied ? Number(t.rate_applied) : null,
      amount: t.amount_charged ? Number(t.amount_charged) : null,
      remark: t.remark || '',
    }));
    return res.json({ success: true, data, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (err) { next(err); }
};
