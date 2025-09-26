// src/controllers/logController.js
const { v4: uuidv4 } = require('uuid');

// Log tag constants
const LOG_TAGS = {
  TAG_SOCKET: 'TAG_SOCKET',
  TAG_VIDEO: 'TAG_VIDEO',
  TAG_DOWNLOAD: 'TAG_DOWNLOAD',
  TAG_STORAGE: 'TAG_STORAGE',
  TAG_NETWORK: 'TAG_NETWORK',
  TAG_SYSTEM: 'TAG_SYSTEM',
  TAG_MEMORY: 'TAG_MEMORY',
  TAG_USB: 'TAG_USB',
  TAG_SCHEDULE: 'TAG_SCHEDULE',
  TAG_PLAYBACK: 'TAG_PLAYBACK'
};

// In-memory session storage
const activeSessions = new Map(); // sessionId -> session data
const deviceSessions = new Map(); // deviceId -> Set of sessionIds
const adminSessions = new Map();  // adminSocketId -> Set of sessionIds

/**
 * Create a new log session
 */
const createLogSession = (sessionId, deviceId, adminSocketId, tags, packageFilter = null) => {
  try {
    // End any existing active sessions for this admin and device
    endSessionsForAdminDevice(adminSocketId, deviceId);

    // Create new session
    const session = {
      sessionId,
      deviceId,
      adminSocketId,
      deviceSocketId: null,
      tags,
      packageFilter,
      isActive: true,
      startedAt: new Date()
    };

    // Store session
    activeSessions.set(sessionId, session);

    // Update device sessions mapping
    if (!deviceSessions.has(deviceId)) {
      deviceSessions.set(deviceId, new Set());
    }
    deviceSessions.get(deviceId).add(sessionId);

    // Update admin sessions mapping
    if (!adminSessions.has(adminSocketId)) {
      adminSessions.set(adminSocketId, new Set());
    }
    adminSessions.get(adminSocketId).add(sessionId);

    console.log(`Created log session: ${sessionId} for device: ${deviceId}`);
    return session;
  } catch (error) {
    console.error('Error creating log session:', error);
    throw error;
  }
};

/**
 * End a log session
 */
const endLogSession = (sessionId) => {
  try {
    const session = activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Mark session as inactive
    session.isActive = false;
    session.endedAt = new Date();

    // Remove from mappings
    if (deviceSessions.has(session.deviceId)) {
      deviceSessions.get(session.deviceId).delete(sessionId);
      if (deviceSessions.get(session.deviceId).size === 0) {
        deviceSessions.delete(session.deviceId);
      }
    }

    if (adminSessions.has(session.adminSocketId)) {
      adminSessions.get(session.adminSocketId).delete(sessionId);
      if (adminSessions.get(session.adminSocketId).size === 0) {
        adminSessions.delete(session.adminSocketId);
      }
    }

    // Remove from active sessions
    activeSessions.delete(sessionId);

    console.log(`Ended log session: ${sessionId}`);
    return session;
  } catch (error) {
    console.error('Error ending log session:', error);
    throw error;
  }
};

/**
 * Get active log sessions for a device
 */
const getActiveSessionsForDevice = (deviceId) => {
  try {
    const sessionIds = deviceSessions.get(deviceId) || new Set();
    const sessions = [];

    for (const sessionId of sessionIds) {
      const session = activeSessions.get(sessionId);
      if (session && session.isActive) {
        sessions.push(session);
      }
    }

    return sessions;
  } catch (error) {
    console.error('Error getting active sessions:', error);
    throw error;
  }
};

/**
 * Update device socket ID for a session
 */
const updateDeviceSocketId = (sessionId, deviceSocketId) => {
  try {
    const session = activeSessions.get(sessionId);
    if (session && session.isActive) {
      session.deviceSocketId = deviceSocketId;
      return session;
    }
    return null;
  } catch (error) {
    console.error('Error updating device socket ID:', error);
    throw error;
  }
};

/**
 * End sessions for a specific admin and device combination
 */
const endSessionsForAdminDevice = (adminSocketId, deviceId) => {
  try {
    const adminSessionIds = adminSessions.get(adminSocketId) || new Set();

    for (const sessionId of adminSessionIds) {
      const session = activeSessions.get(sessionId);
      if (session && session.deviceId === deviceId && session.isActive) {
        endLogSession(sessionId);
      }
    }
  } catch (error) {
    console.error('Error ending sessions for admin device:', error);
    throw error;
  }
};

/**
 * Clean up sessions for disconnected socket
 */
const cleanupSessionsForSocket = (socketId) => {
  try {
    // End sessions where this socket was the admin
    const adminSessionIds = adminSessions.get(socketId) || new Set();
    for (const sessionId of [...adminSessionIds]) {
      endLogSession(sessionId);
    }

    // Clear device socket ID where this socket was the device
    for (const [sessionId, session] of activeSessions) {
      if (session.deviceSocketId === socketId) {
        session.deviceSocketId = null;
      }
    }

    console.log(`Cleaned up sessions for socket: ${socketId}`);
  } catch (error) {
    console.error('Error cleaning up sessions for socket:', error);
    throw error;
  }
};

/**
 * Get all active sessions (for debugging)
 */
const getAllActiveSessions = () => {
  return Array.from(activeSessions.values()).filter(session => session.isActive);
};

/**
 * Get session by ID
 */
const getSessionById = (sessionId) => {
  return activeSessions.get(sessionId);
};

/**
 * Get active log sessions for an admin
 */
const getActiveSessionsForAdmin = (adminSocketId) => {
  try {
    const sessionIds = adminSessions.get(adminSocketId) || new Set();
    const sessions = [];

    for (const sessionId of sessionIds) {
      const session = activeSessions.get(sessionId);
      if (session && session.isActive) {
        sessions.push(session);
      }
    }

    return sessions;
  } catch (error) {
    console.error('Error getting active sessions for admin:', error);
    throw error;
  }
};

module.exports = {
  LOG_TAGS,
  createLogSession,
  endLogSession,
  getActiveSessionsForDevice,
  getActiveSessionsForAdmin,
  updateDeviceSocketId,
  cleanupSessionsForSocket,
  endSessionsForAdminDevice,
  getAllActiveSessions,
  getSessionById
};
