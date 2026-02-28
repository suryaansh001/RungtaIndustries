const prisma = require('../config/db');
const { success, created, notFound, badRequest } = require('../utils/response');

const fmt = (p) => ({
  id: p.id,
  productType: p.coil_grade,
  activity: p.activity_type,
  jwLine: p.jw_line || null,
  rate: Number(p.rate),
  unit: p.rate_unit,
  effectiveFrom: p.effective_from?.toISOString?.().split('T')[0] || p.effective_from,
  effectiveTo: p.effective_to?.toISOString?.().split('T')[0] || null,
  status: p.is_active && (!p.effective_to || new Date(p.effective_to) >= new Date()) ? 'active' : 'expired',
});

exports.getAll = async (req, res, next) => {
  try {
    const { grade, activity, status } = req.query;
    const where = {};
    if (grade) where.coil_grade = grade;
    if (activity) where.activity_type = activity;
    if (status === 'active') where.is_active = true;
    if (status === 'expired') where.is_active = false;
    const rows = await prisma.pricingConfig.findMany({ where, orderBy: [{ coil_grade: 'asc' }, { effective_from: 'desc' }] });
    return res.json({ success: true, data: rows.map(fmt) });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const p = await prisma.pricingConfig.findUnique({ where: { id: req.params.id } });
    if (!p) return notFound(res, 'Pricing config not found');
    return success(res, 'Found', fmt(p));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { coil_grade, activity_type, rate, rate_unit, jw_line, effective_from, effective_to } = req.body;
    if (!coil_grade || !activity_type || !rate || !rate_unit || !effective_from)
      return badRequest(res, 'coil_grade, activity_type, rate, rate_unit, effective_from are required');
    const p = await prisma.pricingConfig.create({
      data: { coil_grade, activity_type, rate, rate_unit, jw_line: jw_line || null, effective_from: new Date(effective_from), effective_to: effective_to ? new Date(effective_to) : null, created_by: req.user.id },
    });
    return created(res, 'Pricing config created', fmt(p));
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'A pricing config with this combination already exists for the same effective date' });
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { rate, rate_unit, effective_to, is_active } = req.body;
    const p = await prisma.pricingConfig.update({
      where: { id: req.params.id },
      data: { ...(rate !== undefined && { rate }), ...(rate_unit && { rate_unit }), ...(effective_to !== undefined && { effective_to: effective_to ? new Date(effective_to) : null }), ...(is_active !== undefined && { is_active }) },
    });
    return success(res, 'Updated', fmt(p));
  } catch (err) {
    if (err.code === 'P2025') return notFound(res, 'Pricing config not found');
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.pricingConfig.update({ where: { id: req.params.id }, data: { is_active: false, effective_to: new Date() } });
    return success(res, 'Pricing config deactivated');
  } catch (err) {
    if (err.code === 'P2025') return notFound(res, 'Pricing config not found');
    next(err);
  }
};
