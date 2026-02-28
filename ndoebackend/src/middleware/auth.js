const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { unauthorized, forbidden } = require('../utils/response');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return unauthorized(res, 'No token provided');
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, email: true, role: true, is_active: true },
    });
    if (!user || !user.is_active) return unauthorized(res, 'User not found or deactivated');
    req.user = user;
    next();
  } catch (err) {
    return unauthorized(res, 'Invalid or expired token');
  }
};

// authorize(...roles) — must come AFTER protect
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res);
  if (!roles.includes(req.user.role)) return forbidden(res, `Access restricted to: ${roles.join(', ')}`);
  next();
};

module.exports = { protect, authorize };
