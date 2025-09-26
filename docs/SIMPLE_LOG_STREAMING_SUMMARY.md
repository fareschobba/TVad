# Simple Real-Time Log Streaming System

## Overview
A lightweight Socket.IO-based log streaming system that streams logs in real-time from Android TV devices to admin clients. **No database storage** - everything happens live!

## How It Works

### 1. Admin Requests Logs
```javascript
socket.emit('requestLogs', {
  deviceId: 'DEVICE123',
  tags: ['TAG_VIDEO', 'TAG_NETWORK'],  // Optional filtering
  sessionId: 'unique-session-id'       // Optional
});
```

### 2. Server Notifies Device
Server sends `requestLogs/DEVICE123` event to the device with session details.

### 3. Device Streams Logs
```javascript
socket.emit('logsData', {
  sessionId: 'session-id',
  deviceId: 'DEVICE123',
  logs: [
    {
      timestamp: 1640995200000,
      level: 'I',                    // V, D, I, W, E
      tag: 'TAG_VIDEO',
      message: 'Video playback started',
      deviceId: 'DEVICE123',
      formattedTime: '2022-01-01 12:00:00'
    }
  ]
});
```

### 4. Admin Receives Logs
```javascript
socket.on('logsData', (data) => {
  console.log('Received logs:', data.logs);
});
```

### 5. Stop Streaming
```javascript
socket.emit('stopLogs', {
  deviceId: 'DEVICE123',
  sessionId: 'session-id'
});
```

## Key Features

✅ **Real-time streaming only** - No database storage  
✅ **Tag-based filtering** - Filter by log categories  
✅ **Multiple admin support** - Multiple admins can monitor same device  
✅ **Session management** - Track active streaming sessions  
✅ **Auto cleanup** - Sessions cleaned up on disconnect  
✅ **Memory efficient** - All data stored in memory only  

## Supported Log Tags

- `TAG_SOCKET` - Socket.IO communications
- `TAG_VIDEO` - Video playback events  
- `TAG_DOWNLOAD` - File download progress
- `TAG_STORAGE` - USB storage operations
- `TAG_NETWORK` - API calls and connectivity
- `TAG_SYSTEM` - System state changes
- `TAG_MEMORY` - Memory management
- `TAG_USB` - USB device events
- `TAG_SCHEDULE` - Advertisement scheduling
- `TAG_PLAYBACK` - Media playback events

## Log Levels

- `V` - Verbose
- `D` - Debug  
- `I` - Info
- `W` - Warning
- `E` - Error

## Quick Start

### 1. Start the Server
```bash
npm start
```

### 2. Test with Admin Client
Open `admin_client_example.html` in your browser and:
- Connect to server
- Enter device ID
- Select log tags
- Click "Start Log Streaming"

### 3. Test with Device Simulator
```bash
node test_log_streaming.js
```

### 4. Monitor Sessions
```bash
curl http://localhost:3001/api/logs/sessions
```

## File Structure

```
src/
├── config/socket.js              # Socket.IO event handlers
├── controllers/logController.js  # Session management logic
├── services/logStreaming.service.js # Utility functions
├── routes/logRoutes.js           # REST API endpoints
└── server.js                     # Main server file

# Test & Examples
├── test_log_streaming.js         # Test script
├── admin_client_example.html     # Web admin client
└── ANDROID_TV_INTEGRATION_EXAMPLE.md # Android integration guide
```

## REST API Endpoints

- `GET /api/logs/status` - System status
- `GET /api/logs/sessions` - Active sessions
- `GET /api/logs/info` - System information

## Android TV Integration

See `ANDROID_TV_INTEGRATION_EXAMPLE.md` for complete Kotlin/Java examples.

### Quick Android Example
```kotlin
// Initialize
val logManager = LogStreamingManager("http://server:3001", "DEVICE123")
logManager.connect()

// Send logs
logManager.sendLog("I", "TAG_VIDEO", "Video started")
logManager.sendLog("E", "TAG_NETWORK", "Connection failed")

// Cleanup
logManager.disconnect()
```

## Benefits of This Approach

1. **Simple** - No database setup or management
2. **Fast** - Real-time streaming with minimal latency
3. **Lightweight** - Low memory footprint
4. **Scalable** - Can handle multiple devices and admins
5. **Reliable** - Auto-cleanup prevents memory leaks
6. **Flexible** - Easy to extend with new log tags

## Limitations

1. **No Historical Data** - Logs are not stored permanently
2. **Memory Only** - Sessions lost on server restart
3. **Real-time Only** - Must be connected to receive logs

## Perfect For

- **Live debugging** of Android TV applications
- **Real-time monitoring** of device status
- **Development and testing** environments
- **Temporary log analysis** without storage overhead

This system is ideal when you need live log streaming without the complexity of database management!
