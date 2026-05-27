// Socket.IO server config — hardened for the Angular admin migration.
//
// Key changes vs. legacy:
//   - io.use(attachAuth) installs dual-mode auth (admin JWT or anonymous device).
//   - Admin-mode sockets join an `admins` room. Device-mode sockets join `device_${deviceId}`.
//   - Every admin-initiated event is: schema-validated → admin-mode-checked → ownership-checked
//     → rate-limited → request registered → forwarded to device room.
//   - Every device-emitted response is correlated by requestId via the registry and emitted
//     to the originator socket only; falls back to `admins` room if registry expired.
//   - *StateChanged events are emitted to the `admins` room (no longer broadcast to every
//     connected client including devices).
//   - logsData runs through a redactor before forwarding to admins.

const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const {
  createLogSession,
  endLogSession,
  getActiveSessionsForDevice,
  getActiveSessionsForAdmin,
  updateDeviceSocketId,
  cleanupSessionsForSocket
} = require('../controllers/logController');

const { attachAuth } = require('../middleware/socketAuth');
const { requireAdminSocket, canOperateOnDevice, isAdminRole } = require('../middleware/socketAuthz');
const { socketEventGuard } = require('../middleware/rateLimits');
const requestRegistry = require('../utils/requestRegistry');
const { redactLogs } = require('../utils/logRedactor');
const { audit } = require('../utils/audit');
const schemas = require('../utils/socketSchemas');

const ADMINS_ROOM = 'admins';
const deviceRoomFor = (deviceId) => `device_${deviceId}`;

// K2 dual-accept switch. While false (default), legacy/anonymous devices may still register
// and receive commands (migration window). Flip to 'true' once the whole fleet runs the
// secret-presenting APK to reject any un-authenticated device from the control plane.
const ENFORCE_DEVICE_AUTH = process.env.ENFORCE_DEVICE_AUTH === 'true';

// In-memory state cache (per-device latest snapshot). Kept across connections.
const deviceStates = new Map();

let io;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function parseOr(socket, event, schema, raw) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    socket.emit('validationError', {
      event,
      issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message }))
    });
    return null;
  }
  return parsed.data;
}

// Forward a request to the device room, registering for response correlation.
// Returns true on success (request was registered + emitted), false otherwise.
function dispatchToDevice({ socket, event, deviceId, requestId, payload }) {
  if (!requestRegistry.register({ requestId, originatorSocketId: socket.id, deviceId, event })) {
    // Duplicate requestId — already in flight or recently completed.
    return false;
  }

  const room = deviceRoomFor(deviceId);
  const occupants = io.sockets.adapter.rooms.get(room);
  const target = occupants && occupants.size > 0 ? io.to(room) : io;

  target.emit(`${event}/${deviceId}`, {
    ...payload,
    requestId,
    adminSocketId: socket.id
  });
  return true;
}

// Emit a device-originated response back to the originator admin only.
// Falls back to the `admins` room if the registry entry expired (defensive).
function relayResponseToOriginator(eventName, data) {
  const entry = requestRegistry.lookup(data?.requestId);
  if (entry) {
    requestRegistry.release(data.requestId);
    io.to(entry.originatorSocketId).emit(eventName, data);
  } else {
    // Late or unknown requestId — broadcast to admins so a refreshed tab still sees it.
    io.to(ADMINS_ROOM).emit(eventName, data);
  }
}

// Update in-memory snapshot for a device and emit to the admins room.
function updateAndBroadcastState(deviceId, slice, eventName, data) {
  if (!deviceId) return;
  if (!deviceStates.has(deviceId)) deviceStates.set(deviceId, {});
  const s = deviceStates.get(deviceId);
  Object.assign(s, slice);
  s.lastUpdate = Date.now();
  io.to(ADMINS_ROOM).emit(eventName, data);
}

// ────────────────────────────────────────────────────────────────────────────
// Init
// ────────────────────────────────────────────────────────────────────────────

