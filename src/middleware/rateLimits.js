// Rate limit factories used by REST routes and Socket.IO handlers.

const rateLimit = require('express-rate-limit');

// REST: brute-force login + general API.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in a minute.' }
});

const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

const pairLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many pairing attempts. Try again in a minute.' }
});

// Socket: per-(socket, event, deviceId) token-bucket-ish counter.
const socketLimits = new Map(); // key: `${socketId}:${event}:${deviceId}` -> { count, resetAt }

function socketAllow(socketId, event, deviceId, max, windowMs) {
  const key = `${socketId}:${event}:${deviceId || '*'}`;
  const now = Date.now();
  const entry = socketLimits.get(key);
  if (!entry || entry.resetAt < now) {
    socketLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

// Periodic sweep
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of socketLimits) {
    if (v.resetAt < now) socketLimits.delete(k);
  }
}, 60_000).unref?.();

const SOCKET_LIMITS = {
  restartApp:        { max: 3,  windowMs: 60_000 },
  cleanUsbStorage:   { max: 2,  windowMs: 60_000 },
  clearCache:        { max: 10, windowMs: 60_000 },
  healthCheck:       { max: 30, windowMs: 60_000 },
  requestDeviceState:{ max: 30, windowMs: 60_000 },
  requestLogs:       { max: 10, windowMs: 60_000 },
  stopLogs:          { max: 30, windowMs: 60_000 }
};

function socketEventGuard(socket, event, deviceId) {
  const cfg = SOCKET_LIMITS[event];
  if (!cfg) return true;
  return socketAllow(socket.id, event, deviceId, cfg.max, cfg.windowMs);
}

module.exports = { loginLimiter, generalApiLimiter, pairLimiter, socketEventGuard };
