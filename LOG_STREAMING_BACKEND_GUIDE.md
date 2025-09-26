# 📡 Log Streaming Backend Implementation Guide

## Overview

This document provides a comprehensive breakdown of the log streaming backend implementation for the Android TV Log Management System. Use this guide to adapt your Kotlin app to communicate with the latest backend changes.

## 🏗️ System Architecture

### **Components**
- **Admin Dashboard**: Web interface for log management
- **Node.js Backend**: Socket.IO server handling real-time communication
- **Android TV App**: Kotlin app that streams logs
- **In-Memory Session Management**: No database persistence

### **Communication Flow**
```
Admin Dashboard ←→ Node.js Backend ←→ Android TV Device
     (WebSocket)        (Socket.IO)        (WebSocket)
```

## 🔌 Socket.IO Events Reference

### **1. Log Session Management**

#### **Admin → Backend: Request Logs**
```javascript
// Event: "requestLogs"
{
  "deviceId": "DEVICE_12345",
  "sessionId": "dashboard-1703123456789", // Optional, auto-generated if not provided
  "tags": ["SocketIO", "VideoActivity", "ALL"], // Array of log tags to filter
  "packageFilter": "package:com.kamran.tvadapp", // Optional package filter
  "includeHistorical": true // Whether to include historical logs
}
```

#### **Backend → Device: Request Logs**
```javascript
// Event: "requestLogs/DEVICE_12345"
{
  "sessionId": "session-1703123456789-abc123",
  "tags": ["SocketIO", "VideoActivity"],
  "packageFilter": "package:com.kamran.tvadapp", // Optional
  "includeHistorical": true,
  "adminSocketId": "admin-socket-id-123"
}
```

#### **Backend → Admin: Session Started**
```javascript
// Event: "logSessionStarted"
{
  "sessionId": "session-1703123456789-abc123",
  "deviceId": "DEVICE_12345",
  "tags": ["SocketIO", "VideoActivity"],
  "packageFilter": "package:com.kamran.tvadapp", // null if not specified
  "includeHistorical": true
}
```

### **2. Log Data Streaming**

#### **Device → Backend: Send Logs (Real-time)**
```javascript
// Event: "logsData"
{
  "type": "realtime",
  "sessionId": "session-1703123456789-abc123",
  "log": {
    "deviceId": "DEVICE_12345",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "level": "INFO", // DEBUG, INFO, WARN, ERROR
    "tag": "SocketIO",
    "message": "Connected to server successfully",
    "packageName": "com.kamran.tvadapp", // Optional
    "threadId": "main",
    "processId": "12345"
  }
}
```

#### **Device → Backend: Send Logs (Historical)**
```javascript
// Event: "logsData"
{
  "type": "historical",
  "sessionId": "session-1703123456789-abc123",
  "logs": [
    {
      "deviceId": "DEVICE_12345",
      "timestamp": "2024-01-01T11:59:00.000Z",
      "level": "DEBUG",
      "tag": "VideoActivity",
      "message": "Video playback started",
      "packageName": "com.kamran.tvadapp",
      "threadId": "video-thread",
      "processId": "12345"
    },
    // ... more log entries
  ]
}
```

#### **Backend → Admin: Forward Logs**
```javascript
// Event: "logsData"
{
  "sessionId": "session-1703123456789-abc123",
  "deviceId": "DEVICE_12345",
  "logs": [/* filtered log entries */],
  "isHistorical": false // true for historical logs
}
```

### **3. Session Termination**

#### **Admin → Backend: Stop Logs**
```javascript
// Event: "stopLogs"
{
  "deviceId": "DEVICE_12345",
  "sessionId": "session-1703123456789-abc123" // Optional, if not provided stops ALL sessions for device
}
```

#### **Backend → Device: Stop Logs**
```javascript
// Event: "stopLogs/DEVICE_12345"
{
  "sessionId": "session-1703123456789-abc123", // null if stopping all
  "adminSocketId": "admin-socket-id-123",
  "stoppedSessions": ["session-1", "session-2"] // Array of stopped session IDs
}
```

#### **Backend → Admin: Session Stopped**
```javascript
// Event: "logSessionStopped"
{
  "sessionId": "session-1703123456789-abc123",
  "deviceId": "DEVICE_12345",
  "stoppedSessions": 2 // Number of sessions stopped
}
```

