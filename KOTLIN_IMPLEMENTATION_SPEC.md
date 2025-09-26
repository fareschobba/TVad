# 🔧 Kotlin Implementation Specification

## Complete Socket.IO Integration for Android TV Log Streaming

### **1. Dependencies & Setup**

```kotlin
// build.gradle (app level)
dependencies {
    implementation 'io.socket:socket.io-client:2.0.0'
    implementation 'org.json:json:20210307'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.6.4'
}

// AndroidManifest.xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_LOGS" />
```

### **2. Core Classes Structure**

```kotlin
// LogStreamingManager.kt - Main class for log streaming
class LogStreamingManager(private val context: Context) {
    companion object {
        private const val SERVER_URL = "http://your-server:3001"
        private const val DEVICE_ID = "DEVICE_${Build.SERIAL}"
        
        // Log tags constants
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
        const val TAG_ALL = "ALL"
    }
    
    private val socket: Socket by lazy {
        IO.socket(SERVER_URL)
    }
    
    private val activeSessions = mutableMapOf<String, LogSession>()
    private val historicalLogs = CircularBuffer<LogEntry>(1000)
    
    // ... implementation details below
}

// LogEntry.kt - Data class for log entries
data class LogEntry(
    val deviceId: String,
    val timestamp: String,
    val level: String, // DEBUG, INFO, WARN, ERROR
    val tag: String,
    val message: String,
    val packageName: String? = null,
    val threadId: String? = null,
    val processId: String? = null
) {
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("deviceId", deviceId)
            put("timestamp", timestamp)
            put("level", level)
            put("tag", tag)
            put("message", message)
            packageName?.let { put("packageName", it) }
            threadId?.let { put("threadId", it) }
            processId?.let { put("processId", it) }
        }
    }
}

// LogSession.kt - Data class for active sessions
data class LogSession(
    val sessionId: String,
    val tags: List<String>,
    val packageFilter: String?,
    val includeHistorical: Boolean,
    val startTime: Long,
    var logcatProcess: Process? = null,
    var isActive: Boolean = true
)
```

### **3. Socket Connection & Event Handling**

```kotlin
class LogStreamingManager {
    fun connect() {
        socket.connect()
        setupEventListeners()
        Log.d(TAG_SOCKET, "Connecting to log streaming server: $SERVER_URL")
    }
    
    private fun setupEventListeners() {
        // Connection events
        socket.on(Socket.EVENT_CONNECT) {
            Log.d(TAG_SOCKET, "Connected to log streaming server")
            // Optionally register device
            registerDevice()
        }
        
        socket.on(Socket.EVENT_DISCONNECT) { args ->
            Log.w(TAG_SOCKET, "Disconnected from server: ${args.getOrNull(0)}")
            cleanupAllSessions()
        }
        
        socket.on(Socket.EVENT_CONNECT_ERROR) { args ->
            Log.e(TAG_SOCKET, "Connection error: ${args.getOrNull(0)}")
        }
        
        // Log streaming events
        socket.on("requestLogs/$DEVICE_ID") { args ->
            handleLogRequest(args[0] as JSONObject)
        }
        
        socket.on("stopLogs/$DEVICE_ID") { args ->
            handleStopRequest(args[0] as JSONObject)
        }
    }
    
    private fun registerDevice() {
        val deviceInfo = JSONObject().apply {
            put("deviceId", DEVICE_ID)
            put("deviceName", Build.MODEL)
            put("androidVersion", Build.VERSION.RELEASE)
            put("appVersion", getAppVersion())
            put("timestamp", System.currentTimeMillis())
        }
        
        socket.emit("deviceRegistration", deviceInfo)
    }
}
```

### **4. Log Request Handling**

