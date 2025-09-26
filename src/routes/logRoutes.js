// src/routes/logRoutes.js
const express = require('express');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const { getAllActiveSessions, createLogSession, endLogSession } = require('../controllers/logController');
const { getIO } = require('../config/socket');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/**
 * GET /api/logs/status
 * Get current log streaming status
 */
router.get('/status', protect, (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Log streaming is active - no persistent storage',
      data: {
        storageType: 'real-time-only',
        persistentLogs: false,
        description: 'Logs are streamed in real-time only when requested'
      }
    });
  } catch (error) {
    console.error('Error getting log status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get log status',
      error: error.message
    });
  }
});

/**
 * GET /api/logs/sessions
 * Get active log sessions
 */
router.get('/sessions', protect, (req, res) => {
  try {
    const sessions = getAllActiveSessions();

    res.status(200).json({
      success: true,
      data: sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('Error fetching log sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch log sessions',
      error: error.message
    });
  }
});

/**
 * POST /api/logs/cleanup
 * Force cleanup all sessions (debug endpoint)
 */
router.post('/cleanup', protect, (req, res) => {
  try {
    const sessions = getAllActiveSessions();
    const { cleanupSessionsForSocket } = require('../controllers/logController');

    console.log(`Force cleanup requested - found ${sessions.length} active sessions`);

    // End all active sessions
    sessions.forEach(session => {
      console.log(`Force ending session: ${session.sessionId} for device: ${session.deviceId}`);
      cleanupSessionsForSocket(session.adminSocketId);
      cleanupSessionsForSocket(session.deviceSocketId);
    });

    // Emit stop signals to all devices
    const io = getIO();
    const deviceIds = [...new Set(sessions.map(s => s.deviceId))];
    deviceIds.forEach(deviceId => {
      io.emit(`stopLogs/${deviceId}`, {
        forceStop: true,
        reason: 'Force cleanup requested'
      });
      console.log(`Sent force stop signal to device: ${deviceId}`);
    });

    res.status(200).json({
      success: true,
      message: `Cleaned up ${sessions.length} sessions and sent stop signals to ${deviceIds.length} devices`,
      data: {
        cleanedSessions: sessions.length,
        devicesNotified: deviceIds.length,
        deviceIds
      }
    });

  } catch (error) {
    console.error('Error in force cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup sessions',
      error: error.message
    });
  }
});

/**
 * GET /api/logs/info
 * Get information about the log streaming system
 */
router.get('/info', protect, (req, res) => {
  try {
    const sessions = getAllActiveSessions();
    const deviceCount = new Set(sessions.map(s => s.deviceId)).size;
    const adminCount = new Set(sessions.map(s => s.adminSocketId)).size;

    res.status(200).json({
      success: true,
      data: {
        systemType: 'Real-time Log Streaming',
        activeSessions: sessions.length,
        activeDevices: deviceCount,
        activeAdmins: adminCount,
        features: [
          'Real-time log streaming',
          'Tag-based filtering',
          'Multiple admin support',
          'Session management',
          'No persistent storage'
        ],
        
        supportedTags: [
          'SocketIO',
          'VideoActivity',
          'DownloadProcess',
          'StorageManager',
          'NetworkManager',
          'SystemMonitor',
          'MemoryMonitor',
          'USBManager',
          'ScheduleManager',
          'TvAdApp',
          'DeviceManager',
          'ApiService',
          'BootManager',
          'ActivityLifecycle',
          'VideoValidation',
          'MediaPlayback',
          'OrientationManager',
          'CacheManager',
          'HealthCheck'
        ],
        supportedLevels: ['V', 'D', 'I', 'W', 'E']
      }
    });

  } catch (error) {
    console.error('Error getting log info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get log info',
      error: error.message
    });
  }
});

/**
 * POST /api/logs/test/request
 * Test endpoint to simulate admin requesting logs (for Postman testing)
 */
router.post('/test/request', protect, (req, res) => {
  try {
    const { deviceId, tags = [], sessionId, includeHistorical = false } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    const finalSessionId = sessionId || uuidv4();
    const mockAdminSocketId = `admin-${req.user._id}-${Date.now()}`;

    // Create log session
    createLogSession(
      finalSessionId,
      deviceId,
      mockAdminSocketId,
      tags
    );

    // Emit to device via Socket.IO
    const io = getIO();
    io.emit(`requestLogs/${deviceId}`, {
      sessionId: finalSessionId,
      tags,
      includeHistorical,
      adminSocketId: mockAdminSocketId
    });

    res.status(200).json({
      success: true,
      message: 'Log request sent to device',
      data: {
        sessionId: finalSessionId,
        deviceId,
        tags,
        includeHistorical,
        adminSocketId: mockAdminSocketId,
        instructions: {
          emulator: `Listen for event: requestLogs/${deviceId}`,
          response: 'Send logsData event with the sessionId',
          formats: {
            realtime: '{ type: "realtime", log: {...}, sessionId: "..." }',
            historical: '{ type: "historical", logs: [...], sessionId: "..." }'
          }
        }
      }
    });

  } catch (error) {
    console.error('Error in test request logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request logs',
      error: error.message
    });
  }
});