## 🏷️ Supported Log Tags

### **Standard Tags**
```kotlin
// Predefined log tags your Kotlin app should support
const val TAG_SOCKET = "SocketIO"
const val TAG_VIDEO = "VideoActivity"
const val TAG_DOWNLOAD = "DownloadProcess"
const val TAG_STORAGE = "StorageManager"
const val TAG_NETWORK = "NetworkManager"
const val TAG_SYSTEM = "SystemMonitor"
const val TAG_MEMORY = "MemoryMonitor"
const val TAG_USB = "USBManager"
const val TAG_SCHEDULE = "ScheduleManager"
const val TAG_TVAD = "TvAdApp"
const val TAG_DEVICE = "DeviceManager"
const val TAG_API = "ApiService"
const val TAG_BOOT = "BootManager"
const val TAG_LIFECYCLE = "ActivityLifecycle"
const val TAG_VIDEO_VALIDATION = "VideoValidation"
const val TAG_MEDIA_PLAYBACK = "MediaPlayback"
const val TAG_ORIENTATION = "OrientationManager"
const val TAG_CACHE = "CacheManager"
const val TAG_HEALTH = "HealthCheck"

// Special tag for complete logcat streaming
const val TAG_ALL = "ALL"
```

## 📦 Package Filtering

### **Package Filter Format**
```
package:com.kamran.tvadapp
```

### **Implementation in Kotlin**
```kotlin
// When receiving requestLogs event
data class LogRequest(
    val sessionId: String,
    val tags: List<String>,
    val packageFilter: String?, // "package:com.kamran.tvadapp"
    val includeHistorical: Boolean,
    val adminSocketId: String
)

// Filter logs by package
fun shouldIncludeLog(logEntry: LogEntry, packageFilter: String?): Boolean {
    if (packageFilter == null) return true
    
    // Extract package name from filter (remove "package:" prefix)
    val targetPackage = packageFilter.removePrefix("package:")
    
    return logEntry.packageName == targetPackage
}
```

## 🔄 Session Management

### **Session Lifecycle**
1. **Creation**: Admin requests logs → Backend creates session → Device receives request
2. **Active**: Device streams logs → Backend filters and forwards → Admin receives logs
3. **Termination**: Admin stops logs → Backend ends session → Device stops streaming

### **Session Data Structure**
```javascript
// Backend session object
{
  sessionId: "session-1703123456789-abc123",
  deviceId: "DEVICE_12345",
  adminSocketId: "admin-socket-id-123",
  deviceSocketId: "device-socket-id-456", // Set when device connects
  tags: ["SocketIO", "VideoActivity"],
  packageFilter: "package:com.kamran.tvadapp",
  isActive: true,
  startedAt: "2024-01-01T12:00:00.000Z"
}
```

### **Cleanup Scenarios**
- **Admin disconnects**: All admin sessions terminated
- **Device disconnects**: Device socket ID cleared, sessions remain for reconnection
- **Explicit stop**: Specific session or all device sessions terminated
- **Server restart**: All sessions lost (in-memory storage)

## 🚀 Kotlin Implementation Guide

### **1. Socket Connection**
```kotlin
class LogStreamingManager {
    private val socket: Socket by lazy {
        IO.socket("http://your-server:3001")
    }
    
    fun connect() {
        socket.connect()
        setupEventListeners()
    }
    
    private fun setupEventListeners() {
        // Listen for log requests
        socket.on("requestLogs/${deviceId}") { args ->
            handleLogRequest(args[0] as JSONObject)
        }
        
        // Listen for stop requests
        socket.on("stopLogs/${deviceId}") { args ->
            handleStopRequest(args[0] as JSONObject)
        }
    }
}
```

### **2. Handle Log Requests**
```kotlin
private fun handleLogRequest(data: JSONObject) {
    val sessionId = data.getString("sessionId")
    val tags = data.getJSONArray("tags").toStringList()
    val packageFilter = data.optString("packageFilter", null)
    val includeHistorical = data.getBoolean("includeHistorical")
    
    // Start log streaming
    startLogStreaming(sessionId, tags, packageFilter, includeHistorical)
}

private fun startLogStreaming(
    sessionId: String,
    tags: List<String>,
    packageFilter: String?,
    includeHistorical: Boolean
) {
    // Send historical logs first if requested
    if (includeHistorical) {
        sendHistoricalLogs(sessionId, tags, packageFilter)
    }
    
    // Start real-time log streaming
    startRealtimeLogStreaming(sessionId, tags, packageFilter)
}
```