module.exports = {
  init: (server) => {
    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    io = socketIO(server, {
      cors: {
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);
          if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
          return cb(new Error(`Origin ${origin} not allowed`));
        },
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    // Dual-mode auth on the handshake.
    io.use(attachAuth);

    io.on('connection', (socket) => {
      const mode = socket.data?.mode || 'device';
      const userId = socket.data?.user?.id || null;
      const total = io.sockets.sockets.size;
      console.log(`[Socket.IO] connected: id=${socket.id} mode=${mode} user=${userId} total=${total}`);

      if (mode === 'admin') {
        socket.join(ADMINS_ROOM);
      }

      // K2: an authenticated device proved ownership of its id at the handshake — auto-join
      // its room immediately so it doesn't depend on a (spoofable) registerDevice payload.
      if (socket.data.deviceAuthenticated && socket.data.deviceId) {
        socket.join(deviceRoomFor(socket.data.deviceId));
        console.log(`[Socket.IO] authenticated device ${socket.data.deviceId} auto-joined room on ${socket.id}`);
      }

      // ─── Device registration ───
      socket.on('registerDevice', (data) => {
        const parsed = parseOr(socket, 'registerDevice', schemas.registerDeviceSchema, data);
        if (!parsed) return;

        if (socket.data.deviceAuthenticated) {
          // Authenticated devices may only (re)register their own proven id.
          if (parsed.deviceId !== socket.data.deviceId) {
            return socket.emit('authError', { event: 'registerDevice', error: 'forbidden' });
          }
          socket.join(deviceRoomFor(parsed.deviceId));
          return;
        }

        // Un-authenticated (legacy/anonymous) device.
        if (ENFORCE_DEVICE_AUTH) {
          console.warn(`[Socket.IO] rejected unauthenticated registerDevice for ${parsed.deviceId} on ${socket.id}`);
          return socket.emit('authError', { event: 'registerDevice', error: 'device_auth_required' });
        }
        socket.join(deviceRoomFor(parsed.deviceId));
        socket.data.deviceId = parsed.deviceId;
        console.log(`[Socket.IO] device ${parsed.deviceId} registered on ${socket.id} (unauthenticated, migration window)`);
      });

      socket.on('message', (data) => { console.log(data); });

      // ─── Legacy *Web fan-outs (device → admin HTML dashboards) ───
      // Kept during dual-run with the old HTML pages. Targets `admins` room only.
      socket.on('currentAd',   (data) => io.to(ADMINS_ROOM).emit('currentAdWeb', data));
      socket.on('TVState',     (data) => io.to(ADMINS_ROOM).emit('TVStateWeb', data));
      socket.on('SystemState', (data) => io.to(ADMINS_ROOM).emit('SystemStateWeb', data));
      socket.on('AppState',    (data) => io.to(ADMINS_ROOM).emit('AppStateWeb', data));
      socket.on('returnState', (data) => io.to(ADMINS_ROOM).emit('returnStateWeb', data));

      // ─── checkStates (admin → devices) ───
      socket.on('checkStates', async (data) => {
        if (!requireAdminSocket(socket, 'checkStates')) return;
        const parsed = parseOr(socket, 'checkStates', schemas.checkStatesSchema, data);
        if (!parsed) return;

        for (const deviceId of parsed.devices) {
          const authz = await canOperateOnDevice(socket, 'checkStates', deviceId);
          if (!authz.ok) continue;
          const room = deviceRoomFor(deviceId);
          const occupants = io.sockets.adapter.rooms.get(room);
          const target = occupants && occupants.size > 0 ? io.to(room) : io;
          target.emit(`checkState/${deviceId}`, 'checkState');
        }
      });

      // ─── clearCache (admin → device) ───
      socket.on('clearCache', async (data) => {
        if (!requireAdminSocket(socket, 'clearCache')) return;
        const parsed = parseOr(socket, 'clearCache', schemas.clearCacheSchema, data);
        if (!parsed) return;
        const { deviceId, cacheType, requestId } = parsed;

        // Operations are admin/SUPERADMIN only — clients may monitor (state/health) but not control.
        if (!isAdminRole(socket.data.user?.role)) {
          return socket.emit('authError', { event: 'clearCache', error: 'forbidden', requestId });
        }

        if (!socketEventGuard(socket, 'clearCache', deviceId)) {
          return socket.emit('rateLimited', { event: 'clearCache', requestId });
        }
        const authz = await canOperateOnDevice(socket, 'clearCache', deviceId);
        if (!authz.ok) return socket.emit('authError', { event: 'clearCache', error: authz.status, requestId });

        audit({
          event: 'clearCache', actor: socket.data.user, actorIp: socket.handshake.address,
          deviceId, deviceOwnerId: authz.device.userId, socketId: socket.id, requestId,
          result: 'allowed', payload: { cacheType }
        });

        const ok = dispatchToDevice({ socket, event: 'clearCache', deviceId, requestId, payload: { cacheType } });
        if (!ok) socket.emit('duplicate', { event: 'clearCache', requestId });
      });

      // ─── healthCheck (admin → device) ───
      socket.on('healthCheck', async (data) => {
        if (!requireAdminSocket(socket, 'healthCheck')) return;
        const parsed = parseOr(socket, 'healthCheck', schemas.healthCheckSchema, data);
        if (!parsed) return;
        const { deviceId, requestId } = parsed;

        if (!socketEventGuard(socket, 'healthCheck', deviceId)) {
          return socket.emit('rateLimited', { event: 'healthCheck', requestId });
        }
        const authz = await canOperateOnDevice(socket, 'healthCheck', deviceId);
        if (!authz.ok) return socket.emit('authError', { event: 'healthCheck', error: authz.status, requestId });

        audit({
          event: 'healthCheck', actor: socket.data.user, actorIp: socket.handshake.address,
          deviceId, deviceOwnerId: authz.device.userId, socketId: socket.id, requestId, result: 'allowed'
        });

        const ok = dispatchToDevice({ socket, event: 'healthCheck', deviceId, requestId, payload: {} });
        if (!ok) socket.emit('duplicate', { event: 'healthCheck', requestId });
      });

      // ─── cleanUsbStorage (admin → device) ───
      socket.on('cleanUsbStorage', async (data) => {
        if (!requireAdminSocket(socket, 'cleanUsbStorage')) return;
        const parsed = parseOr(socket, 'cleanUsbStorage', schemas.cleanUsbStorageSchema, data);
        if (!parsed) return;
        const { deviceId, cleanType, requestId } = parsed;

        // Operations are admin/SUPERADMIN only — clients may monitor (state/health) but not control.
        if (!isAdminRole(socket.data.user?.role)) {
          return socket.emit('authError', { event: 'cleanUsbStorage', error: 'forbidden', requestId });
        }

        if (!socketEventGuard(socket, 'cleanUsbStorage', deviceId)) {
          return socket.emit('rateLimited', { event: 'cleanUsbStorage', requestId });
        }
        const authz = await canOperateOnDevice(socket, 'cleanUsbStorage', deviceId);
        if (!authz.ok) return socket.emit('authError', { event: 'cleanUsbStorage', error: authz.status, requestId });

        audit({
          event: 'cleanUsbStorage', actor: socket.data.user, actorIp: socket.handshake.address,
          deviceId, deviceOwnerId: authz.device.userId, socketId: socket.id, requestId,
          result: 'allowed', payload: { cleanType }
        });

        const ok = dispatchToDevice({ socket, event: 'cleanUsbStorage', deviceId, requestId, payload: { cleanType } });
        if (!ok) socket.emit('duplicate', { event: 'cleanUsbStorage', requestId });
      });

      // ─── restartApp (admin → device) ───
      socket.on('restartApp', async (data) => {
        if (!requireAdminSocket(socket, 'restartApp')) return;
        const parsed = parseOr(socket, 'restartApp', schemas.restartAppSchema, data);
        if (!parsed) return;
        const { deviceId, requestId } = parsed;

        // Operations are admin/SUPERADMIN only — clients may monitor (state/health) but not control.
        if (!isAdminRole(socket.data.user?.role)) {
          return socket.emit('authError', { event: 'restartApp', error: 'forbidden', requestId });
        }

        if (!socketEventGuard(socket, 'restartApp', deviceId)) {
          return socket.emit('rateLimited', { event: 'restartApp', requestId });
        }
        const authz = await canOperateOnDevice(socket, 'restartApp', deviceId);
        if (!authz.ok) return socket.emit('authError', { event: 'restartApp', error: authz.status, requestId });

        audit({
          event: 'restartApp', actor: socket.data.user, actorIp: socket.handshake.address,
          deviceId, deviceOwnerId: authz.device.userId, socketId: socket.id, requestId, result: 'allowed'
        });

        const ok = dispatchToDevice({ socket, event: 'restartApp', deviceId, requestId, payload: {} });
        if (!ok) socket.emit('duplicate', { event: 'restartApp', requestId });
      });

      // ─── requestDeviceState (admin → device) ───
      socket.on('requestDeviceState', async (data) => {
        if (!requireAdminSocket(socket, 'requestDeviceState')) return;
        const parsed = parseOr(socket, 'requestDeviceState', schemas.requestDeviceStateSchema, data);
        if (!parsed) return;
        const { deviceId, requestId } = parsed;

        if (!socketEventGuard(socket, 'requestDeviceState', deviceId)) {
          return socket.emit('rateLimited', { event: 'requestDeviceState', requestId });
        }
        const authz = await canOperateOnDevice(socket, 'requestDeviceState', deviceId);
        if (!authz.ok) return socket.emit('authError', { event: 'requestDeviceState', error: authz.status, requestId });

        const ok = dispatchToDevice({ socket, event: 'requestDeviceState', deviceId, requestId, payload: {} });
        if (!ok) socket.emit('duplicate', { event: 'requestDeviceState', requestId });
      });

      // ─── Device → admin response events (targeted reply) ───
      // K3: these are device-originated; reject if emitted by an admin-mode socket (anti-spoof).
      // NOTE: full enforcement (payload.deviceId === socket.data.deviceId) activates with K2,
      // once device sockets carry a verified deviceId. Until then this blocks admin-side forgery.
      socket.on('cacheCleared',      (data) => { if (socket.data.mode === 'admin') return; relayResponseToOriginator('cacheCleared', data); });
      socket.on('healthStatus',      (data) => { if (socket.data.mode === 'admin') return; relayResponseToOriginator('healthStatus', data); });
      socket.on('usbStorageCleaned', (data) => { if (socket.data.mode === 'admin') return; relayResponseToOriginator('usbStorageCleaned', data); });
      socket.on('appRestarted',      (data) => { if (socket.data.mode === 'admin') return; relayResponseToOriginator('appRestarted', data); });

      socket.on('deviceStateResponse', (data) => {
        if (socket.data.mode === 'admin') return;
        if (data?.deviceId) {
          const slice = {};
          if (data.appState)    slice.appState    = data.appState;
          if (data.tvState)     slice.tvState     = data.tvState;
          if (data.systemState) slice.systemState = data.systemState;
          if (data.playerState) slice.playerState = data.playerState;
          if (!deviceStates.has(data.deviceId)) deviceStates.set(data.deviceId, {});
          Object.assign(deviceStates.get(data.deviceId), slice, { lastUpdate: Date.now() });
        }
        relayResponseToOriginator('deviceStateResponse', data);
      });

      // ─── State change push events (device → admins room) ───
      socket.on('appStateChanged', (data) => {
        if (socket.data.mode === 'admin') return;
        const { deviceId, state, timestamp } = data || {};
        updateAndBroadcastState(deviceId, { appState: { state, timestamp: timestamp || Date.now() } },
          'appStateChanged', data);
      });

      socket.on('tvStateChanged', (data) => {
        if (socket.data.mode === 'admin') return;
        const { deviceId, state, timestamp } = data || {};
        updateAndBroadcastState(deviceId, { tvState: { state, timestamp: timestamp || Date.now() } },
          'tvStateChanged', data);
      });

      socket.on('systemStateChanged', (data) => {
        if (socket.data.mode === 'admin') return;
        const { deviceId, state, timestamp } = data || {};
        updateAndBroadcastState(deviceId, { systemState: { state, timestamp: timestamp || Date.now() } },
          'systemStateChanged', data);
      });

      socket.on('playerStateChanged', (data) => {
        if (socket.data.mode === 'admin') return;
        const { deviceId, playerState, bufferPercentage, isStuck, currentAd, timestamp } = data || {};
        updateAndBroadcastState(deviceId, {
          playerState: { playerState, bufferPercentage, isStuck, currentAd, timestamp: timestamp || Date.now() }
        }, 'playerStateChanged', data);
      });

      socket.on('stateHeartbeat', (data) => {
        if (socket.data.mode === 'admin') return;
        const deviceId = data?.deviceId;
        if (!deviceId) return;
        const slice = {};
        if (data.appState)    slice.appState    = data.appState;
        if (data.tvState)     slice.tvState     = data.tvState;
        if (data.systemState) slice.systemState = data.systemState;
        if (data.playerState) slice.playerState = data.playerState;
        updateAndBroadcastState(deviceId, slice, 'stateHeartbeat', data);
      });

      // ─── Log streaming ───
      socket.on('requestLogs', async (data) => {
        if (!requireAdminSocket(socket, 'requestLogs')) return;
        const parsed = parseOr(socket, 'requestLogs', schemas.requestLogsSchema, data);
        if (!parsed) return;
        const { deviceId, tags, packageFilter, includeHistorical } = parsed;
        const sessionId = parsed.sessionId || uuidv4();

        // H6: log streaming is SUPERADMIN-only (matches the SUPERADMIN-only Logs tab in the web UI).
        if (socket.data.user?.role !== 'SUPERADMIN') {
          return socket.emit('authError', { event: 'requestLogs', error: 'forbidden', sessionId });
        }

        if (!socketEventGuard(socket, 'requestLogs', deviceId)) {
          return socket.emit('rateLimited', { event: 'requestLogs', sessionId });
        }
        const authz = await canOperateOnDevice(socket, 'requestLogs', deviceId);
        if (!authz.ok) return socket.emit('authError', { event: 'requestLogs', error: authz.status, sessionId });

        try {
          createLogSession(sessionId, deviceId, socket.id, tags, packageFilter);

          audit({
            event: 'requestLogs', actor: socket.data.user, actorIp: socket.handshake.address,
            deviceId, deviceOwnerId: authz.device.userId, socketId: socket.id, result: 'allowed',
            payload: { sessionId, tags, packageFilter, includeHistorical }
          });

          const room = deviceRoomFor(deviceId);
          const occupants = io.sockets.adapter.rooms.get(room);
          const target = occupants && occupants.size > 0 ? io.to(room) : io;
          // NOTE: packageFilter MUST always be present (default ''). The Android client
          // parses it with `optString("packageFilter", null).takeIf { it.isNotEmpty() }`,
          // which throws an NPE if the key is absent — aborting the whole log request.
          // Omitting it (old behaviour) silently breaks log streaming. See LogManager.kt:147.
          const devicePayload = { sessionId, tags, includeHistorical, adminSocketId: socket.id, packageFilter: packageFilter || '' };
          target.emit(`requestLogs/${deviceId}`, devicePayload);

          socket.emit('logSessionStarted', {
            sessionId, deviceId, tags, packageFilter: packageFilter || null, includeHistorical
          });
        } catch (err) {
          console.error('requestLogs error:', err);
          socket.emit('logError', { message: 'Failed to start log session', error: err.message });
        }
      });

      socket.on('stopLogs', async (data) => {
        if (!requireAdminSocket(socket, 'stopLogs')) return;
        const parsed = parseOr(socket, 'stopLogs', schemas.stopLogsSchema, data);
        if (!parsed) return;
        const { deviceId, sessionId } = parsed;

        // H6: log streaming is SUPERADMIN-only.
        if (socket.data.user?.role !== 'SUPERADMIN') {
          return socket.emit('authError', { event: 'stopLogs', error: 'forbidden', sessionId });
        }

        if (!socketEventGuard(socket, 'stopLogs', deviceId)) {
          return socket.emit('rateLimited', { event: 'stopLogs', sessionId });
        }
        const authz = await canOperateOnDevice(socket, 'stopLogs', deviceId);
        if (!authz.ok) return socket.emit('authError', { event: 'stopLogs', error: authz.status, sessionId });

        try {
          let stopped = [];
          if (sessionId) {
            const s = endLogSession(sessionId);
            if (s) stopped.push(s);
          } else {
            const adminSessions = getActiveSessionsForAdmin(socket.id).filter(s => s.deviceId === deviceId);
            for (const s of adminSessions) {
              const ended = endLogSession(s.sessionId);
              if (ended) stopped.push(ended);
            }
          }

          const room = deviceRoomFor(deviceId);
          const occupants = io.sockets.adapter.rooms.get(room);
          const target = occupants && occupants.size > 0 ? io.to(room) : io;
          target.emit(`stopLogs/${deviceId}`, {
            sessionId,
            adminSocketId: socket.id,
            stoppedSessions: stopped.map(s => s.sessionId)
          });

          socket.emit('logSessionStopped', { sessionId, deviceId, stoppedSessions: stopped.length });
        } catch (err) {
          console.error('stopLogs error:', err);
          socket.emit('logError', { message: 'Failed to stop log session', error: err.message });
        }
      });

      socket.on('logsData', (data) => {
        if (socket.data.mode === 'admin') return; // K3: logs come from devices, not admin sockets
        try {
          let sessionId, deviceId, logs, isHistorical = false;

          if (data?.type === 'realtime' && data.log) {
            sessionId = data.sessionId; deviceId = data.log.deviceId;
            logs = [data.log]; isHistorical = false;
          } else if (data?.type === 'historical' && data.logs) {
            sessionId = data.sessionId; logs = data.logs; isHistorical = true;
            deviceId = logs.length > 0 ? logs[0].deviceId : null;
          } else if (data?.logs && data?.deviceId) {
            sessionId = data.sessionId; deviceId = data.deviceId;
            logs = data.logs; isHistorical = data.isHistorical || false;
          } else {
            return;
          }
          if (!sessionId || !deviceId || !Array.isArray(logs)) return;

          updateDeviceSocketId(sessionId, socket.id);

          const active = getActiveSessionsForDevice(deviceId);
          for (const session of active) {
            if (!session.adminSocketId || !session.isActive) continue;
            let filtered = logs;
            if (session.tags && session.tags.length > 0) {
              filtered = logs.filter(log => session.tags.includes(log.tag));
            }
            if (filtered.length === 0) continue;

            const safe = redactLogs(filtered);
            io.to(session.adminSocketId).emit('logsData', {
              sessionId: session.sessionId,
              deviceId,
              logs: safe,
              isHistorical
            });
          }
        } catch (err) {
          console.error('logsData error:', err);
        }
      });

      // ─── Disconnect cleanup ───
      socket.on('disconnect', (reason) => {
        console.log(`[Socket.IO] disconnected: id=${socket.id} mode=${socket.data?.mode} reason=${reason}`);
        try {
          const adminSessions = getActiveSessionsForAdmin(socket.id);
          cleanupSessionsForSocket(socket.id);

          for (const session of adminSessions) {
            const room = deviceRoomFor(session.deviceId);
            const occupants = io.sockets.adapter.rooms.get(room);
            const target = occupants && occupants.size > 0 ? io.to(room) : io;
            target.emit(`stopLogs/${session.deviceId}`, {
              sessionId: session.sessionId,
              adminSocketId: socket.id,
              reason: 'admin_disconnected',
              forceStop: true
            });
          }

          if (socket.data?.mode === 'admin' && adminSessions.length > 0) {
            io.to(ADMINS_ROOM).emit('adminDisconnected', {
              socketId: socket.id,
              cleanedSessions: adminSessions.length
            });
          }
        } catch (err) {
          console.error('disconnect cleanup error:', err);
        }
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) throw new Error('Socket.io not initialized!');
    return io;
  },

  // Public helpers used elsewhere
  getDeviceState: (deviceId) => deviceStates.get(deviceId) || null,
  getAllDeviceStates: () => Object.fromEntries(deviceStates),
  clearDeviceState: (deviceId) => deviceStates.delete(deviceId)
};