```kotlin
private fun handleLogRequest(data: JSONObject) {
    try {
        val sessionId = data.getString("sessionId")
        val tags = data.getJSONArray("tags").toStringList()
        val packageFilter = data.optString("packageFilter").takeIf { it.isNotEmpty() }
        val includeHistorical = data.getBoolean("includeHistorical")
        
        Log.d(TAG_SOCKET, "Log request received - Session: $sessionId, Tags: $tags, Package: $packageFilter")
        
        val session = LogSession(
            sessionId = sessionId,
            tags = tags,
            packageFilter = packageFilter,
            includeHistorical = includeHistorical,
            startTime = System.currentTimeMillis()
        )
        
        activeSessions[sessionId] = session
        
        // Send historical logs first if requested
        if (includeHistorical) {
            sendHistoricalLogs(session)
        }
        
        // Start real-time streaming
        startRealtimeStreaming(session)
        
    } catch (e: Exception) {
        Log.e(TAG_SOCKET, "Error handling log request", e)
        sendError(data.optString("sessionId"), "Failed to start log streaming: ${e.message}")
    }
}

private fun JSONArray.toStringList(): List<String> {
    return (0 until length()).map { getString(it) }
}
```

### **5. Historical Logs Implementation**

```kotlin
private fun sendHistoricalLogs(session: LogSession) {
    val filteredLogs = historicalLogs.toList()
        .filter { log -> shouldIncludeLog(log, session.tags, session.packageFilter) }
    
    if (filteredLogs.isNotEmpty()) {
        val data = JSONObject().apply {
            put("type", "historical")
            put("sessionId", session.sessionId)
            put("logs", JSONArray(filteredLogs.map { it.toJson() }))
        }
        
        socket.emit("logsData", data)
        Log.d(TAG_SOCKET, "Sent ${filteredLogs.size} historical logs for session ${session.sessionId}")
    }
}

// Store logs in circular buffer for historical access
private fun storeLogEntry(logEntry: LogEntry) {
    historicalLogs.add(logEntry)
}
```

### **6. Real-time Log Streaming**

```kotlin
private fun startRealtimeStreaming(session: LogSession) {
    CoroutineScope(Dispatchers.IO).launch {
        try {
            val logcatCommand = buildLogcatCommand(session.tags, session.packageFilter)
            val process = Runtime.getRuntime().exec(logcatCommand)
            session.logcatProcess = process
            
            process.inputStream.bufferedReader().use { reader ->
                while (session.isActive && !Thread.currentThread().isInterrupted) {
                    val line = reader.readLine() ?: break
                    
                    val logEntry = parseLogLine(line)
                    if (logEntry != null && shouldIncludeLog(logEntry, session.tags, session.packageFilter)) {
                        // Store for historical access
                        storeLogEntry(logEntry)
                        
                        // Send real-time
                        sendRealtimeLog(session.sessionId, logEntry)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG_SOCKET, "Error in real-time streaming for session ${session.sessionId}", e)
            sendError(session.sessionId, "Real-time streaming error: ${e.message}")
        }
    }
}

private fun buildLogcatCommand(tags: List<String>, packageFilter: String?): Array<String> {
    val command = mutableListOf("logcat", "-v", "time")
    
    // Handle ALL tag for complete logcat
    if (tags.contains(TAG_ALL)) {
        // No additional filters - stream everything
        return command.toTypedArray()
    }
    
    // Add tag filters
    if (tags.isNotEmpty()) {
        val tagFilter = tags.joinToString(" ") { "$it:V" }
        command.add(tagFilter)
        command.add("*:S") // Silence other tags
    }
    
    // Package filtering is handled in shouldIncludeLog() for flexibility
    
    return command.toTypedArray()
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

### **7. Log Parsing & Filtering**

```kotlin
private fun parseLogLine(line: String): LogEntry? {
    try {
        // Parse Android logcat format: "MM-DD HH:MM:SS.mmm PID TID LEVEL TAG: MESSAGE"
        val regex = Regex("""(\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+([^:]+):\s*(.*)""")
        val match = regex.find(line) ?: return null
        
        val (timestamp, pid, tid, level, tag, message) = match.destructured
        
        // Convert single letter level to full word
        val fullLevel = when (level) {
            "V" -> "VERBOSE"
            "D" -> "DEBUG"
            "I" -> "INFO"
            "W" -> "WARN"
            "E" -> "ERROR"
            "F" -> "FATAL"
            else -> level
        }
        
        // Try to extract package name from message or use current app package
        val packageName = extractPackageName(message) ?: context.packageName
        
        return LogEntry(
            deviceId = DEVICE_ID,
            timestamp = formatTimestamp(timestamp),
            level = fullLevel,
            tag = tag.trim(),
            message = message.trim(),
            packageName = packageName,
            threadId = tid,
            processId = pid
        )
    } catch (e: Exception) {
        Log.w(TAG_SOCKET, "Failed to parse log line: $line", e)
        return null
    }
}

