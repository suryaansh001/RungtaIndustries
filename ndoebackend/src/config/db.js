const { PrismaClient } = require('@prisma/client');

// Reconnect-aware Prisma singleton
// db.prisma.io (Prisma Postgres) drops idle connections after ~5 min.
// We handle this by:
//  1. Small pool (connection_limit=3) — fewer idle sockets to expire
//  2. Keepalive heartbeat every 4 min — pings DB to keep at least one socket alive
//  3. Auto-reconnect middleware — on P1017/P1001 errors, disconnect + reconnect then retry

function createClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  // Middleware: retry once on connection-lost errors
  client.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (err) {
      const code = err?.code ?? '';
      const msg  = (err?.message ?? '').toLowerCase();
      const isConnErr =
        code === 'P1017' ||   // server closed connection
        code === 'P1001' ||   // can't reach server
        code === 'P2024' ||   // connection pool timeout
        msg.includes('connection reset') ||
        msg.includes('connection closed') ||
        msg.includes('socket');

      if (isConnErr) {
        console.warn('[db] Connection error detected — reconnecting and retrying once…');
        try { await client.$disconnect(); } catch {}
        try { await client.$connect(); } catch {}
        return await next(params); // one retry
      }
      throw err;
    }
  });

  return client;
}

const prisma = global.__prisma || createClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Keepalive: run a lightweight query every 4 minutes to prevent idle timeout
const KEEPALIVE_MS = 4 * 60 * 1000;
const keepalive = setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.warn('[db] Keepalive ping failed:', e?.message ?? e);
    // The retry middleware will handle reconnection on the next real query
  }
}, KEEPALIVE_MS);
if (keepalive.unref) keepalive.unref(); // don't block process exit

module.exports = prisma;
