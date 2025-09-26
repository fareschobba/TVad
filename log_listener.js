// log_listener.js - Simple script to listen to device logs
const io = require('socket.io-client');

// Configuration
const SERVER_URL = 'http://localhost:3001';
const DEVICE_ID = 'TEST_DEVICE_001';

console.log('🎧 Starting Log Listener...');
console.log(`Server: ${SERVER_URL}`);
console.log(`Monitoring Device: ${DEVICE_ID}`);

// Connect to server
const socket = io(SERVER_URL);

socket.on('connect', () => {
  console.log('✅ Connected to server');
  console.log('Socket ID:', socket.id);
  
  // Request logs from device
  const sessionId = `listener-${Date.now()}`;
  console.log(`📡 Requesting logs with session: ${sessionId}`);
  
  socket.emit('requestLogs', {
    deviceId: DEVICE_ID,
    tags: ['TAG_VIDEO', 'TAG_NETWORK', 'TAG_SYSTEM'], // Filter by tags
    sessionId: sessionId
  });
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

// Listen for session confirmation
socket.on('logSessionStarted', (data) => {
  console.log('🚀 Log session started:', data);
});

// Listen for logs from device
socket.on('logsData', (data) => {
  console.log('\n📦 Received log batch:');
  console.log(`   Session: ${data.sessionId}`);
  console.log(`   Device: ${data.deviceId}`);
  console.log(`   Count: ${data.logs.length}`);
  console.log('   Logs:');
  
  data.logs.forEach((log, index) => {
    const levelColor = {
      'V': '\x1b[90m', // Gray
      'D': '\x1b[36m', // Cyan  
      'I': '\x1b[32m', // Green
      'W': '\x1b[33m', // Yellow
      'E': '\x1b[31m'  // Red
    };
    
    const resetColor = '\x1b[0m';
    const color = levelColor[log.level] || '';
    
    console.log(`   ${index + 1}. ${color}[${log.level}] [${log.tag}] ${log.message}${resetColor}`);
    console.log(`      Time: ${log.formattedTime}`);
  });
});

// Listen for session end
socket.on('logSessionStopped', (data) => {
  console.log('⏹️ Log session stopped:', data);
});

// Listen for errors
socket.on('logError', (error) => {
  console.error('❌ Log error:', error);
});

// Handle connection errors
socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down log listener...');
  
  socket.emit('stopLogs', {
    deviceId: DEVICE_ID
  });
  
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

console.log('\n📝 Instructions:');
console.log('1. Make sure your server is running');
console.log('2. Start a device emulator or real device');
console.log('3. This listener will automatically request and display logs');
console.log('4. Press Ctrl+C to stop\n');