### **3. Send Historical Logs**
```kotlin
private fun sendHistoricalLogs(
    sessionId: String,
    tags: List<String>,
    packageFilter: String?
) {
    val historicalLogs = getStoredLogs()
        .filter { log -> shouldIncludeLog(log, tags, packageFilter) }
    
    if (historicalLogs.isNotEmpty()) {
        val data = JSONObject().apply {
            put("type", "historical")
            put("sessionId", sessionId)
            put("logs", JSONArray(historicalLogs.map { it.toJson() }))
        }
        
        socket.emit("logsData", data)
    }
}
```

### **4. Stream Real-time Logs**
```kotlin
private fun startRealtimeLogStreaming(
    sessionId: String,
    tags: List<String>,
    packageFilter: String?
) {
    // Start logcat process or use existing log collection
    logcatProcess = startLogcatProcess(tags, packageFilter)
    
    logcatProcess.outputStream.bufferedReader().use { reader ->
        reader.lineSequence().forEach { line ->
            val logEntry = parseLogLine(line)
            
            if (shouldIncludeLog(logEntry, tags, packageFilter)) {
                sendRealtimeLog(sessionId, logEntry)
            }
        }
    }
}

private fun sendRealtimeLog(sessionId: String, logEntry: LogEntry) {
    val data = JSONObject().apply {
        put("type", "realtime")
        put("sessionId", sessionId)
        put("log", logEntry.toJson())
    }
    
    socket.emit("logsData", data)
}
```

### **5. Log Filtering Logic**
```kotlin
private fun shouldIncludeLog(
    logEntry: LogEntry,
    tags: List<String>,
    packageFilter: String?
): Boolean {
    // Check package filter first
    if (packageFilter != null) {
        val targetPackage = packageFilter.removePrefix("package:")
        if (logEntry.packageName != targetPackage) {
            return false
        }
    }
    
    // If no tags specified or ALL tag present, include all logs
    if (tags.isEmpty() || tags.contains("ALL")) {
        return true
    }
    
    // Check if log tag matches any of the requested tags
    return tags.contains(logEntry.tag)
}
```

### **6. Handle Stop Requests**
```kotlin
private fun handleStopRequest(data: JSONObject) {
    val sessionId = data.optString("sessionId", null)
    
    if (sessionId != null) {
        // Stop specific session
        stopLogSession(sessionId)
    } else {
        // Stop all sessions for this device
        stopAllLogSessions()
    }
}

private fun stopLogSession(sessionId: String) {
    activeSessions.remove(sessionId)?.let { session ->
        session.logcatProcess?.destroy()
        Log.d(TAG_SOCKET, "Stopped log session: $sessionId")
    }
}
```

## 🔧 Error Handling

### **Connection Errors**
```kotlin
socket.on(Socket.EVENT_CONNECT_ERROR) { args ->
    Log.e(TAG_SOCKET, "Connection error: ${args[0]}")
    // Implement reconnection logic
}

socket.on(Socket.EVENT_DISCONNECT) { args ->
    Log.w(TAG_SOCKET, "Disconnected: ${args[0]}")
    // Clean up active sessions
    stopAllLogSessions()
}
```

### **Log Streaming Errors**
```kotlin
private fun handleLogStreamingError(sessionId: String, error: Exception) {
    Log.e(TAG_SOCKET, "Log streaming error for session $sessionId", error)
    
    // Notify backend about the error
    val errorData = JSONObject().apply {
        put("sessionId", sessionId)
        put("error", error.message)
        put("deviceId", deviceId)
    }
    
    socket.emit("logStreamingError", errorData)
}
```

## 📊 Performance Considerations

