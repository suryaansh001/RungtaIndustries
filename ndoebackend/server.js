require('dotenv').config();
const app = require('./app');
const prisma = require('./src/config/db');
const logger = require('./src/utils/logger');
const startOverdueJob = require('./src/jobs/overdueChecker');

const PORT = process.env.PORT || 8000;

const start = async () => {
  try {
    logger.info('🔗 Connecting to PostgreSQL (Neon) via Prisma...');
    await prisma.$connect();
    logger.info('✅ PostgreSQL connection established');

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
      startOverdueJob();
    });

    server.on('error', (err) => {
      logger.error(`Server error: ${err.message}`);
      process.exit(1);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Server closed, Prisma disconnected');
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();
