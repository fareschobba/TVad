
const socketIO = require('socket.io');
const { emit } = require('../server');
const { v4: uuidv4 } = require('uuid');
const {
  createLogSession,
  endLogSession,
  getActiveSessionsForDevice,
  getActiveSessionsForAdmin,
  updateDeviceSocketId,
  cleanupSessionsForSocket
} = require('../controllers/logController');

let io;

// Track processed requests to prevent duplicate emissions when multiple clients are connected
const processedRequests = new Set();

// Clean up processed requests every 5 minutes to prevent memory leaks
setInterval(() => {
  const size = processedRequests.size;
  processedRequests.clear();
  console.log(`[Socket.IO] Cleared ${size} processed request IDs from memory`);
}, 5 * 60 * 1000);

module.exports = {
  init: (server) => {
    io = socketIO(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    io.on('connection', (socket) => {
      const connectedSockets = io.sockets.sockets.size;
      console.log(`[Socket.IO] Client connected: ${socket.id} | Total connections: ${connectedSockets}`);

      // Device registration - devices should emit this on connect
      socket.on('registerDevice', (data) => {
        const { deviceId } = data;
        if (deviceId) {
          socket.join(`device_${deviceId}`);
          console.log(`[Socket.IO] Device ${deviceId} registered with socket ${socket.id}`);
        }
      });

      socket.on("message", (data) => {
        console.log(data);

      });

      // Listen for "currentAd/{deviceId}" event
      socket.on("currentAd", (data) => {
        const deviceId = data.deviceId;
        console.log("Received currentAd event for device:", deviceId);
        console.log("Data:", data);

        // Broadcast the update to all clients (including the web page)
        io.emit("currentAdWeb", data);
      });

      // Listen for "TVState/{deviceId}" event
      socket.on("TVState", (data) => {
        const deviceId = data.deviceId;
        console.log("Received TVState event for device:", deviceId);
        console.log("Data:", data);

        // Broadcast the update to all clients
        io.emit("TVStateWeb", data);
      });

      // Listen for "SystemState/{deviceId}" event
      socket.on("SystemState", (data) => {
        const deviceId = data.deviceId;
        console.log("Received SystemState event for device:", deviceId);
        console.log("Data:", data);

        // Broadcast the update to all clients
        io.emit("SystemStateWeb", data);
      });

      // Listen for "AppState/{deviceId}" event
      socket.on("AppState", (data) => {
        const deviceId = data.deviceId;
        console.log("Received AppState event for device:", deviceId);
        console.log("Data:", data);

        // Broadcast the update to all clients
        io.emit("AppStateWeb", data);
      });

      // Listen for CheckStates event
      socket.on("checkStates", (data) => {
        data.devices.forEach((deviceId) => {
          // Emit to specific device using room
          const deviceRoom = `device_${deviceId}`;
          const socketsInRoom = io.sockets.adapter.rooms.get(deviceRoom);

          if (socketsInRoom && socketsInRoom.size > 0) {
            io.to(deviceRoom).emit(`checkState/${deviceId}`, "checkState");
            console.log(`Emitted checkState to room ${deviceRoom} (${socketsInRoom.size} sockets)`);
          } else {
            io.emit(`checkState/${deviceId}`, "checkState");
            console.log(`Emitted checkState broadcast (device not in room)`);
          }
        });
      });

      // Listen for CheckStates event
      socket.on("returnState", (data) => {

        io.emit(`returnStateWeb`, data);

        console.log("returnStateWeb data: ",data);

      });

      // ===== CACHE MANAGEMENT EVENTS =====

      // Listen for cache clear requests from admin
      socket.on('clearCache', (data) => {
        const { deviceId, cacheType = 'all', requestId } = data;

        // Prevent duplicate processing when multiple admin clients are connected
        if (processedRequests.has(requestId)) {
          console.log(`[Dedup] Duplicate cache clear request ignored: ${requestId} from socket ${socket.id}`);
          return;
        }
        processedRequests.add(requestId);

        console.log(`Cache clear request for device ${deviceId}, type: ${cacheType}, requestId: ${requestId}`);

        // Forward to specific device using room
        const deviceRoom = `device_${deviceId}`;
        const socketsInRoom = io.sockets.adapter.rooms.get(deviceRoom);

        if (socketsInRoom && socketsInRoom.size > 0) {
          io.to(deviceRoom).emit(`clearCache/${deviceId}`, {
            cacheType,
            requestId,
            adminSocketId: socket.id
          });
          console.log(`Emitted clearCache to room ${deviceRoom} (${socketsInRoom.size} sockets)`);
        } else {
          io.emit(`clearCache/${deviceId}`, {
            cacheType,
            requestId,
            adminSocketId: socket.id
          });
          console.log(`Emitted clearCache broadcast (device not in room)`);
        }
      });

      // Listen for cache cleared responses from devices
      socket.on('cacheCleared', (data) => {
        console.log('Cache cleared response received:', data);

        // Broadcast to all admin clients
        io.emit('cacheCleared', data);
      });

      // ===== HEALTH CHECK EVENTS =====

      // Listen for health check requests from admin
      socket.on('healthCheck', (data) => {
        const { deviceId, requestId } = data;

        // Prevent duplicate processing when multiple admin clients are connected
        if (processedRequests.has(requestId)) {
          console.log(`[Dedup] Duplicate health check request ignored: ${requestId} from socket ${socket.id}`);
          return;
        }
        processedRequests.add(requestId);

        console.log(`Health check request for device ${deviceId}, requestId: ${requestId}`);

        // Forward to specific device using room
        const deviceRoom = `device_${deviceId}`;
        const socketsInRoom = io.sockets.adapter.rooms.get(deviceRoom);

        if (socketsInRoom && socketsInRoom.size > 0) {
          io.to(deviceRoom).emit(`healthCheck/${deviceId}`, {
            requestId,
            adminSocketId: socket.id
          });
          console.log(`Emitted healthCheck to room ${deviceRoom} (${socketsInRoom.size} sockets)`);
        } else {
          io.emit(`healthCheck/${deviceId}`, {
            requestId,
            adminSocketId: socket.id
          });
          console.log(`Emitted healthCheck broadcast (device not in room)`);
        }
      });

      // Listen for health status responses from devices
      socket.on('healthStatus', (data) => {
        console.log('Health status response received:', data);

        // Broadcast to all admin clients
        io.emit('healthStatus', data);
      });

      // ===== USB STORAGE MANAGEMENT EVENTS =====

      // Listen for USB storage clean requests from admin
      socket.on('cleanUsbStorage', (data) => {
        const { deviceId, cleanType = 'all', requestId } = data;

        // Prevent duplicate processing when multiple admin clients are connected
        if (processedRequests.has(requestId)) {
          console.log(`[Dedup] Duplicate USB clean request ignored: ${requestId} from socket ${socket.id}`);
          return;
        }
        processedRequests.add(requestId);

        console.log(`USB storage clean request for device ${deviceId}, type: ${cleanType}, requestId: ${requestId}`);

        // Forward to specific device using room
        const deviceRoom = `device_${deviceId}`;
        const socketsInRoom = io.sockets.adapter.rooms.get(deviceRoom);

        if (socketsInRoom && socketsInRoom.size > 0) {
          io.to(deviceRoom).emit(`cleanUsbStorage/${deviceId}`, {
            cleanType,
            requestId,
            adminSocketId: socket.id
          });
          console.log(`Emitted cleanUsbStorage to room ${deviceRoom} (${socketsInRoom.size} sockets)`);
        } else {
          io.emit(`cleanUsbStorage/${deviceId}`, {
            cleanType,
            requestId,
            adminSocketId: socket.id
          });
          console.log(`Emitted cleanUsbStorage broadcast (device not in room)`);
        }
      });

      // Listen for USB storage cleaned responses from devices
      socket.on('usbStorageCleaned', (data) => {
        console.log('USB storage cleaned response received:', data);

        // Broadcast to all admin clients
        io.emit('usbStorageCleaned', data);
      });

      // ===== APP RESTART MANAGEMENT EVENTS =====

      // Listen for app restart requests from admin
      socket.on('restartApp', (data) => {
        const { deviceId, requestId } = data;

        console.log(`[RestartApp] Received request - deviceId: ${deviceId}, requestId: ${requestId}, socket: ${socket.id}`);
        console.log(`[RestartApp] Set size before check: ${processedRequests.size}, has requestId: ${processedRequests.has(requestId)}`);

        // Prevent duplicate processing
        if (processedRequests.has(requestId)) {
          console.log(`[RestartApp] DUPLICATE BLOCKED - requestId: ${requestId}, socket: ${socket.id}`);
          return;
        }

        // Add to processed set
        processedRequests.add(requestId);
        console.log(`[RestartApp] Added to set - Set size now: ${processedRequests.size}`);

        // Get sockets in device room
        const deviceRoom = `device_${deviceId}`;
        const socketsInRoom = io.sockets.adapter.rooms.get(deviceRoom);
        const socketCount = socketsInRoom ? socketsInRoom.size : 0;

        console.log(`[RestartApp] Device room: ${deviceRoom}, sockets in room: ${socketCount}`);

        // Emit to device room (only registered devices) OR fallback to broadcast
        if (socketCount > 0) {
          io.to(deviceRoom).emit(`restartApp/${deviceId}`, {
            requestId,
            adminSocketId: socket.id
          });
          console.log(`[RestartApp] ✅ EMITTED to room ${deviceRoom} (${socketCount} sockets)`);
        } else {
          // Fallback: broadcast to all (for devices not using room registration)
          io.emit(`restartApp/${deviceId}`, {
            requestId,
            adminSocketId: socket.id
          });
          console.log(`[RestartApp] ✅ EMITTED broadcast (device not in room)`);
        }
      });

      // Listen for app restart responses from devices
      socket.on('appRestarted', (data) => {
        console.log('App restart response received:', data);

        // Broadcast to all admin clients
        io.emit('appRestarted', data);
      });

      // ===== LOG STREAMING EVENTS =====

      // Handle requestLogs/{deviceId} event from admin
      socket.on("requestLogs", (data) => {
        try {
          const { deviceId, tags = [], packageFilter, sessionId, includeHistorical = false } = data;

          if (!deviceId) {
            socket.emit('logError', { message: 'Device ID is required' });
            return;
          }

          const finalSessionId = sessionId || uuidv4();

          console.log(`Admin ${socket.id} requesting logs for device ${deviceId}:`, {
            tags,
            packageFilter: packageFilter || 'all',
            includeHistorical,
            sessionId: finalSessionId
          });

          // Create log session with package filter
          const session = createLogSession(
            finalSessionId,
            deviceId,
            socket.id,
            tags,
            packageFilter
          );

          // Prepare request data for device
          const deviceRequest = {
            sessionId: finalSessionId,
            tags,
            includeHistorical,
            adminSocketId: socket.id
          };

          // Add package filter if specified
          if (packageFilter) {
            deviceRequest.packageFilter = packageFilter;
          }

          // Notify the device to start streaming logs using room
          const deviceRoom = `device_${deviceId}`;
          const socketsInRoom = io.sockets.adapter.rooms.get(deviceRoom);

          if (socketsInRoom && socketsInRoom.size > 0) {
            io.to(deviceRoom).emit(`requestLogs/${deviceId}`, deviceRequest);
            console.log(`Emitted requestLogs to room ${deviceRoom} (${socketsInRoom.size} sockets)`);
          } else {
            io.emit(`requestLogs/${deviceId}`, deviceRequest);
            console.log(`Emitted requestLogs broadcast (device not in room)`);
          }

          // Confirm session started to admin
          socket.emit('logSessionStarted', {
            sessionId: finalSessionId,
            deviceId,
            tags,
            packageFilter: packageFilter || null,
            includeHistorical
          });

        } catch (error) {
          console.error('Error handling requestLogs:', error);
          socket.emit('logError', {
            message: 'Failed to start log session',
            error: error.message
          });
        }
      });

      // Handle stopLogs/{deviceId} event from admin
      socket.on("stopLogs", (data) => {
        try {
          const { deviceId, sessionId } = data;

          if (!deviceId) {
            socket.emit('logError', { message: 'Device ID is required' });
            return;
          }

          console.log(`Admin ${socket.id} stopping logs for device ${deviceId}, session: ${sessionId}`);

          let stoppedSessions = [];

          // End the specific log session or all sessions for this admin/device
          if (sessionId) {
            const session = endLogSession(sessionId);
            if (session) {
              stoppedSessions.push(session);
            }
          } else {
            // If no sessionId provided, end all sessions for this admin and device
            const adminSessions = getActiveSessionsForAdmin(socket.id);
            const deviceSessions = adminSessions.filter(session => session.deviceId === deviceId);

            deviceSessions.forEach(session => {
              const stoppedSession = endLogSession(session.sessionId);
              if (stoppedSession) {
                stoppedSessions.push(stoppedSession);
              }
              console.log(`Ended session ${session.sessionId} for device ${deviceId}`);
            });
          }

          // Notify the device to stop streaming logs using room
          const deviceRoom = `device_${deviceId}`;
          const socketsInRoom = io.sockets.adapter.rooms.get(deviceRoom);

          if (socketsInRoom && socketsInRoom.size > 0) {
            io.to(deviceRoom).emit(`stopLogs/${deviceId}`, {
              sessionId,
              adminSocketId: socket.id,
              stoppedSessions: stoppedSessions.map(s => s.sessionId)
            });
            console.log(`Emitted stopLogs to room ${deviceRoom} (${socketsInRoom.size} sockets)`);
          } else {
            io.emit(`stopLogs/${deviceId}`, {
              sessionId,
              adminSocketId: socket.id,
              stoppedSessions: stoppedSessions.map(s => s.sessionId)
            });
            console.log(`Emitted stopLogs broadcast (device not in room)`);
          }

          // Also send stop signal for each stopped session
          if (stoppedSessions.length > 0) {
            console.log(`Sending stop signal for ${stoppedSessions.length} sessions`);
            stoppedSessions.forEach(session => {
              const sessionDeviceRoom = `device_${session.deviceId}`;
              const sessionSockets = io.sockets.adapter.rooms.get(sessionDeviceRoom);

              if (sessionSockets && sessionSockets.size > 0) {
                io.to(sessionDeviceRoom).emit(`stopLogs/${session.deviceId}`, {
                  sessionId: session.sessionId,
                  adminSocketId: socket.id,
                  forceStop: true
                });
              } else {
                io.emit(`stopLogs/${session.deviceId}`, {
                  sessionId: session.sessionId,
                  adminSocketId: socket.id,
                  forceStop: true
                });
              }
            });
          }

          // Confirm session stopped to admin
          socket.emit('logSessionStopped', {
            sessionId,
            deviceId,
            stoppedSessions: stoppedSessions.length
          });

          console.log(`Stopped ${stoppedSessions.length} log session(s) for device ${deviceId}`);

        } catch (error) {
          console.error('Error handling stopLogs:', error);
          socket.emit('logError', {
            message: 'Failed to stop log session',
            error: error.message
          });
        }
      });

      // Handle logsData event from device
      socket.on("logsData", (data) => {
        try {
          let sessionId, deviceId, logs, isHistorical = false;

          // Handle different data formats from device
          if (data.type === 'realtime' && data.log) {
            // Format: { type: "realtime", log: {...}, sessionId: "..." }
            sessionId = data.sessionId;
            deviceId = data.log.deviceId;
            logs = [data.log]; // Single log entry in array
            isHistorical = false;
          } else if (data.type === 'historical' && data.logs) {
            // Format: { type: "historical", logs: [...], sessionId: "..." }
            sessionId = data.sessionId;
            logs = data.logs;
            isHistorical = true;
            // Extract deviceId from first log entry
            deviceId = logs.length > 0 ? logs[0].deviceId : null;
          } else if (data.logs && data.deviceId) {
            // Legacy format: { sessionId: "...", deviceId: "...", logs: [...] }
            sessionId = data.sessionId;
            deviceId = data.deviceId;
            logs = data.logs;
            isHistorical = data.isHistorical || false;
          } else {
            console.error('Invalid logsData received:', data);
            return;
          }

          if (!sessionId || !deviceId || !logs || !Array.isArray(logs)) {
            console.error('Missing required fields in logsData:', { sessionId, deviceId, logsCount: logs?.length });
            return;
          }

          const logType = isHistorical ? 'historical' : 'realtime';
          console.log(`📦 Received ${logs.length} ${logType} log entries from device ${deviceId}, session: ${sessionId}`);

          // Optional: Log first few entries for monitoring
          if (logs.length > 0) {
            console.log(`   Sample ${logType} logs:`);
            logs.slice(0, 2).forEach((log, i) => {
              console.log(`   ${i + 1}. [${log.level}] [${log.tag}] ${log.message}`);
            });
          }

          // Update device socket ID in session if not already set
          updateDeviceSocketId(sessionId, socket.id);

          // Get active sessions for this device
          const activeSessions = getActiveSessionsForDevice(deviceId);

          // Forward logs to all active admin sessions
          for (const session of activeSessions) {
            if (session.adminSocketId && session.isActive) {
              // Filter logs based on session tags if specified
              let filteredLogs = logs;
              if (session.tags && session.tags.length > 0) {
                filteredLogs = logs.filter(log => session.tags.includes(log.tag));
              }

              if (filteredLogs.length > 0) {
                io.to(session.adminSocketId).emit('logsData', {
                  sessionId: session.sessionId,
                  deviceId,
                  logs: filteredLogs,
                  isHistorical
                });
              }
            }
          }

        } catch (error) {
          console.error('Error handling logsData:', error);
        }
      });

      // Handle socket disconnection
      socket.on('disconnect', (reason) => {
        const remainingSockets = io.sockets.sockets.size - 1;
        console.log(`[Socket.IO] Socket ${socket.id} disconnected: ${reason} | Remaining connections: ${remainingSockets}`);

        try {
          // Get sessions before cleanup for notification
          const { getActiveSessionsForAdmin } = require('../controllers/logController');
          const adminSessions = getActiveSessionsForAdmin(socket.id);

          // Clean up all sessions associated with this socket
          cleanupSessionsForSocket(socket.id);

          // Send stop signals to devices for any sessions this socket was managing
          if (adminSessions.length > 0) {
            console.log(`Sending stop signals for ${adminSessions.length} sessions from disconnected socket`);
            adminSessions.forEach(session => {
              io.emit(`stopLogs/${session.deviceId}`, {
                sessionId: session.sessionId,
                adminSocketId: socket.id,
                reason: 'Admin disconnected',
                forceStop: true
              });
            });
          }

          // Notify other sockets about the disconnection if needed
          socket.broadcast.emit('adminDisconnected', {
            socketId: socket.id,
            reason,
            cleanedSessions: adminSessions.length
          });

        } catch (error) {
          console.error('Error during socket disconnect cleanup:', error);
        }
      });

    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  }
};