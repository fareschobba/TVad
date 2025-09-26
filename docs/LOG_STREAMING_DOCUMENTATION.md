# Socket.IO Real-Time Log Streaming System Documentation

## Overview

This document describes the Socket.IO-based real-time log streaming system for Android TV devices. The system enables live log streaming from Android TV devices to admin clients with tag-based filtering and session management. **No logs are stored persistently** - all streaming happens in real-time only.

## Architecture

### Components

1. **Socket.IO Server** (`src/config/socket.js`)
   - Handles WebSocket connections
   - Manages log streaming events
   - Routes messages between devices and admins

2. **Log Controller** (`src/controllers/logController.js`)
   - Manages log sessions
   - Handles log storage and retrieval
   - Provides session cleanup utilities

3. **Log Service** (`src/services/logStreaming.service.js`)
   - Utility functions for log processing
   - Broadcasting and validation logic

4. **REST API** (`src/routes/logRoutes.js`)
   - HTTP endpoints for session monitoring
   - System status and information

## Socket.IO Events

### Admin → Server Events

#### `requestLogs`
Request log streaming from a specific device.

**Payload:**
```javascript
{
  deviceId: "DEVICE123",           // Required: Target device ID
  tags: ["TAG_VIDEO", "TAG_NETWORK"], // Optional: Filter by log tags
  sessionId: "uuid-string"         // Optional: Custom session ID
}
```

**Response Events:**
- `logSessionStarted` - Confirms session creation
- `logError` - Error occurred

#### `stopLogs`
Stop log streaming from a device.

**Payload:**
```javascript
{
  deviceId: "DEVICE123",    // Required: Target device ID
  sessionId: "uuid-string"  // Optional: Specific session to stop
}
```

**Response Events:**
- `logSessionStopped` - Confirms session ended
- `logError` - Error occurred

### Device → Server Events

#### `logsData`
Send log entries to the server.

**Payload:**
```javascript
{
  sessionId: "uuid-string",  // Required: Session identifier
  deviceId: "DEVICE123",     // Required: Device identifier
  logs: [                    // Required: Array of log entries
    {
      timestamp: 1640995200000,     // Unix timestamp in milliseconds
      level: "I",                   // Log level: V, D, I, W, E
      tag: "TAG_VIDEO",             // Log tag
      message: "Video playback started", // Log message
      deviceId: "DEVICE123",        // Device identifier
      formattedTime: "2022-01-01 12:00:00" // Human-readable time
    }
  ]
}
```

### Server → Device Events

#### `requestLogs/{deviceId}`
Server requests device to start streaming logs.

**Payload:**
```javascript
{
  sessionId: "uuid-string",         // Session identifier
  tags: ["TAG_VIDEO"],              // Requested log tags
  adminSocketId: "socket-id"        // Admin socket requesting logs
}
```

#### `stopLogs/{deviceId}`
Server requests device to stop streaming logs.

**Payload:**
```javascript
{
  sessionId: "uuid-string",    // Session identifier
  adminSocketId: "socket-id"   // Admin socket stopping logs
}
```

### Server → Admin Events

#### `logsData`
Server forwards log data to admin.

**Payload:**
```javascript
{
  sessionId: "uuid-string",  // Session identifier
  deviceId: "DEVICE123",     // Device identifier
  logs: [...]                // Array of log entries
}
```

#### `logSessionStarted`
Confirms log session has started.

**Payload:**
```javascript
{
  sessionId: "uuid-string",
  deviceId: "DEVICE123",
  tags: ["TAG_VIDEO"]
}
```

#### `logSessionStopped`
Confirms log session has ended.

**Payload:**
```javascript
{
  sessionId: "uuid-string",
  deviceId: "DEVICE123"
}
```

#### `logError`
Error occurred during log operations.

**Payload:**
```javascript
{
  message: "Error description",
  error: "Detailed error message"
}
```

## Log Tags

The system supports the following predefined log tags:

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

## REST API Endpoints

### GET `/api/logs/status`
Get current log streaming status.

**Response:**
```javascript
{
  success: true,
  message: "Log streaming is active - no persistent storage",
  data: {
    storageType: "real-time-only",
    persistentLogs: false,
    description: "Logs are streamed in real-time only when requested"
  }
}
```

### GET `/api/logs/sessions`
Get active log sessions.

**Response:**
```javascript
{
  success: true,
  data: [...], // Array of active sessions
  count: 2
}
```

### GET `/api/logs/info`
Get information about the log streaming system.

**Response:**
```javascript
{
  success: true,
  data: {
    systemType: "Real-time Log Streaming",
    activeSessions: 2,
    activeDevices: 1,
    activeAdmins: 1,
    features: [...],
    supportedTags: [...],
    supportedLevels: ["V", "D", "I", "W", "E"]
  }
}
```

## Usage Examples

### Admin Client (JavaScript)

```javascript
const socket = io('http://localhost:3001');

// Request logs from device
socket.emit('requestLogs', {
  deviceId: 'DEVICE123',
  tags: ['TAG_VIDEO', 'TAG_NETWORK']
});

// Listen for log data
socket.on('logsData', (data) => {
  console.log('Received logs:', data.logs);
  console.log('Session:', data.sessionId);
});

// Stop log streaming
socket.emit('stopLogs', {
  deviceId: 'DEVICE123'
});
```

### Android TV Device (Kotlin/Java)

```kotlin
// Send logs to server
val logs = listOf(
  mapOf(
    "timestamp" to System.currentTimeMillis(),
    "level" to "I",
    "tag" to "TAG_VIDEO",
    "message" to "Video playback started",
    "deviceId" to "DEVICE123",
    "formattedTime" to SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(Date())
  )
)

socket.emit("logsData", mapOf(
  "sessionId" to sessionId,
  "deviceId" to "DEVICE123",
  "logs" to logs
))
```

## In-Memory Session Storage

### Session Object Structure
```javascript
{
  sessionId: String,       // Unique session identifier
  deviceId: String,        // Device identifier
  adminSocketId: String,   // Admin socket ID
  deviceSocketId: String,  // Device socket ID (nullable)
  tags: [String],          // Requested log tags
  isActive: Boolean,       // Session active status
  startedAt: Date          // Session start time
}
```

**Note:** Sessions are stored in memory only and are lost when the server restarts. No persistent storage is used for logs or sessions.

## Features

1. **Real-time Streaming** - Live log streaming from devices to admins
2. **Tag Filtering** - Filter logs by specific tags
3. **Session Management** - Track and manage active streaming sessions
4. **Multiple Admins** - Support for multiple admin clients per device
5. **Memory-based Storage** - No persistent storage, all data in memory
6. **Auto Cleanup** - Automatic cleanup on socket disconnection
7. **Error Handling** - Comprehensive error handling and reporting
8. **REST API** - HTTP endpoints for session monitoring and system info

## Security Considerations

1. **Authentication** - All REST endpoints require authentication
2. **Authorization** - Admin-only access to sensitive operations
3. **Rate Limiting** - Consider implementing rate limiting for log ingestion
4. **Memory Management** - Monitor memory usage for high-volume log streams
5. **Session Cleanup** - Automatic cleanup on socket disconnection
6. **No Data Persistence** - No sensitive log data stored permanently
