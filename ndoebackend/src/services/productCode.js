const prisma = require('../config/db');

/**
 * Generate an atomic sequential product code
 * Format: PROD-YYYY-XXXX  e.g. PROD-2026-0043
 */
const generateProductCode = async (prefix = 'PROD') => {
  const year = new Date().getFullYear();
  const counterId = `${prefix}-${year}`;
  const counter = await prisma.$transaction((tx) =>
    tx.counter.upsert({
      where: { id: counterId },
      create: { id: counterId, seq: 1 },
      update: { seq: { increment: 1 } },
    })
  );
  return `${prefix}-${year}-${String(counter.seq).padStart(4, '0')}`;
};

/**
 * Generate an atomic sequential invoice number
 * Format: INV-YYYY-XXXX  e.g. INV-2026-0012
 */
const generateInvoiceNumber = async (prefix = 'INV') => {
  const year = new Date().getFullYear();
  const counterId = `${prefix}-${year}`;
  const counter = await prisma.$transaction((tx) =>
    tx.counter.upsert({
      where: { id: counterId },
      create: { id: counterId, seq: 1 },
      update: { seq: { increment: 1 } },
    })
  );
  return `${prefix}-${year}-${String(counter.seq).padStart(4, '0')}`;
};

module.exports = { generateProductCode, generateInvoiceNumber };
