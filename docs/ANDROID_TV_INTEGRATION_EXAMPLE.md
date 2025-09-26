# Android TV Integration Example

## Overview

This document provides examples for integrating the log streaming system with Android TV applications.

## Kotlin Implementation

### Dependencies

Add to your `build.gradle` file:

```gradle
implementation 'io.socket:socket.io-client:2.0.0'
implementation 'org.json:json:20210307'
```

### LogStreaming Manager

```kotlin
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

class LogStreamingManager(private val serverUrl: String, private val deviceId: String) {
    private var socket: Socket? = null
    private var activeSessions = mutableSetOf<String>()
    private val dateFormatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())

    fun connect() {
        try {
            socket = IO.socket(serverUrl)
            
            socket?.on(Socket.EVENT_CONNECT) {
                println("Connected to log streaming server")
            }
            
            socket?.on(Socket.EVENT_DISCONNECT) {
                println("Disconnected from log streaming server")
                activeSessions.clear()
            }
            
            // Listen for log requests
            socket?.on("requestLogs/$deviceId") { args ->
                handleLogRequest(args[0] as JSONObject)
            }
            
            // Listen for stop log requests
            socket?.on("stopLogs/$deviceId") { args ->
                handleStopLogRequest(args[0] as JSONObject)
            }
            
            socket?.connect()
        } catch (e: Exception) {
            println("Error connecting to log streaming server: ${e.message}")
        }
    }
    
    fun disconnect() {
        socket?.disconnect()
        activeSessions.clear()
    }
    
    private fun handleLogRequest(data: JSONObject) {
        val sessionId = data.getString("sessionId")
        val tags = data.optJSONArray("tags")?.let { jsonArray ->
            (0 until jsonArray.length()).map { jsonArray.getString(it) }
        } ?: emptyList()
        val includeHistorical = data.optBoolean("includeHistorical", false)
        
        println("Received log request - Session: $sessionId, Tags: $tags")
        
        activeSessions.add(sessionId)
        
        // Send historical logs if requested
        if (includeHistorical) {
            sendHistoricalLogs(sessionId, tags)
        }
        
        // Start real-time logging for this session
        startRealTimeLogging(sessionId, tags)
    }
    
    private fun handleStopLogRequest(data: JSONObject) {
        val sessionId = data.optString("sessionId")
        
        if (sessionId.isNotEmpty()) {
            activeSessions.remove(sessionId)
            println("Stopped log session: $sessionId")
        } else {
            // Stop all sessions for this device
            activeSessions.clear()
            println("Stopped all log sessions")
        }
    }
    
    private fun sendHistoricalLogs(sessionId: String, tags: List<String>) {
        // This is a mock implementation - replace with actual historical log retrieval
        val historicalLogs = getHistoricalLogs(tags, 50)
        
        if (historicalLogs.isNotEmpty()) {
            sendLogs(sessionId, historicalLogs)
        }
    }
    
    private fun startRealTimeLogging(sessionId: String, tags: List<String>) {
        // This would typically integrate with your existing logging system
        // For now, we'll just mark the session as active
        println("Started real-time logging for session: $sessionId with tags: $tags")
    }
    
    fun sendLog(level: String, tag: String, message: String) {
        if (activeSessions.isEmpty()) return
        
        val logEntry = createLogEntry(level, tag, message)
        
        // Send to all active sessions that match the tag filter
        activeSessions.forEach { sessionId ->
            sendLogs(sessionId, listOf(logEntry))
        }
    }
    
    private fun sendLogs(sessionId: String, logs: List<LogEntry>) {
        try {
            val data = JSONObject().apply {
                put("sessionId", sessionId)
                put("deviceId", deviceId)
                put("logs", JSONArray().apply {
                    logs.forEach { log ->
                        put(JSONObject().apply {
                            put("timestamp", log.timestamp)
                            put("level", log.level)
                            put("tag", log.tag)
                            put("message", log.message)
                            put("deviceId", log.deviceId)
                            put("formattedTime", log.formattedTime)
                        })
                    }
                })
            }
            
            socket?.emit("logsData", data)
        } catch (e: Exception) {
            println("Error sending logs: ${e.message}")
        }
    }
    
    private fun createLogEntry(level: String, tag: String, message: String): LogEntry {
        val timestamp = System.currentTimeMillis()
        return LogEntry(
            timestamp = timestamp,
            level = level,
            tag = tag,
            message = message,
            deviceId = deviceId,
            formattedTime = dateFormatter.format(Date(timestamp))
        )
    }
    
    private fun getHistoricalLogs(tags: List<String>, limit: Int): List<LogEntry> {
        // Mock implementation - replace with actual historical log retrieval
        // This could read from local storage, database, or log files
        return emptyList()
    }
}

data class LogEntry(
    val timestamp: Long,
    val level: String,
    val tag: String,
    val message: String,
    val deviceId: String,
    val formattedTime: String
)
```

