const router = require('express').Router();
const prisma = require('../config/db');

// GET /health — no auth required, just a basic ping
router.get('/', async (req, res) => {
  try {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /health/db — test Neon connection with latency + endpoint info
router.get('/db', async (req, res) => {
  const start = Date.now();
  try {
    const [row] = await prisma.$queryRaw`SELECT version() AS pg_version, now() AS server_time`;
    const latencyMs = Date.now() - start;

    // Extract host from DATABASE_URL for display (mask credentials)
    let neonHost = null;
    try {
      const dbUrl = new URL(process.env.DATABASE_URL || '');
      neonHost = dbUrl.hostname;
    } catch (_) {}

    res.json({
      status: 'connected',
      provider: 'postgresql (Neon)',
      neon_host: neonHost,
      pg_version: row.pg_version,
      server_time: row.server_time,
      latency_ms: latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    res.status(503).json({
      status: 'error',
      provider: 'postgresql (Neon)',
      message: err.message,
      latency_ms: latencyMs,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/diagnose — detailed env diagnostic
router.get('/diagnose', async (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Not set',
      NODE_ENV: process.env.NODE_ENV,
      FRONTEND_URL: process.env.FRONTEND_URL,
    },
    connection: null,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    diagnostics.connection = { status: 'connected', provider: 'postgresql (Neon)' };
    res.json(diagnostics);
  } catch (err) {
    diagnostics.connection = { status: 'error', message: err.message };
    res.status(503).json(diagnostics);
  }
});

module.exports = router;
