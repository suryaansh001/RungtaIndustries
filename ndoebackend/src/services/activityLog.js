const prisma = require('../config/db');

/**
 * Write an activity log entry (fire-and-forget — never block request on log failure)
 */
const log = async ({ userId, actionType, entityType, entityId, description, ip = null }) => {
  try {
    await prisma.activityLog.create({
      data: {
        user_id: userId || null,
        action_type: actionType,
        entity_type: entityType || null,
        entity_id: entityId ? String(entityId) : null,
        description,
        ip_address: ip,
      },
    });
  } catch (err) {
    // Never crash request pipeline for a logging failure
    console.error('ActivityLog write failed:', err.message);
  }
};

module.exports = { log };
