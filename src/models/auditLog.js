const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', index: true },
  actorRole: { type: String, enum: ['SUPERADMIN', 'admin', 'client', 'anonymous'] },
  actorIp: String,
  event: { type: String, required: true, index: true },
  deviceId: { type: String, index: true },
  deviceOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  result: { type: String, enum: ['allowed', 'denied', 'error'], required: true },
  reason: String,
  requestId: String,
  socketId: String,
  payload: mongoose.Schema.Types.Mixed
}, {
  collection: 'audit_events'
});

auditLogSchema.index({ ts: -1, event: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