### Usage in Android TV App

```kotlin
class MainActivity : Activity() {
    private lateinit var logStreamingManager: LogStreamingManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize log streaming
        logStreamingManager = LogStreamingManager(
            serverUrl = "http://your-server:3001",
            deviceId = "DEVICE_${getDeviceId()}"
        )
        
        logStreamingManager.connect()
        
        // Example: Send logs for different events
        logStreamingManager.sendLog("I", "TAG_SYSTEM", "App started")
    }
    
    override fun onDestroy() {
        super.onDestroy()
        logStreamingManager.disconnect()
    }
    
    private fun getDeviceId(): String {
        // Return unique device identifier
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
    }
    
    // Example: Video playback events
    private fun onVideoStarted(videoUrl: String) {
        logStreamingManager.sendLog("I", "TAG_VIDEO", "Video playback started: $videoUrl")
    }
    
    private fun onVideoError(error: String) {
        logStreamingManager.sendLog("E", "TAG_VIDEO", "Video playback error: $error")
    }
    
    // Example: Network events
    private fun onApiCall(endpoint: String) {
        logStreamingManager.sendLog("D", "TAG_NETWORK", "API call: $endpoint")
    }
    
    private fun onApiError(endpoint: String, error: String) {
        logStreamingManager.sendLog("E", "TAG_NETWORK", "API error on $endpoint: $error")
    }
}
```

### Integration with Existing Logging

```kotlin
// Custom log wrapper that sends to both local logs and streaming server
object TVLogger {
    private var logStreamingManager: LogStreamingManager? = null
    
    fun initialize(serverUrl: String, deviceId: String) {
        logStreamingManager = LogStreamingManager(serverUrl, deviceId)
        logStreamingManager?.connect()
    }
    
    fun v(tag: String, message: String) {
        Log.v(tag, message)
        logStreamingManager?.sendLog("V", tag, message)
    }
    
    fun d(tag: String, message: String) {
        Log.d(tag, message)
        logStreamingManager?.sendLog("D", tag, message)
    }
    
    fun i(tag: String, message: String) {
        Log.i(tag, message)
        logStreamingManager?.sendLog("I", tag, message)
    }
    
    fun w(tag: String, message: String) {
        Log.w(tag, message)
        logStreamingManager?.sendLog("W", tag, message)
    }
    
    fun e(tag: String, message: String) {
        Log.e(tag, message)
        logStreamingManager?.sendLog("E", tag, message)
    }
    
    fun cleanup() {
        logStreamingManager?.disconnect()
    }
}
```

## Java Implementation

### LogStreamingManager (Java)

