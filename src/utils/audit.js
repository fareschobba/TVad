// Async fire-and-forget audit logging. Never throws — never blocks request flow.

const AuditLog = require('../models/auditLog');

function audit({
  event,
  actor = null,
  actorIp = null,
  deviceId = null,
  deviceOwnerId = null,
  result = 'allowed',
  reason = null,
  requestId = null,
  socketId = null,
  payload = null
}) {
  // Sanitize payload: never persist secrets
  let safePayload = payload;
  if (payload && typeof payload === 'object') {
    safePayload = { ...payload };
    delete safePayload.password;
    delete safePayload.token;
    delete safePayload.currentPassword;
    delete safePayload.newPassword;
  }
  AuditLog.create({
    event,
    actorId: actor?._id || actor?.id || null,
    actorRole: actor?.role || 'anonymous',
    actorIp,
    deviceId,
    deviceOwnerId,
    result,
    reason,
    requestId,
    socketId,
    payload: safePayload
  }).catch(err => {
    console.error('[Audit] failed to write audit entry:', err.message);
  });
}

module.exports = { audit };
