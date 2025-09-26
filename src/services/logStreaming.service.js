// src/services/logStreaming.service.js
const { getIO } = require('../config/socket');
const {
  getActiveSessionsForDevice,
  LOG_TAGS
} = require('../controllers/logController');

/**
 * Broadcast log data to active admin sessions for a device
 */
const broadcastLogsToAdmins = (deviceId, logs) => {
  try {
    const io = getIO();
    const activeSessions = getActiveSessionsForDevice(deviceId);

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
            logs: filteredLogs
          });
        }
      }
    }
  } catch (error) {
    console.error('Error broadcasting logs to admins:', error);
    throw error;
  }
};

/**
 * Process and broadcast log entries
 */
const processLogEntries = (deviceId, logs) => {
  try {
    // Validate logs
    const validLogs = [];
    if (Array.isArray(logs)) {
      for (const logEntry of logs) {
        // Validate required fields
        if (logEntry.timestamp && logEntry.level && logEntry.tag &&
            logEntry.message && logEntry.deviceId && logEntry.formattedTime) {
          validLogs.push(logEntry);
        }
      }
    }

    // Broadcast to active admin sessions
    broadcastLogsToAdmins(deviceId, validLogs);

    return validLogs;
  } catch (error) {
    console.error('Error processing log entries:', error);
    throw error;
  }
};

/**
 * Validate log entry format
 */
const validateLogEntry = (logEntry) => {
  const required = ['timestamp', 'level', 'tag', 'message', 'deviceId', 'formattedTime'];
  const validLevels = ['V', 'D', 'I', 'W', 'E'];

  // Check required fields
  for (const field of required) {
    if (!logEntry[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  // Validate level
  if (!validLevels.includes(logEntry.level)) {
    return { valid: false, error: `Invalid log level: ${logEntry.level}` };
  }

  // Validate timestamp
  if (typeof logEntry.timestamp !== 'number' || logEntry.timestamp <= 0) {
    return { valid: false, error: 'Invalid timestamp' };
  }

  return { valid: true };
};

/**
 * Format log entry for consistent structure
 */
const formatLogEntry = (rawLogEntry) => {
  return {
    timestamp: rawLogEntry.timestamp,
    level: rawLogEntry.level,
    tag: rawLogEntry.tag,
    message: rawLogEntry.message,
    deviceId: rawLogEntry.deviceId,
    formattedTime: rawLogEntry.formattedTime
  };
};

/**
 * Send log request to specific device
 */
const requestLogsFromDevice = (deviceId, sessionId, tags, includeHistorical) => {
  try {
    const io = getIO();
    io.emit(`requestLogs/${deviceId}`, {
      sessionId,
      tags,
      includeHistorical
    });
  } catch (error) {
    console.error('Error sending log request to device:', error);
    throw error;
  }
};

/**
 * Send stop logs request to specific device
 */
const stopLogsFromDevice = (deviceId, sessionId) => {
  try {
    const io = getIO();
    io.emit(`stopLogs/${deviceId}`, {
      sessionId
    });
  } catch (error) {
    console.error('Error sending stop logs request to device:', error);
    throw error;
  }
};

module.exports = {
  broadcastLogsToAdmins,
  processLogEntries,
  validateLogEntry,
  formatLogEntry,
  requestLogsFromDevice,
  stopLogsFromDevice,
  LOG_TAGS
};
