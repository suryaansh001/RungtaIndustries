const prisma = require('../config/db');
const { success } = require('../utils/response');

exports.get = async (req, res, next) => {
  try {
    let settings = await prisma.settings.findFirst();
    if (!settings) settings = await prisma.settings.create({ data: {} });
    return success(res, 'Settings retrieved', settings);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    let settings = await prisma.settings.findFirst();
    const allowed = ['gst_percentage','company_name','company_address','company_mobile','company_email','invoice_prefix','invoice_due_days','auto_overdue_days','bank_details','footer_notes'];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (!settings) {
      settings = await prisma.settings.create({ data });
    } else {
      settings = await prisma.settings.update({ where: { id: settings.id }, data });
    }
    return success(res, 'Settings updated', settings);
  } catch (err) { next(err); }
};
