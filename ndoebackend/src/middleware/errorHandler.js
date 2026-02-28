const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Prisma: unique constraint violation
  if (err.code === 'P2002') {
    const fields = err.meta?.target?.join(', ') || 'field';
    message = `${fields} already exists`;
    statusCode = 409;
  }

  // Prisma: record not found
  if (err.code === 'P2025') {
    message = err.meta?.cause || 'Record not found';
    statusCode = 404;
  }

  // Prisma: foreign key constraint failed
  if (err.code === 'P2003') {
    message = 'Related record not found';
    statusCode = 400;
  }

  // Prisma: invalid UUID / value
  if (err.code === 'P2023' || err.code === 'P2006') {
    message = 'Invalid identifier format';
    statusCode = 400;
  }

  logger.error(`[${req.method}] ${req.originalUrl} — ${statusCode}: ${message}`);

  res.status(statusCode).json({
    success: false,
    message,
    error_code: err.error_code || 'SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
