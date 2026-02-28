require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

// CORS — allow any localhost in dev, configured FRONTEND_URL + Vercel in prod
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, skip: (req) => req.path === '/health' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.use('/health', require('./src/routes/health'));

// ─── API v1 routes ────────────────────────────────────────────────────────────
app.use('/api/v1/auth',         require('./src/routes/auth'));
app.use('/api/v1/users',        require('./src/routes/users'));
app.use('/api/v1/parties',      require('./src/routes/parties'));
app.use('/api/v1/coils',        require('./src/routes/coils'));
app.use('/api/v1/packets',      require('./src/routes/packets'));
app.use('/api/v1/transfers',    require('./src/routes/transfers'));
app.use('/api/v1/pricing',      require('./src/routes/pricing'));
app.use('/api/v1/transactions', require('./src/routes/transactions'));
app.use('/api/v1/reports',      require('./src/routes/reports'));
app.use('/api/v1/settings',     require('./src/routes/settings'));
app.use('/api/v1/export',       require('./src/routes/export'));

// 404
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
