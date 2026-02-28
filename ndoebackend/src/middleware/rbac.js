const { forbidden } = require('../utils/response');

// Role hierarchy: admin > manager > operator > viewer
const roleHierarchy = { admin: 4, manager: 3, operator: 2, viewer: 1 };

/**
 * Allow only specific roles
 * @param  {...string} roles
 */
const allow = (...roles) => (req, res, next) => {
  if (!req.user) return forbidden(res, 'Not authenticated');
  if (!roles.includes(req.user.role)) {
    return forbidden(res, 'Insufficient permissions');
  }
  next();
};

/**
 * Allow users with minimum role level
 * @param {string} minRole
 */
const atLeast = (minRole) => (req, res, next) => {
  if (!req.user) return forbidden(res, 'Not authenticated');
  if (roleHierarchy[req.user.role] < roleHierarchy[minRole]) {
    return forbidden(res, 'Insufficient permissions');
  }
  next();
};

module.exports = { allow, atLeast };