/**
 * POST /api/logs/test/stop
 * Test endpoint to simulate admin stopping logs (for Postman testing)
 */
router.post('/test/stop', protect, (req, res) => {
  try {
    const { deviceId, sessionId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // End the log session if sessionId provided
    if (sessionId) {
      endLogSession(sessionId);
    }

    // Emit to device via Socket.IO
    const io = getIO();
    io.emit(`stopLogs/${deviceId}`, {
      sessionId,
      adminSocketId: `admin-${req.user._id}`
    });

    res.status(200).json({
      success: true,
      message: 'Stop logs request sent to device',
      data: {
        sessionId,
        deviceId,
        instructions: {
          emulator: `Listen for event: stopLogs/${deviceId}`,
          response: 'Stop sending logsData events'
        }
      }
    });

  } catch (error) {
    console.error('Error in test stop logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop logs',
      error: error.message
    });
  }
});

/**
 * POST /api/logs/test/simulate
 * Test endpoint to simulate device sending logs (for testing without real device)
 */
router.post('/test/simulate', protect, (req, res) => {
  try {
    const { deviceId, sessionId, count = 5, type = 'realtime', format = 'device' } = req.body;

    if (!deviceId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID and Session ID are required'
      });
    }

    // Generate sample logs
    const sampleLogs = [];

    const basicTags = ['TAG_VIDEO', 'TAG_NETWORK', 'TAG_SYSTEM', 'TAG_MEMORY', 'SocketIO'];
    const levels = ['V', 'D', 'I', 'W', 'E'];
    const messages = [
      'Video playback started',
      'Network connection established',
      'System initialization complete',
      'Memory usage: 45%',
      'Download progress: 75%',
      'USB device connected',
      'Advertisement scheduled',
      'Playback buffer full',
      'Emitted currentAd event: {"title":"THE_ROOF_cld.mp4","index":1,"deviceId":"' + deviceId + '"}',
      'Activity lifecycle: onCreate',
      'Boot sequence completed',
      'API request processed',
      'Cache hit ratio: 85%',
      'Orientation changed to landscape',
      'Health check passed',
      'Storage space available: 2.5GB',
      'USB device mounted successfully',
      'Schedule updated with 5 new ads',
      'Device manager initialized'
    ];

    // Use basic tags for simulation
    const tagsToUse = basicTags;
    const finalCount = count;

    for (let i = 0; i < finalCount; i++) {
      const timestamp = Date.now() + (i * 1000);
      sampleLogs.push({
        timestamp,
        level: levels[Math.floor(Math.random() * levels.length)],
        tag: tagsToUse[Math.floor(Math.random() * tagsToUse.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        deviceId,
        formattedTime: new Date(timestamp).toISOString()
      });
    }

    const io = getIO();

    if (format === 'device') {
      // Use device format - send individual logs for realtime
      if (type === 'realtime') {
        // Send each log individually as device would
        sampleLogs.forEach((log, index) => {
          setTimeout(() => {
            io.emit('logsData', {
              type: 'realtime',
              log: log,
              sessionId: sessionId
            });
          }, index * 500); // Stagger the logs
        });
      } else {
        // Send all logs as historical batch
        io.emit('logsData', {
          type: 'historical',
          logs: sampleLogs,
          sessionId: sessionId
        });
      }
    } else {
      // Use legacy format
      io.emit('logsData', {
        sessionId,
        deviceId,
        logs: sampleLogs,
        isHistorical: type === 'historical'
      });
    }

    res.status(200).json({
      success: true,
      message: `Simulated ${count} ${type} log entries sent using ${format} format`,
      data: {
        sessionId,
        deviceId,
        logCount: count,
        type,
        format,
        sampleLogs: sampleLogs.slice(0, 2) // Show first 2 logs as example
      }
    });

  } catch (error) {
    console.error('Error in simulate logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate logs',
      error: error.message
    });
  }
});

/**
 * GET /api/logs/dashboard
 * Serve a testing dashboard for log streaming
 */
