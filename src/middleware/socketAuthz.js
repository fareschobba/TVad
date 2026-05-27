// Per-event authorization helpers.
// Use INSIDE handlers, AFTER schema validation.

const Device = require('../models/device');
const { audit } = require('../utils/audit');

function isAdminRole(role) {
  return role === 'admin' || role === 'SUPERADMIN';
}

function requireAdminSocket(socket, event) {
  if (socket.data?.mode !== 'admin') {
    audit({
      event,
      result: 'denied',
      reason: 'admin_mode_required',
      socketId: socket.id,
      actorIp: socket.handshake.address
    });
    socket.emit('authError', { event, error: 'admin_required' });
    return false;
  }
  return true;
}

// Looks up the target device and verifies that the calling admin user is allowed to
// operate on it. Returns { ok: true, device } or { ok: false, status }.
//   - admin / SUPERADMIN → any device
//   - client → only devices where device.userId === user._id
async function canOperateOnDevice(socket, event, deviceId) {
  const user = socket.data?.user;
  if (!user) {
    return { ok: false, status: 'unauthorized' };
  }

  // Device lookup by deviceId string (the 5-char id), not Mongo _id.
  const device = await Device.findOne({ deviceId, isDeleted: false })
    .select('_id deviceId userId')
    .lean();

  if (!device) {
    audit({
      event,
      actor: user,
      actorIp: socket.handshake.address,
      deviceId,
      socketId: socket.id,
      result: 'denied',
      reason: 'device_not_found'
    });
    return { ok: false, status: 'not_found' };
  }

  if (!isAdminRole(user.role) && String(device.userId) !== String(user._id)) {
    audit({
      event,
      actor: user,
      actorIp: socket.handshake.address,
      deviceId,
      deviceOwnerId: device.userId,
      socketId: socket.id,
      result: 'denied',
      reason: 'cross_tenant'
    });
    return { ok: false, status: 'forbidden' };
  }

  return { ok: true, device };
}

module.exports = { requireAdminSocket, canOperateOnDevice, isAdminRole };