### **Log Batching**
```kotlin
// Batch logs for better performance
private val logBuffer = mutableListOf<LogEntry>()
private val batchSize = 50
private val batchTimeout = 1000L // 1 second

private fun bufferLog(sessionId: String, logEntry: LogEntry) {
    logBuffer.add(logEntry)
    
    if (logBuffer.size >= batchSize) {
        flushLogBuffer(sessionId)
    }
}

private fun flushLogBuffer(sessionId: String) {
    if (logBuffer.isNotEmpty()) {
        val data = JSONObject().apply {
            put("type", "realtime")
            put("sessionId", sessionId)
            put("logs", JSONArray(logBuffer.map { it.toJson() }))
        }
        
        socket.emit("logsData", data)
        logBuffer.clear()
    }
}
```

### **Memory Management**
```kotlin
// Limit historical log storage
private val maxHistoricalLogs = 1000
private val historicalLogs = CircularBuffer<LogEntry>(maxHistoricalLogs)

// Clean up old sessions
private fun cleanupOldSessions() {
    val cutoffTime = System.currentTimeMillis() - TimeUnit.HOURS.toMillis(1)
    
    activeSessions.entries.removeAll { (_, session) ->
        session.startTime < cutoffTime
    }
}
```

## ✅ Testing Checklist

### **Basic Functionality**
- [ ] Device connects to Socket.IO server
- [ ] Receives `requestLogs/DEVICE_ID` events
- [ ] Sends historical logs when `includeHistorical: true`
- [ ] Streams real-time logs continuously
- [ ] Filters logs by tags correctly
- [ ] Filters logs by package correctly
- [ ] Handles `ALL` tag for complete logcat
- [ ] Stops streaming on `stopLogs/DEVICE_ID` events
- [ ] Cleans up sessions on disconnect

### **Edge Cases**
- [ ] Handles empty tag arrays
- [ ] Handles null package filters
- [ ] Manages multiple concurrent sessions
- [ ] Recovers from connection drops
- [ ] Handles malformed log data
- [ ] Manages memory efficiently

### **Integration Testing**
- [ ] Works with admin dashboard
- [ ] Proper session lifecycle management
- [ ] Correct event emission and reception
- [ ] Error handling and recovery

## 🔍 Backend Implementation Details

### **Server Configuration**
```javascript
// src/config/socket.js - Key configurations
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Connection URL for Kotlin app
const SERVER_URL = "http://your-server-ip:3001"
```

### **Session Storage Structure**
```javascript
// In-memory storage maps
const activeSessions = new Map(); // sessionId -> session data
const deviceSessions = new Map(); // deviceId -> Set of sessionIds
const adminSessions = new Map();  // adminSocketId -> Set of sessionIds

// Session cleanup on disconnect
socket.on('disconnect', () => {
  cleanupSessionsForSocket(socket.id);
});
```

### **Log Filtering Implementation**
```javascript
// Backend filters logs before forwarding to admin
for (const session of activeSessions) {
  let filteredLogs = logs;

  // Filter by tags
  if (session.tags && session.tags.length > 0 && !session.tags.includes('ALL')) {
    filteredLogs = logs.filter(log => session.tags.includes(log.tag));
  }

  // Package filtering is handled on device side for efficiency

  if (filteredLogs.length > 0) {
    io.to(session.adminSocketId).emit('logsData', {
      sessionId: session.sessionId,
      deviceId,
      logs: filteredLogs,
      isHistorical
    });
  }
}
```

## 📱 Kotlin App Integration Points

### **Required Dependencies**
```kotlin
// build.gradle (app level)
implementation 'io.socket:socket.io-client:2.0.0'
implementation 'org.json:json:20210307'
```

### **Device Registration**
```kotlin
// Your device should have a unique identifier
class DeviceManager {
    companion object {
        const val DEVICE_ID = "DEVICE_${Build.SERIAL}" // or your preferred ID scheme
    }
}
```

### **Complete Socket Event Mapping**
```kotlin
// Events your Kotlin app MUST handle
socket.on("requestLogs/${DEVICE_ID}") { /* Start log streaming */ }
socket.on("stopLogs/${DEVICE_ID}") { /* Stop log streaming */ }

// Events your Kotlin app MUST emit
socket.emit("logsData", logData) // Send logs to backend
socket.emit("logStreamingError", errorData) // Report errors
```

This guide provides everything needed to implement the Kotlin side of the log streaming system. The backend is ready to handle all these events and data formats! 🚀