router.get('/dashboard', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Log Streaming Dashboard</title>
        <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .dashboard {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                max-width: 1400px;
                margin: 0 auto;
            }
            .panel {
                background: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .panel h3 {
                margin: 0 0 15px 0;
                color: #333;
                border-bottom: 2px solid #007bff;
                padding-bottom: 10px;
            }
            .status {
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
                font-weight: bold;
            }
            .status.connected { background: #d4edda; color: #155724; }
            .status.disconnected { background: #f8d7da; color: #721c24; }
            .logs {
                background: #000;
                color: #00ff00;
                padding: 15px;
                border-radius: 5px;
                height: 300px;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 12px;
            }
            .controls {
                display: flex;
                gap: 10px;
                margin: 10px 0;
                flex-wrap: wrap;
            }
            input, button, select {
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            button {
                background: #007bff;
                color: white;
                border: none;
                cursor: pointer;
            }
            button:hover { background: #0056b3; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            .api-section {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                margin: 15px 0;
            }
            .endpoint {
                font-family: 'Courier New', monospace;
                background: #e9ecef;
                padding: 8px;
                border-radius: 3px;
                margin: 5px 0;
                cursor: pointer;
                transition: background 0.3s;
            }
            .endpoint:hover { background: #dee2e6; }
            .full-width {
                grid-column: 1 / -1;
            }
        </style>
    </head>
    <body>
        <h1 style="text-align: center; color: #333;">🧪 Log Streaming Test Dashboard</h1>

        <div class="dashboard">
            <!-- Admin Panel -->
            <div class="panel">
                <h3>👨‍💼 Admin Control Panel</h3>
                <div id="adminStatus" class="status disconnected">Disconnected</div>

                <div class="controls">
                    <input type="text" id="deviceId" placeholder="Device ID" value="TEST_DEVICE_001">
                    <input type="text" id="tags" placeholder="Tags (comma-separated)" value="TAG_VIDEO,TAG_NETWORK">
                    <button onclick="connectAdmin()">Connect</button>
                    <button onclick="requestLogs()" disabled id="requestBtn">Request Logs</button>
                    <button onclick="stopLogs()" disabled id="stopBtn">Stop Logs</button>
                </div>

                <div class="logs" id="adminLogs">
                    <div style="color: #888;">Admin logs will appear here...</div>
                </div>
            </div>

            <!-- Device Panel -->
            <div class="panel">
                <h3>📱 Device Emulator Panel</h3>
                <div id="deviceStatus" class="status disconnected">Disconnected</div>

                <div class="controls">
                    <input type="text" id="deviceIdEmulator" placeholder="Device ID" value="TEST_DEVICE_001">
                    <button onclick="connectDevice()">Connect Device</button>
                    <button onclick="sendTestLogs()" disabled id="testLogsBtn">Send Test Logs</button>
                </div>

                <div class="logs" id="deviceLogs">
                    <div style="color: #888;">Device logs will appear here...</div>
                </div>
            </div>

            <!-- API Testing Panel -->
            <div class="panel full-width">
                <h3>🔧 API Testing Panel</h3>
                <div class="api-section">
                    <h4>Quick API Tests (Click to execute):</h4>
                    <div class="endpoint" onclick="testAPI('/api/logs/status')">GET /api/logs/status</div>
                    <div class="endpoint" onclick="testAPI('/api/logs/sessions')">GET /api/logs/sessions</div>
                    <div class="endpoint" onclick="testAPI('/api/logs/info')">GET /api/logs/info</div>
                    <div class="endpoint" onclick="testAPIPost('/api/logs/test/request')">POST /api/logs/test/request</div>
                    <div class="endpoint" onclick="testAPIPost('/api/logs/test/simulate')">POST /api/logs/test/simulate</div>
                </div>

                <div class="logs" id="apiResults">
                    <div style="color: #888;">API test results will appear here...</div>
                </div>
            </div>
        </div>

        <script>
            let adminSocket = null;
            let deviceSocket = null;
            let currentSessionId = null;

            // Admin functions
            function connectAdmin() {
                adminSocket = io();

                adminSocket.on('connect', () => {
                    updateAdminStatus(true);
                    addAdminLog('Connected to server as admin');
                });

                adminSocket.on('disconnect', () => {
                    updateAdminStatus(false);
                    addAdminLog('Disconnected from server');
                });

                adminSocket.on('logSessionStarted', (data) => {
                    addAdminLog('Session started: ' + data.sessionId);
                    currentSessionId = data.sessionId;
                });

                adminSocket.on('logsData', (data) => {
                    addAdminLog('Received ' + data.logs.length + ' log entries');
                    data.logs.forEach(log => {
                        addAdminLog('[' + log.level + '] [' + log.tag + '] ' + log.message);
                    });
                });

                adminSocket.on('logSessionStopped', (data) => {
                    addAdminLog('Session stopped: ' + data.sessionId);
                    currentSessionId = null;
                });
            }

            function requestLogs() {
                if (!adminSocket) return;

                const deviceId = document.getElementById('deviceId').value;
                const tags = document.getElementById('tags').value.split(',').map(t => t.trim());
                const sessionId = 'dashboard-' + Date.now();

                adminSocket.emit('requestLogs', {
                    deviceId: deviceId,
                    tags: tags,
                    sessionId: sessionId
                });

                addAdminLog('Requesting logs from ' + deviceId);
            }

            function stopLogs() {
                if (!adminSocket || !currentSessionId) return;

                const deviceId = document.getElementById('deviceId').value;

                adminSocket.emit('stopLogs', {
                    deviceId: deviceId,
                    sessionId: currentSessionId
                });

                addAdminLog('Stopping logs for ' + deviceId);
            }

            // Device functions
            function connectDevice() {
                const deviceId = document.getElementById('deviceIdEmulator').value;
                deviceSocket = io();

                deviceSocket.on('connect', () => {
                    updateDeviceStatus(true);
                    addDeviceLog('Connected to server as device: ' + deviceId);
                });

                deviceSocket.on('disconnect', () => {
                    updateDeviceStatus(false);
                    addDeviceLog('Disconnected from server');
                });

                deviceSocket.on('requestLogs/' + deviceId, (data) => {
                    addDeviceLog('Received log request: ' + JSON.stringify(data));
                    // Auto-respond with sample logs
                    setTimeout(() => sendSampleLogs(data.sessionId, deviceId), 1000);
                });

                deviceSocket.on('stopLogs/' + deviceId, (data) => {
                    addDeviceLog('Received stop request: ' + JSON.stringify(data));
                });
            }

            function sendTestLogs() {
                const deviceId = document.getElementById('deviceIdEmulator').value;
                sendSampleLogs('manual-test-' + Date.now(), deviceId);
            }

            function sendSampleLogs(sessionId, deviceId) {
                if (!deviceSocket) return;

                const logs = [
                    {
                        timestamp: Date.now(),
                        level: 'I',
                        tag: 'TAG_VIDEO',
                        message: 'Video playback started',
                        deviceId: deviceId,
                        formattedTime: new Date().toISOString()
                    },
                    {
                        timestamp: Date.now() + 1000,
                        level: 'D',
                        tag: 'TAG_NETWORK',
                        message: 'Network request completed',
                        deviceId: deviceId,
                        formattedTime: new Date(Date.now() + 1000).toISOString()
                    }
                ];

                deviceSocket.emit('logsData', {
                    sessionId: sessionId,
                    deviceId: deviceId,
                    logs: logs
                });

                addDeviceLog('Sent ' + logs.length + ' log entries');
            }

            // API testing functions
            function testAPI(endpoint) {
                fetch(endpoint)
                    .then(response => response.json())
                    .then(data => {
                        addAPIResult('GET ' + endpoint + ':\\n' + JSON.stringify(data, null, 2));
                    })
                    .catch(error => {
                        addAPIResult('Error: ' + error.message);
                    });
            }

            function testAPIPost(endpoint) {
                const body = {
                    deviceId: 'TEST_DEVICE_001',
                    tags: ['TAG_VIDEO', 'TAG_NETWORK'],
                    sessionId: 'api-test-' + Date.now()
                };

                fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                })
                .then(response => response.json())
                .then(data => {
                    addAPIResult('POST ' + endpoint + ':\\n' + JSON.stringify(data, null, 2));
                })
                .catch(error => {
                    addAPIResult('Error: ' + error.message);
                });
            }

            // Utility functions
            function updateAdminStatus(connected) {
                const status = document.getElementById('adminStatus');
                const requestBtn = document.getElementById('requestBtn');
                const stopBtn = document.getElementById('stopBtn');

                if (connected) {
                    status.textContent = 'Connected';
                    status.className = 'status connected';
                    requestBtn.disabled = false;
                    stopBtn.disabled = false;
                } else {
                    status.textContent = 'Disconnected';
                    status.className = 'status disconnected';
                    requestBtn.disabled = true;
                    stopBtn.disabled = true;
                }
            }

            function updateDeviceStatus(connected) {
                const status = document.getElementById('deviceStatus');
                const testBtn = document.getElementById('testLogsBtn');

                if (connected) {
                    status.textContent = 'Connected';
                    status.className = 'status connected';
                    testBtn.disabled = false;
                } else {
                    status.textContent = 'Disconnected';
                    status.className = 'status disconnected';
                    testBtn.disabled = true;
                }
            }

            function addAdminLog(message) {
                addLog('adminLogs', message);
            }

            function addDeviceLog(message) {
                addLog('deviceLogs', message);
            }

            function addAPIResult(message) {
                addLog('apiResults', message);
            }

            function addLog(containerId, message) {
                const container = document.getElementById(containerId);
                const logEntry = document.createElement('div');
                logEntry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
                container.appendChild(logEntry);
                container.scrollTop = container.scrollHeight;

                // Keep only last 50 entries
                while (container.children.length > 50) {
                    container.removeChild(container.firstChild);
                }
            }
        </script>
    </body>
    </html>
  `);
});

module.exports = router;