private fun shouldIncludeLog(logEntry: LogEntry, tags: List<String>, packageFilter: String?): Boolean {
    // Check package filter first (most restrictive)
    if (packageFilter != null) {
        val targetPackage = packageFilter.removePrefix("package:")
        if (logEntry.packageName != targetPackage) {
            return false
        }
    }
    
    // If no tags specified or ALL tag present, include all logs
    if (tags.isEmpty() || tags.contains(TAG_ALL)) {
        return true
    }
    
    // Check if log tag matches any of the requested tags
    return tags.contains(logEntry.tag)
}

private fun extractPackageName(message: String): String? {
    // Try to extract package name from common log message patterns
    val patterns = listOf(
        Regex("""package:([a-zA-Z0-9._]+)"""),
        Regex("""([a-zA-Z0-9._]+\.[a-zA-Z0-9._]+\.[a-zA-Z0-9._]+)""") // Basic package pattern
    )
    
    for (pattern in patterns) {
        val match = pattern.find(message)
        if (match != null) {
            return match.groupValues[1]
        }
    }
    
    return null
}
```

### **8. Session Management & Cleanup**

```kotlin
private fun handleStopRequest(data: JSONObject) {
    val sessionId = data.optString("sessionId").takeIf { it.isNotEmpty() }
    
    if (sessionId != null) {
        stopLogSession(sessionId)
    } else {
        // Stop all sessions for this device
        stopAllSessions()
    }
}

private fun stopLogSession(sessionId: String) {
    activeSessions[sessionId]?.let { session ->
        session.isActive = false
        session.logcatProcess?.destroy()
        activeSessions.remove(sessionId)
        
        Log.d(TAG_SOCKET, "Stopped log session: $sessionId")
    }
}

private fun stopAllSessions() {
    activeSessions.values.forEach { session ->
        session.isActive = false
        session.logcatProcess?.destroy()
    }
    activeSessions.clear()
    Log.d(TAG_SOCKET, "Stopped all log sessions")
}

private fun cleanupAllSessions() {
    stopAllSessions()
    // Additional cleanup if needed
}

private fun sendError(sessionId: String, errorMessage: String) {
    val errorData = JSONObject().apply {
        put("sessionId", sessionId)
        put("deviceId", DEVICE_ID)
        put("error", errorMessage)
        put("timestamp", System.currentTimeMillis())
    }
    
    socket.emit("logStreamingError", errorData)
}
```

### **9. Utility Classes**

```kotlin
// CircularBuffer.kt - For storing historical logs
class CircularBuffer<T>(private val capacity: Int) {
    private val buffer = arrayOfNulls<Any>(capacity) as Array<T?>
    private var head = 0
    private var tail = 0
    private var size = 0
    
    fun add(item: T) {
        buffer[tail] = item
        tail = (tail + 1) % capacity
        
        if (size < capacity) {
            size++
        } else {
            head = (head + 1) % capacity
        }
    }
    
    fun toList(): List<T> {
        val result = mutableListOf<T>()
        var current = head
        
        repeat(size) {
            buffer[current]?.let { result.add(it) }
            current = (current + 1) % capacity
        }
        
        return result
    }
}
```

### **10. Integration with Your App**

```kotlin
// In your Application class or main activity
class TvAdApplication : Application() {
    private lateinit var logStreamingManager: LogStreamingManager
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize log streaming
        logStreamingManager = LogStreamingManager(this)
        logStreamingManager.connect()
    }
    
    override fun onTerminate() {
        super.onTerminate()
        logStreamingManager.disconnect()
    }
}

// Usage in your activities/services
class VideoActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Your existing code...
        
        // Log important events with appropriate tags
        Log.d(LogStreamingManager.TAG_VIDEO, "Video activity created")
        Log.i(LogStreamingManager.TAG_LIFECYCLE, "VideoActivity onCreate")
    }
    
    private fun startVideoPlayback() {
        Log.d(LogStreamingManager.TAG_MEDIA_PLAYBACK, "Starting video playback")
        // Your video playback code...
    }
}
```

This specification provides a complete implementation guide for integrating the log streaming functionality into your Kotlin Android TV app. The backend is fully compatible with these data formats and event structures! 🚀
