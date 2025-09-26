// test_log_streaming.js
// Simple test script to verify log streaming functionality

const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:3001';
const TEST_DEVICE_ID = 'TEST_DEVICE_001';

// Create admin client
const adminClient = io(SERVER_URL);
// Create device client
const deviceClient = io(SERVER_URL);

console.log('Starting log streaming test...');

// Admin client event handlers
adminClient.on('connect', () => {
  console.log('Admin client connected:', adminClient.id);
  
  // Request logs after connection
  setTimeout(() => {
    console.log('Requesting logs from device...');
    adminClient.emit('requestLogs', {
      deviceId: TEST_DEVICE_ID,
      tags: ['TAG_VIDEO', 'TAG_NETWORK'],
      sessionId: 'test-session-001'
    });
  }, 1000);
});

adminClient.on('logSessionStarted', (data) => {
  console.log('Log session started:', data);
});

adminClient.on('logsData', (data) => {
  console.log('Received logs:', {
    sessionId: data.sessionId,
    deviceId: data.deviceId,
    logCount: data.logs.length,
    logs: data.logs.slice(0, 2) // Show first 2 logs
  });
});

adminClient.on('logSessionStopped', (data) => {
  console.log('Log session stopped:', data);
});

adminClient.on('logError', (error) => {
  console.error('Log error:', error);
});

// Device client event handlers
deviceClient.on('connect', () => {
  console.log('Device client connected:', deviceClient.id);
});

deviceClient.on(`requestLogs/${TEST_DEVICE_ID}`, (data) => {
  console.log('Device received log request:', data);
  
  // Simulate sending logs
  setTimeout(() => {
    const testLogs = [
      {
        timestamp: Date.now(),
        level: 'I',
        tag: 'TAG_VIDEO',
        message: 'Video playback started',
        deviceId: TEST_DEVICE_ID,
        formattedTime: new Date().toISOString()
      },
      {
        timestamp: Date.now() + 1000,
        level: 'D',
        tag: 'TAG_NETWORK',
        message: 'API call to server successful',
        deviceId: TEST_DEVICE_ID,
        formattedTime: new Date(Date.now() + 1000).toISOString()
      },
      {
        timestamp: Date.now() + 2000,
        level: 'W',
        tag: 'TAG_VIDEO',
        message: 'Video buffer low',
        deviceId: TEST_DEVICE_ID,
        formattedTime: new Date(Date.now() + 2000).toISOString()
      }
    ];

    console.log('Device sending test logs...');
    deviceClient.emit('logsData', {
      sessionId: data.sessionId,
      deviceId: TEST_DEVICE_ID,
      logs: testLogs
    });
  }, 2000);
});

deviceClient.on(`stopLogs/${TEST_DEVICE_ID}`, (data) => {
  console.log('Device received stop logs request:', data);
});

// Test sequence
setTimeout(() => {
  console.log('Stopping log session...');
  adminClient.emit('stopLogs', {
    deviceId: TEST_DEVICE_ID,
    sessionId: 'test-session-001'
  });
}, 10000);

// Cleanup after test
setTimeout(() => {
  console.log('Test completed. Disconnecting clients...');
  adminClient.disconnect();
  deviceClient.disconnect();
  process.exit(0);
}, 15000);

// Error handlers
adminClient.on('connect_error', (error) => {
  console.error('Admin client connection error:', error);
});

deviceClient.on('connect_error', (error) => {
  console.error('Device client connection error:', error);
});

adminClient.on('disconnect', () => {
  console.log('Admin client disconnected');
});

deviceClient.on('disconnect', () => {
  console.log('Device client disconnected');
});
