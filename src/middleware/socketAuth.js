// Dual-mode Socket.IO auth.
//   - If handshake.auth.token is present → verify JWT, attach socket.data.user, mode='admin'.
//   - If handshake.auth.deviceId + deviceSecret present → validate against the stored hash;
//     match → mode='device', deviceAuthenticated=true. Wrong secret → reject.
//   - If neither present → allow connection in mode='device' (legacy/anonymous device).
//   - If token present but invalid → reject.
//
// Per-event authorization (admin-only events, ownership checks) is enforced inside
// individual handlers via helpers in socketAuthz.js. K2 control-plane enforcement
// (rejecting un-authenticated devices) is gated by ENFORCE_DEVICE_AUTH in socket.js.

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const AdminUser = require('../models/adminUser');
const Device = require('../models/device');

const hashDeviceSecret = (secret) => crypto.createHash('sha256').update(secret).digest('hex');

async function attachAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token || null;

    if (!token) {
      // No admin token. Check for device credentials (K2).
      const deviceId = socket.handshake.auth?.deviceId || null;
      const deviceSecret = socket.handshake.auth?.deviceSecret || null;

      socket.data.mode = 'device';
      socket.data.user = null;
      socket.data.deviceAuthenticated = false;

      if (deviceId && deviceSecret) {
        try {
          const device = await Device.findOne({
            deviceId: String(deviceId).toUpperCase(),
            isDeleted: false
          }).select('+socketSecretHash deviceId').lean();

          // Constant-time-ish comparison via fixed-length hex hashes.
          const expected = device?.socketSecretHash || '';
          const provided = hashDeviceSecret(String(deviceSecret));
          const ok = expected.length > 0 &&
            expected.length === provided.length &&
            crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));

          if (ok) {
            socket.data.deviceAuthenticated = true;
            socket.data.deviceId = device.deviceId;
          } else {
            // A wrong/forged secret is an attack signal, not a legacy client — reject.
            return next(new Error('unauthorized: invalid device credentials'));
          }
        } catch (e) {
          return next(new Error('unauthorized: device auth error'));
        }
      }
      return next();
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return next(new Error('unauthorized: invalid token'));
    }

    const user = await AdminUser.findById(decoded.id).select('-password').lean();
    if (!user || user.isDeleted || !user.isActive) {
      return next(new Error('unauthorized: user inactive or removed'));
    }

    socket.data.mode = 'admin';
    socket.data.user = {
      _id: user._id,
      id: user._id.toString(),
      role: user.role,
      username: user.username
    };
    next();
  } catch (err) {
    console.error('[SocketAuth] unexpected error:', err.message);
    next(new Error('unauthorized: internal error'));
  }
}

module.exports = { attachAuth };
