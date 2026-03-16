const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { success, created, badRequest, unauthorized } = require('../utils/response');
const { log } = require('../services/activityLog');

const signTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' });
  return { accessToken, refreshToken };
};

// POST /api/auth/login  — accepts username
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return badRequest(res, 'Username and password required');
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.is_active) return unauthorized(res, 'Invalid credentials');
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return unauthorized(res, 'Invalid credentials');
    const { accessToken, refreshToken } = signTokens(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
    await log({ userId: user.id, actionType: 'USER_LOGIN', entityType: 'user', entityId: user.id, description: `${user.username} logged in`, ip: req.ip });
    return success(res, 'Login successful', {
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) { next(err); }
};

// POST /api/auth/refresh
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return unauthorized(res, 'Refresh token required');
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.is_active) return unauthorized(res, 'Invalid refresh token');
    const tokens = signTokens(user.id);
    return success(res, 'Token refreshed', tokens);
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return unauthorized(res, 'Invalid or expired token');
    next(err);
  }
};

// POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    await log({ userId: req.user?.id, actionType: 'USER_LOGOUT', entityType: 'user', entityId: req.user?.id, description: `${req.user?.username} logged out`, ip: req.ip });
    return success(res, 'Logged out');
  } catch (err) { next(err); }
};

// GET /api/auth/me
exports.me = async (req, res, next) => {
  try {
    return success(res, 'Current user', { id: req.user.id, username: req.user.username, email: req.user.email, role: req.user.role });
  } catch (err) { next(err); }
};
