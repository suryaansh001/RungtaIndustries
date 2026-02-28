const cron = require('node-cron');
const prisma = require('../config/db');
const logger = require('../utils/logger');

const runOverdueCheck = async () => {
  try {
    const now = new Date();
    const overdueInvoices = await prisma.invoice.findMany({
      where: { status: 'PENDING', due_date: { lt: now } },
      select: { id: true, invoice_number: true, product_id: true },
    });
    if (overdueInvoices.length === 0) return;
    const invoiceIds = overdueInvoices.map((i) => i.id);
    const productIds = [...new Set(overdueInvoices.map((i) => i.product_id))];
    await prisma.invoice.updateMany({ where: { id: { in: invoiceIds } }, data: { status: 'OVERDUE' } });
    await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { billing_status: 'OVERDUE' } });
    logger.info(`Overdue check: ${overdueInvoices.length} invoice(s) marked OVERDUE`);
  } catch (err) {
    logger.error(`Overdue checker failed: ${err.message}`);
  }
};

const startOverdueJob = () => {
  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', () => {
    logger.info('Running scheduled overdue invoice check...');
    runOverdueCheck();
  });
  logger.info('Overdue checker cron job scheduled (daily 2:00 AM)');
};

module.exports = startOverdueJob;
