const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { success, created, notFound, badRequest } = require('../utils/response');
const { log } = require('../services/activityLog');

const fmt = (u) => ({ id: u.id, username: u.username, email: u.email, role: u.role, status: u.is_active ? 'active' : 'inactive', lastLogin: u.last_login_at, created: u.created_at });

exports.getAll = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { created_at: 'desc' } });
    return success(res, 'Users', users.map(fmt));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !password) return badRequest(res, 'Username and password required');
    const existing = await prisma.user.findFirst({ where: { OR: [{ username }, ...(email ? [{ email }] : [])] } });
    if (existing) return badRequest(res, 'Username or email already exists');
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { username, email: email || null, password_hash, role: role || 'operator' } });
    await log({ userId: req.user.id, actionType: 'USER_CREATED', entityType: 'user', entityId: user.id, description: `User ${username} created`, ip: req.ip });
    return created(res, 'User created', fmt(user));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return notFound(res, 'User not found');
    const { email, role, is_active, password } = req.body;
    const data = {};
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (is_active !== undefined) data.is_active = is_active;
    if (password) data.password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    await log({ userId: req.user.id, actionType: 'USER_UPDATED', entityType: 'user', entityId: user.id, description: `User ${user.username} updated`, ip: req.ip });
    return success(res, 'User updated', fmt(user));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return notFound(res, 'User not found');
    if (req.params.id === req.user.id) return badRequest(res, 'Cannot deactivate yourself');
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { is_active: false } });
    return success(res, 'User deactivated', null);
  } catch (err) { next(err); }
};