```java
import io.socket.client.IO;
import io.socket.client.Socket;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.*;

public class LogStreamingManager {
    private Socket socket;
    private String serverUrl;
    private String deviceId;
    private Set<String> activeSessions = new HashSet<>();
    private SimpleDateFormat dateFormatter = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
    
    public LogStreamingManager(String serverUrl, String deviceId) {
        this.serverUrl = serverUrl;
        this.deviceId = deviceId;
    }
    
    public void connect() {
        try {
            socket = IO.socket(serverUrl);
            
            socket.on(Socket.EVENT_CONNECT, args -> {
                System.out.println("Connected to log streaming server");
            });
            
            socket.on(Socket.EVENT_DISCONNECT, args -> {
                System.out.println("Disconnected from log streaming server");
                activeSessions.clear();
            });
            
            socket.on("requestLogs/" + deviceId, args -> {
                handleLogRequest((JSONObject) args[0]);
            });
            
            socket.on("stopLogs/" + deviceId, args -> {
                handleStopLogRequest((JSONObject) args[0]);
            });
            
            socket.connect();
        } catch (Exception e) {
            System.err.println("Error connecting to log streaming server: " + e.getMessage());
        }
    }
    
    public void sendLog(String level, String tag, String message) {
        if (activeSessions.isEmpty()) return;
        
        LogEntry logEntry = createLogEntry(level, tag, message);
        
        for (String sessionId : activeSessions) {
            sendLogs(sessionId, Arrays.asList(logEntry));
        }
    }
    
    private void handleLogRequest(JSONObject data) {
        try {
            String sessionId = data.getString("sessionId");
            activeSessions.add(sessionId);
            System.out.println("Started log session: " + sessionId);
        } catch (Exception e) {
            System.err.println("Error handling log request: " + e.getMessage());
        }
    }
    
    private void handleStopLogRequest(JSONObject data) {
        try {
            String sessionId = data.optString("sessionId");
            if (!sessionId.isEmpty()) {
                activeSessions.remove(sessionId);
            } else {
                activeSessions.clear();
            }
        } catch (Exception e) {
            System.err.println("Error handling stop log request: " + e.getMessage());
        }
    }
    
    private LogEntry createLogEntry(String level, String tag, String message) {
        long timestamp = System.currentTimeMillis();
        return new LogEntry(
            timestamp,
            level,
            tag,
            message,
            deviceId,
            dateFormatter.format(new Date(timestamp))
        );
    }
    
    private void sendLogs(String sessionId, List<LogEntry> logs) {
        try {
            JSONObject data = new JSONObject();
            data.put("sessionId", sessionId);
            data.put("deviceId", deviceId);
            
            JSONArray logsArray = new JSONArray();
            for (LogEntry log : logs) {
                JSONObject logObj = new JSONObject();
                logObj.put("timestamp", log.timestamp);
                logObj.put("level", log.level);
                logObj.put("tag", log.tag);
                logObj.put("message", log.message);
                logObj.put("deviceId", log.deviceId);
                logObj.put("formattedTime", log.formattedTime);
                logsArray.put(logObj);
            }
            data.put("logs", logsArray);
            
            socket.emit("logsData", data);
        } catch (Exception e) {
            System.err.println("Error sending logs: " + e.getMessage());
        }
    }
    
    public void disconnect() {
        if (socket != null) {
            socket.disconnect();
        }
        activeSessions.clear();
    }
    
    public static class LogEntry {
        public final long timestamp;
        public final String level;
        public final String tag;
        public final String message;
        public final String deviceId;
        public final String formattedTime;
        
        public LogEntry(long timestamp, String level, String tag, String message, String deviceId, String formattedTime) {
            this.timestamp = timestamp;
            this.level = level;
            this.tag = tag;
            this.message = message;
            this.deviceId = deviceId;
            this.formattedTime = formattedTime;
        }
    }
}
```

## Best Practices

1. **Connection Management**: Handle connection failures and reconnection logic
2. **Buffering**: Buffer logs when disconnected and send when reconnected
3. **Performance**: Avoid sending too many logs too frequently
4. **Security**: Use secure connections (WSS) in production
5. **Error Handling**: Implement proper error handling for all socket events
6. **Memory Management**: Clean up resources properly on app termination
